import 'package:lecturer_app/services/firebase_environment.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'dart:io' show Platform;
import 'package:intl/intl.dart';

import 'services/session_service.dart';
import 'services/scanner_bindings.dart';
import 'services/module_service.dart';
import 'models/module.dart';
import 'screens/scanner_screen.dart' as scanner;

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeAppFirebase();

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
      stream: appAuth.authStateChanges(),
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
      final userCredential = await appAuth
          .signInWithEmailAndPassword(
            email: _emailController.text.trim(),
            password: _passwordController.text.trim(),
          );

      final uid = userCredential.user!.uid;
      final currentDeviceId = await _getDeviceId();

      // Step 2: Check device binding
      final lecturerRef = appFirestore
          .collection('lecturers')
          .doc(uid);
      final lecturerDoc = await lecturerRef.get();

      if (!lecturerDoc.exists) {
        await appAuth.signOut();
        throw Exception('Lecturer record not found. Contact administrator.');
      }

      final data = lecturerDoc.data()!;
      final storedDeviceId = data['device_id']?.toString().trim();

      // Step 3: Device binding logic
      if (storedDeviceId == null || storedDeviceId.isEmpty) {
        // First login - bind device
        await lecturerRef.set({
          'device_id': currentDeviceId,
          'device_locked_at': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('✅ Device successfully bound'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } else if (storedDeviceId != currentDeviceId.trim()) {
        // Device mismatch - BLOCK
        await appAuth.signOut();
        throw Exception(
          'Unauthorized Device\n\nThis account is locked to another device.',
        );
      }

      // Update last login
      await lecturerRef.update({'last_login': FieldValue.serverTimestamp()});
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
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
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
                      prefixIcon: Icon(
                        Icons.email_outlined,
                        color: Color(0xFF00BCD4),
                      ),
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
                      prefixIcon: const Icon(
                        Icons.lock_outline,
                        color: Color(0xFF00BCD4),
                      ),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_off
                              : Icons.visibility,
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
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  Colors.black,
                                ),
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
                            style: Theme.of(
                              context,
                            ).textTheme.bodyMedium?.copyWith(fontSize: 12),
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
  String? _selectedModuleFilter;

  @override
  void initState() {
    super.initState();
    _loadLecturerData();
  }

  Future<void> _loadLecturerData() async {
    try {
      final doc = await appFirestore
          .collection('lecturers')
          .doc(widget.user.uid)
          .get();

      if (doc.exists) {
        setState(() {
          _lecturerName =
              doc.data()?['name'] ?? widget.user.email?.split('@')[0];
        });
      }
    } catch (e) {
      print('Error loading lecturer data: $e');
    }
  }

  Future<void> _createSession() async {
    final formKey = GlobalKey<FormState>();
    final topicController = TextEditingController();
    final moduleService = ModuleService();
    String? selectedModuleId;
    Module? selectedModule;

    TimeOfDay startTime = TimeOfDay.now();
    TimeOfDay endTime = TimeOfDay(
      hour: (TimeOfDay.now().hour + 2) % 24,
      minute: TimeOfDay.now().minute,
    );

    String calculateDurationText(TimeOfDay start, TimeOfDay end) {
      int diffMinutes = (end.hour * 60 + end.minute) - (start.hour * 60 + start.minute);
      if (diffMinutes < 0) diffMinutes += 24 * 60;
      final hrs = diffMinutes ~/ 60;
      final mins = diffMinutes % 60;
      if (hrs > 0 && mins > 0) return '${hrs}h ${mins}m';
      if (hrs > 0) return '$hrs hr${hrs > 1 ? "s" : ""}';
      return '$mins mins';
    }

    try {
      final result = await showDialog<bool>(
        context: context,
        builder: (context) => StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1D1E33),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              title: const Text('Create New Session'),
              content: Form(
                key: formKey,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      StreamBuilder<List<Module>>(
                        stream: moduleService.watchModulesForLecturer(
                          widget.user.uid,
                        ),
                        builder: (context, snapshot) {
                          if (snapshot.connectionState ==
                              ConnectionState.waiting) {
                            return const Padding(
                              padding: EdgeInsets.symmetric(vertical: 12),
                              child: CircularProgressIndicator(),
                            );
                          }

                          if (snapshot.hasError) {
                            return Text(
                              snapshot.error.toString(),
                              style: const TextStyle(color: Colors.redAccent),
                            );
                          }

                          final modules = snapshot.data ?? const <Module>[];
                          if (modules.isEmpty) {
                            return const Text(
                              'No modules available.',
                              style: TextStyle(color: Colors.white70),
                            );
                          }

                          final stillExists =
                              selectedModuleId != null &&
                              modules.any((m) => m.id == selectedModuleId);
                          if (!stillExists && selectedModuleId != null) {
                            WidgetsBinding.instance.addPostFrameCallback((_) {
                              setDialogState(() {
                                selectedModuleId = null;
                                selectedModule = null;
                              });
                            });
                          }

                          return DropdownButtonFormField<String>(
                            key: ValueKey<String?>(selectedModuleId),
                            initialValue: selectedModuleId,
                            dropdownColor: const Color(0xFF1D1E33),
                            iconEnabledColor: const Color(0xFF00BCD4),
                            style: const TextStyle(color: Colors.white),
                            decoration: const InputDecoration(
                              labelText: 'Module',
                              hintText: 'Select module',
                              prefixIcon: Icon(
                                Icons.book,
                                color: Color(0xFF00BCD4),
                              ),
                            ),
                            items: modules
                                .map(
                                  (m) => DropdownMenuItem<String>(
                                    value: m.id,
                                    child: Text(
                                      '${m.code} — ${m.name}',
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                )
                                .toList(growable: false),
                            onChanged: (value) {
                              setDialogState(() {
                                selectedModuleId = value;
                                selectedModule = value == null
                                    ? null
                                    : modules.firstWhere((m) => m.id == value);
                              });
                            },
                            validator: (value) {
                              if (value == null || value.isEmpty) {
                                return 'Select module';
                              }
                              return null;
                            },
                          );
                        },
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: topicController,
                        style: const TextStyle(color: Colors.white),
                        decoration: const InputDecoration(
                          labelText: 'Session Topic',
                          hintText: 'e.g., OOP Concepts',
                          prefixIcon: Icon(Icons.topic, color: Color(0xFF00BCD4)),
                        ),
                        validator: (value) {
                          if (value == null || value.trim().isEmpty) {
                            return 'Enter session topic';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: InkWell(
                              onTap: () async {
                                final picked = await showTimePicker(
                                  context: context,
                                  initialTime: startTime,
                                );
                                if (picked != null) {
                                  setDialogState(() {
                                    startTime = picked;
                                    final sMin = startTime.hour * 60 + startTime.minute;
                                    final eMin = endTime.hour * 60 + endTime.minute;
                                    if (eMin <= sMin) {
                                      endTime = TimeOfDay(
                                        hour: (startTime.hour + 2) % 24,
                                        minute: startTime.minute,
                                      );
                                    }
                                  });
                                }
                              },
                              child: InputDecorator(
                                decoration: const InputDecoration(
                                  labelText: 'Start Time',
                                  prefixIcon: Icon(Icons.access_time, color: Color(0xFF00BCD4)),
                                ),
                                child: Text(
                                  startTime.format(context),
                                  style: const TextStyle(color: Colors.white, fontSize: 13),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: InkWell(
                              onTap: () async {
                                final picked = await showTimePicker(
                                  context: context,
                                  initialTime: endTime,
                                );
                                if (picked != null) {
                                  setDialogState(() {
                                    endTime = picked;
                                  });
                                }
                              },
                              child: InputDecorator(
                                decoration: const InputDecoration(
                                  labelText: 'End Time',
                                  prefixIcon: Icon(Icons.timer_outlined, color: Color(0xFF00BCD4)),
                                ),
                                child: Text(
                                  endTime.format(context),
                                  style: const TextStyle(color: Colors.white, fontSize: 13),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF00BCD4).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFF00BCD4).withOpacity(0.3)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.timelapse, size: 14, color: Color(0xFF00BCD4)),
                            const SizedBox(width: 6),
                            Text(
                              'Duration: ${calculateDurationText(startTime, endTime)}',
                              style: const TextStyle(
                                color: Color(0xFF00BCD4),
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('CANCEL'),
                ),
                ElevatedButton(
                  onPressed: () {
                    if (formKey.currentState?.validate() ?? false) {
                      Navigator.pop(context, true);
                    }
                  },
                  child: const Text('START SESSION'),
                ),
              ],
            );
          },
        ),
      );

      if (result == true && selectedModule != null) {
        final moduleCode = selectedModule!.code.trim().toUpperCase();
        final sessionTopic = topicController.text.trim();

        final now = DateTime.now();
        final startDateTime = DateTime(now.year, now.month, now.day, startTime.hour, startTime.minute);
        var endDateTime = DateTime(now.year, now.month, now.day, endTime.hour, endTime.minute);
        if (endDateTime.isBefore(startDateTime)) {
          endDateTime = endDateTime.add(const Duration(days: 1));
        }
        // Use the same fixed-roster creation as the durable scanner services.
        final sessionId = await SessionService().createSession(
          moduleCode: moduleCode,
          moduleId: selectedModule!.id,
          sessionTopic: sessionTopic,
          startTime: startDateTime,
          endTime: endDateTime,
        );

        if (mounted) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => ScannerScreen(
                sessionId: sessionId,
                module: moduleCode,
                topic: sessionTopic,
              ),
            ),
          );
        }
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
    } finally {
      topicController.dispose();
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
              await appAuth.signOut();
            },
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
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
                    colors: [const Color(0xFF00BCD4), const Color(0xFF00ACC1)],
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
                      style: TextStyle(color: Colors.white70, fontSize: 16),
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

              _buildModuleFilter(),
              const SizedBox(height: 32),

              _buildActiveSessionsList(),
              const SizedBox(height: 32),

              _buildCompletedSessionsList(),
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
                        const Icon(
                          Icons.info_outline,
                          color: Color(0xFF00BCD4),
                        ),
                        const SizedBox(width: 12),
                        Text(
                          'How it works',
                          style: Theme.of(
                            context,
                          ).textTheme.headlineMedium?.copyWith(fontSize: 18),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _buildInfoRow(
                      '1',
                      'Create a new session with module, topic & class duration',
                    ),
                    _buildInfoRow(
                      '2',
                      'Announce & scan for nearby students broadcasting',
                    ),
                    _buildInfoRow(
                      '3',
                      'System auto-verifies students in database',
                    ),
                    _buildInfoRow(
                      '4',
                      'Attendance & session duration recorded in real-time',
                    ),
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
            child: Text(text, style: Theme.of(context).textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }

  Widget _buildModuleFilter() {
    return StreamBuilder<List<Module>>(
      stream: ModuleService().watchModulesForLecturer(widget.user.uid),
      builder: (context, snapshot) {
        if (!snapshot.hasData || snapshot.data!.isEmpty) return const SizedBox.shrink();
        
        final modules = snapshot.data!;
        
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Filter by Module', style: TextStyle(color: Colors.white54, fontSize: 14)),
            const SizedBox(height: 8),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  FilterChip(
                    label: const Text('All'),
                    selected: _selectedModuleFilter == null,
                    onSelected: (selected) {
                      setState(() => _selectedModuleFilter = null);
                    },
                    selectedColor: const Color(0xFF00BCD4),
                    checkmarkColor: Colors.white,
                    labelStyle: TextStyle(color: _selectedModuleFilter == null ? Colors.white : Colors.white70),
                    backgroundColor: const Color(0xFF1D1E33),
                  ),
                  const SizedBox(width: 8),
                  ...modules.map((m) => Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: Text(m.code),
                      selected: _selectedModuleFilter == m.code,
                      onSelected: (selected) {
                        setState(() => _selectedModuleFilter = selected ? m.code : null);
                      },
                      selectedColor: const Color(0xFF00BCD4),
                      checkmarkColor: Colors.white,
                      labelStyle: TextStyle(color: _selectedModuleFilter == m.code ? Colors.white : Colors.white70),
                      backgroundColor: const Color(0xFF1D1E33),
                    ),
                  )).toList(),
                ],
              ),
            ),
          ],
        );
      }
    );
  }

  Widget _buildActiveSessionsList() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.play_circle_fill, color: Colors.greenAccent),
            const SizedBox(width: 8),
            Text(
              'Active Sessions',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 18),
            ),
          ],
        ),
        const SizedBox(height: 16),
        StreamBuilder<QuerySnapshot>(
          stream: SessionService().getActiveSessionsStream(widget.user.uid),
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              return Text('Error: ${snapshot.error}', style: const TextStyle(color: Colors.red));
            }
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }

            var docs = snapshot.data?.docs ?? [];
            if (_selectedModuleFilter != null) {
              docs = docs.where((doc) {
                final data = doc.data() as Map<String, dynamic>;
                final code = data['module_code'] ?? data['module'] ?? '';
                return code == _selectedModuleFilter;
              }).toList();
            }

            if (docs.isEmpty) {
              return Text(
                _selectedModuleFilter != null 
                  ? 'No active sessions for $_selectedModuleFilter.'
                  : 'No active sessions. Create one to start!', 
                style: const TextStyle(color: Colors.white54)
              );
            }

            return ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: docs.length,
              itemBuilder: (context, index) {
                final data = docs[index].data() as Map<String, dynamic>;
                final sessionId = docs[index].id;
                final moduleCode = data['module_code'] ?? data['module'] ?? 'Unknown Module';
                final topic = data['session_topic'] ?? data['topic'] ?? '';

                String? durationStr = data['duration_formatted'];
                if (durationStr == null && data['start_time'] != null && data['end_time'] != null) {
                  final s = (data['start_time'] as Timestamp).toDate();
                  final e = (data['end_time'] as Timestamp).toDate();
                  durationStr = SessionService.formatDurationString(s, e);
                }

                return Card(
                  color: const Color(0xFF1D1E33),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: const BorderSide(color: Color(0xFF00BCD4), width: 1),
                  ),
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    title: Text(moduleCode, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (topic.isNotEmpty)
                          Text(topic, style: const TextStyle(color: Colors.white70)),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(Icons.access_time, size: 12, color: Color(0xFF00BCD4)),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                durationStr ?? 'Active Session',
                                style: const TextStyle(color: Color(0xFF00BCD4), fontSize: 11, fontWeight: FontWeight.w500),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    trailing: const Icon(Icons.arrow_forward_ios, color: Color(0xFF00BCD4), size: 16),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => ScannerScreen(
                            sessionId: sessionId,
                            module: moduleCode,
                            topic: topic,
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
            );
          },
        ),
      ],
    );
  }

  Widget _buildCompletedSessionsList() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.history, color: Colors.white54),
            const SizedBox(width: 8),
            Text(
              'Past Sessions',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 18),
            ),
          ],
        ),
        const SizedBox(height: 16),
        StreamBuilder<QuerySnapshot>(
          stream: SessionService().getCompletedSessionsStream(widget.user.uid),
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              return Text('Error: ${snapshot.error}', style: const TextStyle(color: Colors.red));
            }
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }

            var docs = snapshot.data?.docs ?? [];
            if (_selectedModuleFilter != null) {
              docs = docs.where((doc) {
                final data = doc.data() as Map<String, dynamic>;
                final code = data['module_code'] ?? data['module'] ?? '';
                return code == _selectedModuleFilter;
              }).toList();
            }

            if (docs.isEmpty) {
              return Text(
                _selectedModuleFilter != null
                  ? 'No past sessions for $_selectedModuleFilter yet.'
                  : 'No past sessions yet.', 
                style: const TextStyle(color: Colors.white54)
              );
            }

            final displayDocs = docs.take(2).toList();

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: displayDocs.length,
                  itemBuilder: (context, index) {
                    final data = displayDocs[index].data() as Map<String, dynamic>;
                    return PastSessionCard(data: data);
                  },
                ),
                if (docs.length > 2)
                  Center(
                    child: TextButton(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => PastSessionsScreen(
                              lecturerId: widget.user.uid,
                              moduleFilter: _selectedModuleFilter,
                            ),
                          ),
                        );
                      },
                      child: const Text('VIEW ALL PAST SESSIONS', style: TextStyle(color: Colors.cyan, fontWeight: FontWeight.bold)),
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}

