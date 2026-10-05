# Local QA setup and unified commands

Use the [P11 command map](#p11-unified-test-commands-and-ci) for the current runners. Earlier phase sections preserve their fixture assumptions and evidence; `npm test` now runs the web unit/runner checks, including the original configuration guards.

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

The npm server `test` command invokes the P02 smoke runner; `qa`'s `test:p03` adds role/profile regressions, `test:p04` adds enrollment/API access regressions, and `test:p05` adds round rules checks. P06/P07 commands are documented below. P08–P13, CI workflows and production deployment require their own authorized phases.

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

Rebuild the normal main.dart lecturer QA APK after drive. Stop API, Firebase and the dedicated Android emulator afterward. See [P06 report](reports/P06.md) for actual results and manual Git commands. P07 report/workbook reconciliation is documented below; physical BLE remains a separate gate.

## P07 reports and workbooks

With Firebase stopped, run `npm.cmd run test:p07` inside `qa`. It includes the earlier P02–P06 suites and the report policy, actual API and serialized XLSX checks. For a running local emulator session, `node scripts/run.cjs report-tests` runs the P07 subset. Pure checks can run from the repository root with `node --test qa/tests/report-policy.test.cjs qa/tests/workbook.test.cjs`.

Reports count completed eligible classes once. New classes use their saved roster; a later joiner has N/A for earlier classes. Classes without a saved roster explicitly report `roster_source: legacy_enrollment`; exact past enrollment cannot be recovered from missing historical data. Manual corrections supersede stale projections. Unresolved evidence conflicts get no credit and remain flagged in API results, the student card and workbook comments. Profile counters are not a report source. Date filters accept YYYY-MM-DD in Asia/Colombo, inclusive start and exclusive midnight after the end day. Eligibility uses raw counts >=80%; displayed percentages use two decimals. Zero classes yield 0% and no eligibility.

`GET /api/student/attendance-summary` derives identity from the verified token, checks an active student profile, and returns only that student's module metrics/records. Stats and lecturer report adapters require the existing explicit HTTPS `API_BASE_URL` outside QA. Reports require an available API and never silently fall back to stale counters. No production API has been deployed.

Workbook builders live in `frontend/src/services/attendanceWorkbook.js`; download/auth side effects remain in `attendanceExportService.js`. Tests write/read actual XLSX bytes, check cached results and independently evaluate the generated COUNTIF/IF/ROUND subset. They do not run an Excel or LibreOffice calculation engine. The 100,000 denominator threshold case is an arithmetic fixture, not a workbook with more than Excel's column limit or a capacity test.

For Android, start the dedicated QA AVD plus `npm.cmd run emulators` and `npm.cmd run api`. Run `node scripts/run.cjs p07-fixture` from `qa` before each app's probe. The fixture deliberately includes C's excused correction, stale absence and wrong profile counter. From each respective app folder:

```powershell
$env:GRADLE_OPTS = '-Dorg.gradle.java.home="C:/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot" -Dorg.gradle.daemon=false'
& 'C:/sdk/flutter/bin/flutter.bat' drive --no-pub --driver=test_driver/qa_bootstrap.dart --target=integration_test/report_test.dart -d emulator-5580 --dart-define=QA_MODE=true --dart-define=QA_PROJECT_ID=demo-crowd-attendance-qa --dart-define=QA_EMULATOR_HOST=10.0.2.2
& 'C:/sdk/flutter/bin/flutter.bat' build apk --debug --no-pub -t lib/main.dart --dart-define=QA_MODE=true --dart-define=QA_PROJECT_ID=demo-crowd-attendance-qa --dart-define=QA_EMULATOR_HOST=10.0.2.2
```

Student probes cover the actual report service, a focused report-card eligibility boundary and Colombo date rendering; lecturer probes call the actual report adapter. Record dates retain their actual UTC instant until displayed in Colombo time. Missing durations no longer invent a two-hour attendance interval. They do not establish normal UI journeys or physical BLE success. Stop the owned QA processes afterward. See [P07 report](reports/P07.md). P08 requires its own approval/start instruction; student Windows tests remain deferred.

## P08 — component and retained-feature checks

The user approved P07 and started P08 on 2026-10-04. Portal account/module management uses the real services. Portal Add/Edit Session and their in-memory providers are excluded from the running application; session creation remains in the lecturer Android app. Old mock source files remain unmounted.

From `qa`, with QA API/emulator ports free:

```powershell
npm.cmd run test:p08
```

This starts isolated Firebase emulators and runs the retained P02–P07 suite, focused React components, then React form persistence/fault-recovery checks serially. The latter use actual local Auth/Firestore/API calls and fresh page mounts; they use jsdom at the allowed QA origin, not a browser. Two fault cases intentionally reject one SDK operation; compensation and retry are real. Frontend dependencies must be installed with its updated lockfile. `npm.cmd run test:components` in the frontend runs only the component mocks. With local emulators already running and port 5000 free, `node scripts/run.cjs component-integration` runs just the real form checks.

For Android, start the dedicated QA AVD (`emulator-5580`), local Firebase emulators and QA API. Close both previous test apps before reseeding. From `qa`, run `node scripts/run.cjs p04-fixture` successfully before **each** app's P08 probe. This leaves QA202 open/not enrolled by A and QA303 closed. A Firestore emulator reset can return 499 after cancelled native listeners; close the apps, rerun the fixture and require exit 0 before relying on readiness. No failed seed is a pass.

From each app folder:

```powershell
$env:GRADLE_OPTS = '-Dorg.gradle.java.home="C:/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot" -Dorg.gradle.daemon=false'
& 'C:/sdk/flutter/bin/flutter.bat' drive --no-pub --driver=test_driver/qa_bootstrap.dart --target=integration_test/ui_components_test.dart -d emulator-5580 --dart-define=QA_MODE=true --dart-define=QA_PROJECT_ID=demo-crowd-attendance-qa --dart-define=QA_EMULATOR_HOST=10.0.2.2
& 'C:/sdk/flutter/bin/flutter.bat' build apk --debug --no-pub -t lib/main.dart --dart-define=QA_MODE=true --dart-define=QA_PROJECT_ID=demo-crowd-attendance-qa --dart-define=QA_EMULATOR_HOST=10.0.2.2
```

Widget definitions are under each app's `test/ui_components_test.dart`, registered by the Android target. Text/gestures and BLE callbacks are simulated. Actual mobile login, student enrollment and lecturer session creation use the local services; server reads/fresh mounts check persistence. The test keyboard is registered to prevent competition with the native IME; native keyboard behavior and physical BLE are unverified. Student Windows tests remain deferred. Full journeys and accessibility/visual automation belong to P09; physical checks remain P12. See [P08 evidence](reports/P08.md). Stop the owned QA processes afterward.

## P09 — shared browser and Android journeys

P08 was approved and P09 started on 2026-10-04. These tests use the normal app roots and real isolated Auth/Firestore/API services. Lecturer scan packets, permission/radio callbacks and test text input are simulated explicitly; no physical BLE or native permission pass is claimed.

Install QA dependencies from the updated lockfile. Download the pinned browser into the workspace once, from `qa`:

```powershell
npm.cmd ci --no-audit --no-fund --cache .cache/npm
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD/.cache/playwright"
node node_modules/playwright/cli.js install chromium
```

Start the existing dedicated Android AVD `crowd_attendance_qa_p02_api36` at port 5580 (headless is supported). Start `npm.cmd run emulators`, `npm.cmd run api` and `npm.cmd run web` in separate terminals under `qa`. Wait for local readiness. The web/API targets must be exactly 127.0.0.1:5173/5000; do not use a silently selected alternate Vite port. Close old mobile apps, then run `node scripts/run.cjs p04-fixture` and require exit 0. If native-listener cancellation makes reset return 499, close the apps and retry; no failed seed is readiness evidence.

Run the following **in order**, sharing the same fixture; do not reset between clients:

1. From `lecturer_app`, run the Android target below. Normal login/session form creates one QA101 class titled `P09 Android simulated ledger`. The actual controller persists three rounds, duplicate suppression, A in all rounds and C in the first two; UI completion and reopening are checked.
2. From `qa`, run `npm.cmd run test:p09:web`. This runs eight loaded-screen axe scans, compares two reviewed screenshots, then exercises actual browser wrong/correct login, saved absent/excused correction, reload, XLSX download and student account create/edit/delete. It requires the single completed Android class and never invents a replacement. UI correction establishes a repeatable starting status on reruns.
3. From `qa`, run `node scripts/run.cjs p09-student-fixture` successfully. This idempotently removes only A's QA202 enrollment for the student scenario, preserving the Android class/correction. From `student_app`, run the same Android target. Normal login, wrong/correct enrollment, Back/reopen, fresh app mount, logout and C login verify actual reports: A 2/2, C 1/2 after correction, QA202 0/0.

From each respective app folder:

```powershell
$env:GRADLE_OPTS = '-Dorg.gradle.java.home="C:/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot" -Dorg.gradle.daemon=false'
& 'C:/sdk/flutter/bin/flutter.bat' drive --no-pub --driver=test_driver/qa_bootstrap.dart --target=integration_test/journey_test.dart -d emulator-5580 --dart-define=QA_MODE=true --dart-define=QA_PROJECT_ID=demo-crowd-attendance-qa --dart-define=QA_EMULATOR_HOST=10.0.2.2
& 'C:/sdk/flutter/bin/flutter.bat' build apk --debug --no-pub -t lib/main.dart --dart-define=QA_MODE=true --dart-define=QA_PROJECT_ID=demo-crowd-attendance-qa --dart-define=QA_EMULATOR_HOST=10.0.2.2
```

Drive replaces the app APK with the test target; the build restores the normal QA APK. Browser artifacts, downloaded synthetic workbook, axe JSON and failure traces are ignored under `qa/artifacts/p09/browser`. Only the two reviewed PNG baselines are proposed for Git. Review [baseline notes](browser/baselines/README.md); update deliberately with `npm.cmd run test:p09:web -- --grep "stable core" --update-snapshots`, inspect both images, then rerun without that flag. Never update a baseline to hide a regression.

The axe tag set is WCAG 2 A/AA and 2.1 A/AA. Automatic checks do not establish complete accessibility; incomplete checks, focus/modal behavior, screen readers and native keyboard require manual review. Windows/Chromium screenshots are platform-specific; no mobile golden or other-browser visual pass is claimed. Student Windows desktop tests remain deferred.

Retain these **manual native permission checks for P12**: fresh-install student Advertise/Connect/location allow and deny; lecturer Scan/Connect/location allow and deny; Bluetooth off/on, stop/restart, logout/navigation during an actual broadcast/scan, and permission revocation. Use real test phones and record model/OS/outcomes. Idle student navigation/logout is covered without granting or requesting native radio permission; actual advertising and permission-plugin recovery are unverified.

Stop the owned API/web/Firebase/Android processes after testing. With their ports free, `npm.cmd run test:p08` reruns the retained 94 checks on a fresh seed; it intentionally resets the shared journey ledger. See [P09 evidence](reports/P09.md). P10 requires separate approval/start.

## P11 unified test commands and CI

Run these from `qa`. Earlier phase instructions remain historical/reusable; `test:p03`–`test:p09:web` aliases are preserved. Install all three npm lockfiles (QA/server/frontend) before Node/browser suites. CI uses `npm ci --ignore-scripts --no-audit --no-fund`; required build binaries are supplied by locked platform packages. Install both Flutter locks with `flutter pub get --enforce-lockfile` before Android/domain commands.

| Command (`npm.cmd run …`) | What it executes |
|---|---|
| `test:static` | Runner/server-route JavaScript syntax and explicitly listed frontend QA/bootstrap/form lint subset. This is focused static verification. |
| `test:static:full` | Full frontend ESLint, then both Flutter analyses, failing at the first nonzero result. Known baseline ESLint findings currently make this fail; it is not a clean full-analysis claim. |
| `test:build` / `test:build:android` | Normal + guarded QA web bundles / both normal-entry QA debug Android APKs. |
| `test:unit:web` (`npm test`) | Config guards, report policy/workbook oracles and runner contract cases. |
| `test:unit:mobile` / `test:unit` | Lecturer pure round/gate domain tests / web unit then lecturer domain tests. Student Windows host tests remain deferred. |
| `test:component` | Existing 25 React auth/forms/routes cases. |
| `test:widget` | Existing student and lecturer P08 integration targets on Android, including their widget and actual-service cases. No Windows widget fallback. |
| `test:api` / `test:contract` | Same explicit profile/enrollment/finalization/report/P10 malformed API files. Some files include rules assertions; counts overlap other categories. |
| `test:rules` | Profile, enrollment/access and durable-round rules files using actual application rules. |
| `test:integration` | P02 fixture/rules/API bootstrap plus P07 real report/persistence contracts. |
| `test:rounds` | Existing P05 round security and P06 completion/correction files. |
| `test:mobile` | Actual Android student enrollment, lecturer session access and round persistence probes, each preceded by its required fixture. |
| `test:e2e` | One seed → lecturer Android journey → full Windows Chromium suite → preservation-only student fixture → student Android journey. One ledger is shared without a reset between clients. Radio callbacks are simulated. |
| `test:accessibility` / `test:visual` | Same standalone stable-screen browser case: eight selected axe states and two strict reviewed Windows screenshot comparisons. It uses the completed base class and removes only the empty active placeholder; it never manufactures an Android journey ledger. |
| `test:security` | Fresh pinned Gitleaks + OSV scans, exact valid dispositions, four security harness cases and seven local API security cases (including the P13 expired-token regression). Raw findings may exit 1; only a freshly produced scan artifact plus passing review can satisfy the wrapper. |
| `test:property` | Existing lecturer seeded replay/reversal test, selected by exact name: one bounded property case over 100 repeat counts. No broad randomized/shrinking/fuzzing framework is claimed. |
| `test:performance` | Existing fixed P10 six-worker load/fault/short-soak with measured latency and ledger reconciliation. |
| `smoke` / `test:regression` | Original five P02 checks / retained P08 94 then seven API security cases (101 execution occurrences). No new test duplicates are created to inflate totals. |
| `test:workflow` | Checksum-pinned actionlint validates the workflow and custom self-hosted label. Bash/Python linters are disabled; workflow scripts use PowerShell. |
| `test:hardware` | Always fails with the explicit P12/device prerequisite. No BLE/native-permission/UAT pass is inferred. |

Suites use explicit nonempty file inventories. Missing/empty files, unknown categories, extra flags, failed/timed-out children and zero passing test output fail. Node, Vitest, Playwright and Flutter result formats are checked. The runner captures raw diagnostics only under ignored `.cache/p11` and prints/writes a narrow JSON result (label, status, code, count, timeout, duration). `canary-fail`/`canary-empty`/`canary-timeout` are intentional negative checks asserted by the passing runner contract suite. Tool-displayed Flutter counts may include framework teardown; the drive result parser subtracts its known teardown case so teardown alone cannot satisfy a required suite. Phase reports distinguish substantive cases. Category counts overlap and must not be added as unique coverage.

Use Windows x64, Node **24.21.0**, Flutter **3.47.6** / Dart **3.13.5**, JDK **21.0.11+10** for the pinned CI profile. Local Flutter can be selected with `QA_FLUTTER_BIN`; otherwise the existing C:/sdk installation or PATH is used. Android commands require the prepared dedicated API36 AVD as **emulator-5580** (override to any other serial is refused), Android SDK via ANDROID_HOME/ANDROID_SDK_ROOT or the normal local location, both Flutter lockfiles restored and free Firebase/API/web QA ports. They never boot/reuse an arbitrary phone or fall back to desktop. The runner stops only owned API/web process trees, refreshes the real rules, probes before writes, serializes fixture resets and force-stops the two QA apps before fixture changes. Normal-entry QA APK artifacts are rebuilt after drives; this does not claim they were reinstalled on the emulator.

For this local JDK selection, retain the previously verified setup:

```powershell
$env:GRADLE_OPTS = '-Dorg.gradle.java.home="C:/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot" -Dorg.gradle.daemon=false'
```

Install checksum-pinned tools from repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File qa/scripts/install-ci-tools.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File qa/security/install.ps1
```

`.github/workflows/qa.yml` defines Windows web/regression/security/performance, standalone browser and Android build/domain jobs on push to MAIN and pull requests. External actions use full commit pins; Node/Flutter/Java versions are exact. Read-only repository permission, no persisted checkout credentials, no production secrets/config, sequential local emulator ownership and job time limits are explicit. The full Android/browser journey is manual `workflow_dispatch` only, requiring a dedicated self-hosted Windows/X64 runner labelled `crowd-attendance-qa`, prepared emulator-5580 and SDK prerequisites. This runner job also restores locked dependencies and the pinned Chromium. Physical checks remain outside Actions.

Only `qa/artifacts/p11/*.json` command summaries are uploaded for seven days. Raw logs, environments, Auth responses, traces, screenshots, APKs, caches and the whole workspace are excluded from upload. Reviewed baseline PNGs remain source-controlled, never updated automatically. The Windows hosted image/fonts can differ from this machine; a visual mismatch must fail and require deliberate review, not an automatic baseline update. Full lint baseline failures remain visible through the strict full command; the automatic job is explicitly focused static verification.

The user subsequently pushed P11/P12. Hosted run 37236446839 failed at Java setup before application tests. P13 corrects the exact Java catalog selector to `21.0.11+10.0.LTS`; corrected hosted jobs still require the user's manual publication and a new run. Review [P13 report](reports/P13.md), [final results](../QA.university.results.md) and [software-only demo/reset/recovery](docs/demo.md). P12's physical-phone scope was explicitly deferred by the user; running these emulator commands does not establish physical BLE or real-user acceptance.
