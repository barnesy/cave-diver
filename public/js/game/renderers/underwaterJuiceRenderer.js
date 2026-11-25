/**
 * Underwater Tactile "Juice", Pooled Bioluminescent Plankton Wake,
 * Hydro-Dash Buddy Slipstream Arcs & Dynamic Camera Framing (v195).
 *
 * Designed for zero per-frame allocations on mobile & desktop:
 * - Pre-baked offscreen radial glow stamps (no ctx.createRadialGradient in hot loops)
 * - In-place array compaction for wake motes and slipstream arcs
 */

const MAX_BIOLUM_WAKE = 64;
const MAX_SLIPSTREAMS = 6;

const _glowStampCache = new Map();

function _getGlowStamp(colorKey, innerRgba, midRgba) {
  if (typeof document === 'undefined') return null;
  const cached = _glowStampCache.get(colorKey);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 48;
  const gctx = c.getContext('2d');
  if (!gctx) return null;
  const g = gctx.createRadialGradient(24, 24, 2, 24, 24, 24);
  g.addColorStop(0, innerRgba);
  g.addColorStop(0.42, midRgba);
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  gctx.fillStyle = g;
  gctx.fillRect(0, 0, 48, 48);
  _glowStampCache.set(colorKey, c);
  return c;
}

/**
 * Apply a crisp directional camera kick + optional micro hit-stop (in seconds) on heavy impacts.
 * Values are clamped so camera motion stays punchy yet comfortable.
 */
export function triggerCameraKick(session, dirX = 0, dirY = 0, magnitude = 0.42, hitstopSec = 0) {
  if (!session) return;
  const mag = Math.hypot(dirX, dirY);
  const ux = mag > 1e-4 ? dirX / mag : 1;
  const uy = mag > 1e-4 ? dirY / mag : 0;
  const clamped = Math.max(0, Math.min(1.1, Number(magnitude) || 0));
  session.cameraKickX = Math.max(-1.15, Math.min(1.15, (session.cameraKickX || 0) + ux * clamped));
  session.cameraKickY = Math.max(-1.15, Math.min(1.15, (session.cameraKickY || 0) + uy * clamped));
  if (hitstopSec > 0) {
    session.hitstopSec = Math.max(session.hitstopSec || 0, Math.min(0.065, hitstopSec));
  }
}

/**
 * Exponentially decay directional camera kick back to neutral.
 */
export function decayCameraKick(session, dt) {
  if (!session || dt <= 0) return;
  const damp = Math.exp(-12.5 * dt);
  if (Math.abs(session.cameraKickX || 0) > 0.004) {
    session.cameraKickX *= damp;
  } else {
    session.cameraKickX = 0;
  }
  if (Math.abs(session.cameraKickY || 0) > 0.004) {
    session.cameraKickY *= damp;
  } else {
    session.cameraKickY = 0;
  }
}

/**
 * Push a Hydro-Dash Slipstream tether arc connecting the dashing diver and a nearby buddy.
 */
export function pushDashSlipstreamArc(session, fromX, fromY, toX, toY, buddyName = '') {
  if (!session) return null;
  if (!Array.isArray(session.dashSlipstreams)) session.dashSlipstreams = [];
  if (session.dashSlipstreams.length >= MAX_SLIPSTREAMS) {
    session.dashSlipstreams.shift();
  }
  const arc = {
    x1: fromX,
    y1: fromY,
    x2: toX,
    y2: toY,
    buddyName: String(buddyName || ''),
    life: 0.58,
    maxLife: 0.58,
  };
  session.dashSlipstreams.push(arc);
  return arc;
}

/**
 * Step zero-alloc bioluminescent plankton wake stirred up by brisk fin-kicks, DPV thrust,
 * and Hydro-Dashes in deep or dark underwater zones, plus active slipstream arcs.
 */
