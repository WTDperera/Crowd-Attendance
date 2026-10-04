import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:lecturer_app/services/firebase_environment.dart';
import 'package:lecturer_app/services/module_service.dart';
import 'package:lecturer_app/services/session_service.dart';
import 'package:lecturer_app/services/qa_config.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('P04 Android lecturer session writes and owner isolation', (
    _,
  ) async {
    expect(defaultTargetPlatform, TargetPlatform.android);
    QaConfig.validate();
    expect(QaConfig.enabled, isTrue);
    await initializeAppFirebase();
    String? sessionId;
    try {
      await appAuth.signInWithEmailAndPassword(
        email: 'lecturer.a@example.test',
        password: 'QA-only-Password-123!',
      );
      final modules = await ModuleService()
          .watchModulesForLecturer('qa-lecturer-a')
          .first
          .timeout(const Duration(seconds: 20));
      expect(modules.single.code, 'QA101');
      final service = SessionService();
      sessionId = await service.createSession(
        moduleCode: 'QA101',
        moduleId: 'QA101',
        sessionTopic: 'P04 permission probe',
      );
      final roundId = await service.beginRound(sessionId);
      await service.markAttendance(
        sessionId: sessionId,
        roundId: roundId,
        studentId: 'qa-student-a',
        regNo: 'QA001',
        rssi: -50,
      );
      await service.markAttendance(
        sessionId: sessionId,
        roundId: roundId,
        studentId: 'qa-student-a',
        regNo: 'QA001',
        rssi: -50,
      );
      final nested = await appFirestore
          .collection('active_sessions/$sessionId/attendance')
          .get(const GetOptions(source: Source.server));
      expect(nested.docs.single.data()['student_uid'], 'qa-student-a');
      // One close checks permission compatibility only; retry/round outcome
      // correctness is reserved for P05/P06.
      await service.completeRound(sessionId, roundId);
      await service.endSession(sessionId, totalStudents: 3);
      final catalog = await appFirestore
          .doc('module_catalog/QA101')
          .get(const GetOptions(source: Source.server));
      expect(catalog.data()?['total_sessions'], 2);
      final absences = await appFirestore
          .collection('absence_records')
          .where('session_id', isEqualTo: sessionId)
          .get(const GetOptions(source: Source.server));
      expect(absences.docs.length, 2);
      await appAuth.signOut();
      await appAuth.signInWithEmailAndPassword(
        email: 'lecturer.b@example.test',
        password: 'QA-only-Password-123!',
      );
      final denied = isA<FirebaseException>().having(
        (error) => error.code,
        'code',
        'permission-denied',
      );
      await expectLater(
        appFirestore
            .doc('active_sessions/$sessionId')
            .get(const GetOptions(source: Source.server)),
        throwsA(denied),
      );
      await expectLater(
        appFirestore
            .collection('active_sessions/$sessionId/attendance')
            .get(const GetOptions(source: Source.server)),
        throwsA(denied),
      );
    } finally {
      await appAuth.signOut();
    }
  }, timeout: const Timeout(Duration(minutes: 3)));
}
