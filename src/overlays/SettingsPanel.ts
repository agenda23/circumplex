import type { AutoScaler } from '../render/AutoScaler';
import { ATTACK_MS_RANGE, RELEASE_MS_RANGE, SENSITIVITY_RANGE, type LevelEnvelope } from '../engine/audio/levelEnvelope';

export interface SettingsPanelOptions {
  onSelectMicDevice: (deviceId: string) => void;
  autoScaler: AutoScaler;
  levelEnvelope: LevelEnvelope;
  /** PRD §5.3: a clean/OBS session (`?ui=false`) shouldn't be interactively reconfigurable. */
  uiVisible: boolean;
  /** Called after any persisted setting changes, so the caller can sync the URL. */
  onSettingsChange?: () => void;
  /** PRD §6: mirror the canvas into a floating PiP window for OBS window capture. */
  onStartPip: () => Promise<void>;
}

const SHORTCUTS: Array<[string, string]> = [
  ['Enter', 'Start demo audio'],
  ['M', 'Start microphone input'],
  ['` / Esc', 'Open/close this settings panel'],
];

/**
 * Settings modal (PRD §5.2). Plain DOM per this project's no-framework
 * approach -- user-facing strings go through textContent, never innerHTML,
 * following ref/age-vd's overlays/dom.ts convention.
 */
