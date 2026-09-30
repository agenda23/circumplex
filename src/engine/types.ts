export interface BandLevels {
  low: number;
  mid: number;
  high: number;
}

export type AudioSourceKind = 'demo' | 'mic';

export type EngineStatus = 'idle' | 'starting' | 'running' | 'error';

export interface EngineState {
  status: EngineStatus;
  input: AudioSourceKind | null;
  levels: BandLevels;
  fps: number;
  error: string | null;
}

export function createInitialState(): EngineState {
  return {
    status: 'idle',
    input: null,
    levels: { low: 0, mid: 0, high: 0 },
    fps: 0,
    error: null,
  };
}

export type Command =
  | { type: 'session.start'; input: AudioSourceKind }
  | { type: 'session.stop' }
  | { type: 'levels.update'; levels: BandLevels }
  | { type: 'fps.update'; fps: number }
  | { type: 'audio.error'; message: string };

export type EnvelopeSource = 'keyboard' | 'system';

export interface Envelope {
  t: number;
  source: EnvelopeSource;
  cmd: Command;
}

export type Effect = { type: 'audio.start'; input: AudioSourceKind } | { type: 'audio.stop' };
