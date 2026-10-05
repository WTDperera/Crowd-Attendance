# QA Phase Status

**Created:** 2 October 2026  
**Current authorized phase:** None — QA process complete for the accepted software-only scope

**Last approved phase:** P13

**Implementation status:** P01–P13 approved; final P13 acceptance recorded on 2026-10-05. Physical-device checks remain deferred by user instruction; verification limits and hosted CI retest remain documented.

Read together with [rules](AGENTS.md), [prompts](QA.agent.prompts.md) and [plan](QA.university.essential.plan.md).

| Phase | Status | Start authorization | Review evidence | User approval |
|---|---|---|---|---|
| P01 — Scope, policy and expected results | APPROVED | 2026-10-02: user explicitly started P01; exact wording below | [P01 report](../qa/reports/P01.md), [decisions](../qa/docs/decisions.md), [matrix](../qa/docs/test-matrix.md) | 2026-10-02: “ok I aprove the phase 1 go to the next” |
| P02 — Isolated environment and minimum harness | APPROVED | 2026-10-02: “ok I aprove the phase 1 go to the next”; resumed 2026-10-03 for Android only | [P02 report](../qa/reports/P02.md): harness 5/5; student Android 2/2; lecturer Android 2/2; both final QA APKs build; baseline analysis nonzero; student Windows host test deferred by user | 2026-10-04: “I approve P02. Please start P03” |
| P03 — Role and profile protection | APPROVED | 2026-10-04: “I approve P02. Please start P03” | [P03 report](../qa/reports/P03.md): escalation reproduced before repair; final local suite 15/15; Android profile probe 1/1 per app; normal QA APKs and QA web build pass | 2026-10-04: “I approve P03. Please start P04” |
| P04 — Enrollment and API ownership | APPROVED | 2026-10-04: “I approve P03. Please start P04” | [P04 report](../qa/reports/P04.md): final combined suite 27/27; actual Android enrollment/session permission scenario 1/1 per app; both normal QA APKs and QA web build pass; baseline analysis limits recorded | 2026-10-04: “I approve P04. Please start P05” |
| P05 — Durable multiple scan rounds | APPROVED | 2026-10-04: “I approve P04. Please start P05” | [P05 report](../qa/reports/P05.md): combined suite 34/34; unit 11/11; actual Android persistence 2/2; fresh-process prepare/resume 1/1 each; P04 lecturer probe 1/1; normal lecturer QA APK builds | 2026-10-04: “I approve P05. Please start P06” |
| P06 — Finalization, recovery and corrections | APPROVED | 2026-10-04: “I approve P05. Please start P06” | [P06 report](../qa/reports/P06.md): combined 44/44; unit 11/11; Android P06 1/1, retained P05 2/2 and P04 lecturer 1/1; targeted Dart analysis clean; normal lecturer QA APK builds | 2026-10-04: “I approve P06. Please start P07” |
| P07 — Report and workbook correctness | APPROVED | 2026-10-04: “I approve P06. Please start P07” | [P07 report](../qa/reports/P07.md): final combined 64/64; Android student 3/3, lecturer 1/1; serialized XLSX/formula checks; both normal QA APKs and QA web build pass; analysis limits recorded | 2026-10-04: “I approve P07. Please start P08” |
| P08 — UI components and retained demo features | APPROVED | 2026-10-04: “I approve P07. Please start P08” | [P08 report](../qa/reports/P08.md): combined 94/94; Android student 6/6, lecturer 7/7; retained Android P05 2/2 and pure 11/11; actual form persistence/fault recovery; normal/QA web and both Android APK builds pass; baseline lint limits recorded | 2026-10-04: “I approve P08. Please start P09” |
| P09 — Automated browser and mobile journeys | APPROVED | 2026-10-04: “I approve P08. Please start P09” | [P09 report](../qa/reports/P09.md): clean shared chain lecturer Android 1/1 → Playwright 2/2 → student Android 1/1; eight axe states, two reviewed web screenshots; retained 94/94; both final normal QA APKs and normal/QA web builds pass; native/accessibility/analysis limits recorded | 2026-10-05: “I approve P09. Please start P10” |
| P10 — Security checks and modest load scripts | APPROVED | 2026-10-05: “I approve P09. Please start P10” | [P10 report](../qa/reports/P10.md): security 6/6, harness 4/4, retained 94/94; pinned redacted scans with explicit remaining dispositions; final load 191 requests, three expected failures, zero unexpected errors and reconciled ledger; normal/QA web builds pass | 2026-10-05: “I approve P10. Please start P11” |
| P11 — Test commands and GitHub Actions | APPROVED | 2026-10-05: “I approve P10. Please start P11” | [P11 report](../qa/reports/P11.md): unified suites propagate failures; local workflow validation; retained94+6, unit15+11, Android widget6+7/service1+1+2/shared journey1→2→1; security4+6; load191 requests; builds pass; baseline full lint fails; hosted CI unrun | 2026-10-05: “I approve P11. Please start P12” |
| P12 — Actual demo devices and failure checks | APPROVED — software-only scope | 2026-10-05: “I approve P11. Please start P12” | [P12 report](../qa/reports/P12.md): user said “no need tto do that” to physical-phone checks; E16/E17 and physical E20 deferred, not passed; prior P11 software evidence referenced, no new functional run | 2026-10-05: “I approve P12. Please start P13” |
| P13 — Final regression and submission pack | APPROVED — software-only; QA complete | 2026-10-05: “I approve P12. Please start P13” | [P13 report](../qa/reports/P13.md), [final results](../QA.university.results.md), [demo/reset/recovery](../qa/docs/demo.md): regression101, Android widget13/service4/retained13/shared chain1→2→1; security4+7; load191 requests; builds pass. Physical E16/E17 deferred; broad static nonzero; hosted Java failure repaired locally, retest pending. | 2026-10-05: “I accept P13. The QA process is complete” |

