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
        this.startAudio(effect.input);
        break;
      case 'audio.stop':
        this.audioGraph?.stop();
        this.audioGraph = null;
        break;
    }
  }

  private startAudio(input: 'demo' | 'mic'): void {
    this.audioGraph?.stop();
    this.audioGraph = null;

    const graphPromise = input === 'demo' ? Promise.resolve(createDemoAudioGraph()) : createMicAudioGraph();

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
