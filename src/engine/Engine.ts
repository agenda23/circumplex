import { reduce } from './commands';
import { readAnalyserLevel, readBandLevels } from './audio/bands';
import { FeatureWorkerClient } from './audio/featureWorkerClient';
import { createMicAudioGraph } from './audio/input';
import { createDemoAudioGraph } from './audio/synth';
import type { AudioGraph } from './audio/graph';
import { createInitialState, type Effect, type Envelope, type EngineState } from './types';

/**
 * Holds engine state and runs the effects a dispatch produces. Must never
 * import from `hud/` or `input/` — those read `Engine`, not the other way
 * around.
 */
export class Engine {
  private state: EngineState = createInitialState();
  private audioGraph: AudioGraph | null = null;
  private readonly featureClient = new FeatureWorkerClient();
  private freqScratch: Float32Array<ArrayBuffer> | null = null;
  private lastFeatureTime = performance.now();
  private vectorScratchL: Float32Array<ArrayBuffer> | null = null;
  private vectorScratchR: Float32Array<ArrayBuffer> | null = null;

  constructor() {
    this.featureClient.onResults(({ features, circumplex }) => {
      this.dispatch({ t: performance.now(), source: 'system', cmd: { type: 'circumplex.update', circumplex, features } });
    });
  }

  getState(): Readonly<EngineState> {
    return this.state;
  }

  dispatch(envelope: Envelope): void {
    const [next, effects] = reduce(this.state, envelope.cmd);
    this.state = next;
    for (const effect of effects) this.runEffect(effect);
  }

  /** Called once per animation frame by the caller's render loop. */
  tick(fps: number): void {
    this.dispatch({ t: performance.now(), source: 'system', cmd: { type: 'fps.update', fps } });
    if (this.audioGraph) {
      const levels = readBandLevels(this.audioGraph.analysers);
      this.dispatch({ t: performance.now(), source: 'system', cmd: { type: 'levels.update', levels } });
      this.submitFeatures(this.audioGraph);
    }
  }

  /** Raw L/R time-domain samples for vector synthesis (PRD §3.2) -- deliberately
   * bypasses the command/state system, same reasoning as feature extraction:
   * this is a per-frame render input, not small serializable app state. */
  getVectorSamples(): { left: Float32Array; right: Float32Array } | null {
    if (!this.audioGraph) return null;
    const { vectorL, vectorR } = this.audioGraph.analysers;

    if (!this.vectorScratchL || this.vectorScratchL.length !== vectorL.fftSize) {
      this.vectorScratchL = new Float32Array(vectorL.fftSize);
    }
    if (!this.vectorScratchR || this.vectorScratchR.length !== vectorR.fftSize) {
      this.vectorScratchR = new Float32Array(vectorR.fftSize);
    }
    vectorL.getFloatTimeDomainData(this.vectorScratchL);
    vectorR.getFloatTimeDomainData(this.vectorScratchR);
    return { left: this.vectorScratchL, right: this.vectorScratchR };
  }

  private submitFeatures(graph: AudioGraph): void {
    const full = graph.analysers.full;
    if (!this.freqScratch || this.freqScratch.length !== full.frequencyBinCount) {
      this.freqScratch = new Float32Array(full.frequencyBinCount);
    }
    full.getFloatFrequencyData(this.freqScratch);
    const rms = readAnalyserLevel(full);

    const now = performance.now();
    const dt = (now - this.lastFeatureTime) / 1000;
    this.lastFeatureTime = now;

    this.featureClient.submit(this.freqScratch, graph.context.sampleRate, full.fftSize, rms, dt);
  }

  private runEffect(effect: Effect): void {
    switch (effect.type) {
      case 'audio.start':
        this.startAudio(effect.input, effect.deviceId);
        break;
      case 'audio.stop':
        this.audioGraph?.stop();
        this.audioGraph = null;
        break;
    }
  }

  private startAudio(input: 'demo' | 'mic', deviceId?: string): void {
    this.audioGraph?.stop();
    this.audioGraph = null;

    const graphPromise = input === 'demo' ? Promise.resolve(createDemoAudioGraph()) : createMicAudioGraph(deviceId);

    graphPromise
      .then((graph) => {
        this.audioGraph = graph;
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.dispatch({ t: performance.now(), source: 'system', cmd: { type: 'audio.error', message } });
      });
  }
}
