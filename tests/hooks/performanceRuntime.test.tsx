import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { usePerformanceRuntime } from '../../src/hooks/usePerformanceRuntime';
import {
  createPerformanceRuntime,
  type PerformanceRuntime,
} from '../../src/performance/runtime';

vi.mock('../../src/performance/runtime', () => ({
  createPerformanceRuntime: vi.fn(),
}));

function createRuntime(): PerformanceRuntime {
  return {
    start: vi.fn(async () => undefined),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
    reset: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
    getSnapshot: vi.fn(),
  };
}

function HookHarness({ active }: { active: boolean }) {
  usePerformanceRuntime(active);
  return null;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('usePerformanceRuntime', () => {
  it('catches StrictMode visibility transitions leaking an inactive or stopped runtime', () => {
    const runtime = createRuntime();
    vi.mocked(createPerformanceRuntime).mockReturnValue(runtime);

    const { rerender, unmount } = render(
      <StrictMode>
        <HookHarness active={false} />
      </StrictMode>,
    );
    expect(runtime.start).not.toHaveBeenCalled();
    expect(runtime.pause).toHaveBeenCalled();

    rerender(
      <StrictMode>
        <HookHarness active />
      </StrictMode>,
    );
    expect(runtime.start).toHaveBeenCalledOnce();
    expect(runtime.resume).toHaveBeenCalledOnce();

    rerender(
      <StrictMode>
        <HookHarness active={false} />
      </StrictMode>,
    );
    expect(runtime.pause).toHaveBeenCalledTimes(3);
    unmount();
    expect(runtime.stop).toHaveBeenCalledTimes(2);
  });
});
