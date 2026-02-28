import 'package:cloud_firestore/cloud_firestore.dart';

class StudentModel {
  final String uid;
  final String regNo;
  final String email;
  final String? deviceId;
  final String? deviceModel;
  final DateTime? deviceLockedAt;
  final DateTime? lastLogin;

  StudentModel({
    required this.uid,
    required this.regNo,
    required this.email,
    this.deviceId,
    this.deviceModel,
    this.deviceLockedAt,
    this.lastLogin,
  });

  factory StudentModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return StudentModel(
      uid: doc.id,
      regNo: data['reg_no'] ?? '',
      email: data['email'] ?? '',
      deviceId: data['device_id'],
      deviceModel: data['device_model'],
      deviceLockedAt: (data['device_locked_at'] as Timestamp?)?.toDate(),
      lastLogin: (data['last_login'] as Timestamp?)?.toDate(),
    );
  }

  bool get isDeviceLocked => deviceId != null && deviceId!.isNotEmpty;
}
