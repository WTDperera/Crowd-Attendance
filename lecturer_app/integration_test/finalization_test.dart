import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:lecturer_app/services/firebase_environment.dart';
import 'package:lecturer_app/services/qa_config.dart';
import 'package:lecturer_app/services/session_service.dart';
import 'package:lecturer_app/services/api_client.dart';
import 'package:lecturer_app/services/round_service.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'P06 Android completion retries and corrections retain the ledger',
    (_) async {
      expect(defaultTargetPlatform, TargetPlatform.android);
      QaConfig.validate();
      expect(QaConfig.enabled, isTrue);
      await initializeAppFirebase();
      await appAuth.signInWithEmailAndPassword(
        email: 'lecturer.a@example.test',
        password: 'QA-only-Password-123!',
      );
      const server = GetOptions(source: Source.server);
      try {
        final service = SessionService();
        final id = await service.createSession(
          moduleCode: 'QA101',
          moduleId: 'QA101',
          sessionTopic: 'P06 Android ledger',
        );
        for (var n = 1; n <= 3; n++) {
          final round = await service.beginRound(id);
          for (final suffix in n == 3 ? ['a'] : ['a', 'c']) {
            await service.markAttendance(
              sessionId: id,
              roundId: round,
              studentId: 'qa-student-$suffix',
              regNo: suffix == 'a' ? 'QA001' : 'QA003',
              rssi: -50,
            );
          }
          await service.completeRound(id, round);
        }
        await Future.wait([service.endSession(id), service.endSession(id)]);
        await service.endSession(id);
        expect(
          (await appFirestore.doc('modules/QA101').get(server))
              .data()?['total_sessions'],
          2,
        );
        final root = appFirestore.doc('active_sessions/$id');
        expect((await root.get(server)).data()?['student_count'], 1);
        final results = await root.collection('attendance').get(server);
        expect(
          {for (final doc in results.docs) doc.id: doc.data()['final_status']},
          {
            'qa-student-a': 'present',
            'qa-student-b': 'absent',
            'qa-student-c': 'left_early',
          },
        );
        for (final status in [
          'Excused',
          'Excused',
          'Present',
          'Absent',
          'Absent',
        ]) {
          await ApiClient().post('/api/attendance/session/$id/mark', {
            'student_uid': 'qa-student-c',
            'status': status,
            'reason': 'Synthetic Android P06',
          });
          final record =
              (await root
                      .collection('attendance')
                      .doc('qa-student-c')
                      .get(server))
                  .data()!;
          expect(record['final_status'], status.toLowerCase());
          expect(record['scan_count'], 2);
          final profile =
              (await appFirestore.doc('students/qa-student-c').get(server))
                  .data()!;
          expect(
            (profile['attendance_counts'] as Map)['QA101'],
            status == 'Absent' ? 0 : 1,
          );
        }
        await service.endSession(id);
        expect((await root.get(server)).data()?['student_count'], 1);
        expect(
          (await appFirestore.doc('modules/QA101').get(server))
              .data()?['total_sessions'],
          2,
        );
        final observations = await root
            .collection('rounds')
            .doc('r1')
            .collection('observations')
            .get(server);
        expect(observations.size, 2);
        await expectLater(
          service.markAttendance(
            sessionId: id,
            roundId: 'r3',
            studentId: 'qa-student-b',
            regNo: 'QA002',
            rssi: -50,
          ),
          throwsA(isA<RoundException>()),
        );
        await expectLater(
          service.beginRound(id),
          throwsA(isA<RoundException>()),
        );
        await expectLater(
          root.update({'status': 'active'}),
          throwsA(isA<FirebaseException>()),
        );
      } finally {
        await appAuth.signOut();
      }
    },
    timeout: const Timeout(Duration(minutes: 5)),
  );
}
