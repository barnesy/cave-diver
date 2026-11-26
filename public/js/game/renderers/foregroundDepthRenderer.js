import { evaluateCaveSDF } from '../collision.js';

/**
 * Strategic Foreground Parallax Depth Elements (v224).
 *
 * Adds cinematic, soft-focus near-camera foreground framing silhouettes (parallax 1.12x–1.22x)
 * anchored seamlessly into real cavern ceilings & floors across all 37 campaign sites,
 * procedural caves, and Proving Grounds.
 *
 * Uses smooth organic Bezier silhouettes, optical depth-of-field bokeh halos (zero blur filter
 * perf cost), gradient-faded root skirts (zero flat cutoff edges), dynamic torch rim-lighting,
 * and automatic diver-proximity auto-fade so gameplay & sightlines stay 100% unobstructed.
 */

const FG_CACHE = new WeakMap();

function _hash01(seed) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
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

function _getBiomePalette(biome) {
  switch (biome) {
    case 'wreck':
      return {
        rgb: '6, 12, 20',
        haloRgb: '2, 6, 12',
        rimRgb: '148, 163, 184',
        floraRgb: '7, 26, 30',
        floraRimRgb: '56, 189, 248',
      };
    case 'ice':
      return {
        rgb: '5, 22, 42',
        haloRgb: '2, 12, 26',
        rimRgb: '186, 230, 253',
        floraRgb: '8, 34, 58',
        floraRimRgb: '125, 211, 252',
      };
    case 'volcanic':
      return {
        rgb: '11, 9, 14',
        haloRgb: '4, 3, 7',
        rimRgb: '251, 146, 60',
        floraRgb: '18, 12, 16',
        floraRimRgb: '249, 115, 22',
      };
    case 'crystal':
      return {
        rgb: '9, 18, 36',
        haloRgb: '4, 8, 20',
        rimRgb: '196, 181, 253',
        floraRgb: '14, 24, 48',
        floraRimRgb: '167, 139, 250',
      };
    case 'mine':
      return {
        rgb: '12, 11, 14',
        haloRgb: '5, 5, 8',
        rimRgb: '217, 119, 6',
        floraRgb: '18, 14, 10',
        floraRimRgb: '245, 158, 11',
      };
    case 'monolith':
      return {
        rgb: '8, 18, 28',
        haloRgb: '3, 8, 14',
        rimRgb: '125, 211, 252',
        floraRgb: '10, 28, 36',
        floraRimRgb: '56, 189, 248',
      };
    case 'cenote':
    default:
      return {
        rgb: '8, 16, 24',
        haloRgb: '3, 8, 14',
        rimRgb: '94, 174, 198',
        floraRgb: '7, 30, 28',
        floraRimRgb: '52, 211, 153',
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
 * Anchors deeply into real cavern rock surfaces in spacious passages (height >= 4.8m) and
 * steers clear of spawn, exitZone, and checkpoints.
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
  const MIN_SPACING_SQ = 8.2 * 8.2;

  for (let sIdx = 0; sIdx < segs.length && elements.length < MAX_ELEMENTS; sIdx++) {
    const s = segs[sIdx];
    const ax = s.ax ?? s.x1 ?? 0;
    const ay = s.ay ?? s.y1 ?? 0;
    const bx = s.bx ?? s.x2 ?? ax;
    const by = s.by ?? s.y2 ?? ay;
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 3.5) continue;

    const samples = Math.max(1, Math.min(4, Math.floor(len / 9.5)));
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
      // Bury anchor slightly inside the rock boundary so the base skirt blends organically into solid rock
      const anchorY = placeOnCeiling ? ceilY - 0.55 : floorY + 0.55;

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

      let kind = 'limestone-overhang';
      if (biome === 'wreck') {
        if (placeOnCeiling) kind = r1 < 0.48 ? 'wreck-chain' : 'wreck-girder';
        else kind = r1 < 0.52 ? 'wreck-railing' : 'wreck-girder';
      } else if (biome === 'ice') {
        kind = placeOnCeiling ? 'icicle-cluster' : 'basalt-spire';
      } else if (biome === 'volcanic') {
        kind = placeOnCeiling ? 'limestone-overhang' : 'basalt-spire';
      } else if (biome === 'crystal') {
        kind = 'crystal-cluster';
      } else if (biome === 'mine') {
        kind = placeOnCeiling ? (r1 < 0.5 ? 'mine-beam' : 'wreck-chain') : 'mine-beam';
      } else if (biome === 'monolith') {
        kind = 'monolith-block';
      } else {
        // Cenote / Karst: alternate living roots & swaying kelp in sunlit shallow/mid zones with sculpted overhangs deeper
        if (placeOnCeiling) {
          kind = anchorY < 17 && (sIdx + k) % 3 !== 2 ? 'cenote-roots' : 'limestone-overhang';
        } else {
          kind = anchorY < 19 && (sIdx + k) % 3 !== 2 ? 'kelp-fronds' : 'limestone-overhang';
        }
      }

      const maxReach = Math.min(3.3, spanH * 0.30);
      const heightM = Math.max(1.3, maxReach * (0.64 + r2 * 0.36));
      const widthM = Math.max(1.1, heightM * (0.62 + r3 * 0.42));

      elements.push({
        x: mx,
        y: anchorY,
        side: placeOnCeiling ? 'ceiling' : 'floor',
        biome,
        kind,
        widthM,
        heightM,
        parallax: 1.12 + r1 * 0.10, // subtle 1.12x–1.22x near-camera depth plane
        lean: (r2 - 0.5) * 0.34,
        phase: r3 * Math.PI * 2,
        subCount: 2 + Math.floor(r1 * 3), // 2..4 lobes/strands/fronds
        seed: r1 * 100 + r2 * 10,
      });
    }
  }

  FG_CACHE.set(level, elements);
  return elements;
}

