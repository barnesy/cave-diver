/**
 * Adaptive 60 FPS Performance Monitor & Mobile Quality Governor (v144).
 *
 * Tracks rolling EMA frame times with zero per-frame allocations and smoothly steps
 * between 3 rendering quality tiers (`high` -> `balanced` -> `performance`) with
 * hysteresis so low-end mobile GPUs and 4-diver Hardcore silt-outs stay fluid
 * without quality oscillation.
 */

export const PERF_TIERS = Object.freeze({
  high: Object.freeze({
    tier: 'high',
    rayScale: 1.0,
    peerRayMax: 22,
    siltTendrilLimit: 24,
    siltSkipSmallBelow: 0,
    lightmapScale: 0.35,
    dprCap: 2.0,
    bioStride: 1,
    bossParticleScale: 1.0,
    volumetricBeams: true,
  }),
  balanced: Object.freeze({
    tier: 'balanced',
    rayScale: 0.78,
    peerRayMax: 16,
    siltTendrilLimit: 12,
    siltSkipSmallBelow: 0.14,
    lightmapScale: 0.31,
    dprCap: 1.5,
    bioStride: 2,
    bossParticleScale: 0.72,
    volumetricBeams: true,
  }),
  performance: Object.freeze({
    tier: 'performance',
    rayScale: 0.58,
    peerRayMax: 12,
    siltTendrilLimit: 0,
    siltSkipSmallBelow: 0.24,
    lightmapScale: 0.26,
    dprCap: 1.25,
    bioStride: 3,
    bossParticleScale: 0.48,
    volumetricBeams: false,
  }),
});

const TIER_ORDER = ['high', 'balanced', 'performance'];

/**
 * Create a stateful zero-GC performance monitor & adaptive quality governor.
 */
export function createPerfMonitor({ isMobile = false, initialTier = 'high' } = {}) {
  let tierIndex = Math.max(0, TIER_ORDER.indexOf(initialTier));
  let emaMs = 16.67;
  let slowStreak = 0;
  let fastStreak = 0;
  let sampleCount = 0;
  let transitions = 0;

  // Thresholds tuned with generous hysteresis to prevent tier flapping
  const downgradeToBalancedMs = isMobile ? 21.5 : 23.0;
  const downgradeToPerfMs = isMobile ? 28.5 : 31.0;
  const upgradeFromPerfMs = 20.5;
  const upgradeFromBalancedMs = 17.5;
  const downgradeFramesReq = 36; // ~0.6s sustained slowdown
  const upgradeFramesReq = 140;  // ~2.3s sustained smooth headroom

  const mobileHighBudget = Object.freeze({
    ...PERF_TIERS.high,
    dprCap: 1.75,
    peerRayMax: 18,
  });

  function getBudget() {
    const name = TIER_ORDER[tierIndex];
    if (isMobile && name === 'high') return mobileHighBudget;
    return PERF_TIERS[name];
  }

  function recordFrame(frameDeltaMs) {
    if (!Number.isFinite(frameDeltaMs) || frameDeltaMs <= 0 || frameDeltaMs > 250) {
      return false; // Ignore tab-switch / debugger pauses
    }
    sampleCount++;
    const alpha = sampleCount < 12 ? 0.25 : 0.08;
    emaMs += (frameDeltaMs - emaMs) * alpha;

    let changed = false;
    if (tierIndex === 0) {
      if (emaMs >= downgradeToBalancedMs) {
        slowStreak++;
        fastStreak = 0;
        if (slowStreak >= downgradeFramesReq) {
          tierIndex = 1;
          slowStreak = 0;
          transitions++;
          changed = true;
        }
      } else {
        slowStreak = Math.max(0, slowStreak - 2);
      }
    } else if (tierIndex === 1) {
      if (emaMs >= downgradeToPerfMs) {
        slowStreak++;
        fastStreak = 0;
        if (slowStreak >= downgradeFramesReq) {
          tierIndex = 2;
          slowStreak = 0;
          transitions++;
          changed = true;
        }
      } else if (emaMs <= upgradeFromBalancedMs) {
        fastStreak++;
        slowStreak = 0;
        if (fastStreak >= upgradeFramesReq) {
          tierIndex = 0;
          fastStreak = 0;
          transitions++;
          changed = true;
        }
      } else {
        slowStreak = Math.max(0, slowStreak - 1);
        fastStreak = Math.max(0, fastStreak - 1);
      }
    } else {
      if (emaMs <= upgradeFromPerfMs) {
        fastStreak++;
        if (fastStreak >= upgradeFramesReq) {
          tierIndex = 1;
          fastStreak = 0;
          transitions++;
          changed = true;
        }
      } else {
        fastStreak = Math.max(0, fastStreak - 1);
      }
    }
    return changed;
  }

  function reset() {
    emaMs = 16.67;
    slowStreak = 0;
    fastStreak = 0;
    sampleCount = 0;
  }

  function getStats() {
    return {
      fps: Math.max(1, Math.min(240, Math.round(1000 / Math.max(4, emaMs)))),
      avgFrameMs: Math.round(emaMs * 10) / 10,
      tier: TIER_ORDER[tierIndex],
      transitions,
    };
  }

  return {
    recordFrame,
    getBudget,
    getStats,
    reset,
  };
}
