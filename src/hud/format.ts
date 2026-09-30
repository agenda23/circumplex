import type { EngineState } from '../engine/types';

export function formatHud(state: EngineState): string {
  const { levels, circumplex, features } = state;
  const status = state.status === 'error' ? `ERROR: ${state.error}` : state.status.toUpperCase();
  const line1 = `[ FPS: ${state.fps.toFixed(0)} | STATUS: ${status} | L ${levels.low.toFixed(2)} M ${levels.mid.toFixed(2)} H ${levels.high.toFixed(2)} ]`;
  const line2 = `[ V ${circumplex.valence.toFixed(2)} A ${circumplex.arousal.toFixed(2)} | centroid ${features.centroid.toFixed(0)}Hz flat ${features.flatness.toFixed(2)} flux ${features.flux.toFixed(3)} ]`;
  return `${line1}\n${line2}\n[ Enter: start demo | M: start mic ]`;
}
