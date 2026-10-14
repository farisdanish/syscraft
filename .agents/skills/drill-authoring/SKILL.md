---
name: drill-authoring
description: Guidelines and template structures for authoring new SysCraft curriculum drills, test assertions, and visual state machines.
---

# Drill Authoring Guide

Use this skill when designing or expanding curriculum drills for SysCraft.

## 1. Drill Specification Structure

Every drill in `src/drills/` must implement the `DrillDefinition` interface:

```typescript
export interface DrillDefinition {
  id: string; // e.g. "w1-n-plus-one-elimination"
  week: number;
  title: string;
  tier: 1 | 2 | 3;
  engine: "sqlite-wasm" | "postgresql-docker" | "simulated-laravel";
  conceptBrief: {
    thesis: string;
    diagramType: "lifecycle" | "btree" | "queue" | "diff";
    keyPoints: string[];
  };
  initialCode: string;
  solutionCode: string;
  validationRules: {
    type: "semantic-query-plan" | "ast-property" | "bridge-pest-test";
    expectedAssertions: string[];
    queryBudget?: number; // e.g. <= 3 queries, zero per-row queries
  };
  oralRubric: {
    question: string;
    checkpoints: Array<{
      dimension: "correctness" | "tradeoff" | "failure" | "clarity" | "challenge";
      prompt: string;
    }>;
  };
}
```

## 2. Invariants When Creating Drills
1. **Tier Labeling:** Explicitly assign Tier 1 (Browser), Tier 2 (Simulated), or Tier 3 (Docker).
2. **Query Plan Assertions:** For SQLite, parse normalized operations (`operation: "search"` targeting index). For PostgreSQL, run `ANALYZE` and check plan JSON properties, not rigid exact node types.
3. **Cursor Constraints:** Enforce unique ordering columns and validate that pagination does not assume snapshot-consistent views under concurrent writes.
