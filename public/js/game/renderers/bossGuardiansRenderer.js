/**
 * 11 Biome Guardian Boss Body Renderers & Shared Status Emotes (v264).
 * Extracted from bossAndLairRenderer.js and spread into bossAndLairMethods.
 */
export const bossGuardiansMethods = {
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
};
