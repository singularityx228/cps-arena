// Anti-Inspect, Anti-Source View, and DevTools Shortcut Blocker
// Protects code from right-click inspect, F12, Ctrl+U, Ctrl+Shift+I/J/C

export function initSecurityGuards() {
  if (typeof window === 'undefined') return;

  // 1. Disable Right-Click Context Menu
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });

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
