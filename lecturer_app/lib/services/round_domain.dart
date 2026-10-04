import 'dart:convert';

// Student advertising uses UTF-8 manufacturer payloads under this company ID.
// No case/whitespace/length policy is invented: match the roster label exactly.
String? decodeRegistration(Map<int, List<int>> manufacturerData) {
  final bytes = manufacturerData[0xffff];
  if (bytes == null || bytes.isEmpty || bytes.any((b) => b < 0 || b > 255)) {
    return null;
  }
  try {
    final label = utf8.decode(bytes);
    return label.trim().isEmpty || label.contains('\x00') ? null : label;
  } on FormatException {
    return null;
  }
}

String attendanceDocumentId(String sessionId, String studentId) =>
    '$sessionId.${base64Url.encode(utf8.encode(studentId))}';

String roundOutcome(Iterable<String> observed, Set<String> completed) {
  if (completed.isEmpty) throw StateError('Complete at least one round first.');
  final seen = observed.toSet().intersection(completed);
  return seen.isEmpty
      ? 'absent'
      : seen.length == completed.length
      ? 'present'
      : 'left_early';
}
