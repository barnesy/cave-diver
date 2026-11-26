import { evaluateCaveSDF } from '../collision.js';
import { getTorchOptic } from '../rigLivery.js';
import { computeStormLightningFlash } from '../weather.js';

/**
 * Living, Light-Integrated Foreground Parallax Depth Elements (v224 / v249 / v250).
 *
 * Cinematic Near-Plane Architecture:
 * - Drawn AFTER the diver, volumetric torch cones, sunlight shafts & silt clouds so foreground
 *   formations truly sit IN FRONT of both the diver and the volumetric light behind them.
 * - Strictly light-gated (`lightVis`): in pitch-black unlit caverns elements dissolve seamlessly
 *   to 0% visibility (zero dark cutout stickers over navy darkness). The moment sunlight, the
 *   diver's torch cone, a buddy's torch, a geothermal vent, or a wreck floodlight illuminates the
 *   water behind or around them, they emerge organically with rich near-plane depth contrast and
 *   directional backlit Fresnel rim highlights tinted by the real light source (including Torch Optics).
 * - Wall-slope SDF anchoring (`wallSlope`) + soft feathered wall-tuck keeps every formation seamlessly
 *   rooted into angled ceilings and floors with zero floating edges or self-intersecting curves.
 * - Subtle edge occlusion: the diver's fins, tanks, and outer silhouette genuinely glide behind the
 *   sculpted edges of overhangs, wispy root veils, undulating kelp ribbons, crystal tips, icicles,
 *   and hollow-cutout shipwreck girders, while gently softening if the diver enters the buried core.
 */

const FG_CACHE = new WeakMap();

function _hash01(seed) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function _clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function _smoothstep(e0, e1, x) {
  const t = _clamp((x - e0) / (e1 - e0 || 1), 0, 1);
  return t * t * (3 - 2 * t);
}

function _parseRgb(str, fallback = [186, 230, 253]) {
  if (typeof str !== 'string') return fallback;
  const parts = str.split(',');
  if (parts.length < 3) return fallback;
  const r = parseFloat(parts[0]);
  const g = parseFloat(parts[1]);
  const b = parseFloat(parts[2]);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return fallback;
  return [r, g, b];
}

