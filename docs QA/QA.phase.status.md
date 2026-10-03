# QA Phase Status

**Created:** 2 October 2026  
**Current authorized phase:** P02 only — ready for user review

**Last approved phase:** P01

**Implementation status:** P01 approved; P02 READY_FOR_REVIEW (Android verification complete). No later phase authorized.

Read together with [rules](AGENTS.md), [prompts](QA.agent.prompts.md) and [plan](QA.university.essential.plan.md).

| Phase | Status | Start authorization | Review evidence | User approval |
|---|---|---|---|---|
| P01 — Scope, policy and expected results | APPROVED | 2026-10-02: user explicitly started P01; exact wording below | [P01 report](../qa/reports/P01.md), [decisions](../qa/docs/decisions.md), [matrix](../qa/docs/test-matrix.md) | 2026-10-02: “ok I aprove the phase 1 go to the next” |
| P02 — Isolated environment and minimum harness | READY_FOR_REVIEW | 2026-10-02: “ok I aprove the phase 1 go to the next”; resumed 2026-10-03 for Android only | [P02 report](../qa/reports/P02.md): harness 5/5; student Android 2/2; lecturer Android 2/2; both final QA APKs build; baseline analysis nonzero; student Windows host test deferred by user | None |
| P03 — Role and profile protection | NOT_STARTED | None | None | None |
| P04 — Enrollment and API ownership | NOT_STARTED | None | None | None |
| P05 — Durable multiple scan rounds | NOT_STARTED | None | None | None |
| P06 — Finalization, recovery and corrections | NOT_STARTED | None | None | None |
| P07 — Report and workbook correctness | NOT_STARTED | None | None | None |
| P08 — UI components and retained demo features | NOT_STARTED | None | None | None |
| P09 — Automated browser and mobile journeys | NOT_STARTED | None | None | None |
| P10 — Security checks and modest load scripts | NOT_STARTED | None | None | None |
| P11 — Test commands and GitHub Actions | NOT_STARTED | None | None | None |
| P12 — Actual demo devices and failure checks | NOT_STARTED | None | None | None |
| P13 — Final regression and submission pack | NOT_STARTED | None | None | None |

## Status rules

NOT_STARTED → IN_PROGRESS → READY_FOR_REVIEW → APPROVED.
Use BLOCKED where the gate cannot be met. Fixes return to IN_PROGRESS only for the authorized phase.
Only the user's actual approval can produce APPROVED. Record date and the user's wording.
Starting a successor additionally requires an explicit start instruction for that successor.
Do not treat the table itself as a substitute for missing user authorization.

## Approval and start log

2026-10-02 — user authorized P01 with:

> ok I fixed That,
> If you need  help by me ask (such like physical/UI User exppieriance tests you cannot do)
> and start First Phase(P01   )

At that time this authorized P01 only. Subsequent approval/start is recorded below.

2026-10-02 — P01 policy responses (not phase approval):

- “FOR THE ADMIN DASHBOARD CAN LOG with the lecture same credinceal, then lectures can do delete,add (CRUD)” — same lecturer login and retained student CRUD.
- “Use these rules” — confirms proposed all/some/none outcomes, excused credit, failed/cancelled exclusion and rejection of zero-round completion.
- “Use this proposed demo scope and policy” — confirms Asia/Colombo, 80%, roster at start, owner corrections and portal Add/Edit Session exclusion. Specific CRUD answer overrides bundled account-lifecycle exclusion.
- “Delete login/profile access but preserve historical attendance” — confirms retained historical reporting after student deletion.

## Current blockers and decisions

2026-10-02 — “ok I aprove the phase 1 go to the next” approves P01 and explicitly advances to its immediate successor P02 only. P01 proposals are accepted as the reviewed baseline where a candidate was specified; details left unspecified (e.g. registration byte budget and exact hardware) still require resolution before dependent work. The user then confirmed “I deleted the SDK,” explaining unavailable Flutter/Android baseline tools. Mobile execution is blocked until SDK restoration; independent P02 work continues.

P01 is approved: E01–E23 mappings and specified candidate policies form the reviewed baseline. Explicitly unspecified details (registration format/byte budget, reset workflow, actual device/capacity selection) still need resolution before dependent work; approval does not invent missing values.

