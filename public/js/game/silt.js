import { evaluateCaveSDF, evaluateCaveNormal } from './collision.js';

const MAX_SILT_CLOUDS = 145;

/**
 * Probes straight down from (x, y) to measure clearance to a silty cave floor in meters.
 * Returns null if open water continues beyond maxDist.
 */
export function sampleFloorClearance(level, x, y, maxDist = 1.75) {
  for (let d = 0.15; d <= maxDist; d += 0.22) {
    if (evaluateCaveSDF(level, x, y + d) >= 0) {
      return d;
    }
  }
  return null;
}

/**
 * Spawns a single cave-silt plume capped to MAX_SILT_CLOUDS for steady mobile GPU performance.
 */
export function spawnSiltPlume(siltClouds, plume) {
  if (siltClouds.length >= MAX_SILT_CLOUDS) {
    siltClouds.shift();
  }
  const life = plume.life ?? 30.0;
  const peakAlpha = plume.peakAlpha ?? plume.opacity ?? 0.85;
  const cloud = {
    x: plume.x,
    y: plume.y,
    vx: plume.vx ?? 0,
    vy: plume.vy ?? -0.25,
    radius: plume.radius ?? 0.9,
    maxRadius: plume.maxRadius ?? 4.6,
    life,
    maxLife: life,
    peakAlpha,
    alpha: peakAlpha,
    seed: plume.seed ?? Math.random() * 6.28,
    rot: plume.rot ?? Math.random() * 6.28,
    rotVel: plume.rotVel ?? (Math.random() - 0.5) * 0.35,
    canBud: plume.canBud ?? false,
    isRust: Boolean(plume.isRust),
  };
  siltClouds.push(cloud);
  return cloud;
}

export function sampleSiltDensity(x, y, siltClouds) {
  if (!Array.isArray(siltClouds) || siltClouds.length === 0) return 0;
  let density = 0;
  for (let i = 0; i < siltClouds.length; i++) {
    const s = siltClouds[i];
    const r = s.radius;
    const dx = s.x - x;
    const dy = s.y - y;
    const distSq = dx * dx + dy * dy;
    if (distSq < r * r) {
      density += (1 - Math.sqrt(distSq) / r) * s.alpha;
    }
  }
  return density > 1 ? 1 : density;
}

const _siltNormalTmp = { nx: 0, ny: 0 };

/**
 * Checks diver fin tips & body proximity to cavern floors during swimming / frog kicks,
 * stirring up billowing limestone silt plumes that obscure visibility.
 * Returns true if substantial floor silt was disturbed this tick.
 */
export function stirFloorSilt(level, diver, siltClouds, { dt, thrustMag, timerState, onSpawn = null, difficulty = 'standard', dpvBoost = false, mutatorMult = 1.0 }) {
  if (!diver || diver.y < 5.0) return false;

  const diffMult = (difficulty === 'hardcore' ? 1.35 : difficulty === 'guided' ? 0.56 : 1.0) * (Number(mutatorMult) || 1.0);
  const kickBoost = dpvBoost ? 1.75 : (diver.body ? 0.55 + diver.body.kickSurge * 1.45 : 1.0);
  const vx = diver.vx || 0;
  const vy = diver.vy || 0;
  const speed = Math.sqrt(vx * vx + vy * vy);
  const activity = Math.min(dpvBoost ? 2.2 : 1.5, thrustMag * 0.95 * kickBoost + speed * 0.35);
  if (activity < 0.12) return false;

  // Sample clearance beneath pelvis and both articulated fin tips (zero allocations)
  const maxProbe = dpvBoost ? 2.35 : 1.65;
  const maxClear = dpvBoost ? 2.25 : 1.55;
  let minClearance = Infinity;
  let stirX = diver.x;
  let stirY = diver.y;
  const c0 = sampleFloorClearance(level, diver.x, diver.y + 0.15, maxProbe);
  if (c0 !== null && c0 < minClearance) {
    minClearance = c0;
    stirX = diver.x;
    stirY = diver.y + 0.15 + c0 - 0.14;
  }
  const legs = diver.body?.legs;
  if (legs) {
    for (let i = 0; i < legs.length; i++) {
      const tip = legs[i].finTip;
      const c = sampleFloorClearance(level, tip.x, tip.y, maxProbe);
      if (c !== null && c < minClearance) {
        minClearance = c;
        stirX = tip.x;
        stirY = tip.y + c - 0.14;
      }
    }
  }

  if (minClearance > maxClear) return false;

  const proximity = 1 - minClearance / maxClear; // 0..1 as fins or DPV propwash skim the floor
  const spawnRate = (2.8 + proximity * 8.5) * activity * diffMult * (dpvBoost ? 1.35 : 1.0);
  timerState.accum = (timerState.accum || 0) + spawnRate * dt;

  let disturbed = false;
  const fx = Math.cos(diver.angle);
  const fy = Math.sin(diver.angle);

  while (timerState.accum >= 1.0) {
    timerState.accum -= 1.0;
    disturbed = true;
    const spread = (Math.random() - 0.5) * 1.4;
    const radScale = (difficulty === 'hardcore' ? 1.16 : difficulty === 'guided' ? 0.82 : 1.0) * (dpvBoost ? 1.18 : 1.0);
    const alphaScale = (difficulty === 'hardcore' ? 1.09 : difficulty === 'guided' ? 0.78 : 1.0) * (dpvBoost ? 1.06 : 1.0);
    // Prop-wash & fin-wash wake jets backward along swim/kick axis & billows upward from the floor (v159)
    const finWashMag = 0.85 + Math.min(1.4, activity * 0.65) + (dpvBoost ? 0.9 : 0);
    const cloud = spawnSiltPlume(siltClouds, {
      x: stirX - fx * 0.35 + spread * 0.5,
      y: stirY - Math.random() * 0.22,
      vx: -fx * (finWashMag + Math.random() * 0.65) + spread * 0.45,
      vy: -fy * 0.35 - (0.38 + Math.random() * 0.58),
      radius: (0.75 + proximity * 0.55 + Math.random() * 0.35) * radScale,
      maxRadius: (3.4 + proximity * 2.1) * radScale,
      life: (28.0 + Math.random() * 12.0) * (difficulty === 'guided' ? 0.8 : difficulty === 'hardcore' ? 1.15 : 1.0),
      peakAlpha: Math.min(0.95, (0.68 + proximity * 0.25) * alphaScale),
      canBud: true,
    });
    if (cloud && onSpawn) onSpawn(cloud);
  }

  return disturbed && proximity > 0.32;
}

