# Experiment Controls, Motion and HUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在已部署的朗世乐首页上加入可访问的实验控制抽屉、可清理的动态层、真实性能 HUD、30 秒 Benchmark 与纯本地报告操作。

**Architecture:** `App` 持有用户请求设置、面板开闭、性能运行时和 Benchmark 状态；`HomeScreen` 只组合视觉层与交互组件。高频帧、指针和 Canvas 数据保留在 class/ref/RAF 中，React 仅接收最多 4Hz 的不可变快照。所有 Blur 模式继续复用唯一页面与 `GlassSurface` DOM。

**Tech Stack:** React 19, TypeScript 6, CSS, Framer Motion 12, Canvas 2D, web-vitals 6, Vitest, React Testing Library, Vite 8

## Global Constraints

- `GlassMode` 固定为 `real | simulated | preblur | off`，一次只激活一种；内容、布局、人物、动画和 DOM 不复制。
- `MotionLevel` 固定为 `off | low | medium | high | maximum`。
- `ParticleCount` 固定为 `0 | 20 | 50 | 100 | maximum`；实现常量 `MAXIMUM_PARTICLES = 160` 只作为可替换的本地压力上限。
- `DprMode` 固定为 `native | cap-2 | cap-1.5`；Canvas backing store 必须使用 `resolveDpr()`。
- `HudMode` 固定为 `compact | expanded | hidden`；HUD 不使用 `aria-live` 朗读高频数字。
- 普通玻璃不发光；只有已选 radio、游戏或底栏项使用暖香槟色强调。
- 控制抽屉是非 modal region，使用明确展开/收起按钮；不增加遮罩关闭、焦点陷阱或新导航。
- Reduced Motion（系统偏好或模拟开关）关闭粒子、持续视差和环境循环，但保留按压反馈。
- 页面 hidden 时暂停 FrameSampler、Canvas 和 Benchmark 采样；visible 后恢复并重新校准。
- Framer Motion 只负责抽屉/HUD 的组件转场；背景、Canvas 与触摸效果只由 CSS 变量和 RAF 写入，禁止两个系统同时写同一 transform。
- `waiting`、`unsupported`、`not-measurable` 必须显示为状态文案，禁止伪造数值 `0`。
- 报告仅使用现有白名单 serializer；不读取 cookie、token、位置、IP、身份或后端数据。
- 服务入口继续是 `Experimental / Mock`；不实现真实订单、账户、远程请求、Release 或版本标签。

---

### Task 1: Persisted settings and ExperimentPanel

**Files:**

- Create: `src/components/controls/ExperimentPanel.tsx`
- Create: `src/components/controls/experiment-panel.css`
- Modify: `src/App.tsx`
- Modify: `src/experiments/home/HomeScreen.tsx`
- Modify: `src/experiments/settings.ts`
- Test: `tests/ui/experimentPanel.test.tsx`
- Test: `tests/experiments/settings.test.ts`

**Interfaces:**

- Consumes: `ExperimentSettings`, `updateSettings(current, patch)`, `loadSettings(storage)`, `saveSettings(storage, settings)`, `resetSettings(current)`.
- Produces:

```ts
export interface ExperimentPanelProps {
  open: boolean;
  settings: ExperimentSettings;
  onChange: (patch: Partial<ExperimentSettings>) => void;
  onReset: () => void;
  onClose: () => void;
}

export interface HomeScreenProps {
  settings: ExperimentSettings;
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  onSettingsChange: (patch: Partial<ExperimentSettings>) => void;
  onSettingsReset: () => void;
}
```

- Visible copy: `实验控制`, `收起`, `玻璃方式`, `动态等级`, `粒子数量`, `像素密度`, `HUD`, `背景动态`, `触摸视差`, `卡片浮动`, `模拟减少动态`, `重置设置`.

- [ ] **Step 1: Write settings and control RED tests**

```tsx
it('applies one glass mode immediately and persists it', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: '实验控制' }));
  const group = screen.getByRole('group', { name: '玻璃方式' });
  await user.click(within(group).getByRole('radio', { name: 'Preblur Layer' }));
  expect(within(group).getAllByRole('radio', { checked: true })).toHaveLength(1);
  expect(screen.getByRole('main')).toHaveAttribute('data-glass-mode', 'preblur');
  expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
    schemaVersion: 1,
    settings: { glassMode: 'preblur' },
  });
});

it('falls back to defaults when storage access throws', () => {
  const storage = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: vi.fn(),
  };
  expect(loadSettings(storage)).toEqual(createDefaultSettings());
});
```