export function stepUnderwaterJuice(session, dt) {
  if (!session || dt <= 0) return;
  const diver = session.diver;
  const level = session.level;

  // 1. Decay slipstream tether arcs in place
  if (Array.isArray(session.dashSlipstreams) && session.dashSlipstreams.length > 0) {
    let w = 0;
    for (let i = 0; i < session.dashSlipstreams.length; i++) {
      const a = session.dashSlipstreams[i];
      a.life -= dt;
      if (a.life > 0) {
        session.dashSlipstreams[w++] = a;
      }
    }
    session.dashSlipstreams.length = w;
  }

  // 2. Step pooled bioluminescent plankton wake motes in place
  if (!Array.isArray(session.biolumWake)) session.biolumWake = [];
  const wake = session.biolumWake;
  let writeIdx = 0;
  for (let i = 0; i < wake.length; i++) {
    const p = wake[i];
    p.life -= dt;
    if (p.life <= 0) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.max(0, 1 - dt * 1.9);
    p.vy = p.vy * Math.max(0, 1 - dt * 1.6) - 0.08 * dt;
    wake[writeIdx++] = p;
  }
  wake.length = writeIdx;

  if (!diver || !session.diveState?.alive || session.surfaced) return;
  const depthM = Math.max(0, diver.y || 0);
  const inDarkWater =
    depthM >= 14 ||
    Boolean(level?.theme?.bioluminescent) ||
    Boolean(session.secretLair?.veilBreached);
  if (!inDarkWater) return;

  const spd = Math.hypot(diver.vx || 0, diver.vy || 0);
  const dashing = (session.secretLair?.dashTimerSec || 0) > 0.01;
  const dpvThrust = Boolean(session.dpv?.active && session.dpv?.thrusting);
  if (!dashing && !dpvThrust && spd < 1.35) return;

  const rate = dashing ? 56 : dpvThrust ? 26 : Math.min(18, (spd - 1.2) * 8.5);
  session._bioWakeAccum = (session._bioWakeAccum || 0) + dt * rate;
  const ang = diver.angle || 0;
  const tailX = diver.x - Math.cos(ang) * 0.95;
  const tailY = diver.y - Math.sin(ang) * 0.95;

  while (session._bioWakeAccum >= 1 && wake.length < MAX_BIOLUM_WAKE) {
    session._bioWakeAccum -= 1;
    const spread = (Math.random() - 0.5) * 0.85;
    const perpX = -Math.sin(ang);
    const perpY = Math.cos(ang);
    const tint = dashing ? 2 : dpvThrust ? 1 : (Math.random() < 0.3 ? 1 : 0);
    const maxLife = dashing ? 1.15 : 0.9 + Math.random() * 0.65;
    wake.push({
      x: tailX + perpX * spread * 0.55 + (Math.random() - 0.5) * 0.25,
      y: tailY + perpY * spread * 0.55 + (Math.random() - 0.5) * 0.25,
      vx: -(diver.vx || 0) * 0.24 + perpX * spread * 0.7,
      vy: -(diver.vy || 0) * 0.24 + perpY * spread * 0.7 - 0.12,
      r: dashing ? 0.13 + Math.random() * 0.09 : 0.07 + Math.random() * 0.07,
      life: maxLife,
      maxLife,
      tint,
    });
  }
  if (session._bioWakeAccum > 3) session._bioWakeAccum = 3;
}

/**
 * Compute smooth dynamic cavern framing zoom multiplier:
 * Slightly pulls camera out in wide open caverns (> 6.5m wall clearance) so grand vaults breathe,
 * while yielding smoothly to restriction zoom & boss arena zoom.
 */
export function computeCavernFramingZoom(spaceClearanceM, depthM, inBossArena, isPhotoMode, reducedMotion) {
  if (isPhotoMode || reducedMotion || inBossArena) return 1.0;
  if (!Number.isFinite(spaceClearanceM) || spaceClearanceM <= 6.2 || (depthM || 0) < 5.0) {
    return 1.0;
  }
  const t = Math.min(1, (spaceClearanceM - 6.2) / 7.5);
  return 1.0 - t * 0.09; // Smooth up to 9% wider vista in grand cathedrals
}

/**
 * Mixin methods attached to CaveRenderer.prototype.
 */
