import { evaluateCaveSDF } from '../collision.js';
import { getTorchOptic } from '../rigLivery.js';
import { computeStormLightningFlash } from '../weather.js';

/**
 * Living, Light-Integrated Foreground Parallax Depth Elements (v224 / v249).
 *
 * Two-pass rendering architecture seamlessly integrated with the lighting system:
 * - Pass 1 (`_drawForegroundDepthElements`, rendered RIGHT AFTER the diver and RIGHT BEFORE `_drawLighting`):
 *   Draws sculpted, biome-crafted foreground formations anchored along the exact local cave wall slope
 *   (`wallSlope` computed from the cave SDF gradient!) directly IN FRONT of the diver so the diver
 *   subtly glides behind their outer edges, root curtains, kelp fronds, crystal spires, and hull ribs.
 *   Because `_drawLighting` runs immediately afterward, real ray-cast cave darkness, cenote sun shafts,
 *   ray-cast diver & peer torch cones, geothermal vents, and power-relay floodlights illuminate every
 *   foreground pixel naturally—zero glowing stickers in unlit darkness!
 * - Pass 2 (`_drawForegroundDepthLightingAccents`, rendered AFTER `_drawLighting`):
 *   Adds delicate edge-hugging backlit rim wrap, translucent subsurface leaf/root/ice edge highlights,
 *   and pinpoint crystal/wet-metal diamond glints strictly where real light sources strike!
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
        rockDark: [26, 33, 42],
        rockMid: [56, 68, 80],
        rockHighlight: [106, 122, 138],
        rustRgb: [140, 74, 42],
        rimRgb: [178, 208, 228],
        floraDark: [18, 44, 38],
        floraMid: [38, 88, 68],
        sssRgb: [84, 212, 176],
        mossRgb: [44, 106, 76],
      };
    case 'ice':
      return {
        rockDark: rockBase ? [Math.round(rockBase[0] * 0.65), Math.round(rockBase[1] * 0.76), Math.round(rockBase[2] * 0.88)] : [24, 58, 92],
        rockMid: [72, 146, 196],
        rockHighlight: [186, 236, 255],
        rustRgb: [134, 214, 248],
        rimRgb: [216, 246, 255],
        floraDark: [24, 66, 102],
        floraMid: [82, 172, 220],
        sssRgb: [142, 234, 255],
        mossRgb: [152, 226, 250],
      };
    case 'volcanic':
      return {
        rockDark: [24, 21, 28],
        rockMid: [50, 44, 56],
        rockHighlight: [92, 80, 92],
        rustRgb: [255, 114, 36],
        rimRgb: [255, 168, 96],
        floraDark: [30, 22, 24],
        floraMid: [66, 44, 38],
        sssRgb: [255, 134, 52],
        mossRgb: [204, 88, 34],
      };
    case 'crystal':
      return {
        rockDark: rockBase || [46, 38, 34],
        rockMid: [82, 96, 158],
        rockHighlight: [184, 212, 255],
        rustRgb: [168, 146, 252],
        rimRgb: [218, 232, 255],
        floraDark: [40, 50, 96],
        floraMid: [102, 132, 214],
        sssRgb: [168, 218, 255],
        mossRgb: [146, 208, 250],
      };
    case 'mine':
      return {
        rockDark: [38, 28, 20],
        rockMid: [86, 62, 40],
        rockHighlight: [142, 104, 68],
        rustRgb: [168, 96, 46],
        rimRgb: [228, 168, 98],
        floraDark: [36, 26, 18],
        floraMid: [78, 58, 38],
        sssRgb: [236, 172, 90],
        mossRgb: [116, 86, 50],
      };
    case 'monolith':
      return {
        rockDark: rockBase || [38, 50, 58],
        rockMid: [70, 96, 106],
        rockHighlight: [126, 164, 174],
        rustRgb: [82, 188, 200],
        rimRgb: [162, 228, 246],
        floraDark: [22, 58, 56],
        floraMid: [48, 118, 108],
        sssRgb: [96, 226, 228],
        mossRgb: [56, 152, 132],
      };
    case 'cenote':
    default:
      return {
        rockDark: rockBase || [48, 38, 30],
        rockMid: rockBase ? [Math.round(rockBase[0] * 1.45), Math.round(rockBase[1] * 1.4), Math.round(rockBase[2] * 1.35)] : [78, 62, 48],
        rockHighlight: [128, 108, 86],
        rustRgb: [68, 46, 30], // gnarled cenote mangrove mahogany bark
        rimRgb: [152, 224, 226],
        floraDark: [18, 54, 42],
        floraMid: [44, 114, 78],
        sssRgb: [104, 236, 162],
        mossRgb: [56, 142, 86],
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
 * Deterministically generate strategic ceiling & floor foreground depth elements for a level.
 * Anchors right along real cavern rock boundaries AND samples the exact local SDF wall slope
 * (`wallSlope = dy/dx`) so every rock overhang, crystal geode, icicle curtain, root crown & kelp
 * holdfast hugs the real sloping cave geometry with zero flat horizontal seams!
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
      avoidPts.push({ x: cp.x, y: cp.y, r: 3.2 });
    }
  }

  let idHash = 17;
  const lid = String(level.id || 'lvl');
  for (let i = 0; i < lid.length; i++) idHash = (idHash * 31 + lid.charCodeAt(i)) % 99991;

  const elements = [];
  const MAX_ELEMENTS = 44;
  const MIN_SPACING_SQ = 7.8 * 7.8;

  for (let sIdx = 0; sIdx < segs.length && elements.length < MAX_ELEMENTS; sIdx++) {
    const s = segs[sIdx];
    const ax = s.ax ?? s.x1 ?? 0;
    const ay = s.ay ?? s.y1 ?? 0;
    const bx = s.bx ?? s.x2 ?? ax;
    const by = s.by ?? s.y2 ?? ay;
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 3.5) continue;

    const samples = Math.max(1, Math.min(4, Math.floor(len / 9.0)));
    for (let k = 0; k < samples && elements.length < MAX_ELEMENTS; k++) {
      const seed = idHash + sIdx * 131 + k * 29;
      const t = (k + 0.28 + _hash01(seed) * 0.44) / samples;
      const mx = ax + (bx - ax) * t;
      const my = ay + (by - ay) * t;

      if (my < 2.8 || evaluateCaveSDF(level, mx, my) > -1.35) continue;

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
      if (spanH < 4.8) continue;

      const placeOnCeiling = ((sIdx + k) % 2 === 0) && ceilY > 1.8;
      const wallY = placeOnCeiling ? ceilY : floorY;
      // Compute local wall tangent slope (dy/dx) from SDF gradient so bases hug angled cave walls!
      const eps = 0.28;
      const gx = evaluateCaveSDF(level, mx + eps, wallY) - evaluateCaveSDF(level, mx - eps, wallY);
      const gy = evaluateCaveSDF(level, mx, wallY + eps) - evaluateCaveSDF(level, mx, wallY - eps);
      const wallSlope = Math.abs(gy) > 0.025 ? _clamp(-gx / gy, -0.58, 0.58) : 0;

      // Tuck anchor slightly inside the rock lip so sloping bases never leave an air gap
      const anchorY = placeOnCeiling ? ceilY - 0.16 : floorY + 0.16;

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
      if (biome === 'wreck') {
        if (placeOnCeiling) kind = r1 < 0.48 ? 'wreck-chain' : 'wreck-girder';
        else kind = r1 < 0.52 ? 'wreck-railing' : 'wreck-girder';
      } else if (biome === 'ice') {
        kind = placeOnCeiling ? 'icicle-cluster' : (r1 < 0.42 ? 'icicle-cluster' : 'limestone-overhang');
      } else if (biome === 'volcanic') {
        kind = placeOnCeiling ? 'limestone-overhang' : 'basalt-spire';
      } else if (biome === 'crystal') {
        kind = 'crystal-cluster';
      } else if (biome === 'mine') {
        kind = placeOnCeiling ? (r1 < 0.48 ? 'mine-beam' : 'wreck-chain') : 'mine-beam';
      } else if (biome === 'monolith') {
        kind = 'monolith-block';
      } else {
        if (placeOnCeiling) {
          kind = anchorY < 20 && (sIdx + k) % 3 !== 2 ? 'cenote-roots' : 'limestone-overhang';
        } else {
          kind = anchorY < 22 && (sIdx + k) % 3 !== 2 ? 'kelp-fronds' : 'limestone-overhang';
        }
      }

      const isCurtain =
        kind === 'cenote-roots' ||
        kind === 'kelp-fronds' ||
        kind === 'wreck-chain' ||
        kind === 'icicle-cluster' ||
        kind === 'crystal-cluster';

      const isMidPlane = isCurtain ? r4 < 0.72 : r4 < 0.62;
      const depthLayer = isMidPlane ? 'mid' : 'near';
      const parallax = isMidPlane ? 1.06 + r1 * 0.04 : 1.11 + r1 * 0.06;

      const maxReach = isCurtain ? Math.min(3.75, spanH * 0.36) : Math.min(3.15, spanH * 0.29);
      const heightM = Math.max(1.35, maxReach * (0.64 + r2 * 0.36));
      const widthM = Math.max(1.25, heightM * (0.68 + r3 * 0.44));

      elements.push({
        x: mx,
        y: anchorY,
        side: placeOnCeiling ? 'ceiling' : 'floor',
        biome,
        kind,
        depthLayer,
        wallSlope,
        widthM,
        heightM,
        parallax,
        lean: (r2 - 0.5) * 0.32,
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
  const wy = el.y + dir * el.heightM * 0.55;

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
    if (haloDist < 5.0) {
      const hFrac = _smoothstep(5.0, 0.6, haloDist);
      const weight = hFrac * (isLocal ? 0.56 : 0.34);
      backLit = Math.max(backLit, hFrac * (isLocal ? 0.58 : 0.32));
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

      if (absD < 0.78) {
        const coneSoft = _smoothstep(0.78, 0.14, absD);
        const hotCore = _smoothstep(0.28, 0.0, absD) * 0.35;
        const lit = Math.min(1.15, (coneSoft + hotCore) * rangeFalloff * (isLocal ? 1.05 : 0.68));
        beamLit = Math.max(beamLit, lit);
        const w = lit * 1.6;
        accW += w;
        accR += (coreR * 0.65 + shaftR * 0.35) * w;
        accG += (coreG * 0.65 + shaftG * 0.35) * w;
        accB += (coreB * 0.65 + shaftB * 0.35) * w;
        dirX += toLx * w;
        dirY += toLy * w;
      }

      if (dist < 6.2 && absD < 1.55) {
        const prox = _smoothstep(6.2, 0.8, dist);
        const sideWrap = _smoothstep(1.55, 0.25, absD);
        const bl = prox * (0.38 + sideWrap * 0.62) * (isLocal ? 1.0 : 0.6);
        backLit = Math.max(backLit, bl);
        const w = bl * 1.2;
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

function _rgbStr(rgb) {
  return `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`;
}

function _blendWithLight(baseRgb, light, factor) {
  const k = _clamp(factor, 0, 1);
  const r = Math.round(baseRgb[0] + (light.lightR - baseRgb[0]) * k);
  const g = Math.round(baseRgb[1] + (light.lightG - baseRgb[1]) * k);
  const b = Math.round(baseRgb[2] + (light.lightB - baseRgb[2]) * k);
  return `${r}, ${g}, ${b}`;
}

function _applyRockPatternTransform(pattern, sx, sy) {
  if (!pattern || typeof pattern.setTransform !== 'function' || typeof DOMMatrix === 'undefined') return;
  try {
    pattern.setTransform(new DOMMatrix().translate(sx, sy).scale(0.92, 0.92));
  } catch {}
}

function _strokeDropShadow(ctx, tracePath, dir, offsetPx, widthPx, alpha = 0.28) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(2, 6, 12, ${alpha.toFixed(3)})`;
  ctx.lineWidth = widthPx;
  if (typeof ctx.translate === 'function') {
    ctx.translate(0, dir * offsetPx);
  }
  ctx.beginPath();
  tracePath();
  ctx.stroke();
  ctx.restore();
}

function _drawCausticRibbons(ctx, sx, sy, wPx, hPx, dir, timeSec, reduced, light) {
  if (light.causticAlpha <= 0.02) return;
  const phase = reduced ? 0 : timeSec * 1.85;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = `rgba(176, 248, 255, ${light.causticAlpha.toFixed(3)})`;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const u = (i + 0.5) / 3;
    const wave = Math.sin(phase + i * 2.1 + sx * 0.015) * wPx * 0.14;
    const y0 = sy + dir * hPx * (0.24 + u * 0.46);
    ctx.lineWidth = Math.max(1.3, hPx * 0.026);
    ctx.beginPath();
    ctx.moveTo(sx - wPx * 0.44 + wave, y0);
    ctx.quadraticCurveTo(sx + wave * 0.4, y0 + dir * hPx * 0.07, sx + wPx * 0.42 + wave * 0.8, y0 - dir * hPx * 0.04);
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
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(gx - rad, gy);
  ctx.lineTo(gx + rad, gy);
  ctx.moveTo(gx, gy - rad);
  ctx.lineTo(gx, gy + rad);
  ctx.stroke();
  ctx.fillStyle = `rgba(255, 255, 255, ${(alpha * 0.88).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(gx, gy, rad * 0.24, rad * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a rock-anchored formation that hugs the EXACT local cave wall slope (`wallSlope`),
 * blends seamlessly into the real rock wall with ZERO dark top cutoff seam, and casts a soft
 * water-side drop-shadow onto anything passing behind its sculpted edge!
 */
