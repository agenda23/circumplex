# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository. It mirrors `CLAUDE.md` — keep the two in sync when either changes.

## Commands

```bash
npm install
npm run dev        # dev server
npm run build      # tsc --noEmit + vite build
npm run typecheck  # tsc --noEmit only
npm test           # vitest run (test/**/*.test.ts)
npm run preview    # preview a production build
```

Single test file: `npx vitest run test/foo.test.ts`; single test case: add `-t "name"`.

## Progress tracking

`docs/PROGRESS.md` tracks the milestone breakdown of the PRD and what's done vs. not started. **Check it before starting new work** (to see what's already built and what a milestone depends on) **and update it after committing a milestone** (status, commit hash, completion date). Plan each milestone (design, tradeoffs, file list) before implementing it — this repo's non-trivial decisions (React/R3F rejection, the Web Worker feature pipeline, the Valence/Arousal heuristic) were all worked out that way, and the rationale is often more useful later than the code alone.

## Stack

TypeScript + Three.js + Vite, no framework. React and React Three Fiber were deliberately rejected: the rendering core is a single Uber Shader driven by a manual render loop with per-frame FPS-based auto-scaling, which gets no benefit from a declarative component tree and risks fighting a reconciler's re-renders. See `docs/circumplex_prd.md` §1.3 for the rationale. Follow the "Reference project" section below for how to structure UI/engine separation without a framework (command bus, plain-DOM overlays, HUD as pure string-formatting functions).

## Product architecture (from the PRD)

Circumplex is a WebGL audio visualizer / VJ app intended for long-running (1hr+) live performance use, driven directly by raw analog L/R audio rather than beat-triggered effects. Key architectural pillars to keep in mind when implementing:

**Audio pipeline (Web Audio API)**
- Raw audio comes from `getUserMedia` with `echoCancellation`/`noiseSuppression`/`autoGainControl` explicitly disabled and `channelCount: 2`, to avoid the browser mangling the signal.
- A single input stream is split via `BiquadFilterNode` into three pseudo-stem bands, each routed to its own `AnalyserNode`: Low (~150Hz, sub/kick → global hue shifts, camera shake), Mid (300Hz–3kHz, lead/vocal → shape morphing), High (4kHz+, hats/noise → edge glow, particles/glitch).
- Heavier feature extraction (spectral centroid, chromagram, spectral flux, RMS, spectral flatness) must run off the main thread (`AudioWorklet`/`Web Worker`) to protect frame rate.
- These features feed a Valence/Arousal estimate (Russell's Circumplex Model — the project's namesake), smoothed with a 3–5s moving average/exponential smoothing so the visuals transition on musical-phrase timescales rather than per-frame.

**Rendering (Three.js / WebGL)**
- Per-frame band data is uploaded as a 1D `THREE.DataTexture` to the GPU.
- All effects live in one "Uber Shader"; JS drives crossfades between effects via `uniform` float weights (0.0–1.0) rather than swapping materials/programs.
- Prefer thick SDF/Raymarched forms and filled geometry over thin wireframes — at low render resolution, lean into Bloom and intentional pixelation as an art style rather than fighting the artifacts.
- Color is computed in HSL/Oklch inside the shader (never raw RGB manipulation): Hue from mid-band dominant pitch + Circumplex polar angle, Saturation from harmonic complexity + Circumplex radius, Lightness from RMS.
- A very-low-frequency LFO (~0.01Hz) continuously drifts color phase/noise seeds over tens of minutes so identical input doesn't produce visually repetitive output during long sets.

**Auto-scaling / reliability**
- Monitor a rolling ~120-frame FPS average; if it drops below a threshold (e.g. 50fps), reduce `renderer.setPixelRatio` (down to ~0.5) before disabling expensive shader features (fractal iteration counts, high-quality AA). Restore quality when stable.
- Hold `navigator.wakeLock` during operation and re-acquire it on `visibilitychange`, since sets can run 1hr+.

**UI**
- Visuals are the priority; UI is minimal-footprint by design. Two surfaces: a non-interactive (`pointer-events: none`) monospace HUD/log overlay (FPS, scaling factor, RMS, system messages) for a cyberpunk terminal aesthetic, and a settings modal triggered by a hidden gesture (backtick/Esc on desktop, two-finger double-tap on iOS) for device selection, manual overrides of the auto-scaling/color system, and PWA/cache controls.
- Full UI parameter state syncs to a URL query param (Base64-encoded) for shareable links; `?ui=false` gives a clean/OBS-safe mode with the UI hidden.

**Streaming/OBS integration**
- Two supported capture paths: loading a `?ui=false` URL directly as an OBS Browser Source, or using `canvas.captureStream(60)` piped into a hidden `<video>` + the Picture-in-Picture API so OBS can do lightweight window capture instead of full browser-source rendering.

**Target platforms:** Chrome desktop (primary) and iPadOS Safari (live/generator use); deploy as a static PWA (e.g. Cloudflare Pages).

## Reference project

`ref/age-vd` is a previously-built app cloned locally purely for reference; it is git-ignored and not part of this project's history or build. Its rendering/visual code is unrelated to this project. What *is* worth reusing as a reference: its **UI and interaction patterns** — see `src/input/` (keyboard/gesture/MIDI/touch mapping), `src/hud/` (HUD/log overlay), and `src/overlays/` (settings modal/DOM overlay wiring) — since this project wants similar UI/operation conventions. Its actual settings/config *content* is unrelated to this project's needs and can be ignored.
