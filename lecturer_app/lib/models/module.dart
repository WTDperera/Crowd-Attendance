import 'package:cloud_firestore/cloud_firestore.dart';

class Module {
  const Module({
    required this.id,
    required this.code,
    required this.name,
    required this.lecturerId,
  });

  final String id;
  final String code;
  final String name;
  final String lecturerId;

  factory Module.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};

    return Module(
      id: doc.id,
      code: (data['code'] as Object?)?.toString().trim() ?? '',
      name: (data['name'] as Object?)?.toString().trim() ?? '',
      lecturerId: (data['lecturer_id'] as Object?)?.toString().trim() ?? '',
    );
  }
}
