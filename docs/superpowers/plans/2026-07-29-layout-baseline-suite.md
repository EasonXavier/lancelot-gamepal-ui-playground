# Compact Layout and Baseline Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the mobile layout and add a one-click four-mode performance baseline suite without weakening the existing standalone benchmark or device-evidence boundary.

**Architecture:** A framework-independent `BaselineSuiteRunner` orchestrates the existing 30-second `BenchmarkRunner` four times with an unsampled three-second settle before every run. React owns temporary Glass overrides, modal-sheet UI, immutable report snapshots, and restoration; the serializer moves all single and suite reports to one schema-version-2 `runs[]` model.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, React Testing Library, CSS, GitHub Actions Pages.

## Global Constraints

- Work only in the standalone repository and the `codex/layout-baseline-suite` branch based on `origin/main@b7b421b`.
- Preserve `LSVIS TD.woff2`, the character asset, shared React/DOM Glass surfaces, Pages base path, and selected-only glow rule.
- Fixed suite order is `real`, `simulated`, `preblur`, `off`; each mode settles for 3,000ms and then runs the existing 30,000ms benchmark, for 132,000ms total without interruptions.
- Freeze all non-Glass effective settings at suite start; temporary Glass overrides must never be persisted.
- Cancelled active runs never enter `runs[]`. Completed suite runs survive later cancellation or failure.
- No backend, telemetry, report history, new runtime dependency, formal Release, or Git tag.
- Desktop and simulated browser evidence never completes real-device Safe Area, WeChat WebView, or device-performance acceptance.

---

### Task 1: Baseline suite state machine

**Files:** Create `src/performance/baselineSuiteRunner.ts`; test `tests/performance/baselineSuiteRunner.test.ts`.

**Interfaces:** Produce `BASELINE_MODE_ORDER`, `BaselineSuiteStatus`, `BaselineSuiteFailureReason`, `BaselineSuiteState`, `BaselineSuiteRun`, `BaselineSuiteContext`, and `BaselineSuiteRunner`. The runner consumes existing `BenchmarkClock`, `BenchmarkRunner`, and `BenchmarkContext`; it exposes `start`, `cancel`, `setVisibility`, `failOrientationChange`, and `getState`.

- [ ] Write fake-clock tests proving the exact four `3,000 + 30,000` transitions, independent metric resets/captures, fixed order, and 132,000ms completion; run them and confirm RED because the API is missing.
- [ ] Implement the minimal runner and rerun the focused test to GREEN.
- [ ] Add RED tests for cancel during settle/run, completed-run retention, visibility retry, third consecutive interruption failure, orientation failure, timer cleanup, and exact completion-boundary races.
- [ ] Implement each edge case minimally, refactor only after GREEN, run all performance tests, and commit.

### Task 2: Controller integration and schema-version-2 reports

**Files:** Modify `src/hooks/useBenchmarkController.ts`, `src/App.tsx`, `src/performance/reportExporter.ts`, and `src/performance/reportActions.ts`; test their existing focused suites.

**Interfaces:** Extend `BenchmarkController` with suite state/actions and one `workloadLocked` flag while retaining single `start`, `cancel`, and `state`. Replace v1 top-level settings/performance with v2 `reportType`, common environment, benchmark metadata, and `runs[]`; single success has one run, single cancel has zero, suite completion has four.

- [ ] Write RED controller tests for mutual exclusion, frozen settings, non-persisted Glass overrides, restoration on every terminal path, and active-run exclusion.
- [ ] Implement suite ownership in the hook/App and make focused controller tests GREEN.
- [ ] Write RED serializer/action tests for schema v2, 0/1/4 runs, retention, eligibility, sanitation, stable JSON, summary rows, copy, and download.
- [ ] Implement immutable v2 snapshots/actions, remove v1 assumptions, run focused and full tests, and commit.

### Task 3: Compact home, interactive HUD, and modal experiment sheet

**Files:** Modify home/HUD/experiment-panel components and their colocated CSS; test the related suites under `tests/ui/`.

**Interfaces:** HUD compact mode becomes a one-line button with `aria-expanded`; compact/expanded changes use the settings callback and are disabled while workload-locked. The panel becomes an `aria-modal` bottom sheet with scrim, focus entry/cycle/restore, idle Escape/scrim dismissal, and benchmark-controlled open/close.

- [ ] Write RED UI tests for HUD toggling/locking, modal/focus behavior, suite controls/progress/results, and disabled workload mutations.
- [ ] Implement semantic component changes and make focused tests GREEN.
- [ ] Adjust CSS so the game rail begins near 42% viewport height, unequal service cards clear the fixed nav/Safe Area, the sheet is bounded by `--app-height`, and only its middle body scrolls.
- [ ] Run UI tests, typecheck, lint, and format check; commit after GREEN.

### Task 4: Documentation and local/browser acceptance

**Files:** Modify `README.md`, `docs/performance-metrics.md`, `docs/device-test-template.md`, `docs/ui-exploration-plan.md`, and the three persistent planning files.

**Interfaces:** Document v2 report fields, the one-suite device workflow, fixed-order thermal bias, optional repeats, and the remaining `pending-device` boundary.

- [ ] Update documentation to match implemented UI, timing, termination semantics, and schema v2 without claiming device evidence.
- [ ] Run typecheck, lint, format check, all tests, build, `git diff --check`, and repository privacy/path scans.
- [ ] Validate 375×812, 390×844, 393×852, 430×932, and 844×390 in production preview with no overflow, service/nav overlap, sheet overflow, console errors, or glow regression.
- [ ] Run one complete 132-second desktop suite, export v2, record it as desktop-only evidence, update progress, and commit.

### Task 5: Review, merge, Pages deployment, and live verification

**Files:** Modify only review-required fixes and final progress evidence.

**Interfaces:** Produce a review-clean branch, ready PR, merge commit on `main`, successful Pages workflow, and live verification at `https://easonx.me/lancelot-gamepal-ui-playground/`.

- [ ] Run scoped task reviews and whole-branch review; fix every Critical/Important finding with focused regression tests.
- [ ] Rerun the complete local gate and staged privacy/absolute-path scan.
- [ ] Push the branch, create a ready PR, merge to `main`, and wait for target Pages build/deploy success.
- [ ] Verify live assets, 390×844 layout, modal sheet, suite start/cancel, and one complete desktop suite; retain real-device items as `pending-device`.
- [ ] Record exact commit, PR, workflow, asset, and live evidence; do not create a Release or tag.
