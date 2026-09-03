import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:permission_handler/permission_handler.dart';
import '../services/session_service.dart';

class ScannerScreen extends StatefulWidget {
  final String sessionId;

  const ScannerScreen({super.key, required this.sessionId});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final _sessionService = SessionService();
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  
  // 🎯 CRITICAL: Must match Student App's SERVICE_UUID exactly!
  static const String SERVICE_UUID = 'bf27730d-860a-4e09-8f3c-7a2b5d9e4f1c';
  
  bool _isScanning = false;
  Map<String, dynamic> _sessionData = {};
  Set<String>? _enrolledRegNos;
  Map<String, Map<String, dynamic>> _detectedStudents = {}; // regNo -> data
  StreamSubscription? _sessionStream;
  StreamSubscription? _attendanceStream;
  StreamSubscription? _scanSubscription;
  
  Set<String> _scannedInCurrentRound = {}; // Track students scanned in the current active round
  int _devicesFound = 0; // Debug counter

  @override
  void initState() {
    super.initState();
    _initializeScanner();
  }

  @override
  void dispose() {
    _stopScanning();
    _sessionStream?.cancel();
    _attendanceStream?.cancel();
    _scanSubscription?.cancel();
    super.dispose();
  }

  Future<void> _initializeScanner() async {
    // Listen to session updates
    _sessionStream = _sessionService.getSessionStream(widget.sessionId).listen(
      (snapshot) async {
        if (snapshot.exists && mounted) {
          final data = snapshot.data() as Map<String, dynamic>;
          setState(() {
            _sessionData = data;
          });
          
          if (_enrolledRegNos == null) {
            final code = data['module_code'] ?? data['module'] ?? '';
            if (code.isNotEmpty) {
              await _fetchEnrolledStudents(code);
            }
          }
        }
      },
    );

    // Listen to attendance records
    _attendanceStream = _sessionService
        .getAttendanceRecordsStream(widget.sessionId)
        .listen(
      (snapshot) {
        if (mounted) {
          final students = <String, Map<String, dynamic>>{};
          for (var doc in snapshot.docs) {
            final data = doc.data() as Map<String, dynamic>;
            students[data['reg_no']] = data;
          }
          setState(() => _detectedStudents = students);
        }
      },
    );

    // Note: removed auto-start scanning. The user must manually start a scan round.
  }

  Future<void> _fetchEnrolledStudents(String moduleCode) async {
    try {
      final moduleKey = moduleCode.toUpperCase().trim();
      final snap = await _firestore
          .collection('students')
          .where('enrolled_module_ids', arrayContains: moduleKey)
          .get();
      
      final regNos = <String>{};
      for (var doc in snap.docs) {
        final data = doc.data();
        if (data['reg_no'] != null) {
          regNos.add(data['reg_no'].toString().trim());
        }
      }
      
      if (mounted) {
        setState(() {
          _enrolledRegNos = regNos;
        });
      }
      print("🎓 Fetched ${regNos.length} enrolled students for module $moduleKey");
    } catch (e) {
      print("❌ Error fetching enrolled students: $e");
    }
  }

  Future<void> _requestPermissions() async {
    if (await Permission.bluetoothScan.isDenied) {
      await Permission.bluetoothScan.request();
    }
    if (await Permission.bluetoothConnect.isDenied) {
      await Permission.bluetoothConnect.request();
    }
    if (await Permission.location.isDenied) {
      await Permission.location.request();
    }
  }

