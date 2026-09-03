import 'package:flutter/material.dart';

import '../models/module_stats.dart';
import '../services/attendance_stats_service.dart';
import '../widgets/module_attendance_card.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  final _moduleController = TextEditingController();
  final _service = AttendanceStatsService();

  Future<ModuleStats>? _future;
  String? _loadedModuleId;

  void _load() {
    final moduleId = _moduleController.text.trim().toUpperCase();
    if (moduleId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a module code (e.g., CS101).'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() {
      _loadedModuleId = moduleId;
      _future = _service.calculateAttendanceStats(moduleId);
    });
  }

  @override
  void dispose() {
    _moduleController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1D1E33),
        elevation: 0,
        title: const Text('Attendance'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Check your attendance by module',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _moduleController,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(
                      labelText: 'Module code',
                      hintText: 'CS101',
                    ),
                    onSubmitted: (_) => _load(),
                  ),
                ),
                const SizedBox(width: 12),
                ElevatedButton(onPressed: _load, child: const Text('Load')),
              ],
            ),
            const SizedBox(height: 16),
            if (_future == null)
              Text(
                'Enter a module code and tap Load.',
                style: Theme.of(context).textTheme.bodyMedium,
              )
            else
              FutureBuilder<ModuleStats>(
                future: _future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: CircularProgressIndicator(),
                      ),
                    );
                  }

                  if (snapshot.hasError) {
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Text(
                          (snapshot.error ?? 'Unknown error').toString(),
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(color: Colors.redAccent),
                        ),
                      ),
                    );
                  }

                  final stats = snapshot.data;
                  if (stats == null) {
                    return const SizedBox.shrink();
                  }

                  return ModuleAttendanceCard(
                    stats: stats,
                    title: _loadedModuleId,
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}
