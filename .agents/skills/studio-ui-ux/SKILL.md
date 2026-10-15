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
- **Styling:** Vanilla CSS with semantic custom properties (`src/index.css`). *Do not introduce Tailwind CSS.*
- **Animation:** CSS transforms (`translateY`, `scale`) and keyframes. *No heavy animation dependencies (GSAP, Three.js, R3F).*
- **Components:** MYDS React design tokens (`@govtechmy/myds-react`), Lucide React icons, Monaco Editor, `@xyflow/react`.
- **Performance Budget:** Animate only hardware-accelerated properties (`transform`, `opacity`). Never animate `box-shadow`, `filter`, or layout dimensions continuously.

---

## 2. Palette & Theme Token System

All components must strictly use semantic CSS custom properties defined in `src/index.css`. Never use raw inline hex colors (e.g., `#ffffff`, `#000000`, `#0284c7`).

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
  --studio-glass-border: rgba(226, 232, 240, 0.8);
  --studio-glass-blur: blur(12px);
  
  /* Borders */
  --studio-border: #e2e8f0;        /* Subtle divider borders (slate-200) */
  --studio-border-strong: #cbd5e1; /* Strong input & card borders (slate-300) */
  --studio-border-focus: #0284c7;  /* Focus ring outline (sky-600) */

  /* Typography */
  --studio-text: #0f172a;          /* Primary body & headers (slate-900) */
  --studio-text-muted: #64748b;    /* Secondary captions & labels (slate-500) */
  --studio-text-faint: #94a3b8;    /* Watermarks & disabled text (slate-400) */

  /* Accents */
  --studio-primary: #0284c7;       /* Studio brand cyan (sky-600) */
  --studio-primary-glow: rgba(2, 132, 199, 0.15);
  --studio-success: #059669;       /* Pass / optimized status (emerald-600) */
  --studio-warning: #d97706;       /* Alert status (amber-600) */
  --studio-danger: #dc2626;        /* Error / failure status (red-600) */
  
  /* Shadows & Spatial Elevation */
  --studio-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --studio-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.07);
  --studio-shadow-float: 0 12px 24px -4px rgba(0, 0, 0, 0.08), 0 4px 8px -2px rgba(0, 0, 0, 0.04);
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
  --studio-glass-bg: rgba(17, 24, 39, 0.75);
  --studio-glass-border: rgba(148, 163, 184, 0.14);
  --studio-glass-blur: blur(12px);
  
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
  
  /* Shadows & Spatial Elevation */
  --studio-shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.3);
  --studio-shadow-md: 0 4px 12px 0 rgba(0, 0, 0, 0.45);
  --studio-shadow-float: 0 16px 32px -4px rgba(0, 0, 0, 0.55), 0 0 1px 1px rgba(255, 255, 255, 0.05);
}
```

---

## 3. Spatial Depth & Weightlessness Principles

1. **Layered Elevation:**
   - Background canvas: flat `--studio-bg` with subtle dotted grid overlay.
   - Cards & panels: elevated using `--studio-surface`, subtle 1px border, and `--studio-shadow-sm`.
   - Modals, popovers & floating tooltips: floating elevation with `backdrop-filter: var(--studio-glass-blur)`, `--studio-glass-bg`, and `--studio-shadow-float`.
2. **Tactile Hover Lift:**
   - Interactive module cards and action buttons should feature subtle micro-elevation on hover:
     ```css
     transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, border-color 0.2s ease;
     &:hover {
       transform: translateY(-2px);
       border-color: var(--studio-primary);
     }
     ```
3. **Calibrated Depth (No Unreadable Tilts):**
   - Keep code editors, data tables, EXPLAIN plans, and forms strictly orthogonal (no 3D rotations or isometric tilts that distort text).
   - Use depth for Z-axis hierarchy, elevation shadows, and illuminated borders.

---

## 4. Motion & Animation Standards

1. **Immediate Feedback:** Interactive actions (run code, evaluate plan, step tracer) must show immediate visual feedback (loading spinners, badge updates, or polite aria notices).
2. **Staggered Matrix Entrances:** When displaying grids of cards (such as the 7-week curriculum matrix), apply staggered CSS entrance animations:
   ```css
   @keyframes studio-fade-up {
     from { opacity: 0; transform: translateY(8px); }
     to { opacity: 1; transform: translateY(0); }
   }
   .home-module-card {
     animation: studio-fade-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
   }
   .home-module-card:nth-child(1) { animation-delay: 0.04s; }
   .home-module-card:nth-child(2) { animation-delay: 0.08s; }
   /* ... */
   ```
3. **Status Pulse Indicators:** Glowing live badges (e.g. running sprint timer, connected Docker bridge) should use subtle 2-second looping keyframe pulses on opacity or box-shadow halo (`0 0 8px var(--studio-primary-glow)`).
4. **Mandatory Reduced Motion (`prefers-reduced-motion: reduce`):**
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after {
       animation-duration: 0.01ms !important;
       animation-iteration-count: 1 !important;
       transition-duration: 0.01ms !important;
       scroll-behavior: auto !important;
     }
   }
   ```

---

## 5. Editor & IDE Theming Rules
1. **Monaco Synchronization:**
   - When `isDark === true`, set Monaco `theme="vs-dark"`.
   - When `isDark === false`, set Monaco `theme="light"`.
2. **Focus & Escape Hatch:**
   - Monaco container must display an explicit caption: `Esc releases focus`.
   - Pressing Escape or clicking outside transfers focus back to the parent studio container.

---

## 6. React Flow Visual Standards (Flowchart & Tracer Replay)

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

## 7. Accessibility Checklist (WCAG 2.2 AA & MYDS)
1. **Zoom & Reflow:** Entire layout must adapt cleanly at 400% zoom without page-level horizontal scroll.
2. **Keyboard Alternative:** Every diagram must have an immediate toggle button: *"Accessible Table View"* displaying all nodes and transitions in a standard semantic HTML table.
3. **Focus States:** Every interactive button and input must have visible focus rings (`3px solid var(--studio-border-focus)` with `outline-offset: 2px`).
4. **No Color-Only Cues:** Pair all pass/fail tags with text and icons (e.g., Checkmark for PASS, Alert for FAIL).
5. **Reduced Motion:** Verify all animations and pulsing halos disappear cleanly under `prefers-reduced-motion: reduce`.
