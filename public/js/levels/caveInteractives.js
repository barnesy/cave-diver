import { evaluateCaveSDF } from '../game/collision.js';

/**
 * Deterministic Cave Interactive Parity Enricher.
 * Populates all 20 cave expeditions with verified open-water interactive elements:
 * - stageCaches: Clipped reserve Trimix / EAN32 / O2 bailout stage bottles ([E] refill)
 * - lineAnchors: Unlined cave junction line-marker & jump-spool stations ([E] drop glowing cave arrow + +45m reel)
 * - caveCurrents: Authentic steady karst spring / underground river currents along cave conduits
 * - surgeZones: Pulsing tidal blue-hole & karst resurgence siphons (with rhythmic calm lull windows)
 * - snagZones (kind: 'linetrap'): Abandoned tangled cave lines cuttable with shears ([E] / buddy rescue)
 */

const SPRING_CAVE_IDS = new Set([
  'eagles-nest-sink',
  'plura-marble-sump',
  'fontaine-de-vaucluse',
  'orda-crystal-maze',
  'emergence-du-ressel',
  'pozzo-del-merro',
  'lagoa-misteriosa-abyss',
  'boy-bulok-asian-sump',
]);

const TIDAL_SIPHON_IDS = new Set([
  'dans-cave-abaco',
  'blue-hole-dahab-arch',
  'tunel-de-la-atlantida',
  'ox-bel-ha-grand-traverse',
  'silfra-katla-aurora-abyss',
  'strytan-hydrothermal-chimneys',
  'kverkfjoll-subglacial-caves',
  'grjotagja-kleifarvatn-rift',
]);

function pickSafeSegmentPoint(level, seg, t = 0.5, minClearance = 1.0) {
  const x = seg.ax + (seg.bx - seg.ax) * t;
  const y = seg.ay + (seg.by - seg.ay) * t;
  if (y < 6.5) return null;
  const sdf = evaluateCaveSDF(level, x, y);
  if (sdf > -minClearance) return null;
  const dx = seg.bx - seg.ax;
  const dy = seg.by - seg.ay;
  const len = Math.hypot(dx, dy) || 1;
  return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)), dx: dx / len, dy: dy / len, len, clearance: -sdf };
}

function isFarFrom(list, x, y, minDist = 11) {
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (Math.hypot(p.x - x, p.y - y) < minDist) return false;
  }
  return true;
}

