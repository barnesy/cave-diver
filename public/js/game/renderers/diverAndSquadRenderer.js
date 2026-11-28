/**
 * Diver, Squad Rescue, Recovery Target, Sonar/Flash & Peer Telemetry Renderer Mixin (v261).
 * Extracted from CaveRenderer to keep renderer.js cleanly modularized (<4000 lines).
 */
import { createDiverBody } from '../diverBody.js';
import { getScubaSignalById } from '../diveSignals.js';
import { resolveDiverLiveryPalette } from '../rigLivery.js';
import {
  drawStyledDiverRig,
  drawArticulatedDiverLeg,
  drawDiverArmAndTorch,
} from '../artSprites.js';

export const diverAndSquadRendererMethods = {
  _drawBuddyRescueTethers(ctx, diver, peerList, toScreenX, toScreenY, scale, timeSec, airShareBeams = null) {
    if (!Array.isArray(peerList) || peerList.length === 0) return;
    ctx.save();
    const allDivers = [
      { id: diver.id || '__self__', x: diver.x, y: diver.y, name: diver.name || 'You', alive: true, rescueTargetId: diver.rescueTargetId || '' },
      ...peerList,
    ];

    // 1. SOS distress beacon rings around untowed downed buddies
    for (let i = 0; i < peerList.length; i++) {
      const p = peerList[i];
      if (!p || p.alive !== false || p.rescued) continue;
      const sx = toScreenX(p.x);
      const sy = toScreenY(p.y);
      const pulse = 0.55 + 0.45 * Math.sin(timeSec * 5.2);
      const r = (0.95 + pulse * 0.45) * scale;
      ctx.strokeStyle = p.rescuedBy ? 'rgba(74, 222, 128, 0.78)' : 'rgba(245, 158, 11, 0.85)';
      ctx.lineWidth = Math.max(1.8, 0.065 * scale);
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `800 ${Math.max(9, Math.round(0.32 * scale))}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = p.rescuedBy ? '#86efac' : '#fde68a';
      ctx.fillText(p.rescuedBy ? '🛟 TOWING' : 'SOS · RESCUE', sx, sy - r - 0.25 * scale);
    }

    // 2. Braided catenary umbilical tow line between rescuer and towed teammate
    // 1b. Hardcore AI Wingman Leadership / Issue Beacon & Guided Pro Guide Halo (v157/v158)
    for (let i = 0; i < peerList.length; i++) {
      const p = peerList[i];
      if (!p || p.alive === false || p.surfaced) continue;
      if (!p.issue && !p.separated) {
        if (p.isAiBuddy && (p.condition === 'SAFETY GUARD' || p.condition === 'DECO PACE')) {
          const sx = toScreenX(p.x);
          const sy = toScreenY(p.y);
          const pulse = 0.55 + 0.45 * Math.sin(timeSec * 4.2 + i);
          const r = (1.02 + pulse * 0.16) * scale;
          const isGuard = p.condition === 'SAFETY GUARD';
          ctx.strokeStyle = isGuard ? 'rgba(52, 211, 153, 0.78)' : 'rgba(56, 189, 248, 0.65)';
          ctx.lineWidth = Math.max(1.5, 0.05 * scale);
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = `800 ${Math.max(9, Math.round(0.28 * scale))}px ui-monospace, monospace`;
          ctx.textAlign = 'center';
          ctx.fillStyle = isGuard ? '#a7f3d0' : '#bae6fd';
          ctx.fillText(isGuard ? '🛡️ SAFETY GUARD' : '🛡️ DECO PACE', sx, sy - r - 0.26 * scale);
        }
        continue;
      }
      const sx = toScreenX(p.x);
      const sy = toScreenY(p.y);
      const pulse = 0.55 + 0.45 * Math.sin(timeSec * 5.8 + i);
      const r = (1.05 + pulse * 0.25) * scale;
      const isCrit = p.issue && (p.issue.kind === 'snagged' || p.issue.kind === 'low-gas' || (p.issue.countdownSec || 99) < 15);
      ctx.strokeStyle = isCrit ? 'rgba(248, 113, 113, 0.85)' : 'rgba(251, 191, 36, 0.85)';
      ctx.lineWidth = Math.max(1.8, 0.06 * scale);
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const prog = Math.max(0, Math.min(1, Number(p.issue?.progress) || 0));
      if (prog > 0.02) {
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = Math.max(2.6, 0.085 * scale);
        ctx.beginPath();
        ctx.arc(sx, sy, r + 0.14 * scale, -Math.PI * 0.5, -Math.PI * 0.5 + prog * Math.PI * 2);
        ctx.stroke();
      }
      ctx.font = `800 ${Math.max(9, Math.round(0.31 * scale))}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = isCrit ? '#fecaca' : '#fde68a';
      const baseLbl = p.issue ? (p.issue.hudLabel || p.issue.condition) : '🧭 SEPARATED · LEAD';
      const pctSuffix = p.issue && prog > 0.02 ? ` ${Math.round(prog * 100)}%` : '';
      ctx.fillText(`${baseLbl}${pctSuffix}`, sx, sy - r - 0.3 * scale);
    }
    for (let i = 0; i < allDivers.length; i++) {
      const rescuer = allDivers[i];
      if (!rescuer?.rescueTargetId) continue;
      const target = peerList.find((p) => p && p.id === rescuer.rescueTargetId);
      const tPos = target || (rescuer !== allDivers[0] && diver.rescuedBy === rescuer.id ? diver : null);
      if (!tPos) continue;
      const x1 = toScreenX(rescuer.x);
      const y1 = toScreenY(rescuer.y);
      const x2 = toScreenX(tPos.x);
      const y2 = toScreenY(tPos.y);
      const mx = (x1 + x2) * 0.5;
      const my = (y1 + y2) * 0.5 + (0.28 + 0.09 * Math.sin(timeSec * 4.2)) * scale;

      ctx.strokeStyle = 'rgba(250, 204, 21, 0.28)';
      ctx.lineWidth = Math.max(4.5, 0.16 * scale);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx, my, x2, y2);
      ctx.stroke();

      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = Math.max(2, 0.075 * scale);
      ctx.setLineDash([7, 4]);
      ctx.lineDashOffset = -timeSec * 18;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx, my, x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;

      // Carabiner clip rings at both diver harness attachment points
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(x1, y1, Math.max(2.6, 0.08 * scale), 0, Math.PI * 2);
      ctx.arc(x2, y2, Math.max(2.6, 0.08 * scale), 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Active Air-Share 2m Braided Yellow Primary-Donate Long Hose (upgraded v151)
    if (Array.isArray(airShareBeams) && airShareBeams.length > 0) {
      for (let i = 0; i < airShareBeams.length; i++) {
        const b = airShareBeams[i];
        if (!b || b.timer <= 0) continue;
        const peer = peerList.find((p) => p && (p.id === b.peerId || p.name === b.peerName));
        if (!peer) continue;
        const donor = b.fromSelf ? diver : peer;
        const recv = b.fromSelf ? peer : diver;
        const x1 = toScreenX(donor.x);
        const y1 = toScreenY(donor.y);
        const x2 = toScreenX(recv.x);
        const y2 = toScreenY(recv.y);
        const alpha = Math.min(1, b.timer / 0.55) * Math.min(1, ((b.duration || 2.6) - b.timer) / 0.18 + 0.25);
        const mx = (x1 + x2) * 0.5;
        const my = (y1 + y2) * 0.5 + 0.42 * scale + Math.sin(timeSec * 3.6 + i) * 0.06 * scale;

        // Soft underwater glow halo around high-vis safety-yellow primary-donate hose
        ctx.strokeStyle = `rgba(250, 204, 21, ${(0.24 * alpha).toFixed(3)})`;
        ctx.lineWidth = Math.max(6, 0.22 * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(mx, my, x2, y2);
        ctx.stroke();

        // Dark rubber outer jacket border
        ctx.strokeStyle = `rgba(15, 23, 42, ${(0.88 * alpha).toFixed(3)})`;
        ctx.lineWidth = Math.max(3.6, 0.13 * scale);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(mx, my, x2, y2);
        ctx.stroke();

        // High-visibility safety-yellow braided long-hose core
        ctx.strokeStyle = `rgba(250, 204, 21, ${(0.95 * alpha).toFixed(3)})`;
        ctx.lineWidth = Math.max(2.1, 0.075 * scale);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(mx, my, x2, y2);
        ctx.stroke();

        // Subtle braided weave dash highlight along the hose
        ctx.save();
        ctx.setLineDash([Math.max(3, 0.12 * scale), Math.max(3, 0.12 * scale)]);
        ctx.strokeStyle = `rgba(254, 249, 195, ${(0.75 * alpha).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.1, 0.035 * scale);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(mx, my, x2, y2);
        ctx.stroke();
        ctx.restore();

        // Brass 1st-stage swivel fitting (donor) & yellow 2nd-stage octo housing (receiver)
        ctx.fillStyle = `rgba(217, 119, 6, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x1, y1, Math.max(2.6, 0.095 * scale), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(250, 204, 21, ${alpha.toFixed(3)})`;
        ctx.strokeStyle = `rgba(15, 23, 42, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x2, y2, Math.max(3.0, 0.11 * scale), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Flowing pressurized gas pulses + twin synced regulator exhaust bubble wisps
        for (let k = 0; k < 4; k++) {
          const u = ((timeSec * 1.45 + k * 0.25) % 1);
          const inv = 1 - u;
          const px = inv * inv * x1 + 2 * inv * u * mx + u * u * x2;
          const py = inv * inv * y1 + 2 * inv * u * my + u * u * y2;
          ctx.fillStyle = `rgba(240, 249, 255, ${(0.92 * alpha).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(px, py, Math.max(2.1, 0.075 * scale), 0, Math.PI * 2);
          ctx.fill();
        }
        for (let p = 0; p < 3; p++) {
          const rise = ((timeSec * 1.6 + p * 0.33) % 1);
          const rBub = Math.max(1.4, (0.045 + rise * 0.03) * scale);
          const bAlpha = (1 - rise) * 0.65 * alpha;
          ctx.fillStyle = `rgba(224, 242, 254, ${bAlpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x2 + Math.sin(timeSec * 4 + p) * 0.1 * scale, y2 - rise * 0.65 * scale, rBub, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.font = `800 ${Math.max(10, Math.round(0.34 * scale))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(254, 249, 195, ${alpha.toFixed(3)})`;
        ctx.fillText(`🟡 LONG-HOSE +${b.amountBar}b`, mx, my - 0.32 * scale);
      }
    }
    ctx.restore();
  },

  _drawBuddyLocatePing(ctx, diver, buddyPing, toScreenX, toScreenY, scale, timeSec, cw, ch) {
    if (!buddyPing || buddyPing.timer <= 0) return;
    const dur = Math.max(0.5, buddyPing.duration || 4.6);
    const fade = Math.min(1, buddyPing.timer / 0.85);
    const dx = toScreenX(diver.x);
    const dy = toScreenY(diver.y);
    const bx = toScreenX(buddyPing.x);
    const by = toScreenY(buddyPing.y);
    const distM = Math.round(Math.hypot(buddyPing.x - diver.x, buddyPing.y - diver.y));

    ctx.save();
    // 1. Acoustic bearing line from self diver toward pinged buddy (visible through walls & silt)
    const grad = ctx.createLinearGradient(dx, dy, bx, by);
    grad.addColorStop(0, `rgba(56, 189, 248, ${(0.12 * fade).toFixed(3)})`);
    grad.addColorStop(0.55, `rgba(56, 189, 248, ${(0.52 * fade).toFixed(3)})`);
    grad.addColorStop(1, `rgba(251, 191, 36, ${(0.88 * fade).toFixed(3)})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(1.8, 0.065 * scale);
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -timeSec * 34;
    ctx.beginPath();
    ctx.moveTo(dx, dy);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // 2. Expanding concentric sonar target rings centered on buddy
    for (let rIdx = 0; rIdx < 2; rIdx++) {
      const phase = ((dur - buddyPing.timer) * 1.15 + rIdx * 0.5) % 1;
      const rad = (0.7 + phase * 2.8) * scale;
      const ringAlpha = (1 - phase) * 0.82 * fade;
      ctx.strokeStyle = `rgba(251, 191, 36, ${ringAlpha.toFixed(3)})`;
      ctx.lineWidth = Math.max(1.8, 0.07 * scale);
      ctx.beginPath();
      ctx.arc(bx, by, rad, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3. Floating clamped locator badge (stays onscreen at edge when buddy is far away)
    const padX = Math.max(66, cw * 0.08);
    const padY = Math.max(92, ch * 0.14);
    const lx = Math.max(padX, Math.min(cw - padX, bx));
    const ly = Math.max(padY, Math.min(ch - padY, by - 1.35 * scale));
    const label = `📡 ${buddyPing.targetName || 'Buddy'} · ${distM}m`;
    ctx.font = `800 ${Math.max(11, Math.round(0.36 * scale))}px ui-monospace, monospace`;
    const tw = ctx.measureText(label).width;
    const pw = tw + 18;
    const ph = Math.max(22, Math.round(0.68 * scale));
    ctx.fillStyle = `rgba(8, 20, 36, ${(0.92 * fade).toFixed(3)})`;
    ctx.strokeStyle = `rgba(251, 191, 36, ${(0.88 * fade).toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(lx - pw / 2, ly - ph / 2, pw, ph, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = `rgba(254, 243, 199, ${fade.toFixed(3)})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, lx, ly + 0.5);
    ctx.restore();
  },

  _drawRecoveryTarget(ctx, diver, peerList, bodyRecovered, carryingBody, toScreenX, toScreenY, scale, timeSec) {
    const rt = this.level.recoveryTarget;
    if (!rt) return;
    ctx.save();

    if (!bodyRecovered) {
      const sx = toScreenX(rt.x);
      const sy = toScreenY(rt.y);
      if (rt.kind === 'probe') {
        // Titanium Katla Bathysphere Seismic Core: beacon halo, tripod stabilizer, pressure sphere & viewport
        const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3.6);
        const halo = ctx.createRadialGradient(sx, sy, 0.2 * scale, sx, sy, (2.2 + pulse * 0.65) * scale);
        halo.addColorStop(0, 'rgba(45, 212, 191, 0.34)');
        halo.addColorStop(0.55, 'rgba(56, 189, 248, 0.14)');
        halo.addColorStop(1, 'rgba(45, 212, 191, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(sx, sy, (2.2 + pulse * 0.65) * scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(sx, sy);
        // Anchoring skid legs + vertical stabilizing fins
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = Math.max(1.5, 0.08 * scale);
        ctx.beginPath();
        ctx.moveTo(-0.55 * scale, 0.65 * scale);
        ctx.lineTo(0, 0.12 * scale);
        ctx.lineTo(0.55 * scale, 0.65 * scale);
        ctx.moveTo(-0.75 * scale, 0.65 * scale);
        ctx.lineTo(0.75 * scale, 0.65 * scale);
        ctx.stroke();

        // Titanium pressure hull
        const hullGrad = ctx.createRadialGradient(-0.18 * scale, -0.18 * scale, 0.08 * scale, 0, 0, 0.62 * scale);
        hullGrad.addColorStop(0, '#e2e8f0');
        hullGrad.addColorStop(0.5, '#64748b');
        hullGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = hullGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 0.58 * scale, 0, Math.PI * 2);
        ctx.fill();

        // Equatorial clamp ring & tow lug
        ctx.strokeStyle = '#2dd4bf';
        ctx.lineWidth = Math.max(1.2, 0.06 * scale);
        ctx.beginPath();
        ctx.ellipse(0, 0, 0.58 * scale, 0.17 * scale, -0.15, 0, Math.PI * 2);
        ctx.stroke();

        // Glowing sapphire sensor viewport + top transponder mast
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0.16 * scale, -0.04 * scale, 0.2 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(94, 234, 212, ${(0.72 + pulse * 0.28).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(0.16 * scale, -0.04 * scale, 0.14 * scale, 0, Math.PI * 2);
        ctx.fill();

        // Mast + strobe
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = Math.max(1, 0.045 * scale);
        ctx.beginPath();
        ctx.moveTo(0, -0.58 * scale);
        ctx.lineTo(0, -1.08 * scale);
        ctx.stroke();
        const strobe = Math.pow(0.5 + 0.5 * Math.sin(timeSec * 6.0), 3);
        ctx.fillStyle = `rgba(251, 146, 60, ${(0.35 + strobe * 0.65).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(0, -1.1 * scale, (0.09 + strobe * 0.09) * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const dist = Math.hypot(diver.x - rt.x, diver.y - rt.y);
        if (dist < 26) {
          ctx.font = `800 ${Math.max(10, Math.round(0.32 * scale))}px ui-monospace, monospace`;
          ctx.textAlign = 'center';
          ctx.fillStyle = '#5eead4';
          ctx.fillText(`🛰 ${rt.name.toUpperCase()} (${Math.round(rt.y)}m)`, sx, sy - 1.45 * scale);
        }
        ctx.restore();
        return;
      }

      // Resting fallen cave diver silhouette on rocky cavern shelf + blinking amber locator strobe
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-0.18);
      // Fins + legs + drysuit torso + twin tanks
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-0.82 * scale, -0.14 * scale, 1.35 * scale, 0.28 * scale);
      ctx.fillStyle = '#334155';
      ctx.fillRect(-0.45 * scale, -0.26 * scale, 0.78 * scale, 0.16 * scale);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(-1.02 * scale, -0.16 * scale, 0.28 * scale, 0.1 * scale);
      ctx.fillRect(-1.02 * scale, 0.05 * scale, 0.28 * scale, 0.1 * scale);
      // Helmet & visor
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0.58 * scale, -0.02 * scale, 0.18 * scale, 0, Math.PI * 2);
      ctx.fill();
      // Emergency wrist locator strobe
      const strobe = Math.pow(0.5 + 0.5 * Math.sin(timeSec * 5.2), 3);
      ctx.fillStyle = `rgba(251, 146, 60, ${(0.35 + strobe * 0.65).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(0.2 * scale, -0.24 * scale, (0.08 + strobe * 0.08) * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const dist = Math.hypot(diver.x - rt.x, diver.y - rt.y);
      if (dist < 22) {
        ctx.font = `800 ${Math.max(10, Math.round(0.32 * scale))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fdba74';
        ctx.fillText(`🛟 ${rt.name.toUpperCase()} (${Math.round(rt.y)}m)`, sx, sy - 0.75 * scale);
      }
      ctx.restore();
      return;
    }

    // Recovered target towed gently behind carrier diver (local player or co-op buddy)
    let carrier = carryingBody ? diver : null;
    if (!carrier && Array.isArray(peerList)) {
      carrier = peerList.find((p) => p && p.carryingBody);
    }
    if (carrier) {
      const ang = carrier.angle || 0;
      const towDist = rt.kind === 'probe' ? 1.8 : 1.65;
      const sway = Math.sin(timeSec * 2.2) * 0.12;
      const bx = carrier.x - Math.cos(ang) * towDist - Math.sin(ang) * sway;
      const by = carrier.y - Math.sin(ang) * towDist + Math.cos(ang) * sway;
      const cx = toScreenX(carrier.x);
      const cy = toScreenY(carrier.y);
      const tx = toScreenX(bx);
      const ty = toScreenY(by);

      // Catenary braided recovery tow bridle + stainless shackle carabiners
      const midTowX = (cx + tx) * 0.5;
      const midTowY = (cy + ty) * 0.5 + 0.22 * scale + Math.sin(timeSec * 3.1) * 0.05 * scale;
      ctx.strokeStyle = rt.kind === 'probe' ? 'rgba(94, 234, 212, 0.92)' : 'rgba(251, 191, 36, 0.92)';
      ctx.lineWidth = Math.max(1.6, 0.06 * scale);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(midTowX, midTowY, tx, ty);
      ctx.stroke();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = Math.max(1.2, 0.048 * scale);
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.8, 0.075 * scale), 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tx, ty, Math.max(1.8, 0.075 * scale), 0, Math.PI * 2);
      ctx.stroke();

      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(ang);
      if (rt.kind === 'probe') {
        const pulse = 0.5 + 0.5 * Math.sin(timeSec * 5.0);
        const g = ctx.createRadialGradient(-0.12 * scale, -0.12 * scale, 0.05 * scale, 0, 0, 0.44 * scale);
        g.addColorStop(0, '#e2e8f0');
        g.addColorStop(0.55, '#64748b');
        g.addColorStop(1, '#1e293b');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 0.42 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2dd4bf';
        ctx.lineWidth = Math.max(1.2, 0.05 * scale);
        ctx.stroke();
        ctx.fillStyle = `rgba(94, 234, 212, ${(0.7 + pulse * 0.3).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(0.14 * scale, 0, 0.12 * scale, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-0.62 * scale, -0.14 * scale, 1.1 * scale, 0.28 * scale);
        ctx.fillStyle = '#475569';
        ctx.fillRect(-0.35 * scale, -0.25 * scale, 0.65 * scale, 0.14 * scale);
        ctx.fillStyle = '#eab308';
        ctx.fillRect(-0.82 * scale, -0.14 * scale, 0.24 * scale, 0.24 * scale);
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(0.48 * scale, 0, 0.16 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  },

  _drawLimbSegment(ctx, x1, y1, x2, y2, width, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  },

  _drawArticulatedLeg(ctx, pelvis, leg, toScreenX, toScreenY, scale, isPeer, isBackLeg, liverySuit = null, timeSec = 0) {
    drawArticulatedDiverLeg(
      ctx,
      toScreenX(pelvis.x),
      toScreenY(pelvis.y),
      toScreenX(leg.knee.x),
      toScreenY(leg.knee.y),
      toScreenX(leg.ankle.x),
      toScreenY(leg.ankle.y),
      toScreenX(leg.finTip.x),
      toScreenY(leg.finTip.y),
      leg.finOpen ?? 0.65,
      scale,
      isPeer,
      isBackLeg,
      liverySuit,
      timeSec
    );
  },

  _drawCameraFlash(ctx, flash, toScreenX, toScreenY, scale) {
    if (!flash || flash.ageSec >= flash.durationSec) return;
    const t = Math.max(0, Math.min(1, flash.ageSec / flash.durationSec));
    const sx = toScreenX(flash.x);
    const sy = toScreenY(flash.y);
    const ang = Number.isFinite(flash.angle) ? flash.angle : 0;

    ctx.save();
    // 1. Intense twin-strobe flash burst cone (fades sharply in first 0.36s)
    if (t < 0.52) {
      const flashAlpha = Math.pow(1 - t / 0.52, 1.8);
      const rPx = (10.5 + t * 5.0) * scale;
      ctx.globalCompositeOperation = 'screen';
      const grad = ctx.createRadialGradient(sx, sy, 0.2 * scale, sx, sy, rPx);
      grad.addColorStop(0, `rgba(255, 255, 255, ${(0.92 * flashAlpha).toFixed(3)})`);
      grad.addColorStop(0.32, `rgba(224, 242, 254, ${(0.52 * flashAlpha).toFixed(3)})`);
      grad.addColorStop(0.75, `rgba(56, 189, 248, ${(0.18 * flashAlpha).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(14, 165, 233, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, rPx, ang - 0.86, ang + 0.86);
      ctx.closePath();
      ctx.fill();
    }

    // 2. Crisp viewfinder focus brackets around the captured subject
    if (flash.subject && Number.isFinite(flash.targetX) && Number.isFinite(flash.targetY)) {
      const tx = toScreenX(flash.targetX);
      const ty = toScreenY(flash.targetY);
      const boxAlpha = t < 0.2 ? t / 0.2 : Math.max(0, 1 - (t - 0.2) / 0.8);
      const half = Math.max(18, 1.15 * scale) * (1.15 - 0.15 * Math.min(1, t * 3));
      const corner = Math.max(6, half * 0.36);
      const col = flash.isNewInGuide ? '#fde047' : '#38bdf8';

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = boxAlpha;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      // Top-left
      ctx.moveTo(tx - half, ty - half + corner);
      ctx.lineTo(tx - half, ty - half);
      ctx.lineTo(tx - half + corner, ty - half);
      // Top-right
      ctx.moveTo(tx + half - corner, ty - half);
      ctx.lineTo(tx + half, ty - half);
      ctx.lineTo(tx + half, ty - half + corner);
      // Bottom-right
      ctx.moveTo(tx + half, ty + half - corner);
      ctx.lineTo(tx + half, ty + half);
      ctx.lineTo(tx + half - corner, ty + half);
      // Bottom-left
      ctx.moveTo(tx - half + corner, ty + half);
      ctx.lineTo(tx - half, ty + half);
      ctx.lineTo(tx - half, ty + half - corner);
      ctx.stroke();

      const starStr = '★'.repeat(Math.max(1, Math.min(3, flash.stars || 1)));
      const tag = flash.isNewInGuide ? `NEW · ${starStr}` : starStr;
      ctx.font = 'bold 11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = col;
      ctx.fillText(tag, tx, ty - half - 4);
    }
    ctx.restore();
  },

  _drawSonarPulse(ctx, pulse, toScreenX, toScreenY, scale, timeSec) {
    if (!pulse || pulse.ageSec >= pulse.durationSec) return;
    const sweepDur = 1.45;
    const sweepProgress = Math.min(1, pulse.ageSec / sweepDur);
    const waveRadiusM = sweepProgress * (pulse.maxRadiusM || 28);
    const overallFade = Math.max(0, 1 - pulse.ageSec / pulse.durationSec);
    const cx = toScreenX(pulse.x);
    const cy = toScreenY(pulse.y);

    ctx.save();
    // Expanding translucent high-tech hydrophone wavefront + radial acoustic wash + trailing echo ring
    if (sweepProgress < 1) {
      const waveAlpha = (1 - sweepProgress) * 0.78;
      const radPx = Math.max(2, waveRadiusM * scale);
      const innerPx = Math.max(0, radPx * 0.78);
      const wash = ctx.createRadialGradient(cx, cy, innerPx, cx, cy, radPx);
      wash.addColorStop(0, 'rgba(34, 211, 238, 0)');
      wash.addColorStop(0.82, `rgba(34, 211, 238, ${(waveAlpha * 0.14).toFixed(3)})`);
      wash.addColorStop(1, `rgba(103, 232, 249, ${(waveAlpha * 0.28).toFixed(3)})`);
      ctx.fillStyle = wash;
      ctx.beginPath();
      ctx.arc(cx, cy, radPx, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(103, 232, 249, ${waveAlpha.toFixed(3)})`;
      ctx.lineWidth = Math.max(2.2, 0.14 * scale);
      ctx.beginPath();
      ctx.arc(cx, cy, radPx, 0, Math.PI * 2);
      ctx.stroke();

      if (waveRadiusM > 2.2) {
        ctx.strokeStyle = `rgba(45, 212, 191, ${(waveAlpha * 0.48).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.2, 0.065 * scale);
        ctx.setLineDash([Math.max(6, scale * 0.35), Math.max(4, scale * 0.22)]);
        ctx.beginPath();
        ctx.arc(cx, cy, (waveRadiusM - 1.8) * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Rock-wall contour echo dots illuminated as the sonar ring sweeps past
    const hits = pulse.wallHits || [];
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      if (h.dist > waveRadiusM) continue;
      const hitAge = pulse.ageSec - (h.dist / (pulse.maxRadiusM || 28)) * sweepDur;
      const a = Math.max(0, Math.min(1, 1 - hitAge / 1.45)) * overallFade;
      if (a <= 0.03) continue;
      const hx = toScreenX(h.x);
      const hy = toScreenY(h.y);
      ctx.fillStyle = `rgba(103, 232, 249, ${(a * 0.85).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(hx, hy, Math.max(2.2, 0.14 * scale), 0, Math.PI * 2);
      ctx.fill();
      if (i > 0) {
        const prev = hits[i - 1];
        if (prev.dist <= waveRadiusM && Math.hypot(h.x - prev.x, h.y - prev.y) < 5.5) {
          ctx.strokeStyle = `rgba(45, 212, 191, ${(a * 0.48).toFixed(3)})`;
          ctx.lineWidth = Math.max(1.2, 0.065 * scale);
          ctx.beginPath();
          ctx.moveTo(toScreenX(prev.x), toScreenY(prev.y));
          ctx.lineTo(hx, hy);
          ctx.stroke();
        }
      }
    }

    // High-contrast silt-piercing sonar contacts: relics, stage caches, markers, recovery, AND reactive hazards (v142)
    const contacts = pulse.contacts || [];
    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];
      if (c.dist > waveRadiusM) continue;
      const pingAge = pulse.ageSec - (c.dist / (pulse.maxRadiusM || 28)) * sweepDur;
      const a = Math.max(0, Math.min(1, 1 - pingAge / 2.65)) * overallFade;
      if (a <= 0.04) continue;
      const px = toScreenX(c.x);
      const py = toScreenY(c.y);

      if (c.kind === 'shifting-hatch') {
        const open = Math.max(0, Math.min(1, c.hatchRef?.openness ?? 1));
        const col = open >= 0.55 ? '74, 222, 128' : open >= 0.3 ? '251, 191, 36' : '248, 113, 113';
        const statusTxt = open >= 0.55 ? 'OPEN' : open >= 0.3 ? 'CLOSING' : 'SLAM!';
        const hr = Math.max(0.85, (c.radius || 2.4) * 0.55) * scale;
        ctx.strokeStyle = `rgba(${col}, ${(a * 0.95).toFixed(3)})`;
        ctx.lineWidth = Math.max(2, 0.1 * scale);
        ctx.beginPath();
        ctx.arc(px, py, hr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = `800 ${Math.max(9, Math.round(scale * 0.34))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(${col}, ${a.toFixed(3)})`;
        ctx.fillText(`🚪 ${statusTxt}`, px, py - hr - Math.max(7, scale * 0.28));
        continue;
      }

      if (c.kind === 'percolation') {
        const halfPx = (c.halfWidth || 3.4) * scale;
        const ceilPy = toScreenY(c.ceilY ?? c.y);
        ctx.strokeStyle = `rgba(251, 191, 36, ${(a * 0.9).toFixed(3)})`;
        ctx.lineWidth = Math.max(2, 0.1 * scale);
        ctx.setLineDash([Math.max(5, scale * 0.3), Math.max(3, scale * 0.18)]);
        ctx.beginPath();
        ctx.moveTo(px - halfPx, ceilPy);
        ctx.lineTo(px + halfPx, ceilPy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `800 ${Math.max(9, Math.round(scale * 0.32))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = `rgba(253, 224, 71, ${a.toFixed(3)})`;
        ctx.fillText('🌫️ CEIL SILT', px, ceilPy - Math.max(4, scale * 0.14));
        continue;
      }

      if (c.kind === 'thermocline') {
        const rxPx = (c.rx || 4.5) * scale * 0.72;
        const ryPx = (c.ry || 2.2) * scale * 0.72;
        ctx.strokeStyle = `rgba(125, 211, 252, ${(a * 0.85).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.5, 0.08 * scale);
        ctx.setLineDash([Math.max(4, scale * 0.24), Math.max(3, scale * 0.18)]);
        ctx.beginPath();
        ctx.ellipse(px, py, rxPx, ryPx, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `800 ${Math.max(9, Math.round(scale * 0.32))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(186, 230, 253, ${a.toFixed(3)})`;
        ctx.fillText(`❄️ -${c.tempDropC || 7}°C`, px, py);
        continue;
      }

      if (c.kind === 'secret-veil') {
        // Subtle, mysterious acoustic hollow echo (ZERO text callout — observant divers spot the faint fissure!)
        const pulseR = (0.72 + Math.sin(timeSec * 6.5) * 0.1) * scale;
        ctx.strokeStyle = `rgba(103, 232, 249, ${(a * 0.58).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.5, 0.07 * scale);
        ctx.setLineDash([Math.max(3, scale * 0.16), Math.max(4, scale * 0.2)]);
        ctx.beginPath();
        ctx.arc(px, py, pulseR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }

      const col = c.kind === 'recovery' ? '251, 191, 36' : c.kind === 'hatch' ? '249, 115, 22' : c.kind === 'stage' ? '74, 222, 128' : c.kind === 'collectible' ? '253, 224, 71' : '56, 189, 248';
      const r = (0.72 + Math.sin(timeSec * 9 + i) * 0.1) * scale;
      const bk = r * 1.18;
      const arm = Math.max(4, bk * 0.36);
      // High-tech tactical corner target-lock brackets
      ctx.strokeStyle = `rgba(${col}, ${(a * 0.92).toFixed(3)})`;
      ctx.lineWidth = Math.max(1.8, 0.08 * scale);
      ctx.beginPath();
      ctx.moveTo(px - bk, py - bk + arm); ctx.lineTo(px - bk, py - bk); ctx.lineTo(px - bk + arm, py - bk);
      ctx.moveTo(px + bk - arm, py - bk); ctx.lineTo(px + bk, py - bk); ctx.lineTo(px + bk, py - bk + arm);
      ctx.moveTo(px - bk, py + bk - arm); ctx.lineTo(px - bk, py + bk); ctx.lineTo(px - bk + arm, py + bk);
      ctx.moveTo(px + bk - arm, py + bk); ctx.lineTo(px + bk, py + bk); ctx.lineTo(px + bk, py + bk - arm);
      ctx.stroke();
      ctx.font = `700 ${Math.max(10, Math.round(scale * 0.44))}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(248, 250, 252, ${a.toFixed(3)})`;
      ctx.fillText(c.icon || '◆', px, py);
      if (c.kind === 'collectible' || c.kind === 'recovery' || c.kind === 'stage') {
        ctx.font = `800 ${Math.max(8, Math.round(scale * 0.28))}px ui-monospace, monospace`;
        ctx.fillStyle = `rgba(${col}, ${(a * 0.95).toFixed(3)})`;
        ctx.fillText(`${Math.round(c.dist)}m`, px, py + bk + Math.max(6, scale * 0.22));
      }
    }
    ctx.restore();
  },

  _drawDiver(ctx, diver, toScreenX, toScreenY, scale, timeSec, isPeer, mechCtx = null) {
    const body = diver.body || createDiverBody(diver.x, diver.y, diver.angle);
    const sx = toScreenX(diver.x);
    const sy = toScreenY(diver.y);
    const px = toScreenX(body.pelvis.x);
    const py = toScreenY(body.pelvis.y);
    const hx = toScreenX(body.hand.x);
    const hy = toScreenY(body.hand.y);

    ctx.save();

    const liveryPalette = diver.livery ? resolveDiverLiveryPalette(diver.livery) : null;
    if (liveryPalette?.wakeProfile?.active) this._drawDiverGearAura?.(ctx, sx, sy, scale, timeSec, liveryPalette);

    // 1. Far leg (behind torso)
    this._drawArticulatedLeg(ctx, body.pelvis, body.legs[1], toScreenX, toScreenY, scale, isPeer, true, liveryPalette, timeSec);

    // 2. Articulated Torso connecting shoulders (sx, sy) to pelvis (px, py)
    let accent = liveryPalette ? liveryPalette.trim : (isPeer ? '#fb923c' : '#22d3ee');
    if (liveryPalette?.trimFx === 'selenite-prism') {
      accent = `hsl(${Math.round((timeSec * 90) % 360)}, 92%, 78%)`;
    } else if (liveryPalette?.trimFx === 'foundry-sparks') {
      accent = `hsl(32, 98%, ${58 + Math.round(Math.sin(timeSec * 6.5) * 14)}%)`;
    }
    const torsoAngle = Math.atan2(sy - py, sx - px);
    const rollScale = Math.abs(body.rollVisual) < 0.15 ? 0.15 : body.rollVisual;
    const facingLeft = body.facingSign < 0;

    // Flexible spine core (bare warm skin midriff for bikini/cutout swimsuits)
    const isBareTorso = liveryPalette?.suitCut === 'bikini' || liveryPalette?.suitCut === 'cutout';
    this._drawLimbSegment(
      ctx,
      px,
      py,
      sx,
      sy,
      (liveryPalette?.bodyType === 'curvy' ? 0.28 : 0.36) * scale,
      isBareTorso ? (liveryPalette.skinTone || '#e8b68c') : (liveryPalette ? liveryPalette.suitMid : '#0f172a')
    );
    // Subtle shoulder / hip trim stripe (with live plasma-wave conduit pulse)
    if (!isBareTorso) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1.5, 0.04 * scale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
    if (liveryPalette?.trimFx === 'plasma-wave') {
      const pt = ((timeSec * 1.45) % 1 + 1) % 1;
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(sx + (px - sx) * pt, sy + (py - sy) * pt, Math.max(2, 0.048 * scale), 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Rigid Rig & Head oriented to torsoAngle + smooth roll (artSprites)
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(torsoAngle);
    if (facingLeft) ctx.scale(1, -1);

    const u = scale * 0.55;
    drawStyledDiverRig(ctx, u, scale, isPeer, rollScale, {
      hasCcr: diver.hasCcr,
      hasDpv: diver.hasDpv,
      dpvActive: diver.dpvActive,
      dpvThrusting: diver.dpvThrusting,
      timeSec,
      liveryPalette,
      vx: diver.vx || 0,
      vy: diver.vy || 0,
      bounceKey: diver.id || (isPeer ? 'peer' : 'self'),
    });
    ctx.restore();

    // 4. Near leg (in front of pelvis)
    this._drawArticulatedLeg(ctx, body.pelvis, body.legs[0], toScreenX, toScreenY, scale, isPeer, false, liveryPalette, timeSec);

    // 5. Articulated Arm, Wrist Dive Computer & Goodman-handle Primary Torch (shared with Workshop Preview)
    const shoulderX = sx + Math.cos(torsoAngle) * (0.08 * scale);
    const shoulderY = sy + Math.sin(torsoAngle) * (0.08 * scale);
    const midArmX = (shoulderX + hx) * 0.5 + Math.sin(torsoAngle) * body.facingSign * (0.12 * scale);
    const midArmY = (shoulderY + hy) * 0.5 - Math.cos(torsoAngle) * body.facingSign * (0.12 * scale);
    const torchAng = Number.isFinite(diver.torchAngle) ? diver.torchAngle : diver.angle;
    drawDiverArmAndTorch(
      ctx,
      shoulderX,
      shoulderY,
      midArmX,
      midArmY,
      hx,
      hy,
      torchAng,
      scale,
      isPeer,
      liveryPalette,
      {
        torchOn: diver.torchOn !== false,
        glowStamps: this.glowStamps,
        hasSpeargun: Boolean(mechCtx?.hasSpeargun),
        spearRecoil: mechCtx?.spearRecoil || 0,
        muzzleFlash: mechCtx?.muzzleFlash || 0,
        timeSec,
      }
    );

    // 5b. Articulated Working Arm & Mechanical Hardware Rig (v148: Wheel Crank, Valve Bleed, Shears, Delrin Reel, Shot-Line Lanyard)
    if (!isPeer && mechCtx) {
      const ws = mechCtx.wreckState;
      const mfx = mechCtx.mechFx;

      // Shot-line stainless carabiner & yellow braided clip lanyard when clipped onto descent line
      if (ws?.clippedToShotLine && this.level?.shotLine) {
        const lineX = toScreenX(this.level.shotLine.x ?? this.level.spawn?.x ?? diver.x);
        const lineY = sy - 0.08 * scale;
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.94)';
        ctx.lineWidth = Math.max(1.5, 0.058 * scale);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo((sx + lineX) * 0.5, sy + 0.16 * scale, lineX, lineY);
        ctx.stroke();
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = Math.max(1.4, 0.055 * scale);
        ctx.beginPath();
        ctx.arc(lineX, lineY, Math.max(2.2, 0.095 * scale), 0, Math.PI * 2);
        ctx.stroke();
      }

      // Compute working-hand screen target for active mechanical interactions
      let workTargetX = null;
      let workTargetY = null;
      let workTool = null;

      const activeDrillKind = mechCtx?.drills?.active?.kind || null;
      if (ws?.crankingHatchId && Array.isArray(this.level?.watertightHatches)) {
        const hObj = this.level.watertightHatches.find((h) => h && h.id === ws.crankingHatchId);
        if (hObj) {
          const hr = (hObj.radius || 1.9) * scale;
          const wheelRot = (ws.crankingHatchProgress || 0) * Math.PI * 5;
          workTargetX = toScreenX(hObj.x) + Math.cos(wheelRot) * hr * 0.44;
          workTargetY = toScreenY(hObj.y) + Math.sin(wheelRot) * hr * 0.44;
          workTool = 'crank';
        }
      } else if (activeDrillKind === 'mask-flood' || mfx?.activeAction?.kind === 'mask-purge') {
        // Working hand rises to upper mask visor rim to press & exhale-purge flooded mask (v151)
        const headX = sx + Math.cos(torsoAngle) * 0.36 * scale;
        const headY = sy + Math.sin(torsoAngle) * 0.36 * scale - 0.08 * scale;
        workTargetX = headX + Math.cos(torsoAngle + body.facingSign * 0.25) * 0.12 * scale;
        workTargetY = headY + Math.sin(torsoAngle + body.facingSign * 0.25) * 0.12 * scale;
        workTool = 'mask-purge';
      } else if (activeDrillKind === 'free-flow' || mfx?.activeAction?.kind === 'free-flow-shutoff') {
        // Working arm reaches back over the shoulder to crank the rear tank isolator manifold valve (v151)
        const backAng = torsoAngle + Math.PI - body.facingSign * 0.48;
        const twist = Math.sin(timeSec * 12) * 0.05 * scale;
        workTargetX = shoulderX + Math.cos(backAng) * 0.38 * scale + twist;
        workTargetY = shoulderY + Math.sin(backAng) * 0.38 * scale - 0.12 * scale;
        workTool = 'free-flow-shutoff';
      } else if (mfx?.activeAction?.kind === 'gas-switch') {
        // Gloved hand clips/switches color-coded 2nd-stage regulator at chest/mouthpiece (v151)
        const reach = Math.sin(Math.min(1, mfx.activeAction.timer / Math.max(0.1, mfx.activeAction.duration)) * Math.PI);
        if (reach > 0.05) {
          const regAng = torsoAngle + body.facingSign * 0.28;
          workTargetX = shoulderX + Math.cos(regAng) * (0.26 + reach * 0.18) * scale;
          workTargetY = shoulderY + Math.sin(regAng) * (0.26 + reach * 0.18) * scale;
          workTool = 'gas-switch';
        }
      } else if (mfx?.activeAction) {
        const a = mfx.activeAction;
        const reach = Math.sin(Math.min(1, a.timer / Math.max(0.1, a.duration)) * Math.PI);
        if (reach > 0.05) {
          const tx = toScreenX(a.x);
          const ty = toScreenY(a.y);
          const distPx = Math.hypot(tx - shoulderX, ty - shoulderY);
          const clamped = Math.min(distPx, 2.6 * scale);
          const ratio = distPx > 0.01 ? (clamped / distPx) * reach : 0;
          workTargetX = shoulderX + (tx - shoulderX) * ratio;
          workTargetY = shoulderY + (ty - shoulderY) * ratio;
          workTool = a.kind;
        }
      } else if (mechCtx.reelingActive) {
        // Off-hand holds the spinning machined Delrin cave guideline spool
        const offAng = torsoAngle + body.facingSign * 0.55;
        workTargetX = shoulderX + Math.cos(offAng) * 0.52 * scale;
        workTargetY = shoulderY + Math.sin(offAng) * 0.52 * scale;
        workTool = 'spool';
      }

      if (workTargetX !== null && workTargetY !== null) {
        const elbowX = (shoulderX + workTargetX) * 0.5 - Math.sin(torsoAngle) * body.facingSign * (0.14 * scale);
        const elbowY = (shoulderY + workTargetY) * 0.5 + Math.cos(torsoAngle) * body.facingSign * (0.14 * scale);
        this._drawLimbSegment(ctx, shoulderX, shoulderY, elbowX, elbowY, 0.125 * scale, '#1e293b');
        this._drawLimbSegment(ctx, elbowX, elbowY, workTargetX, workTargetY, 0.11 * scale, '#0f172a');
        // Neoprene gloved hand
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(workTargetX, workTargetY, Math.max(2.2, 0.075 * scale), 0, Math.PI * 2);
        ctx.fill();

        if (workTool === 'spool') {
          // Spinning machined Delrin guideline finger-spool in hand
          ctx.save();
          ctx.translate(workTargetX, workTargetY);
          ctx.rotate(timeSec * 5.2);
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = Math.max(1.2, 0.05 * scale);
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(3.2, 0.16 * scale), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(1.4, 0.07 * scale), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (workTool === 'cut-net') {
          // Gleaming titanium trauma shears blades at hand
          const shearAng = Math.atan2(workTargetY - elbowY, workTargetX - elbowX);
          ctx.save();
          ctx.translate(workTargetX, workTargetY);
          ctx.rotate(shearAng);
          ctx.strokeStyle = '#f8fafc';
          ctx.lineWidth = Math.max(1.4, 0.055 * scale);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0.24 * scale, -0.07 * scale);
          ctx.moveTo(0, 0);
          ctx.lineTo(0.24 * scale, 0.07 * scale);
          ctx.stroke();
          ctx.restore();
        } else if (workTool === 'gas-switch') {
          // Color-coded 2nd-stage regulator housing + stainless bolt-snap glint
          const gId = mfx?.activeAction?.gasId || 'EAN32';
          const regCol = gId === 'O2' ? '#22c55e' : gId === 'TMX1455' ? '#f59e0b' : '#38bdf8';
          ctx.fillStyle = regCol;
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = Math.max(1.1, 0.04 * scale);
          ctx.beginPath();
          ctx.arc(workTargetX, workTargetY, Math.max(2.6, 0.105 * scale), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (workTool === 'free-flow-shutoff') {
          // Brass tank isolator valve knob + turning arc highlight
          ctx.fillStyle = '#fbbf24';
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = Math.max(1.1, 0.04 * scale);
          ctx.beginPath();
          ctx.arc(workTargetX, workTargetY, Math.max(2.4, 0.095 * scale), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (workTool === 'mask-purge') {
          // Rising silver nasal-purge micro-bubbles escaping bottom skirt of mask
          ctx.fillStyle = 'rgba(224, 242, 254, 0.82)';
          for (let pb = 0; pb < 3; pb++) {
            const lift = ((timeSec * 3.8 + pb * 0.33) % 1) * 0.42 * scale;
            ctx.beginPath();
            ctx.arc(workTargetX + (pb - 1) * 0.07 * scale, workTargetY - lift, Math.max(1.2, 0.038 * scale), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    ctx.restore();

    // Buddy nameplate + live overhead gas & physiological vital bar
    if (isPeer && diver.name) {
      const bar = Math.round(diver.activeBar ?? 200);
      const bpm = diver.alive === false ? 0 : Math.round(diver.heartRateBpm ?? 68);
      const stress = Math.round(
        Math.max(
          diver.cnsPercent || 0,
          diver.dcsStress || 0,
          diver.hypoxiaStress || 0,
          diver.cardiacStress || 0,
          (diver.narcosisLevel || 0) * 80
        )
      );
      const cond = diver.alive === false ? 'DOWN' : (diver.condition || 'NOMINAL');
      const isDecoHold = cond.startsWith('DECO ');
      const alertColor =
        diver.alive === false ||
        cond === 'NO GAS' ||
        cond === 'HYPOXIA' ||
        cond === 'O2 TOX' ||
        cond === 'DCS' ||
        cond === 'SNAGGED!' ||
        cond === 'NO LIGHT' ||
        cond === 'NARCOSIS' ||
        cond === 'PANIC' ||
        cond === 'LOW GAS' ||
        cond === 'SEPARATED' ||
        stress >= 65 ||
        bpm >= 150
          ? '#ef4444'
          : (cond !== 'NOMINAL' && !isDecoHold) || bar < 50 || stress >= 25 || bpm >= 118
            ? '#fbbf24'
            : isDecoHold
              ? '#38bdf8'
              : '#fdba74';

      const pillY = sy - scale * 1.12;
      const barW = Math.max(42, 1.8 * scale);
      ctx.save();
      ctx.font = `700 ${Math.max(9, Math.round(0.32 * scale))}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = alertColor;
      const hrTag = diver.alive === false ? '' : ` ♥${bpm}`;
      const tag = cond === 'NOMINAL' ? `${diver.name} · ${bar}b${hrTag}` : `${diver.name} · ${cond} (${bar}b${hrTag})`;
      ctx.fillText(tag, sx, pillY - 5);

      // Compact mini-bars below nameplate (left: gas, right: stress)
      const mixStartBar = this.level?.gasOverrides?.[diver.gasId]?.startBar || 200;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(sx - barW * 0.5, pillY, barW, 4);
      const gasW = Math.max(0, Math.min(1, bar / mixStartBar)) * (barW * 0.48);
      ctx.fillStyle = bar < 45 ? '#ef4444' : '#38bdf8';
      ctx.fillRect(sx - barW * 0.5, pillY, gasW, 4);
      const stressW = Math.max(0, Math.min(1, stress / 100)) * (barW * 0.48);
      ctx.fillStyle = stress >= 65 ? '#ef4444' : stress >= 25 ? '#fbbf24' : '#4ade80';
      ctx.fillRect(sx + barW * 0.02, pillY, stressW, 4);
      ctx.restore();
    }
  },

  /**
   * Post-lighting luminous overhead hand/torch signals & 3-flash dive-light pulse
   * so co-op team signals remain razor-sharp even in pitch-black cave sumps.
   */
  _drawDiverSignals(ctx, diver, peers, toScreenX, toScreenY, scale, timeSec, cw = 0, ch = 0) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const list = [];
    if (diver?.signalText && diver.signalExpiresAt > now) list.push({ d: diver, isPeer: false });
    if (Array.isArray(peers)) {
      for (let i = 0; i < peers.length; i++) {
        const p = peers[i];
        if (p?.signalText && p.signalExpiresAt > now) list.push({ d: p, isPeer: true });
      }
    }
    if (list.length === 0) return;

    ctx.save();
    for (let i = 0; i < list.length; i++) {
      const { d, isPeer } = list[i];
      const remMs = d.signalExpiresAt - now;
      const totalMs = isPeer ? 4500 : 4000;
      const elapsedSec = Math.max(0, (totalMs - remMs) / 1000);
      const fade = Math.min(1, remMs / 550);
      const sx = toScreenX(d.x);
      const sy = toScreenY(d.y);
      // Skip completely offscreen peers (their signal is surfaced on _drawPeerEdgeIndicators)
      if (isPeer && cw > 0 && ch > 0 && (sx < -24 || sx > cw + 24 || sy < -24 || sy > ch + 24)) continue;

      const sigSpec = getScubaSignalById(d.signalId || d.signalText);
      const isWarn = sigSpec ? (sigSpec.id === 'low-gas' || sigSpec.id === 'hold' || sigSpec.id === 'share-air') : /GAS|DECO|HOLD|SHARE/i.test(d.signalText);
      const accentColor = sigSpec?.color || (isWarn ? '#fbbf24' : '#38bdf8');
      const bgColor = sigSpec?.bgRgba || (isWarn ? 'rgba(69, 26, 3, 0.94)' : 'rgba(8, 47, 73, 0.94)');
      const txtColor = sigSpec?.textColor || (isWarn ? '#fef3c7' : '#e0f2fe');
      const sigElapsed = Number.isFinite(d.signalStartedAt) ? Math.max(0, (now - d.signalStartedAt) / 1000) : elapsedSec;

      // Authentic in-world cave-diving torch light gesture graphic ahead of diver's beam (v127)
      if (sigSpec && sigElapsed < 2.35 && d.torchOn !== false) {
        const gFade = Math.min(1, sigElapsed / 0.2) * Math.min(1, (2.35 - sigElapsed) / 0.35);
        const aimAng = Number.isFinite(d.torchAngle) ? d.torchAngle : (d.angle || 0);
        const gx = sx + Math.cos(aimAng) * 2.15 * scale;
        const gy = sy + Math.sin(aimAng) * 2.15 * scale;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = gFade * 0.9;
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = Math.max(2, 0.08 * scale);
        if (sigSpec.torchPattern === 'circle') {
          // Luminous Torch "O" Circle signal (classic cave-diving OK gesture!)
          const r = 0.68 * scale;
          const headA = sigElapsed * Math.PI * 2.8;
          ctx.beginPath();
          ctx.arc(gx, gy, r, headA - Math.PI * 1.45, headA);
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(gx + Math.cos(headA) * r, gy + Math.sin(headA) * r, Math.max(2.6, 0.1 * scale), 0, Math.PI * 2);
          ctx.fill();
        } else if (sigSpec.torchPattern === 'wave' || sigSpec.torchPattern === 'sos-wave') {
          // Sweeping attention light arcs
          for (let aIdx = 0; aIdx < 2; aIdx++) {
            const ar = (1.1 + aIdx * 0.55) * scale;
            ctx.beginPath();
            ctx.arc(sx, sy, ar, aimAng - 0.52, aimAng + 0.52);
            ctx.stroke();
          }
        } else if (sigSpec.torchPattern === 'nod-up') {
          // Rising upward ascent chevrons above diver
          for (let cIdx = 0; cIdx < 2; cIdx++) {
            const cy = sy - (1.0 + ((sigElapsed * 1.3 + cIdx * 0.5) % 1.0) * 1.1) * scale;
            const cwHalf = 0.36 * scale;
            ctx.beginPath();
            ctx.moveTo(sx - cwHalf, cy + 0.18 * scale);
            ctx.lineTo(sx, cy - 0.12 * scale);
            ctx.lineTo(sx + cwHalf, cy + 0.18 * scale);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // 3-flash dive-light beacon ring during first 1.6s of signal so teammates spot it across dark passages
      if (elapsedSec < 1.65) {
        const flashPhase = (elapsedSec * 3.0) % 1.0;
        const flashAlpha = Math.sin(flashPhase * Math.PI) * (1 - elapsedSec / 1.8);
        if (flashAlpha > 0.04) {
          const ringR = (0.75 + flashPhase * 2.15) * scale;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = flashAlpha * 0.85;
          ctx.strokeStyle = accentColor;
          ctx.lineWidth = Math.max(2, 0.1 * scale);
          ctx.beginPath();
          ctx.arc(sx, sy, ringR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      const risePx = Math.min(14, elapsedSec * 5) + Math.sin(timeSec * 4 + i) * 1.5;
      const baseMsgY = isPeer
        ? Math.min(sy - scale * 1.92, sy - scale * 1.12 - 28) - risePx
        : sy - scale * 1.55 - risePx;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.font = `800 ${Math.max(10, Math.round(0.36 * scale))}px ui-monospace, monospace`;
      const padX = 9;
      const tw = ctx.measureText(d.signalText).width;
      const bw = tw + padX * 2;
      const bh = Math.max(20, 0.58 * scale);
      const pillCx = cw > 0 ? Math.max(bw * 0.5 + 8, Math.min(cw - bw * 0.5 - 8, sx)) : sx;
      const msgY = ch > 0 ? Math.max(bh * 0.5 + 12, Math.min(ch - bh * 0.5 - 12, baseMsgY)) : baseMsgY;
      ctx.fillStyle = bgColor;
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(pillCx - bw * 0.5, msgY - bh * 0.5, bw, bh, 999);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = txtColor;
      ctx.fillText(d.signalText, pillCx, msgY + 0.5);
      ctx.restore();
    }
    ctx.restore();
  },

  _drawPeerEdgeIndicators(ctx, cw, ch, diver, peers, toScreenX, toScreenY, timeSec) {
    if (!peers || peers.length === 0) return;
    const dpr = this._cachedDpr || 1;
    const marginX = Math.round(28 * dpr);
    const topSafe = Math.round((cw < ch ? 116 : 92) * dpr);
    const botSafe = Math.round((cw < ch ? 225 : 138) * dpr);
    const fontPx = Math.round(11 * dpr);
    const arrowSz = Math.round(8 * dpr);
    const pillH = Math.round(20 * dpr);
    const placedPills = [];
    let ctxSaved = false;
    const textWCache = this._peerEdgeTextWCache || (this._peerEdgeTextWCache = new Map());
    for (let i = 0; i < peers.length; i++) {
      const p = peers[i];
      const px = toScreenX(p.x), py = toScreenY(p.y);
      if (px >= marginX && px <= cw - marginX && py >= topSafe && py <= ch - botSafe) continue;
      if (!ctxSaved) { ctx.save(); ctx.font = `800 ${fontPx}px ui-monospace, monospace`; ctx.textBaseline = 'middle'; ctxSaved = true; }

      const distM = Math.round(Math.hypot(p.x - diver.x, p.y - diver.y));
      const dDepth = Math.round((p.y || 0) - (diver.y || 0));
      const depthTag = Math.abs(dDepth) >= 3 ? (dDepth > 0 ? ` ▼${dDepth}m` : ` ▲${Math.abs(dDepth)}m`) : '';
      const ang = Math.atan2(py - ch * 0.5, px - cw * 0.5);
      const rx = Math.max(marginX, Math.min(cw - marginX, cw * 0.5 + Math.cos(ang) * (cw * 0.5 - marginX)));
      let ry = Math.max(topSafe, Math.min(ch - botSafe, ch * 0.5 + Math.sin(ang) * (ch * 0.5 - Math.max(topSafe, botSafe) * 0.5)));

      const stress = Math.round(
        Math.max(p.cnsPercent || 0, p.dcsStress || 0, p.hypoxiaStress || 0, p.cardiacStress || 0, (p.narcosisLevel || 0) * 80)
      );
      const bpm = p.alive === false ? 0 : Math.round(p.heartRateBpm ?? 68);
      const bar = Math.round(p.activeBar ?? 200);
      const cond = p.alive === false ? 'DOWN' : (p.condition || 'NOMINAL');
      const isDecoHold = cond.startsWith('DECO ');
      const distressed =
        p.alive === false ||
        cond === 'NO GAS' ||
        cond === 'HYPOXIA' ||
        cond === 'O2 TOX' ||
        cond === 'DCS' ||
        cond === 'SNAGGED!' ||
        cond === 'NO LIGHT' ||
        cond === 'NARCOSIS' ||
        cond === 'PANIC' ||
        cond === 'LOW GAS' ||
        cond === 'SEPARATED' ||
        stress >= 65 ||
        bpm >= 150;
      const isWarn = !distressed && ((cond !== 'NOMINAL' && !isDecoHold) || bar < 50 || stress >= 25 || bpm >= 118);
      const pulse = distressed ? 0.65 + 0.35 * Math.sin(timeSec * 8) : 0.94;
      const col = distressed ? '#f87171' : isWarn ? '#fbbf24' : isDecoHold ? '#38bdf8' : '#fdba74';

      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const activeSig = p.signalText && p.signalExpiresAt > nowMs ? ` · ${p.signalText}` : '';
      const label = cond === 'NOMINAL'
        ? `${p.name || 'Buddy'} ${distM}m${depthTag}${activeSig}`
        : `${p.name || 'Buddy'} ${cond} ${distM}m${depthTag}${activeSig}`;
      const mKey = `${fontPx}|${label}`;
      let textW = textWCache.get(mKey);
      if (textW === undefined) { if (textWCache.size > 64) textWCache.clear(); textW = ctx.measureText(label).width; textWCache.set(mKey, textW); }
      const pillPadX = Math.round(7 * dpr);
      const pillW = Math.min(cw - marginX * 2, textW + pillPadX * 2);
      const onRight = rx > cw * 0.5;
      const rawPillX = onRight ? rx - arrowSz - Math.round(5 * dpr) - pillW : rx + arrowSz + Math.round(5 * dpr);
      const pillX = Math.max(marginX, Math.min(cw - marginX - pillW, rawPillX));

      // Avoid vertical stacking collisions when multiple peers lie in the same direction
      const stepY = pillH + Math.round(4 * dpr);
      for (let k = 0; k < placedPills.length; k++) {
        const prev = placedPills[k];
        if (Math.abs(prev.x - pillX) < (prev.w + pillW) * 0.5 && Math.abs(prev.y - ry) < stepY) {
          ry = Math.min(ch - botSafe, Math.max(topSafe, prev.y + (ry >= prev.y ? stepY : -stepY)));
        }
      }
      placedPills.push({ x: pillX, y: ry, w: pillW });

      ctx.globalAlpha = pulse;
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(ang);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(arrowSz, 0);
      ctx.lineTo(-arrowSz * 0.7, -arrowSz * 0.6);
      ctx.lineTo(-arrowSz * 0.38, 0);
      ctx.lineTo(-arrowSz * 0.7, arrowSz * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = distressed ? 'rgba(69, 10, 10, 0.9)' : 'rgba(6, 15, 29, 0.88)';
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(1.2, 1.3 * dpr);
      ctx.beginPath();
      ctx.roundRect(pillX, ry - pillH * 0.5, pillW, pillH, 999);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = col;
      ctx.fillText(label, pillX + pillW * 0.5, ry + 0.5, pillW - pillPadX * 1.4);
    }
    if (ctxSaved) ctx.restore();
  },
};
