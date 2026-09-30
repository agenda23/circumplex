/**
 * PRD §5.3: shareable UI state via a Base64 URL query param, plus a
 * `?ui=false` clean/OBS-safe mode. Kept as pure functions operating on a
 * `search` string (not `window.location` directly) so they're testable
 * without a browser environment; `main.ts` is the thin wrapper that reads
 * `window.location.search` and calls `history.replaceState`.
 *
 * `PersistedSettings` only has one field today (`autoScalingEnabled`) since
 * that's the only real persisted setting this app has so far -- extend it
 * as more UI parameters (manual color/effect overrides, etc.) are built.
 */

export interface PersistedSettings {
  autoScalingEnabled: boolean;
}

const DEFAULT_SETTINGS: PersistedSettings = { autoScalingEnabled: true };

function toBase64Url(json: string): string {
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return atob(padded);
}

function isPersistedSettings(value: unknown): value is PersistedSettings {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).autoScalingEnabled === 'boolean'
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
