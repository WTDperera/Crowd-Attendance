import 'package:flutter/foundation.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:lecturer_app/screens/login_screen.dart';
import 'package:lecturer_app/services/firebase_environment.dart';
import 'package:lecturer_app/services/qa_config.dart';
import 'package:lecturer_app/services/session_service.dart';
import '../test/ui_components_test.dart' as components;

class UiComponentBinding extends IntegrationTestWidgetsFlutterBinding {
  @override
  bool get registerTestTextInput => true;
}

void main() {
  UiComponentBinding();
  components.main();
  testWidgets(
    'P08 Android lecturer real login and mobile session survive fresh server read',
    (tester) async {
      expect(defaultTargetPlatform, TargetPlatform.android);
      QaConfig.validate();
      expect(QaConfig.enabled, isTrue);
      await initializeAppFirebase();
      await appAuth.signOut();
      await tester.pumpWidget(
        MaterialApp(
          home: LoginScreen(
            destination: (_) => const Scaffold(body: Text('QA authenticated')),
          ),
        ),
      );
      await components.fillLogin(tester);
      await tester.enterText(
        find.byType(TextFormField).at(1),
        'Wrong-password-123!',
      );
      await tester.pump();
      await tester.tap(find.byType(ElevatedButton).last);
      for (int i = 0; i < 150; i++) {
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 100)),
        );
        await tester.pump();
        if (tester
                .widget<ElevatedButton>(find.byType(ElevatedButton).last)
                .onPressed !=
            null) {
          break;
        }
      }
      expect(appAuth.currentUser, isNull);
      expect(find.byType(SnackBar), findsOneWidget);
      await tester.enterText(
        find.byType(TextFormField).at(1),
        'QA-only-Password-123!',
      );
      await tester.pump();
      await tester.tap(find.byType(ElevatedButton).last);
      for (int i = 0; i < 150; i++) {
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 100)),
        );
        await tester.pump();
        if (find.text('QA authenticated').evaluate().isNotEmpty) break;
      }
      await tester.pumpAndSettle();
      expect(appAuth.currentUser?.uid, 'qa-lecturer-a');
      expect(find.text('QA authenticated'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      final id = await SessionService().createSession(
        moduleCode: 'QA101',
        moduleId: 'QA101',
        sessionTopic: 'P08 mobile persistence',
      );
      final stored = await appFirestore
          .collection('active_sessions')
          .doc(id)
          .get(const GetOptions(source: Source.server));
      expect(stored.data()?['session_topic'], 'P08 mobile persistence');
      expect(stored.data()?['status'], 'active');
      await appAuth.signOut();
      await appAuth.signInWithEmailAndPassword(
        email: 'lecturer.a@example.test',
        password: 'QA-only-Password-123!',
      );
      final reopened = await SessionService()
          .getSessionStream(id)
          .firstWhere((doc) => doc.exists);
      final data = reopened.data() as Map<String, dynamic>;
      expect(data['session_topic'], 'P08 mobile persistence');
      expect(data['eligible_roster'], hasLength(3));
      final fresh = await appFirestore
          .collection('active_sessions')
          .doc(id)
          .get(const GetOptions(source: Source.server));
      expect(fresh.data()?['session_topic'], 'P08 mobile persistence');
      await appAuth.signOut();
    },
  );
}
