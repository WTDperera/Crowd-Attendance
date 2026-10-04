import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'firebase_environment.dart';
import 'round_domain.dart';

class RoundException implements Exception {
  RoundException(this.message);
  final String message;
  @override
  String toString() => message;
}

class RoundService {
  RoundService({
    FirebaseFirestore? firestore,
    FirebaseAuth? auth,
    this.beforeCommit,
  }) : db = firestore ?? appFirestore,
       auth = auth ?? appAuth;
  final FirebaseFirestore db;
  final FirebaseAuth auth;
  // Optional command injection for atomic-failure tests; normal clients omit it.
  final void Function(Transaction)? beforeCommit;

  // All validation/reads precede writes in the three operations below. Return
  // callback failures as values and throw after native transaction completion:
  // cloud_firestore 5.6.12 can double-complete a throwing callback on Android.
  Future<T> _transaction<T>(Future<T> Function(Transaction) operation) async {
    final attempt = await db.runTransaction<_RoundAttempt<T>>((tx) async {
      try {
        return _RoundAttempt(value: await operation(tx));
      } catch (error) {
        return _RoundAttempt(error: error);
      }
    });
    if (attempt.error != null) throw attempt.error!;
    return attempt.value as T;
  }

  void checkSession(Map<String, dynamic> data) {
    if (auth.currentUser == null ||
        data['lecturer_id'] != auth.currentUser!.uid) {
      throw RoundException('Session owner required.');
    }
    if (data['status'] != 'active' || data['round_schema'] != 2) {
      throw RoundException(
        'Scanning requires an active session with a saved roster. Create a new session for legacy data.',
      );
    }
  }

  Future<Map<String, String>> captureRoster(String moduleId) async {
    final students = await db
        .collection('students')
        .where('enrolled_module_ids', arrayContains: moduleId)
        .get(const GetOptions(source: Source.server));
    final roster = <String, String>{};
    final labels = <String>{};
    for (final student in students.docs) {
      if (student.data()['lifecycle_status'] == 'deleting') continue;
      final label = student.data()['reg_no'];
      if (label is! String ||
          label.trim().isEmpty ||
          label.contains('\x00') ||
          !labels.add(label)) {
        throw RoundException(
          'Resolve missing or ambiguous roster registrations before scanning.',
        );
      }
      roster[student.id] = label;
    }
    return roster;
  }

  Future<Map<String, String>> loadRoster(String sessionId) async {
    final session = await db
        .doc('active_sessions/$sessionId')
        .get(const GetOptions(source: Source.server));
    final data = session.data();
    if (data == null) throw RoundException('Session not found.');
    checkSession(data);
    final roster = Map<String, String>.from(data['eligible_roster'] as Map);
    if (roster.values.toSet().length != roster.length) {
      throw RoundException('Ambiguous roster registrations.');
    }
    return {for (final entry in roster.entries) entry.value: entry.key};
  }

  Future<void> createSession(
    DocumentReference<Map<String, dynamic>> ref,
    Map<String, dynamic> data,
  ) async {
    final moduleRef = db.doc('modules/${data['module_id']}');
    final before = await moduleRef.get(const GetOptions(source: Source.server));
    final count = before.data()?['enrolled_count'];
    final roster = await captureRoster(data['module_id'] as String);
    await _transaction<void>((tx) async {
      final module = await tx.get(moduleRef);
      if (count is! int ||
          roster.length != count ||
          module.data()?['enrolled_count'] != count) {
        throw RoundException(
          'Enrollment changed or needs repair. Retry session creation.',
        );
      }
      for (final entry in roster.entries) {
        final student = await tx.get(db.doc('students/${entry.key}'));
        if (student.data()?['reg_no'] != entry.value ||
            student.data()?['lifecycle_status'] == 'deleting' ||
            !List<String>.from(
              student.data()?['enrolled_module_ids'] as List? ?? [],
            ).contains(data['module_id'])) {
          throw RoundException('Roster changed. Retry session creation.');
        }
      }
      tx.set(ref, {
        ...data,
        'round_schema': 2,
        'eligible_roster': roster,
        'rounds_started': 0,
        'scans_performed': 0,
        'active_round_id': null,
      });
      for (final entry in roster.entries) {
        tx.set(ref.collection('roster').doc(entry.key), {
          'student_uid': entry.key,
          'reg_no': entry.value,
          'module_id': data['module_id'],
          'captured_at': FieldValue.serverTimestamp(),
        });
      }
    });
  }

