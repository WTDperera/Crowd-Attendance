import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:intl/intl.dart';

class SessionScreen extends StatefulWidget {
  const SessionScreen({super.key});

  @override
  State<SessionScreen> createState() => _SessionScreenState();
}

class _SessionScreenState extends State<SessionScreen> {
  final _classNameController = TextEditingController();
  final _durationController = TextEditingController(text: '60');
  
  bool isSessionActive = false;
  bool isScanning = false;
  int scansPerformed = 0;
  List<Map<String, dynamic>> foundStudents = [];
  Set<String> processedHashesInCurrentScan = {};
  String? currentSessionId;
  DateTime? sessionStartTime;

  String _uuidToDeviceId(String uuid) {
    try {
      String lowerUuid = uuid.toLowerCase();
      String noDashes = lowerUuid.replaceAll('-', '');
      if (noDashes.length < 32) return '';
      
      String encodedHex = noDashes.substring(16, 32);
      String hashHex = encodedHex.substring(0, 8);
      
      return hashHex;
    } catch (e) {
      return '';
    }
  }

  Future<void> _startSession() async {
    if (_classNameController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter class name')),
      );
      return;
    }

    User? user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    // Create session in Firebase
    var sessionDoc = await FirebaseFirestore.instance
        .collection('attendance_sessions')
        .add({
      'lecturer_id': user.uid,
      'class_name': _classNameController.text,
      'duration_minutes': int.tryParse(_durationController.text) ?? 60,
      'created_at': FieldValue.serverTimestamp(),
      'start_time': FieldValue.serverTimestamp(),
      'status': 'Active Session',
      'student_count': 0,
      'scans_performed': 0,
    });

