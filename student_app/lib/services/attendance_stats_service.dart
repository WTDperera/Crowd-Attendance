import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/module_stats.dart';

class AttendanceStatsService {
  AttendanceStatsService({FirebaseFirestore? firestore, FirebaseAuth? auth})
    : _firestore = firestore ?? FirebaseFirestore.instance,
      _auth = auth ?? FirebaseAuth.instance;

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  int _coerceInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) {
      final trimmed = value.trim();
      if (trimmed.isEmpty) return 0;
      return int.tryParse(trimmed) ?? double.tryParse(trimmed)?.toInt() ?? 0;
    }
    return 0;
  }

  Future<_ModuleAttendanceEvidence> _loadAttendanceEvidenceForModule({
    required String studentUid,
    required String moduleId,
  }) async {
    final moduleKey = moduleId.trim().toUpperCase();
    final studentKey = studentUid.trim();

    final queries = <Query<Map<String, dynamic>>>[
      // Current schema (lecturer app writes both student_uid + module_id)
      _firestore
          .collection('attendance_records')
          .where('student_uid', isEqualTo: studentKey)
          .where('module_id', isEqualTo: moduleKey)
          .where('status', isEqualTo: 'present'),

      // Legacy: module_code instead of module_id
      _firestore
          .collection('attendance_records')
          .where('student_uid', isEqualTo: studentKey)
          .where('module_code', isEqualTo: moduleKey)
          .where('status', isEqualTo: 'present'),

      // Legacy: student_id instead of student_uid
      _firestore
          .collection('attendance_records')
          .where('student_id', isEqualTo: studentKey)
          .where('module_id', isEqualTo: moduleKey)
          .where('status', isEqualTo: 'present'),

      // Legacy: both student_id + module_code
      _firestore
          .collection('attendance_records')
          .where('student_id', isEqualTo: studentKey)
          .where('module_code', isEqualTo: moduleKey)
          .where('status', isEqualTo: 'present'),
    ];

    final seenPresentDocIds = <String>{};
    final presentSessionKeys = <String>{};
    final absentSessionKeys = <String>{};
    final allSessionKeys = <String>{};
    final presentTimes = <DateTime>[];
    final absentTimes = <DateTime>[];

    final presentTimeBySessionKey = <String, DateTime>{};
    final absentTimeBySessionKey = <String, DateTime>{};

    String sessionKeyFrom(dynamic data, String docId) {
      if (data is Map<String, dynamic>) {
        final sessionId = (data['session_id'] as String?)?.trim();
        if (sessionId != null && sessionId.isNotEmpty) {
          return 'session:$sessionId';
        }

        final ts = data['timestamp'] ?? data['marked_at'];
        if (ts is Timestamp) {
          return 'ts:${ts.toDate().toUtc().toIso8601String()}';
        }
      }
      return 'doc:$docId';
    }

    for (final q in queries) {
      try {
        final snap = await q.get();
        for (final doc in snap.docs) {
          if (!seenPresentDocIds.add(doc.id)) continue;

          final data = doc.data();
          final ts = data['timestamp'] ?? data['marked_at'];
          if (ts is Timestamp) {
            presentTimes.add(ts.toDate());
          }

          final key = sessionKeyFrom(data, doc.id);
          presentSessionKeys.add(key);
          allSessionKeys.add(key);

          if (!presentTimeBySessionKey.containsKey(key) && ts is Timestamp) {
            presentTimeBySessionKey[key] = ts.toDate();
          }
        }
      } catch (_) {
        // Ignore (missing index/rules).
      }
    }

    // Include absences so total session count can't lag behind.
    final absenceQueries = <Query<Map<String, dynamic>>>[
      _firestore
          .collection('absence_records')
          .where('student_uid', isEqualTo: studentKey)
          .where('module_id', isEqualTo: moduleKey),
      // Legacy safety: some older docs might have student_id.
      _firestore
          .collection('absence_records')
          .where('student_id', isEqualTo: studentKey)
          .where('module_id', isEqualTo: moduleKey),
    ];

    final seenAbsenceDocIds = <String>{};
    for (final q in absenceQueries) {
      try {
        final snap = await q.get();
        for (final doc in snap.docs) {
          if (!seenAbsenceDocIds.add(doc.id)) continue;
          final data = doc.data();
          final key = sessionKeyFrom(data, doc.id);
          absentSessionKeys.add(key);
          allSessionKeys.add(key);

          final ts = data['timestamp'] ?? data['marked_at'];
          if (ts is Timestamp) {
            absentTimes.add(ts.toDate());
            if (!absentTimeBySessionKey.containsKey(key)) {
              absentTimeBySessionKey[key] = ts.toDate();
            }
          }
        }
      } catch (_) {
        // Ignore.
      }
    }

    presentTimes.sort((a, b) => a.compareTo(b));

    // If a session is explicitly marked absent, treat it as absent even if a
    // present record exists (prevents % jumping to 100% when absent + present
    // records coexist for the same session_id).
    final effectivePresent = presentSessionKeys.difference(absentSessionKeys);

    final effectivePresentRecordDates = <DateTime>[];
    for (final key in effectivePresent) {
      final dt = presentTimeBySessionKey[key];
      if (dt != null) effectivePresentRecordDates.add(dt);
    }
    effectivePresentRecordDates.sort((a, b) => a.compareTo(b));

    final absentRecordDates = <DateTime>[];
    for (final key in absentSessionKeys) {
      final dt = absentTimeBySessionKey[key];
      if (dt != null) absentRecordDates.add(dt);
    }
    absentRecordDates.sort((a, b) => a.compareTo(b));

    return _ModuleAttendanceEvidence(
      presentCount: effectivePresent.length,
      presentTimes: presentTimes,
      totalSessionsSeen: allSessionKeys.length,
      presentRecordDates: effectivePresentRecordDates,
      absentRecordDates: absentRecordDates,
    );
  }

  Future<DocumentSnapshot<Map<String, dynamic>>> _resolveStudentDoc(
    String uidOrId,
  ) async {
    final raw = uidOrId.trim();
    if (raw.isEmpty) {
      throw Exception('uid is required');
    }

    final byId = await _firestore.collection('students').doc(raw).get();
    if (byId.exists) {
      return byId;
    }

    // If the provided value is actually a reg number, try to resolve by reg_no.
    try {
      final byReg = await _firestore
          .collection('students')
          .where('reg_no', isEqualTo: raw)
          .limit(1)
          .get();
      if (byReg.docs.isNotEmpty) {
        return byReg.docs.first;
      }
    } catch (_) {
      // Ignore.
    }

    return byId; // non-existent snapshot
  }

  // Legacy helpers removed in favor of _loadPresentAttendanceForModule.

  /// Prompt requirement (Module-First):
  /// Return stats for each module in `students/{uid}.enrolled_module_ids`.
  ///
  /// Percentage calculation (REQUIRED):
  /// - presentCount = count(attendance_records where student_uid == student && module_id == moduleId && status == "present")
  /// - totalSessions = modules/{moduleId}.total_sessions
  /// - Percentage = (presentCount / totalSessions) * 100
  ///
  /// UI missing sessions:
  /// - modules/{moduleId}.session_dates is the master schedule list
  /// - attendance_records timestamps (present only) are matched against master schedule using
  ///   +/- 60 minutes; any master session without a match is shown as absent.
  Future<List<ModuleStats>> getStudentStats(String uid) async {
    final studentSnap = await _resolveStudentDoc(uid);
    if (!studentSnap.exists) {
      throw Exception('Student not found: ${uid.trim()}');
    }

    final resolvedStudentId = studentSnap.id;
    final studentData = studentSnap.data();
    final enrolledRaw = (studentData is Map<String, dynamic>)
        ? studentData['enrolled_module_ids']
        : null;

    final enrolled = <String>[];
    if (enrolledRaw is List) {
      for (final v in enrolledRaw) {
        if (v is String && v.trim().isNotEmpty) {
          enrolled.add(v.trim().toUpperCase());
        }
      }
    }

    if (enrolled.isEmpty) {
      // Source of truth: students/{uid}/enrollments/{moduleId}
      try {
        final enrollmentsSnap = await _firestore
            .collection('students')
            .doc(resolvedStudentId)
            .collection('enrollments')
            .get();
        for (final doc in enrollmentsSnap.docs) {
          final id = doc.id.trim();
          if (id.isNotEmpty) {
            enrolled.add(id.toUpperCase());
          }
        }
      } catch (_) {
        // Ignore (missing rules/index).
      }
    }

    if (enrolled.isEmpty) {
      return const <ModuleStats>[];
    }

    final futures = enrolled.map((moduleId) async {
      // 1) Fetch module info.
      final moduleKey = moduleId.trim().toUpperCase();
      final moduleSnap = await _firestore
          .collection('modules')
          .doc(moduleKey)
          .get();
      if (!moduleSnap.exists) {
        return null;
      }

      final moduleData = moduleSnap.data() as Map<String, dynamic>;
      final code = moduleKey;
      final name = (moduleData['name'] as String?)?.trim();

      final totalSessionsFromModule = _coerceInt(moduleData['total_sessions']);

      final masterDatesRaw = moduleData['session_dates'];
      final masterSessionTimes = <DateTime>[];
      if (masterDatesRaw is List) {
        for (final item in masterDatesRaw) {
          if (item is Timestamp) {
            masterSessionTimes.add(item.toDate());
          }
        }
      }

      // Required formula: presentCount / modules.total_sessions * 100
      final evidence = await _loadAttendanceEvidenceForModule(
        studentUid: resolvedStudentId,
        moduleId: moduleKey,
      );
      final presentCount = evidence.presentCount;

      final sessionsFromEvidence = evidence.totalSessionsSeen;
      final totalSessions = (sessionsFromEvidence > 0)
          ? sessionsFromEvidence
          : (totalSessionsFromModule > 0)
          ? totalSessionsFromModule
          : masterSessionTimes.length;

      final attendanceTimes = evidence.presentTimes;

      final absentDates = <DateTime>[];
      if (masterSessionTimes.isNotEmpty) {
        const matchWindow = Duration(minutes: 60);
        for (final masterTime in masterSessionTimes) {
          var matched = false;
          for (final attTime in attendanceTimes) {
            final diffMs = attTime.difference(masterTime).inMilliseconds;
            if (diffMs.abs() <= matchWindow.inMilliseconds) {
              matched = true;
              break;
            }
          }
          if (!matched) {
            absentDates.add(masterTime);
          }
        }
        absentDates.sort((a, b) => a.compareTo(b));
      }

      final rawPercentage = totalSessions <= 0
          ? 0.0
          : (presentCount.toDouble() / totalSessions.toDouble()) * 100.0;
      final safePercentage = rawPercentage.isFinite
          ? rawPercentage.clamp(0.0, 100.0)
          : 0.0;

      return ModuleStats(
        moduleId: moduleKey,
        code: code,
        name: name,
        attendancePercentage: safePercentage,
        absentDates: absentDates,
        presentRecordDates: evidence.presentRecordDates,
        absentRecordDates: evidence.absentRecordDates,
        presentCount: presentCount,
        totalModuleSessions: totalSessions,
      );
    }).toList();

    final results = await Future.wait(futures);
    final stats = results.whereType<ModuleStats>().toList();
    stats.sort((a, b) => (a.code ?? '').compareTo(b.code ?? ''));
    return stats;
  }

  /// New requirement (Enrollment-based):
  /// Return stats for every module the student is enrolled in,
  /// even if the student attended 0 sessions.
  Future<List<ModuleStats>> getStudentAttendanceStats(String studentUid) async {
    return getStudentStats(studentUid);
  }

  /// Phase 3 requirement:
  /// calculateAttendanceStats(String moduleId) -> ModuleStats
  ///
  /// Firestore assumptions (matches lecturer app writes):
  /// This project may be using either of these schemas:
  ///
  /// Schema A (modules + top-level attendance_records):
  /// - modules/{moduleId} has total_sessions (int) and session_dates (list of Timestamp)
  /// - attendance_records has student_id (uid), module_id (moduleId), marked_at (Timestamp)
  ///
  /// Schema B (active_sessions + per-session attendance subcollection):
  /// - active_sessions/{sessionId} has module (String), status ("completed"), completed_at (Timestamp)
  /// - active_sessions/{sessionId}/attendance/{regNo} has timestamp (Timestamp)
  Future<ModuleStats> calculateAttendanceStats(String moduleId) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    final moduleKey = moduleId.trim();
    if (moduleKey.isEmpty) {
      throw Exception('moduleId is required');
    }

    // Resolve student doc (uid vs reg_no) so we use the same UID stored in attendance_records.student_uid.
    final studentSnap = await _resolveStudentDoc(user.uid);
    final resolvedStudentId = studentSnap.exists ? studentSnap.id : user.uid;

    final moduleUpper = moduleKey.trim().toUpperCase();

    // Load module totals + master schedule.
    final moduleSnap = await _firestore
        .collection('modules')
        .doc(moduleUpper)
        .get();
    final moduleData = moduleSnap.data();
    final totalSessionsRaw = (moduleData is Map<String, dynamic>)
        ? moduleData['total_sessions']
        : null;
    final totalSessionsFromModule = _coerceInt(totalSessionsRaw);

    final masterSessionTimes = <DateTime>[];
    final masterRaw = (moduleData is Map<String, dynamic>)
        ? moduleData['session_dates']
        : null;
    if (masterRaw is List) {
      for (final item in masterRaw) {
        if (item is Timestamp) {
          masterSessionTimes.add(item.toDate());
        }
      }
    }

    final evidence = await _loadAttendanceEvidenceForModule(
      studentUid: resolvedStudentId,
      moduleId: moduleUpper,
    );
    final presentCount = evidence.presentCount;

    final sessionsFromEvidence = evidence.totalSessionsSeen;
    final totalSessions = (sessionsFromEvidence > 0)
        ? sessionsFromEvidence
        : (totalSessionsFromModule > 0)
        ? totalSessionsFromModule
        : masterSessionTimes.length;

    final attendanceTimes = evidence.presentTimes;

    final absentDates = <DateTime>[];
    if (masterSessionTimes.isNotEmpty) {
      const matchWindow = Duration(minutes: 60);
      for (final masterTime in masterSessionTimes) {
        var matched = false;
        for (final attTime in attendanceTimes) {
          final diffMs = attTime.difference(masterTime).inMilliseconds;
          if (diffMs.abs() <= matchWindow.inMilliseconds) {
            matched = true;
            break;
          }
        }
        if (!matched) {
          absentDates.add(masterTime);
        }
      }
      absentDates.sort((a, b) => a.compareTo(b));
    }

    final rawPercentage = totalSessions <= 0
        ? 0.0
        : (presentCount.toDouble() / totalSessions.toDouble()) * 100.0;
    final attendancePercentage = rawPercentage.isFinite
        ? rawPercentage.clamp(0.0, 100.0)
        : 0.0;

    return ModuleStats(
      moduleId: moduleUpper,
      code: moduleUpper,
      attendancePercentage: attendancePercentage,
      absentDates: absentDates,
      presentRecordDates: evidence.presentRecordDates,
      absentRecordDates: evidence.absentRecordDates,
      presentCount: presentCount,
      totalModuleSessions: totalSessions,
    );
  }
}

class _ModuleAttendanceEvidence {
  final int presentCount;
  final List<DateTime> presentTimes;
  final int totalSessionsSeen;
  final List<DateTime> presentRecordDates;
  final List<DateTime> absentRecordDates;

  const _ModuleAttendanceEvidence({
    required this.presentCount,
    required this.presentTimes,
    required this.totalSessionsSeen,
    required this.presentRecordDates,
    required this.absentRecordDates,
  });
}
