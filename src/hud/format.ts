import type { EngineState } from '../engine/types';
import { moodLabel } from './mood';

export interface HudCorners {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
}

const LEVEL_BAR_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/** Maps a 0..1 level to one of 8 Unicode block-height characters (▁..█). */
export function levelBar(value: number): string {
  const clamped = Math.min(1, Math.max(0, value));
  const index = Math.min(LEVEL_BAR_CHARS.length - 1, Math.floor(clamped * LEVEL_BAR_CHARS.length));
  return LEVEL_BAR_CHARS[index]!;
}

export function formatHud(state: EngineState): HudCorners {
  const { levels, circumplex, features, scaling } = state;
  const status = state.status === 'error' ? `ERROR: ${state.error}` : state.status.toUpperCase();

  const mood = moodLabel(circumplex.valence, circumplex.arousal);
  const topLeft = `STATUS: ${status} | MOOD: ${mood}\nV ${circumplex.valence.toFixed(2)} A ${circumplex.arousal.toFixed(2)}\ncentroid ${features.centroid.toFixed(0)}Hz flat ${features.flatness.toFixed(2)} flux ${features.flux.toFixed(3)}`;

  const topRight = `FPS: ${state.fps.toFixed(0)}\nSCALING: ${scaling.pixelRatio.toFixed(2)}x(${scaling.level})`;

  const bottomRight = `L${levelBar(levels.low)} M${levelBar(levels.mid)} H${levelBar(levels.high)} R${levelBar(features.rms)}`;

  const bottomLeft = 'Enter: start demo\nM: start mic\n`/Esc: settings';

  return { topLeft, topRight, bottomLeft, bottomRight };
}