// ============================================================================
// PAST SESSIONS WIDGETS
// ============================================================================

class PastSessionCard extends StatelessWidget {
  final Map<String, dynamic> data;

  const PastSessionCard({Key? key, required this.data}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final moduleCode = data['module_code'] ?? data['module'] ?? 'Unknown Module';
    final topic = data['session_topic'] ?? data['topic'] ?? '';
    final studentCount = ((data['student_count'] ?? 0) as num).toInt().clamp(0, 1 << 30);
    
    DateTime? date;
    DateTime? startTime;
    DateTime? endTime;
    
    if (data['created_at'] != null) date = (data['created_at'] as Timestamp).toDate();
    if (data['start_time'] != null) {
      startTime = (data['start_time'] as Timestamp).toDate();
    } else if (data['started_at'] != null) {
      startTime = (data['started_at'] as Timestamp).toDate();
    }
    if (data['end_time'] != null) {
      endTime = (data['end_time'] as Timestamp).toDate();
    } else if (data['ended_at'] != null) {
      endTime = (data['ended_at'] as Timestamp).toDate();
    }
    
    String dateString = date != null ? DateFormat('MMM dd, yyyy').format(date) : 'Unknown Date';
    String durationDisplay;
    if (data['duration_formatted'] != null) {
      durationDisplay = data['duration_formatted'];
    } else if (startTime != null && endTime != null) {
      durationDisplay = SessionService.formatDurationString(startTime, endTime);
    } else {
      String startTimeString = startTime != null ? DateFormat('hh:mm a').format(startTime) : '--';
      String endTimeString = endTime != null ? DateFormat('hh:mm a').format(endTime) : '--';
      durationDisplay = '$startTimeString - $endTimeString';
    }

    return Card(
      color: const Color(0xFF1D1E33),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(moduleCode, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (topic.isNotEmpty) ...[
              Text(topic, style: const TextStyle(color: Colors.white70)),
              const SizedBox(height: 8),
            ] else ...[
              const SizedBox(height: 4),
            ],
            Row(
              children: [
                const Icon(Icons.calendar_today, size: 12, color: Colors.white54),
                const SizedBox(width: 4),
                Text(dateString, style: const TextStyle(color: Colors.white54, fontSize: 11)),
                const SizedBox(width: 12),
                const Icon(Icons.access_time, size: 12, color: Colors.white54),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    durationDisplay,
                    style: const TextStyle(color: Colors.white54, fontSize: 11),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ),
        trailing: Text('$studentCount students', style: const TextStyle(color: Colors.white70)),
        isThreeLine: true,
      ),
    );
  }
}

class PastSessionsScreen extends StatelessWidget {
  final String lecturerId;
  final String? moduleFilter;
  const PastSessionsScreen({Key? key, required this.lecturerId, this.moduleFilter}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('All Past Sessions'),
        backgroundColor: const Color(0xFF1D1E33),
        elevation: 0,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: StreamBuilder<QuerySnapshot>(
            stream: SessionService().getCompletedSessionsStream(lecturerId),
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return Center(child: Text('Error: ${snapshot.error}', style: const TextStyle(color: Colors.red)));
              }
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              
              final docs = snapshot.data?.docs ?? [];
              var filteredDocs = docs;
              if (moduleFilter != null) {
                filteredDocs = filteredDocs.where((d) {
                  final data = d.data() as Map<String, dynamic>;
                  final code = data['module_code'] ?? data['module'] ?? '';
                  return code == moduleFilter;
                }).toList();
              }
              
              if (filteredDocs.isEmpty) {
                return Center(
                  child: Text(
                    moduleFilter != null ? 'No past sessions for $moduleFilter.' : 'No past sessions.', 
                    style: const TextStyle(color: Colors.white54)
                  )
                );
              }
              
              return ListView.builder(
                itemCount: filteredDocs.length,
                itemBuilder: (context, index) {
                  final data = filteredDocs[index].data() as Map<String, dynamic>;
                  return PastSessionCard(data: data);
                },
              );
            },
          ),
        ),
      ),
    );
  }
}

// ============================================================================
// SCANNER SCREEN - Real-time BLE Scanner with UUID filtering
// ============================================================================

// Both dashboard routes use the same durable scanner implementation.
class ScannerScreen extends StatelessWidget {
  const ScannerScreen({super.key, required this.sessionId, required this.module, required this.topic});
  final String sessionId, module, topic;
  @override
  Widget build(BuildContext context) => scanner.ScannerScreen(
    sessionId: sessionId,
    bindings: ScannerBindingsScope.maybeOf(context)?.forSession(sessionId),
  );
}

class StudentAttendance {
  final String regNo;
  final String studentId;
  final int rssi;
  final DateTime timestamp;
  final bool isVerified;
  int scan_count;

  StudentAttendance({
    required this.regNo,
    required this.studentId,
    required this.rssi,
    required this.timestamp,
    required this.isVerified,
    this.scan_count = 1,
  });
}