## Status rules

NOT_STARTED → IN_PROGRESS → READY_FOR_REVIEW → APPROVED.
Use BLOCKED where the gate cannot be met. Fixes return to IN_PROGRESS only for the authorized phase.
Only the user's actual approval can produce APPROVED. Record date and the user's wording.
Starting a successor additionally requires an explicit start instruction for that successor.
Do not treat the table itself as a substitute for missing user authorization.

## Approval and start log

2026-10-05 — “I accept P13. The QA process is complete” gives final acceptance of P13 for its recorded software-only scope and closes QA. No successor phase is authorized. Physical/user-deferred checks, static findings, security exceptions and hosted CI retest remain as recorded; acceptance does not convert them into passes.

2026-10-05 — “I approve P12. Please start P13” approves P12's recorded software-only scope and authorizes P13 only. Initial worktree/index clean on MAIN, HEAD `8ccf577d232e9d33be63e7cbfe6471e9c56c813f`; P11/P12 were committed and pushed externally. Physical BLE/native permission/device checks and real-user UAT remain deferred. Final acceptance has not been given.

2026-10-05 — “I approve P11. Please start P12” approves P11 and authorizes P12 only. When asked to connect two Android phones and operate native permission/Bluetooth controls, the user answered “no need tto do that”. Physical-phone verification is therefore deferred at the user's request; the claimed P12 demonstration is narrowed to software-only evidence with simulated radio callbacks. This is neither a physical pass nor approval of P12. P13 remains unauthorized.

## P12 review checkpoint — 2026-10-05

P12 is **READY_FOR_REVIEW for the user-narrowed software-only scope**. [Report, scope decision, verification limits and manual Git commands](../qa/reports/P12.md). E16 native permission/Bluetooth recovery, E17 actual two-phone advertising/scanning and physical/manual E20 are deferred by user instruction. Actual-device restart/network/radio trials remain unrun. Prior approved P11 Android/browser/software persistence and recovery evidence remains historical; no new P12 functional tests were run or inferred from those results.

Read-only adb inventory is empty; QA listener count is zero. Existing normal-entry QA APK hashes were recorded as available artifacts, not fresh builds or installed-phone evidence. MAIN/HEAD/origin remain unchanged; index empty. All 16 pending P11 files are preserved. P12 edits only this tracker and its new report; no application/Git/live-data changes, hosted CI, physical radio trial or participant UAT. P12 approval and a separate P13 start instruction are still required.

2026-10-05 — “I approve P10. Please start P11” approves P10 and starts P11 only. Initial clean worktree/index, MAIN, HEAD `fa1a20f7c1422f649837f9ed945e79ad4e3258fc`; P10 committed externally. Android scope and student Windows deferral persist. P12–P13 remain unauthorized.

## P11 review checkpoint — 2026-10-05

P11 is **READY_FOR_REVIEW**, not approved. [Report, command map, actual results and exact manual inventory](../qa/reports/P11.md). Named categories reuse existing suites; missing/empty files, failed/timed-out children, zero passing results, unsafe flags and physical-device prerequisites fail explicitly. Raw diagnostics stay ignored; CI uploads narrow JSON command summaries only. Pinned Windows jobs and optional prepared-runner Android journey pass local actionlint/PowerShell validation; no hosted execution or runner registration occurred.

