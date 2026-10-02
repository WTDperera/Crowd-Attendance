// P02 diagnostic entry point; never used by the normal application.
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'services/firebase_environment.dart';
import 'services/qa_config.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  QaConfig.validate();
  if (!QaConfig.enabled) throw StateError('Smoke requires explicit QA mode');
  await initializeAppFirebase();
  try {
    final result = await appAuth.signInWithEmailAndPassword(
      email: 'student.a@example.test', password: 'QA-only-Password-123!',
    ).timeout(const Duration(seconds: 15));
    final profile = await appFirestore.collection('students').doc(result.user!.uid)
        .get(const GetOptions(source: Source.server)).timeout(const Duration(seconds: 15));
    if (!profile.exists) throw StateError('Seeded QA profile missing');
  } finally {
    await appAuth.signOut();
  }
runApp(const MaterialApp(home: Scaffold(body: Center(child: Text('P02 QA connection PASS')))));
}