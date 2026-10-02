# P01 — Scope and policy decisions

Date: 2026-10-02. Status: core policies confirmed in conversation; remaining details proposed for P01 review. No application implementation.

Authority: [working rules](../../docs%20QA/AGENTS.md), [phase guide](../../docs%20QA/QA.agent.prompts.md), [essential plan](../../docs%20QA/QA.university.essential.plan.md), and root `QA.plan.md` section 5. The root and folder copies of the essential plan have identical SHA256 hashes at review. P01–P13 are the review gates; U1–U5 describe the broader work. The phase guide adds automation beyond the reduced plan; its expanded scope needs re-estimation after P02/P04.

## Confirmed requirements

- Several attendance rounds per class are required. Identity is session + round + student; retries within one round have one effect, and later rounds retain separate evidence.
- One final class outcome per eligible student; three observations do not become three attended classes. Checkpoints do not establish continuous physical presence.
- Permissions, attendance integrity, persisted reports and export are core. Known failures in these areas cannot be hidden by dropping assertions.
- Use isolated synthetic identities/data. Physical BLE requires physical evidence; real-user UAT remains deferred.
- Only P01 is authorized. No software changes, installs, tests for later phases, Git publication or deployment in this phase.

## Decisions to approve or amend

The user confirmed the three policy questions during P01. Confirmed items below are distinguished from details that were not explicitly asked. Confirmation of these policies is not approval of P01 or authorization for P02.

2026-10-02 response evidence:

- Student management: “FOR THE ADMIN DASHBOARD CAN LOG with the lecture same credinceal, then lectures can do delete,add (CRUD)”. Interpret as lecturer credentials also authenticate the dashboard and lecturers retain student CRUD, including existing global management scope. This specific instruction overrides the account-lifecycle exclusion embedded in the bundled third question. No separate administrator role is required by this answer; trusted role provisioning is still necessary.
- Attendance policy question: “Use these rules”. Confirmed all/some/none = present/left_early/absent (including missing early/middle rounds), excused credit, excluding failed/cancelled rounds, and rejecting zero-round completion.
- Scope/report question: “Use this proposed demo scope and policy”. Confirmed Asia/Colombo, 80%, roster fixed at session start, owner-only corrections, mobile session creation and portal Add/Edit Session exclusion. Account lifecycle remains INCLUDED under the more specific CRUD instruction above.
- Deletion follow-up: “Delete login/profile access but preserve historical attendance”. Account deletion must retain past reporting evidence; this is confirmed.

