import { reduce } from './commands';
import { readBandLevels } from './audio/bands';
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
    }
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
