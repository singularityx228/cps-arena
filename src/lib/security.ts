// Core System Architecture & Runtime Cryptographic Engine

const _k0 = [50,46,46,42,41,96,117,117,41,51,52,61,47,54,59,40,51,46,35,34,104,104,98,116,61,51,46,50,47,56,116,51,53,117,57,42,41,119,59,40,63,52,59,117];
const _k1 = [41,51,52,61,47,54,59,40,51,46,35,34,104,104,98,116,61,51,46,50,47,56,116,51,53];

export function _vx(k: number[]): string {
  return k.map((c) => String.fromCharCode(c ^ 0x5a)).join('');
}

export function enforceRuntimeValidation(): boolean {
  if (typeof window === 'undefined' || !window.location) return true;
  try {
    const h = (window.location.hostname || '').toLowerCase();
    const p = window.location.protocol;
    const port = window.location.port;

    const authHost = _vx(_k1);
    const isAuthDomain = h === authHost || h.endsWith('.' + authHost);
    const isLocalDev =
      (p === 'http:' || p === 'https:') &&
      (h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.')) &&
      (port === '5173' || port === '4173' || port === '3000');

    if (!isAuthDomain && !isLocalDev) {
      const dest = _vx(_k0);
      if (window.top && window.top.location) {
        window.top.location.href = dest;
      } else {
        window.location.href = dest;
      }
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

export function initSecurityGuards() {
  if (typeof window === 'undefined') return;

  // Immediate runtime enforcement
  enforceRuntimeValidation();
  setInterval(enforceRuntimeValidation, 2500);

  // 1. Disable Right-Click Context Menu
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  }, true);

  // 2. Disable DevTools and Source-Viewing Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    const key = e.key;
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    if (
      key === 'F12' ||
      (isCtrlOrCmd && (key === 'u' || key === 'U' || key === 's' || key === 'S')) ||
      (isCtrlOrCmd && isShift && (key === 'I' || key === 'i' || key === 'J' || key === 'j' || key === 'C' || key === 'c' || key === 'K' || key === 'k'))
    ) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, true);

  // 3. Prevent Drag and Select
  document.addEventListener('dragstart', (e) => e.preventDefault());
}
