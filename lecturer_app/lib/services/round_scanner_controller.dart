import 'detection_gate.dart';

class RoundScannerController {
  RoundScannerController({
    required this.loadRoster,
    required this.begin,
    required this.finish,
    required this.persist,
  });
  final Future<Map<String, String>> Function() loadRoster;
  final Future<String> Function() begin;
  final Future<void> Function(String, bool) finish;
  final Future<void> Function(String, String, String, int) persist;
  final DetectionGate gate = DetectionGate();
  Map<String, String>? _roster;
  String? currentRound;
  bool _changing = false;
  bool _disposed = false;

  void dispose() {
    _disposed = true;
    gate.pause(); // Leaving a screen must never complete a durable round.
  }

  Future<void> start() async {
    if (_disposed || _changing || gate.accepting) return;
    _changing = true;
    try {
      // Failed/unavailable roster never permits detection. Retry loads server.
      _roster ??= await loadRoster();
      if (_disposed) return;
      final id = await begin();
      currentRound = id;
      if (_disposed) return;
      gate.resume(id, _roster!);
    } finally {
      _changing = false;
    }
  }

  Future<DetectionResult> process(Map<int, List<int>> payload, int rssi) =>
      gate.process(
        payload,
        (round, uid, regNo) => persist(round, uid, regNo, rssi),
      );

  Future<void> pause() async {
    await gate.drain(allowFailures: true);
  }

  Future<void> complete({bool cancel = false}) async {
    if (_changing) throw StateError('Round change already pending.');
    final id = currentRound;
    if (id == null) return;
    _changing = true;
    try {
      await gate.drain(allowFailures: cancel);
      await finish(id, cancel);
      currentRound = null;
    } finally {
      _changing = false;
    }
  }
}
