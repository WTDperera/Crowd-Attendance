import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:lecturer_app/services/firebase_environment.dart';
import 'package:lecturer_app/services/qa_config.dart';
import '../test/qa_config_assertions.dart';

// P02 only: target safety and actual Auth/Firestore connection. No BLE journey.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('P02 QA target guards run on Android', (_) async {
    expect(defaultTargetPlatform, TargetPlatform.android);
    verifyQaConfigGuards();
  });

  testWidgets('P02 lecturer connects to seeded local Firebase', (_) async {
    expect(defaultTargetPlatform, TargetPlatform.android);
    QaConfig.validate();
    expect(QaConfig.enabled, isTrue, reason: 'Explicit QA defines required');
    await initializeAppFirebase();
    expect(appAuth.app.name, 'isolated-qa');
    expect(appFirestore.app.options.projectId, QaConfig.project);
    try {
      final login = await appAuth
          .signInWithEmailAndPassword(
            email: 'lecturer.a@example.test',
            password: 'QA-only-Password-123!',
          )
          .timeout(const Duration(seconds: 15));
      expect(login.user?.uid, 'qa-lecturer-a');
      final profile = await appFirestore
          .collection('lecturers')
          .doc('qa-lecturer-a')
          .get(const GetOptions(source: Source.server))
          .timeout(const Duration(seconds: 15));
      expect(profile.exists, isTrue);
      expect(profile.data()?['email'], 'lecturer.a@example.test');
    } finally {
      await appAuth.signOut();
    }
    expect(appAuth.currentUser, isNull);
  });
}
