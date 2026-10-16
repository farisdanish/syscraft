---
name: drill-content-review
description: Review a single SysCraft drill for technical accuracy, tier honesty, metadata consistency, assessment validity, hint progression, and oral-rubric quality. Use after creating or editing a drill in src/drills/, or when asked to audit a specific week's content. Not for authoring new drills (see drill-authoring) or app/UI code.
---

# Drill Content Review

Review **one drill at a time** and report findings. Audit-only requests must not modify repository files.

## 1. Sources of truth (read these, not the README)

| What | Where |
|---|---|
| Drill content | `src/drills/weekN-*.ts` (`WEEK_N_DRILL`, optional `evaluate*Drill`) |
| Drill schema | `DrillDefinition` in `src/types/index.ts` |
| Task metadata | `CURRICULUM_TASKS` in `src/data/curriculumTasks.ts`; `CurriculumTask` in `src/types/tasks.ts` |
| Dispatch | `src/drills/registry.ts` (`evaluateDrillSimulation`, `getBridgeCommandForDrill`) |
| Pass status | `src/components/layout/studio/useStudioSession.ts` (sets `verificationSource`: `simulation` vs `local-runtime`) |
| SQL plan evaluation | `src/services/queryPlanParser.ts` (`semantic-query-plan` rules, `requiredIndexName`) |
| Tier 3 runner | `bridge/command_manifest.v1.json`, `testbed/artisan` (custom PHP runner, one suite per Tier 3 drill), `testbed/bootstrap/models.php` (Eloquent-style stubs) |
| Oral scoring | `src/components/rubric/OralRubricDialog.tsx` (generic 1–4 level descriptors, hesitation logging) |
| Invariants | `.agents/rules/architecture_invariants.md` |

Open other files only when needed to establish a finding. The README is context only; if it disagrees with the sources above, report it as stale.

**Pinned runtime versions** (for version-sensitive claims): SQLite 3.45.2 (`sql.js@1.12.0`), PostgreSQL 16.4, PHP 8.3.11. These are what the repo pins, not proof they're installed — check before claiming a version-specific run.

**Laravel is taught, not executed.** Laravel/Eloquent APIs in drill content (Laravel 12 is the target) are checked by Tier 2 evaluators or by Tier 3 stubs. Neither Laravel nor Pest is installed; `testbed/artisan` output only mimics Pest formatting. Laravel-specific claims therefore need documentation evidence, not a runtime check.

## 2. Scope per week

Judge each drill against its own competency. Missing topics outside it are **not** findings; list them under "Out of scope" at most.

| Week | Drill ID | Core competency | Non-goals |
|---|---|---|---|
| 1 | `w1-laravel-internals-n1` | Trace request lifecycle; eliminate N+1 within a query budget | Full kernel/middleware internals |
| 2 | `w2-rest-cursor-pagination` | Seek-based cursors with stable unique ordering; RFC 9457 errors | API versioning, rate limiting |
| 3 | `w3-class-refactoring-di` | Refactor to injected services; bind contracts in the container | General design-pattern catalogue |
| 4 | `w4-btree-indexing` | Choose a composite index for a query; read the plan | Partitioning, PG planner tuning |
| 5 | `w5-queue-dlq-pipeline` | Idempotent consumers, backoff, DLQ isolation | Broker internals, exactly-once |
| 6 | `w6-system-design-star` | Defend pipeline trade-offs with evidence (STAR) | Full capacity-planning course |
| 7 | `w7-crud-auth-sprint` | Session fixation defense; object-level authorization (IDOR) | OAuth/SSO, full RBAC design |

If the drill ID or competency in the repo differs from this table, report the drift and review what actually exists. If the user explicitly asks about breadth, propose at most **3** additions, each justified by target-role impact vs learner-time cost.

## 3. Procedure

Never review a drill file in isolation; most false positives come from skipping the trace.

1. Read the full drill definition.
2. Read its `CURRICULUM_TASKS` entry and the relevant schema types.
3. Trace dispatch in `registry.ts`: which evaluator (if any), which bridge command (if any).
4. Follow the evaluator into its implementation (`evaluate*Drill` or `queryPlanParser.ts`) and into `useStudioSession.ts` to see how a pass is recorded.
5. Apply the checklist (§4).
6. Run targeted verification where feasible (§5).
7. Report (§7).

Don't infer behavior from function names; follow the call path for any claim about runtime behavior.

## 4. Checklist

