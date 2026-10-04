import 'package:lecturer_app/services/firebase_environment.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:intl/intl.dart';
import 'round_service.dart';
import 'api_client.dart';

class SessionService {
  static final SessionService _instance = SessionService._internal();
  factory SessionService() => _instance;
  SessionService._internal();

  final FirebaseFirestore _firestore = appFirestore;
  final FirebaseAuth _auth = appAuth;

  final RoundService _roundService = RoundService();

  String? _activeSessionId;
  String? get activeSessionId => _activeSessionId;

  /// Helper to format duration string
  static String formatDurationString(DateTime start, DateTime end) {
    final diffMinutes = end.difference(start).inMinutes;
    final hrs = diffMinutes ~/ 60;
    final mins = diffMinutes % 60;
    String durationText;
    if (hrs > 0 && mins > 0) {
      durationText = '${hrs}h ${mins}m';
    } else if (hrs > 0) {
      durationText = '$hrs hr${hrs > 1 ? "s" : ""}';
    } else {
      durationText = '$mins mins';
    }
    final startStr = DateFormat('hh:mm a').format(start);
    final endStr = DateFormat('hh:mm a').format(end);
    return '$startStr - $endStr ($durationText)';
  }

  /// Create a new attendance session
  Future<String> createSession({
    required String moduleCode,
    required String sessionTopic,
    String? moduleId,
    DateTime? startTime,
    DateTime? endTime,
  }) async {
    try {
      final user = _auth.currentUser;
      if (user == null) throw Exception('User not authenticated');

      final sessionRef = _firestore.collection('active_sessions').doc();

      final resolvedModuleId = (moduleId?.trim().isNotEmpty ?? false)
          ? moduleId!.trim()
          : moduleCode.toUpperCase().trim();

      final start = startTime ?? DateTime.now();
      final end = endTime ?? start.add(const Duration(hours: 2));
      final durationMins = end.difference(start).inMinutes;
      final formattedDuration = formatDurationString(start, end);
      final startStr = DateFormat('hh:mm a').format(start);
      final endStr = DateFormat('hh:mm a').format(end);

      await _roundService.createSession(sessionRef, {
        'session_id': sessionRef.id,
        'lecturer_id': user.uid,
        'module_id': resolvedModuleId,
        'module_code': moduleCode.toUpperCase(),
        'module': moduleCode.toUpperCase(),
        'session_topic': sessionTopic,
        'topic': sessionTopic,
        'created_at': FieldValue.serverTimestamp(),
        'started_at': Timestamp.fromDate(start),
        'ended_at': Timestamp.fromDate(end),
        'start_time': Timestamp.fromDate(start),
        'end_time': Timestamp.fromDate(end),
        'duration_minutes': durationMins,
        'duration_formatted': formattedDuration,
        'duration_range': '$startStr - $endStr',
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

  Future<String> beginRound(String sessionId) => _roundService.begin(sessionId);
  Future<void> completeRound(String sessionId, String roundId) =>
      _roundService.finish(sessionId, roundId);
  Future<void> cancelRound(String sessionId, String roundId) =>
      _roundService.finish(sessionId, roundId, cancel: true);
  Future<Map<String, String>> loadSessionRoster(String sessionId) =>
      _roundService.loadRoster(sessionId);

  Future<bool> markAttendance({
    required String sessionId,
    required String roundId,
    required String studentId,
    required String regNo,
    required int rssi,
  }) => _roundService.mark(
    sessionId: sessionId,
    roundId: roundId,
    studentId: studentId,
    regNo: regNo,
    rssi: rssi,
  );

  /// All outcomes, absences and counters commit through the owner API together.
  Future<void> endSession(String sessionId, {int? totalStudents}) async {
    await ApiClient().post(
      '/api/attendance/session/${Uri.encodeComponent(sessionId)}/complete',
      {},
    );
    _activeSessionId = null;
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

  /// Get active sessions list for a lecturer
  Stream<QuerySnapshot> getActiveSessionsStream(String lecturerId) =>
      _ownedSessionsStream(lecturerId, 'active');

  /// Get completed sessions list for a lecturer
  Stream<QuerySnapshot> getCompletedSessionsStream(String lecturerId) =>
      _ownedSessionsStream(lecturerId, 'completed');

  Stream<QuerySnapshot> _ownedSessionsStream(
    String lecturerId,
    String status,
  ) async* {
    // Rules require ownership of both the lecturer and module. A query scoped
    // only to lecturer_id cannot prove module ownership. Resolve owned module
    // IDs from the server and constrain the session query too.
    final modules = await _firestore
        .collection('modules')
        .where('lecturer_id', isEqualTo: lecturerId)
        .get(const GetOptions(source: Source.server));
    final ids = modules.docs.map((doc) => doc.id).toList();
    if (ids.isEmpty) return;
    if (ids.length > 30) {
      throw StateError('Too many modules for this session query.');
    }
    yield* _firestore
        .collection('active_sessions')
        .where('lecturer_id', isEqualTo: lecturerId)
        .where('module_id', whereIn: ids)
        .where('status', isEqualTo: status)
        .snapshots();
  }
}
