import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:student_app/services/firebase_environment.dart';
import 'package:student_app/services/qa_config.dart';
import 'package:student_app/services/attendance_stats_service.dart';
import 'package:student_app/models/module_stats.dart';
import 'package:student_app/widgets/module_attendance_card.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'P07 Android student reports use completed class ledger and corrections',
    (_) async {
      expect(defaultTargetPlatform, TargetPlatform.android);
      QaConfig.validate();
      expect(QaConfig.enabled, isTrue);
      await initializeAppFirebase();
      try {
        await appAuth.signInWithEmailAndPassword(
          email: 'student.c@example.test',
          password: 'QA-only-Password-123!',
        );
        final stats = await AttendanceStatsService().getStudentStats(
          'qa-student-c',
        );
        final module = stats.singleWhere((s) => s.code == 'QA101');
        expect(module.presentCount, 1);
        expect(module.totalModuleSessions, 1);
        expect(module.attendancePercentage, 100);
        expect(module.eligible, isTrue);
        expect(module.absentRecordDates, isEmpty);
        expect(module.conflicts, isEmpty);
        expect(
          module.presentRecordDates.single.toUtc(),
          DateTime.parse('2026-10-02T03:30:00Z'),
        );
        final zero = stats.singleWhere((s) => s.code == 'QA202');
        expect(zero.totalModuleSessions, 0);
        expect(zero.attendancePercentage, 0);
        expect(zero.eligible, isFalse);
        await expectLater(
          AttendanceStatsService().getStudentStats('qa-student-a'),
          throwsStateError,
        );
        for (final counts in [
          [4, 5, true],
          [7999, 10000, false],
          [8001, 10000, true],
          [79999, 100000, false],
          [0, 0, false],
        ]) {
          final m = ModuleStats(
            attendancePercentage: 80,
            absentDates: [],
            presentCount: counts[0] as int,
            totalModuleSessions: counts[1] as int,
          );
          expect(m.eligible, counts[2]);
        }
      } finally {
        await appAuth.signOut();
      }
    },
  );
  testWidgets(
    'P07 report card displays two decimals and uses raw eligibility',
    (tester) async {
      for (final sample in [
        [4, 5, '80.00%', Colors.green],
        [79999, 100000, '80.00%', Colors.orange],
        [0, 0, '0.00%', Colors.red],
      ]) {
        final present = sample[0] as int, total = sample[1] as int;
        final stats = ModuleStats(
          attendancePercentage: total == 0 ? 0 : present / total * 100,
          absentDates: [],
          presentCount: present,
          totalModuleSessions: total,
          conflicts: const ['qa-conflict'],
        );
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: ModuleAttendanceCard(key: UniqueKey(), stats: stats),
            ),
          ),
        );
        expect(find.text(sample[2] as String), findsOneWidget);
        expect(
          tester
              .widget<CircularProgressIndicator>(
                find.byType(CircularProgressIndicator),
              )
              .color,
          sample[3],
        );
        expect(
          find.text('Conflicting records require lecturer review.'),
          findsOneWidget,
        );
      }
    },
  );
  testWidgets(
    'P07 report detail uses the same Colombo day at both boundaries',
    (tester) async {
      for (final instant in [
        DateTime.parse('2026-10-01T18:30:00Z'),
        DateTime.parse('2026-10-02T18:29:59Z'),
      ]) {
        final stats = ModuleStats(
          attendancePercentage: 100,
          absentDates: [],
          presentCount: 1,
          totalModuleSessions: 1,
          presentRecordDates: [instant],
        );
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: ModuleAttendanceCard(
                  key: UniqueKey(),
                  stats: stats,
                  initiallyExpanded: true,
                ),
              ),
            ),
          ),
        );
        expect(find.textContaining('Friday, October 2, 2026'), findsOneWidget);
        expect(find.textContaining('2 hrs'), findsNothing);
      }
    },
  );
}
