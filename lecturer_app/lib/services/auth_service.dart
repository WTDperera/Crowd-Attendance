import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'device_service.dart';

class AuthService {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final DeviceService _deviceService = DeviceService();

  User? get currentUser => _auth.currentUser;
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  /// Login with device verification
  Future<Map<String, dynamic>> loginWithEmailPassword({
    required String email,
    required String password,
  }) async {
    try {
      // Step 1: Sign in with Firebase Auth
      final userCredential = await _auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );

      final user = userCredential.user;
      if (user == null) {
        throw Exception('Login failed: No user returned');
      }

      // Step 2: Get current device ID
      final currentDeviceId = await _deviceService.getDeviceId();
      final deviceModel = await _deviceService.getDeviceModel();

      // Step 3: Check lecturer document in Firestore
      final lecturerDoc = await _firestore
          .collection('lecturers')
          .doc(user.uid)
          .get();

      if (!lecturerDoc.exists) {
        // Lecturer doesn't exist in database
        await _auth.signOut();
        throw Exception('Account not found. Please contact admin.');
      }

      final lecturerData = lecturerDoc.data()!;
      final storedDeviceId = lecturerData['device_id'] as String?;

      // Step 4: Device verification logic
      if (storedDeviceId == null || storedDeviceId.isEmpty) {
        // First-time login: Store device ID
        await _firestore.collection('lecturers').doc(user.uid).update({
          'device_id': currentDeviceId,
          'device_model': deviceModel,
          'device_locked_at': FieldValue.serverTimestamp(),
          'last_login': FieldValue.serverTimestamp(),
        });

        return {
          'success': true,
          'message': 'Device locked successfully',
          'isFirstLogin': true,
        };
      } else {
        // Subsequent login: Verify device ID
        if (storedDeviceId != currentDeviceId) {
          // SECURITY VIOLATION: Different device
          await _auth.signOut();
          throw Exception(
            'Unauthorized Device\n\nThis account is locked to another device. Contact admin if you need to change devices.',
          );
        }

        // Device matches: Update last login
        await _firestore.collection('lecturers').doc(user.uid).update({
          'last_login': FieldValue.serverTimestamp(),
        });

        return {
          'success': true,
          'message': 'Login successful',
          'isFirstLogin': false,
        };
      }
    } on FirebaseAuthException catch (e) {
      switch (e.code) {
        case 'user-not-found':
          throw Exception('No account found with this email');
        case 'wrong-password':
          throw Exception('Incorrect password');
        case 'invalid-email':
          throw Exception('Invalid email format');
        case 'user-disabled':
          throw Exception('This account has been disabled');
        case 'too-many-requests':
          throw Exception('Too many attempts. Try again later');
        default:
          throw Exception('Login failed: ${e.message}');
      }
    } catch (e) {
      rethrow;
    }
  }

  /// Logout
  Future<void> logout() async {
    await _auth.signOut();
  }

  /// Get lecturer data
  Future<Map<String, dynamic>?> getLecturerData() async {
    final user = currentUser;
    if (user == null) return null;

    final doc = await _firestore.collection('lecturers').doc(user.uid).get();
    return doc.data();
  }
}
