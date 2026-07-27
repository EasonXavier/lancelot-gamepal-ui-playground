import { GlassSurface } from '../glass/GlassSurface';
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
  open: boolean;
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
  { label: 'Real Blur', value: 'real' },
  { label: 'Simulated Glass', value: 'simulated' },
  { label: 'Preblur Layer', value: 'preblur' },
  { label: 'Blur Off', value: 'off' },
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

function RadioGroup<T extends string | number>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="experiment-panel__group">
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
  open,
  settings,
  onChange,
  onReset,
  onClose,
}: ExperimentPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <GlassSurface className="experiment-panel" mode={settings.glassMode}>
      <aside aria-label="实验控制" className="experiment-panel__content" role="region">
        <div className="experiment-panel__heading">
          <h2>实验控制</h2>
          <button className="tap-target" onClick={onClose} type="button">
            收起
          </button>
        </div>
        <RadioGroup
          legend="玻璃方式"
          name="glass-mode"
          onChange={(glassMode) => onChange({ glassMode })}
          options={glassOptions}
          value={settings.glassMode}
        />
        <RadioGroup
          legend="动态等级"
          name="motion-level"
          onChange={(motionLevel) => onChange({ motionLevel })}
          options={motionOptions}
          value={settings.motionLevel}
        />
        <RadioGroup
          legend="粒子数量"
          name="particle-count"
          onChange={(particleCount) => onChange({ particleCount })}
          options={particleOptions}
          value={settings.particleCount}
        />
        <RadioGroup
          legend="像素密度"
          name="dpr-mode"
          onChange={(dprMode) => onChange({ dprMode })}
          options={dprOptions}
          value={settings.dprMode}
        />
        <RadioGroup
          legend="HUD"
          name="hud-mode"
          onChange={(hudMode) => onChange({ hudMode })}
          options={hudOptions}
          value={settings.hudMode}
        />
        <div className="experiment-panel__toggles">
          <Toggle
            checked={settings.backgroundMotion}
            label="背景动态"
            onChange={(backgroundMotion) => onChange({ backgroundMotion })}
          />
          <Toggle
            checked={settings.touchParallax}
            label="触摸视差"
            onChange={(touchParallax) => onChange({ touchParallax })}
          />
          <Toggle
            checked={settings.cardFloat}
            label="卡片浮动"
            onChange={(cardFloat) => onChange({ cardFloat })}
          />
          <Toggle
            checked={settings.reducedMotionSimulation}
            label="模拟减少动态"
            onChange={(reducedMotionSimulation) =>
              onChange({ reducedMotionSimulation })
            }
          />
        </div>
        <button
          className="tap-target experiment-panel__reset"
          onClick={onReset}
          type="button"
        >
          重置设置
        </button>
      </aside>
    </GlassSurface>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="experiment-panel__toggle">
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}
