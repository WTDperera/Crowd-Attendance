# Crowd Attendance — QA/QC Plan and Developer Guide

**Version:** 1.0  
**Prepared:** 2 October 2026 (Asia/Colombo)  
**Code baseline reviewed:** `f13d6bc`  
**Status:** Planning and static assessment complete; implementation and test execution pending.  
**Scope:** Student app, lecturer app, admin portal, Express API, Firebase access rules, data flows, administrative scripts, and delivery configuration.  
**Constraint:** Real-user testing is deferred to a future phase. Synthetic accounts, automation, developer exploratory testing, and developer-operated physical devices are in scope.

## 1. Purpose and recommended industry approach

Use a **risk-based Software Testing Life Cycle (STLC), integrated into development**, with traceability from requirements to risks, tests, defects, and release evidence. Start with the areas where failure could expose records or produce incorrect attendance.

There is no single mandatory industry method for every project. This plan adopts ISTQB testing principles and lifecycle activities, supported by security and accessibility verification references. It is a tailored engineering plan, not a claim of certification or standards compliance.

QA prevents defects through clear requirements, architecture and code reviews, reproducible environments, and change controls. QC detects defects through static analysis, automated tests, manual exploration, and measured results. Both are required.

The testing cycle is: analyze requirements and risks → plan → design cases and data → prepare environments → execute → report and fix defects → retest and regress → assess completion. Repeat it for each implementation phase. Define entry and exit criteria and keep blocked or deferred work visible. The process basis is [ISTQB CTFL v4.0.1](https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf).

Use these additional references:

| Reference | Application to this project |
|---|---|
| [OWASP ASVS 5.0.0](https://github.com/OWASP/ASVS/tree/v5.0.0) | Select and track applicable web/API controls, initially targeting applicable Level 2 requirements for authentication, authorization, validation, data protection, and logging. Record omissions; do not claim full ASVS verification. |
| [OWASP MASVS](https://mas.owasp.org/MASVS/) | Mobile authentication, local storage, network communication, platform interaction, and privacy checks. |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Target applicable A/AA web criteria with automated and developer manual checks. Automation alone cannot establish conformance. |
| [Firebase rules testing](https://firebase.google.com/docs/firestore/security/test-rules-emulator) | Exercise real client permission behavior in the Firestore emulator. Admin SDK integration tests are separate because server libraries bypass Firestore rules. |
| [Flutter testing guidance](https://docs.flutter.dev/testing/overview) | Combine unit, widget, and integration tests; add device testing for native BLE behavior. |

Most tests should be fast unit/component tests, supported by service/rules integration tests and a smaller set of critical end-to-end journeys. Do not impose an arbitrary percentage split. Select tests according to failure risk and the boundary they must exercise.

## 2. What was assessed and what has actually run

### Repository inventory

| Area | Actual implementation and important files |
|---|---|
| Student Flutter app | `student_app/lib/main.dart`: Firebase login, device binding, BLE advertising. `services/module_service.dart`: enrollment. `services/attendance_stats_service.dart`: evidence reconciliation and statistics. |
| Lecturer Flutter app | `lecturer_app/lib/services/auth_service.dart`, `device_service.dart`, `module_service.dart`, `session_service.dart`; `screens/scanner_screen.dart`: BLE scanning and rounds. |
| Admin portal | React 19, Vite 7, Firebase client SDK, Axios, spreadsheet export. Routes in `web_app/admin-portal/frontend/src/App.jsx`; services, contexts, and pages under `src/`. |
| API | Express 5, Firebase Admin SDK; `web_app/admin-portal/server/index.js`, `middleware/verifyFirebaseToken.js`, routes for login, students, modules, attendance/reporting. |
| Firestore rules | `web_app/admin-portal/firestore.rules`. Repository contents were reviewed; deployed rules were not inspected. |
| Data stores | Firebase Auth; `students`, `lecturers`, `modules`, `active_sessions`, nested session `attendance`, `attendance_records`, `absence_records`, nested student `enrollments`. |
| Operational scripts | `scripts/firestore/*.js`, server `scripts/createLecturer.js`, root `update_firebase_hashes.dart`. Treat them as privileged data-changing tools. |
| Platform scaffolding | Android/iOS and other generated Flutter platform folders exist. Their presence does not establish supported production platforms. Android is the first proposed mobile target; iOS requires separate validation. |

The root README describes an older/simpler attendance flow and makes production-readiness and anti-spoofing claims. The current implementation includes multiple scan rounds, pending/left-early states, separate absence records, manual corrections, and several reporting paths. Use source behavior plus agreed requirements as the test basis; correct outdated documentation.

### Baseline evidence

| Check | Result on 2 October 2026 |
|---|---|
| Working tree before documentation | Clean; baseline commit recorded above. |
| JavaScript syntax | `node --check` passed for 12 JavaScript files under the API/server and Firestore scripts. This proves parsing only. |
| Test inventory | No project-specific Dart test/integration_test suite, frontend test suite, API test suite, or CI workflow found in tracked files. Generated native RunnerTests exist; inspected iOS example is a placeholder. |
| API test command | Existing `npm test` is the placeholder that exits with an error; it is not a test suite. |
| Frontend scripts | Existing dev, build, lint, preview scripts; no test script. |
| Local dependencies | Frontend/server `node_modules` absent. |
| Local tooling | Node v26.3.1, npm 11.16.0, Java executable found. Flutter, Dart, Firebase CLI not found on PATH. Pin a supported project toolchain during Phase 1; do not assume this Node version is the team baseline. |
| PowerShell | `npm` resolves to a policy-blocked PowerShell script; `npm.cmd` works. Use `npm.cmd`/`npx.cmd` on this workstation instead of changing execution policy. |
| Firebase configuration | No tracked Firebase CLI config, emulator config, or index manifest found. Mobile Firebase initialization currently uses default app configuration. |
| Not executed | Dependency installation, lint, builds, unit/integration/E2E tests, emulator tests, dependency vulnerability scans, load tests, real-device tests, deployed-environment checks, UAT. |

**No functional pass rate, coverage percentage, security clearance, or production approval is established by this assessment.** No live accounts or database records were changed.

## 3. Scope and feasibility without real users

| Activity | Current plan | Limitation |
|---|---|---|
| Requirements review, static analysis, code/configuration review | Do now | Business decisions still need an owner; document provisional assumptions. |
| Unit, widget/component, API, Firestore rules tests | Implement now | Needs tooling, dependency injection, isolated data. |
| Browser E2E and cross-client data consistency | Implement now | Synthetic accounts; emulator wiring needed first. |
| Security negative tests and dependency/secret scans | Implement now | Run attacks only against isolated QA systems. |
| Accessibility and usability inspection by developers | Do now | Cannot establish real-user experience or replace participant testing. |
| Load, concurrency, failure recovery | Implement now | Synthetic backend load does not simulate classroom radio conditions. |
| Physical BLE tests operated by developers | Do when devices are available | At least one advertising-capable student phone and one scanner phone; record model and OS. No real users required. |
| iOS build and BLE tests | Conditional | Requires macOS/Xcode, signing/configuration, and suitable iPhones. Windows alone is insufficient. |
| Staging deployment, indexes, backup/restore rehearsal | Conditional | Dedicated QA infrastructure and access required. Do not use production data. |
| Real-student/lecturer UAT, interviews, surveys, classroom pilot | **Deferred — Phase 8** | Not part of current completion criteria. Retain a future checklist and owner. |

If hardware or staging access is unavailable, mark affected cases **Blocked — environment**, not Passed. Continue all independent automated and review work. Simulator success does not validate BLE range, interference, background restrictions, or actual device identity.

Desktop and Flutter-web delivery are not assumed merely because scaffold folders exist. Confirm intended support in Phase 0; expand the compatibility matrix if required.

## 4. Initial risk register grounded in the source

Scores below are proposed triage priorities: likelihood 1–5 × impact 1–5. Scores 20–25 are P0, 12–19 P1, 6–11 P2, 1–5 P3. Likelihood is an assessment, not an observed incident rate. Separate a confirmed source property from a reproduced runtime defect.

| ID / score | Source evidence and risk | Required investigation / acceptance |
|---|---|---|
| R01 — P0 / 25 | Rules allow a signed-in user to write `lecturers/{ownUid}`; `requireLecturer` and portal auth trust existence of that profile. Static privilege-escalation path. | A student cannot create or confer lecturer authority, then obtain portal/API access. Reproduce in emulator; restrict trusted role provisioning independently of profile editing. |
| R02 — P0 / 25 | Rules omit nested session attendance, absence records, and student enrollments; root attendance updates are denied. Lecturer service writes/updates these paths; student services need module and attendance reads denied by current ownership rules. | Build a complete operation/role matrix; legitimate mobile workflows must pass without broadening access to unrelated records. |
| R03 — P0 / 20 | Student rules permit unrestricted own-document writes, including device and attendance-related fields; lecturers can read/write all students. API student management checks lecturer existence but not a narrower administrative scope. | Deny unauthorized binding reset, counter changes, identity changes, and enrollment bypass. Decide lecturer versus administrator privileges before narrowing access. |
| R04 — P0 / 20 | `SessionService.markAttendance` queries for an existing record then batches a new random-ID record and counters; this is not one transaction. | Concurrent/replayed writes must create one logical result per student/session and one detection per scan round. Test two clients, delayed callbacks, and retries. |
| R05 — P0 / 20 | `endSession` adjusts left-early counters before the completed-session guard; absence finalization follows the completion transaction. | Repeated/concurrent end calls do not decrement twice. Failure between stages is recoverable and does not leave a completed session with unfinished absences. |
| R06 — P1 / 16 | Scanner allows processing when enrollment cache is null; adds regNo to round cache before database/write success. Subscriptions and asynchronous stop/dispose need lifecycle verification. | Enrollment loading failure must fail closed; transient write failure must permit a safe retry; repeated start/stop must not multiply callbacks or rounds. |
| R07 — P1 / 16 | Both mobile login implementations use `androidInfo.id`. Package documentation identifies it as a build label/changelist, not a unique handset identifier. | Redesign the binding requirement and verify same-build phones, reinstall/update, missing ID, simultaneous first login, and reset authorization. See [package API reference](https://pub.dev/documentation/device_info_plus/latest/device_info_plus/AndroidDeviceInfo/id.html). |
| R08 — P1 / 16 | Student broadcasts registration-number bytes; scanner accepts the identifier after database lookup. No packet freshness or cryptographic sender proof was observed. | In an isolated lab, replay/impersonation must be tested. UUID filtering, encoding, and RSSI do not prove identity or classroom presence. Define an acceptable security design before making anti-fraud claims. |
| R09 — P1 / 16 | Student statistics, API summaries, manual marking, and Excel export reconcile current/legacy records differently. Multiple cached counters exist. | Use one agreed status truth table and independent fixtures; all views and exports agree after edits and retries. |
| R10 — P1 / 12 | Auth account create/update/delete and Firestore profile operations in `routes/students.js` are sequential. | Inject a failure after each step; no orphaned account/profile or misleading success. Design compensation/reconciliation and repeatable retries. |
| R11 — P1 / 12 | Routed AddSession/EditSession pages use `ModulesContext`, initialized from mock data. | Create/edit must persist through refresh and appear across clients, or explicitly remove/label unsupported routes from the release scope. Do not count mock-only success as integration coverage. |
| R12 — P1 / 12 | No automated regression harness, emulator wiring, index manifest, or CI gate found. API initializes credentials and listening during startup. | Reproducible clean-environment checks, injectable dependencies, testable Express app, fail-closed emulator setup, and checked-in index requirements. |
| R13 — P1 / 12 | Session finalization builds writes over attendance records in one batch; reports load potentially large collections. | Test request/write limits, growth, latency, retry cost, and resumable chunking if needed. Do not infer capacity from small fixtures. |
| R14 — P1 / 12 | Operational seed scripts use Admin SDK; module seed path can create metadata without ownership. | Explicit QA project guard, dry-run, validated fixtures, owner fields, idempotency and recovery; never run old scripts blindly as test setup. |
| R15 — P2 / 9 | iOS Info.plists reviewed lack Bluetooth usage-description keys; platform support is not demonstrated. Android runtime permission behavior varies. | Verify native configuration and build/permission behavior for each declared supported platform. |
| R16 — P2 / 9 | BLE logs print identifiers, names, and email; login messages can distinguish account conditions; frontend contains server-oriented dependencies. | Check sensitive logging, enumeration/rate controls, dependency/bundle contents, and secret handling. Package presence alone is not evidence a secret shipped. |

R01–R06 require priority implementation. R07/R08 are security-design gaps, not issues that can be solved solely by adding tests. Do not relax rules globally to make mobile tests pass.

## 5. Requirements and expected-result decisions

Create `Developer Guide/QA/requirements.md` and a decision log in Phase 0. The technical lead owns decisions until a product owner is assigned. These decisions do not require recruiting real users.

| Decision | Proposed basis for planning | Must be resolved before |
|---|---|---|
| Roles | Student, lecturer, and trusted provisioning operator are distinct. The portal currently treats lecturers as its privileged users. Decide whether all lecturers may globally manage students or a separate admin role is needed. | Access-control fixes |
| Attendance rule | A student detected in all successfully completed rounds becomes present; some rounds becomes left_early; none becomes absent. Empty/failed/cancelled rounds and late arrival require an explicit rule. | Attendance assertions |
| Manual correction | Only authorized session owner/operator; record actor, reason, timestamp, before/after values. Repeat identical correction has no additional effect. | Correction tests |
| Excused / late | Current export counts excused as present; summary helper mentions late. Confirm whether both count toward eligibility and how legacy late values normalize. | Cross-view reporting oracle |
| Eligibility threshold | Portal export highlights below 80%; confirm threshold, rounding, and display policy. | Boundary tests |
| Enrollment history | Decide whether attendance eligibility uses enrollment at session start or the current roster. Test later enrollment/removal and historical reports. | Absence/report tests |
| Time | Store consistent timestamps; proposed institutional display/date boundary is Asia/Colombo. Test clients and server in other zones. | Date filtering/export |
| Registration numbers | Define canonical case, whitespace, maximum length, character set, uniqueness and change policy, including BLE byte budget. | Account/BLE validation |
| Session lifecycle | Decide zero-round close, abandoned sessions, reopen/edit after close, and whether multiple active sessions per module are allowed. | Lifecycle integration |
| Device binding | Define identity, authorized reset, reinstall and replacement behavior; a build ID cannot fulfill unique-phone identity. | Binding changes |
| Retention and deletion | Define retention of historical attendance when student/module is deleted, export access, log redaction, and backup retention. | Destructive-operation acceptance |
| Platforms and capacity | Confirm supported OS/browser/device versions, expected class size, concurrent sessions, and largest export. Initial load profiles below are engineering probes. | Compatibility/performance sign-off |

Tests against unresolved policy remain **Blocked — requirement**. Characterization tests may document existing behavior but must not turn a known flaw into the acceptance rule.

### Data invariants

1. Each student/session has exactly one effective final attendance outcome; duplicate physical documents must not inflate it.
2. A completed session's present and absent totals reconcile with the eligible roster under the agreed excused/left-early policy.
3. An effective present student has no conflicting active absence result. Correction removes or supersedes conflicting evidence consistently.
4. Counters are nonnegative, reproducible from canonical evidence, and unaffected by replay or repeated completion.
5. One student contributes at most once per valid scan round. Duplicate advertisements are not additional attendance.
6. Completed sessions reject new scan writes; permitted administrative corrections use the controlled correction path.
7. User/role identity and ownership cannot be changed through an untrusted client write.
8. Enrollment updates are atomic and idempotent; counters and nested enrollment records remain consistent.
9. One normalization policy handles `module_id/module_code/module` and `student_uid/student_id`; legacy data cannot cross ownership boundaries.
10. Expected percentages use an independent calculation, including an explicit zero-denominator rule. Tests must not call production calculation code to generate their expected values.

## 6. Test architecture and implementation tools

| Layer | Proposed tools | What it proves |
|---|---|---|
| Static checks | ESLint, Dart analyzer/formatter, Node syntax checks, repository secret scanner, package dependency audit | Source/configuration hygiene; not runtime correctness |
| React logic/components | Vitest, React Testing Library, user-event, jsdom; MSW where HTTP behavior is mocked | Form validation, auth loading/error states, interactions, formatting |
| API unit/integration | Node built-in test runner and Supertest; injected Auth/Firestore adapters; emulator-backed integration | HTTP contract, validation, authorization, transaction behavior and failures |
| Firestore rules | `@firebase/rules-unit-testing` with the client SDK and Firebase Emulator Suite | Real allow/deny behavior, field restrictions, queries and atomic writes |
| Flutter unit/widget | `flutter_test`, fake repositories, fake clock, fake BLE stream; add a mocking library only where useful | Parsing, domain logic, UI states, lifecycle, deterministic retries |
| Flutter integration | `integration_test` with QA Firebase configuration | App/service wiring; native BLE still needs physical devices |
| Browser E2E | Playwright | Login, durable CRUD, corrections, report/export, route protection across browsers |
| Accessibility | axe-core integration plus keyboard/screen-reader/manual review | Automated rule findings plus manual semantics, focus and error handling |
| Load/resilience | k6 for API traffic plus a deterministic synthetic scan-event harness | API/data throughput, contention, failure recovery; not radio performance |
| Security | Dependency and secret scanning, selected OWASP control tests, ZAP against QA deployment | Evidence for specific controls; not a blanket security guarantee |

Check and pin compatible tool versions in Phase 1. Do not upgrade production dependencies indiscriminately to accommodate a test framework. [Vitest](https://vitest.dev/guide/) supports the Vite-based test approach; [Playwright](https://playwright.dev/docs/writing-tests) supplies isolated browser tests and assertions.

### Required testability changes

- Export Express app creation without calling `listen`; keep the production entry point separate. Inject Auth, Firestore, external identity verification, and clock where needed.
- Make `firebaseAdmin.js` support explicit emulator initialization without production service-account credentials. Preserve production initialization separately.
- Route login verification to the Auth emulator in QA mode; the present Identity Toolkit URL is hard-coded to the live service. Test missing/malformed QA configuration fails before any network call.
- Add explicit web and mobile QA bootstrap configuration connecting Auth and Firestore before services/listeners start. Do not silently fall back to production.
- Extract BLE payload codec, round tracking, attendance state transitions, normalization, and report calculations into testable units. Use small changes with regression protection.
- Inject mobile auth/data/device/BLE providers. The current singleton-style session service and monolithic student login/broadcast code make isolated testing difficult.
- Implement idempotent write boundaries, round IDs, and recoverable completion only after requirements are recorded; keep client, API and rules contracts aligned.
- Make export workbook construction testable independently from triggering the browser download.
- Use dependency fakes for deterministic error branches and real emulator integration for database/rule semantics. A fake Firestore is not a rules test.

### Proposed repository layout

These paths are a target for implementation; only this plan is delivered in the planning task.

```text
Developer Guide/
  QA plan.md
  QA/
    requirements.md
    decisions.md
    risk-register.md
    traceability.csv
    test-cases.md
    defects.md
    deferred-validation.md
    test-summary.md
qa/
  package.json
  firebase.json
  firestore.indexes.json
  fixtures/
  rules/
  integration/
  e2e/
  load/
  scripts/
web_app/admin-portal/server/test/
web_app/admin-portal/frontend/src/**/*.test.jsx
student_app/test/
student_app/integration_test/
lecturer_app/test/
lecturer_app/integration_test/
```

Use the existing rules file as the single source; point QA Firebase configuration to it. Do not maintain an untracked second rules copy. Record index definitions with the deployable configuration. Store generated reports as CI artifacts, not as source fixtures.

## 7. Environments, isolation, and synthetic data

### Environments

| Environment | Use | Required controls |
|---|---|---|
| Unit/component | Fast local/PR checks | No production services; fixed clock/seed; deterministic fakes |
| Local emulators | Auth, rules, API/data and browser integration | Project ID `demo-crowd-attendance-qa`; explicit host settings; no production credentials |
| QA staging | Indexes, hosting, network/TLS, IAM, realistic latency, restore checks | Separate Firebase project and synthetic accounts; controlled credentials and budgets |
| Device lab | Mobile release build and BLE checks | QA app configuration, synthetic identities, device/OS inventory |
| Production | Outside this implementation testing scope | No destructive tests, load tests, data seeding, or fault injection |

The emulator startup must verify the demo project ID and both emulator endpoints, and abort if either is missing. Keep Admin SDK credential material out of test fixtures and client bundles. Client Firebase configuration values are not equivalent to service-account private keys.

Android emulators, browsers, and physical phones may require different emulator host addresses. Document the mapping; use a controlled LAN for phone access and never expose local emulators publicly. For external REST calls, reject unexpected hosts in QA tests.

Reset test data between cases/suites and use unique namespaces for parallel workers. Privileged seeding is allowed only during setup; permission assertions must execute as actual synthetic client identities. Prevent fixture cleanup from targeting any non-QA project.

### Required fixture packs

| Pack | Contents |
|---|---|
| Identity | Anonymous, student A/B, lecturer A/B, authenticated user without profile, disabled account, expired/invalid token, removed lecturer profile, missing device ID |
| Small oracle | Two modules with different owners; six synthetic students; three completed sessions; present, absent, excused, left_early, pending and legacy records |
| Enrollment | Valid/wrong password, disabled enrollment, duplicate enrollment, student outside roster, late enrollment, deleted module |
| Corrupt/legacy | Missing fields, mixed case, UID aliases, duplicate root records, orphan records, conflicting absence/presence, inconsistent nested versus dotted counter fields |
| Time | Midnight in Colombo versus UTC, end-of-month/year, leap-day fixture, null server timestamp, reversed ranges and date-only filters |
| BLE | Wrong UUID/company ID, empty/truncated/oversized bytes, nulls, non-ASCII input, unknown regNo, duplicate burst, delayed/out-of-order event, replay from another transmitter |
| Load | 30/100/300-student classes; 1/5/10 concurrent sessions; 500-student × 100-session export; duplicates and failure/retry traffic |

Use fabricated addresses such as `student-a@example.invalid` and fixed IDs. Do not copy personal records. Capture a small expected-results ledger by hand and review it independently.

**Example reporting oracle:** assuming excused counts as present and each of three sessions is eligible, values `[1, 0, ex]` produce 2 presents, 1 absence, 66.67%. All UIs and the workbook must agree. This is a proposed policy fixture pending Phase 0 confirmation.

## 8. Coverage catalogue and initial traceability

Each row expands into separate positive, negative, boundary, and recovery cases. Owner roles: **API** = backend developer, **WEB** = frontend developer, **MOB** = mobile developer, **QA** = test owner, **OPS** = environment/release owner. One person may hold several roles, but record who reviewed critical results.

| Case family / requirement | Risk / priority | Scenario and expected result | Layer / owner / phase |
|---|---|---|---|
| TC-AUTH-01 / REQ-ACCESS | R01 / P0 | Valid lecturer login succeeds; student, profile-less and disabled accounts cannot enter portal or protected APIs. | API + browser / API / 2 |
| TC-AUTH-02 / REQ-ACCESS | R01 / P0 | Student attempts own lecturer-profile creation and then API access; role grant and access denied. | Rules + API / API / 2 |
| TC-AUTH-03 / REQ-ACCESS | R03 / P0 | Missing, malformed, expired, wrong-project token rejected; removed role loses protected access; verify agreed revocation behavior. | API / API / 2 |
| TC-AUTH-04 / REQ-BIND | R07 / P1 | First/same/different device; concurrent first login; shared build ID; unknown ID; update/reinstall; authorized reset. No unintended rebinding. | Unit + device / MOB / 3,6 |
| TC-AUTH-05 / REQ-ACCESS | R12 / P1 | Reload/logout/token refresh/backend timeout and password reset. No protected-data flash, stale user state or unintended email delivery in QA. | Component + E2E / WEB / 4 |
| TC-RULE-01 / REQ-ISOLATION | R02 / P0 | Execute every documented client collection/query/read/write using each role; valid operations pass, all forbidden ones fail. | Rules / API / 2 |
| TC-RULE-02 / REQ-ISOLATION | R03 / P0 | Alter counters, binding, UID, module/session owner, enrollment array or immutable identity fields directly. Denied except authorized narrow transitions. | Rules / API / 2 |
| TC-RULE-03 / REQ-ISOLATION | R02 / P0 | Nested attendance, absences and enrollments work for permitted actors; unrelated users cannot list/query/read them. | Rules / API / 2 |
| TC-API-01 / REQ-ISOLATION | R03 / P0 | Lecturer B guesses lecturer A's module/session/record IDs for reads, exports and correction. No disclosure or mutation. | API / API / 2 |
| TC-STU-01 / REQ-IDENTITY | R10 / P1 | Create/edit invalid, duplicate and case-variant regNo/email; unknown UID update/delete. Clear errors and no phantom profile. | API + E2E / API / 4 |
| TC-STU-02 / REQ-IDENTITY | R10 / P1 | Fail Auth or Firestore create/update/delete step; retry restores consistency without orphan or duplicate. | Integration / API / 4 |
| TC-MOD-01 / REQ-MODULE | R03,R11 / P1 | Create same normalized code twice, edit ownership, delete used module. Preserve history and apply agreed ownership/collision policy. | Rules + E2E / WEB / 4 |
| TC-ENR-01 / REQ-ENROLL | R02,R03 / P0 | Correct/wrong/blank password, disabled module and direct-write bypass. Only validated enrollment succeeds. | Rules + integration / MOB / 2,4 |
| TC-ENR-02 / REQ-ENROLL | R04 / P1 | Concurrent duplicate enroll; module deleted/disabled mid-request. One enrollment/count change or safe rejection. | Integration / MOB / 4 |
| TC-SES-01 / REQ-SESSION | R11 / P1 | Portal session create/edit survives refresh and appears to another client; mock-backed behavior cannot satisfy this case. | E2E / WEB / 4 |
| TC-SES-02 / REQ-SESSION | R05 / P0 | Empty/zero-round session, invalid times, close twice, simultaneous close, scan after close. Correct state/counters and no late unauthorized write. | Unit + integration / MOB / 3 |
| TC-BLE-01 / REQ-DETECTION | R06 / P1 | Denied/permanently denied permission, Bluetooth off/unsupported, interrupted scan, automatic timeout. Truthful UI and no phantom successful round. | Widget + device / MOB / 3,6 |
| TC-BLE-02 / REQ-DETECTION | R06,R08 / P1 | Malformed packet variants, unknown student, wrong service/company, enrollment still loading. No crash or false attendance. | Unit + integration / MOB / 3 |
| TC-BLE-03 / REQ-DETECTION | R04,R06 / P0 | Repeat same advertisement 100 times in one round, then detect in next round. Exactly one increment per round. | Unit + integration / MOB / 3 |
| TC-BLE-04 / REQ-DETECTION | R06 / P0 | First write fails; later advertisement retries. Event eventually persists once, not silently discarded by cache. | Integration / MOB / 3 |
| TC-BLE-05 / REQ-DETECTION | R06 / P1 | Start/stop/resume, background/foreground, navigation/dispose and process restart. No duplicate subscription, post-dispose update or hidden scan. | Widget + device / MOB / 3,6 |
| TC-BLE-06 / REQ-ANTI-FRAUD | R08 / P1 | Replay another synthetic student's payload and transmit from outside agreed presence area. Compare with explicit security requirement; record unmitigated acceptance as a gap. | Isolated lab / QA / 6 |
| TC-ATT-01 / REQ-ATTENDANCE | R04 / P0 | Two clients mark same student simultaneously with retries. One logical result; counters and round evidence reconcile. | Emulator integration / MOB / 3 |
| TC-ATT-02 / REQ-ATTENDANCE | R05 / P0 | All/some/no valid rounds, interrupted round, late entrant. Match the approved status table. | Unit + integration / MOB / 3 |
| TC-ATT-03 / REQ-RECOVERY | R05 / P0 | Inject failure after each close stage; restart and retry. Completion is recoverable, absences finalized, no double decrement. | Integration / MOB / 3 |
| TC-ATT-04 / REQ-CORRECTION | R09 / P0 | Present→Absent→Excused→Present, same state twice, simultaneous edits. Reconcile record stores/counters; preserve correction audit. | API + integration / API / 3,4 |
| TC-ATT-05 / REQ-RECOVERY | R04,R05 / P0 | Network loss while recording/ending and later reconnect. Pending UI stays distinct from confirmed success; replay does not corrupt totals. | Integration + device / MOB / 3,6 |
| TC-REP-01 / REQ-REPORT | R09 / P0 | Student view, lecturer view, dashboard, module/session report and export consume identical oracle pack; effective outcomes agree. | Cross-client integration / QA / 4 |
| TC-REP-02 / REQ-REPORT | R09 / P1 | Legacy aliases, duplicate/conflicting records, changed roster, zero sessions, 79.99/80/80.01% and rounding boundaries. Follow approved precedence. | Unit + integration / API / 4 |
| TC-EXP-01 / REQ-EXPORT | R09 / P1 | Empty/one/many sessions; columns beyond Z; date range; duplicate dates; 1/0/ex values. Workbook totals/formulas/cached values match oracle. | Unit + E2E / WEB / 4 |
| TC-EXP-02 / REQ-EXPORT | R09 / P1 | Input beginning =,+,-,@ remains literal data; exported fields have no executable user-supplied formulas; authorized download only. | Unit + E2E / WEB / 4 |
| TC-TIME-01 / REQ-TIME | R09 / P1 | Run with UTC and Colombo clients/server, midnight and inclusive date filters. Same intended institutional session date/results. | Unit + integration / QA / 4 |
| TC-UI-01 / REQ-USABILITY | R11 / P2 | Keyboard navigation, labels, focus after modal/error, contrast, zoom, small viewport, text scaling and empty/loading/error states. No blocked core task. | Component + manual / WEB,MOB / 5 |
| TC-SEC-01 / REQ-SECURITY | R08,R16 / P1 | Malicious input/XSS, body-size abuse, login abuse/enumeration, CORS/headers, secret/log/bundle scan and dependency audit. Track findings with exploitability and fixes. | Static + QA DAST / QA / 5 |
| TC-PERF-01 / REQ-CAPACITY | R13 / P1 | Class/export/concurrent-session profiles; measure p50/p95/p99, errors, writes, cost and reconciliation. No lost/duplicate attendance. | Load / QA / 5 |
| TC-OPS-01 / REQ-OPERATIONS | R12,R14 / P1 | Seed twice, interrupted migration, malformed seed and wrong-project target. Safe abort/dry-run, repeatable state and recoverability. | Integration / OPS / 5 |
| TC-OPS-02 / REQ-OPERATIONS | R12 / P1 | Fresh install, env validation, index-required queries, release build, staging deploy and restore/rollback rehearsal. Reproducible and evidenced. | Staging + build / OPS / 6,7 |

Use a CSV with these columns in Phase 0: `requirement_id,risk_id,test_id,component,priority,layer,owner,phase,automation_path,status,evidence,defect_id`. Start every executable case as Not run. Report many-to-many coverage explicitly rather than treating this catalogue as executed tests.

### Test design techniques

| Technique | Project use |
|---|---|
| Equivalence partitioning | Valid/invalid identity, roles, packet formats, enrollment states |
| Boundary values | Empty/max-length regNo, threshold percentages, date limits, zero/one/many sessions, configured batch-size edges |
| Decision tables | Role × resource ownership × operation; enrollment enabled × password validity × previous enrollment |
| State transitions | Login/binding, scan rounds, pending/present/left_early, close/retry/correction |
| Pairwise combinations | Browser/viewport and device/OS/permission combinations after mandatory high-risk combinations |
| Property-based tests | Counters never negative; repeating an idempotent event preserves state; duplicate evidence does not change totals |
| Fault injection | Auth, Firestore, network and application failures between multi-step operations |
| Exploratory charters | 30–60 minute developer sessions with a clear goal, notes, evidence and reported defects |

## 9. Nonfunctional targets and device matrix

These are **proposed initial engineering targets**, to be agreed and calibrated in Phase 0/1. They are not existing measurements or industry-mandated numbers.

| Measure | Proposed target / method |
|---|---|
| Data correctness | Zero duplicate effective outcomes, counter drift or lost confirmed records in deterministic and load suites |
| API latency | At 20 requests/second for 15 minutes: ordinary report/CRUD p95 ≤2 seconds, unexpected 5xx/timeouts <1%; expected authorization/validation failures excluded |
| Export | 500 students ×100 sessions completes within 10 seconds end-to-end on the recorded QA machine/network; workbook values remain correct |
| Synthetic scan pipeline | 300 distinct students plus 10× duplicate events; 5 concurrent sessions; all accepted unique events reconcile, no cache-induced permanent loss |
| Capacity exploration | Run 30/100/300 classes and 1/5/10 sessions, then increase until a measured bottleneck; report supported capacity rather than declaring the largest attempted size passed |
| UI | Core actions acknowledge loading promptly; no indefinite spinner on failed requests; measure key screens with fixed hardware/network |
| BLE lab | Provisional foreground target: at least 95% of controlled advertising trials detected within 10 seconds at agreed near-classroom distances; at least 30 trials per supported phone pairing; investigate every missed/false mark |
| Endurance | 2-hour scanning/advertising session and 4-hour backend soak; no crash, growing listener count, unreconciled writes or unbounded memory growth; record battery/thermal observations |
| Recovery | Every injected failure has a documented retry/reconciliation outcome; restore exercise reconciles fixture counts and hashes |
| Accessibility | Zero unresolved critical/serious automated findings on core pages plus manual keyboard, focus and screen-reader checks; record criteria not assessed |
| Logs/privacy | No passwords, ID/custom tokens or private keys in logs/artifacts; minimize identifiers in release logs and restrict access |

Load reports must include commit, dataset, duration, warm-up, machine, network, service location, concurrency, request mix and measured percentiles. Emulators are useful for correctness under contention, not a substitute for production-like Firestore latency/index/quotas. Evaluate cost and quota headroom in staging separately.

Compatibility baseline:

- Web: pinned current stable Chromium, Firefox and WebKit in automated tests; manual Edge/Chrome checks on Windows; 360, 768 and 1440 pixel viewport widths.
- Android: minimum declared supported SDK/device, permission-transition coverage around Android 12 where supported, and a current supported OS; at least two vendors if available. Verify advertising capability before counting a device as covered.
- iOS: minimum/current supported OS on physical devices after macOS/Xcode setup and native permission configuration. If unavailable, explicitly exclude iOS from the verified release scope.
- Mobile scenarios: install/upgrade/relaunch, Bluetooth and location toggles where applicable, permission denial/recovery, background/foreground, screen lock, rotation/text scaling, battery saver, network loss, simultaneous nearby sessions.
- BLE lab: vary distance, obstruction, adjacent-room transmitter and interference. Record outcomes; do not claim classroom-scale accuracy from a two-phone experiment.

## 10. Implementation phases, dependencies and completion gates

[Actionable phase checklist](QA%20implementation%20phases.md) contains task IDs, owners, dependencies and completion gates for executing these phases.

Effort is an initial estimate for one developer with QA responsibilities, excluding major redesign, waiting for infrastructure, and future real-user recruitment. Re-estimate after Phase 2. A phase is complete only when its evidence and exit conditions exist.

| Phase | Work and concrete deliverables | Entry / dependency | Exit gate | Estimate |
|---|---|---|---|---|
| **0 — Test basis and decisions** | Inventory routes/data flows; approve role and attendance truth tables; create requirements, decisions, traceability, risk and deferred registers. Turn R01–R16 into tracked work items. | This plan | Each P0/P1 risk has an owner, requirement, test family and clear expected result; unresolved decisions explicitly block affected work. | 1–2 days |
| **1 — Safe harness and baseline** | Pin Node/Flutter/Java/tool versions; install locked dependencies; add emulator and QA bootstrap; export testable API app; seed/reset guard; create test runners and basic CI; run lint/build baselines. | Phase 0 scope | Clean checkout runs one meaningful smoke test per layer; test configuration refuses production; baseline warnings/errors recorded. | 2–4 days |
| **2 — Permissions and security boundaries** | Write failing R01/R02/R03 tests first; fix trusted role provisioning, field restrictions and intended client operation rules; API ownership checks; prove legitimate cross-client flows still work. | Phase 1 | All P0 authorization and rules compatibility cases pass; student cannot self-promote or change protected data; no global allow rule; rule/API evidence reviewed. | 2–4 days |
| **3 — Attendance core and recovery** | Extract codec/round logic; establish canonical IDs/states; fix duplicate writes, enrollment-cache failure, retry handling and session-close recovery; binding design; unit/widget and concurrent emulator tests. | Phase 2; approved status/binding rules | TC-SES-02, TC-BLE-02/03/04 and TC-ATT-01–05 pass; no counter drift on replay/parallel execution; unfinished hardware security tests remain visible. | 4–7 days |
| **4 — Feature integration and reporting** | Durable portal session flows; student lifecycle compensation; enrollment; correction/audit; legacy normalization; cross-client oracle; workbook assertions; critical Playwright journeys. | Phases 2–3 | Full synthetic journey passes; all views/export agree; refresh proves persistence; negative ownership cases pass alongside happy paths. | 3–5 days |
| **5 — Nonfunctional and operational QC** | Security audits, accessibility review, performance/fault/soak suites, script guards, observability and privacy review; triage and fix material findings. | Stable Phase 4 data flow | Measured targets met or scope/targets revised with reason before sign-off; no open release-blocking security/integrity defect. | 3–5 days |
| **6 — Devices and staging** | Developer-operated BLE matrix, native permissions/lifecycle, release builds, staging indexes/IAM/network and recovery checks. | Devices/QA access; stable Phase 3 onward | Every claimed platform and capacity has evidence. Missing hardware/staging cases are Blocked, and release claims are narrowed accordingly. | 2–4 days plus access waits |
| **7 — Regression and technical handoff** | Run full release suite; retest defects; inspect final artifacts; create completion report, known limitations, rollback and future-UAT pack. | Applicable Phases 0–6 gates | Technical QA exit criteria below satisfied; review/sign-off recorded. Real-user acceptance remains explicitly deferred. | 1–2 days |
| **8 — Future real-user validation** | Representative students/lecturers, classroom pilot, usability/accessibility participants, feedback and formal acceptance; retest changes. | Real users and institution available; technical gates pass | Separate acceptance report and decision. Not required to finish today's planning or current synthetic QA implementation scope. | Estimate later |

**Planning range for Phases 0–7: 18–33 person-days**, plus remediation/design work beyond the assumptions and resource waits. This is a planning estimate, not a delivery promise.

Dependency sequence: **0 → 1 → 2 → 3 → 4 → 5 → 7**, with **6** proceeding once its relevant build/data prerequisites and resources exist and completing before claims about supported devices/staging. Phase 8 stays deferred. Independent accessibility/static-check work can begin earlier.

### First implementation backlog

1. Record canonical role/resource matrix and reproduce self-created lecturer-profile access in the emulator.
2. Wire all three clients and API to isolated Auth/Firestore with a production-endpoint rejection test.
3. Add client rules tests for actual enrollment, scanning, attendance update and absence operations.
4. Fix permission boundaries with narrow positive and negative regression cases.
5. Add duplicate-mark and double-close failure tests before modifying attendance state management.
6. Add an independent cross-client reporting fixture, then durable portal and export tests.
7. Expand nonfunctional, hardware and delivery checks after the critical path is reliable.

Do not start by writing hundreds of UI tests while database permissions and attendance invariants remain unprotected.

## 11. Developer commands and CI contract

### Existing commands, after installing prerequisites

Run from the indicated directory. Dependency installation/builds write files and may require workspace permission. No command below implies it was executed during planning.

| Working directory | Command | Meaning |
|---|---|---|
| `web_app/admin-portal/frontend` | `npm.cmd ci` | Install the checked-in lockfile |
| Same | `npm.cmd run lint` | Existing ESLint script |
| Same | `npm.cmd run build` | Existing Vite production build |
| `web_app/admin-portal/server` | `npm.cmd ci` | Install API dependencies |
| `student_app`, then `lecturer_app` | `flutter pub get` | Resolve app packages; inspect any lockfile changes |
| Each Flutter app | `flutter analyze` | Static analysis |
| Each Flutter app | `dart format --output=none --set-exit-if-changed lib test integration_test` | Add test directories first; formatting verification |
| Each Flutter app | `flutter build apk --debug` | Initial Android build smoke with configured SDK/QA build environment |

Do not run `npm start`, seed scripts, or mobile apps against default Firebase configuration as a QA shortcut. The current API `npm test` must be replaced, not reported as a useful failing suite.

### Commands to implement in Phase 1

These scripts do **not yet exist**. Define them with pinned local dependencies and document environment variables.

| Proposed location / command | Implementation contract |
|---|---|
| API: `npm.cmd run test:unit` | Node test runner; injected adapters; no network dependency |
| API: `npm.cmd run test:integration` | Supertest + Auth/Firestore emulator; verify persistence and authorization |
| Frontend: `npm.cmd run test:coverage` | Vitest run, component/logic coverage, machine-readable report |
| `qa`: `npm.cmd run test:rules` | Rules-unit-testing using the existing rules source |
| `qa`: `npm.cmd run test:emulated` | Validate environment, seed, run API/rules/cross-client suites, cleanup |
| `qa`: `npm.cmd run test:e2e` | Playwright with QA frontend/API processes and synthetic accounts |
| `qa`: `npm.cmd run test:load` | Explicit QA-only host guard and versioned load profiles |
| Each Flutter app: `flutter test --coverage` | Unit/widget tests with deterministic adapters |
| Each Flutter app: `flutter test integration_test -d <qa-device-id>` | Integration tests on configured QA target; native BLE cases labeled separately |

From `qa/`, the intended emulator wrapper is:

```powershell
npx.cmd firebase emulators:exec --project demo-crowd-attendance-qa --config firebase.json --only auth,firestore "npm run test:emulated"
```

Implement a local `firebase-tools` dependency first; this is not a currently runnable repository command. `test:emulated` runs suites only and must not recursively launch the emulator wrapper. Browser/Flutter device suites need documented host routing and lifecycle orchestration.

### CI cadence and gates

| Trigger | Checks | Failure behavior |
|---|---|---|
| Every pull request | Secrets, lint/analysis, unit/widget/component, API/rules integration, changed-path build, critical browser smoke | Block merge on failures; do not silently skip affected app tests |
| Main branch / nightly | Full browser matrix, cross-client regression, wider concurrency/fault tests, dependency audit | Create/assign defect and retain logs; repair before release |
| Scheduled/device availability | Physical BLE matrix, mobile lifecycle, soak, exploratory accessibility | Track device-specific evidence and unresolved gaps |
| Release candidate | Full relevant suite, release builds, QA deployment/index checks, restore/rollback rehearsal and technical summary | No sign-off without required gate evidence |

Pin dependency versions and runner environments, cache only reproducible dependencies, and keep production secrets out of PR jobs. Retain redacted run artifacts for a proposed 90 days; approve the final retention policy.

CI should fail on zero discovered tests in mandatory suites. Keep original failures when rerunning tests. A passing retry is a flaky test requiring investigation, not automatic clearance. Any quarantined case needs an owner, defect, expiry and equivalent coverage; do not quarantine critical authorization/integrity checks to obtain a green build.

## 12. Entry, exit, suspension and release criteria

### Entry criteria for executable testing

- Requirement and expected result recorded, or clearly designated characterization test.
- Testable build and correct isolated environment available.
- Data pack seeded, cleanup verified, necessary mocks/emulators/devices ready.
- Source commit, versions and configuration recorded.
- Required predecessor phase gate met.

### Definition of done for a change

- Acceptance criteria and affected risks mapped to meaningful tests.
- Implementation reviewed; relevant lint/build/tests pass.
- Fix has a regression test where practical; negative access checks accompany permission changes.
- No production-data dependency; evidence attached and documentation updated.
- Any residual risk is owned and does not violate release-blocking criteria.

### Current technical QA exit criteria

- 100% of defined P0/P1 requirements mapped to cases, and 100% of applicable P0/P1 cases pass on the release commit.
- All other executed failures are triaged; accepted low-impact exceptions have owner, reason, mitigation and target date.
- No open Critical/High security or attendance-integrity defects, no data-corruption defect, and no broken core journey.
- Target at least 80% line coverage on newly testable critical domain/service modules; collect branch coverage where tooling supports it and target 70% there. This is a project target, not a substitute for risk/state coverage. Document generated-code exclusions and baseline before enforcing.
- All critical decision-table branches and attendance states have positive/negative coverage regardless of code coverage percentage.
- Cross-client oracle, authorization, retries, concurrent marking/closing and exports pass.
- Build artifacts, dependency scan disposition, rules/index version, performance report, and relevant device/staging evidence retained.
- Two consecutive clean mandatory regression runs after the final change, with no unexplained flakes.
- Completion report distinguishes Passed, Failed, Blocked, Not run, Deferred and Not applicable.
- Deferred real-user validation is prominently documented; technical completion is not institutional UAT approval.

If hardware/staging tests cannot run, the result may be **“software-only QA complete; device/staging verification blocked”**. Do not label the full project production-ready on that basis.

### Suspend and resume

Suspend affected tests if the target points to production, fixtures contain personal data, the environment is unreliable, core setup fails, or corruption prevents trustworthy results. Capture evidence, isolate the problem, fix/reset the QA environment, and rerun smoke checks before resuming. Independent safe suites can continue.

Resource or schedule pressure does not convert an untested feature into a pass. Narrow the verified scope and record the remaining risk.

## 13. Defect management, metrics and evidence

Severity describes impact; priority describes repair order.

| Severity | Example | Release treatment |
|---|---|---|
| Critical | Role escalation, widespread data exposure, irrecoverable attendance corruption | Blocks affected release immediately |
| High | Wrong final attendance/counters, duplicate outcomes, legitimate core flow denied | Must fix and regress |
| Medium | Recoverable non-core failure, report formatting error without data loss | Assess scope and workaround; recorded owner |
| Low | Cosmetic issue with no task/data/access impact | Schedule and document |

Defect lifecycle: **New → Triaged → Assigned → In progress → Fixed → Ready for retest → Verified → Closed**. Failed retest returns to Reopened. “Cannot reproduce” needs environment/evidence review, not silent closure. Triage P0 findings immediately during active implementation and review remaining findings each workday.

### Test-case record template

```text
ID / title:
Requirement / risk / priority:
Layer / owner / environment / commit:
Preconditions and synthetic fixture:
Steps and exact inputs:
Expected UI, HTTP and database outcomes:
Cleanup:
Actual result:
Status: Not run | Passed | Failed | Blocked | Deferred | Not applicable
Evidence / defect:
```

### Defect record template

```text
ID / title / severity / priority:
Commit, app build, device/browser and environment:
Preconditions and synthetic account role:
Minimal reproduction:
Expected versus actual:
Redacted log, screenshot/trace, database assertion:
Requirement/risk/test links:
Owner / root cause / fix commit:
Retest and regression evidence:
```

### Metrics to report

- Requirement coverage: requirements with mapped cases / in-scope requirements.
- Execution progress: executed / planned applicable cases, with blocked and deferred counts separately.
- Pass rate: passed / executed; show counts and exclude blocked/deferred from this denominator.
- P0/P1 pass counts and outstanding defects by severity/age.
- Coverage by critical module and state/decision-table branch.
- Flaky tests and rerun rate; failure causes split between product, test and environment.
- Counter/record reconciliation errors under concurrency/load.
- Latency percentiles, error rate, resource/cost observations and tested capacity.
- Device/OS/browser coverage and unmet resource dependencies.

The release evidence bundle contains the commit/build IDs, tool versions, redacted environment manifest, fixture version, raw test reports, coverage, security findings/dispositions, browser traces, device notes, load results, defect register and signed technical summary. Keep private credentials and real personal data out of artifacts.

### Completion report template

```text
Release candidate / commit / date:
Scope and environments:
Planned / executed / passed / failed / blocked / deferred:
P0/P1 requirement coverage:
Defects fixed and outstanding:
Security/integrity/performance/device evidence:
Known limitations and verified platform scope:
Real-user UAT: Deferred — not performed
Recommendation: Rework | Software-only QA complete | Technically ready for controlled pilot
Technical reviewer / product-risk owner / decision date:
Next actions and owners:
```

## 14. Future real-user testing — explicitly deferred

Create deferred items **D-UAT-01 to D-UAT-05** now, all with status **Deferred — real users unavailable**. Product owner owns scheduling; QA owner maintains the pack. Lack of real users must not delay unit, integration, security, reporting or developer device checks.

| ID | Future activity | Re-entry condition / evidence |
|---|---|---|
| D-UAT-01 | Students complete login, binding, enrollment, broadcasting and attendance lookup | Technical gates pass; representative volunteers/accounts; task completion and observed problems recorded |
| D-UAT-02 | Lecturers run sessions/rounds, review absences, correct records and export | Agreed teaching workflow; independent expected attendance ledger; task results and acceptance |
| D-UAT-03 | Real classroom pilot across device diversity, room layout and interference | Approved controlled pilot, fallback manual attendance process, representative devices; false-positive/negative and detection-delay measurements |
| D-UAT-04 | Usability and accessibility sessions with representative participants | Participant availability and appropriate arrangements; observed barriers and prioritized findings |
| D-UAT-05 | Institutional acceptance and operational handover | Pilot findings fixed/retested; agreed policies, training/support and acceptance record |

Prepare scripts and synthetic dry runs now. Later define participant selection and sample size from the intended population and pilot objectives; do not invent statistically representative results. Developer role-playing, automated tests and simulated load do not constitute UAT.

## 15. Maintenance and review

The test owner updates this plan when roles, schema, BLE protocol, status calculations, supported platforms or deployment architecture change. For every change, identify affected requirements, revise fixtures/cases, and rerun impacted tests plus the critical regression suite.

Review the risk register after each phase. Keep the code baseline and executed evidence distinct from planned improvements. This document delivers the QA strategy and phased developer guide; it does not claim that the implementation phases have been executed.