export class SettingsPanel {
  private deviceSelect!: HTMLSelectElement;
  private open = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: SettingsPanelOptions,
  ) {
    this.container.textContent = '';

    const panel = document.createElement('div');
    panel.className = 'panel';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close';
    closeBtn.textContent = 'Close (Esc)';
    closeBtn.addEventListener('click', () => this.close());
    panel.appendChild(closeBtn);

    const heading = document.createElement('h2');
    heading.textContent = 'Settings';
    panel.appendChild(heading);

    panel.appendChild(this.buildAudioSection());
    panel.appendChild(this.buildAutoScalingSection());
    panel.appendChild(this.buildStreamingSection());
    panel.appendChild(this.buildShortcutsSection());

    this.container.appendChild(panel);

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.key === '`' || e.key === 'Escape') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  isOpen(): boolean {
    return this.open;
  }

  toggle(): void {
    if (!this.options.uiVisible) return;
    if (this.open) this.close();
    else this.show();
  }

  show(): void {
    this.open = true;
    this.container.classList.add('open');
    void this.refreshDevices();
  }

  close(): void {
    this.open = false;
    this.container.classList.remove('open');
  }

  private sectionHeading(text: string): HTMLHeadingElement {
    const h = document.createElement('h3');
    h.textContent = text;
    return h;
  }

  private buildAudioSection(): DocumentFragment {
    const frag = document.createDocumentFragment();
    frag.appendChild(this.sectionHeading('Audio'));

    const deviceLabel = document.createElement('label');
    deviceLabel.textContent = 'Input device';
    frag.appendChild(deviceLabel);

    this.deviceSelect = document.createElement('select');
    const useDeviceBtn = document.createElement('button');
    useDeviceBtn.textContent = 'Start with this device';
    useDeviceBtn.addEventListener('click', () => {
      const id = this.deviceSelect.value;
      if (id) {
        this.options.onSelectMicDevice(id);
        this.close();
      }
    });
    const deviceRow = document.createElement('div');
    deviceRow.className = 'row';
    deviceRow.appendChild(this.deviceSelect);
    deviceRow.appendChild(useDeviceBtn);
    frag.appendChild(deviceRow);

    const env = this.options.levelEnvelope;

    frag.appendChild(
      this.buildSlider('Sensitivity', SENSITIVITY_RANGE.min, SENSITIVITY_RANGE.max, 0.05, env.sensitivity, (v) => {
        env.sensitivity = v;
      }),
    );
    frag.appendChild(
      this.buildSlider('Attack (ms)', ATTACK_MS_RANGE.min, ATTACK_MS_RANGE.max, 1, env.attackMs, (v) => {
        env.attackMs = v;
      }),
    );
    frag.appendChild(
      this.buildSlider('Release (ms)', RELEASE_MS_RANGE.min, RELEASE_MS_RANGE.max, 1, env.releaseMs, (v) => {
        env.releaseMs = v;
      }),
    );

    const peakRow = document.createElement('div');
    peakRow.className = 'row';
    const peakCheckbox = document.createElement('input');
    peakCheckbox.type = 'checkbox';
    peakCheckbox.checked = env.peakNormalize;
    peakCheckbox.addEventListener('change', () => {
      env.peakNormalize = peakCheckbox.checked;
      this.options.onSettingsChange?.();
    });
    const peakLabel = document.createElement('label');
    peakLabel.textContent = 'Auto-normalize quiet input';
    peakRow.appendChild(peakCheckbox);
    peakRow.appendChild(peakLabel);
    frag.appendChild(peakRow);

    return frag;
  }

  private buildAutoScalingSection(): DocumentFragment {
    const frag = document.createDocumentFragment();
    frag.appendChild(this.sectionHeading('Performance'));

    const scalingRow = document.createElement('div');
    scalingRow.className = 'row';
    const autoScaleCheckbox = document.createElement('input');
    autoScaleCheckbox.type = 'checkbox';
    autoScaleCheckbox.checked = this.options.autoScaler.enabled;
    autoScaleCheckbox.addEventListener('change', () => {
      this.options.autoScaler.enabled = autoScaleCheckbox.checked;
      this.options.onSettingsChange?.();
    });
    const scalingLabel = document.createElement('label');
    scalingLabel.textContent = 'Auto-scaling enabled';
    scalingRow.appendChild(autoScaleCheckbox);
    scalingRow.appendChild(scalingLabel);
    frag.appendChild(scalingRow);

    return frag;
  }

  private buildStreamingSection(): DocumentFragment {
    const frag = document.createDocumentFragment();
    frag.appendChild(this.sectionHeading('Streaming'));

    const pipRow = document.createElement('div');
    pipRow.className = 'row';
    const pipBtn = document.createElement('button');
    pipBtn.textContent = 'Start PiP capture (for OBS)';
    pipBtn.addEventListener('click', () => {
      this.options.onStartPip().catch((err: unknown) => {
        console.error('[Circumplex] PiP capture failed:', err);
      });
    });
    pipRow.appendChild(pipBtn);
    frag.appendChild(pipRow);

    return frag;
  }

  private buildShortcutsSection(): DocumentFragment {
    const frag = document.createDocumentFragment();
    frag.appendChild(this.sectionHeading('Shortcuts'));

    const list = document.createElement('div');
    list.className = 'shortcuts';
    for (const [keys, label] of SHORTCUTS) {
      const row = document.createElement('div');
      row.className = 'shortcut-row';
      const keyEl = document.createElement('span');
      keyEl.className = 'shortcut-key';
      keyEl.textContent = keys;
      const labelEl = document.createElement('span');
      labelEl.textContent = label;
      row.appendChild(keyEl);
      row.appendChild(labelEl);
      list.appendChild(row);
    }
    frag.appendChild(list);

    return frag;
  }

  private buildSlider(
    label: string,
    min: number,
    max: number,
    step: number,
    initial: number,
    onChange: (value: number) => void,
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'row slider-row';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(initial);

    const readout = document.createElement('span');
    readout.className = 'readout';
    readout.textContent = initial.toFixed(step < 1 ? 2 : 0);

    input.addEventListener('input', () => {
      const value = Number(input.value);
      readout.textContent = value.toFixed(step < 1 ? 2 : 0);
      onChange(value);
    });
    input.addEventListener('change', () => {
      this.options.onSettingsChange?.();
    });

    row.appendChild(labelEl);
    row.appendChild(input);
    row.appendChild(readout);
    return row;
  }

  private async refreshDevices(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.deviceSelect.textContent = '';
      for (const device of devices.filter((d) => d.kind === 'audioinput')) {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Input ${device.deviceId.slice(0, 6)}`;
        this.deviceSelect.appendChild(option);
      }
    } catch {
      // Permissions not granted yet, or enumeration unsupported -- list
      // just stays empty; not fatal.
    }
  }
}
