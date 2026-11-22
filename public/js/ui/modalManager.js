/**
 * Centralized Modal Stack, Capture-Phase Escape Dismissal & Focus Restoration (v144).
 *
 * Guarantees innermost child modals (e.g. Gear Workshop over Dive Setup,
 * Collector Card over Logbook) always close before their parent overlays, even when
 * an input/select/textarea inside the modal currently holds keyboard focus.
 */

export function createModalManager(entries = [], { doc = typeof document !== 'undefined' ? document : null, win = typeof window !== 'undefined' ? window : null } = {}) {
  let lastTriggerEl = null;

  const onPointerDown = (e) => {
    const btn = e?.target?.closest?.('button, [role="button"]');
    if (btn && !btn.closest?.('.lb-stats-modal')) {
      lastTriggerEl = btn;
    }
  };

  function getOpenCount() {
    let count = 0;
    for (let i = 0; i < entries.length; i++) {
      try {
        if (entries[i].isOpen()) count++;
      } catch {}
    }
    return count;
  }

  function closeTopmost() {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      try {
        if (entry.isOpen()) {
          entry.close();
          if (getOpenCount() === 0 && lastTriggerEl?.focus && !lastTriggerEl.hidden) {
            try {
              lastTriggerEl.focus({ preventScroll: true });
            } catch {}
          }
          return true;
        }
      } catch {}
    }
    return false;
  }

  const onKeyDown = (e) => {
    if (e?.key !== 'Escape') return;
    if (closeTopmost()) {
      e.preventDefault?.();
      e.stopImmediatePropagation?.();
      e.stopPropagation?.();
    }
  };

  if (doc?.addEventListener) {
    doc.addEventListener('pointerdown', onPointerDown, { passive: true });
  }
  if (win?.addEventListener) {
    win.addEventListener('keydown', onKeyDown, true);
  }

  function destroy() {
    if (doc?.removeEventListener) {
      doc.removeEventListener('pointerdown', onPointerDown);
    }
    if (win?.removeEventListener) {
      win.removeEventListener('keydown', onKeyDown, true);
    }
  }

  return {
    closeTopmost,
    getOpenCount,
    destroy,
  };
}
