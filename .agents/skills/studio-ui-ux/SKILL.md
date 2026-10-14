---
name: studio-ui-ux
description: Standardized UI/UX design tokens, component styling conventions, dark/light theme contracts, and React Flow visual styling for SysCraft.
---

# SysCraft UI/UX Design System Specification

Use this skill to ensure all UI elements, layout components, and visual simulations in SysCraft maintain a cohesive, high-end technical studio aesthetic conforming to both **MYDS (Malaysia Government Design System)** principles and modern developer studio standards.

---

## 1. Palette & Theme Token System

All components must strictly use semantic CSS custom properties defined in `src/index.css`. Never use raw inline hex colors (like `#ffffff` or `#000000`) for surfaces or text.

### Light Theme Tokens (`:root`)
```css
:root {
  /* Surfaces */
  --studio-bg: #f8fafc;            /* Canvas background (slate-50) */
  --studio-surface: #ffffff;       /* Card & panel surfaces */
  --studio-surface-hover: #f1f5f9; /* Interactive surface hover (slate-100) */
  --studio-surface-subtle: #f8fafc;/* Inset boxes, code backgrounds */
  
  /* Borders */
  --studio-border: #e2e8f0;        /* Subtle divider borders (slate-200) */
  --studio-border-strong: #cbd5e1; /* Strong input & card borders (slate-300) */
  --studio-border-focus: #0284c7;  /* Focus ring outline (sky-600) */

  /* Typography */
  --studio-text: #0f172a;          /* Primary body & headers (slate-900) */
  --studio-text-muted: #64748b;    /* Secondary captions & labels (slate-500) */
  --studio-text-faint: #94a3b8;    /* Watermarks & disabled text (slate-400) */

  /* Accents */
  --studio-primary: #0284c7;       /* GovTech / studio brand cyan (sky-600) */
  --studio-primary-glow: rgba(2, 132, 199, 0.15);
  --studio-success: #059669;       /* Pass / optimized status (emerald-600) */
  --studio-warning: #d97706;       /* Review / unoptimized alert (amber-600) */
  --studio-danger: #dc2626;        /* Fail / error status (red-600) */
  
  /* Shadows */
  --studio-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --studio-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.07);
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
  
  /* Borders */
  --studio-border: rgba(148, 163, 184, 0.14); /* Crisp hairline border */
  --studio-border-strong: rgba(148, 163, 184, 0.28);
  --studio-border-focus: #38bdf8;  /* Glowing cyan focus ring (sky-400) */

  /* Typography */
  --studio-text: #f8fafc;          /* High contrast heading text (slate-50) */
  --studio-text-muted: #94a3b8;    /* Muted secondary text (slate-400) */
  --studio-text-faint: #64748b;    /* Disabled & watermark text (slate-500) */

  /* Accents */
  --studio-primary: #38bdf8;       /* Glowing electric cyan */
  --studio-primary-glow: rgba(56, 189, 248, 0.25);
  --studio-success: #10b981;       /* Emerald neon */
  --studio-warning: #f59e0b;       /* Amber neon */
  --studio-danger: #f43f5e;        /* Rose neon */
  
  /* Shadows */
  --studio-shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.3);
  --studio-shadow-md: 0 4px 12px 0 rgba(0, 0, 0, 0.45);
}
```

---

## 2. Editor & IDE Theming Rules
1. **Monaco Synchronization:**
   - When `isDark === true`, set Monaco `theme="vs-dark"`.
   - When `isDark === false`, set Monaco `theme="light"`.
2. **Focus & Escape Hatch:**
   - Monaco container must have an explicit caption: `Esc releases focus`.
   - Clicking outside or pressing Escape transfers focus back to the parent studio container.

---

## 3. React Flow Visual Standards (Flowchart & Tracer Replay)

Never render React Flow with generic unstyled default boxes. Use **Custom Node Components**:

```text
+--------------------------------------------------------------+
| [Step #1]                     [PHASE: BOOTSTRAP]             |
| Client HTTP Ingress                                          |
| METHOD: GET /api/posts                                       |
| ------------------------------------------------------------ |
| Web server dispatches raw HTTP request to public/index.php.  |
| ● Active Packet Token                                        |
+--------------------------------------------------------------+
```

### Custom Node Rules:
1. **Layout & Geometry:**
   - Width: `240px` to `260px` with uniform card padding (`12px 14px`).
   - Border radius: `10px` with hairline border (`1px solid var(--studio-border)`).
   - Card background: `var(--studio-surface)` with backdrop blur or subtle gradient.
2. **State Signaling:**
   - **Inactive Node:** Muted border (`var(--studio-border)`), opacity `0.85`.
   - **Active Node:** Bold glowing border (`2px solid var(--studio-primary)`), halo shadow (`0 0 20px var(--studio-primary-glow)`), scale `1.02`.
   - **Completed Past Node:** Emerald accent border (`1.5px solid var(--studio-success)`), subtle completion badge `✓`.
3. **Edges & Animations:**
   - Use `type="smoothstep"` or `type="bezier"` edges with rounded corners.
   - Active edge must be animated (`animated: true`) with glowing stroke width `3px`.
   - Marker end: `MarkerType.ArrowClosed` matching current node theme.
4. **Canvas Background:**
   - Use `<Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="var(--studio-border-strong)" />`.

---

## 4. Accessibility Checklist (WCAG 2.2)
1. **Zoom & Reflow:** Whole layout must adapt cleanly at 400% zoom without page-level horizontal scroll.
2. **Keyboard Alternative:** Every diagram must have an immediate toggle button: *"Accessible Table View"* displaying all nodes and transitions in a standard HTML table.
3. **Focus States:** Every interactive button and input must have visible focus rings (`3px solid var(--studio-border-focus)`).
4. **No Color-Only Cues:** Pair all pass/fail tags with text and icons (e.g., Checkmark for PASS, Cross for FAIL).
