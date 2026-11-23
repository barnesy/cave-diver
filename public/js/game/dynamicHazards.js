/**
 * Dynamic Reactive Cave & Wreck Hazards (v141):
 *   1. Cold Thermocline Pockets — thermal refraction layers that spike cold-shock HR & RMV gas burn
 *   2. Overhead Bubble Percolation Ceilings — open-circuit exhaust bubbles dislodge cascading ceiling silt
 *      (CCR Rebreathers emit zero bubbles and glide cleanly underneath!)
 *   3. Surge-Driven Shifting Wreck Hatches / Siphon Gates — rhythmic tidal bulkheads rewarding timing
 *
 * Pure deterministic module with zero DOM dependencies (works across all 33 campaign + procedural sites).
 */

import { evaluateCaveSDF } from './collision.js';
import { spawnSiltPlume } from './silt.js';

function hashStr(str) {
  let h = 2166136261;
  const s = String(str || 'site');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRand(seed) {
  let x = (seed >>> 0) || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

/**
 * Deterministic hatch openness in [0..1] (1 = wide open lull, 0 = slammed/surging).
 */
export function computeShiftingHatchOpenness(hatch, timeSec) {
  const period = Math.max(4, Number(hatch?.periodSec) || 10.5);
  const phase = Number(hatch?.phase) || 0;
  // Smooth plateau wave so there is a clear readable open window and a brief slam pulse
  const raw = Math.sin(((timeSec || 0) / period) * Math.PI * 2 + phase);
  const shaped = Math.max(-1, Math.min(1, raw * 1.35));
  return (shaped + 1) * 0.5;
}

/**
 * Compute deterministic living sump hydrology: tidal siphon inflow/slack/outflow cycle (v159).
 * Strongest on open-ocean wrecks, sea caves, Blue Hole, and karst spring siphons; gentle in cenotes.
 */
const _levelHazardMetaCache = new WeakMap();

function getLevelHazardMeta(level) {
  let meta = _levelHazardMetaCache.get(level);
  if (meta) return meta;
  const idStr = `${level.id || ''} ${level.theme?.surfaceStyle || ''} ${level.name || ''}`;
  const isWreck = Boolean(level.isWreck);
  const isStrongTide = isWreck || /blue-hole|wakulla|dahab|lanzarote|abaco|bimini|bermuda|red-sea|thistlegorm|zenobia|britannic|andrea-doria|u1206|oriskany/i.test(idStr);
  const isMildSiphon = /cenote|yucatan|sac-actun|dos-ojos|vaucluse|ressel|silfra|strytan|lagoa|eagle/i.test(idStr);
  const seed = hashStr(level.id || level.name || 'tide');
  let baseSurfaceC = 24.5;
  let floorMinC = 14.0;
  if (/arctic|ice|scoresby|kverkfjoll|silfra|strytan/i.test(idStr)) {
    baseSurfaceC = 3.5;
    floorMinC = 1.2;
  } else if (/ojamo|fitzgerald|orda|krubera|plura|boy-bulok|hranicka/i.test(idStr)) {
    baseSurfaceC = 9.5;
    floorMinC = 4.2;
  } else if (/vaucluse|ressel|zenobia|britannic|andrea-doria|victoria|u1206|merro|molnar/i.test(idStr)) {
    baseSurfaceC = 18.0;
    floorMinC = 11.5;
  } else if (/yucatan|cenote|bahamas|abaco|bimini|bermuda|red-sea|thistlegorm|dahab|oriskany|lagoa|lanzarote/i.test(idStr)) {
    baseSurfaceC = 26.0;
    floorMinC = 18.5;
  }
  meta = {
    isStrongTide,
    isMildSiphon,
    periodSec: isStrongTide ? 68 + (seed % 26) : 92 + (seed % 34),
    phaseOffset: ((seed >>> 8) % 628) / 100,
    peakSpeed: isStrongTide ? 0.62 : 0.34,
    baseSurfaceC,
    floorMinC,
  };
  _levelHazardMetaCache.set(level, meta);
  return meta;
}

export function computeTidalCurrent(level, simTimeSec = 0) {
  if (!level) {
    return { enabled: false, vx: 0, vy: 0, strength: 0, phase: 0, label: 'CALM', isStrong: false };
  }
  const meta = getLevelHazardMeta(level);
  if (!meta.isStrongTide && !meta.isMildSiphon) {
    return { enabled: false, vx: 0, vy: 0, strength: 0, phase: 0, label: 'CALM', isStrong: false };
  }

  const phase = ((simTimeSec || 0) / meta.periodSec) * Math.PI * 2 + meta.phaseOffset;
  const wave = Math.sin(phase);
  const vx = Math.round(wave * meta.peakSpeed * 1000) / 1000;
  const vy = Math.round(Math.cos(phase * 1.5) * meta.peakSpeed * 0.14 * 1000) / 1000;
  const strength = Math.abs(vx);
  const label = strength < 0.14 ? 'SLACK TIDE' : vx > 0 ? 'INFLOW' : 'OUTFLOW';
  return {
    enabled: true,
    vx,
    vy,
    strength,
    phase,
    label,
    isStrong: strength >= 0.32,
  };
}

/**
 * Compute deterministic freshwater/saltwater Halocline refraction layer for cenotes & coastal karst (v159).
 */
export function computeHaloclineLayer(level) {
  if (!level || level.isWreck) {
    return { enabled: false, depthM: 0, thicknessM: 0, salinityDelta: 0 };
  }
  const idStr = `${level.id || ''} ${level.theme?.surfaceStyle || ''} ${level.name || ''}`;
  const hasHalocline = /cenote|yucatan|sac-actun|dos-ojos|angelita|bahamas|abaco|bimini|bermuda|blue-hole|lanzarote|eagle|wakulla|lagoa/i.test(idStr);
  if (!hasHalocline) {
    return { enabled: false, depthM: 0, thicknessM: 0, salinityDelta: 0 };
  }
  const maxD = Number(level.maxDepthM) || 35;
  const seed = hashStr(level.id || 'halo');
  const rawDepth = Math.min(maxD * 0.48, 12.5 + (seed % 7));
  const depthM = Math.round(Math.max(9.5, Math.min(24, rawDepth)) * 10) / 10;
  return {
    enabled: true,
    depthM,
    thicknessM: 2.4,
    salinityDelta: 32, // PSU fresh-to-salt jump
  };
}

/**
 * Compute realistic biome-calibrated ambient water temperature (°C) at current depth,
 * factoring in weather surface cooling, geothermal vents, and cold thermocline pockets (v142).
 */
export function computeAmbientWaterTempC(level, depthM = 0, hazards = null, weather = null) {
  const meta = level ? getLevelHazardMeta(level) : null;
  const baseSurfaceC = meta ? meta.baseSurfaceC : 24.5;
  const floorMinC = meta ? meta.floorMinC : 14.0;

  const d = Math.max(0, Number(depthM) || 0);
  const weatherOffset =
    weather?.id === 'arctic-blizzard' ? -2.2 : weather?.id === 'night-biolum' ? -1.0 : weather?.id === 'tropical-storm' ? -0.6 : 0;
  const depthCooled = Math.max(floorMinC, baseSurfaceC + weatherOffset - d * 0.065);
  const thermoDrop =
    hazards && hazards.thermoclineColdFactor > 0.01
      ? (hazards.thermoclineTempDropC || 7) * Math.max(0, Math.min(1, hazards.thermoclineColdFactor))
      : 0;
  const raw = Math.max(0.5, Math.min(34.0, depthCooled - thermoDrop));
  return Math.round(raw * 10) / 10;
}

/**
 * Synthesize deterministic, SDF-validated reactive hazards tailored to any cave or shipwreck level.
 */
export function createDynamicHazards(level) {
  if (!level) {
    return {
      thermoclines: [],
      percolationZones: [],
      shiftingHatches: [],
      inThermocline: false,
      thermoclineColdFactor: 0,
      thermoclineTempDropC: 0,
      baselineTempC: 24.0,
      waterTempC: 24.0,
      activePercolation: 0,
      activeHatchAlert: false,
      _thermoToastCd: 0,
      _percToastCd: 0,
      _hatchToastCd: 0,
    };
  }

  const rng = seededRand(hashStr(level.id || level.name) ^ 0x9e3779b9);
  const checkpoints = Array.isArray(level.checkpoints) ? level.checkpoints : [];
  const segs = Array.isArray(level.segments) ? level.segments : [];
  const isWreck = Boolean(level.isWreck);
  const isArctic = /arctic|ice|scoresby|kverkfjoll|silfra|strytan/i.test(
    `${level.id || ''} ${level.theme?.surfaceStyle || ''}`
  );

  // Collect candidate open-water corridor midpoints away from spawn
  const candidates = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const mx = (s.ax + s.bx) * 0.5;
    const my = (s.ay + s.by) * 0.5;
    if (my < 9.5) continue;
    const distSpawn = Math.hypot(mx - (level.spawn?.x || 0), my - (level.spawn?.y || 1));
    if (distSpawn < 11) continue;
    const sdf = evaluateCaveSDF(level, mx, my);
    if (sdf < -1.35) {
      candidates.push({ x: mx, y: my, clear: -sdf, segIdx: i });
    }
  }
  for (let i = 0; i < checkpoints.length; i++) {
    const cp = checkpoints[i];
    if (!cp || cp.y < 10) continue;
    const sdf = evaluateCaveSDF(level, cp.x, cp.y);
    if (sdf < -1.4) {
      candidates.push({ x: cp.x, y: cp.y, clear: -sdf, segIdx: 100 + i });
    }
  }

  const pickSpaced = (pool, count, minSep) => {
    const chosen = [];
    for (let i = 0; i < pool.length && chosen.length < count; i++) {
      const idx = Math.floor(rng() * pool.length);
      const c = pool[idx];
      if (!c) continue;
      if (chosen.every((o) => Math.hypot(o.x - c.x, o.y - c.y) >= minSep)) {
        chosen.push(c);
      }
    }
    return chosen;
  };

  // 1. Cold Thermocline Pockets (1–3 deeper lenses)
  const thermoPool = candidates.filter((c) => c.y >= 12 && c.clear >= 1.5);
  const thermoclines = pickSpaced(thermoPool, isArctic ? 3 : 2, 16).map((c, idx) => ({
    id: `thermo-${idx}`,
    x: c.x,
    y: c.y,
    rx: 4.8 + rng() * 2.4,
    ry: 2.3 + rng() * 1.1,
    tempDropC: Math.round((isArctic ? 8 : 6) + rng() * 4),
    phase: rng() * Math.PI * 2,
  }));

  // 2. Overhead Bubble Percolation Ceilings (fragile limestone/silt ceilings with rock overhead within 4.5m)
  const percPool = [];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (c.y < 10) continue;
    // Probe straight up to find exact ceiling height above candidate
    let ceilDist = -1;
    for (let dy = 0.6; dy <= 5.2; dy += 0.45) {
      if (evaluateCaveSDF(level, c.x, c.y - dy) >= -0.15) {
        ceilDist = dy;
        break;
      }
    }
    if (ceilDist > 1.1 && ceilDist <= 4.8) {
      percPool.push({ ...c, ceilY: c.y - ceilDist + 0.15, ceilDist });
    }
  }
  const percolationZones = pickSpaced(percPool, isWreck ? 1 : 2, 15).map((c, idx) => ({
    id: `perc-${idx}`,
    x: c.x,
    y: c.y,
    ceilY: c.ceilY,
    halfWidth: 3.4 + rng() * 1.4,
    intensity: 0, // [0..1] active ceiling avalanche buildup
    siltCooldown: 0,
    streaks: [], // visual falling silt motes [{ x, y, vy, life }]
  }));

  // 3. Surge-Driven Shifting Wreck Hatches (or Deep Karst Siphon Gates on caves)
  const hatchPool = candidates.filter((c) => c.y >= 11 && c.clear >= 1.4 && c.clear <= 5.8);
  const shiftingHatches = pickSpaced(hatchPool, isWreck ? 2 : 1, 18).map((c, idx) => ({
    id: `hatch-${idx}`,
    x: c.x,
    y: c.y,
    radius: Math.min(3.4, Math.max(2.1, c.clear * 0.92)),
    periodSec: 9.0 + rng() * 3.8,
    phase: rng() * Math.PI * 2,
    isWreckHatch: isWreck,
    openness: 1,
    pushCooldown: 0,
    label: isWreck ? 'Surge Bulkhead Hatch' : 'Tidal Siphon Gate',
  }));

  const startTempC = computeAmbientWaterTempC(level, level.spawn?.y || 1, null, null);
  const halocline = computeHaloclineLayer(level);
  const tidalCurrent = computeTidalCurrent(level, 0);
  return {
    thermoclines,
    percolationZones,
    shiftingHatches,
    halocline,
    tidalCurrent,
    inThermocline: false,
    inHalocline: false,
    haloclineStrength: 0,
    thermoclineColdFactor: 0,
    thermoclineTempDropC: 0,
    baselineTempC: startTempC,
    waterTempC: startTempC,
    activePercolation: 0,
    activeHatchAlert: false,
    _thermoToastCd: 0,
    _percToastCd: 0,
    _hatchToastCd: 0,
    _haloclineNotified: false,
  };
}

