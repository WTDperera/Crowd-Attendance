import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../services/scanner_bindings.dart';
import '../services/round_scanner_controller.dart';
import '../services/detection_gate.dart';

class ScannerScreen extends StatefulWidget {
  final String sessionId;
  final ScannerBindings? bindings;

  const ScannerScreen({super.key, required this.sessionId, this.bindings});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  late final ScannerBindings _bindings;
  late final RoundScannerController _rounds;
  bool _isScanning = false;
  bool _busy = false;
  bool _ending = false;
  String? _sessionError;
  bool get _unavailable =>
      _busy ||
      _ending ||
      _sessionData['status'] != 'active' ||
      _sessionError != null;
  Map<String, dynamic> _sessionData = {};
  Map<String, Map<String, dynamic>> _detectedStudents = {};
  int _devicesFound = 0;
  StreamSubscription? _sessionStream,
      _attendanceStream,
      _scanSubscription,
      _radioStream;

  @override
  void initState() {
    super.initState();
    _bindings = widget.bindings ?? ScannerBindings.forSession(widget.sessionId);
    _rounds = _bindings.rounds;
    _sessionStream = _bindings.session.listen(
      (data) {
        if (mounted) {
          setState(() {
            _sessionData = data ?? {};
            _sessionError = data == null
                ? 'Session not found. Return to your sessions.'
                : null;
          });
        }
      },
      onError: (Object error) {
        if (mounted) {
          setState(() => _sessionError = 'Cannot load session: $error');
        }
      },
    );
    _attendanceStream = _bindings.attendance.listen((data) {
      if (mounted) setState(() => _detectedStudents = data);
    }, onError: (Object error) => _showError('Cannot load attendance: $error'));
    _radioStream = _bindings.radio.listen((running) {
      if (!running && _isScanning) {
        _rounds.gate.pause(); // timeout/radio loss pauses, never completes
        if (mounted) setState(() => _isScanning = false);
      }
    });
  }

  @override
  void dispose() {
    _rounds.dispose();
    _sessionStream?.cancel();
    _attendanceStream?.cancel();
    _scanSubscription?.cancel();
    _radioStream?.cancel();
    unawaited(_bindings.stopRadio().catchError((Object _) {}));
    super.dispose();
  }

