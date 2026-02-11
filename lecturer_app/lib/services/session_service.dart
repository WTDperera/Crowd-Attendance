import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class SessionService {
  static final SessionService _instance = SessionService._internal();
  factory SessionService() => _instance;
  SessionService._internal();

  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  String? _activeSessionId;
  String? get activeSessionId => _activeSessionId;

  /// Create a new attendance session
  Future<String> createSession({
    required String moduleCode,
    required String sessionTopic,
  }) async {
    try {
      final user = _auth.currentUser;
      if (user == null) throw Exception('User not authenticated');

      final sessionRef = _firestore.collection('active_sessions').doc();
      
      await sessionRef.set({
        'session_id': sessionRef.id,
        'lecturer_id': user.uid,
        'module_code': moduleCode.toUpperCase(),
        'session_topic': sessionTopic,
        'created_at': FieldValue.serverTimestamp(),
        'started_at': FieldValue.serverTimestamp(),
        'status': 'active',
        'student_count': 0,
        'students_present': [], // Array of student IDs
      });

      _activeSessionId = sessionRef.id;
      return sessionRef.id;
    } catch (e) {
      throw Exception('Failed to create session: $e');
    }
  }

  /// Mark student as present in current session
  Future<void> markAttendance({
    required String sessionId,
    required String studentId,
    required String regNo,
    required int rssi,
  }) async {
    try {
      final sessionRef = _firestore.collection('active_sessions').doc(sessionId);
      final attendanceRef = _firestore.collection('attendance_records').doc();

      // Check if already marked
      final existingRecords = await _firestore
          .collection('attendance_records')
          .where('session_id', isEqualTo: sessionId)
          .where('student_id', isEqualTo: studentId)
          .limit(1)
          .get();

      if (existingRecords.docs.isNotEmpty) {
        // Already marked, skip
        return;
      }

      // Create attendance record
      await attendanceRef.set({
        'record_id': attendanceRef.id,
        'session_id': sessionId,
        'student_id': studentId,
        'reg_no': regNo,
        'marked_at': FieldValue.serverTimestamp(),
        'rssi': rssi,
        'status': 'present',
      });

      // Update session document
      await sessionRef.update({
        'student_count': FieldValue.increment(1),
        'students_present': FieldValue.arrayUnion([studentId]),
      });
    } catch (e) {
      throw Exception('Failed to mark attendance: $e');
    }
  }

  /// End current session
  Future<void> endSession(String sessionId) async {
    try {
      await _firestore.collection('active_sessions').doc(sessionId).update({
        'status': 'completed',
        'ended_at': FieldValue.serverTimestamp(),
      });
      _activeSessionId = null;
    } catch (e) {
      throw Exception('Failed to end session: $e');
    }
  }

  /// Get active session data
  Stream<DocumentSnapshot> getSessionStream(String sessionId) {
    return _firestore.collection('active_sessions').doc(sessionId).snapshots();
  }

  /// Get attendance records for a session
  Stream<QuerySnapshot> getAttendanceRecordsStream(String sessionId) {
    return _firestore
        .collection('attendance_records')
        .where('session_id', isEqualTo: sessionId)
        .orderBy('marked_at', descending: true)
        .snapshots();
  }
}
