import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/module.dart';

class ModuleService {
  ModuleService({FirebaseFirestore? firestore})
    : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  Stream<List<Module>> watchModulesForLecturer(String lecturerUid) {
    return _firestore
        .collection('modules')
        .where('lecturer_id', isEqualTo: lecturerUid)
        .snapshots()
        .map((snapshot) {
          final modules = snapshot.docs
              .map((d) => Module.fromDoc(d))
              .where((m) => m.code.trim().isNotEmpty)
              .toList(growable: false);
          final sorted = [...modules]
            ..sort(
              (a, b) => a.code.toUpperCase().compareTo(b.code.toUpperCase()),
            );
          return List<Module>.unmodifiable(sorted);
        });
  }
}
