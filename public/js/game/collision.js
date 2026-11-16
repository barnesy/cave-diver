/**
 * Signed-distance cave geometry & collision solver.
 * All coordinates are in meters (y = depth below surface).
 */

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Deterministic multi-octave pseudo-rock displacement in meters.
 */
export function rockDisplacement(x, y, roughness = 0.42) {
  if (roughness <= 0) return 0;
  const n1 = Math.sin(x * 0.47 + y * 0.31) * Math.cos(x * 0.23 - y * 0.53);
  const n2 = Math.sin(x * 1.13 - y * 0.89) * 0.48;
  const n3 = Math.cos(x * 2.45 + y * 2.05) * 0.22;
  const n4 = Math.sin(x * 4.7 - y * 3.9) * 0.1;
  return (n1 + n2 + n3 + n4) * roughness;
}

/**
 * Distance from point (px, py) to a tapered capsule segment.
 * Negative = inside open tunnel, Positive = inside rock.
 */
function distToTaperedCapsule(px, py, seg) {
  const vx = seg.bx - seg.ax;
  const vy = seg.by - seg.ay;
  const lenSq = vx * vx + vy * vy;
  let t = 0;
  if (lenSq > 1e-6) {
    t = clamp(((px - seg.ax) * vx + (py - seg.ay) * vy) / lenSq, 0, 1);
  }
  const cx = seg.ax + vx * t;
  const cy = seg.ay + vy * t;
  const radius = seg.ra + (seg.rb - seg.ra) * t;
  const dx = px - cx;
  const dy = py - cy;
  return Math.hypot(dx, dy) - radius;
}

/**
 * Smooth minimum for organic cave intersections.
 */
function smoothMin(a, b, k = 1.4) {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0.0, 1.0);
  return b * (1 - h) + a * h - k * h * (1 - h);
}

const LEVEL_SDF_CACHE = new WeakMap();

function getPreparedGeometry(level) {
  const cached = LEVEL_SDF_CACHE.get(level);
  const rawSegs = level.segments;
  const rawBasins = level.openBasins || [];
  if (
    cached &&
    cached.rawSegs === rawSegs &&
    cached.segsLen === rawSegs.length &&
    cached.rawBasins === rawBasins &&
    cached.basinsLen === rawBasins.length
  ) {
    return cached;
  }

  const segs = new Array(rawSegs.length);
  for (let i = 0; i < rawSegs.length; i++) {
    const s = rawSegs[i];
    const vx = s.bx - s.ax;
    const vy = s.by - s.ay;
    const lenSq = vx * vx + vy * vy;
    const maxR = s.ra > s.rb ? s.ra : s.rb;
    segs[i] = {
      ax: s.ax,
      ay: s.ay,
      vx,
      vy,
      invLenSq: lenSq > 1e-6 ? 1 / lenSq : 0,
      ra: s.ra,
      dr: s.rb - s.ra,
      maxR,
      minX: s.ax < s.bx ? s.ax : s.bx,
      maxX: s.ax > s.bx ? s.ax : s.bx,
      minY: s.ay < s.by ? s.ay : s.by,
      maxY: s.ay > s.by ? s.ay : s.by,
    };
  }

  const basins = new Array(rawBasins.length);
  for (let i = 0; i < rawBasins.length; i++) {
    const b = rawBasins[i];
    basins[i] = {
      cx: (b.xMin + b.xMax) * 0.5,
      rimHalf: b.rimHalf ?? (b.xMax - b.xMin) * 0.44,
      flareAdd: b.flareAdd ?? 2.2,
      lipTilt: b.lipTilt ?? 0,
      floorY: b.floorY ?? 2.4,
    };
  }

  const entry = {
    rawSegs,
    segsLen: rawSegs.length,
    rawBasins,
    basinsLen: rawBasins.length,
    segs,
    basins,
  };
  LEVEL_SDF_CACHE.set(level, entry);
  return entry;
}

/**
 * Shared tapered capsule + karst sinkhole SDF evaluator given prefiltered segment & basin arrays.
 */
