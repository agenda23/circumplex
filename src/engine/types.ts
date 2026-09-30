export interface BandLevels {
  low: number;
  mid: number;
  high: number;
}

export interface CircumplexPoint {
  valence: number;
  arousal: number;
}

export interface ScalingState {
  level: number;
  pixelRatio: number;
}

export interface MirFeatures {
  rms: number;
  centroid: number;
  flatness: number;
  flux: number;
  chroma: number[];
}

function createInitialFeatures(): MirFeatures {
  return { rms: 0, centroid: 0, flatness: 0, flux: 0, chroma: new Array(12).fill(0) };
}

export type AudioSourceKind = 'demo' | 'mic';

export type EngineStatus = 'idle' | 'starting' | 'running' | 'error';

export interface EngineState {
  status: EngineStatus;
  input: AudioSourceKind | null;
  levels: BandLevels;
  circumplex: CircumplexPoint;
  features: MirFeatures;
  scaling: ScalingState;
  fps: number;
  error: string | null;
}

export function createInitialState(): EngineState {
  return {
    status: 'idle',
    input: null,
    levels: { low: 0, mid: 0, high: 0 },
    circumplex: { valence: 0, arousal: 0 },
    features: createInitialFeatures(),
    scaling: { level: 0, pixelRatio: 1 },
    fps: 0,
    error: null,
  };
}

export type Command =
  | { type: 'session.start'; input: AudioSourceKind }
  | { type: 'session.stop' }
  | { type: 'levels.update'; levels: BandLevels }
  | { type: 'circumplex.update'; circumplex: CircumplexPoint; features: MirFeatures }
  | { type: 'scaling.update'; scaling: ScalingState }
  | { type: 'fps.update'; fps: number }
  | { type: 'audio.error'; message: string };

export type EnvelopeSource = 'keyboard' | 'system';

export interface Envelope {
  t: number;
  source: EnvelopeSource;
  cmd: Command;
}

export type Effect = { type: 'audio.start'; input: AudioSourceKind } | { type: 'audio.stop' };
