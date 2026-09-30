import type { EngineState } from '../engine/types';
import { formatHud } from './format';

export interface HudElements {
  topLeft: HTMLElement;
  topRight: HTMLElement;
  bottomLeft: HTMLElement;
  bottomRight: HTMLElement;
}

export class Hud {
  constructor(private readonly els: HudElements) {}

  update(state: EngineState, shadeMode = 0): void {
    const corners = formatHud(state, shadeMode);
    this.els.topLeft.textContent = corners.topLeft;
    this.els.topRight.textContent = corners.topRight;
    this.els.bottomLeft.textContent = corners.bottomLeft;
    this.els.bottomRight.textContent = corners.bottomRight;
  }
}
