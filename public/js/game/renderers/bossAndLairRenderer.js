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
      accent: '#fb7185',
      accentSoft: 'rgba(244, 63, 94, 0.28)',
      glow: '#fecdd3',
      sconce: '#fb7185',
      bodyTop: '#f43f5e',
      bodyMid: '#be123c',
      bodyBase: '#881337',
      belly: '#ffe4e6',
      outline: '#3b071e',
      cheek: 'rgba(255, 182, 193, 0.85)',
      irisTop: '#fef08a',
      irisBot: '#fb7185',
      sucker: '#fda4af',
    };
  }
  if (phase === 2) {
    return {
      accent: '#c084fc',
      accentSoft: 'rgba(192, 132, 252, 0.26)',
      glow: '#f3e8ff',
      sconce: '#c084fc',
      bodyTop: '#a855f7',
      bodyMid: '#7e22ce',
      bodyBase: '#4c1d95',
      belly: '#f3e8ff',
      outline: '#22084d',
      cheek: 'rgba(244, 114, 182, 0.78)',
      irisTop: '#fef08a',
      irisBot: '#c084fc',
      sucker: '#e9d5ff',
    };
  }
  return {
    accent: '#38bdf8',
    accentSoft: 'rgba(34, 211, 238, 0.24)',
    glow: '#cffafe',
    sconce: '#38bdf8',
    bodyTop: '#6366f1',
    bodyMid: '#4338ca',
    bodyBase: '#312e81',
    belly: '#cffafe',
    outline: '#14123b',
    cheek: 'rgba(251, 113, 133, 0.76)',
    irisTop: '#fef08a',
    irisBot: '#22d3ee',
    sucker: '#a5f3fc',
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
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-1.55 * scale, -0.68 * scale, 3.1 * scale, 1.36 * scale, 0.22 * scale);
      } else {
        ctx.rect(-1.55 * scale, -0.68 * scale, 3.1 * scale, 1.36 * scale);
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-1.35 * scale, -0.48 * scale, 2.7 * scale, 0.96 * scale, 0.14 * scale);
      } else {
        ctx.rect(-1.35 * scale, -0.48 * scale, 2.7 * scale, 0.96 * scale);
      }
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

  /**
   * Draw one plump, cel-shaded anime tentacle limb with smooth tapered ribbon silhouette,
   * curly spiral tip, pastel underside highlight & glowing jelly suction-cup pads! (v184)
   */
  _drawChubbyAnimeLimb(ctx, pts, widths, pal, scale, { isBack = false, angry = false } = {}) {
    if (!pts || pts.length < 2) return;
    const n = pts.length;
    const leftX = new Array(n);
    const leftY = new Array(n);
    const rightX = new Array(n);
    const rightY = new Array(n);
    for (let i = 0; i < n; i++) {
      const pPrev = pts[Math.max(0, i - 1)];
      const pNext = pts[Math.min(n - 1, i + 1)];
      const tx = pNext.x - pPrev.x;
      const ty = pNext.y - pPrev.y;
      const len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len;
      const ny = tx / len;
      const hw = widths[i];
      leftX[i] = pts[i].x + nx * hw;
      leftY[i] = pts[i].y + ny * hw;
      rightX[i] = pts[i].x - nx * hw;
      rightY[i] = pts[i].y - ny * hw;
    }

    ctx.save();
    // Main chubby silhouette ribbon + rounded tip bulb
    ctx.beginPath();
    ctx.moveTo(leftX[0], leftY[0]);
    for (let i = 1; i < n; i++) ctx.lineTo(leftX[i], leftY[i]);
    const tip = pts[n - 1];
    const tipPrev = pts[n - 2];
    const tipAng = Math.atan2(tip.y - tipPrev.y, tip.x - tipPrev.x);
    const tipR = Math.max(2, widths[n - 1] * 1.12);
    const baseAng = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
    const baseR = Math.max(2, widths[0]);
    ctx.arc(tip.x, tip.y, tipR, tipAng + Math.PI * 0.5, tipAng - Math.PI * 0.5, true);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(rightX[i], rightY[i]);
    ctx.arc(pts[0].x, pts[0].y, baseR, baseAng - Math.PI * 0.5, baseAng + Math.PI * 0.5, true);
    ctx.closePath();

    const grad = ctx.createLinearGradient(pts[0].x, pts[0].y, tip.x, tip.y);
    if (angry) {
      grad.addColorStop(0, '#be123c');
      grad.addColorStop(1, '#fb7185');
    } else if (isBack) {
      grad.addColorStop(0, pal.bodyBase);
      grad.addColorStop(1, pal.bodyMid);
    } else {
      grad.addColorStop(0, pal.bodyMid);
      grad.addColorStop(0.65, pal.bodyTop);
      grad.addColorStop(1, pal.accent);
    }
    ctx.fillStyle = grad;
    ctx.fill();

    // Soft creamy pastel belly stripe along underside edge
    ctx.strokeStyle = isBack ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.34)';
    ctx.lineWidth = Math.max(1.5, widths[0] * 0.32);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 1; i < n - 1; i++) {
      const mx = pts[i].x * 0.6 + rightX[i] * 0.4;
      const my = pts[i].y * 0.6 + rightY[i] * 0.4;
      if (i === 1) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    }
    ctx.stroke();

    // Crisp anime ink outline ONLY along outer sides & rounded tip (NO harsh straight cut line across the chubby belly!)
    ctx.beginPath();
    ctx.moveTo(leftX[0], leftY[0]);
    for (let i = 1; i < n; i++) ctx.lineTo(leftX[i], leftY[i]);
    ctx.arc(tip.x, tip.y, tipR, tipAng + Math.PI * 0.5, tipAng - Math.PI * 0.5, true);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(rightX[i], rightY[i]);
    ctx.strokeStyle = pal.outline;
    ctx.lineWidth = Math.max(1.8, 0.085 * scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Cute glowing jelly suction-cup dots along the underside!
    ctx.fillStyle = pal.sucker;
    for (let i = 2; i <= n - 2; i += 2) {
      const sx = pts[i].x * 0.45 + rightX[i] * 0.55;
      const sy = pts[i].y * 0.45 + rightY[i] * 0.55;
      const sr = Math.max(1.8, widths[i] * 0.38);
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  /**
   * Build animated anime limb spline points in boss-local (right-side-up, +X = facing) space!
   */
  _computeAnimeLimbPose(limbDef, boss, anim, r, scale, timeSec) {
    const st = boss.aiState || 'idle';
    const cyc = anim.swimCycle || timeSec * 3.2;
    const phase = limbDef.phase;
    const segs = 9;
    const pts = [];
    const widths = [];

    // Limb base attachment tucked around the chubby lower belly
    const baseX = limbDef.attachX * r;
    const baseY = limbDef.attachY * r;
    let dirAngle = limbDef.restAngle;
    let lengthR = limbDef.length * r;
    let waveAmp = 0.28;
    let curl = limbDef.curl; // positive curls into cute cinnamon-roll tips!

    if (st === 'dormant') {
      // Snug curled plushie sleep!
      dirAngle = Math.PI * 0.52 + (limbDef.slot - 2.5) * 0.32;
      lengthR *= 0.74;
      waveAmp = 0.06;
      curl = limbDef.curl * 1.65;
    } else if (st === 'awakening') {
      // Cute startled starfish pop!
      const pop = Math.min(1, (boss.awakeningTimer || 0) * 1.4);
      dirAngle = limbDef.restAngle - 0.35 * Math.sin(pop * Math.PI);
      lengthR *= 0.92 + 0.18 * Math.sin(pop * Math.PI);
      waveAmp = 0.35;
      curl = limbDef.curl * 0.8;
    } else if (st === 'lunge_windup') {
      // Cat-pounce tuck behind chubby bottom, wiggling excitedly!
      dirAngle = Math.PI + (limbDef.slot - 2.5) * 0.22;
      lengthR *= 0.78;
      waveAmp = 0.42;
      curl = limbDef.curl * 1.25;
    } else if (st === 'lunge_dash') {
      // Joyful streaming ribbon-tails behind the torpedo chonk!
      dirAngle = Math.PI + (limbDef.slot - 2.5) * 0.14;
      lengthR *= 1.26;
      waveAmp = 0.22;
      curl = limbDef.curl * 0.25;
    } else if (st === 'slam_windup') {
      // Coil arms high & wide flanking the adorable angry face (never blocking the eyes/brows!)
      if (limbDef.slot === 0 || limbDef.slot === 1) {
        dirAngle = -0.78 - (limbDef.slot === 1 ? 0.35 : 0);
        lengthR *= 1.12;
        waveAmp = 0.32;
        curl = -1.65;
      } else if (limbDef.slot === 2 || limbDef.slot === 3) {
        dirAngle = 0.65 + (limbDef.slot === 3 ? 0.42 : 0);
        lengthR *= 1.12;
        waveAmp = 0.32;
        curl = 1.65;
      } else {
        dirAngle = Math.PI * 0.85 + (limbDef.slot - 4.5) * 0.34;
        lengthR *= 0.96;
      }
    } else if (st === 'slam_strike') {
      // Front 4 limbs whip straight forward/outward in slam!
      if (limbDef.slot < 4) {
        dirAngle = (limbDef.slot - 1.5) * 0.36;
        lengthR *= 1.42;
        waveAmp = 0.12;
        curl = 0.15;
      } else {
        dirAngle = Math.PI * 0.9 + (limbDef.slot - 4.5) * 0.28;
      }
    } else if (st === 'ink_barrage') {
      // Front limbs wave happily up beside puffed-up rosy cheeks!
      if (limbDef.slot < 2) {
        dirAngle = -0.35 + (limbDef.slot === 0 ? -0.45 : 0.55) + Math.sin(cyc * 2.4 + phase) * 0.32;
        lengthR *= 0.92;
        curl = limbDef.curl * 1.35;
      } else {
        dirAngle = limbDef.restAngle + Math.sin(cyc * 1.8 + phase) * 0.32;
      }
    } else if (st === 'vortex') {
      // Playful spinning pinwheel swirl!
      dirAngle = (limbDef.slot / 6) * Math.PI * 2 + timeSec * 2.4;
      lengthR *= 1.08;
      waveAmp = 0.42;
      curl = 1.35;
    } else if (st === 'beam_windup') {
      // Cute Kamehameha pose: front limbs cradle the glowing energy orb in front of `:O` mouth!
      if (limbDef.slot < 2) {
        dirAngle = limbDef.slot === 0 ? -0.45 : 0.45;
        lengthR *= 0.86;
        waveAmp = 0.12;
        curl = limbDef.slot === 0 ? 1.15 : -1.15;
      } else {
        dirAngle = Math.PI * 0.72 + (limbDef.slot - 3.5) * 0.38;
        lengthR *= 0.98;
      }
    } else if (st === 'beam_sweep') {
      // Brace back joyfully against plasma beam recoil!
      dirAngle = Math.PI + (limbDef.slot - 2.5) * 0.28;
      lengthR *= 1.14;
      waveAmp = 0.34;
      curl = limbDef.curl * 0.65;
    } else if (st === 'grab_windup' || st === 'grab_hold') {
      if (limbDef.slot === 0) {
        // Extra-long cheeky grabby tentacle reaching forward!
        dirAngle = Math.sin(timeSec * 6) * 0.18;
        lengthR *= 1.48;
        waveAmp = 0.28;
        curl = 0.95;
      } else {
        dirAngle = limbDef.restAngle + Math.sin(cyc * 1.4 + phase) * 0.28;
      }
    } else if (st === 'stunned' || boss.defeated) {
      // Cooked udon noodles flopping limply downward!
      dirAngle = Math.PI * 0.5 + (limbDef.slot - 2.5) * 0.28;
      lengthR *= 0.96;
      waveAmp = 0.24;
      curl = limbDef.curl * 0.55;
    } else {
      // Signature Cute Swimming / Hovering Breaststroke & Flutter Paddle!
      const paddle = Math.sin(cyc + phase);
      const scoop = Math.cos(cyc + phase);
      dirAngle = limbDef.restAngle + paddle * 0.42 + (limbDef.isFront ? scoop * 0.18 : 0);
      lengthR *= 0.94 + Math.max(0, scoop) * 0.14;
      waveAmp = 0.30 + Math.min(0.18, (anim.speed || 0) * 0.02);
    }

    // Build smooth articulated spline with expressive curly tip
    let curX = baseX;
    let curY = baseY;
    let curA = dirAngle;
    const stepLen = lengthR / segs;
    for (let s = 0; s <= segs; s++) {
      const u = s / segs;
      pts.push({ x: curX, y: curY });
      // Chubby plump profile: thick base -> gentle taper -> cute rounded tip!
      const w = Math.max(2.4, (0.27 - u * 0.165) * r + (u > 0.85 ? 0.02 * r : 0));
      widths.push(w);
      const wave = Math.sin(cyc * 1.35 + phase - u * 3.1) * waveAmp * (0.25 + u * 0.85);
      const tipCurl = u > 0.48 ? curl * Math.pow((u - 0.48) / 0.52, 1.35) * 0.78 : 0;
      curA = dirAngle + wave + tipCurl;
      curX += Math.cos(curA) * stepLen;
      curY += Math.sin(curA) * stepLen;
    }
    return { pts, widths };
  },

  _drawCaveKrakenBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(boss.x);
    const sy = toScreenY(boss.y);
    const r = boss.radius * scale;
    const alpha = boss.defeated ? Math.max(0, boss.defeatAnimSec / 3.4) : 1;
    const flash = boss.hitFlash > 0;
    const pal = getPhasePalette(boss.phase);
    const anim = boss.anim || {
      facing: Math.cos(boss.angle || Math.PI) < 0 ? -1 : 1,
      pitch: 0, scaleX: 1, scaleY: 1, swimCycle: timeSec * 3.2,
      earFlap: timeSec * 3.8, cheekPuff: 0, mouthOpen: 0, dizzyAngle: timeSec * 4.8,
      hurtSec: 0, crownBob: 0, speed: 0,
    };
    const st = boss.aiState || 'idle';
    const isStunned = st === 'stunned';
    const isAngry = st === 'slam_windup' || st === 'slam_strike' || st === 'lunge_windup' || st === 'lunge_dash' || boss.phase >= 3;

    // Six cute paired limbs rooted seamlessly along the lower chubby rim (never crossing the face!)
    const limbDefs = [
      { slot: 1, back: true, isFront: true, attachX: 0.54, attachY: 0.52, restAngle: 0.52, length: 1.50, phase: 0.4, curl: 1.15 },
      { slot: 3, back: true, isFront: false, attachX: -0.22, attachY: 0.64, restAngle: 1.88, length: 1.62, phase: 2.2, curl: -1.2 },
      { slot: 5, back: true, isFront: false, attachX: -0.74, attachY: 0.34, restAngle: 2.72, length: 1.56, phase: 4.0, curl: 1.25 },
      { slot: 0, back: false, isFront: true, attachX: 0.44, attachY: 0.66, restAngle: 0.88, length: 1.56, phase: 1.3, curl: -1.15 },
      { slot: 2, back: false, isFront: false, attachX: -0.04, attachY: 0.74, restAngle: 1.46, length: 1.66, phase: 3.1, curl: 1.25 },
      { slot: 4, back: false, isFront: false, attachX: -0.54, attachY: 0.62, restAngle: 2.38, length: 1.58, phase: 5.0, curl: -1.2 },
    ];

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(sx, sy);

    // Subtle floating idle bob
    const floatBobY = st === 'dormant' ? Math.sin(timeSec * 1.6) * 0.08 * r : Math.sin(anim.swimCycle * 0.9) * 0.11 * r;
    ctx.translate(0, floatBobY);

    // Apply gentle right-side-up anime tilt + squash & stretch!
    const facing = anim.facing >= 0 ? 1 : -1;
    ctx.rotate((anim.pitch || 0) * facing);
    ctx.scale(facing * (anim.scaleX || 1), anim.scaleY || 1);

    // 1. Back-Layer Chubby Animated Limbs (depth behind body)
    for (let i = 0; i < limbDefs.length; i++) {
      if (!limbDefs[i].back) continue;
      const pose = this._computeAnimeLimbPose(limbDefs[i], boss, anim, r, scale, timeSec);
      this._drawChubbyAnimeLimb(ctx, pose.pts, pose.widths, pal, scale, {
        isBack: true,
        angry: st === 'slam_strike',
      });
    }

    // 2. Floppy Dumbo-Octopus Anime Ear-Fins (back-side ear behind head, front-side ear on side!)
    const earFlapAng =
      st === 'lunge_windup' || st === 'lunge_dash'
        ? -0.68 + Math.sin(anim.earFlap) * 0.12
        : isStunned || boss.defeated
          ? 0.52 + Math.sin(timeSec * 2) * 0.08
          : Math.sin(anim.earFlap) * 0.34 - (st === 'awakening' ? 0.25 : 0);
    const drawDumboEar = (ex, ey, rotOffset, sizeScale) => {
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(rotOffset + earFlapAng);
      const eg = ctx.createRadialGradient(-0.1 * r, -0.05 * r, 0.05 * r, 0, 0, 0.58 * r * sizeScale);
      eg.addColorStop(0, pal.bodyTop);
      eg.addColorStop(0.75, pal.bodyMid);
      eg.addColorStop(1, pal.bodyBase);
      ctx.fillStyle = eg;
      ctx.strokeStyle = pal.outline;
      ctx.lineWidth = Math.max(1.8, 0.085 * scale);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-0.34 * r * sizeScale, -0.44 * r * sizeScale, -0.68 * r * sizeScale, -0.18 * r * sizeScale, -0.56 * r * sizeScale, 0.22 * r * sizeScale);
      ctx.bezierCurveTo(-0.42 * r * sizeScale, 0.44 * r * sizeScale, -0.12 * r * sizeScale, 0.24 * r * sizeScale, 0, 0.12 * r * sizeScale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Soft glowing inner ear blush
      ctx.fillStyle = pal.accentSoft;
      ctx.beginPath();
      ctx.ellipse(-0.28 * r * sizeScale, 0.05 * r * sizeScale, 0.18 * r * sizeScale, 0.11 * r * sizeScale, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    // Far-side ear peeking from behind forehead
    drawDumboEar(0.32 * r, -0.66 * r, 2.35, 0.78);

    // 3. Plump Squishy Mochi-Pear Chubby Anime Body!
    const puff = 1 + (anim.cheekPuff || 0) * 0.12;
    const bg = ctx.createRadialGradient(-0.18 * r, -0.34 * r, 0.1 * r, 0.06 * r, 0.08 * r, 1.25 * r);
    bg.addColorStop(0, pal.bodyTop);
    bg.addColorStop(0.55, pal.bodyMid);
    bg.addColorStop(1, pal.bodyBase);
    ctx.fillStyle = bg;
    ctx.strokeStyle = flash ? '#ffffff' : pal.outline;
    ctx.lineWidth = Math.max(2.4, (flash ? 0.16 : 0.1) * scale);
    ctx.beginPath();
    // Classic kawaii chubby mochi-bell dome: round bouncy crown + plump cheeks + soft rounded tummy!
    ctx.moveTo(0, -0.96 * r);
    ctx.bezierCurveTo(0.76 * r, -0.96 * r, 1.08 * r * puff, -0.34 * r, 1.04 * r * puff, 0.24 * r);
    ctx.bezierCurveTo(0.98 * r * puff, 0.78 * r, 0.48 * r, 0.94 * r, 0, 0.90 * r);
    ctx.bezierCurveTo(-0.56 * r, 0.94 * r, -1.04 * r, 0.74 * r, -1.06 * r, 0.20 * r);
    ctx.bezierCurveTo(-1.08 * r, -0.42 * r, -0.74 * r, -0.96 * r, 0, -0.96 * r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Soft pastel creamy belly patch on lower front chonk
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.ellipse(0.18 * r, 0.42 * r, 0.56 * r, 0.36 * r, -0.08, 0, Math.PI * 2);
    ctx.fill();

    // Cute glowing pastel polka-dot chromatophores along the back of the head
    ctx.fillStyle = pal.glow;
    ctx.globalAlpha = alpha * (0.48 + 0.22 * Math.sin(timeSec * 3.8));
    for (const [dx, dy, dr] of [
      [-0.58, -0.36, 0.11],
      [-0.74, -0.08, 0.08],
      [-0.44, -0.62, 0.075],
      [-0.64, 0.18, 0.065],
    ]) {
      ctx.beginPath();
      ctx.arc(dx * r, dy * r, Math.max(1.6, dr * r), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = alpha;

    // Glossy anime jelly-bean specular highlight on upper dome!
    ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
    ctx.beginPath();
    ctx.ellipse(-0.22 * r, -0.58 * r, 0.30 * r, 0.14 * r, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(0.14 * r, -0.68 * r, Math.max(1.8, 0.055 * r), 0, Math.PI * 2);
    ctx.fill();

    if (flash) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.beginPath();
      ctx.arc(0, 0, 0.96 * r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Near-side Dumbo Ear-Fin mounted jauntily on cheek-side of dome
    drawDumboEar(-0.56 * r, -0.36 * r, -0.25, 1.0);

    // 4. Cute Bouncy Golden Abyssal Crown perched jauntily on top of its chubby head!
    ctx.save();
    ctx.translate(0.06 * r, (-0.96 + (anim.crownBob || 0)) * r);
    ctx.rotate(0.14 + Math.sin(anim.swimCycle * 1.1) * 0.07);
    const cwCrown = 0.42 * r;
    const chCrown = 0.28 * r;
    const cg = ctx.createLinearGradient(0, -chCrown, 0, chCrown * 0.4);
    cg.addColorStop(0, '#fef08a');
    cg.addColorStop(0.55, '#f59e0b');
    cg.addColorStop(1, '#b45309');
    ctx.fillStyle = cg;
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = Math.max(1.5, 0.06 * scale);
    ctx.beginPath();
    ctx.moveTo(-cwCrown, chCrown * 0.35);
    ctx.lineTo(-cwCrown * 0.88, -chCrown * 0.72);
    ctx.lineTo(-cwCrown * 0.32, -chCrown * 0.12);
    ctx.lineTo(0, -chCrown);
    ctx.lineTo(cwCrown * 0.32, -chCrown * 0.12);
    ctx.lineTo(cwCrown * 0.88, -chCrown * 0.72);
    ctx.lineTo(cwCrown, chCrown * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Glowing pearl-gem tips on the crown!
    ctx.fillStyle = pal.accent;
    for (const [gx, gy] of [[-cwCrown * 0.88, -chCrown * 0.78], [0, -chCrown * 1.06], [cwCrown * 0.88, -chCrown * 0.78]]) {
      ctx.beginPath();
      ctx.arc(gx, gy, Math.max(2, 0.065 * r), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 5. Front-Layer Chubby Animated Limbs (in front of lower belly!)
    for (let i = 0; i < limbDefs.length; i++) {
      if (limbDefs[i].back) continue;
      const pose = this._computeAnimeLimbPose(limbDefs[i], boss, anim, r, scale, timeSec);
      this._drawChubbyAnimeLimb(ctx, pose.pts, pose.widths, pal, scale, {
        isBack: false,
        angry: st === 'slam_strike',
      });
    }

    // 6. Rosy Glowing Anime Blush Cheeks (swell huge when puffing up for Ink Barrage!)
    const blushScale = 1 + (anim.cheekPuff || 0) * 0.42;
    for (const [bxC, byC, rxC] of [[0.20 * r, 0.25 * r, 0.16 * r], [0.80 * r, 0.22 * r, 0.13 * r]]) {
      ctx.save();
      ctx.fillStyle = pal.cheek;
      ctx.beginPath();
      ctx.ellipse(bxC, byC, rxC * blushScale, 0.085 * r * blushScale, 0, 0, Math.PI * 2);
      ctx.fill();
      // Cute anime diagonal blush hatch lines!
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = Math.max(1.1, 0.035 * scale);
      for (let h = -1; h <= 1; h++) {
        ctx.beginPath();
        ctx.moveTo(bxC + h * 0.055 * r - 0.02 * r, byC + 0.035 * r);
        ctx.lineTo(bxC + h * 0.055 * r + 0.025 * r, byC - 0.035 * r);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 7. Expressive Cute Anime Mouth (:3 smile, puffy o, glowing :O beam/vortex, wobbly ~ stunned!)
    const mouthX = 0.56 * r;
    const mouthY = 0.24 * r;
    const mOpen = Math.max(0, Math.min(1, anim.mouthOpen || 0));
    ctx.save();
    if (mOpen > 0.22) {
      // Big adorable glowing Kirby/anime `:O` mouth!
      const mrX = Math.max(2, (0.09 + mOpen * 0.13) * r);
      const mrY = Math.max(2, (0.08 + mOpen * 0.15) * r);
      const mg = ctx.createRadialGradient(mouthX, mouthY, mrX * 0.1, mouthX, mouthY, mrY * 1.1);
      mg.addColorStop(0, st === 'beam_windup' || st === 'beam_sweep' ? '#ffffff' : '#fda4af');
      mg.addColorStop(0.55, st === 'beam_windup' || st === 'beam_sweep' ? pal.accent : '#9f1239');
      mg.addColorStop(1, '#3b071e');
      ctx.fillStyle = mg;
      ctx.strokeStyle = pal.outline;
      ctx.lineWidth = Math.max(1.5, 0.06 * scale);
      ctx.beginPath();
      ctx.ellipse(mouthX, mouthY, mrX, mrY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Cute tiny pink tongue curve at bottom of open mouth (when not firing plasma beam)
      if (st !== 'beam_windup' && st !== 'beam_sweep') {
        ctx.fillStyle = '#fb7185';
        ctx.beginPath();
        ctx.ellipse(mouthX, mouthY + mrY * 0.45, mrX * 0.55, mrY * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (isStunned || boss.defeated) {
      // Wobbly dazed `~` anime mouth
      ctx.strokeStyle = pal.outline;
      ctx.lineWidth = Math.max(1.8, 0.075 * scale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(mouthX - 0.12 * r, mouthY);
      ctx.quadraticCurveTo(mouthX - 0.04 * r, mouthY - 0.06 * r, mouthX, mouthY);
      ctx.quadraticCurveTo(mouthX + 0.05 * r, mouthY + 0.06 * r, mouthX + 0.12 * r, mouthY);
      ctx.stroke();
    } else {
      // Iconic cute `:3` / `ω` anime smile!
      ctx.strokeStyle = pal.outline;
      ctx.lineWidth = Math.max(1.8, 0.075 * scale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(mouthX - 0.065 * r, mouthY - 0.01 * r, Math.max(1.5, 0.065 * r), 0.15, Math.PI - 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(mouthX + 0.065 * r, mouthY - 0.01 * r, Math.max(1.5, 0.065 * r), 0.1, Math.PI - 0.15);
      ctx.stroke();
    }
    ctx.restore();

    // 8. GIANT Expressive Glossy Anime Eyes (placed in classic cute 3/4 view so BOTH eyes shine!)
    const eyeSpecs = [
      { cx: 0.34 * r, cy: 0.03 * r, rx: 0.185 * r, ry: 0.225 * r },
      { cx: 0.76 * r, cy: 0.01 * r, rx: 0.155 * r, ry: 0.205 * r },
    ];
    const isHurtFlinch = (anim.hurtSec || 0) > 0.02 && !isStunned && !boss.defeated;
    for (let ei = 0; ei < eyeSpecs.length; ei++) {
      const e = eyeSpecs[ei];
      ctx.save();
      ctx.translate(e.cx, e.cy);
      if (st === 'dormant') {
        // Peaceful sleeping closed curves `u u`
        ctx.strokeStyle = pal.outline;
        ctx.lineWidth = Math.max(2, 0.085 * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(2, e.rx * 0.82), 0.2, Math.PI - 0.2);
        ctx.stroke();
      } else if (isHurtFlinch || boss.defeated) {
        // Cute squeezed `> <` flinch or KO eyes!
        ctx.strokeStyle = pal.outline;
        ctx.lineWidth = Math.max(2.2, 0.095 * scale);
        ctx.lineCap = 'round';
        const sgn = ei === 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(-sgn * e.rx * 0.65, -e.ry * 0.45);
        ctx.lineTo(sgn * e.rx * 0.55, 0);
        ctx.lineTo(-sgn * e.rx * 0.65, e.ry * 0.45);
        ctx.stroke();
      } else if (isStunned) {
        // Adorable spinning dizzy `@_@` anime spiral eyes!
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = pal.outline;
        ctx.lineWidth = Math.max(1.8, 0.075 * scale);
        ctx.beginPath();
        ctx.ellipse(0, 0, Math.max(2, e.rx), Math.max(2, e.ry * 0.92), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.rotate((ei === 0 ? 1 : -1) * (anim.dizzyAngle || timeSec * 5));
        ctx.strokeStyle = pal.outline;
        ctx.lineWidth = Math.max(1.6, 0.065 * scale);
        ctx.beginPath();
        for (let k = 0; k <= 24; k++) {
          const ang = k * 0.52;
          const rad = (k / 24) * e.rx * 0.78;
          const px = Math.cos(ang) * rad;
          const py = Math.sin(ang) * rad;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      } else {
        // Giant Glossy Sparkling Kawaii Anime Eyes!
        const wideMult = st === 'awakening' || st === 'beam_windup' ? 1.12 : 1.0;
        const rxE = Math.max(2, e.rx * wideMult);
        const ryE = Math.max(2, e.ry * wideMult);
        // Deep dark glossy iris base
        ctx.fillStyle = '#09071a';
        ctx.beginPath();
        ctx.ellipse(0, 0, rxE, ryE, 0, 0, Math.PI * 2);
        ctx.fill();
        // Rich glowing lower anime iris crescent!
        const ig = ctx.createRadialGradient(0, ryE * 0.35, rxE * 0.08, 0, ryE * 0.25, ryE * 0.88);
        ig.addColorStop(0, pal.irisTop);
        ig.addColorStop(0.55, pal.irisBot);
        ig.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = ig;
        ctx.beginPath();
        ctx.ellipse(0, ryE * 0.22, rxE * 0.82, ryE * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
        // Big glossy upper-left anime catchlight + secondary lower-right sparkle!
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(-rxE * 0.28, -ryE * 0.32, Math.max(1.5, rxE * 0.34), Math.max(1.5, ryE * 0.28), -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(rxE * 0.30, ryE * 0.34, Math.max(1.2, rxE * 0.16), 0, Math.PI * 2);
        ctx.fill();
        // Cute anime eyelashes / upper eyelid curve
        ctx.strokeStyle = pal.outline;
        ctx.lineWidth = Math.max(2, 0.08 * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, rxE * 1.02, Math.PI * 1.08, Math.PI * 1.92);
        ctx.stroke();
        // Cute determined angled anime eyebrows when winding up an attack or in Phase 3!
        if (isAngry) {
          const browTilt = ei === 0 ? 0.34 : -0.28;
          ctx.strokeStyle = pal.outline;
          ctx.lineWidth = Math.max(2.2, 0.095 * scale);
          ctx.beginPath();
          ctx.moveTo(-rxE * 0.85, -ryE * 1.08 - browTilt * ryE * 0.5);
          ctx.lineTo(rxE * 0.85, -ryE * 1.08 + browTilt * ryE * 0.5);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 9. Cute Anime Status Emotes (Phase 3 Anger Vein `💢`, Stunned Orbiting Gold Stars `★`, Sleeping `Z z z`!)
    if (boss.phase >= 3 && !isStunned && !boss.defeated) {
      // Classic anime popped anger vein mark near upper forehead!
      const vx = -0.18 * r;
      const vy = -0.52 * r;
      const pulse = 1 + Math.sin(timeSec * 14) * 0.14;
      const vr = 0.12 * r * pulse;
      ctx.save();
      ctx.translate(vx, vy);
      ctx.strokeStyle = '#fecdd3';
      ctx.lineWidth = Math.max(2, 0.07 * scale);
      ctx.lineCap = 'round';
      for (let q = 0; q < 4; q++) {
        ctx.rotate(Math.PI * 0.5);
        ctx.beginPath();
        ctx.moveTo(vr * 0.25, vr * 0.95);
        ctx.quadraticCurveTo(vr * 0.32, vr * 0.32, vr * 0.95, vr * 0.25);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();

    // World-upright cute orbiting dizzy stars when stunned, or floating `Z z z` bubbles when sleeping!
    if (isStunned && !boss.defeated) {
      ctx.save();
      ctx.translate(sx, sy - 1.25 * r + floatBobY);
      for (let s = 0; s < 3; s++) {
        const sa = (anim.dizzyAngle || timeSec * 4.5) + (s * Math.PI * 2) / 3;
        const stx = Math.cos(sa) * 0.72 * r;
        const sty = Math.sin(sa) * 0.22 * r;
        const starR = Math.max(4, 0.16 * r);
        ctx.save();
        ctx.translate(stx, sty);
        ctx.rotate(sa * 1.5);
        ctx.fillStyle = '#fde047';
        ctx.strokeStyle = '#854d0e';
        ctx.lineWidth = Math.max(1.2, 0.045 * scale);
        ctx.beginPath();
        for (let p = 0; p < 10; p++) {
          const pr = p % 2 === 0 ? starR : starR * 0.45;
          const pa = (p * Math.PI) / 5 - Math.PI * 0.5;
          if (p === 0) ctx.moveTo(Math.cos(pa) * pr, Math.sin(pa) * pr);
          else ctx.lineTo(Math.cos(pa) * pr, Math.sin(pa) * pr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    } else if (st === 'dormant' && !boss.defeated) {
      ctx.save();
      ctx.font = `900 ${Math.max(12, Math.round(0.32 * r))}px ui-monospace, monospace`;
      ctx.fillStyle = '#bae6fd';
      ctx.textAlign = 'center';
      for (let z = 0; z < 3; z++) {
        const zp = (timeSec * 0.55 + z * 0.33) % 1;
        ctx.globalAlpha = Math.sin(zp * Math.PI) * 0.85;
        ctx.fillText('Z', sx + (0.55 + zp * 0.45) * r, sy - (0.8 + zp * 0.95) * r);
      }
      ctx.restore();
    }
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
      ctx.arc(sx, sy, Math.max(1, (sw.radius || 0.5) * scale), 0, Math.PI * 2);
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

      // 3a. Pillar-Occluded Sweeping Bioluminescent Abyssal Beam (blasts straight from the wide-open `:O` mouth!)
      if (boss.aiState === 'beam_windup' || boss.aiState === 'beam_sweep') {
        const bFacing = (boss.anim?.facing ?? (Math.cos(boss.angle || Math.PI) < 0 ? -1 : 1)) >= 0 ? 1 : -1;
        const mx = bx + bFacing * boss.radius * 0.56 * scale;
        const my = by + boss.radius * 0.24 * scale;
        const ex = toScreenX(boss.beamEndX);
        const ey = toScreenY(boss.beamEndY);
        const isFiring = boss.aiState === 'beam_sweep';
        ctx.save();
        if (!isFiring) {
          // Pulsing sighting laser + inward energy particles at beak
          const prog = Math.max(0, Math.min(1, 1 - Math.max(0, boss.stateTimer) / Math.max(0.1, boss.stateMaxTimer || 1.25)));
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
          ctx.arc(mx, my, Math.max(1, (2.2 - prog * 1.6) * scale), 0, Math.PI * 2);
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
        const prog = isStrike ? 1 : Math.max(0.05, Math.min(1, 1 - Math.max(0, boss.stateTimer) / Math.max(0.1, boss.stateMaxTimer || 1.15)));
        ctx.save();
        for (const sa of slamAngles) {
          ctx.fillStyle = isStrike ? 'rgba(244, 63, 94, 0.38)' : 'rgba(251, 146, 60, 0.14)';
          ctx.strokeStyle = isStrike ? 'rgba(254, 202, 202, 0.94)' : 'rgba(251, 191, 36, 0.88)';
          ctx.lineWidth = Math.max(2, 0.09 * scale);
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.arc(bx, by, Math.max(1, rad), sa - halfArc, sa + halfArc);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Growing inner charge wedge shows EXACT moment of slam impact!
          if (!isStrike) {
            ctx.fillStyle = 'rgba(244, 63, 94, 0.28)';
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.arc(bx, by, Math.max(1, rad * prog), sa - halfArc, sa + halfArc);
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
        const prog = Math.max(0, Math.min(1, 1 - Math.max(0, boss.stateTimer) / Math.max(0.1, boss.stateMaxTimer || 0.85)));
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
        const prog = Math.max(0.04, Math.min(1, 1 - Math.max(0, boss.stateTimer) / Math.max(0.1, boss.stateMaxTimer || 1.1)));
        const rad = Math.max(1, 15.5 * scale);
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
        ctx.arc(bx, by, Math.max(1, rad * prog), boss.slamTargetAngle - 0.44, boss.slamTargetAngle + 0.44);
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

      // 3i. Glowing Orbiting Star-Pearl Weak-Point Core (orbits cleanly outside the silhouette so the cute face shines!)
      if (boss.aiState !== 'dormant') {
        const coreX = toScreenX(boss.x + Math.cos(boss.weakAngle) * (boss.radius * 1.08));
        const coreY = toScreenY(boss.y + Math.sin(boss.weakAngle) * (boss.radius * 1.08));
        const stunnedBoost = boss.aiState === 'stunned' ? 1.35 : 1.0;
        const coreR = (0.78 + 0.14 * Math.sin(timeSec * 8)) * scale * stunnedBoost;
        ctx.save();
        const cg = ctx.createRadialGradient(coreX, coreY, coreR * 0.1, coreX, coreY, coreR * 1.65);
        cg.addColorStop(0, '#ffffff');
        cg.addColorStop(0.38, boss.aiState === 'stunned' ? '#fde047' : boss.phase === 3 ? '#f472b6' : '#38bdf8');
        cg.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(coreX, coreY, coreR * 1.65, 0, Math.PI * 2);
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
    if (lair.combatMode && lair.weaponEquipped && !lair.bossDefeated && diver && (lair.shotCounter || 0) % 5 === 4) {
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
