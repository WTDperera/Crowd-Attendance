# P10 security checks

Run from the repository root, using Windows x64 and installed dependencies from the committed npm locks. Tools are pinned in `tools.json`; installation verifies SHA-256 before use. No global installation is needed.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\qa\security\install.ps1
node qa/security/scan.cjs secrets
node qa/security/scan.cjs dependencies
node qa/security/review.cjs
node --test qa/security/harness.test.cjs
```

The two raw scans intentionally exit **1** when findings exist, even if reviewed. Run both and then review; do not join them with `&&`. Exit 0 from review means all findings have explicit current dispositions, not that the scanners found no vulnerabilities. Unknown findings, changed finding content, changed source/lockfiles, incomplete coverage and expired dispositions fail review. Dispositions expire on 2026-11-05 and must be reconsidered then.

Gitleaks scans tracked/untracked reviewable files plus local phase Markdown, and all locally available Git refs/history. It uses upstream default rules, disables inline allow comments and does not suppress the reviewed Firebase client key identifiers. Reports omit match/secret/author/email values. Ignored credentials, generated dependencies/builds/logs and inaccessible remote refs are outside this inventory; do not copy them into evidence. No live key validation or restriction/rotation operation occurs.

OSV queries six explicit resolved lockfiles: QA, server, frontend, student, lecturer and legacy Flutter web. It records package inventory counts, lock hashes, advisory IDs and upstream metadata, with no package call analysis or build execution. Native Android/Gradle transitive libraries, Flutter SDK internals, arbitrary vendor bundles and zero-day findings are not covered. The bundled older SheetJS engine in `xlsx-js-style` is separately disclosed in `dispositions.json`; retained UI only writes workbooks.

Artifacts under ignored `qa/artifacts/p10` contain safe scan/review summaries; caches and raw diagnostics remain ignored. Never publish raw Firebase/npm logs. See [P10 report](../reports/P10.md) for actual findings, environment and limits.

With all QA ports free, run the malformed-input/security cases from `qa`:

```powershell
node scripts/run.cjs p10-security
```

This owns local Auth/Firestore emulator lifetime, validates the exact demo target before resetting synthetic fixtures, runs six API cases on an owned loopback listener and shuts down. No penetration testing, production traffic, live credential lookup or phase P11 CI work is included.
