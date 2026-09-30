import type { EngineState } from '../engine/types';
import { formatHud } from './format';

export class Hud {
  constructor(private readonly el: HTMLElement) {}

  update(state: EngineState): void {
    this.el.textContent = formatHud(state);
  }
}
