import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:lecturer_app/services/firebase_environment.dart';
import 'package:lecturer_app/services/qa_config.dart';
import 'package:lecturer_app/services/report_service.dart';
import 'package:lecturer_app/services/api_client.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'P07 Android lecturer report adapter retains correction and owner contracts',
    (_) async {
      expect(defaultTargetPlatform, TargetPlatform.android);
      QaConfig.validate();
      expect(QaConfig.enabled, isTrue);
      await initializeAppFirebase();
      try {
        await appAuth.signInWithEmailAndPassword(
          email: 'lecturer.a@example.test',
          password: 'QA-only-Password-123!',
        );
        final service = ReportService();
        final report = await service.sessionReport('qa-s1');
        expect(
          (report['records'] as List<dynamic>).map((r) => r['status']).toList(),
          [1, 0, 'ex'],
        );
        expect(report['totals']['attendance_percentage'], 66.67);
        final module = await service.moduleSummary('QA101');
        expect(module['total_sessions'], 1);
        expect(module['summary_by_uid']['qa-student-c']['present'], 1);
        await expectLater(
          service.moduleSummary('QA202'),
          throwsA(isA<ApiException>().having((e) => e.status, 'status', 403)),
        );
      } finally {
        await appAuth.signOut();
      }
    },
  );
}
