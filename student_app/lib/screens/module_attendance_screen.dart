import 'package:flutter/material.dart';

import '../models/module_stats.dart';
import '../services/attendance_stats_service.dart';
import '../widgets/module_attendance_card.dart';

class ModuleAttendanceScreen extends StatelessWidget {
  const ModuleAttendanceScreen({
    super.key,
    required this.moduleCode,
    required this.moduleName,
  });

  final String moduleCode;
  final String moduleName;

  @override
  Widget build(BuildContext context) {
    final code = moduleCode.trim();
    final name = moduleName.trim();
    final title = name.isNotEmpty ? '$code - $name' : code;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1D1E33),
        elevation: 0,
        title: const Text('My Attendance'),
      ),
      body: FutureBuilder<ModuleStats>(
        future: AttendanceStatsService().calculateAttendanceStats(code),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  (snapshot.error ?? 'Unknown error').toString(),
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(color: Colors.redAccent),
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }

          final stats = snapshot.data;
          if (stats == null) {
            return Center(
              child: Text(
                'No data found.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            );
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              ModuleAttendanceCard(
                stats: stats,
                title: title,
                initiallyExpanded: true,
              ),
            ],
          );
        },
      ),
    );
  }
}
