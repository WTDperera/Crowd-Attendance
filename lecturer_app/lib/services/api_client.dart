import 'dart:convert';
import 'dart:io';
import 'package:firebase_auth/firebase_auth.dart';
import 'firebase_environment.dart';
import 'qa_config.dart';

class ApiException implements Exception {
  ApiException(this.status, this.message);
  final int status;
  final String message;
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({FirebaseAuth? auth}) : _auth = auth ?? appAuth;
  final FirebaseAuth _auth;

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) =>
      _request('POST', path, body);

  Future<Map<String, dynamic>> get(String path) => _request('GET', path, null);

  Future<Map<String, dynamic>> _request(
    String method,
    String path,
    Map<String, dynamic>? body,
  ) async {
    QaConfig.validate();
    final base = QaConfig.enabled
        ? 'http://${QaConfig.host}:5000'
        : const String.fromEnvironment('API_BASE_URL');
    final uri = Uri.tryParse(base);
    if (uri == null ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty ||
        (QaConfig.enabled ? uri.scheme != 'http' : uri.scheme != 'https')) {
      throw StateError(
        'Configure a valid HTTPS API_BASE_URL for lecturer attendance.',
      );
    }
    final user = _auth.currentUser;
    if (user == null) throw StateError('Lecturer login is required.');
    final token = await user.getIdToken();
    final client = HttpClient();
    try {
      final request = await client
          .openUrl(method, uri.resolve(path))
          .timeout(const Duration(seconds: 15));
      request.headers.contentType = ContentType.json;
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      if (body != null) request.write(jsonEncode(body));
      final response = await request.close().timeout(
        const Duration(seconds: 15),
      );
      final text = await utf8.decoder
          .bind(response)
          .join()
          .timeout(const Duration(seconds: 15));
      final data = jsonDecode(text);
      if (data is! Map<String, dynamic>) {
        throw StateError('Invalid attendance response.');
      }
      if (response.statusCode != HttpStatus.ok) {
        throw ApiException(
          response.statusCode,
          data['message'] as String? ?? 'Attendance update failed.',
        );
      }
      return data;
    } finally {
      client.close(force: true);
    }
  }
}
