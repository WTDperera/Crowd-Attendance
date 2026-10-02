import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'qa_config.dart';

// A named QA app avoids reusing the production default app created by Android.
// Every application Auth/Firestore access goes through these getters.
FirebaseAuth get appAuth {
  QaConfig.validate();
  return QaConfig.enabled
      ? FirebaseAuth.instanceFor(app: Firebase.app('isolated-qa'))
      : FirebaseAuth.instance;
}

FirebaseFirestore get appFirestore {
  QaConfig.validate();
  return QaConfig.enabled
      ? FirebaseFirestore.instanceFor(app: Firebase.app('isolated-qa'))
      : FirebaseFirestore.instance;
}

Future<void> initializeAppFirebase() async {
  QaConfig.validate();
  if (!QaConfig.enabled) {
    await Firebase.initializeApp();
    return;
  }
  await Firebase.initializeApp(
    name: 'isolated-qa',
    options: const FirebaseOptions(
      apiKey: 'qa-emulator-key', appId: '1:1234567890:android:qa',
      messagingSenderId: '1234567890', projectId: QaConfig.project,
    ),
  );
  await appAuth.useAuthEmulator(QaConfig.host, 9099, automaticHostMapping: false);
  appFirestore.settings = const Settings(persistenceEnabled: false);
  appFirestore.useFirestoreEmulator(QaConfig.host, 8080, automaticHostMapping: false);
}
