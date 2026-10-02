import 'package:flutter_test/flutter_test.dart';
import '../lib/services/qa_config.dart';

void main() {
  test('QA rejects production targets and ambiguous bootstrap settings', () {
    expect(() => QaConfig.validate(modeValue: 'true', projectValue: 'live', hostValue: '127.0.0.1'), throwsStateError);
    expect(() => QaConfig.validate(modeValue: 'true', projectValue: QaConfig.project, hostValue: 'example.com'), throwsStateError);
    expect(() => QaConfig.validate(modeValue: 'false', projectValue: QaConfig.project, hostValue: '127.0.0.1'), throwsStateError);
    expect(() => QaConfig.validate(modeValue: 'true', projectValue: QaConfig.project, hostValue: '10.0.2.2'), returnsNormally);
  });
}