import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:student_app/services/api_client.dart';
import 'package:student_app/services/firebase_environment.dart';
import 'package:student_app/services/module_service.dart';
import 'package:student_app/services/qa_config.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('P04 Android student uses safe catalog and server enrollment', (
    _,
  ) async {
    expect(defaultTargetPlatform, TargetPlatform.android);
    QaConfig.validate();
    expect(QaConfig.enabled, isTrue);
    await initializeAppFirebase();
    try {
      await appAuth.signInWithEmailAndPassword(
        email: 'student.a@example.test',
        password: 'QA-only-Password-123!',
      );
      final service = ModuleService();
      final modules = await service.watchAllModules().first.timeout(
        const Duration(seconds: 20),
      );
      expect(modules.map((module) => module.code), ['QA101', 'QA202', 'QA303']);
      final target = modules.singleWhere((module) => module.code == 'QA202');
      final disabled = modules.singleWhere((module) => module.code == 'QA303');
      await expectLater(
        service.enrollWithPassword(
          studentUid: 'qa-student-a',
          module: target,
          plainPassword: 'wrong',
        ),
        throwsA(isA<WrongEnrollmentPasswordException>()),
      );
      await expectLater(
        service.enrollWithPassword(
          studentUid: 'qa-student-a',
          module: disabled,
          plainPassword: 'QA-module-only-123!',
        ),
        throwsA(
          isA<ApiException>().having((error) => error.status, 'status', 409),
        ),
      );
      await service.enrollWithPassword(
        studentUid: 'qa-student-a',
        module: target,
        plainPassword: 'QA-module-only-123!',
      );
      await service.enrollWithPassword(
        studentUid: 'qa-student-a',
        module: target,
        plainPassword: 'QA-module-only-123!',
      );
      final student = await appFirestore
          .doc('students/qa-student-a')
          .get(const GetOptions(source: Source.server));
      expect(student.data()?['enrolled_module_ids'], ['QA101', 'QA202']);
      expect(student.data()?['attendance_counts'], {'QA101': 1, 'QA202': 0});
      final enrollments = await appFirestore
          .collection('students/qa-student-a/enrollments')
          .get(const GetOptions(source: Source.server));
      expect(enrollments.docs.length, 2);
      final denied = isA<FirebaseException>().having(
        (error) => error.code,
        'code',
        'permission-denied',
      );
      await expectLater(
        appFirestore
            .doc('module_secrets/QA202')
            .get(const GetOptions(source: Source.server)),
        throwsA(denied),
      );
      await expectLater(
        appFirestore
            .doc('modules/QA202')
            .get(const GetOptions(source: Source.server)),
        throwsA(denied),
      );
      await expectLater(
        appFirestore.doc('students/qa-student-a/enrollments/QA303').set({
          'code': 'QA303',
        }),
        throwsA(denied),
      );
      final own = await appFirestore
          .collection('attendance_records')
          .where('student_uid', isEqualTo: 'qa-student-a')
          .where('module_id', isEqualTo: 'QA101')
          .get(const GetOptions(source: Source.server));
      expect(own.docs.length, 1);
    } finally {
      await appAuth.signOut();
    }
  }, timeout: const Timeout(Duration(minutes: 3)));
}
