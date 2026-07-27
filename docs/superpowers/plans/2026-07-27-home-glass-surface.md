# 朗世乐主界面与 Glass Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前工程检查点替换为可访问的朗世乐移动首页，并让四种 Blur 模式在完全相同的 React/DOM 树上互斥切换。

**Architecture:** `App` 只持有低频 `ExperimentSettings`，`HomeScreen` 组合背景、游戏栏、服务网格、占位层和底栏。所有玻璃区域复用唯一 `GlassSurface`，模式差异只存在于 `data-glass-mode` 与单一模式类；CSS 伪元素承载 preblur，不增加隐藏页面副本。

**Tech Stack:** React 19, TypeScript 6, CSS, Lucide React, Vitest, React Testing Library, Vite 8

## Global Constraints

- 品牌文案固定为“朗世乐”。
- 游戏固定为“三角洲行动”“CS2”“Valorant”“Steam 游戏”，默认选中“三角洲行动”，且只有选中游戏显示近似几何图标。
- 服务固定为“趣味单”“小时单”“自助下单”“客服接待”“活动专区”“全部服务”。
- 底栏固定为“首页”“挑选”“订单”“消息”“我的”，默认“首页”为当前页面。
- 普通玻璃不使用发光边缘；只有选中游戏或底栏项使用 `glass-surface--selected`。
- `GlassMode` 固定为 `real | simulated | preblur | off`，四种模式共享内容、布局、图片、交互和 DOM。
- 所有交互按钮具有可访问名称和至少 44px 的命中类；不渲染隐藏的重复控件。
- 只使用 `public/assets/character-source.png`、现有 LSVIS TD WOFF2 和代码原生 SVG 图标，不新增游戏 Logo 素材。
- 本计划不实现实验面板、HUD、Benchmark UI、粒子、触摸视差、真实业务路由或远程数据。
- Vite `base` 保持 `/lancelot-gamepal-ui-playground/`，不创建 Release、标签或纯 SemVer 发布。

---

### Task 1: 单一 DOM 的 Glass Surface

**Files:**
- Create: `src/components/glass/GlassSurface.tsx`
- Create: `src/components/glass/glass-surface.css`
- Create: `tests/ui/glassSurface.test.tsx`

**Interfaces:**
- Consumes: `GlassMode` from `src/experiments/settings.ts`.
- Produces: `GlassSurfaceProps extends HTMLAttributes<HTMLDivElement>` with `mode: GlassMode`, `selected?: boolean`, and `children: ReactNode`; one persistent `<div>` with `data-glass-mode` and `data-selected`.

- [ ] **Step 1: Write the failing structural tests**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GlassSurface } from '../../src/components/glass/GlassSurface';
import type { GlassMode } from '../../src/experiments/settings';

describe('GlassSurface', () => {
  it.each<GlassMode>(['real', 'simulated', 'preblur', 'off'])(
    'maps %s to one mode class without selected glow',
    (mode) => {
      render(
        <GlassSurface data-testid="surface" mode={mode}>
          <span>内容</span>
        </GlassSurface>,
      );
      const surface = screen.getByTestId('surface');
      expect(surface).toHaveClass('glass-surface', `glass-surface--${mode}`);
      expect(surface).not.toHaveClass('glass-surface--selected');
      expect(surface).toHaveAttribute('data-glass-mode', mode);
      expect(surface).toHaveAttribute('data-selected', 'false');
    },
  );

  it('preserves the same DOM nodes when only the mode changes', () => {
    const { rerender } = render(
      <GlassSurface data-testid="surface" mode="real">
        <span data-testid="payload">内容</span>
      </GlassSurface>,
    );
    const surface = screen.getByTestId('surface');
    const payload = screen.getByTestId('payload');

    rerender(
      <GlassSurface data-testid="surface" mode="simulated">
        <span data-testid="payload">内容</span>
      </GlassSurface>,
    );

    expect(screen.getByTestId('surface')).toBe(surface);
    expect(screen.getByTestId('payload')).toBe(payload);
    expect(surface).toHaveClass('glass-surface--simulated');
    expect(surface).not.toHaveClass('glass-surface--real');
  });

  it('adds selected styling only when explicitly selected', () => {
    render(
      <GlassSurface data-testid="surface" mode="off" selected>
        当前项
      </GlassSurface>,
    );
    expect(screen.getByTestId('surface')).toHaveClass(
      'glass-surface--selected',
    );
  });
});
```

- [ ] **Step 2: Run RED**

Run: `npm test -- tests/ui/glassSurface.test.tsx`

Expected: FAIL because `src/components/glass/GlassSurface.tsx` does not exist.

- [ ] **Step 3: Implement the minimal component and four CSS strategies**

```tsx
import type { HTMLAttributes, ReactNode } from 'react';
import type { GlassMode } from '../../experiments/settings';
import './glass-surface.css';