function evalPreparedSDF(segs, basins, level, x, y) {
  const kSeg = 1.35;
  let d = Infinity;

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (d !== Infinity) {
      const dxBox = x < seg.minX ? seg.minX - x : (x > seg.maxX ? x - seg.maxX : 0);
      const dyBox = y < seg.minY ? seg.minY - y : (y > seg.maxY ? y - seg.maxY : 0);
      if ((dxBox > dyBox ? dxBox : dyBox) - seg.maxR >= d + kSeg) continue;
    }

    const t = seg.invLenSq > 0
      ? clamp(((x - seg.ax) * seg.vx + (y - seg.ay) * seg.vy) * seg.invLenSq, 0, 1)
      : 0;
    const cx = seg.ax + seg.vx * t;
    const cy = seg.ay + seg.vy * t;
    const radius = seg.ra + seg.dr * t;
    const segD = Math.hypot(x - cx, y - cy) - radius;
    d = d === Infinity ? segD : smoothMin(d, segD, kSeg);
  }

  for (let i = 0; i < basins.length; i++) {
    const b = basins[i];
    const flare = clamp((y + 1.8) / 5.5, 0, 1);
    const targetHalf = b.rimHalf + b.flareAdd * flare * flare;
    const tilt = b.lipTilt * Math.sin(clamp((y + 3.0) / 6.0, -1, 1));
    const dx = Math.abs(x - (b.cx + tilt)) - targetHalf;
    const dy = y - b.floorY;
    const sinkholeD = dy > 0 ? Math.hypot(Math.max(0, dx), dy) : dx;
    d = d === Infinity ? sinkholeD : smoothMin(d, sinkholeD, 1.9);
  }

  const waterlineCalm = 0.45 + 0.55 * clamp(Math.abs(y) / 1.4, 0, 1);
  const roughness = (level.roughness ?? 0.38) * waterlineCalm;
  return d + rockDisplacement(x, y, roughness);
}

/**
 * Returns a chunk-localized SDF evaluator pruned to segments & basins near [cx0, cx1]
 * so off-screen terrain baking avoids scanning distant geometry on large multi-tier caves.
 */
export function createChunkSDFEvaluator(level, cx0, cx1, marginM = 8.0) {
  const { segs, basins } = getPreparedGeometry(level);
  const loX = cx0 - marginM;
  const hiX = cx1 + marginM;
  const localSegs = segs.filter((s) => s.maxX + s.maxR >= loX && s.minX - s.maxR <= hiX);
  const localBasins = basins.filter((b) => {
    const half = b.rimHalf + b.flareAdd + Math.abs(b.lipTilt) + 3.0;
    return b.cx + half >= loX && b.cx - half <= hiX;
  });
  return (x, y) => evalPreparedSDF(localSegs, localBasins, level, x, y);
}

/**
 * Evaluates signed distance to rock wall at (x, y).
 * < 0 means open water; >= 0 means solid rock.
 */
export function evaluateCaveSDF(level, x, y) {
  const { segs, basins } = getPreparedGeometry(level);
  return evalPreparedSDF(segs, basins, level, x, y);
}

/**
 * Computes unit normal pointing from open water INTO rock (i.e., gradient of SDF).
 */
export function evaluateCaveNormal(level, x, y) {
  const eps = 0.08;
  const gx = evaluateCaveSDF(level, x + eps, y) - evaluateCaveSDF(level, x - eps, y);
  const gy = evaluateCaveSDF(level, x, y + eps) - evaluateCaveSDF(level, x, y - eps);
  const len = Math.hypot(gx, gy) || 1;
  return { nx: gx / len, ny: gy / len };
}

/**
 * Resolves circle collision against cave walls and water surface.
 * Returns { collided, impactSpeed, nx, ny }.
 */
export function resolveDiverCollision(level, diver, diverRadius = 0.55) {
  let collided = false;
  let impactSpeed = 0;
  let hitNx = 0;
  let hitNy = 0;

  // Water surface ceiling (y >= 0.35m unless inside open basin surface)
  if (diver.y < 0.35) {
    diver.y = 0.35;
    if (diver.vy < 0) diver.vy = 0;
  }

  for (let iter = 0; iter < 3; iter++) {
    const sdf = evaluateCaveSDF(level, diver.x, diver.y);
    const penetration = sdf + diverRadius;
    if (penetration > 0) {
      const { nx, ny } = evaluateCaveNormal(level, diver.x, diver.y);
      // Push back into open water (-normal)
      diver.x -= nx * penetration;
      diver.y -= ny * penetration;

      const vn = diver.vx * nx + diver.vy * ny;
      if (vn > 0) {
        if (vn > impactSpeed) impactSpeed = vn;
        // Slide along wall with slight bounce
        diver.vx -= nx * vn * 1.25;
        diver.vy -= ny * vn * 1.25;
        diver.vx *= 0.86;
        diver.vy *= 0.86;
        collided = true;
        hitNx = nx;
        hitNy = ny;
      }
    } else {
      break;
    }
  }

  return { collided, impactSpeed, nx: hitNx, ny: hitNy };
}
