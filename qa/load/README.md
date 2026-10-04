# P10 modest synthetic load and fault/soak

From `qa`, with emulator ports free and QA dependencies installed:

```powershell
node scripts/run.cjs p10-load
```

The fixed workload accepts no target, credentials, duration or concurrency arguments. The launcher rejects mixed/remote selectors, probes local Auth/Firestore before seed/reset, and binds its own API to a loopback ephemeral port. There is no production fallback. Run serially with other fixture-writing suites.

The base seed plus a fixed three-student/two-round class is recreated on every run. Six workers perform 120 mixed requests: 40 enrollment retries, 40 exports and 40 student lists. Three workers then perform six completion retries. The runner rejects one atomic commit, simulates one committed correction with lost acknowledgement, stops its owned API for three failed read requests, restarts it and performs 15 paced ticks of correction/completion/enrollment/export retries with two seconds between ticks. The paced interval lasts at least 30 seconds plus operation latency. Two extra report reads reconcile the outcomes.

Assertions require one enrollment count increment, one completed class increment, one correction journal entry, stable round observations and scan counts, coherent root/nested results, correct attendance/absence counters and five synthetic Auth identities. A failed queued transaction must leave the session active, no nested outcomes and no class increment. All 188 successful responses and three expected network failures are accounted for; any unexpected status/error fails. Synthetic fixtures are restored and owned services stopped afterward.

Ignored `artifacts/p10/load.json` records host environment, durations, throughput, status/error counts, request latency percentiles, phase breakdown, safe request samples and reconciliation. Fault hooks are injected only from this local runner, never selectable via HTTP. No arbitrary low-latency SLA is invented. A single host, six workers, three students and a short software fault run provide neither crowd-radio evidence nor production capacity/recovery assurance. See [P10 report](../reports/P10.md).
