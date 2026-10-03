import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:lecturer_app/services/auth_service.dart';
import 'package:lecturer_app/services/firebase_environment.dart';
import 'package:lecturer_app/services/qa_config.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'P03 lecturer Android actual login binding and denied tampering',
    (_) async {
      expect(defaultTargetPlatform, TargetPlatform.android);
      QaConfig.validate();
      expect(QaConfig.enabled, isTrue);
      await initializeAppFirebase();
      final service = AuthService();
      try {
        final first = await service
            .loginWithEmailPassword(
              email: 'lecturer.a@example.test',
              password: 'QA-only-Password-123!',
            )
            .timeout(const Duration(seconds: 30));
        expect(first['success'], isTrue);
        expect(first['isFirstLogin'], isTrue);
        expect(appAuth.currentUser?.uid, 'qa-lecturer-a');
        final profile = appFirestore
            .collection('lecturers')
            .doc('qa-lecturer-a');
        final bound = await profile.get(
          const GetOptions(source: Source.server),
        );
        expect(bound.data()?['device_id'], isA<String>());
        expect(bound.data()?['device_locked_at'], isA<Timestamp>());
        expect(bound.data()?['device_model'], isA<String>());
        await service.logout();
        final second = await service
            .loginWithEmailPassword(
              email: 'lecturer.a@example.test',
              password: 'QA-only-Password-123!',
            )
            .timeout(const Duration(seconds: 30));
        expect(second['success'], isTrue);
        expect(second['isFirstLogin'], isFalse);
        await profile.update({
          'name': 'QA Android Lecturer',
          'department': 'QA Department',
        });
        final denied = isA<FirebaseException>().having(
          (error) => error.code,
          'code',
          'permission-denied',
        );
        for (final patch in <Map<String, dynamic>>[
          {'device_id': 'replacement'},
          {'role': 'admin'},
          {'email': 'other@example.test'},
          {'uid': 'qa-lecturer-b'},
        ]) {
          await expectLater(profile.update(patch), throwsA(denied));
        }
        await expectLater(
          appFirestore.collection('students').doc('qa-student-a').update({
            'device_id': 'reset',
          }),
          throwsA(denied),
        );
        final after = await profile.get(
          const GetOptions(source: Source.server),
        );
        expect(after.data()?['device_id'], bound.data()?['device_id']);
        expect(after.data()?['role'], 'lecturer');
        expect(after.data()?['email'], 'lecturer.a@example.test');
      } finally {
        await service.logout();
      }
      expect(appAuth.currentUser, isNull);
    },
    timeout: const Timeout(Duration(minutes: 2)),
  );
}