P02 now meets its Android-scoped harness gate: 5/5 local harness checks, 2/2 Android bootstrap checks in each mobile app, and both final normal-entry QA APK builds pass. Auth/Firestore connections were verified on the dedicated Android 36 emulator. Student Windows host testing is explicitly deferred by the user; existing assertions remain and passed on Android. Frontend lint baseline remains 16 errors/2 warnings; mobile analysis remains nonzero with no errors (student 1 warning/27 info; lecturer 1 warning/157 info). These are recorded baseline findings, not green lint/analysis claims. P02 is READY_FOR_REVIEW, not approved. No P03 work started.

Real-user testing remains deferred. Physical hardware availability is unconfirmed; user offered assistance. Devices are not a P01 prerequisite. Before accepting later dependent tests, resolve their policy decisions and environment needs.

## P01 handoff — 2026-10-02

- Branch: MAIN; baseline: d35e3d4fd4f22f0dc36041fe207ee3e05edaaf5e.
- Changed: this tracker, qa/docs/decisions.md, qa/docs/test-matrix.md, qa/reports/P01.md only.
- Evidence: source inspection and independent ledger review; application tests/builds not run in this documentation phase.
- Technical gate: READY_FOR_REVIEW, not APPROVED. No application defects fixed or functionally reproduced.
- Existing .gitignore edit and other untracked handoff documents preserved.
- Manual verification and Git commands: see P01 report. No staging/commit/push/deployment executed.
- Subsequent user approval and P02 start: “ok I aprove the phase 1 go to the next”, 2026-10-02.

## P02 handoff — 2026-10-02

- Authorized wording: “ok I aprove the phase 1 go to the next”; P02 only.
- Current HEAD: a5ea075192f88924fe7703f3373316ff6a2dd375, MAIN; origin unchanged. User's P01 commit appeared during work; agent performed no Git mutations.
- Evidence/files/commands/manual Git instructions: [P02 report](../qa/reports/P02.md), [setup guide](../qa/README.md).
- Technical gate: BLOCKED — user confirmed deleted SDK; mobile checks unrun. Web/API/emulator 5/5 checks and two frontend builds pass; baseline lint fails.
- Resume: restore Flutter/Android tools and request “Resume P02 only”; verify both mobile targets before approval.
- P02 approval: none. P03 start: none. Emulators stopped after successful final smoke run.

## P02 resumed checkpoint — 2026-10-02

- User requested “please start previously stoped point”; this resumes the already authorized unfinished P02 only.
- User confirmed “Not restored yet” when asked about Flutter/Android SDK restoration. Flutter/Dart/adb remain absent from PATH; checked common SDK locations were not found. SDK discovery is not a mobile build or connection test.
- Observed branch `MAIN`, HEAD `a1e8a926094392a2b38f02a0a9205ddb04f77099` (`Parcialy done the p02`), origin unchanged; worktree and index were clean before this checkpoint update. Git mutations were not executed.
- `npm.cmd test` in `qa` and direct `node --test tests/config.test.cjs` both exited 0: 2/2 configuration guard tests passed. Integrated 5/5 smoke evidence above is from the prior run, not rerun in this checkpoint.
- P02 remains BLOCKED: restore compatible Flutter/Dart (Dart >=3.10.1 within the pubspec constraint), Android SDK and an Android emulator or connected device, then execute both apps' locked dependency, analysis, guard-test, debug-build and local Firebase connection checks from `qa/README.md`.
- Changed only this tracker and `qa/reports/P02.md`. No application feature changes, installation, deployment or P03 work. P02 approval remains absent.

## P02 Android restoration update — 2026-10-02

- User reported “I installed the Android studio”. Verified Android Studio at `C:/Program Files/Android/Android Studio` and Android SDK at `C:/Users/Tharindu/AppData/Local/Android/Sdk`.
- SDK contains platform-tools, emulator, platform `android-37.0`, build-tools `36.0.0` and a licenses directory. Command-line Tools were not found at `cmdline-tools/latest`; complete Flutter compatibility/licensing is unverified.
- Full-path `adb.exe version` initially failed on sandbox user-directory access; approved retry exited 0: Android Debug Bridge 1.0.41, package 37.0.1-15733141. adb remains absent from PATH.
- Flutter/Dart remain absent from PATH and checked common Flutter locations. Asked whether Flutter was installed in a custom folder; no such path verified yet. P02 remains BLOCKED pending Flutter discovery/restoration and both apps' actual mobile checks; no device/build/connection pass is claimed.
- Updated tracker/report only; previous guard results remain historical. Manual Git commands are in the P02 report. No Git mutations or P03 work.

## P02 Flutter restoration checkpoint