/**
 * Paint a softly defocused foreground rock/structural silhouette whose base dissolves
 * seamlessly into the surrounding rock wall (no hard horizontal bottom seam!) and whose
 * water-facing crest catches a subtle rim highlight.
 */
function _fillSoftRootedShape(ctx, sx, sy, dir, hPx, skirtPx, rgb, haloRgb, rimRgb, rimAlpha, traceCrestOnly, closeWithSkirt) {
  const baseY = sy - dir * skirtPx;
  const tipY = sy + dir * hPx;

  // 1. Soft out-of-focus bokeh shadow halo along the water-facing silhouette (instant lens depth!)
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  traceCrestOnly();
  ctx.strokeStyle = `rgba(${haloRgb}, 0.28)`;
  ctx.lineWidth = Math.max(7, Math.min(18, hPx * 0.13));
  ctx.stroke();
  ctx.restore();

  // 2. Gradient-faded solid silhouette body: rich near-camera shadow at crest -> dissolves cleanly into rock at root
  const grad = ctx.createLinearGradient(sx, tipY, sx, baseY);
  grad.addColorStop(0, `rgba(${rgb}, 0.96)`);
  grad.addColorStop(0.58, `rgba(${rgb}, 0.88)`);
  grad.addColorStop(0.84, `rgba(${rgb}, 0.42)`);
  grad.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  traceCrestOnly();
  closeWithSkirt(baseY);
  ctx.closePath();
  ctx.fill();

  // 3. Delicate single-edge water-facing rim highlight (NEVER strokes the buried base!)
  if (rimAlpha > 0.04) {
    const rimGrad = ctx.createLinearGradient(sx, tipY, sx, baseY);
    rimGrad.addColorStop(0, `rgba(${rimRgb}, ${(rimAlpha * 0.65).toFixed(3)})`);
    rimGrad.addColorStop(0.55, `rgba(${rimRgb}, ${(rimAlpha * 0.26).toFixed(3)})`);
    rimGrad.addColorStop(1, `rgba(${rimRgb}, 0)`);
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = Math.max(1.1, Math.min(2.2, hPx * 0.018));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    traceCrestOnly();
    ctx.stroke();
  }
}

