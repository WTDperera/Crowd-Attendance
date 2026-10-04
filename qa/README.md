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

## Mobile: Android QA setup

Flutter is restored at `C:/sdk/flutter` (3.47.6, Dart 3.13.5), with Android SDK at `C:/Users/Tharindu/AppData/Local/Android/Sdk`. Flutter is not on PATH; use its full path below. Both apps include the SDK `integration_test` dependency and shared guard assertions. See [P02 report](reports/P02.md) for actual build/probe results and baseline analysis findings.

Android Studio bundles Java 25, which is incompatible with the existing Gradle 8.14. Set the process-local Java 21 Gradle setting below; `org.gradle.daemon=false` avoids reusing a daemon with stale DNS failures after network restoration. Android Command-line Tools 22.0 and the verified Android 36 AOSP x86_64 image are installed. Some unrelated SDK licenses were unaccepted in the last doctor result; review any needed licenses personally with `& 'C:/sdk/flutter/bin/flutter.bat' doctor --android-licenses`.

On 2026-10-03 the user explicitly deferred student Windows desktop/host tests. The Android probe runs the same retained target-guard assertions plus a real Auth/Firestore server connection; Windows C++ tools are not an Android QA prerequisite. Do not run the student's default host `flutter test` command for this scope or claim it passed.

The dedicated AVD is `crowd_attendance_qa_p02_api36` (Pixel 6 profile, Android 36, x86_64), with data under ignored `qa/.cache/avd/p02-api36.avd`. Boot it before testing:

```powershell
& 'C:/Users/Tharindu/AppData/Local/Android/Sdk/emulator/emulator.exe' -avd crowd_attendance_qa_p02_api36 -port 5580 -no-snapshot
```

Confirm `adb.exe -s emulator-5580 shell getprop sys.boot_completed` returns `1`. The test command explicitly selects `emulator-5580` and asserts Android; it cannot silently run on Windows. If the AVD or SDK image has been removed, recreate it with Android Studio's Device Manager before relying on these instructions.

Both apps use `firebase_environment.dart`; QA creates a separate named Firebase app and routes every Auth/Firestore access through it. Non-QA uses the existing default Firebase app. QA requires three explicit Dart defines, accepts only the fixed demo project and `10.0.2.2` or `127.0.0.1`, and disables Firestore persistence. Invalid QA flags fail before initialization. Debug Android manifests permit emulator HTTP; release manifests are unchanged.

With the Android device booted and local Firebase emulators running/seeded, execute inside **each** `student_app` and `lecturer_app`:

```powershell
& 'C:/sdk/flutter/bin/flutter.bat' pub get --enforce-lockfile
& 'C:/sdk/flutter/bin/flutter.bat' analyze --no-pub
$env:GRADLE_OPTS = '-Dorg.gradle.java.home="C:/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot" -Dorg.gradle.daemon=false'
& 'C:/sdk/flutter/bin/flutter.bat' build apk --debug --no-pub --dart-define=QA_MODE=true --dart-define=QA_PROJECT_ID=demo-crowd-attendance-qa --dart-define=QA_EMULATOR_HOST=10.0.2.2
& 'C:/sdk/flutter/bin/flutter.bat' drive --no-pub --driver=test_driver/qa_bootstrap.dart --target=integration_test/qa_bootstrap_test.dart -d emulator-5580 --dart-define=QA_MODE=true --dart-define=QA_PROJECT_ID=demo-crowd-attendance-qa --dart-define=QA_EMULATOR_HOST=10.0.2.2
& 'C:/sdk/flutter/bin/flutter.bat' run --no-pub -t lib/qa_smoke.dart --dart-define=QA_MODE=true --dart-define=QA_PROJECT_ID=demo-crowd-attendance-qa --dart-define=QA_EMULATOR_HOST=10.0.2.2
```

The Android emulator reaches the desktop loopback through `10.0.2.2`. The automated probe checks four target guard assertions, then authenticates the expected synthetic UID, verifies the named QA app/demo project, reads its own profile from the **server**, checks the synthetic email and signs out. It has a timeout and fails on errors. The optional `lib/qa_smoke.dart` diagnostic displays `P02 QA connection PASS`. Both bypass BLE and do not establish the normal app journey or physical-device behavior. Record each app/device result separately. Run `flutter run` with the same defines and the default `lib/main.dart` entry for normal QA app use.

