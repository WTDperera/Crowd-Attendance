import 'package:lecturer_app/services/firebase_environment.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:intl/intl.dart';
import 'round_service.dart';
import 'round_domain.dart';

class SessionService {
  static final SessionService _instance = SessionService._internal();
  factory SessionService() => _instance;
  SessionService._internal();

  final FirebaseFirestore _firestore = appFirestore;
  final FirebaseAuth _auth = appAuth;

  final RoundService _roundService = RoundService();

  String? _activeSessionId;
  String? get activeSessionId => _activeSessionId;

  /// Helper to format duration string
  static String formatDurationString(DateTime start, DateTime end) {
    final diffMinutes = end.difference(start).inMinutes;
    final hrs = diffMinutes ~/ 60;
    final mins = diffMinutes % 60;
    String durationText;
    if (hrs > 0 && mins > 0) {
      durationText = '${hrs}h ${mins}m';
    } else if (hrs > 0) {
      durationText = '$hrs hr${hrs > 1 ? "s" : ""}';
    } else {
      durationText = '$mins mins';
    }
    final startStr = DateFormat('hh:mm a').format(start);
    final endStr = DateFormat('hh:mm a').format(end);
    return '$startStr - $endStr ($durationText)';
  }

  /// Create a new attendance session
  Future<String> createSession({
    required String moduleCode,
    required String sessionTopic,
    String? moduleId,
    DateTime? startTime,
    DateTime? endTime,
  }) async {
    try {
      final user = _auth.currentUser;
      if (user == null) throw Exception('User not authenticated');

      final sessionRef = _firestore.collection('active_sessions').doc();

      final resolvedModuleId = (moduleId?.trim().isNotEmpty ?? false)
          ? moduleId!.trim()
          : moduleCode.toUpperCase().trim();

      final start = startTime ?? DateTime.now();
      final end = endTime ?? start.add(const Duration(hours: 2));
      final durationMins = end.difference(start).inMinutes;
      final formattedDuration = formatDurationString(start, end);
      final startStr = DateFormat('hh:mm a').format(start);
      final endStr = DateFormat('hh:mm a').format(end);

      await _roundService.createSession(sessionRef, {
        'session_id': sessionRef.id,
        'lecturer_id': user.uid,
        'module_id': resolvedModuleId,
        'module_code': moduleCode.toUpperCase(),
        'module': moduleCode.toUpperCase(),
        'session_topic': sessionTopic,
        'topic': sessionTopic,
        'created_at': FieldValue.serverTimestamp(),
        'started_at': Timestamp.fromDate(start),
        'ended_at': Timestamp.fromDate(end),
        'start_time': Timestamp.fromDate(start),
        'end_time': Timestamp.fromDate(end),
        'duration_minutes': durationMins,
        'duration_formatted': formattedDuration,
        'duration_range': '$startStr - $endStr',
        'status': 'active',
        'student_count': 0,
        'students_present': [], // Array of student IDs
      });

      _activeSessionId = sessionRef.id;
      return sessionRef.id;
    } catch (e) {
      throw Exception('Failed to create session: $e');
    }
  }

  Future<String> beginRound(String sessionId) => _roundService.begin(sessionId);
  Future<void> completeRound(String sessionId, String roundId) =>
      _roundService.finish(sessionId, roundId);
  Future<void> cancelRound(String sessionId, String roundId) =>
      _roundService.finish(sessionId, roundId, cancel: true);
  Future<Map<String, String>> loadSessionRoster(String sessionId) =>
      _roundService.loadRoster(sessionId);

  Future<bool> markAttendance({
    required String sessionId,
    required String roundId,
    required String studentId,
    required String regNo,
    required int rssi,
  }) => _roundService.mark(
    sessionId: sessionId,
    roundId: roundId,
    studentId: studentId,
    regNo: regNo,
    rssi: rssi,
  );

