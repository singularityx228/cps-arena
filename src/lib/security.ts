// Advanced Multi-Layer System Protection & Hardware Calibrator
// Integrates shortcut blocking, context protection, and cryptographic domain integrity validation

const _0x1a = [104, 116, 116, 112, 115, 58, 47, 47, 115, 105, 110, 103, 117, 108, 97, 114, 105, 116, 121, 120, 50, 50, 56, 46, 103, 105, 116, 104, 117, 98, 46, 105, 111, 47, 99, 112, 115, 45, 97, 114, 101, 110, 97, 47];
const _0x2b = [115, 105, 110, 103, 117, 108, 97, 114, 105, 116, 121, 120, 50, 50, 56, 46, 103, 105, 116, 104, 117, 98, 46, 105, 111];

function _decode(arr: number[]): string {
  return String.fromCharCode(...arr);
}

function verifyRuntimeIntegrity() {
  if (typeof window === 'undefined' || !window.location) return;
  const host = window.location.hostname.toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host === '';
  const isAllowed = isLocal || host === _decode(_0x2b) || host.endsWith('.' + _decode(_0x2b));

  if (!isAllowed) {
    try {
      const target = _decode(_0x1a);
      if (window.top && window.top.location) {
        window.top.location.replace(target);
      } else {
        window.location.replace(target);
      }
      document.documentElement.innerHTML = '';
    } catch {
      window.location.href = _decode(_0x1a);
    }
  }
}

export function initSecurityGuards() {
  if (typeof window === 'undefined') return;

  // Immediate and periodic integrity validation
  verifyRuntimeIntegrity();
  setInterval(verifyRuntimeIntegrity, 3000);

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

    // F12
    if (key === 'F12') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+U (View Source)
    if (isCtrlOrCmd && (key === 'u' || key === 'U')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+S (Save page)
    if (isCtrlOrCmd && (key === 's' || key === 'S')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+I (DevTools Inspector)
    if (isCtrlOrCmd && isShift && (key === 'I' || key === 'i')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+J (DevTools Console)
    if (isCtrlOrCmd && isShift && (key === 'J' || key === 'j')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+C (Element Picker)
    if (isCtrlOrCmd && isShift && (key === 'C' || key === 'c')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+K (Firefox Console)
    if (isCtrlOrCmd && isShift && (key === 'K' || key === 'k')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, true);

  // 3. Prevent Drag and Select
  document.addEventListener('dragstart', (e) => e.preventDefault());
}
