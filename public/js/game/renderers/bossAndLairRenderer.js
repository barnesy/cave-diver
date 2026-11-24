/**
 * Secret Lair, Pneumatic Speargun & Colossal Cave Kraken Boss Renderer (v179).
 * Mixed onto CaveRenderer.prototype alongside chunkBaker, surfaceRenderer,
 * wreckAndInteractivesRenderer, and lightingAndFxRenderer.
 */

import { wreckAndInteractivesMethods } from './wreckAndInteractivesRenderer.js';
import { drawDetailedSpeargun } from '../artSprites.js';
import { SPEARGUN_MAX_CHARGE_SEC } from '../secretLairs.js';

export const bossAndLairMethods = {
  /**
   * World-space (pre-lighting) pass: solid false limestone veil, sculpted cover pillars,
   * armory rack, bailout stages, lesser enemies & the Kraken's body/tentacles.
   */
  _drawSecretLairWorld(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, lair) {
    if (!lair?.spec) return;
    const { spec, boss } = lair;

    // 1. Sealed False Limestone Veil (blends seamlessly into cave rock before breached!)
    if (!lair.veilBreached) {
      const v = spec.veil;
      if (v.x + v.radius + 2 >= visX0 && v.x - v.radius - 2 <= visX1 && v.y + v.radius + 2 >= visY0 && v.y - v.radius - 2 <= visY1) {
        const sx = toScreenX(v.x);
        const sy = toScreenY(v.y);
        const sr = (v.radius + 0.9) * scale;
        ctx.save();
        ctx.translate(sx, sy);
        const rockGrad = ctx.createRadialGradient(-sr * 0.25, -sr * 0.2, sr * 0.1, 0, 0, sr);
        rockGrad.addColorStop(0, '#334155');
        rockGrad.addColorStop(0.65, '#1e293b');
        rockGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = rockGrad;
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const jitter = 0.88 + 0.2 * Math.sin(i * 2.7 + 1.1);
          const rx = Math.cos(a) * sr * jitter;
          const ry = Math.sin(a) * sr * jitter;
          if (i === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.lineWidth = Math.max(1.5, 0.08 * scale);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (!lair.veilBreached) return;

    // 2. Sculpted Arena Natural Limestone Cover Pillars (layered karst strata + mineral seams)
    for (const p of spec.arena.pillars || []) {
      if (p.x + p.radius + 2 < visX0 || p.x - p.radius - 2 > visX1 || p.y + p.radius + 2 < visY0 || p.y - p.radius - 2 > visY1) continue;
      const sx = toScreenX(p.x);
      const sy = toScreenY(p.y);
      const sr = p.radius * scale;
      ctx.save();
      ctx.translate(sx, sy);
      // Outer limestone mass
      const pg = ctx.createRadialGradient(-sr * 0.3, -sr * 0.32, sr * 0.1, 0, 0, sr * 1.08);
      pg.addColorStop(0, '#64748b');
      pg.addColorStop(0.42, '#334155');
      pg.addColorStop(0.78, '#1e293b');
      pg.addColorStop(1, '#09111f');
      ctx.fillStyle = pg;
      ctx.beginPath();
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const j = 0.90 + 0.14 * Math.cos(i * 3.1 + p.x) + 0.05 * Math.sin(i * 5.3);
        const rx = Math.cos(a) * sr * j;
        const ry = Math.sin(a) * sr * j;
        if (i === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.closePath();
      ctx.fill();
      // Inner carved karst terrace & mineral calcite veins
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
      ctx.lineWidth = Math.max(1.2, 0.06 * scale);
      ctx.stroke();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
      ctx.beginPath();
      ctx.ellipse(sr * 0.14, sr * 0.16, sr * 0.56, sr * 0.44, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.lineWidth = Math.max(1.1, 0.045 * scale);
      ctx.beginPath();
      ctx.moveTo(-sr * 0.55, -sr * 0.25);
      ctx.lineTo(-sr * 0.1, sr * 0.08);
      ctx.lineTo(sr * 0.45, -sr * 0.15);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Salvaged Expedition Armory Cradle (High-Detail Mounted-Torch Titanium Speargun)
    const arm = spec.armory;
    if (arm && arm.x + 5 >= visX0 && arm.x - 5 <= visX1 && arm.y + 5 >= visY0 && arm.y - 5 <= visY1) {
      const sx = toScreenX(arm.x);
      const sy = toScreenY(arm.y);
      ctx.save();
      ctx.translate(sx, sy);
      // Heavy titanium weapon pedestal case
      const caseGrad = ctx.createLinearGradient(0, -0.75 * scale, 0, 0.75 * scale);
      caseGrad.addColorStop(0, '#334155');
      caseGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = caseGrad;
      ctx.strokeStyle = lair.weaponEquipped ? 'rgba(148, 163, 184, 0.35)' : '#38bdf8';
      ctx.lineWidth = Math.max(1.5, 0.065 * scale);
      ctx.beginPath();
      ctx.roundRect(-1.55 * scale, -0.68 * scale, 3.1 * scale, 1.36 * scale, 0.22 * scale);
      ctx.fill();
      ctx.stroke();
      // Inner foam cradle recess
      ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
      ctx.beginPath();
      ctx.roundRect(-1.35 * scale, -0.48 * scale, 2.7 * scale, 0.96 * scale, 0.14 * scale);
      ctx.fill();
      if (!lair.weaponEquipped) {
        ctx.save();
        ctx.translate(-0.72 * scale, Math.sin(timeSec * 2.8) * 0.06 * scale);
        ctx.rotate(-0.12);
        drawDetailedSpeargun(ctx, scale * 1.45, {
          torchOn: true,
          lensColor: '#fef08a',
          glowStamps: this.glowStamps,
        });
        ctx.restore();
      }
      ctx.restore();
    }

    // 4. Arena & Corridor Emergency Bailout Stages (hidden in Pure Combat Mode where gas is frozen!)
    if (!lair.combatMode) {
      for (const st of lair.stages || []) {
        if (st.x + 3 < visX0 || st.x - 3 > visX1 || st.y + 3 < visY0 || st.y - 3 > visY1) continue;
        const sx = toScreenX(st.x);
        const sy = toScreenY(st.y);
        ctx.save();
        ctx.translate(sx, sy);
        wreckAndInteractivesMethods._drawDetailedStageCylinder(ctx, scale, {
          bodyCol: st.cooldownSec > 0 ? '#475569' : '#0284c7',
          trimCol: st.cooldownSec > 0 ? '#94a3b8' : '#38bdf8',
          claimed: st.cooldownSec > 0,
          tiltRad: -0.25,
          timeSec,
        });
        ctx.restore();
      }
    }

    // 5. Lesser Enemies (Abyssal Morays, Brine Swarmers, Armored Stalkers)
    for (const m of lair.minions || []) {
      if (!m.alive) continue;
      if (m.x + 4 < visX0 || m.x - 4 > visX1 || m.y + 4 < visY0 || m.y - 4 > visY1) continue;
      this._drawSecretLairMinion(ctx, m, toScreenX, toScreenY, scale, timeSec);
    }

    // 6. Colossal Bioluminescent Cave Kraken (*XIBALBA'S MAW*)
    if (boss && (!boss.defeated || boss.defeatAnimSec > 0)) {
      if (boss.x + 15 >= visX0 && boss.x - 15 <= visX1 && boss.y + 15 >= visY0 && boss.y - 15 <= visY1) {
        this._drawCaveKrakenBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec);
      }
    }
  },

  _drawSecretLairMinion(ctx, m, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(m.x);
    const sy = toScreenY(m.y);
    const r = m.radius * scale;
    const flash = m.hitFlash > 0;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(m.angle || 0);

    if (m.kind === 'moray') {
      // Sculpted serpentine Abyssal Cave Moray with undulating dorsal fin & fanged jaw
      const pts = [];
      for (let seg = 0; seg <= 6; seg++) {
        pts.push({
          x: -seg * r * 0.42,
          y: Math.sin(m.wigglePhase - seg * 0.85) * r * (0.14 + seg * 0.055),
          w: r * (0.46 - seg * 0.055),
        });
      }
      // Translucent bioluminescent dorsal ribbon
      ctx.strokeStyle = m.state === 'telegraph' ? 'rgba(248, 113, 113, 0.78)' : 'rgba(56, 189, 248, 0.68)';
      ctx.lineWidth = Math.max(2, 0.12 * scale);
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const px = pts[i].x;
        const py = pts[i].y - pts[i].w * 0.95;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      // Tapered serpentine body
      for (let seg = pts.length - 1; seg >= 0; seg--) {
        const pt = pts[seg];
        const bg = ctx.createRadialGradient(pt.x, pt.y - pt.w * 0.3, pt.w * 0.1, pt.x, pt.y, pt.w);
        bg.addColorStop(0, seg === 0 ? '#2b5876' : '#1e3a5f');
        bg.addColorStop(1, '#091628');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y, pt.w * 1.15, pt.w * 0.86, 0, 0, Math.PI * 2);
        ctx.fill();
        if (flash) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      }
      // Snapped fanged jaws & menacing eye
      const jawOpen = m.state === 'telegraph' || m.state === 'lunge' ? 0.34 : 0.14;
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = Math.max(1.2, 0.05 * scale);
      ctx.beginPath();
      ctx.moveTo(r * 0.18, -r * 0.18);
      ctx.lineTo(r * 0.92, -r * jawOpen);
      ctx.lineTo(r * 0.35, 0.04 * r);
      ctx.lineTo(r * 0.88, r * (jawOpen + 0.12));
      ctx.lineTo(r * 0.16, r * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Needle teeth
      ctx.fillStyle = '#f8fafc';
      for (let k = 0; k < 3; k++) {
        const tx = r * (0.42 + k * 0.16);
        ctx.beginPath();
        ctx.moveTo(tx, -r * jawOpen * 0.6);
        ctx.lineTo(tx + r * 0.05, r * 0.04);
        ctx.lineTo(tx - r * 0.04, -r * jawOpen * 0.6);
        ctx.fill();
      }
      ctx.fillStyle = m.state === 'telegraph' ? '#f87171' : '#facc15';
      ctx.beginPath();
      ctx.arc(r * 0.34, -r * 0.24, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    } else if (m.kind === 'swarmer') {
      // Bioluminescent Abyssal Brine-Spitter (translucent ribbed mantle + trailing venom tendrils)
      for (let k = -2; k <= 2; k++) {
        const swing = Math.sin(m.wigglePhase * 1.3 + k * 1.1) * 0.28 * r;
        ctx.strokeStyle = 'rgba(132, 204, 22, 0.65)';
        ctx.lineWidth = Math.max(1.1, 0.045 * scale);
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, k * r * 0.22);
        ctx.quadraticCurveTo(-r * 0.95, k * r * 0.34 + swing, -r * 1.45, k * r * 0.24 - swing * 0.6);
        ctx.stroke();
      }
      const sg = ctx.createRadialGradient(r * 0.12, -r * 0.15, r * 0.1, 0, 0, r * 0.98);
      sg.addColorStop(0, '#3f6212');
      sg.addColorStop(0.65, '#14532d');
      sg.addColorStop(1, '#052e16');
      ctx.fillStyle = sg;
      ctx.strokeStyle = flash ? '#ffffff' : '#84cc16';
      ctx.lineWidth = Math.max(1.4, 0.06 * scale);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.92, r * 0.66, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Pulsing glowing brine venom core
      const glowR = r * (0.34 + 0.06 * Math.sin(timeSec * 8 + m.wigglePhase));
      const vg = ctx.createRadialGradient(-r * 0.18, 0, 0, -r * 0.18, 0, glowR * 1.4);
      vg.addColorStop(0, '#ecfccb');
      vg.addColorStop(0.5, '#a3e635');
      vg.addColorStop(1, 'rgba(132, 204, 22, 0)');
      ctx.fillStyle = vg;
      ctx.beginPath();
      ctx.arc(-r * 0.18, 0, glowR * 1.4, 0, Math.PI * 2);
      ctx.fill();
      // Twin acid-green eyes
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(r * 0.52, -r * 0.22, r * 0.11, 0, Math.PI * 2);
      ctx.arc(r * 0.52, r * 0.22, r * 0.11, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Armored Cenote Stalker (layered obsidian-slate chitin plates + glowing amber rear core!)
      const cg = ctx.createRadialGradient(r * 0.25, -r * 0.2, r * 0.1, 0, 0, r * 1.1);
      cg.addColorStop(0, '#64748b');
      cg.addColorStop(0.55, '#1e293b');
      cg.addColorStop(1, '#090f1c');
      ctx.fillStyle = cg;
      ctx.strokeStyle = flash ? '#ffffff' : '#94a3b8';
      ctx.lineWidth = Math.max(2, 0.09 * scale);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.0, -Math.PI * 0.64, Math.PI * 0.64);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Armored ridge plate lines
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
      ctx.lineWidth = Math.max(1.2, 0.05 * scale);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.66, -Math.PI * 0.55, Math.PI * 0.55);
      ctx.stroke();
      // Exposed glowing amber rear flank core
      const ag = ctx.createRadialGradient(-r * 0.42, 0, r * 0.06, -r * 0.42, 0, r * 0.56);
      ag.addColorStop(0, '#fef08a');
      ag.addColorStop(0.55, '#f59e0b');
      ag.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.arc(-r * 0.42, 0, r * 0.56, 0, Math.PI * 2);
      ctx.fill();
      // Serrated twin pincer mandibles
      ctx.strokeStyle = m.state === 'telegraph' ? '#f87171' : '#e2e8f0';
      ctx.lineWidth = Math.max(2.2, 0.1 * scale);
      ctx.beginPath();
      ctx.moveTo(r * 0.72, -r * 0.38);
      ctx.quadraticCurveTo(r * 1.18, -r * 0.45, r * 1.38, -r * 0.12);
      ctx.moveTo(r * 0.72, r * 0.38);
      ctx.quadraticCurveTo(r * 1.18, r * 0.45, r * 1.38, r * 0.12);
      ctx.stroke();
    }
    ctx.restore();

    // Compact HP bar above damaged/aggro minion
    if (m.hp < m.maxHp || m.aggro) {
      const bw = Math.max(28, r * 1.8);
      const bh = 4;
      const bx = sx - bw * 0.5;
      const by = sy - r - 11;
      ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = m.kind === 'stalker' ? '#f59e0b' : '#f43f5e';
      ctx.fillRect(bx, by, bw * Math.max(0, m.hp / m.maxHp), bh);
    }
  },

  _drawCaveKrakenBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(boss.x);
    const sy = toScreenY(boss.y);
    const r = boss.radius * scale;
    const alpha = boss.defeated ? Math.max(0, boss.defeatAnimSec / 3.2) : 1;
    const flash = boss.hitFlash > 0;
    const rageCol = boss.phase === 3 ? '#f43f5e' : boss.phase === 2 ? '#c084fc' : '#22d3ee';
    const bodyBase = boss.phase === 3 ? '#4c0519' : boss.phase === 2 ? '#2e1065' : '#172554';
    const bodyMid = boss.phase === 3 ? '#881337' : boss.phase === 2 ? '#4c1d95' : '#1e1b4b';
    const breathe = 1 + Math.sin(timeSec * 2.2) * 0.035;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(sx, sy);

    // 1. Six Tapered Multi-Segment Articulated Muscular Tentacles + Bioluminescent Sucker Orbs
    for (const t of boss.tentacles || []) {
      const isSlam = boss.aiState === 'slam_windup' || boss.aiState === 'slam_strike';
      const baseA = isSlam
        ? boss.slamTargetAngle + (t.index - 2.5) * 0.28
        : t.baseAngle + Math.sin(t.waveOffset * 0.55) * 0.26;
      const reachPx = t.reach * scale * (boss.aiState === 'slam_strike' ? 1.42 : 1.05);
      const segs = 7;
      const pts = [];
      for (let s = 0; s <= segs; s++) {
        const u = s / segs;
        const bend = Math.sin(t.waveOffset + u * 2.4) * 0.34 * u + Math.cos(t.waveOffset * 0.7 - u * 1.9) * 0.16 * u * u;
        const dist = r * 0.55 + u * (reachPx - r * 0.45);
        pts.push({
          x: Math.cos(baseA + bend) * dist,
          y: Math.sin(baseA + bend) * dist,
          w: Math.max(2.2, (0.62 - u * 0.50) * scale),
        });
      }
      ctx.lineCap = 'round';
      for (let s = 0; s < segs; s++) {
        const a = pts[s];
        const b = pts[s + 1];
        ctx.strokeStyle = isSlam ? '#7f1d1d' : bodyBase;
        ctx.lineWidth = a.w;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        // Highlight dorsal edge
        ctx.strokeStyle = isSlam ? 'rgba(251, 113, 133, 0.55)' : 'rgba(129, 140, 248, 0.38)';
        ctx.lineWidth = Math.max(1.2, a.w * 0.28);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        // Glowing bioluminescent sucker orbs along the underside
        if (s >= 1 && s <= segs - 1) {
          ctx.fillStyle = isSlam ? '#fda4af' : rageCol;
          ctx.beginPath();
          ctx.arc(a.x, a.y, Math.max(1.8, a.w * 0.24), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 2. Sculpted Abyssal Cephalopod Mantle Hood + Undulating Lateral Fins (aligned opposite aggro)
    ctx.save();
    ctx.rotate(boss.angle + Math.PI); // Hood points away from eyes, crown faces target
    const finWave = Math.sin(timeSec * 3.1) * 0.16 * r;
    // Lateral undulating mantle fins
    ctx.fillStyle = bodyBase;
    ctx.strokeStyle = rageCol;
    ctx.lineWidth = Math.max(1.5, 0.06 * scale);
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(r * 0.35, sgn * r * 0.52);
      ctx.quadraticCurveTo(r * 1.05, sgn * (r * 1.18 + finWave * sgn), r * 1.38, sgn * r * 0.36);
      ctx.quadraticCurveTo(r * 1.02, sgn * r * 0.18, r * 0.35, sgn * r * 0.52);
      ctx.fill();
      ctx.stroke();
    }

    // Main sculpted pear-shaped Kraken mantle dome
    const mg = ctx.createRadialGradient(-r * 0.2, -r * 0.22, r * 0.12, r * 0.15, 0, r * 1.35);
    mg.addColorStop(0, bodyMid);
    mg.addColorStop(0.58, bodyBase);
    mg.addColorStop(1, '#050816');
    ctx.fillStyle = mg;
    ctx.strokeStyle = flash ? '#ffffff' : rageCol;
    ctx.lineWidth = Math.max(2.2, (flash ? 0.18 : 0.09) * scale);
    ctx.beginPath();
    ctx.moveTo(-r * 0.92 * breathe, 0);
    ctx.bezierCurveTo(-r * 0.92, -r * 0.96, r * 0.45, -r * 1.08 * breathe, r * 1.32 * breathe, 0);
    ctx.bezierCurveTo(r * 0.45, r * 1.08 * breathe, -r * 0.92, r * 0.96, -r * 0.92 * breathe, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pulsing bioluminescent chromatophore ridge veins across the hood
    const veinAlpha = (0.45 + 0.35 * Math.sin(timeSec * 4.2)).toFixed(2);
    ctx.strokeStyle = boss.phase === 3 ? `rgba(251, 113, 133, ${veinAlpha})` : boss.phase === 2 ? `rgba(192, 132, 252, ${veinAlpha})` : `rgba(34, 211, 238, ${veinAlpha})`;
    ctx.lineWidth = Math.max(1.6, 0.065 * scale);
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, sgn * r * 0.22);
      ctx.quadraticCurveTo(r * 0.25, sgn * r * 0.62, r * 1.02, sgn * r * 0.16);
      ctx.stroke();
    }
    if (flash) {
      // Crisp translucent rim flash on damage without obscuring boss silhouette!
      ctx.fillStyle = 'rgba(224, 242, 254, 0.28)';
      ctx.fill();
    }
    ctx.restore();

    // 3. Twin Fierce Armored-Brow Bioluminescent Eyes facing aggro angle
    const ex = Math.cos(boss.angle) * r * 0.48;
    const ey = Math.sin(boss.angle) * r * 0.48;
    const px = -Math.sin(boss.angle) * r * 0.34;
    const py = Math.cos(boss.angle) * r * 0.34;
    for (const sgn of [-1, 1]) {
      const cx = ex + px * sgn;
      const cy = ey + py * sgn;
      // Dark orbital socket
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 0.22, r * 0.15, boss.angle, 0, Math.PI * 2);
      ctx.fill();
      // Glowing molten amber-crimson iris
      const eg = ctx.createRadialGradient(cx, cy, r * 0.02, cx, cy, r * 0.18);
      eg.addColorStop(0, '#fef08a');
      eg.addColorStop(0.55, boss.phase === 3 ? '#f43f5e' : '#f59e0b');
      eg.addColorStop(1, '#7c2d12');
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 0.17, r * 0.11, boss.angle, 0, Math.PI * 2);
      ctx.fill();
      // Vertical razor slit pupil
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(boss.angle);
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.032, r * 0.095, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  },

  /**
   * Emissive (post-lighting) pass: glowing sonar veil fracture lines, Kraken mantle weak-point core,
   * telegraphed slam cones, vortex rings, ink projectiles, tethered speargun bolts, charge sightline,
   * floating crit sparks, post-victory updraft & the Top-Center Boss Health Bar!
   */
  _drawSecretLairEmissive(ctx, cw, ch, diver, toScreenX, toScreenY, scale, timeSec, lair) {
    if (!lair?.spec) return;
    const dpr = this._cachedDpr || 1;
    const { spec, boss } = lair;

    // 1. Subtle Sonar-Revealed Tight-Squeeze Hairline Fissure (ZERO text callout!)
    if (lair.veilRevealed && !lair.veilBreached) {
      const v = spec.veil;
      const sx = toScreenX(v.x);
      const sy = toScreenY(v.y);
      const sr = v.radius * scale;
      const fade = Math.min(1, (lair.veilRevealPulse || 0) / 1.5 + 0.35);
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3.8);
      ctx.save();
      ctx.strokeStyle = `rgba(103, 232, 249, ${(fade * (0.28 + pulse * 0.34)).toFixed(2)})`;
      ctx.lineWidth = Math.max(1.4, 0.06 * scale);
      ctx.beginPath();
      ctx.moveTo(sx - sr * 0.38, sy - sr * 0.45);
      ctx.lineTo(sx - sr * 0.04, sy - sr * 0.05);
      ctx.lineTo(sx + sr * 0.34, sy + sr * 0.38);
      ctx.moveTo(sx - sr * 0.04, sy - sr * 0.05);
      ctx.lineTo(sx + sr * 0.35, sy - sr * 0.25);
      ctx.stroke();
      ctx.restore();
    }

    if (!lair.veilBreached) return;

    // 1b. Glowing Bioluminescent Cathedral Crystal Sconces (dynamic rim illumination!)
    for (let i = 0; i < (spec.arena?.lightSconces || []).length; i++) {
      const sc = spec.arena.lightSconces[i];
      const sx = toScreenX(sc.x);
      const sy = toScreenY(sc.y);
      const sr = (sc.radius || 13) * scale * 0.52;
      if (sx + sr < 0 || sx - sr > cw || sy + sr < 0 || sy - sr > ch) continue;
      const pulse = 0.72 + 0.28 * Math.sin(timeSec * 2.4 + i * 1.4);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const sg = ctx.createRadialGradient(sx, sy, 0.2 * scale, sx, sy, sr);
      sg.addColorStop(0, sc.color || '#38bdf8');
      sg.addColorStop(0.32, 'rgba(56, 189, 248, 0.24)');
      sg.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.globalAlpha = 0.44 * pulse;
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
      // Crystal cluster core
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.moveTo(sx, sy - 0.55 * scale);
      ctx.lineTo(sx + 0.3 * scale, sy);
      ctx.lineTo(sx, sy + 0.45 * scale);
      ctx.lineTo(sx - 0.3 * scale, sy);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 2. Glowing Speargun Armory Beacon in Quiet Anteroom (auto-equips on swim-over!)
    if (!lair.weaponEquipped && spec.armory) {
      const sx = toScreenX(spec.armory.x);
      const sy = toScreenY(spec.armory.y);
      const pulse = 0.6 + 0.4 * Math.sin(timeSec * 4.5);
      ctx.save();
      const ag = ctx.createRadialGradient(sx, sy, 0.2 * scale, sx, sy, 2.4 * scale);
      ag.addColorStop(0, 'rgba(56, 189, 248, 0.42)');
      ag.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.arc(sx, sy, 2.4 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(125, 211, 252, ${(0.5 + pulse * 0.45).toFixed(2)})`;
      ctx.lineWidth = Math.max(1.6, 0.07 * scale);
      ctx.beginPath();
      ctx.arc(sx, sy, (1.45 + pulse * 0.22) * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2b. Emerald Bio-Heal Orbs (dropped by slain enemies & phase transitions!)
    for (const orb of lair.healOrbs || []) {
      const ox = toScreenX(orb.x);
      const oy = toScreenY(orb.y);
      const r = (0.42 + 0.08 * Math.sin(timeSec * 7 + orb.phase)) * scale;
      ctx.save();
      const og = ctx.createRadialGradient(ox, oy, r * 0.15, ox, oy, r * 2.4);
      og.addColorStop(0, '#ecfdf5');
      og.addColorStop(0.4, '#34d399');
      og.addColorStop(1, 'rgba(16, 185, 129, 0)');
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(ox, oy, r * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#a7f3d0';
      ctx.lineWidth = Math.max(1.2, 0.05 * scale);
      ctx.beginPath();
      ctx.moveTo(ox - r * 0.55, oy);
      ctx.lineTo(ox + r * 0.55, oy);
      ctx.moveTo(ox, oy - r * 0.55);
      ctx.lineTo(ox, oy + r * 0.55);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Boss Emissive Attacks, Weak-Point Mantle Core & Stun/Lunge Indicators
    if (boss && boss.active && !boss.defeated) {
      const bx = toScreenX(boss.x);
      const by = toScreenY(boss.y);

      if (boss.blackoutAlpha > 0.02) {
        ctx.save();
        ctx.fillStyle = `rgba(10, 4, 24, ${(boss.blackoutAlpha * 0.48).toFixed(3)})`;
        ctx.fillRect(0, 0, cw, ch);
        ctx.restore();
      }

      // Kraken Lunge Dash Lane Telegraph (crystal-clear glowing rush path!)
      if (boss.aiState === 'lunge_windup' || boss.aiState === 'lunge_dash') {
        const dx = toScreenX(boss.lungeDestX);
        const dy = toScreenY(boss.lungeDestY);
        const isDash = boss.aiState === 'lunge_dash';
        ctx.save();
        ctx.strokeStyle = isDash ? 'rgba(244, 63, 94, 0.72)' : 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = boss.radius * 1.45 * scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(dx, dy);
        ctx.stroke();
        ctx.strokeStyle = isDash ? '#fda4af' : '#bae6fd';
        ctx.lineWidth = Math.max(2, 0.1 * scale);
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(dx, dy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Telegraphed Tentacle Slam Cone (Single in P1/P2, Twin Crossing Lanes in P3!)
      if (boss.aiState === 'slam_windup' || boss.aiState === 'slam_strike') {
        const isStrike = boss.aiState === 'slam_strike';
        const rad = boss.slamRadius * scale;
        const slamAngles = boss.twinSlam
          ? [boss.slamTargetAngle - 0.58, boss.slamTargetAngle + 0.58]
          : [boss.slamTargetAngle];
        const halfArc = boss.twinSlam ? 0.36 : boss.slamArcHalf;
        ctx.save();
        ctx.fillStyle = isStrike ? 'rgba(244, 63, 94, 0.36)' : 'rgba(251, 146, 60, 0.18)';
        ctx.strokeStyle = isStrike ? 'rgba(254, 202, 202, 0.94)' : 'rgba(251, 191, 36, 0.88)';
        ctx.lineWidth = Math.max(2, 0.09 * scale);
        for (const sa of slamAngles) {
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.arc(bx, by, rad, sa - halfArc, sa + halfArc);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }

      // Phase 2/3 Abyssal Suction Vortex Rings
      if (boss.aiState === 'vortex' && boss.vortexStrength > 0) {
        ctx.save();
        for (let k = 0; k < 4; k++) {
          const frac = ((timeSec * 0.95 + k * 0.25) % 1);
          const vr = (1 - frac) * 24 * scale + boss.radius * scale;
          ctx.strokeStyle = `rgba(192, 132, 252, ${(frac * 0.58).toFixed(2)})`;
          ctx.lineWidth = Math.max(2, 0.09 * scale);
          ctx.beginPath();
          ctx.arc(bx, by, vr, timeSec * 2 + k, timeSec * 2 + k + Math.PI * 1.4);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Stunned Kraken Ring (huge open 2x damage window!)
      if (boss.aiState === 'stunned') {
        ctx.save();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = Math.max(2.6, 0.12 * scale);
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(bx, by, (boss.radius + 1.1) * scale, timeSec * 3, timeSec * 3 + Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Glowing Tentacle Grab Tether
      if (boss.pinnedTargetId === 'local' && diver) {
        ctx.save();
        ctx.strokeStyle = '#fb7185';
        ctx.lineWidth = Math.max(4, 0.24 * scale);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(toScreenX(diver.x), toScreenY(diver.y));
        ctx.stroke();
        ctx.font = `800 ${Math.max(11, Math.round(12 * dpr))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fde047';
        ctx.fillText(`TAP FIRE TO BREAK (${boss.pinHitsNeeded || 1})`, toScreenX(diver.x), toScreenY(diver.y) - 24 * dpr);
        ctx.restore();
      }

      // Glowing Exposed Mantle Weak-Point Core (blazes brightly!)
      const coreX = toScreenX(boss.x + Math.cos(boss.weakAngle) * (boss.radius * 0.56));
      const coreY = toScreenY(boss.y + Math.sin(boss.weakAngle) * (boss.radius * 0.56));
      const stunnedBoost = boss.aiState === 'stunned' ? 1.35 : 1.0;
      const coreR = (1.1 + 0.2 * Math.sin(timeSec * 8)) * scale * stunnedBoost;
      ctx.save();
      const cg = ctx.createRadialGradient(coreX, coreY, coreR * 0.1, coreX, coreY, coreR * 1.9);
      cg.addColorStop(0, '#ffffff');
      cg.addColorStop(0.35, boss.aiState === 'stunned' ? '#fde047' : boss.phase === 3 ? '#f472b6' : '#38bdf8');
      cg.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(coreX, coreY, coreR * 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = Math.max(1.6, 0.07 * scale);
      ctx.beginPath();
      ctx.arc(coreX, coreY, coreR * 0.92, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Post-Victory Bioluminescent Escape Updraft
    if (lair.bossDefeated && spec.arena.exitUpdraft) {
      const up = spec.arena.exitUpdraft;
      const ux = toScreenX(up.x);
      const uy = toScreenY(up.y);
      const ur = up.radius * scale;
      const pulse = 0.65 + 0.35 * Math.sin(timeSec * 4.5);
      ctx.save();
      const ug = ctx.createRadialGradient(ux, uy, ur * 0.15, ux, uy, ur * 1.35);
      ug.addColorStop(0, 'rgba(103, 232, 249, 0.85)');
      ug.addColorStop(0.55, 'rgba(52, 211, 153, 0.4)');
      ug.addColorStop(1, 'rgba(52, 211, 153, 0)');
      ctx.fillStyle = ug;
      ctx.beginPath();
      ctx.arc(ux, uy, ur * 1.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(167, 243, 208, ${(0.55 + pulse * 0.4).toFixed(2)})`;
      ctx.lineWidth = Math.max(2, 0.09 * scale);
      ctx.beginPath();
      ctx.arc(ux, uy, ur * (0.85 + pulse * 0.12), 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = `800 ${Math.max(10, Math.round(11 * dpr))}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#a7f3d0';
      ctx.fillText('✨ UPDRAFT → 6m DECO [E]', ux, uy - ur - 8 * dpr);
      ctx.restore();
    }

    // 5. Enemy Ink / Brine Projectiles
    for (const pr of lair.enemyProjectiles || []) {
      const px = toScreenX(pr.x);
      const py = toScreenY(pr.y);
      const prR = pr.radius * scale;
      ctx.save();
      const pg = ctx.createRadialGradient(px, py, prR * 0.1, px, py, prR * 1.9);
      pg.addColorStop(0, '#ffffff');
      pg.addColorStop(0.4, pr.color || '#c084fc');
      pg.addColorStop(1, 'rgba(192, 132, 252, 0)');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(px, py, prR * 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 6. Diver Speargun Charge Sightline & Tethered Titanium Bolts
    if (lair.weaponEquipped && lair.charging && diver) {
      const cFrac = Math.min(1, lair.chargeSec / SPEARGUN_MAX_CHARGE_SEC);
      const dx = toScreenX(diver.x);
      const dy = toScreenY(diver.y);
      const aim = diver.torchAngle ?? diver.angle ?? 0;
      const len = (5 + cFrac * 11) * scale;
      ctx.save();
      ctx.strokeStyle = cFrac >= 0.72 ? 'rgba(250, 204, 21, 0.85)' : 'rgba(56, 189, 248, 0.65)';
      ctx.lineWidth = Math.max(1.6, (0.06 + cFrac * 0.08) * scale);
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(dx + Math.cos(aim) * scale * 0.9, dy + Math.sin(aim) * scale * 0.9);
      ctx.lineTo(dx + Math.cos(aim) * len, dy + Math.sin(aim) * len);
      ctx.stroke();
      ctx.setLineDash([]);
      // Charge ring around diver
      ctx.strokeStyle = cFrac >= 0.72 ? '#fde047' : '#38bdf8';
      ctx.lineWidth = Math.max(2.2, 0.1 * scale);
      ctx.beginPath();
      ctx.arc(dx, dy, 1.25 * scale, -Math.PI * 0.5, -Math.PI * 0.5 + cFrac * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const sp of lair.spears || []) {
      const sx = toScreenX(sp.x);
      const sy = toScreenY(sp.y);
      const ox = toScreenX(sp.originX);
      const oy = toScreenY(sp.originY);
      ctx.save();
      // Braided tether cord trailing back
      ctx.strokeStyle = sp.piercing ? 'rgba(253, 224, 71, 0.45)' : 'rgba(186, 230, 253, 0.32)';
      ctx.lineWidth = Math.max(1, 0.04 * scale);
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(sx, sy);
      ctx.stroke();

      // Gleaming titanium spear shaft + barbed tip
      ctx.translate(sx, sy);
      ctx.rotate(sp.angle || 0);
      ctx.strokeStyle = sp.piercing ? '#fde047' : '#e0f2fe';
      ctx.lineWidth = Math.max(2.4, (sp.charged ? 0.13 : 0.09) * scale);
      ctx.beginPath();
      ctx.moveTo(-0.85 * scale, 0);
      ctx.lineTo(0.45 * scale, 0);
      ctx.stroke();
      ctx.fillStyle = sp.piercing ? '#fef08a' : '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(0.75 * scale, 0);
      ctx.lineTo(0.25 * scale, -0.22 * scale);
      ctx.lineTo(0.25 * scale, 0.22 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 7. Hit Sparks & Floating Damage / Crit Callouts
    for (const sk of lair.hitSparks || []) {
      const sx = toScreenX(sk.x);
      const sy = toScreenY(sk.y);
      const a = Math.max(0, Math.min(1, sk.life / (sk.maxLife || 0.7)));
      ctx.save();
      ctx.globalAlpha = a;
      if (sk.text) {
        ctx.font = `800 ${Math.max(11, Math.round((sk.crit ? 14 : 11) * dpr))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = sk.color || '#38bdf8';
        ctx.fillText(sk.text, sx, sy - (1 - a) * 18 * dpr);
      } else {
        ctx.fillStyle = sk.color || '#38bdf8';
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(2, 0.09 * scale * a), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 8. Combat Hit Vignette & Top-Center Epic Boss Health Bar (positioned cleanly at top in Combat Mode!)
    if (lair.playerHitFlash > 0.02) {
      ctx.save();
      const hitA = Math.min(0.45, lair.playerHitFlash * 1.2);
      ctx.strokeStyle = `rgba(244, 63, 94, ${hitA.toFixed(2)})`;
      ctx.lineWidth = Math.max(16, 22 * dpr);
      ctx.strokeRect(0, 0, cw, ch);
      ctx.restore();
    }

    if (boss && boss.active && !boss.defeated) {
      const barW = Math.min(cw - 48 * dpr, 480 * dpr);
      const barH = 13 * dpr;
      const bx = Math.round((cw - barW) * 0.5);
      const by = Math.round((lair.combatMode ? 38 : (cw < ch ? 114 : 78)) * dpr);
      const hpRatio = Math.max(0, Math.min(1, boss.hp / Math.max(1, boss.maxHp)));

      ctx.save();
      ctx.fillStyle = 'rgba(4, 12, 26, 0.86)';
      ctx.strokeStyle = boss.aiState === 'stunned' ? 'rgba(250, 204, 21, 0.85)' : boss.phase === 3 ? 'rgba(244, 63, 94, 0.82)' : 'rgba(56, 189, 248, 0.62)';
      ctx.lineWidth = Math.max(1.2, 1.4 * dpr);
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(bx - 14 * dpr, by - 24 * dpr, barW + 28 * dpr, barH + 36 * dpr, 10 * dpr);
      } else {
        ctx.rect(bx - 14 * dpr, by - 24 * dpr, barW + 28 * dpr, barH + 36 * dpr);
      }
      ctx.fill();
      ctx.stroke();

      ctx.font = `800 ${Math.round(11.5 * dpr)}px ui-monospace, monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f8fafc';
      const statusTag = boss.aiState === 'stunned' ? ' · ⚡ STUNNED!' : ` · PHASE ${boss.phase}/3`;
      ctx.fillText(`🐙 ${boss.name}${statusTag}`, bx, by - 11 * dpr);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fde68a';
      ctx.fillText(lair.scaling.label, bx + barW, by - 11 * dpr);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(bx, by, barW, barH);
      const hg = ctx.createLinearGradient(bx, by, bx + barW, by);
      hg.addColorStop(0, '#ef4444');
      hg.addColorStop(0.5, '#c084fc');
      hg.addColorStop(1, '#38bdf8');
      ctx.fillStyle = hg;
      ctx.fillRect(bx, by, barW * hpRatio, barH);

      ctx.strokeStyle = 'rgba(248, 250, 252, 0.78)';
      ctx.lineWidth = Math.max(1, 1.3 * dpr);
      for (const mark of [0.33, 0.66]) {
        const mx = bx + barW * mark;
        ctx.beginPath();
        ctx.moveTo(mx, by);
        ctx.lineTo(mx, by + barH);
        ctx.stroke();
      }
      ctx.restore();
    }
  },
};
