class ModuleStats {
  final String? moduleId;
  final String? code;
  final String? name;
  final double attendancePercentage;
  final List<DateTime> absentDates;
  final List<DateTime> presentRecordDates;
  final List<DateTime> absentRecordDates;
  final Map<DateTime, String> recordDurations;
  final int presentCount;
  final int totalModuleSessions;
  final List<String> conflicts;
  bool get eligible =>
      totalModuleSessions > 0 && presentCount * 100 >= totalModuleSessions * 80;

  const ModuleStats({
    this.moduleId,
    this.code,
    this.name,
    required this.attendancePercentage,
    required this.absentDates,
    this.presentRecordDates = const <DateTime>[],
    this.absentRecordDates = const <DateTime>[],
    this.recordDurations = const <DateTime, String>{},
    required this.presentCount,
    required this.totalModuleSessions,
    this.conflicts = const <String>[],
  });
}