export interface GlassSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  mode: GlassMode;
  selected?: boolean;
}

export function GlassSurface({
  children,
  className = '',
  mode,
  selected = false,
  ...props
}: GlassSurfaceProps) {
  const classes = [
    'glass-surface',
    `glass-surface--${mode}`,
    selected ? 'glass-surface--selected' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      {...props}
      className={classes}
      data-glass-mode={mode}
      data-selected={String(selected)}
    >
      {children}
    </div>
  );
}
```

```css
.glass-surface {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: inherit;
  background: var(--glass-fill);
  box-shadow: var(--glass-inner-highlight), var(--glass-shadow);
}

.glass-surface--real {
  -webkit-backdrop-filter: blur(var(--blur-real)) saturate(1.12);
  backdrop-filter: blur(var(--blur-real)) saturate(1.12);
}

.glass-surface--simulated {
  background:
    linear-gradient(145deg, rgb(255 255 255 / 0.07), transparent 48%),
    var(--glass-fill-strong);
}

.glass-surface--preblur::before {
  position: absolute;
  z-index: -1;
  inset: -28px;
  background: url('/assets/character-source.png') center 34% / cover;
  content: '';
  filter: blur(var(--blur-real)) saturate(0.9);
  opacity: 0.5;
  transform: scale(1.08);
}

.glass-surface--off {
  background: var(--glass-fill-strong);
}