function _fillRockAnchoredForm(
  ctx,
  sx,
  sy,
  wPx,
  hPx,
  dir,
  pal,
  light,
  rockPattern,
  isNearPlane,
  traceCrest,
  closeWallHugBase,
  drawDetails = null
) {
  const tipY = sy + dir * hPx;

  // 1. Soft water-facing drop shadow (creates immediate 3D separation over the diver behind!)
  _strokeDropShadow(ctx, traceCrest, dir, isNearPlane ? 5 : 3, isNearPlane ? 9 : 6, isNearPlane ? 0.28 : 0.20);

  // 2. Main textured rock body: seamlessly uses the cave's REAL rock texture pattern!
  ctx.beginPath();
  traceCrest();
  closeWallHugBase();
  ctx.closePath();

  if (rockPattern) {
    _applyRockPatternTransform(rockPattern, sx, sy);
    ctx.fillStyle = rockPattern;
    ctx.fill();
    // Gentle depth shading strictly toward the water-facing crest -> 0% opacity at the wall contact
    // so there is ZERO visible seam where the foreground rock joins the cavern wall!
    const glaze = ctx.createLinearGradient(sx, tipY, sx, sy);
    glaze.addColorStop(0, `rgba(${_rgbStr(pal.rockDark)}, 0.34)`);
    glaze.addColorStop(0.55, `rgba(${_rgbStr(pal.rockDark)}, 0.14)`);
    glaze.addColorStop(1, `rgba(${_rgbStr(pal.rockDark)}, 0)`);
    ctx.fillStyle = glaze;
    ctx.fill();
  } else {
    const grad = ctx.createLinearGradient(sx, tipY, sx, sy);
    grad.addColorStop(0, `rgba(${_rgbStr(pal.rockMid)}, 0.96)`);
    grad.addColorStop(0.6, `rgba(${_rgbStr(pal.rockDark)}, 0.92)`);
    grad.addColorStop(1, `rgba(${_rgbStr(pal.rockDark)}, 0.72)`);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // 3. Clipped internal rock sculpture & caustics
  if (typeof ctx.clip === 'function') {
    ctx.save();
    ctx.beginPath();
    traceCrest();
    closeWallHugBase();
    ctx.closePath();
    ctx.clip();

    const gx0 = sx + light.lightDirX * wPx * 0.9;
    const gy0 = (sy + tipY) * 0.5 + light.lightDirY * hPx * 0.65;
    const gx1 = sx - light.lightDirX * wPx * 0.9;
    const gy1 = (sy + tipY) * 0.5 - light.lightDirY * hPx * 0.65;
    const hlGrad = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    hlGrad.addColorStop(0, `rgba(${_rgbStr(pal.rockHighlight)}, 0.28)`);
    hlGrad.addColorStop(0.45, `rgba(${_rgbStr(pal.rockHighlight)}, 0.08)`);
    hlGrad.addColorStop(1, 'rgba(0, 0, 0, 0.18)');
    ctx.fillStyle = hlGrad;
    ctx.fill();

    if (drawDetails) drawDetails();

    ctx.restore();
  }

  // 4. Delicate water-facing edge highlight facing the light (NEVER strokes the wall-contact base!)
  const rx0 = sx + light.lightDirX * wPx * 0.85;
  const rx1 = sx - light.lightDirX * wPx * 0.65;
  const bevelGrad = ctx.createLinearGradient(rx0, tipY, rx1, sy);
  bevelGrad.addColorStop(0, `rgba(${_rgbStr(pal.rockHighlight)}, 0.42)`);
  bevelGrad.addColorStop(0.55, `rgba(${_rgbStr(pal.rockHighlight)}, 0.12)`);
  bevelGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.strokeStyle = bevelGrad;
  ctx.lineWidth = Math.max(1.1, Math.min(2.1, hPx * 0.018));
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  traceCrest();
  ctx.stroke();
}

/**
 * PASS 1 (Pre-Lighting): Draw rich, wall-hugging, biome-crafted foreground formations
 * ON TOP of the diver and INSIDE the real lighting pipeline!
 */
function _drawBaseFormation(ctx, el, sx, sy, wPx, hPx, dir, pal, swayPx, light, timeSec, reduced, rockPattern) {
  const leanPx = el.lean * wPx;
  const slope = Number.isFinite(el.wallSlope) ? el.wallSlope : 0;
  const wallY = (dx) => sy + dx * slope;
  const isNearPlane = el.depthLayer === 'near';

  switch (el.kind) {
    case 'cenote-roots': {
      // Organic gnarled mahogany cenote mangrove & strangler-fig root curtain hugging the sloping ceiling!
      const rootDark = '34, 22, 14';
      const rootMid = _rgbStr(pal.rustRgb);
      const rootHl = '118, 86, 56';

      // Soft mossy root pads tucked right along the sloping ceiling rock
      for (let m = -1; m <= 1; m++) {
        const mdx = m * wPx * 0.24;
        ctx.fillStyle = `rgba(${_rgbStr(m === 0 ? pal.floraDark : pal.mossRgb)}, ${m === 0 ? 0.72 : 0.48})`;
        ctx.beginPath();
        ctx.ellipse(sx + mdx, wallY(mdx) + 2, wPx * (m === 0 ? 0.28 : 0.18), Math.max(3.5, hPx * 0.065), Math.atan(slope), 0, Math.PI * 2);
        ctx.fill();
      }

      const strands = el.subCount + 3;
      ctx.lineCap = 'round';
      for (let i = 0; i < strands; i++) {
        const u = strands === 1 ? 0 : i / (strands - 1) - 0.5;
        const jitter = (_hash01(el.seed + i * 17.3) - 0.5) * 0.24;
        const frac = u + jitter;
        const isHair = i % 2 === 1;
        const dx0 = frac * wPx * 0.90;
        const bx = sx + dx0;
        const by = wallY(dx0);
        const archOut = frac * wPx * (0.34 + _hash01(el.seed + i * 9.1) * 0.22);
        const len = hPx * (isHair ? 0.55 + _hash01(el.seed + i * 31) * 0.44 : 0.68 + _hash01(el.seed + i * 13) * 0.38);
        const sw = swayPx * (isHair ? 1.25 : 0.68 + (i % 3) * 0.22);
        const topW = Math.max(isHair ? 1.3 : 3.8, wPx * (isHair ? 0.028 : 0.078 - Math.abs(u) * 0.02));

        const c1x = bx + archOut * 0.65 + leanPx * 0.3 + sw * 0.28;
        const c1y = by + len * 0.34;
        const c2x = bx + archOut * 0.35 + leanPx * 0.72 + sw * 0.68 - Math.sign(frac || 1) * wPx * 0.08;
        const c2y = by + len * 0.68;
        const tipX = bx + archOut * 0.55 + leanPx + sw;
        const tipY = by + len;

        if (isHair) {
          const hg = ctx.createLinearGradient(bx, by, tipX, tipY);
          hg.addColorStop(0, `rgba(${rootMid}, 0.88)`);
          hg.addColorStop(0.75, `rgba(${rootMid}, 0.74)`);
          hg.addColorStop(1, `rgba(${rootMid}, 0.14)`);
          ctx.strokeStyle = hg;
          ctx.lineWidth = topW;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.bezierCurveTo(c1x, c1y, c2x, c2y, tipX, tipY);
          ctx.stroke();
        } else {
          ctx.strokeStyle = 'rgba(2, 6, 10, 0.26)';
          ctx.lineWidth = topW * 1.6;
          ctx.beginPath();
          ctx.moveTo(bx, by + 2);
          ctx.bezierCurveTo(c1x, c1y + 2, c2x, c2y + 2, tipX, tipY + 2);
          ctx.stroke();

          const tg = ctx.createLinearGradient(bx, by, tipX, tipY);
          tg.addColorStop(0, `rgba(${rootDark}, 0.98)`);
          tg.addColorStop(0.45, `rgba(${rootMid}, 0.96)`);
          tg.addColorStop(0.85, `rgba(${rootMid}, 0.88)`);
          tg.addColorStop(1, `rgba(${rootDark}, 0.22)`);
          ctx.fillStyle = tg;
          ctx.beginPath();
          ctx.moveTo(bx - topW * 0.72, by - 2);
          ctx.bezierCurveTo(c1x - topW * 0.44, c1y, c2x - topW * 0.24, c2y, tipX, tipY);
          ctx.bezierCurveTo(c2x + topW * 0.24, c2y, c1x + topW * 0.44, c1y, bx + topW * 0.72, by - 2);
          ctx.closePath();
          ctx.fill();

          const hlSign = light.lightDirX >= 0 ? 1 : -1;
          ctx.strokeStyle = `rgba(${rootHl}, 0.44)`;
          ctx.lineWidth = Math.max(1.0, topW * 0.22);
          ctx.beginPath();
          ctx.moveTo(bx + hlSign * topW * 0.34, by);
          ctx.bezierCurveTo(c1x + hlSign * topW * 0.22, c1y, c2x + hlSign * topW * 0.12, c2y, tipX, tipY);
          ctx.stroke();

          const fSign = frac >= 0 ? 1 : -1;
          const fx0 = c1x * 0.55 + c2x * 0.45;
          const fy0 = c1y * 0.55 + c2y * 0.45;
          const fTipX = fx0 + fSign * wPx * 0.26 + sw * 0.85;
          const fTipY = fy0 + len * 0.34;
          ctx.strokeStyle = `rgba(${rootMid}, 0.82)`;
          ctx.lineWidth = Math.max(1.2, topW * 0.32);
          ctx.beginPath();
          ctx.moveTo(fx0, fy0);
          ctx.quadraticCurveTo(fx0 + fSign * wPx * 0.18, fy0 + len * 0.14, fTipX, fTipY);
          ctx.stroke();
        }
      }
      break;
    }

    case 'kelp-fronds': {
      // Lush asymmetric giant kelp stalks rooted right along the sloping floor edge,
      // with staggered ruffled leaf blades & golden-olive air bladders!
      const stalkDark = _rgbStr(pal.floraDark);
      const leafMid = _rgbStr(pal.floraMid);
      const leafLit = _rgbStr(pal.mossRgb);

      const stalks = el.subCount + 1;
      ctx.lineCap = 'round';
      for (let i = 0; i < stalks; i++) {
        const u = stalks === 1 ? 0 : i / (stalks - 1) - 0.5;
        const jitter = (_hash01(el.seed + i * 21.7) - 0.5) * 0.22;
        const frac = u + jitter;
        const dx0 = frac * wPx * 0.82;
        const bx = sx + dx0;
        const by = wallY(dx0);
        const len = hPx * (0.58 + _hash01(el.seed + i * 11.3) * 0.46);
        const archX = (frac * 0.48 + el.lean * 0.9) * wPx;
        const sw = swayPx * (0.78 + (i % 3) * 0.28);

        const c1x = bx + archX * 0.32 + sw * 0.32;
        const c1y = by - len * 0.36;
        const c2x = bx + archX * 0.78 + sw * 0.72;
        const c2y = by - len * 0.72;
        const tipX = bx + archX + sw;
        const tipY = by - len;

        // Tiny root holdfast knot right on the rock surface
        ctx.fillStyle = `rgba(${stalkDark}, 0.85)`;
        ctx.beginPath();
        ctx.ellipse(bx, by, 4.5, 2.4, Math.atan(slope), 0, Math.PI * 2);
        ctx.fill();

        // Flexible kelp stipe
        ctx.strokeStyle = `rgba(${stalkDark}, 0.94)`;
        ctx.lineWidth = Math.max(2.0, wPx * 0.032);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, tipX, tipY);
        ctx.stroke();

        // Alternating ruffled kelp blades
        const leafCount = 5 + (i % 3);
        for (let l = 1; l <= leafCount; l++) {
          const lt = l / (leafCount + 0.5);
          const inv = 1 - lt;
          const lx = inv * inv * inv * bx + 3 * inv * inv * lt * c1x + 3 * inv * lt * lt * c2x + lt * lt * lt * tipX;
          const ly = inv * inv * inv * by + 3 * inv * inv * lt * c1y + 3 * inv * lt * lt * c2y + lt * lt * lt * tipY;
          const side = (l + i) % 2 === 0 ? 1 : -1;
          const leafLen = Math.max(12, wPx * (0.28 - lt * 0.10) * (0.82 + ((l * 17) % 5) * 0.08));
          const leafW = Math.max(4.5, leafLen * 0.28);
          const droopY = ly - leafLen * (0.35 + lt * 0.22);
          const endX = lx + side * leafLen * 0.86 + sw * lt * 0.45;
          const endY = droopY - side * leafLen * 0.08;

          const lg = ctx.createLinearGradient(lx, ly, endX, endY);
          lg.addColorStop(0, `rgba(${stalkDark}, 0.92)`);
          lg.addColorStop(0.55, `rgba(${leafMid}, 0.88)`);
          lg.addColorStop(1, `rgba(${leafLit}, 0.76)`);
          ctx.fillStyle = lg;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.quadraticCurveTo(lx + side * leafLen * 0.46, ly - leafW * 1.15, endX, endY);
          ctx.quadraticCurveTo(lx + side * leafLen * 0.48, ly + leafW * 0.65, lx, ly);
          ctx.closePath();
          ctx.fill();

          if (l % 2 === 1) {
            ctx.fillStyle = `rgba(${leafLit}, 0.88)`;
            ctx.beginPath();
            ctx.ellipse(lx + side * 2.4, ly - 1.5, 2.2, 1.7, side * 0.3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      break;
    }

    case 'wreck-chain': {
      const links = Math.max(4, Math.min(10, Math.round(hPx / Math.max(10, wPx * 0.18))));
      const linkH = hPx / links;
      const linkW = Math.max(5.5, wPx * 0.17);
      const steelDark = _rgbStr(pal.rockDark);
      const steelMid = _rgbStr(pal.rockMid);
      const rustStr = _rgbStr(pal.rustRgb);

      for (let i = 0; i < links; i++) {
        const u = (i + 0.5) / links;
        const lx = sx + swayPx * u * u + leanPx * u * 0.36;
        const ly = sy + dir * (i + 0.32) * linkH;
        const isBroad = i % 2 === 0;
        const rx = isBroad ? linkW * 0.56 : linkW * 0.25;
        const ry = linkH * 0.60;

        ctx.strokeStyle = 'rgba(2, 6, 12, 0.34)';
        ctx.lineWidth = Math.max(5.0, linkW * 0.52);
        ctx.beginPath();
        ctx.ellipse(lx + 1.5, ly + dir * 2, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(${i % 3 === 0 ? rustStr : steelMid}, 0.96)`;
        ctx.lineWidth = Math.max(2.8, linkW * 0.32);
        ctx.beginPath();
        ctx.ellipse(lx, ly, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(${steelDark}, 0.72)`;
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.ellipse(lx, ly, Math.max(1, rx - 1.4), Math.max(1, ry - 1.4), 0, 0, Math.PI * 2);
        ctx.stroke();

        if (isBroad) {
          ctx.strokeStyle = `rgba(${steelMid}, 0.95)`;
          ctx.lineWidth = Math.max(2.0, linkW * 0.22);
          ctx.beginPath();
          ctx.moveTo(lx - rx * 0.8, ly);
          ctx.lineTo(lx + rx * 0.8, ly);
          ctx.stroke();
        }
      }
      break;
    }

    case 'wreck-girder': {
      // Riveted steel shipwreck hull rib with TRUE hollow circular lightening holes (`evenodd` fill!)
      const bw = Math.max(14, wPx * 0.38);
      const tipX = sx + leanPx * 1.15;
      const tipY = sy + dir * hPx * 0.96;
      const holeCount = Math.max(2, Math.min(4, Math.round(hPx / 26)));
      const yL = wallY(-bw * 0.72);
      const yR = wallY(bw * 0.72);

      _strokeDropShadow(ctx, () => {
        ctx.moveTo(sx - bw * 0.72, yL);
        ctx.lineTo(tipX - bw * 0.46, tipY);
        ctx.lineTo(tipX + bw * 0.46, tipY);
        ctx.lineTo(sx + bw * 0.72, yR);
      }, dir, 4, 8, 0.32);

      ctx.beginPath();
      ctx.moveTo(sx - bw * 0.72, yL);
      ctx.lineTo(tipX - bw * 0.46, tipY);
      ctx.lineTo(tipX + bw * 0.46, tipY);
      ctx.lineTo(sx + bw * 0.72, yR);
      ctx.closePath();

      const holes = [];
      for (let h = 0; h < holeCount; h++) {
        const u = (h + 0.52) / (holeCount + 0.25);
        const hx = sx + (tipX - sx) * u;
        const hy = sy + (tipY - sy) * u;
        const hr = Math.max(3.2, bw * (0.21 - u * 0.04));
        holes.push({ hx, hy, hr, u });
        ctx.moveTo(hx + hr, hy);
        ctx.ellipse(hx, hy, hr, hr, 0, 0, Math.PI * 2);
      }

      const steelGrad = ctx.createLinearGradient(sx - bw * 0.7, sy, sx + bw * 0.7, tipY);
      steelGrad.addColorStop(0, `rgba(${_rgbStr(pal.rockMid)}, 0.98)`);
      steelGrad.addColorStop(0.55, `rgba(${_rgbStr(pal.rockDark)}, 0.96)`);
      steelGrad.addColorStop(1, `rgba(${_rgbStr(pal.rustRgb)}, 0.92)`);
      ctx.fillStyle = steelGrad;
      try {
        ctx.fill('evenodd');
      } catch {
        ctx.fill();
      }

      ctx.strokeStyle = `rgba(${_rgbStr(pal.rockHighlight)}, 0.48)`;
      ctx.lineWidth = Math.max(1.8, bw * 0.09);
      ctx.beginPath();
      ctx.moveTo(sx - bw * 0.66, yL);
      ctx.lineTo(tipX - bw * 0.42, tipY);
      ctx.moveTo(sx + bw * 0.66, yR);
      ctx.lineTo(tipX + bw * 0.42, tipY);
      ctx.stroke();

      for (let h = 0; h < holes.length; h++) {
        const { hx, hy, hr, u } = holes[h];
        ctx.strokeStyle = `rgba(${_rgbStr(pal.rockHighlight)}, 0.45)`;
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.ellipse(hx, hy, hr, hr, 0, 0, Math.PI * 2);
        ctx.stroke();

        const flX = bw * (0.52 - u * 0.12);
        ctx.fillStyle = `rgba(${_rgbStr(pal.rockHighlight)}, 0.56)`;
        ctx.beginPath();
        ctx.ellipse(hx - flX, hy, 1.5, 1.5, 0, 0, Math.PI * 2);
        ctx.ellipse(hx + flX, hy, 1.5, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = `rgba(${_rgbStr(pal.floraMid)}, 0.82)`;
      ctx.lineWidth = Math.max(1.6, bw * 0.08);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tipX + bw * 0.28, tipY);
      ctx.quadraticCurveTo(tipX + bw * 0.34 + swayPx * 0.7, tipY + dir * hPx * 0.18, tipX + bw * 0.18 + swayPx * 1.4, tipY + dir * hPx * 0.34);
      ctx.stroke();
      break;
    }

    case 'mine-beam': {
      const bw = Math.max(12, wPx * 0.35);
      const tipX = sx + leanPx * 1.05;
      const tipY = sy + dir * hPx * 0.92;
      const yL = wallY(-bw * 0.66);
      const yR = wallY(bw * 0.66);
      const traceCrest = () => {
        ctx.moveTo(sx - bw * 0.66, yL);
        ctx.lineTo(tipX - bw * 0.52, tipY);
        ctx.lineTo(tipX + bw * 0.52, tipY);
        ctx.lineTo(sx + bw * 0.66, yR);
      };
      const closeBase = () => {
        ctx.lineTo(sx - bw * 0.66, yL);
      };
      const drawTimberDetail = () => {
        ctx.strokeStyle = `rgba(${_rgbStr(pal.rockDark)}, 0.55)`;
        ctx.lineWidth = 1.2;
        for (const f of [-0.26, 0.04, 0.28]) {
          ctx.beginPath();
          ctx.moveTo(sx + bw * f, wallY(bw * f));
          ctx.lineTo(tipX + bw * f * 0.84, tipY);
          ctx.stroke();
        }
        const bx = sx + (tipX - sx) * 0.72;
        const by = sy + (tipY - sy) * 0.72;
        ctx.strokeStyle = `rgba(${_rgbStr(pal.rustRgb)}, 0.88)`;
        ctx.lineWidth = Math.max(4, bw * 0.24);
        ctx.beginPath();
        ctx.moveTo(bx - bw * 0.6, by);
        ctx.lineTo(bx + bw * 0.6, by);
        ctx.stroke();
      };
      _fillRockAnchoredForm(ctx, sx, sy, wPx, hPx, dir, pal, light, null, isNearPlane, traceCrest, closeBase, drawTimberDetail);
      break;
    }

    case 'wreck-railing': {
      const posts = 3;
      const railOffset = dir * hPx * 0.78;
      const steelMid = _rgbStr(pal.rockMid);
      const steelHl = _rgbStr(pal.rockHighlight);
      const rustStr = _rgbStr(pal.rustRgb);

      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(3.0, wPx * 0.068);
      for (let i = 0; i < posts; i++) {
        const frac = i / (posts - 1) - 0.5;
        const dx0 = frac * wPx * 0.96;
        const px = sx + dx0;
        const py = wallY(dx0);
        ctx.strokeStyle = `rgba(${i === 1 ? rustStr : steelMid}, 0.95)`;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + leanPx * 0.45, py + railOffset);
        ctx.stroke();
      }
      const xL = sx - wPx * 0.58 + leanPx * 0.45;
      const xR = sx + wPx * 0.58 + leanPx * 0.45;
      const yL = wallY(-wPx * 0.58);
      const yR = wallY(wPx * 0.58);
      for (const hFrac of [0.78, 0.44]) {
        const off = dir * hPx * hFrac;
        ctx.strokeStyle = `rgba(${steelMid}, 0.94)`;
        ctx.beginPath();
        ctx.moveTo(xL, yL + off);
        ctx.quadraticCurveTo(sx + leanPx * 0.45, sy + off + dir * hPx * 0.05, xR, yR + off);
        ctx.stroke();
      }
      ctx.strokeStyle = `rgba(${steelHl}, 0.46)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(xL, yL + railOffset - dir * 1.2);
      ctx.quadraticCurveTo(sx + leanPx * 0.45, sy + railOffset + dir * hPx * 0.05 - dir * 1.2, xR, yR + railOffset - dir * 1.2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(${_rgbStr(pal.floraMid)}, 0.80)`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(sx - wPx * 0.48 + leanPx * 0.45, wallY(-wPx * 0.48) + railOffset);
      ctx.quadraticCurveTo(sx + leanPx * 0.45 + swayPx * 0.75, sy + railOffset - dir * hPx * 0.22, sx + wPx * 0.48 + leanPx * 0.45, wallY(wPx * 0.48) + railOffset);
      ctx.stroke();
      break;
    }

    case 'crystal-cluster': {
      // Natural radiating fan of tilted hexagonal mineral crystal spears rooted right into the sloping cave rock!
      const count = el.subCount + 3;
      const litRight = light.lightDirX >= 0;

      for (let i = 0; i < count; i++) {
        const order = i === count - 1 ? Math.floor(count / 2) : (i >= Math.floor(count / 2) ? i + 1 : i);
        const u = count <= 1 ? 0 : order / (count - 1) - 0.5;
        const isHero = order === Math.floor(count / 2);
        const tilt = u * 1.14 + el.lean * 0.45 + (_hash01(el.seed + order * 19) - 0.5) * 0.16;
        const cLen = hPx * (isHero ? 1.04 : 0.46 + (1 - Math.abs(u) * 1.35) * 0.36 + _hash01(el.seed + order * 7) * 0.14);
        const cHalfW = Math.max(4.5, wPx * (isHero ? 0.155 : 0.11));

        const dx0 = u * wPx * 0.52;
        const bx = sx + dx0;
        const by = wallY(dx0);
        const ax = Math.sin(tilt);
        const ay = dir * Math.cos(tilt);
        const px = Math.cos(tilt);
        const py = -dir * Math.sin(tilt);

        const tipX = bx + ax * cLen;
        const tipY = by + ay * cLen;
        const shDist = cLen * 0.76;
        const lShX = bx + ax * shDist - px * cHalfW;
        const lShY = by + ay * shDist - py * cHalfW;
        const rShX = bx + ax * shDist + px * cHalfW;
        const rShY = by + ay * shDist + py * cHalfW;
        const lBaseX = bx - px * cHalfW * 0.84;
        const lBaseY = by - py * cHalfW * 0.84;
        const rBaseX = bx + px * cHalfW * 0.84;
        const rBaseY = by + py * cHalfW * 0.84;

        ctx.fillStyle = 'rgba(2, 6, 14, 0.24)';
        ctx.beginPath();
        ctx.moveTo(lBaseX + 2, lBaseY + dir * 2);
        ctx.lineTo(lShX + 2, lShY + dir * 2);
        ctx.lineTo(tipX + 2, tipY + dir * 2);
        ctx.lineTo(rShX + 2, rShY + dir * 2);
        ctx.lineTo(rBaseX + 2, rBaseY + dir * 2);
        ctx.closePath();
        ctx.fill();

        const cg = ctx.createLinearGradient(bx, by, tipX, tipY);
        cg.addColorStop(0, `rgba(${_rgbStr(pal.floraDark)}, 0.94)`);
        cg.addColorStop(0.55, `rgba(${_rgbStr(pal.rockMid)}, 0.88)`);
        cg.addColorStop(1, `rgba(${_rgbStr(pal.rockHighlight)}, 0.94)`);
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.moveTo(lBaseX, lBaseY);
        ctx.lineTo(lShX, lShY);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(rShX, rShY);
        ctx.lineTo(rBaseX, rBaseY);
        ctx.closePath();
        ctx.fill();

        const fGrad = ctx.createLinearGradient(tipX, tipY, bx, by);
        fGrad.addColorStop(0, 'rgba(232, 244, 255, 0.62)');
        fGrad.addColorStop(0.65, `rgba(${_rgbStr(pal.rustRgb)}, 0.26)`);
        fGrad.addColorStop(1, `rgba(${_rgbStr(pal.rockMid)}, 0.05)`);
        ctx.fillStyle = fGrad;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(tipX, tipY);
        if (litRight) {
          ctx.lineTo(rShX, rShY);
          ctx.lineTo(rBaseX, rBaseY);
        } else {
          ctx.lineTo(lShX, lShY);
          ctx.lineTo(lBaseX, lBaseY);
        }
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(240, 248, 255, 0.56)';
        ctx.lineWidth = isHero ? 1.25 : 0.95;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
      }
      break;
    }

    case 'icicle-cluster': {
      // Organic glassy glacial icicle curtain (ceiling) or frosted ice stalagmite cluster (floor)
      // emerging directly out of the sloping rock surface — ZERO flat horizontal bar!
      const spears = el.subCount + 3;
      const halfW = wPx * 0.66;

      for (let i = 0; i < spears; i++) {
        const u = spears <= 1 ? 0 : i / (spears - 1) - 0.5;
        const j = (_hash01(el.seed + i * 29.3) - 0.5) * 0.14;
        const dx0 = (u + j) * halfW * 1.72;
        const bx = sx + dx0;
        const by = wallY(dx0);
        const isMain = Math.abs(u) < 0.22;
        const len = hPx * (isMain ? 0.82 + _hash01(el.seed + i * 7) * 0.24 : 0.36 + _hash01(el.seed + i * 17) * 0.42);
        const halfBase = Math.max(3.4, wPx * (isMain ? 0.115 : 0.078));
        const tipX = bx + leanPx * 0.32;
        const tipY = by + dir * len;

        // Soft drop shadow behind spear
        ctx.fillStyle = 'rgba(2, 8, 18, 0.22)';
        ctx.beginPath();
        ctx.moveTo(bx - halfBase + 2, by + dir * 2);
        ctx.quadraticCurveTo(bx - halfBase * 0.32 + 2, by + dir * len * 0.52, tipX + 2, tipY + dir * 2);
        ctx.quadraticCurveTo(bx + halfBase * 0.38 + 2, by + dir * len * 0.52, bx + halfBase + 2, by + dir * 2);
        ctx.closePath();
        ctx.fill();

        // Translucent sapphire-to-frost ice spear fading gently right at the rock lip
        const ig = ctx.createLinearGradient(bx, by, tipX, tipY);
        ig.addColorStop(0, `rgba(${_rgbStr(pal.rockDark)}, 0.48)`);
        ig.addColorStop(0.22, `rgba(${_rgbStr(pal.rockMid)}, 0.86)`);
        ig.addColorStop(0.82, `rgba(${_rgbStr(pal.rockHighlight)}, 0.94)`);
        ig.addColorStop(1, 'rgba(242, 252, 255, 0.98)');
        ctx.fillStyle = ig;
        ctx.beginPath();
        ctx.moveTo(bx - halfBase, wallY(dx0 - halfBase));
        ctx.quadraticCurveTo(bx - halfBase * 0.32, by + dir * len * 0.52, tipX, tipY);
        ctx.quadraticCurveTo(bx + halfBase * 0.38, by + dir * len * 0.52, bx + halfBase, wallY(dx0 + halfBase));
        ctx.closePath();
        ctx.fill();

        const hlSign = light.lightDirX >= 0 ? 1 : -1;
        ctx.strokeStyle = 'rgba(232, 248, 255, 0.64)';
        ctx.lineWidth = isMain ? 1.25 : 0.9;
        ctx.beginPath();
        ctx.moveTo(bx + hlSign * halfBase * 0.3, by + dir * 3);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
      }
      break;
    }

    case 'monolith-block': {
      const bw = wPx * 0.74;
      const stepH = hPx * 0.54;
      const traceCrest = () => {
        ctx.moveTo(sx - bw, wallY(-bw));
        ctx.lineTo(sx - bw * 0.90, wallY(-bw * 0.90) + dir * stepH * 0.74);
        ctx.lineTo(sx - bw * 0.46, wallY(-bw * 0.46) + dir * stepH * 0.74);
        ctx.lineTo(sx - bw * 0.40, wallY(-bw * 0.40) + dir * hPx);
        ctx.lineTo(sx + bw * 0.34, wallY(bw * 0.34) + dir * hPx);
        ctx.lineTo(sx + bw * 0.40, wallY(bw * 0.40) + dir * stepH);
        ctx.lineTo(sx + bw * 0.92, wallY(bw * 0.92) + dir * stepH);
        ctx.lineTo(sx + bw, wallY(bw));
      };
      const closeBase = () => {
        ctx.lineTo(sx - bw, wallY(-bw));
      };
      const drawCarvedRelief = () => {
        ctx.strokeStyle = `rgba(${_rgbStr(pal.rustRgb)}, 0.58)`;
        ctx.lineWidth = Math.max(1.2, hPx * 0.018);
        const yBand1 = sy + dir * hPx * 0.76;
        const yBand2 = sy + dir * hPx * 0.42;
        ctx.beginPath();
        ctx.moveTo(sx - bw * 0.28, yBand1 - bw * 0.28 * slope);
        ctx.lineTo(sx + bw * 0.24, yBand1 + bw * 0.24 * slope);
        ctx.moveTo(sx - bw * 0.72, yBand2 - bw * 0.72 * slope);
        ctx.lineTo(sx + bw * 0.72, yBand2 + bw * 0.72 * slope);
        ctx.stroke();
        _drawCausticRibbons(ctx, sx, sy, wPx, hPx, dir, timeSec, reduced, light);
      };
      _fillRockAnchoredForm(ctx, sx, sy, wPx, hPx, dir, pal, light, rockPattern, isNearPlane, traceCrest, closeBase, drawCarvedRelief);
      break;
    }

    case 'basalt-spire': {
      const cols = Math.max(3, Math.min(5, el.subCount + 1));
      const halfW = wPx * 0.78;
      const colData = [];
      for (let i = 0; i < cols; i++) {
        const u0 = i / cols;
        const u1 = (i + 1) / cols;
        const centerDist = Math.abs((i + 0.5) / cols - 0.5) * 2;
        const ch = hPx * (1.0 - centerDist * 0.44 + ((i * 19 + Math.floor(el.seed)) % 7) * 0.025);
        const dx0 = (u0 - 0.5) * halfW * 2;
        const dx1 = (u1 - 0.5) * halfW * 2;
        colData.push({ x0: sx + dx0, x1: sx + dx1, y0: wallY(dx0), y1: wallY(dx1), h: ch });
      }
      const traceCrest = () => {
        ctx.moveTo(sx - halfW, wallY(-halfW));
        for (let i = 0; i < colData.length; i++) {
          const c = colData[i];
          const bevel = (c.x1 - c.x0) * 0.14;
          const by = (c.y0 + c.y1) * 0.5;
          ctx.lineTo(c.x0 + bevel * 0.4, by + dir * c.h);
          ctx.lineTo(c.x1 - bevel * 0.4, by + dir * (c.h * 0.94));
          if (i < colData.length - 1) {
            const nextH = Math.min(c.h, colData[i + 1].h) * 0.86;
            ctx.lineTo(c.x1, c.y1 + dir * nextH);
          }
        }
        ctx.lineTo(sx + halfW, wallY(halfW));
      };
      const closeBase = () => {
        ctx.lineTo(sx - halfW, wallY(-halfW));
      };
      const drawBasaltColumns = () => {
        const litRight = light.lightDirX >= 0;
        for (let i = 0; i < colData.length; i++) {
          const c = colData[i];
          const midX = (c.x0 + c.x1) * 0.5;
          const by = (c.y0 + c.y1) * 0.5;
          ctx.fillStyle = `rgba(${_rgbStr(pal.rockHighlight)}, 0.24)`;
          ctx.beginPath();
          ctx.moveTo(litRight ? midX : c.x0, by);
          ctx.lineTo(litRight ? midX : c.x0, by + dir * c.h);
          ctx.lineTo(litRight ? c.x1 : midX, by + dir * c.h * 0.95);
          ctx.lineTo(litRight ? c.x1 : midX, by);
          ctx.closePath();
          ctx.fill();
          if (i > 0) {
            ctx.strokeStyle = el.biome === 'volcanic'
              ? `rgba(255, 118, 42, ${(0.28 + light.ventLit * 0.58).toFixed(3)})`
              : `rgba(${_rgbStr(pal.rockDark)}, 0.65)`;
            ctx.lineWidth = el.biome === 'volcanic' ? 1.4 : 1.0;
            ctx.beginPath();
            ctx.moveTo(c.x0, c.y0);
            ctx.lineTo(c.x0, c.y0 + dir * Math.min(c.h, colData[i - 1].h) * 0.82);
            ctx.stroke();
          }
        }
      };
      _fillRockAnchoredForm(ctx, sx, sy, wPx, hPx, dir, pal, light, rockPattern, isNearPlane, traceCrest, closeBase, drawBasaltColumns);
      break;
    }

    case 'limestone-overhang':
    default: {
      // Sculpted asymmetric karst limestone spur hugging the EXACT sloping cave ceiling/floor
      // and filled with the level's real procedural rock texture — ZERO flat seam!
      const halfW = wPx * 0.98;
      const flip = ((Math.floor(el.seed) % 2) === 0) ? 1 : -1;
      const dxPeak = flip * halfW * 0.16 + leanPx * 0.48;
      const dxShoulder = -flip * halfW * 0.42;
      const dxMinor = flip * halfW * 0.54;
      const peakX = sx + dxPeak;
      const shoulderX = sx + dxShoulder;
      const minorX = sx + dxMinor;
      const shoulderH = hPx * (0.44 + ((el.seed * 7) % 10) * 0.022);
      const mainH = hPx * 0.96;
      const minorH = hPx * (0.36 + ((el.seed * 13) % 10) * 0.018);

      const traceCrest = () => {
        ctx.moveTo(sx - halfW, wallY(-halfW));
        ctx.bezierCurveTo(
          sx - halfW * 0.84, wallY(-halfW * 0.84) + dir * shoulderH * 0.65,
          shoulderX - halfW * 0.18, wallY(dxShoulder - halfW * 0.18) + dir * shoulderH * 1.05,
          shoulderX + flip * halfW * 0.14, wallY(dxShoulder + flip * halfW * 0.14) + dir * shoulderH * 0.78
        );
        ctx.bezierCurveTo(
          peakX - flip * halfW * 0.24, wallY(dxPeak - flip * halfW * 0.24) + dir * mainH * 0.92,
          peakX - flip * halfW * 0.04, wallY(dxPeak - flip * halfW * 0.04) + dir * mainH * 1.08,
          peakX + flip * halfW * 0.16, wallY(dxPeak + flip * halfW * 0.16) + dir * mainH * 0.74
        );
        ctx.bezierCurveTo(
          minorX - flip * halfW * 0.12, wallY(dxMinor - flip * halfW * 0.12) + dir * minorH * 1.08,
          sx + halfW * 0.76, wallY(halfW * 0.76) + dir * minorH * 0.72,
          sx + halfW, wallY(halfW)
        );
      };
      const closeBase = () => {
        // Follows the exact sloping rock wall back to the start point — seamless with cavern geometry!
        ctx.lineTo(sx - halfW, wallY(-halfW));
      };

      const drawKarstDetail = () => {
        ctx.fillStyle = `rgba(${_rgbStr(pal.rockDark)}, 0.34)`;
        ctx.beginPath();
        ctx.moveTo(sx - halfW * 0.72, wallY(-halfW * 0.72));
        ctx.quadraticCurveTo(peakX - flip * halfW * 0.1, wallY(dxPeak) + dir * mainH * 0.62, sx + halfW * 0.66, wallY(halfW * 0.66));
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = `rgba(${_rgbStr(pal.rockDark)}, 0.38)`;
        ctx.lineWidth = 1.1;
        for (const frac of [0.36, 0.60]) {
          const yL = wallY(-halfW * 0.56) + dir * hPx * frac;
          const yM = wallY(dxPeak) + dir * hPx * (frac + 0.05);
          const yR = wallY(halfW * 0.52) + dir * hPx * (frac - 0.02);
          ctx.beginPath();
          ctx.moveTo(sx - halfW * 0.56, yL);
          ctx.quadraticCurveTo(peakX, yM, sx + halfW * 0.52, yR);
          ctx.stroke();
        }

        if (el.biome === 'cenote' && el.y < 24) {
          ctx.fillStyle = `rgba(${_rgbStr(pal.mossRgb)}, 0.42)`;
          ctx.beginPath();
          ctx.ellipse(shoulderX, wallY(dxShoulder) + dir * shoulderH * 0.72, halfW * 0.22, Math.max(4, hPx * 0.085), Math.atan(slope) + flip * 0.14, 0, Math.PI * 2);
          ctx.fill();
        }

        _drawCausticRibbons(ctx, sx, sy, wPx, hPx, dir, timeSec, reduced, light);
      };

      _fillRockAnchoredForm(ctx, sx, sy, wPx, hPx, dir, pal, light, rockPattern, isNearPlane, traceCrest, closeBase, drawKarstDetail);
      break;
    }
  }
}

/**
 * PASS 2 (Post-Lighting Optical Finish): Strictly gated by real light sources!
 * Edge-hugging backlit rim highlights (zero geometric oval blobs!), sparkling crystal/ice glints,
 * and bioluminescent micro-spores.
 */
function _drawLightingAccent(ctx, el, sx, sy, wPx, hPx, dir, pal, swayPx, light, timeSec, reduced) {
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
    // Delicate edge-hugging backlit rim threads along outer organic stalks/strands (ZERO circle blobs!)
    const sssPower = _clamp(light.backLit * 0.46 + light.sunLit * 0.30 + light.beamLit * 0.28, 0, 0.56);
    if (sssPower > 0.09) {
      const strands = el.subCount + 1;
      ctx.lineCap = 'round';
      for (let i = 0; i < strands; i++) {
        const u = strands <= 1 ? 0 : i / (strands - 1) - 0.5;
        const dx0 = u * wPx * 0.78;
        const bx = sx + dx0;
        const by = wallY(dx0);
        const len = hPx * (0.62 + _hash01(el.seed + i * 11.3) * 0.34);
        const tipX = bx + (u * 0.42 + el.lean * 0.85) * wPx + swayPx * 0.85;
        const tipY = by + dir * len;
        const midX = (bx + tipX) * 0.5 + swayPx * 0.35;
        const midY = (by + tipY) * 0.5;
        const sg = ctx.createLinearGradient(bx, by, tipX, tipY);
        sg.addColorStop(0, `rgba(${sssRgb}, 0)`);
        sg.addColorStop(0.55, `rgba(${sssRgb}, ${(sssPower * 0.45).toFixed(3)})`);
        sg.addColorStop(1, `rgba(${sssRgb}, ${(sssPower * 0.68).toFixed(3)})`);
        ctx.strokeStyle = sg;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(midX, midY, tipX, tipY);
        ctx.stroke();
      }
    }
    if (light.biolumLit > 0.18) {
      for (let b = 0; b < 3; b++) {
        const bx = sx + ((b / 2) - 0.5) * wPx * 0.75 + swayPx * 0.5;
        const by = wallY(((b / 2) - 0.5) * wPx * 0.75) + dir * hPx * (0.36 + ((b * 37) % 10) * 0.05);
        const pulse = 0.45 + 0.55 * Math.sin(timeSec * 2.8 + b * 1.9 + el.phase);
        ctx.fillStyle = `rgba(110, 242, 255, ${(light.biolumLit * pulse * 0.72).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(bx, by, 2.0, 2.0, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (el.kind === 'crystal-cluster' || el.kind === 'icicle-cluster') {
    // Pinpoint crystalline diamond twinkle strictly when swept by torchlight or sunlight!
    const glintA = _clamp((light.beamLit - 0.22) * 0.92 + light.sunLit * 0.34 + light.backLit * 0.28, 0, 0.84);
    if (glintA > 0.09) {
      const twinkle = reduced ? 1 : 0.68 + 0.32 * Math.sin(timeSec * 4.4 + el.phase);
      _drawStarGlint(ctx, sx + leanPx * 0.42, sy + dir * hPx * 0.92, Math.max(4.5, hPx * 0.085), rimRgb, glintA * twinkle);
      if (glintA > 0.34) {
        _drawStarGlint(ctx, sx - wPx * 0.22, wallY(-wPx * 0.22) + dir * hPx * 0.58, Math.max(3.0, hPx * 0.05), sssRgb, glintA * 0.62 * twinkle);
      }
    }
  } else if (el.kind === 'limestone-overhang') {
    // Crisp subtle backlit edge rim ONLY when the diver/torch/vent illuminates the organic rock lip
    const rimA = _clamp(light.backLit * 0.42 + light.edgeOcc * 0.18 + light.ventLit * 0.28 + (light.beamLit - 0.28) * 0.30, 0, 0.46);
    if (rimA > 0.09) {
      const tipX = sx + leanPx * 0.4 + light.lightDirX * wPx * 0.28;
      const tipY = sy + dir * hPx * 0.86;
      const rGrad = ctx.createLinearGradient(tipX, tipY, sx - light.lightDirX * wPx * 0.6, sy);
      rGrad.addColorStop(0, `rgba(${rimRgb}, ${(rimA * 0.64).toFixed(3)})`);
      rGrad.addColorStop(0.5, `rgba(${rimRgb}, ${(rimA * 0.20).toFixed(3)})`);
      rGrad.addColorStop(1, `rgba(${rimRgb}, 0)`);
      ctx.strokeStyle = rGrad;
      ctx.lineWidth = Math.max(1.6, Math.min(3.2, hPx * 0.025));
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx - wPx * 0.48, wallY(-wPx * 0.48) + dir * hPx * 0.34);
      ctx.quadraticCurveTo(sx + leanPx * 0.35, sy + dir * hPx * 0.94, sx + wPx * 0.48, wallY(wPx * 0.48) + dir * hPx * 0.34);
      ctx.stroke();
    }
  } else if (el.kind === 'basalt-spire') {
    // Crisp lit top-bevel highlight on the central basalt column + volcanic magma seam glow
    const rimA = _clamp(light.backLit * 0.38 + light.ventLit * 0.46 + (light.beamLit - 0.24) * 0.34, 0, 0.52);
    if (rimA > 0.09) {
      const halfW = wPx * 0.26;
      ctx.strokeStyle = `rgba(${rimRgb}, ${(rimA * 0.58).toFixed(3)})`;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx - halfW, sy + dir * hPx * 0.94);
      ctx.lineTo(sx + halfW, sy + dir * hPx * 0.94);
      ctx.stroke();
    }
  } else if (el.kind === 'wreck-girder') {
    // Clean metallic flange specular along the lit girder edge
    const rimA = _clamp(light.backLit * 0.36 + (light.beamLit - 0.22) * 0.40, 0, 0.48);
    if (rimA > 0.09) {
      const bw = Math.max(14, wPx * 0.38);
      const sideSign = light.lightDirX >= 0 ? 1 : -1;
      const tipX = sx + leanPx * 1.15 + sideSign * bw * 0.44;
      const tipY = sy + dir * hPx * 0.96;
      const baseX = sx + sideSign * bw * 0.68;
      const baseY = wallY(sideSign * bw * 0.68);
      const rGrad = ctx.createLinearGradient(tipX, tipY, baseX, baseY);
      rGrad.addColorStop(0, `rgba(${rimRgb}, ${(rimA * 0.70).toFixed(3)})`);
      rGrad.addColorStop(0.65, `rgba(${rimRgb}, ${(rimA * 0.24).toFixed(3)})`);
      rGrad.addColorStop(1, `rgba(${rimRgb}, 0)`);
      ctx.strokeStyle = rGrad;
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
    }
  } else if (el.kind === 'monolith-block') {
    // Crisp carved lintel highlight along the horizontal monolith crest
    const rimA = _clamp(light.backLit * 0.38 + light.sunLit * 0.28 + (light.beamLit - 0.24) * 0.34, 0, 0.48);
    if (rimA > 0.09) {
      const bw = wPx * 0.74;
      ctx.strokeStyle = `rgba(${rimRgb}, ${(rimA * 0.56).toFixed(3)})`;
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx - bw * 0.40, wallY(-bw * 0.40) + dir * hPx);
      ctx.lineTo(sx + bw * 0.34, wallY(bw * 0.34) + dir * hPx);
      ctx.stroke();
    }
  }

  ctx.restore();
}

export const foregroundDepthRendererMethods = {
  /**
   * PASS 1 (Pre-Lighting): Draw living foreground formations IN FRONT of the diver and INSIDE
   * the lighting pipeline so real cave darkness, sunlight shafts & ray-cast torch beams light them!
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
    const inCombat = Boolean(secretLair?.combatMode);
    const reduced = Boolean(this._reducedMotion);
    const diverSx = diver ? viewCenterX + (diver.x - effCamX) * scale : -9999;
    const diverSy = diver ? viewCenterY + (diver.y - effCamY) * scale : -9999;

    const innerClearR = Math.max(28, scale * 0.88);
    const outerClearR = Math.max(54, scale * 1.68);

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
      const coreY = sy + dir * hPx * 0.22;
      const distCore = Math.hypot(sx - diverSx, coreY - diverSy);
      let proxFade = 1.0;
      if (distCore < outerClearR) {
        const u = _clamp((distCore - innerClearR) / Math.max(1, outerClearR - innerClearR), 0, 1);
        proxFade = 0.36 + u * u * 0.64;
      }

      const baseAlpha = inCombat ? 0.30 : (el.depthLayer === 'mid' ? 0.98 : 0.92);
      const finalAlpha = baseAlpha * proxFade;
      if (finalAlpha < 0.04) continue;

      const light = computeForegroundElementLighting(el, this.level, solveOpts, _lightScratch);

      const swayPx = reduced
        ? 0
        : Math.sin(timeSec * (el.kind === 'wreck-chain' ? 1.05 : 1.42) + el.phase) *
          (el.kind === 'cenote-roots' || el.kind === 'kelp-fronds' ? 0.26 * scale : 0.08 * scale);

      ctx.globalAlpha = finalAlpha;
      _drawBaseFormation(ctx, el, sx, sy, wPx, hPx, dir, pal, swayPx, light, timeSec, reduced, rockPattern);
    }
    ctx.restore();
  },

  /**
   * PASS 2 (Post-Lighting): Subtle backlit edge-wrap, translucent subsurface highlights & diamond glints
   * strictly where real light sources strike or the diver glides behind an edge.
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
      if (Math.max(light.beamLit, light.backLit, light.sunLit, light.ventLit, light.biolumLit) < 0.16) continue;

      const swayPx = reduced
        ? 0
        : Math.sin(timeSec * (el.kind === 'wreck-chain' ? 1.05 : 1.42) + el.phase) *
          (el.kind === 'cenote-roots' || el.kind === 'kelp-fronds' ? 0.26 * scale : 0.08 * scale);

      ctx.globalAlpha = inCombat ? 0.35 : 0.90;
      _drawLightingAccent(ctx, el, sx, sy, wPx, hPx, dir, pal, swayPx, light, timeSec, reduced);
    }
    ctx.restore();
  },
};
