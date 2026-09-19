// Comprehensive Anti-Inspect, Anti-Source View, Anti-DevTools & Anti-Theft Guard

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
  setInterval(enforceRuntimeValidation, 2000);

  // 1. Block ALL Right-Click Context Menus Everywhere
  const blockContext = (e: MouseEvent | Event) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };
  window.addEventListener('contextmenu', blockContext, true);
  document.addEventListener('contextmenu', blockContext, true);

  // 2. Block ALL DevTools & Source-Viewing Keyboard Shortcuts
  const blockKeys = (e: KeyboardEvent) => {
    const key = e.key ? e.key.toLowerCase() : '';
    const code = e.code || '';
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const isAlt = e.altKey;

    // F12 or F12 keycode (123)
    if (key === 'f12' || code === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+U / Cmd+U (View Source)
    if (isCtrlOrCmd && key === 'u') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+S / Cmd+S (Save Page)
    if (isCtrlOrCmd && key === 's') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+I / Cmd+Option+I (DevTools Inspector)
    if ((isCtrlOrCmd && isShift && key === 'i') || (isCtrlOrCmd && isAlt && key === 'i')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+J / Cmd+Option+J (DevTools Console)
    if ((isCtrlOrCmd && isShift && key === 'j') || (isCtrlOrCmd && isAlt && key === 'j')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+C / Cmd+Shift+C (Element Picker)
    if (isCtrlOrCmd && isShift && key === 'c') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+K (Firefox Console)
    if (isCtrlOrCmd && isShift && key === 'k') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+E (Network tab)
    if (isCtrlOrCmd && isShift && key === 'e') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+P (Print to PDF/Source)
    if (isCtrlOrCmd && key === 'p') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  };

  window.addEventListener('keydown', blockKeys, true);
  document.addEventListener('keydown', blockKeys, true);

  // 3. Block Dragging & Text Selection on UI
  document.addEventListener('dragstart', (e) => e.preventDefault(), true);

  // 4. Anti-Debugging / Console Protection Loop
  try {
    setInterval(() => {
      // Clear console continuously in production
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        console.clear();
      }
    }, 1500);
  } catch {
    // ignore
  }
}