export function enrichCaveInteractives(level) {
  if (!level || level.isWreck || !Array.isArray(level.segments) || level.segments.length < 3) {
    return level;
  }

  const segs = level.segments;
  const maxDepthM = Math.max(...segs.map((s) => Math.max(s.ay, s.by)), 45);
  const isUnlined = (level.reelMetersPerDiver || 0) > 0;
  const isSpring = SPRING_CAVE_IDS.has(level.id);
  const isTidal = TIDAL_SIPHON_IDS.has(level.id);
  const isIntro = level.id === 'cenote-el-abismo';

  // Gather candidate open-water tunnel midpoints sorted by depth
  const candidates = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const pt = pickSafeSegmentPoint(level, s, 0.5, 1.05);
    if (!pt) continue;
    // Skip right on top of spawn/exit
    if (Math.hypot(pt.x - level.spawn.x, pt.y - level.spawn.y) < 9) continue;
    if (level.exitZone && Math.hypot(pt.x - level.exitZone.x, pt.y - level.exitZone.y) < 9) continue;
    candidates.push({ ...pt, segIdx: i });
  }
  if (candidates.length === 0) return level;

  const placedCoords = [];

  // 1. Staged Bailout / Reserve Cylinder Caches (1 on intro, 2 on deeper/longer caves)
  if (!Array.isArray(level.stageCaches)) {
    const caches = [];
    // Deep Trimix bailout cache near ~65-82% of max depth
    const deepTargetY = Math.max(28, maxDepthM * 0.72);
    let bestDeep = null;
    let bestDeepErr = Infinity;
    for (const c of candidates) {
      if (c.y < 24 || c.clearance < 1.25) continue;
      const err = Math.abs(c.y - deepTargetY);
      if (err < bestDeepErr) {
        bestDeepErr = err;
        bestDeep = c;
      }
    }
    if (bestDeep) {
      const barBonus = maxDepthM >= 110 ? 75 : 60;
      caches.push({
        id: `${level.id}_stage_tmx`,
        x: bestDeep.x,
        y: bestDeep.y,
        gasId: 'TMX1455',
        barBonus,
        label: 'Staged Trimix Bailout Bottle',
      });
      placedCoords.push(bestDeep);
    }

    // Secondary shallow EAN32/O2 deco reserve bottle on caves deeper than 58m
    if (!isIntro && maxDepthM >= 58) {
      let bestShallow = null;
      let bestShallowErr = Infinity;
      for (const c of candidates) {
        if (c.y < 10 || c.y > 28 || c.clearance < 1.2) continue;
        if (!isFarFrom(placedCoords, c.x, c.y, 14)) continue;
        const err = Math.abs(c.y - 18);
        if (err < bestShallowErr) {
          bestShallowErr = err;
          bestShallow = c;
        }
      }
      if (bestShallow) {
        const isO2 = bestShallow.y <= 12;
        caches.push({
          id: `${level.id}_stage_deco`,
          x: bestShallow.x,
          y: bestShallow.y,
          gasId: isO2 ? 'O2' : 'EAN32',
          barBonus: 65,
          label: isO2 ? 'Clipped O₂ Deco Bottle' : 'Clipped EAN32 Travel Stage',
        });
        placedCoords.push(bestShallow);
      }
    }
    level.stageCaches = caches;
  }

  // 2. Expedition Line Marker & Jump-Spool Stations on unlined reel caves
  if (isUnlined && !Array.isArray(level.lineAnchors)) {
    const anchors = [];
    const targetCount = maxDepthM >= 95 ? 2 : 1;
    const midCandidates = candidates
      .filter((c) => c.y >= 20 && c.y <= maxDepthM * 0.85 && c.clearance >= 1.2)
      .sort((a, b) => Math.abs(a.y - maxDepthM * 0.48) - Math.abs(b.y - maxDepthM * 0.48));
    for (const c of midCandidates) {
      if (anchors.length >= targetCount) break;
      if (!isFarFrom(placedCoords, c.x, c.y, 13)) continue;
      // Point the directional cave arrow back toward the shallower / exit end of the segment
      const exitDirX = c.dy > 0 ? -c.dx : c.dx;
      const exitDirY = c.dy > 0 ? -c.dy : c.dy;
      anchors.push({
        id: `${level.id}_marker_${anchors.length + 1}`,
        x: c.x,
        y: c.y,
        dirAngle: Number(Math.atan2(exitDirY, exitDirX).toFixed(3)),
        reelBonusM: maxDepthM >= 120 ? 55 : 40,
        label: anchors.length === 0 ? 'Main Junction Line Marker' : 'Deep Gallery Jump Spool',
      });
      placedCoords.push(c);
    }
    level.lineAnchors = anchors;
  }

  // 3. Karst Spring Flow Conduits (steady directional underground river flow)
  if (!Array.isArray(level.caveCurrents)) {
    const currents = [];
    if (isSpring || isIntro) {
      const flowPool = candidates
        .filter((c) => c.len >= 12 && c.clearance >= 1.5 && c.y >= 14)
        .sort((a, b) => b.len - a.len);
      const count = isIntro ? 1 : 2;
      for (const c of flowPool) {
        if (currents.length >= count) break;
        if (!isFarFrom(currents, c.x, c.y, 18)) continue;
        const spd = isIntro ? 0.95 : maxDepthM >= 100 ? 1.85 : 1.45;
        // Outbound karst spring flow pushes toward shallower/exit side
        const sign = currents.length % 2 === 0 ? -1 : 1;
        currents.push({
          id: `${level.id}_flow_${currents.length + 1}`,
          x: c.x,
          y: c.y,
          radius: Math.min(5.2, Math.max(3.4, c.clearance * 1.45)),
          vx: Number((c.dx * spd * sign).toFixed(2)),
          vy: Number((c.dy * spd * sign).toFixed(2)),
          label: isIntro ? 'Cenote Halocline Drift' : 'Karst Resurgence Flow',
        });
      }
    }
    level.caveCurrents = currents;
  }

  // 4. Tidal Blue-Hole & Deep Karst Siphon Surges (pulsing flow with safe calm lull windows)
  if (!Array.isArray(level.surgeZones)) {
    const surges = [];
    if (isTidal || (!isSpring && !isIntro && maxDepthM >= 70)) {
      const siphonPool = candidates
        .filter((c) => c.y >= 20 && c.clearance >= 1.35)
        .sort((a, b) => Math.abs(a.y - maxDepthM * 0.55) - Math.abs(b.y - maxDepthM * 0.55));
      const count = maxDepthM >= 100 ? 2 : 1;
      for (const c of siphonPool) {
        if (surges.length >= count) break;
        if (!isFarFrom(surges, c.x, c.y, 18)) continue;
        const spd = maxDepthM >= 110 ? 3.2 : 2.65;
        surges.push({
          id: `${level.id}_siphon_${surges.length + 1}`,
          x: c.x,
          y: c.y,
          radius: Math.min(4.6, Math.max(3.2, c.clearance * 1.35)),
          vx: Number((c.dx * spd).toFixed(2)),
          vy: Number((c.dy * spd).toFixed(2)),
          periodSec: 7.4 + surges.length * 1.1,
          phase: surges.length * 1.8 + 0.4,
          label: isTidal ? 'Tidal Blue-Hole Siphon' : 'Karst Pressure Siphon',
        });
      }
    }
    level.surgeZones = surges;
  }

  // 5. Abandoned Tangled Cave Line Traps (sliceable with [E] shears / buddy rescue) on mid-to-advanced caves
  if (!isIntro && !Array.isArray(level.snagZones) && maxDepthM >= 55) {
    const snags = [];
    const snagPool = candidates
      .filter((c) => c.y >= 22 && c.y <= maxDepthM * 0.88 && c.clearance >= 1.3 && c.clearance <= 3.8)
      .sort((a, b) => Math.abs(a.y - maxDepthM * 0.6) - Math.abs(b.y - maxDepthM * 0.6));
    for (const c of snagPool) {
      if (snags.length >= 1) break;
      if (!isFarFrom(placedCoords, c.x, c.y, 12)) continue;
      snags.push({
        id: `${level.id}_linetrap_1`,
        kind: 'linetrap',
        x: c.x,
        y: c.y,
        radius: Math.min(2.3, Math.max(1.85, c.clearance * 0.82)),
        label: 'Abandoned Tangled Cave Line',
      });
      placedCoords.push(c);
    }
    level.snagZones = snags;
  }

  return level;
}
