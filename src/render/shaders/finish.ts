/**
 * Final sampling pass: intentional pixelation (PRD §3.2, driven by the
 * auto-scaling level) plus an optional CRT scanline/vignette. No full-frame
 * flashes — brightness only dips slightly toward the edges and between lines.
 */
export const FINISH_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: null },
    uPixel: { value: 0 },
    uCrt: { value: 0 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uPixel;
    uniform float uCrt;
    uniform float uTime;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      if (uPixel > 0.5) {
        vec2 g = max(uRes / uPixel, vec2(1.0));
        uv = (floor(uv * g) + 0.5) / g;
      }
      vec3 col = texture2D(tDiffuse, uv).rgb;
      if (uCrt > 0.001) {
        float scan = 0.5 + 0.5 * sin(vUv.y * uRes.y * 3.14159265);
        col *= 1.0 - 0.22 * scan;
        vec2 c = vUv - 0.5;
        col *= 1.0 - 0.55 * smoothstep(0.35, 1.05, length(c));
        col += (hash(vUv * uRes + fract(uTime * 12.0)) - 0.5) * 0.04;
      }
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
