import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from 'react';
import { GlassSurface } from '../glass/GlassSurface';
import type { BenchmarkController } from '../../hooks/useBenchmarkController';
import type { ReportActions } from '../../performance/reportActions';
import {
  BASELINE_MODE_ORDER,
  type BaselineSuiteState,
  type BaselineSuiteStatus,
} from '../../performance/baselineSuiteRunner';
import type {
  DprMode,
  ExperimentSettings,
  GlassMode,
  HudMode,
  MotionLevel,
  ParticleCount,
} from '../../experiments/settings';
import './experiment-panel.css';

export interface ExperimentPanelProps {
  benchmarkController: BenchmarkController;
  open: boolean;
  openerRef: RefObject<HTMLElement | null>;
  reportActions: ReportActions;
  settings: ExperimentSettings;
  onChange: (patch: Partial<ExperimentSettings>) => void;
  onReset: () => void;
  onClose: () => void;
}

interface RadioOption<T extends string | number> {
  label: string;
  value: T;
}

const glassOptions: RadioOption<GlassMode>[] = [
  { label: '真实模糊', value: 'real' },
  { label: '模拟玻璃', value: 'simulated' },
  { label: '预模糊层', value: 'preblur' },
  { label: '关闭模糊', value: 'off' },
];

const motionOptions: RadioOption<MotionLevel>[] = [
  { label: '关闭', value: 'off' },
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
  { label: '最大', value: 'maximum' },
];

const particleOptions: RadioOption<ParticleCount>[] = [
  { label: '0', value: 0 },
  { label: '20', value: 20 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
  { label: '最大', value: 'maximum' },
];

const dprOptions: RadioOption<DprMode>[] = [
  { label: '原生', value: 'native' },
  { label: '上限 2x', value: 'cap-2' },
  { label: '上限 1.5x', value: 'cap-1.5' },
];

const hudOptions: RadioOption<HudMode>[] = [
  { label: '紧凑', value: 'compact' },
  { label: '展开', value: 'expanded' },
  { label: '隐藏', value: 'hidden' },
];

const modeLabel: Record<GlassMode, string> = {
  real: '真实模糊',
  simulated: '模拟玻璃',
  preblur: '预模糊层',
  off: '关闭模糊',
};

const suiteStatusLabel: Record<BaselineSuiteStatus, string> = {
  idle: '未开始',
  settling: '准备',
  running: '运行中',
  'waiting-for-visibility': '等待页面可见',
  completed: '已完成',
  cancelled: '已取消',
  failed: '失败',
};

const focusableSelector =
  'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])';

const isSuiteActive = (status: BaselineSuiteStatus): boolean =>
  status === 'settling' || status === 'running' || status === 'waiting-for-visibility';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(focusableSelector)].filter(
    (element) => !element.matches(':disabled') && !element.hidden,
  );
}

function useModalFocus(
  open: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  openerRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const opener = openerRef.current;
    const dialog = dialogRef.current;
    (dialog ? getFocusableElements(dialog)[0] : null)?.focus();

    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [dialogRef, open, openerRef]);
}