  /// End current session
  Future<void> endSession(String sessionId, {int? totalStudents}) async {
    try {
      final sessionRef = _firestore
          .collection('active_sessions')
          .doc(sessionId);

      // Finalize statuses based on multi-scan
      final sessionSnapBeforeTx = await sessionRef.get();
      if (sessionSnapBeforeTx.exists) {
        final sessionData = sessionSnapBeforeTx.data() as Map<String, dynamic>;
        Set<String>? completedRounds;
        if (sessionData['round_schema'] == 2) {
          if (sessionData['active_round_id'] != null) {
            throw StateError('Complete or cancel the open round first.');
          }
          final rounds = await sessionRef
              .collection('rounds')
              .get(const GetOptions(source: Source.server));
          completedRounds = rounds.docs
              .where((r) => r.data()['status'] == 'completed')
              .map((r) => r.id)
              .toSet();
          if (completedRounds.isEmpty) {
            throw StateError('Complete at least one round first.');
          }
        }
        int scansPerformed =
            completedRounds?.length ?? sessionData['scans_performed'] ?? 1;
        if (scansPerformed < 1) scansPerformed = 1;

        final recordsSnap = await _firestore
            .collection('attendance_records')
            .where('session_id', isEqualTo: sessionId)
            .get();

        final batch = _firestore.batch();
        List<String> leftEarlyStudentIds = [];

        for (var doc in recordsSnap.docs) {
          int scanCount = doc.data().containsKey('scan_count')
              ? doc.get('scan_count')
              : 1;
          String finalStatus = completedRounds == null
              ? (scanCount >= scansPerformed ? 'present' : 'left_early')
              : roundOutcome(
                  List<String>.from(
                    doc.data()['observed_round_ids'] as List? ?? [],
                  ),
                  completedRounds,
                );
          batch.update(doc.reference, {'status': finalStatus});

          String regNo = doc.get('reg_no');
          batch.update(
            sessionRef
                .collection('attendance')
                .doc(
                  sessionData['round_schema'] == 2
                      ? doc.get('student_id')
                      : regNo,
                ),
            {'status': finalStatus},
          );

          if (finalStatus != 'present') {
            String studentId = doc.get('student_id');
            leftEarlyStudentIds.add(studentId);
            String moduleKey = doc.get('module_code');
            batch.update(_firestore.collection('students').doc(studentId), {
              'attendance_module_id': moduleKey,
              'attendance_counts.$moduleKey': FieldValue.increment(-1),
            });
          }
        }

        if (leftEarlyStudentIds.isNotEmpty) {
          // Clamp student_count to minimum 0 — avoid going negative.
          final currentCount =
              (sessionData['student_count'] as num?)?.toInt() ?? 0;
          final newCount = (currentCount - leftEarlyStudentIds.length).clamp(
            0,
            currentCount,
          );
          batch.update(sessionRef, {
            'students_present': FieldValue.arrayRemove(leftEarlyStudentIds),
            'student_count': newCount,
          });
        }

        await batch.commit();
      }

      String? moduleKeyOut;
      Timestamp? endedAtOut;
      await _firestore.runTransaction((transaction) async {
        final sessionSnap = await transaction.get(sessionRef);
        if (!sessionSnap.exists) {
          throw Exception('Session not found');
        }
        final sessionData = sessionSnap.data() as Map<String, dynamic>;
        final statusRaw = sessionData['status'];
        final status = statusRaw is String
            ? statusRaw.trim().toLowerCase()
            : '';
        if (status == 'completed' || status == 'complete') {
          return; // idempotent: avoid double increment
        }

        final moduleKeyLocal =
            ((sessionData['module_id'] as String?)?.trim() ??
                    (sessionData['module_code'] as String?)?.trim() ??
                    (sessionData['module'] as String?)?.trim() ??
                    '')
                .toUpperCase();
        if (moduleKeyLocal.isEmpty) {
          throw Exception(
            'Missing module code in session (module_id/module_code/module)',
          );
        }

        // Expose for absence finalization after the transaction.
        moduleKeyOut = moduleKeyLocal;

        final now = Timestamp.now();
        endedAtOut = now;
        final moduleRef = _firestore.collection('modules').doc(moduleKeyLocal);
        final moduleSnap = await transaction.get(moduleRef);
        if (!moduleSnap.exists) {
          throw Exception('Module not found: $moduleKeyLocal');
        }

        transaction.update(sessionRef, {
          'status': 'completed',
          'module_id': moduleKeyLocal,
          'module_code': moduleKeyLocal,
          'ended_at': now,
          'completed_at': now,
          if (totalStudents != null) 'total_students': totalStudents,
        });

        transaction.update(moduleRef, {
          'total_sessions': FieldValue.increment(1),
          'session_dates': FieldValue.arrayUnion([now]),
        });
        transaction.update(
          _firestore.collection('module_catalog').doc(moduleKeyLocal),
          {
            'total_sessions': FieldValue.increment(1),
            'session_dates': FieldValue.arrayUnion([now]),
          },
        );
      });

      if (moduleKeyOut != null &&
          moduleKeyOut!.isNotEmpty &&
          endedAtOut != null) {
        await _finalizeAbsences(
          sessionId: sessionId,
          moduleId: moduleKeyOut!,
          endedAt: endedAtOut!,
        );
      }
      _activeSessionId = null;
    } catch (e) {
      throw Exception('Failed to end session: $e');
    }
  }

