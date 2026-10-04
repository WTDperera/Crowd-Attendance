import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:lecturer_app/screens/login_screen.dart';
import 'package:lecturer_app/screens/scanner_screen.dart';
import 'package:lecturer_app/services/scanner_bindings.dart';
import 'package:lecturer_app/services/round_scanner_controller.dart';

class ScannerHarness {
  final session = StreamController<Map<String, dynamic>?>.broadcast();
  final attendance =
      StreamController<Map<String, Map<String, dynamic>>>.broadcast();
  final radio = StreamController<bool>.broadcast();
  final results = StreamController<List<ScanResult>>.broadcast();
  Future<Map<String, String>> Function()? load;
  Future<String> Function()? begin;
  Future<void> Function()? request;
  Future<void> Function()? start;
  int begins = 0, finishes = 0, starts = 0, stops = 0, ends = 0;
  late final rounds = RoundScannerController(
    loadRoster: () => load?.call() ?? Future.value({'QA001': 'qa-student-a'}),
    begin: () {
      begins++;
      return begin?.call() ?? Future.value('r1');
    },
    finish: (_, _) async {
      finishes++;
    },
    persist: (_, _, _, _) async {},
  );
  late final bindings = ScannerBindings(
    rounds: rounds,
    session: session.stream,
    attendance: attendance.stream,
    radio: radio.stream,
    results: results.stream,
    requestRadio: () async {
      await request?.call();
    },
    startRadio: () async {
      starts++;
      await start?.call();
    },
    stopRadio: () async {
      stops++;
    },
    endSession: () async {
      ends++;
    },
  );
  void ready({String? round}) => session.add({
    'module_code': 'QA808',
    'status': 'active',
    if (round != null) 'active_round_id': round,
  });
  Future<void> close() async {
    await session.close();
    await attendance.close();
    await radio.close();
    await results.close();
  }
}

Future<void> fillLogin(WidgetTester tester) async {
  await tester.enterText(
    find.byType(TextFormField).at(0),
    'lecturer.a@example.test',
  );
  await tester.enterText(
    find.byType(TextFormField).at(1),
    'QA-only-Password-123!',
  );
  await tester.ensureVisible(find.byType(ElevatedButton).last);
}

Future<void> showScanner(WidgetTester tester, ScannerHarness h) =>
    tester.pumpWidget(
      MaterialApp(
        home: ScannerScreen(sessionId: 'qa-widget', bindings: h.bindings),
      ),
    );
