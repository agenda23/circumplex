import type { AutoScaler } from '../render/AutoScaler';

export interface SettingsPanelOptions {
  onSelectMicDevice: (deviceId: string) => void;
  autoScaler: AutoScaler;
  /** PRD §5.3: a clean/OBS session (`?ui=false`) shouldn't be interactively reconfigurable. */
  uiVisible: boolean;
  /** Called after any persisted setting changes, so the caller can sync the URL. */
  onSettingsChange?: () => void;
}

/**
 * Settings modal (PRD §5.2), first pass: audio device selection and the
 * auto-scaling override. Plain DOM per this project's no-framework
 * approach -- user-facing strings go through textContent, never innerHTML,
 * following ref/age-vd's overlays/dom.ts convention.
 */
export class SettingsPanel {
  private readonly deviceSelect: HTMLSelectElement;
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

    const deviceLabel = document.createElement('label');
    deviceLabel.textContent = 'Audio input device';
    panel.appendChild(deviceLabel);

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
    panel.appendChild(deviceRow);

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
    panel.appendChild(scalingRow);

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
