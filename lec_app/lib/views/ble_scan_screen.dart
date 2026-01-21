import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../viewmodels/ble_view_model.dart';
import '../models/ble_device.dart';

class LecturerScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final vm = Provider.of<LecturerViewModel>(context);

    return Scaffold(
      appBar: AppBar(title: Text("Lecturer Scanner")),
      body: Column(
        children: [
          ElevatedButton(
            onPressed: vm.startScan,
            child: Text("Start Scan"),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: vm.devices.length,
              itemBuilder: (context, index) {
                final d = vm.devices[index];
                return ListTile(
                  title: Text(d.name.isEmpty ? "Unknown Device" : d.name),
                  subtitle: Text(_buildSubtitle(d)),
                );
              },
            ),
          )
        ],
      ),
    );
  }

  String _buildSubtitle(DeviceModel d) {
    final uuidLine = d.advertisedUuid == null ? null : "UUID: ${d.advertisedUuid}";
    final idLine = "ID: ${d.id}";
    final regLine = d.regNo == null ? null : "Reg No: ${d.regNo}";
    return [uuidLine, idLine, regLine].where((e) => e != null).join("\n");
  }
}
