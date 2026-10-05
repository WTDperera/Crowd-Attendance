# Crowd Attendance — final QA results

P13, 2026-10-05. **ACCEPTED — software-only scope; QA process complete.** The user gave final acceptance on 2026-10-05: “I accept P13. The QA process is complete”. Hosted CI retest is pending and full static findings remain disclosed; acceptance does not change the recorded verification boundaries.

The user approved P12 and started P13 with “I approve P12. Please start P13”. Physical-phone testing was previously declined with “no need tto do that”. Student Windows desktop/host tests remain deferred. Android emulator and browser results cannot establish physical BLE or human usability.

Baseline: `MAIN`, `8ccf577d232e9d33be63e7cbfe6471e9c56c813f`, plus the reviewed P13 diff. Initial worktree/index were clean; P11/P12 had been committed and pushed externally. No agent staging, commit, push, deployment or live Firebase operation occurred. Application policy, rules and dependency locks are unchanged in P13.

## Environment and evidence

Windows x64; Node 24.21.0; Flutter 3.47.6 / Dart 3.13.5; Temurin JDK 21.0.11 build 10; dedicated AVD `crowd_attendance_qa_p02_api36`, Android 16/API 36, `emulator-5580`. Playwright 1.63.0 uses pinned Windows Chromium, en-GB locale, Asia/Colombo time zone, 1280×900 viewport and no retries. Demo project `demo-crowd-attendance-qa`; Auth 9099, Firestore 8080, API 5000, web 5173; Android host `10.0.2.2`.

[P13 execution report](qa/reports/P13.md) records current commands/results. [Phase history](docs%20QA/QA.phase.status.md) and [P01 scenario specification](qa/docs/test-matrix.md) remain historical evidence. [Demo/reset/recovery instructions](qa/docs/demo.md) distinguish simulated journey targets from normal APKs using real radio plugins. Raw diagnostics, tools, APKs and narrow local result artifacts remain ignored.

## E01–E23 disposition

The table maps implemented assertions to the original scenarios; it is not a claim that every possible stimulus or physical/manual subcase ran. The implemented software assertions have now been rerun; physical/manual boundaries remain explicit.

Within that narrowed scope: **21 IDs with passing implemented software assertions, 0 failed core IDs, 0 blocked software IDs, 2 physical-only IDs deferred by the user**. Manual/physical portions of otherwise software-qualified cases remain unverified as described below; these counts do not claim completion of the original physical scope.

| ID | Software evidence and boundary | Current status |
|---|---|---|
| E01 | Real local Auth login/profile checks, portal/student role separation; focused stale/loading/error/duplicate-submit checks; first binding. Native keyboard and actual-phone binding unverified. | PASS — software assertions |
| E02 | Student-created lecturer profile and forged privileged requests denied by real rules/API. | PASS — software assertions |
| E03 | Missing/malformed tokens, non-lecturer denial; new expired-token assertion against actual emulator verifier and protected API. Production token cryptography untested. | PASS — software assertions |
| E04 | Cross-owner module/session/roster/report/correction/export denial, including zero-session export; global student CRUD follows the approved policy. | PASS — software assertions |
| E05 | Protected profile/role/counter/binding/enrollment edits denied; permitted fields and initial binding allowed. | PASS — software assertions |
| E06 | Actual Android discovery/enrollment/nested attendance/report reads and writes, client rules and preserved projections. | PASS — software assertions |
| E07 | Same-round replay/concurrent writes converge; later-round observations remain distinct; class numerator bounded. | PASS — software assertions |
| E08 | Completed/empty/cancelled/zero-round and missed-round outcome tables; eligible roster reconciliation. | PASS — software assertions |
| E09 | Concurrent/repeated close, selected transactional failure/retry points, rejected post-close scans. Exhaustive crash-point coverage unclaimed. | PASS — software assertions |
| E10 | Malformed/unknown/non-enrolled signals and roster loading/error fail closed; parser/controller/widget assertions use simulated packets. | PASS — software assertions |
| E11 | Selected failed/lost-ack writes, retry and real local durable round persistence; no permanent cache suppression. | PASS — software assertions |
| E12 | Owner correction/repeat/denial; immutable raw tuples, audit, absence and counter reconciliation. | PASS — software assertions |
| E13 | Independent base ledger and corrected totals across API, web and Android reports; active sessions excluded; legacy alias precedence. | PASS — software assertions |
| E14 | Real account/module form persistence and new mounts; lecturer Android session persistence/reopen and complete automated journey. Portal session creation excluded by D08. | PASS — software assertions |
| E15 | Wrong/blank/missing/disabled/duplicate/concurrent enrollment, trusted API/rules bypass denial and historical roster. | PASS — software assertions |
| E16 | Supporting simulated permission/controller checks exist; actual denied/permanently-denied/Bluetooth off-on trials absent. | **DEFERRED_BY_USER — physical** |
| E17 | Supporting lifecycle/packet/persistence checks exist; actual two-phone advertising/scanning/background/radio trials absent. | **DEFERRED_BY_USER — physical** |
| E18 | Serialized XLSX cells/formulas/caches, date boundaries, thresholds, zero sessions, beyond-Z columns and literal user text. Manual Excel recalculation/inspection absent. | PASS — software assertions |
| E19 | Actual account CRUD, Auth/Firestore compensation/recovery/repeated deletion, historical attendance preservation and module ownership. | PASS — software assertions |
| E20 | Fresh shared lecturer Android → browser → student Android ledger. Radio callbacks simulated; physical/manual demo portion deferred. | PASS — software assertions |
| E21 | A's three independent round observations produce one present class. | PASS — software assertions |
| E22 | C's repeated r1 packets and r2 observation preserve missing r3 and left_early outcome. | PASS — software assertions |
| E23 | Durable identity/retry and separately launched prepare/resume Android processes; no intervening reset. Physical device restart/radio evidence absent. | PASS — software assertions |