Actual retained regression94+6, web unit15, lecturer unit11, bounded property1, React25, API49/rules29/rounds17/integration14/smoke5 pass; counts overlap. Android widget student6/lecturer7 and service1+1+2 pass. Final shared Android→Chromium→Android chain1→2→1 passes with teardown excluded and both normal QA APKs rebuilt. Standalone eight-state axe/two-screenshot check passes. Fresh security harness4/API6 and exact disposition review pass; existing19 identifiers and six package/seven advisory occurrences remain reviewed, not repaired. Local load191 requests has three expected outage failures, zero unexpected errors and reconciled ledger. Normal/QA web builds pass; strict full static command retains10 lint errors/two warnings and does not reach broad Flutter analysis.

Branch/HEAD/origin unchanged, index empty; manual inventory exactly16 files. Owned QA services and agent-started AVD stopped, zero QA listeners, empty adb list. No Git mutation/deployment/live Firebase operation. P12–P13 remain unauthorized; student Windows, physical BLE/native permission/UAT and hosted CI remain unverified/deferred.

## P10 review checkpoint — 2026-10-05

P10 is **READY_FOR_REVIEW**, not approved. [Report, findings, verification and exact manual inventory](../qa/reports/P10.md). Original four malformed-input failures reproduced and repaired; final six API cases and four harness cases pass. Retained local suite 94/94, zero skipped. Gitleaks 8.30.1 / OSV 2.6.0 are checksum pinned: four current/15 historical Firebase client-key identifiers reviewed, no scanned privileged credential exposure found; six package occurrences/seven advisory occurrences remain with explicit scope dispositions. Bundled older SheetJS parser limitations are separately disclosed, not silently treated as patched. No live key validation/restriction or broad audit claim.

Final local repeat: 191 requests, 188 HTTP 200 plus three expected failures during owned API outage, zero unexpected errors. Six-worker mixed workload p95 962.43 ms; paced fault/soak 38.00 s. Rejected atomic commit, lost correction acknowledgement and API restart reconcile exactly one enrollment/class/correction with retained round evidence and correct attendance/absence counters. Normal/QA web builds pass. Mobile/physical/browser journeys were not rerun; student Windows deferral persists. All owned QA services stop; index empty, 25 files in manual inventory, no Git mutation/deployment/live operation. P11–P13 remain unauthorized.

2026-10-05 — “I approve P09. Please start P10” approves P09 and starts P10 only. Android scope and student Windows deferral persist. Initial clean worktree/index on MAIN, HEAD `a5a07b1526e833f87d8714ebae31743bba887b03`; P09 was committed externally. P11–P13 remain unauthorized.

2026-10-04 — “I approve P08. Please start P09” approves P08 and starts P09 only. Android scope and student Windows deferral persist. P10 requires separate approval/start. Initial clean worktree/index, branch MAIN, HEAD `ae72bc90bb1b9d1256fee648c8252e01b8d7e88c`; P08 was committed externally.

## P09 review checkpoint — 2026-10-04

P09 is **READY_FOR_REVIEW**, not approved. [Evidence, verification and exact manual Git commands](../qa/reports/P09.md): normal lecturer Android journey **1/1**, real Chromium **2/2**, normal student Android journey **1/1**. Final clean-fixture repeat uses one persisted class across clients in that order, with no reset between clients. Three simulated scan rounds retain observation counts 2/2/1, completion produces present/absent/left_early, actual browser correction saves Excused and exports [1,0,ex] at 66.67%; student reports agree at A 2/2 and C 1/2. No physical BLE/native permission success is inferred.

Eight loaded web states have zero automatic violations for selected WCAG A/AA tags; seven incomplete contrast rule results remain for manual judgment. Two Windows/Chromium screenshots were reviewed by the agent and compared in three subsequent full passes without updates. Native permission/radio, keyboard/focus/screen-reader and real-user checks remain manual/deferred. Student Windows tests remain deferred. Retained local suite **94/94**, zero skipped; both final normal QA APKs and normal/QA web builds pass. Focused analysis/lint pass; entry-point and prior full-lint baseline findings are recorded, not claimed clean.

