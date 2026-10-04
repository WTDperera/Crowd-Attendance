import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:student_app/main.dart' as app;
import 'package:student_app/services/firebase_environment.dart';
import 'package:student_app/services/qa_config.dart';
import 'package:student_app/services/attendance_stats_service.dart';

class JourneyBinding extends IntegrationTestWidgetsFlutterBinding {
  @override
  bool get registerTestTextInput => true;
}

Future<void> until(WidgetTester tester, bool Function() ready) async {
  for (var n = 0; n < 200; n++) {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 100)),
    );
    await tester.pump();
    if (ready()) return;
  }
  throw StateError('Journey UI did not become ready within 20 seconds');
}

Future<void> login(WidgetTester tester, String suffix) async {
  await until(tester, () => find.byType(TextFormField).evaluate().length == 2);
  await tester.enterText(
    find.byType(TextFormField).first,
    'student.$suffix@example.test',
  );
  await tester.enterText(
    find.byType(TextFormField).last,
    'QA-only-Password-123!',
  );
  await tester.tap(find.byType(ElevatedButton).last);
  await until(
    tester,
    () => find.text('Student Broadcaster').evaluate().isNotEmpty,
  );
}

void main() {
  JourneyBinding();
  testWidgets(
    'P09 normal student UI enrolls, reopens and reads the shared completed/corrected ledger',
    (tester) async {
      QaConfig.validate();
      expect(QaConfig.enabled, isTrue);
      await initializeAppFirebase();
      await appAuth.signOut();
      await tester.pumpWidget(const app.StudentApp());
      await login(tester, 'a');
      await tester.tap(find.byTooltip('Modules'));
      await tester.pump();
      final enroll = find.widgetWithText(ElevatedButton, 'Enroll');
      await until(tester, () => enroll.evaluate().isNotEmpty);
      await tester.ensureVisible(enroll);
      await tester.tap(enroll);
      await tester.pump(const Duration(milliseconds: 400));
      await tester.enterText(find.byType(TextField), 'wrong-password');
      await tester.tap(find.widgetWithText(ElevatedButton, 'Continue'));
      await tester.pump();
      await until(
        tester,
        () => find.text('Wrong password').evaluate().isNotEmpty,
      );
      const server = GetOptions(source: Source.server);
      expect(
        (await appFirestore
                .doc('students/qa-student-a/enrollments/QA202')
                .get(server))
            .exists,
        isFalse,
      );
      await tester.pump(const Duration(seconds: 5));
      await tester.ensureVisible(enroll);
      await tester.tap(enroll);
      await tester.pump(const Duration(milliseconds: 400));
      await tester.enterText(find.byType(TextField), 'QA-module-only-123!');
      await tester.tap(find.widgetWithText(ElevatedButton, 'Continue'));
      await tester.pump();
      await until(
        tester,
        () => find.text('Enrolled in QA202').evaluate().isNotEmpty,
      );
      expect(
        (await appFirestore
                .doc('students/qa-student-a/enrollments/QA202')
                .get(server))
            .exists,
        isTrue,
      );
      await tester.pageBack();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.byTooltip('Modules'));
      await tester.pump();
      await until(tester, () => find.text('QA202').evaluate().isNotEmpty);
      expect(find.widgetWithText(ElevatedButton, 'Enroll'), findsNothing);
      await tester.pageBack();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.byTooltip('My Modules'));
      await tester.pump();
      await until(
        tester,
        () => find.text('Attended: 2/2').evaluate().isNotEmpty,
      );
      expect(find.text('100.00%'), findsOneWidget);
      expect(find.text('Attended: 0/0'), findsOneWidget);
      // Fresh application mount retains login and obtains a new report request.
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
      await tester.pumpWidget(const app.StudentApp());
      await until(
        tester,
        () => find.byTooltip('My Modules').evaluate().isNotEmpty,
      );
      await tester.tap(find.byTooltip('My Modules'));
      await tester.pump();
      await until(
        tester,
        () => find.text('Attended: 2/2').evaluate().isNotEmpty,
      );
      await tester.pageBack();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.byTooltip('Logout'));
      await tester.pump();
      await login(tester, 'c');
      await tester.tap(find.byTooltip('My Modules'));
      await tester.pump();
      // C has no credit in the original fixture, and excused credit in the new
      // three-round class. The independent oracle is 1/2 = 50%, not 2/2.
      await until(
        tester,
        () => find.text('Attended: 1/2').evaluate().isNotEmpty,
      );
      expect(find.text('50.00%'), findsOneWidget);
      final stats = await AttendanceStatsService().getStudentAttendanceStats(
        'qa-student-c',
      );
      final qa101 = stats.singleWhere((item) => item.moduleId == 'QA101');
      expect(qa101.presentCount, 1);
      expect(qa101.totalModuleSessions, 2);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
      await appAuth.signOut();
    },
    timeout: const Timeout(Duration(minutes: 6)),
  );
}
