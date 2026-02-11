import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'dart:io' show Platform;
import 'dart:convert' show utf8;

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ),
  );
  
  runApp(const LecturerApp());
}

// ============================================================================
// APP ROOT
// ============================================================================

class LecturerApp extends StatelessWidget {
  const LecturerApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Lecturer Attendance',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        primaryColor: const Color(0xFF00BCD4),
        scaffoldBackgroundColor: const Color(0xFF0A0E21),
        colorScheme: ColorScheme.dark(
          primary: const Color(0xFF00BCD4),
          secondary: const Color(0xFF00BCD4),
          surface: const Color(0xFF1D1E33),
          background: const Color(0xFF0A0E21),
        ),
        cardTheme: CardThemeData(
          color: const Color(0xFF1D1E33),
          elevation: 4,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF00BCD4),
            foregroundColor: Colors.black,
            elevation: 0,
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            textStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.2,
            ),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF1D1E33),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF00BCD4), width: 2),
          ),
          labelStyle: const TextStyle(color: Colors.white70),
          hintStyle: const TextStyle(color: Colors.white38),
        ),
        textTheme: const TextTheme(
          headlineLarge: TextStyle(
            color: Colors.white,
            fontSize: 32,
            fontWeight: FontWeight.bold,
          ),
          headlineMedium: TextStyle(
            color: Colors.white,
            fontSize: 24,
            fontWeight: FontWeight.w600,
          ),
          bodyLarge: TextStyle(color: Colors.white, fontSize: 16),
          bodyMedium: TextStyle(color: Colors.white70, fontSize: 14),
        ),
        snackBarTheme: SnackBarThemeData(
          backgroundColor: const Color(0xFF1D1E33),
          contentTextStyle: const TextStyle(color: Colors.white),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      home: const AuthWrapper(),
    );
  }
}

// ============================================================================
// AUTH WRAPPER
// ============================================================================

class AuthWrapper extends StatelessWidget {
  const AuthWrapper({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            backgroundColor: Color(0xFF0A0E21),
            body: Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF00BCD4)),
              ),
            ),
          );
        }
        
        if (snapshot.hasData && snapshot.data != null) {
          return DashboardScreen(user: snapshot.data!);
        }
        
        return const LoginScreen();
      },
    );
  }
}

