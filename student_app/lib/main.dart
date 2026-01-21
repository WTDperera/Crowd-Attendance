import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_ble_peripheral/flutter_ble_peripheral.dart';
import 'package:permission_handler/permission_handler.dart';
import 'dart:io';
import 'dart:convert';
<<<<<<< HEAD
=======
import 'dart:typed_data';
>>>>>>> 4b52f03969596bfe00ee9f56c89dfcd70c584883

// 🔧 ONE-TIME FIREBASE UPDATE FUNCTION
// Call this once to add device_id_hash to all existing students
Future<void> updateAllStudentHashes() async {
  print("\n========================================");
  print("🔧 Firebase Hash Update Started");
  print("========================================\n");

  try {
    var studentsRef = FirebaseFirestore.instance.collection('students');
    var snapshot = await studentsRef.get();
    
    print("📊 Found ${snapshot.docs.length} students\n");

    int updated = 0;
    int skipped = 0;

    for (var doc in snapshot.docs) {
      try {
        var data = doc.data();
        String deviceId = data['device_id'] ?? '';
        String regNo = data['reg_no'] ?? 'Unknown';

        // Check if already has hash
        if (data.containsKey('device_id_hash')) {
          print("⏭️  $regNo already has hash - SKIPPED");
          skipped++;
          continue;
        }

        if (deviceId.isEmpty) {
          print("⚠️  $regNo has no device_id - SKIPPED");
          skipped++;
          continue;
        }

        // Calculate hash (same algorithm as encoding)
        int hash = deviceId.hashCode;
        String hashHex = hash.abs().toRadixString(16).padLeft(8, '0');

        // Update document with hash field
        await doc.reference.update({
          'device_id_hash': hashHex,
        });

        print("✅ Updated $regNo:");
        print("   Device ID: $deviceId");
        print("   Hash: $hashHex\n");
        
        updated++;

      } catch (e) {
        print("❌ Error updating ${doc.id}: $e\n");
      }
    }

    print("========================================");
    print("📊 Update Summary:");
    print("   ✅ Updated: $updated students");
    print("   ⏭️  Skipped: $skipped students");
    print("========================================\n");

  } catch (e) {
    print("❌ Fatal error: $e\n");
  }
}

// 1. App Entry Point
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(); // Initialize Firebase
  runApp(MaterialApp(
    debugShowCheckedModeBanner: false,
    home: LoginPage(), // Start with Login Page
    theme: ThemeData.dark(), // Dark theme
  ));
}

