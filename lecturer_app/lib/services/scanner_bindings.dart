import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'round_scanner_controller.dart';
import 'session_service.dart';

// UI tests replace only platform/data boundaries. The production screen still
// uses the same durable controller and the actual session services.
class ScannerBindings {
  const ScannerBindings({
    required this.rounds,
    required this.session,
    required this.attendance,
    required this.radio,
    required this.results,
    required this.requestRadio,
    required this.startRadio,
    required this.stopRadio,
    required this.endSession,
  });
  final RoundScannerController rounds;
  final Stream<Map<String, dynamic>?> session;
  final Stream<Map<String, Map<String, dynamic>>> attendance;
  final Stream<bool> radio;
  final Stream<List<ScanResult>> results;
  final Future<void> Function() requestRadio, startRadio, stopRadio, endSession;

  factory ScannerBindings.forSession(String id) {
    final service = SessionService();
    return ScannerBindings(
      rounds: RoundScannerController(
        loadRoster: () => service.loadSessionRoster(id),
        begin: () => service.beginRound(id),
        finish: (round, cancel) => cancel
            ? service.cancelRound(id, round)
            : service.completeRound(id, round),
        persist: (round, uid, regNo, rssi) async {
          await service.markAttendance(
            sessionId: id,
            roundId: round,
            studentId: uid,
            regNo: regNo,
            rssi: rssi,
          );
        },
      ),
      session: service
          .getSessionStream(id)
          .map((doc) => doc.data() as Map<String, dynamic>?),
      attendance: service
          .getAttendanceRecordsStream(id)
          .map(
            (snapshot) => {
              for (final doc in snapshot.docs)
                (doc.data() as Map<String, dynamic>)['reg_no'] as String:
                    doc.data() as Map<String, dynamic>,
            },
          ),
      radio: FlutterBluePlus.isScanning,
      results: FlutterBluePlus.onScanResults,
      requestRadio: () async {
        final permissions = await [
          Permission.bluetoothScan,
          Permission.bluetoothConnect,
          Permission.location,
        ].request();
        if (permissions.values.any((status) => !status.isGranted)) {
          throw StateError('Bluetooth/location permissions required.');
        }
        if (!await FlutterBluePlus.isSupported) {
          throw StateError('Bluetooth not supported.');
        }
      },
      startRadio: () => FlutterBluePlus.startScan(
        withServices: [Guid('bf27730d-860a-4e09-8f3c-7a2b5d9e4f1c')],
        timeout: const Duration(minutes: 30),
        androidUsesFineLocation: true,
      ),
      stopRadio: FlutterBluePlus.stopScan,
      endSession: () => service.endSession(id),
    );
  }
}
