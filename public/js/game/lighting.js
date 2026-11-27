import { evaluateCaveSDF, createBoxSDFEvaluator } from './collision.js';

/**
 * Sphere-traces a ray against the cave SDF and optional silt clouds.
 * Returns { x, y, dist, hitWall, hitSurface, nx, ny, incidence } at the stopping point.
 */
export function castLightRay(
  level,
  ox,
  oy,
  angle,
  maxRangeM,
  siltClouds = [],
  { stopAtSurface = true, sdfFn = null, out = null, siltPierce = 0 } = {}
) {
  const res = out || { x: 0, y: 0, dist: 0, hitWall: false, hitSurface: false, nx: 0, ny: 0, incidence: 0 };
  const evalSdf = sdfFn || ((x, y) => evaluateCaveSDF(level, x, y));
  const marchSdf = sdfFn?.evalFast || evalSdf;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let t = 0.08;
  let effectiveMax = maxRangeM;

  // Clamp underwater torch rays cleanly at the water surface (y = 0) when pointing upward
  if (stopAtSurface && oy >= 0 && dy < -0.001) {
    const surfaceT = -oy / dy;
    if (surfaceT > 0 && surfaceT < effectiveMax) {
      effectiveMax = surfaceT;
    }
  }

  // Attenuate beam reach when shooting through dense cave silt clouds (reduced by Silt-Piercing Lamps, v230)
  const pierce = Math.max(0, Math.min(0.9, Number(siltPierce) || 0));
  if (siltClouds.length > 0 && pierce < 0.98) {
    const attenScale = 0.72 * (1 - pierce);
    const minFloor = 1.2 + pierce * 5.2;
    for (let i = 0; i < siltClouds.length; i++) {
      const s = siltClouds[i];
      if (s.alpha < 0.08) continue;
      const rx = s.x - ox;
      const ry = s.y - oy;
      const proj = rx * dx + ry * dy;
      if (proj > 0 && proj < effectiveMax) {
        const perpSq = rx * rx + ry * ry - proj * proj;
        const r = s.radius * 0.92;
        if (perpSq < r * r) {
          const density = (1 - Math.sqrt(Math.max(0, perpSq)) / r) * s.alpha;
          effectiveMax = Math.max(minFloor, effectiveMax * (1 - Math.min(0.82, density * attenScale)));
        }
      }
    }
  }

  let prevT = 0;
  for (let step = 0; step < 36; step++) {
    if (t >= effectiveMax) {
      const hitSurface = stopAtSurface && oy >= 0 && dy < -0.001 && Math.abs(oy + dy * effectiveMax) < 0.06;
      res.x = ox + dx * effectiveMax;
      res.y = oy + dy * effectiveMax;
      res.dist = effectiveMax;
      res.hitWall = false;
      res.hitSurface = hitSurface;
      res.nx = 0;
      res.ny = hitSurface ? 1 : 0;
      res.incidence = hitSurface ? Math.max(0.15, -dy) : 0;
      return res;
    }

    const px = ox + dx * t;
    const py = oy + dy * t;
    const sdf = marchSdf(px, py);

    if (sdf >= -0.025) {
      // 2-step binary refinement (~0.035m precision) + 2-sample forward-difference wall normal (43% fewer SDF evals!)
      let lo = prevT;
      let hi = t;
      for (let b = 0; b < 2; b++) {
        const mid = (lo + hi) * 0.5;
        if (evalSdf(ox + dx * mid, oy + dy * mid) >= -0.02) hi = mid;
        else lo = mid;
      }
      const hitDist = Math.min(effectiveMax, hi + 0.04);
      const hx = ox + dx * hitDist;
      const hy = oy + dy * hitDist;
      const sdfH = evalSdf(hx, hy);
      const eps = 0.09;
      const gx = evalSdf(hx + eps, hy) - sdfH;
      const gy = evalSdf(hx, hy + eps) - sdfH;
      const nLen = Math.sqrt(gx * gx + gy * gy) || 1;
      const nnx = gx / nLen;
      const nny = gy / nLen;
      const incidence = Math.max(0.15, dx * nnx + dy * nny);
      res.x = hx;
      res.y = hy;
      res.dist = hitDist;
      res.hitWall = true;
      res.hitSurface = false;
      res.nx = -nnx;
      res.ny = -nny;
      res.incidence = incidence;
      return res;
    }

    prevT = t;
    t += Math.max(0.15, -sdf * 0.88);
  }

  res.x = ox + dx * effectiveMax;
  res.y = oy + dy * effectiveMax;
  res.dist = effectiveMax;
  res.hitWall = false;
  res.hitSurface = false;
  res.nx = 0;
  res.ny = 0;
  res.incidence = 0;
  return res;
}

const _fanLocalSiltScratch = [];

/**
 * Casts a fan of rays to build a physical cave-shadowed visibility polygon.
 * Prunes segments, basins, and silt clouds once to the torch bounding box.
 * Accepts optional reusable `outRays` pool for zero-GC per-frame raycasting.
 */
