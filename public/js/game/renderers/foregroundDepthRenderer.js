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
      const parallax = isMidPlane ? 1.07 + r1 * 0.04 : 1.12 + r1 * 0.06;

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

      elements.push({
        x: mx,
        y: anchorY,
        side: (placeOnCeiling || canPlacePillar) ? 'ceiling' : 'floor',
        biome,
        kind,
        depthLayer,
        wallSlope,
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

function _getFgScratch(host, needW, needH) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const w = Math.min(768, Math.max(256, Math.ceil(needW / 64) * 64));
  const h = Math.min(768, Math.max(256, Math.ceil(needH / 64) * 64));
  if (!host._fgScratch) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const sctx = canvas.getContext('2d');
    if (!sctx) return null;
    host._fgScratch = { canvas, ctx: sctx };
  } else if (host._fgScratch.canvas.width < w || host._fgScratch.canvas.height < h) {
    host._fgScratch.canvas.width = Math.max(host._fgScratch.canvas.width, w);
    host._fgScratch.canvas.height = Math.max(host._fgScratch.canvas.height, h);
  }
  return host._fgScratch;
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
 * Compute real-time diffuse lighting multiplier RGB for photorealistic high-res foreground textures.
 * Keeps crisp micro-detail visible under torch/sun/vent light while staying richer & slightly deeper
 * than the mid-ground cave wall for unmistakable near-plane 3D separation!
 */
function _computeTexLightRgb(light, isNearPlane, boost = 1.0) {
  const lit = _clamp((light.totalLight - 0.03) * 1.16 * boost, 0.04, 1.05);
  const depthScale = isNearPlane ? 0.68 : 0.84;
  const k = lit * depthScale;
  const tint = _clamp(light.beamLit * 0.42 + light.ventLit * 0.48 + light.sunLit * 0.28 + light.biolumLit * 0.22, 0.06, 0.62);
  const baseR = 235 * (1 - tint) + light.lightR * tint;
  const baseG = 235 * (1 - tint) + light.lightG * tint;
  const baseB = 235 * (1 - tint) + light.lightB * tint;
  const r = Math.round(_clamp(10 + baseR * k, 8, 255));
  const g = Math.round(_clamp(16 + baseG * k, 12, 255));
  const b = Math.round(_clamp(28 + baseB * k, 20, 255));
  return `${r}, ${g}, ${b}`;
}

/**
 * Composite a high-res textured foreground shape onto the reusable scratch canvas with:
 *   1. Crisp world-locked 512px photorealistic texture (`source-in`)
 *   2. Real-time lighting multiply & 3D sculptural shading (`multiply` + `source-atop`)
 *   3. Exact live-SDF feathered wall-weld alpha mask (`destination-in`) — ZERO hard seams, ZERO leaking light!
 */
function _compositeHiResShape(
  mainCtx,
  scratch,
  cw,
  ch,
  bounds,
  { drawShape, pattern, texOriginX, texOriginY, texScale, light, isNearPlane, boost = 1.0, drawOverlay = null, drawAlphaMask = null }
) {
  if (!scratch || !pattern || typeof mainCtx.drawImage !== 'function') return false;
  const bx = Math.max(0, Math.floor(bounds.x));
  const by = Math.max(0, Math.floor(bounds.y));
  const bx2 = Math.min(cw, Math.ceil(bounds.x + bounds.w));
  const by2 = Math.min(ch, Math.ceil(bounds.y + bounds.h));
  const bw = bx2 - bx;
  const bh = by2 - by;
  if (bw <= 2 || bh <= 2 || bw > scratch.canvas.width || bh > scratch.canvas.height) return false;

  const sctx = scratch.ctx;
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.globalCompositeOperation = 'source-over';
  sctx.globalAlpha = 1;
  sctx.clearRect(0, 0, bw, bh);

  sctx.save();
  sctx.translate(-bx, -by);

  // Pass 1: Crisp silhouette mask
  sctx.fillStyle = '#ffffff';
  drawShape(sctx);

  // Pass 2: Lock full-res 512px photorealistic texture into silhouette
  sctx.globalCompositeOperation = 'source-in';
  if (typeof pattern.setTransform === 'function' && typeof DOMMatrix !== 'undefined') {
    try {
      pattern.setTransform(new DOMMatrix().translate(texOriginX, texOriginY).scale(texScale, texScale));
    } catch {}
  }
  sctx.fillStyle = pattern;
  sctx.fillRect(bx, by, bw, bh);

  // Pass 3: Multiply by real-time scene lighting (torch optic RGB, sunlight, vents, near-plane depth)
  sctx.globalCompositeOperation = 'multiply';
  sctx.fillStyle = `rgb(${_computeTexLightRgb(light, isNearPlane, boost)})`;
  sctx.fillRect(bx, by, bw, bh);

  // Re-clip strictly back to the exact silhouette (Porter-Duff multiply paints outside transparent alpha!)
  sctx.globalCompositeOperation = 'destination-in';
  sctx.fillStyle = '#ffffff';
  drawShape(sctx);

  // Pass 4: Local 3D bevel, strata, ambient-occlusion wall-merge tint & detail overlays (strictly inside silhouette!)
  if (drawOverlay) {
    sctx.globalCompositeOperation = 'source-atop';
    drawOverlay(sctx);
  }

  // Pass 5: Exact feathered wall-weld alpha mask (100% opaque across water & wall seam -> 0% deep in solid rock!)
  if (drawAlphaMask) {
    sctx.globalCompositeOperation = 'destination-in';
    drawAlphaMask(sctx);
  }

  sctx.restore();

  mainCtx.drawImage(scratch.canvas, 0, 0, bw, bh, bx, by, bw, bh);
  return true;
}

/**
 * Exact sub-pixel cave wall probe: starts in open water and marches in probeDir (-1 up / +1 down)
 * until hitting solid rock (SDF >= -0.02), then refines with 3 bisection steps (~0.03m precision).
 */
function _probeWallExact(level, wx, startY, probeDir, maxDistM = 6.0) {
  let y = startY;
  // If startY drifted into solid rock, step briefly into open water first
  if (evaluateCaveSDF(level, wx, y) >= -0.05) {
    let foundOpen = false;
    for (let k = 1; k <= 5; k++) {
      const ty = startY - probeDir * (k * 0.55);
      if (evaluateCaveSDF(level, wx, ty) < -0.05) {
        y = ty;
        foundOpen = true;
        break;
      }
    }
    if (!foundOpen) return null;
  }

  const step = 0.24;
  let prevY = y;
  for (let d = step; d <= maxDistM; d += step) {
    const ny = y + probeDir * d;
    if (evaluateCaveSDF(level, wx, ny) >= -0.02) {
      let lo = prevY;
      let hi = ny;
      for (let b = 0; b < 3; b++) {
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
 * Sample the LIVE background cave wall contour directly behind a foreground element's screen X span
 * so the attachment seam ALWAYS locks pixel-tight to the real cave rock with ZERO leaking light!
 */
function _buildLiveWallSampler(level, el, sx, fallbackSy, wPx, dir, effCamX, effCamY, viewCenterX, viewCenterY, scale) {
  const slope = Number.isFinite(el.wallSlope) ? el.wallSlope : 0;
  const fallbackFn = (dx) => fallbackSy + dx * slope;

  if (!level || !Array.isArray(level.segments) || level.segments.length === 0 || !scale || scale < 4) {
    return {
      hasWall: true,
      centerSy: fallbackSy,
      oppSy: el.kind === 'rock-pillar' ? fallbackSy + dir * el.heightM * scale * el.parallax : null,
      wallSy: fallbackFn,
      wallSlopePx: slope,
    };
  }

  const spanHalf = Math.max(wPx * 0.68, 28);
  const sampleCount = 7;
  const probeStartY = el.y + dir * Math.min(2.6, Math.max(1.0, el.heightM * 0.44));
  const maxDriftM = Math.max(3.8, el.heightM * 0.58);
  const rawYs = new Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const u = i / (sampleCount - 1) - 0.5;
    const dx = u * spanHalf * 2;
    const wx = effCamX + (sx + dx - viewCenterX) / scale;
    const hitY = _probeWallExact(level, wx, probeStartY, -dir, 6.2);
    if (hitY !== null && Math.abs(hitY - el.y) <= maxDriftM) {
      rawYs[i] = viewCenterY + (hitY - effCamY) * scale;
    } else {
      rawYs[i] = null;
    }
  }

  const midIdx = Math.floor(sampleCount / 2);
  if (rawYs[midIdx] === null) {
    // Center of element drifted over open water (e.g. cenote shaft) — hide instead of floating detached!
    return { hasWall: false, centerSy: fallbackSy, oppSy: null, wallSy: fallbackFn, wallSlopePx: slope };
  }

  // Fill any missing outer wing samples smoothly from the nearest valid rock anchor
  for (let i = midIdx - 1; i >= 0; i--) {
    if (rawYs[i] === null) {
      rawYs[i] = rawYs[i + 1] - (spanHalf * 2 / (sampleCount - 1)) * slope;
    }
  }
  for (let i = midIdx + 1; i < sampleCount; i++) {
    if (rawYs[i] === null) {
      rawYs[i] = rawYs[i - 1] + (spanHalf * 2 / (sampleCount - 1)) * slope;
    }
  }

  // Also probe opposite wall for ceiling-to-floor pillars & hull-spanning wreck girders
  let oppSy = null;
  if (el.kind === 'rock-pillar' || el.kind === 'wreck-girder') {
    const centerWx = effCamX + (sx - viewCenterX) / scale;
    const midCorridorY = el.y + dir * Math.min(el.heightM * 0.50, 5.0);
    const oppHit = _probeWallExact(level, centerWx, midCorridorY, dir, Math.max(9.0, el.heightM * 1.15));
    if (oppHit !== null) {
      oppSy = viewCenterY + (oppHit - effCamY) * scale;
    }
  }
  if (el.kind === 'rock-pillar' && oppSy === null) {
    return { hasWall: false, centerSy: rawYs[midIdx], oppSy: null, wallSy: fallbackFn, wallSlopePx: slope };
  }

  const wallSy = (dx) => {
    const t = _clamp((dx + spanHalf) / (spanHalf * 2), 0, 1) * (sampleCount - 1);
    const i0 = Math.floor(t);
    const i1 = Math.min(sampleCount - 1, i0 + 1);
    const frac = t - i0;
    return rawYs[i0] + (rawYs[i1] - rawYs[i0]) * frac;
  };
  const wallSlopePx = _clamp((rawYs[sampleCount - 1] - rawYs[0]) / Math.max(1, spanHalf * 2), -1.1, 1.1);

  return {
    hasWall: true,
    centerSy: rawYs[midIdx],
    oppSy,
    wallSy,
    wallSlopePx,
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
 * Paint a grounded, 100% light-sealed wall attachment collar (rock pocket, root-bank, holdfast mound,
 * or steel hull weld) plus an Ambient Occlusion contact shadow along the live cave wall contour so
 * ZERO torchlight or background water can ever leak behind the joint!
 */
function _drawWallWeldCollar(ctx, sx, wallY, halfW, dir, lipOutPx, buryPx, mergeRgb, aoAlpha, vis, renderCtx = null, light = null, isNearPlane = false) {
  if (vis < 0.02 || halfW < 4) return;
  const steps = 10;
  const lipPts = [];
  const buryPts = [];
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const dx = (u - 0.5) * halfW * 2;
    const wy = wallY(dx);
    const env = Math.pow(Math.sin(u * Math.PI), 0.85);
    const bump = 0.68 + 0.22 * Math.sin(u * Math.PI * 3.0) + 0.14 * Math.cos(u * Math.PI * 7.0);
    const ly = wy + dir * lipOutPx * env * bump;
    const by = wy - dir * buryPx * (0.45 + 0.55 * env);
    lipPts.push({ x: sx + dx, y: ly });
    buryPts.push({ x: sx + dx, y: by });
    if (ly < minY) minY = ly;
    if (by < minY) minY = by;
    if (ly > maxY) maxY = ly;
    if (by > maxY) maxY = by;
  }

  // 1. Subtle rock-side contact crevice shadow tucked into the wall lip (kills bright torch-rim leak with ZERO dark bar!)
  if (aoAlpha > 0.02) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Soft shadow shifted slightly into solid rock
    ctx.strokeStyle = `rgba(2, 6, 13, ${(aoAlpha * 0.36 * vis).toFixed(3)})`;
    ctx.lineWidth = Math.max(9, lipOutPx * 1.15 + 4);
    ctx.beginPath();
    ctx.moveTo(sx - halfW * 0.86, wallY(-halfW * 0.86) - dir * 3);
    for (let i = 1; i <= steps; i++) {
      const dx = ((i / steps) - 0.5) * halfW * 1.72;
      ctx.lineTo(sx + dx, wallY(dx) - dir * 3);
    }
    ctx.stroke();
    // Tight contact occlusion crevice right along the wall seam
    ctx.strokeStyle = `rgba(2, 6, 13, ${(aoAlpha * 0.46 * vis).toFixed(3)})`;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(sx - halfW * 0.80, wallY(-halfW * 0.80) - dir * 0.5);
    for (let i = 1; i <= steps; i++) {
      const dx = ((i / steps) - 0.5) * halfW * 1.60;
      ctx.lineTo(sx + dx, wallY(dx) - dir * 0.5);
    }
    ctx.stroke();
    ctx.restore();
  }

  const traceCollar = (c) => {
    c.beginPath();
    c.moveTo(lipPts[0].x, lipPts[0].y);
    for (let i = 1; i < steps; i++) {
      const mx = (lipPts[i].x + lipPts[i + 1].x) * 0.5;
      const my = (lipPts[i].y + lipPts[i + 1].y) * 0.5;
      c.quadraticCurveTo(lipPts[i].x, lipPts[i].y, mx, my);
    }
    c.lineTo(lipPts[steps].x, lipPts[steps].y);
    for (let i = steps; i >= 0; i--) {
      c.lineTo(buryPts[i].x, buryPts[i].y);
    }
    c.closePath();
    c.fill();
  };

  // 2. Opaque wall-normal-graded root collar: 99% opaque right across the wall seam, softly feathered on both sides!
  const { nx, ny } = _computeWallNormal(wallY, halfW, dir);
  const cy = wallY(0);
  const gStartX = sx + nx * (lipOutPx + 2);
  const gStartY = cy + ny * (lipOutPx + 2);
  const gEndX = sx - nx * buryPx;
  const gEndY = cy - ny * buryPx;
  const totalD = Math.max(10, lipOutPx + 2 + buryPx);
  const tLip = _clamp((lipOutPx * 0.55 + 1) / totalD, 0.08, 0.34);
  const tSolid = _clamp((lipOutPx + 10) / totalD, tLip + 0.12, 0.72);

  if (renderCtx?.scratch && renderCtx?.mats?.rock && light) {
    const ok = _compositeHiResShape(
      ctx,
      renderCtx.scratch,
      renderCtx.cw,
      renderCtx.ch,
      { x: sx - halfW - 6, y: minY - 6, w: halfW * 2 + 12, h: maxY - minY + 12 },
      {
        drawShape: traceCollar,
        pattern: renderCtx.mats.rock,
        texOriginX: renderCtx.texOriginX,
        texOriginY: renderCtx.texOriginY,
        texScale: 0.62,
        light,
        isNearPlane,
        boost: 0.48 + light.sunLit * 0.28,
        drawOverlay: (sctx) => {
          const darkCover = 0.34 + (1 - _clamp(light.sunLit * 2.0, 0, 1)) * 0.34;
          const mg = sctx.createLinearGradient(gStartX, gStartY, gEndX, gEndY);
          mg.addColorStop(0, `rgba(${mergeRgb}, ${darkCover.toFixed(3)})`);
          mg.addColorStop(tSolid, `rgba(${mergeRgb}, 0.82)`);
          mg.addColorStop(1, `rgba(${mergeRgb}, 0.98)`);
          sctx.fillStyle = mg;
          sctx.fillRect(sx - halfW - 8, minY - 8, halfW * 2 + 16, maxY - minY + 16);
        },
        drawAlphaMask: (sctx) => {
          const ag = sctx.createLinearGradient(gStartX, gStartY, gEndX, gEndY);
          ag.addColorStop(0, `rgba(255, 255, 255, ${(0.18 * vis).toFixed(3)})`);
          ag.addColorStop(tLip, `rgba(255, 255, 255, ${(0.98 * vis).toFixed(3)})`);
          ag.addColorStop(tSolid, `rgba(255, 255, 255, ${(0.98 * vis).toFixed(3)})`);
          ag.addColorStop(Math.min(0.95, tSolid + (1 - tSolid) * 0.55), `rgba(255, 255, 255, ${(0.48 * vis).toFixed(3)})`);
          ag.addColorStop(1, 'rgba(255, 255, 255, 0)');
          sctx.fillStyle = ag;
          sctx.fillRect(sx - halfW - 8, minY - 8, halfW * 2 + 16, maxY - minY + 16);
        },
      }
    );
    if (ok) return;
  }

  const grad = ctx.createLinearGradient(gStartX, gStartY, gEndX, gEndY);
  grad.addColorStop(0, `rgba(${mergeRgb}, ${(0.18 * vis).toFixed(3)})`);
  grad.addColorStop(tLip, `rgba(${mergeRgb}, ${(0.98 * vis).toFixed(3)})`);
  grad.addColorStop(tSolid, `rgba(${mergeRgb}, ${(0.98 * vis).toFixed(3)})`);
  grad.addColorStop(Math.min(0.95, tSolid + (1 - tSolid) * 0.55), `rgba(${mergeRgb}, ${(0.48 * vis).toFixed(3)})`);
  grad.addColorStop(1, `rgba(${mergeRgb}, 0)`);

  ctx.fillStyle = grad;
  traceCollar(ctx);
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
  const bury = Math.max(28, hPx * 0.36);
  const mergeRgb = _getWallMergeRgb(pal, light, isNearPlane);
  const { nx, ny } = _computeWallNormal(wallY, halfW, dir);

  const traceCrest = (c) => {
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) * 0.5;
      const my = (pts[i].y + pts[i + 1].y) * 0.5;
      c.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    const last = pts[pts.length - 1];
    c.lineTo(last.x, last.y);
  };

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].y < minY) minY = pts[i].y;
    if (pts[i].y > maxY) maxY = pts[i].y;
  }
  const backPts = [];
  for (let i = 6; i >= 0; i--) {
    const u = i / 6;
    const dx = (u - 0.5) * halfW * 2;
    const env = 0.58 + 0.42 * Math.sin(u * Math.PI);
    const by = wallY(dx) - dir * bury * env;
    backPts.push({ x: sx + dx, y: by });
    if (by < minY) minY = by;
    if (by > maxY) maxY = by;
  }

  // Back skirt follows the EXACT live SDF cave wall shifted deep into solid rock!
  const traceFullClosed = (c) => {
    traceCrest(c);
    for (let i = 0; i < backPts.length; i++) {
      c.lineTo(backPts[i].x, backPts[i].y);
    }
    c.closePath();
  };

  // 0. Grounded Ambient Occlusion shadow tucked slightly onto the rock side of the cave wall lip
  ctx.save();
  ctx.strokeStyle = `rgba(2, 6, 13, ${(0.56 * vis).toFixed(3)})`;
  ctx.lineWidth = Math.max(12, Math.min(20, hPx * 0.18));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(sx - halfW * 0.94, wallY(-halfW * 0.94) - dir * 2.5);
  for (let i = 1; i <= 6; i++) {
    const dx = ((i / 6) - 0.5) * halfW * 1.88;
    ctx.lineTo(sx + dx, wallY(dx) - dir * 2.5);
  }
  ctx.stroke();
  ctx.restore();

  // 1. Soft water-facing cast shadow behind the sculpted crest (instant 3D separation!)
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(2, 6, 14, ${(0.36 * vis * (isNearPlane ? 1.15 : 0.85)).toFixed(3)})`;
  ctx.lineWidth = isNearPlane ? 14 : 9;
  if (typeof ctx.translate === 'function') ctx.translate(nx * (isNearPlane ? 6 : 4), ny * (isNearPlane ? 6 : 4));
  ctx.beginPath();
  traceCrest(ctx);
  ctx.stroke();
  ctx.restore();

  // 2. High-Res 512px Photorealistic Rock Body via Scratch-Canvas `destination-in` Wall-Weld Mask!
  const rockMidShaded = _shadeNearRgb(pal.rockMid, light, isNearPlane, 0.96);
  const rockDarkShaded = _shadeNearRgb(pal.rockDark, light, isNearPlane, 0.80);
  const totalDepth = hPx + bury;
  const tLip = _clamp(hPx / totalDepth, 0.48, 0.82);
  const tSolidInRock = _clamp((hPx + Math.min(12, bury * 0.36)) / totalDepth, tLip + 0.04, 0.90);
  const gX0 = sx + nx * hPx;
  const gY0 = sy + ny * hPx;
  const gX1 = sx - nx * bury;
  const gY1 = sy - ny * bury;

  let drewHiRes = false;
  if (renderCtx?.scratch && renderCtx?.mats?.rock) {
    drewHiRes = _compositeHiResShape(
      ctx,
      renderCtx.scratch,
      renderCtx.cw,
      renderCtx.ch,
      { x: sx - halfW - 8, y: minY - 8, w: halfW * 2 + 16, h: maxY - minY + 16 },
      {
        drawShape: (sctx) => {
          sctx.beginPath();
          traceFullClosed(sctx);
          sctx.fill();
        },
        pattern: renderCtx.mats.rock,
        texOriginX: renderCtx.texOriginX,
        texOriginY: renderCtx.texOriginY,
        texScale: 0.62,
        light,
        isNearPlane,
        boost: 0.62 + light.sunLit * 0.24,
        drawOverlay: (sctx) => {
          // 3D crest bevel highlight -> deep wall-weld merge shadow across the rock seam
          const depthTint = sctx.createLinearGradient(gX0, gY0, gX1, gY1);
          depthTint.addColorStop(0, 'rgba(0, 0, 0, 0)');
          depthTint.addColorStop(tLip * 0.72, `rgba(${mergeRgb}, 0.22)`);
          depthTint.addColorStop(tLip, `rgba(${mergeRgb}, 0.68)`);
          depthTint.addColorStop(1, `rgba(${mergeRgb}, 0.95)`);
          sctx.fillStyle = depthTint;
          sctx.fillRect(sx - halfW - 10, minY - 10, halfW * 2 + 20, maxY - minY + 20);

          if (lit > 0.12) {
            const rockHiShaded = _shadeNearRgb(pal.rockHighlight, light, isNearPlane, 0.90);
            const bevelGrad = sctx.createLinearGradient(gX0, gY0, sx + nx * (hPx * 0.18), sy + ny * (hPx * 0.18));
            bevelGrad.addColorStop(0, `rgba(${rockHiShaded}, ${(0.24 * lit).toFixed(3)})`);
            bevelGrad.addColorStop(0.55, `rgba(${rockHiShaded}, ${(0.06 * lit).toFixed(3)})`);
            bevelGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            sctx.fillStyle = bevelGrad;
            sctx.fillRect(sx - halfW - 10, minY - 10, halfW * 2 + 20, maxY - minY + 20);
          }

          if (drawDetails) drawDetails(sctx);

          if (rimPower > 0.08) {
            const gx0 = sx + nx * hPx + light.lightDirX * wPx * 0.42;
            const gy0 = sy + ny * hPx;
            const gx1 = sx + nx * (hPx * 0.12) - light.lightDirX * wPx * 0.35;
            const gy1 = sy + ny * (hPx * 0.12);
            const hlGrad = sctx.createLinearGradient(gx0, gy0, gx1, gy1);
            hlGrad.addColorStop(0, `rgba(${rimRgb}, ${(rimPower * 0.30).toFixed(3)})`);
            hlGrad.addColorStop(0.45, `rgba(${rimRgb}, ${(rimPower * 0.08).toFixed(3)})`);
            hlGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            sctx.fillStyle = hlGrad;
            sctx.fillRect(sx - halfW - 10, minY - 10, halfW * 2 + 20, maxY - minY + 20);
          }
        },
        drawAlphaMask: (sctx) => {
          const maskGrad = sctx.createLinearGradient(gX0, gY0, gX1, gY1);
          maskGrad.addColorStop(0, `rgba(255, 255, 255, ${(0.99 * vis).toFixed(3)})`);
          maskGrad.addColorStop(tLip, `rgba(255, 255, 255, ${(0.99 * vis).toFixed(3)})`);
          maskGrad.addColorStop(tSolidInRock, `rgba(255, 255, 255, ${(0.96 * vis).toFixed(3)})`);
          maskGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          sctx.fillStyle = maskGrad;
          sctx.fillRect(sx - halfW - 10, minY - 10, halfW * 2 + 20, maxY - minY + 20);
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
      // Sculpted near-camera cave column locked pixel-tight to LIVE ceiling & floor SDF lips!
      // Stays 100% OPAQUE across the entire water span AND past both ceiling & floor rock seams (zero light leaks!),
      // flares into buttress roots with grounded AO contact collars, and dissolves to 0% strictly deep inside solid rock!
      const topLip = sy;
      const botLip = wallProfile && Number.isFinite(wallProfile.oppSy) ? wallProfile.oppSy : sy + hPx;
      const waterSpan = Math.max(40, botLip - topLip);
      const bury = Math.max(36, Math.min(68, waterSpan * 0.24));
      const topY = topLip - bury;
      const botY = botLip + bury;
      const span = Math.max(64, botY - topY);
      const steps = 12;
      const leftPts = [];
      const rightPts = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const py = topY + span * t;
        // Normalized position across the open-water span (0 at ceiling lip, 1 at floor lip)
        const uWater = _clamp((py - topLip) / waterSpan, -0.35, 1.35);
        const flare = Math.pow(Math.min(1.25, Math.abs(uWater - 0.5) * 2), 2.15);
        const halfW = wPx * (0.34 + flare * 0.88);
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

      // 0. Grounded Ambient Occlusion root-weld shadows tucked slightly into ceiling & floor rock
      const rootHalfW = wPx * 1.18;
      for (const [lipY, tuckDir] of [[topLip, -1], [botLip, 1]]) {
        ctx.save();
        ctx.strokeStyle = `rgba(2, 6, 13, ${(0.54 * vis).toFixed(3)})`;
        ctx.lineWidth = Math.max(12, Math.min(20, wPx * 0.34));
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx - rootHalfW, lipY + tuckDir * 3.5);
        ctx.lineTo(sx + rootHalfW, lipY + tuckDir * 3.5);
        ctx.stroke();
        ctx.restore();
      }

      // 1. Soft depth drop-shadow behind both flanks across open water (fading smoothly to 0% inside rock roots)
      const tTopLip = _clamp(bury / span, 0.08, 0.34);
      const tBotLip = _clamp(1 - bury / span, 0.66, 0.92);
      const tTopSolid = _clamp(tTopLip * 0.62, 0.04, tTopLip - 0.02);
      const tBotSolid = _clamp(1 - (1 - tBotLip) * 0.62, tBotLip + 0.02, 0.96);

      ctx.save();
      const shadowGrad = ctx.createLinearGradient(sx, topY, sx, botY);
      shadowGrad.addColorStop(0, 'rgba(2, 6, 14, 0)');
      shadowGrad.addColorStop(tTopLip, `rgba(2, 6, 14, ${(0.38 * vis).toFixed(3)})`);
      shadowGrad.addColorStop(tBotLip, `rgba(2, 6, 14, ${(0.38 * vis).toFixed(3)})`);
      shadowGrad.addColorStop(1, 'rgba(2, 6, 14, 0)');
      ctx.strokeStyle = shadowGrad;
      ctx.lineWidth = isNearPlane ? 16 : 10;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      traceLeft(ctx);
      traceRight(ctx);
      ctx.stroke();
      ctx.restore();

      // 2. High-Res 512px Photorealistic Rock Pillar (100% opaque across water & both rock lips -> fades strictly inside solid rock!)
      const rockMidShaded = _shadeNearRgb(pal.rockMid, light, isNearPlane, 0.98);
      const rockDarkShaded = _shadeNearRgb(pal.rockDark, light, isNearPlane, 0.78);
      const litRight = light.lightDirX >= 0;
      const focusY = topLip + waterSpan * _clamp(0.50 + light.lightDirY * 0.22, 0.28, 0.72);
      const colHalfBound = wPx * 1.65 + Math.abs(leanPx) * 1.4;

      let drewPillarHiRes = false;
      if (renderCtx?.scratch && renderCtx?.mats?.rock) {
        drewPillarHiRes = _compositeHiResShape(
          ctx,
          renderCtx.scratch,
          renderCtx.cw,
          renderCtx.ch,
          { x: sx - colHalfBound, y: topY - 4, w: colHalfBound * 2, h: span + 8 },
          {
            drawShape: (sctx) => {
              sctx.beginPath();
              tracePillarClosed(sctx);
              sctx.fill();
            },
            pattern: renderCtx.mats.rock,
            texOriginX: renderCtx.texOriginX,
            texOriginY: renderCtx.texOriginY,
            texScale: 0.62,
            light,
            isNearPlane,
            boost: 0.62 + light.sunLit * 0.24,
            drawOverlay: (sctx) => {
              // Cylindrical 3D cross-lighting (shadowed side -> rim-lit flank)
              const cylGrad = sctx.createLinearGradient(sx - wPx * 0.7, focusY, sx + wPx * 0.7, focusY);
              cylGrad.addColorStop(0, litRight ? 'rgba(2, 6, 14, 0.56)' : `rgba(${rimRgb}, ${(0.22 * rimPower).toFixed(3)})`);
              cylGrad.addColorStop(0.5, 'rgba(2, 6, 14, 0.20)');
              cylGrad.addColorStop(1, litRight ? `rgba(${rimRgb}, ${(0.22 * rimPower).toFixed(3)})` : 'rgba(2, 6, 14, 0.56)');
              sctx.fillStyle = cylGrad;
              sctx.fillRect(sx - colHalfBound, topY - 4, colHalfBound * 2, span + 8);

              // Top & bottom root merge tint so roots blend seamlessly into dark/sunlit ceiling & floor rock
              const rootTint = sctx.createLinearGradient(sx, topY, sx, botY);
              rootTint.addColorStop(0, `rgba(${mergeRgb}, 0.94)`);
              rootTint.addColorStop(tTopLip, `rgba(${mergeRgb}, 0.45)`);
              rootTint.addColorStop(tTopLip + 0.10, 'rgba(0, 0, 0, 0)');
              rootTint.addColorStop(tBotLip - 0.10, 'rgba(0, 0, 0, 0)');
              rootTint.addColorStop(tBotLip, `rgba(${mergeRgb}, 0.45)`);
              rootTint.addColorStop(1, `rgba(${mergeRgb}, 0.94)`);
              sctx.fillStyle = rootTint;
              sctx.fillRect(sx - colHalfBound, topY - 4, colHalfBound * 2, span + 8);

              if (el.biome === 'volcanic') {
                const grooveA = Math.max(light.ventLit * 0.85, lit * 0.42);
                const gGrad = sctx.createLinearGradient(sx, topLip + 4, sx, botLip - 4);
                gGrad.addColorStop(0, 'rgba(255, 118, 42, 0)');
                gGrad.addColorStop(0.24, `rgba(255, 118, 42, ${grooveA.toFixed(3)})`);
                gGrad.addColorStop(0.76, `rgba(255, 118, 42, ${grooveA.toFixed(3)})`);
                gGrad.addColorStop(1, 'rgba(255, 118, 42, 0)');
                sctx.strokeStyle = gGrad;
                sctx.lineWidth = 1.8;
                sctx.lineCap = 'round';
                sctx.beginPath();
                sctx.moveTo(sx - wPx * 0.08, topLip + 6);
                sctx.quadraticCurveTo(sx + leanPx * 0.8, topLip + waterSpan * 0.5, sx + wPx * 0.06, botLip - 6);
                sctx.stroke();
              }
            },
            drawAlphaMask: (sctx) => {
              const ag = sctx.createLinearGradient(sx, topY, sx, botY);
              ag.addColorStop(0, 'rgba(255, 255, 255, 0)');
              ag.addColorStop(tTopSolid, `rgba(255, 255, 255, ${(0.97 * vis).toFixed(3)})`);
              ag.addColorStop(tTopLip, `rgba(255, 255, 255, ${(0.99 * vis).toFixed(3)})`);
              ag.addColorStop(tBotLip, `rgba(255, 255, 255, ${(0.99 * vis).toFixed(3)})`);
              ag.addColorStop(tBotSolid, `rgba(255, 255, 255, ${(0.97 * vis).toFixed(3)})`);
              ag.addColorStop(1, 'rgba(255, 255, 255, 0)');
              sctx.fillStyle = ag;
              sctx.fillRect(sx - colHalfBound, topY - 4, colHalfBound * 2, span + 8);
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
      // High-res gnarled wet mangrove bark root veil rooted into a grounded ceiling rock/soil root-bank collar
      // (zero brown sticks poking into dark unlit rock above the ceiling, zero light leaking above the roots!)
      const rootDark = _shadeNearRgb([30, 19, 12], light, isNearPlane, 0.90);
      const rootMid = _shadeNearRgb(pal.rustRgb, light, isNearPlane, 1.08);
      const leafCol = _shadeNearRgb(pal.mossRgb, light, isNearPlane, 1.05);

      // Seal the ceiling joint tightly behind the root trunks with a rock-blended collar + tucked AO crevice
      _drawWallWeldCollar(ctx, sx, wallY, wPx * 0.46, dir, 3.5, Math.max(22, hPx * 0.14), mergeRgb, 0.44, vis, renderCtx, light, isNearPlane);

      const strands = el.subCount + 5;
      const trunkGeoms = [];
      let minX = sx - wPx;
      let maxX = sx + wPx;
      let minY = sy - 16;
      let maxY = sy + hPx + 24;

      for (let i = 0; i < strands; i++) {
        const u = strands <= 1 ? 0 : i / (strands - 1) - 0.5;
        const j = (_hash01(el.seed + i * 17.3) - 0.5) * 0.14;
        const frac = _clamp(u + j, -0.52, 0.52);
        const isFine = i % 3 !== 0;
        const dx0 = frac * wPx * 0.88;
        const bx = sx + dx0;
        const by = wallY(dx0) - 2;
        const archOut = (frac * 0.28 + (_hash01(el.seed + i * 9.1) - 0.5) * 0.22) * wPx;
        const len = hPx * (isFine ? 0.50 + _hash01(el.seed + i * 31) * 0.52 : 0.72 + _hash01(el.seed + i * 13) * 0.34);
        const sw = swayPx * (isFine ? 1.35 : 0.65 + (i % 3) * 0.20);
        const baseW = Math.max(isFine ? 1.1 : 4.2, wPx * (isFine ? 0.017 : 0.062 - Math.abs(u) * 0.015));

        const c1x = bx + archOut * 0.55 + leanPx * 0.25 + sw * 0.26;
        const c1y = by + len * 0.36;
        const c2x = bx + archOut * 0.30 + leanPx * 0.65 + sw * 0.70 - Math.sign(frac || 1) * wPx * 0.06;
        const c2y = by + len * 0.72;
        const tipX = bx + archOut * 0.45 + leanPx * 0.85 + sw;
        const tipY = by + len;
        if (bx - baseW - 20 < minX) minX = bx - baseW - 20;
        if (tipX + 20 > maxX) maxX = tipX + 20;
        if (by - 12 < minY) minY = by - 12;
        if (tipY + 24 > maxY) maxY = tipY + 24;
        trunkGeoms.push({ i, isFine, bx, by, c1x, c1y, c2x, c2y, tipX, tipY, baseW, len, sw });
      }

      // Composite main mangrove root trunks with full-res 512px wet gnarled bark texture (`tex-fg-roots.jpg`)!
      const { nx: rNx, ny: rNy } = _computeWallNormal(wallY, wPx * 0.46, dir);
      let drewRootsHiRes = false;
      if (renderCtx?.scratch && renderCtx?.mats?.roots) {
        drewRootsHiRes = _compositeHiResShape(
          ctx,
          renderCtx.scratch,
          renderCtx.cw,
          renderCtx.ch,
          { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
          {
            drawShape: (sctx) => {
              // Single combined path so `destination-in` preserves EVERY trunk simultaneously!
              sctx.beginPath();
              for (const g of trunkGeoms) {
                if (g.isFine) continue;
                sctx.moveTo(g.bx - g.baseW * 0.85, g.by - 5);
                sctx.bezierCurveTo(g.c1x - g.baseW * 0.46, g.c1y, g.c2x - g.baseW * 0.22, g.c2y, g.tipX, g.tipY);
                sctx.bezierCurveTo(g.c2x + g.baseW * 0.22, g.c2y, g.c1x + g.baseW * 0.46, g.c1y, g.bx + g.baseW * 0.85, g.by - 5);
                sctx.closePath();
              }
              sctx.fill();
            },
            pattern: renderCtx.mats.roots,
            texOriginX: renderCtx.texOriginX,
            texOriginY: renderCtx.texOriginY,
            texScale: 0.34,
            light,
            isNearPlane,
            boost: 1.52,
            drawOverlay: (sctx) => {
              // Wall-normal-aligned grounding shadow right where roots emerge from sloped ceiling rock
              const rg = sctx.createLinearGradient(sx - rNx * 8, sy - rNy * 8, sx + rNx * 34, sy + rNy * 34);
              rg.addColorStop(0, `rgba(${mergeRgb}, 0.88)`);
              rg.addColorStop(0.45, `rgba(${mergeRgb}, 0.38)`);
              rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
              sctx.fillStyle = rg;
              sctx.fillRect(minX, minY, maxX - minX, maxY - minY);
            },
            drawAlphaMask: (sctx) => {
              const ag = sctx.createLinearGradient(sx - rNx * 7, sy - rNy * 7, sx + rNx * (hPx + 14), sy + rNy * (hPx + 14));
              ag.addColorStop(0, 'rgba(255, 255, 255, 0)');
              ag.addColorStop(0.05, `rgba(255, 255, 255, ${(0.98 * vis).toFixed(3)})`);
              ag.addColorStop(0.76, `rgba(255, 255, 255, ${(0.92 * vis).toFixed(3)})`);
              ag.addColorStop(1, 'rgba(255, 255, 255, 0)');
              sctx.fillStyle = ag;
              sctx.fillRect(minX, minY, maxX - minX, maxY - minY);
            },
          }
        );
      }

      ctx.lineCap = 'round';
      for (const g of trunkGeoms) {
        const { i, isFine, bx, by, c1x, c1y, c2x, c2y, tipX, tipY, baseW, len, sw } = g;
        if (isFine) {
          const hg = ctx.createLinearGradient(bx, by, tipX, tipY);
          hg.addColorStop(0, `rgba(${rootDark}, ${(0.82 * vis).toFixed(3)})`);
          hg.addColorStop(0.55, `rgba(${rootMid}, ${(0.70 * vis).toFixed(3)})`);
          hg.addColorStop(1, `rgba(${rootMid}, 0)`);
          ctx.strokeStyle = hg;
          ctx.lineWidth = baseW;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.bezierCurveTo(c1x, c1y, c2x, c2y, tipX, tipY);
          ctx.stroke();

          if (rimPower > 0.12 && i % 2 === 0) {
            const rg = ctx.createLinearGradient(tipX, tipY, bx, by);
            rg.addColorStop(0, `rgba(${rimRgb}, 0)`);
            rg.addColorStop(0.35, `rgba(${rimRgb}, ${(rimPower * 0.42 * vis).toFixed(3)})`);
            rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.strokeStyle = rg;
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(bx + 0.8, by);
            ctx.bezierCurveTo(c1x + 0.8, c1y, c2x + 0.8, c2y, tipX + 0.8, tipY);
            ctx.stroke();
            ctx.restore();
          }
        } else {
          if (!drewRootsHiRes) {
            const tg = ctx.createLinearGradient(bx, by, tipX, tipY);
            tg.addColorStop(0, `rgba(${rootDark}, ${(0.94 * vis).toFixed(3)})`);
            tg.addColorStop(0.45, `rgba(${rootMid}, ${(0.90 * vis).toFixed(3)})`);
            tg.addColorStop(0.84, `rgba(${rootDark}, ${(0.68 * vis).toFixed(3)})`);
            tg.addColorStop(1, `rgba(${rootDark}, 0)`);
            ctx.fillStyle = tg;
            ctx.beginPath();
            ctx.moveTo(bx - baseW * 0.75, by);
            ctx.bezierCurveTo(c1x - baseW * 0.40, c1y, c2x - baseW * 0.18, c2y, tipX, tipY);
            ctx.bezierCurveTo(c2x + baseW * 0.18, c2y, c1x + baseW * 0.40, c1y, bx + baseW * 0.75, by);
            ctx.closePath();
            ctx.fill();
          }

          if (rimPower > 0.08) {
            const hlSign = light.lightDirX >= 0 ? 1 : -1;
            const rg = ctx.createLinearGradient(tipX, tipY, bx, by);
            rg.addColorStop(0, `rgba(${rimRgb}, 0)`);
            rg.addColorStop(0.28, `rgba(${rimRgb}, ${(rimPower * 0.56 * vis).toFixed(3)})`);
            rg.addColorStop(0.75, `rgba(${sssRgb}, ${(rimPower * 0.24 * vis).toFixed(3)})`);
            rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.strokeStyle = rg;
            ctx.lineWidth = Math.max(1.0, baseW * 0.22);
            ctx.beginPath();
            ctx.moveTo(bx + hlSign * baseW * 0.42, by);
            ctx.bezierCurveTo(c1x + hlSign * baseW * 0.24, c1y, c2x + hlSign * baseW * 0.12, c2y, tipX, tipY);
            ctx.stroke();
            ctx.restore();
          }

          for (const fSign of [-1, 1]) {
            const fT = fSign < 0 ? 0.42 : 0.62;
            const inv = 1 - fT;
            const fx0 = inv * inv * inv * bx + 3 * inv * inv * fT * c1x + 3 * inv * fT * fT * c2x + fT * fT * fT * tipX;
            const fy0 = inv * inv * inv * by + 3 * inv * inv * fT * c1y + 3 * inv * fT * fT * c2y + fT * fT * fT * tipY;
            const fTipX = fx0 + fSign * wPx * 0.18 + sw * 0.9;
            const fTipY = fy0 + len * 0.30;
            const fg = ctx.createLinearGradient(fx0, fy0, fTipX, fTipY);
            fg.addColorStop(0, `rgba(${rootMid}, ${(0.78 * vis).toFixed(3)})`);
            fg.addColorStop(1, `rgba(${rootDark}, 0)`);
            ctx.strokeStyle = fg;
            ctx.lineWidth = Math.max(0.9, baseW * 0.26);
            ctx.beginPath();
            ctx.moveTo(fx0, fy0);
            ctx.quadraticCurveTo(fx0 + fSign * wPx * 0.11, fy0 + len * 0.13, fTipX, fTipY);
            ctx.stroke();
          }

          if (el.y < 18) {
            ctx.fillStyle = `rgba(${leafCol}, ${(0.64 * vis).toFixed(3)})`;
            ctx.beginPath();
            ctx.ellipse(bx + leanPx * 0.08, by + 10, baseW * 1.15, baseW * 0.55, 0.35, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      break;
    }

    case 'kelp-fronds': {
      // High-res photorealistic undulating emerald kelp ribbons rooted into a textured seabed holdfast mound!
      const stalkDark = _shadeNearRgb(pal.floraDark, light, isNearPlane, 0.88);
      const bladeMid = _shadeNearRgb(pal.floraMid, light, isNearPlane, 1.06);
      const bladeLit = _shadeNearRgb(pal.mossRgb, light, isNearPlane, 1.22);

      // Grounded low-profile textured seabed holdfast collar + tucked AO crevice sealing the floor seam
      _drawWallWeldCollar(ctx, sx, wallY, wPx * 0.42, dir, 3.5, Math.max(22, hPx * 0.14), mergeRgb, 0.44, vis, renderCtx, light, isNearPlane);

      const ribbons = el.subCount + 3;
      const bladeGeoms = [];
      let minX = sx - wPx;
      let maxX = sx + wPx;
      let minY = sy - hPx - 16;
      let maxY = sy + 20;

      for (let i = 0; i < ribbons; i++) {
        const u = ribbons <= 1 ? 0 : i / (ribbons - 1) - 0.5;
        const j = (_hash01(el.seed + i * 21.7) - 0.5) * 0.14;
        const frac = _clamp(u + j, -0.48, 0.48);
        const dx0 = frac * wPx * 0.78;
        const bx = sx + dx0;
        const by = wallY(dx0) + 5;
        const hMul = 0.56 + (1 - Math.abs(u) * 1.1) * 0.34 + _hash01(el.seed + i * 11.3) * 0.22;
        const len = hPx * hMul;
        const ribbonW = Math.max(5.5, wPx * (0.085 + _hash01(el.seed + i * 7.7) * 0.045));
        const wavePh = el.phase + i * 1.45 + (reduced ? 0 : timeSec * 1.35);
        const lean = (frac * 0.35 + el.lean * 0.8) * wPx;
        const sw = swayPx * (0.75 + (i % 3) * 0.25);

        const segs = 7;
        const leftPts = [];
        const rightPts = [];
        for (let s = 0; s <= segs; s++) {
          const t = s / segs;
          const taper = Math.sin(Math.pow(t, 0.72) * Math.PI * 0.94);
          const halfW = Math.max(0.8, ribbonW * (0.28 + 0.72 * taper));
          const wave = Math.sin(wavePh + t * 3.8) * ribbonW * (0.45 + t * 0.95);
          const cx = bx + lean * t * t + sw * t * t + wave;
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

      // Composite all kelp blades with full-res 512px cellular emerald kelp texture (`tex-fg-kelp.jpg`)!
      const { nx: kNx, ny: kNy } = _computeWallNormal(wallY, wPx * 0.42, dir);
      let drewKelpHiRes = false;
      if (renderCtx?.scratch && renderCtx?.mats?.kelp) {
        drewKelpHiRes = _compositeHiResShape(
          ctx,
          renderCtx.scratch,
          renderCtx.cw,
          renderCtx.ch,
          { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
          {
            drawShape: (sctx) => {
              // Single combined path so `destination-in` preserves EVERY kelp blade simultaneously!
              sctx.beginPath();
              for (const b of bladeGeoms) {
                traceBladeSubpath(sctx, b);
              }
              sctx.fill();
            },
            pattern: renderCtx.mats.kelp,
            texOriginX: renderCtx.texOriginX,
            texOriginY: renderCtx.texOriginY,
            texScale: 0.42,
            light,
            isNearPlane,
            boost: 1.52,
            drawOverlay: (sctx) => {
              // Wall-normal-aligned dark holdfast grounding gradient & sunlit tip lift + midrib veins
              const vg = sctx.createLinearGradient(sx - kNx * 8, sy - kNy * 8, sx + kNx * hPx, sy + kNy * hPx);
              vg.addColorStop(0, `rgba(${mergeRgb}, 0.88)`);
              vg.addColorStop(0.22, 'rgba(0, 0, 0, 0)');
              vg.addColorStop(1, `rgba(${sssRgb}, ${(0.18 * lit).toFixed(3)})`);
              sctx.fillStyle = vg;
              sctx.fillRect(minX, minY, maxX - minX, maxY - minY);

              for (const b of bladeGeoms) {
                sctx.strokeStyle = `rgba(${stalkDark}, 0.52)`;
                sctx.lineWidth = Math.max(1.0, b.ribbonW * 0.12);
                sctx.beginPath();
                sctx.moveTo(b.bx, b.by);
                for (let s = 1; s <= b.segs; s++) {
                  sctx.lineTo((b.leftPts[s].x + b.rightPts[s].x) * 0.5, b.leftPts[s].y);
                }
                sctx.stroke();
              }
            },
            drawAlphaMask: (sctx) => {
              const ag = sctx.createLinearGradient(sx - kNx * 7, sy - kNy * 7, sx + kNx * (hPx + 12), sy + kNy * (hPx + 12));
              ag.addColorStop(0, 'rgba(255, 255, 255, 0)');
              ag.addColorStop(0.06, `rgba(255, 255, 255, ${(0.98 * vis).toFixed(3)})`);
              ag.addColorStop(0.84, `rgba(255, 255, 255, ${(0.94 * vis).toFixed(3)})`);
              ag.addColorStop(1, `rgba(255, 255, 255, ${(0.68 * vis).toFixed(3)})`);
              sctx.fillStyle = ag;
              sctx.fillRect(minX, minY, maxX - minX, maxY - minY);
            },
          }
        );
      }

      for (const b of bladeGeoms) {
        if (!drewKelpHiRes) {
          const bg = ctx.createLinearGradient(b.bx, b.by, b.tip.x, b.tip.y);
          bg.addColorStop(0, `rgba(${stalkDark}, ${(0.97 * vis).toFixed(3)})`);
          bg.addColorStop(0.48, `rgba(${bladeMid}, ${(0.94 * vis).toFixed(3)})`);
          bg.addColorStop(0.88, `rgba(${bladeLit}, ${(0.88 * vis).toFixed(3)})`);
          bg.addColorStop(1, `rgba(${bladeLit}, ${(0.55 * vis).toFixed(3)})`);
          ctx.fillStyle = bg;
          ctx.beginPath();
          traceBladeSubpath(ctx, b);
          ctx.fill();

          ctx.strokeStyle = `rgba(${stalkDark}, ${(0.55 * vis).toFixed(3)})`;
          ctx.lineWidth = Math.max(1.0, b.ribbonW * 0.12);
          ctx.beginPath();
          ctx.moveTo(b.bx, b.by);
          for (let s = 1; s <= b.segs; s++) {
            ctx.lineTo((b.leftPts[s].x + b.rightPts[s].x) * 0.5, b.leftPts[s].y);
          }
          ctx.stroke();
        }

        // Translucent glowing backlit leaf edge strictly on the light-facing margin!
        if (rimPower > 0.08) {
          const edgePts = light.lightDirX >= 0 ? b.rightPts : b.leftPts;
          const eg = ctx.createLinearGradient(b.tip.x, b.tip.y, b.bx, b.by);
          eg.addColorStop(0, `rgba(${sssRgb}, ${(rimPower * 0.68 * vis).toFixed(3)})`);
          eg.addColorStop(0.65, `rgba(${sssRgb}, ${(rimPower * 0.28 * vis).toFixed(3)})`);
          eg.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.strokeStyle = eg;
          ctx.lineWidth = 1.35;
          ctx.beginPath();
          ctx.moveTo(edgePts[0].x, edgePts[0].y);
          for (let s = 1; s < b.segs; s++) {
            const mx = (edgePts[s].x + edgePts[s + 1].x) * 0.5;
            const my = (edgePts[s].y + edgePts[s + 1].y) * 0.5;
            ctx.quadraticCurveTo(edgePts[s].x, edgePts[s].y, mx, my);
          }
          ctx.lineTo(edgePts[b.segs].x, edgePts[b.segs].y);
          ctx.stroke();
          ctx.restore();
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
      const buryG = 28;
      const yL = wallY(-bw * 0.78) - dir * buryG;
      const yR = wallY(bw * 0.78) - dir * buryG;
      const endY = spanToOpp ? endLipY + dir * buryG : endLipY;
      const endHalfW = spanToOpp ? bw * 0.72 : bw * 0.46;
      const waterLen = Math.max(40, Math.abs(endLipY - sy));
      const holeCount = Math.max(2, Math.min(5, Math.round(waterLen / 34)));
      const steelDark = _shadeNearRgb(pal.rockDark, light, isNearPlane, 0.88);
      const steelMid = _shadeNearRgb(pal.rockMid, light, isNearPlane, 1.02);
      const rustStr = _shadeNearRgb(pal.rustRgb, light, isNearPlane, 1.05);
      const steelHl = _shadeNearRgb(pal.rockHighlight, light, isNearPlane, 1.2);
      const kelpStr = _shadeNearRgb(pal.floraMid, light, isNearPlane, 1.05);

      // Weld girder into anchor bulkhead (and opposite bulkhead when spanning full hold!) with grounded textured AO shadow
      _drawWallWeldCollar(ctx, sx, wallY, bw * 1.08, dir, 6.5, buryG, mergeRgb, 0.56, vis, renderCtx, light, isNearPlane);
      if (spanToOpp) {
        _drawWallWeldCollar(ctx, tipX, () => endLipY, bw * 1.04, -dir, 6.5, buryG, mergeRgb, 0.56, vis, renderCtx, light, isNearPlane);
      }

      const holes = [];
      for (let h = 0; h < holeCount; h++) {
        const u = (h + 0.55) / (holeCount + 0.15);
        const hx = sx + (tipX - sx) * u;
        const hy = sy + (endLipY - sy) * u;
        const hr = Math.max(4.5, bw * (0.23 - (spanToOpp ? 0.02 : u * 0.04)));
        holes.push({ hx, hy, hr, u });
      }

      const traceGirderWithHoles = (c) => {
        c.beginPath();
        c.moveTo(sx - bw * 0.78, yL);
        c.lineTo(tipX - endHalfW, endY);
        c.lineTo(tipX + endHalfW, endY);
        c.lineTo(sx + bw * 0.78, yR);
        c.closePath();
        for (let h = 0; h < holes.length; h++) {
          const { hx, hy, hr } = holes[h];
          c.moveTo(hx + hr, hy);
          c.ellipse(hx, hy, hr, hr, 0, 0, Math.PI * 2);
        }
        try {
          c.fill('evenodd');
        } catch {
          c.fill();
        }
      };

      const gMinX = Math.min(sx - bw, tipX - endHalfW) - 8;
      const gMaxX = Math.max(sx + bw, tipX + endHalfW) + 8;
      const gMinY = Math.min(yL, yR, endY) - 8;
      const gMaxY = Math.max(yL, yR, endY) + 8;

      let drewSteelHiRes = false;
      if (renderCtx?.scratch && renderCtx?.mats?.rock) {
        drewSteelHiRes = _compositeHiResShape(
          ctx,
          renderCtx.scratch,
          renderCtx.cw,
          renderCtx.ch,
          { x: gMinX, y: gMinY, w: gMaxX - gMinX, h: gMaxY - gMinY },
          {
            drawShape: traceGirderWithHoles,
            pattern: renderCtx.mats.rock,
            texOriginX: renderCtx.texOriginX,
            texOriginY: renderCtx.texOriginY,
            texScale: 0.56,
            light,
            isNearPlane,
            boost: 1.24,
            drawOverlay: (sctx) => {
              const sg = sctx.createLinearGradient(sx - bw * 0.7, sy, sx + bw * 0.7, endY);
              sg.addColorStop(0, `rgba(${steelMid}, 0.25)`);
              sg.addColorStop(0.55, `rgba(${steelDark}, 0.35)`);
              sg.addColorStop(1, `rgba(${rustStr}, 0.42)`);
              sctx.fillStyle = sg;
              sctx.fillRect(gMinX, gMinY, gMaxX - gMinX, gMaxY - gMinY);
            },
            drawAlphaMask: (sctx) => {
              const ag = sctx.createLinearGradient(sx, yL, tipX, endY);
              ag.addColorStop(0, 'rgba(255, 255, 255, 0)');
              ag.addColorStop(0.12, `rgba(255, 255, 255, ${(0.99 * vis).toFixed(3)})`);
              if (spanToOpp) {
                ag.addColorStop(0.88, `rgba(255, 255, 255, ${(0.99 * vis).toFixed(3)})`);
                ag.addColorStop(1, 'rgba(255, 255, 255, 0)');
              } else {
                ag.addColorStop(1, `rgba(255, 255, 255, ${(0.97 * vis).toFixed(3)})`);
              }
              sctx.fillStyle = ag;
              sctx.fillRect(gMinX, gMinY, gMaxX - gMinX, gMaxY - gMinY);
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
        traceGirderWithHoles(ctx);
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

      // Seal the wall joint with a subtle photorealistic mineral rock socket + tucked AO crevice
      _drawWallWeldCollar(ctx, sx, wallY, wPx * 0.44, dir, Math.max(5, Math.min(8, hPx * 0.065)), Math.max(24, hPx * 0.20), mergeRgb, 0.50, vis, renderCtx, light, isNearPlane);

      const spires = [];
      let minX = sx - wPx;
      let maxX = sx + wPx;
      let minY = Math.min(sy, sy + dir * hPx) - 16;
      let maxY = Math.max(sy, sy + dir * hPx) + 16;

      for (let i = 0; i < count; i++) {
        const order = i === count - 1 ? Math.floor(count / 2) : (i >= Math.floor(count / 2) ? i + 1 : i);
        const u = count <= 1 ? 0 : order / (count - 1) - 0.5;
        const isHero = order === Math.floor(count / 2);
        const tilt = u * 1.08 + el.lean * 0.38 + (_hash01(el.seed + order * 19) - 0.5) * 0.14;
        const cLen = hPx * (isHero ? 1.02 : 0.44 + (1 - Math.abs(u) * 1.35) * 0.34 + _hash01(el.seed + order * 7) * 0.12);
        const cHalfW = Math.max(4.5, wPx * (isHero ? 0.145 : 0.10));

        const dx0 = u * wPx * 0.48;
        const bx = sx + dx0;
        const by = wallY(dx0) - dir * 6;
        const ax = Math.sin(tilt);
        const ay = dir * Math.cos(tilt);
        const px = Math.cos(tilt);
        const py = -dir * Math.sin(tilt);

        const tipX = bx + ax * cLen;
        const tipY = by + ay * cLen;
        const shDist = cLen * 0.74;
        const lShX = bx + ax * shDist - px * cHalfW;
        const lShY = by + ay * shDist - py * cHalfW;
        const rShX = bx + ax * shDist + px * cHalfW;
        const rShY = by + ay * shDist + py * cHalfW;
        const lBaseX = bx - px * cHalfW * 0.78;
        const lBaseY = by - py * cHalfW * 0.78;
        const rBaseX = bx + px * cHalfW * 0.78;
        const rBaseY = by + py * cHalfW * 0.78;
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

      // Composite all crystal spires with full-res 512px faceted amethyst/quartz texture (`tex-fg-crystal.jpg`)!
      let drewCrystalHiRes = false;
      if (renderCtx?.scratch && renderCtx?.mats?.crystal) {
        drewCrystalHiRes = _compositeHiResShape(
          ctx,
          renderCtx.scratch,
          renderCtx.cw,
          renderCtx.ch,
          { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
          {
            drawShape: (sctx) => {
              // Single combined path so `destination-in` preserves EVERY crystal spire simultaneously!
              sctx.beginPath();
              for (const sp of spires) {
                traceSpireSubpath(sctx, sp);
              }
              sctx.fill();
            },
            pattern: renderCtx.mats.crystal,
            texOriginX: renderCtx.texOriginX,
            texOriginY: renderCtx.texOriginY,
            texScale: 0.44,
            light,
            isNearPlane,
            boost: 1.68,
            drawOverlay: (sctx) => {
              // Dark mineral socket grounding tint right at the crystal-rock base
              const bg = sctx.createLinearGradient(sx, sy - dir * 6, sx, sy + dir * Math.min(34, hPx * 0.34));
              bg.addColorStop(0, `rgba(${mergeRgb}, 0.78)`);
              bg.addColorStop(1, 'rgba(0, 0, 0, 0)');
              sctx.fillStyle = bg;
              sctx.fillRect(minX, minY, maxX - minX, maxY - minY);

              for (const sp of spires) {
                // Darken shadowed half-facet & brighten lit half-facet for crisp 3D hexagonal cleavage planes
                sctx.fillStyle = 'rgba(4, 8, 22, 0.42)';
                sctx.beginPath();
                sctx.moveTo(sp.bx, sp.by);
                sctx.lineTo(sp.tipX, sp.tipY);
                if (litRight) {
                  sctx.lineTo(sp.lShX, sp.lShY);
                  sctx.lineTo(sp.lBaseX, sp.lBaseY);
                } else {
                  sctx.lineTo(sp.rShX, sp.rShY);
                  sctx.lineTo(sp.rBaseX, sp.rBaseY);
                }
                sctx.closePath();
                sctx.fill();

                if (rimPower > 0.06) {
                  const fGrad = sctx.createLinearGradient(sp.tipX, sp.tipY, sp.bx, sp.by);
                  fGrad.addColorStop(0, `rgba(${rimRgb}, ${(rimPower * 0.56).toFixed(3)})`);
                  fGrad.addColorStop(0.58, `rgba(${prismShaded}, ${(rimPower * 0.28).toFixed(3)})`);
                  fGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                  sctx.fillStyle = fGrad;
                  sctx.beginPath();
                  sctx.moveTo(sp.bx, sp.by);
                  sctx.lineTo(sp.tipX, sp.tipY);
                  if (litRight) {
                    sctx.lineTo(sp.rShX, sp.rShY);
                    sctx.lineTo(sp.rBaseX, sp.rBaseY);
                  } else {
                    sctx.lineTo(sp.lShX, sp.lShY);
                    sctx.lineTo(sp.lBaseX, sp.lBaseY);
                  }
                  sctx.closePath();
                  sctx.fill();
                }
              }
            },
            drawAlphaMask: (sctx) => {
              const ag = sctx.createLinearGradient(sx, sy - dir * 10, sx, sy + dir * hPx);
              ag.addColorStop(0, 'rgba(255, 255, 255, 0)');
              ag.addColorStop(0.08, `rgba(255, 255, 255, ${(0.99 * vis).toFixed(3)})`);
              ag.addColorStop(0.75, `rgba(255, 255, 255, ${(0.93 * vis).toFixed(3)})`);
              ag.addColorStop(1, `rgba(255, 255, 255, ${(0.90 * vis).toFixed(3)})`);
              sctx.fillStyle = ag;
              sctx.fillRect(minX, minY, maxX - minX, maxY - minY);
            },
          }
        );
      }

      for (const sp of spires) {
        if (!drewCrystalHiRes) {
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
        if (rimPower > 0.06) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.strokeStyle = `rgba(${rimRgb}, ${(rimPower * (sp.isHero ? 0.80 : 0.54) * vis).toFixed(3)})`;
          ctx.lineWidth = sp.isHero ? 1.5 : 1.05;
          ctx.beginPath();
          ctx.moveTo(sp.lShX, sp.lShY);
          ctx.lineTo(sp.tipX, sp.tipY);
          ctx.lineTo(sp.rShX, sp.rShY);
          ctx.stroke();
          ctx.restore();
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

      _drawWallWeldCollar(ctx, sx, wallY, halfW * 0.90, dir, Math.max(5, Math.min(7, hPx * 0.065)), Math.max(24, hPx * 0.20), mergeRgb, 0.50, vis, renderCtx, light, isNearPlane);

      const spearGeoms = [];
      let minX = sx - halfW * 1.1;
      let maxX = sx + halfW * 1.1;
      let minY = Math.min(sy, sy + dir * hPx) - 16;
      let maxY = Math.max(sy, sy + dir * hPx) + 16;
      for (let i = 0; i < spears; i++) {
        const u = spears <= 1 ? 0 : i / (spears - 1) - 0.5;
        const j = (_hash01(el.seed + i * 29.3) - 0.5) * 0.14;
        const dx0 = (u + j) * halfW * 1.70;
        const bx = sx + dx0;
        const by = wallY(dx0) - dir * 5;
        const isMain = Math.abs(u) < 0.22;
        const len = hPx * (isMain ? 0.84 + _hash01(el.seed + i * 7) * 0.22 : 0.36 + _hash01(el.seed + i * 17) * 0.40);
        const halfBase = Math.max(3.6, wPx * (isMain ? 0.105 : 0.072));
        const tipX = bx + leanPx * 0.28;
        const tipY = by + dir * len;
        if (tipY - 6 < minY) minY = tipY - 6;
        if (tipY + 6 > maxY) maxY = tipY + 6;
        spearGeoms.push({ bx, by, dx0, isMain, len, halfBase, tipX, tipY });
      }

      const traceIcicleSubpath = (c, g) => {
        c.moveTo(g.bx - g.halfBase, wallY(g.dx0 - g.halfBase) - dir * 5);
        c.quadraticCurveTo(g.bx - g.halfBase * 0.30, g.by + dir * g.len * 0.52, g.tipX, g.tipY);
        c.quadraticCurveTo(g.bx + g.halfBase * 0.34, g.by + dir * g.len * 0.52, g.bx + g.halfBase, wallY(g.dx0 + g.halfBase) - dir * 5);
        c.closePath();
      };

      let drewIceHiRes = false;
      if (renderCtx?.scratch && renderCtx?.mats?.ice) {
        drewIceHiRes = _compositeHiResShape(
          ctx,
          renderCtx.scratch,
          renderCtx.cw,
          renderCtx.ch,
          { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
          {
            drawShape: (sctx) => {
              // Single combined path so `destination-in` preserves EVERY icicle spear simultaneously!
              sctx.beginPath();
              for (const g of spearGeoms) {
                traceIcicleSubpath(sctx, g);
              }
              sctx.fill();
            },
            pattern: renderCtx.mats.ice,
            texOriginX: renderCtx.texOriginX,
            texOriginY: renderCtx.texOriginY,
            texScale: 0.44,
            light,
            isNearPlane,
            boost: 1.58,
            drawAlphaMask: (sctx) => {
              const ag = sctx.createLinearGradient(sx, sy - dir * 8, sx, sy + dir * hPx);
              ag.addColorStop(0, 'rgba(255, 255, 255, 0)');
              ag.addColorStop(0.08, `rgba(255, 255, 255, ${(0.98 * vis).toFixed(3)})`);
              ag.addColorStop(0.85, `rgba(255, 255, 255, ${(0.92 * vis).toFixed(3)})`);
              ag.addColorStop(1, `rgba(255, 255, 255, ${(0.88 * vis).toFixed(3)})`);
              sctx.fillStyle = ag;
              sctx.fillRect(minX, minY, maxX - minX, maxY - minY);
            },
          }
        );
      }

      for (const g of spearGeoms) {
        if (!drewIceHiRes) {
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
        if (rimPower > 0.06) {
          const hlSign = light.lightDirX >= 0 ? 1 : -1;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.strokeStyle = `rgba(${rimRgb}, ${(rimPower * (g.isMain ? 0.78 : 0.54) * vis).toFixed(3)})`;
          ctx.lineWidth = g.isMain ? 1.45 : 1.0;
          ctx.beginPath();
          ctx.moveTo(g.bx + hlSign * g.halfBase * 0.42, g.by + dir * 3);
          ctx.quadraticCurveTo(g.bx + hlSign * g.halfBase * 0.16, g.by + dir * g.len * 0.52, g.tipX, g.tipY);
          ctx.stroke();
          ctx.restore();
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
        _drawCausticRibbons(c, sx, sy, wPx, hPx, dir, timeSec, reduced, light);
      };
      _fillWallHuggingRock(ctx, sx, sy, wPx, hPx, dir, wallY, pal, light, rockPattern, isNearPlane, pts, drawCarvedRelief, renderCtx);
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
      // Strictly monotonic organic karst limestone overhang ridge locked to the live SDF wall contour!
      const halfW = wPx * 0.54;
      const ridgeSteps = 10;
      const pts = [];
      for (let i = 0; i <= ridgeSteps; i++) {
        const u = i / ridgeSteps; // 0 -> 1 strictly increasing X!
        const dx = (u - 0.5) * halfW * 2;
        const env = Math.pow(Math.sin(u * Math.PI), 1.18);
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
        _drawCausticRibbons(c, sx, sy, wPx, hPx, dir, timeSec, reduced, light);
      };

      _fillWallHuggingRock(ctx, sx, sy, wPx, hPx, dir, wallY, pal, light, rockPattern, isNearPlane, pts, drawKarstDetail, renderCtx);
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
  } else if (el.kind === 'crystal-cluster' || el.kind === 'icicle-cluster') {
    const glintA = _clamp((light.beamLit - 0.18) * 0.95 + light.sunLit * 0.36 + light.backLit * 0.34, 0, 0.92) * vis;
    if (glintA > 0.09) {
      const twinkle = reduced ? 1 : 0.70 + 0.30 * Math.sin(timeSec * 4.4 + el.phase);
      _drawStarGlint(ctx, sx + leanPx * 0.36, sy + dir * hPx * 0.94, Math.max(5.5, hPx * 0.095), rimRgb, glintA * twinkle);
      if (glintA > 0.32) {
        _drawStarGlint(ctx, sx - wPx * 0.20, wallY(-wPx * 0.20) + dir * hPx * 0.58, Math.max(3.6, hPx * 0.055), sssRgb, glintA * 0.65 * twinkle);
      }
    }
  } else if (el.kind === 'wreck-girder') {
    const rimA = _clamp(light.backLit * 0.48 + (light.beamLit - 0.18) * 0.46, 0, 0.66) * vis;
    if (rimA > 0.09) {
      const bw = Math.max(18, wPx * 0.42);
      const sideSign = light.lightDirX >= 0 ? 1 : -1;
      const tipX = sx + leanPx * 1.1 + sideSign * bw * 0.44;
      const tipY = sy + dir * hPx * 0.95;
      const baseX = sx + sideSign * bw * 0.68;
      const baseY = wallY(sideSign * bw * 0.68);
      const rGrad = ctx.createLinearGradient(tipX, tipY, baseX, baseY);
      rGrad.addColorStop(0, `rgba(${rimRgb}, ${(rimA * 0.85).toFixed(3)})`);
      rGrad.addColorStop(0.65, `rgba(${rimRgb}, ${(rimA * 0.28).toFixed(3)})`);
      rGrad.addColorStop(1, `rgba(${rimRgb}, 0)`);
      ctx.strokeStyle = rGrad;
      ctx.lineWidth = 2.0;
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
    const scratch = _getFgScratch(this, Math.min(768, cw), Math.min(768, ch));
    const inCombat = Boolean(secretLair?.combatMode);
    const reduced = Boolean(this._reducedMotion);
    const diverSx = diver ? viewCenterX + (diver.x - effCamX) * scale : -9999;
    const diverSy = diver ? viewCenterY + (diver.y - effCamY) * scale : -9999;

    const innerClearR = Math.max(16, scale * 0.44);
    const outerClearR = Math.max(30, scale * 0.84);

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
      const p = el.parallax;
      const pyScale = 1 + (p - 1) * 0.14;
      const dxPar = (el.x - effCamX) * scale * (p - 1);
      const sx = viewCenterX + (el.x - effCamX) * scale + dxPar;
      const fallbackSy = viewCenterY + (el.y - effCamY) * scale * pyScale + dxPar * (el.wallSlope || 0) * 0.88;

      const wPx = el.widthM * scale * p;
      const hPx = el.heightM * scale * p;
      const margin = Math.max(wPx, hPx) + 54;
      if (sx < -margin || sx > cw + margin || fallbackSy < -margin || fallbackSy > ch + margin) continue;

      const dir = el.side === 'ceiling' ? 1 : -1;
      // Lock attachment seam pixel-tight to the LIVE background cave SDF contour behind sx (zero floating / zero leaking light!)
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

      // Anchor core-fade strictly at the buried wall-contact root so open-water edges stay 100% SOLID over the diver!
      const coreY = sy + dir * Math.min(hPx * 0.22, scale * 0.34);
      const distCore = Math.hypot(sx - diverSx, coreY - diverSy);
      let proxFade = 1.0;
      if (distCore < outerClearR) {
        const u = _clamp((distCore - innerClearR) / Math.max(1, outerClearR - innerClearR), 0, 1);
        proxFade = 0.34 + u * u * 0.66;
      }

      const baseAlpha = inCombat ? 0.30 : (el.depthLayer === 'mid' ? 0.98 : 0.95);
      const finalAlpha = baseAlpha * proxFade;
      if (finalAlpha < 0.04) continue;

      const light = computeForegroundElementLighting(el, this.level, solveOpts, _lightScratch);

      const swayPx = reduced
        ? 0
        : Math.sin(timeSec * (el.kind === 'wreck-chain' ? 1.05 : 1.42) + el.phase) *
          (el.kind === 'cenote-roots' || el.kind === 'kelp-fronds' ? 0.28 * scale : 0.08 * scale);

      const renderCtx = scratch
        ? {
            scratch,
            mats,
            cw,
            ch,
            texOriginX: sx - el.x * scale * 0.45,
            texOriginY: sy - el.y * scale * 0.45,
            scale,
          }
        : null;

      ctx.globalAlpha = finalAlpha;
      _drawBaseFormation(ctx, el, sx, sy, wPx, hPx, dir, pal, swayPx, light, timeSec, reduced, rockPattern, wallProfile, renderCtx);
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
      const p = el.parallax;
      const pyScale = 1 + (p - 1) * 0.14;
      const dxPar = (el.x - effCamX) * scale * (p - 1);
      const sx = viewCenterX + (el.x - effCamX) * scale + dxPar;
      const sy = viewCenterY + (el.y - effCamY) * scale * pyScale + dxPar * (el.wallSlope || 0) * 0.88;

      const wPx = el.widthM * scale * p;
      const hPx = el.heightM * scale * p;
      const margin = Math.max(wPx, hPx) + 54;
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
