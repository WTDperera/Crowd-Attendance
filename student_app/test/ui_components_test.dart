import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:student_app/main.dart';
import 'package:student_app/models/module.dart';
import 'package:student_app/screens/modules_screen.dart';
import 'package:student_app/services/module_service.dart';

class UiModuleService implements ModuleService {
  final enrollments = StreamController<Set<String>>.broadcast();
  final modules = StreamController<List<Module>>.broadcast();
  Future<void> Function()? save;
  int saves = 0;
  int enrollmentWatches = 0, moduleWatches = 0;
  @override
  Stream<Set<String>> watchEnrolledCodes(String uid) {
    enrollmentWatches++;
    return enrollments.stream.map((value) => value);
  }

  @override
  Stream<List<Module>> watchAllModules() {
    moduleWatches++;
    return modules.stream.map((value) => value);
  }

  @override
  Future<void> enrollWithPassword({
    required String studentUid,
    required Module module,
    required String plainPassword,
  }) async {
    saves++;
    await save?.call();
  }

  Future<void> close() async {
    await enrollments.close();
    await modules.close();
  }
}

Module sample({bool open = true}) => Module(
  id: 'QA808',
  code: 'QA808',
  name: 'QA widget module',
  lecturerId: 'qa-lecturer-a',
  totalSessions: 0,
  sessionDates: [],
  enrollmentEnabled: open,
);
Future<void> fillLogin(WidgetTester tester) async {
  await tester.enterText(
    find.byType(TextFormField).at(0),
    'student.a@example.test',
  );
  await tester.enterText(
    find.byType(TextFormField).at(1),
    'QA-only-Password-123!',
  );
  await tester.ensureVisible(find.byType(ElevatedButton).last);
}

void main() {
  testWidgets(
    'student login validates input and exposes pending/error/retry states',
    (tester) async {
      int calls = 0;
      final pending = Completer<void>();
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
      expect(find.textContaining('required'), findsWidgets);
      await fillLogin(tester);
      // Use two callbacks before a frame to exercise the synchronous guard.
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
      pending.completeError(Exception('QA login offline'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('QA login offline'), findsOneWidget);
      expect(
        tester
            .widget<ElevatedButton>(find.byType(ElevatedButton).last)
            .onPressed,
        isNotNull,
      );
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets('student login safely disposes with a request pending', (
    tester,
  ) async {
    final pending = Completer<void>();
    await tester.pumpWidget(
      MaterialApp(home: LoginScreen(login: (_, _) => pending.future)),
    );
    await fillLogin(tester);
    await tester.tap(find.byType(ElevatedButton).last);
    await tester.pump();
    await tester.pumpWidget(const SizedBox.shrink());
    pending.completeError(Exception('Late error'));
    await tester.pump();
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'enrollment shows loading/error and closes stream listeners on disposal',
    (tester) async {
      final service = UiModuleService();
      await tester.pumpWidget(
        MaterialApp(
          home: ModulesScreen(studentUid: 'qa-student-a', service: service),
        ),
      );
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      service.enrollments.addError(Exception('Enrollment unavailable'));
      await tester.pump();
      expect(find.textContaining('Enrollment unavailable'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      expect(service.enrollments.hasListener, isFalse);
      expect(service.modules.hasListener, isFalse);
      await service.close();
    },
  );
  testWidgets(
    'enrollment blocks closed/already enrolled and reports a failed save without success',
    (tester) async {
      final service = UiModuleService();
      await tester.pumpWidget(
        MaterialApp(
          home: ModulesScreen(studentUid: 'qa-student-a', service: service),
        ),
      );
      service.enrollments.add({});
      await tester.pump();
      service.modules.add([sample(open: false)]);
      await tester.pump();
      expect(
        tester
            .widget<ElevatedButton>(find.byType(ElevatedButton).last)
            .onPressed,
        isNull,
      );
      service.modules.add([sample()]);
      await tester.pump();
      await tester.tap(find.widgetWithText(ElevatedButton, 'Enroll'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.widgetWithText(ElevatedButton, 'Continue'));
      await tester.pumpAndSettle();
      expect(find.text('Password is required'), findsOneWidget);
      expect(service.saves, 0);
      ScaffoldMessenger.of(
        tester.element(find.byType(ModulesScreen)),
      ).clearSnackBars();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.widgetWithText(ElevatedButton, 'Enroll'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.enterText(find.byType(TextField), 'wrong-password');
      await tester.pump();
      service.save = () async {
        throw WrongEnrollmentPasswordException();
      };
      await tester.tap(find.widgetWithText(ElevatedButton, 'Continue'));
      await tester.pumpAndSettle();
      expect(service.saves, 1);
      expect(service.enrollmentWatches, 1);
      expect(service.moduleWatches, 1);
      expect(find.text('Wrong password'), findsOneWidget);
      expect(find.text('Enrolled in QA808'), findsNothing);
      service.enrollments.add({'QA808'});
      await tester.pump();
      service.modules.add([sample()]);
      await tester.pump();
      expect(
        tester
            .widget<ElevatedButton>(find.byType(ElevatedButton).last)
            .onPressed,
        isNull,
      );
      await tester.pumpWidget(const SizedBox.shrink());
      await service.close();
    },
  );
}
