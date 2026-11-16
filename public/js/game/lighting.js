import { evaluateCaveSDF, evaluateCaveNormal } from './collision.js';

/**
 * Sphere-traces a ray against the cave SDF and optional silt clouds.
 * Returns { x, y, dist, hitWall, hitSurface, nx, ny, incidence } at the stopping point.
 */
export function castLightRay(level, ox, oy, angle, maxRangeM, siltClouds = [], { stopAtSurface = true } = {}) {
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

  // Attenuate beam reach strongly when shooting through dense cave silt clouds
  if (siltClouds.length > 0) {
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
          effectiveMax = Math.max(1.2, effectiveMax * (1 - Math.min(0.82, density * 0.72)));
        }
      }
    }
  }

  let prevT = 0;
  for (let step = 0; step < 44; step++) {
    if (t >= effectiveMax) {
      const hitSurface = stopAtSurface && oy >= 0 && dy < -0.001 && Math.abs(oy + dy * effectiveMax) < 0.06;
      return {
        x: ox + dx * effectiveMax,
        y: oy + dy * effectiveMax,
        dist: effectiveMax,
        hitWall: false,
        hitSurface,
        nx: 0,
        ny: hitSurface ? 1 : 0,
        incidence: hitSurface ? Math.max(0.15, -dy) : 0,
      };
    }

    const px = ox + dx * t;
    const py = oy + dy * t;
    const sdf = evaluateCaveSDF(level, px, py);

    if (sdf >= -0.025) {
      // Binary-refine the surface crossing between prevT and t for crisp consistent wall scatter
      let lo = prevT;
      let hi = t;
      for (let b = 0; b < 3; b++) {
        const mid = (lo + hi) * 0.5;
        if (evaluateCaveSDF(level, ox + dx * mid, oy + dy * mid) >= -0.02) hi = mid;
        else lo = mid;
      }
      const hitDist = Math.min(effectiveMax, hi + 0.04);
      const hx = ox + dx * hitDist;
      const hy = oy + dy * hitDist;
      const n = evaluateCaveNormal(level, hx, hy);
      // Normal points INTO rock, so -n points into open water; incidence is alignment with -ray
      const incidence = Math.max(0.15, dx * n.nx + dy * n.ny);
      return {
        x: hx,
        y: hy,
        dist: hitDist,
        hitWall: true,
        hitSurface: false,
        nx: -n.nx,
        ny: -n.ny,
        incidence,
      };
    }

    prevT = t;
    t += Math.max(0.14, -sdf * 0.85);
  }

  return {
    x: ox + dx * effectiveMax,
    y: oy + dy * effectiveMax,
    dist: effectiveMax,
    hitWall: false,
    hitSurface: false,
    nx: 0,
    ny: 0,
    incidence: 0,
  };
}

/**
 * Casts a fan of rays to build a physical cave-shadowed visibility polygon.
 */
export function castTorchFan(level, ox, oy, centerAngle, halfSpread, maxRangeM, rayCount = 40, siltClouds = []) {
  const rays = new Array(rayCount);
  const start = centerAngle - halfSpread;
  const step = (halfSpread * 2) / Math.max(1, rayCount - 1);

  for (let i = 0; i < rayCount; i++) {
    const a = start + step * i;
    rays[i] = castLightRay(level, ox, oy, a, maxRangeM, siltClouds);
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

  for (let i = 0; i < sampleCount; i++) {
    const rx = xMin + (span * i) / Math.max(1, sampleCount - 1);
    const sdf = evaluateCaveSDF(level, rx, 0.04);
    if (sdf >= -0.08) {
      if (current && current.length >= 2) curtains.push(current);
      current = null;
      continue;
    }

    const hit = castLightRay(level, rx, 0.04, sunAngle, maxDepthM, siltClouds, { stopAtSurface: false });
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
