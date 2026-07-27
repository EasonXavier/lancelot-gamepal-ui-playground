# 朗世乐移动 UI 性能试验场 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建并公开部署一个在真实移动 WebView 中比较四种毛玻璃实现、动态负载、触摸反馈和浏览器性能指标的独立实验应用。

**Architecture:** React 只负责低频状态和界面组合；RAF、Canvas、PerformanceObserver 与固定容量采样器位于独立性能模块，通过最多 4Hz 的快照进入 HUD。四种 Glass Mode 共用同一 DOM、图片与动画树，仅切换表面策略；Benchmark 用可测试的纯状态机驱动 30 秒流程并在结束后恢复现场。

**Tech Stack:** Vite, React, TypeScript, Framer Motion, Canvas 2D, web-vitals, Vitest, React Testing Library, ESLint, Prettier, GitHub Actions Pages

## Global Constraints

- 唯一仓库与工作目录是 `EasonXavier/lancelot-gamepal-ui-playground`；不得访问或修改 `EasonXavier/lancelot-gamepal`。
- 品牌固定为“朗世乐”；首页只显示四个指定游戏、六个指定入口和五个指定底栏项。
- `LSVIS TD.woff2` 仅作 Demo 字体，通过单一 CSS 变量引用并记录来源。
- 角色原图是用户提供且允许使用的公开素材；入库前移除 EXIF，并保持可替换。
- 普通玻璃不得边缘发光；只有选中的游戏、导航或实验选项允许强调光效。
- 四种 Glass Mode 共享内容、布局、图片、动画和 DOM，一次只激活一种，不隐藏渲染四套页面。
- RAF 每帧只采样，不每帧 `setState`；HUD 最多每秒更新四次；hidden 时暂停并在 visible 后重校准。
- 无法测量的数据必须显示 `N/A`、`Not measurable` 或 `Unsupported by this WebView`，不得伪造为 0。
- 所有报告仅在本地处理；不得收集 IP、Cookie、Token、精确位置、微信身份或真实业务数据。
- Vite `base` 固定为 `/lancelot-gamepal-ui-playground/`，Pages 构建目录为 `dist/`。
- 本次不创建正式 Release 或版本标签；工作构建使用 `0.1.0+YYYYMMDD.HHmm.COMMIT`，无 commit 时使用 `draft`。

---

### Task 1: 工程基础、公开素材与设计系统

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `.prettierrc.json`, `.gitignore`, `index.html`
- Create: `public/assets/character-source.png`, `public/assets/fonts/lsvis-td.woff2`
- Create: `src/styles/tokens.css`, `src/styles/global.css`, `src/styles/motion.css`, `src/buildInfo.ts`
- Create: `ASSET_SOURCES.md`, `SECURITY.md`, `LICENSE`

**Interfaces:**
- Produces: `BuildInfo { version: string; buildVersion: string }`, CSS variables `--font-brand`, `--glass-*`, `--accent-*`, `--safe-*`.

- [x] **Step 1: Create configuration and scripts**

  Define scripts `dev`, `typecheck`, `lint`, `format:check`, `test`, `test:watch`, `build`, `preview`; pin React/Vite/Vitest-compatible dependencies. The first local checkpoint is `9f26f73`; the deployable checkpoint is `d20b849`, with working build metadata `0.1.0+20260727.1309.d20b849`.

- [x] **Step 2: Acquire and sanitize public assets**

  Download the user-named font from the raw GitHub URL. Re-encode the user-provided PNG into a new PNG to remove metadata, verify it has no EXIF/text chunks, and record both sources, ownership statement, public permission, transformation, and replacement intent in `ASSET_SOURCES.md`.

- [x] **Step 3: Define the design tokens**

  Include exact palette roles for graphite background, neutral glass borders, champagne selected accent, text hierarchy, radii, spacing, shadow, duration, `@font-face`, and a separate selected glow token so base glass never emits light.

- [ ] **Step 4: Verify configuration**

  Run `npm install`, `npm run typecheck`, `npm run lint`, and `npm run build`. Expected: clean exit; `dist/` references `/lancelot-gamepal-ui-playground/` assets.

  Checkpoint state: install, typecheck and lint passed; build is deferred until the test-driven app entry exists.

### Task 2: 帧数学、环形缓冲与采样器（TDD）

**Files:**
- Create: `src/performance/types.ts`, `src/performance/ringBuffer.ts`, `src/performance/frameMath.ts`, `src/performance/frameSampler.ts`
- Test: `tests/performance/frameMath.test.ts`, `tests/performance/frameSampler.test.ts`

**Interfaces:**
- Produces: `median(values: readonly number[]): number | null`, `percentile(values, quantile): number | null`, `estimateDroppedFrames(intervals, baseline): number`, `FrameSampler.start()`, `pause()`, `resume()`, `reset()`, `subscribe(listener)`, `getSnapshot()`.

- [x] **Step 1: Write failing frame-math tests**

  Cover empty input, odd/even median, P95 nearest-rank behavior, adaptive baseline refresh interval, 33.3/50ms long-frame counts, and Estimated Dropped Frames without assuming 60Hz.