Minimal repairs connect the normal session form to durable creation, scope session reads to owned modules, avoid native stop on an idle student broadcaster and fix detected web contrast/filter labels. Rules/backend/attendance policy unchanged. Branch MAIN, HEAD `ae72bc90bb1b9d1256fee648c8252e01b8d7e88c`, origin unchanged; index empty. All owned QA services/AVD stopped, no QA listeners, adb list empty. Manual inventory matches **21** files; no Git mutations/publication/live data operation. P10–P13 remain unauthorized.

2026-10-04 — “I approve P07. Please start P08” approves P07 and starts P08 only. Android scope and student Windows test deferral persist. P09 requires separate approval/start.

## P08 review checkpoint — 2026-10-04

P08 is **READY_FOR_REVIEW**, not approved. [Evidence and exact manual Git inventory](../qa/reports/P08.md): retained local suite 64/64, React components 25/25 and actual form persistence/fault recovery 5/5, combined **94/94**, zero skipped. Student Android 6/6 and lecturer Android 7/7 substantive component/real-service cases pass; retained lecturer Android round persistence 2/2 and pure domain/gate 11/11 pass. Both final normal QA APKs and normal/QA web builds pass. Targeted analysis/lint pass; full frontend lint retains 10 errors/two warnings, detailed in the report.

Repaired portal stale-auth, duplicate submission, direct-edit hook crash and student enrollment stream/context loss; guarded scanner disposal/retry/end controls. Mock portal session routes/providers are excluded per P01 D08. Actual local create/edit/delete, Auth/Firestore partial-failure recovery and refreshed storage are verified. Widget gestures, text and radio callbacks are simulated; jsdom is not a browser. Native keyboard, physical BLE, real-user usability, full journeys, CI/load and final regression remain unrun. Student Windows testing remains deferred. P09–P13 remain unauthorized.

Branch `MAIN`, baseline/current HEAD `807fb6f22710975da5309912f16bd10d36e65152`; origin unchanged. Index empty; no Git mutation, deployment or live data operation. Owned QA processes stopped, QA listener count zero, adb device list empty. Review the report and changes; P09 requires explicit P08 approval and a separate start instruction.

2026-10-04 — “I approve P06. Please start P07” approves P06 and starts P07 only. P08 requires separate approval/start.

2026-10-04 — “I approve P05. Please start P06” approves P05 and starts P06 only. P07 requires separate approval/start.

2026-10-04 — “I approve P04. Please start P05” approves P04 and starts P05 only. Android scope and Windows deferral persist. P06 requires its own approval/start instruction.

2026-10-04 — “I approve P03. Please start P04” approves P03 and starts P04 only. Android scope/Windows deferral persist. P05 requires its own approval/start instruction.

2026-10-04 — “I approve P02. Please start P03” approves P02 and explicitly starts P03 only. P02's Android-only verification and Windows deferral remain the reviewed scope. P04 requires a separate approval/start instruction.

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

P02 was approved on 2026-10-04 with its Android-scoped verification and explicit student Windows deferral. P03 now meets its role/profile gate: Admin-only lecturer provisioning, narrow profile permissions, first-binding and denied-tampering tests. Final combined emulator suite passes 15/15; both Android profile scenarios pass. Baseline frontend lint and full-app mobile analysis findings from P02 remain historical/nonzero; targeted analysis of both new probes has no findings. Enrollment, counter ownership/integrity and broader resource access remain later gates; no complete U2/security closure is claimed.

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

## P03 handoff — 2026-10-04

- Authorization: “I approve P02. Please start P03”; P02 approved, P03 only started.
- Baseline: clean worktree/index, MAIN, HEAD `37b823c40a4e11dc66dff3b0612805d4a16cc2e3` (`test(qa): complete P02 mobile tests and APK builds`), origin `https://github.com/WTDperera/Crowd-Attendance.git`.
- Before repair: student created its own lecturer profile and obtained a portal custom token (HTTP 200). Isolated baseline suite: 6 pass/8 fail. Initial test isolation defects were corrected before relying on that baseline.
- After repair: final combined suite 15/15, zero skipped (P02 5 + P03 10). Android student/lecturer each 1/1 substantive profile scenario; lecturer uses the actual AuthService for first/subsequent login. Targeted probe analysis clean. Normal QA APK rebuilds and QA web build pass.
- Admin provisioning is the only profile-creation path; students cannot promote themselves. Protected identity/role/binding/enrollment fields cannot be edited by ordinary clients; valid first binding and server login timestamps pass. Lecturer presentation edits and existing mobile attendance-count field updates remain allowed.
- Limits: role registry origin must be audited before any future live deployment; current live profiles were not inspected/migrated. Direct enrollment and broad counter ownership/integrity remain P04–P06 work. Device build ID is not proof of unique hardware; reset workflow/physical BLE/UI journeys remain deferred. No new production operations, dependencies or global toolchain configuration.
- Evidence and exact manual verification/Git commands: [P03 report](../qa/reports/P03.md). No staging/commit/push. P03 is READY_FOR_REVIEW, not approved; P04 has not started.