For a physical USB Android phone, forward the local ports and use `QA_EMULATOR_HOST=127.0.0.1` instead:

```powershell
adb reverse tcp:9099 tcp:9099
adb reverse tcp:8080 tcp:8080
```

No LAN-exposed emulator listener is required. Multiple attached devices need an explicit device serial for adb/Flutter. Physical BLE and human UX observations remain for P12; these connection probes alone are not those tests.

## P03: role and profile regressions

Run `npm.cmd run test:p03` inside `qa`. The guarded launcher starts only local Auth/Firestore emulators, resets synthetic data between P03 cases, runs the P02 smoke checks plus focused P03 rules/API/provisioning cases, and stops the emulators. Expected permission-denied messages are assertions, not test failures; rely on the final test summary/exit code. Do not launch this while a separate Firebase emulator session owns the same ports.

Lecturer profiles now form a trusted registry: client creation/deletion is denied. The existing server `scripts/createLecturer.js` uses the Admin-only provisioning service, which checks the Auth account, refuses student identities/duplicate profiles, and fixes UID/email/role from trusted input. The QA seed uses that same service. No provisioning route is exposed. Existing lecturer credentials still work in mobile and the portal; a separate administrator role is not introduced. Existing live profiles would require an origin/identity audit before any future deployment; no live registry was inspected or migrated in P03.

Student direct writes are limited to first binding and server login timestamps. Provisioned lecturers may update their own name/fullName/department and first binding/login fields; identity/role/creation fields remain protected. Lecturer mobile writes to student attendance_counts remain supported, while identity/registration/enrollment/binding changes use trusted API paths where authorized. Full enrollment, counter ownership and attendance integrity are later phase gates.

For Android P03 checks, boot the existing QA AVD and start Firebase using the instructions above. Run `npm.cmd run seed` before **each** app probe so its first-binding assertions begin unbound. In each app directory:

```powershell
$env:GRADLE_OPTS = '-Dorg.gradle.java.home="C:/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot" -Dorg.gradle.daemon=false'
& 'C:/sdk/flutter/bin/flutter.bat' drive --no-pub --driver=test_driver/qa_bootstrap.dart --target=integration_test/profile_security_test.dart -d emulator-5580 --dart-define=QA_MODE=true --dart-define=QA_PROJECT_ID=demo-crowd-attendance-qa --dart-define=QA_EMULATOR_HOST=10.0.2.2
& 'C:/sdk/flutter/bin/flutter.bat' build apk --debug --no-pub -t lib/main.dart --dart-define=QA_MODE=true --dart-define=QA_PROJECT_ID=demo-crowd-attendance-qa --dart-define=QA_EMULATOR_HOST=10.0.2.2
```

The student probe checks actual Dart SDK writes with the student login's field shape; it does not operate the login UI. The lecturer probe calls the actual AuthService for first and subsequent login. Each defines one substantive scenario; framework teardown is not another acceptance case. Rebuilding main.dart restores the normal app APK overwritten by drive. See [P03 report](reports/P03.md) for results and limits. Windows desktop and physical BLE remain deferred.

## Firebase references

