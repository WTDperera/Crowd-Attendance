import 'dart:async';
import 'round_domain.dart';

enum DetectionResult { ignored, duplicate, saved }

/// Shared by actual BLE scanner and tests. A failed write never enters success.
class DetectionGate {
  String? roundId;
  Map<String, String>? roster; // registration -> stable student UID
  bool accepting = false;
  final Set<String> _saved = {};
  final Map<String, Future<void>> _pending = {};
  final Map<String, Object> failures = {};
  int get pendingCount => _pending.length;

  void resume(String id, Map<String, String> eligible) {
    if (_pending.isNotEmpty) throw StateError('Wait for pending writes.');
    if (roundId != id) {
      _saved.clear();
      failures.clear();
    }
    roundId = id;
    roster = Map.unmodifiable(eligible);
    accepting = true;
  }

  Future<DetectionResult> process(
    Map<int, List<int>> payload,
    Future<void> Function(String roundId, String uid, String regNo) persist,
  ) async {
    final regNo = decodeRegistration(payload);
    final id = roundId;
    final uid = roster?[regNo];
    if (!accepting || id == null || regNo == null || uid == null) {
      return DetectionResult.ignored;
    }
    final key = '$id/$uid';
    if (_saved.contains(key) || _pending.containsKey(key)) {
      return DetectionResult.duplicate;
    }
    // Insert before calling persist, including when it throws synchronously.
    final done = Completer<void>();
    _pending[key] = done.future;
    try {
      await persist(id, uid, regNo);
      _saved.add(key);
      failures.remove(key);
      return DetectionResult.saved;
    } catch (error) {
      failures[key] = error;
      rethrow;
    } finally {
      _pending.remove(key);
      done.complete();
    }
  }

  void pause() {
    accepting = false;
  }

  Future<void> drain({bool allowFailures = false}) async {
    pause();
    await Future.wait(_pending.values.toList());
    if (!allowFailures && failures.isNotEmpty) {
      throw StateError(
        'Attendance not saved. Resume and retry, or cancel this round.',
      );
    }
  }
}
