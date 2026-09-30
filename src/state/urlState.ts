/**
 * PRD §5.3: shareable UI state via a Base64 URL query param, plus a
 * `?ui=false` clean/OBS-safe mode. Kept as pure functions operating on a
 * `search` string (not `window.location` directly) so they're testable
 * without a browser environment; `main.ts` is the thin wrapper that reads
 * `window.location.search` and calls `history.replaceState`.
 *
 * Older links that predate a field keep working: missing keys fall back to
 * defaults. A payload with none of the known keys is treated as foreign.
 */

import { CHROMA_RANGE, SHADE_MODE_MAX, TRAIL_RANGE, VECTOR_SCOPE_GAIN_RANGE } from './visualFx';

export interface PersistedSettings {
  autoScalingEnabled: boolean;
  sensitivity: number;
  peakNormalize: boolean;
  attackMs: number;
  releaseMs: number;
  trail: number;
  chroma: number;
  crt: boolean;
  vectorScopeGain: number;
  autopilotEnabled: boolean;
  shadeMode: number;
}

const DEFAULT_SETTINGS: PersistedSettings = {
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

function toBase64Url(json: string): string {
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return atob(padded);
}

function finiteInRange(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function intInRange(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function coerceSettings(value: unknown): PersistedSettings | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const known = (Object.keys(DEFAULT_SETTINGS) as (keyof PersistedSettings)[]).some((key) => key in v);
  if (!known) return null;
  return {
    autoScalingEnabled: boolOr(v.autoScalingEnabled, DEFAULT_SETTINGS.autoScalingEnabled),
    sensitivity: numberOr(v.sensitivity, DEFAULT_SETTINGS.sensitivity),
    peakNormalize: boolOr(v.peakNormalize, DEFAULT_SETTINGS.peakNormalize),
    attackMs: numberOr(v.attackMs, DEFAULT_SETTINGS.attackMs),
    releaseMs: numberOr(v.releaseMs, DEFAULT_SETTINGS.releaseMs),
    trail: finiteInRange(v.trail, TRAIL_RANGE.min, TRAIL_RANGE.max, DEFAULT_SETTINGS.trail),
    chroma: finiteInRange(v.chroma, CHROMA_RANGE.min, CHROMA_RANGE.max, DEFAULT_SETTINGS.chroma),
    crt: boolOr(v.crt, DEFAULT_SETTINGS.crt),
    vectorScopeGain: finiteInRange(
      v.vectorScopeGain,
      VECTOR_SCOPE_GAIN_RANGE.min,
      VECTOR_SCOPE_GAIN_RANGE.max,
      DEFAULT_SETTINGS.vectorScopeGain,
    ),
    autopilotEnabled: boolOr(v.autopilotEnabled, DEFAULT_SETTINGS.autopilotEnabled),
    shadeMode: intInRange(v.shadeMode, 0, SHADE_MODE_MAX, DEFAULT_SETTINGS.shadeMode),
  };
}

export function encodeSettings(settings: PersistedSettings): string {
  return toBase64Url(JSON.stringify(settings));
}

/** Returns null for any corrupt/foreign/missing input, never throws. */
export function decodeSettings(encoded: string): PersistedSettings | null {
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(encoded));
    return coerceSettings(parsed);
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
