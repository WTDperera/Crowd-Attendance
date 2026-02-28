import 'package:cloud_firestore/cloud_firestore.dart';

class SessionModel {
  final String id;
  final String lecturerId;
  final String moduleCode;
  final String sessionTopic;
  final DateTime? createdAt;
  final DateTime? startedAt;
  final DateTime? endedAt;
  final String status; // 'active' | 'completed'
  final int studentCount;

  SessionModel({
    required this.id,
    required this.lecturerId,
    required this.moduleCode,
    required this.sessionTopic,
    this.createdAt,
    this.startedAt,
    this.endedAt,
    required this.status,
    required this.studentCount,
  });

  factory SessionModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return SessionModel(
      id: doc.id,
      lecturerId: data['lecturer_id'] ?? '',
      moduleCode: data['module_code'] ?? data['module'] ?? '',
      sessionTopic: data['session_topic'] ?? data['topic'] ?? '',
      createdAt: (data['created_at'] as Timestamp?)?.toDate(),
      startedAt: (data['started_at'] as Timestamp?)?.toDate(),
      endedAt: (data['ended_at'] as Timestamp?)?.toDate(),
      status: data['status'] ?? 'completed',
      studentCount: data['student_count'] ?? 0,
    );
  }

  bool get isActive => status == 'active';
}