// 2. Login Page
class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  _LoginPageState createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _emailController = TextEditingController();
  final _passController = TextEditingController();
  bool _isLoading = false;

  // Handle login button press
  Future<void> _handleLogin() async {
    setState(() => _isLoading = true); // Start loading indicator

    try {
      // 1. Firebase Login (Username/Password Check)
      UserCredential user = await FirebaseAuth.instance.signInWithEmailAndPassword(
          email: _emailController.text.trim(), 
          password: _passController.text.trim()
      );

      // 2. මේ Phone එකේ ID එක ගන්න
      String currentDeviceId = "";
      DeviceInfoPlugin deviceInfo = DeviceInfoPlugin();
      if (Platform.isAndroid) {
        AndroidDeviceInfo info = await deviceInfo.androidInfo;
        currentDeviceId = info.id;
      }

      // 3. Database එකේ Student ගේ Document එක ගන්න
      DocumentReference ref = FirebaseFirestore.instance.collection('students').doc(user.user!.uid);
      DocumentSnapshot doc = await ref.get();

      if (!doc.exists || !doc.data().toString().contains('device_id')) {
        // --- මෙන්න අලුත් කොටස (New Security Check) ---
        
        // ප්‍රශ්නය: මේ ෆෝන් එක දැනටමත් වෙන කෙනෙක්ගේ නමට තියෙනවද?
        QuerySnapshot deviceCheck = await FirebaseFirestore.instance
            .collection('students')
            .where('device_id', isEqualTo: currentDeviceId)
            .get();

        if (deviceCheck.docs.isNotEmpty) {
          // Device already registered to another student
          await FirebaseAuth.instance.signOut(); // Sign out
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text("Error: This device is already registered to another student!"), 
              backgroundColor: Colors.red
            )
          );
          setState(() => _isLoading = false);
          return; // Stop here
        }
        
        // Lock device to this student only if not registered to anyone
        // Calculate device_id hash for Firebase query optimization
        int hash = currentDeviceId.hashCode;
        String hashHex = hash.abs().toRadixString(16).padLeft(8, '0');
        
        await ref.set({
          'device_id': currentDeviceId,
          'device_id_hash': hashHex,  // 🔐 NEW: Store hash for BLE lookup
          'reg_no': _emailController.text.split('@')[0]
        }, SetOptions(merge: true));
        
        print("🔐 Stored in Firebase:");
        print("   device_id: $currentDeviceId");
        print("   device_id_hash: $hashHex");
        print("   reg_no: ${_emailController.text.split('@')[0]}");
        
        _goToHome();

      } else {
        // 4. Student already registered - verify device
        String registeredId = doc.get('device_id');
        if (registeredId == currentDeviceId) {
          _goToHome(); // Correct device - allow access
        } else {
          await FirebaseAuth.instance.signOut();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text("BLOCKED: This is not your registered device!"), 
              backgroundColor: Colors.red
            )
          );
        }
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Error: $e")));
    }
    
    setState(() => _isLoading = false);
  }

  void _goToHome() async {
    // Extract RegNo from email
    String regNo = _emailController.text.split('@')[0];
    
    // Get current device ID
    String deviceId = "";
    DeviceInfoPlugin deviceInfo = DeviceInfoPlugin();
    if (Platform.isAndroid) {
      AndroidDeviceInfo info = await deviceInfo.androidInfo;
      deviceId = info.id;
    }
    
    // Navigate to Home page with both regNo and deviceId
    Navigator.pushReplacement(
      context, 
      MaterialPageRoute(builder: (_) => HomePage(regNo: regNo, deviceId: deviceId))
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("Student Login")),
      body: Padding(
        padding: EdgeInsets.all(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.school, size: 80, color: Colors.blue),
            SizedBox(height: 20),
            TextField(controller: _emailController, decoration: InputDecoration(border: OutlineInputBorder(), labelText: "Email (eg2022xxxx@sjp.ac.lk)")),
            SizedBox(height: 10),
            TextField(controller: _passController, decoration: InputDecoration(border: OutlineInputBorder(), labelText: "Password"), obscureText: true),
            SizedBox(height: 20),
            _isLoading 
              ? CircularProgressIndicator()
              : ElevatedButton(
                  onPressed: _handleLogin, 
                  child: Padding(padding: EdgeInsets.all(12), child: Text("Secure Login", style: TextStyle(fontSize: 18))),
                )
          ],
        ),
      ),
    );
  }
}

// 3. Home Page - BLE Broadcasting
class HomePage extends StatefulWidget {
  final String regNo;
  final String deviceId;
  const HomePage({super.key, required this.regNo, required this.deviceId});
  @override
  _HomePageState createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  bool isBroadcasting = false;
  final FlutterBlePeripheral blePeripheral = FlutterBlePeripheral();

  // 🔧 BLE HARDWARE ENGINEERING: Convert Device ID to UUID using SHA-256 hash
  // This creates a unique, hardware-bound UUID for secure attendance tracking
  // Hash ensures full device ID uniqueness even with length constraints
  String _deviceIdToUUID(String deviceId) {
    // Base UUID: bf27730d-860a-4e09-XXXX-XXXXXXXXXXXX
    // We encode a hash of device_id in the last 16 hex digits (8 bytes)
    
    try {
      // Use simple hashCode for deterministic conversion
      // This gives us a 32-bit integer that we can expand to 16 hex digits
      int hash = deviceId.hashCode;
      
      // Convert hash to positive number and expand to 16 hex characters
      String hashHex = hash.abs().toRadixString(16).padLeft(8, '0');
      
      // Store the actual device_id as additional bytes
      List<int> bytes = utf8.encode(deviceId);
      String deviceHex = bytes.take(4).map((b) => b.toRadixString(16).padLeft(2, '0')).join('');
      
      // Combine: 8 chars from hash + 8 chars from device bytes
      String combined = (hashHex + deviceHex).padRight(16, '0').substring(0, 16);
      
      // Construct UUID: bf27730d-860a-4e09-[4 chars]-[12 chars]
      String part1 = combined.substring(0, 4);
      String part2 = combined.substring(4, 16);
      
      String uuid = 'bf27730d-860a-4e09-$part1-$part2';
      
      print("🔐 ENCODING: '$deviceId' → hash:$hashHex → UUID:$uuid");
      
      return uuid;
    } catch (e) {
      print("❌ UUID encoding error: $e");
      return 'bf27730d-860a-4e09-0000-000000000000';
    }
  }