## P04 handoff — 2026-10-04

- Authorization: “I approve P03. Please start P04”; P03 approved, P04 only started.
- Baseline: clean worktree/index, MAIN, HEAD `27274d00b7b1e88ba92047b852b74f0fb849b9cb` (`test(qa): complete P03 role and profile protection`), origin unchanged.
- Before repair: eight focused access scenarios failed; second lecturer export returned 200, direct enrollment-count mutation succeeded, required student queries failed, trusted enrollment was missing, and the student API could mutate a lecturer Auth identity/create a false student profile.
- Changes: trusted transactional password enrollment, secret-free student catalog and server-only hashes, owner report/export guards and module management, actual client query/write permissions, approved global student CRUD with access removal/retry and archived identity. Round/finalization/report calculations remain later gates.
- Final evidence: combined P02/P03/P04 suite 27/27, zero skipped (32.17 s test duration). Android student/lecturer each 1/1 substantive service scenario. Both normal-entry QA APK builds and QA web build pass. Student changed-source/probe analysis and portal targeted lint clean; lecturer analysis reports five existing print infos, no new probe findings. Full baseline lint/analysis not rerun.
- Limits: non-QA Android requires explicit HTTPS API_BASE_URL; live catalog/secret backfill remains unperformed; deletion failure/race coverage is bounded, registration byte/format/reset policy unresolved. No physical BLE, normal UI/browser journey, Windows desktop, deployment or full security/attendance-correctness claim.
- All local QA sessions stopped; final adb list empty and QA ports have no listeners. Index empty; no Git mutations, dependencies or production changes.
- Evidence, exact commands and optional manual Git list: [P04 report](../qa/reports/P04.md), [README](../qa/README.md).
- At this historical checkpoint: technical gate READY_FOR_REVIEW, not approved; P05 was NOT_STARTED. Subsequent P04 approval/P05 start is recorded in the approval log and current table above.

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

## P05 review checkpoint — 2026-10-04

P05 is READY_FOR_REVIEW: durable round/observation identities, immutable eligibility proofs, fail-closed roster loading, retryable packet gate and atomic marking are implemented. Three legitimate rounds retain A's three observations and C's two despite replay; reopening retains r2. Combined local P02–P05 suite passes 34/34, unit tests 11/11, Android persistence scenarios 2/2, restart prepare/resume 1/1 each, retained P04 lecturer probe 1/1, and normal lecturer QA APK builds. New P05 Dart analysis is clean; affected existing files retain 30 informational findings. No physical BLE, transport outage or full finalization/correction closure is claimed. Student Windows tests stay deferred. No Git mutations, live writes or deployment occurred; QA emulators are stopped. See [P05 report](../qa/reports/P05.md) for commands, evidence and limits.

P06 has not started and requires explicit approval/start. No phase approval is inferred from these results.

STOPPED — awaiting your approval of P05 and an explicit instruction to start the next phase.

## P06 review checkpoint — 2026-10-04

P06 is READY_FOR_REVIEW. Completion and owner corrections use bounded atomic API transactions, preserving immutable round evidence while reconciling root/nested outcomes, absences, credited membership and counters. Failed commits remain active/retryable; repeated close preserves corrections. Completed projections and aggregate writes are protected from ordinary clients. The final combined local suite passes 44/44, zero skipped; unit tests 11/11; actual Android P06 1/1, retained P05 2/2 and P04 lecturer 1/1. Targeted Dart analysis is clean and the normal lecturer QA APK builds. See [P06 report](../qa/reports/P06.md) for defect reproduction, commands, historical/bounded-data limits and exact manual Git commands.

Final worktree contains only the phase changes, index is empty, branch/HEAD/remote unchanged. No staging, commit, push, deployment or live writes occurred. Dedicated Android, API and Firebase processes are stopped; adb has no device and QA ports have no listeners. Physical BLE, transport outages and P07 report/workbook reconciliation remain unverified. P07 has not started and requires explicit approval/start.

STOPPED — awaiting your approval of P06 and an explicit instruction to start the next phase.

## P07 review checkpoint — 2026-10-04