  Future<void> _startScanning() async {
    if (_unavailable) return;
    setState(() => _busy = true);
    try {
      await _bindings.requestRadio();
      if (!mounted) return;
      await _rounds.start();
      if (!mounted) return;
      await _scanSubscription?.cancel();
      if (!mounted) return;
      _scanSubscription = _bindings.results.listen(
        (results) {
          for (final result in results) {
            _processScanResult(result);
          }
        },
        onError: (Object error) {
          _rounds.gate.pause();
          if (mounted) setState(() => _isScanning = false);
          _showError('Scan paused: $error');
        },
      );
      await _bindings.startRadio();
      if (!mounted) {
        await _bindings.stopRadio();
        return;
      }
      if (mounted) {
        setState(() {
          _isScanning = true;
          _devicesFound = 0;
        });
      }
    } catch (error) {
      _rounds.gate.pause();
      _showError('Scan not started: $error. Retry resumes the saved round.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _processScanResult(ScanResult result) async {
    try {
      final saved = await _rounds.process(
        result.advertisementData.manufacturerData,
        result.rssi,
      );
      if (mounted && saved == DetectionResult.saved) {
        setState(() => _devicesFound++);
      }
    } catch (error) {
      _showError(
        'Attendance not saved: $error. Resume and retry before completing.',
      );
    }
  }

  Future<void> _stopScanning({bool cancel = false}) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      _rounds.gate.pause();
      await _bindings.stopRadio();
      await _scanSubscription?.cancel();
      if (!mounted) return;
      if (mounted) setState(() => _isScanning = false);
      _rounds.currentRound ??= _sessionData['active_round_id'] as String?;
      await _rounds.complete(cancel: cancel);
    } catch (error) {
      _showError('Round not completed: $error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showError(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: Colors.red.shade700,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _endSession() async {
    if (_unavailable) return;
    setState(() => _ending = true);
    try {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          backgroundColor: const Color(0xFF1D1E33),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: const Text(
            'End Session',
            style: TextStyle(color: Colors.white),
          ),
          content: Text(
            'Are you sure you want to end this session?\n\n${_detectedStudents.length} students marked present.',
            style: const TextStyle(color: Colors.grey),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(
                'Cancel',
                style: TextStyle(color: Colors.grey.shade400),
              ),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red.shade600,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text(
                'End Session',
                style: TextStyle(color: Colors.white),
              ),
            ),
          ],
        ),
      );

      if (!mounted) return;
      if (confirm == true) {
        if (_isScanning ||
            _rounds.currentRound != null ||
            _sessionData['active_round_id'] != null) {
          await _stopScanning();
        }
        if (_rounds.currentRound != null) return;
        try {
          if (!mounted) return;
          await _bindings.endSession();
        } catch (error) {
          _showError('Session not completed: $error');
          return;
        }
        if (mounted) {
          Navigator.of(context).pop();
        }
      }
    } finally {
      if (mounted) setState(() => _ending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E21),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1D1E33),
        elevation: 0,
        title: const Text(
          'Live Scanner',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (_sessionError != null)
              Text(
                _sessionError!,
                style: const TextStyle(color: Colors.redAccent),
              ),
            if (_rounds.currentRound != null ||
                _sessionData['active_round_id'] != null)
              TextButton(
                onPressed: _unavailable
                    ? null
                    : () => _stopScanning(cancel: true),
                child: const Text('Cancel open round'),
              ),
            // Session info card
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [Colors.purple.shade400, Colors.deepPurple.shade600],
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.purple.withOpacity(0.3),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _sessionData['module_code'] ?? 'Loading...',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _sessionData['session_topic'] ?? '',
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            const Text(
                              'Completed Rounds',
                              style: TextStyle(
                                color: Colors.white70,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Wrap(
                              spacing: 4,
                              children: [
                                if ((_sessionData['scans_performed'] ?? 0) == 0)
                                  const Text(
                                    '0',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 14,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ...List.generate(
                                  _sessionData['scans_performed'] ?? 0,
                                  (index) => const Icon(
                                    Icons.check_circle,
                                    color: Colors.greenAccent,
                                    size: 16,
                                  ),
                                ),
                                if (_isScanning)
                                  const Padding(
                                    padding: EdgeInsets.only(left: 4.0),
                                    child: SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        valueColor:
                                            AlwaysStoppedAnimation<Color>(
                                              Colors.orangeAccent,
                                            ),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.people, color: Colors.white, size: 32),
                        const SizedBox(width: 12),
                        Text(
                          '${_detectedStudents.length}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 36,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          'Present',
                          style: TextStyle(color: Colors.white70, fontSize: 16),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Scan Controls
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: 16.0,
                vertical: 8.0,
              ),
              child: SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: _unavailable
                      ? null
                      : _isScanning
                      ? () => _stopScanning()
                      : _startScanning,
                  icon: Icon(
                    _isScanning ? Icons.stop_circle_outlined : Icons.radar,
                    color: Colors.white,
                  ),
                  label: Text(
                    _isScanning
                        ? 'Complete Scan Round'
                        : (_rounds.currentRound != null ||
                                  _sessionData['active_round_id'] != null
                              ? 'Resume Scan Round'
                              : 'Start New Scan Round'),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _isScanning
                        ? Colors.orange.shade700
                        : Colors.blue.shade600,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 4,
                  ),
                ),
              ),
            ),

            // Students list
            Expanded(
              child: _detectedStudents.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.radar,
                            size: 80,
                            color: Colors.cyan.withOpacity(0.3),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            _isScanning
                                ? 'Scanning for students...'
                                : 'Start scanning to detect students',
                            style: TextStyle(
                              color: Colors.grey.shade500,
                              fontSize: 16,
                            ),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: _detectedStudents.length,
                      itemBuilder: (context, index) {
                        final regNo = _detectedStudents.keys.elementAt(index);
                        final data = _detectedStudents[regNo]!;
                        final timestamp = (data['marked_at'] as Timestamp?)
                            ?.toDate();

                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1D1E33),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: Colors.green.withOpacity(0.3),
                              width: 1,
                            ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Colors.green.withOpacity(0.2),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.check_circle,
                                  color: Colors.green,
                                  size: 24,
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      regNo.toUpperCase(),
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    if (timestamp != null) ...[
                                      const SizedBox(height: 4),
                                      Row(
                                        children: [
                                          ...List.generate(
                                            data['scan_count'] ?? 1,
                                            (index) => const Padding(
                                              padding: EdgeInsets.only(
                                                right: 2.0,
                                              ),
                                              child: Icon(
                                                Icons.star,
                                                color: Colors.amber,
                                                size: 14,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Text(
                                            '${timestamp.hour.toString().padLeft(2, '0')}:${timestamp.minute.toString().padLeft(2, '0')}',
                                            style: TextStyle(
                                              color: Colors.grey.shade400,
                                              fontSize: 12,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.green.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      Icons.signal_cellular_alt,
                                      color: Colors.green.shade400,
                                      size: 14,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      '${data['rssi']} dBm',
                                      style: TextStyle(
                                        color: Colors.green.shade400,
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),

            // End session button
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF1D1E33),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.2),
                    blurRadius: 10,
                    offset: const Offset(0, -5),
                  ),
                ],
              ),
              child: SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _unavailable ? null : _endSession,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red.shade600,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.stop_circle, color: Colors.white),
                      SizedBox(width: 12),
                      Text(
                        'END SESSION',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
