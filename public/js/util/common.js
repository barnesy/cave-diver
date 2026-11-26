/**
 * Shared pure utility helpers across Techno Dive simulation, UI, and rendering (v171).
 */

/** Clamp `v` into `[lo, hi]` (canonical value-first argument order). */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Normalize an angle in radians into `(-PI, PI]`. */
export function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Format elapsed seconds as `MM:SS`. */
export function formatClock(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

/** Fast deterministic FNV-1a 32-bit string hash. */
export function hashStr(str) {
  let h = 2166136261 >>> 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Draw a filled rounded rectangle with fallback when `ctx.roundRect` is unavailable. */
export function fillRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

/** Draw a stroked rounded rectangle with fallback when `ctx.roundRect` is unavailable. */
export function strokeRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.stroke();
}

/** Escape special HTML characters for safe innerHTML interpolation. */
export function escapeHtml(raw) {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Polyfill CanvasRenderingContext2D.prototype.roundRect for older Safari / iOS WebViews (v223)
if (typeof CanvasRenderingContext2D !== 'undefined' && typeof CanvasRenderingContext2D.prototype.roundRect !== 'function') {
  CanvasRenderingContext2D.prototype.roundRect = function roundRectPolyfill(x, y, w, h) {
    return this.rect(x, y, w, h);
  };
}
