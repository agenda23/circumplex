import * as THREE from 'three';
import { Engine } from './engine/Engine';
import { UberShader } from './render/UberShader';
import { AutoScaler } from './render/AutoScaler';
import { Hud } from './hud/Hud';
import { bindKeyboard } from './input/keyboard';

const canvas = document.createElement('canvas');
document.body.prepend(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

const scene = new UberShader(renderer);
scene.resize(window.innerWidth, window.innerHeight);

const engine = new Engine();
const autoScaler = new AutoScaler();

const hudEl = document.getElementById('hud');
if (!hudEl) throw new Error('#hud element missing from index.html');
const hud = new Hud(hudEl);

bindKeyboard((envelope) => engine.dispatch(envelope));

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
  scene.render();
  hud.update(state);

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
