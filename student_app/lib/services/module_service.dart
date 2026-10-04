import 'package:student_app/services/firebase_environment.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/module.dart';
import 'api_client.dart';

class WrongEnrollmentPasswordException implements Exception {
  WrongEnrollmentPasswordException();

  @override
  String toString() => 'Wrong password';
}

class ModuleService {
  ModuleService({FirebaseFirestore? firestore, FirebaseAuth? auth})
    : _firestore = firestore ?? appFirestore,
      _auth = auth ?? appAuth;

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  Stream<List<Module>> watchAllModules() {
    return _firestore
        .collection('module_catalog')
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

    if (_auth.currentUser?.uid != uid) {
      throw StateError('Enrollment must use the signed-in student identity.');
    }
    try {
      final result = await ApiClient(auth: _auth).post(
        '/api/student/modules/${Uri.encodeComponent(module.id)}/enroll',
        {'password': password},
      );
      if (result['success'] != true || result['code'] != code) {
        throw StateError('Invalid enrollment response.');
      }
    } on ApiException catch (error) {
      if (error.status == 403 &&
          error.message == 'Wrong enrollment password.') {
        throw WrongEnrollmentPasswordException();
      }
      rethrow;
    }
  }
}
