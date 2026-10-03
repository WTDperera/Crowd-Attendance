import 'package:flutter_test/flutter_test.dart';
import 'qa_config_assertions.dart';

void main() {
  test('QA rejects production targets and ambiguous bootstrap settings', () {
    verifyQaConfigGuards();
  });
}