.glass-surface--selected {
  border-color: var(--glass-border-selected);
  box-shadow:
    var(--glass-inner-highlight),
    var(--glass-shadow),
    var(--selected-glow);
}
```

- [ ] **Step 4: Run GREEN**

Run: `npm test -- tests/ui/glassSurface.test.tsx`

Expected: 1 file and 6 parameterized tests pass; the component never conditionally renders a mode-specific subtree.

- [ ] **Step 5: Commit Task 1**

```powershell
git add src/components/glass/GlassSurface.tsx src/components/glass/glass-surface.css tests/ui/glassSurface.test.tsx
git commit -m "feat: add shared glass surface"
```

### Task 2: 游戏、服务与底栏交互组件

**Files:**
- Create: `src/components/navigation/GameRail.tsx`
- Create: `src/components/navigation/BottomNav.tsx`
- Create: `src/components/controls/ServiceGrid.tsx`
- Create: `src/components/controls/ExperimentalPlaceholder.tsx`
- Create: `src/components/controls/home-controls.css`
- Create: `tests/ui/homeScreen.test.tsx`

**Interfaces:**
- Consumes: `GlassMode`, `GlassSurface`.
- Produces: `GameId = 'delta' | 'cs2' | 'valorant' | 'steam'`, `BottomNavId = 'home' | 'select' | 'orders' | 'messages' | 'profile'`, and `ServiceName = '趣味单' | '小时单' | '自助下单' | '客服接待' | '活动专区' | '全部服务'`.
- Produces controlled props: `GameRail({ mode, selectedGame, onSelect })`, `BottomNav({ mode, selectedItem, onSelect })`, `ServiceGrid({ mode, onSelect })`, and `ExperimentalPlaceholder({ service, onClose })`.

- [ ] **Step 1: Write the failing copy, state, icon and dialog tests**

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BottomNav } from '../../src/components/navigation/BottomNav';
import { GameRail } from '../../src/components/navigation/GameRail';
import {
  ServiceGrid,
  type ServiceName,
} from '../../src/components/controls/ServiceGrid';
import { ExperimentalPlaceholder } from '../../src/components/controls/ExperimentalPlaceholder';

describe('home controls', () => {
  it('renders four games and only the selected game logo', () => {
    render(
      <GameRail mode="real" selectedGame="delta" onSelect={vi.fn()} />,
    );
    const rail = screen.getByRole('navigation', { name: '游戏切换' });
    const games = within(rail).getAllByRole('button');
    expect(games).toHaveLength(4);
    expect(games.map((button) => button.textContent)).toEqual([
      '三角洲行动',
      'CS2',
      'Valorant',
      'Steam 游戏',
    ]);
    expect(
      within(screen.getByRole('button', { name: '三角洲行动' })).getByTestId(
        'game-logo',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('game-logo')).toHaveLength(1);
  });

  it('renders six varied service buttons with 44px targets', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn<(service: ServiceName) => void>();
    render(<ServiceGrid mode="real" onSelect={onSelect} />);
    const region = screen.getByRole('region', { name: '服务入口' });
    const services = within(region).getAllByRole('button');
    expect(services.map((button) => button.textContent)).toEqual([
      '趣味单',
      '小时单',
      '自助下单',
      '客服接待',
      '活动专区',
      '全部服务',
    ]);
    services.forEach((button) => expect(button).toHaveClass('tap-target'));
    await user.click(screen.getByRole('button', { name: '趣味单' }));
    expect(onSelect).toHaveBeenCalledWith('趣味单');
  });

  it('marks 首页 current and renders all five bottom items', () => {
    render(
      <BottomNav mode="real" selectedItem="home" onSelect={vi.fn()} />,
    );
    const nav = screen.getByRole('navigation', { name: '主要导航' });
    expect(within(nav).getAllByRole('button')).toHaveLength(5);
    expect(screen.getByRole('button', { name: '首页' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows and closes the Experimental / Mock dialog', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExperimentalPlaceholder service="趣味单" onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: '趣味单' });
    expect(within(dialog).getByText('Experimental / Mock')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: '关闭' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run RED**

Run: `npm test -- tests/ui/homeScreen.test.tsx`

Expected: FAIL because the four control modules do not exist.

- [ ] **Step 3: Implement exact controlled components**

Use these immutable definitions; do not derive visible copy from external data:

```tsx
export const games = [
  { id: 'delta', label: '三角洲行动' },
  { id: 'cs2', label: 'CS2' },
  { id: 'valorant', label: 'Valorant' },
  { id: 'steam', label: 'Steam 游戏' },
] as const;

export const services = [
  { name: '趣味单', shape: 'wide' },
  { name: '小时单', shape: 'compact' },
  { name: '自助下单', shape: 'tall' },
  { name: '客服接待', shape: 'compact' },
  { name: '活动专区', shape: 'wide' },
  { name: '全部服务', shape: 'medium' },
] as const;

export const bottomItems = [
  { id: 'home', label: '首页' },
  { id: 'select', label: '挑选' },
  { id: 'orders', label: '订单' },
  { id: 'messages', label: '消息' },
  { id: 'profile', label: '我的' },
] as const;
```

Each list renders one semantic `<button type="button" className="tap-target ...">`. The button contains one `GlassSurface`; only the controlled selected game/bottom item passes `selected`. The selected game inserts this decorative mark immediately before its label, while unselected games render no SVG:

```tsx
{selected ? (
  <svg
    aria-hidden="true"
    data-testid="game-logo"
    viewBox="0 0 24 24"
  >
    <path d="M12 3 21 19h-6l-3-6-3 6H3L12 3Z" fill="currentColor" />
  </svg>
) : null}
```

`ExperimentalPlaceholder` must use `role="dialog"`, `aria-modal="true"`, `aria-labelledby="experimental-service-title"`, an `<h2 id="experimental-service-title">{service}</h2>`, visible text `Experimental / Mock`, and a named close button.

The shared control stylesheet must include these exact minimums and varied spans:

```css
.tap-target {
  min-width: 44px;
  min-height: 44px;
}

.game-rail {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  min-height: 50px;
  max-height: 56px;
}