// ============================================================================
// LOGIN SCREEN
// ============================================================================

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;

  Future<String> _getDeviceId() async {
    try {
      final deviceInfo = DeviceInfoPlugin();
      if (Platform.isAndroid) {
        final androidInfo = await deviceInfo.androidInfo;
        return androidInfo.id;
      } else if (Platform.isIOS) {
        final iosInfo = await deviceInfo.iosInfo;
        return iosInfo.identifierForVendor ?? 'unknown';
      }
    } catch (e) {
      print('❌ Error getting device ID: $e');
    }
    return 'unknown';
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      // Step 1: Authenticate
      final userCredential = await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text.trim(),
      );

      final uid = userCredential.user!.uid;
      final currentDeviceId = await _getDeviceId();

      // Step 2: Check device binding
      final lecturerRef = FirebaseFirestore.instance.collection('lecturers').doc(uid);
      final lecturerDoc = await lecturerRef.get();

      if (!lecturerDoc.exists) {
        await FirebaseAuth.instance.signOut();
        throw Exception('Lecturer record not found. Contact administrator.');
      }

      final data = lecturerDoc.data()!;
      final storedDeviceId = data['device_id'];

      // Step 3: Device binding logic
      if (storedDeviceId == null || storedDeviceId.isEmpty) {
        // First login - bind device
        await lecturerRef.update({
          'device_id': currentDeviceId,
          'device_locked_at': FieldValue.serverTimestamp(),
        });
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('✅ Device successfully bound'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } else if (storedDeviceId != currentDeviceId) {
        // Device mismatch - BLOCK
        await FirebaseAuth.instance.signOut();
        throw Exception(
          'Unauthorized Device\n\nThis account is locked to another device.'
        );
      }

      // Update last login
      await lecturerRef.update({
        'last_login': FieldValue.serverTimestamp(),
      });

    } on FirebaseAuthException catch (e) {
      String message = 'Login failed';
      switch (e.code) {
        case 'user-not-found':
          message = 'No account found with this email';
          break;
        case 'wrong-password':
          message = 'Incorrect password';
          break;
        case 'invalid-email':
          message = 'Invalid email format';
          break;
        case 'user-disabled':
          message = 'This account has been disabled';
          break;
        default:
          message = 'Authentication error: ${e.message}';
      }
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(message), backgroundColor: Colors.red),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 5),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // App Icon
                  Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: [
                          const Color(0xFF00BCD4),
                          const Color(0xFF00BCD4).withOpacity(0.5),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                    child: const Icon(
                      Icons.school,
                      size: 80,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 32),
                  
                  Text(
                    'Lecturer Login',
                    style: Theme.of(context).textTheme.headlineLarge,
                  ),
                  const SizedBox(height: 8),
                  
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1D1E33),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.lock_outline,
                          color: Color(0xFF00BCD4),
                          size: 16,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Device-locked access only',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 48),
                  
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    enabled: !_isLoading,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      labelText: 'Email Address',
                      prefixIcon: Icon(Icons.email_outlined, color: Color(0xFF00BCD4)),
                      hintText: 'lecturer@sjp.ac.lk',
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Email is required';
                      }
                      if (!value.contains('@')) {
                        return 'Enter a valid email';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 20),
                  
                  TextFormField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    enabled: !_isLoading,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: 'Password',
                      prefixIcon: const Icon(Icons.lock_outline, color: Color(0xFF00BCD4)),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword ? Icons.visibility_off : Icons.visibility,
                          color: Colors.white54,
                        ),
                        onPressed: () {
                          setState(() => _obscurePassword = !_obscurePassword);
                        },
                      ),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Password is required';
                      }
                      return null;
                    },
                    onFieldSubmitted: (_) => _handleLogin(),
                  ),
                  const SizedBox(height: 40),
                  
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _handleLogin,
                      child: _isLoading
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(Colors.black),
                              ),
                            )
                          : const Text('LOGIN'),
                    ),
                  ),
                  const SizedBox(height: 24),
                  
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1D1E33).withOpacity(0.5),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: const Color(0xFF00BCD4).withOpacity(0.3),
                      ),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.info_outline,
                          color: Color(0xFF00BCD4),
                          size: 20,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Accounts are admin-created only.\nContact your institution for credentials.',
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
}

// ============================================================================
// DASHBOARD SCREEN - Session Management
// ============================================================================

class DashboardScreen extends StatefulWidget {
  final User user;
  
  const DashboardScreen({Key? key, required this.user}) : super(key: key);

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  String? _lecturerName;

  @override
  void initState() {
    super.initState();
    _loadLecturerData();
  }

  Future<void> _loadLecturerData() async {
    try {
      final doc = await FirebaseFirestore.instance
          .collection('lecturers')
          .doc(widget.user.uid)
          .get();
      
      if (doc.exists) {
        setState(() {
          _lecturerName = doc.data()?['name'] ?? widget.user.email?.split('@')[0];
        });
      }
    } catch (e) {
      print('Error loading lecturer data: $e');
    }
  }

