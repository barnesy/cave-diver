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
    const dx = x - (seg.ax + seg.vx * t);
    const dy = y - (seg.ay + seg.vy * t);
    const radius = seg.ra + seg.dr * t;
    const segD = Math.sqrt(dx * dx + dy * dy) - radius;
    d = d === Infinity ? segD : smoothMin(d, segD, kSeg);
  }

  for (let i = 0; i < basins.length; i++) {
    const b = basins[i];
    const flare = clamp((y + 1.8) / 5.5, 0, 1);
    const targetHalf = b.rimHalf + b.flareAdd * flare * flare;
    const tilt = b.lipTilt * Math.sin(clamp((y + 3.0) / 6.0, -1, 1));
    const dx = Math.abs(x - (b.cx + tilt)) - targetHalf;
    const dy = y - b.floorY;
    let sinkholeD;
    if (dy > 0) {
      const mx = dx > 0 ? dx : 0;
      sinkholeD = Math.sqrt(mx * mx + dy * dy);
    } else {
      sinkholeD = dx;
    }
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
 * Returns a 2D-bounded SDF evaluator pruned in both X and Y for torch raycasts and vertical baking strips.
 */
export function createBoxSDFEvaluator(level, xMin, xMax, yMin, yMax, marginM = 4.0) {
  const { segs, basins } = getPreparedGeometry(level);
  const loX = xMin - marginM;
  const hiX = xMax + marginM;
  const loY = yMin - marginM;
  const hiY = yMax + marginM;
  const localSegs = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (
      s.maxX + s.maxR >= loX &&
      s.minX - s.maxR <= hiX &&
      s.maxY + s.maxR >= loY &&
      s.minY - s.maxR <= hiY
    ) {
      localSegs.push(s);
    }
  }
  const localBasins = [];
  for (let i = 0; i < basins.length; i++) {
    const b = basins[i];
    const half = b.rimHalf + b.flareAdd + Math.abs(b.lipTilt) + 3.0;
    if (b.cx + half >= loX && b.cx - half <= hiX && b.floorY + 3.5 >= loY && -8.0 <= hiY) {
      localBasins.push(b);
    }
  }
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
export function evaluateCaveNormal(level, x, y, out = null) {
  const { segs, basins } = getPreparedGeometry(level);
  const eps = 0.08;
  const gx =
    evalPreparedSDF(segs, basins, level, x + eps, y) -
    evalPreparedSDF(segs, basins, level, x - eps, y);
  const gy =
    evalPreparedSDF(segs, basins, level, x, y + eps) -
    evalPreparedSDF(segs, basins, level, x, y - eps);
  const len = Math.sqrt(gx * gx + gy * gy) || 1;
  const nx = gx / len;
  const ny = gy / len;
  if (out) {
    out.nx = nx;
    out.ny = ny;
    return out;
  }
  return { nx, ny };
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

export const DIVER_PEER_COLLISION_RADIUS = 0.56;

/**
 * Resolves physical diver-to-diver collisions (used in Hardcore Mode so squadmates must
 * maintain authentic single-file cave trim and avoid bumping rigs in restrictions).
 * Always re-enforces cave wall SDF collision afterwards so a peer can never push a diver into rock.
 */
export function resolveDiverPeerCollisions(
  level,
  diver,
  peers,
  {
    diverRadius = DIVER_PEER_COLLISION_RADIUS,
    peerRadius = DIVER_PEER_COLLISION_RADIUS,
    restitution = 0.35,
    excludePeerId = '',
  } = {}
) {
  if (!diver || !Array.isArray(peers) || peers.length === 0) {
    return { collided: false, impactSpeed: 0, hitPeer: null, nx: 0, ny: 0, pushCount: 0 };
  }

  const minDist = Math.max(0.4, diverRadius + peerRadius);
  let collided = false;
  let maxImpactSpeed = 0;
  let hitPeer = null;
  let lastNx = 0;
  let lastNy = 0;
  let pushCount = 0;

  for (let i = 0; i < peers.length; i++) {
    const p = peers[i];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (p.alive === false || p.surfaced === true) continue;
    if (p.rescued === true || Boolean(p.rescuedBy)) continue;
    if (excludePeerId && p.id === excludePeerId) continue;
    // Allow AI Buddy APEX-2 to close in during active emergency gas-share or snag-cut rescue
    if (p.isAiBuddy && (p.mode === 'assist-gas' || p.mode === 'assist-snag')) continue;

    let dx = diver.x - p.x;
    let dy = diver.y - p.y;
    let dist = Math.hypot(dx, dy);
    if (dist >= minDist) continue;

    let nx;
    let ny;
    if (dist < 1e-4) {
      // Deterministic separation fallback if two divers overlap identically
      const idStr = String(p.id || i);
      const parity = (idStr.charCodeAt(0) || i) % 2 === 0 ? 1 : -1;
      nx = parity;
      ny = 0;
      dist = 0;
    } else {
      nx = dx / dist;
      ny = dy / dist;
    }

    const overlap = minDist - dist;
    const isLocalMutablePeer = Boolean(p.isAiBuddy);
    const diverShare = isLocalMutablePeer ? 0.5 : 0.65;

    diver.x += nx * overlap * diverShare;
    diver.y = Math.max(0.35, diver.y + ny * overlap * diverShare);
    if (isLocalMutablePeer) {
      p.x -= nx * overlap * (1 - diverShare);
      p.y = Math.max(0.35, p.y - ny * overlap * (1 - diverShare));
    }

    const pvx = Number.isFinite(p.vx) ? p.vx : 0;
    const pvy = Number.isFinite(p.vy) ? p.vy : 0;
    const relVn = (diver.vx - pvx) * nx + (diver.vy - pvy) * ny;
    if (relVn < 0) {
      const closing = -relVn;
      if (closing > maxImpactSpeed) {
        maxImpactSpeed = closing;
        hitPeer = p;
      }
      const impulse = Math.min(3.8, (1 + restitution) * closing * diverShare);
      diver.vx += nx * impulse;
      diver.vy += ny * impulse;
      if (isLocalMutablePeer) {
        const peerImpulse = Math.min(3.8, (1 + restitution) * closing * (1 - diverShare));
        p.vx = pvx - nx * peerImpulse;
        p.vy = pvy - ny * peerImpulse;
      }
    } else if (!hitPeer) {
      hitPeer = p;
    }

    if (isLocalMutablePeer && level) {
      resolveDiverCollision(level, p, 0.52);
    }

    collided = true;
    lastNx = nx;
    lastNy = ny;
    pushCount += 1;
  }

  // Re-enforce cave rock SDF bounds so peer pushes can never wedge the diver inside a wall
  if (collided && level) {
    resolveDiverCollision(level, diver, 0.52);
  }

  return {
    collided,
    impactSpeed: maxImpactSpeed,
    hitPeer,
    nx: lastNx,
    ny: lastNy,
    pushCount,
  };
}
