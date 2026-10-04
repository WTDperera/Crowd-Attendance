import 'api_client.dart';

class ReportService {
  ReportService({ApiClient? api}) : _api = api ?? ApiClient();
  final ApiClient _api;
  Future<Map<String, dynamic>> moduleSummary(String id) =>
      _api.get('/api/attendance/module/${Uri.encodeComponent(id)}/summary');
  Future<Map<String, dynamic>> sessionReport(String id) =>
      _api.get('/api/attendance/session/${Uri.encodeComponent(id)}/report');
}
