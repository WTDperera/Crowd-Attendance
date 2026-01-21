import 'package:flutter_reactive_ble/flutter_reactive_ble.dart';

class BleService {
  final FlutterReactiveBle _ble = FlutterReactiveBle();

  Stream<DiscoveredDevice> scanDevices() {
    return _ble.scanForDevices(
      withServices: [], // empty = scan all devices
      scanMode: ScanMode.lowLatency,
    );
  }
}
