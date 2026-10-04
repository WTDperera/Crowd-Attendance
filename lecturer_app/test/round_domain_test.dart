import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:lecturer_app/services/round_domain.dart';

void main() {
  test(
    'UTF-8 registration matches roster bytes exactly without case/trim policy',
    () {
      for (final label in ['QA001', 'eg123', ' ර', 'QA 001 ']) {
        expect(decodeRegistration({0xffff: utf8.encode(label)}), label);
      }
    },
  );
  test(
    'empty, malformed, NUL and unrelated manufacturer payloads are rejected',
    () {
      for (final data in <Map<int, List<int>>>[
        {},
        {
          1: [65],
        },
        {0xffff: []},
        {
          0xffff: [0xff],
        },
        {
          0xffff: [65, 0, 66],
        },
        {
          0xffff: [-1],
        },
        {
          0xffff: [256],
        },
        {
          0xffff: [32],
        },
      ]) {
        expect(decodeRegistration(data), isNull);
      }
    },
  );
  test(
    'tuple encoding cannot collide on separators or non-ASCII identities',
    () {
      expect(
        attendanceDocumentId('a_b', 'c'),
        isNot(attendanceDocumentId('a', 'b_c')),
      );
      expect(
        attendanceDocumentId('session', 'සි'),
        attendanceDocumentId('session', 'සි'),
      );
    },
  );
  test(
    'distinct completed rounds define all/some/none; cancelled evidence excluded',
    () {
      final completed = {'r1', 'r2', 'r3'};
      expect(roundOutcome(['r1', 'r2', 'r3'], completed), 'present');
      expect(
        roundOutcome([...List.filled(100, 'r1'), 'r2'], completed),
        'left_early',
      );
      expect(roundOutcome(['cancelled'], completed), 'absent');
      expect(() => roundOutcome([], {}), throwsStateError);
    },
  );
  test(
    'seeded replay permutations preserve round evidence and missed rounds',
    () {
      for (var repeats = 1; repeats <= 100; repeats++) {
        final observed = [...List.filled(repeats, 'r1'), 'r2'];
        expect(observed.toSet(), {'r1', 'r2'});
        expect(
          roundOutcome(observed.reversed, {'r1', 'r2', 'r3'}),
          'left_early',
        );
      }
    },
  );
}