Add separate assertions for the exact 4/5/5/3/3 radio values, four checkbox toggles, reset, `aria-expanded`, one selected class per group, and non-modal `region` semantics.

- [ ] **Step 2: Run RED**

Run:

```powershell
& 'C:\Users\Ezrea\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\node_modules\vitest\vitest.mjs run tests/ui/experimentPanel.test.tsx tests/experiments/settings.test.ts
```

Expected: missing `ExperimentPanel` and absent App update/persistence behavior fail.

- [ ] **Step 3: Implement minimal settings ownership and panel**

Use a functional update so persistence observes the exact next state:

```ts
const changeSettings = useCallback((patch: Partial<ExperimentSettings>) => {
  setSettings((current) => {
    const next = updateSettings(current, patch);
    saveSettings(window.localStorage, next);
    return next;
  });
}, []);
```

Wrap both storage `getItem` and `setItem` in `try/catch`; storage denial must not crash the demo. Render each exclusive group as `<fieldset><legend>…</legend><input type="radio" /></fieldset>` and each toggle as a named checkbox. Use `GlassSurface` once around the open panel; selected option labels alone receive `glass-surface--selected` through `selected`.

- [ ] **Step 4: Run GREEN and quality gates**

Run the focused command from Step 2, then direct bundled-Node typecheck, ESLint and Prettier check. Expected: focused tests pass with no warnings.

- [ ] **Step 5: Commit**

```powershell
git add src/App.tsx src/experiments/home/HomeScreen.tsx src/experiments/settings.ts src/components/controls/ExperimentPanel.tsx src/components/controls/experiment-panel.css tests/ui/experimentPanel.test.tsx tests/experiments/settings.test.ts
git commit -m "feat: add experiment settings panel"
```

---

### Task 2: Viewport, visibility, particles and touch parallax

**Files:**

- Create: `src/hooks/useViewportHeight.ts`
- Create: `src/hooks/useVisibility.ts`
- Create: `src/hooks/useReducedMotion.ts`
- Create: `src/experiments/motion/ParticleField.tsx`
- Create: `src/experiments/motion/useTouchParallax.ts`
- Create: `src/experiments/motion/motion.css`
- Modify: `src/App.tsx`
- Modify: `src/experiments/home/HomeScreen.tsx`
- Modify: `src/experiments/home/home-screen.css`
- Test: `tests/hooks/lifecycle.test.tsx`

**Interfaces:**

```ts
export function useViewportHeight(): void;
export function useVisibility(): boolean;
export function useReducedMotion(): boolean;
export function useTouchParallax(
  target: React.RefObject<HTMLElement | null>,
  enabled: boolean,
): void;
export interface ParticleFieldProps {
  count: ParticleCount;
  dprMode: DprMode;
  paused: boolean;
}
export const MAXIMUM_PARTICLES = 160;
```

- [ ] **Step 1: Write lifecycle RED tests**

```tsx
it('updates app height and removes viewport listeners', () => {
  const add = vi.spyOn(window, 'addEventListener');
  const remove = vi.spyOn(window, 'removeEventListener');
  const { unmount } = render(<ViewportHarness />);
  expect(document.documentElement.style.getPropertyValue('--app-height')).toBe(
    `${window.innerHeight}px`,
  );
  expect(add).toHaveBeenCalledWith('resize', expect.any(Function), { passive: true });
  expect(add).toHaveBeenCalledWith('orientationchange', expect.any(Function), {
    passive: true,
  });
  unmount();
  expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
});

it('cancels its only canvas frame on unmount', () => {
  const cancel = vi.spyOn(window, 'cancelAnimationFrame');
  const { unmount } = render(
    <ParticleField count={20} dprMode="cap-2" paused={false} />,
  );
  unmount();
  expect(cancel).toHaveBeenCalledTimes(1);
});
```

Also assert `visibilitychange` cleanup, hidden pause, visible resume, DPR-capped backing size, `maximum -> 160`, passive pointer/touch listeners, one queued parallax RAF, StrictMode replay cleanup, and reduced motion yielding zero effective particles/parallax while `.service-card:active` remains styled.

- [ ] **Step 2: Run RED**

```powershell
& 'C:\Users\Ezrea\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\node_modules\vitest\vitest.mjs run tests/hooks/lifecycle.test.tsx
```

Expected: missing hooks and motion modules fail import.

- [ ] **Step 3: Implement minimal lifecycle and motion layer**

`useViewportHeight` writes only `--app-height`; `useVisibility` returns `document.visibilityState === 'visible'`; both add/remove the same listener functions. `useTouchParallax` stores coordinates in refs, batches DOM writes into one RAF, and writes `--parallax-x`/`--parallax-y` without React state. `ParticleField` owns one canvas and one RAF loop, resizes backing pixels only when viewport/DPR changes, and renders with `pointer-events: none`.