### A. Metadata consistency
- Drill `id`, `week`, `tier` match the `CURRICULUM_TASKS` entry.
- `engine` values correspond (the two types currently use different spellings — report, don't silently "fix").
- `prerequisites` reference existing task IDs and are actually needed.
- `estimatedMinutes` is plausible including analysis and oral recall.
- Task `description`/`topics` don't promise content the drill doesn't teach or assess.

Ignore naming/formatting differences that cause no integration or maintenance problem.

### B. Tier honesty
- A drill may have a declared tier **plus** an extra verification path (e.g. Week 4 is Tier 1 with a `postgres-plan-test` bridge command). Mixed paths aren't defects; misleading descriptions or wrong pass semantics are.
- Tier 1: no claim that SQLite plans/timings predict PostgreSQL.
- Tier 2: simulated behavior is described as a model with stated assumptions.
- Tier 3: confirm in `useStudioSession.ts` that `local-runtime` status comes only from bridge-captured results. Real at Tier 3: PHP execution, PDO, PostgreSQL plans and query counts. Stubbed: Laravel, Eloquent, sessions, policies. Flag content that presents a Tier 3 pass as proof of real framework behavior.
- `validationRules.type: 'bridge-pest-test'` is a legacy name; it doesn't mean Pest runs.

### C. Technical accuracy
- Check claims in `conceptBrief`, `hints`, instructions, and rubric prompts against the pinned versions.
- Watch for inverted terminology (e.g. "high selectivity" used to mean "many rows"), wrong causal explanations, and missing assumptions that change the answer.
- For uncertain or version-sensitive claims, name the claim and the source/test needed; mark `unverified`. Don't rewrite from memory.

### D. Assessment validity
Inspect `expectedAssertions`, the evaluator, `initialCode`, `solutionCode`, and any tests together.
- **False pass:** can a wrong answer pass via a superficial string/regex/name match?
- **False fail:** would a correct alternative (different column order where valid, different naming, equivalent syntax) be rejected unnecessarily?
- **Agreement:** does `solutionCode` actually satisfy the evaluator? Do success messages describe only what was really checked?
- `initialCode` requires a real decision, not filling one blank.
- Negative cases are covered where central to the competency (e.g. unauthorized access in Week 7).

String/AST assertions aren't inherently invalid — judge them against the competency and the acceptable solution space.

### E. Hint progression
- Hints escalate: direction → mechanism → near-answer. A near-answer **final** hint is acceptable if earlier hints preserve reasoning.
- Flag leakage only when it undermines the assessment (e.g. an early hint gives the answer, or nothing distinguishes hinted from unhinted passes).
- Hints don't contradict the brief, starter code, assertions, or rubric.
- Don't assume `hintsRequested` affects scoring or review. Trace its writers before making claims (as of this writing, `OralRubricDialog.tsx` logs it as a constant `0`).

### F. Oral rubric
- All 5 `RubricDimension`s present exactly once.
- Each drill checkpoint describes **observable** content (said X or didn't), not "showed good understanding".
- `challenge` asks a variation the brief doesn't answer verbatim.
- Checkpoints stay within the drill's scope, or flag the unintended prerequisite.
- Per-level (1–4) anchors are generic and live in `OralRubricDialog.tsx`, not in drills. Don't flag drills for lacking per-level anchors; that would be a schema change.

### G. Cross-artifact consistency
Brief ↔ starter ↔ hints ↔ solution ↔ assertions ↔ evaluator ↔ rubric ↔ task metadata. A technically correct lesson is still defective if its evaluation rewards a different answer than it teaches.

## 5. Verification

Prefer targeted checks. Available commands:

| Command | What it actually covers |
|---|---|
| `npm run build` | `tsc -b` type-check of all drills and app code (plus Vite build) |
| `npm run lint` | oxlint |
| `npm test` | Compiles a **subset** (Weeks 2, 3, 5, 6, 7 drill files + some services) and runs `tests/*.test.mjs`. No drill-specific tests exist; Weeks 1 and 4 aren't compiled here. |

To check whether `solutionCode` passes its evaluator, a throwaway script may import the compiled output in `dist-test/` and call the evaluator. Keep it in the artifact scratch directory, never in the repo.

Tier 3 runs need the bridge (`npm run bridge`) and Docker, and exercise the stubbed testbed (see §1). Don't start services or install anything without asking; see the `bridge-diagnostics` skill.

Label every check as one of:
- **Static** — source inspected only.
- **Tested** — a named command/script ran and its output was observed.
- **Runtime verified** — reproduced through the actual tier path.
- **Unverified** — runtime, fixture, or evidence unavailable.

Never claim a test passed because it exists.

## 6. Classify every finding

- **Status:** `incorrect` (demonstrably wrong) | `inconsistent` (artifacts contradict) | `insufficient` (doesn't establish the competency) | `unverified` (suspected, not proven)
- **Severity:** `high` (teaches something wrong, misleading runtime claim, or a consequential wrong answer passes) | `medium` (materially weakens learning or assessment) | `low` (clarity/polish)
- Each finding needs: file + line evidence, why it matters for *this drill's* competency, and the smallest fix.

Don't inflate severity for out-of-scope or optional enhancements. No per-drill numeric score — it hides serious defects.

## 7. Report format

```
## Drill review: <id> (Week N, Tier T)
Summary: <1–2 lines>

| # | Severity | Status | Area | Finding | Evidence | Smallest fix |
|---|---|---|---|---|---|---|

Verification: <commands run + results; static-only areas; runtime not performed and why>
Out of scope (not findings): ...
Unverified: <claim → evidence needed>
```

If there are no confirmed findings, say so. Don't manufacture issues.

## 8. Fixes and learner data

- Only edit when fixes are explicitly requested; touch only the files needed.
- Preserve drill IDs, schema fields, rubric dimensions, the 1–4 scale, and completion semantics. If a fix needs a schema/registry/runtime-contract change, explain the dependency and ask first.
- After edits, run the relevant §5 commands and report actual results.
- Learner data (hesitation logs, oral scores) lives in browser IndexedDB, not the repo. Never infer learning outcomes from code, assertions, or logging.