.service-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: 34px;
}

.service-card--wide { grid-column: span 7; grid-row: span 2; }
.service-card--compact { grid-column: span 5; grid-row: span 2; }
.service-card--tall { grid-column: span 5; grid-row: span 3; }
.service-card--medium { grid-column: span 7; grid-row: span 3; }
```

- [ ] **Step 4: Run GREEN**

Run: `npm test -- tests/ui/homeScreen.test.tsx tests/ui/glassSurface.test.tsx`

Expected: both files pass; only selected controls have `glass-surface--selected`, and the game rail contains exactly one `data-testid="game-logo"`.

- [ ] **Step 5: Commit Task 2**

```powershell
git add src/components/navigation src/components/controls tests/ui/homeScreen.test.tsx
git commit -m "feat: add accessible home controls"
```

### Task 3: 首页组合、人物遮挡与检查点替换

**Files:**
- Create: `src/experiments/home/HomeScreen.tsx`
- Create: `src/experiments/home/home-screen.css`
- Modify: `src/App.tsx`
- Modify: `tests/ui/homeScreen.test.tsx`
- Delete: `src/styles/checkpoint.css`

**Interfaces:**
- Consumes: `ExperimentSettings`, `createDefaultSettings`, Task 2 controlled components.
- Produces: `HomeScreen({ settings }: { settings: ExperimentSettings })`; `App()` renders exactly one `HomeScreen`.

- [ ] **Step 1: Add the failing page-composition and interaction tests**

Append to `tests/ui/homeScreen.test.tsx`:

```tsx
import { App } from '../../src/App';

