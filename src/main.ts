import * as THREE from 'three';
import { Engine } from './engine/Engine';
import { UberShader } from './render/UberShader';
import { AutoScaler } from './render/AutoScaler';
import { Hud } from './hud/Hud';
import { bindKeyboard } from './input/keyboard';
import { WakeLockController } from './system/WakeLockController';
import { SettingsPanel } from './overlays/SettingsPanel';
import { buildSearchWithSettings, isUiVisible, parseSettingsFromSearch } from './state/urlState';
import { createPipVideo, requestPip } from './system/pipCapture';

function requireEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} element missing from index.html`);
  return el;
}

const canvas = document.createElement('canvas');
document.body.prepend(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

const scene = new UberShader(renderer);
scene.resize(window.innerWidth, window.innerHeight);

const engine = new Engine();
const autoScaler = new AutoScaler();

// PRD §6: prepared eagerly (muted autoplay needs no gesture) so its
// metadata is long loaded by the time the settings panel's PiP button is
// clicked -- see system/pipCapture.ts for why this can't happen lazily.
const pipVideo = createPipVideo(canvas);

// PRD §5.3: shareable state + ?ui=false clean/OBS mode.
const uiVisible = isUiVisible(window.location.search);
const persisted = parseSettingsFromSearch(window.location.search);
autoScaler.enabled = persisted.autoScalingEnabled;
engine.levelEnvelope.sensitivity = persisted.sensitivity;
engine.levelEnvelope.peakNormalize = persisted.peakNormalize;
engine.levelEnvelope.attackMs = persisted.attackMs;
engine.levelEnvelope.releaseMs = persisted.releaseMs;
if (!uiVisible) document.body.classList.add('ui-hidden');

const hud = new Hud({
  topLeft: requireEl('hud-top-left'),
  topRight: requireEl('hud-top-right'),
  bottomLeft: requireEl('hud-bottom-left'),
  bottomRight: requireEl('hud-bottom-right'),
});

const settings = new SettingsPanel(requireEl('settings'), {
  autoScaler,
  levelEnvelope: engine.levelEnvelope,
  uiVisible,
  onSelectMicDevice: (deviceId) => {
    engine.dispatch({ t: performance.now(), source: 'keyboard', cmd: { type: 'session.start', input: 'mic', deviceId } });
    void wakeLock.acquire();
  },
  onSettingsChange: () => {
    const newSearch = buildSearchWithSettings(window.location.search, {
      autoScalingEnabled: autoScaler.enabled,
      sensitivity: engine.levelEnvelope.sensitivity,
      peakNormalize: engine.levelEnvelope.peakNormalize,
      attackMs: engine.levelEnvelope.attackMs,
      releaseMs: engine.levelEnvelope.releaseMs,
    });
    history.replaceState(null, '', `${window.location.pathname}?${newSearch}${window.location.hash}`);
  },
  onStartPip: () => requestPip(pipVideo),
});

const wakeLock = new WakeLockController();
bindKeyboard(
  (envelope) => {
    engine.dispatch(envelope);
    // Enter/M are the only keys bindKeyboard handles, and both mean "start
    // playing" -- request from here so we're still inside the synchronous
    // user-gesture call stack the Wake Lock API requires.
    void wakeLock.acquire();
  },
  () => settings.isOpen(),
);

window.addEventListener('resize', () => {
  scene.resize(window.innerWidth, window.innerHeight);
});

let lastTime = performance.now();
let fps = 0;
let appliedScalingLevel = -1;

function tick(now: number): void {
  const dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0) fps = fps === 0 ? 1 / dt : fps + (1 / dt - fps) * 0.1;

  const level = autoScaler.update(fps, dt);
  if (level !== appliedScalingLevel) {
    appliedScalingLevel = level;
    const { pixelRatio } = scene.setQuality(level);
    engine.dispatch({ t: now, source: 'system', cmd: { type: 'scaling.update', scaling: { level, pixelRatio } } });
  }

  engine.tick(fps);
  const state = engine.getState();
  scene.setAudio(state);
  const vector = engine.getVectorSamples();
  if (vector) scene.setVectorScope(vector.left, vector.right);
  scene.render();
  hud.update(state);

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
