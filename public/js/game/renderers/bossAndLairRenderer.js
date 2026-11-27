/**
 * Secret Lair, Pneumatic Speargun & Colossal Cave Kraken Boss Renderer (v182).
 * Mixed onto CaveRenderer.prototype alongside chunkBaker, surfaceRenderer,
 * wreckAndInteractivesRenderer, and lightingAndFxRenderer.
 */

import { wreckAndInteractivesMethods } from './wreckAndInteractivesRenderer.js';
import { drawDetailedSpeargun } from '../artSprites.js';
import { BOSS_WEAPON_UPGRADES } from '../secretLairs.js';

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

    // 1c. Corridor Boss Shadow Foreshadowing (colossal darkened silhouette sweeps past background!)
    if ((lair.foreshadowTimer || 0) > 0) {
      const frac = 1 - lair.foreshadowTimer / 3.2;
      const baseFx = spec.foreshadowX || 198;
      const baseFy = spec.arena?.cy || 45.5;
      const fx = toScreenX(baseFx + frac * 22);
      const fy = toScreenY(baseFy + Math.sin(frac * Math.PI) * 2.5);
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

    // 2. Sculpted Arena Natural Limestone Cover Pillars + Faceted Resonance Crystal Pedestals (v188)
    const crystals = lair.pillarCrystals || [];
    for (let pi = 0; pi < (spec.arena.pillars || []).length; pi++) {
      const p = spec.arena.pillars[pi];
      if (p.x + p.radius + 3 < visX0 || p.x - p.radius - 3 > visX1 || p.y + p.radius + 3 < visY0 || p.y - p.radius - 3 > visY1) continue;
      const sx = toScreenX(p.x);
      const sy = toScreenY(p.y);
      const sr = p.radius * scale;
      const pc = crystals[pi] || null;
      const isCooling = pc && pc.cooldownSec > 0;
      const chargeLevel = pc?.charge || 0;
      ctx.save();
      ctx.translate(sx, sy);

      // Ambient underwater grounding halo beneath pillar
      const underG = ctx.createRadialGradient(0, 0, sr * 0.65, 0, 0, sr * 1.38);
      underG.addColorStop(0, 'rgba(2, 6, 23, 0.52)');
      underG.addColorStop(1, 'rgba(2, 6, 23, 0)');
      ctx.fillStyle = underG;
      ctx.beginPath();
      ctx.arc(0, 0, sr * 1.38, 0, Math.PI * 2);
      ctx.fill();

      // Outer carved limestone mass with multi-stop rock gradient
      const pg = ctx.createRadialGradient(-sr * 0.34, -sr * 0.36, sr * 0.08, 0, 0, sr * 1.1);
      pg.addColorStop(0, '#788ca5');
      pg.addColorStop(0.38, '#3b4c63');
      pg.addColorStop(0.75, '#1e293b');
      pg.addColorStop(1, '#070f1d');
      ctx.fillStyle = pg;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const j = 0.91 + 0.12 * Math.cos(i * 3.1 + p.x) + 0.045 * Math.sin(i * 5.3 + pi);
        const rx = Math.cos(a) * sr * j;
        const ry = Math.sin(a) * sr * j;
        if (i === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = chargeLevel > 0 ? 'rgba(103, 232, 249, 0.82)' : 'rgba(148, 163, 184, 0.38)';
      ctx.lineWidth = Math.max(1.5, 0.068 * scale);
      ctx.stroke();

      // Inner sculpted rock ledge & carved strata grooves
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.58)';
      ctx.lineWidth = Math.max(1.1, 0.045 * scale);
      ctx.beginPath();
      ctx.arc(0, 0, sr * 0.74, -0.4, 2.3);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.16)';
      ctx.beginPath();
      ctx.arc(0, 0, sr * 0.74, 2.7, 5.4);
      ctx.stroke();

      // Bioluminescent teal cave moss tufts clinging to crevices
      ctx.fillStyle = 'rgba(45, 212, 191, 0.36)';
      for (let m = 0; m < 3; m++) {
        const ma = pi * 1.9 + m * 2.15;
        ctx.beginPath();
        ctx.ellipse(Math.cos(ma) * sr * 0.78, Math.sin(ma) * sr * 0.78, sr * 0.16, sr * 0.08, ma + 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Recessed carved Mayan stone socket with glowing etched rune ring
      ctx.fillStyle = '#071122';
      ctx.beginPath();
      ctx.arc(0, 0, sr * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isCooling
        ? 'rgba(71, 85, 105, 0.5)'
        : chargeLevel >= 2
          ? 'rgba(253, 224, 71, 0.75)'
          : 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = Math.max(1.1, 0.045 * scale);
      ctx.setLineDash([Math.max(3, sr * 0.18), Math.max(2, sr * 0.12)]);
      ctx.beginPath();
      ctx.arc(0, 0, sr * 0.52, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Multi-faceted quartz Resonance Crystal cluster with inner specular ridge
      const crysDark = isCooling ? '#1e293b' : chargeLevel >= 2 ? '#0284c7' : chargeLevel === 1 ? '#0369a1' : '#0c4a6e';
      const crysBright = isCooling ? '#475569' : chargeLevel >= 2 ? '#a5f3fc' : chargeLevel === 1 ? '#67e8f9' : '#38bdf8';
      const crysRim = isCooling ? '#64748b' : '#f0f9ff';
      for (let k = -1; k <= 1; k++) {
        ctx.save();
        ctx.rotate(k * 0.44);
        const h = (k === 0 ? 0.62 : 0.44) * sr;
        const w = (k === 0 ? 0.2 : 0.15) * sr;
        // Left lit facet
        ctx.fillStyle = crysBright;
        ctx.beginPath();
        ctx.moveTo(0, -h);
        ctx.lineTo(0, h * 0.46);
        ctx.lineTo(-w, 0);
        ctx.closePath();
        ctx.fill();
        // Right shaded facet
        ctx.fillStyle = crysDark;
        ctx.beginPath();
        ctx.moveTo(0, -h);
        ctx.lineTo(w, 0);
        ctx.lineTo(0, h * 0.46);
        ctx.closePath();
        ctx.fill();
        // Specular outline & center crystal spine
        ctx.strokeStyle = crysRim;
        ctx.lineWidth = Math.max(1.1, 0.042 * scale);
        ctx.beginPath();
        ctx.moveTo(0, -h);
        ctx.lineTo(w, 0);
        ctx.lineTo(0, h * 0.46);
        ctx.lineTo(-w, 0);
        ctx.closePath();
        ctx.stroke();
        if (!isCooling) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
          ctx.lineWidth = Math.max(0.9, 0.03 * scale);
          ctx.beginPath();
          ctx.moveTo(0, -h * 0.85);
          ctx.lineTo(0, h * 0.28);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore();
    }

    // 2b. Destructible Hanging Ceiling Stalactites (shoot loose to crush & stun the Boss!) (v189)
    this._drawSecretLairStalactites(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, lair);

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
        ctx.translate(-0.54 * scale, -0.14 * scale + Math.sin(timeSec * 2.8) * 0.05 * scale);
        ctx.rotate(-0.1);
        drawDetailedSpeargun(ctx, scale * 1.02, {
          torchOn: true,
          lensColor: '#fef08a',
          glowStamps: this.glowStamps,
        });
        ctx.restore();
        // Compact docked Combat DPV Scooter nestled below the Speargun in the armory cradle
        ctx.save();
        ctx.translate(0.18 * scale, 0.28 * scale + Math.sin(timeSec * 2.8 + 1.0) * 0.04 * scale);
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = Math.max(1.1, 0.04 * scale);
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(-0.52 * scale, -0.18 * scale, 0.28 * scale, 0.36 * scale, 0.06 * scale);
        } else {
          ctx.rect(-0.52 * scale, -0.18 * scale, 0.28 * scale, 0.36 * scale);
        }
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.moveTo(-0.24 * scale, -0.15 * scale);
        ctx.lineTo(0.28 * scale, -0.15 * scale);
        ctx.quadraticCurveTo(0.56 * scale, 0, 0.28 * scale, 0.15 * scale);
        ctx.lineTo(-0.24 * scale, 0.15 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#67e8f9';
        ctx.beginPath();
        ctx.arc(0.24 * scale, 0, Math.max(1.5, 0.05 * scale), 0, Math.PI * 2);
        ctx.fill();
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

    // 6. Secret Lair Boss (dispatches across all 4 unique biome bosses!) (v189)
    if (boss && (!boss.defeated || boss.defeatAnimSec > 0)) {
      if (boss.x + 18 >= visX0 && boss.x - 18 <= visX1 && boss.y + 18 >= visY0 && boss.y - 18 <= visY1) {
        this._drawSecretLairBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec);
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
    const ang = m.angle || 0;
    const flipY = Math.cos(ang) < 0 ? -1 : 1;
    const isTelegraph = m.state === 'telegraph';
    const isLunge = m.state === 'lunge';
    const sqX = flash ? 0.88 : isLunge ? 1.14 : isTelegraph ? 0.9 : 1.0;
    const sqY = flash ? 1.12 : isLunge ? 0.88 : isTelegraph ? 1.1 : 1.0;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ang);
    ctx.scale(sqX, flipY * sqY);

    if (m.kind === 'moray') {
      // === ABYSSAL CAVE MORAY (Sinuous Cel-Shaded Bioluminescent Eel + Flared Jaw Telegraph) ===
      const segCount = 9;
      const pts = [];
      for (let seg = 0; seg <= segCount; seg++) {
        const u = seg / segCount;
        pts.push({
          x: r * 0.22 - u * r * 2.75,
          y: Math.sin((m.wigglePhase || 0) - seg * 0.65) * r * (0.08 + u * 0.34),
          w: r * (0.48 * (1 - u * 0.72) + 0.06),
        });
      }

      // Soft bioluminescent aura behind head & crest
      const auraG = ctx.createRadialGradient(r * 0.2, 0, r * 0.1, r * 0.1, 0, r * 1.45);
      auraG.addColorStop(0, isTelegraph ? 'rgba(251, 113, 133, 0.38)' : 'rgba(34, 211, 238, 0.22)');
      auraG.addColorStop(1, 'rgba(34, 211, 238, 0)');
      ctx.fillStyle = auraG;
      ctx.beginPath();
      ctx.arc(r * 0.1, 0, r * 1.45, 0, Math.PI * 2);
      ctx.fill();

      // Translucent ruffled dorsal fin crest running along entire spine
      ctx.save();
      const finGrad = ctx.createLinearGradient(pts[0].x, -r * 0.9, pts[segCount].x, r * 0.2);
      if (isTelegraph || isLunge) {
        finGrad.addColorStop(0, 'rgba(251, 113, 133, 0.88)');
        finGrad.addColorStop(1, 'rgba(244, 63, 94, 0.28)');
      } else {
        finGrad.addColorStop(0, 'rgba(56, 189, 248, 0.72)');
        finGrad.addColorStop(1, 'rgba(45, 212, 191, 0.26)');
      }
      ctx.fillStyle = finGrad;
      ctx.beginPath();
      ctx.moveTo(pts[0].x - r * 0.05, pts[0].y - pts[0].w * 0.72);
      for (let i = 1; i <= segCount; i++) {
        const wave = Math.sin(timeSec * 11 + i * 1.3) * r * 0.06;
        const crestH = pts[i].w * (1.28 + (i === 1 ? 0.24 : 0));
        ctx.lineTo(pts[i].x, pts[i].y - crestH + wave);
      }
      for (let i = segCount; i >= 0; i--) {
        ctx.lineTo(pts[i].x, pts[i].y - pts[i].w * 0.35);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = isTelegraph ? '#fda4af' : 'rgba(125, 211, 252, 0.75)';
      ctx.lineWidth = Math.max(1.1, 0.042 * scale);
      ctx.stroke();
      ctx.restore();

      // Smooth tapered eel body ribbon (top edge -> rounded tail tip -> belly edge)
      const topPts = [];
      const botPts = [];
      for (let i = 0; i <= segCount; i++) {
        const pPrev = pts[Math.max(0, i - 1)];
        const pNext = pts[Math.min(segCount, i + 1)];
        const tx = pNext.x - pPrev.x;
        const ty = pNext.y - pPrev.y;
        const len = Math.hypot(tx, ty) || 1;
        const nx = ty / len;
        const ny = -tx / len;
        topPts.push({ x: pts[i].x + nx * pts[i].w, y: pts[i].y + ny * pts[i].w });
        botPts.push({ x: pts[i].x - nx * pts[i].w, y: pts[i].y - ny * pts[i].w });
      }
      const bodyGrad = ctx.createLinearGradient(0, -r * 0.65, 0, r * 0.65);
      bodyGrad.addColorStop(0, flash ? '#e0f2fe' : '#2dd4bf');
      bodyGrad.addColorStop(0.35, flash ? '#bae6fd' : '#0f526e');
      bodyGrad.addColorStop(0.8, '#0c2340');
      bodyGrad.addColorStop(1, '#38bdf8');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.moveTo(topPts[0].x, topPts[0].y);
      for (let i = 1; i <= segCount; i++) ctx.lineTo(topPts[i].x, topPts[i].y);
      ctx.lineTo(pts[segCount].x - r * 0.25, pts[segCount].y);
      for (let i = segCount; i >= 0; i--) ctx.lineTo(botPts[i].x, botPts[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = flash ? '#ffffff' : '#041021';
      ctx.lineWidth = Math.max(1.6, 0.072 * scale);
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Bioluminescent cyan leopard flank spots + subtle pastel belly stripe
      ctx.fillStyle = isTelegraph ? 'rgba(254, 205, 211, 0.72)' : 'rgba(103, 232, 249, 0.52)';
      for (let i = 1; i < segCount - 1; i++) {
        const pt = pts[i];
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y - pt.w * 0.22, pt.w * 0.32, pt.w * 0.2, 0.15, 0, Math.PI * 2);
        ctx.fill();
      }
      // Subtle curved gill slits behind head
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.55)';
      ctx.lineWidth = Math.max(1.1, 0.04 * scale);
      for (let g = 0; g < 2; g++) {
        ctx.beginPath();
        ctx.arc(-r * (0.04 + g * 0.14), r * 0.05, r * 0.16, -0.7, 0.8);
        ctx.stroke();
      }

      // Sculpted Moray Head + Hinged Jaws + Ivory Fang Rows + Telegraph Throat Glow
      const jawOpen = isTelegraph || isLunge ? 0.44 : 0.15;
      // Inner crimson maw
      ctx.fillStyle = isTelegraph ? '#e11d48' : '#4c0519';
      ctx.beginPath();
      ctx.moveTo(r * 0.22, -r * 0.08);
      ctx.lineTo(r * 0.94, -r * (jawOpen * 0.72));
      ctx.lineTo(r * 0.88, r * (jawOpen * 0.85));
      ctx.lineTo(r * 0.18, r * 0.16);
      ctx.closePath();
      ctx.fill();

      // Upper snout
      ctx.fillStyle = flash ? '#f0f9ff' : '#155e75';
      ctx.strokeStyle = flash ? '#ffffff' : '#041021';
      ctx.lineWidth = Math.max(1.6, 0.068 * scale);
      ctx.beginPath();
      ctx.moveTo(r * 0.05, -r * 0.46);
      ctx.quadraticCurveTo(r * 0.62, -r * 0.54, r * 1.04, -r * (jawOpen * 0.78 + 0.06));
      ctx.lineTo(r * 0.92, -r * (jawOpen * 0.38));
      ctx.lineTo(r * 0.26, -r * 0.04);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Lower jaw
      ctx.fillStyle = flash ? '#e0f2fe' : '#0e3c56';
      ctx.beginPath();
      ctx.moveTo(r * 0.14, r * 0.08);
      ctx.lineTo(r * 0.9, r * (jawOpen * 0.76));
      ctx.quadraticCurveTo(r * 0.62, r * (jawOpen + 0.22), r * 0.08, r * 0.36);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Curved glossy ivory fangs (upper + lower)
      ctx.fillStyle = '#f8fafc';
      for (let k = 0; k < 3; k++) {
        const tx = r * (0.46 + k * 0.16);
        const topY = -r * (jawOpen * 0.52 + 0.02);
        ctx.beginPath();
        ctx.moveTo(tx - r * 0.045, topY);
        ctx.lineTo(tx + r * 0.03, topY + r * 0.18);
        ctx.lineTo(tx + r * 0.06, topY);
        ctx.closePath();
        ctx.fill();
        if (k < 2) {
          const botY = r * (jawOpen * 0.62 + 0.02);
          ctx.beginPath();
          ctx.moveTo(tx + r * 0.05, botY);
          ctx.lineTo(tx + r * 0.09, botY - r * 0.14);
          ctx.lineTo(tx + r * 0.13, botY);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Expressive Anime Reptile Eye (golden amber iris, slit pupil, specular sparkle, angry brow!)
      const ex = r * 0.42;
      const ey = -r * 0.24;
      const er = r * 0.165;
      ctx.fillStyle = isTelegraph ? '#fb7185' : '#facc15';
      ctx.strokeStyle = '#041021';
      ctx.lineWidth = Math.max(1.2, 0.05 * scale);
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Vertical slit pupil
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.ellipse(ex + er * 0.16, ey, er * 0.28, er * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      // Crisp white anime catchlight
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - er * 0.25, ey - er * 0.28, er * 0.28, 0, Math.PI * 2);
      ctx.fill();
      // Fierce slanted brow ridge
      ctx.strokeStyle = '#041021';
      ctx.lineWidth = Math.max(1.6, 0.068 * scale);
      ctx.beginPath();
      ctx.moveTo(ex - er * 1.1, ey - er * 1.05);
      ctx.lineTo(ex + er * 1.15, ey - er * 0.45);
      ctx.stroke();

    } else if (m.kind === 'swarmer') {
      // === BRINE SPITTER SWARMER (Expressive Translucent Bio-Jelly Spitter) ===
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * 7.5 + (m.wigglePhase || 0));
      const spitCharge = m.cooldown < 0.45 ? 1 - m.cooldown / 0.45 : 0;

      // Soft emerald-lime ambient glow
      const glowG = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.55);
      glowG.addColorStop(0, spitCharge > 0.3 ? 'rgba(250, 204, 21, 0.36)' : 'rgba(163, 230, 53, 0.26)');
      glowG.addColorStop(1, 'rgba(132, 204, 22, 0)');
      ctx.fillStyle = glowG;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.55, 0, Math.PI * 2);
      ctx.fill();

      // 5 gracefully tapering undulating tentacles with glowing tip beads
      for (let k = -2; k <= 2; k++) {
        const swing = Math.sin((m.wigglePhase || 0) * 1.35 + k * 1.05) * 0.3 * r;
        const tipX = -r * (1.42 + (k % 2 === 0 ? 0.16 : 0));
        const tipY = k * r * 0.26 - swing * 0.65;
        ctx.strokeStyle = k % 2 === 0 ? 'rgba(163, 230, 53, 0.84)' : 'rgba(52, 211, 153, 0.72)';
        ctx.lineWidth = Math.max(1.5, (0.078 - Math.abs(k) * 0.008) * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.36, k * r * 0.2);
        ctx.quadraticCurveTo(-r * 0.94, k * r * 0.32 + swing, tipX, tipY);
        ctx.stroke();
        // Glowing bead tip
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(tipX, tipY, Math.max(1.6, 0.065 * scale), 0, Math.PI * 2);
        ctx.fill();
      }

      // Flared translucent side propulsion fins
      const finFlap = Math.sin((m.wigglePhase || 0) * 1.8) * 0.22;
      for (const sgn of [-1, 1]) {
        ctx.save();
        ctx.translate(-r * 0.08, sgn * r * 0.56);
        ctx.rotate(sgn * (0.35 + finFlap));
        ctx.fillStyle = 'rgba(74, 222, 128, 0.55)';
        ctx.strokeStyle = '#052e16';
        ctx.lineWidth = Math.max(1.2, 0.048 * scale);
        ctx.beginPath();
        ctx.ellipse(-r * 0.12, sgn * r * 0.14, r * 0.34, r * 0.14, sgn * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Plump cel-shaded translucent emerald dome mantle
      const sg = ctx.createRadialGradient(r * 0.16, -r * 0.22, r * 0.08, 0, 0, r * 1.04);
      sg.addColorStop(0, flash ? '#ffffff' : '#bef264');
      sg.addColorStop(0.36, flash ? '#ecfccb' : '#4d7c0f');
      sg.addColorStop(0.78, '#14532d');
      sg.addColorStop(1, '#052e16');
      ctx.fillStyle = sg;
      ctx.strokeStyle = flash ? '#ffffff' : '#052e16';
      ctx.lineWidth = Math.max(1.7, 0.074 * scale);
      ctx.beginPath();
      ctx.moveTo(-r * 0.66, -r * 0.52);
      ctx.quadraticCurveTo(r * 0.12, -r * 0.88, r * 0.92, -r * 0.24);
      ctx.quadraticCurveTo(r * 1.04, 0, r * 0.92, r * 0.24);
      ctx.quadraticCurveTo(r * 0.12, r * 0.88, -r * 0.66, r * 0.52);
      ctx.quadraticCurveTo(-r * 0.42, 0, -r * 0.66, -r * 0.52);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Pressurized Glowing Bio-Acid Sac inside translucent bell (flares brightly before spitting!)
      const sacR = r * (0.34 + 0.06 * pulse + spitCharge * 0.16);
      const vg = ctx.createRadialGradient(-r * 0.14, 0, 0, -r * 0.14, 0, sacR * 1.45);
      vg.addColorStop(0, '#ffffff');
      vg.addColorStop(0.42, spitCharge > 0.35 ? '#fde047' : '#bef264');
      vg.addColorStop(0.8, 'rgba(132, 204, 22, 0.45)');
      vg.addColorStop(1, 'rgba(132, 204, 22, 0)');
      ctx.fillStyle = vg;
      ctx.beginPath();
      ctx.arc(-r * 0.14, 0, sacR * 1.45, 0, Math.PI * 2);
      ctx.fill();

      // Glossy glass specular crescent on upper dome
      ctx.fillStyle = 'rgba(236, 252, 203, 0.42)';
      ctx.beginPath();
      ctx.ellipse(r * 0.12, -r * 0.42, r * 0.36, r * 0.12, -0.18, 0, Math.PI * 2);
      ctx.fill();

      // Cute/mischievous siphon nozzle + big expressive twin anime eyes!
      ctx.fillStyle = '#052e16';
      ctx.beginPath();
      ctx.ellipse(r * 0.88, 0, r * 0.12, r * (0.1 + spitCharge * 0.08), 0, 0, Math.PI * 2);
      ctx.fill();
      if (spitCharge > 0.25) {
        ctx.fillStyle = '#d9f99d';
        ctx.beginPath();
        ctx.arc(r * 0.92, 0, r * 0.09 * spitCharge, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const sgn of [-1, 1]) {
        const ex = r * 0.48;
        const ey = sgn * r * 0.25;
        const er = r * 0.165;
        ctx.fillStyle = '#fef08a';
        ctx.strokeStyle = '#052e16';
        ctx.lineWidth = Math.max(1.1, 0.045 * scale);
        ctx.beginPath();
        ctx.arc(ex, ey, er, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(ex + er * 0.22, ey, er * 0.48, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - er * 0.18, ey - er * 0.24, er * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }

    } else {
      // === ARMORED CENOTE STALKER (Heavy Titanium-Carapace Trilobite + Golden Crystal Rear Weakpoint) ===
      const legStride = Math.sin((m.wigglePhase || 0) * 1.4);

      // 6 articulated scurrying armored legs beneath carapace
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = Math.max(1.8, 0.085 * scale);
      ctx.lineCap = 'round';
      for (let leg = 0; leg < 3; leg++) {
        const lx = r * (0.28 - leg * 0.34);
        const swing = (leg % 2 === 0 ? legStride : -legStride) * r * 0.16;
        for (const sgn of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(lx, sgn * r * 0.55);
          ctx.lineTo(lx - r * 0.1 + swing, sgn * r * 1.02);
          ctx.lineTo(lx - r * 0.32 + swing, sgn * r * 1.18);
          ctx.stroke();
        }
      }

      // Exposed Glowing Golden-Amber Crystal Weakpoint Core at the rear! (Invites flanking or Hyper-Tip pierce!)
      const wkPulse = 0.6 + 0.4 * Math.sin(timeSec * 6.5 + (m.wigglePhase || 0));
      const ag = ctx.createRadialGradient(-r * 0.58, 0, r * 0.08, -r * 0.58, 0, r * 0.85);
      ag.addColorStop(0, '#fef9c3');
      ag.addColorStop(0.42, '#f59e0b');
      ag.addColorStop(0.75, 'rgba(245, 158, 11, 0.32)');
      ag.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.arc(-r * 0.58, 0, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      // Faceted amber weakpoint crystal protruding from rear shell gap
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = Math.max(1.2, 0.05 * scale);
      ctx.beginPath();
      ctx.moveTo(-r * 1.12, 0);
      ctx.lineTo(-r * 0.62, -r * (0.34 + wkPulse * 0.04));
      ctx.lineTo(-r * 0.25, 0);
      ctx.lineTo(-r * 0.62, r * (0.34 + wkPulse * 0.04));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef9c3';
      ctx.beginPath();
      ctx.moveTo(-r * 0.96, 0);
      ctx.lineTo(-r * 0.62, -r * 0.16);
      ctx.lineTo(-r * 0.42, 0);
      ctx.closePath();
      ctx.fill();

      // Articulated serrated front pincer mandibles (flare wide + glow crimson on telegraph!)
      const pincerOpen = isTelegraph || isLunge ? 0.26 : 0.0;
      for (const sgn of [-1, 1]) {
        ctx.save();
        ctx.translate(r * 0.62, sgn * r * 0.34);
        ctx.rotate(sgn * pincerOpen);
        ctx.fillStyle = isTelegraph ? '#fb7185' : '#94a3b8';
        ctx.strokeStyle = '#050a14';
        ctx.lineWidth = Math.max(1.6, 0.068 * scale);
        ctx.beginPath();
        ctx.moveTo(0, -sgn * r * 0.1);
        ctx.quadraticCurveTo(r * 0.54, sgn * r * 0.26, r * 0.82, -sgn * r * 0.14);
        ctx.quadraticCurveTo(r * 0.42, sgn * r * 0.06, 0, sgn * r * 0.12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Layered Overlapping Titanium-Slate Armored Carapace Plates (3 terraced shields)
      const cg = ctx.createRadialGradient(r * 0.25, -r * 0.25, r * 0.1, 0, 0, r * 1.12);
      cg.addColorStop(0, flash ? '#ffffff' : '#94a3b8');
      cg.addColorStop(0.45, flash ? '#cbd5e1' : '#334155');
      cg.addColorStop(0.82, '#1e293b');
      cg.addColorStop(1, '#070d19');
      ctx.fillStyle = cg;
      ctx.strokeStyle = flash ? '#ffffff' : '#050a14';
      ctx.lineWidth = Math.max(2.1, 0.088 * scale);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.02, -Math.PI * 0.66, Math.PI * 0.66);
      ctx.quadraticCurveTo(-r * 0.22, 0, Math.cos(-Math.PI * 0.66) * r * 1.02, Math.sin(-Math.PI * 0.66) * r * 1.02);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Terraced armor ridge lines + specular metallic highlight bevels
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.42)';
      ctx.lineWidth = Math.max(1.3, 0.055 * scale);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, -Math.PI * 0.56, Math.PI * 0.56);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.lineWidth = Math.max(1.4, 0.058 * scale);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.44, -Math.PI * 0.48, Math.PI * 0.48);
      ctx.stroke();
      // Metallic top reflection crescent
      ctx.fillStyle = 'rgba(241, 245, 249, 0.22)';
      ctx.beginPath();
      ctx.ellipse(r * 0.28, -r * 0.38, r * 0.34, r * 0.14, 0.32, 0, Math.PI * 2);
      ctx.fill();

      // Twin Glowing Visor Optic Slits peering beneath the front brow shield!
      for (const sgn of [-1, 1]) {
        const vx = r * 0.56;
        const vy = sgn * r * 0.24;
        ctx.fillStyle = isTelegraph ? '#ff2d55' : '#fb923c';
        ctx.beginPath();
        ctx.ellipse(vx, vy, r * 0.14, r * 0.075, sgn * -0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff7ed';
        ctx.beginPath();
        ctx.arc(vx + r * 0.03, vy, r * 0.038, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Sleek Rounded Pill Health Bar (shown cleanly when damaged or aggro)
    if (m.hp < m.maxHp || m.aggro) {
      const bw = Math.max(32, r * 1.9);
      const bh = 5;
      const bx = sx - bw * 0.5;
      const by = sy - r - 12;
      const ratio = Math.max(0, Math.min(1, m.hp / Math.max(1, m.maxHp)));
      ctx.save();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.86)';
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(bx - 1.5, by - 1.5, bw + 3, bh + 3, 4);
      } else {
        ctx.rect(bx - 1.5, by - 1.5, bw + 3, bh + 3);
      }
      ctx.fill();
      ctx.stroke();
      const hg = ctx.createLinearGradient(bx, by, bx + bw, by);
      if (m.kind === 'stalker') {
        hg.addColorStop(0, '#f59e0b');
        hg.addColorStop(1, '#fde047');
      } else if (m.kind === 'swarmer') {
        hg.addColorStop(0, '#65a30d');
        hg.addColorStop(1, '#bef264');
      } else {
        hg.addColorStop(0, '#e11d48');
        hg.addColorStop(1, '#fb7185');
      }
      ctx.fillStyle = hg;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(bx, by, Math.max(2, bw * ratio), bh, 3);
      } else {
        ctx.rect(bx, by, Math.max(2, bw * ratio), bh);
      }
      ctx.fill();
      ctx.restore();
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
   * Draw biome-styled Destructible Hanging Ceiling Stalactites (limestone / steel / icicle / onyx) (v189).
   */
  _drawSecretLairStalactites(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, lair) {
    const stalactites = lair?.stalactites;
    if (!Array.isArray(stalactites) || stalactites.length === 0) return;
    const styleColors = {
      limestone: { lit: '#94a3b8', mid: '#475569', dark: '#1e293b', rim: '#7dd3fc', ink: '#041021' },
      steel: { lit: '#d97706', mid: '#52525b', dark: '#1f2937', rim: '#fbbf24', ink: '#09090b' },
      icicle: { lit: '#e0f2fe', mid: '#38bdf8', dark: '#0369a1', rim: '#ffffff', ink: '#082f49' },
      onyx: { lit: '#a855f7', mid: '#3b0764', dark: '#0f172a', rim: '#fde047', ink: '#020617' },
      coral: { lit: '#fda4af', mid: '#e11d48', dark: '#881337', rim: '#fde047', ink: '#1f0510' },
      basalt: { lit: '#78716c', mid: '#292524', dark: '#0c0a09', rim: '#fb923c', ink: '#09090b' },
      gypsum: { lit: '#f5d0fe', mid: '#c084fc', dark: '#4c1d95', rim: '#bae6fd', ink: '#1e1b4b' },
      orichalcum: { lit: '#fef08a', mid: '#d97706', dark: '#451a03', rim: '#38bdf8', ink: '#1c1917' },
      iron: { lit: '#cbd5e1', mid: '#475569', dark: '#0f172a', rim: '#f97316', ink: '#020617' },
    };
    for (const st of stalactites) {
      if (st.state === 'broken') continue;
      if (st.x + 3 < visX0 || st.x - 3 > visX1 || st.y + 5 < visY0 || st.y - 3 > visY1) continue;
      const sx = toScreenX(st.x);
      const sy = toScreenY(st.y);
      const pal = styleColors[st.style] || styleColors.limestone;
      const w = 1.05 * scale;
      const h = 2.65 * scale;
      const cracked = st.hp < st.maxHp || st.state === 'falling';
      ctx.save();
      ctx.translate(sx, sy);

      // Falling speed motion streaks
      if (st.state === 'falling') {
        ctx.strokeStyle = 'rgba(224, 242, 254, 0.65)';
        ctx.lineWidth = Math.max(1.4, 0.06 * scale);
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(k * w * 0.45, -0.3 * scale);
          ctx.lineTo(k * w * 0.45, -2.4 * scale);
          ctx.stroke();
        }
      }

      // Left cel-lit facet
      ctx.fillStyle = st.flashSec > 0 ? '#ffffff' : pal.lit;
      ctx.beginPath();
      ctx.moveTo(-w * 0.92, -0.15 * scale);
      ctx.lineTo(0, -0.25 * scale);
      ctx.lineTo(0, h);
      ctx.lineTo(-w * 0.36, h * 0.56);
      ctx.closePath();
      ctx.fill();

      // Right cel-shaded facet
      ctx.fillStyle = st.flashSec > 0 ? '#fde047' : pal.dark;
      ctx.beginPath();
      ctx.moveTo(0, -0.25 * scale);
      ctx.lineTo(w * 0.92, -0.15 * scale);
      ctx.lineTo(w * 0.42, h * 0.52);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      // Crisp anime ink outline
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = Math.max(1.8, 0.075 * scale);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-w * 0.92, -0.15 * scale);
      ctx.lineTo(w * 0.92, -0.15 * scale);
      ctx.lineTo(w * 0.42, h * 0.52);
      ctx.lineTo(0, h);
      ctx.lineTo(-w * 0.36, h * 0.56);
      ctx.closePath();
      ctx.stroke();

      // Glowing mineral/frost edge sheen
      ctx.strokeStyle = pal.rim;
      ctx.globalAlpha = 0.58;
      ctx.lineWidth = Math.max(1.1, 0.04 * scale);
      ctx.beginPath();
      ctx.moveTo(-w * 0.55, 0.1 * scale);
      ctx.lineTo(-w * 0.15, h * 0.65);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Glowing amber fracture zigzag at ceiling root when cracked!
      if (cracked) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = Math.max(1.8, 0.075 * scale);
        ctx.beginPath();
        ctx.moveTo(-w * 0.72, 0.18 * scale);
        ctx.lineTo(-w * 0.18, 0.48 * scale);
        ctx.lineTo(w * 0.2, 0.26 * scale);
        ctx.lineTo(w * 0.68, 0.52 * scale);
        ctx.stroke();
      }
      ctx.restore();
    }
  },

  /**
   * Dispatch boss rendering across all 10 unique biome Secret Lair Guardians (v189–v195).
   */
  _drawSecretLairBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const t = Number.isFinite(timeSec) ? timeSec : 0;
    if (boss.kind === 'iron-leviathan') {
      this._drawIronLeviathanBoss(ctx, boss, toScreenX, toScreenY, scale, t);
    } else if (boss.kind === 'frost-wyrm') {
      this._drawFrostWyrmBoss(ctx, boss, toScreenX, toScreenY, scale, t);
    } else if (boss.kind === 'abyssal-empress') {
      this._drawAbyssalEmpressBoss(ctx, boss, toScreenX, toScreenY, scale, t);
    } else if (boss.kind === 'solar-leviathan') {
      this._drawSolarLeviathanBoss(ctx, boss, toScreenX, toScreenY, scale, t);
    } else if (boss.kind === 'thermal-nautilus') {
      this._drawThermalNautilusBoss(ctx, boss, toScreenX, toScreenY, scale, t);
    } else if (boss.kind === 'crystal-basilisk') {
      this._drawCrystalBasiliskBoss(ctx, boss, toScreenX, toScreenY, scale, t);
    } else if (boss.kind === 'phantom-uboat') {
      this._drawPhantomUBoatBoss(ctx, boss, toScreenX, toScreenY, scale, t);
    } else if (boss.kind === 'orichalcum-colossus') {
      this._drawOrichalcumColossusBoss(ctx, boss, toScreenX, toScreenY, scale, t);
    } else if (boss.kind === 'drill-wyrm') {
      this._drawDrillWyrmBoss(ctx, boss, toScreenX, toScreenY, scale, t);
    } else if (boss.kind === 'coral-dragon') {
      this._drawCoralDragonBoss(ctx, boss, toScreenX, toScreenY, scale, t);
    } else if (boss.kind === 'spectral-dreadnought') {
      this._drawSpectralDreadnoughtBoss(ctx, boss, toScreenX, toScreenY, scale, t);
    } else {
      this._drawCaveKrakenBoss(ctx, boss, toScreenX, toScreenY, scale, t);
    }
  },

  /**
   * Shared world-upright anime dizzy stars & dormant Zzz bubbles for all bosses (v189).
   */
  _drawBossStatusEmotes(ctx, boss, sx, sy, r, floatBobY, scale, timeSec) {
    const isStunned = boss.aiState === 'stunned';
    const anim = boss.anim || {};
    if (isStunned && !boss.defeated) {
      ctx.save();
      ctx.translate(sx, sy - 1.25 * r + floatBobY);
      for (let s = 0; s < 3; s++) {
        const sa = (anim.dizzyAngle || timeSec * 4.5) + (s * Math.PI * 2) / 3;
        const stx = Math.cos(sa) * 0.75 * r;
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
    } else if (boss.aiState === 'dormant' && !boss.defeated) {
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
   * IRON LEVIATHAN MK-IV — Armored WWII Deep-Sea Mech-Anglerfish Guardian (SS Thistlegorm) (v189).
   */
  _drawIronLeviathanBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(boss.x);
    const sy = toScreenY(boss.y);
    const r = boss.radius * scale;
    const anim = boss.anim || {};
    const facing = (anim.facing ?? -1) < 0 ? -1 : 1;
    const isStunned = boss.aiState === 'stunned';
    const isHurt = boss.hitFlash > 0;
    const isAngry = boss.phase >= 3 || boss.aiState.includes('windup') || boss.aiState === 'lunge_dash' || boss.aiState === 'beam_sweep';
    const glowCol = boss.phase >= 3 ? '#fb7185' : boss.phase === 2 ? '#c084fc' : '#fbbf24';
    const hullTop = boss.phase >= 3 ? '#57534e' : '#475569';
    const hullBot = boss.phase >= 3 ? '#1c1917' : '#0f172a';
    const brass = '#d97706';
    const floatBobY = Math.sin(timeSec * 2.4) * 0.12 * r;
    const tailWag = Math.sin(timeSec * (isAngry ? 9 : 4.2)) * 0.24;
    const jawOpen = isAngry ? 0.32 + Math.sin(timeSec * 14) * 0.1 : 0.1 + Math.sin(timeSec * 3.5) * 0.04;

    ctx.save();
    ctx.translate(sx, sy + floatBobY);
    if (boss.defeated && boss.defeatAnimSec > 0) {
      ctx.globalAlpha = Math.max(0.08, boss.defeatAnimSec / 3.6);
      ctx.rotate((3.6 - boss.defeatAnimSec) * 0.6);
    }
    ctx.scale(facing * (anim.scaleX || 1), anim.scaleY || 1);

    // 1. Twin Propulsor Tail Rudder & Wake Jet
    ctx.save();
    ctx.translate(-r * 0.92, 0);
    ctx.rotate(tailWag);
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(2, 0.085 * scale);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.36);
    ctx.lineTo(-r * 0.72, -r * 0.68);
    ctx.lineTo(-r * 0.56, 0);
    ctx.lineTo(-r * 0.72, r * 0.68);
    ctx.lineTo(0, r * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Brass prop exhaust nozzle
    ctx.fillStyle = glowCol;
    ctx.beginPath();
    ctx.ellipse(-r * 0.52, 0, r * 0.14, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Articulated Iron Dorsal Lure Stalk + Glowing Plasma Lantern Weakpoint
    const lureSway = Math.sin(timeSec * 4.5) * 0.12 * r;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(3, 0.14 * scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.15, -r * 0.72);
    ctx.quadraticCurveTo(r * 0.78, -r * 1.48, r * 1.16 + lureSway, -r * 0.74);
    ctx.stroke();
    // Lantern core
    const lx = r * 1.16 + lureSway;
    const ly = -r * 0.68;
    const lg = ctx.createRadialGradient(lx, ly, r * 0.04, lx, ly, r * 0.52);
    lg.addColorStop(0, '#ffffff');
    lg.addColorStop(0.35, glowCol);
    lg.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(lx, ly, r * 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef9c3';
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(1.5, 0.06 * scale);
    ctx.beginPath();
    ctx.arc(lx, ly, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 3. Riveted Battleship Armored Hull Body
    const bodyG = ctx.createLinearGradient(0, -r * 0.95, 0, r * 0.95);
    bodyG.addColorStop(0, isHurt ? '#ffffff' : hullTop);
    bodyG.addColorStop(0.55, isHurt ? '#fef08a' : '#27364b');
    bodyG.addColorStop(1, hullBot);
    ctx.fillStyle = bodyG;
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(2.4, 0.1 * scale);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.04, r * 0.86, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Brass armor plate seam & rivets
    ctx.strokeStyle = brass;
    ctx.lineWidth = Math.max(1.8, 0.075 * scale);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, -Math.PI * 0.72, Math.PI * 0.72);
    ctx.stroke();
    ctx.fillStyle = '#fcd34d';
    for (let rv = 0; rv < 5; rv++) {
      const ra = -1.1 + rv * 0.55;
      ctx.beginPath();
      ctx.arc(Math.cos(ra) * r * 0.72, Math.sin(ra) * r * 0.58, Math.max(1.8, 0.055 * r), 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Three Glowing Boiler Furnace Gill Vents
    for (let v = 0; v < 3; v++) {
      const vx = -r * (0.12 + v * 0.24);
      ctx.fillStyle = glowCol;
      ctx.strokeStyle = '#041021';
      ctx.lineWidth = Math.max(1.2, 0.05 * scale);
      ctx.beginPath();
      ctx.ellipse(vx, r * 0.05, r * 0.075, r * 0.34 - v * 0.04 * r, 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 5. Upper & Lower Armored Mandible Jaws with Interlocking Steel Fangs
    // Upper fang ridge
    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(1.6, 0.065 * scale);
    for (let t = 0; t < 4; t++) {
      const tx = r * (0.58 + t * 0.13);
      ctx.beginPath();
      ctx.moveTo(tx, r * 0.06);
      ctx.lineTo(tx + r * 0.055, r * 0.24);
      ctx.lineTo(tx + r * 0.11, r * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Articulated lower steel jaw
    ctx.save();
    ctx.translate(r * 0.56, r * 0.28);
    ctx.rotate(jawOpen);
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(2, 0.08 * scale);
    ctx.beginPath();
    ctx.moveTo(-r * 0.22, 0);
    ctx.lineTo(r * 0.62, r * 0.04);
    ctx.lineTo(r * 0.48, r * 0.36);
    ctx.lineTo(-r * 0.28, r * 0.26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Interlocking lower steel teeth
    ctx.fillStyle = '#f8fafc';
    for (let t = 0; t < 4; t++) {
      const tx = -r * 0.04 + t * r * 0.155;
      ctx.beginPath();
      ctx.moveTo(tx, 0);
      ctx.lineTo(tx + r * 0.06, -r * 0.2);
      ctx.lineTo(tx + r * 0.12, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // 6. Expressive Armored Brow + Searchlight Porthole Eye with White Catchlights
    const ex = r * 0.44;
    const ey = -r * 0.22;
    const er = r * 0.24;
    ctx.fillStyle = brass;
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(1.8, 0.075 * scale);
    ctx.beginPath();
    ctx.arc(ex, ey, er * 1.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const eyeG = ctx.createRadialGradient(ex, ey, er * 0.1, ex, ey, er);
    eyeG.addColorStop(0, '#ffffff');
    eyeG.addColorStop(0.5, isStunned ? '#94a3b8' : glowCol);
    eyeG.addColorStop(1, '#7c2d12');
    ctx.fillStyle = eyeG;
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fill();
    // Dark vertical pupil & glossy catchlight
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.ellipse(ex + er * 0.15, ey, er * 0.22, er * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - er * 0.26, ey - er * 0.28, er * 0.26, 0, Math.PI * 2);
    ctx.fill();
    // Fierce angled iron brow hood over searchlight eye
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(1.8, 0.075 * scale);
    ctx.beginPath();
    ctx.moveTo(ex - er * 1.25, ey - er * 0.95);
    ctx.lineTo(ex + er * 1.25, ey - er * 0.28);
    ctx.lineTo(ex + er * 1.05, ey - er * 0.95);
    ctx.lineTo(ex - er * 0.9, ey - er * 1.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 7. Spinning Side Hydro-Turbine Fin
    ctx.save();
    ctx.translate(r * 0.05, r * 0.46);
    ctx.rotate(Math.sin(timeSec * 6) * 0.28);
    ctx.fillStyle = brass;
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(1.8, 0.07 * scale);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.36, r * 0.18, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
    this._drawBossStatusEmotes(ctx, boss, sx, sy, r, floatBobY, scale, timeSec);
  },



  /**
   * BOREALIS WYRM — Luminous Crystalline Arctic Ice Serpent (Scoresby Sund) (v189).
   */
  _drawFrostWyrmBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(boss.x);
    const sy = toScreenY(boss.y);
    const r = boss.radius * scale;
    const anim = boss.anim || {};
    const facing = (anim.facing ?? -1) < 0 ? -1 : 1;
    const isStunned = boss.aiState === 'stunned';
    const isHurt = boss.hitFlash > 0;
    const auroraA = boss.phase >= 3 ? '#f472b6' : boss.phase === 2 ? '#a78bfa' : '#34d399';
    const iceTop = boss.phase >= 3 ? '#fbcfe8' : '#e0f2fe';
    const iceMid = boss.phase >= 3 ? '#e879f9' : '#38bdf8';
    const iceDark = boss.phase >= 3 ? '#581c87' : '#0c4a6e';
    const floatBobY = Math.sin(timeSec * 2.6) * 0.14 * r;

    ctx.save();
    ctx.translate(sx, sy + floatBobY);
    if (boss.defeated && boss.defeatAnimSec > 0) {
      ctx.globalAlpha = Math.max(0.08, boss.defeatAnimSec / 3.6);
      ctx.rotate((3.6 - boss.defeatAnimSec) * 0.65);
    }
    ctx.scale(facing * (anim.scaleX || 1), anim.scaleY || 1);

    // 1. Undulating Segmented Glacial Serpent Body (back to front)
    for (let s = 5; s >= 1; s--) {
      const segX = -s * r * 0.44;
      const segY = Math.sin(timeSec * 4.6 - s * 0.9) * r * (0.22 + s * 0.045);
      const segR = r * (0.86 - s * 0.11);
      // Translucent aurora dorsal ribbon fin
      ctx.fillStyle = auroraA;
      ctx.globalAlpha = 0.62;
      ctx.beginPath();
      ctx.moveTo(segX - segR * 0.4, segY - segR * 0.65);
      ctx.lineTo(segX + segR * 0.1, segY - segR * 1.48);
      ctx.lineTo(segX + segR * 0.5, segY - segR * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      const sg = ctx.createRadialGradient(segX - segR * 0.2, segY - segR * 0.25, segR * 0.08, segX, segY, segR);
      sg.addColorStop(0, isHurt ? '#ffffff' : iceTop);
      sg.addColorStop(0.5, iceMid);
      sg.addColorStop(1, iceDark);
      ctx.fillStyle = sg;
      ctx.strokeStyle = '#041021';
      ctx.lineWidth = Math.max(2, 0.085 * scale);
      ctx.beginPath();
      ctx.ellipse(segX, segY, segR * 1.05, segR * 0.84, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 2. Sculpted Frost Wyrm Head & Crystalline Crown Horns
    ctx.fillStyle = '#f0f9ff';
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(2, 0.08 * scale);
    // Swept crystal ice antlers
    for (let h = -1; h <= 1; h += 2) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.15, -r * 0.55);
      ctx.lineTo(-r * 0.85, -r * (1.28 + (h > 0 ? 0.18 : 0)));
      ctx.lineTo(-r * 0.42, -r * 0.72);
      ctx.lineTo(-r * 0.02, -r * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    const headG = ctx.createRadialGradient(r * 0.18, -r * 0.26, r * 0.1, r * 0.1, 0, r * 1.05);
    headG.addColorStop(0, isHurt ? '#ffffff' : iceTop);
    headG.addColorStop(0.48, iceMid);
    headG.addColorStop(1, iceDark);
    ctx.fillStyle = headG;
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(2.4, 0.1 * scale);
    ctx.beginPath();
    ctx.moveTo(r * 1.18, 0.02 * r);
    ctx.quadraticCurveTo(r * 0.72, -r * 0.85, -r * 0.35, -r * 0.78);
    ctx.quadraticCurveTo(-r * 0.92, 0, -r * 0.35, r * 0.78);
    ctx.quadraticCurveTo(r * 0.68, r * 0.78, r * 1.18, 0.02 * r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Borealis Heart Diamond on forehead
    ctx.fillStyle = auroraA;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.4, 0.055 * scale);
    ctx.beginPath();
    ctx.moveTo(r * 0.58, -r * 0.38);
    ctx.lineTo(r * 0.74, -r * 0.22);
    ctx.lineTo(r * 0.58, -r * 0.06);
    ctx.lineTo(r * 0.42, -r * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Flowing luminous whisker tendrils + sculpted crystalline jaw line & fangs
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(1.8, 0.07 * scale);
    ctx.beginPath();
    ctx.moveTo(r * 1.06, r * 0.14);
    ctx.quadraticCurveTo(r * 0.56, r * 0.34, r * 0.05, r * 0.24);
    ctx.stroke();
    ctx.fillStyle = '#f0f9ff';
    for (let f = 0; f < 3; f++) {
      const fx = r * (0.86 - f * 0.2);
      ctx.beginPath();
      ctx.moveTo(fx, r * 0.2);
      ctx.lineTo(fx - r * 0.06, r * 0.42);
      ctx.lineTo(fx - r * 0.12, r * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Swept translucent ice cheek fin
    ctx.fillStyle = auroraA;
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    ctx.moveTo(-r * 0.08, r * 0.18);
    ctx.lineTo(-r * 0.88, r * 0.68);
    ctx.lineTo(-r * 0.52, r * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = auroraA;
    ctx.lineWidth = Math.max(2, 0.075 * scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.88, r * 0.16);
    ctx.quadraticCurveTo(r * 0.45, r * 0.82 + Math.sin(timeSec * 6) * 0.18 * r, -r * 0.28, r * 0.95);
    ctx.stroke();

    // Fierce Sparkling Anime Ice-Dragon Eye + Angled Crystalline Brow Crest
    const ex = r * 0.24;
    const ey = -r * 0.16;
    const er = r * 0.25;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(1.8, 0.075 * scale);
    ctx.beginPath();
    ctx.ellipse(ex, ey, er * 1.12, er * 0.82, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const irisG = ctx.createLinearGradient(ex, ey - er, ex, ey + er);
    irisG.addColorStop(0, isStunned ? '#94a3b8' : '#fef08a');
    irisG.addColorStop(1, auroraA);
    ctx.fillStyle = irisG;
    ctx.beginPath();
    ctx.arc(ex + er * 0.1, ey, er * 0.66, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.ellipse(ex + er * 0.16, ey, er * 0.18, er * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - er * 0.18, ey - er * 0.24, er * 0.24, 0, Math.PI * 2);
    ctx.fill();
    // Fierce dragon ice brow ridge
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(2.4, 0.095 * scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - er * 1.2, ey - er * 0.82);
    ctx.lineTo(ex + er * 1.15, ey - er * 0.36);
    ctx.stroke();

    ctx.restore();
    this._drawBossStatusEmotes(ctx, boss, sx, sy, r, floatBobY, scale, timeSec);
  },



  /**
   * ABYSSAL EMPRESS — Regal Bioluminescent Winged Manta-Hydra Queen (Krubera-Voronya Sump) (v189).
   */
  _drawAbyssalEmpressBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(boss.x);
    const sy = toScreenY(boss.y);
    const r = boss.radius * scale;
    const anim = boss.anim || {};
    const facing = (anim.facing ?? -1) < 0 ? -1 : 1;
    const isStunned = boss.aiState === 'stunned';
    const isHurt = boss.hitFlash > 0;
    const wingFlap = Math.sin(timeSec * (boss.phase >= 3 ? 6.5 : 3.6)) * 0.26;
    const gold = '#fde047';
    const wingTop = boss.phase >= 3 ? '#f43f5e' : boss.phase === 2 ? '#a855f7' : '#4f46e5';
    const wingDeep = boss.phase >= 3 ? '#4c0519' : '#1e1b4b';
    const glyphCol = boss.phase >= 3 ? '#fecdd3' : '#67e8f9';
    const floatBobY = Math.sin(timeSec * 2.2) * 0.16 * r;

    ctx.save();
    ctx.translate(sx, sy + floatBobY);
    if (boss.defeated && boss.defeatAnimSec > 0) {
      ctx.globalAlpha = Math.max(0.08, boss.defeatAnimSec / 3.6);
      ctx.rotate((3.6 - boss.defeatAnimSec) * 0.55);
    }
    ctx.scale(facing * (anim.scaleX || 1), anim.scaleY || 1);

    // 1. Twin Graceful Bioluminescent Ribbon Tails
    for (let t = -1; t <= 1; t += 2) {
      ctx.strokeStyle = t < 0 ? glyphCol : gold;
      ctx.lineWidth = Math.max(2.2, 0.085 * scale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, t * r * 0.18);
      ctx.bezierCurveTo(
        -r * 1.25,
        t * r * 0.52 + Math.sin(timeSec * 4 + t) * 0.28 * r,
        -r * 1.85,
        t * r * 0.15 - Math.sin(timeSec * 4 + t) * 0.34 * r,
        -r * 2.45,
        t * r * 0.38 + Math.sin(timeSec * 5 + t) * 0.25 * r
      );
      ctx.stroke();
    }

    // 2. Sweeping Royal Manta Wings with Glowing Constellation Markings
    for (let side = -1; side <= 1; side += 2) {
      ctx.save();
      ctx.scale(1, side);
      ctx.rotate(wingFlap * 0.55);
      const wg = ctx.createLinearGradient(0, 0, -r * 0.4, -r * 1.9);
      wg.addColorStop(0, isHurt ? '#ffffff' : wingTop);
      wg.addColorStop(0.55, '#312e81');
      wg.addColorStop(1, wingDeep);
      ctx.fillStyle = wg;
      ctx.strokeStyle = '#041021';
      ctx.lineWidth = Math.max(2.2, 0.095 * scale);
      ctx.beginPath();
      ctx.moveTo(r * 0.62, -r * 0.12);
      ctx.quadraticCurveTo(r * 0.25, -r * 1.55, -r * 0.85, -r * 1.85);
      ctx.quadraticCurveTo(-r * 0.58, -r * 0.95, -r * 0.82, -r * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Glowing constellation spots on wing
      ctx.fillStyle = glyphCol;
      for (let d = 0; d < 3; d++) {
        ctx.beginPath();
        ctx.arc(-r * (0.08 + d * 0.22), -r * (0.62 + d * 0.36), Math.max(2, r * (0.1 - d * 0.02)), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 3. Sculpted Regal Manta-Queen Body Core, Cephalic Snout Lobes & Golden Empress Diadem Crown
    const cg = ctx.createRadialGradient(r * 0.25, -r * 0.18, r * 0.08, 0, 0, r * 1.05);
    cg.addColorStop(0, isHurt ? '#ffffff' : '#818cf8');
    cg.addColorStop(0.52, wingTop);
    cg.addColorStop(1, wingDeep);
    ctx.fillStyle = cg;
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(2.4, 0.1 * scale);
    ctx.beginPath();
    ctx.moveTo(r * 1.18, -r * 0.04);
    ctx.bezierCurveTo(r * 0.72, -r * 0.66, -r * 0.32, -r * 0.62, -r * 0.94, 0);
    ctx.bezierCurveTo(-r * 0.32, r * 0.56, r * 0.65, r * 0.58, r * 1.18, -r * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sweeping cephalic manta snout horn & pale pearl belly sheen
    ctx.fillStyle = 'rgba(224, 242, 254, 0.26)';
    ctx.beginPath();
    ctx.ellipse(r * 0.18, r * 0.22, r * 0.66, r * 0.22, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = wingTop;
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(1.8, 0.07 * scale);
    ctx.beginPath();
    ctx.moveTo(r * 0.96, r * 0.06);
    ctx.quadraticCurveTo(r * 1.38, r * 0.18, r * 1.24, r * 0.44);
    ctx.quadraticCurveTo(r * 0.98, r * 0.36, r * 0.78, r * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sculpted Golden Empress Diadem Crown perched along dorsal crest
    ctx.fillStyle = gold;
    ctx.strokeStyle = '#713f12';
    ctx.lineWidth = Math.max(1.8, 0.07 * scale);
    ctx.beginPath();
    ctx.moveTo(r * 0.02, -r * 0.48);
    ctx.lineTo(r * 0.16, -r * 1.04);
    ctx.lineTo(r * 0.34, -r * 0.64);
    ctx.lineTo(r * 0.54, -r * 1.14);
    ctx.lineTo(r * 0.64, -r * 0.54);
    ctx.lineTo(r * 0.86, -r * 0.8);
    ctx.lineTo(r * 0.72, -r * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Radiant Pearl Jewel in Diadem
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(r * 0.52, -r * 0.74, r * 0.11, 0, Math.PI * 2);
    ctx.fill();

    // 4. Regal Side-Profile Anime Eye with Sweeping Eyelash, Golden Iris & Cheek Constellation Marks
    const ex = r * 0.46;
    const ey = -r * 0.12;
    const er = r * 0.24;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(1.8, 0.075 * scale);
    ctx.beginPath();
    ctx.ellipse(ex, ey, er * 1.24, er * 0.86, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const irisG = ctx.createLinearGradient(ex, ey - er, ex, ey + er);
    irisG.addColorStop(0, isStunned ? '#94a3b8' : '#fef08a');
    irisG.addColorStop(1, '#f59e0b');
    ctx.fillStyle = irisG;
    ctx.beginPath();
    ctx.arc(ex + er * 0.12, ey, er * 0.66, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(ex + er * 0.18, ey, er * 0.24, er * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - er * 0.18, ey - er * 0.24, er * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + er * 0.32, ey + er * 0.24, er * 0.11, 0, Math.PI * 2);
    ctx.fill();
    // Sweeping royal upper eyelash wing
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(2.4, 0.095 * scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - er * 1.32, ey - er * 0.25);
    ctx.quadraticCurveTo(ex, ey - er * 1.12, ex + er * 1.24, ey - er * 0.18);
    ctx.stroke();
    // Glowing cheek constellation jewels
    ctx.fillStyle = glyphCol;
    for (let j = 0; j < 3; j++) {
      ctx.beginPath();
      ctx.arc(r * (0.28 - j * 0.18), r * (0.16 + j * 0.04), Math.max(1.8, r * (0.065 - j * 0.012)), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    this._drawBossStatusEmotes(ctx, boss, sx, sy, r, floatBobY, scale, timeSec);
  },

  /**
   * SOLAR LEVIATHAN — Radiant Red Sea Reef Dragon-Serpent Guardian (Dahab Blue Hole) (v193).
   */
  _drawSolarLeviathanBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(boss.x);
    const sy = toScreenY(boss.y);
    const r = (boss.radius || 4.5) * scale;
    const facing = boss.facing || -1;
    const hitF = boss.hitFlash || 0;
    const isStunned = boss.aiState === 'stunned';
    const anim = boss.anim || {};
    const breath = 1 + Math.sin(timeSec * 3.1) * 0.03;
    const floatBobY = Math.sin(timeSec * 2.2) * 0.1 * r;

    ctx.save();
    ctx.translate(sx, sy + floatBobY);
    if (boss.defeated) {
      ctx.globalAlpha = Math.max(0.2, 1 - (boss.defeatTimer || 0) * 0.28);
    }
    ctx.scale(facing * (anim.squashX || 1) * breath, (anim.squashY || 1) / breath);

    const sunGold = boss.phase >= 3 ? '#fb7185' : boss.phase === 2 ? '#fbbf24' : '#fde047';
    const reefTeal = boss.phase >= 3 ? '#f472b6' : '#2dd4bf';
    const scaleMid = hitF > 0 ? '#ffffff' : boss.phase >= 3 ? '#be123c' : '#d97706';
    const scaleDark = hitF > 0 ? '#fef3c7' : '#78350f';

    // 1. Undulating Serpent Body Coils trailing behind the head
    for (let i = 5; i >= 1; i--) {
      const segX = -r * (0.46 + i * 0.34);
      const segY = Math.sin(timeSec * 4.2 - i * 0.92) * r * (0.28 + i * 0.045);
      const segR = r * (0.64 - i * 0.082);
      // Radiant turquoise-gold dorsal sun-ray fin per coil
      ctx.fillStyle = i % 2 === 0 ? reefTeal : sunGold;
      ctx.strokeStyle = '#041021';
      ctx.lineWidth = Math.max(1.8, 0.075 * scale);
      ctx.beginPath();
      ctx.moveTo(segX - segR * 0.25, segY - segR * 0.65);
      ctx.lineTo(segX - segR * 0.6, segY - segR * 1.55);
      ctx.lineTo(segX + segR * 0.38, segY - segR * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Golden armored coil segment
      const sg = ctx.createRadialGradient(segX - segR * 0.2, segY - segR * 0.25, segR * 0.1, segX, segY, segR);
      sg.addColorStop(0, hitF > 0 ? '#ffffff' : '#fef08a');
      sg.addColorStop(0.52, scaleMid);
      sg.addColorStop(1, scaleDark);
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(segX, segY, segR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 2. Fanned Lionfish-Helios Solar Halo Rays behind the head
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(2, 0.08 * scale);
    for (let ray = 0; ray < 7; ray++) {
      const a = -Math.PI * 0.85 + ray * 0.29 + Math.sin(timeSec * 3.8 + ray) * 0.04;
      const innerR = r * 0.65;
      const outerR = r * (ray % 2 === 0 ? 1.55 : 1.32);
      ctx.fillStyle = ray % 2 === 0 ? sunGold : reefTeal;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.09) * innerR, Math.sin(a - 0.09) * innerR);
      ctx.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
      ctx.lineTo(Math.cos(a + 0.09) * innerR, Math.sin(a + 0.09) * innerR);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 3. Sculpted Reef-Serpent Head Silhouette + Swept Cheek Fin & Fangs
    const headG = ctx.createRadialGradient(r * 0.2, -r * 0.26, r * 0.1, r * 0.08, 0, r * 1.04);
    headG.addColorStop(0, hitF > 0 ? '#ffffff' : '#fef9c3');
    headG.addColorStop(0.45, scaleMid);
    headG.addColorStop(1, scaleDark);
    ctx.fillStyle = headG;
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(2.6, 0.11 * scale);
    ctx.beginPath();
    ctx.moveTo(-r * 0.56, -r * 0.44);
    ctx.quadraticCurveTo(r * 0.18, -r * 0.94, r * 0.98, -r * 0.12);
    ctx.quadraticCurveTo(r * 1.12, r * 0.2, r * 0.72, r * 0.46);
    ctx.quadraticCurveTo(r * 0.1, r * 0.66, -r * 0.52, r * 0.44);
    ctx.quadraticCurveTo(-r * 0.92, r * 0.02, -r * 0.56, -r * 0.44);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Gleaming upper reef fangs
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.4, 0.06 * scale);
    for (let f = 0; f < 3; f++) {
      const fx = r * (0.48 + f * 0.15);
      const fy = r * (0.38 - f * 0.05);
      ctx.beginPath();
      ctx.moveTo(fx - r * 0.05, fy);
      ctx.lineTo(fx + r * 0.02, fy + r * 0.17);
      ctx.lineTo(fx + r * 0.08, fy - r * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 4. Radiant Solar Prism Crown Jewel Weakpoint
    const wx = Math.cos(boss.weakAngle || 0) * r * 0.85 * facing;
    const wy = Math.sin(boss.weakAngle || 0) * r * 0.85;
    const pulse = 0.78 + 0.22 * Math.sin(timeSec * 8.5);
    const crR = r * 0.32 * pulse;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = Math.max(2, 0.08 * scale);
    ctx.beginPath();
    ctx.moveTo(wx, wy - crR * 1.35);
    ctx.lineTo(wx + crR * 0.95, wy);
    ctx.lineTo(wx, wy + crR * 1.35);
    ctx.lineTo(wx - crR * 0.95, wy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 5. Single Regal Side-Profile Anime Eye (turquoise-gold caustic iris + fierce brow)
    const ex = r * 0.34;
    const ey = -r * 0.14;
    const er = r * 0.27;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(2, 0.08 * scale);
    ctx.beginPath();
    ctx.ellipse(ex, ey, er * 1.15, er * 0.88, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (isStunned) {
      ctx.strokeStyle = '#041021';
      ctx.lineWidth = Math.max(2.4, 0.095 * scale);
      ctx.beginPath();
      ctx.moveTo(ex - er * 0.5, ey - er * 0.45);
      ctx.lineTo(ex + er * 0.5, ey + er * 0.45);
      ctx.moveTo(ex + er * 0.5, ey - er * 0.45);
      ctx.lineTo(ex - er * 0.5, ey + er * 0.45);
      ctx.stroke();
    } else {
      const irisG = ctx.createLinearGradient(ex, ey - er, ex, ey + er);
      irisG.addColorStop(0, '#0f766e');
      irisG.addColorStop(0.55, reefTeal);
      irisG.addColorStop(1, '#fef08a');
      ctx.fillStyle = irisG;
      ctx.beginPath();
      ctx.arc(ex + er * 0.08, ey, er * 0.66, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#041021';
      ctx.beginPath();
      ctx.ellipse(ex + er * 0.12, ey, er * 0.2, er * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - er * 0.18, ey - er * 0.24, er * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(2.5, 0.1 * scale);
    ctx.beginPath();
    ctx.moveTo(ex - er * 1.25, ey - er * 0.62);
    ctx.quadraticCurveTo(ex + er * 0.1, ey - er * 1.05, ex + er * 1.18, ey - er * 0.34);
    ctx.stroke();

    ctx.restore();
    this._drawBossStatusEmotes(ctx, boss, sx, sy, r, floatBobY, scale, timeSec);
  },

  /**
   * HYDROTHERMAL NAUTILUS — Armored Volcanic Basalt Chambered Nautilus Guardian (Iceland Strýtan) (v193).
   */
  _drawThermalNautilusBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(boss.x);
    const sy = toScreenY(boss.y);
    const r = (boss.radius || 4.6) * scale;
    const facing = boss.facing || -1;
    const hitF = boss.hitFlash || 0;
    const isStunned = boss.aiState === 'stunned';
    const anim = boss.anim || {};
    const breath = 1 + Math.sin(timeSec * 2.6) * 0.032;
    const floatBobY = Math.sin(timeSec * 1.9) * 0.09 * r;

    ctx.save();
    ctx.translate(sx, sy + floatBobY);
    if (boss.defeated) {
      ctx.globalAlpha = Math.max(0.2, 1 - (boss.defeatTimer || 0) * 0.28);
    }
    ctx.scale(facing * (anim.squashX || 1) * breath, (anim.squashY || 1) / breath);

    const magmaCol = boss.phase >= 3 ? '#fef08a' : boss.phase === 2 ? '#fb923c' : '#f97316';
    const shellTop = hitF > 0 ? '#ffffff' : '#78716c';
    const shellMid = hitF > 0 ? '#fed7aa' : '#44403c';
    const shellDark = '#1c1917';

    // 1. Six Writhing Steam-Charged Hydrothermal Tentacles extending forward from shell aperture
    ctx.lineCap = 'round';
    for (let tIdx = 0; tIdx < 6; tIdx++) {
      const yOff = (-0.34 + tIdx * 0.15) * r;
      const sway = Math.sin(timeSec * 4.5 + tIdx * 1.1) * 0.18 * r;
      const tipX = r * (1.28 + (tIdx % 2) * 0.22);
      const tipY = yOff + sway;
      ctx.strokeStyle = '#041021';
      ctx.lineWidth = Math.max(4.4, 0.22 * r);
      ctx.beginPath();
      ctx.moveTo(r * 0.42, yOff * 0.7);
      ctx.quadraticCurveTo(r * 0.88, yOff - sway * 0.45, tipX, tipY);
      ctx.stroke();

      ctx.strokeStyle = tIdx % 2 === 0 ? '#c2410c' : '#ea580c';
      ctx.lineWidth = Math.max(2.6, 0.13 * r);
      ctx.stroke();

      ctx.fillStyle = magmaCol;
      ctx.beginPath();
      ctx.arc(tipX, tipY, Math.max(2.2, 0.075 * r), 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Massive Chambered Obsidian-and-Copper Spiral Nautilus Shell
    const shellCx = -r * 0.22;
    const shellCy = -r * 0.06;
    const shellR = r * 1.06;
    const shellG = ctx.createRadialGradient(shellCx - shellR * 0.2, shellCy - shellR * 0.28, shellR * 0.1, shellCx, shellCy, shellR);
    shellG.addColorStop(0, shellTop);
    shellG.addColorStop(0.55, shellMid);
    shellG.addColorStop(1, shellDark);
    ctx.fillStyle = shellG;
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(2.8, 0.12 * scale);
    ctx.beginPath();
    ctx.arc(shellCx, shellCy, shellR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Subtle molten copper outer rim highlight so shell pops crisply against dark basalt walls
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.48)';
    ctx.lineWidth = Math.max(1.8, 0.065 * scale);
    ctx.beginPath();
    ctx.arc(shellCx, shellCy, shellR * 0.96, -Math.PI * 0.85, Math.PI * 0.55);
    ctx.stroke();

    // Glowing magma chamber septa ribs radiating around spiral
    const pulse = 0.65 + 0.35 * Math.sin(timeSec * 5.2);
    ctx.strokeStyle = magmaCol;
    ctx.lineWidth = Math.max(2, 0.075 * scale);
    ctx.globalAlpha = 0.72 + pulse * 0.26;
    for (let rib = 0; rib < 9; rib++) {
      const a = -Math.PI * 0.85 + rib * 0.56;
      const innerX = shellCx + Math.cos(a) * shellR * 0.24;
      const innerY = shellCy + Math.sin(a) * shellR * 0.24;
      const outerX = shellCx + Math.cos(a + 0.18) * shellR * 0.94;
      const outerY = shellCy + Math.sin(a + 0.18) * shellR * 0.94;
      ctx.beginPath();
      ctx.moveTo(innerX, innerY);
      ctx.quadraticCurveTo(
        shellCx + Math.cos(a + 0.32) * shellR * 0.62,
        shellCy + Math.sin(a + 0.32) * shellR * 0.62,
        outerX,
        outerY
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Inner logarithmic copper spiral eye
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = Math.max(2, 0.08 * scale);
    ctx.beginPath();
    for (let s = 0; s <= 24; s++) {
      const ang = s * 0.34;
      const sr = (s / 24) * shellR * 0.42;
      const px = shellCx + Math.cos(ang) * sr;
      const py = shellCy + Math.sin(ang) * sr;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // 3. Armored Basalt Hood Plate & Soft Cephalopod Aperture Body
    ctx.fillStyle = hitF > 0 ? '#ffffff' : '#7c2d12';
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(2.4, 0.1 * scale);
    ctx.beginPath();
    ctx.ellipse(r * 0.46, r * 0.08, r * 0.5, r * 0.58, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Heavy Volcanic Basalt Hood Crest
    ctx.fillStyle = hitF > 0 ? '#ffffff' : '#44403c';
    ctx.beginPath();
    ctx.moveTo(r * 0.02, -r * 0.66);
    ctx.quadraticCurveTo(r * 0.72, -r * 0.78, r * 1.05, -r * 0.24);
    ctx.quadraticCurveTo(r * 0.64, -r * 0.14, r * 0.08, -r * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4. Glowing Superheated Magma Valve Weakpoint
    const wx = Math.cos(boss.weakAngle || 0) * r * 0.82 * facing;
    const wy = Math.sin(boss.weakAngle || 0) * r * 0.82;
    ctx.fillStyle = '#fef08a';
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = Math.max(2, 0.085 * scale);
    ctx.beginPath();
    ctx.arc(wx, wy, r * 0.24 * (0.85 + pulse * 0.2), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 5. Single Fierce Molten-Amber Side-Profile Anime Eye beneath Basalt Hood
    const ex = r * 0.56;
    const ey = -r * 0.06;
    const er = r * 0.26;
    ctx.fillStyle = '#fef9c3';
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(2, 0.08 * scale);
    ctx.beginPath();
    ctx.ellipse(ex, ey, er * 1.1, er * 0.9, 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (isStunned) {
      ctx.strokeStyle = '#041021';
      ctx.lineWidth = Math.max(2.4, 0.095 * scale);
      ctx.beginPath();
      ctx.moveTo(ex - er * 0.5, ey - er * 0.45);
      ctx.lineTo(ex + er * 0.5, ey + er * 0.45);
      ctx.moveTo(ex + er * 0.5, ey - er * 0.45);
      ctx.lineTo(ex - er * 0.5, ey + er * 0.45);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(ex + er * 0.08, ey, er * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#041021';
      ctx.beginPath();
      ctx.arc(ex + er * 0.14, ey, er * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - er * 0.15, ey - er * 0.22, er * 0.23, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(2.6, 0.105 * scale);
    ctx.beginPath();
    ctx.moveTo(ex - er * 1.1, ey - er * 0.68);
    ctx.lineTo(ex + er * 1.15, ey - er * 0.36);
    ctx.stroke();

    ctx.restore();
    this._drawBossStatusEmotes(ctx, boss, sx, sy, r, floatBobY, scale, timeSec);
  },

  /**
   * CRYSTAL BASILISK — Iridescent Faceted Gypsum-Selenite Mirror Wyrm (Orda Crystal Maze) (v194).
   */
  _drawCrystalBasiliskBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(boss.x);
    const sy = toScreenY(boss.y);
    const r = (boss.radius || 4.5) * scale;
    const facing = boss.facing || -1;
    const hitF = boss.hitFlash || 0;
    const isStunned = boss.aiState === 'stunned';
    const anim = boss.anim || {};
    const breath = 1 + Math.sin(timeSec * 3.0) * 0.028;
    const floatBobY = Math.sin(timeSec * 2.1) * 0.09 * r;

    ctx.save();
    ctx.translate(sx, sy + floatBobY);
    if (boss.defeated) {
      ctx.globalAlpha = Math.max(0.2, 1 - (boss.defeatTimer || 0) * 0.28);
    }
    ctx.scale(facing * (anim.squashX || 1) * breath, (anim.squashY || 1) / breath);

    const crystalLit = hitF > 0 ? '#ffffff' : boss.phase >= 3 ? '#f472b6' : '#f5d0fe';
    const crystalMid = hitF > 0 ? '#f0abfc' : boss.phase >= 3 ? '#a21caf' : '#a855f7';
    const crystalCyan = boss.phase >= 3 ? '#fde047' : '#38bdf8';

    // 1. Faceted Diamond Selenite Tail Segments + Jagged Crystal Spires
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = Math.max(2, 0.085 * scale);
    for (let i = 5; i >= 1; i--) {
      const segX = -r * (0.48 + i * 0.34);
      const segY = Math.sin(timeSec * 4.0 - i * 0.88) * r * (0.26 + i * 0.04);
      const segR = r * (0.62 - i * 0.075);

      // Tall faceted gypsum dorsal crystal spire
      ctx.fillStyle = i % 2 === 0 ? crystalCyan : crystalLit;
      ctx.beginPath();
      ctx.moveTo(segX - segR * 0.35, segY - segR * 0.52);
      ctx.lineTo(segX - segR * 0.55, segY - segR * 1.65);
      ctx.lineTo(segX + segR * 0.25, segY - segR * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Hexagonal faceted crystal coil body
      ctx.fillStyle = i % 2 === 0 ? crystalMid : '#7e22ce';
      ctx.beginPath();
      ctx.moveTo(segX + segR, segY);
      ctx.lineTo(segX + segR * 0.45, segY - segR * 0.85);
      ctx.lineTo(segX - segR * 0.55, segY - segR * 0.8);
      ctx.lineTo(segX - segR, segY);
      ctx.lineTo(segX - segR * 0.55, segY + segR * 0.8);
      ctx.lineTo(segX + segR * 0.45, segY + segR * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glossy specular prism facet highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
      ctx.beginPath();
      ctx.moveTo(segX + segR * 0.42, segY - segR * 0.78);
      ctx.lineTo(segX - segR * 0.42, segY - segR * 0.72);
      ctx.lineTo(segX, segY - segR * 0.05);
      ctx.closePath();
      ctx.fill();
    }

    // 2. Sweeping Selenite Crystal Crown Horns behind the head
    for (let h = 0; h < 3; h++) {
      const a = -2.35 + h * 0.36;
      const len = r * (h === 1 ? 1.62 : 1.32);
      ctx.fillStyle = h === 1 ? crystalCyan : crystalLit;
      ctx.beginPath();
      ctx.moveTo(-r * 0.22, -r * 0.28);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.lineTo(r * 0.14, -r * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 3. Faceted Angular Crystal Basilisk Head + Luminous Fangs
    const headG = ctx.createLinearGradient(-r * 0.5, -r * 0.75, r * 0.9, r * 0.55);
    headG.addColorStop(0, crystalLit);
    headG.addColorStop(0.5, crystalMid);
    headG.addColorStop(1, '#3b0764');
    ctx.fillStyle = headG;
    ctx.lineWidth = Math.max(2.6, 0.11 * scale);
    ctx.beginPath();
    ctx.moveTo(-r * 0.62, -r * 0.32);
    ctx.lineTo(-r * 0.1, -r * 0.78);
    ctx.lineTo(r * 0.64, -r * 0.54);
    ctx.lineTo(r * 1.05, -r * 0.04);
    ctx.lineTo(r * 0.68, r * 0.44);
    ctx.lineTo(-r * 0.12, r * 0.58);
    ctx.lineTo(-r * 0.62, r * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner iridescent prism plane highlight
    ctx.fillStyle = 'rgba(224, 242, 254, 0.34)';
    ctx.beginPath();
    ctx.moveTo(-r * 0.08, -r * 0.72);
    ctx.lineTo(r * 0.58, -r * 0.5);
    ctx.lineTo(r * 0.2, -r * 0.08);
    ctx.lineTo(-r * 0.42, -r * 0.2);
    ctx.closePath();
    ctx.fill();

    // Translucent crystal fangs
    ctx.fillStyle = '#e0f2fe';
    ctx.lineWidth = Math.max(1.4, 0.06 * scale);
    for (let f = 0; f < 3; f++) {
      const fx = r * (0.44 + f * 0.16);
      const fy = r * (0.36 - f * 0.06);
      ctx.beginPath();
      ctx.moveTo(fx - r * 0.05, fy);
      ctx.lineTo(fx + r * 0.02, fy + r * 0.18);
      ctx.lineTo(fx + r * 0.08, fy - r * 0.03);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 4. Orbiting Selenite Heart Weakpoint
    const wx = Math.cos(boss.weakAngle || 0) * r * 0.84 * facing;
    const wy = Math.sin(boss.weakAngle || 0) * r * 0.84;
    const pulse = 0.8 + 0.2 * Math.sin(timeSec * 8);
    const crR = r * 0.3 * pulse;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = Math.max(2, 0.08 * scale);
    ctx.beginPath();
    ctx.moveTo(wx, wy - crR * 1.3);
    ctx.lineTo(wx + crR * 0.9, wy);
    ctx.lineTo(wx, wy + crR * 1.3);
    ctx.lineTo(wx - crR * 0.9, wy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 5. Single Fierce Faceted Amethyst-Cyan Anime Eye
    const ex = r * 0.34;
    const ey = -r * 0.14;
    const er = r * 0.26;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = Math.max(2, 0.08 * scale);
    ctx.beginPath();
    ctx.ellipse(ex, ey, er * 1.12, er * 0.86, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (isStunned) {
      ctx.lineWidth = Math.max(2.4, 0.095 * scale);
      ctx.beginPath();
      ctx.moveTo(ex - er * 0.48, ey - er * 0.45);
      ctx.lineTo(ex + er * 0.48, ey + er * 0.45);
      ctx.moveTo(ex + er * 0.48, ey - er * 0.45);
      ctx.lineTo(ex - er * 0.48, ey + er * 0.45);
      ctx.stroke();
    } else {
      ctx.fillStyle = crystalCyan;
      ctx.beginPath();
      ctx.arc(ex + er * 0.08, ey, er * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.ellipse(ex + er * 0.12, ey, er * 0.18, er * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - er * 0.16, ey - er * 0.22, er * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = Math.max(2.5, 0.1 * scale);
    ctx.beginPath();
    ctx.moveTo(ex - er * 1.2, ey - er * 0.58);
    ctx.lineTo(ex + er * 1.15, ey - er * 0.34);
    ctx.stroke();

    ctx.restore();
    this._drawBossStatusEmotes(ctx, boss, sx, sy, r, floatBobY, scale, timeSec);
  },

  /**
   * PHANTOM TORPEDO SENTINEL — Haunted North Sea Type-VIIC U-Boat Leviathan (U-1206 Wreck) (v194).
   */
  _drawPhantomUBoatBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(boss.x);
    const sy = toScreenY(boss.y);
    const r = (boss.radius || 4.6) * scale;
    const facing = boss.facing || -1;
    const hitF = boss.hitFlash || 0;
    const isStunned = boss.aiState === 'stunned';
    const anim = boss.anim || {};
    const breath = 1 + Math.sin(timeSec * 2.5) * 0.025;
    const floatBobY = Math.sin(timeSec * 1.8) * 0.08 * r;

    ctx.save();
    ctx.translate(sx, sy + floatBobY);
    if (boss.defeated) {
      ctx.globalAlpha = Math.max(0.2, 1 - (boss.defeatTimer || 0) * 0.28);
    }
    ctx.scale(facing * (anim.squashX || 1) * breath, (anim.squashY || 1) / breath);

    const ghostGlow = boss.phase >= 3 ? '#fb7185' : boss.phase === 2 ? '#fde047' : '#2dd4bf';
    const hullTop = hitF > 0 ? '#ffffff' : '#475569';
    const hullMid = hitF > 0 ? '#ccfbf1' : '#1e293b';
    const hullDark = '#020617';

    // 1. Twin Spinning Spectral Stern Propellers + Rudder Fin
    const propSpin = Math.sin(timeSec * 18) * r * 0.36;
    ctx.fillStyle = ghostGlow;
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(2, 0.08 * scale);
    ctx.beginPath();
    ctx.moveTo(-r * 1.12, 0);
    ctx.lineTo(-r * 1.56, -r * 0.52);
    ctx.lineTo(-r * 1.46, r * 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.ellipse(-r * 1.42, 0, r * 0.1, Math.max(r * 0.14, Math.abs(propSpin) + r * 0.12), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 2. Armored Conning Tower Sail + Glowing Periscope Crown
    ctx.fillStyle = hitF > 0 ? '#ffffff' : '#334155';
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(2.4, 0.1 * scale);
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, -r * 0.56);
    ctx.lineTo(-r * 0.28, -r * 1.18);
    ctx.lineTo(r * 0.28, -r * 1.14);
    ctx.lineTo(r * 0.42, -r * 0.54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Glowing periscope mast
    ctx.strokeStyle = ghostGlow;
    ctx.lineWidth = Math.max(2.4, 0.095 * scale);
    ctx.beginPath();
    ctx.moveTo(r * 0.04, -r * 1.15);
    ctx.lineTo(r * 0.04, -r * 1.56);
    ctx.lineTo(r * 0.26, -r * 1.56);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(r * 0.26, -r * 1.56, r * 0.11, 0, Math.PI * 2);
    ctx.fill();

    // 3. Sleek Armored Type-VIIC U-Boat Pressure Hull Body
    const hullG = ctx.createLinearGradient(0, -r * 0.72, 0, r * 0.72);
    hullG.addColorStop(0, hullTop);
    hullG.addColorStop(0.52, hullMid);
    hullG.addColorStop(1, hullDark);
    ctx.fillStyle = hullG;
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(2.8, 0.12 * scale);
    ctx.beginPath();
    ctx.moveTo(-r * 1.24, -r * 0.24);
    ctx.quadraticCurveTo(-r * 0.35, -r * 0.72, r * 0.68, -r * 0.52);
    ctx.quadraticCurveTo(r * 1.26, -r * 0.22, r * 1.18, r * 0.14);
    ctx.quadraticCurveTo(r * 0.88, r * 0.62, -r * 0.3, r * 0.66);
    ctx.quadraticCurveTo(-r * 0.95, r * 0.56, -r * 1.24, r * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Spectral glowing flood-vent ribs along the side of the submarine hull
    const pulse = 0.6 + 0.4 * Math.sin(timeSec * 5.8);
    ctx.fillStyle = ghostGlow;
    ctx.globalAlpha = 0.72 + pulse * 0.24;
    for (let v = 0; v < 5; v++) {
      const vx = -r * (0.72 - v * 0.26);
      ctx.fillRect(vx - r * 0.05, -r * 0.22, r * 0.1, r * 0.34);
    }
    ctx.globalAlpha = 1;

    // Armored Torpedo-Tube Bow Jaws + Glowing Muzzle Bays
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = ghostGlow;
    ctx.lineWidth = Math.max(1.8, 0.075 * scale);
    for (let t = 0; t < 2; t++) {
      ctx.beginPath();
      ctx.arc(r * (0.96 - t * 0.12), r * (0.18 + t * 0.18), r * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 4. Spectral Reactor Core Weakpoint
    const wx = Math.cos(boss.weakAngle || 0) * r * 0.82 * facing;
    const wy = Math.sin(boss.weakAngle || 0) * r * 0.82;
    ctx.fillStyle = '#ccfbf1';
    ctx.strokeStyle = ghostGlow;
    ctx.lineWidth = Math.max(2, 0.085 * scale);
    ctx.beginPath();
    ctx.arc(wx, wy, r * 0.24 * (0.85 + pulse * 0.2), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 5. Glowing Spectral Emerald Sonar Porthole Anime Eye
    const ex = r * 0.48;
    const ey = -r * 0.12;
    const er = r * 0.27;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = Math.max(2.4, 0.095 * scale);
    ctx.beginPath();
    ctx.arc(ex, ey, er * 1.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (isStunned) {
      ctx.strokeStyle = ghostGlow;
      ctx.lineWidth = Math.max(2.4, 0.095 * scale);
      ctx.beginPath();
      ctx.moveTo(ex - er * 0.5, ey - er * 0.45);
      ctx.lineTo(ex + er * 0.5, ey + er * 0.45);
      ctx.moveTo(ex + er * 0.5, ey - er * 0.45);
      ctx.lineTo(ex - er * 0.5, ey + er * 0.45);
      ctx.stroke();
    } else {
      ctx.fillStyle = ghostGlow;
      ctx.beginPath();
      ctx.arc(ex, ey, er * 0.78, 0, Math.PI * 2);
      ctx.fill();
      // Rotating sonar sweep line inside eye
      const sweep = timeSec * 4.5;
      ctx.strokeStyle = '#041021';
      ctx.lineWidth = Math.max(1.8, 0.07 * scale);
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + Math.cos(sweep) * er * 0.74, ey + Math.sin(sweep) * er * 0.74);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - er * 0.22, ey - er * 0.22, er * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    this._drawBossStatusEmotes(ctx, boss, sx, sy, r, floatBobY, scale, timeSec);
  },

  /**
   * ORICHALCUM COLOSSUS — Sunken Atlantean Bronze & Gold Astrolabe Guardian (Bimini Road, v195).
   */
  _drawOrichalcumColossusBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(boss.x);
    const sy = toScreenY(boss.y);
    const r = boss.radius * scale;
    const alpha = boss.defeated ? Math.max(0, boss.defeatAnimSec / 3.4) : 1;
    const flash = boss.hitFlash > 0;
    const anim = boss.anim || {};
    const st = boss.aiState || 'idle';
    const isStunned = st === 'stunned';
    const facing = (anim.facing ?? -1) >= 0 ? 1 : -1;
    const floatBobY = Math.sin(timeSec * 2.2) * 0.1 * r;
    const runeGlow = boss.phase >= 3 ? '#fb7185' : boss.phase === 2 ? '#38bdf8' : '#fde047';

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(sx, sy + floatBobY);
    ctx.rotate((anim.pitch || 0) * facing);
    ctx.scale(facing * (anim.scaleX || 1), anim.scaleY || 1);

    // 1. Rotating Back Golden Astrolabe Halo Rings
    ctx.save();
    ctx.rotate(timeSec * (boss.phase >= 3 ? 1.5 : 0.85));
    ctx.strokeStyle = flash ? '#ffffff' : '#fbbf24';
    ctx.lineWidth = Math.max(2.4, 0.11 * scale);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.42, r * 0.52, 0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = runeGlow;
    ctx.lineWidth = Math.max(1.8, 0.075 * scale);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.56, r * 1.38, -0.25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 2. Floating Carved Megalithic Shoulder Pauldrons
    const armLift = (st === 'slam_windup' || st === 'lunge_windup') ? -0.28 * r : Math.sin(timeSec * 3.0) * 0.08 * r;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * r * 0.88, -r * 0.12 + armLift * (side > 0 ? 1 : 0.6));
      ctx.rotate(side * 0.22);
      ctx.fillStyle = flash ? '#ffffff' : '#0f4c5c';
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = Math.max(2.0, 0.08 * scale);
      ctx.beginPath();
      ctx.moveTo(-r * 0.32, -r * 0.34);
      ctx.lineTo(r * 0.32, -r * 0.26);
      ctx.lineTo(r * 0.24, r * 0.36);
      ctx.lineTo(-r * 0.28, r * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = Math.max(1.8, 0.065 * scale);
      ctx.strokeRect(-r * 0.2, -r * 0.18, r * 0.4, r * 0.36);
      ctx.fillStyle = runeGlow;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Monolithic Octagonal Orichalcum Torso & Sun-Crest Crown
    ctx.fillStyle = flash ? '#fef9c3' : '#b45309';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = Math.max(2.4, 0.095 * scale);
    ctx.beginPath();
    ctx.moveTo(-r * 0.68, -r * 0.56);
    ctx.lineTo(0, -r * 0.96);
    ctx.lineTo(r * 0.68, -r * 0.56);
    ctx.lineTo(r * 0.78, r * 0.24);
    ctx.lineTo(r * 0.36, r * 0.86);
    ctx.lineTo(-r * 0.36, r * 0.86);
    ctx.lineTo(-r * 0.78, r * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner verdigris turquoise inlaid chest plate
    ctx.fillStyle = flash ? '#ffffff' : '#0e7490';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(1.8, 0.07 * scale);
    ctx.beginPath();
    ctx.moveTo(-r * 0.46, -r * 0.36);
    ctx.lineTo(0, -r * 0.68);
    ctx.lineTo(r * 0.46, -r * 0.36);
    ctx.lineTo(r * 0.42, r * 0.48);
    ctx.lineTo(-r * 0.42, r * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Crown sun-crest spires
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = Math.max(1.6, 0.065 * scale);
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(k * r * 0.28 - r * 0.1, -r * 0.74);
      ctx.lineTo(k * r * 0.34, -r * (k === 0 ? 1.24 : 1.06));
      ctx.lineTo(k * r * 0.28 + r * 0.1, -r * 0.74);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 4. Radiant Solar-Core Cyclops Eye
    const ex = r * 0.14;
    const ey = -r * 0.06;
    const er = r * 0.32;
    ctx.fillStyle = '#1c1917';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(2.0, 0.08 * scale);
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (isStunned || boss.defeated) {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = Math.max(2.4, 0.095 * scale);
      ctx.beginPath();
      ctx.moveTo(ex - er * 0.48, ey - er * 0.48);
      ctx.lineTo(ex + er * 0.48, ey + er * 0.48);
      ctx.moveTo(ex + er * 0.48, ey - er * 0.48);
      ctx.lineTo(ex - er * 0.48, ey + er * 0.48);
      ctx.stroke();
    } else {
      ctx.fillStyle = runeGlow;
      ctx.beginPath();
      ctx.arc(ex, ey, er * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + er * 0.16, ey - er * 0.14, er * 0.26, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    this._drawBossStatusEmotes(ctx, boss, sx, sy, r, floatBobY, scale, timeSec);
  },

  /**
   * ABYSSAL DRILL-WYRM — Armored Tungsten Tunneling Leviathan (Ojamo Iron Mine, v195).
   */
  _drawDrillWyrmBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(boss.x);
    const sy = toScreenY(boss.y);
    const r = boss.radius * scale;
    const alpha = boss.defeated ? Math.max(0, boss.defeatAnimSec / 3.4) : 1;
    const flash = boss.hitFlash > 0;
    const anim = boss.anim || {};
    const st = boss.aiState || 'idle';
    const isStunned = st === 'stunned';
    const facing = (anim.facing ?? -1) >= 0 ? 1 : -1;
    const floatBobY = Math.sin(timeSec * 2.6) * 0.09 * r;
    const furnaceCol = boss.phase >= 3 ? '#ef4444' : boss.phase === 2 ? '#fb923c' : '#fbbf24';

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(sx, sy + floatBobY);
    ctx.rotate((anim.pitch || 0) * facing);
    ctx.scale(facing * (anim.scaleX || 1), anim.scaleY || 1);

    // 1. Articulated Armored Steel Ore-Car Body Segments
    for (let s = 3; s >= 1; s--) {
      const segX = -s * r * 0.58;
      const segY = Math.sin(timeSec * 3.8 - s * 0.9) * r * 0.22;
      const segR = r * (0.76 - s * 0.12);
      ctx.fillStyle = flash ? '#ffffff' : (s % 2 === 0 ? '#334155' : '#1e293b');
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = Math.max(2.0, 0.08 * scale);
      ctx.beginPath();
      ctx.ellipse(segX, segY, segR * 0.78, segR * 0.68, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = furnaceCol;
      ctx.fillRect(segX - segR * 0.25, segY - segR * 0.16, segR * 0.5, segR * 0.32);
    }

    // 2. Heavy Riveted Iron Head Chassis
    ctx.fillStyle = flash ? '#fef08a' : '#475569';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = Math.max(2.4, 0.095 * scale);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(-r * 0.65, -r * 0.72, r * 1.24, r * 1.44, r * 0.28);
    } else {
      ctx.rect(-r * 0.65, -r * 0.72, r * 1.24, r * 1.44);
    }
    ctx.fill();
    ctx.stroke();

    // Hazard-stripe mining collar band
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(r * 0.28, -r * 0.64, r * 0.24, r * 1.28);
    ctx.fillStyle = '#0f172a';
    for (let k = -2; k <= 2; k++) {
      ctx.fillRect(r * 0.28, k * r * 0.25 - r * 0.06, r * 0.24, r * 0.1);
    }

    // 3. Spinning Helical Tungsten Carbide Bore-Head Nose Cone
    const drillSpin = (timeSec * (st === 'lunge_dash' ? 24 : 11)) % 1;
    ctx.fillStyle = flash ? '#ffffff' : '#94a3b8';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = Math.max(2.2, 0.085 * scale);
    ctx.beginPath();
    ctx.moveTo(r * 0.54, -r * 0.58);
    ctx.lineTo(r * 1.56, 0);
    ctx.lineTo(r * 0.54, r * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = Math.max(1.8, 0.075 * scale);
    for (let f = 0; f < 4; f++) {
      const u = ((f / 4) + drillSpin) % 1;
      const fx = r * (0.58 + u * 0.88);
      const halfH = r * 0.52 * (1 - u);
      ctx.beginPath();
      ctx.moveTo(fx - r * 0.08, -halfH);
      ctx.lineTo(fx + r * 0.08, halfH);
      ctx.stroke();
    }

    // 4. Industrial Miner's Headlamp Optical Sensor Eye
    const ex = -r * 0.06;
    const ey = -r * 0.14;
    const er = r * 0.3;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = Math.max(2.0, 0.08 * scale);
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (isStunned || boss.defeated) {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = Math.max(2.4, 0.095 * scale);
      ctx.beginPath();
      ctx.moveTo(ex - er * 0.45, ey - er * 0.45);
      ctx.lineTo(ex + er * 0.45, ey + er * 0.45);
      ctx.moveTo(ex + er * 0.45, ey - er * 0.45);
      ctx.lineTo(ex - er * 0.45, ey + er * 0.45);
      ctx.stroke();
    } else {
      ctx.fillStyle = furnaceCol;
      ctx.beginPath();
      ctx.arc(ex, ey, er * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fffbeb';
      ctx.beginPath();
      ctx.arc(ex + er * 0.16, ey - er * 0.16, er * 0.26, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    this._drawBossStatusEmotes(ctx, boss, sx, sy, r, floatBobY, scale, timeSec);
  },

  /**
   * BOSS 11 (Yonaguni Monument): RYŪJIN'S SERPENT — Pacific Coral Dragon Leviathan (v201).
   * Sinuous jade-emerald serpentine coils, crimson coral mane & dorsal crest, golden dragon antlers,
   * flowing whiskers, and a floating luminous Dragon Pearl orbiting its snout.
   */
  _drawCoralDragonBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(boss.x);
    const sy = toScreenY(boss.y);
    const r = boss.radius * scale;
    const anim = boss.anim || {};
    const facing = anim.facing || -1;
    const isStunned = boss.aiState === 'stunned';
    const isAngry = boss.aiState === 'lunge_windup' || boss.aiState === 'lunge_dash' || boss.aiState === 'beam_charge' || boss.aiState === 'roar';
    const flash = boss.hitFlash > 0;
    const alpha = boss.defeated ? Math.max(0, (boss.defeatAnimSec || 0) / 3.4) : 1;
    const floatBobY = Math.sin(timeSec * 2.5) * 0.14 * r;
    const jadeMain = boss.phase >= 3 ? '#10b981' : '#0d9488';
    const jadeLight = boss.phase >= 3 ? '#5eead4' : '#2dd4bf';
    const coralMane = boss.phase >= 3 ? '#fb7185' : '#f43f5e';
    const pearlGlow = '#fef08a';

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(sx, sy + floatBobY);
    ctx.scale(facing * (anim.squashX || 1), anim.squashY || 1);

    // 1. Sinuous Scaled Dragon Body Coils & Crimson Dorsal Coral Fin
    for (let s = 5; s >= 1; s--) {
      const segX = -s * r * 0.44;
      const segY = Math.sin(timeSec * 3.6 - s * 0.85) * r * 0.28;
      const segR = r * (0.64 - s * 0.08);
      // Crimson coral spine ridge
      ctx.fillStyle = coralMane;
      ctx.beginPath();
      ctx.moveTo(segX - segR * 0.35, segY - segR * 0.55);
      ctx.lineTo(segX, segY - segR * 1.28);
      ctx.lineTo(segX + segR * 0.38, segY - segR * 0.55);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = flash ? '#ffffff' : (s % 2 === 0 ? jadeLight : jadeMain);
      ctx.strokeStyle = '#022c22';
      ctx.lineWidth = Math.max(1.8, 0.075 * scale);
      ctx.beginPath();
      ctx.ellipse(segX, segY, segR * 0.88, segR * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Golden belly plates
      ctx.fillStyle = 'rgba(254, 240, 138, 0.48)';
      ctx.beginPath();
      ctx.ellipse(segX, segY + segR * 0.35, segR * 0.52, segR * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Sculpted Dragon Head, Coral Mane & Golden Antler Horns
    ctx.fillStyle = coralMane;
    ctx.strokeStyle = '#4c0519';
    ctx.lineWidth = Math.max(1.8, 0.07 * scale);
    for (let m = -2; m <= 2; m++) {
      const ang = m * 0.36 - 0.15;
      ctx.beginPath();
      ctx.ellipse(-r * 0.18 + Math.cos(ang + Math.PI) * r * 0.34, Math.sin(ang) * r * 0.55, r * 0.38, r * 0.2, ang, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Swept Golden Dragon Antlers
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = Math.max(2.2, 0.09 * scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.05, -r * 0.42);
    ctx.quadraticCurveTo(-r * 0.35, -r * 1.15, -r * 0.78, -r * 1.05);
    ctx.moveTo(-r * 0.26, -r * 0.78);
    ctx.lineTo(-r * 0.12, -r * 1.18);
    ctx.stroke();

    // Jade Dragon Snout & Jaw
    ctx.fillStyle = flash ? '#ffffff' : jadeLight;
    ctx.strokeStyle = '#022c22';
    ctx.lineWidth = Math.max(2.2, 0.088 * scale);
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, -r * 0.48);
    ctx.quadraticCurveTo(r * 0.45, -r * 0.62, r * 1.02, -r * 0.12);
    ctx.lineTo(r * 0.88, r * 0.32);
    ctx.quadraticCurveTo(r * 0.2, r * 0.56, -r * 0.42, r * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Flowing Golden Dragon Whiskers
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(1.4, 0.055 * scale);
    const wWave = Math.sin(timeSec * 4.4) * r * 0.24;
    ctx.beginPath();
    ctx.moveTo(r * 0.82, r * 0.12);
    ctx.quadraticCurveTo(r * 1.24, r * 0.28 + wWave, r * 1.56, r * 0.06 - wWave);
    ctx.stroke();

    // Luminous Floating Ryūjin Dragon Pearl ahead of snout
    const px = r * 1.26;
    const py = -r * 0.34 + Math.sin(timeSec * 3.8) * r * 0.12;
    ctx.fillStyle = 'rgba(254, 240, 138, 0.28)';
    ctx.beginPath();
    ctx.arc(px, py, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pearlGlow;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = Math.max(1.2, 0.05 * scale);
    ctx.beginPath();
    ctx.arc(px, py, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Expressive Fierce Golden Eye
    const ex = r * 0.26;
    const ey = -r * 0.16;
    const er = r * 0.23;
    ctx.fillStyle = isAngry ? '#fef08a' : '#fffbeb';
    ctx.strokeStyle = '#022c22';
    ctx.lineWidth = Math.max(1.8, 0.07 * scale);
    ctx.beginPath();
    ctx.ellipse(ex, ey, er, er * (isAngry ? 0.68 : 0.86), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (!isStunned && !boss.defeated) {
      ctx.fillStyle = isAngry ? '#dc2626' : '#0f172a';
      ctx.beginPath();
      ctx.ellipse(ex + er * 0.22, ey, er * 0.3, er * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + er * 0.34, ey - er * 0.22, er * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    this._drawBossStatusEmotes(ctx, boss, sx, sy, r, floatBobY, scale, timeSec);
  },

  /**
   * BOSS 12 (SMS Markgraf — Scapa Flow): SCAPA DREADNOUGHT — Spectral WWI Battleship Leviathan (v201).
   * Heavy riveted steel dreadnought hull, twin 12-inch armored gun turrets, spectral emerald
   * waterline glow, ghostly searchlight bow optic, and spinning brass triple propellers.
   */
  _drawSpectralDreadnoughtBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(boss.x);
    const sy = toScreenY(boss.y);
    const r = boss.radius * scale;
    const anim = boss.anim || {};
    const facing = anim.facing || -1;
    const isStunned = boss.aiState === 'stunned';
    const isAngry = boss.aiState === 'lunge_windup' || boss.aiState === 'lunge_dash' || boss.aiState === 'beam_charge' || boss.aiState === 'roar';
    const flash = boss.hitFlash > 0;
    const alpha = boss.defeated ? Math.max(0, (boss.defeatAnimSec || 0) / 3.4) : 1;
    const floatBobY = Math.sin(timeSec * 1.9) * 0.11 * r;
    const ghostGlow = boss.phase >= 3 ? '#5eead4' : '#34d399';

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(sx, sy + floatBobY);
    ctx.scale(facing * (anim.squashX || 1), anim.squashY || 1);

    // 1. Spectral Emerald Hull Wake Aura
    ctx.fillStyle = 'rgba(52, 211, 153, 0.16)';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.85, r * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Spinning Brass Stern Propellers
    const propSpin = Math.sin(timeSec * 18) * r * 0.34;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = Math.max(2.4, 0.095 * scale);
    ctx.beginPath();
    ctx.moveTo(-r * 1.56, -propSpin);
    ctx.lineTo(-r * 1.56, propSpin);
    ctx.stroke();

    // 3. Armored Dreadnought Main Hull & Ram Bow
    ctx.fillStyle = flash ? '#ffffff' : '#334155';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = Math.max(2.3, 0.09 * scale);
    ctx.beginPath();
    ctx.moveTo(r * 1.58, 0.08 * r);
    ctx.lineTo(r * 1.15, -r * 0.44);
    ctx.lineTo(-r * 1.25, -r * 0.4);
    ctx.lineTo(-r * 1.52, 0.1 * r);
    ctx.lineTo(-r * 1.28, r * 0.56);
    ctx.lineTo(r * 1.05, r * 0.56);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Spectral Emerald Armor Belt & Portholes
    ctx.fillStyle = ghostGlow;
    ctx.fillRect(-r * 1.18, r * 0.08, r * 2.24, r * 0.14);
    for (let p = -3; p <= 2; p++) {
      ctx.beginPath();
      ctx.arc(p * r * 0.34, -r * 0.14, r * 0.085, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Armored Bridge Citadel & Twin 12-Inch Gun Turrets
    ctx.fillStyle = flash ? '#e2e8f0' : '#475569';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = Math.max(2.0, 0.08 * scale);
    ctx.fillRect(-r * 0.36, -r * 1.02, r * 0.74, r * 0.62);
    ctx.strokeRect(-r * 0.36, -r * 1.02, r * 0.74, r * 0.62);

    // Fore & Aft Twin-Barrel 12-inch Turrets
    for (const tx of [r * 0.68, -r * 0.78]) {
      const dir = tx > 0 ? 1 : -1;
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(tx, -r * 0.46, r * 0.28, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(2.0, 0.08 * scale);
      ctx.beginPath();
      ctx.moveTo(tx, -r * 0.56);
      ctx.lineTo(tx + dir * r * 0.58, -r * 0.68);
      ctx.moveTo(tx, -r * 0.48);
      ctx.lineTo(tx + dir * r * 0.56, -r * 0.58);
      ctx.stroke();
    }

    // 5. Spectral Bridge Searchlight Optic Eye
    const ex = r * 0.16;
    const ey = -r * 0.74;
    const er = r * 0.22;
    ctx.fillStyle = '#020617';
    ctx.strokeStyle = ghostGlow;
    ctx.lineWidth = Math.max(1.8, 0.075 * scale);
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (!isStunned && !boss.defeated) {
      ctx.fillStyle = isAngry ? '#f43f5e' : ghostGlow;
      ctx.beginPath();
      ctx.arc(ex, ey, er * 0.68, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ecfdf5';
      ctx.beginPath();
      ctx.arc(ex + er * 0.2, ey - er * 0.18, er * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    this._drawBossStatusEmotes(ctx, boss, sx, sy, r, floatBobY, scale, timeSec);
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
      // Sculpted obsidian brazier pedestal cradling a faceted glowing crystal flame + rising motes (v188)
      ctx.globalAlpha = 0.96;
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = Math.max(1.1, 0.045 * scale);
      ctx.beginPath();
      ctx.moveTo(sx - 0.46 * scale, sy + 0.16 * scale);
      ctx.lineTo(sx + 0.46 * scale, sy + 0.16 * scale);
      ctx.lineTo(sx + 0.28 * scale, sy + 0.56 * scale);
      ctx.lineTo(sx - 0.28 * scale, sy + 0.56 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Faceted outer bioluminescent crystal flame
      const flH = (0.72 + 0.12 * pulse) * scale;
      ctx.fillStyle = sconceCol;
      ctx.beginPath();
      ctx.moveTo(sx, sy - flH);
      ctx.lineTo(sx + 0.34 * scale, sy + 0.12 * scale);
      ctx.lineTo(sx, sy + 0.34 * scale);
      ctx.lineTo(sx - 0.34 * scale, sy + 0.12 * scale);
      ctx.closePath();
      ctx.fill();

      // Inner white-hot crystal core
      ctx.fillStyle = '#f0f9ff';
      ctx.beginPath();
      ctx.moveTo(sx, sy - flH * 0.65);
      ctx.lineTo(sx + 0.15 * scale, sy + 0.06 * scale);
      ctx.lineTo(sx, sy + 0.2 * scale);
      ctx.lineTo(sx - 0.15 * scale, sy + 0.06 * scale);
      ctx.closePath();
      ctx.fill();

      // Rising luminescent spark motes
      for (let m = 0; m < 2; m++) {
        const phase = (timeSec * 0.9 + i * 0.37 + m * 0.5) % 1;
        const mx = sx + Math.sin(timeSec * 3.2 + m * 4 + i) * 0.24 * scale;
        const my = sy - (0.35 + phase * 1.15) * scale;
        ctx.globalAlpha = (1 - phase) * 0.85;
        ctx.fillStyle = '#fef9c3';
        ctx.beginPath();
        ctx.arc(mx, my, Math.max(1.2, 0.05 * scale * (1 - phase * 0.5)), 0, Math.PI * 2);
        ctx.fill();
      }
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

    // 2b. Emerald Bio-Heal Orbs (v193 mobile-fast glowStamps, zero per-orb radial gradient allocs!)
    const healStamp = this.glowStamps?.cyan;
    const warmStamp = this.glowStamps?.warm;
    for (const orb of lair.healOrbs || []) {
      const ox = toScreenX(orb.x);
      const oy = toScreenY(orb.y);
      if (ox < -60 || ox > cw + 60 || oy < -60 || oy > ch + 60) continue;
      const r = (0.42 + 0.08 * Math.sin(timeSec * 7 + orb.phase)) * scale;
      ctx.save();
      if (healStamp) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.65;
        ctx.drawImage(healStamp, ox - r * 2.4, oy - r * 2.4, r * 4.8, r * 4.8);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#34d399';
      ctx.strokeStyle = '#ecfdf5';
      ctx.lineWidth = Math.max(1.2, 0.05 * scale);
      ctx.beginPath();
      ctx.arc(ox, oy, r * 0.92, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ox - r * 0.5, oy);
      ctx.lineTo(ox + r * 0.5, oy);
      ctx.moveTo(ox, oy - r * 0.5);
      ctx.lineTo(ox, oy + r * 0.5);
      ctx.stroke();
      ctx.restore();
    }

    // 2c. Glowing DPV Battery Power Cells (Electric Cyan-Gold Canisters — zero gradient alloc!)
    for (const cell of lair.batteryCells || []) {
      const cx = toScreenX(cell.x);
      const cy = toScreenY(cell.y);
      if (cx < -70 || cx > cw + 70 || cy < -70 || cy > ch + 70) continue;
      const pulse = 0.55 + 0.45 * Math.sin(timeSec * 6.5 + (cell.phase || 0));
      const r = 0.54 * scale;
      ctx.save();
      if (warmStamp) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.55 + pulse * 0.25;
        ctx.drawImage(warmStamp, cx - r * 2.5, cy - r * 2.5, r * 5.0, r * 5.0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }

      // Rotating dashed energy ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(timeSec * 1.9 + (cell.phase || 0));
      ctx.strokeStyle = `rgba(103, 232, 249, ${(0.55 + pulse * 0.4).toFixed(2)})`;
      ctx.lineWidth = Math.max(1.3, 0.055 * scale);
      ctx.setLineDash([Math.max(4, r * 0.6), Math.max(3, r * 0.4)]);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Cylindrical battery housing + terminal cap
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = Math.max(1.5, 0.06 * scale);
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(cx - r * 0.54, cy - r * 0.72, r * 1.08, r * 1.44, r * 0.24);
      } else {
        ctx.rect(cx - r * 0.54, cy - r * 0.72, r * 1.08, r * 1.44);
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.fillRect(cx - r * 0.24, cy - r * 0.9, r * 0.48, r * 0.2);

      // Glowing lightning bolt inside canister
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.08, cy - r * 0.48);
      ctx.lineTo(cx - r * 0.26, cy + r * 0.04);
      ctx.lineTo(cx + r * 0.02, cy + r * 0.04);
      ctx.lineTo(cx - r * 0.1, cy + r * 0.48);
      ctx.lineTo(cx + r * 0.28, cy - r * 0.04);
      ctx.lineTo(cx + r * 0.0, cy - r * 0.04);
      ctx.closePath();
      ctx.fill();

      // Crisp floating micro-tag
      ctx.font = `900 ${Math.max(9, Math.round(9.5 * dpr))}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)';
      ctx.lineWidth = 2.6 * dpr;
      ctx.strokeText('⚡ BATT', cx, cy + r * 1.18);
      ctx.fillStyle = '#fde047';
      ctx.fillText('⚡ BATT', cx, cy + r * 1.18);
      ctx.restore();
    }

    // 2d. Glowing Speargun Weapon Upgrade Holo-Pods (SPLIT / RAPID / PLASMA / SEEKER — zero gradient alloc!)
    for (const pod of lair.weaponUpgrades || []) {
      const meta = BOSS_WEAPON_UPGRADES[pod.kind] || BOSS_WEAPON_UPGRADES.twin;
      const ux = toScreenX(pod.x);
      const uy = toScreenY(pod.y);
      if (ux < -70 || ux > cw + 70 || uy < -70 || uy > ch + 70) continue;
      const pulse = 0.55 + 0.45 * Math.sin(timeSec * 5.8 + (pod.phase || 0));
      const r = 0.64 * scale;
      ctx.save();
      const podStamp = (pod.kind === 'rapid' || pod.kind === 'overcharge') ? (warmStamp || healStamp) : healStamp;
      if (podStamp) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.55 + pulse * 0.25;
        ctx.drawImage(podStamp, ux - r * 2.7, uy - r * 2.7, r * 5.4, r * 5.4);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }

      // Rotating hexagonal tactical housing
      ctx.save();
      ctx.translate(ux, uy);
      ctx.rotate(Math.sin(timeSec * 2.2 + (pod.phase || 0)) * 0.16);
      ctx.fillStyle = 'rgba(6, 16, 34, 0.9)';
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = Math.max(1.8, 0.07 * scale);
      ctx.beginPath();
      for (let s = 0; s < 6; s++) {
        const a = (s / 6) * Math.PI * 2 - Math.PI / 6;
        const hx = Math.cos(a) * r;
        const hy = Math.sin(a) * r;
        if (s === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner pulsing ring
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.55 + pulse * 0.35;
      ctx.lineWidth = Math.max(1, 0.035 * scale);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Center upgrade icon
      ctx.font = `${Math.max(12, Math.round(r * 0.95))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(meta.icon, 0, 1);
      ctx.restore();

      // Crisp floating upgrade badge
      const curLv = lair.weaponMods?.[pod.kind] || 0;
      const tag = curLv >= 1 && curLv < meta.maxLevel ? `${meta.shortLabel} +` : meta.shortLabel;
      ctx.font = `900 ${Math.max(9.5, Math.round(10 * dpr))}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.94)';
      ctx.lineWidth = 2.8 * dpr;
      ctx.strokeText(tag, ux, uy + r * 1.15);
      ctx.fillStyle = meta.color;
      ctx.fillText(tag, ux, uy + r * 1.15);
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
          ctx.lineWidth = Math.max(1.5, 0.065 * scale);
          // Rotating lock-on reticle at beam impact endpoint (v204 AAA Polish Wave 2)
          const retR = (0.55 + (1 - prog) * 0.85) * scale;
          ctx.beginPath();
          ctx.arc(ex, ey, retR, timeSec * 3.5, timeSec * 3.5 + Math.PI * 1.45);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(ex, ey, retR * 0.45, 0, Math.PI * 2);
          ctx.stroke();
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
        // Pulsing destination impact ring during lunge windup (v204 AAA Polish Wave 2)
        if (!isDash) {
          const pulse = 0.5 + 0.5 * Math.sin(timeSec * 12);
          ctx.strokeStyle = `rgba(186, 230, 253, ${(0.55 + pulse * 0.35).toFixed(3)})`;
          ctx.lineWidth = Math.max(1.8, 0.08 * scale);
          ctx.beginPath();
          ctx.arc(dx, dy, (boss.radius * 0.72 + pulse * 0.35) * scale, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 3b-ii. Volumetric Radiance Collapse Burst when Guardian is Dying (v204 AAA Polish Wave 2)
      if (boss.aiState === 'dying') {
        const prog = Math.max(0, Math.min(1, 1 - Math.max(0, boss.stateTimer || 0) / Math.max(0.2, boss.stateMaxTimer || 2.1)));
        ctx.save();
        ctx.translate(bx, by);
        ctx.globalCompositeOperation = 'screen';
        const rayCount = 10;
        const maxR = (boss.radius * (1.8 + prog * 2.6)) * scale;
        for (let r = 0; r < rayCount; r++) {
          const ang = (r / rayCount) * Math.PI * 2 + timeSec * 0.55;
          const halfW = 0.08 + prog * 0.06;
          ctx.fillStyle = r % 2 === 0
            ? `rgba(254, 240, 138, ${(0.24 * (1 - prog * 0.4)).toFixed(3)})`
            : `rgba(103, 232, 249, ${(0.22 * (1 - prog * 0.4)).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ang - halfW) * maxR, Math.sin(ang - halfW) * maxR);
          ctx.lineTo(Math.cos(ang + halfW) * maxR, Math.sin(ang + halfW) * maxR);
          ctx.closePath();
          ctx.fill();
        }
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
        // 3 orbiting diamond reticle petals around core + crisp crosshair ticks (v256)
        for (let p = 0; p < 3; p++) {
          const pa = timeSec * 2.2 + (p * Math.PI * 2) / 3;
          const ptx = coreX + Math.cos(pa) * coreR * 1.18;
          const pty = coreY + Math.sin(pa) * coreR * 1.18;
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(ptx, pty, Math.max(2.2, 0.1 * scale), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = boss.aiState === 'stunned' ? '#fde047' : 'rgba(254, 240, 138, 0.82)';
        ctx.lineWidth = Math.max(1.5, 0.065 * scale);
        ctx.beginPath();
        const tickIn = coreR * 0.98;
        const tickOut = coreR * 1.42;
        for (let t = 0; t < 4; t++) {
          const ta = (t * Math.PI) / 2;
          ctx.moveTo(coreX + Math.cos(ta) * tickIn, coreY + Math.sin(ta) * tickIn);
          ctx.lineTo(coreX + Math.cos(ta) * tickOut, coreY + Math.sin(ta) * tickOut);
        }
        ctx.stroke();
        if (boss.aiState === 'stunned') {
          ctx.font = `800 ${Math.max(10, Math.round(11 * dpr))}px ui-monospace, monospace`;
          ctx.textAlign = 'center';
          ctx.strokeStyle = 'rgba(2, 6, 23, 0.92)';
          ctx.lineWidth = 3 * dpr;
          ctx.strokeText('★ STUNNED 1.65×', coreX, coreY - coreR * 1.58);
          ctx.fillStyle = '#fde047';
          ctx.fillText('★ STUNNED 1.65×', coreX, coreY - coreR * 1.58);
        }
        ctx.restore();
      }

      // 3j. Offscreen Boss & Telegraph Edge Chevron for mobile portrait spatial awareness (v256)
      if (boss.aiState !== 'dormant') {
        const margin = 28 * dpr;
        if (bx < margin || bx > cw - margin || by < margin || by > ch - margin) {
          const cxScreen = cw * 0.5;
          const cyScreen = ch * 0.5;
          const ang = Math.atan2(by - cyScreen, bx - cxScreen);
          const cosA = Math.cos(ang);
          const sinA = Math.sin(ang);
          const halfW = cw * 0.5 - margin;
          const halfH = ch * 0.5 - margin;
          const tEdge = Math.min(
            Math.abs(cosA) > 0.001 ? halfW / Math.abs(cosA) : 1e6,
            Math.abs(sinA) > 0.001 ? halfH / Math.abs(sinA) : 1e6
          );
          const ex = cxScreen + cosA * tEdge;
          const ey = cyScreen + sinA * tEdge;
          const isWindup =
            boss.aiState === 'lunge_windup' ||
            boss.aiState === 'lunge_dash' ||
            boss.aiState === 'slam_windup' ||
            boss.aiState === 'beam_windup' ||
            boss.aiState === 'beam_sweep';
          const pulse = 0.72 + 0.28 * Math.sin(timeSec * (isWindup ? 14 : 6));
          const chevR = (isWindup ? 14 : 11) * dpr;
          ctx.save();
          ctx.translate(ex, ey);
          ctx.rotate(ang);
          ctx.globalAlpha = pulse;
          ctx.fillStyle = isWindup ? '#fb7185' : pal.accent;
          ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)';
          ctx.lineWidth = 2.2 * dpr;
          ctx.beginPath();
          ctx.moveTo(chevR, 0);
          ctx.lineTo(-chevR * 0.72, -chevR * 0.68);
          ctx.lineTo(-chevR * 0.35, 0);
          ctx.lineTo(-chevR * 0.72, chevR * 0.68);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          if (isWindup) {
            ctx.rotate(-ang);
            ctx.font = `900 ${Math.max(11, Math.round(12 * dpr))}px ui-monospace, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fef08a';
            ctx.fillText('!', -cosA * (chevR * 1.45), -sinA * (chevR * 1.45));
          }
          ctx.restore();
        }
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

    // 5. Enemy Plasma-Ink Orbs & Bubbling Bio-Brine Globules (v193 zero-gradient-alloc mobile 60 FPS fast path!)
    const projGlowCyan = this.glowStamps?.cyan;
    const projGlowWarm = this.glowStamps?.warm;
    for (const pr of lair.enemyProjectiles || []) {
      const px = toScreenX(pr.x);
      const py = toScreenY(pr.y);
      if (px < -70 || px > cw + 70 || py < -70 || py > ch + 70) continue;
      const prR = pr.radius * scale;
      const pAng = Math.atan2(pr.vy || 0, pr.vx || 1);
      const col = pr.color || '#c084fc';
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(pAng);

      // Soft outer halo via pre-baked glowStamp (0 per-projectile gradient allocations!)
      const gStamp = (pr.kind === 'slag' || pr.kind === 'prism') ? (projGlowWarm || projGlowCyan) : projGlowCyan;
      if (gStamp) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.58;
        ctx.drawImage(gStamp, -prR * 2.1, -prR * 2.1, prR * 4.2, prR * 4.2);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }

      // Velocity-aligned comet tail wisp (flat translucent fill = zero gradient alloc!)
      ctx.globalAlpha = 0.44;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-prR * 2.5, 0);
      ctx.quadraticCurveTo(-prR * 0.6, -prR * 0.85, prR * 0.6, -prR * 0.45);
      ctx.arc(0, 0, prR * 0.82, -0.7, 0.7);
      ctx.quadraticCurveTo(-prR * 0.6, prR * 0.85, -prR * 2.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      // Solid stylized orb core with dark contour & glossy specular dot
      ctx.fillStyle = pr.kind === 'brine' ? '#bef264' : col;
      ctx.strokeStyle = pr.kind === 'brine' ? '#052e16' : '#1e1b4b';
      ctx.lineWidth = Math.max(1.2, 0.05 * scale);
      ctx.beginPath();
      ctx.ellipse(0, 0, prR * 0.92, prR * 0.76, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(prR * 0.24, -prR * 0.22, prR * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5c. Scooter Hydro-Dash Cavitation Shock-Cone & Cyan Afterimage Trail (v189)
    if (Array.isArray(lair.dashTrail) && lair.dashTrail.length > 0) {
      ctx.save();
      for (let i = 0; i < lair.dashTrail.length; i++) {
        const pt = lair.dashTrail[i];
        const a = Math.max(0, Math.min(1, pt.life / Math.max(0.05, pt.maxLife || 0.28)));
        const tx = toScreenX(pt.x);
        const ty = toScreenY(pt.y);
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(pt.angle || 0);
        ctx.globalAlpha = a * 0.55;
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = Math.max(1.5, 0.08 * scale * a);
        ctx.beginPath();
        ctx.arc(0, 0, (0.55 + (1 - a) * 0.65) * scale, -Math.PI * 0.42, Math.PI * 0.42);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
    if ((lair.dashTimerSec || 0) > 0 && diver) {
      const dx = toScreenX(diver.x);
      const dy = toScreenY(diver.y);
      const ang = Math.atan2(lair.dashDirY || 0, lair.dashDirX || 1);
      const frac = Math.min(1, lair.dashTimerSec / 0.26);
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(ang);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.72 * frac;
      const coneG = ctx.createLinearGradient(1.4 * scale, 0, -1.8 * scale, 0);
      coneG.addColorStop(0, '#ffffff');
      coneG.addColorStop(0.35, '#22d3ee');
      coneG.addColorStop(1, 'rgba(34, 211, 238, 0)');
      ctx.strokeStyle = coneG;
      ctx.lineWidth = Math.max(2.6, 0.14 * scale);
      ctx.beginPath();
      ctx.moveTo(-1.3 * scale, -0.95 * scale);
      ctx.quadraticCurveTo(0.8 * scale, -0.25 * scale, 1.35 * scale, 0);
      ctx.quadraticCurveTo(0.8 * scale, 0.25 * scale, -1.3 * scale, 0.95 * scale);
      ctx.stroke();
      ctx.restore();
    }

    // 5d. Hanging Ceiling Stalactite Emissive Aim Cue when Boss Drifts Underneath (v189)
    if (boss && boss.active && !boss.defeated) {
      for (const st of lair.stalactites || []) {
        if (st.state !== 'hanging') continue;
        const bossUnder = Math.abs(boss.x - st.x) <= (boss.radius || 3.4) + 2.4 && boss.y > st.y;
        const sx = toScreenX(st.x);
        const sy = toScreenY(st.y + 1.2);
        if (sx < -60 || sx > cw + 60 || sy < -60 || sy > ch + 60) continue;
        ctx.save();
        const pulse = 0.55 + 0.45 * Math.sin(timeSec * 8);
        if (bossUnder) {
          ctx.strokeStyle = `rgba(253, 224, 71, ${(0.62 + pulse * 0.34).toFixed(2)})`;
          ctx.lineWidth = Math.max(1.8, 0.08 * scale);
          ctx.beginPath();
          ctx.arc(sx, sy, (1.15 + pulse * 0.18) * scale, 0, Math.PI * 2);
          ctx.stroke();
          // Vertical dotted drop indicator toward boss
          ctx.strokeStyle = `rgba(253, 224, 71, ${(0.28 + pulse * 0.18).toFixed(2)})`;
          ctx.setLineDash([4 * dpr, 5 * dpr]);
          ctx.beginPath();
          ctx.moveTo(sx, sy + 1.2 * scale);
          ctx.lineTo(sx, toScreenY(boss.y - boss.radius));
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (st.hp < st.maxHp) {
          ctx.strokeStyle = 'rgba(253, 224, 71, 0.52)';
          ctx.lineWidth = Math.max(1.2, 0.05 * scale);
          ctx.beginPath();
          ctx.arc(sx, sy, 0.95 * scale, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 5e. Biome-Unique Signature Boss Hazards: Mines, Frost Rings, Star Orbs, Thermal Vent Geysers & Solar Caustic Lances (v192-v193)
    for (const hz of lair.bossHazards || []) {
      const hx = toScreenX(hz.x);
      const hy = toScreenY(hz.y);
      if (hz.kind !== 'frost-ring' && hz.kind !== 'sun-lance' && hz.kind !== 'vent-geyser') {
        if (hx < -90 || hx > cw + 90 || hy < -90 || hy > ch + 90) continue;
      }
      if (hz.kind === 'naval-mine') {
        const mr = (hz.radius || 1.35) * scale;
        const blink = Math.sin(timeSec * (hz.fuseSec < 2.4 ? 18 : 6.5) + (hz.phase || 0)) > 0;
        ctx.save();
        ctx.translate(hx, hy);
        if ((hz.hp || 2) < 2 || (hz.fuseSec ?? 9) < 2.5) {
          ctx.strokeStyle = 'rgba(251, 146, 60, 0.34)';
          ctx.lineWidth = Math.max(1.2, 0.05 * scale);
          ctx.setLineDash([5 * dpr, 5 * dpr]);
          ctx.beginPath();
          ctx.arc(0, 0, mr * 2.1, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.strokeStyle = '#041021';
        ctx.lineWidth = Math.max(2.2, 0.1 * scale);
        ctx.lineCap = 'round';
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + timeSec * 0.45;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * mr * 0.72, Math.sin(a) * mr * 0.72);
          ctx.lineTo(Math.cos(a) * mr * 1.24, Math.sin(a) * mr * 1.24);
          ctx.stroke();
          ctx.fillStyle = k % 2 === 0 && blink ? '#fb923c' : '#94a3b8';
          ctx.beginPath();
          ctx.arc(Math.cos(a) * mr * 1.24, Math.sin(a) * mr * 1.24, Math.max(2, mr * 0.16), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = hz.hitFlash > 0 ? '#ffffff' : '#334155';
        ctx.strokeStyle = '#041021';
        ctx.lineWidth = Math.max(1.8, 0.075 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, mr * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(-mr * 0.24, -mr * 0.24, mr * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = blink ? '#f97316' : '#fef08a';
        ctx.beginPath();
        ctx.arc(0, 0, mr * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (hz.kind === 'frost-ring') {
        const rr = (hz.radius || 2.6) * scale;
        const fade = Math.max(0.12, 1 - (hz.radius || 2.6) / (hz.maxRadius || 17.5));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.82 * fade;
        ctx.strokeStyle = hz.shatteredByLocal ? '#34d399' : '#67e8f9';
        ctx.lineWidth = Math.max(3, 0.18 * scale);
        ctx.beginPath();
        ctx.arc(hx, hy, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#e0f2fe';
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2 + timeSec * 1.4;
          const sx = hx + Math.cos(a) * rr;
          const sy = hy + Math.sin(a) * rr;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(a);
          ctx.beginPath();
          ctx.moveTo(0.42 * scale, 0);
          ctx.lineTo(0, -0.18 * scale);
          ctx.lineTo(-0.32 * scale, 0);
          ctx.lineTo(0, 0.18 * scale);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      } else if (hz.kind === 'star-orb') {
        const or = (hz.radius || 1.05) * scale;
        ctx.save();
        ctx.translate(hx, hy);
        if (warmStamp) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.72;
          ctx.drawImage(warmStamp, -or * 1.8, -or * 1.8, or * 3.6, or * 3.6);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
        }
        ctx.rotate(timeSec * 2.4);
        ctx.fillStyle = hz.hitFlash > 0 ? '#ffffff' : '#fef9c3';
        ctx.strokeStyle = '#713f12';
        ctx.lineWidth = Math.max(1.5, 0.06 * scale);
        ctx.beginPath();
        for (let p = 0; p < 8; p++) {
          const pr = p % 2 === 0 ? or * 0.96 : or * 0.36;
          const pa = (p * Math.PI) / 4;
          if (p === 0) ctx.moveTo(Math.cos(pa) * pr, Math.sin(pa) * pr);
          else ctx.lineTo(Math.cos(pa) * pr, Math.sin(pa) * pr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (hz.kind === 'vent-geyser') {
        // Boiling Hydrothermal Vent Geyser Column + shootable glowing basalt vent cap (v193)
        const halfW = (hz.halfWidth || 1.65) * scale;
        const colH = (hz.height || 18.0) * scale;
        const pulse = 0.55 + 0.45 * Math.sin(timeSec * 14);
        ctx.save();
        if (hz.erupting) {
          // Superheated towering undulating magma-steam eruption plume (feathered organic silhouette!)
          ctx.globalCompositeOperation = 'lighter';
          const segs = 10;
          ctx.fillStyle = 'rgba(249, 115, 22, 0.28)';
          ctx.beginPath();
          ctx.moveTo(hx - halfW * 0.72, hy);
          for (let s = 1; s <= segs; s++) {
            const f = s / segs;
            const w = halfW * (0.72 + f * 0.48) + Math.sin(timeSec * 9 - f * 7) * halfW * 0.14;
            ctx.lineTo(hx - w, hy - f * colH);
          }
          for (let s = segs; s >= 0; s--) {
            const f = s / segs;
            const w = halfW * (0.72 + f * 0.48) + Math.cos(timeSec * 8.4 - f * 6.5) * halfW * 0.14;
            ctx.lineTo(hx + w, hy - f * colH);
          }
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = 'rgba(254, 240, 138, 0.44)';
          ctx.beginPath();
          ctx.moveTo(hx - halfW * 0.34, hy);
          for (let s = 1; s <= segs; s++) {
            const f = s / segs;
            const sway = Math.sin(timeSec * 11 - f * 8) * halfW * 0.12;
            ctx.lineTo(hx - halfW * (0.34 + f * 0.14) + sway, hy - f * colH);
          }
          for (let s = segs; s >= 0; s--) {
            const f = s / segs;
            const sway = Math.sin(timeSec * 11 - f * 8) * halfW * 0.12;
            ctx.lineTo(hx + halfW * (0.34 + f * 0.14) + sway, hy - f * colH);
          }
          ctx.closePath();
          ctx.fill();
          // Rising boiling steam-ember pockets
          ctx.fillStyle = 'rgba(255, 247, 237, 0.72)';
          for (let b = 0; b < 6; b++) {
            const frac = ((timeSec * 2.6 + b * 0.18) % 1);
            const by = hy - frac * colH;
            const bx = hx + Math.sin(timeSec * 7 + b * 2.1) * halfW * 0.45;
            ctx.beginPath();
            ctx.arc(bx, by, Math.max(2.5, (0.28 + (1 - frac) * 0.28) * scale), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';
        } else {
          // Floor fissure warning telegraph shimmer
          ctx.strokeStyle = `rgba(251, 146, 60, ${(0.45 + pulse * 0.48).toFixed(2)})`;
          ctx.lineWidth = Math.max(1.8, 0.08 * scale);
          ctx.setLineDash([6 * dpr, 5 * dpr]);
          ctx.beginPath();
          ctx.moveTo(hx - halfW * 0.75, hy);
          ctx.lineTo(hx - halfW * 0.75, hy - colH * 0.85);
          ctx.moveTo(hx + halfW * 0.75, hy);
          ctx.lineTo(hx + halfW * 0.75, hy - colH * 0.85);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // Shootable volcanic basalt vent cap node at base
        const capR = (hz.radius || 1.35) * scale;
        ctx.fillStyle = hz.hitFlash > 0 ? '#ffffff' : '#292524';
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = Math.max(1.8, 0.075 * scale);
        ctx.beginPath();
        ctx.moveTo(hx - capR, hy + capR * 0.35);
        ctx.lineTo(hx - capR * 0.62, hy - capR * 0.72);
        ctx.lineTo(hx + capR * 0.62, hy - capR * 0.72);
        ctx.lineTo(hx + capR, hy + capR * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(hx, hy - capR * 0.28, capR * 0.28 * (0.8 + pulse * 0.25), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (hz.kind === 'sun-lance') {
        // Refracting Solar Caustic Lance + Hydro-Dash shatterable Sun-Prism Node (v193)
        const ang = hz.angle || 0;
        const lenPx = (hz.length || 25.0) * scale;
        const ex = hx + Math.cos(ang) * lenPx;
        const ey = hy + Math.sin(ang) * lenPx;
        const pr = (hz.radius || 1.25) * scale;
        const pulse = 0.55 + 0.45 * Math.sin(timeSec * 15);
        ctx.save();
        if (hz.firing) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.42)';
          ctx.lineWidth = Math.max(12, 1.35 * scale);
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(254, 249, 195, 0.94)';
          ctx.lineWidth = Math.max(4, 0.46 * scale);
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        } else {
          // Crisp golden refracting aim telegraph line
          ctx.strokeStyle = `rgba(253, 224, 71, ${(0.4 + pulse * 0.45).toFixed(2)})`;
          ctx.lineWidth = Math.max(1.6, 0.065 * scale);
          ctx.setLineDash([7 * dpr, 5 * dpr]);
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // Rotating Sun-Prism Crystal Node
        ctx.translate(hx, hy);
        ctx.rotate(timeSec * 2.8);
        if (warmStamp) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.68;
          ctx.drawImage(warmStamp, -pr * 1.9, -pr * 1.9, pr * 3.8, pr * 3.8);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = hz.hitFlash > 0 ? '#ffffff' : '#fde047';
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = Math.max(1.6, 0.065 * scale);
        ctx.beginPath();
        ctx.moveTo(0, -pr * 0.95);
        ctx.lineTo(pr * 0.72, 0);
        ctx.lineTo(0, pr * 0.95);
        ctx.lineTo(-pr * 0.72, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (hz.kind === 'crystal-prism') {
        // Faceted Iridescent Selenite Mirror Shard (Crystal Basilisk, v194)
        const pr = (hz.radius || 1.25) * scale;
        ctx.save();
        ctx.translate(hx, hy);
        if (healStamp) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.65;
          ctx.drawImage(healStamp, -pr * 2.0, -pr * 2.0, pr * 4.0, pr * 4.0);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
        }
        ctx.rotate(Math.sin(timeSec * 2.1 + (hz.phase || 0)) * 0.22);
        ctx.fillStyle = hz.hitFlash > 0 ? '#ffffff' : '#e879f9';
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = Math.max(1.8, 0.075 * scale);
        ctx.beginPath();
        ctx.moveTo(0, -pr * 1.15);
        ctx.lineTo(pr * 0.72, -pr * 0.25);
        ctx.lineTo(pr * 0.45, pr * 1.05);
        ctx.lineTo(-pr * 0.45, pr * 1.05);
        ctx.lineTo(-pr * 0.72, -pr * 0.25);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.beginPath();
        ctx.moveTo(0, -pr * 0.85);
        ctx.lineTo(pr * 0.36, -pr * 0.15);
        ctx.lineTo(0, pr * 0.55);
        ctx.lineTo(-pr * 0.36, -pr * 0.15);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (hz.kind === 'homing-torpedo') {
        // Spectral Acoustic Homing Torpedo (flips cyan-gold when Hydro-Dash reversed! v194)
        const tr = (hz.radius || 1.12) * scale;
        const ang = hz.angle || 0;
        const col = hz.reversed ? '#fde047' : '#2dd4bf';
        const pulse = 0.5 + 0.5 * Math.sin(timeSec * 16);
        ctx.save();
        ctx.translate(hx, hy);
        // Pulsing acoustic sonar ping ring
        ctx.strokeStyle = hz.reversed ? `rgba(253, 224, 71, ${(0.35 + pulse * 0.45).toFixed(2)})` : `rgba(45, 212, 191, ${(0.32 + pulse * 0.42).toFixed(2)})`;
        ctx.lineWidth = Math.max(1.4, 0.06 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, tr * (1.25 + pulse * 0.45), 0, Math.PI * 2);
        ctx.stroke();

        ctx.rotate(ang);
        // Bubbling wake trail behind prop
        ctx.fillStyle = hz.reversed ? 'rgba(254, 240, 138, 0.55)' : 'rgba(94, 234, 212, 0.48)';
        for (let b = 1; b <= 3; b++) {
          ctx.beginPath();
          ctx.arc(-tr * (1.15 + b * 0.48), Math.sin(timeSec * 18 + b) * tr * 0.18, tr * (0.28 - b * 0.05), 0, Math.PI * 2);
          ctx.fill();
        }
        // Torpedo steel fuselage + warhead nose
        ctx.fillStyle = hz.hitFlash > 0 ? '#ffffff' : '#334155';
        ctx.strokeStyle = '#041021';
        ctx.lineWidth = Math.max(1.8, 0.07 * scale);
        ctx.beginPath();
        ctx.ellipse(0, 0, tr * 1.18, tr * 0.44, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Glowing acoustic warhead cap
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(tr * 0.85, 0, tr * 0.34, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.fill();
        // Stabilizer fins
        ctx.fillStyle = '#64748b';
        ctx.fillRect(-tr * 1.15, -tr * 0.55, tr * 0.32, tr * 1.1);
        ctx.restore();
      } else if (hz.kind === 'sun-obelisk') {
        const obR = (hz.radius || 1.35) * scale;
        ctx.save();
        ctx.translate(hx, hy);
        if (warmStamp) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.65;
          ctx.drawImage(warmStamp, -obR * 2.2, -obR * 2.2, obR * 4.4, obR * 4.4);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
        }
        ctx.rotate(hz.angle || timeSec);
        ctx.fillStyle = hz.hitFlash > 0 ? '#ffffff' : '#d97706';
        ctx.strokeStyle = '#1c1917';
        ctx.lineWidth = Math.max(2.0, 0.08 * scale);
        ctx.beginPath();
        ctx.moveTo(0, -obR * 1.25);
        ctx.lineTo(obR * 0.72, 0);
        ctx.lineTo(0, obR * 1.25);
        ctx.lineTo(-obR * 0.72, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(0, 0, obR * 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = Math.max(1.4, 0.06 * scale);
        ctx.stroke();
        ctx.restore();
      } else if (hz.kind === 'ore-gate') {
        const gr = (hz.radius || 1.55) * scale;
        ctx.save();
        ctx.translate(hx, hy);
        if (!hz.dropping) {
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = Math.max(1.8, 0.07 * scale);
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(-gr * 0.62, -gr * 0.72);
          ctx.lineTo(-gr * 0.62, -gr * 3.2);
          ctx.moveTo(gr * 0.62, -gr * 0.72);
          ctx.lineTo(gr * 0.62, -gr * 3.2);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (warmStamp) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.75;
          ctx.drawImage(warmStamp, -gr * 2.0, -gr * 2.0, gr * 4.0, gr * 4.0);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = hz.hitFlash > 0 ? '#ffffff' : '#334155';
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = Math.max(2.2, 0.085 * scale);
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(-gr * 0.92, -gr * 0.72, gr * 1.84, gr * 1.44, gr * 0.16);
        } else {
          ctx.rect(-gr * 0.92, -gr * 0.72, gr * 1.84, gr * 1.44);
        }
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-gr * 0.78, gr * 0.25, gr * 1.56, gr * 0.28);
        if (!hz.dropping) {
          const pulse = 0.6 + 0.4 * Math.sin(timeSec * 10);
          ctx.fillStyle = `rgba(249, 115, 22, ${pulse.toFixed(2)})`;
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = Math.max(1.6, 0.065 * scale);
          ctx.beginPath();
          ctx.arc(0, -gr * 0.15, gr * 0.34, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 6. Hyper-Tip Ready Golden Glow on Diver's Speargun Tip (zero gradient alloc!)
    const overLv = lair.weaponMods?.overcharge || 0;
    const hyperEvery = overLv >= 2 ? 2 : overLv === 1 ? 3 : 5;
    if (lair.combatMode && lair.weaponEquipped && !lair.bossDefeated && diver && (lair.shotCounter || 0) % hyperEvery === hyperEvery - 1) {
      const aim = diver.torchAngle ?? diver.angle ?? 0;
      const hx = toScreenX((diver.body?.hand?.x ?? diver.x) + Math.cos(aim) * 1.12);
      const hy = toScreenY((diver.body?.hand?.y ?? diver.y) + Math.sin(aim) * 1.12);
      const hr = (0.32 + 0.07 * Math.sin(timeSec * 14)) * scale;
      ctx.save();
      if (warmStamp) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.85;
        ctx.drawImage(warmStamp, hx - hr * 2.2, hy - hr * 2.2, hr * 4.4, hr * 4.4);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#fef9c3';
      ctx.beginPath();
      ctx.arc(hx, hy, hr * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 6b. Tethered Titanium Speargun Bolts (upgraded plasma / seeker / rapid visuals!)
    for (const sp of lair.spears || []) {
      const sx = toScreenX(sp.x);
      const sy = toScreenY(sp.y);
      const ox = toScreenX(sp.originX);
      const oy = toScreenY(sp.originY);
      const isSeeker = (sp.homingTurnRate || 0) > 0;
      const isOver = Boolean(sp.overcharged);
      const isWing = Boolean(sp.isWingman);
      const tetherCol = sp.piercing
        ? 'rgba(253, 224, 71, 0.56)'
        : isWing
          ? 'rgba(52, 211, 153, 0.46)'
          : isSeeker
            ? 'rgba(192, 132, 252, 0.48)'
            : isOver
              ? 'rgba(251, 113, 133, 0.48)'
              : 'rgba(186, 230, 253, 0.34)';
      const shaftCol = sp.piercing
        ? '#fde047'
        : isWing
          ? '#a7f3d0'
          : isSeeker
            ? '#e9d5ff'
            : isOver
              ? '#fecdd3'
              : '#e0f2fe';
      const tipCol = sp.piercing
        ? '#fef08a'
        : isWing
          ? '#34d399'
          : isSeeker
            ? '#c084fc'
            : isOver
              ? '#fb7185'
              : sp.rapid
                ? '#67e8f9'
                : '#38bdf8';
      ctx.save();
      ctx.strokeStyle = tetherCol;
      ctx.lineWidth = Math.max(1, (sp.piercing || isOver ? 0.055 : 0.04) * scale);
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(sx, sy);
      ctx.stroke();

      ctx.translate(sx, sy);
      ctx.rotate(sp.angle || 0);
      ctx.strokeStyle = shaftCol;
      ctx.lineWidth = Math.max(2.4, (sp.charged ? 0.14 : 0.095) * scale);
      ctx.beginPath();
      ctx.moveTo(-0.88 * scale, 0);
      ctx.lineTo(0.48 * scale, 0);
      ctx.stroke();
      ctx.fillStyle = tipCol;
      ctx.beginPath();
      ctx.moveTo(0.8 * scale, 0);
      ctx.lineTo(0.24 * scale, -0.24 * scale);
      ctx.lineTo(0.24 * scale, 0.24 * scale);
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
      // Sleek cinematic letterbox backdrop & hairline accent beneath Boss Title Card (v204)
      const stripH = (lair.titleBannerSub ? 56 : 38) * dpr;
      const stripW = Math.min(cw * 0.78, 520 * dpr);
      const bgGrad = ctx.createLinearGradient(cw * 0.5 - stripW * 0.5, cy, cw * 0.5 + stripW * 0.5, cy);
      bgGrad.addColorStop(0, 'rgba(2, 6, 23, 0)');
      bgGrad.addColorStop(0.22, 'rgba(2, 6, 23, 0.72)');
      bgGrad.addColorStop(0.78, 'rgba(2, 6, 23, 0.72)');
      bgGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(cw * 0.5 - stripW * 0.5, cy - stripH * 0.44, stripW, stripH);
      const accentCol = lair.titleBannerColor || '#38bdf8';
      ctx.strokeStyle = accentCol;
      ctx.lineWidth = Math.max(1, 1.4 * dpr);
      ctx.globalAlpha = bannerA * 0.62;
      ctx.beginPath();
      ctx.moveTo(cw * 0.5 - stripW * 0.34, cy - stripH * 0.44);
      ctx.lineTo(cw * 0.5 + stripW * 0.34, cy - stripH * 0.44);
      ctx.moveTo(cw * 0.5 - stripW * 0.34, cy + stripH * 0.56);
      ctx.lineTo(cw * 0.5 + stripW * 0.34, cy + stripH * 0.56);
      ctx.stroke();
      ctx.globalAlpha = bannerA;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${Math.round(24 * dpr)}px ui-monospace, monospace`;
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.95)';
      ctx.lineWidth = 5 * dpr;
      ctx.strokeText(lair.titleBannerText, cw * 0.5, cy);
      ctx.fillStyle = accentCol;
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
      ctx.fillText(`${spec.boss.icon || '🐙'} ${boss.name}${statusTag}`, bx, by - 11 * dpr);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fde68a';
      ctx.fillText(lair.scaling.label, bx + barW, by - 11 * dpr);

      // Rounded pill HP track with glossy bevel sheen & diamond phase pips (v188)
      const trackR = barH * 0.45;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(bx, by, barW, barH, trackR);
      } else {
        ctx.rect(bx, by, barW, barH);
      }
      ctx.fill();

      // Trailing AAA Ghost-Damage Bar (smoothly drains behind burst hits so every big hit feels huge!, v204)
      if (!Number.isFinite(this._bossGhostHpRatio) || this._bossGhostHpId !== boss.id || hpRatio > this._bossGhostHpRatio) {
        this._bossGhostHpRatio = hpRatio;
        this._bossGhostHpId = boss.id;
      } else {
        this._bossGhostHpRatio += (hpRatio - this._bossGhostHpRatio) * 0.085;
        if (this._bossGhostHpRatio - hpRatio < 0.002) this._bossGhostHpRatio = hpRatio;
      }
      if (this._bossGhostHpRatio > hpRatio + 0.003) {
        const ghostW = Math.max(0, barW * this._bossGhostHpRatio);
        ctx.fillStyle = 'rgba(254, 240, 138, 0.78)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx, by, ghostW, barH, trackR);
        } else {
          ctx.rect(bx, by, ghostW, barH);
        }
        ctx.fill();
      }

      const fillW = Math.max(0, barW * hpRatio);
      if (fillW > 1) {
        const gradKey = `${bx}:${barW}`;
        if (!this._bossBarGradCache || this._bossBarGradCache.key !== gradKey) {
          const hg = ctx.createLinearGradient(bx, by, bx + barW, by);
          hg.addColorStop(0, '#ef4444');
          hg.addColorStop(0.5, '#c084fc');
          hg.addColorStop(1, '#38bdf8');
          this._bossBarGradCache = { key: gradKey, grad: hg };
        }
        ctx.fillStyle = this._bossBarGradCache.grad;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx, by, fillW, barH, trackR);
        } else {
          ctx.rect(bx, by, fillW, barH);
        }
        ctx.fill();
        // Upper glossy bevel highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fillRect(bx + trackR * 0.5, by + 1.5 * dpr, Math.max(0, fillW - trackR), barH * 0.32);
      }

      // Phase threshold diamond markers at 33% & 66%
      for (const mark of [0.33, 0.66]) {
        const mx = bx + barW * mark;
        const my = by + barH * 0.5;
        ctx.strokeStyle = 'rgba(248, 250, 252, 0.72)';
        ctx.lineWidth = Math.max(1, 1.2 * dpr);
        ctx.beginPath();
        ctx.moveTo(mx, by);
        ctx.lineTo(mx, by + barH);
        ctx.stroke();
        ctx.fillStyle = hpRatio > mark ? '#fef9c3' : '#475569';
        ctx.beginPath();
        ctx.moveTo(mx, my - 3.2 * dpr);
        ctx.lineTo(mx + 3.2 * dpr, my);
        ctx.lineTo(mx, my + 3.2 * dpr);
        ctx.lineTo(mx - 3.2 * dpr, my);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  },
};
