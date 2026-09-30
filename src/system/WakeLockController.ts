/**
 * PRD §4.3: prevent the device from sleeping during a long (1hr+) set.
 * Feature-detected and re-acquired on visibility change, per the spec's
 * common failure mode (the lock is released automatically when the tab
 * goes to the background, and must be re-requested when it returns).
 */
export class WakeLockController {
  private sentinel: WakeLockSentinel | null = null;

  constructor() {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /** Must be called from within a user-gesture event handler (e.g. keydown). */
  async acquire(): Promise<void> {
    if (!('wakeLock' in navigator)) return;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });
    } catch {
      // Not fatal: e.g. no user gesture yet, or the platform doesn't allow it
      // right now. The visibilitychange handler and the next acquire() call
      // will retry.
    }
  }

  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible' && this.sentinel === null) {
      void this.acquire();
    }
  };
}