- [x] **Step 2: Run RED**

  Run `npm test -- tests/performance/frameMath.test.ts`. Expected: FAIL because `frameMath.ts` exports do not exist.

- [x] **Step 3: Implement pure frame math**

  Use sorted copies for percentile/median and `Math.max(0, Math.round(interval / baseline) - 1)` per eligible interval for estimated dropped frames.

- [x] **Step 4: Write failing sampler lifecycle tests**

  Inject RAF/cancel/time functions; verify fixed capacity, listener updates no faster than 250ms, hidden pause, visible resume discarding the background gap, and baseline recalibration.

- [x] **Step 5: Run RED, implement sampler, run GREEN**

  Run `npm test -- tests/performance/frameSampler.test.ts`, implement a single RAF loop with refs/internal fields and cleanup, then rerun both test files. Expected: PASS.

### Task 3: 浏览器性能观察与环境能力（TDD）

**Files:**
- Create: `src/performance/webVitals.ts`, `src/performance/mainThreadMetrics.ts`, `src/performance/navigationMetrics.ts`, `src/performance/resourceMetrics.ts`, `src/performance/environmentInfo.ts`
- Test: `tests/performance/observers.test.ts`, `tests/performance/environmentInfo.test.ts`

**Interfaces:**
- Produces: `PerformanceCapabilities`, `WebVitalsSnapshot`, `MainThreadSnapshot`, `ResourceSnapshot`, `EnvironmentSnapshot`, each using explicit availability states rather than numeric sentinel zeroes.

- [x] **Step 1: Write failing capability tests**

  Verify unsupported PerformanceObserver entry types return `{ status: 'unsupported' }`; INP without interaction returns `waiting`; missing transfer sizes return `not-measurable`; unavailable device memory/network fields remain `null`.

- [x] **Step 2: Run RED**

  Run `npm test -- tests/performance/observers.test.ts tests/performance/environmentInfo.test.ts`. Expected: FAIL on missing modules.

- [x] **Step 3: Implement observer factories and cleanup**

  Feature-detect `navigation`, `paint`, `largest-contentful-paint`, `layout-shift`, `event`, `longtask`, and `long-animation-frame`; return cleanup functions and never register duplicate global observers.

- [x] **Step 4: Integrate `web-vitals` lazily**

  Dynamically import `web-vitals` after app mount so first render is not blocked; store real TTFB/FCP/LCP/CLS/INP values and their rating/delta when emitted.

- [x] **Step 5: Run GREEN**

  Run both test files. Expected: PASS with mocked browser capability surfaces and no unhandled promise rejection.

### Task 4: 设置状态、报告与 30 秒 Benchmark（TDD）

**Files:**
- Create: `src/experiments/settings.ts`, `src/performance/reportExporter.ts`, `src/performance/benchmarkRunner.ts`
- Test: `tests/experiments/settings.test.ts`, `tests/performance/reportExporter.test.ts`, `tests/performance/benchmarkRunner.test.ts`

**Interfaces:**
- Produces: `ExperimentSettings`, `GlassMode = 'real' | 'simulated' | 'preblur' | 'off'`, `MotionLevel`, `DprMode`; `serializeReport(snapshot): string`; `BenchmarkRunner.start(context)`, `cancel()`, `getState()`.

- [x] **Step 1: Write failing settings tests**

  Verify one Glass Mode at a time, immediate immutable setting updates, reduced-motion override, DPR caps, reset behavior, and schema-versioned local persistence without rebuilding app state.

- [x] **Step 2: Write failing report tests**

  Verify stable JSON schema, explicit estimate labels, null/unsupported serialization, and absence of cookie/token/IP/location/user identity fields.

- [x] **Step 3: Write failing Benchmark tests**

  Using a fake clock, verify exact phases `warmup 3s → ambient 8s → stress 8s → scroll-transition 8s → summarize 3s`, foreground completeness tracking, background sample exclusion, cancellation, and restoration of scroll/category/particle/panel state.

- [x] **Step 4: Run RED**

  Run the three test files. Expected: FAIL because settings/report/runner modules are missing.

- [x] **Step 5: Implement minimal modules and run GREEN**

  Keep the runner independent of React using injected clock/actions/snapshot functions. Rerun all three test files. Expected: PASS.

### Task 5: 主界面、Glass Surface 与交互壳（TDD）

**Files:**
- Create: `src/main.tsx`, `src/App.tsx`, `src/experiments/home/HomeScreen.tsx`
- Create: `src/components/glass/GlassSurface.tsx`, `src/components/navigation/GameRail.tsx`, `src/components/navigation/BottomNav.tsx`, `src/components/controls/ServiceGrid.tsx`, `src/components/controls/ExperimentalPlaceholder.tsx`
- Test: `tests/ui/homeScreen.test.tsx`, `tests/ui/glassSurface.test.tsx`

**Interfaces:**
- Consumes: `ExperimentSettings`, `GlassMode`.
- Produces: accessible controls with exact copy and `data-glass-mode`, `data-selected`, `aria-current`, `aria-pressed` state.