The base three-round fixture expects A/B/C 100/0/0%, then 100/0/100% after C is excused; class credit changes 33.33→66.67%. The shared journey adds another class: the module denominators then include both classes. These are distinct ledgers, not conflicting percentage expectations.

## Current execution results

| Check | Actual P13 result |
|---|---|
| Focused static and workflow validation | Pass; 14 syntax checks and focused ESLint; actionlint also passes after the Java-selector repair. |
| Web unit/runner contracts | 15/15, zero skipped; repeated after the readiness repair, exit0 (1.908s). |
| Retained regression | Initial 100 pass. Final 94 retained + 7 API security = 101 pass, zero skipped, including expiry; child commands 165.671s / 11.136s. |
| Lecturer pure domain/gate | 11/11. |
| Bounded replay property | 1/1; overlaps domain coverage, not an extra unique requirement. |
| Android widgets | Student 6 + lecturer 7 = 13 substantive cases; framework teardown excluded. |
| Android service suite | Final retry exit 0: student enrollment 1 + lecturer session access 1 + round persistence 2 = 4 substantive cases, 253.570s. Initial Firestore exit/timeout remains a failed attempt. |
| Retained Android profile/report/restart probes and final shared journey | Retained Android probes 13/13 pass, including separate prepare/resume processes. Final shared journey lecturer1 → Chromium2 → student1 passes; 389.397s including cleanup/builds. |
| Normal/QA web builds | Both pass; existing large-bundle warning. |
| Full frontend ESLint | Exit 1: 10 errors / 2 warnings in retained code; not a clean lint result. |
| Full Flutter analysis | Each exits 1. Student: 0 errors, 1 warning, 27 infos; lecturer: 0 errors, 1 warning, 49 infos. |
| Fresh security | Exit0: pinned Gitleaks/OSV scans and exact review, 4/4 harness + 7/7 API. Scanner exits1 denote findings; review passes with zero unmatched findings. |
| Modest load/fault/short soak | Exit0, 191 requests:188 HTTP200 + 3 expected outage failures, zero unexpected. Mixed-load120 requests/six workers p95 158.14ms, max3659.21ms; paced soak36.639s. Ledger reconciled. |

API/contract, rules, rounds and integration inventories are included in the retained regression; component cases are its 25 React tests and five actual persistence/fault-recovery tests. Smoke's five checks overlap that regression. Accessibility/visual aliases use the browser stable-screen case: eight selected axe states and two exact reviewed Windows screenshots pass in the final journey. No alias was counted as another unique scenario. Android execution occurrences are widget13, service4, retained probes13 and journey2; they overlap assertions and are not a unique-coverage metric. The final shared journey has two additional Chromium cases.

Suite aliases overlap deliberately; counts cannot be added into a unique test count or a coverage percentage. Tests exercise actual local rules/services except explicitly mocked component/packet/fault boundaries. No numeric coverage target substitutes for E01–E23 outcomes.

## Hosted CI and defect dispositions