  /// Explicit start returns the open round after retry/reopen; concurrent starts
  /// share one identity. A new round is possible only after completion/cancel.
  Future<String> begin(String sessionId) async {
    try {
      return await _begin(sessionId);
    } on FirebaseException catch (error) {
      if (error.code != 'permission-denied') rethrow;
      // Rules may reject a raced create before the SDK retries its read set.
      // Accept only the owner's server-confirmed open round, never cached state.
      final ref = db.doc('active_sessions/$sessionId');
      final data = (await ref.get(
        const GetOptions(source: Source.server),
      )).data();
      if (data == null) rethrow;
      checkSession(data);
      final id = data['active_round_id'] as String?;
      if (id == null) rethrow;
      final round = await ref
          .collection('rounds')
          .doc(id)
          .get(const GetOptions(source: Source.server));
      if (round.data()?['status'] != 'open') rethrow;
      return id;
    }
  }

  Future<String> _begin(String sessionId) => _transaction<String>((tx) async {
    final ref = db.doc('active_sessions/$sessionId');
    final session = await tx.get(ref);
    final data = session.data();
    if (data == null) throw RoundException('Session not found.');
    checkSession(data);
    final active = data['active_round_id'] as String?;
    if (active != null) {
      final round = await tx.get(ref.collection('rounds').doc(active));
      if (round.data()?['status'] != 'open') {
        throw RoundException('Round state needs repair.');
      }
      return active;
    }
    final ordinal = (data['rounds_started'] as int? ?? 0) + 1;
    final id = 'r$ordinal';
    final roundRef = ref.collection('rounds').doc(id);
    if ((await tx.get(roundRef)).exists) {
      throw RoundException('Round identity already exists.');
    }
    tx.set(roundRef, {
      'round_id': id,
      'ordinal': ordinal,
      'status': 'open',
      'started_at': FieldValue.serverTimestamp(),
    });
    tx.update(ref, {'active_round_id': id, 'rounds_started': ordinal});
    return id;
  });

  Future<void> finish(
    String sessionId,
    String roundId, {
    bool cancel = false,
  }) async {
    try {
      await _finish(sessionId, roundId, cancel: cancel);
    } on FirebaseException catch (error) {
      if (error.code != 'permission-denied') rethrow;
      final ref = db.doc('active_sessions/$sessionId');
      final data = (await ref.get(
        const GetOptions(source: Source.server),
      )).data();
      if (data == null) rethrow;
      checkSession(data);
      final round = await ref
          .collection('rounds')
          .doc(roundId)
          .get(const GetOptions(source: Source.server));
      if (round.data()?['status'] != (cancel ? 'cancelled' : 'completed')) {
        rethrow;
      }
    }
  }

  Future<void> _finish(
    String sessionId,
    String roundId, {
    bool cancel = false,
  }) => _transaction<void>((tx) async {
    final ref = db.doc('active_sessions/$sessionId');
    final roundRef = ref.collection('rounds').doc(roundId);
    final session = await tx.get(ref);
    final round = await tx.get(roundRef);
    final data = session.data();
    if (data == null) throw RoundException('Session not found.');
    checkSession(data);
    final desired = cancel ? 'cancelled' : 'completed';
    if (round.data()?['status'] == desired) return; // lost acknowledgement
    if (data['active_round_id'] != roundId ||
        round.data()?['status'] != 'open') {
      throw RoundException('Round is not open.');
    }
    tx.update(roundRef, {
      'status': desired,
      'finished_at': FieldValue.serverTimestamp(),
    });
    tx.update(ref, {
      'active_round_id': null,
      if (!cancel) 'scans_performed': FieldValue.increment(1),
    });
  });

