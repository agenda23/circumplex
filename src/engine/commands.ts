import type { Command, Effect, EngineState } from './types';

export function reduce(state: EngineState, cmd: Command): [EngineState, Effect[]] {
  switch (cmd.type) {
    case 'session.start':
      return [
        { ...state, status: 'starting', input: cmd.input, error: null },
        [{ type: 'audio.start', input: cmd.input }],
      ];

    case 'session.stop':
      return [
        { ...state, status: 'idle', input: null, levels: { low: 0, mid: 0, high: 0 } },
        [{ type: 'audio.stop' }],
      ];

    case 'levels.update':
      return [{ ...state, status: 'running', levels: cmd.levels }, []];

    case 'circumplex.update':
      return [{ ...state, circumplex: cmd.circumplex, features: cmd.features }, []];

    case 'fps.update':
      return [{ ...state, fps: cmd.fps }, []];

    case 'audio.error':
      return [{ ...state, status: 'error', error: cmd.message }, []];
  }
}
