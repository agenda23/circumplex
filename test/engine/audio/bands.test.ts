import { describe, expect, it } from 'vitest';
import { readBandLevels, type AnalyserLike } from '../../../src/engine/audio/bands';

function fakeAnalyser(fill: (array: Uint8Array) => void, fftSize = 8): AnalyserLike {
  return {
    fftSize,
    getByteTimeDomainData(array: Uint8Array) {
      fill(array);
    },
  };
}

const silent = () => fakeAnalyser((arr) => arr.fill(128));
const fullScale = () => fakeAnalyser((arr) => arr.forEach((_, i) => (arr[i] = i % 2 === 0 ? 0 : 255)));

describe('readBandLevels', () => {
  it('reports ~0 for silence', () => {
    const levels = readBandLevels({ low: silent(), mid: silent(), high: silent() });
    expect(levels.low).toBeCloseTo(0, 5);
    expect(levels.mid).toBeCloseTo(0, 5);
    expect(levels.high).toBeCloseTo(0, 5);
  });

  it('reports ~1 for a full-scale square wave', () => {
    const levels = readBandLevels({ low: fullScale(), mid: fullScale(), high: fullScale() });
    expect(levels.low).toBeGreaterThan(0.95);
    expect(levels.mid).toBeGreaterThan(0.95);
    expect(levels.high).toBeGreaterThan(0.95);
  });

  it('keeps bands independent', () => {
    const levels = readBandLevels({ low: silent(), mid: fullScale(), high: silent() });
    expect(levels.low).toBeCloseTo(0, 5);
    expect(levels.mid).toBeGreaterThan(0.95);
    expect(levels.high).toBeCloseTo(0, 5);
  });

  it('re-reads live data from the same node on each call', () => {
    let loud = false;
    const node = fakeAnalyser((arr) => arr.fill(loud ? 255 : 128));

    const quiet = readBandLevels({ low: node, mid: node, high: node });
    expect(quiet.low).toBeCloseTo(0, 5);

    loud = true;
    const louder = readBandLevels({ low: node, mid: node, high: node });
    expect(louder.low).toBeGreaterThan(0.9);
  });
});
