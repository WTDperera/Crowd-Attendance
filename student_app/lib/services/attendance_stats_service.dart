import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/module_stats.dart';
import 'api_client.dart';
import 'firebase_environment.dart';

/// Completed, eligible classes resolved by the authenticated report API.
/// Firestore remains a constructor argument for source compatibility.
class AttendanceStatsService {
  AttendanceStatsService({FirebaseFirestore? firestore, FirebaseAuth? auth})
    : _auth = auth ?? appAuth,
      _api = ApiClient(auth: auth);
  final FirebaseAuth _auth;
  final ApiClient _api;

  Future<List<ModuleStats>> getStudentStats(String uid) async {
    if (_auth.currentUser?.uid != uid) {
      throw StateError('Only your own attendance report is available.');
    }
    final data = await _api.get('/api/student/attendance-summary');
    return (data['modules'] as List<dynamic>).map((entry) {
      final module = entry['module'] as Map<String, dynamic>;
      final stats = entry['stats'] as Map<String, dynamic>;
      final present = <DateTime>[];
      final absent = <DateTime>[];
      final outcomes = <DateTime, String>{};
      for (final record in entry['records'] as List<dynamic>) {
        final date = DateTime.tryParse(record['date'] as String? ?? '')?.toUtc();
        if (date == null) continue;
        final credit =
            record['status_value'] == 1 || record['status_value'] == 'ex';
        (credit ? present : absent).add(date);
        outcomes[date] = record['status'] as String;
      }
      return ModuleStats(
        moduleId: module['module_id'] as String,
        code: module['module_code'] as String,
        name: module['module_name'] as String,
        attendancePercentage: (stats['raw_percentage'] as num).toDouble(),
        absentDates: absent,
        presentRecordDates: present,
        absentRecordDates: absent,
        recordDurations: outcomes,
        presentCount: stats['present'] as int,
        totalModuleSessions: stats['total'] as int,
        conflicts: List<String>.from(stats['conflicts'] as List<dynamic>),
      );
    }).toList();
  }

  Future<List<ModuleStats>> getStudentAttendanceStats(String uid) =>
      getStudentStats(uid);

  Future<ModuleStats> calculateAttendanceStats(String moduleId) async {
    final uid = _auth.currentUser?.uid;
    if (uid == null) throw StateError('Student login is required.');
    final modules = await getStudentStats(uid);
    return modules.firstWhere(
      (m) => m.moduleId == moduleId || m.code == moduleId,
    );
  }
}