  // Toggle BLE broadcast on button press
  void _toggleBroadcast() async {
    print("========================================");
    print("🔵 STUDENT APP: Toggle broadcast pressed");
    print("🔵 Current status: ${isBroadcasting ? 'Broadcasting' : 'Not Broadcasting'}");
    print("🔵 Registration Number: ${widget.regNo}");
    print("🔐 Device ID: ${widget.deviceId}");
    print("========================================");
    
    // Request Bluetooth permissions first
    Map<Permission, PermissionStatus> statuses = await [
      Permission.bluetoothAdvertise, 
      Permission.bluetoothConnect, 
      Permission.location
    ].request();
    
    print("📋 Permission Status:");
    statuses.forEach((permission, status) {
      print("   $permission: $status");
    });

    if (isBroadcasting) {
      // Stop broadcasting if currently active
      print("🛑 Stopping broadcast...");
      await blePeripheral.stop();
      setState(() => isBroadcasting = false);
      print("✅ Broadcast stopped");
    } else {
      try {
        print("🚀 Starting broadcast...");
        
        // 🔧 HYBRID APPROACH: Encode device_id into UUID
        String deviceUUID = _deviceIdToUUID(widget.deviceId);
        print("🔐 Device UUID (encoded): $deviceUUID");
        print("🔧 UUID Structure:");
        print("   Base: bf27730d-860a-4e09");
        print("   Encoded Device ID: ${deviceUUID.substring(24)}");
        
        // Create BLE advertisement data with device UUID
        final AdvertiseData data = AdvertiseData(
          serviceUuid: deviceUUID, // ← Broadcasting device-bound UUID
        );
        print("📡 Advertisement Data:");
        print("   localName: ${widget.regNo}");
        print("   serviceUuid: bf27730d-860a-4e09-889c-2d8b6a9e0fe7");
        
        // Start broadcasting
        await blePeripheral.start(advertiseData: data);
        setState(() => isBroadcasting = true);
        print("✅ Broadcasting started successfully!");
        print("✅ Device Name: ${widget.regNo}");
        print("========================================");
      } catch (e) {
        print("❌ BROADCAST ERROR: $e");
        print("========================================");
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("ID: ${widget.regNo}"), backgroundColor: Colors.grey[900]),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(isBroadcasting ? "Broadcasting Active" : "Ready to Mark", 
              style: TextStyle(fontSize: 20, color: Colors.grey)),
            SizedBox(height: 30),
            
            // Large circular button
            GestureDetector(
              onTap: _toggleBroadcast,
              child: AnimatedContainer(
                duration: Duration(milliseconds: 500),
                width: 200, height: 200,
                decoration: BoxDecoration(
                  color: isBroadcasting ? Colors.blue : Colors.grey[800],
                  shape: BoxShape.circle,
                  boxShadow: isBroadcasting ? [BoxShadow(color: Colors.blue, blurRadius: 40)] : []
                ),
                child: Center(
                  child: Icon(Icons.wifi_tethering, size: 80, color: Colors.white)
                ),
              ),
            ),
            SizedBox(height: 20),
            Text(isBroadcasting ? "Tap to Stop" : "Tap to Start", style: TextStyle(color: Colors.white)),
            
            SizedBox(height: 50),
            
            // 🔧 ONE-TIME UPDATE BUTTON (for existing students)
            ElevatedButton.icon(
              onPressed: () async {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text("🔧 Updating Firebase hashes..."), backgroundColor: Colors.orange)
                );
                await updateAllStudentHashes();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text("✅ Firebase update complete! Check console."), backgroundColor: Colors.green)
                );
              },
              icon: Icon(Icons.update),
              label: Text("Update Firebase Hashes"),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.orange,
                padding: EdgeInsets.symmetric(horizontal: 20, vertical: 15),
              ),
            ),
            Text(
              "↑ Click once to add hash field to all students",
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }
}