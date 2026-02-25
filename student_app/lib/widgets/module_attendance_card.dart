import 'package:flutter/material.dart';

import '../models/module_stats.dart';

class ModuleAttendanceCard extends StatefulWidget {
  const ModuleAttendanceCard({
    super.key,
    required this.stats,
    this.title,
    this.initiallyExpanded = false,
  });

  final ModuleStats stats;
  final String? title;
  final bool initiallyExpanded;

  @override
  State<ModuleAttendanceCard> createState() => _ModuleAttendanceCardState();
}

class _ModuleAttendanceCardState extends State<ModuleAttendanceCard> {
  bool _expanded = false;

  @override
  void initState() {
    super.initState();
    _expanded = widget.initiallyExpanded;
  }

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

    final absentCount =
        (widget.stats.totalModuleSessions - widget.stats.presentCount).clamp(
          0,
          1 << 30,
        );

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
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _SmallPill(
                            label: 'Present',
                            value: '${widget.stats.presentCount}',
                            color: Colors.green,
                          ),
                          _SmallPill(
                            label: 'Absent',
                            value: '$absentCount',
                            color: Colors.redAccent,
                          ),
                          _SmallPill(
                            label: 'Total',
                            value: '${widget.stats.totalModuleSessions}',
                            color: Colors.white70,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                TextButton.icon(
                  onPressed: () => setState(() => _expanded = !_expanded),
                  icon: Icon(_expanded ? Icons.expand_less : Icons.expand_more),
                  label: Text(_expanded ? 'Hide' : 'Details'),
                ),
              ],
            ),
            if (_expanded) ...[
              const SizedBox(height: 12),
              const Divider(height: 1),
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

class _SmallPill extends StatelessWidget {
  const _SmallPill({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white10,
        borderRadius: BorderRadius.circular(999),
      ),
      child: RichText(
        text: TextSpan(
          style: Theme.of(context).textTheme.labelMedium,
          children: [
            TextSpan(
              text: '$label: ',
              style: const TextStyle(color: Colors.white70),
            ),
            TextSpan(
              text: value,
              style: TextStyle(color: color, fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }
}