Firebase documents [demo projects and Auth emulator/custom-token connections](https://firebase.google.com/docs/emulator-suite/connect_auth), [Firestore emulator configuration](https://firebase.google.com/docs/emulator-suite/connect_firestore), and [client rules testing](https://firebase.google.com/docs/rules/unit-tests). The implementation follows those mechanisms with stricter local target guards.

The npm server `test` command invokes the P02 smoke runner; `qa`'s `test:p03` adds role/profile regressions, `test:p04` adds enrollment/API access regressions, and `test:p05` adds round rules checks. P06–P13, CI workflows and production deployment require their own authorized phases.

## P04 enrollment and access checks

From `qa`, run `npm.cmd run test:p04` with no existing Firebase emulator session. It starts only the fixed demo Auth/Firestore targets and runs P02, P03 and P04 suites serially. The seed publishes `module_catalog` using an explicit safe field whitelist and stores password hashes in client-inaccessible `module_secrets`. Students cannot read raw `modules` or enroll by direct Firestore writes.

The student app enrolls through `POST /api/student/modules/:moduleId/enroll` with its own Firebase ID token and a password-only JSON body. QA fixes the API to the validated emulator host on port 5000. Outside QA, build Android with an explicit HTTPS `--dart-define=API_BASE_URL=https://your-api-host`; no production API URL is guessed. The portal uses its existing `VITE_API_BASE_URL` for trusted module CRUD. Referenced modules cannot be deleted. Lecturer student CRUD remains global, but cannot target lecturer accounts or reset device bindings.

For Android probes, start `npm.cmd run emulators` and `npm.cmd run api` in separate terminals under `qa`. Before the student probe run `node scripts/run.cjs p04-fixture`; before the lecturer probe run `npm.cmd run seed`. The student fixture removes A's QA202 enrollment and adds disabled QA303. Use the existing dedicated QA AVD on port 5580. Run the following from the respective app folder, selecting its target:

```powershell
$env:GRADLE_OPTS = '-Dorg.gradle.java.home="C:/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot" -Dorg.gradle.daemon=false'
# student_app
& 'C:/sdk/flutter/bin/flutter.bat' drive --no-pub --driver=test_driver/qa_bootstrap.dart --target=integration_test/enrollment_access_test.dart -d emulator-5580 --dart-define=QA_MODE=true --dart-define=QA_PROJECT_ID=demo-crowd-attendance-qa --dart-define=QA_EMULATOR_HOST=10.0.2.2
# lecturer_app
& 'C:/sdk/flutter/bin/flutter.bat' drive --no-pub --driver=test_driver/qa_bootstrap.dart --target=integration_test/session_access_test.dart -d emulator-5580 --dart-define=QA_MODE=true --dart-define=QA_PROJECT_ID=demo-crowd-attendance-qa --dart-define=QA_EMULATOR_HOST=10.0.2.2
# Restore the normal QA app APK after drive; run in each app folder.
& 'C:/sdk/flutter/bin/flutter.bat' build apk --debug --no-pub -t lib/main.dart --dart-define=QA_MODE=true --dart-define=QA_PROJECT_ID=demo-crowd-attendance-qa --dart-define=QA_EMULATOR_HOST=10.0.2.2
```

Each app has one substantive P04 scenario; framework teardown adds another displayed count. Probes call actual services, not the normal UI. Stop the API/Firebase/Android emulator processes afterward. If using USB later, port 5000 also needs `adb reverse` alongside Auth/Firestore. See [P04 report](reports/P04.md) for evidence and limits. No live catalog/secret backfill or deployment has been performed.

## P05 durable rounds

Run `npm.cmd run test:p05` inside `qa` with no existing Firebase emulator session. This adds seven round/roster rules cases to the earlier suites (34 cases total). It tests actual application rules; Android tests below exercise actual Dart transactions and the same controller used by the scanner.

New sessions store `round_schema: 2`, a roster fixed at creation, immutable `roster/{studentUid}` eligibility proofs, an open round pointer and explicit round metadata. Each observation lives at `active_sessions/{sessionId}/rounds/{roundId}/observations/{studentUid}`. Summary IDs use the generated session ID plus a dot and the base64url student UID; nested summaries use the UID. Atomic marking updates evidence and both summaries together; later rounds append IDs without incrementing class attendance again. Cancelled rounds retain evidence but are excluded from outcomes. Legacy sessions remain readable through existing paths; scanning requires a newly created version 2 session. No historical migration was performed.

The normal dashboard now delegates to the shared scanner. Start/resume is explicit. Pause, timeout, navigation and radio errors leave the saved round open; **Complete Scan Round** drains writes and records completion. Cancel explicitly excludes the round. An unavailable roster rejects packets, and failed writes stay retryable. Repeated packets are suppressed only within their round. Registration bytes are strict UTF-8 matched exactly against the roster; no hardware byte budget or case-normalization policy is inferred.

Start the dedicated Android AVD and `npm.cmd run emulators`, then seed. From `lecturer_app`:

```powershell
& 'C:/sdk/flutter/bin/flutter.bat' test --no-pub test/round_domain_test.dart test/detection_gate_test.dart
$env:GRADLE_OPTS = '-Dorg.gradle.java.home="C:/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot" -Dorg.gradle.daemon=false'
& 'C:/sdk/flutter/bin/flutter.bat' drive --no-pub --driver=test_driver/qa_bootstrap.dart --target=integration_test/round_persistence_test.dart -d emulator-5580 --dart-define=QA_MODE=true --dart-define=QA_PROJECT_ID=demo-crowd-attendance-qa --dart-define=QA_EMULATOR_HOST=10.0.2.2
```

For an actual process restart, seed again, run the same drive command with `--dart-define=P05_RESTART_PHASE=prepare`, force-stop `com.example.lecturer_app` using adb, then run with `--dart-define=P05_RESTART_PHASE=resume`. **Do not reset/seed between prepare and resume.** Prepare leaves the unique `P05 restart checkpoint` session open in r2; resume must retain r2 and its observation before explicitly starting r3. Each phase has one substantive test. Rebuild the normal main.dart QA APK afterward using the P04 command above.

See [P05 report](reports/P05.md) for that checkpoint's evidence. These tests cover synthetic persistence, packet decoding and controller behavior; normal UI journeys, physical BLE, transport outage/reconnect and large rosters remain unverified. Version 2 session creation refuses inconsistent enrollment counts or changing profiles rather than capturing a partial roster. P06 completion/correction work is described below.

## P06 atomic completion and corrections

Run `npm.cmd run test:p06` inside `qa` with Firebase stopped. This runs the earlier suites plus ten finalization/correction regression tests (44 total). To test Android, start `npm.cmd run emulators` **and** `npm.cmd run api`; seed before each drive probe. From `lecturer_app`, use the existing P05 drive command with target `integration_test/finalization_test.dart`. P05's `round_persistence_test.dart` and P04's `session_access_test.dart` also now require the API because actual `SessionService.endSession` completes through it. Student Windows tests remain deferred.

`POST /api/attendance/session/:sessionId/complete` validates lecturer and module/session ownership again inside a transaction. It reads the fixed roster, completed rounds and immutable observations, then commits every root/nested outcome, absence, profile counter, session status and module/catalog increment atomically. A queued-write failure leaves the session active; retry performs the whole operation. A lost response after commit is safe to retry. Zero completed rounds/open rounds refuse completion. Repeated close preserves subsequent corrections. `totalStudents` from the old Dart signature remains accepted for source compatibility but the saved roster determines eligibility and totals.

The operation is deliberately bounded to at most 50 roster members, 50 round documents and 200 existing root/absence/nested projection documents; excess or inconsistent legacy data fails without writes. These bounds prevent unbounded atomic work and are **not** classroom capacity evidence. Only the synthetic three-student fixture has been verified. Legacy active sessions cannot be assigned invented round evidence; create a new version 2 session. Completed legacy classes without the new finalization marker require explicit reconciliation before a close retry. Legacy corrections require existing roster/evidence; conflicting statuses fail closed.

`POST /api/attendance/session/:sessionId/mark` corrects completed eligible results only. Body: `student_uid`, `status` (Present/Absent/Excused; retained Late compatibility) and optional `reason`. It preserves raw observations, updates root/nested projections and credited membership, removes stale absences for credited results, updates attendance/absence contributions once and appends owner/before/after/reason/time audit when the status changes. Excused is credited; `students_present`/`student_count` now mean credited membership including excused. Repeating the same status creates no second audit or counter delta. Existing same-status aliases can be reconciled; contradictory legacy evidence and counter conflicts are surfaced.

Clients cannot mutate completed projections, correction audits or module/catalog aggregates. Normal scans remain pending until API finalization. Outside QA, lecturer builds require explicit HTTPS `--dart-define=API_BASE_URL=https://your-api-host`, as the student enrollment client already does. Missing/offline API reports failure and does not claim completion. No API URL or production deployment is inferred.

Rebuild the normal main.dart lecturer QA APK after drive. Stop API, Firebase and the dedicated Android emulator afterward. See [P06 report](reports/P06.md) for actual results and manual Git commands. P07 report/workbook reconciliation and physical BLE remain separate gates.
