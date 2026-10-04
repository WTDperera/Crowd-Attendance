import 'package:flutter/foundation.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:student_app/main.dart';
import 'package:student_app/screens/modules_screen.dart';
import 'package:student_app/services/firebase_environment.dart';
import 'package:student_app/services/qa_config.dart';
import '../test/ui_components_test.dart' as components;

// Component gestures/text are simulated; Firebase and HTTP remain real. Using
// the test keyboard avoids competing native IME edits on a live Android binding.
class UiComponentBinding extends IntegrationTestWidgetsFlutterBinding {
  @override
  bool get registerTestTextInput => true;
}

void main() {
  UiComponentBinding();
  components.main();
  testWidgets(
    'P08 Android student real login failure and account/profile persistence',
    (tester) async {
      expect(defaultTargetPlatform, TargetPlatform.android);
      QaConfig.validate();
      expect(QaConfig.enabled, isTrue);
      await initializeAppFirebase();
      await appAuth.signOut();
      await tester.pumpWidget(const MaterialApp(home: LoginScreen()));
      await components.fillLogin(tester);
      await tester.enterText(
        find.byType(TextFormField).at(1),
        'Wrong-password-123!',
      );
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
      await tester.pumpAndSettle();
      expect(appAuth.currentUser, isNull);
      expect(find.byType(SnackBar), findsOneWidget);
      await tester.enterText(
        find.byType(TextFormField).at(1),
        'QA-only-Password-123!',
      );
      await tester.pump();
      expect(
        tester
            .widget<EditableText>(find.byType(EditableText).at(1))
            .controller
            .text,
        'QA-only-Password-123!',
      );
      await tester.tap(find.byType(ElevatedButton).last);
      await tester.runAsync(() async {
        for (int i = 0; i < 150; i++) {
          await Future<void>.delayed(const Duration(milliseconds: 100));
          if (appAuth.currentUser != null) {
            final profile = await appFirestore
                .doc('students/qa-student-a')
                .get();
            if (profile.data()?['last_login'] != null) break;
          }
        }
      });
      await tester.pumpAndSettle();
      expect(
        appAuth.currentUser?.uid,
        'qa-student-a',
        reason: tester
            .widgetList<Text>(find.byType(Text))
            .map((w) => w.data)
            .join(' | '),
      );
      await tester.pumpWidget(const SizedBox.shrink());
      final profile = await appFirestore
          .doc('students/qa-student-a')
          .get(const GetOptions(source: Source.server));
      expect(profile.data()?['device_id'], isNotEmpty);
      expect(profile.data()?['last_login'], isNotNull);
      await appAuth.signOut();
    },
  );
  testWidgets(
    'P08 Android real enrollment failure and fresh-screen persistence',
    (tester) async {
      QaConfig.validate();
      expect(QaConfig.enabled, isTrue);
      await initializeAppFirebase();
      await appAuth.signInWithEmailAndPassword(
        email: 'student.a@example.test',
        password: 'QA-only-Password-123!',
      );
      await tester.pumpWidget(
        const MaterialApp(home: ModulesScreen(studentUid: 'qa-student-a')),
      );
      Future<void> waitFor(Finder finder) async {
        for (int i = 0; i < 150; i++) {
          await tester.runAsync(
            () => Future<void>.delayed(const Duration(milliseconds: 100)),
          );
          await tester.pump();
          if (finder.evaluate().isNotEmpty) return;
        }
        expect(
          finder,
          findsWidgets,
          reason: tester
              .widgetList<Text>(find.byType(Text))
              .map((w) => w.data)
              .join(' | '),
        );
      }

      final enroll = find.widgetWithText(ElevatedButton, 'Enroll');
      await waitFor(enroll);
      await tester.ensureVisible(enroll);
      await tester.tap(enroll);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.enterText(find.byType(TextField), 'wrong-password');
      await tester.pump();
      await tester.tap(find.widgetWithText(ElevatedButton, 'Continue'));
      await waitFor(find.text('Wrong password'));
      final failed = await appFirestore
          .doc('students/qa-student-a')
          .get(const GetOptions(source: Source.server));
      expect(failed.data()?['enrolled_module_ids'], isNot(contains('QA202')));
      await tester.pump(const Duration(seconds: 5));
      await tester.ensureVisible(enroll);
      await tester.tap(enroll);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.enterText(find.byType(TextField), 'QA-module-only-123!');
      await tester.pump();
      await tester.tap(find.widgetWithText(ElevatedButton, 'Continue'));
      await waitFor(find.text('Enrolled in QA202'));
      await tester.pumpWidget(const SizedBox.shrink());
      final stored = await appFirestore
          .doc('students/qa-student-a')
          .get(const GetOptions(source: Source.server));
      expect(stored.data()?['enrolled_module_ids'], contains('QA202'));
      expect(
        (await appFirestore
                .doc('students/qa-student-a/enrollments/QA202')
                .get(const GetOptions(source: Source.server)))
            .exists,
        isTrue,
      );
      await tester.pumpWidget(
        const MaterialApp(home: ModulesScreen(studentUid: 'qa-student-a')),
      );
      await waitFor(find.text('QA202'));
      expect(find.widgetWithText(ElevatedButton, 'Enroll'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
      await appAuth.signOut();
    },
  );
}