  Future<void> _startScanning() async {
    try {
      await _requestPermissions();

      // Check if Bluetooth is on
      if (await FlutterBluePlus.isSupported == false) {
        throw Exception('Bluetooth not supported on this device');
      }

      setState(() {
        _isScanning = true;
        _devicesFound = 0;
        _scannedInCurrentRound.clear(); // Reset for the new round
      });

      print("========================================");
      print("🔵 LECTURER APP: Starting BLE Scan");
      print("🎯 Target Service UUID: $SERVICE_UUID");
      print("========================================");

      // 🎯 CRITICAL FIX: Scan specifically for the Service UUID
      // This is much more reliable than scanning everything and filtering by name
      await FlutterBluePlus.startScan(
        withServices: [Guid(SERVICE_UUID)], // ← Only detect matching UUID!
        timeout: const Duration(minutes: 30),
        androidUsesFineLocation: true,
      );

      // Listen to scan results
      _scanSubscription = FlutterBluePlus.scanResults.listen(
        (results) {
          print("📡 Scan results received: ${results.length} devices");
          for (ScanResult r in results) {
            _processScanResult(r);
          }
        },
        onError: (e) {
          print("❌ Scan error: $e");
          _showError('Scan error: $e');
        },
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('📡 Scanning for UUID: ${SERVICE_UUID.substring(0, 20)}...'),
            backgroundColor: Colors.green,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      print("❌ Failed to start scanning: $e");
      _showError('Failed to start scanning: $e');
      setState(() => _isScanning = false);
    }
  }

  Future<void> _stopScanning() async {
    try {
      if (!_isScanning) return;
      await FlutterBluePlus.stopScan();
      setState(() => _isScanning = false);
      
      // Increment the scans_performed counter in Firestore when a round is stopped
      await _sessionService.incrementScanRound(widget.sessionId);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Scan Round completed and saved.'),
            backgroundColor: Colors.blue,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      // Ignore errors when stopping
    }
  }

  void _processScanResult(ScanResult result) async {
    try {
      _devicesFound++;
      
      print("\n========================================");
      print("📱 DEVICE DETECTED #$_devicesFound");
      print("========================================");
      
      // Extract device information
      String deviceName = result.device.platformName;
      if (deviceName.isEmpty && result.advertisementData.advName.isNotEmpty) {
        deviceName = result.advertisementData.advName;
      }
      String deviceId = result.device.remoteId.toString();
      
      print("📋 Device Info:");
      print("   Name: $deviceName");
      print("   ID: $deviceId");
      print("   RSSI: ${result.rssi} dBm");
      
      // Debug: Print service UUIDs
      print("📡 Advertised Services:");
      if (result.advertisementData.serviceUuids.isEmpty) {
        print("   (None found - this shouldn't happen if UUID filter works)");
      } else {
        for (var uuid in result.advertisementData.serviceUuids) {
          print("   - $uuid");
        }
      }
      
      // Extract registration number from manufacturer data (secure method)
      final Map<int, List<int>> manufacturerDataMap =
          result.advertisementData.manufacturerData;

      print("🔒 Checking manufacturer data...");
      print("   Available Company IDs: ${manufacturerDataMap.keys.toList()}");

      if (!manufacturerDataMap.containsKey(0xFFFF)) {
        print("⚠️  Device missing manufacturer data with Company ID 0xFFFF - SKIPPED");
        print("========================================");
        return;
      }

      final List<int> regNoBytesList = manufacturerDataMap[0xFFFF]!;

      print("📦 Manufacturer Data Found:");
      print("   Company ID: 0xFFFF (Unreserved)");
      print("   Data Length: ${regNoBytesList.length} bytes");
      print("   Raw Bytes: $regNoBytesList");

      String regNo;
      try {
        regNo = String.fromCharCodes(regNoBytesList).replaceAll('\x00', '').trim();
      } catch (e) {
        print("❌ Failed to decode manufacturer data: $e");
        print("========================================");
        return;
      }

      print("🎓 Processing Student:");
      print("   RegNo extracted: $regNo");

      // Check if already marked IN THIS ROUND
      if (_scannedInCurrentRound.contains(regNo)) {
        print("⏭️  Already marked in current round - skipping");
        print("========================================");
        return;
      }
      
      // Filter unregistered students
      if (_enrolledRegNos != null && !_enrolledRegNos!.contains(regNo)) {
        print("⛔ Unregistered student detected - ignoring: $regNo");
        print("========================================");
        return;
      }
      
      _scannedInCurrentRound.add(regNo);

      // Verify student exists in Firestore
      print("🔍 Querying Firebase for student: $regNo");
      final studentQuery = await _firestore
          .collection('students')
          .where('reg_no', isEqualTo: regNo)
          .limit(1)
          .get();

      if (studentQuery.docs.isEmpty) {
        print("❌ Student not found in database for reg_no: $regNo");
        print("========================================");
        return;
      }

      final studentDoc = studentQuery.docs.first;
      final studentData = studentDoc.data();
      
      print("✅ Student verified in Firebase:");
      print("   Name: ${studentData['name'] ?? 'N/A'}");
      print("   Email: ${studentData['email'] ?? 'N/A'}");

      // Mark attendance
      print("💾 Marking attendance...");
      await _sessionService.markAttendance(
        sessionId: widget.sessionId,
        studentId: studentDoc.id,
        regNo: regNo,
        rssi: result.rssi,
      );
      
      print("✅ Attendance marked successfully!");
      print("========================================");

      // Show notification
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('✅ ${studentData['name'] ?? regNo.toUpperCase()} marked present'),
            backgroundColor: Colors.green,
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      print("❌ Error processing scan result: $e");
      print("========================================");
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
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1D1E33),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
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

    if (confirm == true) {
      await _stopScanning();
      await _sessionService.endSession(widget.sessionId);
      if (mounted) {
        Navigator.of(context).pop();
      }
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
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Session info card
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.purple.shade400,
                    Colors.deepPurple.shade600,
                  ],
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
                                        valueColor: AlwaysStoppedAnimation<Color>(Colors.orangeAccent),
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
                        const Icon(
                          Icons.people,
                          color: Colors.white,
                          size: 32,
                        ),
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
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            
            // Scan Controls
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              child: SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: _isScanning ? _stopScanning : _startScanning,
                  icon: Icon(
                    _isScanning ? Icons.stop_circle_outlined : Icons.radar,
                    color: Colors.white,
                  ),
                  label: Text(
                    _isScanning ? 'Stop Current Scan Round' : 'Start New Scan Round',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _isScanning ? Colors.orange.shade700 : Colors.blue.shade600,
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
                                              padding: EdgeInsets.only(right: 2.0),
                                              child: Icon(Icons.star, color: Colors.amber, size: 14),
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
                  onPressed: _endSession,
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
