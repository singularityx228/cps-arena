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

  // 4. Instant DevTools Detection & DOM Wipe Engine
  const isDev =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.');

  if (!isDev) {
    let isNuked = false;
    const nukePageContent = () => {
      if (isNuked) return;
      isNuked = true;

      try {
        console.clear();
      } catch {}

      // If domain is unauthorized, redirect instantly
      const isAuth = enforceRuntimeValidation();
      if (!isAuth) return;

      try {
        if (window.stop) window.stop();
      } catch {}

      try {
        document.documentElement.innerHTML = `
          <head>
            <meta charset="UTF-8">
            <title>Erişim Engellendi</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="background:#0a0d18;color:#ef4444;height:100vh;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:20px;box-sizing:border-box;">
            <div style="max-width:480px;width:100%;background:#111426;padding:32px 24px;border-radius:24px;border:1px solid rgba(239,68,68,0.4);box-shadow:0 0 50px rgba(239,68,68,0.25);">
              <div style="font-size:52px;margin-bottom:16px;">🔒</div>
              <h1 style="font-size:22px;color:#ffffff;margin:0 0 10px 0;font-weight:900;letter-spacing:-0.5px;">GÜVENLİK KORUMASI AKTİF</h1>
              <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0 0 24px 0;">Geliştirici araçları veya kaynak inceleme açıkken site içeriği ve kodlar gizlenir.</p>
              <button onclick="window.location.reload()" style="padding:12px 28px;background:linear-gradient(135deg,#7c3aed,#db2777);color:#ffffff;border:none;border-radius:14px;font-weight:800;cursor:pointer;font-size:14px;box-shadow:0 0 20px rgba(124,58,237,0.4);transition:transform 0.15s;">Geliştirici Aracını Kapat & Yenile</button>
            </div>
          </body>`;
      } catch {}
    };

    // Trap 1: Window Dimensions (Fires instantly on DevTools dock/undock)
    const checkDimensions = () => {
      const wDiff = window.outerWidth - window.innerWidth;
      const hDiff = window.outerHeight - window.innerHeight;
      if (wDiff > 160 || hDiff > 160) {
        nukePageContent();
      }
    };
    window.addEventListener('resize', checkDimensions, { passive: true });
    setInterval(checkDimensions, 300);

    // Trap 2: Console Getter Trap (Fires the microsecond DevTools console is active)
    try {
      const el = document.createElement('div');
      Object.defineProperty(el, 'id', {
        get: () => {
          nukePageContent();
          return '';
        },
      });
      setInterval(() => {
        console.log('%c', el);
        console.clear();
      }, 500);
    } catch {}

    // Trap 3: Focus / Blur Re-evaluation
    window.addEventListener('focus', checkDimensions, { passive: true });
  }
}