  Future<void> _createSession() async {
    final moduleController = TextEditingController();
    final topicController = TextEditingController();

    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1D1E33),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: const Text('Create New Session'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: moduleController,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                labelText: 'Module Code',
                hintText: 'e.g., SE3021',
                prefixIcon: Icon(Icons.book, color: Color(0xFF00BCD4)),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: topicController,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                labelText: 'Session Topic',
                hintText: 'e.g., OOP Concepts',
                prefixIcon: Icon(Icons.topic, color: Color(0xFF00BCD4)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('CANCEL'),
          ),
          ElevatedButton(
            onPressed: () {
              if (moduleController.text.isNotEmpty && 
                  topicController.text.isNotEmpty) {
                Navigator.pop(context, true);
              }
            },
            child: const Text('START SESSION'),
          ),
        ],
      ),
    );

    if (result == true && moduleController.text.isNotEmpty) {
      try {
        // Create session in Firestore
        final sessionRef = await FirebaseFirestore.instance
            .collection('active_sessions')
            .add({
          'lecturer_id': widget.user.uid,
          'module': moduleController.text.trim(),
          'topic': topicController.text.trim(),
          'created_at': FieldValue.serverTimestamp(),
          'status': 'active',
        });

        if (mounted) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => ScannerScreen(
                sessionId: sessionRef.id,
                module: moduleController.text.trim(),
                topic: topicController.text.trim(),
              ),
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Error creating session: $e'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1D1E33),
        elevation: 0,
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Logout',
            onPressed: () async {
              await FirebaseAuth.instance.signOut();
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Welcome Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      const Color(0xFF00BCD4),
                      const Color(0xFF00ACC1),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Welcome back,',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _lecturerName ?? 'Lecturer',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              
              // Create Session Button
              SizedBox(
                width: double.infinity,
                height: 120,
                child: ElevatedButton(
                  onPressed: _createSession,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1D1E33),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: const BorderSide(
                        color: Color(0xFF00BCD4),
                        width: 2,
                      ),
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.add_circle_outline,
                        size: 48,
                        color: Color(0xFF00BCD4),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'CREATE NEW SESSION',
                        style: TextStyle(
                          color: const Color(0xFF00BCD4),
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 32),
              
              // Info Card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFF1D1E33),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.info_outline, color: Color(0xFF00BCD4)),
                        const SizedBox(width: 12),
                        Text(
                          'How it works',
                          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            fontSize: 18,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _buildInfoRow('1', 'Create a new session with module code and topic'),
                    _buildInfoRow('2', 'Scan for nearby students broadcasting'),
                    _buildInfoRow('3', 'System auto-verifies students in database'),
                    _buildInfoRow('4', 'Attendance marked in real-time'),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(String number, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: Color(0xFF00BCD4),
            ),
            child: Center(
              child: Text(
                number,
                style: const TextStyle(
                  color: Colors.black,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// SCANNER SCREEN - Real-time BLE Scanner with UUID filtering
// ============================================================================

class ScannerScreen extends StatefulWidget {
  final String sessionId;
  final String module;
  final String topic;
  
  const ScannerScreen({
    Key? key,
    required this.sessionId,
    required this.module,
    required this.topic,
  }) : super(key: key);

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  bool _isScanning = false;
  final Map<String, StudentAttendance> _detectedStudents = {};
  int _devicesFound = 0;
  
  static const String SERVICE_UUID = 'bf27730d-860a-4e09-8f3c-7a2b5d9e4f1c';

  @override
  void initState() {
    super.initState();
    _startScanning();
  }

  Future<bool> _requestPermissions() async {
    try {
      final permissions = [
        Permission.bluetoothScan,
        Permission.bluetoothConnect,
        Permission.location,
      ];

      for (var permission in permissions) {
        final status = await permission.request();
        if (!status.isGranted) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Permission denied: ${permission.toString().split('.').last}'),
                backgroundColor: Colors.red,
              ),
            );
          }
          return false;
        }
      }
      return true;
    } catch (e) {
      print('❌ Permission error: $e');
      return false;
    }
  }

  Future<void> _startScanning() async {
    final hasPermissions = await _requestPermissions();
    if (!hasPermissions) return;

    final isSupported = await FlutterBluePlus.isSupported;
    if (!isSupported) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Bluetooth not supported on this device'),
            backgroundColor: Colors.red,
          ),
        );
      }
      return;
    }

    if (FlutterBluePlus.adapterStateNow != BluetoothAdapterState.on) {
      try {
        await FlutterBluePlus.turnOn();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Please turn on Bluetooth to start scanning'),
              backgroundColor: Colors.red,
            ),
          );
        }
        return;
      }
    }

    setState(() => _isScanning = true);

    print("========================================");
    print("🔵 LECTURER APP: Starting BLE Scan");
    print("🎯 Target Service UUID: $SERVICE_UUID");
    print("========================================");

    try {
      // Start scan with UUID filter
      await FlutterBluePlus.startScan(
        withServices: [Guid(SERVICE_UUID)],
        timeout: const Duration(minutes: 30),
        androidUsesFineLocation: true,
      );

      // Listen to scan results
      FlutterBluePlus.scanResults.listen((results) {
        for (ScanResult result in results) {
          _processScanResult(result);
        }
      });
    } catch (e) {
      print('❌ Scan error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Scan error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _processScanResult(ScanResult result) async {
    _devicesFound++;
    
    final deviceName = result.device.platformName;
    final deviceId = result.device.remoteId.toString();
    
    print("\n========================================");
    print("📱 DEVICE DETECTED #$_devicesFound");
    print("========================================");
    print("📋 Device Info:");
    print("   Name: $deviceName");
    print("   ID: $deviceId");
    print("   RSSI: ${result.rssi} dBm");
    print("📡 Advertised Services:");
    for (var uuid in result.advertisementData.serviceUuids) {
      print("   - $uuid");
    }

    // Extract registration number from manufacturer data (SECURE METHOD)
    // flutter_blue_plus returns Map<int, List<int>> where key is company ID
    final advertisementData = result.advertisementData;
    final Map<int, List<int>> manufacturerDataMap = advertisementData.manufacturerData;
    
    print("🔒 Checking manufacturer data...");
    print("   Available Company IDs: ${manufacturerDataMap.keys.toList()}");
    
    if (!manufacturerDataMap.containsKey(0xFFFF)) {
      print("⚠️  Device missing manufacturer data with Company ID 0xFFFF - SKIPPED");
      print("   This device is not broadcasting with secure method");
      print("========================================\n");
      return;
    }
    
    // Get manufacturer data for company ID 0xFFFF
    // Note: flutter_blue_plus automatically parses the company ID from the packet
    // The data here is ONLY the payload bytes (company ID already stripped)
    final List<int> regNoBytesList = manufacturerDataMap[0xFFFF]!;
    
    print("📦 Manufacturer Data Found:");
    print("   Company ID: 0xFFFF (Unreserved)");
    print("   Data Length: ${regNoBytesList.length} bytes");
    print("   Raw Bytes: $regNoBytesList");
    
    String regNo;
    try {
      regNo = utf8.decode(regNoBytesList).trim();
      print("✅ Decoded RegNo: $regNo");
    } catch (e) {
      print("❌ Failed to decode manufacturer data: $e");
      print("========================================\n");
      return;
    }
    
    print("🎓 Processing Student:");
    print("   RegNo: $regNo");

    // Check if already processed in this session
    if (_detectedStudents.containsKey(regNo)) {
      print("⏭️  Student already marked - SKIPPED");
      print("========================================\n");
      return;
    }

    // Validate RegNo format
    final regNoLower = regNo.toLowerCase();
    if (!regNoLower.startsWith('eg') || regNo.length < 5) {
      print("❌ Invalid RegNo format - SKIPPED");
      print("========================================\n");
      return;
    }

    try {
      // Query Firestore to verify student
      print("🔍 Querying Firebase for student: $regNo");
      
      final studentQuery = await FirebaseFirestore.instance
          .collection('students')
          .where('reg_no', isEqualTo: regNo)
          .limit(1)
          .get();

      if (studentQuery.docs.isEmpty) {
        print("❌ Student not found in database");
        print("========================================\n");
        
        setState(() {
          _detectedStudents[regNo] = StudentAttendance(
            regNo: regNo,
            studentId: 'unknown',
            rssi: result.rssi,
            timestamp: DateTime.now(),
            isVerified: false,
          );
        });
        return;
      }

      final studentDoc = studentQuery.docs.first;
      final studentId = studentDoc.id;
      
      print("✅ Student verified in Firebase:");
      print("   Name: ${studentDoc.data()['email']}");
      print("   Student ID: $studentId");

      // Mark attendance in Firestore
      print("💾 Marking attendance...");
      
      await FirebaseFirestore.instance
          .collection('active_sessions')
          .doc(widget.sessionId)
          .collection('attendance')
          .doc(regNo)
          .set({
        'student_id': studentId,
        'reg_no': regNo,
        'timestamp': FieldValue.serverTimestamp(),
        'rssi': result.rssi,
        'status': 'present',
      });

      print("✅ Attendance marked successfully!");
      print("========================================\n");

      setState(() {
        _detectedStudents[regNo] = StudentAttendance(
          regNo: regNo,
          studentId: studentId,
          rssi: result.rssi,
          timestamp: DateTime.now(),
          isVerified: true,
        );
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('✅ ${regNo.toUpperCase()} marked present'),
            backgroundColor: Colors.green,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      print("❌ Error processing student: $e");
      print("========================================\n");
    }
  }

  void _stopScanning() {
    FlutterBluePlus.stopScan();
    setState(() => _isScanning = false);
    print("🔴 Scan stopped");
  }

  Future<void> _endSession() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1D1E33),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: const Text('End Session?'),
        content: const Text('This will mark the session as completed.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('CANCEL'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('END SESSION'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      _stopScanning();
      
      // Update session status
      await FirebaseFirestore.instance
          .collection('active_sessions')
          .doc(widget.sessionId)
          .update({
        'status': 'completed',
        'completed_at': FieldValue.serverTimestamp(),
        'total_students': _detectedStudents.length,
      });

      if (mounted) {
        Navigator.pop(context);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1D1E33),
        elevation: 0,
        title: const Text('Live Scanner'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Session Info Card
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    const Color(0xFF00BCD4),
                    const Color(0xFF00ACC1),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.module,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    widget.topic,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _isScanning ? Colors.green : Colors.red,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _isScanning ? 'Scanning Active' : 'Scan Stopped',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        '${_detectedStudents.length} Present',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            
            // Student List
            Expanded(
              child: _detectedStudents.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            _isScanning
                                ? Icons.bluetooth_searching
                                : Icons.bluetooth_disabled,
                            size: 80,
                            color: Colors.white24,
                          ),
                          const SizedBox(height: 16),
                          Text(
                            _isScanning
                                ? 'Scanning for students...'
                                : 'Scan stopped',
                            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                              color: Colors.white54,
                            ),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: _detectedStudents.length,
                      itemBuilder: (context, index) {
                        final student = _detectedStudents.values.elementAt(index);
                        return _buildStudentCard(student);
                      },
                    ),
            ),
            
            // Control Buttons
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Color(0xFF1D1E33),
                border: Border(
                  top: BorderSide(
                    color: Colors.white12,
                    width: 1,
                  ),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _isScanning ? _stopScanning : _startScanning,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _isScanning
                            ? Colors.orange
                            : const Color(0xFF00BCD4),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      icon: Icon(_isScanning ? Icons.pause : Icons.play_arrow),
                      label: Text(_isScanning ? 'PAUSE SCAN' : 'RESUME SCAN'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _endSession,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      icon: const Icon(Icons.stop),
                      label: const Text('END SESSION'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStudentCard(StudentAttendance student) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1D1E33),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: student.isVerified
              ? const Color(0xFF00BCD4)
              : Colors.red,
          width: 2,
        ),
      ),
      child: Row(
        children: [
          Icon(
            student.isVerified ? Icons.check_circle : Icons.error,
            color: student.isVerified ? Colors.green : Colors.red,
            size: 32,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  student.regNo.toUpperCase(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  student.isVerified
                      ? 'Verified • ${_formatTime(student.timestamp)}'
                      : 'Unknown Device',
                  style: TextStyle(
                    color: student.isVerified ? Colors.white70 : Colors.red,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.black26,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '${student.rssi} dBm',
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime time) {
    return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    _stopScanning();
    super.dispose();
  }
}

// ============================================================================
// DATA MODEL
// ============================================================================

class StudentAttendance {
  final String regNo;
  final String studentId;
  final int rssi;
  final DateTime timestamp;
  final bool isVerified;

  StudentAttendance({
    required this.regNo,
    required this.studentId,
    required this.rssi,
    required this.timestamp,
    required this.isVerified,
  });
}
