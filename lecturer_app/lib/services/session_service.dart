import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:intl/intl.dart';

class SessionService {
  static final SessionService _instance = SessionService._internal();
  factory SessionService() => _instance;
  SessionService._internal();

  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  String? _activeSessionId;
  String? get activeSessionId => _activeSessionId;

  /// Create a new attendance session
  Future<String> createSession({
    required String moduleCode,
    required String sessionTopic,
    String? moduleId,
  }) async {
    try {
      final user = _auth.currentUser;
      if (user == null) throw Exception('User not authenticated');

      final sessionRef = _firestore.collection('active_sessions').doc();

      final resolvedModuleId = (moduleId?.trim().isNotEmpty ?? false)
          ? moduleId!.trim()
          : moduleCode.toUpperCase().trim();

      await sessionRef.set({
        'session_id': sessionRef.id,
        'lecturer_id': user.uid,
        'module_id': resolvedModuleId,
        'module_code': moduleCode.toUpperCase(),
        'session_topic': sessionTopic,
        'created_at': FieldValue.serverTimestamp(),
        'started_at': FieldValue.serverTimestamp(),
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

  /// Mark student as present in current session
  Future<void> markAttendance({
    required String sessionId,
    required String studentId,
    required String regNo,
    required int rssi,
  }) async {
    try {
      final sessionRef = _firestore
          .collection('active_sessions')
          .doc(sessionId);
      final activeAttendanceRef = sessionRef
          .collection('attendance')
          .doc(regNo);
      final attendanceRef = _firestore.collection('attendance_records').doc();

      final sessionSnap = await sessionRef.get();
      if (!sessionSnap.exists) {
        throw Exception('Session not found');
      }
      final sessionData = sessionSnap.data() as Map<String, dynamic>;
      final moduleKey =
          ((sessionData['module_id'] as String?)?.trim() ??
                  (sessionData['module_code'] as String?)?.trim() ??
                  (sessionData['module'] as String?)?.trim() ??
                  '')
              .toUpperCase();
      if (moduleKey.isEmpty) {
        throw Exception(
          'Missing module code in session (module_id/module_code/module)',
        );
      }

      final now = DateTime.now();
      final dateString = DateFormat('yyyy-MM-dd').format(now);

      // Check if already marked
      final existingRecords = await _firestore
          .collection('attendance_records')
          .where('session_id', isEqualTo: sessionId)
          .where('student_id', isEqualTo: studentId)
          .limit(1)
          .get();

      if (existingRecords.docs.isNotEmpty) {
        // Already marked in root collection. Ensure the per-session doc exists too.
        final batch = _firestore.batch();
        batch.set(activeAttendanceRef, {
          'student_uid': studentId,
          'student_id': studentId,
          'reg_no': regNo,
          'timestamp': FieldValue.serverTimestamp(),
          'date': dateString,
          'rssi': rssi,
          'status': 'present',
        }, SetOptions(merge: true));
        await batch.commit();
        return;
      }

      // Batch write: per-session attendance + root attendance record + session counters.
      final batch = _firestore.batch();
      final studentRef = _firestore.collection('students').doc(studentId);

      batch.set(activeAttendanceRef, {
        'student_uid': studentId,
        'student_id': studentId,
        'reg_no': regNo,
        'timestamp': FieldValue.serverTimestamp(),
        'date': dateString,
        'rssi': rssi,
        'status': 'present',
      }, SetOptions(merge: true));

      batch.set(attendanceRef, {
        // New fields requested
        'student_uid': studentId,
        'module_id': moduleKey,
        'session_id': sessionId,
        'timestamp': FieldValue.serverTimestamp(),
        'date': dateString,

        // Backward-compatible fields (used by existing student stats code)
        'record_id': attendanceRef.id,
        'student_id': studentId,
        'module_code': moduleKey,
        'reg_no': regNo,
        'marked_at': FieldValue.serverTimestamp(),
        'rssi': rssi,
        'status': 'present',
      });

      batch.update(sessionRef, {
        'student_count': FieldValue.increment(1),
        'students_present': FieldValue.arrayUnion([studentId]),
      });

      // Firestore counter: increment student's attendance count for this module.
      // Uses merge so it won't overwrite other modules' counters.
      batch.set(studentRef, {
        'attendance_counts.$moduleKey': FieldValue.increment(1),
      }, SetOptions(merge: true));

      await batch.commit();
    } catch (e) {
      throw Exception('Failed to mark attendance: $e');
    }
  }

  /// End current session
  Future<void> endSession(String sessionId, {int? totalStudents}) async {
    try {
      final sessionRef = _firestore
          .collection('active_sessions')
          .doc(sessionId);

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
      });

      if (moduleKeyOut != null && moduleKeyOut!.isNotEmpty && endedAtOut != null) {
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
    final studentsPresentRaw =
        (sessionData is Map<String, dynamic>) ? sessionData['students_present'] : null;
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
          final status = statusRaw is String ? statusRaw.trim().toLowerCase() : '';
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
          final docId = '${sessionId}_$uid';
          batch.delete(_firestore.collection('absence_records').doc(docId));
        }
        await batch.commit();
      }
    }

    // Missing students: enrolled - present.
    final absentStudentUids = <String>[];
    for (final studentDoc in enrolledSnap.docs) {
      final studentUid = studentDoc.id.trim();
      final isPresent = studentUid.isNotEmpty && presentUids.contains(studentUid);
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
}