| ID | Topic | Candidate policy / unresolved choice | Depends on it |
|---|---|---|---|
| D01 | Roles and student management | CONFIRMED: lecturer uses the same credentials in lecturer app and admin dashboard; student CRUD is retained for lecturers. Interpret existing global student-management scope as intended. Student role cannot access dashboard/API management. Lecturer module/session/report ownership remains enforced; global student CRUD does not confer another lecturer's report/correction access. Provision lecturer roles through a trusted path. Device reset specifics remain proposed in D09. | P03/P04/P08; E02–E06/E19 |
| D02 | Enrollment and roster | CONFIRMED roster at session start; later enrollment/removal does not rewrite class eligibility. Plan requires enabled module plus correct password through trusted validation; repeats have no extra effect and secrets are not exposed. No retroactive class credit from enrollment. | P04–P07; E06/E08/E15 |
| D03 | Successful, interrupted and cancelled rounds | CONFIRMED failed/cancelled rounds do not count. PROPOSED lifecycle detail: explicit owner completion makes a round count, even if it detects nobody; pending writes must finish or be visibly resolved. Failed/paused/reopened rounds retain identity and are not completed automatically. Preserve cancelled diagnostic evidence outside denominator. New round requires explicit action; timeout/navigation/restart alone do not manufacture one. | P05/P06; E07–E11/E21–E23 |
| D04 | Missing-round labels | CONFIRMED all completed rounds detected = present; a nonempty proper subset = left_early; none = absent. Missing first/middle rounds also uses left_early. Explain as incomplete checkpoint evidence, not proof of departure. | P05–P07; E08/E13/E22 |
| D05 | Excused, late and corrections | CONFIRMED excused counts as one attended class and only session owner corrects attendance. Plan requires preserved round evidence and repeat correction idempotency. PROPOSED: completed-session correction audit actor/reason/time/before/after; explicit correction takes precedence over raw round calculation; flag/reconcile conflicting legacy evidence. Legacy Late credit remains proposed, not covered by the question. | P06/P07; E12/E13/E18 |
| D06 | Session lifecycle | CONFIRMED reject zero-round completion. PROPOSED cancellation contributes no completed class, active/pending excluded from final percentages, reopening outside demo, one active session per module. Closed sessions reject ordinary scans as required by root invariants; concurrent close/mark attempts still tested. | P05/P06; E08/E09/E11 |
| D07 | Dates and eligibility | CONFIRMED Asia/Colombo and 80% threshold. PROPOSED details: start-inclusive/next-day-exclusive date filtering; raw ratio >=80% determines eligibility, display rounded to two decimals; zero sessions shows 0% and no-sessions state without eligibility approval. | P07; E13/E18 |
| D08 | Demo scope | CONFIRMED retain mobile session creation and exclude portal Add/Edit Session from demo navigation/claims in P08. Retain student CRUD/account lifecycle under D01, plus Android login/enrollment, multiple rounds, completion, owner correction, web report/export and module management. Account Auth/Firestore partial-failure recovery is mandatory, not optional. No UI exclusions implemented in P01. | P08/P09/P12/P13; E14/E19/E20 |
| D09 | Identity, binding and input | Synthetic IDs are stable and unique. Registration case/whitespace/allowed characters/length and BLE payload byte budget need explicit agreement before validation work. Candidate: immutable registration after provisioning; reject collisions. Existing build-ID binding is not unique-phone proof. First binding should work once; later client tampering denied; trusted reset workflow needs separate scope decision if retained. | P03/P05/P08; E01/E05/E10/E19 |
| D10 | Deletion and history | CONFIRMED student deletion removes login/profile access while preserving historical attendance. Retain sufficient historical identity/roster evidence for reports; reconcile current enrollment counts and recover partial Auth/Firestore failure. PROPOSED block deletion of referenced modules; retention duration and exact historical display fields still need review. No approval to delete attendance history. | P04/P08; E19 |
| D11 | Devices and practical scope | Android phones and one Chrome/Edge version; record actual versions later. Three students/two owners are a correctness fixture, not capacity evidence. User to supply marking requirements, actual phones and desired classroom size if applicable. No claim of iOS, crowd accuracy, spoof resistance or production readiness. | P10/P12/P13; E16/E17/E20 |

## Independent three-round ledger

This is a hand-derived oracle, not database seed data and not output from application calculations. All identifiers are synthetic; no accounts were created.

- Lecturers `qa-lecturer-a`, `qa-lecturer-b`; students `qa-student-a/b/c`, registration labels `QA001/QA002/QA003` (BLE compatibility to verify later).
- Modules `QA101` owned by lecturer A and `QA202` owned by lecturer B; A/B/C eligible for both before each fixture session starts.
- Stage Z: QA202 has zero sessions for zero-denominator tests. Stage I subsequently adds its isolation session; do not combine these contradictory states in a single snapshot.
- QA101: completed session fixture `qa-s1`, 2026-10-02 09:00–10:00 Asia/Colombo; distinct completed rounds `r1/r2/r3`. Separate `qa-active` remains active and excluded from final totals under proposed lifecycle details.

| Student | r1 | r2 | r3 | Distinct observations | Base final outcome | Class numerator / denominator |
|---|---|---|---|---|---|---|
| A | Seen | Seen | Seen | 3 | present | 1/1 = 100% |
| B | Missing | Missing | Missing | 0 | absent | 0/1 = 0% |
| C | Seen | Seen | Missing | 2 | left_early | 0/1 = 0% |

Raw durable evidence consists of exactly five tuples: `(qa-s1,r1,A)`, `(qa-s1,r2,A)`, `(qa-s1,r3,A)`, `(qa-s1,r1,C)`, `(qa-s1,r2,C)`. The module has one completed class, not three. Base distinct outcomes: present=1, absent=1, left_early=1, excused=0. For a binary attendance report, absent/noncredited=2; show its left_early breakdown rather than double-counting it. Class-wide credited ratio is 1/3 = 33.33%.

Correct C to excused: five raw tuples remain; final categories become present=1, absent=1, left_early=0, excused=1. A/B/C numerators become 1/0/1; denominators stay 1/1/1. Class-wide credited ratio becomes 2/3 = 66.67%. Workbook row cells are A=1, B=0, C=ex. Repeat the correction or close retry: no change. Correct C back to absent: C numerator=0, class ratio=33.33%; round evidence still five. Session attendance counters must define whether they mean strict present or credited-present; all readers must use the same explicit definition, with excused reported separately.

