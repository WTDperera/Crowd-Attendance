// 🔧 FIREBASE UPDATE SCRIPT
// Run this ONCE to add device_id_hash field to all existing students
// 
// HOW TO RUN:
// 1. This is a Flutter script, not standalone Dart
// 2. Copy this code into student_app/lib/main.dart temporarily
// 3. Or run from student app: flutter run and call this function
// 4. Better: Update via Firebase Console manually

// For now, let's create a Flutter-compatible version
// This needs to be run from within the Flutter app context

void main() {
  print("========================================");
  print("🔧 Firebase Hash Update Instructions");
  print("========================================\n");
  
  print("⚠️  This script requires Flutter context to run.");
  print("Please use ONE of these methods:\n");
  
  print("METHOD 1: Update via Firebase Console (Recommended)");
  print("---------------------------------------------------");
  print("1. Open Firebase Console: https://console.firebase.google.com");
  print("2. Navigate to your project → Firestore Database");
  print("3. Open 'students' collection");
  print("4. For each student document:");
  print("   - Note the 'device_id' value (e.g., 'TP1A.220624.014')");
  print("   - Calculate hash using this Dart code:");
  print("     String hash = deviceId.hashCode.abs().toRadixString(16).padLeft(8, '0');");
  print("   - Add new field 'device_id_hash' with the hash value\n");
  
  print("METHOD 2: Run from Student App");
  print("---------------------------------------------------");
  print("See update_firebase_from_app.dart for Flutter-compatible code\n");
  
  print("========================================");
}

// Flutter-compatible update function (copy this into student_app)
/*
import 'package:cloud_firestore/cloud_firestore.dart';

Future<void> updateFirebaseHashes() async {
  print("========================================");
  print("🔧 Firebase Hash Update Script");
  print("========================================\n");

  // Get all students
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

      if (deviceId.isEmpty) {
        print("⚠️  Student $regNo has no device_id - SKIPPED");
        skipped++;
        continue;
      }

      // Calculate hash (same algorithm as student app)
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
  print("📊 Summary:");
  print("   Updated: $updated students");
  print("   Skipped: $skipped students");
  print("========================================");
}
