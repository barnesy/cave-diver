/**
 * Secret Lair, Pneumatic Speargun & Colossal Cave Kraken Boss Renderer (v182).
 * Mixed onto CaveRenderer.prototype alongside chunkBaker, surfaceRenderer,
 * wreckAndInteractivesRenderer, and lightingAndFxRenderer.
 */

import { wreckAndInteractivesMethods } from './wreckAndInteractivesRenderer.js';
import { drawDetailedSpeargun } from '../artSprites.js';

function getPhasePalette(phase) {
  if (phase >= 3) {
    return {
      accent: '#f43f5e',
      accentSoft: 'rgba(244, 63, 94, 0.28)',
      glow: '#fda4af',
      sconce: '#fb7185',
      bodyBase: '#4c0519',
      bodyMid: '#881337',
    };
  }
  if (phase === 2) {
    return {
      accent: '#c084fc',
      accentSoft: 'rgba(192, 132, 252, 0.26)',
      glow: '#e9d5ff',
      sconce: '#c084fc',
      bodyBase: '#2e1065',
      bodyMid: '#4c1d95',
    };
  }
  return {
    accent: '#22d3ee',
    accentSoft: 'rgba(34, 211, 238, 0.24)',
    glow: '#a5f3fc',
    sconce: '#38bdf8',
    bodyBase: '#172554',
    bodyMid: '#1e1b4b',
  };
}

