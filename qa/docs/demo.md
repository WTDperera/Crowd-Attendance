# Software-only demo, reset and recovery

Scope approved through P12: Android emulator + Windows Chromium + isolated local Firebase/API. Radio packets and permission callbacks in the journey targets are **simulated**. Real BLE advertising/scanning, native permission recovery, actual phones and participant UAT are excluded from the claimed verified demo. Normal `lib/main.dart` QA APKs still use the real radio plugins; QA mode does not turn those plugins into simulators.

Use only the synthetic accounts in [identities](../fixtures/identities.json). Do not use production records. Project is fixed to `demo-crowd-attendance-qa`; local Auth 9099, Firestore 8080, API 5000, web 5173. Android AVD host is 10.0.2.2. [README](../README.md#p11-unified-test-commands-and-ci) describes the guarded commands and prerequisites.

## Setup

Use Windows x64, Node 24.21.0, Flutter 3.47.6/Dart 3.13.5 at `C:/sdk/flutter`, JDK 21.0.11 build 10, locked npm/Flutter dependencies and pinned Playwright Chromium. The CI selector for the same JDK is `21.0.11+10.0.LTS`.

From repository root, each terminal needs the pinned Node on PATH. This workspace has it under the ignored QA cache; a fresh checkout needs Node 24.21.0 installed instead. Set the local Java selection in terminals that run Flutter:

```powershell
$qaRepo = $PWD.Path
$env:PATH = (Join-Path $qaRepo 'qa/.cache/p11-tools') + ';' + $env:PATH
$env:GRADLE_OPTS = '-Dorg.gradle.java.home="C:/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot" -Dorg.gradle.daemon=false'
```

Restore dependencies if needed (these commands were not a new P13 dependency upgrade):

```powershell
npm.cmd ci --prefix qa --ignore-scripts --no-audit --no-fund
npm.cmd ci --prefix web_app/admin-portal/server --ignore-scripts --no-audit --no-fund
npm.cmd ci --prefix web_app/admin-portal/frontend --ignore-scripts --no-audit --no-fund
Push-Location student_app
& 'C:/sdk/flutter/bin/flutter.bat' pub get --enforce-lockfile
Pop-Location
Push-Location lecturer_app
& 'C:/sdk/flutter/bin/flutter.bat' pub get --enforce-lockfile
Pop-Location
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $qaRepo 'qa/.cache/playwright'
node qa/node_modules/@playwright/test/cli.js install chromium
```

Prepare the existing AVD `crowd_attendance_qa_p02_api36`, Android 16/API 36, at serial **emulator-5580**. Run this in its own terminal to display the emulator during narration (add `-no-window` for headless verification):

```powershell
& "$env:LOCALAPPDATA/Android/Sdk/emulator/emulator.exe" -avd crowd_attendance_qa_p02_api36 -port 5580 -no-audio -no-snapshot-load -no-snapshot-save -gpu swiftshader_indirect
```

In another terminal, require `adb devices -l` to show emulator-5580 as `device`, then `adb -s emulator-5580 shell getprop sys.boot_completed` to return 1. Stop only your QA processes if the fixed ports are occupied; the runners refuse an unrelated listener instead of selecting another port.

## One-command clean verification

With Firebase/API/web ports free and the AVD ready, run from `qa`:

```powershell
npm.cmd run test:e2e
```

The command owns local Firebase/API/web, seeds once, then executes lecturer Android → Chromium → preservation-only student fixture → student Android. It stops its services afterward and rebuilds both normal-entry QA APK artifacts. It leaves the caller-owned AVD running. The Flutter drive targets temporarily install test APKs; rebuilding a normal APK does not claim it was reinstalled.

Explain these expected results during the demo:

1. Lecturer wrong/correct login and the normal session form create `P09 Android simulated ledger` under QA101. Three explicit scan rounds accept A in all three and C in the first two; repeated packets in one round do not create extra observations. Five raw observations remain, completed-round total 3.
2. Class completion gives A=`present`, B=`absent`, C=`left_early`, with exactly one additional class. QA101 includes its base class, so its completed class total becomes 2. Reopen confirms persistence.
3. Real Chromium login/report UI changes C from absent/partial to Excused, reloads, and exports `[1,0,ex]` for the new class at 66.67%. Raw round evidence remains five tuples. The browser also checks retained synthetic student CRUD, eight selected axe states and two reviewed screenshots.
4. Student A wrong/correct enrollment in QA202 creates one enrollment; Back/reopen preserves it. Reports agree at A2/2 and C1/2 in QA101, and QA202 remains a zero-session module. These are completed-class totals, not scan counts.

The test uses WidgetTester gestures/text and simulated radio callbacks, while persistence/API/rules are real local services. Do not describe it as a physical presence, continuous attendance or native keyboard demonstration.

## Narrated run with a visible browser and persistent local services

Use this alternative when you want to inspect the ledger in the portal afterward. Do not run the one-command suite concurrently.

Open three terminals at `qa`, with the setup PATH, and run one command in each:

```powershell
npm.cmd run emulators
npm.cmd run api
npm.cmd run web
```

Wait for Auth/Firestore and API/web readiness. In a fourth terminal at `qa`, close old app listeners and require successful seed before starting the journey:

```powershell
& "$env:LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" -s emulator-5580 shell am force-stop com.example.student_app
& "$env:LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" -s emulator-5580 shell am force-stop com.example.lecturer_app
node scripts/run.cjs seed
```

From `lecturer_app`, run the existing journey target using the local Java setting above:

```powershell
& 'C:/sdk/flutter/bin/flutter.bat' drive --no-pub --driver=test_driver/qa_bootstrap.dart --target=integration_test/journey_test.dart -d emulator-5580 --dart-define=QA_MODE=true --dart-define=QA_PROJECT_ID=demo-crowd-attendance-qa --dart-define=QA_EMULATOR_HOST=10.0.2.2
```

From `qa`, run the real browser scenario visibly, with the same Android-created ledger and no reset:

```powershell
npm.cmd run test:p09:web -- --headed
node scripts/run.cjs p09-student-fixture
```

Require each command to finish successfully. From `student_app`, run the same drive command shown above. A physical/manual phone journey is not performed by these targets.

You can now inspect `http://127.0.0.1:5173` with the synthetic lecturer A credentials. The local services remain alive in their terminals, so refresh preserves this in-memory emulator ledger. Portal Add/Edit Session is excluded; session creation is the lecturer Android workflow.

Close both test apps, then rebuild normal-entry QA APK artifacts from each app folder:

```powershell
& 'C:/sdk/flutter/bin/flutter.bat' build apk --debug --no-pub -t lib/main.dart --dart-define=QA_MODE=true --dart-define=QA_PROJECT_ID=demo-crowd-attendance-qa --dart-define=QA_EMULATOR_HOST=10.0.2.2
```

End the three owned service terminals with Ctrl+C; stop the caller-owned AVD with `adb -s emulator-5580 emu kill` when finished. Restarting the unexported Firebase emulators does not preserve their in-memory data; seed again for another clean run.

## Reset and recovery

| Situation | Action and expected result |
|---|---|
| Clean restart | Close both QA apps, start the local emulators, then `node scripts/run.cjs seed`; require exit 0. It resets only the fixed local demo project, giving five Auth users, three students and two modules. It erases the prior synthetic journey. |
| Seed/readiness failed | Stop relying on that fixture. Close app listeners; rerun guarded seed after both read-only emulator probes succeed. Auth/Firestore reset is not one transaction. A stopped/remote target must fail without production fallback. |
| Wrong/disabled enrollment | Error with no unintended enrollment/count. Correct password retry creates one enrollment; duplicates have one effect. |
| Scan write failed or radio lost | Do not complete an unresolved round. Error stays visible; Resume uses the saved round ID. Retry after an acknowledged write must not add another tuple. Explicit Cancel excludes that round; navigation/timeout alone does not complete it. Actual hardware recovery remains deferred. |
| Process restart during r2 | Retained test: seed, lecturer `round_persistence_test.dart` drive with `--dart-define=P05_RESTART_PHASE=prepare`, force-stop lecturer app, then drive with `--dart-define=P05_RESTART_PHASE=resume` **without a seed/reset between them**. Same r2/evidence survives; explicit r3 creates a separate observation. |
| Completion/correction retry | A rejected atomic commit leaves no partial completed class; repeat completion or identical correction yields stable counters/evidence. P13's retained tests model commit/acknowledgement faults and owned API outage; they do not establish physical-phone network recovery. |
| Screenshot mismatch | Keep the failure and inspect the platform/rendering difference. Do not use `--update-snapshots` to hide it; baseline changes need explicit review. |
| Hosted CI Java setup failure | P13 corrects the exact selector to `21.0.11+10.0.LTS`. Review/commit/push manually, then inspect the new hosted run. A locally validated fix is not a hosted pass. |

Raw logs, downloaded workbooks, traces, scans and APKs are ignored local artifacts. Use the narrow command summaries and [final results](../../QA.university.results.md) for submission; keep synthetic identifiers only. See [P13 report](../reports/P13.md) for actual executed commands, limitations and exact manual Git inventory.
