import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'firebase_options.dart';
import 'screens/login_screen.dart';
import 'screens/main_shell.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const AdminApp());
}

class AdminApp extends StatelessWidget {
  const AdminApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BLE Attendance Admin',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF00BCD4),
          brightness: Brightness.light,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF0A0E21),
          foregroundColor: Colors.white,
          elevation: 0,
        ),
        navigationRailTheme: const NavigationRailThemeData(
          backgroundColor: Color(0xFF0A0E21),
          selectedIconTheme: IconThemeData(color: Color(0xFF00BCD4)),
          unselectedIconTheme: IconThemeData(color: Colors.white54),
          selectedLabelTextStyle: TextStyle(color: Color(0xFF00BCD4)),
          unselectedLabelTextStyle: TextStyle(color: Colors.white54),
          indicatorColor: Color(0xFF1D1E33),
        ),
        cardTheme: CardThemeData(
          elevation: 2,
          surfaceTintColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            backgroundColor: Color(0xFF0A0E21),
            body: Center(
              child: CircularProgressIndicator(color: Color(0xFF00BCD4)),
            ),
          );
        }
        if (snapshot.hasData && snapshot.data != null) {
          return const MainShell();
        }
        return const LoginScreen();
      },
    );
  }
}