/**
 * Diffuses silt clouds outward along cave corridors while bouncing off rock boundaries.
 * Also computes local silt density at (diver.x, diver.y) for telemetry/testing.
 */
export function stepSiltPhysics(level, siltClouds, diver, dt, opts = {}) {
  const dampX = Math.exp(-0.48 * dt);
  const dampY = Math.exp(-0.58 * dt);
  const currentVx = Number(opts?.currentVx) || 0;
  for (let i = siltClouds.length - 1; i >= 0; i--) {
    const s = siltClouds[i];
    // Bud secondary cavern-diffusing tendrils as energetic floor plumes rise into the passage
    if (s.canBud && s.radius > 1.7 && siltClouds.length < MAX_SILT_CLOUDS) {
      s.canBud = false;
      const budSign = Math.cos(s.seed) >= 0 ? 1 : -1;
      const bx = s.x + budSign * 0.45;
      const by = s.y - 0.35;
      if (evaluateCaveSDF(level, bx, by) < -0.25) {
        spawnSiltPlume(siltClouds, {
          x: bx,
          y: by,
          vx: s.vx * 0.55 + budSign * (0.48 + Math.random() * 0.45),
          vy: s.vy * 0.5 - (0.18 + Math.random() * 0.22),
          radius: s.radius * 0.72,
          maxRadius: Math.min(5.4, s.maxRadius * 1.25),
          life: s.life * 0.95,
          peakAlpha: s.peakAlpha * 0.72,
          canBud: false,
        });
      }
    }

    // Buoyant turbulent swirl followed by slow diffuse drift & gradual settling
    const nx = s.x + s.vx * dt;
    const ny = s.y + s.vy * dt;

    if (evaluateCaveSDF(level, nx, ny) < -0.14) {
      s.x = nx;
      s.y = ny;
    } else {
      const n = evaluateCaveNormal(level, nx, ny, _siltNormalTmp);
      const vn = s.vx * n.nx + s.vy * n.ny;
      if (vn > 0) {
        s.vx -= n.nx * vn * 1.3;
        s.vy -= n.ny * vn * 1.3;
      }
      s.x -= n.nx * 0.06;
      s.y -= n.ny * 0.06;
    }

    // Cavern eddy curls, tidal drift & broad diffusion throughout the chamber (rust percolation gently rains downward)
    s.vx = (s.vx + (Math.sin(s.life * 1.15 + s.seed) * 0.26 + currentVx * 0.42) * dt) * dampX;
    if (s.isRust) {
      s.vy = (s.vy + (0.28 + Math.cos(s.life * 0.85 + s.seed) * 0.08) * dt) * dampY;
    } else {
      s.vy = (s.vy + Math.cos(s.life * 0.95 + s.seed) * 0.16 * dt) * dampY;
    }
    s.rot = (s.rot ?? 0) + (s.rotVel ?? 0) * dt;
    if (s.radius < s.maxRadius) {
      s.radius = Math.min(s.maxRadius, s.radius + dt * (0.38 + (s.maxRadius - s.radius) * 0.24));
    }

    s.life -= dt;
    if (s.life <= 0) {
      const last = siltClouds.length - 1;
      if (i !== last) siltClouds[i] = siltClouds[last];
      siltClouds.pop();
      continue;
    }

    const lifeRatio = s.life / s.maxLife;
    // Holds dense opacity for most of its lifetime, then gently thins out near end
    s.alpha = s.peakAlpha * Math.min(1, lifeRatio * 1.85);
  }

  return diver ? sampleSiltDensity(diver.x, diver.y, siltClouds) : 0;
}