Derive effective settings without mutating requested settings:

```ts
const systemReducedMotion = useReducedMotion();
const effectiveSettings = resolveEffectiveSettings(settings, systemReducedMotion);
```

Framer Motion may animate panel/HUD presence; character and cards use CSS variables/classes only. Keep press feedback outside continuous-motion selectors.

- [ ] **Step 4: Run GREEN and full regression tests**

Run the focused test, then all Vitest files, typecheck, ESLint and Prettier. Expected: every listener/RAF cleanup assertion and existing 48 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/hooks src/experiments/motion src/App.tsx src/experiments/home tests/hooks/lifecycle.test.tsx
git commit -m "feat: add lifecycle-aware motion layer"
```

---

### Task 3: Performance runtime and HUD

**Files:**

- Create: `src/performance/runtime.ts`
- Create: `src/hooks/usePerformanceRuntime.ts`
- Create: `src/components/performance/PerformanceHud.tsx`
- Create: `src/components/performance/performance-hud.css`
- Modify: `src/performance/webVitals.ts`
- Modify: `src/App.tsx`
- Modify: `src/experiments/home/HomeScreen.tsx`
- Test: `tests/performance/runtime.test.ts`
- Test: `tests/ui/performanceHud.test.tsx`

**Interfaces:**

```ts
export interface PerformanceSnapshot {
  frames: FrameSamplerSnapshot;
  webVitals: WebVitalsSnapshot;
  mainThread: MainThreadSnapshot;
  navigation: NavigationSnapshot;
  resources: ResourceSnapshot;
  capabilities: PerformanceCapabilities;
}

export interface PerformanceRuntime {
  start(): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  reset(): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): PerformanceSnapshot;
}
```

- [ ] **Step 1: Write runtime and HUD RED tests**

```tsx
it.each(['waiting', 'unsupported', 'not-measurable'] as const)(
  'renders %s as a state instead of zero',
  (status) => {
    render(<PerformanceHud mode="expanded" snapshot={snapshotWith(status)} />);
    expect(screen.queryByText(/^0(?:\.0+)?$/)).not.toBeInTheDocument();
    expect(screen.getByText(labelFor(status))).toBeVisible();
  },
);

it('publishes no faster than every 250ms', () => {
  runtime.start();
  observer.emit(entries);
  observer.emit(entries);
  expect(listener).not.toHaveBeenCalled();
  clock.advanceBy(250);
  expect(listener).toHaveBeenCalledOnce();
});
```

Assert compact shows FPS/P95 only, expanded shows FPS/P95/max/dropped/LCP/CLS/INP/long-task/LoAF/resources, hidden returns `null`, no `aria-live` exists, duplicate start is idempotent, pause/resume delegates to FrameSampler, and stop disconnects subscriptions under StrictMode replay.

- [ ] **Step 2: Run RED**

```powershell
& 'C:\Users\Ezrea\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\node_modules\vitest\vitest.mjs run tests/performance/runtime.test.ts tests/ui/performanceHud.test.tsx
```

Expected: missing runtime/HUD modules fail import.

- [ ] **Step 3: Implement runtime and HUD**

Create the runtime once with lazy state in `usePerformanceRuntime`; use `useSyncExternalStore` for the HUD snapshot. Reuse `FrameSampler`, `PerformanceObserverRegistry`, `WebVitalsStore`, navigation/resource summaries and capability detection. Observer callbacks update refs/arrays and schedule one 250ms publication; they do not call React state directly.

Make `WebVitalsStore.start()` reactivate an already-loaded store before returning its existing promise so StrictMode stop/start remains valid. Render statuses through one formatter:

```ts
const statusLabel = {
  waiting: '等待',
  unsupported: '不支持',
  'not-measurable': '不可测',
} as const;
```

- [ ] **Step 4: Run GREEN and full gates**

Run focused tests, all tests, typecheck, ESLint and Prettier. Confirm subscriber frequency is at most 4Hz and no test leaves observers/timers active.

- [ ] **Step 5: Commit**

```powershell
git add src/performance/runtime.ts src/performance/webVitals.ts src/hooks/usePerformanceRuntime.ts src/components/performance src/App.tsx src/experiments/home/HomeScreen.tsx tests/performance/runtime.test.ts tests/ui/performanceHud.test.tsx
git commit -m "feat: add live performance hud"
```

---

### Task 4: Benchmark and local report actions

**Files:**

- Create: `src/hooks/useBenchmarkController.ts`
- Create: `src/performance/reportActions.ts`
- Modify: `src/components/controls/ExperimentPanel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/experiments/home/HomeScreen.tsx`
- Test: `tests/ui/experimentActions.test.tsx`
- Test: `tests/performance/reportActions.test.ts`

**Interfaces:**

```ts
export interface ReportActions {
  copyJson(): Promise<void>;
  downloadJson(): void;
  copySummary(): Promise<void>;
}

