# Architecture Invariants

These architectural rules govern all development in **SysCraft**. Every feature, drill, and visual component must comply with these invariants:

---

## 1. The 3-Tier Execution Principle
1. **Tier 1 (Browser-Native):**
   - SQLite execution occurs in-browser via `sql.js@1.12.0`.
   - Never claim an SQLite query plan or performance timing predicts PostgreSQL execution behavior.
   - Always badge Tier 1 queries with `[Engine: SQLite {sqlite3_libversion()} (WASM)]`.
2. **Tier 2 (Simulated Backend):**
   - All visual state machines (Laravel request lifecycle, Horizon/queue retry loops, container resolution, memory growth) are **Deterministic Simulations with Documented Assumptions**.
   - Must be clearly labeled in the UI as **"Deterministic Simulation"**. Never present simulated memory counters or synthetic queue loops as live operating system telemetry.
3. **Tier 3 (Secured Canonical Runtime):**
   - True backend behavior (Eloquent eager loading, session regeneration, policies, and Pest 3 tests) runs through the authenticated loopback bridge daemon into `syscraft-runner:1.0.0` and `postgres:16.4-alpine`.
   - Automated pass status is granted **only** to bridge-captured, schema-validated execution.
   - Any manual results pasted via the CLI fallback are marked `[Self-Reported / Unverified]`.

---

## 2. Zero-Secrets Invariant
- Never store API keys, database credentials, passwords, or cloud tokens in IndexedDB, LocalStorage, or git repositories.
- All JSON export envelopes must be strictly validated against the versioned Zod schema (`ExportEnvelopeV1` / `EncryptedExportEnvelopeV1`).
- Malicious keys (`__proto__`, `constructor`) must be stripped during JSON parsing.
- Maximum envelope payload size is 2MB; maximum nesting depth is 5.

---

## 3. Cognitive Load & Layout Invariant
- Enforce the progressive 5-step learning workflow:
  $$\text{Concept Brief} \longrightarrow \text{Focused Drill} \longrightarrow \text{Plan Analysis} \longrightarrow \text{Oral Recall} \longrightarrow \text{Tracer Replay}$$
- Never clutter the screen with simultaneous competing graphs, telemetry meters, and split diffs. The visual tracer is a progressive teaching aid, not an overwhelming operational dashboard.