export function castTorchFan(level, ox, oy, centerAngle, halfSpread, maxRangeM, rayCount = 40, siltClouds = [], outRays = null, siltPierce = 0) {
  const rays = Array.isArray(outRays) ? outRays : new Array(rayCount);
  rays.length = rayCount;
  const start = centerAngle - halfSpread;
  const step = (halfSpread * 2) / Math.max(1, rayCount - 1);

  const localSdf = createBoxSDFEvaluator(
    level,
    ox - maxRangeM,
    ox + maxRangeM,
    oy - maxRangeM,
    oy + maxRangeM,
    4.0
  );

  let localSilt = siltClouds;
  if (siltClouds.length > 0) {
    _fanLocalSiltScratch.length = 0;
    for (let i = 0; i < siltClouds.length; i++) {
      const s = siltClouds[i];
      if (s.alpha < 0.08) continue;
      const reach = maxRangeM + s.radius;
      const dx = s.x - ox;
      const dy = s.y - oy;
      if (dx * dx + dy * dy <= reach * reach) {
        _fanLocalSiltScratch.push(s);
      }
    }
    localSilt = _fanLocalSiltScratch;
  }

  const opts = { stopAtSurface: true, sdfFn: localSdf, out: null, siltPierce };
  for (let i = 0; i < rayCount; i++) {
    const a = start + step * i;
    const slot = rays[i] || { x: 0, y: 0, dist: 0, hitWall: false, hitSurface: false, nx: 0, ny: 0, incidence: 0 };
    opts.out = slot;
    rays[i] = castLightRay(level, ox, oy, a, maxRangeM, localSilt, opts);
  }
  return rays;
}

/**
 * Casts parallel sunlight rays across an open cenote basin surface (y = 0) down into the water,
 * stopping strictly at limestone overhangs, walls, or maxDepthM.
 * Returns contiguous open-water sun curtains [{ rays: [{ xTop, yTop, xBot, yBot, dist, hitWall, nx, ny, incidence }] }].
 */
export function castSunCurtain(level, xMin, xMax, sunAngle = Math.PI * 0.5 - 0.14, maxDepthM = 20, siltClouds = [], sampleCount = 20) {
  const curtains = [];
  let current = null;
  const span = Math.max(0.5, xMax - xMin);
  const xPad = Math.abs(Math.cos(sunAngle)) * maxDepthM + 4.0;
  const localSdf = createBoxSDFEvaluator(level, xMin - xPad, xMax + xPad, -2, maxDepthM + 4, 4.0);
  const opts = { stopAtSurface: false, sdfFn: localSdf };

  for (let i = 0; i < sampleCount; i++) {
    const rx = xMin + (span * i) / Math.max(1, sampleCount - 1);
    const sdf = localSdf(rx, 0.04);
    if (sdf >= -0.08) {
      if (current && current.length >= 2) curtains.push(current);
      current = null;
      continue;
    }

    const hit = castLightRay(level, rx, 0.04, sunAngle, maxDepthM, siltClouds, opts);
    if (!current) current = [];
    current.push({
      xTop: rx,
      yTop: 0,
      xBot: hit.x,
      yBot: hit.y,
      dist: hit.dist,
      hitWall: hit.hitWall,
      nx: hit.nx,
      ny: hit.ny,
      incidence: hit.incidence,
    });
  }

  if (current && current.length >= 2) {
    curtains.push(current);
  }
  return curtains;
}

/**
 * Physically inspired Beer-Lambert underwater spectral wavelength absorption (v124).
 * Reds vanish rapidly (~10m), oranges/yellows by ~22m, while blue-cyan penetrates deep —
 * until a high-CRI dive torch restores warm colors locally inside the beam cone.
 */
export function computeSpectralAbsorption(depthM = 0) {
  const d = Math.max(0, Number(depthM) || 0);
  const redRetention = Math.exp(-0.16 * d);
  const greenRetention = Math.exp(-0.045 * d);
  const blueRetention = Math.exp(-0.016 * d);
  // How strongly red/warm light has been stripped relative to blue
  const redLoss = Math.max(0, Math.min(1, 1 - redRetention));
  const absorptionStrength = d <= 4 ? 0 : Math.min(1, ((d - 4) / 34) * (0.45 + 0.55 * redLoss));
  const tintAlpha = Math.round(absorptionStrength * 0.22 * 1000) / 1000;
  const warmRestoreStrength = Math.round(Math.min(1, redLoss * 0.85) * 1000) / 1000;
  return {
    depthM: d,
    redRetention: Math.round(redRetention * 1000) / 1000,
    greenRetention: Math.round(greenRetention * 1000) / 1000,
    blueRetention: Math.round(blueRetention * 1000) / 1000,
    absorptionStrength: Math.round(absorptionStrength * 1000) / 1000,
    tintAlpha,
    warmRestoreStrength,
  };
}