void main() {
  testWidgets(
    'lecturer login validates, suppresses duplicates and retries a rejected request',
    (tester) async {
      int calls = 0;
      final pending = Completer<Map<String, dynamic>>();
      await tester.pumpWidget(
        MaterialApp(
          home: LoginScreen(
            login: (_, _) {
              calls++;
              return pending.future;
            },
          ),
        ),
      );
      await tester.ensureVisible(find.byType(ElevatedButton).last);
      await tester.tap(find.byType(ElevatedButton).last);
      await tester.pump();
      expect(calls, 0);
      await fillLogin(tester);
      final submit = tester
          .widget<ElevatedButton>(find.byType(ElevatedButton).last)
          .onPressed!;
      submit();
      submit();
      await tester.pump();
      expect(calls, 1);
      expect(
        tester
            .widget<ElevatedButton>(find.byType(ElevatedButton).last)
            .onPressed,
        isNull,
      );
      pending.completeError(Exception('QA wrong password'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('QA wrong password'), findsOneWidget);
      expect(
        tester
            .widget<ElevatedButton>(find.byType(ElevatedButton).last)
            .onPressed,
        isNotNull,
      );
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets('lecturer login does not navigate after disposal', (
    tester,
  ) async {
    final pending = Completer<Map<String, dynamic>>();
    int navigations = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: LoginScreen(
          login: (_, _) => pending.future,
          destination: (_) {
            navigations++;
            return const Text('Dashboard');
          },
        ),
      ),
    );
    await fillLogin(tester);
    await tester.tap(find.byType(ElevatedButton).last);
    await tester.pump();
    await tester.pumpWidget(const SizedBox.shrink());
    pending.complete({'message': 'Success'});
    await tester.pump();
    expect(navigations, 0);
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'round controls fail closed while session loads or errors and recover on a valid event',
    (tester) async {
      final h = ScannerHarness();
      await showScanner(tester, h);
      expect(
        tester
            .widget<ElevatedButton>(
              find.widgetWithText(ElevatedButton, 'Start New Scan Round'),
            )
            .onPressed,
        isNull,
      );
      h.session.addError(Exception('QA session offline'));
      await tester.pump();
      expect(find.textContaining('Cannot load session'), findsOneWidget);
      h.ready();
      await tester.pump();
      expect(
        tester
            .widget<ElevatedButton>(
              find.widgetWithText(ElevatedButton, 'Start New Scan Round'),
            )
            .onPressed,
        isNotNull,
      );
      await tester.pumpWidget(const SizedBox.shrink());
      expect(h.session.hasListener, isFalse);
      expect(h.attendance.hasListener, isFalse);
      expect(h.radio.hasListener, isFalse);
      expect(h.results.hasListener, isFalse);
      expect(h.finishes, 0);
      await h.close();
    },
  );
  testWidgets(
    'round controls reject permissions, retry saved round and pause without completing on radio loss',
    (tester) async {
      final h = ScannerHarness();
      h.request = () async {
        throw StateError('Bluetooth/location permissions required.');
      };
      await showScanner(tester, h);
      h.ready();
      await tester.pump();
      await tester.tap(find.text('Start New Scan Round'));
      await tester.pumpAndSettle();
      expect(find.textContaining('permissions required'), findsOneWidget);
      expect(h.begins, 0);
      h.request = null;
      h.start = () async {
        throw StateError('QA radio start failed');
      };
      await tester.tap(find.text('Start New Scan Round'));
      await tester.pumpAndSettle();
      expect(h.rounds.currentRound, 'r1');
      expect(find.text('Resume Scan Round'), findsOneWidget);
      expect(find.text('Cancel open round'), findsOneWidget);
      expect(h.finishes, 0);
      h.start = null;
      h.ready(round: 'r1');
      await tester.pump();
      await tester.tap(find.text('Resume Scan Round'));
      await tester.pump();
      expect(h.starts, 2);
      expect(find.text('Complete Scan Round'), findsOneWidget);
      h.radio.add(false);
      await tester.pump();
      expect(h.finishes, 0);
      expect(h.rounds.gate.accepting, isFalse);
      expect(find.text('Resume Scan Round'), findsOneWidget);
      await tester.tap(find.text('Resume Scan Round'));
      await tester.pump();
      await tester.tap(find.text('Complete Scan Round'));
      await tester.pump();
      expect(h.finishes, 1);
      expect(h.rounds.currentRound, isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      await h.close();
    },
  );
  testWidgets(
    'navigation during roster or begin await never restarts radio or admits packets',
    (tester) async {
      for (final delayedBegin in [false, true]) {
        final h = ScannerHarness();
        final roster = Completer<Map<String, String>>();
        final begin = Completer<String>();
        if (delayedBegin) {
          h.begin = () => begin.future;
        } else {
          h.load = () => roster.future;
        }
        await showScanner(tester, h);
        h.ready();
        await tester.pump();
        await tester.tap(find.text('Start New Scan Round'));
        await tester.pump();
        await tester.pumpWidget(const SizedBox.shrink());
        if (delayedBegin) {
          begin.complete('r1');
        } else {
          roster.complete({'QA001': 'qa-student-a'});
        }
        await tester.pump();
        expect(h.starts, 0);
        expect(h.finishes, 0);
        expect(h.rounds.gate.accepting, isFalse);
        expect(h.begins, delayedBegin ? 1 : 0);
        expect(tester.takeException(), isNull);
        await h.close();
      }
    },
  );
  testWidgets(
    'end confirmation is single, disables controls and cancellation performs no persistence',
    (tester) async {
      final h = ScannerHarness();
      await showScanner(tester, h);
      h.ready();
      await tester.pump();
      final end = tester
          .widget<ElevatedButton>(
            find.widgetWithText(ElevatedButton, 'END SESSION'),
          )
          .onPressed!;
      end();
      end();
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(h.ends, 0);
      expect(h.finishes, 0);
      await tester.pumpWidget(const SizedBox.shrink());
      await h.close();
    },
  );
}
