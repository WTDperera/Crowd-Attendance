import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/student_model.dart';
import '../models/lecturer_model.dart';
import '../models/session_model.dart';
import '../models/attendance_model.dart';

class FirestoreService {
  static final FirestoreService _instance = FirestoreService._internal();
  factory FirestoreService() => _instance;
  FirestoreService._internal();

  final FirebaseFirestore _db = FirebaseFirestore.instance;

  // ============================================================
  // DASHBOARD STATS
  // ============================================================

  Future<Map<String, int>> getDashboardStats() async {
    final results = await Future.wait([
      _db.collection('students').count().get(),
      _db.collection('lecturers').count().get(),
      _db.collection('active_sessions').count().get(),
      _db
          .collection('active_sessions')
          .where('status', isEqualTo: 'active')
          .count()
          .get(),
    ]);

    return {
      'students': results[0].count ?? 0,
      'lecturers': results[1].count ?? 0,
      'sessions': results[2].count ?? 0,
      'activeSessions': results[3].count ?? 0,
    };
  }

  // ============================================================
  // STUDENTS
  // ============================================================

  Stream<List<StudentModel>> getStudentsStream() {
    return _db
        .collection('students')
        .orderBy('reg_no')
        .snapshots()
        .map((snap) => snap.docs.map(StudentModel.fromFirestore).toList());
  }

  Future<void> addStudent({
    required String uid,
    required String regNo,
    required String email,
  }) async {
    await _db.collection('students').doc(uid).set({
      'reg_no': regNo.toLowerCase(),
      'email': email,
      'device_id': null,
      'created_at': FieldValue.serverTimestamp(),
    });
  }

  Future<void> resetStudentDevice(String uid) async {
    await _db.collection('students').doc(uid).update({
      'device_id': null,
      'device_model': null,
      'device_locked_at': null,
    });
  }

  Future<void> deleteStudent(String uid) async {
    await _db.collection('students').doc(uid).delete();
  }

  // ============================================================
  // LECTURERS
  // ============================================================

  Stream<List<LecturerModel>> getLecturersStream() {
    return _db
        .collection('lecturers')
        .orderBy('email')
        .snapshots()
        .map((snap) => snap.docs.map(LecturerModel.fromFirestore).toList());
  }

  Future<void> addLecturer({
    required String uid,
    required String name,
    required String email,
    String? department,
  }) async {
    await _db.collection('lecturers').doc(uid).set({
      'name': name,
      'email': email,
      'department': department ?? '',
      'device_id': null,
      'created_at': FieldValue.serverTimestamp(),
    });
  }

  Future<void> resetLecturerDevice(String uid) async {
    await _db.collection('lecturers').doc(uid).update({
      'device_id': null,
      'device_model': null,
      'device_locked_at': null,
    });
  }

  Future<void> deleteLecturer(String uid) async {
    await _db.collection('lecturers').doc(uid).delete();
  }

  // ============================================================
  // SESSIONS
  // ============================================================

  Stream<List<SessionModel>> getSessionsStream() {
    return _db
        .collection('active_sessions')
        .orderBy('created_at', descending: true)
        .snapshots()
        .map((snap) => snap.docs.map(SessionModel.fromFirestore).toList());
  }

  Stream<List<SessionModel>> getActiveSessionsStream() {
    return _db
        .collection('active_sessions')
        .where('status', isEqualTo: 'active')
        .orderBy('created_at', descending: true)
        .snapshots()
        .map((snap) => snap.docs.map(SessionModel.fromFirestore).toList());
  }

  Future<SessionModel?> getSession(String sessionId) async {
    final doc =
        await _db.collection('active_sessions').doc(sessionId).get();
    if (!doc.exists) return null;
    return SessionModel.fromFirestore(doc);
  }

  Future<void> endSession(String sessionId) async {
    await _db.collection('active_sessions').doc(sessionId).update({
      'status': 'completed',
      'ended_at': FieldValue.serverTimestamp(),
    });
  }

  Future<void> deleteSession(String sessionId) async {
    // Delete attendance records first
    final records = await _db
        .collection('attendance_records')
        .where('session_id', isEqualTo: sessionId)
        .get();
    final batch = _db.batch();
    for (var doc in records.docs) {
      batch.delete(doc.reference);
    }
    batch.delete(_db.collection('active_sessions').doc(sessionId));
    await batch.commit();
  }

  // ============================================================
  // ATTENDANCE RECORDS
  // ============================================================

  Stream<List<AttendanceModel>> getAttendanceStream(String sessionId) {
    return _db
        .collection('attendance_records')
        .where('session_id', isEqualTo: sessionId)
        .orderBy('marked_at', descending: false)
        .snapshots()
        .map((snap) =>
            snap.docs.map(AttendanceModel.fromFirestore).toList());
  }

  Future<List<AttendanceModel>> getAttendanceForSession(
      String sessionId) async {
    final snap = await _db
        .collection('attendance_records')
        .where('session_id', isEqualTo: sessionId)
        .orderBy('marked_at')
        .get();
    return snap.docs.map(AttendanceModel.fromFirestore).toList();
  }

  /// Get lecturer name by uid
  Future<String> getLecturerName(String uid) async {
    try {
      final doc = await _db.collection('lecturers').doc(uid).get();
      if (doc.exists) {
        final data = doc.data()!;
        return data['name'] ?? data['email'] ?? 'Unknown';
      }
      return 'Unknown';
    } catch (_) {
      return 'Unknown';
    }
  }
}
