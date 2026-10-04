import 'dart:convert';
import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:lecturer_app/services/firebase_environment.dart';
import 'package:lecturer_app/services/qa_config.dart';
import 'package:lecturer_app/services/session_service.dart';
import 'package:lecturer_app/services/round_service.dart';
import 'package:lecturer_app/services/round_domain.dart';
import 'package:lecturer_app/services/detection_gate.dart';
import 'package:lecturer_app/services/round_scanner_controller.dart';

const server = GetOptions(source: Source.server);
Future<void> login() async {
  expect(defaultTargetPlatform, TargetPlatform.android);
  QaConfig.validate();
  expect(QaConfig.enabled, isTrue);
  await initializeAppFirebase();
  await appAuth.signInWithEmailAndPassword(
    email: 'lecturer.a@example.test',
    password: 'QA-only-Password-123!',
  );
}

Future<String> create(String topic) => SessionService().createSession(
  moduleCode: 'QA101',
  moduleId: 'QA101',
  sessionTopic: topic,
);
Future<bool> mark(
  RoundService service,
  String session,
  String round,
  String suffix,
) => service.mark(
  sessionId: session,
  roundId: round,
  studentId: 'qa-student-$suffix',
  regNo: {'a': 'QA001', 'b': 'QA002', 'c': 'QA003'}[suffix]!,
  rssi: -50,
);

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  const phase = String.fromEnvironment('P05_RESTART_PHASE');
  if (phase.isNotEmpty) {
    testWidgets('P05 actual process restart: $phase', (_) async {
      await login();
      try {
        final service = RoundService();
        if (phase == 'prepare') {
          final id = await create('P05 restart checkpoint');
          final first = await service.begin(id);
          await mark(service, id, first, 'a');
          await service.finish(id, first);
          final second = await service.begin(id);
          expect(second, 'r2');
          await mark(service, id, second, 'a');
          // Leave open: process termination must not manufacture completion.
        } else {
          final sessions = await appFirestore
              .collection('active_sessions')
              .where('lecturer_id', isEqualTo: 'qa-lecturer-a')
              .where('module_id', isEqualTo: 'QA101')
              .where('session_topic', isEqualTo: 'P05 restart checkpoint')
              .get(server);
          final id = sessions.docs.single.id;
          expect(sessions.docs.single.data()['scans_performed'], 1);
          expect(await service.begin(id), 'r2');
          expect(await mark(service, id, 'r2', 'a'), false);
          final second = await appFirestore
              .doc('active_sessions/$id/rounds/r2/observations/qa-student-a')
              .get(server);
          expect(second.data()?['round_id'], 'r2');
          await service.finish(id, 'r2');
          await service.finish(id, 'r2');
          expect(await service.begin(id), 'r3');
          expect(await mark(service, id, 'r3', 'a'), true);
          final record = await appFirestore
              .doc(
                'attendance_records/${attendanceDocumentId(id, 'qa-student-a')}',
              )
              .get(server);
          expect(record.data()?['scan_count'], 3);
          await service.finish(id, 'r3');
        }
      } finally {
        await appAuth.signOut();
      }
    }, timeout: const Timeout(Duration(minutes: 5)));
    return;
  }

  testWidgets(
    'P05 real Dart transactions retain five tuples under replay/concurrency',
    (_) async {
      await login();
      try {
        final id = await create('P05 three rounds');
        final service = RoundService();
        final initialStudent = await appFirestore
            .doc('students/qa-student-a')
            .get(server);
        final initialCount =
            (initialStudent.data()?['attendance_counts'] as Map)['QA101'] as int;
        final starts = await Future.wait([
          service.begin(id),
          RoundService().begin(id),
        ]);
        debugPrint('P05 concurrent begin acknowledged');
        expect(starts, ['r1', 'r1']);
        final writes = await Future.wait([
          mark(service, id, 'r1', 'a'),
          mark(RoundService(), id, 'r1', 'a'),
        ]);
        debugPrint('P05 concurrent first mark acknowledged');
        expect(writes.where((changed) => changed).length, 1);
        await mark(service, id, 'r1', 'c');
        for (var i = 0; i < 100; i++) {
          expect(await mark(service, id, 'r1', 'c'), false);
        }
        await service.finish(id, 'r1');
        await Future.wait([
          service.finish(id, 'r1'),
          RoundService().finish(id, 'r1'),
        ]);
        expect(await service.begin(id), 'r2');
        await mark(service, id, 'r2', 'a');
        await mark(service, id, 'r2', 'c');
        await service.finish(id, 'r2');
        expect(await RoundService().begin(id), 'r3');
        await mark(service, id, 'r3', 'a');
        await service.finish(id, 'r3');
        var tuples = 0;
        for (final round in ['r1', 'r2', 'r3']) {
          final docs = await appFirestore
              .collection('active_sessions/$id/rounds/$round/observations')
              .get(server);
          tuples += docs.docs.length;
        }
        expect(tuples, 5);
        final records = await appFirestore
            .collection('attendance_records')
            .where('session_id', isEqualTo: id)
            .get(server);
        expect(records.docs.length, 2);
        final byUid = {
          for (final doc in records.docs) doc.data()['student_uid']: doc.data(),
        };
        expect(byUid['qa-student-a']?['observed_round_ids'], [
          'r1',
          'r2',
          'r3',
        ]);
        expect(byUid['qa-student-c']?['observed_round_ids'], ['r1', 'r2']);
        expect(
          roundOutcome(
            List<String>.from(byUid['qa-student-c']!['observed_round_ids']),
            {'r1', 'r2', 'r3'},
          ),
          'left_early',
        );
        final student = await appFirestore
            .doc('students/qa-student-a')
            .get(server);
        expect(
          (student.data()?['attendance_counts'] as Map)['QA101'],
          initialCount + 1,
        );
        final session = await appFirestore
            .doc('active_sessions/$id')
            .get(server);
        expect(session.data()?['scans_performed'], 3);
        expect(session.data()?['student_count'], 2);
        await SessionService().endSession(id, totalStudents: 3);
        final finalRecords = await appFirestore
            .collection('attendance_records')
            .where('session_id', isEqualTo: id)
            .get(server);
        final outcomes = {
          for (final doc in finalRecords.docs)
            doc.data()['student_uid']: doc.data()['status'],
        };
        expect(outcomes, {
          'qa-student-a': 'present',
          'qa-student-b': 'absent',
          'qa-student-c': 'left_early',
        });
        final finalStudent = await appFirestore
            .doc('students/qa-student-a')
            .get(server);
        expect(
          (finalStudent.data()?['attendance_counts'] as Map)['QA101'],
          initialCount + 1,
        );
        expect(
          (await appFirestore.doc('modules/QA101').get(server))
              .data()?['total_sessions'],
          2,
        );
        final denied = isA<FirebaseException>().having(
          (e) => e.code,
          'code',
          'permission-denied',
        );
        await expectLater(
          appFirestore
              .doc('active_sessions/$id/rounds/r1/observations/qa-student-a')
              .update({'rssi': -1}),
          throwsA(denied),
        );
        await expectLater(
          appFirestore.doc('active_sessions/$id').update({
            'eligible_roster': {},
          }),
          throwsA(denied),
        );
        await expectLater(
          mark(service, id, 'r3', 'b'),
          throwsA(isA<Exception>()),
        );
        await appAuth.signOut();
        await appAuth.signInWithEmailAndPassword(
          email: 'lecturer.b@example.test',
          password: 'QA-only-Password-123!',
        );
        await expectLater(
          appFirestore.collection('active_sessions/$id/rounds').get(server),
          throwsA(denied),
        );
      } finally {
        await appAuth.signOut();
      }
    },
    timeout: const Timeout(Duration(minutes: 5)),
  );

  testWidgets('P05 rejected-commit/lost-ack retry and cancelled/empty rounds', (
    _,
  ) async {
    await login();
    try {
      final id = await create('P05 retry and cancel');
      var rejectCommit = true;
      final service = RoundService(
        beforeCommit: (tx) {
          if (rejectCommit) {
            tx.set(appFirestore.doc('module_secrets/QA101'), {
              'injected': true,
            });
          }
        },
      );
      var loseAck = false;
      Completer<void>? pendingHold;
      final controller = RoundScannerController(
        loadRoster: () => service.loadRoster(id),
        begin: () => service.begin(id),
        finish: (round, cancel) => service.finish(id, round, cancel: cancel),
        persist: (round, uid, regNo, rssi) async {
          await pendingHold?.future;
          await service.mark(
            sessionId: id,
            roundId: round,
            studentId: uid,
            regNo: regNo,
            rssi: rssi,
          );
          if (loseAck) {
            throw StateError(
              'Injected lost response after committed transaction.',
            );
          }
        },
      );
      final packet = {0xffff: utf8.encode('QA001')};
      expect(await controller.process(packet, -50), DetectionResult.ignored);
      await controller.start();
      expect(
        await controller.process({0xffff: utf8.encode('unknown')}, -50),
        DetectionResult.ignored,
      );
      await expectLater(
        service.mark(
          sessionId: id,
          roundId: 'r1',
          studentId: 'qa-student-a',
          regNo: 'wrong',
          rssi: -50,
        ),
        throwsA(isA<RoundException>()),
      );
      expect(
        (await appFirestore
                .collection('active_sessions/$id/rounds/r1/observations')
                .get(server))
            .docs,
        isEmpty,
      );
      await expectLater(
        controller.process(packet, -50),
        throwsA(
          isA<FirebaseException>().having(
            (e) => e.code,
            'code',
            'permission-denied',
          ),
        ),
      );
      expect(
        (await appFirestore
                .collection('active_sessions/$id/rounds/r1/observations')
                .get(server))
            .docs,
        isEmpty,
      );
      expect(
        (await appFirestore.doc('active_sessions/$id').get(server))
            .data()?['student_count'],
        0,
      );
      await expectLater(controller.complete(), throwsStateError);
      await controller.start();
      rejectCommit = false;
      loseAck = true;
      await expectLater(controller.process(packet, -50), throwsStateError);
      loseAck = false;
      await controller.start();
      expect(await controller.process(packet, -50), DetectionResult.saved);
      await controller.pause(); // no completion
      expect(
        (await appFirestore.doc('active_sessions/$id').get(server))
            .data()?['scans_performed'],
        0,
      );
      await controller.complete(cancel: true);
      expect(
        (await appFirestore.doc('active_sessions/$id/rounds/r1').get(server))
            .data()?['status'],
        'cancelled',
      );
      await controller.start();
      expect(controller.currentRound, 'r2');
      // Owner explicitly completes a successful empty round.
      await controller.complete();
      expect(
        (await appFirestore.doc('active_sessions/$id').get(server))
            .data()?['scans_performed'],
        1,
      );
      expect(
        (await appFirestore
                .collection('active_sessions/$id/rounds/r1/observations')
                .get(server))
            .docs
            .length,
        1,
      );
      expect(roundOutcome(['r1'], {'r2'}), 'absent');
      await controller.start();
      pendingHold = Completer<void>();
      final pending = controller.process({0xffff: utf8.encode('QA002')}, -50);
      final closing = controller.complete();
      expect(controller.gate.pendingCount, 1);
      expect(
        (await appFirestore.doc('active_sessions/$id/rounds/r3').get(server))
            .data()?['status'],
        'open',
      );
      pendingHold.complete();
      await pending;
      await closing;
      expect(
        (await appFirestore.doc('active_sessions/$id').get(server))
            .data()?['scans_performed'],
        2,
      );
    } finally {
      await appFirestore.enableNetwork();
      await appAuth.signOut();
    }
  }, timeout: const Timeout(Duration(minutes: 5)));
}