function RadioGroup<T extends string | number>({
  legend,
  name,
  options,
  value,
  onChange,
  disabled = false,
}: {
  legend: string;
  name: string;
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="experiment-panel__group" disabled={disabled}>
      <legend>{legend}</legend>
      <div className="experiment-panel__options">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              className={`glass-surface experiment-panel__option${
                selected ? ' glass-surface--selected' : ''
              }`}
              key={String(option.value)}
            >
              <input
                checked={selected}
                name={name}
                onChange={() => onChange(option.value)}
                type="radio"
                value={String(option.value)}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ExperimentPanel({
  benchmarkController,
  open,
  openerRef,
  reportActions,
  settings,
  onChange,
  onReset,
  onClose,
}: ExperimentPanelProps) {
  const [actionResult, setActionResult] = useState<string | null>(null);
  const operationSequence = useRef(0);
  const mounted = useRef(true);
  const dialogRef = useRef<HTMLElement>(null);
  const headingId = useId();
  const workloadLocked = benchmarkController.workloadLocked;

  useModalFocus(open, dialogRef, openerRef);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operationSequence.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.matches(':disabled')) {
      const dialog = dialogRef.current;
      (dialog ? getFocusableElements(dialog)[0] : null)?.focus();
    }
  }, [open, workloadLocked]);

  if (!open) {
    return null;
  }

  const publishActionResult = (operation: number, result: string) => {
    if (mounted.current && operation === operationSequence.current) {
      setActionResult(result);
    }
  };

  const copy = async (action: () => Promise<void>) => {
    const operation = ++operationSequence.current;
    try {
      await action();
      publishActionResult(operation, '已复制');
    } catch {
      publishActionResult(operation, '复制失败');
    }
  };

  const download = () => {
    const operation = ++operationSequence.current;
    try {
      reportActions.downloadJson();
      publishActionResult(operation, '已下载');
    } catch {
      publishActionResult(operation, '下载失败');
    }
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!workloadLocked) onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const dialog = dialogRef.current;
    const focusable = dialog ? getFocusableElements(dialog) : [];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) {
      event.preventDefault();
      dialog?.focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleScrimClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !workloadLocked) onClose();
  };

  return (
    <div
      className="experiment-panel__scrim"
      data-testid="experiment-panel-scrim"
      onClick={handleScrimClick}
    >
      <GlassSurface className="experiment-panel" mode={settings.glassMode}>
        <aside
          aria-labelledby={headingId}
          aria-modal="true"
          className="experiment-panel__content"
          onKeyDown={handleDialogKeyDown}
          ref={dialogRef}
          role="dialog"
          tabIndex={-1}
        >
          <header className="experiment-panel__heading">
            <div>
              <h2 id={headingId}>实验控制</h2>
              <p>调整画面并运行对比测试</p>
            </div>
            <button
              className="tap-target experiment-panel__close"
              disabled={workloadLocked}
              onClick={onClose}
              type="button"
            >
              关闭
            </button>
          </header>

          <BaselineSuiteCard controller={benchmarkController} />

          <div className="experiment-panel__body">
            <RadioGroup
              disabled={workloadLocked}
              legend="玻璃方式"
              name="glass-mode"
              onChange={(glassMode) => onChange({ glassMode })}
              options={glassOptions}
              value={settings.glassMode}
            />
            <RadioGroup
              disabled={workloadLocked}
              legend="动态等级"
              name="motion-level"
              onChange={(motionLevel) => onChange({ motionLevel })}
              options={motionOptions}
              value={settings.motionLevel}
            />
            <RadioGroup
              disabled={workloadLocked}
              legend="粒子数量"
              name="particle-count"
              onChange={(particleCount) => onChange({ particleCount })}
              options={particleOptions}
              value={settings.particleCount}
            />
            <RadioGroup
              disabled={workloadLocked}
              legend="像素密度"
              name="dpr-mode"
              onChange={(dprMode) => onChange({ dprMode })}
              options={dprOptions}
              value={settings.dprMode}
            />
            <RadioGroup
              disabled={workloadLocked}
              legend="HUD"
              name="hud-mode"
              onChange={(hudMode) => onChange({ hudMode })}
              options={hudOptions}
              value={settings.hudMode}
            />
            <div className="experiment-panel__toggles">
              <Toggle
                checked={settings.backgroundMotion}
                disabled={workloadLocked}
                label="背景动态"
                onChange={(backgroundMotion) => onChange({ backgroundMotion })}
              />
              <Toggle
                checked={settings.touchParallax}
                disabled={workloadLocked}
                label="触摸视差"
                onChange={(touchParallax) => onChange({ touchParallax })}
              />
              <Toggle
                checked={settings.cardFloat}
                disabled={workloadLocked}
                label="卡片浮动"
                onChange={(cardFloat) => onChange({ cardFloat })}
              />
              <Toggle
                checked={settings.reducedMotionSimulation}
                disabled={workloadLocked}
                label="模拟减少动态"
                onChange={(reducedMotionSimulation) =>
                  onChange({ reducedMotionSimulation })
                }
              />
            </div>
            <section aria-label="单次测试" className="experiment-panel__single-run">
              <div>
                <h3>单次测试</h3>
                <p>
                  {benchmarkController.state.phase ?? benchmarkController.state.status}
                </p>
              </div>
              <div className="experiment-panel__single-actions">
                <button
                  className="tap-target experiment-panel__action"
                  disabled={workloadLocked}
                  onClick={benchmarkController.start}
                  type="button"
                >
                  运行 30 秒 Benchmark
                </button>
                <button
                  className="tap-target experiment-panel__action"
                  disabled={benchmarkController.state.status !== 'running'}
                  onClick={benchmarkController.cancel}
                  type="button"
                >
                  取消 Benchmark
                </button>
              </div>
            </section>
          </div>

          <footer className="experiment-panel__footer">
            <div className="experiment-panel__report-actions">
              <button
                className="tap-target experiment-panel__action"
                onClick={() => void copy(reportActions.copyJson)}
                type="button"
              >
                复制 JSON
              </button>
              <button
                className="tap-target experiment-panel__action"
                onClick={download}
                type="button"
              >
                下载 JSON
              </button>
              <button
                className="tap-target experiment-panel__action"
                onClick={() => void copy(reportActions.copySummary)}
                type="button"
              >
                复制摘要
              </button>
              <button
                className="tap-target experiment-panel__action"
                disabled={workloadLocked}
                onClick={onReset}
                type="button"
              >
                重置设置
              </button>
            </div>
            {actionResult ? <output aria-live="polite">{actionResult}</output> : null}
          </footer>
        </aside>
      </GlassSurface>
    </div>
  );
}