  Future<void> _finalizeAbsences({
    required String sessionId,
    required String moduleId,
    required Timestamp endedAt,
  }) async {
    final moduleKey = moduleId.trim().toUpperCase();

    // Enrolled students: students where enrolled_module_ids contains moduleId.
    final enrolledSnap = await _firestore
        .collection('students')
        .where('enrolled_module_ids', arrayContains: moduleKey)
        .get();

    // Present students can be captured in two places:
    // 1) active_sessions/{sessionId}.students_present (List<String> of UIDs)
    // 2) active_sessions/{sessionId}/attendance/* docs (student_uid fields)
    final sessionSnap = await _firestore
        .collection('active_sessions')
        .doc(sessionId)
        .get();

    // Present students: attendance subcollection of this session.
    final presentSnap = await _firestore
        .collection('active_sessions')
        .doc(sessionId)
        .collection('attendance')
        .get();

    final presentUids = <String>{};
    final presentFromSessionArray = <String>{};
    final presentFromAttendanceSubcollection = <String>{};
    final presentFromAttendanceRecords = <String>{};
    final regNosToResolve = <String>{};

    final sessionData = sessionSnap.data();
    final studentsPresentRaw = (sessionData is Map<String, dynamic>)
        ? sessionData['students_present']
        : null;
    if (studentsPresentRaw is List) {
      for (final v in studentsPresentRaw) {
        if (v is String) {
          final uid = v.trim();
          if (uid.isNotEmpty) {
            presentUids.add(uid);
            presentFromSessionArray.add(uid);
          }
        }
      }
    }

    for (final doc in presentSnap.docs) {
      final data = doc.data();
      final statusRaw = data['status'];
      final status = statusRaw is String ? statusRaw.trim().toLowerCase() : '';
      if (status != 'present') {
        continue;
      }

      final uid = (data['student_uid'] as String?)?.trim();
      if (uid != null && uid.isNotEmpty) {
        presentUids.add(uid);
        presentFromAttendanceSubcollection.add(uid);
        continue;
      }

      // Backward-compat for older per-session docs that used student_id.
      final legacyUid = (data['student_id'] as String?)?.trim();
      if (legacyUid != null && legacyUid.isNotEmpty) {
        presentUids.add(legacyUid);
        presentFromAttendanceSubcollection.add(legacyUid);
        continue;
      }

      // If we only have reg_no in the session attendance doc, resolve to student UID.
      final regNo = (data['reg_no'] as String?)?.trim();
      if (regNo != null && regNo.isNotEmpty) {
        regNosToResolve.add(regNo);
      }
    }

    // Resolve any reg_no-only attendance docs to student UIDs (best-effort).
    if (regNosToResolve.isNotEmpty) {
      final regList = regNosToResolve.toList();
      const maxWhereIn = 10;
      for (var i = 0; i < regList.length; i += maxWhereIn) {
        final chunk = regList.sublist(
          i,
          (i + maxWhereIn) > regList.length ? regList.length : (i + maxWhereIn),
        );
        try {
          final snap = await _firestore
              .collection('students')
              .where('reg_no', whereIn: chunk)
              .get();
          for (final doc in snap.docs) {
            final uid = doc.id.trim();
            if (uid.isNotEmpty) {
              presentUids.add(uid);
              presentFromAttendanceSubcollection.add(uid);
            }
          }
        } catch (_) {
          // Ignore (missing index/rules) - attendance_records fallback still protects correctness.
        }
      }
    }

    // Present students from top-level attendance_records (definitive source).
    try {
      final presentRecordsSnap = await _firestore
          .collection('attendance_records')
          .where('session_id', isEqualTo: sessionId)
          .where('status', isEqualTo: 'present')
          .get();
      for (final doc in presentRecordsSnap.docs) {
        final data = doc.data();
        final uid = (data['student_uid'] as String?)?.trim();
        if (uid != null && uid.isNotEmpty) {
          presentUids.add(uid);
          presentFromAttendanceRecords.add(uid);
          continue;
        }
        final legacyUid = (data['student_id'] as String?)?.trim();
        if (legacyUid != null && legacyUid.isNotEmpty) {
          presentUids.add(legacyUid);
          presentFromAttendanceRecords.add(legacyUid);
        }
      }
    } catch (e) {
      // Fallback: query by session only and filter status client-side.
      try {
        final bySession = await _firestore
            .collection('attendance_records')
            .where('session_id', isEqualTo: sessionId)
            .get();
        for (final doc in bySession.docs) {
          final data = doc.data();
          final statusRaw = data['status'];
          final status = statusRaw is String
              ? statusRaw.trim().toLowerCase()
              : '';
          if (status != 'present') {
            continue;
          }

          final uid = (data['student_uid'] as String?)?.trim();
          if (uid != null && uid.isNotEmpty) {
            presentUids.add(uid);
            presentFromAttendanceRecords.add(uid);
            continue;
          }
          final legacyUid = (data['student_id'] as String?)?.trim();
          if (legacyUid != null && legacyUid.isNotEmpty) {
            presentUids.add(legacyUid);
            presentFromAttendanceRecords.add(legacyUid);
          }
        }
      } catch (_) {
        // Ignore. We'll still have the session/subcollection sources.
      }
      print('[ABSENCE] Warning: attendance_records present query failed: $e');
    }

    final endedAtDateTime = endedAt.toDate();
    final dateString = DateFormat('yyyy-MM-dd').format(endedAtDateTime);

    // Debug visibility.
    print(
      '[ABSENCE] finalizeAbsences session=$sessionId module_id=$moduleKey enrolled=${enrolledSnap.docs.length} '
      'presentSet=${presentUids.length} (sessionArray=${presentFromSessionArray.length}, '
      'sessionAttendance=${presentFromAttendanceSubcollection.length}, attendance_records=${presentFromAttendanceRecords.length})',
    );

    // Hard guarantee: if a student is present, there must NOT be an absence record.
    // Delete deterministic absence docs for all present UIDs (idempotent).
    if (presentUids.isNotEmpty) {
      final presentList = presentUids.toList();
      const maxWritesPerBatch = 450;
      for (var i = 0; i < presentList.length; i += maxWritesPerBatch) {
        final chunk = presentList.sublist(
          i,
          (i + maxWritesPerBatch) > presentList.length
              ? presentList.length
              : (i + maxWritesPerBatch),
        );
        final batch = _firestore.batch();
        for (final uid in chunk) {
          final existing = await _firestore
              .collection('absence_records')
              .where('session_id', isEqualTo: sessionId)
              .where('student_uid', isEqualTo: uid)
              .get();
          for (final record in existing.docs) {
            batch.delete(record.reference);
          }
        }
        await batch.commit();
      }
    }

    // Missing students: enrolled - present.
    final absentStudentUids = <String>[];
    for (final studentDoc in enrolledSnap.docs) {
      final studentUid = studentDoc.id.trim();
      final isPresent =
          studentUid.isNotEmpty && presentUids.contains(studentUid);
      if (!isPresent) {
        absentStudentUids.add(studentUid);
      }
    }

    if (absentStudentUids.isEmpty) {
      print('[ABSENCE] No absences to create.');
      return;
    }

    print('[ABSENCE] absencesToCreate=${absentStudentUids.length}');

    // Batch write absence_records. Use deterministic doc IDs for idempotency.
    const maxWritesPerBatch = 450;
    for (var i = 0; i < absentStudentUids.length; i += maxWritesPerBatch) {
      final chunk = absentStudentUids.sublist(
        i,
        (i + maxWritesPerBatch) > absentStudentUids.length
            ? absentStudentUids.length
            : (i + maxWritesPerBatch),
      );

      final batch = _firestore.batch();
      var skippedAlreadyPresent = 0;
      for (final studentUid in chunk) {
        // Safety guard: do NOT create absence if present by any source.
        if (presentUids.contains(studentUid)) {
          skippedAlreadyPresent++;
          continue;
        }

        // Extra guard specifically requested: if a "present" attendance record exists
        // for (session_id, student_uid), skip absence creation.
        if (presentFromAttendanceRecords.contains(studentUid)) {
          skippedAlreadyPresent++;
          continue;
        }

        final docId = '${sessionId}_$studentUid';
        final ref = _firestore.collection('absence_records').doc(docId);
        batch.set(ref, {
          'student_uid': studentUid,
          'module_id': moduleKey,
          'session_id': sessionId,
          'timestamp': endedAt,
          'date': dateString,
          'status': 'Absent',
        }, SetOptions(merge: true));
      }

      print(
        '[ABSENCE] batchChunk=${chunk.length} writes=${chunk.length - skippedAlreadyPresent} skippedAlreadyPresent=$skippedAlreadyPresent',
      );
      await batch.commit();
    }
  }

  /// Get active session data
  Stream<DocumentSnapshot> getSessionStream(String sessionId) {
    return _firestore.collection('active_sessions').doc(sessionId).snapshots();
  }

  /// Get attendance records for a session
  Stream<QuerySnapshot> getAttendanceRecordsStream(String sessionId) {
    return _firestore
        .collection('attendance_records')
        .where('session_id', isEqualTo: sessionId)
        .orderBy('marked_at', descending: true)
        .snapshots();
  }

  /// Get active sessions list for a lecturer
  Stream<QuerySnapshot> getActiveSessionsStream(String lecturerId) {
    return _firestore
        .collection('active_sessions')
        .where('lecturer_id', isEqualTo: lecturerId)
        .where('status', isEqualTo: 'active')
        .snapshots();
  }

  /// Get completed sessions list for a lecturer
  Stream<QuerySnapshot> getCompletedSessionsStream(String lecturerId) {
    return _firestore
        .collection('active_sessions')
        .where('lecturer_id', isEqualTo: lecturerId)
        .where('status', isEqualTo: 'completed')
        .snapshots();
  }
}