export const underwaterJuiceRendererMethods = {
  _drawBiolumPlanktonWake(ctx, wake, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale) {
    if (!Array.isArray(wake) || wake.length === 0) return;
    const cyanStamp = _getGlowStamp('bio-cyan', 'rgba(207, 250, 254, 0.95)', 'rgba(34, 211, 238, 0.36)');
    const mintStamp = _getGlowStamp('bio-mint', 'rgba(204, 251, 241, 0.95)', 'rgba(45, 212, 191, 0.34)');
    const dashStamp = _getGlowStamp('bio-dash', 'rgba(254, 249, 195, 0.96)', 'rgba(56, 189, 248, 0.45)');

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < wake.length; i++) {
      const p = wake[i];
      if (p.x < visX0 || p.x > visX1 || p.y < visY0 || p.y > visY1) continue;
      const frac = Math.max(0, Math.min(1, p.life / (p.maxLife || 1)));
      const alpha = frac < 0.2 ? frac * 5 : Math.pow(frac, 0.75);
      const sx = toScreenX(p.x);
      const sy = toScreenY(p.y);
      const rPx = Math.max(2.2, p.r * scale * (0.65 + frac * 0.55));
      const stamp = p.tint === 2 ? dashStamp : p.tint === 1 ? mintStamp : cyanStamp;
      ctx.globalAlpha = Math.min(0.85, alpha * (p.tint === 2 ? 0.85 : 0.62));
      if (stamp) {
        const d = rPx * 4.4;
        ctx.drawImage(stamp, sx - d * 0.5, sy - d * 0.5, d, d);
      } else {
        ctx.fillStyle = p.tint === 2 ? '#67e8f9' : p.tint === 1 ? '#5eead4' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(sx, sy, rPx, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  },

  _drawDashSlipstreamArcs(ctx, arcs, toScreenX, toScreenY, scale, timeSec) {
    if (!Array.isArray(arcs) || arcs.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < arcs.length; i++) {
      const a = arcs[i];
      const frac = Math.max(0, Math.min(1, a.life / (a.maxLife || 0.58)));
      const x1 = toScreenX(a.x1);
      const y1 = toScreenY(a.y1);
      const x2 = toScreenX(a.x2);
      const y2 = toScreenY(a.y2);
      const mx = (x1 + x2) * 0.5;
      const my = (y1 + y2) * 0.5 - Math.sin(timeSec * 14 + i) * 0.35 * scale;

      ctx.globalAlpha = frac * 0.72;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = Math.max(2.6, 0.16 * scale * frac);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx, my, x2, y2);
      ctx.stroke();

      ctx.globalAlpha = frac * 0.92;
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = Math.max(1.2, 0.065 * scale * frac);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx, my, x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  },

  /**
   * Cenote Angelita's iconic glowing 30m Hydrogen Sulfide (H2S) Cloud River & sunken jungle tree silhouettes (v196).
   */
  _drawH2sCloudRiver(ctx, cw, ch, h2s, toScreenX, toScreenY, scale, timeSec) {
    if (!h2s || !Number.isFinite(h2s.y)) return;
    const cloudY = toScreenY(h2s.y);
    const bandH = (h2s.thickness || 3.8) * scale;
    if (cloudY + bandH * 2 < 0 || cloudY - bandH * 2 > ch) return;

    ctx.save();
    // 1. Eerie sunken mahogany tree trunks & gnarled branches poking through the misty cloud bank
    if (Array.isArray(h2s.trees)) {
      ctx.strokeStyle = 'rgba(28, 37, 24, 0.86)';
      ctx.lineCap = 'round';
      for (let i = 0; i < h2s.trees.length; i++) {
        const tr = h2s.trees[i];
        const tx = toScreenX(tr.x);
        const baseY = toScreenY(tr.y + 1.8);
        const topY = toScreenY(tr.y - (tr.h || 6.0));
        const leanPx = (tr.lean || 0) * (tr.h || 6.0) * scale;
        if (tx < -120 || tx > cw + 120) continue;
        ctx.lineWidth = Math.max(3.5, 0.34 * scale);
        ctx.beginPath();
        ctx.moveTo(tx, baseY);
        ctx.quadraticCurveTo(tx + leanPx * 0.5, (baseY + topY) * 0.5, tx + leanPx, topY);
        ctx.stroke();
        // Two gnarled skeletal branches
        ctx.lineWidth = Math.max(2.0, 0.16 * scale);
        const midY = baseY * 0.38 + topY * 0.62;
        const midX = tx + leanPx * 0.62;
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(midX - 1.7 * scale, midY - 1.3 * scale);
        ctx.moveTo(midX + leanPx * 0.15, midY - 0.8 * scale);
        ctx.lineTo(midX + 1.9 * scale, midY - 2.1 * scale);
        ctx.stroke();
      }
    }

    // 2. Multi-ribbon glowing golden-chartreuse H2S sulfurous mist river
    const x0 = Math.max(0, toScreenX(h2s.xMin ?? -20));
    const x1 = Math.min(cw, toScreenX(h2s.xMax ?? 140));
    if (x1 > x0) {
      const grad = ctx.createLinearGradient(0, cloudY - bandH * 0.9, 0, cloudY + bandH * 1.05);
      grad.addColorStop(0, 'rgba(163, 230, 53, 0)');
      grad.addColorStop(0.28, 'rgba(190, 242, 100, 0.24)');
      grad.addColorStop(0.55, 'rgba(163, 230, 53, 0.44)');
      grad.addColorStop(0.82, 'rgba(101, 163, 13, 0.28)');
      grad.addColorStop(1, 'rgba(54, 83, 20, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x0, cloudY - bandH * 0.9, x1 - x0, bandH * 1.95);

      // Rolling sulfurous cloud billows drifting gently along the river top
      const billowStamp = _getGlowStamp('h2s-cloud', 'rgba(217, 249, 157, 0.42)', 'rgba(163, 230, 53, 0.16)');
      const count = 14;
      const span = Math.max(10, (h2s.xMax ?? 118) - (h2s.xMin ?? -12));
      for (let i = 0; i < count; i++) {
        const wx = (h2s.xMin ?? -12) + ((i + 0.5) / count) * span + Math.sin(timeSec * 0.35 + i * 1.7) * 2.2;
        const wy = h2s.y + Math.cos(timeSec * 0.45 + i * 2.1) * 0.48;
        const bx = toScreenX(wx);
        const by = toScreenY(wy);
        if (bx < -160 || bx > cw + 160) continue;
        const rw = (3.4 + (i % 3) * 1.1) * scale;
        const rh = (1.35 + (i % 2) * 0.45) * scale;
        if (billowStamp) {
          ctx.drawImage(billowStamp, bx - rw, by - rh, rw * 2, rh * 2);
        } else {
          ctx.fillStyle = 'rgba(190, 242, 100, 0.22)';
          ctx.beginPath();
          ctx.ellipse(bx, by, rw * 0.7, rh * 0.7, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  },
};
