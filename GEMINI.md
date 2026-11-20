# Zyvra Engineering & UI Guidelines

This document outlines the architectural, visual, and operational standards for the **Zyvra** platform. All agents, contributors, and features must adhere to these rules.

---

## 1. UI & Visual Philosophy: Minimalism • Modern / Experimental
- **Aesthetic:** A restrained approach focused on essential elements and generous whitespace.
- **Visual Clutter:** Avoid crowded grids, redundant banners, or dense walls of text. Provide breathing room around interactive elements.
- **Consistency:** Use consistent corner radii (`rounded-2xl`, `rounded-3xl`), subtle micro-borders (`border border-slate-200 dark:border-slate-800`), and restrained shadows.

---

## 2. Color Palette & Dark / Light Contrast
- **Dark Mode (Default Obsidian Theme):**
  - Page Background: `#0B1120`
  - Elevated Cards / Panels: `#1E293B` or `#0F172A`
  - Borders: `border-slate-800` or `border-indigo-500/20`
  - Primary Text: `text-slate-100` or `text-white`
  - Secondary / Muted Text: `text-slate-400`
  - Accents: Indigo (`#6366F1`), Amber (`#F59E0B`), Emerald (`#10B981`)
- **Light Mode (Clean Slate Theme):**
  - Page Background: `#F8FAFC`
  - Elevated Cards / Panels: `#FFFFFF`
  - Borders: `border-slate-200`
  - Primary Text: `text-slate-900`
  - Secondary / Muted Text: `text-slate-500`
- **Rule:** Never use hardcoded light backgrounds like `#f4faf7` or `#F7FAF8` in dark mode. Always use standard Tailwind `dark:` variants.

---

## 3. Responsive Layout & Mobile Usability
- **Page Container Standard:**
  All inner student pages must use the standardized breathing container:
  ```jsx
  <div className="w-full max-w-4xl min-w-0 mx-auto space-y-4 sm:space-y-6 pb-6">
  ```
- **Eliminate Mobile Congestion:**
  - Never wrap student content in restrictive constraints like `max-w-3xl` or `max-w-2xl px-3.5 sm:px-6` inside `.student-page-content` (it wastes ~60px of screen real estate on mobile phones).
- **Touch Targets:**
  - All clickable buttons, pills, and icons must meet or exceed a minimum 44×44px touch target for mobile usability.
- **Keyboard Handling:**
  - Forms and inputs must not cause awkward layout jumps or cover bottom action bars when the soft keyboard is invoked.

---

## 4. 60 FPS Performance & Transitions
- **GPU-Accelerated Animations:**
  - Only animate `transform` (scale, translate) and `opacity`. Avoid animating layout-triggering properties (`width`, `height`, `margin`, `padding`, `top`, `left`).
- **Zero Cumulative Layout Shift (CLS = 0):**
  - Skeleton loaders and placeholder cards must match the dimensions of the loaded content to prevent screen jumping.
- **List Virtualization / Clamping:**
  - For long question sets or lists, paginate or clamp items smoothly to avoid DOM bloat.

---

## 5. Zyvra AI Guru Guidelines
- **Live Exam Integrity (No Cheating):**
  - The AI Guru modal and floating assistant MUST remain strictly disabled and inaccessible during live test sessions (`LiveQuiz.jsx`).
- **Post-Exam Doubt Solver:**
  - In `QuizResult.jsx`, provide intuitive "Ask Zyvra AI Guru" actions next to incorrect or flagged questions so students can clear doubts.
- **Toolbox & Home Integration:**
  - AI Guru is highlighted in `StudentToolbox.jsx` via the dedicated spotlight card and category tab, as well as the quick-access pill on `StudentHome.jsx`.

---

## 6. Testing & Quality Verification
- **Automated Tests:**
  - Always verify code changes with `npm test -- --run` before committing.
  - Zero test regressions are tolerated (all 117+ tests must pass).
- **Production Build:**
  - Run `npm run build` to verify Vite bundling, tree-shaking, and syntax correctness.
