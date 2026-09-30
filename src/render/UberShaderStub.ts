import * as THREE from 'three';
import type { BandLevels } from '../engine/types';

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Placeholder only: proves audio levels reach the GPU each frame. The real
// Uber Shader (SDF/raymarching, HSL/Oklch mapping, LFO drift) is a later
// milestone — see docs/circumplex_prd.md §3.
const FRAGMENT_SHADER = /* glsl */ `
  varying vec2 vUv;
  uniform float uLow;
  uniform float uMid;
  uniform float uHigh;
  uniform float uTime;

  void main() {
    vec2 p = vUv - 0.5;
    float radius = 0.2 + uLow * 0.3;
    float ring = smoothstep(radius, radius - 0.02 - uMid * 0.05, length(p))
      - smoothstep(radius + 0.02 + uHigh * 0.1, radius, length(p));
    vec3 color = vec3(0.2 + uLow, 0.2 + uMid, 0.2 + uHigh) * (0.3 + ring);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export class UberShaderStub {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: THREE.ShaderMaterial;
  private readonly startTime = performance.now();

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uLow: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uTime: { value: 0 },
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.scene.add(quad);
  }

  setLevels(levels: BandLevels): void {
    this.material.uniforms.uLow!.value = levels.low;
    this.material.uniforms.uMid!.value = levels.mid;
    this.material.uniforms.uHigh!.value = levels.high;
    this.material.uniforms.uTime!.value = (performance.now() - this.startTime) / 1000;
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera);
  }
}
