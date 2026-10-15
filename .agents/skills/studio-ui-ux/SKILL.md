---
name: studio-ui-ux
description: Standardized UI/UX design tokens, spatial depth & glassmorphism conventions, dark/light theme contracts, motion rules, and React Flow visual styling for SysCraft.
risk: safe
source: internal
date_added: "2026-10-15"
---

# SysCraft UI/UX & Spatial Design System Specification

## When to Use
- Designing or modifying UI layouts, interactive panels, navigation, or dialogs in SysCraft.
- Implementing spatial depth, glassmorphism, or tactile micro-interactions (hover lifts, glowing borders, active state halos).
- Styling React Flow diagrams, tracers, or execution flowcharts.
- Ensuring compliance with MYDS (Malaysia Government Design System) and WCAG 2.2 AA accessibility standards.

## 🎯 Role Overview
You are a senior UI/UX engineer maintaining SysCraft's cohesive, high-end technical studio aesthetic. Your goal is to make the studio feel **weightless, tactile, responsive, and illuminated** without sacrificing readability, performance, or accessibility.

---

## 1. Preferred Tech Stack & Architecture Constraints
- **Styling:** Vanilla CSS with semantic custom properties (`src/index.css`). *Do not introduce Tailwind CSS utilities.*
- **Animation:** Hardware-accelerated CSS transforms (`translateY`, `scale`) and keyframes. *No heavy animation dependencies (GSAP, Three.js, R3F).*
- **Components:** MYDS React design tokens (`@govtechmy/myds-react`), Lucide React icons, Monaco Editor, `@xyflow/react`.
- **Modularity:** Studio architecture must remain strictly decomposed under `src/components/layout/studio/` with `StudioLayout.tsx` acting as a thin orchestrator (< 200 lines).

---

## 2. Palette & Theme Token System

All components must strictly use semantic CSS custom properties defined in `src/index.css`. Never use raw inline hex colors (e.g., `#ffffff`, `#000000`) or hardcoded `rgba()` strings.

### Light Theme Tokens (`:root`)
```css
:root {
  /* Surfaces */
  --studio-bg: #f8fafc;            /* Canvas background (slate-50) */
  --studio-surface: #ffffff;       /* Card & panel surfaces */
  --studio-surface-hover: #f1f5f9; /* Interactive surface hover (slate-100) */
  --studio-surface-subtle: #f8fafc;/* Inset boxes, code backgrounds */

  /* Glassmorphism & Depth */
  --studio-glass-bg: rgba(255, 255, 255, 0.85);
  --studio-glass-border: rgba(226, 232, 240, 0.85);
  --studio-glass-blur: blur(12px);
  --studio-overlay: rgba(15, 23, 42, 0.65);
  
  /* Borders */
  --studio-border: #e2e8f0;        /* Subtle divider borders (slate-200) */
  --studio-border-strong: #cbd5e1; /* Strong input & card borders (slate-300) */
  --studio-border-focus: #0284c7;  /* Focus ring outline (sky-600) */

  /* Typography (WCAG 2.2 AA ≥ 5.1:1 on #f8fafc) */
  --studio-text: #0f172a;          /* Primary body & headers (slate-900) */
  --studio-text-muted: #475569;    /* Secondary captions & labels (slate-600, 5.1:1) */
  --studio-text-faint: #64748b;    /* Subtext & helper badges (slate-500) */
  --studio-text-on-accent: #ffffff;

  /* Accents & Status */
  --studio-primary: #0284c7;       /* Studio brand cyan (sky-600) */
  --studio-primary-glow: rgba(2, 132, 199, 0.15);
  --studio-primary-subtle: rgba(2, 132, 199, 0.08);
  --studio-primary-border: rgba(2, 132, 199, 0.35);

  --studio-success: #059669;       /* Pass / optimized status (emerald-600) */
  --studio-success-glow: rgba(5, 150, 105, 0.15);
  --studio-success-subtle: rgba(5, 150, 105, 0.08);
  --studio-success-border: rgba(5, 150, 105, 0.35);

  --studio-warning: #d97706;       /* Alert status (amber-600) */
  --studio-warning-glow: rgba(217, 119, 6, 0.15);
  --studio-warning-subtle: rgba(217, 119, 6, 0.08);
  --studio-warning-border: rgba(217, 119, 6, 0.35);

  --studio-danger: #dc2626;        /* Error / failure status (red-600) */
  --studio-danger-glow: rgba(220, 38, 38, 0.15);
  --studio-danger-subtle: rgba(220, 38, 38, 0.08);
  --studio-danger-border: rgba(220, 38, 38, 0.35);

  --studio-accent-violet: #7c3aed; /* Architecture / schema accent */
  --studio-accent-violet-glow: rgba(124, 58, 237, 0.15);
  --studio-accent-violet-subtle: rgba(124, 58, 237, 0.08);
  --studio-accent-violet-border: rgba(124, 58, 237, 0.35);

  /* React Flow & Tracer */
  --studio-edge-inactive: rgba(100, 116, 139, 0.45); /* Crisp directional tracking */
  
  /* Shadows & Spatial Elevation */
  --studio-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --studio-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.07);
  --studio-shadow-float: 0 12px 24px -4px rgba(0, 0, 0, 0.12), 0 4px 8px -2px rgba(0, 0, 0, 0.06);
  --studio-shadow-glow: 0 0 16px -2px rgba(2, 132, 199, 0.25);
}
```

