import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class AuthService {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  User? get currentUser => _auth.currentUser;
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  /// Login - allows both lecturers (as admins on web)
  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    try {
      final credential = await _auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );

      final user = credential.user;
      if (user == null) throw Exception('Login failed');

      // Check if lecturer (admin on web)
      final lecturerDoc =
          await _firestore.collection('lecturers').doc(user.uid).get();
      if (lecturerDoc.exists) {
        return {
          'success': true,
          'role': 'lecturer',
          'data': lecturerDoc.data(),
        };
      }

      // Not a lecturer - sign out and reject
      await _auth.signOut();
      throw Exception(
          'Access denied. Only lecturers can access the admin dashboard.');
    } on FirebaseAuthException catch (e) {
      switch (e.code) {
        case 'user-not-found':
          throw Exception('No account found with this email.');
        case 'wrong-password':
        case 'invalid-credential':
          throw Exception('Incorrect email or password.');
        case 'invalid-email':
          throw Exception('Invalid email format.');
        case 'user-disabled':
          throw Exception('This account has been disabled.');
        case 'too-many-requests':
          throw Exception('Too many attempts. Try again later.');
        default:
          throw Exception('Login failed: ${e.message}');
      }
    }
  }

  Future<void> logout() async {
    await _auth.signOut();
  }

  Future<Map<String, dynamic>?> getCurrentUserData() async {
    final user = currentUser;
    if (user == null) return null;
    final doc =
        await _firestore.collection('lecturers').doc(user.uid).get();
    return doc.data();
  }
}
