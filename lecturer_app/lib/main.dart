import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'dart:convert';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  runApp(MaterialApp(
    debugShowCheckedModeBanner: false,
    home: LecturerScanner(),
    theme: ThemeData.dark(),
  ));
}

class LecturerScanner extends StatefulWidget {
  const LecturerScanner({super.key});

  @override
  _LecturerScannerState createState() => _LecturerScannerState();
}

class _LecturerScannerState extends State<LecturerScanner> {
  bool isScanning = false;
  List<Map<String, dynamic>> foundStudents = []; // List of found students during scan
  Set<String> processedHashes = {}; // Track which hashes we've already queried
  
  // 🔧 BLE HARDWARE ENGINEERING: Decode UUID back to Device ID
  String _uuidToDeviceId(String uuid) {
    try {
      // Extract encoded part from: bf27730d-860a-4e09-XXXX-XXXXXXXXXXXX
      String lowerUuid = uuid.toLowerCase();
      
      // Remove dashes and get the last 16 hex characters
      String noDashes = lowerUuid.replaceAll('-', '');
      // UUID format: bf27730d860a4e09 + [16 chars: 8 hash + 8 device bytes]
      if (noDashes.length < 32) return '';
      
      String encodedHex = noDashes.substring(16, 32);
      
      // Extract hash portion (first 8 hex chars)
      String hashHex = encodedHex.substring(0, 8);
      
      // Extract device bytes portion (next 8 hex chars)
      String deviceHex = encodedHex.substring(8, 16);
      
      // Convert device hex to bytes to get partial device_id (for debug)
      List<int> bytes = [];
      for (int i = 0; i < deviceHex.length && i < 8; i += 2) {
        String hexByte = deviceHex.substring(i, i + 2);
        if (hexByte == '00') break;
        int byteValue = int.parse(hexByte, radix: 16);
        if (byteValue == 0) break;
        bytes.add(byteValue);
      }
      
      String partialDeviceId = bytes.isNotEmpty ? utf8.decode(bytes, allowMalformed: true) : '';
      
      print("🔓 DECODING: UUID:$uuid");
      print("   📦 Hash hex: $hashHex");
      print("   📦 Device hex: $deviceHex");
      print("   📦 Partial device_id: '$partialDeviceId'");
      print("   ⚠️  Will query Firebase by hash");
      
      // Return the hash hex for Firebase lookup
      return hashHex;
      
    } catch (e) {
      print("❌ UUID decode error: $e");
      return '';
    }
  }

  // Start classroom attendance scan
  void _startClassScan() async {
    // 1. Request Bluetooth permissions
    await [
      Permission.bluetoothScan,
      Permission.bluetoothConnect,
      Permission.location
    ].request();
    
    print("========================================");
    print("🔵 LECTURER APP: Starting scan...");
    print("========================================");

    setState(() {
      isScanning = true;
      foundStudents.clear(); // Clear previous list
      processedHashes.clear(); // Clear processed hashes
    });

    // 2. Start BLE scan (15 seconds timeout)
    await FlutterBluePlus.startScan(timeout: Duration(seconds: 15));
    print("✅ Scan started for 15 seconds...");

    // 3. Check each discovered device
    FlutterBluePlus.scanResults.listen((results) {
      print("📡 Scan Results - Total Devices: ${results.length}");
      
      for (ScanResult r in results) {
        print("---");
        print("🔍 Device Found:");
        print("   Remote ID: ${r.device.remoteId}");
        print("   RSSI: ${r.rssi} dBm");
        print("   Service UUIDs: ${r.advertisementData.serviceUuids}");
        
        // 🔧 HYBRID APPROACH: Check for our custom UUID format
        for (var guidObj in r.advertisementData.serviceUuids) {
          String uuid = guidObj.toString();
          print("   🔎 Analyzing UUID: $uuid");
          
          // Check if UUID starts with our base: bf27730d-860a-4e09
          if (uuid.toLowerCase().startsWith('bf27730d-860a-4e09')) {
            print("   ✅ MATCHES Student App UUID format!");
            
            // Decode hash from UUID
            String hashHex = _uuidToDeviceId(uuid);
            print("   🔓 Decoded Hash: '$hashHex'");
            
            if (hashHex.isNotEmpty && !processedHashes.contains(hashHex)) {
              processedHashes.add(hashHex);
              print("   🔄 Querying Firebase by hash...");
              _verifyWithFirebase(hashHex, r.rssi);
              
            } else if (hashHex.isEmpty) {
              print("   ❌ Failed to decode hash from UUID");
            } else {
              print("   ⚠️ Device already in list (ignored)");
            }
          } else {
            print("   ⚠️ Not a student app UUID (ignored)");
          }
        }
      }
    });

    // Scan automatically stops after 15 seconds
    Future.delayed(Duration(seconds: 15), () {
      setState(() => isScanning = false);
      print("🛑 Scan stopped after 15 seconds");
      print("📊 Total students found: ${foundStudents.length}");
      print("========================================");
    });
  }

