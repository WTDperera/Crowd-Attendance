import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_ble_peripheral/flutter_ble_peripheral.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'dart:io' show Platform;
import 'dart:convert' show utf8;
import 'dart:typed_data' show Uint8List;

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
  
  runApp(const StudentApp());
}

// ============================================================================
// APP ROOT
// ============================================================================

class StudentApp extends StatelessWidget {
  const StudentApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Student Attendance',
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
          behavior: SnackBarBehavior.fixed,
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
// AUTH WRAPPER - Route to Login or Broadcast screen
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
          return BroadcastScreen(user: snapshot.data!);
        }
        
        return const LoginScreen();
      },
    );
  }
}

// ============================================================================
// LOGIN SCREEN - Admin-created accounts only
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
      // Step 1: Authenticate with Firebase Auth
      final userCredential = await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text.trim(),
      );

      final uid = userCredential.user!.uid;
      final currentDeviceId = await _getDeviceId();

      // Step 2: Check Firestore for device binding
      final studentRef = FirebaseFirestore.instance.collection('students').doc(uid);
      final studentDoc = await studentRef.get();

      if (!studentDoc.exists) {
        await FirebaseAuth.instance.signOut();
        throw Exception('Student record not found. Contact administrator.');
      }

      final data = studentDoc.data()!;
      final storedDeviceId = data['device_id'];

      // Step 3: Device Binding Logic
      if (storedDeviceId == null || storedDeviceId.isEmpty) {
        // First login - bind this device
        await studentRef.update({
          'device_id': currentDeviceId,
          'device_locked_at': FieldValue.serverTimestamp(),
        });
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('✅ Device successfully bound to your account'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } else if (storedDeviceId != currentDeviceId) {
        // Device mismatch - BLOCK LOGIN
        await FirebaseAuth.instance.signOut();
        throw Exception(
          'Unauthorized Device\n\nThis account is locked to another device. '
          'Contact your administrator to reset device binding.'
        );
      }

      // Update last login timestamp
      await studentRef.update({
        'last_login': FieldValue.serverTimestamp(),
      });

      // Login successful - AuthWrapper will handle navigation
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
                      Icons.account_circle,
                      size: 80,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 32),
                  
                  // Title
                  Text(
                    'Student Login',
                    style: Theme.of(context).textTheme.headlineLarge,
                  ),
                  const SizedBox(height: 8),
                  
                  // Subtitle
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
                  
                  // Email Field
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    enabled: !_isLoading,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      labelText: 'Email Address',
                      prefixIcon: Icon(Icons.email_outlined, color: Color(0xFF00BCD4)),
                      hintText: 'eg123456@sjp.ac.lk',
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
                  
                  // Password Field
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
                  
                  // Login Button
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
                  
                  // Info Text
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
// BROADCAST SCREEN - BLE Broadcasting with animation
// ============================================================================

class BroadcastScreen extends StatefulWidget {
  final User user;
  
  const BroadcastScreen({Key? key, required this.user}) : super(key: key);

  @override
  State<BroadcastScreen> createState() => _BroadcastScreenState();
}