function BaselineSuiteCard({ controller }: { controller: BenchmarkController }) {
  const { suiteState } = controller;
  const active = isSuiteActive(suiteState.status);
  const completedModes = new Set(suiteState.runs.map(({ mode }) => mode));
  const current = suiteState.mode
    ? `${modeLabel[suiteState.mode]} · ${suiteStatusLabel[suiteState.status]}`
    : suiteStatusLabel[suiteState.status];

  return (
    <section aria-label="四模式基线套件" className="experiment-panel__suite">
      <div className="experiment-panel__suite-heading">
        <div>
          <h3>四模式基线套件</h3>
          <p>预计 2 分 12 秒</p>
        </div>
        <p>{`中断 ${suiteState.consecutiveInterruptions} 次`}</p>
      </div>
      <ol aria-label="四模式进度" className="experiment-panel__progress">
        {BASELINE_MODE_ORDER.map((mode) => {
          const state = completedModes.has(mode)
            ? 'completed'
            : active && suiteState.mode === mode
              ? 'active'
              : 'pending';
          return (
            <li
              aria-current={state === 'active' ? 'step' : undefined}
              data-state={state}
              key={mode}
            >
              <span>{modeLabel[mode]}</span>
            </li>
          );
        })}
      </ol>
      <div className="experiment-panel__suite-status">
        <strong>{current}</strong>
        <div>
          <button
            className="tap-target experiment-panel__action"
            disabled={controller.workloadLocked}
            onClick={controller.startSuite}
            type="button"
          >
            开始全部
          </button>
          <button
            className="tap-target experiment-panel__action"
            disabled={!active}
            onClick={controller.cancelSuite}
            type="button"
          >
            取消全部
          </button>
        </div>
      </div>
      {suiteState.runs.length > 0 ? <SuiteResultTable state={suiteState} /> : null}
    </section>
  );
}

function SuiteResultTable({ state }: { state: BaselineSuiteState }) {
  return (
    <table aria-label="套件结果" className="experiment-panel__results">
      <thead>
        <tr>
          <th scope="col">模式</th>
          <th scope="col">FPS</th>
          <th scope="col">P95</th>
          <th scope="col">估算丢帧</th>
        </tr>
      </thead>
      <tbody>
        {state.runs.map((run) => {
          const metrics = readFrameMetrics(run.result);
          return (
            <tr key={run.mode}>
              <th scope="row">{modeLabel[run.mode]}</th>
              <td>{metricValue(metrics?.currentFps)}</td>
              <td>{metricValue(metrics?.p95FrameTime)}</td>
              <td>
                {metrics?.sampleCount === 0
                  ? '等待'
                  : metricValue(metrics?.estimatedDroppedFrames)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface SuiteFrameMetrics {
  currentFps: number | null;
  p95FrameTime: number | null;
  estimatedDroppedFrames: number | null;
  sampleCount: number;
}

function readFrameMetrics(result: unknown): SuiteFrameMetrics | null {
  if (!isRecord(result) || !isRecord(result.frames)) return null;
  const metrics = result.frames.metrics;
  if (!isRecord(metrics)) return null;
  return {
    currentFps: numberOrNull(metrics.currentFps),
    p95FrameTime: numberOrNull(metrics.p95FrameTime),
    estimatedDroppedFrames: numberOrNull(metrics.estimatedDroppedFrames),
    sampleCount: numberOrZero(metrics.sampleCount),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const numberOrZero = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const metricValue = (value: number | null | undefined): string =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(0) : '等待';

function Toggle({
  checked,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="experiment-panel__toggle">
      <input
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}