### Dark Theme Tokens (`.dark`)
```css
.dark {
  /* Surfaces */
  --studio-bg: #090d16;            /* Deep obsidian studio canvas */
  --studio-surface: #111827;       /* Slate-900 elevated card panels */
  --studio-surface-hover: #1f2937; /* Slate-800 interactive hover */
  --studio-surface-subtle: #0d131f;/* Inset code editors & telemetry wells */

  /* Glassmorphism & Depth */
  --studio-glass-bg: rgba(17, 24, 39, 0.85);
  --studio-glass-border: rgba(148, 163, 184, 0.18);
  --studio-glass-blur: blur(12px);
  --studio-overlay: rgba(3, 7, 18, 0.75);
  
  /* Borders */
  --studio-border: rgba(148, 163, 184, 0.14); /* Crisp hairline border */
  --studio-border-strong: rgba(148, 163, 184, 0.28);
  --studio-border-focus: #38bdf8;  /* Glowing cyan focus ring (sky-400) */

  /* Typography */
  --studio-text: #f8fafc;          /* High contrast heading text (slate-50) */
  --studio-text-muted: #94a3b8;    /* Muted secondary text (slate-400) */
  --studio-text-faint: #64748b;    /* Disabled & watermark text (slate-500) */
  --studio-text-on-accent: #0f172a;

  /* Accents & Status */
  --studio-primary: #38bdf8;       /* Glowing electric cyan */
  --studio-primary-glow: rgba(56, 189, 248, 0.25);
  --studio-primary-subtle: rgba(56, 189, 248, 0.12);
  --studio-primary-border: rgba(56, 189, 248, 0.4);

  --studio-success: #10b981;       /* Emerald neon */
  --studio-success-glow: rgba(16, 185, 129, 0.25);
  --studio-success-subtle: rgba(16, 185, 129, 0.12);
  --studio-success-border: rgba(16, 185, 129, 0.4);

  --studio-warning: #f59e0b;       /* Amber neon */
  --studio-warning-glow: rgba(245, 158, 11, 0.25);
  --studio-warning-subtle: rgba(245, 158, 11, 0.12);
  --studio-warning-border: rgba(245, 158, 11, 0.4);

  --studio-danger: #f43f5e;        /* Rose neon */
  --studio-danger-glow: rgba(244, 63, 94, 0.25);
  --studio-danger-subtle: rgba(244, 63, 94, 0.12);
  --studio-danger-border: rgba(244, 63, 94, 0.4);

  --studio-accent-violet: #a78bfa; /* Violet neon */
  --studio-accent-violet-glow: rgba(167, 139, 250, 0.25);
  --studio-accent-violet-subtle: rgba(167, 139, 250, 0.12);
  --studio-accent-violet-border: rgba(167, 139, 250, 0.4);

  /* React Flow & Tracer */
  --studio-edge-inactive: rgba(148, 163, 184, 0.55);
  
  /* Shadows & Spatial Elevation */
  --studio-shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.3);
  --studio-shadow-md: 0 4px 12px 0 rgba(0, 0, 0, 0.45);
  --studio-shadow-float: 0 16px 32px -4px rgba(0, 0, 0, 0.55), 0 0 1px 1px rgba(255, 255, 255, 0.05);
  --studio-shadow-glow: 0 0 20px -2px rgba(56, 189, 248, 0.35);
}
```

---

## 3. Spatial Depth & Weightlessness Principles

1. **Layered Elevation:**
   - Background canvas: flat `--studio-bg` with subtle dotted grid overlay.
   - Cards & panels: elevated using `--studio-surface`, subtle 1px border, and `--studio-shadow-sm`.
   - Modals, popovers & floating tooltips: floating elevation with `backdrop-filter: var(--studio-glass-blur)`, `--studio-glass-bg`, and `--studio-shadow-float`.
2. **Tactile Hover Lift (`.studio-interactive`):**
   - Interactive module cards and action buttons feature subtle micro-elevation on hover:
     ```css
     .studio-interactive {
       transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, border-color 0.2s ease;
       will-change: transform;
     }
     .studio-interactive:hover {
       transform: translateY(-2px);
       border-color: var(--studio-primary);
       box-shadow: var(--studio-shadow-md);
     }
     ```
