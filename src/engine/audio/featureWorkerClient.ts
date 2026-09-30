import type { FeatureResult } from './features.worker';

/**
 * Main-thread wrapper around the feature-extraction worker. Drops a frame's
 * submission if the worker is still busy with the previous one, instead of
 * queueing — keeps the worker at its own pace without an unbounded backlog.
 */
export class FeatureWorkerClient {
  private readonly worker: Worker;
  private busy = false;
  private onResult: ((result: FeatureResult) => void) | null = null;

  constructor() {
    this.worker = new Worker(new URL('./features.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<FeatureResult>) => {
      this.busy = false;
      this.onResult?.(event.data);
    };
  }

  onResults(callback: (result: FeatureResult) => void): void {
    this.onResult = callback;
  }

  submit(freqDb: Float32Array<ArrayBufferLike>, sampleRate: number, fftSize: number, rms: number, dt: number): void {
    if (this.busy) return;
    this.busy = true;
    this.worker.postMessage({ freqDb, sampleRate, fftSize, rms, dt });
  }

  stop(): void {
    this.worker.terminate();
  }
}
