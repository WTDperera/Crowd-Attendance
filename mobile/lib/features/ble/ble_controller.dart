import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_ble_peripheral/flutter_ble_peripheral.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../core/identity/identity_service.dart';

enum BleState { idle, advertising, scanning }

class BleController extends ChangeNotifier {
  final IdentityService _identityService = IdentityService();
  final FlutterBlePeripheral _blePeripheral = FlutterBlePeripheral();
  
  // State
  BleState _currentState = BleState.idle;
  BleState get currentState => _currentState;
  
  String? _deviceId;
  String? get deviceId => _deviceId;
  
  final List<String> _logs = [];
  List<String> get logs => List.unmodifiable(_logs);

  // Configuration
  static const String SERVICE_UUID = "bf27730d-860a-4e09-889c-2d8b6a9e0fe7"; // Random UUID for the app
  static const int ADVERTISE_DURATION_MS = 10000;
  static const int SCAN_DURATION_MS = 5000;
  static const int IDLE_DURATION_MS = 2000;
  
  Timer? _stateTimer;
  bool _isRunning = false;

  Future<void> initialize() async {
    _log("Initializing BLE Controller...");
    _deviceId = await _identityService.getSecureHardwareId();
    _log("Device ID: $_deviceId");
    
    await _requestPermissions();
  }

  Future<void> _requestPermissions() async {
    Map<Permission, PermissionStatus> statuses = await [
      Permission.bluetooth,
      Permission.bluetoothScan,
      Permission.bluetoothAdvertise,
      Permission.bluetoothConnect,
      Permission.location,
    ].request();
    
    _log("Permissions granted: ${statuses.values.every((element) => element.isGranted)}");
  }

  void startTdm() {
    if (_isRunning) return;
    _isRunning = true;
    _enterAdvertiseState();
  }

  void stopTdm() {
    _isRunning = false;
    _stateTimer?.cancel();
    _stopAdvertising();
    _stopScanning();
    _currentState = BleState.idle;
    notifyListeners();
  }

  // --- State Machine ---

  void _enterAdvertiseState() async {
    if (!_isRunning) return;
    
    _currentState = BleState.advertising;
    notifyListeners();
    _log("State: ADVERTISING");

    await _stopScanning();
    await _startAdvertising();

    _stateTimer = Timer(Duration(milliseconds: ADVERTISE_DURATION_MS), () {
      _enterScanState();
    });
  }

  void _enterScanState() async {
    if (!_isRunning) return;

    _currentState = BleState.scanning;
    notifyListeners();
    _log("State: SCANNING");

    await _stopAdvertising();
    await _startScanning();

    _stateTimer = Timer(Duration(milliseconds: SCAN_DURATION_MS), () {
      _enterIdleState();
    });
  }

  void _enterIdleState() async {
    if (!_isRunning) return;

    _currentState = BleState.idle;
    notifyListeners();
    _log("State: IDLE");

    await _stopAdvertising();
    await _stopScanning();

    _stateTimer = Timer(Duration(milliseconds: IDLE_DURATION_MS), () {
      _enterAdvertiseState();
    });
  }

  // --- Actions ---

  Future<void> _startAdvertising() async {
    if (_deviceId == null) return;

    // Construct Payload
    // For prototype: Manufacturer Data = [0xFF, 0xFF] + Bytes
    // Real impl: See strategy doc for HMAC logic
    
    final AdvertiseData advertiseData = AdvertiseData(
      serviceUuid: SERVICE_UUID,
      manufacturerId: 0xFFFF,
      manufacturerData: utf8.encode(_deviceId!.substring(0, min(_deviceId!.length, 20))), // Truncate for demo
    );

    await _blePeripheral.start(advertiseData: advertiseData);
  }

  Future<void> _stopAdvertising() async {
    await _blePeripheral.stop();
  }

  Future<void> _startScanning() async {
    // Start scanning
    try {
        await FlutterBluePlus.startScan(
            withServices: [Guid(SERVICE_UUID)],
            timeout: Duration(milliseconds: SCAN_DURATION_MS),
            androidUsesFineLocation: true,
        );

        FlutterBluePlus.scanResults.listen((results) {
            for (ScanResult r in results) {
                // Process found peers
                // In real app: Verify HMAC
                _log("Found Peer: ${r.device.remoteId} RSSI: ${r.rssi}");
            }
        });
    } catch (e) {
        _log("Scan Error: $e");
    }
  }

  Future<void> _stopScanning() async {
    try {
        await FlutterBluePlus.stopScan();
    } catch (e) {
        // Ignore
    }
  }

  void _log(String message) {
    print("[BLE-TDM] $message");
    _logs.add("${DateTime.now().toIso8601String().split('T')[1].split('.')[0]} $message");
    notifyListeners();
  }
}