- [ ] **Step 1: Write failing UI tests**

  Assert brand “朗世乐”; exactly four games; selected 三角洲行动 with icon while unselected games have no logo; six exact service names; five exact bottom items; 44px-class tap targets; each service opens a visible `Experimental / Mock` placeholder.

- [ ] **Step 2: Write failing glass tests**

  Render every Glass Mode and verify one DOM subtree with only the mode class changing; base surfaces lack selected-glow class; selected tab receives it.

- [ ] **Step 3: Run RED**

  Run `npm test -- tests/ui/homeScreen.test.tsx tests/ui/glassSurface.test.tsx`. Expected: FAIL on missing components.

- [ ] **Step 4: Implement the approved composition**

  Use a full-viewport character layer, compact HUD area, 50-56px game rail, 12-column variable rectangular service grid, fixed safe-area bottom nav, and code-native SVG line icons.

- [ ] **Step 5: Run GREEN and accessibility assertions**

  Rerun both tests. Expected: PASS without duplicate roles or inaccessible icon-only buttons.

### Task 6: 控制面板、HUD、动效与粒子（TDD）

**Files:**
- Create: `src/components/controls/ExperimentPanel.tsx`, `src/components/performance/PerformanceHud.tsx`, `src/hooks/useViewportHeight.ts`, `src/hooks/useVisibility.ts`, `src/experiments/motion/ParticleField.tsx`, `src/experiments/motion/useTouchParallax.ts`
- Test: `tests/ui/experimentPanel.test.tsx`, `tests/ui/performanceHud.test.tsx`, `tests/hooks/lifecycle.test.tsx`

**Interfaces:**
- Consumes: settings store, frame sampler and observer snapshots.
- Produces: mutually exclusive control groups, HUD compact/expanded/hidden states, a single cleaned-up Canvas RAF loop, CSS variable `--app-height`.

- [ ] **Step 1: Write failing control tests**

  Verify all four Glass modes, five Motion levels, particle presets, toggles, DPR modes, HUD modes and actions; only one radio option is selected per group and changes apply immediately.

- [ ] **Step 2: Write failing lifecycle tests**

  Verify resize/orientation listeners, `100dvh` fallback variable updates, passive touch/pointer handlers, visibility pause/resume, Canvas teardown, and reduced-motion disabling particles/continuous parallax while retaining press feedback.

- [ ] **Step 3: Run RED**

  Run the three test files. Expected: FAIL on missing components/hooks.

- [ ] **Step 4: Implement panel/HUD/motion**

  Keep high-frequency values in refs; use Framer Motion only for component transitions and CSS variables/RAF for background/touch effects so two systems never write the same transform.

- [ ] **Step 5: Run GREEN**

  Rerun all UI/hook tests. Expected: PASS with cleanup assertions.

### Task 7: 文档、CI、Pages 与全量验证

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy-pages.yml`
- Create: `README.md`, `docs/ui-exploration-plan.md`, `docs/performance-metrics.md`, `docs/device-test-template.md`
- Modify: `task_plan.md`, `findings.md`, `progress.md`

**Interfaces:**
- Produces: CI and Pages pipelines using locked dependencies, `dist/` artifact, public documentation matching actual implementation.

- [ ] **Step 1: Create workflows and documentation**

  CI runs install, typecheck, lint, format check, tests and build. Pages runs the same gates, uploads `dist/`, then deploys using `pages: write` and `id-token: write` permissions.

- [ ] **Step 2: Run complete local gates**

  Run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test`, and `npm run build`. Expected: every command exits 0 with no console warnings.

- [ ] **Step 3: Run browser and visual QA**

  Start preview and use the in-app browser first. Verify 375×812, 390×844, 393×852, 430×932, 844×390, simulated MicroMessenger UA, no overflow, Safe Area, controls, every Glass/Motion setting, Benchmark, JSON copy/download, hidden pause and Pages base. Capture the 390×844 main screen and expanded panel.

- [ ] **Step 4: Compare concept and implementation**

  Use `view_image` on the accepted concept and latest screenshots in the same pass; log at least five comparisons covering copy, layout, typography, palette, glass/selected glow, asset crop, responsive behavior and motion. Fix every material mismatch.

- [ ] **Step 5: Run public security scan**

  Inspect `git status`, staged diff, `.env`, token/private URL patterns, absolute paths, image metadata, user reports and unauthorized assets. Expected: no sensitive or main-project content.

- [ ] **Step 6: Commit, push and deploy**

  Commit intentional files to `main`, update build metadata with the commit hash in a follow-up commit if needed, push, configure Pages source to GitHub Actions, monitor both workflows, open the real Pages URL and repeat smoke tests.

- [ ] **Step 7: Complete planning records and handoff evidence**

  Mark all phases complete only after online verification. Report repository URL, Pages URL, visibility, root/remote, file tree, commands/results, workflow runs, viewports, HUD limitations, Benchmark behavior, screenshot paths, asset sources, security scan, untouched-main-project evidence and intentional deviations.