3. **Calibrated Depth (No Unreadable Tilts):**
   - Keep code editors, data tables, EXPLAIN plans, and forms strictly orthogonal (no 3D rotations or isometric tilts that distort text).
   - Use depth for Z-axis hierarchy, elevation shadows, and illuminated borders.

---

## 4. Studio Component Architecture (`src/components/layout/studio/`)

The Studio must follow this decomposed architecture:

- **`StudioLayout.tsx`**: Lightweight orchestrator (< 200 lines). Connects session hook to header, stepper, active step view, and footer.
- **`useStudioSession.ts`**: Pure state hook handling drill selection, Monaco state sync, hints, solution reveal, sprint timers, and storage envelopes.
- **`StudioHeader.tsx`**: Week selector dropdown with `aria-live` announcement, track pills, and utilities menu.
- **`StudioStepper.tsx`**: 5-step sequential flow (`Concept Brief` → `Focused Drill` → `Analysis & Feedback` → `Oral Rubric` → `Tracer Replay`).
- **`StepConceptBrief.tsx`**: 2-column problem statement, architecture context, and constraints.
- **`StepFocusedDrill.tsx`**: Monaco editor, progressive hints drawer, reference solution modal, run controls.
- **`StepAssertionOutput.tsx`**: Single authoritative home for assertion results, diagnostics, diffs, and EXPLAIN cost plans.
- **`StepOralRubric.tsx`**: Senior interview defense checklist with qualitative rubric & STAR story builder.
- **`StepTracerReplay.tsx`**: Planar 9-step execution tracer with snake topology.
- **`StudioFooter.tsx`**: Step navigation, completion summary.
- **`ResetProgressModal.tsx`**: Accessible glass dialog with `role="alertdialog"`.

---

## 5. Teaching Flow & Scaffolding Invariant

1. **Progressive Hint Disclosure:**
   - Drill definitions provide structured hints (`hints: string[]`).
   - Hints unlock one at a time via a compact collapsible drawer.
   - Reference solution is locked behind an explicit confirmation modal.
2. **Scaffolding Telemetry Invariant (Strict Rule):**
   - Hints and solution reveal are recorded (`hintsUsed: number`, `solutionRevealed: boolean`) in session state and exported in `ExportEnvelopeV2`.
   - **Hints and solutions NEVER deduct points from the Oral Rubric score or cap drill completion.**
   - Display hint usage as a neutral informational chip in Step 4 ("Hint used", "Solution referenced") for learner review context only.

---

## 6. React Flow Visual Standards (Flowchart & Tracer Replay)

1. **Custom Node Rules:**
   - Width: `240px` to `260px` with uniform card padding (`12px 14px`).
   - Border radius: `10px` with hairline border (`1px solid var(--studio-border)`).
   - Card background: `var(--studio-surface)` with backdrop blur or subtle gradient.
   - Non-overlapping planar handle routing (Left/Right/Top/Bottom per row).
2. **State Signaling:**
   - **Inactive Edge:** `var(--studio-edge-inactive)` with `strokeWidth: 2`.
   - **Active Edge:** `var(--studio-primary)` animated (`animated: true`) with `strokeWidth: 3`.
   - **Completed Past Edge:** `var(--studio-success)` with `strokeWidth: 2`.
   - Inactive edge markers must match `var(--studio-edge-inactive)`.
3. **Viewport Responsiveness:**
   - Attach `ResizeObserver` to the flow container to automatically call `fitView({ padding: 0.15 })` on window or pane resize.
   - Include `fitViewOptions={{ padding: 0.15 }}` on `<ReactFlow>`.
4. **Accessible Alternative:**
   - Every diagram must have an immediate toggle button: *"Accessible Table View"* displaying all nodes and transitions in a standard semantic HTML `<table>`.

---

## 7. Accessibility Checklist (WCAG 2.2 AA & MYDS)

1. **Contrast:** All body and muted text must achieve ≥ 4.5:1 (SysCraft targets ≥ 5.1:1 on both light and dark modes).
2. **Focus Indicators:** Universal 3px focus rings on `:focus-visible` for all interactive elements (`outline: 3px solid var(--studio-border-focus); outline-offset: 2px;`).
3. **Keyboard Navigation:**
   - Monaco Editor has an explicit `<kbd>Esc</kbd> releases focus` badge bound via `aria-describedby`.
   - Steppers, tabs, and radio groups support standard arrow-key navigation (Left/Right/Up/Down) with roving `tabIndex`.
4. **Form Labels:** Explicit `htmlFor` and `id` bindings on all inputs (e.g., STAR Story builder using `useId()`).
5. **No Color-Only Cues:** Pair all pass/fail tags with text and icons (e.g., Checkmark for PASS, Alert for FAIL).
6. **Reduced Motion:** All hover lifts, keyframe animations, and pulsing halos must disable cleanly under `@media (prefers-reduced-motion: reduce)`.
