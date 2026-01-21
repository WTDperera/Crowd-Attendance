import 'package:cloud_firestore/cloud_firestore.dart';

class StudentService {
  final _db = FirebaseFirestore.instance;

  /// Returns the student's registration number for a given device identifier.
  /// Looks up the `students` collection where field `device_id` == [deviceId].
  Future<String?> findRegNoByDeviceId(String deviceId) async {
    try {
      final q = await _db
          .collection('students')
          .where('device_id', isEqualTo: deviceId)
          .limit(1)
          .get();
      if (q.docs.isEmpty) return null;
      final data = q.docs.first.data();
      return data['reg_no'] as String?;
    } catch (_) {
      return null;
    }
  }
}
