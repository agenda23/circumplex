/**
 * Human-readable label for a Circumplex (Valence/Arousal) point, using the
 * standard 8 octant categories from Russell's model. Purely a HUD/display
 * concern -- the actual V/A computation lives in engine/audio/circumplex.ts.
 */

const OCTANT_LABELS = [
  'Happy / Pleased', // 0deg: +V, 0A
  'Excited / Elated', // 45deg: +V, +A
  'Alert / Tense', // 90deg: 0V, +A
  'Stressed / Nervous', // 135deg: -V, +A
  'Unpleasant / Sad', // 180deg: -V, 0A
  'Depressed / Bored', // 225deg: -V, -A
  'Calm / Relaxed', // 270deg: 0V, -A
  'Content / Serene', // 315deg: +V, -A
];

const NEUTRAL_RADIUS = 0.15;

export function moodLabel(valence: number, arousal: number): string {
  const radius = Math.sqrt(valence * valence + arousal * arousal);
  if (radius < NEUTRAL_RADIUS) return 'Neutral';

  const angleDeg = ((Math.atan2(arousal, valence) * 180) / Math.PI + 360) % 360;
  const octant = Math.round(angleDeg / 45) % 8;
  return OCTANT_LABELS[octant]!;
}