function _drawSilhouette(ctx, el, sx, sy, wPx, hPx, dir, pal, swayPx, rimAlpha) {
  const leanPx = el.lean * wPx;
  const skirtPx = Math.max(12, hPx * 0.42);

  switch (el.kind) {
    case 'cenote-roots': {
      // Graceful hanging cenote mangrove/fig tree roots tapering to fine organic tendrils
      ctx.lineCap = 'round';
      const strands = el.subCount + 1;
      for (let i = 0; i < strands; i++) {
        const frac = strands === 1 ? 0 : i / (strands - 1) - 0.5;
        const bx = sx + frac * wPx * 0.95;
        const len = hPx * (0.62 + ((i * 37) % 10) * 0.044);
        const sw = swayPx * (0.75 + (i % 3) * 0.28);
        const rootThick = Math.max(2.6, wPx * (0.095 - Math.abs(frac) * 0.035));
        const midX = bx + leanPx * 0.45 + sw * 0.5;
        const midY = sy + len * 0.52;
        const tipX = bx + leanPx + sw;
        const tipY = sy + len;

        // Soft bokeh halo
        ctx.strokeStyle = `rgba(${pal.haloRgb}, 0.22)`;
        ctx.lineWidth = rootThick * 2.4;
        ctx.beginPath();
        ctx.moveTo(bx, sy - skirtPx * 0.5);
        ctx.quadraticCurveTo(midX, midY, tipX, tipY);
        ctx.stroke();

        // Tapered organic root strand (fading smoothly at buried top!)
        const rg = ctx.createLinearGradient(bx, sy - skirtPx * 0.6, tipX, tipY);
        rg.addColorStop(0, `rgba(${pal.floraRgb}, 0)`);
        rg.addColorStop(0.22, `rgba(${pal.floraRgb}, 0.88)`);
        rg.addColorStop(0.85, `rgba(${pal.floraRgb}, 0.82)`);
        rg.addColorStop(1, `rgba(${pal.floraRgb}, 0.25)`);
        ctx.strokeStyle = rg;
        ctx.lineWidth = rootThick;
        ctx.beginPath();
        ctx.moveTo(bx, sy - skirtPx * 0.6);
        ctx.quadraticCurveTo(midX, midY, tipX, tipY);
        ctx.stroke();

        // Fine forked secondary tendril
        if (i % 2 === 0) {
          ctx.lineWidth = Math.max(1.2, rootThick * 0.45);
          ctx.beginPath();
          ctx.moveTo(midX, midY);
          ctx.quadraticCurveTo(midX + (frac >= 0 ? 1 : -1) * wPx * 0.16, midY + len * 0.2, midX + (frac >= 0 ? 1 : -1) * wPx * 0.24 + sw * 0.7, midY + len * 0.36);
          ctx.stroke();
        }
        if (rimAlpha > 0.06) {
          ctx.strokeStyle = `rgba(${pal.floraRimRgb}, ${(rimAlpha * 0.36).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(bx + 1, sy);
          ctx.quadraticCurveTo(midX + 1, midY, tipX, tipY);
          ctx.stroke();
        }
      }
      break;
    }

    case 'kelp-fronds': {
      // Flowing S-curved foreground kelp / ribbon-grass fronds rising softly from floor rock
      const blades = el.subCount + 2;
      for (let i = 0; i < blades; i++) {
        const frac = i / Math.max(1, blades - 1) - 0.5;
        const bx = sx + frac * wPx * 0.96;
        const len = hPx * (0.56 + ((i * 29) % 10) * 0.048);
        const sw = swayPx * (0.8 + (i % 3) * 0.32);
        const bladeW = Math.max(3.2, wPx * 0.095);
        const c1x = bx - bladeW * 0.5 + sw * 0.32;
        const c1y = sy - len * 0.42;
        const tipX = bx + leanPx + sw;
        const tipY = sy - len;
        const baseY = sy + skirtPx * 0.55;

        const fg = ctx.createLinearGradient(tipX, tipY, bx, baseY);
        fg.addColorStop(0, `rgba(${pal.floraRgb}, 0.88)`);
        fg.addColorStop(0.68, `rgba(${pal.floraRgb}, 0.82)`);
        fg.addColorStop(1, `rgba(${pal.floraRgb}, 0)`);
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(bx - bladeW * 0.65, baseY);
        ctx.quadraticCurveTo(c1x - bladeW * 0.35, c1y, tipX, tipY);
        ctx.quadraticCurveTo(c1x + bladeW * 0.85, c1y + len * 0.06, bx + bladeW * 0.65, baseY);
        ctx.closePath();
        ctx.fill();

        if (rimAlpha > 0.06 && i % 2 === 0) {
          ctx.strokeStyle = `rgba(${pal.floraRimRgb}, ${(rimAlpha * 0.34).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(bx - bladeW * 0.35, sy);
          ctx.quadraticCurveTo(c1x - bladeW * 0.2, c1y, tipX, tipY);
          ctx.stroke();
        }
      }
      break;
    }

    case 'wreck-chain': {
      // Heavy corroded anchor chain hanging from overhead foreground hull beam
      const links = Math.max(4, Math.min(9, Math.round(hPx / Math.max(9, wPx * 0.18))));
      const linkH = hPx / links;
      const linkW = Math.max(4.5, wPx * 0.16);
      for (let i = 0; i < links; i++) {
        const u = (i + 0.5) / links;
        const fadeTop = i === 0 ? 0.45 : 1;
        const lx = sx + swayPx * u * u + leanPx * u * 0.35;
        const ly = sy + dir * (i + 0.3) * linkH;
        const rx = i % 2 === 0 ? linkW * 0.52 : linkW * 0.26;
        const ry = linkH * 0.58;
        ctx.strokeStyle = `rgba(${pal.haloRgb}, ${(0.25 * fadeTop).toFixed(3)})`;
        ctx.lineWidth = Math.max(4.5, linkW * 0.55);
        ctx.beginPath();
        ctx.ellipse(lx, ly, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(${pal.rgb}, ${(0.92 * fadeTop).toFixed(3)})`;
        ctx.lineWidth = Math.max(2.2, linkW * 0.30);
        ctx.beginPath();
        ctx.ellipse(lx, ly, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }

    case 'wreck-girder':
    case 'mine-beam': {
      // Weathered structural steel hull girder / mine timber beam angled into the foreground frame
      const bw = Math.max(9, wPx * 0.32);
      const tipX = sx + leanPx * 1.2;
      const tipY = sy + dir * hPx * 0.92;
      const traceCrest = () => {
        ctx.moveTo(sx - bw * 0.62, sy);
        ctx.lineTo(tipX - bw * 0.40, tipY);
        ctx.lineTo(tipX + bw * 0.40, tipY);
        ctx.lineTo(sx + bw * 0.62, sy);
      };
      const closeSkirt = (baseY) => {
        ctx.lineTo(sx + bw * 0.78, baseY);
        ctx.lineTo(sx - bw * 0.78, baseY);
      };
      _fillSoftRootedShape(ctx, sx, sy, dir, hPx, skirtPx, pal.rgb, pal.haloRgb, pal.rimRgb, rimAlpha, traceCrest, closeSkirt);
      break;
    }

    case 'wreck-railing': {
      // Bent foreground shipwreck deck stanchions & rail fading into bottom hull
      const posts = 3;
      const railY = sy + dir * hPx * 0.76;
      const baseY = sy - dir * skirtPx * 0.65;
      ctx.lineCap = 'round';
      const rg = ctx.createLinearGradient(sx, railY, sx, baseY);
      rg.addColorStop(0, `rgba(${pal.rgb}, 0.92)`);
      rg.addColorStop(0.7, `rgba(${pal.rgb}, 0.85)`);
      rg.addColorStop(1, `rgba(${pal.rgb}, 0)`);
      ctx.strokeStyle = rg;
      ctx.lineWidth = Math.max(2.8, wPx * 0.065);
      for (let i = 0; i < posts; i++) {
        const frac = i / (posts - 1) - 0.5;
        const px = sx + frac * wPx * 0.95;
        ctx.beginPath();
        ctx.moveTo(px, baseY);
        ctx.lineTo(px + leanPx * 0.45, railY);
        ctx.stroke();
      }
      // Top & mid rail bars
      for (const hFrac of [0.76, 0.42]) {
        const ry = sy + dir * hPx * hFrac;
        ctx.strokeStyle = `rgba(${pal.rgb}, 0.88)`;
        ctx.beginPath();
        ctx.moveTo(sx - wPx * 0.58 + leanPx * 0.45, ry);
        ctx.quadraticCurveTo(sx + leanPx * 0.45, ry + dir * hPx * 0.06, sx + wPx * 0.58 + leanPx * 0.45, ry + dir * hPx * 0.04);
        ctx.stroke();
      }
      if (rimAlpha > 0.05) {
        ctx.strokeStyle = `rgba(${pal.rimRgb}, ${(rimAlpha * 0.42).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx - wPx * 0.58 + leanPx * 0.45, railY);
        ctx.lineTo(sx + wPx * 0.58 + leanPx * 0.45, railY + dir * hPx * 0.04);
        ctx.stroke();
      }
      break;
    }

    case 'icicle-cluster':
    case 'crystal-cluster': {
      // Smoothly tapered glacial icicles / faceted crystal blades rooted softly into cavern ceiling/floor
      const tines = el.subCount;
      const halfW = wPx * 0.68;
      const traceCrest = () => {
        ctx.moveTo(sx - halfW, sy);
        for (let i = 0; i < tines; i++) {
          const u0 = i / tines;
          const uMid = (i + 0.5) / tines;
          const u1 = (i + 1) / tines;
          const isMain = i === Math.floor(tines / 2);
          const peakH = hPx * (isMain ? 1.0 : 0.52 + ((i * 23) % 10) * 0.036);
          const xL = sx + (u0 - 0.5) * halfW * 2;
          const xM = sx + (uMid - 0.5) * halfW * 1.9 + leanPx * 0.45;
          const xR = sx + (u1 - 0.5) * halfW * 2;
          ctx.quadraticCurveTo(xL + (xM - xL) * 0.42, sy + dir * peakH * 0.55, xM, sy + dir * peakH);
          ctx.quadraticCurveTo(xM + (xR - xM) * 0.58, sy + dir * peakH * 0.55, xR, sy + dir * (i < tines - 1 ? hPx * 0.16 : 0));
        }
      };
      const closeSkirt = (baseY) => {
        ctx.lineTo(sx + halfW * 1.12, baseY);
        ctx.lineTo(sx - halfW * 1.12, baseY);
      };
      _fillSoftRootedShape(ctx, sx, sy, dir, hPx, skirtPx, pal.rgb, pal.haloRgb, pal.rimRgb, rimAlpha, traceCrest, closeSkirt);
      break;
    }

    case 'monolith-block': {
      // Weathered beveled ancient sandstone terrace corner
      const bw = wPx * 0.72;
      const stepH = hPx * 0.54;
      const traceCrest = () => {
        ctx.moveTo(sx - bw, sy);
        ctx.lineTo(sx - bw * 0.92, sy + dir * stepH * 0.72);
        ctx.lineTo(sx - bw * 0.46, sy + dir * stepH * 0.72);
        ctx.lineTo(sx - bw * 0.40, sy + dir * hPx);
        ctx.lineTo(sx + bw * 0.34, sy + dir * hPx);
        ctx.lineTo(sx + bw * 0.40, sy + dir * stepH);
        ctx.lineTo(sx + bw * 0.94, sy + dir * stepH);
        ctx.lineTo(sx + bw, sy);
      };
      const closeSkirt = (baseY) => {
        ctx.lineTo(sx + bw * 1.1, baseY);
        ctx.lineTo(sx - bw * 1.1, baseY);
      };
      _fillSoftRootedShape(ctx, sx, sy, dir, hPx, skirtPx, pal.rgb, pal.haloRgb, pal.rimRgb, rimAlpha, traceCrest, closeSkirt);
      break;
    }

    case 'basalt-spire':
    case 'limestone-overhang':
    default: {
      // Asymmetric weathered karst limestone outcrop / cavern boulder framing the foreground edge
      const halfW = wPx * 0.96;
      const flip = ((Math.floor(el.seed) % 2) === 0) ? 1 : -1;
      const peakX = sx + flip * halfW * 0.16 + leanPx * 0.48;
      const shoulderX = sx - flip * halfW * 0.42;
      const shoulderH = hPx * (0.42 + ((el.seed * 7) % 10) * 0.022);
      const mainH = hPx * 0.94;
      const minorX = sx + flip * halfW * 0.54;
      const minorH = hPx * (0.34 + ((el.seed * 13) % 10) * 0.018);
      const traceCrest = () => {
        ctx.moveTo(sx - halfW, sy);
        // Sweeping weathered slope up to broad asymmetric limestone shoulder
        ctx.bezierCurveTo(
          sx - halfW * 0.84, sy + dir * shoulderH * 0.65,
          shoulderX - halfW * 0.18, sy + dir * shoulderH * 1.05,
          shoulderX + flip * halfW * 0.14, sy + dir * shoulderH * 0.78
        );
        // Steep sculpted main karst promontory / overhanging rock tooth
        ctx.bezierCurveTo(
          peakX - flip * halfW * 0.24, sy + dir * mainH * 0.92,
          peakX - flip * halfW * 0.04, sy + dir * mainH * 1.08,
          peakX + flip * halfW * 0.16, sy + dir * mainH * 0.74
        );
        // Broken limestone step tapering smoothly back into rock
        ctx.bezierCurveTo(
          minorX - flip * halfW * 0.12, sy + dir * minorH * 1.08,
          sx + halfW * 0.76, sy + dir * minorH * 0.72,
          sx + halfW, sy
        );
      };
      const closeSkirt = (baseY) => {
        ctx.lineTo(sx + halfW * 1.15, baseY);
        ctx.lineTo(sx - halfW * 1.15, baseY);
      };
      _fillSoftRootedShape(ctx, sx, sy, dir, hPx, skirtPx, pal.rgb, pal.haloRgb, pal.rimRgb, rimAlpha, traceCrest, closeSkirt);
      break;
    }
  }
}

export const foregroundDepthRendererMethods = {
  /**
   * Draw strategic near-camera foreground parallax silhouettes (v224).
   * Automatically fades near the diver so gameplay visibility stays 100% unobstructed.
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
    secretLair = null
  ) {
    if (!this.level || !scale || scale < 4) return;
    const elements = buildForegroundDepthElements(this.level);
    if (!elements || elements.length === 0) return;

    const biome = elements[0].biome || classifyForegroundBiome(this.level);
    const pal = _getBiomePalette(biome);
    const inCombat = Boolean(secretLair?.combatMode);
    const reduced = Boolean(this._reducedMotion);
    const diverSx = diver ? viewCenterX + (diver.x - effCamX) * scale : -9999;
    const diverSy = diver ? viewCenterY + (diver.y - effCamY) * scale : -9999;
    const torchOn = Boolean(diver && diver.torchOn !== false);
    const torchAng = diver?.angle ?? 0;

    // Gentle clear-corridor fade radii around the diver (in pixels)
    const innerClearR = Math.max(64, scale * 2.4);
    const outerClearR = Math.max(150, scale * 5.2);

    ctx.save();
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const p = el.parallax;
      // Keep vertical anchor close to the real rock wall so base skirt stays rooted in rock while horizontal parallax glides smoothly!
      const pyScale = 1 + (p - 1) * 0.22;
      const sx = viewCenterX + (el.x - effCamX) * scale * p;
      const sy = viewCenterY + (el.y - effCamY) * scale * pyScale;

      const wPx = el.widthM * scale * p;
      const hPx = el.heightM * scale * p;
      const margin = Math.max(wPx, hPx) + 42;
      if (sx < -margin || sx > cw + margin || sy < -margin || sy > ch + margin) continue;

      const dir = el.side === 'ceiling' ? 1 : -1;
      const tipY = sy + dir * hPx * 0.55;

      // Auto-fade whenever a foreground element glides near the diver or center sightline
      const distDiver = Math.hypot(sx - diverSx, tipY - diverSy);
      let proxFade = 1.0;
      if (distDiver < outerClearR) {
        const u = Math.max(0, Math.min(1, (distDiver - innerClearR) / Math.max(1, outerClearR - innerClearR)));
        proxFade = 0.10 + u * u * 0.90;
      }

      // Extra gentle fade during active Boss Arena combat so projectile telegraphs pop
      const baseAlpha = inCombat ? 0.22 : 0.72;
      const finalAlpha = baseAlpha * proxFade;
      if (finalAlpha < 0.04) continue;

      // Subtle torch rim-light lift when diver's beam aims toward the silhouette
      let rimAlpha = 0.22;
      if (torchOn && distDiver < scale * 12) {
        const angToEl = Math.atan2(tipY - diverSy, sx - diverSx);
        let dAng = angToEl - torchAng;
        while (dAng > Math.PI) dAng -= Math.PI * 2;
        while (dAng < -Math.PI) dAng += Math.PI * 2;
        if (Math.abs(dAng) < 0.75) {
          rimAlpha = 0.22 + (1 - Math.abs(dAng) / 0.75) * 0.52;
        }
      }

      const swayPx = reduced
        ? 0
        : Math.sin(timeSec * (el.kind === 'wreck-chain' ? 1.1 : 1.45) + el.phase) *
          (el.kind === 'cenote-roots' || el.kind === 'kelp-fronds' ? 0.26 * scale : 0.09 * scale);

      ctx.globalAlpha = finalAlpha;
      _drawSilhouette(ctx, el, sx, sy, wPx, hPx, dir, pal, swayPx, rimAlpha);
    }
    ctx.restore();
  },
};