  // Stop scanning manually
  void _stopClassScan() async {
    await FlutterBluePlus.stopScan();
    setState(() => isScanning = false);
  }

  // Check if student exists in Firebase database by device_id hash
  Future<void> _verifyWithFirebase(String hashHex, int rssi) async {
    try {
      print("🔎 Querying Firebase for device_id_hash: '$hashHex'");
      
      // 🔧 HYBRID APPROACH: Query by device_id_hash (hardware-bound)
      var query = await FirebaseFirestore.instance
          .collection('students')
          .where('device_id_hash', isEqualTo: hashHex)
          .get();
      
      print("📊 Firebase Query Results: ${query.docs.length} documents found");

      if (query.docs.isNotEmpty) {
        // Found! Get the student's registration number and device_id from document
        var doc = query.docs.first;
        String regNo = doc.get('reg_no');
        String actualDeviceId = doc.get('device_id');
        print("✅ VERIFIED: Hash belongs to device '$actualDeviceId' → student '$regNo'!");
        print("🔐 Hash: $hashHex");
        print("🔐 Device ID: $actualDeviceId");
        print("🎓 Registration: $regNo");
        
        setState(() {
          foundStudents.add({
            'id': regNo,  // Display registration number
            'device_id': actualDeviceId,  // Store full device_id for reference
            'rssi': rssi,
            'status': 'Verified ✅',
            'color': Colors.green
          });
        });
      } else {
        // Not Found! Check if it's because device_id_hash field is missing
        print("⚠️  IMPORTANT: No student found with hash '$hashHex'");
        print("⚠️  This usually means:");
        print("   1. Student hasn't registered with this device");
        print("   2. Firebase 'device_id_hash' field is missing (run update script!)");
        
        setState(() {
          foundStudents.add({
            'id': 'Unknown (Hash: ${hashHex.substring(0, 4)}...)',
            'device_id': 'Not in database',
            'rssi': rssi,
            'status': 'Unregistered ❌',
            'color': Colors.orange
          });
        });
      }
    } catch (e) {
      print("❌ Firebase query error: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("Lecturer Scanner")),
      body: Column(
        children: [
          // Top Status Bar
          Container(
            padding: EdgeInsets.all(20),
            color: Colors.grey[900],
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Total Found", style: TextStyle(color: Colors.grey)),
                    Text("${foundStudents.length}", style: TextStyle(fontSize: 30, fontWeight: FontWeight.bold, color: Colors.blue)),
                  ],
                ),
                Row(
                  children: [
                    ElevatedButton.icon(
                      onPressed: isScanning ? null : _startClassScan,
                      icon: isScanning 
                          ? SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) 
                          : Icon(Icons.radar),
                      label: Text(isScanning ? "Scanning..." : "Start Scan"),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isScanning ? Colors.grey : Colors.green,
                        padding: EdgeInsets.symmetric(horizontal: 20, vertical: 15)
                      ),
                    ),
                    if (isScanning) ...[
                      SizedBox(width: 10),
                      ElevatedButton.icon(
                        onPressed: _stopClassScan,
                        icon: Icon(Icons.stop),
                        label: Text("Stop"),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.red,
                          padding: EdgeInsets.symmetric(horizontal: 20, vertical: 15)
                        ),
                      ),
                    ]
                  ],
                )
              ],
            ),
          ),
          
          // Student List
          Expanded(
            child: ListView.builder(
              itemCount: foundStudents.length,
              itemBuilder: (context, index) {
                var student = foundStudents[index];
                return Card(
                  margin: EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: student['color'].withOpacity(0.2),
                      child: Icon(Icons.person, color: student['color']),
                    ),
                    title: Text(student['id'], style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                    subtitle: Text("Signal Strength: ${student['rssi']} dBm"),
                    trailing: Chip(
                      label: Text(student['status']),
                      backgroundColor: student['color'],
                      labelStyle: TextStyle(color: Colors.white),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