    setState(() {
      currentSessionId = sessionDoc.id;
      isSessionActive = true;
      isScanning = false;
      scansPerformed = 0;
      foundStudents.clear();
      processedHashesInCurrentScan.clear();
      sessionStartTime = DateTime.now();
    });
  }

  Future<void> _startScanning() async {
    // Request permissions
    await [
      Permission.bluetoothScan,
      Permission.bluetoothConnect,
      Permission.location
    ].request();

    setState(() {
      isScanning = true;
      processedHashesInCurrentScan.clear();
    });

    // Start BLE scan for a short window if they don't stop it manually
    await FlutterBluePlus.startScan(
      timeout: const Duration(minutes: 5), // Auto stop after 5 mins just in case
    );

    // Listen to scan results
    FlutterBluePlus.scanResults.listen((results) {
      for (ScanResult r in results) {
        for (var guidObj in r.advertisementData.serviceUuids) {
          String uuid = guidObj.toString();
          
          if (uuid.toLowerCase().startsWith('bf27730d-860a-4e09')) {
            String hashHex = _uuidToDeviceId(uuid);
            
            if (hashHex.isNotEmpty && !processedHashesInCurrentScan.contains(hashHex)) {
              processedHashesInCurrentScan.add(hashHex);
              _verifyAndRecordAttendance(hashHex, r.rssi);
            }
          }
        }
      }
    });
  }

  Future<void> _stopScanning() async {
    await FlutterBluePlus.stopScan();
    
    setState(() {
      isScanning = false;
      scansPerformed++;
    });

    if (currentSessionId != null) {
      await FirebaseFirestore.instance
          .collection('attendance_sessions')
          .doc(currentSessionId)
          .update({
        'scans_performed': FieldValue.increment(1),
      });
    }
  }

  Future<void> _verifyAndRecordAttendance(String hashHex, int rssi) async {
    try {
      var query = await FirebaseFirestore.instance
          .collection('students')
          .where('device_id_hash', isEqualTo: hashHex)
          .get();

      if (query.docs.isNotEmpty && currentSessionId != null) {
        var studentDoc = query.docs.first;
        String regNo = studentDoc.get('reg_no');
        String studentId = studentDoc.id;
        String actualDeviceId = studentDoc.get('device_id');

        var recordQuery = await FirebaseFirestore.instance
            .collection('attendance_records')
            .where('session_id', isEqualTo: currentSessionId)
            .where('student_id', isEqualTo: studentId)
            .get();

        if (recordQuery.docs.isNotEmpty) {
          // Update existing record
          await FirebaseFirestore.instance
              .collection('attendance_records')
              .doc(recordQuery.docs.first.id)
              .update({
            'scan_count': FieldValue.increment(1),
            'marked_at': FieldValue.serverTimestamp(),
            'rssi': rssi,
          });
        } else {
          // Create new record
          await FirebaseFirestore.instance
              .collection('attendance_records')
              .add({
            'session_id': currentSessionId,
            'student_id': studentId,
            'reg_no': regNo,
            'device_id': actualDeviceId,
            'device_id_hash': hashHex,
            'rssi': rssi,
            'marked_at': FieldValue.serverTimestamp(),
            'status': 'pending', // Will be finalized on end session
            'scan_count': 1,
          });

          // Update session count only on first detection
          await FirebaseFirestore.instance
              .collection('attendance_sessions')
              .doc(currentSessionId)
              .update({
            'student_count': FieldValue.increment(1),
          });
        }

        setState(() {
          int existingIndex = foundStudents.indexWhere((s) => s['reg_no'] == regNo);
          if (existingIndex >= 0) {
            foundStudents[existingIndex]['time'] = DateFormat('hh:mm a').format(DateTime.now());
            foundStudents[existingIndex]['scan_count'] = (foundStudents[existingIndex]['scan_count'] ?? 1) + 1;
          } else {
            foundStudents.add({
              'reg_no': regNo,
              'device_id': actualDeviceId,
              'rssi': rssi,
              'time': DateFormat('hh:mm a').format(DateTime.now()),
              'verified': true,
              'scan_count': 1,
            });
          }
        });
      } else {
        setState(() {
          int existingIndex = foundStudents.indexWhere((s) => s['device_id'] == 'Hash: $hashHex');
          if (existingIndex < 0) {
            foundStudents.add({
              'reg_no': 'Unknown',
              'device_id': 'Hash: $hashHex',
              'rssi': rssi,
              'time': DateFormat('hh:mm a').format(DateTime.now()),
              'verified': false,
              'scan_count': 1,
            });
          }
        });
      }
    } catch (e) {
      print("Error recording attendance: $e");
    }
  }

  Future<void> _endSession() async {
    if (isScanning) {
      await _stopScanning();
    }
    
    if (currentSessionId != null) {
      int requiredScans = scansPerformed > 0 ? scansPerformed : 1;
      
      // Finalize student statuses
      var recordsQuery = await FirebaseFirestore.instance
          .collection('attendance_records')
          .where('session_id', isEqualTo: currentSessionId)
          .get();
          
      var batch = FirebaseFirestore.instance.batch();
      for (var doc in recordsQuery.docs) {
        int studentScanCount = doc.data().containsKey('scan_count') ? doc.get('scan_count') : 1;
        String finalStatus = studentScanCount >= requiredScans ? 'present' : 'left_early';
        batch.update(doc.reference, {'status': finalStatus});
      }
      await batch.commit();

      await FirebaseFirestore.instance
          .collection('attendance_sessions')
          .doc(currentSessionId)
          .update({
        'end_time': FieldValue.serverTimestamp(),
        'status': 'Completed',
      });
    }

    setState(() {
      isSessionActive = false;
      isScanning = false;
      currentSessionId = null;
      sessionStartTime = null;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Session completed! ${foundStudents.length} students recorded'),
        backgroundColor: Colors.green,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        title: Text(
          isSessionActive ? (isScanning ? 'Scanning...' : 'Session Active') : 'Start Session',
          style: const TextStyle(color: Colors.white),
        ),
        actions: [
          Stack(
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined, color: Colors.white),
                onPressed: () {},
              ),
              Positioned(
                right: 8,
                top: 8,
                child: Container(
                  width: 10,
                  height: 10,
                  decoration: const BoxDecoration(
                    color: Colors.red,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (!isSessionActive) ...[
              const Text(
                'Start Attendance Session',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Start a new session to record student attendance via Bluetooth',
                style: TextStyle(color: Colors.grey[600], fontSize: 14),
              ),
              const SizedBox(height: 24),
              
              // Class Name Input
              const Text(
                'Select Class',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _classNameController,
                decoration: InputDecoration(
                  hintText: 'e.g., CS101: Introduction to Programming',
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide.none,
                  ),
                  suffixIcon: const Icon(Icons.arrow_drop_down),
                ),
              ),
              const SizedBox(height: 20),
              
              // Duration Input
              const Text(
                'Session Duration (minutes)',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _durationController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              
              // Info Badges
              Row(
                children: [
                  _buildInfoBadge(Icons.access_time, 'Auto-close after duration', Colors.blue),
                  const SizedBox(width: 12),
                  _buildInfoBadge(Icons.location_on, 'Location verified', Colors.green),
                ],
              ),
              const SizedBox(height: 20),
              
              // Warning
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange[50],
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.orange[200]!),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, color: Colors.orange[700]),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Make sure Bluetooth is enabled on your device and you are within range of the classroom.',
                        style: TextStyle(color: Colors.orange[900], fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              
              // Bluetooth Icon
              Center(
                child: Container(
                  width: 150,
                  height: 150,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.blue[50],
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Container(
                        width: 100,
                        height: 100,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.blue[100],
                        ),
                      ),
                      Icon(
                        Icons.bluetooth,
                        size: 60,
                        color: Colors.blue[700],
                      ),
                      if (foundStudents.isNotEmpty)
                        Positioned(
                          top: 10,
                          right: 10,
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: const BoxDecoration(
                              color: Colors.green,
                              shape: BoxShape.circle,
                            ),
                            child: Text(
                              '${foundStudents.length}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              
              Center(
                child: Text(
                  'Tap the button below to start scanning for student\ndevices in your proximity',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey[700], fontSize: 14),
                ),
              ),
            ] else ...[
              // Scanning UI
              const Text(
                'Session Active',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Class: ${_classNameController.text}',
                style: TextStyle(color: Colors.grey[600], fontSize: 14),
              ),
              const SizedBox(height: 20),
              
              // Stats Row
              Row(
                children: [
                  Expanded(
                    child: _buildScanStatCard(
                      'Students Found',
                      '${foundStudents.where((s) => s['verified']).length}',
                      Colors.green,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildScanStatCard(
                      'Scans Done',
                      '$scansPerformed',
                      Colors.blue,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              
              // Scan Controls
              if (isScanning)
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton.icon(
                    onPressed: _stopScanning,
                    icon: const Icon(Icons.stop_circle_outlined, color: Colors.white),
                    label: const Text(
                      'Stop Current Scan',
                      style: TextStyle(fontSize: 16, color: Colors.white),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.orange,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                )
              else
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton.icon(
                    onPressed: _startScanning,
                    icon: const Icon(Icons.radar, color: Colors.white),
                    label: const Text(
                      'Start New Scan',
                      style: TextStyle(fontSize: 16, color: Colors.white),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.blue,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
              const SizedBox(height: 24),
              
              // Student List
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Detected Students',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.green[50],
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            '${foundStudents.length} found',
                            style: TextStyle(
                              color: Colors.green[700],
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    if (foundStudents.isEmpty)
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.all(20),
                          child: Column(
                            children: [
                              CircularProgressIndicator(),
                              SizedBox(height: 12),
                              Text('Scanning for students...'),
                            ],
                          ),
                        ),
                      )
                    else
                      ListView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: foundStudents.length,
                        itemBuilder: (context, index) {
                          var student = foundStudents[index];
                          return _buildStudentTile(student);
                        },
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              
              // Stop Button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: _endSession,
                  icon: const Icon(Icons.stop, color: Colors.white),
                  label: const Text(
                    'End Session',
                    style: TextStyle(fontSize: 16, color: Colors.white),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
      bottomNavigationBar: !isSessionActive
          ? Padding(
              padding: const EdgeInsets.all(20),
              child: SizedBox(
                height: 50,
                child: ElevatedButton(
                  onPressed: _startSession,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2196F3),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: const Text(
                    'Start Session',
                    style: TextStyle(fontSize: 16, color: Colors.white),
                  ),
                ),
              ),
            )
          : null,
    );
  }

  Widget _buildInfoBadge(IconData icon, String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 6),
          Text(
            text,
            style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }

  Widget _buildScanStatCard(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border(top: BorderSide(color: color, width: 3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(color: Colors.grey[600], fontSize: 14),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStudentTile(Map<String, dynamic> student) {
    bool verified = student['verified'] ?? false;
    
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: verified ? Colors.green[50] : Colors.orange[50],
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: verified ? Colors.green[200]! : Colors.orange[200]!,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: verified ? Colors.green : Colors.orange,
              shape: BoxShape.circle,
            ),
            child: Icon(
              verified ? Icons.check : Icons.warning_outlined,
              color: Colors.white,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  student['reg_no'] ?? 'Unknown',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                Row(
                  children: [
                    Text(
                      student['time'] ?? '',
                      style: TextStyle(color: Colors.grey[600], fontSize: 12),
                    ),
                    const SizedBox(width: 8),
                    if (student['scan_count'] != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.blue[50],
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'Scans: ${student['scan_count']}',
                          style: TextStyle(color: Colors.blue[700], fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
          Icon(
            verified ? Icons.verified : Icons.help_outline,
            color: verified ? Colors.green : Colors.orange,
          ),
        ],
      ),
    );
  }
}