describe('HomeScreen', () => {
  it('renders the approved 朗世乐 composition without checkpoint copy', () => {
    render(<App />);
    expect(screen.getByRole('banner')).toHaveTextContent('朗世乐');
    expect(screen.queryByText('工程基础检查点')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '游戏切换' })).toBeVisible();
    expect(screen.getByRole('region', { name: '服务入口' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: '主要导航' })).toBeVisible();
    expect(screen.getByTestId('character-layer')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('opens the selected service and restores home state when closed', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '客服接待' }));
    expect(screen.getByRole('dialog', { name: '客服接待' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '关闭' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '服务入口' })).toBeVisible();
  });

  it('updates selected game and bottom item without duplicating the page', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'CS2' }));
    expect(screen.getByRole('button', { name: 'CS2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getAllByTestId('game-logo')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '挑选' }));
    expect(screen.getByRole('button', { name: '挑选' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run RED**

Run: `npm test -- tests/ui/homeScreen.test.tsx`

Expected: FAIL because `App` still renders “工程基础检查点” and lacks the approved navigation/region structure.

- [ ] **Step 3: Implement `HomeScreen` and replace the checkpoint `App`**

```tsx
import { useState } from 'react';
import { ExperimentalPlaceholder } from '../../components/controls/ExperimentalPlaceholder';
import {
  ServiceGrid,
  type ServiceName,
} from '../../components/controls/ServiceGrid';
import {
  BottomNav,
  type BottomNavId,
} from '../../components/navigation/BottomNav';
import { GameRail, type GameId } from '../../components/navigation/GameRail';
import type { ExperimentSettings } from '../settings';
import './home-screen.css';

export function HomeScreen({ settings }: { settings: ExperimentSettings }) {
  const [selectedGame, setSelectedGame] = useState<GameId>('delta');
  const [selectedNav, setSelectedNav] = useState<BottomNavId>('home');
  const [activeService, setActiveService] = useState<ServiceName | null>(null);
  const mode = settings.glassMode;

  return (
    <main className="home-screen">
      <div
        aria-hidden="true"
        className="home-screen__character"
        data-testid="character-layer"
      />
      <header className="home-screen__header">
        <span aria-hidden="true" className="home-screen__mark">L</span>
        <span className="home-screen__brand">朗世乐</span>
      </header>
      <div className="home-screen__content">
        <GameRail mode={mode} selectedGame={selectedGame} onSelect={setSelectedGame} />
        <ServiceGrid mode={mode} onSelect={setActiveService} />
      </div>
      <BottomNav mode={mode} selectedItem={selectedNav} onSelect={setSelectedNav} />
      {activeService ? (
        <ExperimentalPlaceholder
          service={activeService}
          onClose={() => setActiveService(null)}
        />
      ) : null}
    </main>
  );
}
```

Replace `src/App.tsx` with:

```tsx
import { useState } from 'react';
import { HomeScreen } from './experiments/home/HomeScreen';
import { createDefaultSettings } from './experiments/settings';

export function App() {
  const [settings] = useState(createDefaultSettings);
  return <HomeScreen settings={settings} />;
}

export default App;
```

Delete the checkpoint stylesheet import and file. `home-screen.css` must implement: `min-height: var(--app-height)`, `overflow-x: clip`, safe-top header padding, an absolute character layer using `/assets/character-source.png`, `background-position: center 30%`, content positioned so glass overlaps the character lower half, and bottom padding no smaller than `calc(88px + var(--safe-bottom))`. The bottom navigation uses `position: fixed` and `padding-bottom: var(--safe-bottom)`.

- [ ] **Step 4: Run page GREEN and focused quality gates**

Run:

```powershell
npm test -- tests/ui/homeScreen.test.tsx tests/ui/glassSurface.test.tsx
npm run typecheck
npm run lint
```

Expected: both UI files pass, TypeScript exits 0, and ESLint exits 0 without suppressions.

- [ ] **Step 5: Commit Task 3**

```powershell
git add src/App.tsx src/experiments/home src/styles/checkpoint.css tests/ui/homeScreen.test.tsx
git commit -m "feat: compose lancelot home screen"
```

### Task 4: Task 5 全量门禁与规划检查点

**Files:**
- Modify: `task_plan.md`
- Modify: `findings.md`
- Modify: `progress.md`
- Modify: `docs/superpowers/plans/2026-07-27-mobile-ui-performance-playground.md`

**Interfaces:**
- Consumes: all Task 1–3 components and tests.
- Produces: a verified Task 5 checkpoint with exact test evidence and Phase 4 remaining work still accurately pending.

- [ ] **Step 1: Run the complete local gate**

Run:

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Expected: every command exits 0; the production bundle references `/lancelot-gamepal-ui-playground/` assets and no test emits an unhandled React warning.

- [ ] **Step 2: Run static acceptance scans**

Run:

```powershell
rg -n "朗世乐|三角洲行动|CS2|Valorant|Steam 游戏|趣味单|小时单|自助下单|客服接待|活动专区|全部服务|首页|挑选|订单|消息|我的" src tests
rg -n "glass-surface--selected|glass-surface--real|glass-surface--simulated|glass-surface--preblur|glass-surface--off" src tests
git diff --check
```

Expected: all exact copy and four mode classes are present; `selected` is the only path to glow; the diff has no whitespace errors.

- [ ] **Step 3: Update durable planning records**

Mark detailed-plan Task 5 steps complete only with the Step 1 evidence. In `task_plan.md`, keep Phase 4 in progress and set the next step to Task 6 RED. In `findings.md`, record the shared-DOM implementation details. In `progress.md`, record exact command results, test count, build artifact names, errors and resolutions.

- [ ] **Step 4: Commit the verified Task 5 checkpoint**

```powershell
git add task_plan.md findings.md progress.md docs/superpowers/plans/2026-07-27-mobile-ui-performance-playground.md
git commit -m "chore: record home screen checkpoint"
```

- [ ] **Step 5: Stop at the local checkpoint**

Run: `git status --short --branch`

Expected: clean `agent/performance-observers` worktree. Do not push, deploy, tag, or create a release unless the user explicitly requests it after reviewing the local result.

## Self-Review Result

- Spec coverage: all Task 5 requirements map to Tasks 1–3; complete quality and planning gates map to Task 4.
- Scope: Task 6 controls and motion remain excluded; Task 7 retains viewport, WeChat UA, screenshot and published Pages verification.
- Type consistency: `GlassMode`, `ExperimentSettings`, `GameId`, `BottomNavId`, and `ServiceName` use one spelling at every boundary.
- Test order: every production change follows a focused RED, minimal implementation, GREEN and commit cycle.
