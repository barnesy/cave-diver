/**
 * Mobile Tactile Haptics & Twin-Stick Directional Aim-Arc Feedback (v206).
 *
 * - `triggerHaptic(kind)`: Safe, rate-limited `navigator.vibrate` wrapper for touch
 *   devices (silently no-ops on desktop / unsupported browsers).
 * - `updateStickAimArc(el, angleRad, mag)` / `clearStickAimArc(el)`: Drives the CSS
 *   directional conic-arc glow around `#touch-stick` and `#torch-stick` while dragging.
 */

export const HAPTIC_PATTERNS = Object.freeze({
  tap: 10,
  gasSwitch: [14, 24, 18],
  sonar: [16, 40, 26],
  dash: [22, 18, 34],
  pickup: [12, 22, 24],
  hitstop: [30, 18, 42],
  warning: [28, 42, 28],
  extract: [18, 30, 24, 30, 48],
  bossDefeat: [40, 40, 60, 40, 90],
});

const HAPTIC_PREF_KEY = 'caveDiverHapticsOff_v1';
let _lastHapticMs = 0;

export function isHapticsEnabled() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(HAPTIC_PREF_KEY) === '1') {
      return false;
    }
  } catch {}
  return true;
}

/**
 * Trigger a crisp tactile mobile vibration pattern when supported.
 * Returns true if `navigator.vibrate` was invoked, false otherwise.
 */
export function triggerHaptic(kind = 'tap', { minIntervalMs = 45, nowMs } = {}) {
  if (!isHapticsEnabled()) return false;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
  const now = typeof nowMs === 'number' ? nowMs : (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (now - _lastHapticMs < minIntervalMs) return false;
  const pattern = HAPTIC_PATTERNS[kind] ?? HAPTIC_PATTERNS.tap;
  try {
    _lastHapticMs = now;
    return Boolean(navigator.vibrate(pattern));
  } catch {
    return false;
  }
}

/**
 * Update the directional aim-arc indicator on a touch joystick ring.
 * @param {HTMLElement|null} stickEl
 * @param {number} angleRad - atan2(dy, dx) in radians
 * @param {number} mag - normalized magnitude [0..1]
 */
export function updateStickAimArc(stickEl, angleRad, mag = 0) {
  if (!stickEl?.style) return;
  const clampedMag = Math.max(0, Math.min(1, Number(mag) || 0));
  if (clampedMag <= 0.08 || !Number.isFinite(angleRad)) {
    clearStickAimArc(stickEl);
    return;
  }
  // CSS conic-gradient 0deg starts at 12 o'clock; atan2 0rad starts at 3 o'clock (+90deg offset)
  const deg = Math.round(((angleRad * 180) / Math.PI + 90 + 360) % 360);
  stickEl.style.setProperty('--stick-angle', `${deg}deg`);
  stickEl.style.setProperty('--stick-arc-alpha', (0.35 + clampedMag * 0.65).toFixed(2));
  stickEl.classList?.add('has-arc');
}

/**
 * Clear directional aim-arc indicator on stick release.
 */
export function clearStickAimArc(stickEl) {
  if (!stickEl?.style) return;
  stickEl.classList?.remove('has-arc');
  stickEl.style.setProperty('--stick-arc-alpha', '0');
}