/**
 * Step all reactive cave & wreck hazards for the current simulation tick.
 * Returns { gasRateMult, coldHeartRateBonus, percolationTriggered, hatchPushApplied }.
 */
export function stepDynamicHazards(session, dt, callbacks = {}) {
  const haz = session?.hazards;
  const diver = session?.diver;
  const diveState = session?.diveState;
  if (!haz || !diver || !diveState || dt <= 0) {
    return { gasRateMult: 1, coldHeartRateBonus: 0, percolationTriggered: false, hatchPushApplied: false };
  }

  const diffScale = session.difficulty === 'hardcore' ? 1.3 : session.difficulty === 'guided' ? 0.65 : 1.0;
  const timeSec = session.simTimeSec || 0;
  if (haz._thermoToastCd > 0) haz._thermoToastCd = Math.max(0, haz._thermoToastCd - dt);
  if (haz._percToastCd > 0) haz._percToastCd = Math.max(0, haz._percToastCd - dt);
  if (haz._hatchToastCd > 0) haz._hatchToastCd = Math.max(0, haz._hatchToastCd - dt);

  // --- 1. Cold Thermocline Pockets ---
  let inThermo = false;
  let coldDepth = 0;
  let tempDropC = 0;
  for (let i = 0; i < haz.thermoclines.length; i++) {
    const th = haz.thermoclines[i];
    const nx = (diver.x - th.x) / th.rx;
    const ny = (diver.y - th.y) / th.ry;
    const dSq = nx * nx + ny * ny;
    if (dSq <= 1) {
      inThermo = true;
      const strength = Math.max(0.25, 1 - Math.sqrt(dSq));
      if (strength > coldDepth) {
        coldDepth = strength;
        tempDropC = th.tempDropC;
      }
    }
  }
  haz.inThermocline = inThermo;
  const targetCold = inThermo ? coldDepth : 0;
  haz.thermoclineColdFactor += (targetCold - haz.thermoclineColdFactor) * Math.min(1, dt * (inThermo ? 3.2 : 1.8));
  haz.thermoclineTempDropC = inThermo ? tempDropC : 0;
  haz.baselineTempC = computeAmbientWaterTempC(session.level, Math.max(0, diver.y), null, session.weather);
  haz.waterTempC = computeAmbientWaterTempC(session.level, Math.max(0, diver.y), haz, session.weather);

  let gasRateMult = 1.0;
  let coldHeartRateBonus = 0;
  if (haz.thermoclineColdFactor > 0.08) {
    gasRateMult = 1.0 + haz.thermoclineColdFactor * 0.22 * diffScale;
    coldHeartRateBonus = haz.thermoclineColdFactor * 14 * diffScale;
    diveState.heartRateBpm = Math.min(190, (diveState.heartRateBpm || 72) + coldHeartRateBonus * dt * 0.45);
    if (inThermo && haz._thermoToastCd <= 0) {
      haz._thermoToastCd = 11.0;
      callbacks.onToast?.(`❄️ Cold Thermocline (-${tempDropC}°C) — cold shock increasing breathing rate!`, 2.6);
    }
  }

  // --- 2. Overhead Bubble Percolation Silt Showers ---
  const isCcrBubbleFree = Boolean(session.gear?.ccr && (diveState.ccrScrubberPct ?? 100) > 0);
  const isExhaling = session.breath?.phase === 'exhale';
  const diverSpeed = Math.hypot(diver.vx || 0, diver.vy || 0);
  let maxPerc = 0;
  let percolationTriggered = false;

  for (let i = 0; i < haz.percolationZones.length; i++) {
    const pz = haz.percolationZones[i];
    if (pz.siltCooldown > 0) pz.siltCooldown = Math.max(0, pz.siltCooldown - dt);

    const underCeiling =
      Math.abs(diver.x - pz.x) <= pz.halfWidth &&
      diver.y >= pz.ceilY &&
      diver.y <= pz.ceilY + 5.8;

    // Open-circuit exhaust bubbles OR DPV propwash/high-speed turbulence disturb fragile ceiling silt
    const bubbleDisturbance = !isCcrBubbleFree && isExhaling ? 0.95 : 0;
    const washDisturbance = diver.dpvThrusting ? 1.0 : diverSpeed > 2.2 ? 0.5 : 0;
    const totalDisturb = underCeiling ? (bubbleDisturbance + washDisturbance) * diffScale : 0;

    if (totalDisturb > 0.1) {
      pz.intensity = Math.min(1, pz.intensity + totalDisturb * dt * 0.85);
    } else {
      pz.intensity = Math.max(0, pz.intensity - dt * 0.28);
    }

    if (pz.intensity > maxPerc) maxPerc = pz.intensity;

    // Emit downward-cascading ceiling silt clouds & visual falling motes when threshold reached
    if (pz.intensity >= 0.38 && pz.siltCooldown <= 0) {
      pz.siltCooldown = session.difficulty === 'hardcore' ? 0.95 : 1.45;
      percolationTriggered = true;
      const sx = diver.x + (Math.random() - 0.5) * 1.4;
      const sy = pz.ceilY + 0.35;
      const plume = spawnSiltPlume(session.siltClouds, {
        x: sx,
        y: sy,
        vx: (Math.random() - 0.5) * 0.22,
        vy: 0.42 + pz.intensity * 0.35, // falls downward from the ceiling!
        radius: 0.58 + pz.intensity * 0.32,
        maxRadius: 2.25 + pz.intensity * 0.75,
        life: 14,
        peakAlpha: Math.min(0.68, 0.34 + pz.intensity * 0.28),
        isRust: Boolean(session.level?.isWreck),
      });
      if (plume) callbacks.onSiltSpawn?.(plume);
      if (haz._percToastCd <= 0) {
        haz._percToastCd = 10.0;
        callbacks.onToast?.(
          session.level?.isWreck
            ? '🌫️ Exhaust bubbles dislodging overhead rusticle silt! Slow trim or use CCR.'
            : '🌫️ Ceiling percolation! Exhaust bubbles shaking limestone silt loose above you.',
          2.8
        );
      }
    }

    // Step visual falling sediment streaks
    if (pz.intensity > 0.15 && pz.streaks.length < 18 && Math.random() < pz.intensity * dt * 18) {
      pz.streaks.push({
        x: pz.x + (Math.random() - 0.5) * pz.halfWidth * 1.8,
        y: pz.ceilY + 0.15,
        vy: 0.9 + Math.random() * 1.1,
        life: 1.6 + Math.random() * 1.2,
      });
    }
    for (let k = pz.streaks.length - 1; k >= 0; k--) {
      const st = pz.streaks[k];
      st.y += st.vy * dt;
      st.life -= dt;
      if (st.life <= 0) pz.streaks.splice(k, 1);
    }
  }
  haz.activePercolation = maxPerc;

  // --- 3. Surge-Driven Shifting Wreck Hatches / Tidal Siphon Gates ---
  let hatchPushApplied = false;
  let anyHatchAlert = false;
  for (let i = 0; i < haz.shiftingHatches.length; i++) {
    const h = haz.shiftingHatches[i];
    if (h.pushCooldown > 0) h.pushCooldown = Math.max(0, h.pushCooldown - dt);
    const prevOpen = h.openness ?? 1;
    h.openness = computeShiftingHatchOpenness(h, timeSec);
    const dist = Math.hypot(diver.x - h.x, diver.y - h.y);
    if (dist <= h.radius * 1.45 && h.openness < 0.45) {
      anyHatchAlert = true;
    }
    // When hatch slams near-shut (< 0.3) and diver is inside the doorway aperture, eject smoothly out of pinch
    if (dist <= h.radius * 0.92 && h.openness < 0.3) {
      const dx = diver.x - h.x;
      const dy = diver.y - h.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = Math.abs(dx) >= 0.05 ? Math.sign(dx) : (dx / d);
      const ny = dy / d;
      const force = (0.3 - h.openness) * 14.0 * diffScale;
      diver.vx += nx * force * dt;
      diver.vy += ny * force * 0.45 * dt;
      hatchPushApplied = true;
      if (h.pushCooldown <= 0) {
        h.pushCooldown = 1.6;
        callbacks.onHullGroan?.(0.75);
        if (haz._hatchToastCd <= 0) {
          haz._hatchToastCd = 6.5;
          callbacks.onToast?.(`🚪 ${h.label} surging shut — time the green open window!`, 2.5);
        }
      }
    } else if (prevOpen >= 0.3 && h.openness < 0.3 && dist <= 9.5) {
      // Distant metallic groan cue when hatch slams nearby
      callbacks.onHullGroan?.(0.35);
    }
  }
  haz.activeHatchAlert = anyHatchAlert;

  // --- 4. Living Sump Hydrology: Tidal Siphon / Outflow Current & Halocline Refraction (v159) ---
  const tidal = computeTidalCurrent(session.level, timeSec);
  haz.tidalCurrent = tidal;
  if (tidal.enabled && diver.y >= 3.5 && !session.clippedToShotLine) {
    const tideDiffScale = session.difficulty === 'guided' ? 0.55 : session.difficulty === 'hardcore' ? 1.15 : 0.85;
    diver.vx += tidal.vx * 0.52 * tideDiffScale * dt;
    diver.vy += tidal.vy * 0.35 * tideDiffScale * dt;
  }

  const halo = haz.halocline;
  let inHalocline = false;
  let haloStrength = 0;
  if (halo?.enabled) {
    const dHalo = Math.abs((diver.y || 0) - halo.depthM);
    if (dHalo <= halo.thicknessM) {
      inHalocline = true;
      haloStrength = Math.max(0.15, 1 - dHalo / halo.thicknessM);
      // Crossing into denser saltwater below applies a gentle buoyancy trim nudge
      const belowCenter = (diver.y || 0) > halo.depthM ? -0.32 : 0.12;
      diver.vy += belowCenter * haloStrength * dt;
      if (!haz._haloclineNotified && haloStrength > 0.35) {
        haz._haloclineNotified = true;
        callbacks.onToast?.(
          `🌊 Halocline at ${Math.round(halo.depthM)}m — freshwater/saltwater mixing shimmer & buoyancy shift!`,
          3.0
        );
      }
    }
  }
  haz.inHalocline = inHalocline;
  haz.haloclineStrength += ((inHalocline ? haloStrength : 0) - (haz.haloclineStrength || 0)) * Math.min(1, dt * 4.0);

  return {
    gasRateMult,
    coldHeartRateBonus,
    percolationTriggered,
    hatchPushApplied,
    tidalCurrent: tidal,
    inHalocline,
  };
}
