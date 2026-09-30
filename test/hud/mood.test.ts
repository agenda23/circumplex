import { describe, expect, it } from 'vitest';
import { moodLabel } from '../../src/hud/mood';

describe('moodLabel', () => {
  it('is Neutral near the origin', () => {
    expect(moodLabel(0, 0)).toBe('Neutral');
    expect(moodLabel(0.05, -0.05)).toBe('Neutral');
  });

  it('labels the four cardinal directions', () => {
    expect(moodLabel(1, 0)).toBe('Happy / Pleased');
    expect(moodLabel(0, 1)).toBe('Alert / Tense');
    expect(moodLabel(-1, 0)).toBe('Unpleasant / Sad');
    expect(moodLabel(0, -1)).toBe('Calm / Relaxed');
  });

  it('labels the diagonal octants', () => {
    expect(moodLabel(0.7, 0.7)).toBe('Excited / Elated');
    expect(moodLabel(-0.7, 0.7)).toBe('Stressed / Nervous');
    expect(moodLabel(-0.7, -0.7)).toBe('Depressed / Bored');
    expect(moodLabel(0.7, -0.7)).toBe('Content / Serene');
  });
});
