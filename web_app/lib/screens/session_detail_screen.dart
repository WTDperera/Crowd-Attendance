import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/firestore_service.dart';
import '../models/session_model.dart';
import '../models/attendance_model.dart';

class SessionDetailScreen extends StatefulWidget {
  final String sessionId;
  const SessionDetailScreen({super.key, required this.sessionId});

  @override
  State<SessionDetailScreen> createState() =>
      _SessionDetailScreenState();
}

class _SessionDetailScreenState extends State<SessionDetailScreen> {
  final _firestoreService = FirestoreService();
  SessionModel? _session;
  String _lecturerName = '';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    try {
      final session =
          await _firestoreService.getSession(widget.sessionId);
      String name = '';
      if (session != null) {
        name = await _firestoreService
            .getLecturerName(session.lecturerId);
      }
      if (mounted) {
        setState(() {
          _session = session;
          _lecturerName = name;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A0E21),
        foregroundColor: Colors.white,
        title: Text(_session?.moduleCode ?? 'Session Detail'),
        actions: [
          if (_session?.isActive == true)
            TextButton.icon(
              onPressed: _endSession,
              icon: const Icon(Icons.stop_circle,
                  color: Colors.orange),
              label: const Text('End Session',
                  style: TextStyle(color: Colors.orange)),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _session == null
              ? const Center(child: Text('Session not found'))
              : _buildBody(),
    );
  }

  Widget _buildBody() {
    final s = _session!;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Session Info Card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text('Session Information',
                          style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold)),
                      const Spacer(),
                      _StatusBadge(isActive: s.isActive),
                    ],
                  ),
                  const Divider(height: 24),
                  Wrap(
                    spacing: 40,
                    runSpacing: 16,
                    children: [
                      _InfoItem(
                          label: 'Module',
                          value: s.moduleCode),
                      _InfoItem(
                          label: 'Topic',
                          value: s.sessionTopic),
                      _InfoItem(
                          label: 'Lecturer',
                          value: _lecturerName),
                      _InfoItem(
                          label: 'Students Present',
                          value: '${s.studentCount}'),
                      _InfoItem(
                          label: 'Started',
                          value: s.createdAt != null
                              ? DateFormat('MMM d, yyyy  hh:mm a')
                                  .format(s.createdAt!)
                              : '—'),
                      if (s.endedAt != null)
                        _InfoItem(
                            label: 'Ended',
                            value: DateFormat('MMM d, yyyy  hh:mm a')
                                .format(s.endedAt!)),
                    ],
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 24),

          // Attendance Table
          const Text('Attendance Records',
              style: TextStyle(
                  fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),

          StreamBuilder<List<AttendanceModel>>(
            stream:
                _firestoreService.getAttendanceStream(widget.sessionId),
            builder: (context, snapshot) {
              if (snapshot.connectionState ==
                  ConnectionState.waiting) {
                return const Center(
                    child: CircularProgressIndicator());
              }
              final records = snapshot.data ?? [];

              if (records.isEmpty) {
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(40),
                    child: Column(
                      children: [
                        Icon(Icons.people_outline,
                            size: 48,
                            color: Colors.grey.shade300),
                        const SizedBox(height: 12),
                        Text('No attendance records yet',
                            style: TextStyle(
                                color: Colors.grey.shade500)),
                      ],
                    ),
                  ),
                );
              }

              return Card(
                clipBehavior: Clip.hardEdge,
                child: Table(
                  columnWidths: const {
                    0: FixedColumnWidth(50),
                    1: FlexColumnWidth(2),
                    2: FlexColumnWidth(3),
                    3: FlexColumnWidth(2),
                    4: FixedColumnWidth(80),
                  },
                  children: [
                    // Header
                    TableRow(
                      decoration: BoxDecoration(
                          color: Colors.grey.shade100),
                      children: const [
                        _TableHeader('#'),
                        _TableHeader('Reg. No.'),
                        _TableHeader('Marked At'),
                        _TableHeader('Signal (RSSI)'),
                        _TableHeader('Status'),
                      ],
                    ),
                    // Rows
                    ...records.asMap().entries.map((e) {
                      final i = e.key;
                      final r = e.value;
                      final bg = i.isEven
                          ? Colors.white
                          : Colors.grey.shade50;
                      return TableRow(
                        decoration: BoxDecoration(color: bg),
                        children: [
                          _TableCell('${i + 1}',
                              color: Colors.grey.shade500),
                          _TableCell(r.regNo.toUpperCase(),
                              bold: true),
                          _TableCell(
                            r.markedAt != null
                                ? DateFormat('MMM d, hh:mm:ss a')
                                    .format(r.markedAt!)
                                : '—',
                          ),
                          _TableCell('${r.rssi} dBm',
                              color: _rssiColor(r.rssi)),
                          Padding(
                            padding: const EdgeInsets.symmetric(
                                vertical: 10, horizontal: 12),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: Colors.green.shade50,
                                borderRadius:
                                    BorderRadius.circular(10),
                              ),
                              child: const Text(
                                'Present',
                                style: TextStyle(
                                  color: Colors.green,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ),
                        ],
                      );
                    }),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Color _rssiColor(int rssi) {
    if (rssi >= -60) return Colors.green;
    if (rssi >= -80) return Colors.orange;
    return Colors.red;
  }

  Future<void> _endSession() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('End Session'),
        content: const Text(
            'Are you sure you want to end this active session?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
                backgroundColor: Colors.orange),
            child: const Text('End Session',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await _firestoreService.endSession(widget.sessionId);
      await _loadSession();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Session ended.')));
      }
    }
  }
}

class _InfoItem extends StatelessWidget {
  final String label;
  final String value;
  const _InfoItem({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                color: Colors.grey, fontSize: 12)),
        const SizedBox(height: 4),
        Text(value,
            style: const TextStyle(
                fontWeight: FontWeight.bold, fontSize: 15)),
      ],
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final bool isActive;
  const _StatusBadge({required this.isActive});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color:
            isActive ? Colors.orange.shade50 : Colors.green.shade50,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isActive ? Colors.orange : Colors.green,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            isActive ? 'Active' : 'Completed',
            style: TextStyle(
              fontSize: 12,
              color: isActive
                  ? Colors.orange.shade800
                  : Colors.green.shade800,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}

class _TableHeader extends StatelessWidget {
  final String text;
  const _TableHeader(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
          vertical: 12, horizontal: 12),
      child: Text(
        text,
        style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 13,
            color: Colors.grey),
      ),
    );
  }
}

class _TableCell extends StatelessWidget {
  final String text;
  final bool bold;
  final Color? color;
  const _TableCell(this.text, {this.bold = false, this.color});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
          vertical: 12, horizontal: 12),
      child: Text(
        text,
        style: TextStyle(
          fontWeight:
              bold ? FontWeight.bold : FontWeight.normal,
          color: color,
          fontSize: 13,
        ),
      ),
    );
  }
}
