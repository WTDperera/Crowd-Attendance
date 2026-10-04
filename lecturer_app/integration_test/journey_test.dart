import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:lecturer_app/main.dart' as app;
import 'package:lecturer_app/services/firebase_environment.dart';
import 'package:lecturer_app/services/qa_config.dart';
import 'package:lecturer_app/services/scanner_bindings.dart';
import 'package:lecturer_app/services/detection_gate.dart';

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

Future<void> tapText(WidgetTester tester, String label) async {
  final item = find.text(label).last;
  await tester.ensureVisible(item);
  await tester.tap(item);
  await tester.pump();
}

void main() {
  JourneyBinding();
  testWidgets(
    'P09 normal lecturer UI creates, simulates three scan rounds and completes a persisted class',
    (tester) async {
      QaConfig.validate();
      expect(QaConfig.enabled, isTrue);
      await initializeAppFirebase();
      await appAuth.signOut();
      ScannerBindings? active;
      String? sessionId;
      await tester.pumpWidget(
        ScannerBindingsScope(
          forSession: (id) {
            sessionId = id;
            final real = ScannerBindings.forSession(id);
            active = ScannerBindings(
              rounds: real.rounds,
              session: real.session,
              attendance: real.attendance,
              radio: const Stream<bool>.empty(),
              results: const Stream.empty(),
              requestRadio: () async {},
              startRadio: () async {},
              stopRadio: () async {},
              endSession: real.endSession,
            );
            return active!;
          },
          child: const app.LecturerApp(),
        ),
      );
      await until(
        tester,
        () => find.byType(TextFormField).evaluate().length == 2,
      );
      await tester.enterText(
        find.byType(TextFormField).first,
        'lecturer.a@example.test',
      );
      await tester.enterText(
        find.byType(TextFormField).last,
        'QA-only-Password-123!',
      );
      await tester.tap(find.byType(ElevatedButton).last);
      await until(
        tester,
        () => find.text('Active Sessions').evaluate().isNotEmpty,
      );
      final create = find.widgetWithIcon(
        ElevatedButton,
        Icons.add_circle_outline,
      );
      await tester.ensureVisible(create);
      await tester.tap(create);
      await tester.pump();
      await until(
        tester,
        () =>
            find.byType(DropdownButtonFormField<String>).evaluate().isNotEmpty,
      );
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.textContaining('QA101').last);
      await tester.pump(const Duration(milliseconds: 400));
      final topic = find.byType(TextFormField).first;
      await tester.enterText(topic, 'P09 Android simulated ledger');
      await tapText(tester, 'START SESSION');
      await until(
        tester,
        () =>
            find.text('Live Scanner').evaluate().isNotEmpty ||
            find
                .textContaining('Error creating session:')
                .evaluate()
                .isNotEmpty,
      );
      expect(
        find.textContaining('Error creating session:'),
        findsNothing,
        reason:
            'The normal mobile create form must persist the fixed-roster session.',
      );
      expect(sessionId, isNotNull);
      const server = GetOptions(source: Source.server);
      final root = appFirestore.doc('active_sessions/$sessionId');
      expect((await root.get(server)).data()?['eligible_roster'], hasLength(3));
      await until(
        tester,
        () => find.text('Start New Scan Round').evaluate().isNotEmpty,
      );
      for (var n = 1; n <= 3; n++) {
        await tapText(tester, 'Start New Scan Round');
        await until(tester, () => active!.rounds.gate.accepting);
        // SIMULATED manufacturer packets; radio/permission callbacks only are
        // replaced. The actual controller, roster, writes and UI completion run.
        final a = {0xffff: utf8.encode('QA001')};
        expect(await active!.rounds.process(a, -50), DetectionResult.saved);
        expect(await active!.rounds.process(a, -50), DetectionResult.duplicate);
        if (n < 3) {
          expect(
            await active!.rounds.process({0xffff: utf8.encode('QA003')}, -50),
            DetectionResult.saved,
          );
        }
        await tapText(tester, 'Complete Scan Round');
        await until(tester, () => active!.rounds.currentRound == null);
        expect(
          (await root
                  .collection('rounds')
                  .doc('r$n')
                  .collection('observations')
                  .get(server))
              .size,
          n == 3 ? 1 : 2,
        );
      }
      await tapText(tester, 'END SESSION');
      await tester.pump(const Duration(milliseconds: 400));
      await tapText(tester, 'End Session');
      await until(tester, () => find.text('Live Scanner').evaluate().isEmpty);
      final saved = (await root.get(server)).data()!;
      expect(saved['status'], 'completed');
      expect(saved['student_count'], 1);
      final outcomes = await root.collection('attendance').get(server);
      expect(
        {for (final row in outcomes.docs) row.id: row.data()['final_status']},
        {
          'qa-student-a': 'present',
          'qa-student-b': 'absent',
          'qa-student-c': 'left_early',
        },
      );
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
      await tester.pumpWidget(const app.LecturerApp());
      await until(
        tester,
        () => find.text('P09 Android simulated ledger').evaluate().isNotEmpty,
      );
      await tester.scrollUntilVisible(
        find.text('P09 Android simulated ledger'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('P09 Android simulated ledger'), findsWidgets);
      expect((await root.get(server)).data()?['student_count'], 1);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
      await appAuth.signOut();
    },
    timeout: const Timeout(Duration(minutes: 6)),
  );
}
