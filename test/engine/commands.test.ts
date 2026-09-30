import { describe, expect, it } from 'vitest';
import { reduce } from '../../src/engine/commands';
import { createInitialState } from '../../src/engine/types';

describe('reduce', () => {
  it('session.start moves to starting and requests audio.start', () => {
    const [state, effects] = reduce(createInitialState(), { type: 'session.start', input: 'demo' });
    expect(state.status).toBe('starting');
    expect(state.input).toBe('demo');
    expect(effects).toEqual([{ type: 'audio.start', input: 'demo' }]);
  });

  it('session.stop resets state and requests audio.stop', () => {
    const running = { ...createInitialState(), status: 'running' as const, input: 'mic' as const };
    const [state, effects] = reduce(running, { type: 'session.stop' });
    expect(state.status).toBe('idle');
    expect(state.input).toBeNull();
    expect(state.levels).toEqual({ low: 0, mid: 0, high: 0 });
    expect(effects).toEqual([{ type: 'audio.stop' }]);
  });

  it('levels.update applies levels and marks the session running', () => {
    const starting = { ...createInitialState(), status: 'starting' as const };
    const levels = { low: 0.1, mid: 0.2, high: 0.3 };
    const [state, effects] = reduce(starting, { type: 'levels.update', levels });
    expect(state.status).toBe('running');
    expect(state.levels).toEqual(levels);
    expect(effects).toEqual([]);
  });

  it('fps.update sets fps without touching other fields', () => {
    const [state, effects] = reduce(createInitialState(), { type: 'fps.update', fps: 59.5 });
    expect(state.fps).toBe(59.5);
    expect(effects).toEqual([]);
  });

  it('audio.error moves to error with the message', () => {
    const [state, effects] = reduce(createInitialState(), { type: 'audio.error', message: 'permission denied' });
    expect(state.status).toBe('error');
    expect(state.error).toBe('permission denied');
    expect(effects).toEqual([]);
  });

  it('is pure: does not mutate the input state', () => {
    const initial = createInitialState();
    const snapshot = JSON.parse(JSON.stringify(initial));
    reduce(initial, { type: 'fps.update', fps: 30 });
    expect(initial).toEqual(snapshot);
  });
});
