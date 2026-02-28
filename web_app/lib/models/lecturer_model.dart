import 'package:cloud_firestore/cloud_firestore.dart';

class LecturerModel {
  final String uid;
  final String name;
  final String email;
  final String? department;
  final String? deviceId;
  final String? deviceModel;
  final DateTime? deviceLockedAt;
  final DateTime? lastLogin;

  LecturerModel({
    required this.uid,
    required this.name,
    required this.email,
    this.department,
    this.deviceId,
    this.deviceModel,
    this.deviceLockedAt,
    this.lastLogin,
  });

  factory LecturerModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return LecturerModel(
      uid: doc.id,
      name: data['name'] ?? data['email'] ?? 'Unknown',
      email: data['email'] ?? '',
      department: data['department'],
      deviceId: data['device_id'],
      deviceModel: data['device_model'],
      deviceLockedAt: (data['device_locked_at'] as Timestamp?)?.toDate(),
      lastLogin: (data['last_login'] as Timestamp?)?.toDate(),
    );
  }

  bool get isDeviceLocked => deviceId != null && deviceId!.isNotEmpty;
}