class _BroadcastScreenState extends State<BroadcastScreen> 
    with SingleTickerProviderStateMixin {
  final FlutterBlePeripheral _blePeripheral = FlutterBlePeripheral();
  bool _isBroadcasting = false;
  String? _regNo;
  String? _studentName;
  late AnimationController _pulseController;

  static const String SERVICE_UUID = 'bf27730d-860a-4e09-8f3c-7a2b5d9e4f1c';

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
    _loadStudentData();
  }

  Future<void> _loadStudentData() async {
    try {
      final doc = await FirebaseFirestore.instance
          .collection('students')
          .doc(widget.user.uid)
          .get();
      
      if (doc.exists) {
        setState(() {
          _regNo = doc.data()?['reg_no'];
          _studentName = doc.data()?['email']?.split('@')[0];
        });
      }
    } catch (e) {
      print('Error loading student data: $e');
    }
  }

  Future<bool> _requestPermissions() async {
    try {
      final permissions = [
        Permission.bluetoothAdvertise,
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

  Future<void> _toggleBroadcast() async {
    if (_regNo == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Student data not loaded. Please restart the app.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    try {
      if (!_isBroadcasting) {
        // Request permissions
        final hasPermissions = await _requestPermissions();
        if (!hasPermissions) return;

        print("========================================");
        print("🔵 STUDENT APP: Starting Broadcast");
        print("📋 RegNo: $_regNo");
        print("🔐 Service UUID: $SERVICE_UUID");
        print("========================================");

        // Configure BLE advertising with manufacturer data
        final regNoBytes = utf8.encode(_regNo!);
        final manufacturerData = Uint8List.fromList(regNoBytes);
        
        print("🔒 Encoding RegNo as manufacturer data:");
        print("   Original: $_regNo");
        print("   Company ID: 0xFFFF (Unreserved)");
        print("   Data Bytes: ${regNoBytes.length} bytes");
        print("   Full Packet: ${manufacturerData.length} bytes (manufacturerId provided separately)");
        
        final advertiseData = AdvertiseData(
          serviceUuid: SERVICE_UUID,
          localName: "SJP", // Short name to save packet space
          manufacturerId: 0xFFFF,
          manufacturerData: manufacturerData,
        );

        final advertiseSettings = AdvertiseSettings(
          advertiseMode: AdvertiseMode.advertiseModeBalanced,
          txPowerLevel: AdvertiseTxPower.advertiseTxPowerHigh,
          connectable: false,
          timeout: 0,
        );

        // Start advertising with manufacturer data
        await _blePeripheral.start(
          advertiseData: advertiseData,
          advertiseSettings: advertiseSettings,
        );

        setState(() => _isBroadcasting = true);

        print("✅ Broadcasting Active!");
        print("✅ Local Name: SJP");
        print("✅ Manufacturer Data: Company 0xFFFF with ${regNoBytes.length} bytes");
        print("========================================");

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('✅ Broadcasting started'),
              backgroundColor: Colors.green,
              duration: Duration(seconds: 2),
            ),
          );
        }
      } else {
        // Stop broadcasting
        await _blePeripheral.stop();
        setState(() => _isBroadcasting = false);

        print("🔴 Broadcasting Stopped");
        print("========================================");

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Broadcasting stopped'),
              duration: Duration(seconds: 2),
            ),
          );
        }
      }
    } catch (e) {
      print('❌ Broadcast error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1D1E33),
        elevation: 0,
        title: const Text('Student Broadcaster'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Logout',
            onPressed: () async {
              if (_isBroadcasting) {
                await _blePeripheral.stop();
              }
              await FirebaseAuth.instance.signOut();
            },
          ),
        ],
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Animated Broadcast Button
              GestureDetector(
                onTap: _toggleBroadcast,
                child: AnimatedBuilder(
                  animation: _pulseController,
                  builder: (context, child) {
                    return Transform.scale(
                      scale: _isBroadcasting
                          ? 1.0 + (_pulseController.value * 0.05)
                          : 1.0,
                      child: Container(
                        width: 200,
                        height: 200,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LinearGradient(
                            colors: _isBroadcasting
                                ? [
                                    const Color(0xFF00BCD4),
                                    const Color(0xFF00ACC1),
                                  ]
                                : [
                                    const Color(0xFF1D1E33),
                                    const Color(0xFF2D2E43),
                                  ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          boxShadow: _isBroadcasting
                              ? [
                                  BoxShadow(
                                    color: const Color(0xFF00BCD4).withOpacity(0.5),
                                    blurRadius: 40,
                                    spreadRadius: 10,
                                  ),
                                ]
                              : [],
                        ),
                        child: Icon(
                          _isBroadcasting
                              ? Icons.bluetooth_searching
                              : Icons.bluetooth_disabled,
                          size: 80,
                          color: _isBroadcasting ? Colors.white : Colors.white54,
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 48),
              
              // Registration Number
              if (_regNo != null)
                Text(
                  _regNo!.toUpperCase(),
                  style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                    letterSpacing: 2,
                  ),
                ),
              const SizedBox(height: 12),
              
              // Status Text
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                decoration: BoxDecoration(
                  color: _isBroadcasting
                      ? const Color(0xFF00BCD4).withOpacity(0.2)
                      : const Color(0xFF1D1E33),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: _isBroadcasting
                        ? const Color(0xFF00BCD4)
                        : Colors.white24,
                    width: 2,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _isBroadcasting ? Colors.green : Colors.red,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      _isBroadcasting ? 'BROADCASTING' : 'IDLE',
                      style: TextStyle(
                        color: _isBroadcasting
                            ? const Color(0xFF00BCD4)
                            : Colors.white54,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 48),
              
              // Control Button
              SizedBox(
                width: double.infinity,
                height: 60,
                child: ElevatedButton.icon(
                  onPressed: _toggleBroadcast,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _isBroadcasting
                        ? Colors.red
                        : const Color(0xFF00BCD4),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(30),
                    ),
                  ),
                  icon: Icon(
                    _isBroadcasting ? Icons.stop : Icons.play_arrow,
                    size: 28,
                  ),
                  label: Text(
                    _isBroadcasting ? 'STOP BROADCASTING' : 'START BROADCASTING',
                    style: const TextStyle(fontSize: 16),
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
                    _buildInfoRow(Icons.bluetooth, 'Broadcasting via Bluetooth'),
                    _buildInfoRow(Icons.security, 'Service UUID: $SERVICE_UUID'),
                    _buildInfoRow(Icons.radar, 'Range: ~10-30 meters'),
                    _buildInfoRow(Icons.person, 'Attendance auto-marked when detected'),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, color: Colors.white54, size: 20),
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

  @override
  void dispose() {
    _pulseController.dispose();
    _blePeripheral.stop();
    super.dispose();
  }
}