export interface BenchmarkController {
  state: BenchmarkState;
  start(): void;
  cancel(): void;
}
```

- Visible actions: `运行 30 秒 Benchmark`, `取消 Benchmark`, `复制 JSON`, `下载 JSON`, `复制摘要`; result text is `已复制`, `已下载`, or a concrete failure label and is not a blocking alert.

- [ ] **Step 1: Write action RED tests**

```tsx
it('runs one benchmark and restores scene state', async () => {
  render(<App benchmarkClock={clock} />);
  await user.click(screen.getByRole('button', { name: '运行 30 秒 Benchmark' }));
  expect(screen.getByText('warmup')).toBeVisible();
  clock.advanceBy(30_000);
  expect(screen.getByText('completed')).toBeVisible();
  expect(window.scrollY).toBe(originalScrollY);
});

it('copies only the serialized whitelist report', async () => {
  await actions.copyJson();
  const copied = clipboard.writeText.mock.calls[0][0];
  expect(copied).toContain('"schemaVersion": 1');
  expect(copied).not.toMatch(/cookie|token|authorization/i);
});
```

Assert repeated start is ignored, cancel restores scroll/game/panel/particle state, hidden marks `completedInForeground=false`, download revokes its object URL, clipboard rejection becomes visible failure state, and summary includes Glass mode, FPS/P95, Estimated Dropped Frames and foreground completeness without unavailable values becoming zero.

- [ ] **Step 2: Run RED**

```powershell
& 'C:\Users\Ezrea\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\node_modules\vitest\vitest.mjs run tests/ui/experimentActions.test.tsx tests/performance/reportActions.test.ts
```

Expected: missing controller/actions and absent panel buttons fail.

- [ ] **Step 3: Implement benchmark scene adapter and exports**

`App` owns selected game and panel state so `BenchmarkRunner.captureScene()` can restore them. Benchmark profiles are transient overlays, never persisted settings: `warmup`/`ambient` keep effective settings; `stress` requests maximum motion and 160 particles unless Reduced Motion is effective; `scroll-transition` exercises panel open/close and page scroll; `summarize` freezes stress changes before capture.

Build `ReportSnapshot` only from existing environment, settings and runtime snapshot. `downloadJson()` creates a Blob, clicks one temporary anchor named `lancelot-ui-report-<timestamp>.json`, removes it, and revokes the object URL. `copySummary()` emits these fixed lines when measurable:

```text
朗世乐 UI 性能报告
Glass: <mode>
FPS: <value-or-state>
P95 Frame: <value-or-state>
Estimated Dropped Frames: <value-or-state>
Foreground Complete: <yes|no|waiting>
```

- [ ] **Step 4: Run GREEN and production gates**

Run focused tests, the full suite, typecheck, ESLint, Prettier, `git diff --check`, privacy/path scans and the Vite production build. Expected: all pass with no absolute local path or credential pattern in tracked output.

- [ ] **Step 5: Commit and checkpoint docs**

```powershell
git add src/hooks/useBenchmarkController.ts src/performance/reportActions.ts src/components/controls/ExperimentPanel.tsx src/App.tsx src/experiments/home/HomeScreen.tsx tests/ui/experimentActions.test.tsx tests/performance/reportActions.test.ts task_plan.md findings.md progress.md
git commit -m "feat: connect benchmark and report actions"
```

---

## Plan Self-Review

- Spec coverage: Tasks 1–4 cover every original Task 6 control, lifecycle, motion, HUD, Benchmark and local report requirement.
- Scope: no backend, business route, real order, remote telemetry, release, tag, screenshot-fidelity or Pages publish work is introduced.
- Type consistency: all setting unions reuse `src/experiments/settings.ts`; runtime snapshot and controller interfaces are defined before consumers.
- Fair comparison: no task creates per-mode copies of `HomeScreen`, services, character, motion tree or DOM.
- Accessibility: native fieldset/radio/checkbox controls, explicit panel disclosure, no fake modal and no high-frequency live region.
- Performance: one Canvas RAF, one parallax RAF, one shared observer registry, refs for transient values and publications no faster than 250ms.
- Test order: each task requires focused RED, minimal GREEN, regression gates and a dedicated commit before review.