The user's push produced an actual [failed hosted run](https://github.com/WTDperera/Crowd-Attendance/actions/runs/37236446839) for baseline `8ccf577`. Web, browser and Android-build jobs failed at Java setup before application tests. The optional self-hosted Android journey was skipped. The annotation states: `Could not find satisfied version for SemVer '21.0.11+10'.`

P13 corrects all four workflow selectors and the toolchain manifest to `21.0.11+10.0.LTS`, the catalog name for the same JDK release/build. Old-selector mismatch and corrected match were reproduced locally; actionlint passes. The resolver compares build metadata for exact version requests. [Pinned setup-java resolver source](https://github.com/actions/setup-java/blob/cf277c60eb25467037889841efdb72551f06f6c3/src/util.ts). **Corrected hosted CI remains unrun until the user's publication; no CI-green claim.** Deprecated action-runtime annotations remain recorded; no broad action upgrade occurred.

Full static findings remain explicit: unused student `_studentName`, unused lecturer Firestore import, deprecation/print/async-context infos; frontend fast-refresh exports, memo/dependency findings, unused ModuleDetails values and conditional hooks/purity in unmounted legacy pages. Focused static and build success do not erase these findings. No application change was made merely to suppress them.

P13 also fixes the Android harness startup gate: the first journey seed failed a five-second cold-start read-only probe before any reset/scenario. The runner now uses the existing bounded readiness guard before writes; focused static/15 runner contracts and the clean shared journey pass after that fix. An earlier mobile-service attempt failed after Firestore exited and timed out; a complete four-case retry passed. Failed attempts are retained as failures, not counted as successful scenarios. Three broad static commands remain nonzero (frontend and both mobile analyses), and one observed hosted run failed; these are separate from the software case disposition count.

Security dispositions expire 2026-11-05. Fresh review finds19 existing client-key identifiers (four current/15 historical), six vulnerable package occurrences/seven advisory occurrences, zero unmatched findings. These are reviewed exceptions for the synthetic academic demo, not repaired vulnerabilities or production security clearance. BLE registration payloads are not cryptographic identity, Android build-ID binding does not prove unique-phone identity, and checkpoints do not prove continuous presence.

| Retained finding | Disposition and practical limit |
|---|---|
| Firebase client-key identifiers in current files/history | Reviewed client configuration, not Admin credentials; live restrictions/other API use untested. No history rewrite or key rotation performed. |
| QA OpenTelemetry, basic-ftp and braces | Tool-only paths with no retained inbound baggage, FTP listing or caller-provided glob; deferred migration, not fixed packages. |
| uuid in QA/server locks | Inspected retained caller uses v4 without the advisory's caller-provided buffer; vulnerable package occurrences remain. |
| Frontend react-router | Retained BrowserRouter client rendering has no SSR hydration/untrusted complete navigation destination; major migration deferred. |
| xlsx-js-style bundled SheetJS 0.18.5 | Two manually recorded parser advisories are outside scanner dependency traversal. Export builds/writes data; tests read their own synthetic output. No untrusted workbook import is exposed. Reassess before adding import. |

Exact advisory identifiers and scoped reasoning are in [security dispositions](qa/security/dispositions.json) and [P10 evidence](qa/reports/P10.md). A passing review means every fresh finding has an exact valid disposition; it does not mean zero findings.

Real-user UAT, physical BLE/native permission recovery, actual-phone capacity/reconnect, iOS, student Windows tests, production services/live key restrictions, native accessibility/keyboard behavior, manual workbook recalculation and exhaustive network/crash testing remain unverified. Selected axe states/two web screenshots and modest synthetic load establish only their measured scope.

The academic-demo completion gate is met for the explicitly narrowed software scope: retained permission/integrity assertions and final clean shared journey pass, stored/visible/export values agree, builds/static checks and exceptions are recorded, and the evidence/demo pack is complete. No core permission/integrity failure was reproduced in the final checks. This does not assert zero vulnerabilities, clean broad lint, successful hosted CI, physical detection or institutional acceptance.

Owned API/web/Firebase/Android processes are stopped. No QA port listeners or adb devices remain. Final normal-entry QA APK hashes and exact optional manual Git commands are in [P13 report](qa/reports/P13.md). No files were staged or committed by the agent.

**CLOSED — P13 accepted by the user on 2026-10-05.** No successor phase is authorized. Acceptance was recorded through documentation only; no application/test changes or new test/scan runs were performed. Execution evidence and scan hashes belong to the reviewed P13 snapshot.