  Future<bool> mark({
    required String sessionId,
    required String roundId,
    required String studentId,
    required String regNo,
    required int rssi,
  }) async {
    try {
      return await _mark(
        sessionId: sessionId,
        roundId: roundId,
        studentId: studentId,
        regNo: regNo,
        rssi: rssi,
      );
    } on FirebaseException catch (error) {
      if (error.code != 'permission-denied') rethrow;
      final ref = db.doc('active_sessions/$sessionId');
      final data = (await ref.get(
        const GetOptions(source: Source.server),
      )).data();
      if (data == null) rethrow;
      checkSession(data);
      final evidence =
          (await ref
                  .collection('rounds')
                  .doc(roundId)
                  .collection('observations')
                  .doc(studentId)
                  .get(const GetOptions(source: Source.server)))
              .data();
      if (evidence == null ||
          evidence['session_id'] != sessionId ||
          evidence['round_id'] != roundId ||
          evidence['student_uid'] != studentId ||
          evidence['reg_no'] != regNo) {
        rethrow;
      }
      return false;
    }
  }

  Future<bool> _mark({
    required String sessionId,
    required String roundId,
    required String studentId,
    required String regNo,
    required int rssi,
  }) => _transaction<bool>((tx) async {
    final sessionRef = db.doc('active_sessions/$sessionId');
    final roundRef = sessionRef.collection('rounds').doc(roundId);
    final observationRef = roundRef.collection('observations').doc(studentId);
    final recordRef = db
        .collection('attendance_records')
        .doc(attendanceDocumentId(sessionId, studentId));
    final nestedRef = sessionRef.collection('attendance').doc(studentId);
    final studentRef = db.doc('students/$studentId');
    final session = await tx.get(sessionRef);
    final round = await tx.get(roundRef);
    final observation = await tx.get(observationRef);
    final record = await tx.get(recordRef);
    final student = await tx.get(studentRef);
    final eligibility = await tx.get(
      sessionRef.collection('roster').doc(studentId),
    );
    final data = session.data();
    if (data == null) throw RoundException('Session not found.');
    checkSession(data);
    if (data['eligible_roster'] is! Map ||
        (data['eligible_roster'] as Map)[studentId] != regNo ||
        !student.exists ||
        eligibility.data()?['reg_no'] != regNo ||
        student.data()?['lifecycle_status'] == 'deleting' ||
        student.data()?['reg_no'] != regNo) {
      throw RoundException('Student is not eligible for this session.');
    }
    // A retry after successful completion may prove a prior immutable tuple,
    // but cannot add a late observation to a closed round.
    if (observation.exists) return false;
    if (data['active_round_id'] != roundId ||
        round.data()?['status'] != 'open') {
      throw RoundException('Round is not open.');
    }
    final module = data['module_id'] as String;
    final old = record.data();
    final rounds = {
      ...List<String>.from(old?['observed_round_ids'] as List? ?? []),
      roundId,
    }.toList();
    final now = DateTime.now();
    final date =
        '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    final identity = {
      'session_id': sessionId,
      'student_uid': studentId,
      'student_id': studentId,
      'reg_no': regNo,
      'module_id': module,
      'module_code': module,
    };
    beforeCommit?.call(tx);
    tx.set(observationRef, {
      ...identity,
      'round_id': roundId,
      'rssi': rssi,
      'observed_at': FieldValue.serverTimestamp(),
    });
    final summary = {
      ...identity,
      'record_id': recordRef.id,
      'round_schema': 2,
      'observed_round_ids': rounds,
      'scan_count': rounds.length,
      'timestamp': FieldValue.serverTimestamp(),
      'marked_at': FieldValue.serverTimestamp(),
      'date': date,
      'rssi': rssi,
      'status': 'pending',
      for (final field in [
        'duration_formatted',
        'start_time',
        'end_time',
        'duration_minutes',
      ])
        if (data[field] != null) field: data[field],
    };
    tx.set(recordRef, summary, SetOptions(merge: true));
    tx.set(nestedRef, summary, SetOptions(merge: true));
    if (!record.exists) {
      tx.update(sessionRef, {
        'student_count': FieldValue.increment(1),
        'students_present': FieldValue.arrayUnion([studentId]),
      });
      // Compatibility projection: one provisional class count, not per round.
      // Final outcome reconciliation remains P06.
      tx.update(studentRef, {
        'attendance_module_id': module,
        'attendance_session_id': sessionId,
        'attendance_counts.$module': FieldValue.increment(1),
      });
    }
    return true;
  });
}

class _RoundAttempt<T> {
  _RoundAttempt({this.value, this.error});
  final T? value;
  final Object? error;
}
