import { serializeReport, type ReportSnapshot } from './reportExporter';

export interface ReportActions {
  copyJson(): Promise<void>;
  downloadJson(): void;
  copySummary(): Promise<void>;
}

interface ClipboardWriter {
  writeText(text: string): Promise<void>;
}

interface ObjectUrlApi {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

interface BlobConstructor {
  new (blobParts?: BlobPart[], options?: BlobPropertyBag): Blob;
}

export interface ReportActionDependencies {
  clipboard: ClipboardWriter;
  document: Document;
  Blob: BlobConstructor;
  url: ObjectUrlApi;
  now(): Date;
}

const defaultDependencies = (): ReportActionDependencies => ({
  clipboard: navigator.clipboard,
  document,
  Blob,
  url: URL,
  now: () => new Date(),
});

export function createReportActions(
  getSnapshot: () => ReportSnapshot,
  dependencies: ReportActionDependencies = defaultDependencies(),
): ReportActions {
  const serializedSnapshot = (): string => {
    const snapshot = getSnapshot();
    return serializeReport({
      ...snapshot,
      page: { url: sanitizePageIdentifier(snapshot.page.url) },
    });
  };

  return {
    copyJson(): Promise<void> {
      return dependencies.clipboard.writeText(serializedSnapshot());
    },

    downloadJson(): void {
      const blob = new dependencies.Blob([serializedSnapshot()], {
        type: 'application/json;charset=utf-8',
      });
      const objectUrl = dependencies.url.createObjectURL(blob);
      let anchor: HTMLAnchorElement | null = null;

      try {
        anchor = dependencies.document.createElement('a');
        anchor.download = `lancelot-ui-report-${fileTimestamp(dependencies.now())}.json`;
        anchor.href = objectUrl;
        dependencies.document.body.append(anchor);
        anchor.click();
      } finally {
        anchor?.remove();
        dependencies.url.revokeObjectURL(objectUrl);
      }
    },

    copySummary(): Promise<void> {
      return dependencies.clipboard.writeText(formatSummary(getSnapshot()));
    },
  };
}

const allowedPagePaths = new Set(['/', '/lancelot-gamepal-ui-playground/']);

export function sanitizePageIdentifier(input: string): string {
  try {
    const pathname = new URL(input, 'https://local.invalid').pathname;
    return allowedPagePaths.has(pathname) ? pathname : '[redacted]';
  } catch {
    return '[redacted]';
  }
}

function formatSummary(snapshot: ReportSnapshot): string {
  const { frames } = snapshot.performance;
  return [
    '朗世乐 UI 性能报告',
    `Glass: ${snapshot.settings.glassMode}`,
    `FPS: ${metricText(frames.averageFps)}`,
    `P95 Frame: ${metricText(frames.p95FrameTime)}`,
    `Estimated Dropped Frames: ${metricText(frames.estimatedDroppedFrames)}`,
    `Foreground Complete: ${foregroundText(snapshot.benchmark.completedInForeground)}`,
  ].join('\n');
}

function metricText(value: number | null): string {
  return value === null ? 'waiting' : String(value);
}

function foregroundText(value: boolean | null): string {
  if (value === null) {
    return 'waiting';
  }
  return value ? 'yes' : 'no';
}

function fileTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}
