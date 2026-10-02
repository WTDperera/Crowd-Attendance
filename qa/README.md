# Local QA setup — P02

This harness uses only `demo-crowd-attendance-qa`, Auth at `127.0.0.1:9099`, and Firestore at `127.0.0.1:8080`. It does not use a service-account key or the production `.env`. Conflicting project/host/credential settings cause an error before seed/reset. There is no live-project fallback. Existing `scripts/firestore/` utilities are not reused because they accept arbitrary project IDs and ambient credentials.

The launcher refreshes an ignored copy of the **actual application rules** before starting Firebase (the CLI requires the rules file under its config directory). P02 does not loosen or fix rules. The full attendance journey will still encounter known permission/feature defects until the relevant phases.

## Prerequisites and install

Node/npm, Java 21, and the locked dependencies below are needed. This machine has Node 26.3.1/npm 11.16.0; Firebase's hosting-only transitive `superstatic` package warns that it supports Node 20/22/24. Hosting is not started. Prefer a supported Node 24 environment when restoring the full toolchain; this run's exact outcomes are in [P02 report](reports/P02.md).

```powershell
cd "C:\Users\Tharindu\Desktop\Crowd Attendance\web_app\admin-portal\server"
npm.cmd ci
cd ..\frontend
npm.cmd ci
cd ..\..\..\qa
npm.cmd ci
npm.cmd test
npm.cmd run smoke
```

`smoke` starts local Auth/Firestore, resets/seeds twice, checks fixture counts, exercises one allowed and one denied rules read, and checks API login plus web SDK custom-token exchange against local Auth. It exits nonzero on failure and stops the emulators. This is a harness check, not E01–E23 acceptance or BLE evidence. No hosted CI ran.

## Interactive local session

From the repository's `qa` directory, use separate terminals:

```powershell
# Terminal 1: leave running
npm.cmd run emulators
# Terminal 2: creates synthetic data; replaces all data in this local demo project
npm.cmd run seed
npm.cmd run api
# Terminal 3: opens a local development server, no production deployment
npm.cmd run web
```

Visit `http://127.0.0.1:5173`. The API listens at `http://127.0.0.1:5000`. Synthetic credentials are in [identities.json](fixtures/identities.json): lecturer.a / lecturer.b / student.a / student.b / student.c at `example.test`, password `QA-only-Password-123!`. These are deliberately fake, emulator-only accounts. The portal uses lecturer credentials. Never enter a real account into this QA setup.

`npm.cmd run reset` deletes only this emulator project's Auth/Firestore data, leaving it empty. `npm.cmd run seed` first resets then restores it. If either service is unavailable, the command fails rather than redirecting elsewhere. Stop consumers during reset, then sign out/reload their sessions. If a reset/seed is interrupted, rerun seed before relying on results; seed is repeatable, not an atomic cross-service transaction.

Fixture v1 has two lecturers, three students, QA101/QA202, one completed and one active QA101 session. QA202 has zero sessions. Completed base data reflects the P01 A/B/C oracle using the current schema; it does **not** claim durable round identity already exists. Physical BLE payload compatibility of QA001–QA003 remains unverified. Do not treat Admin SDK seeding as client permission evidence.

Build QA frontend: `npm.cmd run build:web`. The normal frontend `npm.cmd run build` is the existing non-QA baseline; neither command publishes anything. QA API doesn't load `.env`; web QA launch overrides all target selectors and ignores live Firebase settings for client initialization.

## Mobile: pending restored SDK

The user confirmed Flutter/Android SDK deletion during P02. The following commands and connection probes have **not run**. Restore Flutter/Dart compatible with the locked pubspecs (Dart >=3.10.1) and Android tooling first. P02 stays blocked until both apps' checks and actual emulator connections are verified.

Both apps use `firebase_environment.dart`; QA creates a separate named Firebase app and routes every Auth/Firestore access through it. Non-QA uses the existing default Firebase app. QA requires three explicit Dart defines, accepts only the fixed demo project and `10.0.2.2` or `127.0.0.1`, and disables Firestore persistence. Invalid QA flags fail before initialization. Debug Android manifests permit emulator HTTP; release manifests are unchanged.

With local Firebase emulators already running/seeded, execute inside **each** `student_app` and `lecturer_app`:

```powershell
flutter pub get --enforce-lockfile
flutter analyze
flutter test test/qa_config_test.dart
flutter build apk --debug --dart-define=QA_MODE=true --dart-define=QA_PROJECT_ID=demo-crowd-attendance-qa --dart-define=QA_EMULATOR_HOST=10.0.2.2
flutter run -t lib/qa_smoke.dart --dart-define=QA_MODE=true --dart-define=QA_PROJECT_ID=demo-crowd-attendance-qa --dart-define=QA_EMULATOR_HOST=10.0.2.2
```

The Android emulator reaches the desktop loopback through `10.0.2.2`. The diagnostic entry point logs into the seeded role, reads its own profile from the **server** with a timeout, signs out, and displays `P02 QA connection PASS`. It bypasses BLE and does not claim the normal app journey passed. Record each app/device result separately; exceptions are failures, not passes. Run `flutter run` with the same defines and the default `lib/main.dart` entry for normal QA app use.

For a physical USB Android phone, forward the local ports and use `QA_EMULATOR_HOST=127.0.0.1` instead:

```powershell
adb reverse tcp:9099 tcp:9099
adb reverse tcp:8080 tcp:8080
```

No LAN-exposed emulator listener is required. Multiple attached devices need an explicit device serial for adb/Flutter. Physical BLE and human UX observations remain for P12; these connection probes alone are not those tests.

## References and scope

Firebase documents [demo projects and Auth emulator/custom-token connections](https://firebase.google.com/docs/emulator-suite/connect_auth), [Firestore emulator configuration](https://firebase.google.com/docs/emulator-suite/connect_firestore), and [client rules testing](https://firebase.google.com/docs/rules/unit-tests). The implementation follows those mechanisms with stricter local target guards.

The npm server `test` command now invokes this real P02 smoke runner instead of the failing placeholder. P03–P13 feature fixes, their suites, CI workflows and production deployment are not part of this setup.
