# Accessibility Standards (WCAG 2.2 & MYDS)

Every view, component, and drill in SysCraft must satisfy these institutional accessibility criteria:

---

## 1. Zoom & Reflow
- Support 200% text resizing without clipping text or dropping controls.
- Support 400% page zoom with zero page-level horizontal scroll.
- Editor exception: Internal horizontal code scrolling inside Monaco is permitted; surrounding page shell must reflow cleanly.

---

## 2. Keyboard Navigation
- All controls must be reachable via Tab / Shift+Tab and operable with Enter / Space.
- Visual diagram alternative: React Flow must offer an accessible non-drag alternative view (step-by-step list / table of nodes and data transitions).
- Escape Hatch: Pressing `Escape` in Monaco Editor releases keyboard trap and shifts focus back to the parent container.

---

## 3. Visual & Audio Restraint
- Target Size: Minimum $24 \times 24$ CSS pixels for all clickable elements.
- Focus Indicators: Minimum 3:1 contrast ratio against adjacent backgrounds.
- No Color-Only State: Never indicate pass/fail using color alone; pair color with icons (e.g. checkmark / cross) and clear text labels.
- Screen-Reader Milestones: Live regions (`aria-live="polite"`) on countdown timers must announce only milestone intervals ("5 minutes remaining", "1 minute remaining", "Time expired"), never ticking every second.
- Motion: Respect `prefers-reduced-motion: reduce` by halting packet animations and disabling animated transitions.
