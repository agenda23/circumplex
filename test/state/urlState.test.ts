import { describe, expect, it } from 'vitest';
import {
  buildSearchWithSettings,
  decodeSettings,
  encodeSettings,
  isUiVisible,
  parseSettingsFromSearch,
} from '../../src/state/urlState';

describe('encodeSettings / decodeSettings', () => {
  it('round-trips', () => {
    const settings = { autoScalingEnabled: false };
    expect(decodeSettings(encodeSettings(settings))).toEqual(settings);
  });

  it('produces a URL-safe string (no +, /, or = padding)', () => {
    const encoded = encodeSettings({ autoScalingEnabled: true });
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('returns null for corrupt input instead of throwing', () => {
    expect(decodeSettings('not-valid-base64!!!')).toBeNull();
  });

  it('returns null for well-formed but foreign JSON shapes', () => {
    const encoded = btoa(JSON.stringify({ someOtherApp: true })).replace(/=+$/, '');
    expect(decodeSettings(encoded)).toBeNull();
  });
});

describe('parseSettingsFromSearch', () => {
  it('falls back to defaults when there is no p param', () => {
    expect(parseSettingsFromSearch('')).toEqual({ autoScalingEnabled: true });
  });

  it('falls back to defaults when p is corrupt', () => {
    expect(parseSettingsFromSearch('?p=garbage')).toEqual({ autoScalingEnabled: true });
  });

  it('reads a valid p param', () => {
    const encoded = encodeSettings({ autoScalingEnabled: false });
    expect(parseSettingsFromSearch(`?p=${encoded}`)).toEqual({ autoScalingEnabled: false });
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
    const search = buildSearchWithSettings('', { autoScalingEnabled: false });
    expect(parseSettingsFromSearch(`?${search}`)).toEqual({ autoScalingEnabled: false });
  });

  it('preserves an existing ui param while updating p', () => {
    const search = buildSearchWithSettings('?ui=false&p=old', { autoScalingEnabled: false });
    const params = new URLSearchParams(search);
    expect(params.get('ui')).toBe('false');
    expect(params.get('p')).not.toBe('old');
  });
});
