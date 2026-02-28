import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/firestore_service.dart';
import '../models/session_model.dart';
import 'session_detail_screen.dart';

class SessionsScreen extends StatefulWidget {
  const SessionsScreen({super.key});

  @override
  State<SessionsScreen> createState() => _SessionsScreenState();
}

class _SessionsScreenState extends State<SessionsScreen> {
  final _firestoreService = FirestoreService();
  String _filter = 'all'; // all | active | completed
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      body: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            const Text('Sessions',
                style:
                    TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            const Text('All attendance sessions',
                style: TextStyle(color: Colors.grey, fontSize: 14)),
            const SizedBox(height: 20),

            // Filter + Search Row
            Row(
              children: [
                // Filters
                _FilterChip(
                    label: 'All',
                    selected: _filter == 'all',
                    onTap: () => setState(() => _filter = 'all')),
                const SizedBox(width: 8),
                _FilterChip(
                    label: 'Active',
                    selected: _filter == 'active',
                    color: Colors.orange,
                    onTap: () => setState(() => _filter = 'active')),
                const SizedBox(width: 8),
                _FilterChip(
                    label: 'Completed',
                    selected: _filter == 'completed',
                    color: Colors.green,
                    onTap: () =>
                        setState(() => _filter = 'completed')),
                const Spacer(),
                // Search
                SizedBox(
                  width: 260,
                  height: 40,
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'Search module or topic...',
                      hintStyle: const TextStyle(fontSize: 13),
                      prefixIcon: const Icon(Icons.search, size: 18),
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(
                            color: Colors.grey.shade300),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(
                            color: Colors.grey.shade300),
                      ),
                      contentPadding:
                          const EdgeInsets.symmetric(vertical: 8),
                    ),
                    onChanged: (v) =>
                        setState(() => _searchQuery = v.toLowerCase()),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Sessions List
            Expanded(
              child: StreamBuilder<List<SessionModel>>(
                stream: _firestoreService.getSessionsStream(),
                builder: (context, snapshot) {
                  if (snapshot.connectionState ==
                      ConnectionState.waiting) {
                    return const Center(
                        child: CircularProgressIndicator());
                  }
                  var sessions = snapshot.data ?? [];

                  // Apply filter
                  if (_filter == 'active') {
                    sessions = sessions
                        .where((s) => s.isActive)
                        .toList();
                  } else if (_filter == 'completed') {
                    sessions = sessions
                        .where((s) => !s.isActive)
                        .toList();
                  }

                  // Apply search
                  if (_searchQuery.isNotEmpty) {
                    sessions = sessions.where((s) {
                      return s.moduleCode
                              .toLowerCase()
                              .contains(_searchQuery) ||
                          s.sessionTopic
                              .toLowerCase()
                              .contains(_searchQuery);
                    }).toList();
                  }

                  if (sessions.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.event_busy,
                              size: 64,
                              color: Colors.grey.shade300),
                          const SizedBox(height: 16),
                          Text('No sessions found',
                              style: TextStyle(
                                  color: Colors.grey.shade500,
                                  fontSize: 16)),
                        ],
                      ),
                    );
                  }

                  return ListView.builder(
                    itemCount: sessions.length,
                    itemBuilder: (_, i) {
                      return _SessionCard(
                        session: sessions[i],
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => SessionDetailScreen(
                                sessionId: sessions[i].id,
                              ),
                            ),
                          );
                        },
                        onEndSession: sessions[i].isActive
                            ? () => _endSession(sessions[i].id)
                            : null,
                        onDelete: () => _deleteSession(sessions[i].id),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _endSession(String sessionId) async {
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
      try {
        await _firestoreService.endSession(sessionId);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Session ended.'),
            backgroundColor: Colors.green,
          ));
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
          ));
        }
      }
    }
  }

  Future<void> _deleteSession(String sessionId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Session'),
        content: const Text(
            'This will permanently delete the session and all its attendance records. Continue?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style:
                ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      try {
        await _firestoreService.deleteSession(sessionId);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Session deleted.'),
            backgroundColor: Colors.green,
          ));
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
          ));
        }
      }
    }
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final Color? color;
  final VoidCallback onTap;
  const _FilterChip({
    required this.label,
    required this.selected,
    this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = color ?? Theme.of(context).colorScheme.primary;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? c.withValues(alpha: 0.1) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? c : Colors.grey.shade300,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? c : Colors.grey.shade600,
            fontWeight:
                selected ? FontWeight.bold : FontWeight.normal,
            fontSize: 13,
          ),
        ),
      ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  final SessionModel session;
  final VoidCallback onTap;
  final VoidCallback? onEndSession;
  final VoidCallback onDelete;

  const _SessionCard({
    required this.session,
    required this.onTap,
    this.onEndSession,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final dateStr = session.createdAt != null
        ? DateFormat('MMM d, yyyy  hh:mm a').format(session.createdAt!)
        : '—';

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: session.isActive
                      ? Colors.orange.shade50
                      : Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.event,
                  color: session.isActive
                      ? Colors.orange.shade700
                      : Colors.grey.shade500,
                  size: 24,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(session.moduleCode,
                            style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 15)),
                        const SizedBox(width: 8),
                        _StatusBadge(isActive: session.isActive),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(session.sessionTopic,
                        style: const TextStyle(
                            color: Colors.grey, fontSize: 13)),
                    const SizedBox(height: 4),
                    Text(dateStr,
                        style: const TextStyle(
                            color: Colors.grey, fontSize: 12)),
                  ],
                ),
              ),
              // Student count
              Column(
                children: [
                  Text(
                    '${session.studentCount}',
                    style: const TextStyle(
                        fontSize: 22, fontWeight: FontWeight.bold),
                  ),
                  const Text('students',
                      style: TextStyle(
                          color: Colors.grey, fontSize: 11)),
                ],
              ),
              const SizedBox(width: 16),
              // Actions
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert),
                onSelected: (v) {
                  if (v == 'view') onTap();
                  if (v == 'end') onEndSession?.call();
                  if (v == 'delete') onDelete();
                },
                itemBuilder: (_) => [
                  const PopupMenuItem(
                      value: 'view',
                      child: Row(children: [
                        Icon(Icons.visibility, size: 18),
                        SizedBox(width: 8),
                        Text('View Details'),
                      ])),
                  if (onEndSession != null)
                    const PopupMenuItem(
                        value: 'end',
                        child: Row(children: [
                          Icon(Icons.stop_circle,
                              size: 18, color: Colors.orange),
                          SizedBox(width: 8),
                          Text('End Session'),
                        ])),
                  const PopupMenuItem(
                      value: 'delete',
                      child: Row(children: [
                        Icon(Icons.delete,
                            size: 18, color: Colors.red),
                        SizedBox(width: 8),
                        Text('Delete',
                            style: TextStyle(color: Colors.red)),
                      ])),
                ],
              ),
            ],
          ),
        ),
      ),
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
          const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color:
            isActive ? Colors.orange.shade50 : Colors.green.shade50,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        isActive ? 'Active' : 'Completed',
        style: TextStyle(
          fontSize: 11,
          color: isActive
              ? Colors.orange.shade800
              : Colors.green.shade800,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
