import type { EngineState } from '../engine/types';

export function formatHud(state: EngineState): string {
  const { levels } = state;
  const status = state.status === 'error' ? `ERROR: ${state.error}` : state.status.toUpperCase();
  return `[ FPS: ${state.fps.toFixed(0)} | STATUS: ${status} | L ${levels.low.toFixed(2)} M ${levels.mid.toFixed(2)} H ${levels.high.toFixed(2)} ]\n[ Enter: start demo | M: start mic ]`;
}