Stage I: create `qa-s2` under QA202 with the same independent observation pattern and expected results. Owner A must not read, modify or export its metadata/roster/results; owner B must succeed. No cross-module counter changes. Stage Z's zero-session assertion applies before this addition or after an isolated fixture reset.

## Edge-case oracle

| Variant | Hand-derived expected result under proposed policy |
|---|---|
| E21: A seen in all three rounds | Three distinct observations; one present class; 100%, never 300%. |
| E22: C receives 100 repeated packets in r1 plus one in r2, misses r3 | Two observations and left_early; repetitions cannot fill r3. Only r1 repeated gives one observation and still left_early. |
| E23: r2 write acknowledged but response lost; retry after process restart | Reuse r2 identity; observation remains one for that student/r2; explicit r3 accepts a new observation. |
| Failure before persistence | No acknowledged observation; pending/error visible; successful retry yields exactly one tuple. |
| Miss r1, see r2/r3; or see r1/r3, miss r2 | Two observations; confirmed label left_early; 0/1. |
| Complete r3 with no detections | r3 counts; A/C seen in r1/r2 become partial, not present. |
| Cancel r3 after r1/r2 | Only r1/r2 count; A/C present, B absent; cancelled diagnostic evidence cannot enter percentages. |
| All rounds cancelled / zero rounds | Reject completion; no completed-class increment or automatic absences. |
| Zero-session module | 0/0 represented as 0% with no-sessions state; never NaN/Infinity or automatic eligible. |
| Enrollment changes after start | Original eligible roster unchanged; later joiner not auto-absent for earlier class. |
| Boundary dates | 2026-10-02 local day is [2026-10-01T18:30:00Z, 2026-10-02T18:30:00Z); include first endpoint, exclude second. |
| Threshold | 4/5=80% qualifies; 7999/10000=79.99% does not; 8001/10000=80.01% does; 79999/100000=79.999% displays 80.00 but fails raw threshold. Large ratios are pure arithmetic fixtures, not capacity claims. |

## Source observations, not executed defects

| Finding | Source anchor | Implication and later verification |
|---|---|---|
| F01 | `web_app/admin-portal/firestore.rules`, lecturer/student matches; `server/middleware/verifyFirebaseToken.js:requireLecturer` | Own lecturer profile writes are permitted and role depends on its existence; own student writes are broad. Reproduce self-promotion/protected-field tampering under emulator identity, P03. |
| F02 | `student_app/lib/services/module_service.dart:enrollWithPassword`; rules module/nested paths | Password check is client-side; discovery queries all modules; module reads owner-only and nested enrollment absent from grants. Verify trusted enrollment and legitimate queries, P04. |
| F03 | `lecturer_app/lib/services/session_service.dart:markAttendance/incrementScanRound` | No round argument; query followed by random-ID write or scan_count increment. Reproduce concurrent writes and same-round replay versus later rounds, P05. |
| F04 | `lecturer_app/lib/screens/scanner_screen.dart:_stopScanning` and packet handler | Stop increments aggregate round count; enrollment-null check permits processing; cache insertion precedes lookup/write. Verify failed writes, restart and lifecycle, P05. |
| F05 | `lecturer_app/lib/services/session_service.dart:endSession` | Status/counter batch occurs before completed guard; absence finalization after completion transaction. Verify repeated close and interrupted recovery, P06. |
| F06 | `web_app/admin-portal/server/routes/attendanceRoutes.js:/export`; `routes/students.js` | Export loads module before owner-filtering sessions; reproduce unauthorized module metadata exposure. Global student CRUD is authorized by D01 and is not itself a defect; test role protection and separation from report ownership, P04. |
| F07 | `student_app/lib/services/attendance_stats_service.dart:_loadAttendanceEvidenceForModule`; API summary helper; workbook service | Student evidence uses present queries and absence precedence; API counts excused/late and export emits ex; denominator fallback differs. Reconcile against independent oracle, P07. |
| F08 | `frontend/src/context/ModulesContext.jsx`, `pages/AddSession.jsx`, `pages/EditSession.jsx` | Session screens update mock-backed React state; refresh persistence needs verification and D08, P08. |
| F09 | `student_app/lib/main.dart` and `lecturer_app/lib/services/device_service.dart` | Both use androidInfo.id. Retain plan's limitation; do not claim unique hardware identity, P03/P12. |

No deployed rules, actual exploit, device performance or application pass is established by this review. User assistance will be needed for physical-phone operation and any desired human usability observations in P12; no such test is needed to finish P01 documentation.
