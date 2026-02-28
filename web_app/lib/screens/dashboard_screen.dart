import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/firestore_service.dart';
import '../models/session_model.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _firestoreService = FirestoreService();
  Map<String, int> _stats = {
    'students': 0,
    'lecturers': 0,
    'sessions': 0,
    'activeSessions': 0,
  };
  bool _statsLoading = true;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    try {
      final stats = await _firestoreService.getDashboardStats();
      if (mounted) setState(() {
        _stats = stats;
        _statsLoading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _statsLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Dashboard',
                        style: TextStyle(
                            fontSize: 28, fontWeight: FontWeight.bold)),
                    SizedBox(height: 4),
                    Text('BLE Attendance System Overview',
                        style: TextStyle(
                            color: Colors.grey, fontSize: 14)),
                  ],
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.refresh),
                  tooltip: 'Refresh Stats',
                  onPressed: () {
                    setState(() => _statsLoading = true);
                    _loadStats();
                  },
                ),
              ],
            ),
            const SizedBox(height: 28),

            // Stats Cards
            if (_statsLoading)
              const Center(child: CircularProgressIndicator())
            else
              Wrap(
                spacing: 16,
                runSpacing: 16,
                children: [
                  _StatCard(
                    title: 'Total Students',
                    value: _stats['students']!,
                    icon: Icons.school,
                    color: Colors.blue.shade600,
                    bgColor: Colors.blue.shade50,
                  ),
                  _StatCard(
                    title: 'Lecturers',
                    value: _stats['lecturers']!,
                    icon: Icons.person,
                    color: Colors.purple.shade600,
                    bgColor: Colors.purple.shade50,
                  ),
                  _StatCard(
                    title: 'Total Sessions',
                    value: _stats['sessions']!,
                    icon: Icons.event,
                    color: Colors.teal.shade600,
                    bgColor: Colors.teal.shade50,
                  ),
                  _StatCard(
                    title: 'Active Sessions',
                    value: _stats['activeSessions']!,
                    icon: Icons.wifi_tethering,
                    color: Colors.orange.shade700,
                    bgColor: Colors.orange.shade50,
                  ),
                ],
              ),

            const SizedBox(height: 32),

            // Active Sessions Section
            const Text('Active Sessions',
                style:
                    TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            StreamBuilder<List<SessionModel>>(
              stream: _firestoreService.getActiveSessionsStream(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                final sessions = snapshot.data ?? [];
                if (sessions.isEmpty) {
                  return _EmptyState(
                    icon: Icons.wifi_off,
                    message: 'No active sessions right now',
                  );
                }
                return Column(
                  children: sessions
                      .map((s) => _ActiveSessionCard(session: s))
                      .toList(),
                );
              },
            ),

            const SizedBox(height: 32),

            // Recent Sessions
            const Text('Recent Sessions',
                style:
                    TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            StreamBuilder<List<SessionModel>>(
              stream: _firestoreService.getSessionsStream(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                final sessions =
                    (snapshot.data ?? []).take(10).toList();
                if (sessions.isEmpty) {
                  return _EmptyState(
                    icon: Icons.history,
                    message: 'No sessions created yet',
                  );
                }
                return Card(
                  elevation: 1,
                  child: Column(
                    children: sessions.asMap().entries.map((e) {
                      final session = e.value;
                      return _RecentSessionTile(
                        session: session,
                        isLast: e.key == sessions.length - 1,
                      );
                    }).toList(),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final int value;
  final IconData icon;
  final Color color;
  final Color bgColor;

  const _StatCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
    required this.bgColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 200,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          )
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value.toString(),
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
              ),
              Text(title,
                  style: const TextStyle(
                      color: Colors.grey, fontSize: 12)),
            ],
          ),
        ],
      ),
    );
  }
}

class _ActiveSessionCard extends StatelessWidget {
  final SessionModel session;
  const _ActiveSessionCard({required this.session});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.orange.shade50,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(Icons.wifi_tethering,
                  color: Colors.orange.shade700, size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(session.moduleCode,
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 15)),
                  Text(session.sessionTopic,
                      style: const TextStyle(
                          color: Colors.grey, fontSize: 13)),
                ],
              ),
            ),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.green.shade50,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.green,
                    ),
                  ),
                  const SizedBox(width: 6),
                  const Text('Live',
                      style:
                          TextStyle(color: Colors.green, fontSize: 12)),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Text(
              '${session.studentCount} students',
              style: const TextStyle(
                  fontWeight: FontWeight.bold, fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }
}

class _RecentSessionTile extends StatelessWidget {
  final SessionModel session;
  final bool isLast;
  const _RecentSessionTile(
      {required this.session, required this.isLast});

  @override
  Widget build(BuildContext context) {
    final dateStr = session.createdAt != null
        ? DateFormat('MMM d, yyyy  hh:mm a').format(session.createdAt!)
        : 'Unknown date';

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: session.isActive
                      ? Colors.orange.shade50
                      : Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(Icons.event,
                    color: session.isActive
                        ? Colors.orange.shade700
                        : Colors.grey.shade500,
                    size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(session.moduleCode,
                        style: const TextStyle(
                            fontWeight: FontWeight.bold)),
                    Text(session.sessionTopic,
                        style: const TextStyle(
                            color: Colors.grey, fontSize: 12)),
                  ],
                ),
              ),
              Text(dateStr,
                  style: const TextStyle(
                      color: Colors.grey, fontSize: 12)),
              const SizedBox(width: 12),
              Chip(
                label: Text(
                  session.isActive ? 'Active' : 'Done',
                  style: TextStyle(
                    fontSize: 11,
                    color: session.isActive
                        ? Colors.orange.shade800
                        : Colors.grey.shade700,
                  ),
                ),
                backgroundColor: session.isActive
                    ? Colors.orange.shade50
                    : Colors.grey.shade100,
                padding: EdgeInsets.zero,
                visualDensity: VisualDensity.compact,
              ),
              const SizedBox(width: 8),
              Text('${session.studentCount}',
                  style: const TextStyle(fontWeight: FontWeight.bold)),
              const Text(' students',
                  style: TextStyle(color: Colors.grey, fontSize: 12)),
            ],
          ),
        ),
        if (!isLast)
          const Divider(height: 1, indent: 16, endIndent: 16),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  final IconData icon;
  final String message;
  const _EmptyState({required this.icon, required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(40),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Icon(icon, size: 48, color: Colors.grey.shade300),
          const SizedBox(height: 12),
          Text(message,
              style: TextStyle(color: Colors.grey.shade500)),
        ],
      ),
    );
  }
}
