import 'package:flutter/material.dart';

import '../models/module_stats.dart';

class ModuleAttendanceCard extends StatefulWidget {
  const ModuleAttendanceCard({super.key, required this.stats, this.title});

  final ModuleStats stats;
  final String? title;

  @override
  State<ModuleAttendanceCard> createState() => _ModuleAttendanceCardState();
}

class _ModuleAttendanceCardState extends State<ModuleAttendanceCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final rawPercentage = widget.stats.attendancePercentage;
    final percentage = rawPercentage.isFinite
        ? rawPercentage.clamp(0.0, 100.0)
        : 0.0;
    final progress = (percentage / 100.0).clamp(0.0, 1.0);

    final Color color;
    if (percentage > 80.0) {
      color = Colors.green;
    } else if (percentage >= 60.0) {
      color = Colors.orange;
    } else {
      color = Colors.red;
    }

    final attendedText =
        'Attended: ${widget.stats.presentCount}/${widget.stats.totalModuleSessions}';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                SizedBox(
                  width: 64,
                  height: 64,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      CircularProgressIndicator(
                        value: progress,
                        strokeWidth: 8,
                        color: color,
                        backgroundColor: Colors.white12,
                      ),
                      Text(
                        '${percentage.toStringAsFixed(1)}%',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (widget.title != null)
                        Text(
                          widget.title!,
                          style: Theme.of(context).textTheme.titleMedium,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      Text(
                        attendedText,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: () => setState(() => _expanded = !_expanded),
                  child: Text(_expanded ? 'Hide' : 'Expand'),
                ),
              ],
            ),
            if (_expanded) ...[
              const SizedBox(height: 12),
              _buildRecords(context),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildRecords(BuildContext context) {
    final presentDates = widget.stats.presentRecordDates;
    final absentDates = widget.stats.absentRecordDates;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildRecordSection(
          context,
          title: 'Attendance Records',
          icon: Icons.check,
          iconColor: Colors.green,
          dates: presentDates,
          emptyText: 'No attendance records found.',
        ),
        const SizedBox(height: 12),
        _buildRecordSection(
          context,
          title: 'Absence Records',
          icon: Icons.close,
          iconColor: Colors.redAccent,
          dates: absentDates,
          emptyText: 'No absence records found.',
        ),
      ],
    );
  }

  Widget _buildRecordSection(
    BuildContext context, {
    required String title,
    required IconData icon,
    required Color iconColor,
    required List<DateTime> dates,
    required String emptyText,
  }) {
    final localizations = MaterialLocalizations.of(context);
    final always24h =
        MediaQuery.maybeOf(context)?.alwaysUse24HourFormat ?? false;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        if (dates.isEmpty)
          Text(emptyText, style: Theme.of(context).textTheme.bodyMedium)
        else
          ...dates.map((d) {
            final local = d.toLocal();
            final dateText = localizations.formatFullDate(local);
            final timeText = localizations.formatTimeOfDay(
              TimeOfDay.fromDateTime(local),
              alwaysUse24HourFormat: always24h,
            );
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Icon(icon, size: 18, color: iconColor),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '$dateText • $timeText',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }
}
