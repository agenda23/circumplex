import { describe, expect, it } from 'vitest';
import { formatHud, levelBar } from '../../src/hud/format';
import { createInitialState } from '../../src/engine/types';

describe('levelBar', () => {
  it('maps 0 to the lowest bar', () => {
    expect(levelBar(0)).toBe('▁');
  });

  it('maps 1 (and above) to the tallest bar', () => {
    expect(levelBar(1)).toBe('█');
    expect(levelBar(1.5)).toBe('█');
  });

  it('clamps negative values to the lowest bar', () => {
    expect(levelBar(-0.5)).toBe('▁');
  });

  it('is monotonic: higher input never yields a shorter bar', () => {
    const bars = [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1].map(levelBar);
    const heights = bars.map((b) => '▁▂▃▄▅▆▇█'.indexOf(b));
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1]!);
    }
  });
});

describe('formatHud', () => {
  it('produces all four corners', () => {
    const corners = formatHud(createInitialState());
    expect(corners.topLeft).toContain('STATUS: IDLE');
    expect(corners.topRight).toContain('FPS: 0');
    expect(corners.bottomLeft).toContain('start demo');
    expect(corners.bottomRight).toMatch(/^L. M. H. R.$/u);
  });

  it('shows the error message when status is error', () => {
    const state = { ...createInitialState(), status: 'error' as const, error: 'boom' };
    expect(formatHud(state).topLeft).toContain('ERROR: boom');
  });
});