export const bossAndLairMethods = {
  /**
   * World-space (pre-lighting) pass: solid false limestone veil, corridor environmental storytelling,
   * sculpted cover pillars with Resonance Crystals, armory rack, bailout stages, lesser enemies,
   * Ossuary foreshadowing silhouette & the sculpted Cave Kraken (*XIBALBA'S MAW*).
   */
  _drawSecretLairWorld(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, lair) {
    if (!lair?.spec) return;
    const { spec, boss } = lair;

    // 1. Sealed False Limestone Veil (blends seamlessly into cave rock before breached!)
    if (!lair.veilBreached) {
      const v = spec.veil;
      if (v.x + v.radius + 3 >= visX0 && v.x - v.radius - 3 <= visX1 && v.y + v.radius + 3 >= visY0 && v.y - v.radius - 3 <= visY1) {
        const sx = toScreenX(v.x);
        const sy = toScreenY(v.y);
        const sr = (v.radius + 1.05) * scale;
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
      return;
    }

    // 1b. Corridor Environmental Storytelling Landmarks (v182)
    this._drawSecretLairLandmarks(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, lair);

    // 1c. Ossuary Kraken Shadow Foreshadowing (colossal darkened tentacle sweeps past background!)
    if ((lair.foreshadowTimer || 0) > 0) {
      const frac = 1 - lair.foreshadowTimer / 3.2;
      const fx = toScreenX(198 + frac * 22);
      const fy = toScreenY(45.5 + Math.sin(frac * Math.PI) * 2.5);
      const alpha = Math.sin(frac * Math.PI) * 0.42;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.strokeStyle = '#020617';
      ctx.lineCap = 'round';
      for (let s = 0; s < 5; s++) {
        const u = s / 5;
        ctx.lineWidth = Math.max(8, (2.6 - u * 1.9) * scale);
        ctx.beginPath();
        ctx.moveTo(fx - u * 11 * scale, fy + Math.sin(timeSec * 2 + s) * 1.4 * scale);
        ctx.lineTo(fx - (u + 0.24) * 11 * scale, fy + Math.sin(timeSec * 2 + s + 1) * 1.6 * scale);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. Sculpted Arena Natural Limestone Cover Pillars + Resonance Crystal Pedestals
    const crystals = lair.pillarCrystals || [];
    for (let pi = 0; pi < (spec.arena.pillars || []).length; pi++) {
      const p = spec.arena.pillars[pi];
      if (p.x + p.radius + 3 < visX0 || p.x - p.radius - 3 > visX1 || p.y + p.radius + 3 < visY0 || p.y - p.radius - 3 > visY1) continue;
      const sx = toScreenX(p.x);
      const sy = toScreenY(p.y);
      const sr = p.radius * scale;
      const pc = crystals[pi] || null;
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
      ctx.strokeStyle = pc && pc.charge > 0 ? 'rgba(103, 232, 249, 0.72)' : 'rgba(148, 163, 184, 0.32)';
      ctx.lineWidth = Math.max(1.2, 0.06 * scale);
      ctx.stroke();
      // Carved stone socket for the Resonance Crystal
      ctx.fillStyle = 'rgba(15, 23, 42, 0.62)';
      ctx.beginPath();
      ctx.arc(0, 0, sr * 0.48, 0, Math.PI * 2);
      ctx.fill();
      // Crystalline quartz cluster inside the pillar crown
      const isCooling = pc && pc.cooldownSec > 0;
      const crysCol = isCooling ? '#334155' : pc?.charge >= 2 ? '#67e8f9' : pc?.charge === 1 ? '#38bdf8' : '#0284c7';
      ctx.fillStyle = crysCol;
      ctx.strokeStyle = isCooling ? '#475569' : '#e0f2fe';
      ctx.lineWidth = Math.max(1.1, 0.045 * scale);
      for (let k = -1; k <= 1; k++) {
        ctx.save();
        ctx.rotate(k * 0.42);
        const h = (k === 0 ? 0.56 : 0.4) * sr;
        const w = 0.16 * sr;
        ctx.beginPath();
        ctx.moveTo(0, -h);
        ctx.lineTo(w, 0);
        ctx.lineTo(0, h * 0.48);
        ctx.lineTo(-w, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    // 3. Salvaged Expedition Armory Cradle (High-Detail Mounted-Torch Titanium Speargun)
    const arm = spec.armory;
    if (arm && arm.x + 5 >= visX0 && arm.x - 5 <= visX1 && arm.y + 5 >= visY0 && arm.y - 5 <= visY1) {
      const sx = toScreenX(arm.x);
      const sy = toScreenY(arm.y);
      ctx.save();
      ctx.translate(sx, sy);
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
      if (boss.x + 18 >= visX0 && boss.x - 18 <= visX1 && boss.y + 18 >= visY0 && boss.y - 18 <= visY1) {
        this._drawCaveKrakenBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec);
      }
    }
  },

  _drawSecretLairLandmarks(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, lair) {
    const landmarks = lair.spec?.landmarks;
    if (!Array.isArray(landmarks)) return;
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if (lm.x + 6 < visX0 || lm.x - 6 > visX1 || lm.y + 6 < visY0 || lm.y - 6 > visY1) continue;
      const sx = toScreenX(lm.x);
      const sy = toScreenY(lm.y);
      ctx.save();
      ctx.translate(sx, sy);
      if (lm.kind === 'expedition-crate') {
        ctx.fillStyle = '#3f3f46';
        ctx.strokeStyle = '#71717a';
        ctx.lineWidth = Math.max(1.2, 0.05 * scale);
        ctx.fillRect(-1.1 * scale, -0.55 * scale, 2.2 * scale, 1.1 * scale);
        ctx.strokeRect(-1.1 * scale, -0.55 * scale, 2.2 * scale, 1.1 * scale);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-0.85 * scale, -0.1 * scale, 1.7 * scale, 0.2 * scale);
      } else if (lm.kind === 'dive-strobe') {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-0.18 * scale, -0.4 * scale, 0.36 * scale, 0.8 * scale);
        const blink = Math.sin(timeSec * 6.5) > 0.55 ? 0.95 : 0.2;
        ctx.fillStyle = `rgba(250, 204, 21, ${blink.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(0, -0.4 * scale, 0.24 * scale, 0, Math.PI * 2);
        ctx.fill();
      } else if (lm.kind === 'thermal-vent') {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(-1.1 * scale, 0.7 * scale);
        ctx.lineTo(-0.45 * scale, -0.9 * scale);
        ctx.lineTo(0.45 * scale, -0.9 * scale);
        ctx.lineTo(1.1 * scale, 0.7 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.26)';
        ctx.beginPath();
        ctx.ellipse(0, -1.2 * scale, 0.55 * scale, 0.9 * scale, Math.sin(timeSec * 2) * 0.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (lm.kind === 'sea-whips' || lm.kind === 'bio-coral') {
        const col = lm.kind === 'bio-coral' ? '#2dd4bf' : '#38bdf8';
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(1.4, 0.07 * scale);
        for (let k = -2; k <= 2; k++) {
          const sway = Math.sin(timeSec * 2.1 + k + i) * 0.35 * scale;
          ctx.beginPath();
          ctx.moveTo(k * 0.32 * scale, 0.5 * scale);
          ctx.quadraticCurveTo(k * 0.45 * scale + sway, -0.5 * scale, k * 0.52 * scale - sway * 0.5, -1.45 * scale);
          ctx.stroke();
        }
      } else if (lm.kind === 'brine-pool') {
        const w = (lm.width || 6) * scale * 0.5;
        const bg = ctx.createLinearGradient(0, -0.5 * scale, 0, 0.9 * scale);
        bg.addColorStop(0, 'rgba(52, 211, 153, 0.42)');
        bg.addColorStop(1, 'rgba(6, 78, 59, 0.12)');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.ellipse(0, 0.15 * scale, w, 0.65 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (lm.kind === 'rib-arch') {
        const sc = (lm.scale || 1) * scale;
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.42)';
        ctx.lineWidth = Math.max(2.5, 0.24 * sc);
        ctx.lineCap = 'round';
        for (const sgn of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sgn * 0.4 * sc, 2.8 * sc);
          ctx.quadraticCurveTo(sgn * 2.6 * sc, 0.2 * sc, sgn * 0.6 * sc, -2.5 * sc);
          ctx.stroke();
        }
      } else if (lm.kind === 'vintage-helmet') {
        ctx.fillStyle = '#92400e';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = Math.max(1.2, 0.05 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, 0.55 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0.12 * scale, -0.04 * scale, 0.24 * scale, 0, Math.PI * 2);
        ctx.fill();
      } else if (lm.kind === 'mayan-glyphs') {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.36)';
        ctx.lineWidth = Math.max(1.2, 0.055 * scale);
        ctx.strokeRect(-1.4 * scale, -0.9 * scale, 2.8 * scale, 1.8 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, 0.5 * scale, 0, Math.PI * 2);
        ctx.moveTo(-1.1 * scale, 0);
        ctx.lineTo(1.1 * scale, 0);
        ctx.stroke();
      } else if (lm.kind === 'claw-scars') {
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
        ctx.lineWidth = Math.max(1.6, 0.08 * scale);
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(-1.6 * scale, (k * 0.45 - 0.5) * scale);
          ctx.quadraticCurveTo(0, k * 0.35 * scale, 1.7 * scale, (k * 0.45 + 0.65) * scale);
          ctx.stroke();
        }
      } else if (lm.kind === 'temple-column') {
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
        ctx.lineWidth = Math.max(1.2, 0.05 * scale);
        ctx.fillRect(-0.55 * scale, -2.8 * scale, 1.1 * scale, 5.6 * scale);
        ctx.strokeRect(-0.55 * scale, -2.8 * scale, 1.1 * scale, 5.6 * scale);
      } else if (lm.kind === 'monolith') {
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
        ctx.lineWidth = Math.max(1.8, 0.08 * scale);
        ctx.beginPath();
        ctx.moveTo(-0.9 * scale, -2.2 * scale);
        ctx.lineTo(0.9 * scale, -1.7 * scale);
        ctx.lineTo(1.1 * scale, 2.1 * scale);
        ctx.lineTo(-1.1 * scale, 2.1 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, -0.2 * scale, 0.22 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
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
      const pts = [];
      for (let seg = 0; seg <= 6; seg++) {
        pts.push({
          x: -seg * r * 0.42,
          y: Math.sin(m.wigglePhase - seg * 0.85) * r * (0.14 + seg * 0.055),
          w: r * (0.46 - seg * 0.055),
        });
      }
      ctx.strokeStyle = m.state === 'telegraph' ? 'rgba(248, 113, 113, 0.82)' : 'rgba(56, 189, 248, 0.68)';
      ctx.lineWidth = Math.max(2, 0.12 * scale);
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const px = pts[i].x;
        const py = pts[i].y - pts[i].w * 0.95;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
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
      const jawOpen = m.state === 'telegraph' || m.state === 'lunge' ? 0.36 : 0.14;
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
      const glowR = r * (0.34 + 0.06 * Math.sin(timeSec * 8 + m.wigglePhase));
      const vg = ctx.createRadialGradient(-r * 0.18, 0, 0, -r * 0.18, 0, glowR * 1.4);
      vg.addColorStop(0, '#ecfccb');
      vg.addColorStop(0.5, '#a3e635');
      vg.addColorStop(1, 'rgba(132, 204, 22, 0)');
      ctx.fillStyle = vg;
      ctx.beginPath();
      ctx.arc(-r * 0.18, 0, glowR * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(r * 0.52, -r * 0.22, r * 0.11, 0, Math.PI * 2);
      ctx.arc(r * 0.52, r * 0.22, r * 0.11, 0, Math.PI * 2);
      ctx.fill();
    } else {
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
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
      ctx.lineWidth = Math.max(1.2, 0.05 * scale);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.66, -Math.PI * 0.55, Math.PI * 0.55);
      ctx.stroke();
      const ag = ctx.createRadialGradient(-r * 0.42, 0, r * 0.06, -r * 0.42, 0, r * 0.58);
      ag.addColorStop(0, '#fef08a');
      ag.addColorStop(0.55, '#f59e0b');
      ag.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.arc(-r * 0.42, 0, r * 0.58, 0, Math.PI * 2);
      ctx.fill();
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
    const alpha = boss.defeated ? Math.max(0, boss.defeatAnimSec / 3.4) : 1;
    const flash = boss.hitFlash > 0;
    const pal = getPhasePalette(boss.phase);
    const breathe = 1 + Math.sin(timeSec * 2.2) * 0.035;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(sx, sy);

    // 1. Six Smooth Articulated Tentacles with State-Specific Poses!
    const isSlam = boss.aiState === 'slam_windup' || boss.aiState === 'slam_strike';
    const isLunge = boss.aiState === 'lunge_windup' || boss.aiState === 'lunge_dash';
    const isVortex = boss.aiState === 'vortex';
    const isStunned = boss.aiState === 'stunned';
    for (const t of boss.tentacles || []) {
      let baseA;
      if (isSlam) {
        baseA = boss.slamTargetAngle + (t.index - 2.5) * (boss.aiState === 'slam_windup' ? 0.42 : 0.24);
      } else if (isLunge) {
        // Stream torpedo-like behind the Kraken during lunge!
        baseA = boss.angle + Math.PI + (t.index - 2.5) * 0.16;
      } else if (isVortex) {
        baseA = t.baseAngle + timeSec * 1.9;
      } else if (isStunned) {
        baseA = Math.PI * 0.5 + (t.index - 2.5) * 0.34;
      } else {
        baseA = t.baseAngle + Math.sin(t.waveOffset * 0.55) * 0.26;
      }
      const reachMult = boss.aiState === 'slam_strike' ? 1.44 : boss.aiState === 'slam_windup' ? 0.85 : isLunge ? 1.25 : 1.05;
      const reachPx = t.reach * scale * reachMult;
      const segs = 7;
      const pts = [];
      for (let s = 0; s <= segs; s++) {
        const u = s / segs;
        const bendAmp = isStunned ? 0.12 : isVortex ? 0.55 : 0.34;
        const bend = Math.sin(t.waveOffset + u * 2.4) * bendAmp * u + Math.cos(t.waveOffset * 0.7 - u * 1.9) * 0.15 * u * u;
        const dist = r * 0.52 + u * (reachPx - r * 0.42);
        pts.push({
          x: Math.cos(baseA + bend) * dist,
          y: Math.sin(baseA + bend) * dist,
          w: Math.max(2.2, (0.64 - u * 0.52) * scale),
        });
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let s = 0; s < segs; s++) {
        const a = pts[s];
        const b = pts[s + 1];
        ctx.strokeStyle = isSlam ? '#7f1d1d' : pal.bodyBase;
        ctx.lineWidth = a.w;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        ctx.strokeStyle = isSlam ? 'rgba(251, 113, 133, 0.58)' : 'rgba(129, 140, 248, 0.38)';
        ctx.lineWidth = Math.max(1.2, a.w * 0.28);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        if (s >= 1 && s <= segs - 1) {
          ctx.fillStyle = isSlam ? '#fda4af' : pal.accent;
          ctx.beginPath();
          ctx.arc(a.x, a.y, Math.max(1.8, a.w * 0.24), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 2. Sculpted Abyssal Cephalopod Mantle Hood + Lateral Fins
    ctx.save();
    ctx.rotate(boss.angle + Math.PI);
    const finWave = Math.sin(timeSec * 3.1) * 0.16 * r;
    ctx.fillStyle = pal.bodyBase;
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = Math.max(1.5, 0.06 * scale);
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(r * 0.35, sgn * r * 0.52);
      ctx.quadraticCurveTo(r * 1.05, sgn * (r * 1.18 + finWave * sgn), r * 1.38, sgn * r * 0.36);
      ctx.quadraticCurveTo(r * 1.02, sgn * r * 0.18, r * 0.35, sgn * r * 0.52);
      ctx.fill();
      ctx.stroke();
    }

    const mg = ctx.createRadialGradient(-r * 0.2, -r * 0.22, r * 0.12, r * 0.15, 0, r * 1.35);
    mg.addColorStop(0, pal.bodyMid);
    mg.addColorStop(0.58, pal.bodyBase);
    mg.addColorStop(1, '#050816');
    ctx.fillStyle = mg;
    ctx.strokeStyle = flash ? '#ffffff' : pal.accent;
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
      ctx.fillStyle = 'rgba(224, 242, 254, 0.28)';
      ctx.fill();
    }
    ctx.restore();

    // 2b. Sculpted Chitinous Beak / Abyssal Maw (opens wide during beam, vortex, ink barrage & awakening roar!)
    const mawOpen =
      boss.aiState === 'beam_windup' || boss.aiState === 'beam_sweep'
        ? 0.95
        : boss.aiState === 'vortex' || boss.aiState === 'ink_barrage' || boss.aiState === 'awakening'
          ? 0.72
          : 0.24;
    ctx.save();
    ctx.rotate(boss.angle);
    ctx.translate(r * 0.74, 0);
    // Glowing inner throat
    const throatR = r * (0.16 + mawOpen * 0.22);
    const tg = ctx.createRadialGradient(0, 0, throatR * 0.1, 0, 0, throatR);
    tg.addColorStop(0, '#ffffff');
    tg.addColorStop(0.45, pal.accent);
    tg.addColorStop(1, '#020617');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.arc(0, 0, throatR, 0, Math.PI * 2);
    ctx.fill();
    // Upper & lower curved obsidian beak mandibles
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = Math.max(1.2, 0.05 * scale);
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.12, sgn * r * 0.08);
      ctx.quadraticCurveTo(r * 0.18, sgn * r * (0.12 + mawOpen * 0.24), r * 0.34, sgn * r * (0.04 + mawOpen * 0.14));
      ctx.quadraticCurveTo(r * 0.12, sgn * r * (0.04 + mawOpen * 0.08), -r * 0.12, sgn * r * 0.08);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // 3. Twin Fierce Armored-Brow Bioluminescent Eyes facing aggro angle (snap open during Awakening!)
    const eyeOpen = boss.aiState === 'dormant' ? 0.15 : boss.aiState === 'awakening' ? Math.min(1, (boss.awakeningTimer || 0) * 2.2) : 1.0;
    const ex = Math.cos(boss.angle) * r * 0.45;
    const ey = Math.sin(boss.angle) * r * 0.45;
    const px = -Math.sin(boss.angle) * r * 0.34;
    const py = Math.cos(boss.angle) * r * 0.34;
    for (const sgn of [-1, 1]) {
      const cx = ex + px * sgn;
      const cy = ey + py * sgn;
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 0.22, r * 0.15 * eyeOpen, boss.angle, 0, Math.PI * 2);
      ctx.fill();
      if (eyeOpen > 0.2) {
        const eg = ctx.createRadialGradient(cx, cy, r * 0.02, cx, cy, r * 0.18);
        eg.addColorStop(0, '#fef08a');
        eg.addColorStop(0.55, boss.phase === 3 ? '#f43f5e' : '#f59e0b');
        eg.addColorStop(1, '#7c2d12');
        ctx.fillStyle = eg;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * 0.17, r * 0.11 * eyeOpen, boss.angle, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(boss.angle);
        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.032, r * 0.095 * eyeOpen, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
  },

  /**
   * Emissive (post-lighting) pass: sonar veil fracture, dynamic phase-shifted sconces, Resonance Crystal arcs,
   * Vortex cover wake, Sweeping Abyssal Beam, all attack telegraphs, outlined damage numbers, Hyper-Tip
   * spear indicator, cinematic Awakening / Phase title banners & Top-Center Boss Health Bar!
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
      const fade = Math.min(1, (lair.veilRevealPulse || 0) / 1.5 + 0.42);
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3.8);
      ctx.save();
      ctx.strokeStyle = `rgba(103, 232, 249, ${(fade * (0.36 + pulse * 0.4)).toFixed(2)})`;
      ctx.lineWidth = Math.max(1.6, 0.07 * scale);
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

    const phasePal = getPhasePalette(boss?.phase || 1);

    // 1b. Glowing Bioluminescent Cathedral Crystal Sconces (sequentially lit + phase-color shifted!)
    const litCount = lair.arenaEntered
      ? (Number.isFinite(lair.sconceLitCount) ? lair.sconceLitCount : (spec.arena?.lightSconces?.length || 6))
      : 0;
    for (let i = 0; i < (spec.arena?.lightSconces || []).length; i++) {
      if (i >= litCount) continue;
      const sc = spec.arena.lightSconces[i];
      const sx = toScreenX(sc.x);
      const sy = toScreenY(sc.y);
      const sr = (sc.radius || 13) * scale * 0.52;
      if (sx + sr < 0 || sx - sr > cw || sy + sr < 0 || sy - sr > ch) continue;
      const pulse = 0.72 + 0.28 * Math.sin(timeSec * 2.4 + i * 1.4);
      const sconceCol = boss?.phase >= 2 ? phasePal.sconce : (sc.color || '#38bdf8');
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const sg = ctx.createRadialGradient(sx, sy, 0.2 * scale, sx, sy, sr);
      sg.addColorStop(0, sconceCol);
      sg.addColorStop(0.34, phasePal.accentSoft);
      sg.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.globalAlpha = 0.48 * pulse;
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.92;
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

    // 1c. Pillar Resonance Crystal Charge Rings, Acoustic Arc Discharge & Vortex Hydrodynamic Shelter Wake!
    for (const pc of lair.pillarCrystals || []) {
      const px = toScreenX(pc.x);
      const py = toScreenY(pc.y);
      const pr = pc.radius * scale;
      if (px + pr * 3 < 0 || px - pr * 3 > cw || py + pr * 3 < 0 || py - pr * 3 > ch) continue;
      ctx.save();
      // Subtle ready crystal halo / charge segments (0..3)
      if (pc.cooldownSec <= 0) {
        const pulse = 0.55 + 0.45 * Math.sin(timeSec * 4.2 + pc.x);
        ctx.strokeStyle = pc.charge > 0 ? '#67e8f9' : `rgba(56, 189, 248, ${(0.35 + pulse * 0.25).toFixed(2)})`;
        ctx.lineWidth = Math.max(1.8, (pc.charge > 0 ? 0.11 : 0.065) * scale);
        for (let seg = 0; seg < pc.maxCharge; seg++) {
          const a0 = -Math.PI * 0.5 + (seg / pc.maxCharge) * Math.PI * 2 + 0.14;
          const a1 = -Math.PI * 0.5 + ((seg + 1) / pc.maxCharge) * Math.PI * 2 - 0.14;
          ctx.strokeStyle = seg < pc.charge ? '#fde047' : 'rgba(56, 189, 248, 0.36)';
          ctx.beginPath();
          ctx.arc(px, py, pr * 0.72, a0, a1);
          ctx.stroke();
        }
      }
      // Crackling electric Acoustic Arc from crystal -> Kraken!
      if (pc.dischargeAnimSec > 0 && pc.arcTargetX && pc.arcTargetY) {
        const tx = toScreenX(pc.arcTargetX);
        const ty = toScreenY(pc.arcTargetY);
        const a = Math.min(1, pc.dischargeAnimSec / 0.5);
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = Math.max(4, 0.24 * scale);
        ctx.beginPath();
        ctx.moveTo(px, py);
        for (let k = 1; k < 6; k++) {
          const f = k / 6;
          const jx = (Math.sin(timeSec * 45 + k * 7) * 0.75) * scale;
          const jy = (Math.cos(timeSec * 52 + k * 9) * 0.75) * scale;
          ctx.lineTo(px + (tx - px) * f + jx, py + (ty - py) * f + jy);
        }
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1.8, 0.09 * scale);
        ctx.stroke();
      }
      // Glowing cyan Hydrodynamic Cover Shield Arc behind sheltering pillar during Vortex!
      if (boss?.aiState === 'vortex' && lair.vortexShelteredPillarId === pc.id) {
        const awayAng = Math.atan2(pc.y - boss.y, pc.x - boss.x);
        ctx.strokeStyle = 'rgba(103, 232, 249, 0.88)';
        ctx.lineWidth = Math.max(3, 0.16 * scale);
        ctx.beginPath();
        ctx.arc(px, py, pr * 1.28, awayAng - 0.9, awayAng + 0.9);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 1d. Expanding Radial Shockwaves (Awakening, Phase Shifts, Resonance Break, Victory Bursts!)
    for (const sw of lair.shockwaves || []) {
      const sx = toScreenX(sw.x);
      const sy = toScreenY(sw.y);
      const a = Math.max(0, Math.min(1, sw.life / Math.max(0.05, sw.maxLife)));
      ctx.save();
      ctx.globalAlpha = a * 0.82;
      ctx.strokeStyle = sw.color || '#38bdf8';
      ctx.lineWidth = Math.max(2.5, (0.28 * a + 0.06) * scale);
      ctx.beginPath();
      ctx.arc(sx, sy, sw.radius * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Glowing Speargun Armory Beacon in Quiet Anteroom (auto-equips on swim-over!)
    if (!lair.weaponEquipped && spec.armory) {
      const sx = toScreenX(spec.armory.x);
      const sy = toScreenY(spec.armory.y);
      const pulse = 0.6 + 0.4 * Math.sin(timeSec * 4.5);
      ctx.save();
      const ag = ctx.createRadialGradient(sx, sy, 0.2 * scale, sx, sy, 2.5 * scale);
      ag.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
      ag.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(125, 211, 252, ${(0.5 + pulse * 0.45).toFixed(2)})`;
      ctx.lineWidth = Math.max(1.6, 0.07 * scale);
      ctx.beginPath();
      ctx.arc(sx, sy, (1.45 + pulse * 0.22) * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2b. Emerald Bio-Heal Orbs
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

    // 3. Boss Emissive Attacks, Weak-Point Mantle Core & Complete Telegraphs
    if (boss && boss.active && !boss.defeated) {
      const bx = toScreenX(boss.x);
      const by = toScreenY(boss.y);

      if (boss.blackoutAlpha > 0.02) {
        ctx.save();
        ctx.fillStyle = `rgba(10, 4, 24, ${(boss.blackoutAlpha * 0.45).toFixed(3)})`;
        ctx.fillRect(0, 0, cw, ch);
        ctx.restore();
      }

      // 3a. Pillar-Occluded Sweeping Bioluminescent Abyssal Beam (blasts straight from the sculpted beak/maw!)
      if (boss.aiState === 'beam_windup' || boss.aiState === 'beam_sweep') {
        const mx = bx + Math.cos(boss.beamAngle) * boss.radius * 0.78 * scale;
        const my = by + Math.sin(boss.beamAngle) * boss.radius * 0.78 * scale;
        const ex = toScreenX(boss.beamEndX);
        const ey = toScreenY(boss.beamEndY);
        const isFiring = boss.aiState === 'beam_sweep';
        ctx.save();
        if (!isFiring) {
          // Pulsing sighting laser + inward energy particles at beak
          const prog = 1 - Math.max(0, boss.stateTimer / Math.max(0.1, boss.stateMaxTimer || 1.25));
          ctx.strokeStyle = boss.phase === 3 ? 'rgba(251, 113, 133, 0.85)' : 'rgba(103, 232, 249, 0.85)';
          ctx.lineWidth = Math.max(1.8, (0.06 + prog * 0.14) * scale);
          ctx.setLineDash([10, 7]);
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = Math.max(2, 0.09 * scale);
          ctx.beginPath();
          ctx.arc(mx, my, (2.2 - prog * 1.6) * scale, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // 3-Layer Roaring Bioluminescent Plasma Beam occluded cleanly at cover pillars!
          const beamCol = boss.phase === 3 ? '#f43f5e' : '#a855f7';
          const midCol = boss.phase === 3 ? '#fda4af' : '#67e8f9';
          const wobble = 1 + Math.sin(timeSec * 42) * 0.14;
          ctx.lineCap = 'round';
          ctx.globalCompositeOperation = 'screen';
          ctx.strokeStyle = beamCol;
          ctx.globalAlpha = 0.45;
          ctx.lineWidth = 2.6 * scale * wobble;
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.strokeStyle = midCol;
          ctx.globalAlpha = 0.85;
          ctx.lineWidth = 1.25 * scale * wobble;
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.strokeStyle = '#ffffff';
          ctx.globalAlpha = 0.98;
          ctx.lineWidth = 0.48 * scale;
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          // Muzzle bloom right at the Kraken's open throat!
          const mg = ctx.createRadialGradient(mx, my, 0.15 * scale, mx, my, 2.0 * scale);
          mg.addColorStop(0, '#ffffff');
          mg.addColorStop(0.5, midCol);
          mg.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = mg;
          ctx.beginPath();
          ctx.arc(mx, my, 2.0 * scale, 0, Math.PI * 2);
          ctx.fill();

          // Glowing splash impact bloom where beam hits a cover pillar!
          if (boss.beamHitPillar) {
            const bg = ctx.createRadialGradient(ex, ey, 0.2 * scale, ex, ey, 2.8 * scale);
            bg.addColorStop(0, '#ffffff');
            bg.addColorStop(0.45, midCol);
            bg.addColorStop(1, 'rgba(56, 189, 248, 0)');
            ctx.fillStyle = bg;
            ctx.beginPath();
            ctx.arc(ex, ey, 2.8 * scale, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // 3b. Kraken Lunge Dash Lane Telegraph (exact WYSIWYG collision width = (radius + 0.45) * 2!)
      if (boss.aiState === 'lunge_windup' || boss.aiState === 'lunge_dash') {
        const dx = toScreenX(boss.lungeDestX);
        const dy = toScreenY(boss.lungeDestY);
        const isDash = boss.aiState === 'lunge_dash';
        ctx.save();
        ctx.strokeStyle = isDash ? 'rgba(244, 63, 94, 0.58)' : 'rgba(56, 189, 248, 0.34)';
        ctx.lineWidth = (boss.radius + 0.45) * 2 * scale;
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

      // 3c. Telegraphed Tentacle Slam Cone with Growing Inner Progress-Fill Wedge (Single P1/P2, Tri-Fan P3!)
      if (boss.aiState === 'slam_windup' || boss.aiState === 'slam_strike') {
        const isStrike = boss.aiState === 'slam_strike';
        const rad = boss.slamRadius * scale;
        const slamAngles = boss.twinSlam
          ? [boss.slamTargetAngle, boss.slamTargetAngle - 0.82, boss.slamTargetAngle + 0.82]
          : [boss.slamTargetAngle];
        const halfArc = boss.twinSlam ? 0.28 : boss.slamArcHalf;
        const prog = isStrike ? 1 : Math.max(0.05, 1 - boss.stateTimer / Math.max(0.1, boss.stateMaxTimer || 1.15));
        ctx.save();
        for (const sa of slamAngles) {
          ctx.fillStyle = isStrike ? 'rgba(244, 63, 94, 0.38)' : 'rgba(251, 146, 60, 0.14)';
          ctx.strokeStyle = isStrike ? 'rgba(254, 202, 202, 0.94)' : 'rgba(251, 191, 36, 0.88)';
          ctx.lineWidth = Math.max(2, 0.09 * scale);
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.arc(bx, by, rad, sa - halfArc, sa + halfArc);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Growing inner charge wedge shows EXACT moment of slam impact!
          if (!isStrike) {
            ctx.fillStyle = 'rgba(244, 63, 94, 0.28)';
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.arc(bx, by, rad * prog, sa - halfArc, sa + halfArc);
            ctx.closePath();
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // 3d. Ink Barrage Swelling Beak Glow & Spread Preview Ticks
      if (boss.aiState === 'ink_barrage') {
        const count = boss.phase === 1 ? 3 : boss.phase === 2 ? 5 : 7;
        const baseAng = Number.isFinite(boss.inkAimAngle) ? boss.inkAimAngle : boss.angle;
        const spread = boss.phase === 3 ? 0.23 : 0.27;
        const prog = 1 - Math.max(0, boss.stateTimer / Math.max(0.1, boss.stateMaxTimer || 0.85));
        ctx.save();
        ctx.strokeStyle = boss.phase === 3 ? 'rgba(251, 113, 133, 0.72)' : 'rgba(192, 132, 252, 0.72)';
        ctx.lineWidth = Math.max(1.6, 0.07 * scale);
        for (let k = 0; k < count; k++) {
          const a = baseAng + (k - (count - 1) * 0.5) * spread;
          const r0 = (boss.radius * 0.85) * scale;
          const r1 = (boss.radius * 0.85 + 2.4 + prog * 3.8) * scale;
          ctx.beginPath();
          ctx.moveTo(bx + Math.cos(a) * r0, by + Math.sin(a) * r0);
          ctx.lineTo(bx + Math.cos(a) * r1, by + Math.sin(a) * r1);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 3e. Phase 3 Directional Tentacle Grab Windup Cone!
      if (boss.aiState === 'grab_windup') {
        const prog = 1 - Math.max(0, boss.stateTimer / Math.max(0.1, boss.stateMaxTimer || 1.1));
        const rad = 15.5 * scale;
        ctx.save();
        ctx.fillStyle = 'rgba(244, 63, 94, 0.16)';
        ctx.strokeStyle = 'rgba(251, 113, 133, 0.92)';
        ctx.lineWidth = Math.max(2, 0.08 * scale);
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.arc(bx, by, rad, boss.slamTargetAngle - 0.44, boss.slamTargetAngle + 0.44);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(244, 63, 94, 0.28)';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.arc(bx, by, rad * prog, boss.slamTargetAngle - 0.44, boss.slamTargetAngle + 0.44);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 3f. Phase 2/3 Abyssal Suction Vortex Rings
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

      // 3g. Stunned Kraken Ring (huge open 2x damage window!)
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

      // 3h. Glowing Tentacle Grab Tether
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
        ctx.strokeStyle = 'rgba(2, 6, 23, 0.92)';
        ctx.lineWidth = 3.5 * dpr;
        const txt = `TAP FIRE TO BREAK (${boss.pinHitsNeeded || 1})`;
        ctx.strokeText(txt, toScreenX(diver.x), toScreenY(diver.y) - 24 * dpr);
        ctx.fillStyle = '#fde047';
        ctx.fillText(txt, toScreenX(diver.x), toScreenY(diver.y) - 24 * dpr);
        ctx.restore();
      }

      // 3i. Glowing Exposed Mantle Weak-Point Core + Orbiting Armor Petals
      if (boss.aiState !== 'dormant') {
        const coreX = toScreenX(boss.x + Math.cos(boss.weakAngle) * (boss.radius * 0.56));
        const coreY = toScreenY(boss.y + Math.sin(boss.weakAngle) * (boss.radius * 0.56));
        const stunnedBoost = boss.aiState === 'stunned' ? 1.4 : 1.0;
        const coreR = (1.05 + 0.18 * Math.sin(timeSec * 8)) * scale * stunnedBoost;
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
        // 3 orbiting diamond reticle petals around core
        for (let p = 0; p < 3; p++) {
          const pa = timeSec * 2.2 + (p * Math.PI * 2) / 3;
          const ptx = coreX + Math.cos(pa) * coreR * 1.18;
          const pty = coreY + Math.sin(pa) * coreR * 1.18;
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(ptx, pty, Math.max(2.2, 0.1 * scale), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // 4. Post-Victory Full-Height Soaring Bioluminescent Thermal Updraft Column!
    if (lair.bossDefeated && spec.arena.exitUpdraft) {
      const up = spec.arena.exitUpdraft;
      const ux = toScreenX(up.x);
      const uy = toScreenY(up.y);
      const floorY = toScreenY((spec.arena.cy || 40.5) + (spec.arena.ry || 14));
      const ceilY = toScreenY((spec.arena.cy || 40.5) - (spec.arena.ry || 14));
      const ur = up.radius * scale;
      const pulse = 0.65 + 0.35 * Math.sin(timeSec * 4.5);
      ctx.save();
      // Rising luminous thermal column from cathedral floor to skylight
      const colGrad = ctx.createLinearGradient(ux - ur, 0, ux + ur, 0);
      colGrad.addColorStop(0, 'rgba(52, 211, 153, 0)');
      colGrad.addColorStop(0.5, 'rgba(103, 232, 249, 0.34)');
      colGrad.addColorStop(1, 'rgba(52, 211, 153, 0)');
      ctx.fillStyle = colGrad;
      ctx.fillRect(ux - ur, ceilY, ur * 2, Math.max(20, floorY - ceilY));
      // Rising thermal ribbons
      ctx.strokeStyle = 'rgba(167, 243, 208, 0.55)';
      ctx.lineWidth = Math.max(1.6, 0.07 * scale);
      for (let k = 0; k < 4; k++) {
        const phase = (timeSec * 1.1 + k * 0.25) % 1;
        const ry = floorY - phase * Math.max(20, floorY - ceilY);
        ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.75;
        ctx.beginPath();
        ctx.ellipse(ux, ry, ur * 0.72, ur * 0.22, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const ug = ctx.createRadialGradient(ux, uy, ur * 0.15, ux, uy, ur * 1.35);
      ug.addColorStop(0, 'rgba(103, 232, 249, 0.88)');
      ug.addColorStop(0.55, 'rgba(52, 211, 153, 0.42)');
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
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)';
      ctx.lineWidth = 3 * dpr;
      ctx.strokeText('✨ UPDRAFT → SURFACE [E]', ux, uy - ur - 8 * dpr);
      ctx.fillStyle = '#a7f3d0';
      ctx.fillText('✨ UPDRAFT → SURFACE [E]', ux, uy - ur - 8 * dpr);
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

    // 6. 5th-Shot Hyper-Tip Ready Golden Glow on Diver's Speargun Tip!
    if (lair.weaponEquipped && diver && (lair.shotCounter || 0) % 5 === 4) {
      const aim = diver.torchAngle ?? diver.angle ?? 0;
      const hx = toScreenX((diver.body?.hand?.x ?? diver.x) + Math.cos(aim) * 1.05);
      const hy = toScreenY((diver.body?.hand?.y ?? diver.y) + Math.sin(aim) * 1.05);
      const hr = (0.38 + 0.08 * Math.sin(timeSec * 14)) * scale;
      ctx.save();
      const hg = ctx.createRadialGradient(hx, hy, hr * 0.1, hx, hy, hr * 2.2);
      hg.addColorStop(0, '#ffffff');
      hg.addColorStop(0.45, '#fde047');
      hg.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(hx, hy, hr * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 6b. Tethered Titanium Speargun Bolts
    for (const sp of lair.spears || []) {
      const sx = toScreenX(sp.x);
      const sy = toScreenY(sp.y);
      const ox = toScreenX(sp.originX);
      const oy = toScreenY(sp.originY);
      ctx.save();
      ctx.strokeStyle = sp.piercing ? 'rgba(253, 224, 71, 0.5)' : 'rgba(186, 230, 253, 0.34)';
      ctx.lineWidth = Math.max(1, 0.04 * scale);
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(sx, sy);
      ctx.stroke();

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

    // 7. Hit Sparks & High-Contrast Outlined Floating Damage / Crit Callouts
    for (const sk of lair.hitSparks || []) {
      const sx = toScreenX(sk.x);
      const sy = toScreenY(sk.y);
      const a = Math.max(0, Math.min(1, sk.life / (sk.maxLife || 0.75)));
      ctx.save();
      ctx.globalAlpha = a;
      if (sk.text) {
        ctx.font = `900 ${Math.max(11, Math.round((sk.crit ? 15 : 12) * dpr))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        const ty = sy - (1 - a) * 22 * dpr;
        ctx.strokeStyle = 'rgba(2, 6, 23, 0.92)';
        ctx.lineWidth = 3.2 * dpr;
        ctx.strokeText(sk.text, sx, ty);
        ctx.fillStyle = sk.color || '#38bdf8';
        ctx.fillText(sk.text, sx, ty);
      } else {
        ctx.fillStyle = sk.color || '#38bdf8';
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(2, 0.09 * scale * a), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 8. Combat Hit Vignette
    if (lair.playerHitFlash > 0.02) {
      ctx.save();
      const hitA = Math.min(0.45, lair.playerHitFlash * 1.2);
      ctx.strokeStyle = `rgba(244, 63, 94, ${hitA.toFixed(2)})`;
      ctx.lineWidth = Math.max(16, 22 * dpr);
      ctx.strokeRect(0, 0, cw, ch);
      ctx.restore();
    }

    // 8b. Cinematic Awakening / Phase-Shift Title Banner (fades gracefully above center!)
    if ((lair.titleBannerSec || 0) > 0 && lair.titleBannerText) {
      const maxS = Math.max(0.5, lair.titleBannerMaxSec || 3.0);
      const rem = lair.titleBannerSec;
      const inA = Math.min(1, (maxS - rem) / 0.35);
      const outA = Math.min(1, rem / 0.6);
      const bannerA = Math.min(inA, outA);
      const cy = Math.round(ch * 0.23);
      ctx.save();
      ctx.globalAlpha = bannerA;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${Math.round(24 * dpr)}px ui-monospace, monospace`;
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.95)';
      ctx.lineWidth = 5 * dpr;
      ctx.strokeText(lair.titleBannerText, cw * 0.5, cy);
      ctx.fillStyle = lair.titleBannerColor || '#38bdf8';
      ctx.fillText(lair.titleBannerText, cw * 0.5, cy);
      if (lair.titleBannerSub) {
        ctx.font = `700 ${Math.round(11 * dpr)}px ui-monospace, monospace`;
        ctx.lineWidth = 3.2 * dpr;
        ctx.strokeText(lair.titleBannerSub, cw * 0.5, cy + 20 * dpr);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(lair.titleBannerSub, cw * 0.5, cy + 20 * dpr);
      }
      ctx.restore();
    }

    // 9. Top-Center Epic Boss Health Bar (positioned cleanly at top in Combat Mode!)
    if (boss && boss.active && !boss.defeated) {
      const barW = Math.min(cw - 48 * dpr, 480 * dpr);
      const barH = 13 * dpr;
      const bx = Math.round((cw - barW) * 0.5);
      const by = Math.round((lair.combatMode ? 38 : (cw < ch ? 114 : 78)) * dpr);
      const hpRatio = Math.max(0, Math.min(1, boss.hp / Math.max(1, boss.maxHp)));

      ctx.save();
      ctx.fillStyle = 'rgba(4, 12, 26, 0.86)';
      ctx.strokeStyle = boss.aiState === 'stunned' ? 'rgba(250, 204, 21, 0.9)' : boss.phase === 3 ? 'rgba(244, 63, 94, 0.85)' : 'rgba(56, 189, 248, 0.65)';
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
      const statusTag = boss.aiState === 'stunned'
        ? ' · ⚡ STUNNED (2× DMG)!'
        : boss.aiState === 'awakening'
          ? ' · AWAKENING...'
          : ` · PHASE ${boss.phase}/3`;
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
