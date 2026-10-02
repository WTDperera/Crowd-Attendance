class QaConfig {
  static const project = 'demo-crowd-attendance-qa';
  static const mode = String.fromEnvironment('QA_MODE');
  static const projectId = String.fromEnvironment('QA_PROJECT_ID');
  static const host = String.fromEnvironment('QA_EMULATOR_HOST');
  static bool get enabled => mode == 'true';

  static void validate({String modeValue = mode, String projectValue = projectId,
      String hostValue = host}) {
    if (modeValue != 'true') {
      if ((modeValue.isNotEmpty && modeValue != 'false') ||
          projectValue.isNotEmpty || hostValue.isNotEmpty) {
        throw StateError('QA requires explicit QA_MODE=true');
      }
      return;
    }
    if (projectValue != project ||
        !['127.0.0.1', '10.0.2.2'].contains(hostValue)) {
      throw StateError('QA accepts only the demo project and local emulator host');
    }
  }
}
