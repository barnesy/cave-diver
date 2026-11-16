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
  siltClouds.push({
    x: plume.x,
    y: plume.y,
    vx: plume.vx ?? 0,
    vy: plume.vy ?? -0.25,
    radius: plume.radius ?? 0.9,
    maxRadius: plume.maxRadius ?? 4.6,
    life,
    maxLife: life,
    peakAlpha: plume.peakAlpha ?? 0.85,
    alpha: plume.peakAlpha ?? 0.85,
    seed: plume.seed ?? Math.random() * 6.28,
    rot: plume.rot ?? Math.random() * 6.28,
    rotVel: plume.rotVel ?? (Math.random() - 0.5) * 0.35,
    canBud: plume.canBud ?? false,
  });
}

/**
 * Checks diver fin tips & body proximity to cavern floors during swimming / frog kicks,
 * stirring up billowing limestone silt plumes that obscure visibility.
 * Returns true if substantial floor silt was disturbed this tick.
 */
export function stirFloorSilt(level, diver, siltClouds, { dt, thrustMag, timerState }) {
  if (!diver || diver.y < 5.0) return false;

  const kickBoost = diver.body ? 0.55 + diver.body.kickSurge * 1.45 : 1.0;
  const speed = Math.hypot(diver.vx || 0, diver.vy || 0);
  const activity = Math.min(1.5, thrustMag * 0.95 * kickBoost + speed * 0.35);
  if (activity < 0.12) return false;

  // Sample clearance beneath pelvis and both articulated fin tips
  const probes = [{ x: diver.x, y: diver.y + 0.15, weight: 0.7 }];
  if (diver.body?.legs) {
    for (const leg of diver.body.legs) {
      probes.push({ x: leg.finTip.x, y: leg.finTip.y, weight: 1.25 });
    }
  }

  let minClearance = Infinity;
  let stirX = diver.x;
  let stirY = diver.y;
  for (const p of probes) {
    const c = sampleFloorClearance(level, p.x, p.y, 1.65);
    if (c !== null && c < minClearance) {
      minClearance = c;
      stirX = p.x;
      stirY = p.y + c - 0.14;
    }
  }

  if (minClearance > 1.55) return false;

  const proximity = 1 - minClearance / 1.55; // 0..1 as fins skim the floor
  const spawnRate = (2.8 + proximity * 8.5) * activity;
  timerState.accum = (timerState.accum || 0) + spawnRate * dt;

  let disturbed = false;
  const fx = Math.cos(diver.angle);
  const fy = Math.sin(diver.angle);

  while (timerState.accum >= 1.0) {
    timerState.accum -= 1.0;
    disturbed = true;
    const spread = (Math.random() - 0.5) * 1.4;
    // Prop-wash jets backward & billows upward from the limestone silt bed
    spawnSiltPlume(siltClouds, {
      x: stirX + spread * 0.6,
      y: stirY - Math.random() * 0.22,
      vx: -fx * (0.65 + Math.random() * 0.85) + spread * 0.6,
      vy: -fy * 0.25 - (0.42 + Math.random() * 0.65),
      radius: 0.75 + proximity * 0.55 + Math.random() * 0.35,
      maxRadius: 3.4 + proximity * 2.1,
      life: 28.0 + Math.random() * 12.0,
      peakAlpha: 0.68 + proximity * 0.25,
      canBud: true,
    });
  }

  return disturbed && proximity > 0.32;
}

/**
 * Diffuses silt clouds outward along cave corridors while bouncing off rock boundaries.
 * Also computes local silt density at (diver.x, diver.y) for telemetry/testing.
 */
export function stepSiltPhysics(level, siltClouds, diver, dt) {
  let localDensity = 0;

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
      const n = evaluateCaveNormal(level, nx, ny);
      const vn = s.vx * n.nx + s.vy * n.ny;
      if (vn > 0) {
        s.vx -= n.nx * vn * 1.3;
        s.vy -= n.ny * vn * 1.3;
      }
      s.x -= n.nx * 0.06;
      s.y -= n.ny * 0.06;
    }

    // Cavern eddy curls & broad diffusion throughout the chamber
    s.vx = (s.vx + Math.sin(s.life * 1.15 + s.seed) * 0.26 * dt) * Math.exp(-0.48 * dt);
    s.vy = (s.vy + Math.cos(s.life * 0.95 + s.seed) * 0.16 * dt) * Math.exp(-0.58 * dt);
    s.rot = (s.rot ?? 0) + (s.rotVel ?? 0) * dt;
    if (s.radius < s.maxRadius) {
      s.radius = Math.min(s.maxRadius, s.radius + dt * (0.38 + (s.maxRadius - s.radius) * 0.24));
    }

    s.life -= dt;
    if (s.life <= 0) {
      siltClouds.splice(i, 1);
      continue;
    }

    const lifeRatio = s.life / s.maxLife;
    // Holds dense opacity for most of its lifetime, then gently thins out near end
    s.alpha = s.peakAlpha * Math.min(1, lifeRatio * 1.85);

    if (diver) {
      const dist = Math.hypot(s.x - diver.x, s.y - diver.y);
      if (dist < s.radius) {
        localDensity += (1 - dist / s.radius) * s.alpha;
      }
    }
  }

  return Math.min(1, localDensity);
}
