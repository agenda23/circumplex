import { describe, expect, it } from 'vitest';
import {
  buildSearchWithSettings,
  decodeSettings,
  encodeSettings,
  isUiVisible,
  parseSettingsFromSearch,
  type PersistedSettings,
} from '../../src/state/urlState';

const DEFAULTS: PersistedSettings = {
  autoScalingEnabled: true,
  sensitivity: 1.0,
  peakNormalize: true,
  attackMs: 8,
  releaseMs: 160,
  trail: 0,
  chroma: 0,
  crt: false,
  vectorScopeGain: 1,
  autopilotEnabled: true,
  shadeMode: 0,
};

describe('encodeSettings / decodeSettings', () => {
  it('round-trips', () => {
    const settings: PersistedSettings = { ...DEFAULTS, autoScalingEnabled: false, sensitivity: 2.5 };
    expect(decodeSettings(encodeSettings(settings))).toEqual(settings);
  });

  it('produces a URL-safe string (no +, /, or = padding)', () => {
    const encoded = encodeSettings(DEFAULTS);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('returns null for corrupt input instead of throwing', () => {
    expect(decodeSettings('not-valid-base64!!!')).toBeNull();
  });

  it('returns null for well-formed but foreign JSON shapes', () => {
    const encoded = btoa(JSON.stringify({ someOtherApp: true })).replace(/=+$/, '');
    expect(decodeSettings(encoded)).toBeNull();
  });

  it('fills defaults for fields missing from an older payload', () => {
    const encoded = btoa(JSON.stringify({ autoScalingEnabled: false })).replace(/=+$/, '');
    expect(decodeSettings(encoded)).toEqual({ ...DEFAULTS, autoScalingEnabled: false });
  });

  it('clamps visual FX numbers into their slider ranges', () => {
    const encoded = btoa(JSON.stringify({ ...DEFAULTS, trail: 4, vectorScopeGain: 0 })).replace(/=+$/, '');
    expect(decodeSettings(encoded)).toMatchObject({ trail: 0.9, vectorScopeGain: 0.2 });
  });
});

describe('parseSettingsFromSearch', () => {
  it('falls back to defaults when there is no p param', () => {
    expect(parseSettingsFromSearch('')).toEqual(DEFAULTS);
  });

  it('falls back to defaults when p is corrupt', () => {
    expect(parseSettingsFromSearch('?p=garbage')).toEqual(DEFAULTS);
  });

  it('reads a valid p param', () => {
    const settings: PersistedSettings = { ...DEFAULTS, autoScalingEnabled: false };
    const encoded = encodeSettings(settings);
    expect(parseSettingsFromSearch(`?p=${encoded}`)).toEqual(settings);
  });
});

describe('isUiVisible', () => {
  it('is true by default', () => {
    expect(isUiVisible('')).toBe(true);
  });

  it('is false for ?ui=false', () => {
    expect(isUiVisible('?ui=false')).toBe(false);
  });

  it('is true for any other ui value', () => {
    expect(isUiVisible('?ui=true')).toBe(true);
    expect(isUiVisible('?ui=1')).toBe(true);
  });
});

describe('buildSearchWithSettings', () => {
  it('adds a p param to an empty search', () => {
    const settings: PersistedSettings = { ...DEFAULTS, autoScalingEnabled: false };
    const search = buildSearchWithSettings('', settings);
    expect(parseSettingsFromSearch(`?${search}`)).toEqual(settings);
  });

  it('preserves an existing ui param while updating p', () => {
    const search = buildSearchWithSettings('?ui=false&p=old', DEFAULTS);
    const params = new URLSearchParams(search);
    expect(params.get('ui')).toBe('false');
    expect(params.get('p')).not.toBe('old');
  });
});
