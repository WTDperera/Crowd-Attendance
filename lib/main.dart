import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_reactive_ble/flutter_reactive_ble.dart';
import 'package:permission_handler/permission_handler.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Lecturer Scanner App',
      theme: ThemeData(primarySwatch: Colors.blue),
      home: const ScannerScreen(),
    );
  }
}

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final flutterReactiveBle = FlutterReactiveBle();
  final List<DiscoveredDevice> devices = [];

  bool scanning = false;

  @override
  void initState() {
    super.initState();
    _checkPermissionsAndScan();
  }

  /// Step 2: Check and request runtime permissions
  Future<void> _checkPermissionsAndScan() async {
    if (!Platform.isAndroid) {
      // BLE scanning example is for Android only
      return;
    }

    // Build list of required permissions
    final List<Permission> permissions = [
      Permission.bluetoothScan,
      Permission.bluetoothConnect,
      Permission.bluetoothAdvertise,
      Permission.locationWhenInUse, // required on Android <12
    ];

    final statuses = await permissions.request();

    bool allGranted = statuses.values.every((status) => status.isGranted);

    if (allGranted) {
      _startScan();
    } else {
      // Inform user
      _showPermissionDialog();
    }
  }

  void _showPermissionDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Permissions Required'),
        content: const Text(
            'Bluetooth and Location permissions are required for scanning devices.'),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
            },
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              openAppSettings();
              Navigator.of(context).pop();
            },
            child: const Text('Open Settings'),
          ),
        ],
      ),
    );
  }

  /// Step 3: Start BLE scanning
  void _startScan() {
    if (scanning) return;
    setState(() => scanning = true);

    devices.clear();

    flutterReactiveBle.scanForDevices(withServices: []).listen(
      (device) {
        if (!devices.any((d) => d.id == device.id)) {
          setState(() {
            devices.add(device);
          });
        }
      },
      onError: (error) {
        // Handle scan errors here
        debugPrint('Scan error: $error');
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan BLE Devices')),
      body: ListView.builder(
        itemCount: devices.length,
        itemBuilder: (context, index) {
          final d = devices[index];
          return ListTile(
            title: Text(d.name.isNotEmpty ? d.name : 'Unknown Device'),
            subtitle: Text(d.id),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        child: const Icon(Icons.refresh),
        onPressed: _startScan,
      ),
    );
  }
}
