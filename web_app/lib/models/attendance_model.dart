import 'package:cloud_firestore/cloud_firestore.dart';

class AttendanceModel {
  final String id;
  final String sessionId;
  final String studentId;
  final String regNo;
  final DateTime? markedAt;
  final int rssi;
  final String status;

  AttendanceModel({
    required this.id,
    required this.sessionId,
    required this.studentId,
    required this.regNo,
    this.markedAt,
    required this.rssi,
    required this.status,
  });

  factory AttendanceModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return AttendanceModel(
      id: doc.id,
      sessionId: data['session_id'] ?? '',
      studentId: data['student_id'] ?? '',
      regNo: data['reg_no'] ?? '',
      markedAt: (data['marked_at'] as Timestamp?)?.toDate(),
      rssi: (data['rssi'] as num?)?.toInt() ?? 0,
      status: data['status'] ?? 'present',
    );
  }
}