function _wrapAngle(a) {
  let d = a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Classify a level into its foreground architectural/natural biome style.
 */
export function classifyForegroundBiome(level) {
  if (!level) return 'cenote';
  if (level.isWreck || level.category === 'wreck') return 'wreck';
  const key = `${level.id || ''} ${level.name || ''} ${level.theme?.id || ''} ${level.theme?.surfaceStyle || ''}`.toLowerCase();
  if (/scoresby|silfra|kverkfjoll|plura|ice|glacial|arctic|nordic/.test(key)) return 'ice';
  if (/strytan|grjotagja|katla|lanzarote|atlantida|volcan|geotherm|lava/.test(key)) return 'volcanic';
  if (/orda|molnar|crystal|gypsum|selenite/.test(key)) return 'crystal';
  if (/ojamo|mine|shaft/.test(key)) return 'mine';
  if (/yonaguni|bimini|megalith|monument/.test(key)) return 'monolith';
  return 'cenote';
}

function _getBiomePalette(biome, level = null) {
  const rt = level?.theme?.rockTint;
  const rockBase = Array.isArray(rt) && rt.length >= 3
    ? [Math.round(_clamp(rt[0] * 78, 22, 92)), Math.round(_clamp(rt[1] * 66, 20, 82)), Math.round(_clamp(rt[2] * 56, 20, 80))]
    : null;

  switch (biome) {
    case 'wreck':
      return {
        rockDark: [22, 30, 40],
        rockMid: [50, 64, 78],
        rockHighlight: [112, 134, 152],
        rustRgb: [134, 68, 38],
        rimRgb: [182, 218, 240],
        floraDark: [16, 42, 36],
        floraMid: [34, 86, 66],
        sssRgb: [86, 218, 178],
        mossRgb: [42, 108, 76],
      };
    case 'ice':
      return {
        rockDark: [18, 48, 82],
        rockMid: [62, 136, 188],
        rockHighlight: [188, 238, 255],
        rustRgb: [128, 210, 248],
        rimRgb: [218, 248, 255],
        floraDark: [20, 58, 94],
        floraMid: [76, 168, 218],
        sssRgb: [148, 238, 255],
        mossRgb: [152, 226, 250],
      };
    case 'volcanic':
      return {
        rockDark: [20, 18, 26],
        rockMid: [44, 38, 52],
        rockHighlight: [96, 82, 96],
        rustRgb: [255, 114, 36],
        rimRgb: [255, 176, 104],
        floraDark: [28, 20, 22],
        floraMid: [64, 42, 36],
        sssRgb: [255, 138, 56],
        mossRgb: [208, 92, 38],
      };
    case 'crystal':
      return {
        rockDark: rockBase || [38, 32, 34],
        rockMid: [76, 94, 164],
        rockHighlight: [188, 216, 255],
        rustRgb: [164, 140, 252],
        rimRgb: [220, 236, 255],
        floraDark: [34, 44, 92],
        floraMid: [96, 128, 216],
        sssRgb: [176, 222, 255],
        mossRgb: [146, 208, 250],
      };
    case 'mine':
      return {
        rockDark: [34, 24, 18],
        rockMid: [78, 56, 36],
        rockHighlight: [144, 106, 68],
        rustRgb: [168, 96, 44],
        rimRgb: [232, 174, 104],
        floraDark: [32, 24, 16],
        floraMid: [74, 54, 36],
        sssRgb: [238, 176, 94],
        mossRgb: [116, 86, 50],
      };
    case 'monolith':
      return {
        rockDark: rockBase || [32, 46, 54],
        rockMid: [64, 92, 104],
        rockHighlight: [128, 168, 178],
        rustRgb: [82, 192, 204],
        rimRgb: [166, 232, 248],
        floraDark: [20, 54, 52],
        floraMid: [44, 114, 104],
        sssRgb: [98, 228, 232],
        mossRgb: [56, 152, 132],
      };
    case 'cenote':
    default:
      return {
        rockDark: rockBase || [44, 34, 28],
        rockMid: rockBase ? [Math.round(rockBase[0] * 1.4), Math.round(rockBase[1] * 1.35), Math.round(rockBase[2] * 1.3)] : [74, 58, 44],
        rockHighlight: [132, 112, 88],
        rustRgb: [72, 48, 30], // cenote mahogany bark
        rimRgb: [158, 232, 234],
        floraDark: [14, 48, 38],
        floraMid: [34, 108, 72],
        sssRgb: [112, 244, 168],
        mossRgb: [52, 146, 86],
      };
  }
}

function _probeRockBoundary(level, x, startY, dirY, maxDistM) {
  const step = 0.42;
  let y = startY;
  for (let d = step; d <= maxDistM; d += step) {
    y = startY + dirY * d;
    if (evaluateCaveSDF(level, x, y) >= -0.05) {
      return y;
    }
  }
  return null;
}

/**
 * Deterministically generate wall-slope-anchored foreground depth elements for a level.
 */
export function buildForegroundDepthElements(level) {
  if (!level || !Array.isArray(level.segments) || level.segments.length === 0) return [];
  const cached = FG_CACHE.get(level);
  if (cached) return cached;

  const biome = classifyForegroundBiome(level);
  const segs = level.segments;
  const avoidPts = [];
  if (level.spawn) avoidPts.push({ x: level.spawn.x, y: level.spawn.y, r: 4.5 });
  if (level.exitZone) avoidPts.push({ x: level.exitZone.x, y: level.exitZone.y, r: 4.5 });
  for (const cp of level.checkpoints || []) {
    if (cp && Number.isFinite(cp.x) && Number.isFinite(cp.y)) {
      avoidPts.push({ x: cp.x, y: cp.y, r: 3.0 });
    }
  }

  let idHash = 17;
  const lid = String(level.id || 'lvl');
  for (let i = 0; i < lid.length; i++) idHash = (idHash * 31 + lid.charCodeAt(i)) % 99991;

  const elements = [];
  const MAX_ELEMENTS = 44;
  const MIN_SPACING_SQ = 6.0 * 6.0;

  for (let sIdx = 0; sIdx < segs.length && elements.length < MAX_ELEMENTS; sIdx++) {
    const s = segs[sIdx];
    const ax = s.ax ?? s.x1 ?? 0;
    const ay = s.ay ?? s.y1 ?? 0;
    const bx = s.bx ?? s.x2 ?? ax;
    const by = s.by ?? s.y2 ?? ay;
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 3.0) continue;

    const samples = Math.max(1, Math.min(5, Math.floor(len / 7.0)));
    for (let k = 0; k < samples && elements.length < MAX_ELEMENTS; k++) {
      const seed = idHash + sIdx * 131 + k * 29;
      const t = (k + 0.24 + _hash01(seed) * 0.52) / samples;
      const mx = ax + (bx - ax) * t;
      const my = ay + (by - ay) * t;

      if (my < 2.4 || evaluateCaveSDF(level, mx, my) > -1.2) continue;

      let blocked = false;
      for (let a = 0; a < avoidPts.length; a++) {
        const ap = avoidPts[a];
        const dx = mx - ap.x;
        const dy = my - ap.y;
        if (dx * dx + dy * dy < ap.r * ap.r) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      const ceilY = _probeRockBoundary(level, mx, my, -1, 13.0);
      const floorY = _probeRockBoundary(level, mx, my, 1, 13.0);
      if (ceilY === null || floorY === null) continue;
      const spanH = floorY - ceilY;
      if (spanH < 3.6) continue;

      const placeOnCeiling = ((sIdx + k) % 2 === 0) && ceilY > 1.8;
      // Signature foreground corridor-crossing arch pillars roughly 1 in 4 formations in solid enclosed caves!
      // Verify solid ceiling & floor rock on BOTH left/right flanks AND clear of open surface basins so parallax never exposes a floating end.
      const nearOpenBasin = (level.openBasins || []).some(
        (b) => mx >= (b.xMin ?? -1e9) - 3.6 && mx <= (b.xMax ?? 1e9) + 3.6
      );
      const hasSolidPillarAnchors =
        !nearOpenBasin &&
        evaluateCaveSDF(level, mx - 1.5, ceilY - 0.75) > 0.05 &&
        evaluateCaveSDF(level, mx + 1.5, ceilY - 0.75) > 0.05 &&
        evaluateCaveSDF(level, mx - 1.5, floorY + 0.75) > 0.05 &&
        evaluateCaveSDF(level, mx + 1.5, floorY + 0.75) > 0.05;
      const canPlacePillar =
        !level.isWreck &&
        biome !== 'mine' &&
        ceilY > 2.4 &&
        spanH >= 4.0 &&
        spanH <= 13.5 &&
        hasSolidPillarAnchors &&
        ((sIdx + k) % 4 === 1);
      const wallY = (placeOnCeiling || canPlacePillar) ? ceilY : floorY;
      const eps = 0.30;
      const gx = evaluateCaveSDF(level, mx + eps, wallY) - evaluateCaveSDF(level, mx - eps, wallY);
      const gy = evaluateCaveSDF(level, mx, wallY + eps) - evaluateCaveSDF(level, mx, wallY - eps);
      const wallSlope = Math.abs(gy) > 0.025 ? _clamp(-gx / gy, -0.54, 0.54) : 0;

      // Tuck slightly inside the cave rock lip so sloping bases never show a gap
      const anchorY = (placeOnCeiling || canPlacePillar) ? ceilY - 0.16 : floorY + 0.16;

      let tooClose = false;
      for (let e = 0; e < elements.length; e++) {
        const ex = elements[e].x - mx;
        const ey = elements[e].y - anchorY;
        if (ex * ex + ey * ey < MIN_SPACING_SQ) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      const r1 = _hash01(seed + 7);
      const r2 = _hash01(seed + 19);
      const r3 = _hash01(seed + 41);
      const r4 = _hash01(seed + 73);

      let kind = 'limestone-overhang';
      if (canPlacePillar) {
        kind = 'rock-pillar';
      } else if (biome === 'wreck') {
        if (placeOnCeiling) kind = r1 < 0.35 ? 'wreck-chain' : 'wreck-girder';
        else kind = r1 < 0.38 ? 'wreck-railing' : 'wreck-girder';
      } else if (biome === 'ice') {
        kind = placeOnCeiling ? 'icicle-cluster' : (r1 < 0.52 ? 'icicle-cluster' : 'limestone-overhang');
      } else if (biome === 'volcanic') {
        kind = placeOnCeiling ? 'limestone-overhang' : 'basalt-spire';
      } else if (biome === 'crystal') {
        kind = 'crystal-cluster';
      } else if (biome === 'mine') {
        kind = placeOnCeiling ? (r1 < 0.52 ? 'mine-beam' : 'wreck-chain') : 'mine-beam';
      } else if (biome === 'monolith') {
        kind = 'monolith-block';
      } else {
        if (placeOnCeiling) {
          kind = anchorY < 24 && (sIdx + k) % 3 !== 2 ? 'cenote-roots' : 'limestone-overhang';
        } else {
          kind = anchorY < 26 && (sIdx + k) % 3 !== 2 ? 'kelp-fronds' : 'limestone-overhang';
        }
      }

      const isPillar = kind === 'rock-pillar';
      const isGirder = kind === 'wreck-girder';
      const isCurtain =
        kind === 'cenote-roots' ||
        kind === 'kelp-fronds' ||
        kind === 'wreck-chain' ||
        kind === 'icicle-cluster';
      const isCrystal = kind === 'crystal-cluster';

      const isMidPlane = isPillar ? r4 < 0.45 : (isCurtain || isCrystal ? r4 < 0.65 : r4 < 0.58);
      const depthLayer = isMidPlane ? 'mid' : 'near';
      // World-locked (parallax = 1.0) so foreground attachments NEVER drift sideways off sloped walls or ledges!
      const parallax = 1.0;

      // Reach well into the swim corridor so the diver genuinely glides behind sculpted edges, roots, kelp & pillars!
      let heightM;
      let widthM;
      if (isPillar) {
        heightM = spanH + 0.32;
        widthM = 0.92 + r3 * 0.52; // slender waist (~1.1m) so diver emerges cleanly on both sides!
      } else if (isGirder) {
        heightM = Math.min(spanH * 0.92, Math.max(2.4, spanH * (0.64 + r2 * 0.24)));
        widthM = Math.max(1.55, 1.35 + r3 * 0.55);
      } else if (isCurtain) {
        const maxReach = Math.min(5.2, spanH * 0.56);
        heightM = Math.max(1.95, maxReach * (0.72 + r2 * 0.28));
        widthM = Math.max(1.85, heightM * (0.76 + r3 * 0.36));
      } else if (isCrystal) {
        const maxReach = Math.min(3.5, spanH * 0.40);
        heightM = Math.max(1.65, maxReach * (0.72 + r2 * 0.28));
        widthM = Math.max(1.75, heightM * (0.88 + r3 * 0.40));
      } else {
        const maxReach = Math.min(3.3, spanH * 0.34);
        heightM = Math.max(1.60, maxReach * (0.70 + r2 * 0.30));
        widthM = Math.max(2.9, heightM * (1.42 + r3 * 0.52));
      }

      // Strict continuous-wall flank check: verify solid rock spans BOTH left & right attachment flanks
      // without a vertical cliff drop-off so no attachment point can ever hang in open water!
      // If a non-pillar element's initially chosen side fails (e.g. an open shaft on one side), try the opposite wall with the same strict check.
      const checkFlankWall = (testDir, testWallY, testFlankHalf, testMaxDelta) => {
        const fL = _probeRockBoundary(level, mx - testFlankHalf, my, testDir, 13.0);
        const fR = _probeRockBoundary(level, mx + testFlankHalf, my, testDir, 13.0);
        return (
          fL !== null &&
          fR !== null &&
          Math.abs(fL - testWallY) <= testMaxDelta &&
          Math.abs(fR - testWallY) <= testMaxDelta &&
          evaluateCaveSDF(level, mx - testFlankHalf, fL + testDir * 0.70) > 0.06 &&
          evaluateCaveSDF(level, mx + testFlankHalf, fR + testDir * 0.70) > 0.06
        );
      };
      let chosenOnCeiling = placeOnCeiling || canPlacePillar;
      let chosenWallY = wallY;
      let chosenAnchorY = anchorY;
      let chosenSlope = wallSlope;
      const flankHalfM = isPillar
        ? Math.max(1.6, widthM * 1.35)
        : (kind === 'wreck-chain' ? 0.55 : Math.max(0.85, widthM * 0.48));
      const maxFlankDelta = isPillar ? 1.55 : Math.max(1.35, widthM * 0.48);

      if (!checkFlankWall(chosenOnCeiling ? -1 : 1, chosenWallY, flankHalfM, maxFlankDelta)) {
        const altOnCeiling = !chosenOnCeiling;
        const altWallY = altOnCeiling ? ceilY : floorY;
        if (!isPillar && (!altOnCeiling || ceilY > 1.8) && checkFlankWall(altOnCeiling ? -1 : 1, altWallY, flankHalfM, maxFlankDelta)) {
          chosenOnCeiling = altOnCeiling;
          chosenWallY = altWallY;
          chosenAnchorY = chosenOnCeiling ? ceilY - 0.16 : floorY + 0.16;
          const agx = evaluateCaveSDF(level, mx + eps, chosenWallY) - evaluateCaveSDF(level, mx - eps, chosenWallY);
          const agy = evaluateCaveSDF(level, mx, chosenWallY + eps) - evaluateCaveSDF(level, mx, chosenWallY - eps);
          chosenSlope = Math.abs(agy) > 0.025 ? _clamp(-agx / agy, -0.54, 0.54) : 0;
          if (biome === 'wreck') {
            kind = chosenOnCeiling ? (r1 < 0.35 ? 'wreck-chain' : 'wreck-girder') : (r1 < 0.38 ? 'wreck-railing' : 'wreck-girder');
          } else if (biome === 'cenote' || biome === 'limestone') {
            if (chosenOnCeiling) kind = chosenAnchorY < 24 && (sIdx + k) % 3 !== 2 ? 'cenote-roots' : 'limestone-overhang';
            else kind = chosenAnchorY < 26 && (sIdx + k) % 3 !== 2 ? 'kelp-fronds' : 'limestone-overhang';
          }
        } else {
          continue;
        }
      }
      if (isPillar && !checkFlankWall(1, floorY, flankHalfM, 1.55)) {
        continue;
      }

      elements.push({
        x: mx,
        y: chosenAnchorY,
        side: chosenOnCeiling ? 'ceiling' : 'floor',
        biome,
        kind,
        depthLayer,
        wallSlope: chosenSlope,
        widthM,
        heightM,
        parallax,
        lean: (r2 - 0.5) * (isPillar ? 0.16 : 0.26),
        phase: r3 * Math.PI * 2,
        subCount: 2 + Math.floor(r1 * 3),
        seed: r1 * 100 + r2 * 10,
      });
    }
  }

  FG_CACHE.set(level, elements);
  return elements;
}

const _lightScratch = {
  ambient: 0.08,
  sunLit: 0,
  beamLit: 0,
  backLit: 0,
  ventLit: 0,
  biolumLit: 0,
  totalLight: 0.08,
  lightVis: 0,
  lightR: 128,
  lightG: 206,
  lightB: 214,
  lightRgb: '128, 206, 214',
  lightDirX: 0,
  lightDirY: -1,
  causticAlpha: 0,
  edgeOcc: 0,
};

/**
 * Real-time lighting solver synchronizing each foreground element with the level's lighting system.
 */
export function computeForegroundElementLighting(el, level, opts = {}, out = null) {
  const res = out || { ..._lightScratch };
  const dir = el.side === 'ceiling' ? 1 : -1;
  const wx = el.x;
  let wy = el.y + dir * el.heightM * 0.55;
  if (el.kind === 'rock-pillar' && opts.diver && Number.isFinite(opts.diver.y)) {
    const minY = el.y + el.heightM * 0.24;
    const maxY = el.y + el.heightM * 0.76;
    wy = _clamp(opts.diver.y, minY, maxY);
  }

  const weather = opts.weather || null;
  const timeSec = opts.timeSec || 0;
  const diver = opts.diver || null;
  const peers = opts.peers || null;
  const powerRelays = opts.powerRelays || null;
  const secretLair = opts.secretLair || null;
  const localSiltDensity = opts.localSiltDensity || 0;

  const depthFactor = _clamp((wy - 3.5) / 16, 0, 1);
  const lightningFlash = weather?.lightning ? computeStormLightningFlash(weather, timeSec) : 0;
  const weatherSunScale = Math.min(1, (weather ? weather.sunIntensity : 1.0) + lightningFlash * 0.65);
  const weatherDarkBoost = weather?.darknessBoost || 0;

  let basinSun = 0;
  const basins = level?.openBasins || [];
  for (let i = 0; i < basins.length; i++) {
    const b = basins[i];
    const cx = (b.xMin + b.xMax) * 0.5;
    const halfSpan = Math.max(4.5, (b.xMax - b.xMin) * 0.55);
    const dxNorm = Math.max(0, Math.abs(wx - cx) - halfSpan * 0.45) / 14;
    const dyNorm = Math.max(0, wy - 1.5) / 18;
    const near = Math.max(0, 1 - Math.hypot(dxNorm, dyNorm));
    if (near > basinSun) basinSun = near;
  }
  const sunLit = _clamp(basinSun * weatherSunScale * (1 - depthFactor * 0.35), 0, 1);

  const darknessAlpha = _clamp(
    0.28 + depthFactor * 0.7 + weatherDarkBoost * (1 - depthFactor * 0.65) - sunLit * 0.55 - lightningFlash * 0.22,
    0.16,
    0.96
  );
  const ambient = _clamp((1 - darknessAlpha) * 0.92, 0.04, 0.82);

  let accW = 0.001;
  let accR = 72 * accW;
  let accG = 148 * accW;
  let accB = 178 * accW;
  let dirX = 0;
  let dirY = -0.35 * accW;

  if (sunLit > 0.02) {
    const w = sunLit * 1.15;
    accW += w;
    accR += 132 * w;
    accG += 232 * w;
    accB += 242 * w;
    dirY += -1.0 * w;
  }

  let beamLit = 0;
  let backLit = 0;
  let edgeOcc = 0;

  const accumulateDiver = (d, isLocal) => {
    if (!d || d.alive === false || !Number.isFinite(d.x) || !Number.isFinite(d.y)) return;
    const ox = d.body?.hand && Number.isFinite(d.body.hand.x) ? d.body.hand.x : d.x;
    const oy = d.body?.hand && Number.isFinite(d.body.hand.y) ? d.body.hand.y : d.y;
    const dx = wx - ox;
    const dy = wy - oy;
    const dist = Math.hypot(dx, dy);
    const invD = dist > 0.001 ? 1 / dist : 0;
    const toLx = -dx * invD;
    const toLy = -dy * invD;

    const optic = getTorchOptic(d.livery?.torchId);
    const [coreR, coreG, coreB] = _parseRgb(optic.coreRgb, [224, 242, 254]);
    const [shaftR, shaftG, shaftB] = _parseRgb(optic.shaftRgb, [186, 230, 253]);

    const haloDist = Math.hypot(wx - d.x, wy - d.y);
    if (haloDist < 5.2) {
      const hFrac = _smoothstep(5.2, 0.6, haloDist);
      const weight = hFrac * (isLocal ? 0.56 : 0.34);
      backLit = Math.max(backLit, hFrac * (isLocal ? 0.62 : 0.34));
      if (isLocal) {
        edgeOcc = Math.max(edgeOcc, _smoothstep(4.2, 0.65, haloDist));
      }
      accW += weight;
      accR += shaftR * weight;
      accG += shaftG * weight;
      accB += shaftB * weight;
      dirX += toLx * weight;
      dirY += toLy * weight;
    }

    if (d.torchOn === false) return;

    const reachMult = isLocal ? Math.max(0.9, Math.min(1.55, Number(d.torchReachMult) || 1.0)) : 0.85;
    const strobe = isLocal && Number.isFinite(d.strobeMod) ? d.strobeMod : 1.0;
    const siltPierce = Math.max(0, Math.min(0.88, Math.max(Number(optic.siltPierce) || 0, Number(d.siltPierce) || 0)));
    const siltAtten = 1 - Math.min(0.55, localSiltDensity * 0.48 * (1 - siltPierce));
    const maxRange = (isLocal ? 16.5 : 14.0) * (optic.rangeMult || 1.0) * reachMult * (0.28 + 0.72 * strobe) * siltAtten;

    if (dist < maxRange) {
      const beamAng = Number.isFinite(d.torchAngle) ? d.torchAngle : (d.angle || 0);
      const angToEl = Math.atan2(dy, dx);
      const absD = Math.abs(_wrapAngle(angToEl - beamAng));
      const rangeFalloff = Math.pow(Math.max(0, 1 - dist / maxRange), 1.25);

      if (absD < 0.88) {
        const coneSoft = _smoothstep(0.88, 0.14, absD);
        const hotCore = _smoothstep(0.30, 0.0, absD) * 0.35;
        const lit = Math.min(1.15, (coneSoft + hotCore) * rangeFalloff * (isLocal ? 1.08 : 0.70));
        beamLit = Math.max(beamLit, lit);
        const w = lit * 1.65;
        accW += w;
        accR += (coreR * 0.65 + shaftR * 0.35) * w;
        accG += (coreG * 0.65 + shaftG * 0.35) * w;
        accB += (coreB * 0.65 + shaftB * 0.35) * w;
        dirX += toLx * w;
        dirY += toLy * w;
      }

      if (dist < 7.8 && absD < 1.65) {
        const prox = _smoothstep(7.8, 0.9, dist);
        const sideWrap = _smoothstep(1.65, 0.25, absD);
        const bl = prox * (0.42 + sideWrap * 0.58) * (isLocal ? 1.0 : 0.62);
        backLit = Math.max(backLit, bl);
        const w = bl * 1.25;
        accW += w;
        accR += coreR * w;
        accG += coreG * w;
        accB += coreB * w;
        dirX += toLx * w;
        dirY += toLy * w;
      }
    }
  };

  accumulateDiver(diver, true);
  if (Array.isArray(peers)) {
    for (let i = 0; i < peers.length; i++) {
      accumulateDiver(peers[i], false);
    }
  }

  let ventLit = 0;
  const vents = level?.geothermalVents;
  if (Array.isArray(vents) && vents.length > 0) {
    for (let i = 0; i < vents.length; i++) {
      const v = vents[i];
      const dx = wx - v.x;
      const dy = wy - (v.y - 1.0);
      const dist = Math.hypot(dx, dy);
      const reach = 10.5 + (v.radius || 1.2) * 2.2;
      if (dist < reach) {
        const pulse = 0.78 + 0.22 * Math.sin(timeSec * 3.4 + i * 1.7);
        const vl = _smoothstep(reach, 1.2, dist) * pulse * (0.7 + (v.strength || 0.7) * 0.3);
        if (vl > ventLit) ventLit = vl;
        const invD = dist > 0.001 ? 1 / dist : 0;
        const w = vl * 1.25;
        accW += w;
        accR += 255 * w;
        accG += 118 * w;
        accB += 42 * w;
        dirX += (-dx * invD) * w;
        dirY += (-dy * invD) * w;
      }
    }
  }

  if (Array.isArray(powerRelays)) {
    for (let i = 0; i < powerRelays.length; i++) {
      const rel = powerRelays[i];
      if (!rel || !rel.active) continue;
      const dx = wx - rel.x;
      const dy = wy - rel.y;
      const dist = Math.hypot(dx, dy);
      const reach = (rel.radius || 17.5) * 1.05;
      if (dist < reach) {
        const rl = _smoothstep(reach, 2.0, dist) * 0.92;
        beamLit = Math.max(beamLit, rl * 0.85);
        const invD = dist > 0.001 ? 1 / dist : 0;
        const w = rl * 1.1;
        accW += w;
        accR += 196 * w;
        accG += 232 * w;
        accB += 255 * w;
        dirX += (-dx * invD) * w;
        dirY += (-dy * invD) * w;
      }
    }
  }

  const arches = level?.archWindows;
  if (Array.isArray(arches)) {
    for (let i = 0; i < arches.length; i++) {
      const aw = arches[i];
      const rx = (aw.radiusX || 12) * 1.15;
      const ry = (aw.radiusY || 8) * 1.15;
      const dn = Math.hypot((wx - aw.x) / rx, (wy - aw.y) / ry);
      if (dn < 1.1) {
        const al = _smoothstep(1.1, 0.15, dn) * 0.85;
        backLit = Math.max(backLit, al * 0.72);
        const w = al * 0.95;
        accW += w;
        accR += 92 * w;
        accG += 212 * w;
        accB += 255 * w;
      }
    }
  }

  let biolumLit = (level?.theme?.bioluminescent || weather?.forceBiolum) ? 0.34 : 0;
  if (secretLair?.veilBreached && secretLair.spec?.arena) {
    const ar = secretLair.spec.arena;
    const dn = Math.hypot((wx - ar.cx) / (ar.rx * 1.3), (wy - ar.cy) / (ar.ry * 1.35));
    if (dn < 1.1) {
      const sl = _smoothstep(1.1, 0.2, dn) * (secretLair.arenaEntered ? (secretLair.sconceLitFrac ?? 0.8) : 0.25);
      biolumLit = Math.max(biolumLit, sl * 0.75);
    }
  }
  if (biolumLit > 0.05) {
    const w = biolumLit * 0.7;
    accW += w;
    accR += 86 * w;
    accG += 224 * w;
    accB += 248 * w;
  }

  const totalLight = _clamp(
    Math.max(ambient, sunLit * 0.92, beamLit, backLit * 0.72, ventLit * 0.88, biolumLit * 0.75) +
      beamLit * 0.18 +
      ventLit * 0.14,
    0.04,
    1.0
  );
  // Real visibility envelope: dissolves cleanly to 0 in unlit deep caves (ZERO dark cutout stickers!)
  const realStim = Math.max(sunLit, beamLit, backLit * 0.88, ventLit, biolumLit * 0.8, Math.max(0, ambient - 0.18) * 1.35);
  const lightVis = _smoothstep(0.04, 0.24, realStim);

  const lR = Math.round(_clamp(accR / accW, 0, 255));
  const lG = Math.round(_clamp(accG / accW, 0, 255));
  const lB = Math.round(_clamp(accB / accW, 0, 255));
  const dLen = Math.hypot(dirX, dirY) || 1;

  res.ambient = ambient;
  res.sunLit = sunLit;
  res.beamLit = _clamp(beamLit, 0, 1);
  res.backLit = _clamp(backLit, 0, 1);
  res.ventLit = _clamp(ventLit, 0, 1);
  res.biolumLit = _clamp(biolumLit, 0, 1);
  res.totalLight = totalLight;
  res.lightVis = lightVis;
  res.lightR = lR;
  res.lightG = lG;
  res.lightB = lB;
  res.lightRgb = `${lR}, ${lG}, ${lB}`;
  res.lightDirX = dirX / dLen;
  res.lightDirY = dirY / dLen;
  res.causticAlpha = sunLit > 0.14 ? _clamp((sunLit - 0.14) * 0.48, 0, 0.36) : 0;
  res.edgeOcc = _clamp(edgeOcc, 0, 1);
  return res;
}

function _blendWithLight(baseRgb, light, factor) {
  const k = _clamp(factor, 0, 1);
  const r = Math.round(baseRgb[0] + (light.lightR - baseRgb[0]) * k);
  const g = Math.round(baseRgb[1] + (light.lightG - baseRgb[1]) * k);
  const b = Math.round(baseRgb[2] + (light.lightB - baseRgb[2]) * k);
  return `${r}, ${g}, ${b}`;
}

/**
 * Physically shade a near-plane material by scene lighting:
 * darker & richer than mid-ground cave rock so the foreground depth layer pops unmistakably!
 */
function _shadeNearRgb(baseRgb, light, isNearPlane, lift = 1.0) {
  const lit = _clamp((light.totalLight - 0.04) * 1.12 * lift, 0, 1);
  const depthScale = isNearPlane ? 0.56 : 0.74;
  const k = lit * depthScale;
  const tint = _clamp((light.beamLit * 0.24 + light.ventLit * 0.30 + light.sunLit * 0.16) * lit, 0, 0.36);
  const sr = baseRgb[0] * (1 - tint) + light.lightR * tint;
  const sg = baseRgb[1] * (1 - tint) + light.lightG * tint;
  const sb = baseRgb[2] * (1 - tint) + light.lightB * tint;
  const r = Math.round(4 + (sr - 4) * k);
  const g = Math.round(10 + (sg - 10) * k);
  const b = Math.round(20 + (sb - 20) * k);
  return `${_clamp(r, 0, 255)}, ${_clamp(g, 0, 255)}, ${_clamp(b, 0, 255)}`;
}

function _computeRimPower(light) {
  const raw = Math.max(
    light.backLit * 0.96,
    light.beamLit * 0.92,
    light.sunLit * 0.68,
    light.ventLit * 0.96,
    light.biolumLit * 0.45,
    light.edgeOcc * 0.65
  );
  return _clamp((raw - 0.10) * 1.10, 0, 0.92);
}

function _applyRockPatternTransform(pattern, sx, sy) {
  if (!pattern || typeof pattern.setTransform !== 'function' || typeof DOMMatrix === 'undefined') return;
  try {
    pattern.setTransform(new DOMMatrix().translate(sx, sy).scale(0.90, 0.90));
  } catch {}
}

function _drawCausticRibbons(ctx, sx, sy, wPx, hPx, dir, timeSec, reduced, light) {
  if (light.causticAlpha <= 0.02) return;
  const phase = reduced ? 0 : timeSec * 1.85;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = `rgba(176, 248, 255, ${(light.causticAlpha * light.lightVis).toFixed(3)})`;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const u = (i + 0.5) / 3;
    const wave = Math.sin(phase + i * 2.1 + sx * 0.015) * wPx * 0.14;
    const y0 = sy + dir * hPx * (0.24 + u * 0.44);
    ctx.lineWidth = Math.max(1.3, hPx * 0.025);
    ctx.beginPath();
    ctx.moveTo(sx - wPx * 0.38 + wave, y0);
    ctx.quadraticCurveTo(sx + wave * 0.4, y0 + dir * hPx * 0.06, sx + wPx * 0.36 + wave * 0.8, y0 - dir * hPx * 0.04);
    ctx.stroke();
  }
  ctx.restore();
}

function _drawStarGlint(ctx, gx, gy, rad, rgb, alpha) {
  if (alpha < 0.06 || rad < 1.5) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(gx - rad, gy);
  ctx.lineTo(gx + rad, gy);
  ctx.moveTo(gx, gy - rad);
  ctx.lineTo(gx, gy + rad);
  ctx.stroke();
  ctx.fillStyle = `rgba(255, 255, 255, ${(alpha * 0.90).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(gx, gy, rad * 0.22, rad * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const FG_MATERIAL_ASSETS = {
  kelp: '/assets/tex-fg-kelp.jpg',
  roots: '/assets/tex-fg-roots.jpg',
  crystal: '/assets/tex-fg-crystal.jpg',
  ice: '/assets/tex-fg-ice.jpg',
};

const _fgWallSampleCache = new WeakMap();
const _fgSpriteCache = new WeakMap();
let _fgReusableMatrix = null;

function _buildGeomCacheKey(el, wallProfile, _scale, extra = '') {
  const rev = wallProfile ? (wallProfile.cacheRev || 0) : 0;
  return `${el?.kind || 'fg'}|${rev}|${extra}`;
}

function _blitDualLightEntry(mainCtx, entry, anchorX, anchorY, cw, ch, light, scale, shearX = 0) {
  const scaleRatio = entry.bakedScale > 0 ? scale / entry.bakedScale : 1;
  const drawLocalX = entry.localX * scaleRatio;
  const drawLocalY = entry.localY * scaleRatio;
  const drawW = entry.bw * scaleRatio;
  const drawH = entry.bh * scaleRatio;

  const dstX = Math.round(anchorX + drawLocalX);
  const dstY = Math.round(anchorY + drawLocalY);
  if (dstX + drawW <= -32 || dstX >= cw + 32 || dstY + drawH <= -32 || dstY >= ch + 32) return true;

  const rawLit = _clamp((light.totalLight - 0.05) / 0.66, 0, 1);
  const litBlend = entry.isPlant ? Math.pow(rawLit, 0.72) : Math.pow(rawLit, 0.85);
  const hasShear = Math.abs(shearX) > 0.0005 && typeof mainCtx.transform === 'function';
  const prevAlpha = mainCtx.globalAlpha;

  if (hasShear) {
    mainCtx.save();
    mainCtx.translate(anchorX, anchorY);
    mainCtx.transform(1, 0, shearX, 1, 0, 0);
    if (litBlend >= 0.94 || !entry.darkCanvas) {
      mainCtx.drawImage(entry.canvas, 0, 0, entry.sw, entry.sh, drawLocalX, drawLocalY, drawW, drawH);
    } else if (litBlend <= 0.04) {
      mainCtx.drawImage(entry.darkCanvas, 0, 0, entry.sw, entry.sh, drawLocalX, drawLocalY, drawW, drawH);
    } else {
      mainCtx.drawImage(entry.darkCanvas, 0, 0, entry.sw, entry.sh, drawLocalX, drawLocalY, drawW, drawH);
      mainCtx.globalAlpha = prevAlpha * litBlend;
      mainCtx.drawImage(entry.canvas, 0, 0, entry.sw, entry.sh, drawLocalX, drawLocalY, drawW, drawH);
      mainCtx.globalAlpha = prevAlpha;
    }
    mainCtx.restore();
  } else {
    if (litBlend >= 0.94 || !entry.darkCanvas) {
      mainCtx.drawImage(entry.canvas, 0, 0, entry.sw, entry.sh, dstX, dstY, drawW, drawH);
    } else if (litBlend <= 0.04) {
      mainCtx.drawImage(entry.darkCanvas, 0, 0, entry.sw, entry.sh, dstX, dstY, drawW, drawH);
    } else {
      mainCtx.drawImage(entry.darkCanvas, 0, 0, entry.sw, entry.sh, dstX, dstY, drawW, drawH);
      mainCtx.globalAlpha = prevAlpha * litBlend;
      mainCtx.drawImage(entry.canvas, 0, 0, entry.sw, entry.sh, dstX, dstY, drawW, drawH);
      mainCtx.globalAlpha = prevAlpha;
    }
  }
  return true;
}

function _tryBlitCachedFgSprite(mainCtx, el, sx, sy, cw, ch, light, wallProfile, scale, shearX = 0) {
  if (typeof mainCtx.drawImage !== 'function') return false;
  const entry = _fgSpriteCache.get(el);
  if (!entry || !entry.ready) return false;
  const rev = wallProfile ? (wallProfile.cacheRev || 0) : 0;
  if (entry.wallRev !== rev) return false;
  const ratio = entry.bakedScale > 0 ? scale / entry.bakedScale : 1;
  if (ratio > 1.45 || ratio < 0.65) return false;
  return _blitDualLightEntry(mainCtx, entry, sx, sy, cw, ch, light, scale, shearX);
}

function _buildSpriteCacheKey(el, light, rimPower, wallProfile, scale, extra = '') {
  const qLit = Math.round(light.totalLight * 5);
  const qSun = Math.round(light.sunLit * 3);
  const qRim = Math.round(rimPower * 3);
  const qDir = light.lightDirX >= 0 ? 1 : -1;
  const qR = Math.round(light.lightR / 64);
  const qG = Math.round(light.lightG / 64);
  const qB = Math.round(light.lightB / 64);
  const qSc = Math.max(12, Math.round(scale / 6) * 6);
  const rev = wallProfile ? (wallProfile.cacheRev || 0) : 0;
  const vBit = el?.biome === 'volcanic' ? Math.round(light.ventLit * 4) : 0;
  return `${el?.kind || 'fg'}|${rev}|${qSc}|${qLit}|${qSun}|${qRim}|${qDir}|${qR},${qG},${qB}|${vBit}|${extra}`;
}

function _applyPatternTransform(pattern, ox, oy, scale) {
  if (!pattern || typeof pattern.setTransform !== 'function' || typeof DOMMatrix === 'undefined') return;
  try {
    if (!_fgReusableMatrix) _fgReusableMatrix = new DOMMatrix();
    _fgReusableMatrix.a = scale;
    _fgReusableMatrix.b = 0;
    _fgReusableMatrix.c = 0;
    _fgReusableMatrix.d = scale;
    _fgReusableMatrix.e = ox;
    _fgReusableMatrix.f = oy;
    pattern.setTransform(_fgReusableMatrix);
  } catch {}
}

/**
 * Build a full-resolution (512x512) biome-tinted CanvasPattern from host.rockTex so foreground
 * rocks, pillars & wreck steel match the exact photorealistic grain and strata of the cave walls!
 */
function _getHiResRockPattern(host, ctx, level) {
  const srcCanvas = host?.rockTex?.canvas;
  if (!srcCanvas || !ctx || typeof ctx.createPattern !== 'function') return null;
  const rt = level?.theme?.rockTint;
  const key = `${level?.theme?.id || level?.id || 'def'}|${rt ? rt.join(',') : 'raw'}|${srcCanvas.width}`;
  if (host._fgHiResRockKey === key && host._fgHiResRockPat) {
    return host._fgHiResRockPat;
  }
  let patCanvas = srcCanvas;
  if (rt && typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const size = Math.min(512, srcCanvas.width || 512);
    const tc = document.createElement('canvas');
    tc.width = size;
    tc.height = size;
    const tctx = tc.getContext('2d');
    if (tctx) {
      tctx.drawImage(srcCanvas, 0, 0, size, size);
      // Apply the same biome rockTint color grade at full 512px resolution (never downscaled to 128px!)
      tctx.globalCompositeOperation = 'multiply';
      const r = Math.round(_clamp(rt[0] * 185, 24, 255));
      const g = Math.round(_clamp(rt[1] * 185, 24, 255));
      const b = Math.round(_clamp(rt[2] * 185, 24, 255));
      tctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      tctx.fillRect(0, 0, size, size);
      patCanvas = tc;
    }
  }
  const pat = ctx.createPattern(patCanvas, 'repeat');
  host._fgHiResRockKey = key;
  host._fgHiResRockPat = pat;
  return pat;
}

/**
 * Lazy-load high-res 512x512 foreground material textures (kelp, mangrove bark, crystal, glacial ice)
 * matching the renderer's asset pipeline, with zero-stall fallbacks while loading or in headless Node.
 */
function _getHiResMaterialPatterns(host, ctx, level) {
  const rock = _getHiResRockPattern(host, ctx, level);
  if (!host || !ctx || typeof ctx.createPattern !== 'function') {
    return { rock, kelp: null, roots: null, crystal: null, ice: null };
  }
  if (!host._fgMatCache) host._fgMatCache = new Map();
  const resolveMat = (matKey, fallbackCanvas) => {
    const cached = host._fgMatCache.get(matKey);
    if (cached && cached !== 'loading') return cached;
    if (!cached && typeof host._loadRawImageAsset === 'function') {
      host._fgMatCache.set(matKey, 'loading');
      host._loadRawImageAsset(FG_MATERIAL_ASSETS[matKey]).then((img) => {
        if (img && (img.naturalWidth || img.width) > 0) {
          try {
            host._fgMatCache.set(matKey, ctx.createPattern(img, 'repeat'));
          } catch {
            host._fgMatCache.delete(matKey);
          }
        }
      });
    }
    if (fallbackCanvas) {
      const fbKey = `${matKey}_fb`;
      if (!host._fgMatCache.has(fbKey)) {
        try {
          host._fgMatCache.set(fbKey, ctx.createPattern(fallbackCanvas, 'repeat'));
        } catch {}
      }
      return host._fgMatCache.get(fbKey) || null;
    }
    return null;
  };
  return {
    rock,
    kelp: resolveMat('kelp', host.foliageTex?.canvas || null),
    roots: resolveMat('roots', host.rockTex?.canvas || null),
    crystal: resolveMat('crystal', host.rockTex?.canvas || null),
    ice: resolveMat('ice', host.rockTex?.canvas || null),
  };
}

/**
 * Compute real-time dark-cave shading overlay RGBA for zero-scratch direct-draw high-res textures.
 * Keeps crisp 512px micro-detail visible under torch/sun/vent light while staying 100% OPAQUE so
 * NO flashlight beam behind the element can ever bleed through!
 */
function _computeDirectShadeRgba(light, isNearPlane, boost = 1.0) {
  const lit = _clamp((light.totalLight - 0.03) * 1.14 * boost, 0.03, 1.0);
  const depthScale = isNearPlane ? 0.66 : 0.82;
  const k = _clamp(lit * depthScale, 0.02, 0.92);
  const darkAlpha = _clamp(1 - k, 0.08, 0.96);
  const tint = _clamp(light.beamLit * 0.24 + light.ventLit * 0.34 + light.sunLit * 0.14, 0, 0.34);
  const r = Math.round(3 * (1 - tint) + light.lightR * tint * 0.35);
  const g = Math.round(9 * (1 - tint) + light.lightG * tint * 0.35);
  const b = Math.round(19 * (1 - tint) + light.lightB * tint * 0.35);
  return `rgba(${_clamp(r, 0, 255)}, ${_clamp(g, 0, 255)}, ${_clamp(b, 0, 255)}, ${darkAlpha.toFixed(3)})`;
}

/**
 * Stamp pre-baked `this.rockChunks` solid-rock silhouette onto an element's tight sprite canvas
 * (in screen coordinates; translation-invariant because foreground elements are world-locked at parallax=1).
 * Used with `destination-out` shifted slightly into solid rock so every foreground formation terminates
 * PIXEL-EXACTLY inside the real curved/sloped cave wall with ZERO visible attachment edges!
 */
function _stampRockChunksMask(sctx, renderCtx, shiftX, shiftY, alpha, bounds) {
  const chunks = renderCtx?.rockChunks;
  const pxPerM = renderCtx?.rockPxPerM;
  const scale = renderCtx?.scale;
  if (!chunks || !chunks.length || !pxPerM || !scale) return false;

  const padM = (Math.max(Math.abs(shiftX), Math.abs(shiftY)) + 12) / scale;
  const worldMinX = renderCtx.effCamX + (bounds.x - renderCtx.viewCenterX) / scale - padM;
  const worldMaxX = renderCtx.effCamX + (bounds.x + bounds.w - renderCtx.viewCenterX) / scale + padM;
  const worldMinY = renderCtx.effCamY + (bounds.y - renderCtx.viewCenterY) / scale - padM;
  const worldMaxY = renderCtx.effCamY + (bounds.y + bounds.h - renderCtx.viewCenterY) / scale + padM;
  const yMin = renderCtx.levelYMin ?? -6;

  sctx.save();
  sctx.globalAlpha = alpha;
  for (let i = 0; i < chunks.length; i++) {
    const chnk = chunks[i];
    const cx0 = Math.max(worldMinX, chnk.x0);
    const cx1 = Math.min(worldMaxX, chnk.x1);
    if (cx1 <= cx0) continue;

    const tileY0 = chnk.y0 ?? yMin;
    const tileY1 = chnk.y1 ?? worldMaxY;
    const cy0 = Math.max(worldMinY, tileY0);
    const cy1 = Math.min(worldMaxY, tileY1);
    if (cy1 <= cy0) continue;

    const dx = renderCtx.viewCenterX + (cx0 - renderCtx.effCamX) * scale + shiftX;
    const dy = renderCtx.viewCenterY + (cy0 - renderCtx.effCamY) * scale + shiftY;
    const dw = (cx1 - cx0) * scale;
    const dh = (cy1 - cy0) * scale;

    if (chnk.solidRock || !chnk.canvas) {
      sctx.fillStyle = '#ffffff';
      sctx.fillRect(dx, dy, dw + 1, dh + 1);
    } else {
      const sx0 = (cx0 - chnk.x0) * pxPerM;
      const sw = (cx1 - cx0) * pxPerM;
      const sy0 = (cy0 - tileY0) * pxPerM;
      const sh = (cy1 - cy0) * pxPerM;
      sctx.drawImage(chnk.canvas, sx0, sy0, sw, sh, dx, dy, dw, dh);
    }
  }
  sctx.restore();
  return true;
}

/**
 * 3-step soft rock-silhouette `destination-out` mask:
 *   - 0..5px past wall lip into rock: 100% OPAQUE (seals wall seam & covers 100% of torch scatter rim!)
 *   - 5..18px inside solid rock: dissolves smoothly following the EXACT curved/sloped `rockChunks` contour
 *   - >18px inside solid rock: 0% alpha (ZERO dark caps, ZERO horizontal cutoffs, ZERO visible attachment edges!)
 */
function _applyRockWallFeather(sctx, renderCtx, shiftX, shiftY, bounds) {
  if (!renderCtx?.rockChunks?.length) return false;
  _stampRockChunksMask(sctx, renderCtx, shiftX * 0.30, shiftY * 0.30, 0.26, bounds);
  _stampRockChunksMask(sctx, renderCtx, shiftX * 0.64, shiftY * 0.64, 0.56, bounds);
  _stampRockChunksMask(sctx, renderCtx, shiftX, shiftY, 1.0, bounds);
  return true;
}

/**
 * High-res 512px texture renderer with TWO-STAGE 60 FPS Sprite Caching (v255):
 *   - Stage 1 (`baseCanvas`, baked ONCE per element): atomic 512px pattern silhouette + optional extra tendrils
 *     + pixel-exact `rockChunks` `destination-out` feather. NEVER re-runs when the diver swims or aims the torch!
 *   - Stage 2 (`litCanvas`, re-shaded ONLY on coarse lighting tier shifts, max 1 re-shade/frame): copies `baseCanvas`
 *     + `source-atop` cave shade/overlay (preserving the rock-masked alpha with ZERO re-masking or path tracing!).
 *   - Optional root-anchored `shearX` lets cached `kelp-fronds` & `cenote-roots` sway organically in ONE `drawImage()`
 *     with ZERO `mainCtx.clip()`, ZERO per-frame `CanvasPattern`, and ZERO wall-seam drift!
 */
function _compositeHiResShape(
  mainCtx,
  _scratch,
  cw,
  ch,
  bounds,
  {
    tracePath = null,
    drawShape = null,
    drawBaseExtra = null,
    fillRule = 'nonzero',
    pattern,
    texOriginX,
    texOriginY,
    texScale,
    light,
    isNearPlane,
    boost = 1.0,
    drawOverlay = null,
    drawAlphaMask = null,
    drawRockMask = null,
    cacheEl = null,
    cacheKey = '',
    geomKey = '',
    anchorX = 0,
    anchorY = 0,
    shearX = 0,
    renderCtx = null,
  }
) {
  if (!pattern || typeof mainCtx.fillRect !== 'function') return false;

  // Path A: Zero-rebuild Dual-Light Cached Sprite (baked ONCE per element: darkCanvas + litCanvas, smooth real-time crossfade!)
  if (
    cacheEl &&
    cacheKey &&
    typeof document !== 'undefined' &&
    typeof document.createElement === 'function' &&
    typeof mainCtx.drawImage === 'function'
  ) {
    const liveScale = renderCtx?.scale || 24;
    const wallRev = renderCtx?.wallProfile ? (renderCtx.wallProfile.cacheRev || 0) : 0;
    const maxDim = renderCtx?.maxSpriteDim || 512;
    let entry = _fgSpriteCache.get(cacheEl);

    const scaleRatio = entry && entry.bakedScale > 0 ? liveScale / entry.bakedScale : 1;
    const needsBake =
      !entry ||
      !entry.ready ||
      entry.wallRev !== wallRev ||
      scaleRatio > 1.45 ||
      scaleRatio < 0.65;

    if (needsBake) {
      const localX = Math.round(bounds.x - anchorX);
      const localY = Math.round(bounds.y - anchorY);
      const bw = Math.min(896, Math.ceil(bounds.w));
      const bh = Math.min(896, Math.ceil(bounds.h));
      if (bw <= 2 || bh <= 2) return false;

      const bakeRatio = Math.min(1, maxDim / Math.max(bw, bh));
      const sw = Math.max(2, Math.ceil(bw * bakeRatio));
      const sh = Math.max(2, Math.ceil(bh * bakeRatio));
      const capW = Math.min(maxDim, Math.max(64, Math.ceil(sw / 64) * 64));
      const capH = Math.min(maxDim, Math.max(64, Math.ceil(sh / 64) * 64));

      if (!entry) {
        const canvas = document.createElement('canvas');
        canvas.width = capW;
        canvas.height = capH;
        const litCtx = canvas.getContext('2d');
        const darkCanvas = document.createElement('canvas');
        darkCanvas.width = capW;
        darkCanvas.height = capH;
        const darkCtx = darkCanvas.getContext('2d');
        if (!litCtx || !darkCtx) return false;
        entry = {
          canvas,
          ctx: litCtx,
          darkCanvas,
          darkCtx,
          capW,
          capH,
          wallRev: -1,
          ready: false,
          localX: 0,
          localY: 0,
          bw: 0,
          bh: 0,
          sw: 0,
          sh: 0,
          bakeRatio: 1,
          bakedScale: liveScale,
        };
        _fgSpriteCache.set(cacheEl, entry);
      } else if (sw > entry.capW || sh > entry.capH) {
        entry.capW = Math.min(maxDim, Math.max(entry.capW, capW));
        entry.capH = Math.min(maxDim, Math.max(entry.capH, capH));
        entry.canvas.width = entry.capW;
        entry.canvas.height = entry.capH;
        entry.darkCanvas.width = entry.capW;
        entry.darkCanvas.height = entry.capH;
      }

      const sctx = entry.ctx;
      const offX = anchorX + localX;
      const offY = anchorY + localY;
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.globalCompositeOperation = 'source-over';
      sctx.globalAlpha = 1;
      sctx.clearRect(0, 0, sw, sh);

      sctx.save();
      sctx.setTransform(bakeRatio, 0, 0, bakeRatio, -offX * bakeRatio, -offY * bakeRatio);

      // Pass 1: Atomic silhouette filled with world-locked 512px texture (baked ONCE per element!)
      _applyPatternTransform(pattern, texOriginX, texOriginY, texScale);
      sctx.fillStyle = pattern;
      if (tracePath) {
        tracePath(sctx);
        try {
          if (fillRule === 'evenodd') sctx.fill('evenodd');
          else sctx.fill();
        } catch {
          sctx.fill();
        }
      } else if (drawShape) {
        drawShape(sctx);
      }
      if (drawBaseExtra) {
        drawBaseExtra(sctx);
      }

      // Pass 2: Pixel-exact `rockChunks` silhouette mask OR linear fallback (baked ONCE!)
      let maskedByRock = false;
      if (drawRockMask) {
        sctx.globalCompositeOperation = 'destination-out';
        maskedByRock = Boolean(drawRockMask(sctx));
      }
      if (!maskedByRock && drawAlphaMask) {
        sctx.globalCompositeOperation = 'destination-in';
        drawAlphaMask(sctx);
      }
      sctx.restore();

      // Copy rock-masked textured silhouette to `darkCanvas` and shade once for unlit cave ambient
      const dctx = entry.darkCtx;
      dctx.setTransform(1, 0, 0, 1, 0, 0);
      dctx.globalCompositeOperation = 'source-over';
      dctx.globalAlpha = 1;
      dctx.clearRect(0, 0, sw, sh);
      dctx.drawImage(entry.canvas, 0, 0, sw, sh, 0, 0, sw, sh);
      dctx.globalCompositeOperation = 'source-atop';
      dctx.fillStyle = _computeDirectShadeRgba(
        {
          totalLight: 0.08,
          sunLit: 0,
          beamLit: 0,
          backLit: 0,
          ventLit: 0,
          lightR: 72,
          lightG: 148,
          lightB: 178,
        },
        isNearPlane,
        boost * 0.78
      );
      dctx.fillRect(0, 0, sw, sh);

      // Shade `canvas` once for full beam/sunlit clarity + bevel/vein/rim overlays (ZERO 1px fringe!)
      sctx.save();
      sctx.setTransform(bakeRatio, 0, 0, bakeRatio, -offX * bakeRatio, -offY * bakeRatio);
      sctx.globalCompositeOperation = 'source-atop';
      sctx.fillStyle = _computeDirectShadeRgba(
        {
          totalLight: Math.max(0.84, light.totalLight || 0),
          sunLit: Math.max(0.28, light.sunLit || 0),
          beamLit: Math.max(0.55, light.beamLit || 0),
          backLit: light.backLit || 0,
          ventLit: light.ventLit || 0,
          lightR: Number.isFinite(light.lightR) ? light.lightR : 186,
          lightG: Number.isFinite(light.lightG) ? light.lightG : 230,
          lightB: Number.isFinite(light.lightB) ? light.lightB : 253,
        },
        isNearPlane,
        boost
      );
      sctx.fillRect(offX - 2, offY - 2, bw + 4, bh + 4);
      if (drawOverlay) {
        drawOverlay(sctx);
      }
      sctx.restore();

      entry.wallRev = wallRev;
      entry.ready = true;
      entry.isPlant = cacheEl.kind === 'kelp-fronds' || cacheEl.kind === 'cenote-roots' || cacheEl.kind === 'crystal-cluster' || cacheEl.kind === 'icicle-cluster';
      entry.localX = localX;
      entry.localY = localY;
      entry.bw = bw;
      entry.bh = bh;
      entry.sw = sw;
      entry.sh = sh;
      entry.bakeRatio = bakeRatio;
      entry.bakedScale = liveScale;
    }

    return _blitDualLightEntry(mainCtx, entry, anchorX, anchorY, cw, ch, light, liveScale, shearX);
  }

  // Path B: Direct-draw on mainCtx (for swaying organic kelp fronds & mangrove roots)
  if (typeof mainCtx.clip !== 'function') return false;
  const bx = Math.max(0, Math.floor(bounds.x));
  const by = Math.max(0, Math.floor(bounds.y));
  const bx2 = Math.min(cw, Math.ceil(bounds.x + bounds.w));
  const by2 = Math.min(ch, Math.ceil(bounds.y + bounds.h));
  const bw = bx2 - bx;
  const bh = by2 - by;
  if (bw <= 2 || bh <= 2) return false;

  mainCtx.save();
  if (tracePath) {
    tracePath(mainCtx);
  } else if (drawShape) {
    drawShape(mainCtx);
  }
  try {
    if (fillRule === 'evenodd') mainCtx.clip('evenodd');
    else mainCtx.clip();
  } catch {
    mainCtx.clip();
  }

  _applyPatternTransform(pattern, texOriginX, texOriginY, texScale);
  mainCtx.fillStyle = pattern;
  mainCtx.fillRect(bx, by, bw, bh);

  mainCtx.fillStyle = _computeDirectShadeRgba(light, isNearPlane, boost);
  mainCtx.fillRect(bx, by, bw, bh);

  if (drawOverlay) {
    drawOverlay(mainCtx);
  }

  mainCtx.restore();
  return true;
}

/**
 * Fast sub-pixel cave wall probe: starts in open water and marches in probeDir (-1 up / +1 down)
 * until hitting solid rock (SDF >= -0.02), then refines with 2 bisection steps (~0.045m precision).
 */
function _probeWallExact(level, wx, startY, probeDir, maxDistM = 6.0) {
  let y = startY;
  if (evaluateCaveSDF(level, wx, y) >= -0.05) {
    let foundOpen = false;
    for (let k = 1; k <= 4; k++) {
      const ty = startY - probeDir * (k * 0.65);
      if (evaluateCaveSDF(level, wx, ty) < -0.05) {
        y = ty;
        foundOpen = true;
        break;
      }
    }
    if (!foundOpen) return null;
  }

  const step = 0.36;
  let prevY = y;
  for (let d = step; d <= maxDistM; d += step) {
    const ny = y + probeDir * d;
    if (evaluateCaveSDF(level, wx, ny) >= -0.02) {
      let lo = prevY;
      let hi = ny;
      for (let b = 0; b < 2; b++) {
        const mid = (lo + hi) * 0.5;
        if (evaluateCaveSDF(level, wx, mid) >= -0.02) hi = mid;
        else lo = mid;
      }
      return hi;
    }
    prevY = ny;
  }
  return null;
}

/**
 * Sample (and cache permanently for world-locked parallax=1 elements!) the LIVE cave wall contour(s)
 * across the element's full horizontal span — including BOTH ceiling & floor contours for spanning pillars/girders!
 */
function _buildLiveWallSampler(level, el, sx, fallbackSy, wPx, dir, effCamX, effCamY, viewCenterX, viewCenterY, scale) {
  const slope = Number.isFinite(el.wallSlope) ? el.wallSlope : 0;
  const fallbackFn = (dx) => fallbackSy + dx * slope;

  if (!level || !Array.isArray(level.segments) || level.segments.length === 0 || !scale || scale < 4) {
    const fbOpp = el.kind === 'rock-pillar' ? fallbackSy + dir * el.heightM * scale : null;
    return {
      hasWall: true,
      centerSy: fallbackSy,
      oppSy: fbOpp,
      wallSy: fallbackFn,
      oppWallSy: fbOpp !== null ? () => fbOpp : null,
      minWallSy: fallbackSy,
      maxWallSy: fallbackSy,
      minOppSy: fbOpp,
      maxOppSy: fbOpp,
      wallSlopePx: slope,
      cacheRev: 0,
    };
  }

  const isDualSpan = el.kind === 'rock-pillar' || el.kind === 'wreck-girder';
  const spanHalf = Math.max(isDualSpan ? wPx * 1.45 : wPx * 0.82, 36);
  const spanHalfM = spanHalf / scale;
  const centerWx = effCamX + (sx - viewCenterX) / scale;
  const sampleCount = 7;
  const midIdx = 3;

  let cached = _fgWallSampleCache.get(el);
  if (
    !cached ||
    cached.levelId !== level.id ||
    Math.abs(cached.centerWx - centerWx) > 0.14 ||
    Math.abs(cached.spanHalfM - spanHalfM) > 0.18
  ) {
    const probeStartY = el.y + dir * Math.min(2.6, Math.max(1.0, el.heightM * 0.44));
    const maxDriftM = Math.max(3.8, el.heightM * 0.58);
    const worldYs = cached ? cached.worldYs : new Array(sampleCount);
    const oppWorldYs = isDualSpan ? (cached?.oppWorldYs || new Array(sampleCount)) : null;
    const stepWorldX = (spanHalfM * 2) / (sampleCount - 1);

    for (let i = 0; i < sampleCount; i++) {
      const wx = centerWx + (i - midIdx) * stepWorldX;
      const hitY = _probeWallExact(level, wx, probeStartY, -dir, 6.8);
      worldYs[i] = hitY !== null && Math.abs(hitY - el.y) <= maxDriftM ? hitY : null;
    }

    let hasWall = worldYs[midIdx] !== null;
    let oppWorldY = null;
    if (hasWall) {
      for (let i = midIdx - 1; i >= 0; i--) {
        if (worldYs[i] === null) worldYs[i] = worldYs[i + 1] - stepWorldX * slope;
      }
      for (let i = midIdx + 1; i < sampleCount; i++) {
        if (worldYs[i] === null) worldYs[i] = worldYs[i - 1] + stepWorldX * slope;
      }
      if (isDualSpan) {
        const midCorridorY = el.y + dir * Math.min(el.heightM * 0.50, 5.0);
        const oppMaxDist = Math.max(9.5, el.heightM * 1.25);
        for (let i = 0; i < sampleCount; i++) {
          const wx = centerWx + (i - midIdx) * stepWorldX;
          oppWorldYs[i] = _probeWallExact(level, wx, midCorridorY, dir, oppMaxDist);
        }
        oppWorldY = oppWorldYs[midIdx];
        if (oppWorldY !== null) {
          for (let i = midIdx - 1; i >= 0; i--) {
            if (oppWorldYs[i] === null) oppWorldYs[i] = oppWorldYs[i + 1];
          }
          for (let i = midIdx + 1; i < sampleCount; i++) {
            if (oppWorldYs[i] === null) oppWorldYs[i] = oppWorldYs[i - 1];
          }
        }
        if (el.kind === 'rock-pillar' && oppWorldY === null) hasWall = false;
      }
    }

    cached = {
      levelId: level.id,
      centerWx,
      spanHalfM,
      hasWall,
      worldYs,
      oppWorldY,
      oppWorldYs,
      screenYs: cached ? cached.screenYs : new Array(sampleCount),
      oppScreenYs: isDualSpan ? (cached?.oppScreenYs || new Array(sampleCount)) : null,
      rev: cached ? (cached.rev || 0) + 1 : 1,
    };
    _fgWallSampleCache.set(el, cached);
  }

  if (!cached.hasWall) {
    return {
      hasWall: false,
      centerSy: fallbackSy,
      oppSy: null,
      wallSy: fallbackFn,
      oppWallSy: null,
      minWallSy: fallbackSy,
      maxWallSy: fallbackSy,
      minOppSy: null,
      maxOppSy: null,
      wallSlopePx: slope,
      cacheRev: cached.rev || 0,
    };
  }

  const rawYs = cached.screenYs;
  let minWallSy = Infinity;
  let maxWallSy = -Infinity;
  for (let i = 0; i < sampleCount; i++) {
    const syVal = viewCenterY + (cached.worldYs[i] - effCamY) * scale;
    rawYs[i] = syVal;
    if (syVal < minWallSy) minWallSy = syVal;
    if (syVal > maxWallSy) maxWallSy = syVal;
  }

  let oppSy = null;
  let minOppSy = null;
  let maxOppSy = null;
  let oppWallSy = null;
  const invSpan = 1 / Math.max(1, spanHalf * 2);
  if (cached.oppWorldY !== null && cached.oppWorldYs && cached.oppScreenYs) {
    const oppRaw = cached.oppScreenYs;
    minOppSy = Infinity;
    maxOppSy = -Infinity;
    for (let i = 0; i < sampleCount; i++) {
      const oy = viewCenterY + (cached.oppWorldYs[i] - effCamY) * scale;
      oppRaw[i] = oy;
      if (oy < minOppSy) minOppSy = oy;
      if (oy > maxOppSy) maxOppSy = oy;
    }
    oppSy = oppRaw[midIdx];
    oppWallSy = (dx) => {
      const t = _clamp((dx + spanHalf) * invSpan, 0, 1) * (sampleCount - 1);
      const i0 = Math.floor(t);
      const i1 = i0 < sampleCount - 1 ? i0 + 1 : i0;
      return oppRaw[i0] + (oppRaw[i1] - oppRaw[i0]) * (t - i0);
    };
  }

  const wallSy = (dx) => {
    const t = _clamp((dx + spanHalf) * invSpan, 0, 1) * (sampleCount - 1);
    const i0 = Math.floor(t);
    const i1 = i0 < sampleCount - 1 ? i0 + 1 : i0;
    return rawYs[i0] + (rawYs[i1] - rawYs[i0]) * (t - i0);
  };
  const wallSlopePx = _clamp((rawYs[sampleCount - 1] - rawYs[0]) * invSpan, -1.1, 1.1);

  return {
    hasWall: true,
    centerSy: rawYs[midIdx],
    oppSy,
    wallSy,
    oppWallSy,
    minWallSy,
    maxWallSy,
    minOppSy,
    maxOppSy,
    wallSlopePx,
    cacheRev: cached.rev || 0,
  };
}

/**
 * Compute the exact dark rock/hull tone at the wall-buried root so buried skirts blend invisibly into
 * pitch-dark deep cave rock (zero brown patches over dark navy!) AND sunlit shallow limestone!
 */
function _getWallMergeRgb(pal, light, isNearPlane) {
  const sunBlend = _clamp(light.sunLit * 1.35 + Math.max(0, light.ambient - 0.22) * 1.15, 0, 1);
  const darkBase = pal.rockDark;
  const k = (isNearPlane ? 0.42 : 0.58) * sunBlend;
  const r = Math.round(3 + (darkBase[0] - 3) * k);
  const g = Math.round(9 + (darkBase[1] - 9) * k);
  const b = Math.round(19 + (darkBase[2] - 19) * k);
  return `${_clamp(r, 0, 255)}, ${_clamp(g, 0, 255)}, ${_clamp(b, 0, 255)}`;
}

/**
 * Compute unit normal pointing INTO open water perpendicular to the live wall contour.
 */
function _computeWallNormal(wallY, halfW, dir) {
  const dxW = Math.max(8, halfW * 2);
  const dyW = wallY(halfW) - wallY(-halfW);
  const len = Math.hypot(dxW, dyW) || 1;
  return {
    nx: (-dyW / len) * dir,
    ny: (dxW / len) * dir,
  };
}

/**
 * Subtle, wall-hugging ambient-occlusion contact crevice along the live cave wall contour.
 * Darkens the exact seam where crystals, roots, kelp, chains, or steel ribs emerge from rock
 * WITHOUT painting an opaque dark blob over sunlit stratified limestone or dark navy caves!
 */
function _drawWallWeldCollar(ctx, sx, wallY, halfW, dir, lipOutPx, _buryPx, _mergeRgb, aoAlpha, vis) {
  if (vis < 0.02 || halfW < 4 || aoAlpha <= 0.02) return;
  const steps = 8;
  const peakA = _clamp(aoAlpha * 0.46 * vis, 0, 0.44);
  if (peakA < 0.02) return;

  const { nx, ny } = _computeWallNormal(wallY, halfW, dir);
  const cy = wallY(0);
  const outDepth = Math.max(4, Math.min(9, lipOutPx + 2));
  const inDepth = Math.max(9, Math.min(16, lipOutPx * 2.1 + 4));

  const grad = ctx.createLinearGradient(
    sx + nx * outDepth,
    cy + ny * outDepth,
    sx - nx * inDepth,
    cy - ny * inDepth
  );
  grad.addColorStop(0, 'rgba(2, 6, 14, 0)');
  grad.addColorStop(0.38, `rgba(2, 6, 14, ${peakA.toFixed(3)})`);
  grad.addColorStop(0.65, `rgba(2, 6, 14, ${(peakA * 0.62).toFixed(3)})`);
  grad.addColorStop(1, 'rgba(2, 6, 14, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const dx = (u - 0.5) * halfW * 1.92;
    const env = Math.sin(u * Math.PI);
    const ly = wallY(dx) + dir * outDepth * env;
    if (i === 0) ctx.moveTo(sx + dx, ly);
    else ctx.lineTo(sx + dx, ly);
  }
  for (let i = steps; i >= 0; i--) {
    const u = i / steps;
    const dx = (u - 0.5) * halfW * 1.92;
    const env = Math.pow(Math.sin(u * Math.PI), 0.72);
    ctx.lineTo(sx + dx, wallY(dx) - dir * inDepth * env);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw a sculpted, wall-hugging high-res rock formation locked pixel-tight to the live SDF cave wall!
 * Renders with the EXACT SAME 512px photorealistic rock texture as the background cave walls,
 * stays 100% opaque across the entire wall-water lip (zero leaking light!), paints a grounded AO
 * shadow onto the wall seam, and feathers smoothly to 0% alpha ONLY deep inside solid rock!
 */
function _fillWallHuggingRock(
  ctx,
  sx,
  sy,
  wPx,
  hPx,
  dir,
  wallY,
  pal,
  light,
  rockPattern,
  isNearPlane,
  pts,
  drawDetails = null,
  renderCtx = null
) {
  const vis = light.lightVis;
  if (vis < 0.02 || pts.length < 3) return;

  const halfW = Math.max(16, (pts[pts.length - 1].x - pts[0].x) * 0.5);
  const lit = _clamp((light.totalLight - 0.04) * 1.10, 0, 1);
  const rimPower = _computeRimPower(light);
  const rimRgb = _blendWithLight(pal.rimRgb, light, 0.72);
  const bury = Math.max(78, hPx * 0.72);
  const mergeRgb = _getWallMergeRgb(pal, light, isNearPlane);
  const { nx, ny } = _computeWallNormal(wallY, halfW, dir);

  // Tuck outer wing roots 24px into solid rock so formations extend cleanly & organically into any sloped cave wall
  const wingTuck = dir * 24;
  const traceCrest = (c) => {
    c.moveTo(pts[0].x, pts[0].y - wingTuck);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) * 0.5;
      const my = (pts[i].y + pts[i + 1].y) * 0.5;
      c.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    const last = pts[pts.length - 1];
    c.lineTo(last.x, last.y - wingTuck);
  };

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].y < minY) minY = pts[i].y;
    if (pts[i].y > maxY) maxY = pts[i].y;
  }
  const backHalfW = halfW * 1.24;
  const backPts = [];
  for (let i = 6; i >= 0; i--) {
    const u = i / 6;
    const dx = (u - 0.5) * backHalfW * 2;
    const env = 0.65 + 0.35 * Math.sin(u * Math.PI);
    const by = wallY(dx) - dir * bury * env;
    backPts.push({ x: sx + dx, y: by });
    if (by < minY) minY = by;
    if (by > maxY) maxY = by;
  }

  // Back skirt follows the EXACT live SDF cave wall shifted deep & wide into solid rock!
  const traceFullClosed = (c) => {
    traceCrest(c);
    for (let i = 0; i < backPts.length; i++) {
      c.lineTo(backPts[i].x, backPts[i].y);
    }
    c.closePath();
  };

  // 1. Soft water-facing cast shadow behind the sculpted crest (instant 3D separation!)
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(2, 6, 14, ${(0.34 * vis * (isNearPlane ? 1.15 : 0.85)).toFixed(3)})`;
  ctx.lineWidth = isNearPlane ? 13 : 8;
  if (typeof ctx.translate === 'function') ctx.translate(nx * (isNearPlane ? 5 : 3.5), ny * (isNearPlane ? 5 : 3.5));
  ctx.beginPath();
  traceCrest(ctx);
  ctx.stroke();
  ctx.restore();

  // 2. High-Res 512px Photorealistic Rock Body — Cached Tight-Sprite + Pixel-Exact `rockChunks` Mask!
  const rockMidShaded = _shadeNearRgb(pal.rockMid, light, isNearPlane, 0.96);
  const rockDarkShaded = _shadeNearRgb(pal.rockDark, light, isNearPlane, 0.80);
  const totalDepth = hPx + bury;
  const tLip = _clamp(hPx / totalDepth, 0.34, 0.70);
  const tSolidInRock = _clamp((hPx + Math.min(20, bury * 0.36)) / totalDepth, tLip + 0.06, 0.82);
  const tFadeMid = _clamp(tSolidInRock + (0.93 - tSolidInRock) * 0.52, tSolidInRock + 0.04, 0.90);
  const gX0 = sx + nx * hPx;
  const gY0 = sy + ny * hPx;
  const gX1 = sx - nx * bury;
  const gY1 = sy - ny * bury;

  let drewHiRes = false;
  if (renderCtx?.mats?.rock) {
    const cacheEl = renderCtx.el || null;
    const geomKey = cacheEl ? _buildGeomCacheKey(cacheEl, renderCtx.wallProfile, renderCtx.scale || 24, 'rock') : '';
    const cacheKey = cacheEl ? _buildSpriteCacheKey(cacheEl, light, rimPower, renderCtx.wallProfile, renderCtx.scale || 24, 'rock') : '';
    const spriteBounds = { x: sx - backHalfW - 8, y: minY - 8, w: backHalfW * 2 + 16, h: maxY - minY + 16 };
    drewHiRes = _compositeHiResShape(
      ctx,
      null,
      renderCtx.cw,
      renderCtx.ch,
      spriteBounds,
      {
        tracePath: (sctx) => {
          sctx.beginPath();
          traceFullClosed(sctx);
        },
        pattern: renderCtx.mats.rock,
        texOriginX: renderCtx.texOriginX,
        texOriginY: renderCtx.texOriginY,
        texScale: 0.62,
        light,
        isNearPlane,
        boost: 0.68 + light.sunLit * 0.24,
        cacheEl,
        cacheKey,
        geomKey,
        anchorX: sx,
        anchorY: sy,
        renderCtx,
        drawOverlay: (c) => {
          // Wall-weld depth merge: gently darkens into rock root while staying 100% textured
          const backAlpha = _clamp(0.78 - light.sunLit * 0.38, 0.36, 0.78);
          const depthTint = c.createLinearGradient(gX0, gY0, gX1, gY1);
          depthTint.addColorStop(0, 'rgba(0, 0, 0, 0)');
          depthTint.addColorStop(tLip * 0.75, `rgba(${mergeRgb}, 0.16)`);
          depthTint.addColorStop(tLip, `rgba(${mergeRgb}, 0.44)`);
          depthTint.addColorStop(tSolidInRock, `rgba(${mergeRgb}, ${backAlpha.toFixed(3)})`);
          depthTint.addColorStop(1, `rgba(${mergeRgb}, ${backAlpha.toFixed(3)})`);
          c.fillStyle = depthTint;
          c.fillRect(sx - backHalfW - 10, minY - 10, backHalfW * 2 + 20, maxY - minY + 20);

          if (lit > 0.12) {
            const rockHiShaded = _shadeNearRgb(pal.rockHighlight, light, isNearPlane, 0.90);
            const bevelGrad = c.createLinearGradient(gX0, gY0, sx + nx * (hPx * 0.18), sy + ny * (hPx * 0.18));
            bevelGrad.addColorStop(0, `rgba(${rockHiShaded}, ${(0.24 * lit).toFixed(3)})`);
            bevelGrad.addColorStop(0.55, `rgba(${rockHiShaded}, ${(0.06 * lit).toFixed(3)})`);
            bevelGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            c.fillStyle = bevelGrad;
            c.fillRect(sx - backHalfW - 10, minY - 10, backHalfW * 2 + 20, maxY - minY + 20);
          }

          if (drawDetails) drawDetails(c);

          if (rimPower > 0.08) {
            const gx0 = sx + nx * hPx + light.lightDirX * wPx * 0.42;
            const gy0 = sy + ny * hPx;
            const gx1 = sx + nx * (hPx * 0.12) - light.lightDirX * wPx * 0.35;
            const gy1 = sy + ny * (hPx * 0.12);
            const hlGrad = c.createLinearGradient(gx0, gy0, gx1, gy1);
            hlGrad.addColorStop(0, `rgba(${rimRgb}, ${(rimPower * 0.30).toFixed(3)})`);
            hlGrad.addColorStop(0.45, `rgba(${rimRgb}, ${(rimPower * 0.08).toFixed(3)})`);
            hlGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            c.fillStyle = hlGrad;
            c.fillRect(sx - backHalfW - 10, minY - 10, backHalfW * 2 + 20, maxY - minY + 20);
          }
        },
        drawRockMask: (c) => _applyRockWallFeather(c, renderCtx, -nx * 18, -ny * 18, spriteBounds),
        drawAlphaMask: (c) => {
          const maskGrad = c.createLinearGradient(gX0, gY0, gX1, gY1);
          maskGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
          maskGrad.addColorStop(tSolidInRock, 'rgba(255, 255, 255, 1)');
          maskGrad.addColorStop(tFadeMid, 'rgba(255, 255, 255, 0.42)');
          maskGrad.addColorStop(0.93, 'rgba(255, 255, 255, 0)');
          maskGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          c.fillStyle = maskGrad;
          c.fillRect(sx - backHalfW - 12, minY - 12, backHalfW * 2 + 24, maxY - minY + 24);
        },
      }
    );
  }

  // Vector fallback for headless Node unit tests (no DOM canvas)
  if (!drewHiRes) {
    ctx.beginPath();
    traceFullClosed(ctx);
    const bodyGrad = ctx.createLinearGradient(gX0, gY0, gX1, gY1);
    bodyGrad.addColorStop(0, `rgba(${rockMidShaded}, ${(0.99 * vis).toFixed(3)})`);
    bodyGrad.addColorStop(tLip * 0.65, `rgba(${rockDarkShaded}, ${(0.99 * vis).toFixed(3)})`);
    bodyGrad.addColorStop(tLip, `rgba(${mergeRgb}, ${(0.99 * vis).toFixed(3)})`);
    bodyGrad.addColorStop(tSolidInRock, `rgba(${mergeRgb}, ${(0.96 * vis).toFixed(3)})`);
    bodyGrad.addColorStop(1, `rgba(${mergeRgb}, 0)`);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    if (typeof ctx.clip === 'function') {
      ctx.save();
      ctx.beginPath();
      traceFullClosed(ctx);
      ctx.clip();
      if (drawDetails) drawDetails(ctx);
      ctx.restore();
    }
  }

  // 4. Soft, localized directional backlit Fresnel rim strictly on the light-facing water crest (NEVER a wireframe outline!)
  if (rimPower > 0.07) {
    const focusX = sx + light.lightDirX * wPx * 0.34;
    const focusY = wallY(light.lightDirX * wPx * 0.34) + dir * hPx * 0.82;
    const rad = Math.max(26, wPx * 0.68);
    let rimStroke = `rgba(${rimRgb}, ${(rimPower * 0.52 * vis).toFixed(3)})`;
    if (typeof ctx.createRadialGradient === 'function') {
      const rg = ctx.createRadialGradient(focusX, focusY, 2, focusX, focusY, rad);
      rg.addColorStop(0, `rgba(${rimRgb}, ${(rimPower * 0.72 * vis).toFixed(3)})`);
      rg.addColorStop(0.55, `rgba(${rimRgb}, ${(rimPower * 0.28 * vis).toFixed(3)})`);
      rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      rimStroke = rg;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = rimStroke;
    ctx.lineWidth = Math.max(1.5, Math.min(2.6, hPx * 0.022));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    traceCrest(ctx);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Render each sculpted, biome-authentic high-res near-plane foreground element locked onto its live wall contour.
 */
function _drawBaseFormation(ctx, el, sx, sy, wPx, hPx, dir, pal, swayPx, light, timeSec, reduced, rockPattern, wallProfile = null, renderCtx = null) {
  const vis = light.lightVis;
  if (vis < 0.02) return;

  const leanPx = el.lean * wPx;
  const slope = wallProfile ? wallProfile.wallSlopePx : (Number.isFinite(el.wallSlope) ? el.wallSlope : 0);
  const wallY = wallProfile ? wallProfile.wallSy : (dx) => sy + dx * slope;
  const isNearPlane = el.depthLayer === 'near';
  const lit = _clamp((light.totalLight - 0.04) * 1.10, 0, 1);
  const rimPower = _computeRimPower(light);
  const rimRgb = _blendWithLight(pal.rimRgb, light, 0.72);
  const sssRgb = _blendWithLight(pal.sssRgb, light, 0.56);
  const mergeRgb = _getWallMergeRgb(pal, light, isNearPlane);

  switch (el.kind) {
    case 'rock-pillar': {
      // Sculpted near-camera cave column locked pixel-tight to LIVE ceiling & floor SDF contours!
      // Extends past the extreme ceiling/floor bounds across its entire flared width, then trims
      // pixel-exact inside solid rock via `rockChunks` so ZERO horizontal cap or gap can EVER show!
      const topLip = sy;
      const botLip = wallProfile && Number.isFinite(wallProfile.oppSy) ? wallProfile.oppSy : sy + hPx;
      const topMinY = wallProfile && Number.isFinite(wallProfile.minWallSy) ? Math.min(topLip, wallProfile.minWallSy) : topLip;
      const botMaxY = wallProfile && Number.isFinite(wallProfile.maxOppSy) ? Math.max(botLip, wallProfile.maxOppSy) : botLip;
      const waterSpan = Math.max(40, botLip - topLip);
      const bury = Math.max(54, Math.min(92, waterSpan * 0.30));
      const topY = topMinY - bury;
      const botY = botMaxY + bury;
      const span = Math.max(64, botY - topY);
      const midY = (topLip + botLip) * 0.5;
      const steps = 12;
      const leftPts = [];
      const rightPts = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const py = topY + span * t;
        // Normalized position across the open-water span (0 at ceiling lip, 1 at floor lip)
        const uWater = _clamp((py - topLip) / waterSpan, -0.55, 1.55);
        const flare = Math.pow(Math.min(1.52, Math.abs(uWater - 0.5) * 2), 2.10);
        const halfW = wPx * (0.34 + flare * 1.18);
        const curveX = Math.sin(_clamp(uWater, 0, 1) * Math.PI) * leanPx * 1.35;
        const nL = Math.sin(t * 9.5 + el.seed * 1.3) * wPx * 0.075;
        const nR = Math.cos(t * 8.2 + el.seed * 2.1) * wPx * 0.075;
        leftPts.push({ x: sx + curveX - halfW + nL, y: py });
        rightPts.push({ x: sx + curveX + halfW + nR, y: py });
      }

      const traceLeft = (c) => {
        c.moveTo(leftPts[0].x, leftPts[0].y);
        for (let i = 1; i < steps; i++) {
          const mx = (leftPts[i].x + leftPts[i + 1].x) * 0.5;
          const my = (leftPts[i].y + leftPts[i + 1].y) * 0.5;
          c.quadraticCurveTo(leftPts[i].x, leftPts[i].y, mx, my);
        }
        c.lineTo(leftPts[steps].x, leftPts[steps].y);
      };
      const traceRight = (c) => {
        c.moveTo(rightPts[0].x, rightPts[0].y);
        for (let i = 1; i < steps; i++) {
          const mx = (rightPts[i].x + rightPts[i + 1].x) * 0.5;
          const my = (rightPts[i].y + rightPts[i + 1].y) * 0.5;
          c.quadraticCurveTo(rightPts[i].x, rightPts[i].y, mx, my);
        }
        c.lineTo(rightPts[steps].x, rightPts[steps].y);
      };
      const tracePillarClosed = (c) => {
        traceLeft(c);
        c.lineTo(rightPts[steps].x, rightPts[steps].y);
        for (let i = steps - 1; i >= 1; i--) {
          const mx = (rightPts[i].x + rightPts[i - 1].x) * 0.5;
          const my = (rightPts[i].y + rightPts[i - 1].y) * 0.5;
          c.quadraticCurveTo(rightPts[i].x, rightPts[i].y, mx, my);
        }
        c.lineTo(rightPts[0].x, rightPts[0].y);
        c.closePath();
      };

      // 1. Soft depth drop-shadow behind both flanks strictly across open water
      const tTopLip = _clamp((topLip - topY) / span, 0.08, 0.38);
      const tBotLip = _clamp((botLip - topY) / span, 0.62, 0.92);
      const tTopSolid = _clamp(tTopLip * 0.60, 0.05, tTopLip - 0.02);
      const tBotSolid = _clamp(1 - (1 - tBotLip) * 0.60, tBotLip + 0.02, 0.95);
      const tTopMid = _clamp(0.04 + (tTopSolid - 0.04) * 0.48, 0.05, tTopSolid - 0.01);
      const tBotMid = _clamp(tBotSolid + (0.96 - tBotSolid) * 0.52, tBotSolid + 0.01, 0.95);

      ctx.save();
      const shadowGrad = ctx.createLinearGradient(sx, topY, sx, botY);
      shadowGrad.addColorStop(0, 'rgba(2, 6, 14, 0)');
      shadowGrad.addColorStop(tTopLip, 'rgba(2, 6, 14, 0)');
      shadowGrad.addColorStop(Math.min(0.48, tTopLip + 0.08), `rgba(2, 6, 14, ${(0.34 * vis).toFixed(3)})`);
      shadowGrad.addColorStop(Math.max(0.52, tBotLip - 0.08), `rgba(2, 6, 14, ${(0.34 * vis).toFixed(3)})`);
      shadowGrad.addColorStop(tBotLip, 'rgba(2, 6, 14, 0)');
      shadowGrad.addColorStop(1, 'rgba(2, 6, 14, 0)');
      ctx.strokeStyle = shadowGrad;
      ctx.lineWidth = isNearPlane ? 14 : 8;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      traceLeft(ctx);
      traceRight(ctx);
      ctx.stroke();
      ctx.restore();

      // 2. High-Res 512px Photorealistic Rock Pillar — Cached Tight-Sprite + Pixel-Exact `rockChunks` Ceiling/Floor Mask!
      const rockMidShaded = _shadeNearRgb(pal.rockMid, light, isNearPlane, 0.98);
      const rockDarkShaded = _shadeNearRgb(pal.rockDark, light, isNearPlane, 0.78);
      const litRight = light.lightDirX >= 0;
      const focusY = topLip + waterSpan * _clamp(0.50 + light.lightDirY * 0.22, 0.28, 0.72);
      const colHalfBound = wPx * 2.40 + Math.abs(leanPx) * 1.4;

      let drewPillarHiRes = false;
      if (renderCtx?.mats?.rock) {
        const pTag = `p${Math.round(span / 16)}`;
        const geomKey = _buildGeomCacheKey(el, wallProfile, renderCtx.scale || 24, pTag);
        const cacheKey = _buildSpriteCacheKey(el, light, rimPower, wallProfile, renderCtx.scale || 24, pTag);
        const spriteBounds = { x: sx - colHalfBound, y: topY - 4, w: colHalfBound * 2, h: span + 8 };
        drewPillarHiRes = _compositeHiResShape(
          ctx,
          null,
          renderCtx.cw,
          renderCtx.ch,
          spriteBounds,
          {
            tracePath: (sctx) => {
              sctx.beginPath();
              tracePillarClosed(sctx);
            },
            pattern: renderCtx.mats.rock,
            texOriginX: renderCtx.texOriginX,
            texOriginY: renderCtx.texOriginY,
            texScale: 0.62,
            light,
            isNearPlane,
            boost: 0.68 + light.sunLit * 0.24,
            cacheEl: el,
            cacheKey,
            geomKey,
            anchorX: sx,
            anchorY: sy,
            renderCtx,
            drawOverlay: (c) => {
              // Cylindrical 3D cross-lighting (shadowed side -> rim-lit flank)
              const cylGrad = c.createLinearGradient(sx - wPx * 0.7, focusY, sx + wPx * 0.7, focusY);
              cylGrad.addColorStop(0, litRight ? 'rgba(2, 6, 14, 0.56)' : `rgba(${rimRgb}, ${(0.22 * rimPower).toFixed(3)})`);
              cylGrad.addColorStop(0.5, 'rgba(2, 6, 14, 0.20)');
              cylGrad.addColorStop(1, litRight ? `rgba(${rimRgb}, ${(0.22 * rimPower).toFixed(3)})` : 'rgba(2, 6, 14, 0.56)');
              c.fillStyle = cylGrad;
              c.fillRect(sx - colHalfBound, topY - 4, colHalfBound * 2, span + 8);

              // Top & bottom root depth shading into ceiling & floor rock
              const backAlpha = _clamp(0.92 - light.sunLit * 0.44, 0.44, 0.92);
              const rootTint = c.createLinearGradient(sx, topY, sx, botY);
              rootTint.addColorStop(0, `rgba(${mergeRgb}, ${backAlpha.toFixed(3)})`);
              rootTint.addColorStop(tTopLip, `rgba(${mergeRgb}, ${(backAlpha * 0.85).toFixed(3)})`);
              rootTint.addColorStop(Math.min(0.49, tTopLip + 0.14), 'rgba(0, 0, 0, 0)');
              rootTint.addColorStop(Math.max(0.51, tBotLip - 0.14), 'rgba(0, 0, 0, 0)');
              rootTint.addColorStop(tBotLip, `rgba(${mergeRgb}, ${(backAlpha * 0.85).toFixed(3)})`);
              rootTint.addColorStop(1, `rgba(${mergeRgb}, ${backAlpha.toFixed(3)})`);
              c.fillStyle = rootTint;
              c.fillRect(sx - colHalfBound, topY - 4, colHalfBound * 2, span + 8);

              if (el.biome === 'volcanic') {
                const grooveA = Math.max(light.ventLit * 0.85, lit * 0.42);
                const gGrad = c.createLinearGradient(sx, topLip + 4, sx, botLip - 4);
                gGrad.addColorStop(0, 'rgba(255, 118, 42, 0)');
                gGrad.addColorStop(0.24, `rgba(255, 118, 42, ${grooveA.toFixed(3)})`);
                gGrad.addColorStop(0.76, `rgba(255, 118, 42, ${grooveA.toFixed(3)})`);
                gGrad.addColorStop(1, 'rgba(255, 118, 42, 0)');
                c.strokeStyle = gGrad;
                c.lineWidth = 1.8;
                c.lineCap = 'round';
                c.beginPath();
                c.moveTo(sx - wPx * 0.08, topLip + 6);
                c.quadraticCurveTo(sx + leanPx * 0.8, topLip + waterSpan * 0.5, sx + wPx * 0.06, botLip - 6);
                c.stroke();
              }
            },
            drawRockMask: (c) => {
              if (!renderCtx?.rockChunks?.length) return false;
              // Top half: trim pixel-exact 6..26px inside the REAL sloped/curved ceiling rock
              c.save();
              c.beginPath();
              c.rect(spriteBounds.x - 4, spriteBounds.y - 4, spriteBounds.w + 8, midY - spriteBounds.y + 4);
              c.clip();
              _applyRockWallFeather(c, renderCtx, 0, -26, spriteBounds);
              c.restore();
              // Bottom half: trim pixel-exact 6..26px inside the REAL sloped/curved floor rock
              c.save();
              c.beginPath();
              c.rect(spriteBounds.x - 4, midY, spriteBounds.w + 8, spriteBounds.y + spriteBounds.h - midY + 8);
              c.clip();
              _applyRockWallFeather(c, renderCtx, 0, 26, spriteBounds);
              c.restore();
              return true;
            },
            drawAlphaMask: (c) => {
              const maskGrad = c.createLinearGradient(sx, topY, sx, botY);
              maskGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
              maskGrad.addColorStop(0.05, 'rgba(255, 255, 255, 0)');
              maskGrad.addColorStop(tTopMid, 'rgba(255, 255, 255, 0.44)');
              maskGrad.addColorStop(tTopSolid, 'rgba(255, 255, 255, 1)');
              maskGrad.addColorStop(tBotSolid, 'rgba(255, 255, 255, 1)');
              maskGrad.addColorStop(tBotMid, 'rgba(255, 255, 255, 0.44)');
              maskGrad.addColorStop(0.95, 'rgba(255, 255, 255, 0)');
              maskGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
              c.fillStyle = maskGrad;
              c.fillRect(sx - colHalfBound - 4, topY - 6, colHalfBound * 2 + 8, span + 12);
            },
          }
        );
      }

      if (!drewPillarHiRes) {
        const bodyGrad = ctx.createLinearGradient(sx, topY, sx, botY);
        bodyGrad.addColorStop(0, `rgba(${mergeRgb}, 0)`);
        bodyGrad.addColorStop(tTopSolid, `rgba(${mergeRgb}, ${(0.97 * vis).toFixed(3)})`);
        bodyGrad.addColorStop(tTopLip, `rgba(${rockDarkShaded}, ${(0.99 * vis).toFixed(3)})`);
        bodyGrad.addColorStop(0.50, `rgba(${rockDarkShaded}, ${(0.99 * vis).toFixed(3)})`);
        bodyGrad.addColorStop(tBotLip, `rgba(${rockDarkShaded}, ${(0.99 * vis).toFixed(3)})`);
        bodyGrad.addColorStop(tBotSolid, `rgba(${mergeRgb}, ${(0.97 * vis).toFixed(3)})`);
        bodyGrad.addColorStop(1, `rgba(${mergeRgb}, 0)`);
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        tracePillarClosed(ctx);
        ctx.fill();
      }

      // 4. Crisp localized directional backlit Fresnel rim along the light-facing vertical edge (strictly inside water span!)
      if (rimPower > 0.07) {
        const focusX = sx + (litRight ? wPx * 0.36 : -wPx * 0.36);
        const rad = Math.min(waterSpan * 0.44, Math.max(46, waterSpan * 0.42));
        let rimStroke = `rgba(${rimRgb}, ${(rimPower * 0.65 * vis).toFixed(3)})`;
        if (typeof ctx.createRadialGradient === 'function') {
          const rg = ctx.createRadialGradient(focusX, focusY, 3, focusX, focusY, rad);
          rg.addColorStop(0, `rgba(${rimRgb}, ${(rimPower * 0.92 * vis).toFixed(3)})`);
          rg.addColorStop(0.55, `rgba(${rimRgb}, ${(rimPower * 0.36 * vis).toFixed(3)})`);
          rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
          rimStroke = rg;
        }
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = rimStroke;
        ctx.lineWidth = Math.max(1.8, Math.min(3.2, wPx * 0.05));
        ctx.lineCap = 'butt';
        ctx.beginPath();
        if (litRight) traceRight(ctx);
        else traceLeft(ctx);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }

    case 'cenote-roots': {
      // Cached two-stage gnarled wet mangrove bark root veil (`tex-fg-roots.jpg`) with pixel-exact `rockChunks`
      // ceiling-seam masking and 0.04ms root-pinned affine sway (ZERO per-frame `mainCtx.clip()` or `screen` flushes!).
      const rootDark = _shadeNearRgb([30, 19, 12], light, isNearPlane, 0.90);
      const rootMid = _shadeNearRgb(pal.rustRgb, light, isNearPlane, 1.08);
      const leafCol = _shadeNearRgb(pal.mossRgb, light, isNearPlane, 1.05);

      const strands = el.subCount + 5;
      const trunkGeoms = [];
      let minX = sx - wPx;
      let maxX = sx + wPx;
      let minY = sy - 30;
      let maxY = sy + hPx + 24;

      for (let i = 0; i < strands; i++) {
        const u = strands <= 1 ? 0 : i / (strands - 1) - 0.5;
        const j = (_hash01(el.seed + i * 17.3) - 0.5) * 0.14;
        const frac = _clamp(u + j, -0.52, 0.52);
        const isFine = i % 3 !== 0;
        const dx0 = frac * wPx * 0.88;
        const bx = sx + dx0;
        const by = wallY(dx0) - 22;
        const archOut = (frac * 0.28 + (_hash01(el.seed + i * 9.1) - 0.5) * 0.22) * wPx;
        const len = hPx * (isFine ? 0.50 + _hash01(el.seed + i * 31) * 0.52 : 0.72 + _hash01(el.seed + i * 13) * 0.34) + 14;
        const baseW = Math.max(isFine ? 1.1 : 4.2, wPx * (isFine ? 0.017 : 0.062 - Math.abs(u) * 0.015));

        const c1x = bx + archOut * 0.55 + leanPx * 0.25;
        const c1y = by + len * 0.36;
        const c2x = bx + archOut * 0.30 + leanPx * 0.65 - Math.sign(frac || 1) * wPx * 0.06;
        const c2y = by + len * 0.72;
        const tipX = bx + archOut * 0.45 + leanPx * 0.85;
        const tipY = by + len;
        if (bx - baseW - 22 < minX) minX = bx - baseW - 22;
        if (tipX + 22 > maxX) maxX = tipX + 22;
        if (by - 10 < minY) minY = by - 10;
        if (tipY + 24 > maxY) maxY = tipY + 24;
        trunkGeoms.push({ i, isFine, bx, by, c1x, c1y, c2x, c2y, tipX, tipY, baseW, len });
      }

      const { nx: rNx, ny: rNy } = _computeWallNormal(wallY, wPx * 0.48, dir);
      const rBounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      const rootShearX = reduced ? 0 : Math.sin(timeSec * 1.25 + el.phase) * 0.052;
      let drewRootsHiRes = false;
      if (renderCtx?.mats?.roots) {
        const geomKey = _buildGeomCacheKey(el, wallProfile, renderCtx.scale || 24, 'roots');
        const cacheKey = _buildSpriteCacheKey(el, light, rimPower, wallProfile, renderCtx.scale || 24, 'roots');
        drewRootsHiRes = _compositeHiResShape(
          ctx,
          null,
          renderCtx.cw,
          renderCtx.ch,
          rBounds,
          {
            tracePath: (sctx) => {
              sctx.beginPath();
              for (const g of trunkGeoms) {
                if (g.isFine) continue;
                sctx.moveTo(g.bx, g.by - 8);
                sctx.quadraticCurveTo(g.bx - g.baseW * 0.92, g.by + 5, g.bx - g.baseW * 0.72, g.by + 14);
                sctx.bezierCurveTo(g.c1x - g.baseW * 0.46, g.c1y, g.c2x - g.baseW * 0.22, g.c2y, g.tipX, g.tipY);
                sctx.bezierCurveTo(g.c2x + g.baseW * 0.22, g.c2y, g.c1x + g.baseW * 0.46, g.c1y, g.bx + g.baseW * 0.72, g.by + 14);
                sctx.quadraticCurveTo(g.bx + g.baseW * 0.92, g.by + 5, g.bx, g.by - 8);
                sctx.closePath();
              }
            },
            drawBaseExtra: (bctx) => {
              bctx.lineCap = 'round';
              // Fine root hairs & secondary forks baked ONCE into baseCanvas before rock-wall masking!
              bctx.strokeStyle = 'rgba(116, 86, 56, 0.88)';
              bctx.lineWidth = Math.max(1.2, wPx * 0.018);
              bctx.beginPath();
              for (const g of trunkGeoms) {
                if (g.isFine) {
                  bctx.moveTo(g.bx, g.by);
                  bctx.bezierCurveTo(g.c1x, g.c1y, g.c2x, g.c2y, g.tipX, g.tipY);
                } else {
                  for (const fSign of [-1, 1]) {
                    const fT = fSign < 0 ? 0.42 : 0.62;
                    const inv = 1 - fT;
                    const fx0 = inv * inv * inv * g.bx + 3 * inv * inv * fT * g.c1x + 3 * inv * fT * fT * g.c2x + fT * fT * fT * g.tipX;
                    const fy0 = inv * inv * inv * g.by + 3 * inv * inv * fT * g.c1y + 3 * inv * fT * fT * g.c2y + fT * fT * fT * g.tipY;
                    bctx.moveTo(fx0, fy0);
                    bctx.quadraticCurveTo(fx0 + fSign * wPx * 0.11, fy0 + g.len * 0.13, fx0 + fSign * wPx * 0.18, fy0 + g.len * 0.30);
                  }
                }
              }
              bctx.stroke();
              if (el.y < 18) {
                bctx.fillStyle = 'rgba(84, 134, 62, 0.82)';
                bctx.beginPath();
                for (const g of trunkGeoms) {
                  if (g.isFine) continue;
                  bctx.moveTo(g.bx + g.baseW * 1.15, g.by + 24);
                  bctx.ellipse(g.bx + leanPx * 0.08, g.by + 24, g.baseW * 1.15, g.baseW * 0.55, 0.35, 0, Math.PI * 2);
                }
                bctx.fill();
              }
            },
            pattern: renderCtx.mats.roots,
            texOriginX: renderCtx.texOriginX,
            texOriginY: renderCtx.texOriginY,
            texScale: 0.34,
            light,
            isNearPlane,
            boost: 1.48,
            cacheEl: el,
            cacheKey,
            geomKey,
            anchorX: sx,
            anchorY: sy,
            shearX: rootShearX,
            renderCtx,
            drawOverlay: (c) => {
              const rg = c.createLinearGradient(sx - rNx * 16, sy - rNy * 16, sx + rNx * 38, sy + rNy * 38);
              rg.addColorStop(0, `rgba(${mergeRgb}, 0.88)`);
              rg.addColorStop(0.45, `rgba(${mergeRgb}, 0.34)`);
              rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
              c.fillStyle = rg;
              c.fillRect(minX, minY, maxX - minX, maxY - minY);

              if (rimPower > 0.08) {
                const hlSign = light.lightDirX >= 0 ? 1 : -1;
                c.strokeStyle = `rgba(${rimRgb}, ${(rimPower * 0.46).toFixed(3)})`;
                c.lineWidth = Math.max(1.1, wPx * 0.015);
                c.lineCap = 'round';
                c.beginPath();
                for (const g of trunkGeoms) {
                  if (g.isFine) continue;
                  c.moveTo(g.bx + hlSign * g.baseW * 0.38, g.by + 16);
                  c.bezierCurveTo(g.c1x + hlSign * g.baseW * 0.22, g.c1y, g.c2x + hlSign * g.baseW * 0.12, g.c2y, g.tipX, g.tipY);
                }
                c.stroke();
              }
            },
            drawRockMask: (c) => _applyRockWallFeather(c, renderCtx, -rNx * 14, -rNy * 14, rBounds),
            drawAlphaMask: (c) => {
              const mg = c.createLinearGradient(sx - rNx * 22, sy - rNy * 22, sx + rNx * 6, sy + rNy * 6);
              mg.addColorStop(0, 'rgba(255, 255, 255, 0)');
              mg.addColorStop(0.35, 'rgba(255, 255, 255, 0.5)');
              mg.addColorStop(0.80, 'rgba(255, 255, 255, 1)');
              mg.addColorStop(1, 'rgba(255, 255, 255, 1)');
              c.fillStyle = mg;
              c.fillRect(minX - 4, minY - 4, maxX - minX + 8, maxY - minY + 8);
            },
          }
        );
      }

      // Vector fallback ONLY for headless Node unit tests (no DOM canvas)
      if (!drewRootsHiRes) {
        _drawWallWeldCollar(ctx, sx, wallY, wPx * 0.48, dir, 4, Math.max(30, hPx * 0.20), mergeRgb, 0.46, vis);
        ctx.lineCap = 'round';
        for (const g of trunkGeoms) {
          const { isFine, bx, by, c1x, c1y, c2x, c2y, tipX, tipY, baseW } = g;
          if (isFine) {
            ctx.strokeStyle = `rgba(${rootMid}, ${(0.72 * vis).toFixed(3)})`;
            ctx.lineWidth = baseW;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.bezierCurveTo(c1x, c1y, c2x, c2y, tipX, tipY);
            ctx.stroke();
          } else {
            ctx.fillStyle = `rgba(${rootDark}, ${(0.92 * vis).toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(bx - baseW * 0.75, by);
            ctx.bezierCurveTo(c1x - baseW * 0.40, c1y, c2x - baseW * 0.18, c2y, tipX, tipY);
            ctx.bezierCurveTo(c2x + baseW * 0.18, c2y, c1x + baseW * 0.40, c1y, bx + baseW * 0.75, by);
            ctx.closePath();
            ctx.fill();
            if (el.y < 18) {
              ctx.fillStyle = `rgba(${leafCol}, ${(0.64 * vis).toFixed(3)})`;
              ctx.beginPath();
              ctx.ellipse(bx + leanPx * 0.08, by + 24, baseW * 1.15, baseW * 0.55, 0.35, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
      break;
    }

    case 'kelp-fronds': {
      // Cached two-stage photorealistic undulating emerald kelp ribbons (`tex-fg-kelp.jpg`) with pixel-exact
      // `rockChunks` seabed masking and 0.04ms root-pinned affine sway (eliminates +13.4ms/frame `mainCtx.clip()` stall!).
      const stalkDark = _shadeNearRgb(pal.floraDark, light, isNearPlane, 0.88);
      const bladeMid = _shadeNearRgb(pal.floraMid, light, isNearPlane, 1.06);
      const bladeLit = _shadeNearRgb(pal.mossRgb, light, isNearPlane, 1.22);

      const ribbons = el.subCount + 3;
      const bladeGeoms = [];
      let minX = sx - wPx;
      let maxX = sx + wPx;
      let minY = sy - hPx - 16;
      let maxY = sy + 32;

      for (let i = 0; i < ribbons; i++) {
        const u = ribbons <= 1 ? 0 : i / (ribbons - 1) - 0.5;
        const j = (_hash01(el.seed + i * 21.7) - 0.5) * 0.14;
        const frac = _clamp(u + j, -0.48, 0.48);
        const dx0 = frac * wPx * 0.78;
        const bx = sx + dx0;
        const by = wallY(dx0) + 24;
        const hMul = 0.56 + (1 - Math.abs(u) * 1.1) * 0.34 + _hash01(el.seed + i * 11.3) * 0.22;
        const len = hPx * hMul + 14;
        const ribbonW = Math.max(5.5, wPx * (0.085 + _hash01(el.seed + i * 7.7) * 0.045));
        // Static organic rest-pose S-curve baked into cached sprite; real-time current sway runs via root-pinned shearX!
        const wavePh = el.phase + i * 1.45;
        const lean = (frac * 0.35 + el.lean * 0.8) * wPx;

        const segs = 7;
        const leftPts = [];
        const rightPts = [];
        for (let s = 0; s <= segs; s++) {
          const t = s / segs;
          const taper = Math.sin(Math.pow(t, 0.72) * Math.PI * 0.94);
          const halfW = Math.max(0.8, ribbonW * (0.28 + 0.72 * taper));
          const wave = Math.sin(wavePh + t * 3.8) * ribbonW * (0.45 + t * 0.95);
          const cx = bx + lean * t * t + wave;
          const cy = by - len * t;
          const ruffle = Math.sin(t * 14.0 + i * 2.3) * ribbonW * 0.16 * taper;
          const lx = cx - halfW + ruffle;
          const rx = cx + halfW + ruffle;
          leftPts.push({ x: lx, y: cy });
          rightPts.push({ x: rx, y: cy });
          if (lx - 6 < minX) minX = lx - 6;
          if (rx + 6 > maxX) maxX = rx + 6;
          if (cy - 6 < minY) minY = cy - 6;
          if (cy + 8 > maxY) maxY = cy + 8;
        }
        bladeGeoms.push({ bx, by, ribbonW, segs, leftPts, rightPts, tip: leftPts[segs] });
      }

      const traceBladeSubpath = (c, b) => {
        c.moveTo(b.leftPts[0].x, b.leftPts[0].y);
        for (let s = 1; s < b.segs; s++) {
          const mx = (b.leftPts[s].x + b.leftPts[s + 1].x) * 0.5;
          const my = (b.leftPts[s].y + b.leftPts[s + 1].y) * 0.5;
          c.quadraticCurveTo(b.leftPts[s].x, b.leftPts[s].y, mx, my);
        }
        c.lineTo(b.tip.x, b.tip.y);
        for (let s = b.segs - 1; s >= 1; s--) {
          const mx = (b.rightPts[s].x + b.rightPts[s - 1].x) * 0.5;
          const my = (b.rightPts[s].y + b.rightPts[s - 1].y) * 0.5;
          c.quadraticCurveTo(b.rightPts[s].x, b.rightPts[s].y, mx, my);
        }
        c.lineTo(b.rightPts[0].x, b.rightPts[0].y);
        c.closePath();
      };

      const { nx: kNx, ny: kNy } = _computeWallNormal(wallY, wPx * 0.46, dir);
      const kBounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      const kelpShearX = reduced ? 0 : Math.sin(timeSec * 1.38 + el.phase) * 0.068;
      let drewKelpHiRes = false;
      if (renderCtx?.mats?.kelp) {
        const geomKey = _buildGeomCacheKey(el, wallProfile, renderCtx.scale || 24, 'kelp');
        const cacheKey = _buildSpriteCacheKey(el, light, rimPower, wallProfile, renderCtx.scale || 24, 'kelp');
        drewKelpHiRes = _compositeHiResShape(
          ctx,
          null,
          renderCtx.cw,
          renderCtx.ch,
          kBounds,
          {
            tracePath: (sctx) => {
              sctx.beginPath();
              for (const b of bladeGeoms) {
                traceBladeSubpath(sctx, b);
              }
            },
            pattern: renderCtx.mats.kelp,
            texOriginX: renderCtx.texOriginX,
            texOriginY: renderCtx.texOriginY,
            texScale: 0.42,
            light,
            isNearPlane,
            boost: 1.48,
            cacheEl: el,
            cacheKey,
            geomKey,
            anchorX: sx,
            anchorY: sy,
            shearX: kelpShearX,
            renderCtx,
            drawOverlay: (c) => {
              const vg = c.createLinearGradient(sx - kNx * 16, sy - kNy * 16, sx + kNx * hPx, sy + kNy * hPx);
              vg.addColorStop(0, `rgba(${mergeRgb}, 0.94)`);
              vg.addColorStop(0.24, 'rgba(0, 0, 0, 0)');
              vg.addColorStop(1, `rgba(${sssRgb}, ${(0.20 * lit).toFixed(3)})`);
              c.fillStyle = vg;
              c.fillRect(minX, minY, maxX - minX, maxY - minY);

              // Batched midrib veins
              c.strokeStyle = `rgba(${stalkDark}, 0.52)`;
              c.lineWidth = Math.max(1.0, wPx * 0.012);
              c.beginPath();
              for (const b of bladeGeoms) {
                c.moveTo(b.bx, b.by);
                for (let s = 1; s <= b.segs; s++) {
                  c.lineTo((b.leftPts[s].x + b.rightPts[s].x) * 0.5, b.leftPts[s].y);
                }
              }
              c.stroke();

              // Batched translucent backlit leaf rim baked directly inside cached sprite (ZERO mainCtx 'screen' flushes!)
              if (rimPower > 0.08) {
                const useRight = light.lightDirX >= 0;
                c.strokeStyle = `rgba(${sssRgb}, ${(rimPower * 0.52).toFixed(3)})`;
                c.lineWidth = 1.4;
                c.beginPath();
                for (const b of bladeGeoms) {
                  const edgePts = useRight ? b.rightPts : b.leftPts;
                  c.moveTo(edgePts[1].x, edgePts[1].y);
                  for (let s = 2; s < b.segs; s++) {
                    const mx = (edgePts[s].x + edgePts[s + 1].x) * 0.5;
                    const my = (edgePts[s].y + edgePts[s + 1].y) * 0.5;
                    c.quadraticCurveTo(edgePts[s].x, edgePts[s].y, mx, my);
                  }
                  c.lineTo(edgePts[b.segs].x, edgePts[b.segs].y);
                }
                c.stroke();
              }
            },
            drawRockMask: (c) => _applyRockWallFeather(c, renderCtx, -kNx * 14, -kNy * 14, kBounds),
            drawAlphaMask: (c) => {
              const mg = c.createLinearGradient(sx - kNx * 22, sy - kNy * 22, sx + kNx * 6, sy + kNy * 6);
              mg.addColorStop(0, 'rgba(255, 255, 255, 0)');
              mg.addColorStop(0.35, 'rgba(255, 255, 255, 0.5)');
              mg.addColorStop(0.80, 'rgba(255, 255, 255, 1)');
              mg.addColorStop(1, 'rgba(255, 255, 255, 1)');
              c.fillStyle = mg;
              c.fillRect(minX - 4, minY - 4, maxX - minX + 8, maxY - minY + 8);
            },
          }
        );
      }

      // Vector fallback ONLY for headless Node unit tests (no DOM canvas)
      if (!drewKelpHiRes) {
        _drawWallWeldCollar(ctx, sx, wallY, wPx * 0.46, dir, 4, Math.max(30, hPx * 0.20), mergeRgb, 0.46, vis);
        for (const b of bladeGeoms) {
          const bg = ctx.createLinearGradient(b.bx, b.by, b.tip.x, b.tip.y);
          bg.addColorStop(0, `rgba(${stalkDark}, ${(0.97 * vis).toFixed(3)})`);
          bg.addColorStop(0.48, `rgba(${bladeMid}, ${(0.94 * vis).toFixed(3)})`);
          bg.addColorStop(0.88, `rgba(${bladeLit}, ${(0.88 * vis).toFixed(3)})`);
          bg.addColorStop(1, `rgba(${bladeLit}, ${(0.55 * vis).toFixed(3)})`);
          ctx.fillStyle = bg;
          ctx.beginPath();
          traceBladeSubpath(ctx, b);
          ctx.fill();
        }
      }
      break;
    }

    case 'wreck-chain': {
      _drawWallWeldCollar(ctx, sx, wallY, Math.max(18, wPx * 0.36), dir, 7, 24, mergeRgb, 0.70, vis, renderCtx, light, isNearPlane);
      const links = Math.max(4, Math.min(10, Math.round(hPx / Math.max(12, wPx * 0.19))));
      const linkH = hPx / links;
      const linkW = Math.max(6.0, wPx * 0.16);
      const steelDark = _shadeNearRgb(pal.rockDark, light, isNearPlane, 0.86);
      const steelMid = _shadeNearRgb(pal.rockMid, light, isNearPlane, 1.0);
      const rustStr = _shadeNearRgb(pal.rustRgb, light, isNearPlane, 1.05);

      for (let i = 0; i < links; i++) {
        const u = (i + 0.5) / links;
        const lx = sx + swayPx * u * u + leanPx * u * 0.36;
        const ly = sy + dir * (i + 0.32) * linkH;
        const isBroad = i % 2 === 0;
        const rx = isBroad ? linkW * 0.56 : linkW * 0.25;
        const ry = linkH * 0.60;

        ctx.strokeStyle = `rgba(2, 6, 12, ${(0.34 * vis).toFixed(3)})`;
        ctx.lineWidth = Math.max(5.0, linkW * 0.50);
        ctx.beginPath();
        ctx.ellipse(lx + 2, ly + dir * 2, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(${i % 3 === 0 ? rustStr : steelMid}, ${(0.95 * vis).toFixed(3)})`;
        ctx.lineWidth = Math.max(3.0, linkW * 0.32);
        ctx.beginPath();
        ctx.ellipse(lx, ly, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(${steelDark}, ${(0.72 * vis).toFixed(3)})`;
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.ellipse(lx, ly, Math.max(1, rx - 1.4), Math.max(1, ry - 1.4), 0, 0, Math.PI * 2);
        ctx.stroke();

        if (isBroad) {
          ctx.strokeStyle = `rgba(${steelMid}, ${(0.92 * vis).toFixed(3)})`;
          ctx.lineWidth = Math.max(2.0, linkW * 0.22);
          ctx.beginPath();
          ctx.moveTo(lx - rx * 0.8, ly);
          ctx.lineTo(lx + rx * 0.8, ly);
          ctx.stroke();
        }

        if (rimPower > 0.10) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.strokeStyle = `rgba(${rimRgb}, ${(rimPower * 0.50 * vis).toFixed(3)})`;
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.ellipse(lx + (light.lightDirX >= 0 ? 1.1 : -1.1), ly, rx * 0.90, ry * 0.90, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
      break;
    }

    case 'wreck-girder': {
      // Riveted steel shipwreck hull rib welded solidly into the hull bulkhead(s) with flared gusset plates
      // and TRUE transparent circular lightening holes (`evenodd`) so the diver shines right through!
      const bw = Math.max(18, wPx * 0.42);
      const oppY = wallProfile && Number.isFinite(wallProfile.oppSy) ? wallProfile.oppSy : null;
      const distToOpp = oppY !== null ? (oppY - sy) * dir : -1;
      const spanToOpp = distToOpp > 48 && distToOpp <= hPx * 1.38;
      const endLipY = spanToOpp ? oppY : sy + dir * hPx * 0.95;
      const tipX = sx + leanPx * (spanToOpp ? 0.55 : 1.05);
      const buryG = 48;
      const yL = wallY(-bw * 0.82) - dir * buryG;
      const yR = wallY(bw * 0.82) - dir * buryG;
      const endY = spanToOpp ? endLipY + dir * buryG : endLipY;
      const endHalfW = spanToOpp ? bw * 0.78 : bw * 0.46;
      const waterLen = Math.max(40, Math.abs(endLipY - sy));
      const holeCount = Math.max(2, Math.min(5, Math.round(waterLen / 34)));
      const steelDark = _shadeNearRgb(pal.rockDark, light, isNearPlane, 0.88);
      const steelMid = _shadeNearRgb(pal.rockMid, light, isNearPlane, 1.02);
      const rustStr = _shadeNearRgb(pal.rustRgb, light, isNearPlane, 1.05);
      const steelHl = _shadeNearRgb(pal.rockHighlight, light, isNearPlane, 1.2);
      const kelpStr = _shadeNearRgb(pal.floraMid, light, isNearPlane, 1.05);

      // Weld girder deeply into anchor bulkhead (and opposite bulkhead when spanning full hold!)
      _drawWallWeldCollar(ctx, sx, wallY, bw * 1.12, dir, 6.5, buryG, mergeRgb, 0.56, vis);
      if (spanToOpp) {
        _drawWallWeldCollar(ctx, tipX, () => endLipY, bw * 1.08, -dir, 6.5, buryG, mergeRgb, 0.56, vis);
      }

      const holes = [];
      for (let h = 0; h < holeCount; h++) {
        const u = (h + 0.55) / (holeCount + 0.15);
        const hx = sx + (tipX - sx) * u;
        const hy = sy + (endLipY - sy) * u;
        const hr = Math.max(4.5, bw * (0.23 - (spanToOpp ? 0.02 : u * 0.04)));
        holes.push({ hx, hy, hr, u });
      }

      const traceGirderPath = (c) => {
        c.beginPath();
        c.moveTo(sx - bw * 0.82, yL);
        c.lineTo(tipX - endHalfW, endY);
        c.lineTo(tipX + endHalfW, endY);
        c.lineTo(sx + bw * 0.82, yR);
        c.closePath();
        for (let h = 0; h < holes.length; h++) {
          const { hx, hy, hr } = holes[h];
          c.moveTo(hx + hr, hy);
          c.ellipse(hx, hy, hr, hr, 0, 0, Math.PI * 2);
        }
      };

      const gMinX = Math.min(sx - bw, tipX - endHalfW) - 8;
      const gMaxX = Math.max(sx + bw, tipX + endHalfW) + 8;
      const gMinY = Math.min(yL, yR, endY) - 8;
      const gMaxY = Math.max(yL, yR, endY) + 8;

      let drewSteelHiRes = false;
      if (renderCtx?.mats?.rock) {
        const gSpan = Math.max(20, Math.abs(endY - sy) + buryG);
        const tAnchorSolid = _clamp((buryG - 14) / gSpan, 0.06, 0.24);
        const tOppSolid = _clamp(1 - (buryG - 14) / gSpan, 0.76, 0.94);
        const gTag = `g${spanToOpp ? 1 : 0}_${Math.round(waterLen / 16)}`;
        const geomKey = _buildGeomCacheKey(el, wallProfile, renderCtx.scale || 24, gTag);
        const cacheKey = _buildSpriteCacheKey(el, light, rimPower, wallProfile, renderCtx.scale || 24, gTag);
        const gBounds = { x: gMinX, y: gMinY, w: gMaxX - gMinX, h: gMaxY - gMinY };
        const gMidY = (sy + endLipY) * 0.5;
        drewSteelHiRes = _compositeHiResShape(
          ctx,
          null,
          renderCtx.cw,
          renderCtx.ch,
          gBounds,
          {
            tracePath: traceGirderPath,
            fillRule: 'evenodd',
            pattern: renderCtx.mats.rock,
            texOriginX: renderCtx.texOriginX,
            texOriginY: renderCtx.texOriginY,
            texScale: 0.56,
            light,
            isNearPlane,
            boost: 1.24,
            cacheEl: el,
            cacheKey,
            geomKey,
            anchorX: sx,
            anchorY: sy,
            renderCtx,
            drawOverlay: (c) => {
              const sg = c.createLinearGradient(sx, yL, tipX, endY);
              sg.addColorStop(0, `rgba(${mergeRgb}, 0.84)`);
              sg.addColorStop(0.16, `rgba(${steelMid}, 0.25)`);
              sg.addColorStop(0.55, `rgba(${steelDark}, 0.35)`);
              if (spanToOpp) {
                sg.addColorStop(0.84, `rgba(${rustStr}, 0.42)`);
                sg.addColorStop(1, `rgba(${mergeRgb}, 0.84)`);
              } else {
                sg.addColorStop(1, `rgba(${rustStr}, 0.42)`);
              }
              c.fillStyle = sg;
              c.fillRect(gMinX, gMinY, gMaxX - gMinX, gMaxY - gMinY);
            },
            drawRockMask: (c) => {
              if (!renderCtx?.rockChunks?.length) return false;
              if (spanToOpp) {
                c.save();
                c.beginPath();
                c.rect(gBounds.x - 4, gBounds.y - 4, gBounds.w + 8, gMidY - gBounds.y + 4);
                c.clip();
                _applyRockWallFeather(c, renderCtx, 0, -16, gBounds);
                c.restore();
                c.save();
                c.beginPath();
                c.rect(gBounds.x - 4, gMidY, gBounds.w + 8, gBounds.y + gBounds.h - gMidY + 8);
                c.clip();
                _applyRockWallFeather(c, renderCtx, 0, 16, gBounds);
                c.restore();
              } else {
                _applyRockWallFeather(c, renderCtx, 0, -dir * 16, gBounds);
              }
              return true;
            },
            drawAlphaMask: (c) => {
              const mg = c.createLinearGradient(sx, yL, tipX, endY);
              mg.addColorStop(0, 'rgba(255, 255, 255, 0)');
              mg.addColorStop(0.03, 'rgba(255, 255, 255, 0)');
              mg.addColorStop(tAnchorSolid, 'rgba(255, 255, 255, 1)');
              if (spanToOpp) {
                mg.addColorStop(tOppSolid, 'rgba(255, 255, 255, 1)');
                mg.addColorStop(0.97, 'rgba(255, 255, 255, 0)');
                mg.addColorStop(1, 'rgba(255, 255, 255, 0)');
              } else {
                mg.addColorStop(1, 'rgba(255, 255, 255, 1)');
              }
              c.fillStyle = mg;
              c.fillRect(gMinX - 4, gMinY - 4, gMaxX - gMinX + 8, gMaxY - gMinY + 8);
            },
          }
        );
      }

      if (!drewSteelHiRes) {
        const steelGrad = ctx.createLinearGradient(sx, yL, tipX, endY);
        steelGrad.addColorStop(0, `rgba(${mergeRgb}, 0)`);
        steelGrad.addColorStop(0.12, `rgba(${steelMid}, ${(0.99 * vis).toFixed(3)})`);
        steelGrad.addColorStop(0.55, `rgba(${steelDark}, ${(0.98 * vis).toFixed(3)})`);
        if (spanToOpp) {
          steelGrad.addColorStop(0.88, `rgba(${rustStr}, ${(0.98 * vis).toFixed(3)})`);
          steelGrad.addColorStop(1, `rgba(${mergeRgb}, 0)`);
        } else {
          steelGrad.addColorStop(1, `rgba(${rustStr}, ${(0.95 * vis).toFixed(3)})`);
        }
        ctx.fillStyle = steelGrad;
        traceGirderPath(ctx);
        try {
          ctx.fill('evenodd');
        } catch {
          ctx.fill();
        }
      }

      const flangeGrad = ctx.createLinearGradient(sx, yL, tipX, endY);
      flangeGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      flangeGrad.addColorStop(0.14, `rgba(${steelHl}, ${((0.20 + rimPower * 0.52) * vis).toFixed(3)})`);
      flangeGrad.addColorStop(spanToOpp ? 0.86 : 1, `rgba(${steelHl}, ${((0.20 + rimPower * 0.52) * vis).toFixed(3)})`);
      if (spanToOpp) flangeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.strokeStyle = flangeGrad;
      ctx.lineWidth = Math.max(2.0, bw * 0.085);
      ctx.beginPath();
      ctx.moveTo(sx - bw * 0.70, wallY(-bw * 0.70) - dir * 8);
      ctx.lineTo(tipX - endHalfW * 0.92, spanToOpp ? endLipY + dir * 8 : endLipY);
      ctx.moveTo(sx + bw * 0.70, wallY(bw * 0.70) - dir * 8);
      ctx.lineTo(tipX + endHalfW * 0.92, spanToOpp ? endLipY + dir * 8 : endLipY);
      ctx.stroke();

      for (let h = 0; h < holes.length; h++) {
        const { hx, hy, hr, u } = holes[h];
        ctx.strokeStyle = rimPower > 0.08
          ? `rgba(${rimRgb}, ${(rimPower * 0.65 * vis).toFixed(3)})`
          : `rgba(${steelHl}, ${(0.26 * vis).toFixed(3)})`;
        ctx.lineWidth = rimPower > 0.08 ? 1.45 : 1.0;
        ctx.beginPath();
        ctx.ellipse(hx, hy, hr, hr, 0, 0, Math.PI * 2);
        ctx.stroke();

        const flX = bw * (spanToOpp ? 0.50 : 0.52 - u * 0.12);
        ctx.fillStyle = `rgba(${steelHl}, ${((0.32 + rimPower * 0.42) * vis).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(hx - flX, hy, 1.6, 1.6, 0, 0, Math.PI * 2);
        ctx.ellipse(hx + flX, hy, 1.6, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!spanToOpp) {
        ctx.strokeStyle = `rgba(${kelpStr}, ${(0.84 * vis).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.6, bw * 0.07);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tipX + bw * 0.28, endLipY);
        ctx.quadraticCurveTo(tipX + bw * 0.34 + swayPx * 0.7, endLipY + dir * hPx * 0.18, tipX + bw * 0.18 + swayPx * 1.4, endLipY + dir * hPx * 0.34);
        ctx.stroke();
      }
      break;
    }

    case 'mine-beam': {
      const bw = Math.max(14, wPx * 0.34);
      const tipX = sx + leanPx * 1.0;
      const tipY = sy + dir * hPx * 0.90;
      const pts = [
        { x: sx - bw * 0.64, y: wallY(-bw * 0.64) },
        { x: tipX - bw * 0.50, y: tipY },
        { x: tipX + bw * 0.50, y: tipY },
        { x: sx + bw * 0.64, y: wallY(bw * 0.64) },
      ];
      const drawTimberDetail = (c) => {
        c.strokeStyle = `rgba(${_shadeNearRgb(pal.rockDark, light, isNearPlane, 0.75)}, ${(0.60 * vis).toFixed(3)})`;
        c.lineWidth = 1.2;
        for (const f of [-0.24, 0.04, 0.26]) {
          c.beginPath();
          c.moveTo(sx + bw * f, wallY(bw * f));
          c.lineTo(tipX + bw * f * 0.84, tipY);
          c.stroke();
        }
        const bx = sx + (tipX - sx) * 0.72;
        const by = sy + (tipY - sy) * 0.72;
        c.strokeStyle = `rgba(${_shadeNearRgb(pal.rustRgb, light, isNearPlane, 1.05)}, ${(0.90 * vis).toFixed(3)})`;
        c.lineWidth = Math.max(4, bw * 0.22);
        c.beginPath();
        c.moveTo(bx - bw * 0.58, by);
        c.lineTo(bx + bw * 0.58, by);
        c.stroke();
      };
      _fillWallHuggingRock(ctx, sx, sy, wPx, hPx, dir, wallY, pal, light, null, isNearPlane, pts, drawTimberDetail, renderCtx);
      break;
    }

    case 'wreck-railing': {
      _drawWallWeldCollar(ctx, sx, wallY, wPx * 0.56, dir, 7, 24, mergeRgb, 0.70, vis, renderCtx, light, isNearPlane);
      const posts = 3;
      const railOffset = dir * hPx * 0.76;
      const steelMid = _shadeNearRgb(pal.rockMid, light, isNearPlane, 0.96);
      const rustStr = _shadeNearRgb(pal.rustRgb, light, isNearPlane, 1.02);
      const floraStr = _shadeNearRgb(pal.floraMid, light, isNearPlane, 1.0);

      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(3.2, wPx * 0.065);
      for (let i = 0; i < posts; i++) {
        const frac = i / (posts - 1) - 0.5;
        const dx0 = frac * wPx * 0.92;
        const px = sx + dx0;
        const py = wallY(dx0);
        ctx.strokeStyle = `rgba(${i === 1 ? rustStr : steelMid}, ${(0.95 * vis).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + leanPx * 0.45, py + railOffset);
        ctx.stroke();
      }
      const xL = sx - wPx * 0.56 + leanPx * 0.45;
      const xR = sx + wPx * 0.56 + leanPx * 0.45;
      const yL = wallY(-wPx * 0.56);
      const yR = wallY(wPx * 0.56);
      for (const hFrac of [0.76, 0.42]) {
        const off = dir * hPx * hFrac;
        ctx.strokeStyle = `rgba(${steelMid}, ${(0.94 * vis).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(xL, yL + off);
        ctx.quadraticCurveTo(sx + leanPx * 0.45, sy + off + dir * hPx * 0.04, xR, yR + off);
        ctx.stroke();
      }
      if (rimPower > 0.08) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = `rgba(${rimRgb}, ${(rimPower * 0.62 * vis).toFixed(3)})`;
        ctx.lineWidth = 1.45;
        ctx.beginPath();
        ctx.moveTo(xL, yL + railOffset - dir * 1.4);
        ctx.quadraticCurveTo(sx + leanPx * 0.45, sy + railOffset + dir * hPx * 0.04 - dir * 1.4, xR, yR + railOffset - dir * 1.4);
        ctx.stroke();
        ctx.restore();
      }
      ctx.strokeStyle = `rgba(${floraStr}, ${(0.82 * vis).toFixed(3)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx - wPx * 0.46 + leanPx * 0.45, wallY(-wPx * 0.46) + railOffset);
      ctx.quadraticCurveTo(sx + leanPx * 0.45 + swayPx * 0.75, sy + railOffset - dir * hPx * 0.22, sx + wPx * 0.46 + leanPx * 0.45, wallY(wPx * 0.46) + railOffset);
      ctx.stroke();
      break;
    }

    case 'crystal-cluster': {
      // High-res faceted amethyst/quartz crystal cluster embedded into an opaque textured geode rock socket
      // (zero leaking light behind crystal bases; internal crystal cleavage fractures shimmer under torch/sun!)
      const count = el.subCount + 3;
      const litRight = light.lightDirX >= 0;
      const baseShaded = _shadeNearRgb(pal.floraDark, light, isNearPlane, 0.90);
      const midShaded = _shadeNearRgb(pal.rockMid, light, isNearPlane, 1.06);
      const tipShaded = _shadeNearRgb(pal.rockHighlight, light, isNearPlane, 1.24);
      const prismShaded = _shadeNearRgb(pal.rustRgb, light, isNearPlane, 1.14);

      // Seal the wall joint with an extended mineral rock socket + tucked AO crevice
      _drawWallWeldCollar(ctx, sx, wallY, wPx * 0.46, dir, Math.max(5, Math.min(8, hPx * 0.065)), Math.max(30, hPx * 0.24), mergeRgb, 0.50, vis);

      const spires = [];
      let minX = sx - wPx;
      let maxX = sx + wPx;
      let minY = Math.min(sy, sy + dir * hPx) - 22;
      let maxY = Math.max(sy, sy + dir * hPx) + 22;

      for (let i = 0; i < count; i++) {
        const order = i === count - 1 ? Math.floor(count / 2) : (i >= Math.floor(count / 2) ? i + 1 : i);
        const u = count <= 1 ? 0 : order / (count - 1) - 0.5;
        const isHero = order === Math.floor(count / 2);
        const tilt = u * 1.08 + el.lean * 0.38 + (_hash01(el.seed + order * 19) - 0.5) * 0.14;
        const cLen = hPx * (isHero ? 1.02 : 0.44 + (1 - Math.abs(u) * 1.35) * 0.34 + _hash01(el.seed + order * 7) * 0.12);
        const cHalfW = Math.max(4.5, wPx * (isHero ? 0.145 : 0.10));

        const dx0 = u * wPx * 0.48;
        const bx = sx + dx0;
        const by = wallY(dx0) - dir * 32;
        const ax = Math.sin(tilt);
        const ay = dir * Math.cos(tilt);
        const px = Math.cos(tilt);
        const py = -dir * Math.sin(tilt);

        const tipX = bx + ax * (cLen + 18);
        const tipY = by + ay * (cLen + 18);
        const shDist = (cLen + 18) * 0.74;
        const lShX = bx + ax * shDist - px * cHalfW;
        const lShY = by + ay * shDist - py * cHalfW;
        const rShX = bx + ax * shDist + px * cHalfW;
        const rShY = by + ay * shDist + py * cHalfW;
        const lBaseX = bx - px * cHalfW * 0.88;
        const lBaseY = by - py * cHalfW * 0.88;
        const rBaseX = bx + px * cHalfW * 0.88;
        const rBaseY = by + py * cHalfW * 0.88;
        for (const [qx, qy] of [[lBaseX, lBaseY], [lShX, lShY], [tipX, tipY], [rShX, rShY], [rBaseX, rBaseY]]) {
          if (qx - 6 < minX) minX = qx - 6;
          if (qx + 6 > maxX) maxX = qx + 6;
          if (qy - 6 < minY) minY = qy - 6;
          if (qy + 6 > maxY) maxY = qy + 6;
        }
        spires.push({ isHero, bx, by, tipX, tipY, lShX, lShY, rShX, rShY, lBaseX, lBaseY, rBaseX, rBaseY });
      }

      const traceSpireSubpath = (c, sp) => {
        c.moveTo(sp.lBaseX, sp.lBaseY);
        c.lineTo(sp.lShX, sp.lShY);
        c.lineTo(sp.tipX, sp.tipY);
        c.lineTo(sp.rShX, sp.rShY);
        c.lineTo(sp.rBaseX, sp.rBaseY);
        c.closePath();
      };

      // Cached tight-sprite high-res 512px faceted amethyst/quartz cluster (`tex-fg-crystal.jpg`)!
      // Pixel-exact `rockChunks` mask trims buried roots along the exact curved/sloped cave rock strata!
      const { nx: cNx, ny: cNy } = _computeWallNormal(wallY, wPx * 0.46, dir);
      let drewCrystalHiRes = false;
      if (renderCtx?.mats?.crystal) {
        const geomKey = _buildGeomCacheKey(el, wallProfile, renderCtx.scale || 24, 'cry');
        const cacheKey = _buildSpriteCacheKey(el, light, rimPower, wallProfile, renderCtx.scale || 24, 'cry');
        const cBounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        drewCrystalHiRes = _compositeHiResShape(
          ctx,
          null,
          renderCtx.cw,
          renderCtx.ch,
          cBounds,
          {
            tracePath: (sctx) => {
              sctx.beginPath();
              for (const sp of spires) {
                traceSpireSubpath(sctx, sp);
              }
            },
            pattern: renderCtx.mats.crystal,
            texOriginX: renderCtx.texOriginX,
            texOriginY: renderCtx.texOriginY,
            texScale: 0.44,
            light,
            isNearPlane,
            boost: 1.62,
            cacheEl: el,
            cacheKey,
            geomKey,
            anchorX: sx,
            anchorY: sy,
            renderCtx,
            drawOverlay: (c) => {
              // Subtle mineral crevice shading right at the crystal-rock base
              const bg = c.createLinearGradient(sx - cNx * 12, sy - cNy * 12, sx + cNx * Math.min(30, hPx * 0.30), sy + cNy * Math.min(30, hPx * 0.30));
              bg.addColorStop(0, `rgba(${mergeRgb}, 0.65)`);
              bg.addColorStop(1, 'rgba(0, 0, 0, 0)');
              c.fillStyle = bg;
              c.fillRect(minX, minY, maxX - minX, maxY - minY);

              for (const sp of spires) {
                c.fillStyle = 'rgba(4, 8, 22, 0.42)';
                c.beginPath();
                c.moveTo(sp.bx, sp.by);
                c.lineTo(sp.tipX, sp.tipY);
                if (litRight) {
                  c.lineTo(sp.lShX, sp.lShY);
                  c.lineTo(sp.lBaseX, sp.lBaseY);
                } else {
                  c.lineTo(sp.rShX, sp.rShY);
                  c.lineTo(sp.rBaseX, sp.rBaseY);
                }
                c.closePath();
                c.fill();

                if (rimPower > 0.06) {
                  const fGrad = c.createLinearGradient(sp.tipX, sp.tipY, sp.bx, sp.by);
                  fGrad.addColorStop(0, `rgba(${rimRgb}, ${(rimPower * 0.56).toFixed(3)})`);
                  fGrad.addColorStop(0.58, `rgba(${prismShaded}, ${(rimPower * 0.28).toFixed(3)})`);
                  fGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                  c.fillStyle = fGrad;
                  c.beginPath();
                  c.moveTo(sp.bx, sp.by);
                  c.lineTo(sp.tipX, sp.tipY);
                  if (litRight) {
                    c.lineTo(sp.rShX, sp.rShY);
                    c.lineTo(sp.rBaseX, sp.rBaseY);
                  } else {
                    c.lineTo(sp.lShX, sp.lShY);
                    c.lineTo(sp.lBaseX, sp.lBaseY);
                  }
                  c.closePath();
                  c.fill();
                }
              }

              // Batched crisp crystal tip rim highlight inside cached sprite (ZERO mainCtx 'screen' flushes!)
              if (rimPower > 0.06) {
                c.strokeStyle = `rgba(${rimRgb}, ${(rimPower * 0.72).toFixed(3)})`;
                c.lineWidth = 1.4;
                c.beginPath();
                for (const sp of spires) {
                  c.moveTo(sp.lShX, sp.lShY);
                  c.lineTo(sp.tipX, sp.tipY);
                  c.lineTo(sp.rShX, sp.rShY);
                }
                c.stroke();
              }
            },
            drawRockMask: (c) => _applyRockWallFeather(c, renderCtx, -cNx * 14, -cNy * 14, cBounds),
            drawAlphaMask: (c) => {
              const mg = c.createLinearGradient(sx - cNx * 22, sy - cNy * 22, sx + cNx * 4, sy + cNy * 4);
              mg.addColorStop(0, 'rgba(255, 255, 255, 0)');
              mg.addColorStop(0.28, 'rgba(255, 255, 255, 0.45)');
              mg.addColorStop(0.75, 'rgba(255, 255, 255, 1)');
              mg.addColorStop(1, 'rgba(255, 255, 255, 1)');
              c.fillStyle = mg;
              c.fillRect(minX - 4, minY - 4, maxX - minX + 8, maxY - minY + 8);
            },
          }
        );
      }

      if (!drewCrystalHiRes) {
        for (const sp of spires) {
          const cg = ctx.createLinearGradient(sp.bx, sp.by, sp.tipX, sp.tipY);
          cg.addColorStop(0, `rgba(${mergeRgb}, ${(0.96 * vis).toFixed(3)})`);
          cg.addColorStop(0.20, `rgba(${baseShaded}, ${(0.95 * vis).toFixed(3)})`);
          cg.addColorStop(0.62, `rgba(${midShaded}, ${(0.88 * vis).toFixed(3)})`);
          cg.addColorStop(1, `rgba(${tipShaded}, ${(0.88 * vis).toFixed(3)})`);
          ctx.fillStyle = cg;
          ctx.beginPath();
          traceSpireSubpath(ctx, sp);
          ctx.fill();
        }
      }
      break;
    }

    case 'icicle-cluster': {
      // High-res trapped-bubble glacial blue ice spears rooted into an opaque frozen cornice (zero light leak!)
      const spears = el.subCount + 3;
      const halfW = wPx * 0.66;
      const iceDark = _shadeNearRgb(pal.rockDark, light, isNearPlane, 0.88);
      const iceMid = _shadeNearRgb(pal.rockMid, light, isNearPlane, 1.05);
      const iceTip = _shadeNearRgb(pal.rockHighlight, light, isNearPlane, 1.22);

      const spearGeoms = [];
      let minX = sx - halfW * 1.15;
      let maxX = sx + halfW * 1.15;
      let minY = Math.min(sy, sy + dir * hPx) - 42;
      let maxY = Math.max(sy, sy + dir * hPx) + 42;
      for (let i = 0; i < spears; i++) {
        const u = spears <= 1 ? 0 : i / (spears - 1) - 0.5;
        const j = (_hash01(el.seed + i * 29.3) - 0.5) * 0.14;
        const dx0 = (u + j) * halfW * 1.62;
        const bx = sx + dx0;
        const by = wallY(dx0);
        const isMain = Math.abs(u) < 0.22;
        const len = hPx * (isMain ? 0.84 + _hash01(el.seed + i * 7) * 0.22 : 0.36 + _hash01(el.seed + i * 17) * 0.40);
        const halfBase = Math.max(3.8, wPx * (isMain ? 0.105 : 0.072));
        const tipX = bx + leanPx * 0.28;
        const tipY = by + dir * len;
        const rootYL = wallY(dx0 - halfBase) - dir * 34;
        const rootYR = wallY(dx0 + halfBase) - dir * 34;
        for (const qy of [rootYL, rootYR, by, tipY]) {
          if (qy - 8 < minY) minY = qy - 8;
          if (qy + 8 > maxY) maxY = qy + 8;
        }
        if (bx - halfBase - 8 < minX) minX = bx - halfBase - 8;
        if (bx + halfBase + 8 > maxX) maxX = bx + halfBase + 8;
        spearGeoms.push({ bx, by, dx0, isMain, len, halfBase, tipX, tipY, rootYL, rootYR });
      }

      const traceIcicleSubpath = (c, g) => {
        c.moveTo(g.bx - g.halfBase * 1.08, g.rootYL);
        c.quadraticCurveTo(g.bx - g.halfBase * 0.34, g.by + dir * g.len * 0.50, g.tipX, g.tipY);
        c.quadraticCurveTo(g.bx + g.halfBase * 0.38, g.by + dir * g.len * 0.50, g.bx + g.halfBase * 1.08, g.rootYR);
        c.closePath();
      };

      const { nx: iNx, ny: iNy } = _computeWallNormal(wallY, halfW, dir);
      let drewIceHiRes = false;
      if (renderCtx?.mats?.ice) {
        const geomKey = _buildGeomCacheKey(el, wallProfile, renderCtx.scale || 24, 'ice');
        const cacheKey = _buildSpriteCacheKey(el, light, rimPower, wallProfile, renderCtx.scale || 24, 'ice');
        const iBounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        drewIceHiRes = _compositeHiResShape(
          ctx,
          null,
          renderCtx.cw,
          renderCtx.ch,
          iBounds,
          {
            tracePath: (sctx) => {
              sctx.beginPath();
              for (const g of spearGeoms) {
                traceIcicleSubpath(sctx, g);
              }
            },
            pattern: renderCtx.mats.ice,
            texOriginX: renderCtx.texOriginX,
            texOriginY: renderCtx.texOriginY,
            texScale: 0.44,
            light,
            isNearPlane,
            boost: 1.54,
            cacheEl: el,
            cacheKey,
            geomKey,
            anchorX: sx,
            anchorY: sy,
            renderCtx,
            drawOverlay: (c) => {
              const ig = c.createLinearGradient(sx - iNx * 12, sy - iNy * 12, sx + iNx * Math.min(30, hPx * 0.30), sy + iNy * Math.min(30, hPx * 0.30));
              ig.addColorStop(0, `rgba(${mergeRgb}, 0.65)`);
              ig.addColorStop(1, 'rgba(0, 0, 0, 0)');
              c.fillStyle = ig;
              c.fillRect(minX, minY, maxX - minX, maxY - minY);

              // Batched crisp glacial specular rim inside cached sprite (ZERO mainCtx 'screen' flushes!)
              if (rimPower > 0.06) {
                const hlSign = light.lightDirX >= 0 ? 1 : -1;
                c.strokeStyle = `rgba(${rimRgb}, ${(rimPower * 0.72).toFixed(3)})`;
                c.lineWidth = 1.35;
                c.beginPath();
                for (const g of spearGeoms) {
                  c.moveTo(g.bx + hlSign * g.halfBase * 0.42, g.by + dir * 3);
                  c.quadraticCurveTo(g.bx + hlSign * g.halfBase * 0.16, g.by + dir * g.len * 0.52, g.tipX, g.tipY);
                }
                c.stroke();
              }
            },
            drawRockMask: (c) => _applyRockWallFeather(c, renderCtx, -iNx * 14, -iNy * 14, iBounds),
            drawAlphaMask: (c) => {
              const mg = c.createLinearGradient(sx - iNx * 22, sy - iNy * 22, sx + iNx * 4, sy + iNy * 4);
              mg.addColorStop(0, 'rgba(255, 255, 255, 0)');
              mg.addColorStop(0.28, 'rgba(255, 255, 255, 0.45)');
              mg.addColorStop(0.75, 'rgba(255, 255, 255, 1)');
              mg.addColorStop(1, 'rgba(255, 255, 255, 1)');
              c.fillStyle = mg;
              c.fillRect(minX - 4, minY - 4, maxX - minX + 8, maxY - minY + 8);
            },
          }
        );
      }

      if (!drewIceHiRes) {
        _drawWallWeldCollar(ctx, sx, wallY, halfW * 0.94, dir, Math.max(5, Math.min(7, hPx * 0.065)), Math.max(30, hPx * 0.24), mergeRgb, 0.50, vis);
        for (const g of spearGeoms) {
          const ig = ctx.createLinearGradient(g.bx, g.by, g.tipX, g.tipY);
          ig.addColorStop(0, `rgba(${mergeRgb}, ${(0.95 * vis).toFixed(3)})`);
          ig.addColorStop(0.22, `rgba(${iceDark}, ${(0.92 * vis).toFixed(3)})`);
          ig.addColorStop(0.76, `rgba(${iceMid}, ${(0.88 * vis).toFixed(3)})`);
          ig.addColorStop(1, `rgba(${rimPower > 0.10 ? rimRgb : iceTip}, ${(0.92 * vis).toFixed(3)})`);
          ctx.fillStyle = ig;
          ctx.beginPath();
          traceIcicleSubpath(ctx, g);
          ctx.fill();
        }
      }
      break;
    }

    case 'monolith-block': {
      const bw = wPx * 0.52;
      const stepH = hPx * 0.54;
      const pts = [
        { x: sx - bw, y: wallY(-bw) },
        { x: sx - bw * 0.90, y: wallY(-bw * 0.90) + dir * stepH * 0.72 },
        { x: sx - bw * 0.48, y: wallY(-bw * 0.48) + dir * stepH * 0.74 },
        { x: sx - bw * 0.40, y: wallY(-bw * 0.40) + dir * hPx },
        { x: sx + bw * 0.34, y: wallY(bw * 0.34) + dir * hPx },
        { x: sx + bw * 0.42, y: wallY(bw * 0.42) + dir * stepH },
        { x: sx + bw * 0.90, y: wallY(bw * 0.90) + dir * stepH },
        { x: sx + bw, y: wallY(bw) },
      ];
      const drawCarvedRelief = (c) => {
        c.strokeStyle = `rgba(${_shadeNearRgb(pal.rustRgb, light, isNearPlane, 1.15)}, ${(0.52 * lit * vis).toFixed(3)})`;
        c.lineWidth = Math.max(1.2, hPx * 0.018);
        const yBand1 = sy + dir * hPx * 0.76;
        const yBand2 = sy + dir * hPx * 0.42;
        c.beginPath();
        c.moveTo(sx - bw * 0.28, yBand1 - bw * 0.28 * slope);
        c.lineTo(sx + bw * 0.24, yBand1 + bw * 0.24 * slope);
        c.moveTo(sx - bw * 0.72, yBand2 - bw * 0.72 * slope);
        c.lineTo(sx + bw * 0.72, yBand2 + bw * 0.72 * slope);
        c.stroke();
      };
      _fillWallHuggingRock(ctx, sx, sy, wPx, hPx, dir, wallY, pal, light, rockPattern, isNearPlane, pts, drawCarvedRelief, renderCtx);
      if (light.causticAlpha > 0.02) _drawCausticRibbons(ctx, sx, sy, wPx, hPx, dir, timeSec, reduced, light);
      break;
    }

    case 'basalt-spire': {
      // Clean monotonic stepped hexagonal volcanic basalt columns with glowing magma seams!
      const cols = Math.max(3, Math.min(5, el.subCount + 1));
      const halfW = wPx * 0.46;
      const colData = [];
      const pts = [{ x: sx - halfW, y: wallY(-halfW) }];
      for (let i = 0; i < cols; i++) {
        const u0 = i / cols;
        const u1 = (i + 1) / cols;
        const centerDist = Math.abs((i + 0.5) / cols - 0.5) * 2;
        const ch = hPx * (0.98 - centerDist * 0.46 + ((i * 19 + Math.floor(el.seed)) % 7) * 0.02);
        const dx0 = (u0 - 0.5) * halfW * 2;
        const dx1 = (u1 - 0.5) * halfW * 2;
        const x0 = sx + dx0;
        const x1 = sx + dx1;
        const y0 = wallY(dx0);
        const y1 = wallY(dx1);
        const by = (y0 + y1) * 0.5;
        colData.push({ x0, x1, y0, y1, by, h: ch });
        pts.push({ x: x0 + (x1 - x0) * 0.08, y: by + dir * ch });
        pts.push({ x: x1 - (x1 - x0) * 0.08, y: by + dir * (ch * 0.95) });
      }
      pts.push({ x: sx + halfW, y: wallY(halfW) });

      const drawBasaltColumns = (c) => {
        const litRight = light.lightDirX >= 0;
        const facetHl = _shadeNearRgb(pal.rockHighlight, light, isNearPlane, 1.12);
        for (let i = 0; i < colData.length; i++) {
          const col = colData[i];
          const midX = (col.x0 + col.x1) * 0.5;
          c.fillStyle = `rgba(${facetHl}, ${(0.28 * lit * vis).toFixed(3)})`;
          c.beginPath();
          c.moveTo(litRight ? midX : col.x0, col.by);
          c.lineTo(litRight ? midX : col.x0, col.by + dir * col.h);
          c.lineTo(litRight ? col.x1 : midX, col.by + dir * col.h * 0.95);
          c.lineTo(litRight ? col.x1 : midX, col.by);
          c.closePath();
          c.fill();
          if (i > 0) {
            const seamVis = el.biome === 'volcanic' ? Math.max(light.ventLit * 0.92, lit * 0.50) * vis : lit * 0.55 * vis;
            c.strokeStyle = el.biome === 'volcanic'
              ? `rgba(255, 118, 42, ${seamVis.toFixed(3)})`
              : `rgba(${_shadeNearRgb(pal.rockDark, light, isNearPlane, 0.8)}, ${seamVis.toFixed(3)})`;
            c.lineWidth = el.biome === 'volcanic' ? 1.6 : 1.0;
            c.beginPath();
            c.moveTo(col.x0, col.y0);
            c.lineTo(col.x0, col.y0 + dir * Math.min(col.h, colData[i - 1].h) * 0.84);
            c.stroke();
          }
        }
      };
      _fillWallHuggingRock(ctx, sx, sy, wPx, hPx, dir, wallY, pal, light, rockPattern, isNearPlane, pts, drawBasaltColumns, renderCtx);
      break;
    }

    case 'limestone-overhang':
    default: {
      // Strictly monotonic organic karst limestone overhang ridge with extended flared wings locked to the live SDF wall contour!
      const halfW = wPx * 0.62;
      const ridgeSteps = 10;
      const pts = [];
      for (let i = 0; i <= ridgeSteps; i++) {
        const u = i / ridgeSteps; // 0 -> 1 strictly increasing X!
        const dx = (u - 0.5) * halfW * 2;
        const env = Math.pow(Math.sin(u * Math.PI), 1.28);
        const lobe =
          0.66 +
          0.26 * Math.sin(u * Math.PI * 2.4 + el.seed * 0.7) +
          0.14 * Math.sin(u * Math.PI * 5.2 + el.seed * 1.9);
        const h = i === 0 || i === ridgeSteps ? 0 : hPx * env * _clamp(lobe, 0.28, 1.08);
        pts.push({ x: sx + dx, y: wallY(dx) + dir * h });
      }

      const drawKarstDetail = (c) => {
        c.strokeStyle = `rgba(${_shadeNearRgb(pal.rockHighlight, light, isNearPlane, 0.95)}, ${(0.20 * lit * vis).toFixed(3)})`;
        c.lineWidth = 1.2;
        for (const frac of [0.34, 0.58]) {
          const yL = wallY(-halfW * 0.58) + dir * hPx * frac;
          const yM = sy + dir * hPx * (frac + 0.06);
          const yR = wallY(halfW * 0.58) + dir * hPx * (frac - 0.02);
          c.beginPath();
          c.moveTo(sx - halfW * 0.58, yL);
          c.quadraticCurveTo(sx, yM, sx + halfW * 0.58, yR);
          c.stroke();
        }
        if (el.biome === 'cenote' && el.y < 24) {
          c.fillStyle = `rgba(${_shadeNearRgb(pal.mossRgb, light, isNearPlane, 1.15)}, ${(0.44 * lit * vis).toFixed(3)})`;
          c.beginPath();
          c.ellipse(sx - halfW * 0.22, wallY(-halfW * 0.22) + dir * hPx * 0.54, halfW * 0.22, Math.max(4, hPx * 0.085), Math.atan(slope), 0, Math.PI * 2);
          c.fill();
        }
      };

      _fillWallHuggingRock(ctx, sx, sy, wPx, hPx, dir, wallY, pal, light, rockPattern, isNearPlane, pts, drawKarstDetail, renderCtx);
      if (light.causticAlpha > 0.02) _drawCausticRibbons(ctx, sx, sy, wPx, hPx, dir, timeSec, reduced, light);
      break;
    }
  }
}

/**
 * Optical Finish Accents (diamond crystal/ice twinkles, bioluminescent micro-spores, wet-steel specular).
 */
function _drawLightingAccent(ctx, el, sx, sy, wPx, hPx, dir, pal, swayPx, light, timeSec, reduced) {
  const vis = light.lightVis;
  if (vis < 0.06) return;
  const realLight = Math.max(light.beamLit, light.backLit, light.sunLit * 0.85, light.ventLit * 0.9);
  if (realLight < 0.16 && light.biolumLit < 0.18) return;

  const leanPx = el.lean * wPx;
  const slope = Number.isFinite(el.wallSlope) ? el.wallSlope : 0;
  const wallY = (dx) => sy + dx * slope;
  const rimRgb = _blendWithLight(pal.rimRgb, light, _clamp(light.beamLit * 0.72 + light.backLit * 0.78 + light.ventLit * 0.82, 0.2, 0.88));
  const sssRgb = _blendWithLight(pal.sssRgb, light, 0.48);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  if (el.kind === 'kelp-fronds' || el.kind === 'cenote-roots') {
    if (light.biolumLit > 0.18) {
      for (let b = 0; b < 3; b++) {
        const bx = sx + ((b / 2) - 0.5) * wPx * 0.75 + swayPx * 0.5;
        const by = wallY(((b / 2) - 0.5) * wPx * 0.75) + dir * hPx * (0.36 + ((b * 37) % 10) * 0.05);
        const pulse = 0.45 + 0.55 * Math.sin(timeSec * 2.8 + b * 1.9 + el.phase);
        ctx.fillStyle = `rgba(110, 242, 255, ${(light.biolumLit * pulse * 0.76 * vis).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(bx, by, 2.2, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Dynamic torch-reactive wet leaf/bark micro-specular shimmer (zero sprite rebuilds!)
    const wetA = _clamp((light.beamLit - 0.22) * 0.72 + light.sunLit * 0.28, 0, 0.62) * vis;
    if (wetA > 0.10) {
      const shimmer = reduced ? 0.85 : 0.62 + 0.38 * Math.sin(timeSec * 3.6 + el.phase);
      const gx = sx + light.lightDirX * wPx * 0.24 + swayPx * 0.45;
      const gy = sy + dir * hPx * 0.56;
      _drawStarGlint(ctx, gx, gy, Math.max(3.2, hPx * 0.048), sssRgb, wetA * shimmer);
    }
  } else if (el.kind === 'crystal-cluster' || el.kind === 'icicle-cluster') {
    const glintA = _clamp((light.beamLit - 0.16) * 0.98 + light.sunLit * 0.36 + light.backLit * 0.36, 0, 0.94) * vis;
    if (glintA > 0.08) {
      const twinkle = reduced ? 1 : 0.70 + 0.30 * Math.sin(timeSec * 4.4 + el.phase);
      const beamShift = light.lightDirX * wPx * 0.12;
      _drawStarGlint(ctx, sx + leanPx * 0.36 + beamShift, sy + dir * hPx * 0.92, Math.max(5.5, hPx * 0.095), rimRgb, glintA * twinkle);
      if (glintA > 0.28) {
        _drawStarGlint(ctx, sx - wPx * 0.20 + beamShift * 0.6, wallY(-wPx * 0.20) + dir * hPx * 0.56, Math.max(3.6, hPx * 0.058), sssRgb, glintA * 0.68 * twinkle);
      }
    }
  } else if (el.kind === 'wreck-girder' || el.kind === 'rock-pillar') {
    const rimA = _clamp(light.backLit * 0.48 + (light.beamLit - 0.18) * 0.50, 0, 0.68) * vis;
    if (rimA > 0.09) {
      const bw = Math.max(18, wPx * (el.kind === 'rock-pillar' ? 0.36 : 0.42));
      const sideSign = light.lightDirX >= 0 ? 1 : -1;
      const tipX = sx + leanPx * 0.9 + sideSign * bw * 0.44;
      const tipY = sy + dir * hPx * 0.86;
      const baseX = sx + sideSign * bw * 0.62;
      const baseY = wallY(sideSign * bw * 0.62) + dir * hPx * 0.14;
      const rGrad = ctx.createLinearGradient(tipX, tipY, baseX, baseY);
      rGrad.addColorStop(0, `rgba(${rimRgb}, ${(rimA * 0.85).toFixed(3)})`);
      rGrad.addColorStop(0.65, `rgba(${rimRgb}, ${(rimA * 0.28).toFixed(3)})`);
      rGrad.addColorStop(1, `rgba(${rimRgb}, 0)`);
      ctx.strokeStyle = rGrad;
      ctx.lineWidth = el.kind === 'rock-pillar' ? 2.2 : 2.0;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
    }
  }

  ctx.restore();
}

export const foregroundDepthRendererMethods = {
  /**
   * Preload high-res 512x512 foreground botanical/mineral textures during level initialization
   * so players immediately see photorealistic kelp, roots, crystals & glacial ice on frame 1.
   */
  _preloadForegroundTextures() {
    if (typeof this._loadRawImageAsset !== 'function') return Promise.resolve();
    if (!this._fgMatCache) this._fgMatCache = new Map();
    const ctx = this.ctx;
    const tasks = Object.entries(FG_MATERIAL_ASSETS).map(([matKey, assetPath]) => {
      const existing = this._fgMatCache.get(matKey);
      if (existing && existing !== 'loading') return Promise.resolve(existing);
      this._fgMatCache.set(matKey, 'loading');
      return this._loadRawImageAsset(assetPath).then((img) => {
        if (img && (img.naturalWidth || img.width) > 0 && ctx && typeof ctx.createPattern === 'function') {
          try {
            const pat = ctx.createPattern(img, 'repeat');
            this._fgMatCache.set(matKey, pat);
            return pat;
          } catch {
            this._fgMatCache.delete(matKey);
          }
        }
        return null;
      });
    });
    return Promise.all(tasks);
  },

  _prewarmForegroundSprites(level = this.level) {
    if (!level || !Array.isArray(level.segments) || level.segments.length === 0) return;
    const elements = buildForegroundDepthElements(level);
    if (!elements || elements.length === 0) return;
    const spawnX = level.spawn?.x ?? 0;
    const spawnY = level.spawn?.y ?? 2;
    const scale = this.pxPerM || 24;
    // Pre-sample live SDF wall profiles for the nearest 6 formations around spawn during level load (0ms first-frame hitch!)
    const sorted = elements
      .map((el) => ({ el, d2: (el.x - spawnX) * (el.x - spawnX) + (el.y - spawnY) * (el.y - spawnY) }))
      .sort((a, b) => a.d2 - b.d2);
    const limit = Math.min(6, sorted.length);
    for (let i = 0; i < limit; i++) {
      const el = sorted[i].el;
      const dir = el.side === 'ceiling' ? 1 : -1;
      const sx = 640 + (el.x - spawnX) * scale;
      const sy = 360 + (el.y - spawnY) * scale;
      _buildLiveWallSampler(level, el, sx, sy, el.widthM * scale, dir, spawnX, spawnY, 640, 360, scale);
    }
  },

  /**
   * Draw near-plane light-integrated foreground formations in front of the diver & volumetric lighting.
   */
  _drawForegroundDepthElements(
    ctx,
    cw,
    ch,
    effCamX,
    effCamY,
    viewCenterX,
    viewCenterY,
    scale,
    timeSec,
    diver,
    secretLair = null,
    lightContext = null
  ) {
    if (!this.level || !scale || scale < 4) return;
    const elements = buildForegroundDepthElements(this.level);
    if (!elements || elements.length === 0) return;

    const biome = elements[0].biome || classifyForegroundBiome(this.level);
    const pal = _getBiomePalette(biome, this.level);
    const rockPattern = typeof this._getSolidRockPattern === 'function' ? this._getSolidRockPattern(ctx) : null;
    const mats = _getHiResMaterialPatterns(this, ctx, this.level);
    const inCombat = Boolean(secretLair?.combatMode);
    const reduced = Boolean(this._reducedMotion);

    const solveOpts = {
      weather: this._activeWeather || null,
      timeSec,
      diver,
      peers: lightContext?.peers || null,
      powerRelays: lightContext?.powerRelays || null,
      secretLair,
      localSiltDensity: lightContext?.localSiltDensity || 0,
    };

    const renderCtx =
      this._fgRenderCtxScratch ||
      (this._fgRenderCtxScratch = {
        mats: null,
        cw: 0,
        ch: 0,
        texOriginX: 0,
        texOriginY: 0,
        scale: 0,
        el: null,
        wallProfile: null,
        rockChunks: null,
        rockPxPerM: 24,
        levelYMin: -6,
        effCamX: 0,
        effCamY: 0,
        viewCenterX: 0,
        viewCenterY: 0,
        maxSpriteDim: 512,
        reShadesThisFrame: 0,
      });
    const perfTier = this._perfBudget?.tier || 'high';
    renderCtx.mats = mats;
    renderCtx.cw = cw;
    renderCtx.ch = ch;
    renderCtx.scale = scale;
    renderCtx.rockChunks = this.rockChunks || null;
    renderCtx.rockPxPerM = this._rockPxPerM || 24;
    renderCtx.levelYMin = this.level?.bounds?.yMin ?? -6;
    renderCtx.effCamX = effCamX;
    renderCtx.effCamY = effCamY;
    renderCtx.viewCenterX = viewCenterX;
    renderCtx.viewCenterY = viewCenterY;
    renderCtx.maxSpriteDim = perfTier === 'performance' ? 256 : (this._isCoarseMobile || perfTier === 'balanced' ? 384 : 512);
    renderCtx.reShadesThisFrame = 0;

    // Share visible accent candidates with Pass 2 so _drawForegroundDepthLightingAccents does ZERO duplicate SDF probes!
    const accentCache = this._fgAccentCache || (this._fgAccentCache = { key: '', items: [], count: 0 });
    accentCache.key = `${this.level.id}|${timeSec}|${effCamX}|${effCamY}`;
    accentCache.count = 0;

    // 100% solid opaque outside boss combat so flashlights, buddies & silt NEVER bleed through foreground elements!
    const baseAlpha = inCombat ? 0.36 : 1.0;

    ctx.save();
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      // World-locked (parallax = 1.0): zero drift off sloped walls, ceilings, or ledges!
      const sx = viewCenterX + (el.x - effCamX) * scale;
      const fallbackSy = viewCenterY + (el.y - effCamY) * scale;

      const wPx = el.widthM * scale;
      const hPx = el.heightM * scale;
      const margin = Math.max(wPx, hPx) + 64;
      if (sx < -margin || sx > cw + margin || fallbackSy < -margin || fallbackSy > ch + margin) continue;

      // Early light gate BEFORE live SDF wall probing — skips pitch-black off-beam formations at 0 SDF cost!
      const light = computeForegroundElementLighting(el, this.level, solveOpts, _lightScratch);
      if (light.lightVis < 0.02) continue;

      const dir = el.side === 'ceiling' ? 1 : -1;
      const wallProfile = _buildLiveWallSampler(
        this.level,
        el,
        sx,
        fallbackSy,
        wPx,
        dir,
        effCamX,
        effCamY,
        viewCenterX,
        viewCenterY,
        scale
      );
      if (!wallProfile.hasWall) continue;
      const sy = wallProfile.centerSy;

      const finalAlpha = baseAlpha;
      if (finalAlpha < 0.04) continue;

      const swayPx = reduced
        ? 0
        : Math.sin(timeSec * (el.kind === 'wreck-chain' ? 1.05 : 1.42) + el.phase) *
          (el.kind === 'cenote-roots' || el.kind === 'kelp-fronds' ? 0.28 * scale : 0.08 * scale);

      renderCtx.texOriginX = sx - el.x * scale * 0.45;
      renderCtx.texOriginY = sy - el.y * scale * 0.45;
      renderCtx.el = el;
      renderCtx.wallProfile = wallProfile;

      ctx.globalAlpha = finalAlpha;
      const fastShearX = reduced
        ? 0
        : el.kind === 'kelp-fronds'
          ? Math.sin(timeSec * 1.38 + el.phase) * 0.068
          : el.kind === 'cenote-roots'
            ? Math.sin(timeSec * 1.25 + el.phase) * 0.052
            : 0;
      if (!_tryBlitCachedFgSprite(ctx, el, sx, sy, cw, ch, light, wallProfile, scale, fastShearX)) {
        _drawBaseFormation(ctx, el, sx, sy, wPx, hPx, dir, pal, swayPx, light, timeSec, reduced, rockPattern, wallProfile, renderCtx);
      }

      // Record accent-eligible visible elements for zero-cost Pass 2 reuse
      if (
        (el.kind === 'kelp-fronds' || el.kind === 'cenote-roots' || el.kind === 'crystal-cluster' || el.kind === 'icicle-cluster' || el.kind === 'wreck-girder' || el.kind === 'rock-pillar') &&
        light.lightVis >= 0.06 &&
        Math.max(light.beamLit, light.backLit, light.sunLit, light.ventLit, light.biolumLit) >= 0.16
      ) {
        let slot = accentCache.items[accentCache.count];
        if (!slot) {
          slot = { el: null, sx: 0, sy: 0, wPx: 0, hPx: 0, dir: 1, swayPx: 0, light: { ...light } };
          accentCache.items[accentCache.count] = slot;
        } else {
          Object.assign(slot.light, light);
        }
        slot.el = el;
        slot.sx = sx;
        slot.sy = sy;
        slot.wPx = wPx;
        slot.hPx = hPx;
        slot.dir = dir;
        slot.swayPx = swayPx;
        accentCache.count++;
      }
    }
    ctx.restore();
  },

  /**
   * Post-lighting optical accents (crystal/icicle diamond glints, biolum spores, metallic specular).
   */
  _drawForegroundDepthLightingAccents(
    ctx,
    cw,
    ch,
    effCamX,
    effCamY,
    viewCenterX,
    viewCenterY,
    scale,
    timeSec,
    diver,
    secretLair = null,
    lightContext = null
  ) {
    if (!this.level || !scale || scale < 4) return;
    const elements = buildForegroundDepthElements(this.level);
    if (!elements || elements.length === 0) return;

    const biome = elements[0].biome || classifyForegroundBiome(this.level);
    const pal = _getBiomePalette(biome, this.level);
    const inCombat = Boolean(secretLair?.combatMode);
    const reduced = Boolean(this._reducedMotion);

    // Fast path: reuse Pass 1's cached wall samples & lighting with ZERO duplicate SDF probes!
    const frameKey = `${this.level.id}|${timeSec}|${effCamX}|${effCamY}`;
    const accentCache = this._fgAccentCache;
    if (accentCache && accentCache.key === frameKey) {
      if (accentCache.count === 0) return;
      ctx.save();
      ctx.globalAlpha = inCombat ? 0.35 : 0.90;
      for (let i = 0; i < accentCache.count; i++) {
        const it = accentCache.items[i];
        _drawLightingAccent(ctx, it.el, it.sx, it.sy, it.wPx, it.hPx, it.dir, pal, it.swayPx, it.light, timeSec, reduced);
      }
      ctx.restore();
      return;
    }

    const solveOpts = {
      weather: this._activeWeather || null,
      timeSec,
      diver,
      peers: lightContext?.peers || null,
      powerRelays: lightContext?.powerRelays || null,
      secretLair,
      localSiltDensity: lightContext?.localSiltDensity || 0,
    };

    ctx.save();
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const sx = viewCenterX + (el.x - effCamX) * scale;
      const sy = viewCenterY + (el.y - effCamY) * scale;

      const wPx = el.widthM * scale;
      const hPx = el.heightM * scale;
      const margin = Math.max(wPx, hPx) + 64;
      if (sx < -margin || sx > cw + margin || sy < -margin || sy > ch + margin) continue;

      const dir = el.side === 'ceiling' ? 1 : -1;
      const light = computeForegroundElementLighting(el, this.level, solveOpts, _lightScratch);
      if (light.lightVis < 0.06) continue;
      if (Math.max(light.beamLit, light.backLit, light.sunLit, light.ventLit, light.biolumLit) < 0.16) continue;

      const wallProfile = _buildLiveWallSampler(
        this.level,
        el,
        sx,
        sy,
        wPx,
        dir,
        effCamX,
        effCamY,
        viewCenterX,
        viewCenterY,
        scale
      );
      if (!wallProfile.hasWall) continue;

      const swayPx = reduced
        ? 0
        : Math.sin(timeSec * (el.kind === 'wreck-chain' ? 1.05 : 1.42) + el.phase) *
          (el.kind === 'cenote-roots' || el.kind === 'kelp-fronds' ? 0.28 * scale : 0.08 * scale);

      ctx.globalAlpha = inCombat ? 0.35 : 0.90;
      _drawLightingAccent(ctx, el, sx, wallProfile.centerSy, wPx, hPx, dir, pal, swayPx, light, timeSec, reduced);
    }
    ctx.restore();
  },
};