The user said “I approve P06. Please start P07”, approving P06 and authorizing P07 only. P07 is READY_FOR_REVIEW: completed eligible class reports share correction/legacy resolution, fixed-roster denominators and Colombo dates; student reads derive identity from the token; workbook builders are separated from downloads and serialized cells/formulas/caches agree with the independent ledger. Raw 80% eligibility is distinct from two-decimal display. Conflicts remain flagged; absent duration evidence does not invent attendance intervals.

Final combined local P02–P07 suite passes **64/64**, zero skipped (44 retained + 20 P07); student Android scenarios **3/3**, lecturer Android **1/1**; both normal main.dart QA APKs and the QA web bundle build. Student targeted analysis is clean; lecturer analysis retains one existing deprecation info. During a roughly 5.75-hour execution gap, one combined rerun failed a retained P06 cached-token request with 401; normal SDK token refresh was added to that test helper, and the final combined retry passed. No application authorization check was weakened. See [P07 report](../qa/reports/P07.md) for reproductions, commands, artifact hashes, legacy/read-snapshot limits and the exact 30-file manual Git list.

No staging, commit, push, live writes or deployment occurred; branch/HEAD/remote remain unchanged and index is empty. QA ports have no listeners, adb has no device, and the owned API/Firebase/Android QA processes are stopped. UI journeys, physical BLE, capacity/load, CI and final full regression remain unrun; student Windows tests remain deferred. Earlier phase reports/checkpoints above are historical evidence. P08 has not started and requires explicit approval/start.

STOPPED — awaiting your approval of P07 and an explicit instruction to start the next phase.

## P13 final review checkpoint — 2026-10-05

P13 is **READY_FOR_REVIEW for the approved software-only scope**. Retained permission/integrity checks and a fresh final-code synthetic journey pass. [Final results](../QA.university.results.md) maps all E01–E23:21 IDs with passing implemented software assertions, zero final failed/blocked software IDs, two physical-only IDs user-deferred. This does not pass physical/manual portions of E18/E20/E23, actual phones or UAT.

Final regression94+7=101; units15 web/11 lecturer; bounded property1; Android widgets6+7, service1+1+2, retained probes13 including separate-process prepare/resume; shared journey lecturer1→Chromium2→student1. Normal/QA web and both final normal-entry Android APK builds pass. Security fresh scans/review:19 reviewed client identifiers, six vulnerable package/seven advisory occurrences, zero unmatched; harness4/API7 pass. Load191 requests, three expected outage failures, zero unexpected errors, reconciled ledger; mixed p95 158.14ms, short soak36.639s. Suite aliases/counts overlap.

Full static remains nonzero: frontend10 errors/two warnings; student analysis0 errors/one warning/27 infos; lecturer0 errors/one warning/49 infos. Public hosted run37236446839 failed at Java setup before application tests. P13 repairs all four selectors to the exact same-build catalog version21.0.11+10.0.LTS; local resolver/actionlint pass, corrected hosted rerun pending user's publication. A mobile emulator exit/timeout and first journey cold-start probe failure are recorded failed attempts; complete retries pass. Android startup now uses the existing bounded read-only readiness guard, with unchanged target/write restrictions.

Owned QA services/AVD stopped; zero QA listeners and empty adb list. BranchMAIN/HEAD8ccf577d232e9d33be63e7cbfe6471e9c56c813f/origin unchanged; index empty. Nine-file manual inventory in the report excludes generated material. No agent Git mutation, deployment, publication or live Firebase operation. Final acceptance has not been given.

**STOPPED — awaiting final user acceptance of P13.** There is no successor phase.
## Final acceptance and closure — 2026-10-05

P13 is **APPROVED** and the QA process is **COMPLETE for the accepted software-only scope**, by the user's explicit “I accept P13. The QA process is complete”. Earlier review checkpoints below/above are historical; their pending-approval wording does not override this acceptance.

Prior P13 implementation was committed externally at `31d08103e5fa7afc50a2d39f6105c44e1a9f7beb` (`docs(qa): complete P13 final regression and submission pack`). Closure began with a clean worktree/index on MAIN; origin remains `https://github.com/WTDperera/Crowd-Attendance.git`. Only this tracker, the final results document and P13 report were updated. No application/test changes, new test/scan runs, agent Git mutations, deployment or publication occurred. Scan hashes remain evidence for the preceding reviewed snapshot. Optional three-file manual Git commands are in the report.

**CLOSED — final P13 acceptance recorded.** No further QA work or successor phase is authorized.