// Anti-Inspect, Anti-Source View, and Anti-Theft Domain Lock Guard

const OFFICIAL_URL = 'https://singularityx228.github.io/cps-arena/';
const OFFICIAL_HOST = 'singularityx228.github.io';

function verifyDomain() {
  if (typeof window === 'undefined' || !window.location) return;
  try {
    const host = window.location.hostname.toLowerCase();
    
    // Allowed local development and official production domains
    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host.startsWith('172.') ||
      host === '';

    const isOfficial = host === OFFICIAL_HOST || host.endsWith('.' + OFFICIAL_HOST);

    // If running on an unauthorized stolen/cloned domain
    if (!isLocal && !isOfficial) {
      if (window.top && window.top.location) {
        window.top.location.replace(OFFICIAL_URL);
      } else {
        window.location.replace(OFFICIAL_URL);
      }
    }
  } catch {
    // ignore
  }
}

export function initSecurityGuards() {
  if (typeof window === 'undefined') return;

  // Domain verification
  verifyDomain();

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

  // 3. Prevent Drag and Select of sensitive code elements
  document.addEventListener('dragstart', (e) => e.preventDefault());
}
