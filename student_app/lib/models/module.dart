import 'package:cloud_firestore/cloud_firestore.dart';

class Module {
  Module({
    required this.id,
    required this.code,
    required this.name,
    required this.lecturerId,
    required this.totalSessions,
    required this.sessionDates,
    required this.enrollmentEnabled,
    required this.enrollmentPasswordHash,
  });

  final String id;
  final String code;
  final String name;
  final String lecturerId;
  final int totalSessions;
  final List<DateTime> sessionDates;
  final bool enrollmentEnabled;
  final String enrollmentPasswordHash;

  static int _asInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) {
      final trimmed = value.trim();
      if (trimmed.isEmpty) return 0;
      return int.tryParse(trimmed) ?? double.tryParse(trimmed)?.toInt() ?? 0;
    }
    return 0;
  }

  factory Module.fromDoc(DocumentSnapshot doc) {
    final data = doc.data();
    final map = (data is Map<String, dynamic>)
        ? data
        : const <String, dynamic>{};

    final sessionDates = <DateTime>[];
    final rawDates = map['session_dates'] ?? map['sessionDates'];
    if (rawDates is List) {
      for (final item in rawDates) {
        if (item is Timestamp) {
          sessionDates.add(item.toDate());
        }
      }
    }

    return Module(
      id: doc.id,
      code: (map['code'] as String?)?.trim() ?? '',
      name: (map['name'] as String?)?.trim() ?? '',
      lecturerId:
          (map['lecturer_id'] as String?)?.trim() ??
          (map['lecturerId'] as String?)?.trim() ??
          '',
      totalSessions: _asInt(map['total_sessions'] ?? map['totalSessions']),
      sessionDates: sessionDates,
      enrollmentEnabled: map['enrollment_enabled'] == true,
      enrollmentPasswordHash:
          (map['enrollment_password_hash'] as String?)?.trim().toLowerCase() ??
          '',
    );
  }
}
