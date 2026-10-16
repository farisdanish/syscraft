---
name: drill-authoring
description: Procedure for creating or revising a SysCraft curriculum drill (concept brief, starter/solution code, evaluator assertions, hints, oral rubric) and integrating it correctly. Use when writing new drill content or changing an existing drill in src/drills/. For reviewing a finished drill, use drill-content-review.
---

# Drill Authoring

Build a drill that teaches **one competency**, is honest about what its tier actually executes, and is wired into the app correctly. When you're done, the `drill-content-review` skill is the quality gate.

## 1. Read the real contract first

Don't author from memory, from this skill, or from the README. Read:

| What | Where |
|---|---|
| Drill schema | `DrillDefinition` in `src/types/index.ts` (the only source of truth for fields) |
| Closest existing drill | `src/drills/weekN-*.ts` with the same tier/validation type |
| Task metadata | `CURRICULUM_TASKS` in `src/data/curriculumTasks.ts`; `CurriculumTask` in `src/types/tasks.ts` |
| Dispatch | `src/drills/registry.ts` |
| SQL plan evaluation | `src/services/queryPlanParser.ts` |
| Tier 3 runner | `testbed/artisan`, `testbed/bootstrap/models.php`, `bridge/command_manifest.v1.json` |
| Invariants | `.agents/rules/architecture_invariants.md` |

## 2. Choose the authoring mode

The app is keyed by **week number**: `DRILL_REGISTRY` is `Record<number, DrillDefinition>`, so there is exactly one drill per week.

**Mode A: Revise an existing week's drill (default).** This is a content change inside `src/drills/weekN-*.ts`, plus the matching `CURRICULUM_TASKS` entry if its description, topics or minutes change. It needs no other files.

**Mode B: Add a new week. Stop and get user approval first.** This is an architecture change. Week-number branches exist in:
- `src/drills/registry.ts`: `DRILL_REGISTRY`, `ACTIVE_WEEKS`, `getBridgeCommandForDrill`, `evaluateDrillSimulation`
- `src/data/curriculumTasks.ts`: new task entry
- UI: `StudioFooter.tsx`, `StudioHeader.tsx`, `steps/StepAssertionOutput.tsx`, `steps/StepTracerReplay.tsx`, `components/tracer/tracerSteps.ts`
- `package.json` `test` script: compile list
- Tier 3 only: a new suite in `testbed/artisan` and a new entry in `bridge/command_manifest.v1.json`. Adding to the manifest changes the bridge's command allowlist, so **flag it as security-relevant**.

A second drill within an existing week isn't supported without refactoring the registry. Say so rather than working around it.

**Never change a drill ID.** IDs are persisted in IndexedDB; a rename needs a legacy alias in `src/services/storage.ts` (see the `w4-data-layer-indexes` handling) and user approval.

## 3. Design around one competency

Before writing any content, write down:
1. The capability the learner must demonstrate.
2. The decision or diagnosis the exercise forces (not a syntax fill-in).
3. The evidence that separates a correct solution from a wrong one; this becomes the assertions.
4. The relevant trade-offs and failure cases; these become the rubric's `tradeoff`/`failure` checkpoints.

Keep other topics out unless they're true prerequisites; then add them to `prerequisites`.

## 4. Assign the tier honestly

| Tier | What actually runs | Rules |
|---|---|---|
| 1 | SQLite 3.45.2 via `sql.js` in the browser | Never imply SQLite plans/timings predict PostgreSQL. Plans are checked semantically via `queryPlanParser.ts` (SCAN vs SEARCH, index used). |
| 2 | A TypeScript `evaluate*Drill(code)` function over the submitted text | It's a deterministic model; state its assumptions in the brief. Not framework behavior. |
| 3 | Custom PHP 8.3 runner (`testbed/artisan`) + PDO + PostgreSQL 16.4 via the bridge | **Real:** PHP execution, PDO queries, query counts, PG plans. **Stubbed:** Laravel, Eloquent, sessions, policies (`models.php`). No Pest. `bridge-pest-test` is a legacy name. |

A drill may have a declared tier plus an extra bridge path (Week 4: Tier 1 + `postgres-plan-test`). Describe both accurately.

**PostgreSQL plan checks** follow the existing Week 4 suite: run `ANALYZE <table>` to refresh statistics, then `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) <query>`, then walk the plan tree for `Node Type` / `Index Name`. Don't assert one exact top-level node type. `EXPLAIN ANALYZE` **executes** the statement: use it only on SELECTs, or wrap DML in a rolled-back transaction.

## 5. Write the content

- **`conceptBrief`:** the thesis plus key points that state the mechanism *and* its limits. `diagramType` must be one of the existing union values; a new diagram type needs schema and UI changes (Mode B rules apply).
- **`initialCode`:** a realistic starting point that requires the decision from §3.
- **`solutionCode`:** passes the evaluator, and is the clearest correct answer, not the only one.
- **Assertions and evaluator:** check the competency's evidence, not names or substrings alone. Each `assertionResults` message should explain *why* it passed or failed. Reuse existing evaluator patterns before inventing new ones.
- **`hints`:** escalate direction → mechanism → near-answer. Early hints must leave the decision to the learner. Note that `hintsRequested` isn't currently counted, so hints carry no penalty; don't write content that assumes otherwise.
- **`oralRubric`:** one checkpoint per `RubricDimension` (all five, exactly once). Write each as what a level-4 answer must contain, in observable terms. The 1–4 scale and its generic descriptors live in `OralRubricDialog.tsx`; don't redefine them. `challenge` must be a variation the brief doesn't answer.

## 6. Verify the evaluator

For Tier 2 and Tier 1 evaluators, write a throwaway script in the artifact scratch directory (never the repo) and confirm:
1. `solutionCode` passes.
2. `initialCode` fails.
3. At least one plausible **wrong** answer fails for the right reason.
4. At least one valid **alternative** answer passes (or document why it's legitimately rejected).

Tier 3 checks need the bridge and Docker. Ask before starting them (see `bridge-diagnostics`).

## 7. Handoff

1. Run `npm run build`, `npm run lint`, `npm test` (note: `npm test` compiles only the drill files listed in `package.json`).
2. Run the `drill-content-review` skill on the result and fix its findings.
3. Report: changed files, commands run and their results, which §6 checks were **tested** vs **static only**, and anything unverified.
