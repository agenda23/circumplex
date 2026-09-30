/**
 * PRD §5.3: shareable UI state via a Base64 URL query param, plus a
 * `?ui=false` clean/OBS-safe mode. Kept as pure functions operating on a
 * `search` string (not `window.location` directly) so they're testable
 * without a browser environment; `main.ts` is the thin wrapper that reads
 * `window.location.search` and calls `history.replaceState`.
 */

export interface PersistedSettings {
  autoScalingEnabled: boolean;
  sensitivity: number;
  peakNormalize: boolean;
  attackMs: number;
  releaseMs: number;
}

const DEFAULT_SETTINGS: PersistedSettings = {
  autoScalingEnabled: true,
  sensitivity: 1.0,
  peakNormalize: true,
  attackMs: 8,
  releaseMs: 160,
};

function toBase64Url(json: string): string {
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return atob(padded);
}

function isPersistedSettings(value: unknown): value is PersistedSettings {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.autoScalingEnabled === 'boolean' &&
    typeof v.sensitivity === 'number' &&
    typeof v.peakNormalize === 'boolean' &&
    typeof v.attackMs === 'number' &&
    typeof v.releaseMs === 'number'
  );
}

export function encodeSettings(settings: PersistedSettings): string {
  return toBase64Url(JSON.stringify(settings));
}

/** Returns null for any corrupt/foreign/missing input, never throws. */
export function decodeSettings(encoded: string): PersistedSettings | null {
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(encoded));
    return isPersistedSettings(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseSettingsFromSearch(search: string): PersistedSettings {
  const encoded = new URLSearchParams(search).get('p');
  if (!encoded) return DEFAULT_SETTINGS;
  return decodeSettings(encoded) ?? DEFAULT_SETTINGS;
}

export function isUiVisible(search: string): boolean {
  return new URLSearchParams(search).get('ui') !== 'false';
}

/** Updates the `p` param while preserving any other existing params (e.g. `ui`). */
export function buildSearchWithSettings(search: string, settings: PersistedSettings): string {
  const params = new URLSearchParams(search);
  params.set('p', encodeSettings(settings));
  return params.toString();
}
