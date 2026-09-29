import 'package:flutter/material.dart';

import '../models/module_stats.dart';
import '../services/attendance_stats_service.dart';
import '../widgets/module_attendance_card.dart';

class MyModulesScreen extends StatefulWidget {
  const MyModulesScreen({super.key, required this.studentUid});

  final String studentUid;

  @override
  State<MyModulesScreen> createState() => _MyModulesScreenState();
}

class _MyModulesScreenState extends State<MyModulesScreen> {
  final _service = AttendanceStatsService();
  late final Future<List<ModuleStats>> _future;

  @override
  void initState() {
    super.initState();
    _future = _service.getStudentAttendanceStats(widget.studentUid);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1D1E33),
        elevation: 0,
        title: const Text('My Modules'),
      ),
      body: FutureBuilder<List<ModuleStats>>(
        future: _future,
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

          final statsList = snapshot.data;
          if (statsList == null || statsList.isEmpty) {
            return Center(
              child: Text(
                'No enrolled modules found.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: statsList.length,
            separatorBuilder: (context, index) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final stats = statsList[index];
              final titleBase = (stats.code ?? stats.moduleId) ?? 'Module';
              final title =
                  (stats.name != null && stats.name!.trim().isNotEmpty)
                  ? '$titleBase - ${stats.name}'
                  : titleBase;

              return ModuleAttendanceCard(stats: stats, title: title);
            },
          );
        },
      ),
    );
  }
}
