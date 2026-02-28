// File generated manually.
// NOTE: You must register a Web App in your Firebase project and
// replace the appId below with your actual web app ID.
// Firebase Console → Project Settings → Add App → Web

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return web;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      default:
        return web;
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyAd_24B0qFIudKtgLAhxzCihkFZDowcY_k',
    // TODO: Replace with your actual Web App ID from Firebase Console
    // Firebase Console → Project Settings → Your apps → Web app → App ID
    appId: '1:759737487813:web:REPLACE_WITH_WEB_APP_ID',
    messagingSenderId: '759737487813',
    projectId: 'crowed-attendence',
    authDomain: 'crowed-attendence.firebaseapp.com',
    storageBucket: 'crowed-attendence.firebasestorage.app',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyAd_24B0qFIudKtgLAhxzCihkFZDowcY_k',
    appId: '1:759737487813:android:821bda0ed7973ec55ebbac',
    messagingSenderId: '759737487813',
    projectId: 'crowed-attendence',
    storageBucket: 'crowed-attendence.firebasestorage.app',
  );
}
