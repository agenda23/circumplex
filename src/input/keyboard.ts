import type { Envelope } from '../engine/types';

export function bindKeyboard(dispatch: (envelope: Envelope) => void, isBlocked: () => boolean = () => false): void {
  window.addEventListener('keydown', (e) => {
    if (e.repeat || isBlocked()) return;

    if (e.key === 'Enter') {
      dispatch({ t: performance.now(), source: 'keyboard', cmd: { type: 'session.start', input: 'demo' } });
    } else if (e.key.toLowerCase() === 'm') {
      dispatch({ t: performance.now(), source: 'keyboard', cmd: { type: 'session.start', input: 'mic' } });
    }
  });
}
