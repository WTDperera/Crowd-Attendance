import 'dart:async';
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:lecturer_app/services/detection_gate.dart';
import 'package:lecturer_app/services/round_scanner_controller.dart';

final packet = {0xffff: utf8.encode('QA001')};
void main() {
  test('loading/error/unknown/malformed detection fails closed', () async {
    final gate = DetectionGate();
    var calls = 0;
    Future<void> persist(String _, String _, String _) async {
      calls++;
    }

    expect(await gate.process(packet, persist), DetectionResult.ignored);
    gate.resume('r1', {'QA002': 'B'});
    expect(await gate.process(packet, persist), DetectionResult.ignored);
    expect(
      await gate.process({
        0xffff: [0xff],
      }, persist),
      DetectionResult.ignored,
    );
    expect(calls, 0);
  });
  test(
    'concurrent packets stay pending; success dedupes only this round',
    () async {
      final gate = DetectionGate()..resume('r1', {'QA001': 'A'});
      final hold = Completer<void>();
      final first = gate.process(packet, (_, _, _) => hold.future);
      expect(gate.pendingCount, 1);
      expect(
        await gate.process(
          packet,
          (_, _, _) async => fail('duplicate write'),
        ),
        DetectionResult.duplicate,
      );
      hold.complete();
      expect(await first, DetectionResult.saved);
      expect(
        await gate.process(packet, (_, _, _) async => fail('repeat')),
        DetectionResult.duplicate,
      );
      gate.resume('r2', {'QA001': 'A'});
      expect(
        await gate.process(packet, (_, _, _) async {}),
        DetectionResult.saved,
      );
    },
  );
  test('write failure stays retryable and prevents false completion', () async {
    final gate = DetectionGate()..resume('r1', {'QA001': 'A'});
    await expectLater(
      gate.process(packet, (_, _, _) async => throw StateError('offline')),
      throwsStateError,
    );
    expect(gate.pendingCount, 0);
    expect(gate.failures.length, 1);
    await expectLater(gate.drain(), throwsStateError);
    gate.resume('r1', {'QA001': 'A'});
    expect(
      await gate.process(packet, (_, _, _) async {}),
      DetectionResult.saved,
    );
    await gate.drain();
    expect(gate.failures, isEmpty);
  });
  test(
    'completion waits for in-flight writes, then pauses incoming packets',
    () async {
      final gate = DetectionGate()..resume('r1', {'QA001': 'A'});
      final hold = Completer<void>();
      final write = gate.process(packet, (_, _, _) => hold.future);
      var drained = false;
      final finish = gate.drain().then((_) {
        drained = true;
      });
      expect(
        await gate.process(packet, (_, _, _) async {}),
        DetectionResult.ignored,
      );
      expect(drained, false);
      hold.complete();
      await write;
      await finish;
      expect(drained, true);
    },
  );
  test(
    'roster load failure does not begin a round; explicit retry recovers',
    () async {
      var failLoad = true, begins = 0;
      final controller = RoundScannerController(
        loadRoster: () async {
          if (failLoad) throw StateError('roster offline');
          return {'QA001': 'A'};
        },
        begin: () async {
          begins++;
          return 'r1';
        },
        finish: (_, _) async {},
        persist: (_, _, _, _) async {},
      );
      await expectLater(controller.start(), throwsStateError);
      expect(await controller.process(packet, -50), DetectionResult.ignored);
      expect(begins, 0);
      failLoad = false;
      await controller.start();
      expect(await controller.process(packet, -50), DetectionResult.saved);
    },
  );
  test(
    'pause/reopen does not finish; acknowledgement failure preserves round identity',
    () async {
      var finishes = 0, failFinish = true;
      final controller = RoundScannerController(
        loadRoster: () async => {'QA001': 'A'},
        begin: () async => 'r2',
        finish: (id, cancel) async {
          expect(id, 'r2');
          finishes++;
          if (failFinish) throw StateError('lost ack');
        },
        persist: (_, _, _, _) async {},
      );
      await controller.start();
      await controller.pause();
      expect(finishes, 0);
      expect(controller.currentRound, 'r2');
      await expectLater(controller.complete(), throwsStateError);
      expect(controller.currentRound, 'r2');
      failFinish = false;
      await controller.complete();
      expect(controller.currentRound, isNull);
    },
  );
}
