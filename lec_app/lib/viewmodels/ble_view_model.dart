import 'package:flutter/material.dart';
import '../models/ble_device.dart';
import '../services/ble_services.dart';
import '../services/student_service.dart';

class LecturerViewModel extends ChangeNotifier {
  final BleService _bleService = BleService();
  final StudentService _studentService = StudentService();
  List<DeviceModel> devices = [];
  bool isScanning = false;
  final Set<String> _seenIds = {};
  final Set<String> _queriedIds = {};

  void startScan() {
    devices.clear();
    isScanning = true;
    notifyListeners();

    _bleService.scanDevices().listen((device) {
      if (_seenIds.add(device.id)) {
        final String? advUuid =
            (device.serviceUuids.isNotEmpty) ? device.serviceUuids.first.toString() : null;
        final model = DeviceModel(id: device.id, name: device.name, advertisedUuid: advUuid);
        devices.add(model);
        notifyListeners();
        _maybeResolveStudent(model);
      }
    }, onError: (e) {
      isScanning = false;
      notifyListeners();
    });
  }

  Future<void> _maybeResolveStudent(DeviceModel model) async {
    if (_queriedIds.contains(model.id)) return;
    _queriedIds.add(model.id);
    final lookupKey = model.advertisedUuid ?? model.id;
    final reg = await _studentService.findRegNoByDeviceId(lookupKey);
    if (reg != null) {
      model.regNo = reg;
      notifyListeners();
    }
  }
}
