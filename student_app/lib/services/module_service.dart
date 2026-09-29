import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/module.dart';
import '../utils/crypto_utils.dart';

class WrongEnrollmentPasswordException implements Exception {
  WrongEnrollmentPasswordException();

  @override
  String toString() => 'Wrong password';
}

class ModuleService {
  ModuleService({FirebaseFirestore? firestore})
    : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  Stream<List<Module>> watchAllModules() {
    return _firestore
        .collection('modules')
        .orderBy('code')
        .snapshots()
        .map((snapshot) => snapshot.docs.map(Module.fromDoc).toList());
  }

  Stream<Set<String>> watchEnrolledCodes(String studentUid) {
    final uid = studentUid.trim();
    return _firestore.collection('students').doc(uid).snapshots().map((snap) {
      final data = snap.data();
      final raw = data?['enrolled_module_ids'];
      final out = <String>{};
      if (raw is List) {
        for (final item in raw) {
          if (item is String) {
            final trimmed = item.trim();
            if (trimmed.isNotEmpty) out.add(trimmed);
          }
        }
      }
      return out;
    });
  }

  Future<void> enrollWithPassword({
    required String studentUid,
    required Module module,
    required String plainPassword,
  }) async {
    final uid = studentUid.trim();
    if (uid.isEmpty) throw Exception('studentUid is required');

    final code = module.code.trim();
    if (code.isEmpty) {
      throw Exception('Module code is missing. Contact administrator.');
    }

    final password = plainPassword;
    if (password.isEmpty) {
      throw Exception('Password is required');
    }

    final moduleRef = _firestore.collection('modules').doc(module.id);
    final moduleSnap = await moduleRef.get();
    if (!moduleSnap.exists) {
      throw Exception('Module not found');
    }

    final moduleData = moduleSnap.data() ?? const <String, dynamic>{};
    final enabled = moduleData['enrollment_enabled'] == true;
    if (!enabled) {
      throw Exception('Enrollment is not enabled for this module');
    }

    final storedHash =
        (moduleData['enrollment_password_hash'] as String?)
            ?.trim()
            .toLowerCase() ??
        '';

    if (storedHash.isEmpty) {
      throw Exception('Enrollment password is not set for this module');
    }

    final typedHash = sha256Hex(password).trim().toLowerCase();
    if (typedHash != storedHash) {
      throw WrongEnrollmentPasswordException();
    }

    final studentRef = _firestore.collection('students').doc(uid);
    final enrollmentRef = studentRef.collection('enrollments').doc(code);

    await _firestore.runTransaction((tx) async {
      final studentSnap = await tx.get(studentRef);
      final studentData = studentSnap.data();
      final enrolledRaw = studentData?['enrolled_module_ids'];

      final enrolled = <String>{};
      if (enrolledRaw is List) {
        for (final item in enrolledRaw) {
          if (item is String) {
            final trimmed = item.trim();
            if (trimmed.isNotEmpty) enrolled.add(trimmed);
          }
        }
      }

      if (enrolled.contains(code)) {
        return; // idempotent
      }

      final attendanceCounts = studentData?['attendance_counts'];

      final shouldInitAttendance =
          attendanceCounts is! Map || !attendanceCounts.containsKey(code);

      final updates = <String, dynamic>{
        'enrolled_module_ids': FieldValue.arrayUnion([code]),
      };
      if (shouldInitAttendance) {
        updates['attendance_counts.$code'] = 0;
      }

      // Create doc if missing without overwriting other fields.
      tx.set(studentRef, updates, SetOptions(merge: true));

      // Increment enrolled count on the module document
      tx.set(moduleRef, {
        'enrolled_count': FieldValue.increment(1),
      }, SetOptions(merge: true));

      // Optional enrollment subcollection.
      tx.set(enrollmentRef, {
        'moduleId': module.id,
        'code': code,
        'name': module.name,
        'enrolledAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    });
  }
}