- User provided `C:/sdk/flutter`. Flutter 3.47.6/Dart 3.13.5 and Android SDK are now verified; this supersedes earlier SDK-absent observations. It resumes P02 only.
- Both original mobile locks were incompatible with six dependencies required by installed Flutter. Minimal lock refresh completed; both enforced restores now exit 0. Direct dependency manifests unchanged.
- Lecturer QA guard passes 1/1. Student guard is blocked before assertions by existing `win32@6.0.1` Windows C++ compiler requirement; Chrome attempt hit the same blocker.
- Final analysis: student exit 1, 0 errors/1 warning/27 info; lecturer exit 1, 0 errors/1 warning/157 info. Corrected QA test imports and a missing dashboard parenthesis (minimal Dart parsing prerequisite); retained baseline analysis scope.
- Android Studio Java 25 failed with Gradle 8.14. Process-local Java 21 daemon setting advanced builds without global config changes. NDK 28.2.13676358, platform 36 and Build-Tools 35 installed after a serial retry. Student APK then failed on Flutter ARM64 artifact connection reset, followed by DNS failure (`storage.googleapis.com`). Lecturer's last build failed during the earlier SDK installation. APK passes are not claimed; both need successful reruns.
- User authorized “you can install them”: installed Android Command-line Tools 22.0 from Google's official archive after SHA256 verification. Final doctor recognizes tools but reports some unaccepted licenses. Agent did not accept new licenses.
- User chose “Android emulator”. Available Android 36 AOSP x86_64 image install failed with host connection abort. No AVD created/launched; both Firebase connection probes remain unrun. Earlier device enumeration found no Android targets.
- Changed files, exact attempts, remaining prerequisites and optional manual Git commands: latest checkpoint in [P02 report](../qa/reports/P02.md). Earlier report/tracker edits preserved. Generated desktop/lint migration changes restored to baseline contents; Android compatibility flags retained. No Git mutation, production operation or P03 work.
- P02 remains BLOCKED pending download connectivity, remaining licenses/tool prerequisites and required mobile results; no user approval recorded. All build/install sessions ended or were stopped; no QA emulators started. `git diff --check` exited 0; baseline/index unchanged.

## P02 Android-only resume — 2026-10-03

- User requested: “Skip Windows desktop tests for the student app and focus only on Android mobile tests. Also, retry the downloads and now you have the connections”. This resumes P02, explicitly defers the student Windows host test and removes its C++ compiler prerequisite from the active Android gate. It does not approve P02 or start P03.
- Existing guard assertions are retained and shared with new minimal Android bootstrap probes; no Windows tests deleted or reported passed. Both probes cover only target guards plus seeded Auth/Firestore connection and sign-out, not later-phase attendance journeys.
- Guarded local Firebase harness rerun exited 0: 5/5 passed. Both Android bootstrap probes exited 0: 2/2 substantive checks per app, covering guards and actual synthetic login/server profile read/sign-out. The framework's teardown increments its printed counter separately.
- Normal-entry QA APK builds passed for both apps, including final rebuilds after test dependency changes. Both enforced lock restores pass. Final analysis remains 28/158 baseline findings with no Dart errors and no new probe findings.
- Download recovery: fresh Java 21 Gradle process resolved the stale lookup failure; resumable IPv4/HTTP1.1 curl completed the Android image with Google's SHA1 verification. The incomplete SDK image directory was preserved in ignored QA cache before installing the verified image; SDK Manager recognized it and AVD creation succeeded.
- Device: `crowd_attendance_qa_p02_api36`, Pixel 6 profile, Android 36 AOSP revision 2/x86_64, `emulator-5580`, WHPX acceleration. AOSP Play Services/provider warnings did not prevent the server-backed assertions passing; no physical BLE or normal UI journey claim.
- All QA emulator sessions stopped; final device list empty and ports 8080/9099/4400/5580 had no listeners. No Git mutation or production operation. Index empty; branch/HEAD remain MAIN/a1e8a926094392a2b38f02a0a9205ddb04f77099.
- Final files, commands, limits and manual Git commands: latest Android-only handoff in [P02 report](../qa/reports/P02.md). Technical gate READY_FOR_REVIEW; user approval and P03 start remain absent.

## Handoff record template

- Phase / date / branch / baseline commit:
- Authorized user wording:
- Files and behavior changed:
- Executed commands, exit codes and results:
- Not run / blocked / deferred:
- Report path:
- Technical gate: READY_FOR_REVIEW or BLOCKED:
- Review findings:
- Actual user approval wording/date (leave blank until received):
- Next phase start wording/date (leave blank until received):
- Manual Git commands supplied (not executed):
