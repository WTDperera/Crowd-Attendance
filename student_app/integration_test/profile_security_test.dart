import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:student_app/services/firebase_environment.dart';
import 'package:student_app/services/qa_config.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('P03 student Android first binding and denied tampering', (
    _,
  ) async {
    expect(defaultTargetPlatform, TargetPlatform.android);
    QaConfig.validate();
    expect(QaConfig.enabled, isTrue);
    await initializeAppFirebase();
    try {
      final login = await appAuth
          .signInWithEmailAndPassword(
            email: 'student.a@example.test',
            password: 'QA-only-Password-123!',
          )
          .timeout(const Duration(seconds: 15));
      expect(login.user?.uid, 'qa-student-a');
      final profile = appFirestore.collection('students').doc(login.user!.uid);
      // Same write shape as student_app login; reset/seed before this probe.
      final before = await profile.get(const GetOptions(source: Source.server));
      expect(before.data()?['device_id'], isNull);
      await profile.set({
        'device_id': 'qa-android-binding',
        'device_locked_at': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
      await profile.update({'last_login': FieldValue.serverTimestamp()});
      final bound = await profile.get(const GetOptions(source: Source.server));
      expect(bound.data()?['device_id'], 'qa-android-binding');
      expect(bound.data()?['device_locked_at'], isA<Timestamp>());
      final denied = isA<FirebaseException>().having(
        (error) => error.code,
        'code',
        'permission-denied',
      );
      for (final patch in <Map<String, dynamic>>[
        {'device_id': 'replacement'},
        {'reg_no': 'QA999'},
        {
          'attendance_counts': {'QA101': 99},
        },
        {'enrolled_module_ids': []},
      ]) {
        await expectLater(profile.update(patch), throwsA(denied));
      }
      await expectLater(
        appFirestore.collection('lecturers').doc(login.user!.uid).set({
          'role': 'lecturer',
        }),
        throwsA(denied),
      );
      final after = await profile.get(const GetOptions(source: Source.server));
      expect(after.data()?['reg_no'], 'QA001');
      expect(
        after.data()?['attendance_counts'],
        before.data()?['attendance_counts'],
      );
      expect(after.data()?['device_id'], 'qa-android-binding');
    } finally {
      await appAuth.signOut();
    }
    expect(appAuth.currentUser, isNull);
  }, timeout: const Timeout(Duration(minutes: 2)));
}
