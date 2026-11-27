/**
 * 11 Biome Guardian Boss Body Renderers & Shared Status Emotes (v264).
 * Extracted from bossAndLairRenderer.js and spread into bossAndLairMethods.
 */
export const bossGuardiansMethods = {
  /**
   * Dispatch boss rendering across all 14 unique biome Secret Lair Guardians (v189–v265).
   */
  _drawSecretLairBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const t = Number.isFinite(timeSec) ? timeSec : 0;
    if (boss.kind === 'iron-leviathan') {
      this._drawIronLeviathanBoss(ctx, boss, toScreenX, toScreenY, scale, t);
    } else if (boss.kind === 'frost-crab' || boss.kind === 'frost-wyrm') {
      this._drawFrostCrabBoss(ctx, boss, toScreenX, toScreenY, scale, t);
    } else if (boss.kind === 'abyssal-empress') {
      this._drawAbyssalEmpressBoss(ctx, boss, toScreenX, toScreenY, scale, t);
    } else if (boss.kind === 'solar-lobster' || boss.kind === 'solar-leviathan') {
      this._drawSolarLobsterBoss(ctx, boss, toScreenX, toScreenY, scale, t);
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
    } else if (boss.kind === 'electric-eel') {
      this._drawElectricEelBoss(ctx, boss, toScreenX, toScreenY, scale, t);
    } else if (boss.kind === 'loch-ness') {
      this._drawLochNessBoss(ctx, boss, toScreenX, toScreenY, scale, t);
    } else if (boss.kind === 'great-white') {
      this._drawGreatWhiteBoss(ctx, boss, toScreenX, toScreenY, scale, t);
    } else if (boss.kind === 'orca-whale') {
      this._drawOrcaWhaleBoss(ctx, boss, toScreenX, toScreenY, scale, t);
    } else if (boss.kind === 'giant-clam') {
      this._drawGiantClamBoss(ctx, boss, toScreenX, toScreenY, scale, t);
    } else if (boss.kind === 'piranha-trio') {
      this._drawPiranhaTrioBoss(ctx, boss, toScreenX, toScreenY, scale, t);
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
   * Shared Glossy Kawaii Anime Eye matching the Octopus/Kraken boss aesthetic (v266).
   * Supports dormant (`u`), hurt/KO (`> <`), stunned (`@_@` spiral), and sparkling glossy iris + double catchlights.
   */
  _drawKawaiiAnimeEye(ctx, cx, cy, rx, ry, scale, opts = {}) {
    const {
      irisTop = '#67e8f9',
      irisBot = '#0284c7',
      outline = '#09071a',
      isStunned = false,
      isHurt = false,
      isDormant = false,
      isAngry = false,
      side = 0, // 0 = left/near, 1 = right/far
      timeSec = 0,
      lash = true,
    } = opts;
    const rxE = Math.max(2.2, rx);
    const ryE = Math.max(2.2, ry);
    ctx.save();
    ctx.translate(cx, cy);
    if (isDormant) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(2.0, 0.085 * scale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, rxE * 0.82, 0.2, Math.PI - 0.2);
      ctx.stroke();
    } else if (isHurt) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(2.2, 0.095 * scale);
      ctx.lineCap = 'round';
      const sgn = side === 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(-sgn * rxE * 0.65, -ryE * 0.45);
      ctx.lineTo(sgn * rxE * 0.55, 0);
      ctx.lineTo(-sgn * rxE * 0.65, ryE * 0.45);
      ctx.stroke();
    } else if (isStunned) {
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(1.8, 0.075 * scale);
      ctx.beginPath();
      ctx.ellipse(0, 0, rxE, ryE * 0.92, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.rotate((side === 0 ? 1 : -1) * (timeSec * 5.2));
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(1.5, 0.065 * scale);
      ctx.beginPath();
      for (let k = 0; k <= 20; k++) {
        const ang = k * 0.58;
        const rad = (k / 20) * rxE * 0.76;
        if (k === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
        else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
      }
      ctx.stroke();
    } else {
      // Deep glossy obsidian oval base
      ctx.fillStyle = '#09071a';
      ctx.beginPath();
      ctx.ellipse(0, 0, rxE, ryE, 0, 0, Math.PI * 2);
      ctx.fill();
      // Rich glowing lower anime iris crescent gradient
      const ig = ctx.createRadialGradient(0, ryE * 0.36, rxE * 0.08, 0, ryE * 0.26, ryE * 0.88);
      ig.addColorStop(0, irisTop);
      ig.addColorStop(0.58, irisBot);
      ig.addColorStop(1, 'rgba(9, 7, 26, 0)');
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.ellipse(0, ryE * 0.22, rxE * 0.82, ryE * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      // Glossy upper-left anime catchlight oval + lower-right star sparkle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-rxE * 0.26, -ryE * 0.30, Math.max(1.5, rxE * 0.36), Math.max(1.5, ryE * 0.30), -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rxE * 0.30, ryE * 0.32, Math.max(1.2, rxE * 0.17), 0, Math.PI * 2);
      ctx.fill();
      // Crisp upper anime lash arc
      if (lash) {
        ctx.strokeStyle = outline;
        ctx.lineWidth = Math.max(1.8, 0.075 * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.ellipse(0, -ryE * 0.06, rxE * 1.06, ryE * 1.02, 0, Math.PI * 1.08, Math.PI * 1.92);
        ctx.stroke();
      }
      // Cute determined angled anime brow when angry (never harsh!)
      if (isAngry) {
        ctx.strokeStyle = outline;
        ctx.lineWidth = Math.max(2.2, 0.09 * scale);
        ctx.lineCap = 'round';
        const tilt = side === 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(-rxE * 0.95, -ryE * (0.95 + tilt * 0.16));
        ctx.lineTo(rxE * 0.95, -ryE * (0.95 - tilt * 0.18));
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  /**
   * Shared Rosy Anime Blush Cheek with diagonal white hatch marks `///` (v266).
   */
  _drawKawaiiBlush(ctx, cx, cy, rx, ry, scale, color = 'rgba(251, 113, 133, 0.62)') {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(2, rx), Math.max(1.5, ry), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.lineWidth = Math.max(1.0, 0.032 * scale);
    ctx.lineCap = 'round';
    for (let h = -1; h <= 1; h++) {
      ctx.beginPath();
      ctx.moveTo(cx + h * rx * 0.34 - rx * 0.12, cy + ry * 0.44);
      ctx.lineTo(cx + h * rx * 0.34 + rx * 0.14, cy - ry * 0.44);
      ctx.stroke();
    }
    ctx.restore();
  },

  /**
   * Shared Expressive Anime Mouth (`:3` cat smile, `:O` roar with tiny tongue, `~` dizzy) (v266).
   */
  _drawKawaiiMouth(ctx, cx, cy, size, scale, opts = {}) {
    const {
      outline = '#09071a',
      isOpen = false,
      isStunned = false,
      fangs = false,
      glowColor = '#fda4af',
    } = opts;
    ctx.save();
    if (isOpen) {
      const mrX = Math.max(2.2, size * 1.15);
      const mrY = Math.max(2.2, size * 1.18);
      ctx.fillStyle = '#881337';
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(1.5, 0.06 * scale);
      ctx.beginPath();
      ctx.ellipse(cx, cy, mrX, mrY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = glowColor;
      ctx.beginPath();
      ctx.ellipse(cx, cy + mrY * 0.40, mrX * 0.58, mrY * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (isStunned) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(1.7, 0.072 * scale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - size * 1.1, cy);
      ctx.quadraticCurveTo(cx - size * 0.35, cy - size * 0.55, cx, cy);
      ctx.quadraticCurveTo(cx + size * 0.45, cy + size * 0.55, cx + size * 1.1, cy);
      ctx.stroke();
    } else {
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(1.7, 0.072 * scale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx - size * 0.56, cy - size * 0.08, Math.max(1.5, size * 0.58), 0.15, Math.PI - 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + size * 0.56, cy - size * 0.08, Math.max(1.5, size * 0.58), 0.1, Math.PI - 0.15);
      ctx.stroke();
      if (fangs) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = outline;
        ctx.lineWidth = Math.max(1.0, 0.04 * scale);
        for (const sgn of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx + sgn * size * 0.85, cy + size * 0.16);
          ctx.lineTo(cx + sgn * size * 1.05, cy + size * 0.68);
          ctx.lineTo(cx + sgn * size * 0.58, cy + size * 0.32);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  },

  /**
   * Shared Glossy Anime Jelly-Bean Specular Highlight + Tiny Sparkle Dot (v266).
   */
  _drawKawaiiShine(ctx, cx, cy, rx, ry, rot = -0.35) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.36)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(2, rx), Math.max(1.4, ry), rot, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
    ctx.beginPath();
    ctx.arc(cx + rx * 1.15, cy - ry * 0.45, Math.max(1.4, ry * 0.42), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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

    // 5. Glossy Chibi Dome Highlight + Cute Cheeky Underbite Jaw with Stubby Baby Steel Fanglets!
    this._drawKawaiiShine(ctx, -r * 0.22, -r * 0.48, r * 0.30, r * 0.13, -0.28);

    // Cute rounded lower brass chin with tiny stubby baby fangs (Kirby-mech cute!)
    ctx.save();
    ctx.translate(r * 0.56, r * 0.30);
    ctx.rotate(jawOpen * 0.55);
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(1.8, 0.075 * scale);
    ctx.beginPath();
    ctx.moveTo(-r * 0.18, 0);
    ctx.quadraticCurveTo(r * 0.26, -r * 0.04, r * 0.52, r * 0.04);
    ctx.quadraticCurveTo(r * 0.44, r * 0.32, r * 0.12, r * 0.32);
    ctx.quadraticCurveTo(-r * 0.18, r * 0.28, -r * 0.18, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Cute tiny rounded baby teeth peeking up!
    ctx.fillStyle = '#ffffff';
    for (let t = 0; t < 3; t++) {
      const tx = r * (0.04 + t * 0.14);
      ctx.beginPath();
      ctx.arc(tx, -r * 0.02, r * 0.055, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // 6. GIANT Sparkling Anime Porthole Eyes (3/4 chibi pair!) + Rosy Blush + Cute `:3` Grin
    // Brass eyeglass rim behind near eye
    ctx.fillStyle = brass;
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(1.8, 0.07 * scale);
    ctx.beginPath();
    ctx.ellipse(r * 0.34, -r * 0.14, r * 0.28, r * 0.31, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    this._drawKawaiiAnimeEye(ctx, r * 0.34, -r * 0.14, r * 0.22, r * 0.26, scale, {
      irisTop: '#fef08a',
      irisBot: glowCol,
      outline: '#041021',
      isStunned,
      isHurt: isHurt || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry,
      side: 0,
      timeSec,
    });
    // Far-side 3/4 eye peeking adorably near snout!
    this._drawKawaiiAnimeEye(ctx, r * 0.80, -r * 0.16, r * 0.14, r * 0.19, scale, {
      irisTop: '#fef08a',
      irisBot: glowCol,
      outline: '#041021',
      isStunned,
      isHurt: isHurt || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry,
      side: 1,
      timeSec,
    });
    this._drawKawaiiBlush(ctx, r * 0.18, r * 0.16, r * 0.15, r * 0.085, scale, 'rgba(251, 113, 133, 0.65)');
    this._drawKawaiiBlush(ctx, r * 0.88, r * 0.12, r * 0.10, r * 0.065, scale, 'rgba(251, 113, 133, 0.58)');
    this._drawKawaiiMouth(ctx, r * 0.58, r * 0.14, r * 0.11, scale, {
      outline: '#fef08a',
      isOpen: isAngry,
      isStunned,
      fangs: !isAngry,
      glowColor: '#fde047',
    });

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

    // 4. GIANT Sparkling Royal Chibi Anime Eyes (3/4 pair!) + Rosy Blush + Cute Royal `:3` Smile!
    this._drawKawaiiShine(ctx, -r * 0.10, -r * 0.34, r * 0.28, r * 0.11, -0.18);
    const isEmpressAngry = boss.phase >= 3 || boss.aiState === 'beam_sweep' || boss.aiState === 'lunge_dash';
    this._drawKawaiiAnimeEye(ctx, r * 0.30, -r * 0.06, r * 0.20, r * 0.24, scale, {
      irisTop: '#fef08a',
      irisBot: '#c084fc',
      outline: '#041021',
      isStunned,
      isHurt: isHurt || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry: isEmpressAngry,
      side: 0,
      timeSec,
    });
    this._drawKawaiiAnimeEye(ctx, r * 0.78, -r * 0.08, r * 0.15, r * 0.20, scale, {
      irisTop: '#fef08a',
      irisBot: '#c084fc',
      outline: '#041021',
      isStunned,
      isHurt: isHurt || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry: isEmpressAngry,
      side: 1,
      timeSec,
    });
    this._drawKawaiiBlush(ctx, r * 0.14, r * 0.18, r * 0.15, r * 0.085, scale, 'rgba(244, 114, 182, 0.65)');
    this._drawKawaiiBlush(ctx, r * 0.86, r * 0.14, r * 0.10, r * 0.065, scale, 'rgba(244, 114, 182, 0.55)');
    this._drawKawaiiMouth(ctx, r * 0.56, r * 0.16, r * 0.11, scale, {
      outline: '#041021',
      isOpen: isEmpressAngry,
      isStunned,
      glowColor: '#f472b6',
    });
    // Glowing cheek constellation jewels
    ctx.fillStyle = glyphCol;
    for (let j = 0; j < 2; j++) {
      ctx.beginPath();
      ctx.arc(r * (-0.12 - j * 0.18), r * (0.14 + j * 0.04), Math.max(1.8, r * (0.065 - j * 0.014)), 0, Math.PI * 2);
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

    // 3. Cute Chubby Terracotta Cephalopod Face Peeking from Spiral Shell + Cozy Volcanic Cap!
    this._drawKawaiiShine(ctx, shellCx - shellR * 0.26, shellCy - shellR * 0.56, shellR * 0.34, shellR * 0.14, -0.45);
    const faceG = ctx.createRadialGradient(r * 0.44, -r * 0.12, r * 0.08, r * 0.48, r * 0.06, r * 0.64);
    faceG.addColorStop(0, hitF > 0 ? '#ffffff' : '#fdba74');
    faceG.addColorStop(0.58, hitF > 0 ? '#fed7aa' : '#ea580c');
    faceG.addColorStop(1, '#7c2d12');
    ctx.fillStyle = faceG;
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(2.4, 0.1 * scale);
    ctx.beginPath();
    ctx.ellipse(r * 0.48, r * 0.06, r * 0.56, r * 0.62, -0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cute jaunty volcanic basalt beret cap perched above forehead (keeps face wide open & adorable!)
    ctx.fillStyle = hitF > 0 ? '#ffffff' : '#57534e';
    ctx.beginPath();
    ctx.moveTo(r * 0.02, -r * 0.54);
    ctx.quadraticCurveTo(r * 0.52, -r * 0.88, r * 0.96, -r * 0.46);
    ctx.quadraticCurveTo(r * 0.52, -r * 0.34, r * 0.06, -r * 0.40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    this._drawKawaiiShine(ctx, r * 0.42, -r * 0.60, r * 0.20, r * 0.07, -0.1);

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

    // 5. GIANT Sparkling Molten-Gold Chibi Anime Eyes (3/4 pair!) + Rosy Blush + Cute `:3` Smile!
    const isNautAngry = boss.phase >= 3 || boss.aiState === 'lunge_dash' || boss.aiState === 'beam_sweep';
    this._drawKawaiiAnimeEye(ctx, r * 0.42, -r * 0.04, r * 0.20, r * 0.24, scale, {
      irisTop: '#fef08a',
      irisBot: '#f97316',
      outline: '#041021',
      isStunned,
      isHurt: hitF > 0 || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry: isNautAngry,
      side: 0,
      timeSec,
    });
    this._drawKawaiiAnimeEye(ctx, r * 0.84, -r * 0.06, r * 0.14, r * 0.20, scale, {
      irisTop: '#fef08a',
      irisBot: '#f97316',
      outline: '#041021',
      isStunned,
      isHurt: hitF > 0 || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry: isNautAngry,
      side: 1,
      timeSec,
    });
    this._drawKawaiiBlush(ctx, r * 0.26, r * 0.22, r * 0.14, r * 0.08, scale, 'rgba(251, 113, 133, 0.72)');
    this._drawKawaiiBlush(ctx, r * 0.90, r * 0.18, r * 0.09, r * 0.06, scale, 'rgba(251, 113, 133, 0.62)');
    this._drawKawaiiMouth(ctx, r * 0.65, r * 0.20, r * 0.11, scale, {
      outline: '#041021',
      isOpen: isNautAngry,
      isStunned,
      glowColor: '#fde047',
    });

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

    // 3. Plump Chibi Pastel-Amethyst Crystal-Axolotl Head + Glossy Specular Shine!
    const headG = ctx.createRadialGradient(r * 0.15, -r * 0.28, r * 0.08, r * 0.08, 0, r * 1.05);
    headG.addColorStop(0, crystalLit);
    headG.addColorStop(0.55, crystalMid);
    headG.addColorStop(1, '#4c1d95');
    ctx.fillStyle = headG;
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = Math.max(2.4, 0.10 * scale);
    ctx.beginPath();
    ctx.ellipse(r * 0.18, -r * 0.02, r * 0.86, r * 0.68, -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Soft pastel lavender cheek belly + glossy anime jelly-bean forehead shine
    ctx.fillStyle = 'rgba(245, 208, 254, 0.30)';
    ctx.beginPath();
    ctx.ellipse(r * 0.32, r * 0.26, r * 0.48, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    this._drawKawaiiShine(ctx, -r * 0.08, -r * 0.36, r * 0.26, r * 0.11, -0.28);

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

    // 5. GIANT Sparkling Amethyst-Cyan Chibi Anime Eyes (3/4 pair!) + Rosy Blush + `:3` Fang Smile!
    const isBasAngry = boss.phase >= 3 || boss.aiState === 'lunge_dash' || boss.aiState === 'beam_sweep';
    this._drawKawaiiAnimeEye(ctx, r * 0.26, -r * 0.06, r * 0.21, r * 0.25, scale, {
      irisTop: '#e0f2fe',
      irisBot: crystalCyan,
      outline: '#1e1b4b',
      isStunned,
      isHurt: hitF > 0 || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry: isBasAngry,
      side: 0,
      timeSec,
    });
    this._drawKawaiiAnimeEye(ctx, r * 0.76, -r * 0.08, r * 0.15, r * 0.21, scale, {
      irisTop: '#e0f2fe',
      irisBot: crystalCyan,
      outline: '#1e1b4b',
      isStunned,
      isHurt: hitF > 0 || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry: isBasAngry,
      side: 1,
      timeSec,
    });
    this._drawKawaiiBlush(ctx, r * 0.08, r * 0.22, r * 0.16, r * 0.09, scale, 'rgba(244, 114, 182, 0.68)');
    this._drawKawaiiBlush(ctx, r * 0.84, r * 0.18, r * 0.10, r * 0.07, scale, 'rgba(244, 114, 182, 0.58)');
    this._drawKawaiiMouth(ctx, r * 0.54, r * 0.20, r * 0.11, scale, {
      outline: '#1e1b4b',
      isOpen: isBasAngry,
      isStunned,
      fangs: !isBasAngry,
      glowColor: '#f472b6',
    });

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

    // 3. Plump Chibi Miyazaki/Kirby Ghost-Submarine Pressure Hull!
    const hullG = ctx.createRadialGradient(r * 0.15, -r * 0.34, r * 0.1, 0, 0, r * 1.38);
    hullG.addColorStop(0, hitF > 0 ? '#ffffff' : '#5eead4');
    hullG.addColorStop(0.32, hullTop);
    hullG.addColorStop(0.75, hullMid);
    hullG.addColorStop(1, hullDark);
    ctx.fillStyle = hullG;
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(2.6, 0.11 * scale);
    ctx.beginPath();
    ctx.ellipse(0, 0.04 * r, r * 1.20, r * 0.76, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Soft mint-teal belly sheen & glossy anime jelly-bean hull highlight
    ctx.fillStyle = 'rgba(204, 251, 241, 0.22)';
    ctx.beginPath();
    ctx.ellipse(r * 0.16, r * 0.38, r * 0.72, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    this._drawKawaiiShine(ctx, -r * 0.32, -r * 0.36, r * 0.34, r * 0.12, -0.22);

    // Cute glowing spectral gill-porthole buttons along flank
    const pulse = 0.6 + 0.4 * Math.sin(timeSec * 5.8);
    ctx.fillStyle = ghostGlow;
    ctx.globalAlpha = 0.78 + pulse * 0.2;
    for (let v = 0; v < 3; v++) {
      const vx = -r * (0.34 + v * 0.26);
      ctx.beginPath();
      ctx.arc(vx, r * 0.04, r * 0.095, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Cute stubby fluttering pectoral dive-fin
    ctx.save();
    ctx.translate(r * 0.02, r * 0.42);
    ctx.rotate(Math.sin(timeSec * 5.2) * 0.28);
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(1.8, 0.07 * scale);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.32, r * 0.14, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

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

    // 5. GIANT Sparkling Spectral-Mint Chibi Anime Porthole Eyes (3/4 pair!) + Rosy Blush + Cute `:3` Smile!
    const isSubAngry = boss.phase >= 3 || boss.aiState === 'lunge_dash' || boss.aiState === 'beam_sweep';
    // Steel porthole bezel around near eye
    ctx.fillStyle = '#64748b';
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = Math.max(1.8, 0.07 * scale);
    ctx.beginPath();
    ctx.ellipse(r * 0.36, -r * 0.06, r * 0.26, r * 0.29, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    this._drawKawaiiAnimeEye(ctx, r * 0.36, -r * 0.06, r * 0.21, r * 0.25, scale, {
      irisTop: '#ccfbf1',
      irisBot: ghostGlow,
      outline: '#041021',
      isStunned,
      isHurt: hitF > 0 || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry: isSubAngry,
      side: 0,
      timeSec,
    });
    this._drawKawaiiAnimeEye(ctx, r * 0.88, -r * 0.08, r * 0.15, r * 0.20, scale, {
      irisTop: '#ccfbf1',
      irisBot: ghostGlow,
      outline: '#041021',
      isStunned,
      isHurt: hitF > 0 || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry: isSubAngry,
      side: 1,
      timeSec,
    });
    this._drawKawaiiBlush(ctx, r * 0.18, r * 0.22, r * 0.15, r * 0.085, scale, 'rgba(251, 113, 133, 0.65)');
    this._drawKawaiiBlush(ctx, r * 0.96, r * 0.18, r * 0.10, r * 0.065, scale, 'rgba(251, 113, 133, 0.56)');
    this._drawKawaiiMouth(ctx, r * 0.64, r * 0.22, r * 0.12, scale, {
      outline: ghostGlow,
      isOpen: isSubAngry,
      isStunned,
      glowColor: '#5eead4',
    });

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

    // 2. Cute Floating Rounded Sun-Golem Mitten Hands
    const armLift = (st === 'slam_windup' || st === 'lunge_windup') ? -0.28 * r : Math.sin(timeSec * 3.0) * 0.12 * r;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * r * 0.96, r * 0.04 + armLift * (side > 0 ? 1 : -0.7));
      ctx.rotate(side * 0.22);
      ctx.fillStyle = flash ? '#ffffff' : '#0d9488';
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = Math.max(2.0, 0.08 * scale);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.28, r * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = Math.max(1.6, 0.06 * scale);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = runeGlow;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Plump Rounded Chibi Orichalcum Sun-Golem Body & Bouncy Sun-Crown!
    const colG = ctx.createRadialGradient(-r * 0.20, -r * 0.32, r * 0.1, 0, 0, r * 1.12);
    colG.addColorStop(0, flash ? '#ffffff' : '#fde047');
    colG.addColorStop(0.45, flash ? '#fef9c3' : '#d97706');
    colG.addColorStop(1, '#78350f');
    ctx.fillStyle = colG;
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = Math.max(2.4, 0.095 * scale);
    ctx.beginPath();
    ctx.ellipse(0, 0.02 * r, r * 0.84, r * 0.86, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rounded inlaid turquoise-teal face shield
    ctx.fillStyle = flash ? '#ffffff' : '#0d9488';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(1.8, 0.07 * scale);
    ctx.beginPath();
    ctx.ellipse(r * 0.06, 0.04 * r, r * 0.62, r * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    this._drawKawaiiShine(ctx, -r * 0.24, -r * 0.44, r * 0.24, r * 0.10, -0.35);

    // Cute bouncy golden sun-crest crown spires on top
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = Math.max(1.6, 0.065 * scale);
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(k * r * 0.28 - r * 0.10, -r * 0.76);
      ctx.lineTo(k * r * 0.34, -r * (k === 0 ? 1.24 : 1.06));
      ctx.lineTo(k * r * 0.28 + r * 0.10, -r * 0.76);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(k * r * 0.34, -r * (k === 0 ? 1.24 : 1.06), Math.max(1.8, 0.06 * r), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde047';
    }

    // 4. GIANT Sparkling Twin Turquoise-Gold Chibi Anime Eyes + Rosy Blush + Cute `:3` Rune Smile!
    const isColAngry = boss.phase >= 3 || st === 'slam_windup' || st === 'beam_sweep' || st === 'lunge_dash';
    this._drawKawaiiAnimeEye(ctx, -r * 0.16, -r * 0.04, r * 0.19, r * 0.23, scale, {
      irisTop: '#fef9c3',
      irisBot: runeGlow,
      outline: '#1c1917',
      isStunned,
      isHurt: flash || boss.defeated,
      isDormant: st === 'dormant',
      isAngry: isColAngry,
      side: 0,
      timeSec,
    });
    this._drawKawaiiAnimeEye(ctx, r * 0.32, -r * 0.04, r * 0.17, r * 0.22, scale, {
      irisTop: '#fef9c3',
      irisBot: runeGlow,
      outline: '#1c1917',
      isStunned,
      isHurt: flash || boss.defeated,
      isDormant: st === 'dormant',
      isAngry: isColAngry,
      side: 1,
      timeSec,
    });
    this._drawKawaiiBlush(ctx, -r * 0.32, r * 0.22, r * 0.13, r * 0.08, scale, 'rgba(251, 113, 133, 0.68)');
    this._drawKawaiiBlush(ctx, r * 0.44, r * 0.22, r * 0.12, r * 0.075, scale, 'rgba(251, 113, 133, 0.65)');
    this._drawKawaiiMouth(ctx, r * 0.08, r * 0.24, r * 0.11, scale, {
      outline: '#fde047',
      isOpen: isColAngry,
      isStunned,
      glowColor: '#fef08a',
    });

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

    // 2. Plump Rounded Chibi Iron-Mole Head Chassis + Glossy Dome Shine
    const drillHeadG = ctx.createRadialGradient(-r * 0.12, -r * 0.30, r * 0.1, -r * 0.04, 0, r * 0.92);
    drillHeadG.addColorStop(0, flash ? '#ffffff' : '#94a3b8');
    drillHeadG.addColorStop(0.55, flash ? '#fef08a' : '#475569');
    drillHeadG.addColorStop(1, '#1e293b');
    ctx.fillStyle = drillHeadG;
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = Math.max(2.4, 0.095 * scale);
    ctx.beginPath();
    ctx.ellipse(-r * 0.04, 0, r * 0.72, r * 0.76, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    this._drawKawaiiShine(ctx, -r * 0.24, -r * 0.44, r * 0.24, r * 0.10, -0.32);

    // Cute golden mining collar band
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = Math.max(1.6, 0.065 * scale);
    ctx.beginPath();
    ctx.ellipse(r * 0.60, 0, r * 0.13, r * 0.54, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 3. Shiny Spinning Candy-Striped Tungsten Bore-Head Nose Cone
    const drillSpin = (timeSec * (st === 'lunge_dash' ? 24 : 11)) % 1;
    ctx.fillStyle = flash ? '#ffffff' : '#cbd5e1';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = Math.max(2.2, 0.085 * scale);
    ctx.beginPath();
    ctx.moveTo(r * 0.62, -r * 0.48);
    ctx.quadraticCurveTo(r * 1.18, -r * 0.26, r * 1.48, 0);
    ctx.quadraticCurveTo(r * 1.18, r * 0.26, r * 0.62, r * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = Math.max(1.8, 0.075 * scale);
    for (let f = 0; f < 4; f++) {
      const u = ((f / 4) + drillSpin) % 1;
      const fx = r * (0.64 + u * 0.76);
      const halfH = r * 0.42 * (1 - u);
      ctx.beginPath();
      ctx.moveTo(fx - r * 0.07, -halfH);
      ctx.lineTo(fx + r * 0.07, halfH);
      ctx.stroke();
    }

    // 4. GIANT Sparkling Miner-Headlamp Chibi Anime Eyes (3/4 pair!) + Rosy Blush + Cute `:3` Smile!
    const isDrillAngry = boss.phase >= 3 || st === 'lunge_dash' || st === 'lunge_windup';
    this._drawKawaiiAnimeEye(ctx, -r * 0.18, -r * 0.08, r * 0.20, r * 0.24, scale, {
      irisTop: '#fef9c3',
      irisBot: furnaceCol,
      outline: '#020617',
      isStunned,
      isHurt: flash || boss.defeated,
      isDormant: st === 'dormant',
      isAngry: isDrillAngry,
      side: 0,
      timeSec,
    });
    this._drawKawaiiAnimeEye(ctx, r * 0.30, -r * 0.10, r * 0.15, r * 0.20, scale, {
      irisTop: '#fef9c3',
      irisBot: furnaceCol,
      outline: '#020617',
      isStunned,
      isHurt: flash || boss.defeated,
      isDormant: st === 'dormant',
      isAngry: isDrillAngry,
      side: 1,
      timeSec,
    });
    this._drawKawaiiBlush(ctx, -r * 0.34, r * 0.20, r * 0.14, r * 0.08, scale, 'rgba(251, 113, 133, 0.68)');
    this._drawKawaiiBlush(ctx, r * 0.36, r * 0.18, r * 0.10, r * 0.065, scale, 'rgba(251, 113, 133, 0.58)');
    this._drawKawaiiMouth(ctx, r * 0.08, r * 0.22, r * 0.11, scale, {
      outline: '#fde047',
      isOpen: isDrillAngry,
      isStunned,
      glowColor: '#fb923c',
    });

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

    // Plump Chibi Jade Dragon Head & Glossy Forehead Shine!
    const dragHeadG = ctx.createRadialGradient(r * 0.18, -r * 0.26, r * 0.08, r * 0.20, 0, r * 0.94);
    dragHeadG.addColorStop(0, flash ? '#ffffff' : '#99f6e4');
    dragHeadG.addColorStop(0.52, flash ? '#ffffff' : jadeLight);
    dragHeadG.addColorStop(1, jadeMain);
    ctx.fillStyle = dragHeadG;
    ctx.strokeStyle = '#022c22';
    ctx.lineWidth = Math.max(2.2, 0.088 * scale);
    ctx.beginPath();
    ctx.ellipse(r * 0.26, -r * 0.02, r * 0.76, r * 0.58, -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    this._drawKawaiiShine(ctx, r * 0.02, -r * 0.34, r * 0.22, r * 0.09, -0.25);

    // Flowing Golden Dragon Whiskers
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(1.5, 0.055 * scale);
    const wWave = Math.sin(timeSec * 4.4) * r * 0.22;
    ctx.beginPath();
    ctx.moveTo(r * 0.84, r * 0.12);
    ctx.quadraticCurveTo(r * 1.24, r * 0.28 + wWave, r * 1.54, r * 0.06 - wWave);
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

    // GIANT Sparkling Golden-Jade Chibi Dragon Eyes (3/4 pair!) + Rosy Blush + Cute `:3` Smile!
    this._drawKawaiiAnimeEye(ctx, r * 0.26, -r * 0.06, r * 0.20, r * 0.24, scale, {
      irisTop: '#fef08a',
      irisBot: '#f59e0b',
      outline: '#022c22',
      isStunned,
      isHurt: flash || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry,
      side: 0,
      timeSec,
    });
    this._drawKawaiiAnimeEye(ctx, r * 0.76, -r * 0.08, r * 0.14, r * 0.19, scale, {
      irisTop: '#fef08a',
      irisBot: '#f59e0b',
      outline: '#022c22',
      isStunned,
      isHurt: flash || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry,
      side: 1,
      timeSec,
    });
    this._drawKawaiiBlush(ctx, r * 0.08, r * 0.20, r * 0.15, r * 0.085, scale, 'rgba(251, 113, 133, 0.68)');
    this._drawKawaiiBlush(ctx, r * 0.84, r * 0.16, r * 0.09, r * 0.065, scale, 'rgba(251, 113, 133, 0.58)');
    this._drawKawaiiMouth(ctx, r * 0.54, r * 0.20, r * 0.10, scale, {
      outline: '#022c22',
      isOpen: isAngry,
      isStunned,
      fangs: !isAngry,
      glowColor: '#fda4af',
    });

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

    // 3. Plump Chibi Ghost-Battleship Hull & Rounded Cozy Bow!
    const shipG = ctx.createRadialGradient(r * 0.2, -r * 0.25, r * 0.1, 0, r * 0.05, r * 1.6);
    shipG.addColorStop(0, flash ? '#ffffff' : '#64748b');
    shipG.addColorStop(0.55, flash ? '#e2e8f0' : '#334155');
    shipG.addColorStop(1, '#0f172a');
    ctx.fillStyle = shipG;
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = Math.max(2.4, 0.095 * scale);
    ctx.beginPath();
    ctx.moveTo(r * 1.48, r * 0.04);
    ctx.quadraticCurveTo(r * 1.32, -r * 0.48, r * 0.62, -r * 0.44);
    ctx.lineTo(-r * 1.05, -r * 0.42);
    ctx.quadraticCurveTo(-r * 1.52, -r * 0.28, -r * 1.48, r * 0.16);
    ctx.quadraticCurveTo(-r * 1.38, r * 0.64, -r * 0.72, r * 0.62);
    ctx.lineTo(r * 0.88, r * 0.62);
    ctx.quadraticCurveTo(r * 1.48, r * 0.52, r * 1.48, r * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Spectral Emerald Armor Belt & Cute Portholes
    ctx.fillStyle = ghostGlow;
    ctx.beginPath();
    ctx.ellipse(-r * 0.48, r * 0.28, r * 0.76, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let p = -3; p <= -1; p++) {
      ctx.beginPath();
      ctx.arc(p * r * 0.34, -r * 0.06, r * 0.085, 0, Math.PI * 2);
      ctx.fill();
    }
    this._drawKawaiiShine(ctx, -r * 0.48, -r * 0.24, r * 0.36, r * 0.09, -0.08);

    // 4. Cozy Rounded Bridge Cabin, Cute Mini Turrets & Jaunty Glowing Admiral's Crown-Hat!
    ctx.fillStyle = flash ? '#ffffff' : '#475569';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = Math.max(2.0, 0.08 * scale);
    ctx.beginPath();
    ctx.ellipse(-r * 0.08, -r * 0.68, r * 0.44, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    this._drawKawaiiShine(ctx, -r * 0.22, -r * 0.84, r * 0.16, r * 0.07, -0.25);

    // Jaunty Bouncy Golden Admiral's Cap perched atop the bridge!
    ctx.save();
    ctx.translate(-r * 0.04, -r * 1.02 + Math.sin(timeSec * 3.4) * 0.04 * r);
    ctx.rotate(0.12);
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(1.6, 0.065 * scale);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.08, r * 0.36, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(0, -r * 0.08, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Cute mini twin-barrel chibi turrets fore & aft
    for (const tx of [r * 0.64, -r * 0.82]) {
      const dir = tx > 0 ? 1 : -1;
      ctx.fillStyle = '#64748b';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = Math.max(1.8, 0.07 * scale);
      ctx.beginPath();
      ctx.arc(tx, -r * 0.44, r * 0.22, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(1.8, 0.07 * scale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, -r * 0.54);
      ctx.lineTo(tx + dir * r * 0.42, -r * 0.64);
      ctx.stroke();
    }

    // 5. GIANT Sparkling Seafoam-Emerald Chibi Anime Eyes on the Bow (3/4 pair!) + Rosy Blush + Cute `:3` Smile!
    this._drawKawaiiAnimeEye(ctx, r * 0.48, -r * 0.04, r * 0.21, r * 0.25, scale, {
      irisTop: '#a7f3d0',
      irisBot: ghostGlow,
      outline: '#020617',
      isStunned,
      isHurt: flash || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry,
      side: 0,
      timeSec,
    });
    this._drawKawaiiAnimeEye(ctx, r * 1.04, -r * 0.06, r * 0.15, r * 0.20, scale, {
      irisTop: '#a7f3d0',
      irisBot: ghostGlow,
      outline: '#020617',
      isStunned,
      isHurt: flash || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry,
      side: 1,
      timeSec,
    });
    this._drawKawaiiBlush(ctx, r * 0.30, r * 0.24, r * 0.15, r * 0.085, scale, 'rgba(251, 113, 133, 0.65)');
    this._drawKawaiiBlush(ctx, r * 1.12, r * 0.20, r * 0.10, r * 0.065, scale, 'rgba(251, 113, 133, 0.55)');
    this._drawKawaiiMouth(ctx, r * 0.78, r * 0.24, r * 0.12, scale, {
      outline: ghostGlow,
      isOpen: isAngry,
      isStunned,
      glowColor: '#6ee7b7',
    });

    ctx.restore();
    this._drawBossStatusEmotes(ctx, boss, sx, sy, r, floatBobY, scale, timeSec);
  },

  /**
   * BOREALIS KING CRAB — Colossal Glacial Arctic King Crab Guardian (Scoresby Sund) (v265).
   */
  _drawFrostCrabBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(boss.x);
    const sy = toScreenY(boss.y);
    const r = boss.radius * scale;
    const anim = boss.anim || {};
    const isStunned = boss.aiState === 'stunned';
    const isHurt = boss.hitFlash > 0;
    const isAngry = boss.phase >= 3 || boss.aiState.includes('windup') || boss.aiState === 'lunge_dash' || boss.aiState === 'beam_sweep';
    const floatBobY = Math.sin(timeSec * 2.5) * 0.14 * r;
    const snapAmt = (isAngry ? 0.42 : 0.16) + 0.14 * Math.abs(Math.sin(timeSec * (isAngry ? 7.5 : 2.8)));
    const outline = '#082f49';
    const shellHi = isHurt ? '#ffffff' : boss.phase >= 3 ? '#fda4af' : '#bae6fd';
    const shellMid = isHurt ? '#e0f2fe' : boss.phase >= 3 ? '#e11d48' : boss.phase === 2 ? '#0284c7' : '#0ea5e9';
    const shellDark = isHurt ? '#bae6fd' : boss.phase >= 3 ? '#881337' : '#0c4a6e';
    const glowCol = boss.phase >= 3 ? '#fb7185' : boss.phase === 2 ? '#c084fc' : '#67e8f9';

    ctx.save();
    ctx.translate(sx, sy + floatBobY);
    ctx.scale(anim.squashX || 1, anim.squashY || 1);
    ctx.rotate(Math.sin(timeSec * 1.9) * 0.05);

    // 1. Soft Glacial Halo
    const aura = ctx.createRadialGradient(0, 0, r * 0.25, 0, 0, r * 1.85);
    aura.addColorStop(0, boss.phase >= 3 ? 'rgba(251, 113, 133, 0.34)' : 'rgba(103, 232, 249, 0.32)');
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.85, 0, Math.PI * 2);
    ctx.fill();

    // 2. Six Articulated Jointed Crab Legs (3 per side)
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const gait = Math.sin(timeSec * (isAngry ? 7.0 : 3.4) + i * 1.3 + (side > 0 ? Math.PI : 0)) * 0.14;
        const bx = side * r * (0.72 + i * 0.05);
        const by = r * (-0.02 + i * 0.24);
        const kx = side * r * (1.28 + i * 0.08);
        const ky = r * (-0.12 + i * 0.28 + gait);
        const tx = side * r * (1.58 - i * 0.06);
        const ty = r * (0.36 + i * 0.30 + gait * 1.3);

        ctx.strokeStyle = outline;
        ctx.lineWidth = Math.max(4.5, 0.24 * r);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(kx, ky);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        ctx.strokeStyle = shellMid;
        ctx.lineWidth = Math.max(2.6, 0.14 * r);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(kx, ky);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        ctx.fillStyle = shellHi;
        ctx.beginPath();
        ctx.arc(kx, ky, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Twin Colossal Snapping Glacier Pincer Claws
    for (const side of [-1, 1]) {
      ctx.save();
      const armWave = Math.sin(timeSec * (isAngry ? 6.2 : 2.6) + side) * 0.10;
      const shoulderX = side * r * 0.64;
      const shoulderY = -r * 0.22;
      const elbowX = side * r * 1.16;
      const elbowY = -r * 0.56 + armWave * r;
      const clawX = side * r * 0.94;
      const clawY = -r * 0.96 + armWave * r * 1.2;

      // Upper pincer arm
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(5.5, 0.30 * r);
      ctx.beginPath();
      ctx.moveTo(shoulderX, shoulderY);
      ctx.quadraticCurveTo(elbowX, elbowY, clawX, clawY);
      ctx.stroke();
      ctx.strokeStyle = shellMid;
      ctx.lineWidth = Math.max(3.2, 0.18 * r);
      ctx.stroke();

      // Massive snapping claw head (outer shell + articulating inner thumb)
      ctx.translate(clawX, clawY);
      ctx.scale(side, 1);
      ctx.rotate(-0.42 + armWave * 0.7);
      const cg = ctx.createLinearGradient(-r * 0.2, -r * 0.4, r * 0.4, r * 0.3);
      cg.addColorStop(0, shellHi);
      cg.addColorStop(0.5, shellMid);
      cg.addColorStop(1, shellDark);

      // Outer massive curved crusher claw (iconic crab crescent!)
      ctx.save();
      ctx.rotate(-snapAmt * 0.42);
      ctx.fillStyle = cg;
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(2.0, 0.08 * scale);
      ctx.beginPath();
      ctx.moveTo(0, r * 0.06);
      ctx.bezierCurveTo(-r * 0.46, -r * 0.08, -r * 0.50, -r * 0.66, -r * 0.04, -r * 0.74);
      ctx.quadraticCurveTo(-r * 0.14, -r * 0.44, r * 0.02, -r * 0.24);
      ctx.quadraticCurveTo(r * 0.16, -r * 0.10, 0, r * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Inner serrated snapping thumb jaw (creates bold V-notch crab pincer!)
      ctx.save();
      ctx.rotate(snapAmt * 0.50);
      ctx.fillStyle = shellHi;
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(1.8, 0.075 * scale);
      ctx.beginPath();
      ctx.moveTo(r * 0.02, 0);
      ctx.bezierCurveTo(r * 0.36, -r * 0.06, r * 0.42, -r * 0.48, r * 0.14, -r * 0.62);
      ctx.quadraticCurveTo(r * 0.16, -r * 0.32, -r * 0.04, -r * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.restore();
    }

    // 4. Plump Squishy Mochi-Chibi King Crab Carapace + Glossy Ice Shine + Bouncy Frost Crown!
    const bodyGrad = ctx.createRadialGradient(-r * 0.22, -r * 0.34, r * 0.1, 0, 0, r * 1.15);
    bodyGrad.addColorStop(0, shellHi);
    bodyGrad.addColorStop(0.55, shellMid);
    bodyGrad.addColorStop(1, shellDark);
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2.6, 0.10 * scale);
    ctx.beginPath();
    ctx.ellipse(0, 0.04 * r, r * 0.96, r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Soft pastel icy belly patch + glossy anime jelly-bean dome shine!
    ctx.fillStyle = 'rgba(224, 242, 254, 0.38)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.38, r * 0.56, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    this._drawKawaiiShine(ctx, -r * 0.34, -r * 0.38, r * 0.26, r * 0.11, -0.35);

    // Cute Bouncy Crystalline Ice King Crown perched atop the crab dome!
    ctx.save();
    ctx.translate(0, -r * 0.70 + Math.sin(timeSec * 3.5) * 0.04 * r);
    const cw = r * 0.36;
    const ch = r * 0.26;
    ctx.fillStyle = '#e0f2fe';
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(1.6, 0.065 * scale);
    ctx.beginPath();
    ctx.moveTo(-cw, ch * 0.35);
    ctx.lineTo(-cw * 0.85, -ch * 0.70);
    ctx.lineTo(-cw * 0.28, -ch * 0.10);
    ctx.lineTo(0, -ch);
    ctx.lineTo(cw * 0.28, -ch * 0.10);
    ctx.lineTo(cw * 0.85, -ch * 0.70);
    ctx.lineTo(cw, ch * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = glowCol;
    for (const [gx, gy] of [[-cw * 0.85, -ch * 0.75], [0, -ch * 1.05], [cw * 0.85, -ch * 0.75]]) {
      ctx.beginPath();
      ctx.arc(gx, gy, Math.max(1.8, 0.06 * r), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 5. GIANT Sparkling Kawaii Anime Crab Eyes + Rosy Frost-Pink Blush + Adorable `:3` Smile!
    for (const side of [-1, 1]) {
      this._drawKawaiiAnimeEye(ctx, side * r * 0.34, -r * 0.10, r * 0.21, r * 0.25, scale, {
        irisTop: '#e0f2fe',
        irisBot: glowCol,
        outline,
        isStunned,
        isHurt: isHurt || boss.defeated,
        isDormant: boss.aiState === 'dormant',
        isAngry,
        side: side < 0 ? 0 : 1,
        timeSec,
      });
      this._drawKawaiiBlush(ctx, side * r * 0.56, r * 0.16, r * 0.16, r * 0.09, scale, 'rgba(251, 113, 133, 0.65)');
    }
    this._drawKawaiiMouth(ctx, 0, r * 0.18, r * 0.13, scale, {
      outline,
      isOpen: isAngry,
      isStunned,
      glowColor: '#fda4af',
    });

    ctx.restore();
    this._drawBossStatusEmotes(ctx, boss, sx, sy, r, floatBobY, scale, timeSec);
  },

  /**
   * SOLAR REEF LOBSTER — Colossal Radiant Red Sea Reef Lobster Guardian (Blue Hole & The Arch) (v265).
   */
  _drawSolarLobsterBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(boss.x);
    const sy = toScreenY(boss.y);
    const r = boss.radius * scale;
    const anim = boss.anim || {};
    const facing = (anim.facing ?? -1) < 0 ? -1 : 1;
    const isStunned = boss.aiState === 'stunned';
    const isHurt = boss.hitFlash > 0;
    const isAngry = boss.phase >= 3 || boss.aiState.includes('windup') || boss.aiState === 'lunge_dash' || boss.aiState === 'beam_sweep';
    const floatBobY = Math.sin(timeSec * 2.4) * 0.15 * r;
    const snap = (isAngry ? 0.40 : 0.14) + 0.14 * Math.abs(Math.sin(timeSec * (isAngry ? 7.2 : 2.7)));
    const outline = '#450a0a';
    const shellHi = isHurt ? '#ffffff' : '#fde047';
    const shellRed = isHurt ? '#fecaca' : boss.phase >= 3 ? '#f43f5e' : '#ef4444';
    const shellDeep = isHurt ? '#fca5a5' : boss.phase >= 3 ? '#881337' : '#991b1b';
    const goldAccent = '#facc15';

    ctx.save();
    ctx.translate(sx, sy + floatBobY);
    ctx.scale(facing * (anim.squashX || 1), anim.squashY || 1);
    ctx.rotate(Math.sin(timeSec * 2.1) * 0.045);

    // 1. Radiant Caustic Solar Aura
    const aura = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.85);
    aura.addColorStop(0, 'rgba(250, 204, 21, 0.34)');
    aura.addColorStop(0.55, 'rgba(239, 68, 68, 0.18)');
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.85, 0, Math.PI * 2);
    ctx.fill();

    // 2. Long Sweeping Golden Lobster Antennae
    ctx.strokeStyle = goldAccent;
    ctx.lineCap = 'round';
    for (let a = 0; a < 2; a++) {
      const wave = Math.sin(timeSec * 3.6 + a * 1.4) * 0.22 * r;
      ctx.lineWidth = Math.max(1.8, (0.075 - a * 0.015) * scale);
      ctx.beginPath();
      ctx.moveTo(r * 0.78, -r * (0.24 - a * 0.10));
      ctx.bezierCurveTo(r * 1.35, -r * (0.78 - a * 0.18) + wave, r * 1.85, -r * (0.95 - a * 0.25) - wave, r * 2.18, -r * (0.58 - a * 0.22) + wave);
      ctx.stroke();
    }

    // 3. Segmented Overlapping Lobster Abdomen & Fanning Tail Telson
    const tailWag = Math.sin(timeSec * (isAngry ? 6.5 : 3.2)) * 0.18;
    ctx.save();
    ctx.translate(-r * 0.42, r * 0.04);
    ctx.rotate(tailWag);
    for (let seg = 0; seg < 4; seg++) {
      const sxSeg = -seg * r * 0.24;
      const sySeg = seg * r * 0.05;
      const sw = r * (0.34 - seg * 0.045);
      const sh = r * (0.38 - seg * 0.055);
      const sg = ctx.createLinearGradient(sxSeg, sySeg - sh, sxSeg, sySeg + sh);
      sg.addColorStop(0, shellHi);
      sg.addColorStop(0.35, shellRed);
      sg.addColorStop(1, shellDeep);
      ctx.fillStyle = sg;
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(1.8, 0.075 * scale);
      ctx.beginPath();
      ctx.ellipse(sxSeg, sySeg, sw, sh, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Gold plate trim
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.65)';
      ctx.lineWidth = Math.max(1.1, 0.04 * scale);
      ctx.beginPath();
      ctx.arc(sxSeg, sySeg, sh * 0.72, -1.2, 1.2);
      ctx.stroke();
    }
    // Broad 3-blade Tail Fan
    const fx = -r * 1.06;
    const fy = r * 0.20;
    for (let blade = -1; blade <= 1; blade++) {
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(blade * 0.42 + tailWag * 0.4);
      ctx.fillStyle = blade === 0 ? goldAccent : shellRed;
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(1.6, 0.065 * scale);
      ctx.beginPath();
      ctx.ellipse(-r * 0.28, 0, r * 0.34, r * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // 4. Four Animated Walking Legs underneath the Thorax
    ctx.lineCap = 'round';
    for (let leg = 0; leg < 4; leg++) {
      const kick = Math.sin(timeSec * (isAngry ? 7.0 : 3.6) + leg * 1.1) * 0.14 * r;
      const lx = r * (0.38 - leg * 0.24);
      const ly = r * 0.32;
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(3.6, 0.16 * r);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + r * 0.12, ly + r * 0.32 + kick);
      ctx.lineTo(lx - r * 0.06, ly + r * 0.56 + kick * 1.2);
      ctx.stroke();
      ctx.strokeStyle = shellRed;
      ctx.lineWidth = Math.max(2.0, 0.09 * r);
      ctx.stroke();
    }

    // 5. Armored Lobster Carapace (Cephalothorax)
    const cg = ctx.createLinearGradient(0, -r * 0.6, 0, r * 0.5);
    cg.addColorStop(0, shellHi);
    cg.addColorStop(0.32, shellRed);
    cg.addColorStop(1, shellDeep);
    ctx.fillStyle = cg;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2.4, 0.095 * scale);
    ctx.beginPath();
    ctx.moveTo(-r * 0.52, -r * 0.36);
    ctx.bezierCurveTo(r * 0.15, -r * 0.62, r * 0.72, -r * 0.44, r * 0.96, -r * 0.12); // Sharp rostrum horn
    ctx.quadraticCurveTo(r * 0.76, r * 0.42, -r * 0.46, r * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Radiant dorsal crest highlight
    ctx.strokeStyle = goldAccent;
    ctx.lineWidth = Math.max(1.8, 0.07 * scale);
    ctx.beginPath();
    ctx.moveTo(-r * 0.38, -r * 0.28);
    ctx.quadraticCurveTo(r * 0.22, -r * 0.46, r * 0.78, -r * 0.16);
    ctx.stroke();

    // 6. Colossal Forward Crusher & Ripper Lobster Claws
    for (let c = 0; c < 2; c++) {
      ctx.save();
      const isTop = c === 0;
      const cy = isTop ? -r * 0.26 : r * 0.24;
      const cx = r * (isTop ? 0.88 : 0.96);
      const bob = Math.sin(timeSec * 3.4 + c * 2.0) * 0.08 * r;
      ctx.translate(cx, cy + bob);
      ctx.rotate((isTop ? -0.22 : 0.24) + bob * 0.01);

      // Claw arm link
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(4.8, 0.24 * r);
      ctx.beginPath();
      ctx.moveTo(-r * 0.36, isTop ? r * 0.18 : -r * 0.12);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.strokeStyle = shellRed;
      ctx.lineWidth = Math.max(2.6, 0.13 * r);
      ctx.stroke();

      // Main massive palm + upper pincer blade
      const clGrad = ctx.createLinearGradient(0, -r * 0.3, r * 0.9, r * 0.3);
      clGrad.addColorStop(0, shellRed);
      clGrad.addColorStop(0.7, shellHi);
      clGrad.addColorStop(1, '#ffffff');
      ctx.save();
      ctx.rotate(-snap * 0.38);
      ctx.fillStyle = clGrad;
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(2.0, 0.08 * scale);
      ctx.beginPath();
      ctx.moveTo(-r * 0.08, 0);
      ctx.bezierCurveTo(r * 0.22, -r * 0.40, r * 0.78, -r * 0.34, r * 0.96, -r * 0.04);
      ctx.quadraticCurveTo(r * 0.48, -r * 0.02, -r * 0.08, r * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Articulating lower serrated claw blade
      ctx.save();
      ctx.rotate(snap * 0.42);
      ctx.fillStyle = shellDeep;
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(1.8, 0.075 * scale);
      ctx.beginPath();
      ctx.moveTo(-r * 0.05, r * 0.06);
      ctx.quadraticCurveTo(r * 0.48, r * 0.34, r * 0.84, r * 0.10);
      ctx.quadraticCurveTo(r * 0.42, r * 0.04, -r * 0.05, r * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.restore();
    }

    // 7. Glossy Carapace Highlight + GIANT Sparkling Golden-Amber Chibi Lobster Eyes (3/4 pair!) + Blush + `:3` Smile!
    this._drawKawaiiShine(ctx, -r * 0.06, -r * 0.34, r * 0.24, r * 0.09, -0.18);
    this._drawKawaiiAnimeEye(ctx, r * 0.34, -r * 0.20, r * 0.19, r * 0.23, scale, {
      irisTop: '#fef9c3',
      irisBot: goldAccent,
      outline,
      isStunned,
      isHurt: isHurt || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry,
      side: 0,
      timeSec,
    });
    this._drawKawaiiAnimeEye(ctx, r * 0.72, -r * 0.18, r * 0.14, r * 0.18, scale, {
      irisTop: '#fef9c3',
      irisBot: goldAccent,
      outline,
      isStunned,
      isHurt: isHurt || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry,
      side: 1,
      timeSec,
    });
    this._drawKawaiiBlush(ctx, r * 0.16, r * 0.06, r * 0.14, r * 0.08, scale, 'rgba(254, 202, 202, 0.72)');
    this._drawKawaiiBlush(ctx, r * 0.78, r * 0.04, r * 0.09, r * 0.06, scale, 'rgba(254, 202, 202, 0.62)');
    this._drawKawaiiMouth(ctx, r * 0.54, r * 0.08, r * 0.10, scale, {
      outline,
      isOpen: isAngry,
      isStunned,
      glowColor: '#fef08a',
    });

    ctx.restore();
    this._drawBossStatusEmotes(ctx, boss, sx, sy, r, floatBobY, scale, timeSec);
  },

  /**
   * VOLTAIC EMPEROR EEL — High-Voltage Brazilian Sinkhole Electric Eel Guardian (Lagoa Misteriosa) (v265).
   */
  _drawElectricEelBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(boss.x);
    const sy = toScreenY(boss.y);
    const r = boss.radius * scale;
    const anim = boss.anim || {};
    const facing = (anim.facing ?? -1) < 0 ? -1 : 1;
    const isStunned = boss.aiState === 'stunned';
    const isHurt = boss.hitFlash > 0;
    const isAngry = boss.phase >= 3 || boss.aiState.includes('windup') || boss.aiState === 'lunge_dash' || boss.aiState === 'beam_sweep';
    const floatBobY = Math.sin(timeSec * 2.8) * 0.14 * r;
    const outline = '#090d24';
    const bodyDark = isHurt ? '#e0f2fe' : '#1e293b';
    const bodyMid = isHurt ? '#ffffff' : boss.phase >= 3 ? '#1e1b4b' : '#1e3a8a';
    const voltGold = boss.phase >= 3 ? '#fb7185' : '#fde047';
    const voltCyan = '#38bdf8';

    ctx.save();
    ctx.translate(sx, sy + floatBobY);
    ctx.scale(facing * (anim.squashX || 1), anim.squashY || 1);

    // 1. Bio-Electric Plasma Halo
    const aura = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.95);
    aura.addColorStop(0, boss.phase >= 3 ? 'rgba(251, 113, 133, 0.34)' : 'rgba(250, 204, 21, 0.32)');
    aura.addColorStop(0.5, 'rgba(56, 189, 248, 0.18)');
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.95, 0, Math.PI * 2);
    ctx.fill();

    // 2. Sinuous Electric Eel Spine Points (11 smooth undulating segments from tail to head)
    const segCount = 11;
    const pts = [];
    const freq = isAngry ? 6.8 : 3.8;
    for (let i = 0; i < segCount; i++) {
      const u = i / (segCount - 1); // 0 = tail tip, 1 = head
      const px = (-1.65 + u * 2.65) * r;
      const amp = (1 - u * 0.65) * 0.42 * r;
      const py = Math.sin(timeSec * freq - u * 4.8) * amp;
      const thick = (0.10 + Math.sin(u * Math.PI * 0.85) * 0.34 + u * 0.08) * r;
      pts.push({ x: px, y: py, t: thick });
    }

    // Continuous Translucent Rippling Ventral Ribbon Fin along underside
    ctx.fillStyle = 'rgba(56, 189, 248, 0.38)';
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.72)';
    ctx.lineWidth = Math.max(1.4, 0.055 * scale);
    ctx.beginPath();
    for (let i = 0; i < segCount - 1; i++) {
      const p = pts[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y + p.t * 0.7);
    }
    for (let i = segCount - 2; i >= 0; i--) {
      const p = pts[i];
      const ripple = Math.sin(timeSec * 9.5 + i * 1.2) * 0.10 * r;
      ctx.lineTo(p.x, p.y + p.t * 1.48 + ripple);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sculpted Eel Torso Outline & Gradient Fill
    ctx.beginPath();
    for (let i = 0; i < segCount; i++) {
      const p = pts[i];
      if (i === 0) ctx.moveTo(p.x, p.y - p.t * 0.5);
      else ctx.lineTo(p.x, p.y - p.t);
    }
    const head = pts[segCount - 1];
    ctx.quadraticCurveTo(head.x + r * 0.44, head.y - r * 0.14, head.x + r * 0.34, head.y + r * 0.24);
    for (let i = segCount - 1; i >= 0; i--) {
      const p = pts[i];
      ctx.lineTo(p.x, p.y + p.t * 0.92);
    }
    ctx.closePath();
    const bg = ctx.createLinearGradient(0, -r * 0.6, 0, r * 0.6);
    bg.addColorStop(0, bodyDark);
    bg.addColorStop(0.55, bodyMid);
    bg.addColorStop(1, '#f59e0b'); // Iconic electric-eel golden-orange throat/belly!
    ctx.fillStyle = bg;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2.4, 0.095 * scale);
    ctx.fill();
    ctx.stroke();

    // 3. Pulsing Bio-Electric Lateral Organ Cells along the flank
    for (let i = 2; i < segCount - 1; i++) {
      const p = pts[i];
      const pulse = 0.55 + 0.45 * Math.sin(timeSec * (isAngry ? 14 : 6.5) - i * 0.9);
      ctx.fillStyle = i % 2 === 0 ? voltGold : voltCyan;
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.t * 0.48, p.t * 0.20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 4. Live Crackling Jagged Lightning Arcs along dorsal spine & tail!
    const arcCount = isAngry ? 3 : 2;
    for (let a = 0; a < arcCount; a++) {
      ctx.strokeStyle = a === 0 ? voltGold : a === 1 ? '#7dd3fc' : '#ffffff';
      ctx.lineWidth = Math.max(1.5, (a === 0 ? 0.085 : 0.055) * scale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < segCount; i++) {
        const p = pts[i];
        const jit = Math.sin(timeSec * 31 + i * 7.3 + a * 4.1) * (isAngry ? 0.36 : 0.24) * r;
        const ax = p.x;
        const ay = p.y - p.t * (0.98 + a * 0.24) + jit;
        if (i === 0) ctx.moveTo(ax, ay);
        else ctx.lineTo(ax, ay);
      }
      ctx.stroke();
    }

    // 5. Cute Plump Chibi Electric-Eel Head Overlay + GIANT Sparkling Storm-Gold Anime Eyes + Pikachu Blush + `:3` Grin!
    const eelHeadG = ctx.createRadialGradient(head.x - r * 0.06, head.y - r * 0.18, r * 0.06, head.x + r * 0.02, head.y, r * 0.60);
    eelHeadG.addColorStop(0, isHurt ? '#ffffff' : '#3b82f6');
    eelHeadG.addColorStop(0.58, bodyMid);
    eelHeadG.addColorStop(1, '#f59e0b');
    ctx.fillStyle = eelHeadG;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2.2, 0.09 * scale);
    ctx.beginPath();
    ctx.ellipse(head.x + r * 0.02, head.y + r * 0.02, r * 0.54, r * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    this._drawKawaiiShine(ctx, head.x - r * 0.12, head.y - r * 0.24, r * 0.18, r * 0.075, -0.25);

    this._drawKawaiiAnimeEye(ctx, head.x - r * 0.02, head.y - r * 0.06, r * 0.18, r * 0.22, scale, {
      irisTop: '#fef9c3',
      irisBot: voltGold,
      outline,
      isStunned,
      isHurt: isHurt || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry,
      side: 0,
      timeSec,
    });
    this._drawKawaiiAnimeEye(ctx, head.x + r * 0.38, head.y - r * 0.08, r * 0.13, r * 0.18, scale, {
      irisTop: '#fef9c3',
      irisBot: voltGold,
      outline,
      isStunned,
      isHurt: isHurt || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry,
      side: 1,
      timeSec,
    });
    this._drawKawaiiBlush(ctx, head.x - r * 0.16, head.y + r * 0.18, r * 0.14, r * 0.085, scale, 'rgba(251, 113, 133, 0.78)');
    this._drawKawaiiBlush(ctx, head.x + r * 0.44, head.y + r * 0.14, r * 0.09, r * 0.065, scale, 'rgba(251, 113, 133, 0.68)');
    this._drawKawaiiMouth(ctx, head.x + r * 0.20, head.y + r * 0.18, r * 0.10, scale, {
      outline: voltGold,
      isOpen: isAngry,
      isStunned,
      glowColor: '#fde047',
    });

    ctx.restore();
    this._drawBossStatusEmotes(ctx, boss, sx, sy, r, floatBobY, scale, timeSec);
  },

  /**
   * LOCH NESS LEVIATHAN — Ancient Highland Plesiosaur Guardian (Plura Marble Sump) (v265).
   */
  _drawLochNessBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(boss.x);
    const sy = toScreenY(boss.y);
    const r = boss.radius * scale;
    const anim = boss.anim || {};
    const facing = (anim.facing ?? -1) < 0 ? -1 : 1;
    const isStunned = boss.aiState === 'stunned';
    const isHurt = boss.hitFlash > 0;
    const isAngry = boss.phase >= 3 || boss.aiState.includes('windup') || boss.aiState === 'lunge_dash' || boss.aiState === 'beam_sweep';
    const floatBobY = Math.sin(timeSec * 2.1) * 0.16 * r;
    const strokePhase = timeSec * (isAngry ? 5.6 : 2.6);
    const outline = '#022c22';
    const hideTop = isHurt ? '#ffffff' : boss.phase >= 3 ? '#0f766e' : '#059669';
    const hideMid = isHurt ? '#d1fae5' : boss.phase >= 3 ? '#134e4a' : '#047857';
    const hideBelly = '#a7f3d0';
    const finGlow = boss.phase >= 3 ? '#fde047' : '#34d399';

    ctx.save();
    ctx.translate(sx, sy + floatBobY);
    ctx.scale(facing * (anim.squashX || 1), anim.squashY || 1);

    // 1. Misty Highland Emerald Aura
    const aura = ctx.createRadialGradient(0, 0, r * 0.25, 0, 0, r * 1.9);
    aura.addColorStop(0, 'rgba(52, 211, 153, 0.30)');
    aura.addColorStop(0.6, 'rgba(13, 148, 136, 0.14)');
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2);
    ctx.fill();

    // 2. Back Paddle Flippers (far side)
    for (let f = 0; f < 2; f++) {
      ctx.save();
      const fx = f === 0 ? r * 0.18 : -r * 0.44;
      const fy = r * 0.24;
      const flap = Math.sin(strokePhase + f * 1.5 + 0.8) * 0.38;
      ctx.translate(fx, fy);
      ctx.rotate(0.45 + flap);
      ctx.fillStyle = '#064e3b';
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(1.8, 0.075 * scale);
      ctx.beginPath();
      ctx.ellipse(-r * 0.12, r * 0.34, r * 0.18, r * 0.44, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 3. Long Tapering Aquatic Tail
    const tailWave = Math.sin(timeSec * (isAngry ? 5.2 : 2.5)) * 0.24 * r;
    ctx.fillStyle = hideMid;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2.2, 0.09 * scale);
    ctx.beginPath();
    ctx.moveTo(-r * 0.56, -r * 0.16);
    ctx.quadraticCurveTo(-r * 1.25, -r * 0.32 + tailWave * 0.6, -r * 1.82, -r * 0.06 + tailWave);
    ctx.quadraticCurveTo(-r * 1.22, r * 0.28 + tailWave * 0.5, -r * 0.52, r * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4. Iconic Domed Plesiosaur Body + Mossy Highland Dorsal Crest Spines
    const bodyGrad = ctx.createLinearGradient(0, -r * 0.65, 0, r * 0.48);
    bodyGrad.addColorStop(0, hideTop);
    bodyGrad.addColorStop(0.65, hideMid);
    bodyGrad.addColorStop(1, hideBelly);
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2.5, 0.10 * scale);
    ctx.beginPath();
    ctx.ellipse(-r * 0.12, r * 0.06, r * 0.72, r * 0.48, -0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glowing Loch-Kelp Dorsal Ridge Plates along the arched back
    ctx.fillStyle = finGlow;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(1.4, 0.055 * scale);
    for (let s = 0; s < 4; s++) {
      const sxSp = (-0.54 + s * 0.24) * r;
      const sySp = -r * (0.32 + Math.sin((s / 3) * Math.PI) * 0.14);
      ctx.beginPath();
      ctx.moveTo(sxSp - r * 0.09, sySp + r * 0.08);
      ctx.quadraticCurveTo(sxSp, sySp - r * 0.22, sxSp + r * 0.10, sySp + r * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Subtle Bioluminescent Highland Mist Spots along Flank
    ctx.fillStyle = 'rgba(167, 243, 208, 0.45)';
    for (let sp = 0; sp < 3; sp++) {
      ctx.beginPath();
      ctx.arc((-0.44 + sp * 0.28) * r, (0.04 - (sp % 2) * 0.10) * r, r * (0.085 - sp * 0.01), 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Graceful S-Curved Loch Ness Neck & Sculpted Plesiosaur Head
    const neckSway = Math.sin(timeSec * (isAngry ? 4.8 : 2.2)) * 0.12 * r;
    const hx = r * 0.92 + neckSway * 0.35;
    const hy = -r * 0.86 + neckSway * 0.45;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(6.2, 0.40 * r);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.36, -r * 0.04);
    ctx.bezierCurveTo(r * 0.68, -r * 0.10, r * 0.56, -r * 0.74, hx, hy);
    ctx.stroke();
    ctx.strokeStyle = hideTop;
    ctx.lineWidth = Math.max(4.0, 0.28 * r);
    ctx.stroke();
    // Pale cream-mint throat stripe up the front of the S-neck
    ctx.strokeStyle = hideBelly;
    ctx.lineWidth = Math.max(1.8, 0.09 * r);
    ctx.beginPath();
    ctx.moveTo(r * 0.42, r * 0.06);
    ctx.bezierCurveTo(r * 0.74, -r * 0.02, r * 0.64, -r * 0.68, hx + r * 0.04, hy + r * 0.06);
    ctx.stroke();

    // Plump Adorable Studio-Ghibli Chibi Plesiosaur Head + Glossy Shine + GIANT Sparkling Anime Eyes!
    this._drawKawaiiShine(ctx, -r * 0.24, -r * 0.18, r * 0.24, r * 0.09, -0.22);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(Math.sin(timeSec * 2.2) * 0.06 + (isAngry ? -0.14 : 0));
    const nessHeadG = ctx.createRadialGradient(r * 0.06, -r * 0.14, r * 0.05, r * 0.16, 0, r * 0.56);
    nessHeadG.addColorStop(0, isHurt ? '#ffffff' : '#6ee7b7');
    nessHeadG.addColorStop(0.55, hideTop);
    nessHeadG.addColorStop(1, hideMid);
    ctx.fillStyle = nessHeadG;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2.1, 0.088 * scale);
    ctx.beginPath();
    ctx.ellipse(r * 0.18, -r * 0.02, r * 0.48, r * 0.36, 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    this._drawKawaiiShine(ctx, r * 0.02, -r * 0.22, r * 0.16, r * 0.065, -0.22);

    // Cute twin mystic highland ear-frills behind crown!
    ctx.fillStyle = finGlow;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(1.5, 0.06 * scale);
    ctx.beginPath();
    ctx.ellipse(-r * 0.16, -r * 0.26, r * 0.16, r * 0.09, -0.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // GIANT Sparkling Emerald-Gold Chibi Anime Eyes (3/4 pair!) + Rosy Blush + Sweet `:3` Smile!
    this._drawKawaiiAnimeEye(ctx, r * 0.10, -r * 0.04, r * 0.16, r * 0.20, scale, {
      irisTop: '#fef08a',
      irisBot: '#34d399',
      outline,
      isStunned,
      isHurt: isHurt || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry,
      side: 0,
      timeSec,
    });
    this._drawKawaiiAnimeEye(ctx, r * 0.44, -r * 0.06, r * 0.12, r * 0.16, scale, {
      irisTop: '#fef08a',
      irisBot: '#34d399',
      outline,
      isStunned,
      isHurt: isHurt || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry,
      side: 1,
      timeSec,
    });
    this._drawKawaiiBlush(ctx, -r * 0.04, r * 0.15, r * 0.12, r * 0.07, scale, 'rgba(251, 113, 133, 0.70)');
    this._drawKawaiiBlush(ctx, r * 0.49, r * 0.12, r * 0.08, r * 0.055, scale, 'rgba(251, 113, 133, 0.62)');
    this._drawKawaiiMouth(ctx, r * 0.28, r * 0.15, r * 0.09, scale, {
      outline,
      isOpen: isAngry,
      isStunned,
      glowColor: '#fda4af',
    });
    ctx.restore();

    // 6. Front Rowing Paddle Flippers (near side)
    for (let f = 0; f < 2; f++) {
      ctx.save();
      const fx = f === 0 ? r * 0.26 : -r * 0.36;
      const fy = r * 0.26;
      const flap = Math.sin(strokePhase + f * 1.5) * 0.42;
      ctx.translate(fx, fy);
      ctx.rotate(0.28 + flap);
      const fg = ctx.createLinearGradient(0, 0, 0, r * 0.65);
      fg.addColorStop(0, hideTop);
      fg.addColorStop(1, '#065f46');
      ctx.fillStyle = fg;
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(2.0, 0.08 * scale);
      ctx.beginPath();
      ctx.ellipse(-r * 0.06, r * 0.34, r * 0.20, r * 0.46, 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Luminous flipper trim rib
      ctx.strokeStyle = 'rgba(167, 243, 208, 0.55)';
      ctx.lineWidth = Math.max(1.2, 0.045 * scale);
      ctx.beginPath();
      ctx.moveTo(-r * 0.04, r * 0.10);
      ctx.lineTo(-r * 0.12, r * 0.62);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
    this._drawBossStatusEmotes(ctx, boss, sx, sy, r, floatBobY, scale, timeSec);
  },

  /**
   * GREAT WHITE SOVEREIGN — Plump Chibi Pelagic Great White Shark Guardian (USS Oriskany Carrier Reef) (v267).
   */
  _drawGreatWhiteBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(boss.x);
    const sy = toScreenY(boss.y);
    const r = boss.radius * scale;
    const anim = boss.anim || {};
    const facing = (anim.facing ?? -1) < 0 ? -1 : 1;
    const isStunned = boss.aiState === 'stunned';
    const isHurt = boss.hitFlash > 0;
    const isAngry = boss.phase >= 3 || boss.aiState.includes('windup') || boss.aiState === 'lunge_dash' || boss.aiState === 'beam_sweep';
    const floatBobY = Math.sin(timeSec * 2.4) * 0.14 * r;
    const tailWag = Math.sin(timeSec * (isAngry ? 7.8 : 3.8)) * 0.22;
    const outline = '#0f172a';
    const backHi = isHurt ? '#ffffff' : boss.phase >= 3 ? '#64748b' : '#94a3b8';
    const backMid = isHurt ? '#e2e8f0' : boss.phase >= 3 ? '#334155' : '#475569';
    const backDeep = isHurt ? '#cbd5e1' : '#1e293b';
    const bellyWhite = '#f8fafc';
    const auraCol = boss.phase >= 3 ? 'rgba(251, 113, 133, 0.28)' : 'rgba(56, 189, 248, 0.28)';

    ctx.save();
    ctx.translate(sx, sy + floatBobY);
    ctx.scale(facing * (anim.squashX || 1), anim.squashY || 1);
    ctx.rotate(Math.sin(timeSec * 2.2) * 0.04);

    // 1. Soft Pelagic Cyan Aura
    const aura = ctx.createRadialGradient(0, 0, r * 0.25, 0, 0, r * 1.9);
    aura.addColorStop(0, auraCol);
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2);
    ctx.fill();

    // 2. Sweeping Crescent Great White Tail Fin (wagging!)
    ctx.save();
    ctx.translate(-r * 0.96, 0);
    ctx.rotate(tailWag);
    ctx.fillStyle = backMid;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2.2, 0.09 * scale);
    ctx.beginPath();
    ctx.moveTo(r * 0.12, -r * 0.18);
    ctx.quadraticCurveTo(-r * 0.42, -r * 0.34, -r * 0.86, -r * 0.78);
    ctx.quadraticCurveTo(-r * 0.56, -r * 0.08, -r * 0.48, 0);
    ctx.quadraticCurveTo(-r * 0.56, r * 0.12, -r * 0.76, r * 0.62);
    ctx.quadraticCurveTo(-r * 0.36, r * 0.30, r * 0.12, r * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 3. Far-Side Pectoral Fin peeking cleanly behind chest
    ctx.fillStyle = backDeep;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(1.8, 0.075 * scale);
    ctx.beginPath();
    ctx.moveTo(r * 0.42, r * 0.30);
    ctx.quadraticCurveTo(r * 0.66, r * 0.72, r * 0.22, r * 0.76);
    ctx.quadraticCurveTo(r * 0.14, r * 0.48, r * 0.26, r * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4. Iconic Tall Swept Great White Dorsal Fin!
    ctx.fillStyle = backMid;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2.2, 0.09 * scale);
    ctx.beginPath();
    ctx.moveTo(-r * 0.34, -r * 0.46);
    ctx.quadraticCurveTo(-r * 0.16, -r * 1.18, r * 0.08, -r * 1.24);
    ctx.quadraticCurveTo(r * 0.02, -r * 0.78, r * 0.28, -r * 0.44);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 5. Plump Chibi Torpedo Great White Body (Steel-Blue Back + Crisp Snow-White Countershading Belly!)
    const traceSharkBody = () => {
      ctx.beginPath();
      ctx.moveTo(-r * 1.06, 0);
      ctx.bezierCurveTo(-r * 0.68, -r * 0.72, r * 0.52, -r * 0.76, r * 1.18, -r * 0.06);
      ctx.quadraticCurveTo(r * 1.28, r * 0.14, r * 1.04, r * 0.36);
      ctx.bezierCurveTo(r * 0.48, r * 0.68, -r * 0.58, r * 0.58, -r * 1.06, 0);
      ctx.closePath();
    };
    ctx.save();
    traceSharkBody();
    const bg = ctx.createLinearGradient(0, -r * 0.72, 0, r * 0.62);
    bg.addColorStop(0, backHi);
    bg.addColorStop(0.55, backMid);
    bg.addColorStop(1, backDeep);
    ctx.fillStyle = bg;
    ctx.fill();

    // Clip to body for crisp countershaded snow-white shark belly!
    ctx.save();
    ctx.clip();
    ctx.fillStyle = bellyWhite;
    ctx.beginPath();
    ctx.moveTo(-r * 1.10, r * 0.14);
    ctx.bezierCurveTo(-r * 0.40, r * 0.08, r * 0.38, r * 0.14, r * 1.25, r * 0.06);
    ctx.lineTo(r * 1.25, r * 0.85);
    ctx.lineTo(-r * 1.10, r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Re-trace body path before outer stroke (Canvas save/restore does not restore paths)
    traceSharkBody();
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2.5, 0.10 * scale);
    ctx.stroke();
    ctx.restore();

    // Glossy anime jelly-bean dome shine along back!
    this._drawKawaiiShine(ctx, r * 0.10, -r * 0.42, r * 0.34, r * 0.11, -0.14);

    // Three cute curved gill slits behind the cheek
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = Math.max(1.5, 0.06 * scale);
    ctx.lineCap = 'round';
    for (let g = 0; g < 3; g++) {
      const gx = -r * (0.04 + g * 0.12);
      ctx.beginPath();
      ctx.arc(gx, r * 0.04, r * 0.16, -0.75, 0.75);
      ctx.stroke();
    }

    // 6. Sweeping Near-Side Pectoral Fin (flapping playfully!)
    ctx.save();
    ctx.translate(r * 0.04, r * 0.24);
    ctx.rotate(Math.sin(timeSec * 3.6) * 0.14);
    ctx.fillStyle = backMid;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2.0, 0.085 * scale);
    ctx.beginPath();
    ctx.moveTo(r * 0.18, -r * 0.06);
    ctx.quadraticCurveTo(-r * 0.04, r * 0.62, -r * 0.44, r * 0.62);
    ctx.quadraticCurveTo(-r * 0.26, r * 0.24, -r * 0.18, -r * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 7. GIANT Sparkling Pelagic-Cyan Chibi Anime Eyes (3/4 pair!) + Rosy Blush + Cheeky Baby-Fang Shark Grin!
    this._drawKawaiiAnimeEye(ctx, r * 0.42, -r * 0.12, r * 0.20, r * 0.24, scale, {
      irisTop: '#bae6fd',
      irisBot: '#0284c7',
      outline,
      isStunned,
      isHurt: isHurt || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry,
      side: 0,
      timeSec,
    });
    this._drawKawaiiAnimeEye(ctx, r * 0.90, -r * 0.12, r * 0.14, r * 0.19, scale, {
      irisTop: '#bae6fd',
      irisBot: '#0284c7',
      outline,
      isStunned,
      isHurt: isHurt || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry,
      side: 1,
      timeSec,
    });
    this._drawKawaiiBlush(ctx, r * 0.24, r * 0.15, r * 0.15, r * 0.085, scale, 'rgba(251, 113, 133, 0.68)');
    this._drawKawaiiBlush(ctx, r * 0.96, r * 0.12, r * 0.10, r * 0.065, scale, 'rgba(251, 113, 133, 0.58)');
    this._drawKawaiiMouth(ctx, r * 0.68, r * 0.22, r * 0.14, scale, {
      outline,
      isOpen: isAngry,
      isStunned,
      fangs: !isAngry,
      glowColor: '#fda4af',
    });

    ctx.restore();
    this._drawBossStatusEmotes(ctx, boss, sx, sy, r, floatBobY, scale, timeSec);
  },

  /**
   * AURORA ORCA MATRIARCH — Plump Chibi Subglacial Killer Whale Guardian (Silfra & Katla Aurora Abyss) (v267).
   */
  _drawOrcaWhaleBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(boss.x);
    const sy = toScreenY(boss.y);
    const r = boss.radius * scale;
    const anim = boss.anim || {};
    const facing = (anim.facing ?? -1) < 0 ? -1 : 1;
    const isStunned = boss.aiState === 'stunned';
    const isHurt = boss.hitFlash > 0;
    const isAngry = boss.phase >= 3 || boss.aiState.includes('windup') || boss.aiState === 'lunge_dash' || boss.aiState === 'beam_sweep';
    const floatBobY = Math.sin(timeSec * 2.2) * 0.15 * r;
    const flukeSweep = Math.sin(timeSec * (isAngry ? 6.8 : 3.2)) * 0.22;
    const outline = '#020617';
    const orcaHi = isHurt ? '#ffffff' : '#334155';
    const orcaDark = isHurt ? '#cbd5e1' : '#090d16';
    const snowWhite = '#f8fafc';
    const auroraCol = boss.phase >= 3 ? '#f472b6' : '#67e8f9';

    ctx.save();
    ctx.translate(sx, sy + floatBobY);
    ctx.scale(facing * (anim.squashX || 1), anim.squashY || 1);
    ctx.rotate(Math.sin(timeSec * 2.0) * 0.045);

    // 1. Shimmering Northern Aurora Halo
    const aura = ctx.createRadialGradient(0, 0, r * 0.25, 0, 0, r * 1.95);
    aura.addColorStop(0, 'rgba(103, 232, 249, 0.28)');
    aura.addColorStop(0.55, 'rgba(52, 211, 153, 0.14)');
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.95, 0, Math.PI * 2);
    ctx.fill();

    // 2. Broad Sweeping Orca Horizontal Tail Fluke
    ctx.save();
    ctx.translate(-r * 0.98, r * 0.04);
    ctx.rotate(flukeSweep);
    ctx.fillStyle = orcaDark;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2.2, 0.09 * scale);
    ctx.beginPath();
    ctx.moveTo(r * 0.14, -r * 0.16);
    ctx.quadraticCurveTo(-r * 0.42, -r * 0.44, -r * 0.86, -r * 0.56);
    ctx.quadraticCurveTo(-r * 0.62, -r * 0.08, -r * 0.48, 0);
    ctx.quadraticCurveTo(-r * 0.62, r * 0.12, -r * 0.82, r * 0.54);
    ctx.quadraticCurveTo(-r * 0.36, r * 0.40, r * 0.14, r * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 3. Tall Stately Orca Dorsal Fin with Aurora Rim Shimmer!
    ctx.fillStyle = orcaDark;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2.2, 0.09 * scale);
    ctx.beginPath();
    ctx.moveTo(-r * 0.32, -r * 0.48);
    ctx.quadraticCurveTo(-r * 0.18, -r * 1.28, r * 0.02, -r * 1.32);
    ctx.quadraticCurveTo(r * 0.08, -r * 0.82, r * 0.22, -r * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Subtle aurora teal rim along dorsal leading edge
    ctx.strokeStyle = auroraCol;
    ctx.lineWidth = Math.max(1.4, 0.05 * scale);
    ctx.beginPath();
    ctx.moveTo(-r * 0.24, -r * 0.56);
    ctx.quadraticCurveTo(-r * 0.14, -r * 1.12, 0, -r * 1.22);
    ctx.stroke();

    // 4. Plump Chibi Rounded Orca Body (Glossy Obsidian + Iconic Snow-White Saddle, Belly & Eye Patch!)
    const traceOrcaBody = () => {
      ctx.beginPath();
      ctx.moveTo(-r * 1.06, r * 0.04);
      ctx.bezierCurveTo(-r * 0.72, -r * 0.76, r * 0.62, -r * 0.82, r * 1.18, -r * 0.08);
      ctx.quadraticCurveTo(r * 1.26, r * 0.26, r * 0.94, r * 0.48);
      ctx.bezierCurveTo(r * 0.40, r * 0.72, -r * 0.60, r * 0.56, -r * 1.06, r * 0.04);
      ctx.closePath();
    };
    ctx.save();
    traceOrcaBody();
    const bg = ctx.createRadialGradient(r * 0.15, -r * 0.36, r * 0.1, 0, 0, r * 1.4);
    bg.addColorStop(0, orcaHi);
    bg.addColorStop(0.55, orcaDark);
    bg.addColorStop(1, '#020617');
    ctx.fillStyle = bg;
    ctx.fill();

    // Clip to body for unmistakable crisp white orca markings!
    ctx.save();
    ctx.clip();
    // Snow-white chin, belly & swooping rear flank lobe
    ctx.fillStyle = snowWhite;
    ctx.beginPath();
    ctx.moveTo(r * 1.26, r * 0.18);
    ctx.quadraticCurveTo(r * 0.62, r * 0.14, r * 0.18, r * 0.24);
    ctx.quadraticCurveTo(-r * 0.24, r * 0.18, -r * 0.56, -r * 0.04);
    ctx.quadraticCurveTo(-r * 0.76, r * 0.16, -r * 0.48, r * 0.44);
    ctx.lineTo(r * 1.26, r * 0.78);
    ctx.closePath();
    ctx.fill();
    // Classic soft grey dorsal saddle patch behind dorsal fin
    ctx.fillStyle = 'rgba(203, 213, 225, 0.38)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.34, -r * 0.36, r * 0.26, r * 0.14, -0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Re-trace body path before outer stroke (Canvas save/restore does not restore paths)
    traceOrcaBody();
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2.5, 0.10 * scale);
    ctx.stroke();
    ctx.restore();

    // Iconic Bold Snow-White Orca Oval Eye-Patch!
    ctx.fillStyle = snowWhite;
    ctx.beginPath();
    ctx.ellipse(r * 0.12, -r * 0.24, r * 0.28, r * 0.14, -0.22, 0, Math.PI * 2);
    ctx.fill();

    // Glossy anime jelly-bean forehead dome shine!
    this._drawKawaiiShine(ctx, r * 0.32, -r * 0.48, r * 0.30, r * 0.11, -0.18);

    // 5. Cute Rounded Paddle Pectoral Fin
    ctx.save();
    ctx.translate(r * 0.08, r * 0.28);
    ctx.rotate(Math.sin(timeSec * 3.2) * 0.16);
    ctx.fillStyle = orcaDark;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2.0, 0.085 * scale);
    ctx.beginPath();
    ctx.ellipse(-r * 0.10, r * 0.24, r * 0.22, r * 0.38, 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 6. GIANT Sparkling Aurora-Cyan Chibi Anime Eyes (3/4 pair!) + Rosy Blush + Sweet `:3` Whale Smile!
    this._drawKawaiiAnimeEye(ctx, r * 0.50, -r * 0.08, r * 0.20, r * 0.24, scale, {
      irisTop: '#ccfbf1',
      irisBot: auroraCol,
      outline: '#0f172a',
      isStunned,
      isHurt: isHurt || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry,
      side: 0,
      timeSec,
    });
    this._drawKawaiiAnimeEye(ctx, r * 0.96, -r * 0.09, r * 0.14, r * 0.19, scale, {
      irisTop: '#ccfbf1',
      irisBot: auroraCol,
      outline: '#0f172a',
      isStunned,
      isHurt: isHurt || boss.defeated,
      isDormant: boss.aiState === 'dormant',
      isAngry,
      side: 1,
      timeSec,
    });
    this._drawKawaiiBlush(ctx, r * 0.32, r * 0.18, r * 0.15, r * 0.085, scale, 'rgba(251, 113, 133, 0.72)');
    this._drawKawaiiBlush(ctx, r * 1.02, r * 0.15, r * 0.09, r * 0.065, scale, 'rgba(251, 113, 133, 0.62)');
    this._drawKawaiiMouth(ctx, r * 0.74, r * 0.22, r * 0.12, scale, {
      outline: '#0f172a',
      isOpen: isAngry,
      isStunned,
      glowColor: '#fda4af',
    });

    ctx.restore();
    this._drawBossStatusEmotes(ctx, boss, sx, sy, r, floatBobY, scale, timeSec);
  },

  /**
   * TRIDACNA PEARL EMPEROR — Iridescent Giant Clam Boss with Glowing Kawaii Moon-Pearl Face (Fujikawa Maru — Chuuk Lagoon) (v267).
   */
  _drawGiantClamBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(boss.x);
    const sy = toScreenY(boss.y);
    const r = boss.radius * scale;
    const anim = boss.anim || {};
    const isStunned = boss.aiState === 'stunned';
    const isHurt = boss.hitFlash > 0;
    const isAngry = boss.phase >= 3 || boss.aiState.includes('windup') || boss.aiState === 'lunge_dash' || boss.aiState === 'beam_sweep';
    const floatBobY = Math.sin(timeSec * 2.1) * 0.12 * r;
    const jawLift = isAngry
      ? 0.24 + Math.abs(Math.sin(timeSec * 6.5)) * 0.16
      : 0.12 + Math.sin(timeSec * 2.4) * 0.06;
    const outline = '#4c0519';
    const shellHi = isHurt ? '#ffffff' : boss.phase >= 3 ? '#fecdd3' : '#fbcfe8';
    const shellMid = isHurt ? '#fdf2f8' : boss.phase >= 3 ? '#ec4899' : '#f472b6';
    const shellDark = isHurt ? '#f9a8d4' : '#9d174d';
    const mantleTeal = boss.phase >= 3 ? '#fde047' : '#2dd4bf';

    ctx.save();
    ctx.translate(sx, sy + floatBobY);
    ctx.scale(anim.squashX || 1, anim.squashY || 1);
    ctx.rotate(Math.sin(timeSec * 1.8) * 0.035);

    // 1. Shimmering Nacre Pearl Rainbow Aura
    const aura = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.9);
    aura.addColorStop(0, 'rgba(244, 114, 182, 0.34)');
    aura.addColorStop(0.55, 'rgba(45, 212, 191, 0.18)');
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2);
    ctx.fill();

    // 2. Scalloped Upper Clam Shell Lid (hinged open to reveal glowing pearl & cute face!)
    ctx.save();
    ctx.translate(0, -r * (0.14 + jawLift * 0.45));
    const topG = ctx.createRadialGradient(-r * 0.2, -r * 0.55, r * 0.1, 0, -r * 0.2, r * 1.25);
    topG.addColorStop(0, shellHi);
    topG.addColorStop(0.55, shellMid);
    topG.addColorStop(1, shellDark);
    ctx.fillStyle = topG;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2.6, 0.10 * scale);
    ctx.beginPath();
    ctx.moveTo(-r * 1.18, r * 0.18);
    ctx.bezierCurveTo(-r * 1.12, -r * 0.92, r * 1.12, -r * 0.92, r * 1.18, r * 0.18);
    // Scalloped wavy upper rim
    for (let s = 4; s >= -4; s--) {
      const rxS = (s / 4) * r * 1.12;
      const ryS = r * (0.14 + (Math.abs(s) % 2 === 0 ? 0.10 : -0.06));
      ctx.lineTo(rxS, ryS);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Radiating Fluted Clam Shell Ribs
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = Math.max(1.5, 0.055 * scale);
    for (let rib = -3; rib <= 3; rib++) {
      ctx.beginPath();
      ctx.moveTo(rib * r * 0.12, -r * 0.64);
      ctx.quadraticCurveTo(rib * r * 0.28, -r * 0.28, rib * r * 0.34, r * 0.10);
      ctx.stroke();
    }
    this._drawKawaiiShine(ctx, -r * 0.36, -r * 0.48, r * 0.28, r * 0.11, -0.35);

    // Jaunty Bouncy Golden Ocean Crown perched atop the upper shell!
    ctx.save();
    ctx.translate(0, -r * 0.72 + Math.sin(timeSec * 3.4) * 0.04 * r);
    const cw = r * 0.36;
    const ch = r * 0.24;
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#713f12';
    ctx.lineWidth = Math.max(1.5, 0.06 * scale);
    ctx.beginPath();
    ctx.moveTo(-cw, ch * 0.35);
    ctx.lineTo(-cw * 0.85, -ch * 0.70);
    ctx.lineTo(-cw * 0.28, -ch * 0.10);
    ctx.lineTo(0, -ch);
    ctx.lineTo(cw * 0.28, -ch * 0.10);
    ctx.lineTo(cw * 0.85, -ch * 0.70);
    ctx.lineTo(cw, ch * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();

    // 3. Lush Iridescent Ruffled Tridacna Velvet Mantle Interior
    ctx.fillStyle = '#134e4a';
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2.2, 0.085 * scale);
    ctx.beginPath();
    ctx.ellipse(0, r * 0.10, r * 1.06, r * (0.48 + jawLift * 0.35), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glowing turquoise-magenta scalloped mantle frills around the opening
    ctx.fillStyle = mantleTeal;
    for (let f = -4; f <= 4; f++) {
      const fx = f * r * 0.24;
      const fy = r * (0.14 + Math.sin(timeSec * 4.2 + f * 1.1) * 0.06);
      ctx.beginPath();
      ctx.arc(fx, fy, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. GIANT Luminous Iridescent Moon-Pearl Core (The Clam's Adorable Kawaii Face!)
    const pearlR = r * 0.62;
    const pearlY = r * 0.06;
    const pg = ctx.createRadialGradient(-pearlR * 0.28, pearlY - pearlR * 0.32, pearlR * 0.08, 0, pearlY, pearlR * 1.08);
    pg.addColorStop(0, '#ffffff');
    pg.addColorStop(0.55, isHurt ? '#ffffff' : '#fdf2f8');
    pg.addColorStop(0.85, '#fbcfe8');
    pg.addColorStop(1, '#67e8f9');
    ctx.fillStyle = pg;
    ctx.strokeStyle = '#9d174d';
    ctx.lineWidth = Math.max(2.2, 0.09 * scale);
    ctx.beginPath();
    ctx.arc(0, pearlY, pearlR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    this._drawKawaiiShine(ctx, -pearlR * 0.32, pearlY - pearlR * 0.44, pearlR * 0.34, pearlR * 0.16, -0.45);

    // GIANT Sparkling Starlight-Pink Anime Eyes + Rosy Blush + Adorable `:3` Smile on the Pearl!
    for (const side of [-1, 1]) {
      this._drawKawaiiAnimeEye(ctx, side * r * 0.25, pearlY - r * 0.06, r * 0.17, r * 0.21, scale, {
        irisTop: '#fef08a',
        irisBot: '#ec4899',
        outline: '#4c0519',
        isStunned,
        isHurt: isHurt || boss.defeated,
        isDormant: boss.aiState === 'dormant',
        isAngry,
        side: side < 0 ? 0 : 1,
        timeSec,
      });
      this._drawKawaiiBlush(ctx, side * r * 0.40, pearlY + r * 0.15, r * 0.13, r * 0.075, scale, 'rgba(244, 114, 182, 0.72)');
    }
    this._drawKawaiiMouth(ctx, 0, pearlY + r * 0.16, r * 0.11, scale, {
      outline: '#4c0519',
      isOpen: isAngry,
      isStunned,
      glowColor: '#f472b6',
    });

    // 5. Scalloped Lower Clam Shell Cradle
    ctx.save();
    ctx.translate(0, r * (0.28 + jawLift * 0.20));
    const botG = ctx.createLinearGradient(0, 0, 0, r * 0.65);
    botG.addColorStop(0, shellMid);
    botG.addColorStop(1, shellDark);
    ctx.fillStyle = botG;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2.6, 0.10 * scale);
    ctx.beginPath();
    ctx.moveTo(-r * 1.18, 0);
    for (let s = -4; s <= 4; s++) {
      const rxS = (s / 4) * r * 1.12;
      const ryS = r * (Math.abs(s) % 2 === 0 ? 0.10 : -0.05);
      ctx.lineTo(rxS, ryS);
    }
    ctx.bezierCurveTo(r * 1.02, r * 0.68, -r * 1.02, r * 0.68, -r * 1.18, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
    this._drawBossStatusEmotes(ctx, boss, sx, sy, r, floatBobY, scale, timeSec);
  },

  /**
   * CRIMSON PIRANHA TRIO — Three Synchronized Kawaii Anime Chibi Piranha Fish Boss Pack
   * (Cenote Angelita H2S River — Tulum, Mexico) (v268).
   */
  _drawPiranhaTrioBoss(ctx, boss, toScreenX, toScreenY, scale, timeSec) {
    const sx = toScreenX(boss.x);
    const sy = toScreenY(boss.y);
    const r = boss.radius * scale;
    const anim = boss.anim || {};
    const facing = (anim.facing ?? -1) < 0 ? -1 : 1;
    const isStunned = boss.aiState === 'stunned';
    const isHurt = boss.hitFlash > 0;
    const isAngry = boss.phase >= 3 || boss.aiState.includes('windup') || boss.aiState === 'lunge_dash' || boss.aiState === 'beam_sweep';
    const floatBobY = Math.sin(timeSec * 2.8) * 0.14 * r;
    const outline = '#1e1b4b';
    const frenzySpeed = isAngry ? 1.85 : 1.0;

    ctx.save();
    ctx.translate(sx, sy + floatBobY);
    ctx.scale(facing * (anim.squashX || 1), anim.squashY || 1);

    // 1. Soft Crimson-Emerald Cenote Pack Aura + Swirling Frenzy Wake Ribbons
    const aura = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.95);
    aura.addColorStop(0, isAngry ? 'rgba(251, 113, 133, 0.34)' : 'rgba(45, 212, 191, 0.24)');
    aura.addColorStop(0.55, 'rgba(244, 63, 94, 0.14)');
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.95, 0, Math.PI * 2);
    ctx.fill();

    // Swirling translucent water-vortex ribbons connecting the 3 fish
    ctx.save();
    ctx.lineCap = 'round';
    for (let w = 0; w < 3; w++) {
      const a0 = timeSec * (1.8 * frenzySpeed) + (w * Math.PI * 2) / 3;
      ctx.strokeStyle = w === 0 ? 'rgba(251, 113, 133, 0.32)' : w === 1 ? 'rgba(253, 224, 71, 0.28)' : 'rgba(94, 234, 212, 0.28)';
      ctx.lineWidth = Math.max(1.8, 0.065 * scale);
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.98 + w * 0.09), a0, a0 + 1.05);
      ctx.stroke();
    }
    ctx.restore();

    // Helper to draw one super-cute chibi anime Piranha!
    const drawPiranha = (px, py, fr, cfg) => {
      const wag = Math.sin(timeSec * (10.5 * frenzySpeed) + cfg.phase) * 0.34;
      const finFlap = Math.sin(timeSec * (8.2 * frenzySpeed) + cfg.phase) * 0.22;
      const chomp = isAngry ? 0.55 + 0.45 * Math.abs(Math.sin(timeSec * 12.0 + cfg.phase)) : 0;
      const tilt = Math.sin(timeSec * (3.2 * frenzySpeed) + cfg.phase) * 0.09;
      const backHi = isHurt ? '#ffffff' : cfg.backHi;
      const backMid = isHurt ? '#f1f5f9' : cfg.backMid;
      const bellyHi = isHurt ? '#fff1f2' : cfg.bellyHi;
      const bellyMid = isHurt ? '#fecdd3' : cfg.bellyMid;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(tilt);

      // A. Rapidly Wagging Forked Piranha Tail Fin
      ctx.save();
      ctx.translate(-fr * 0.88, 0);
      ctx.rotate(wag);
      ctx.fillStyle = bellyMid;
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(1.8, 0.075 * scale);
      ctx.beginPath();
      ctx.moveTo(fr * 0.08, -fr * 0.16);
      ctx.quadraticCurveTo(-fr * 0.34, -fr * 0.36, -fr * 0.64, -fr * 0.56);
      ctx.quadraticCurveTo(-fr * 0.42, -fr * 0.06, -fr * 0.36, 0);
      ctx.quadraticCurveTo(-fr * 0.42, fr * 0.08, -fr * 0.64, fr * 0.56);
      ctx.quadraticCurveTo(-fr * 0.34, fr * 0.36, fr * 0.08, fr * 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // B. Cute Serrated Chibi Mohawk Dorsal Fin & Lower Anal Fin
      ctx.fillStyle = backHi;
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(1.7, 0.07 * scale);
      ctx.beginPath();
      ctx.moveTo(-fr * 0.48, -fr * 0.54);
      ctx.quadraticCurveTo(-fr * 0.34, -fr * 1.06, -fr * 0.12, -fr * 0.84);
      ctx.quadraticCurveTo(fr * 0.02, -fr * 1.12, fr * 0.16, -fr * 0.82);
      ctx.quadraticCurveTo(fr * 0.28, -fr * 0.96, fr * 0.36, -fr * 0.54);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Lower Crimson/Gold Anal Fin
      ctx.fillStyle = bellyMid;
      ctx.beginPath();
      ctx.moveTo(-fr * 0.56, fr * 0.44);
      ctx.quadraticCurveTo(-fr * 0.34, fr * 0.96, fr * 0.02, fr * 0.72);
      ctx.lineTo(fr * 0.12, fr * 0.52);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // C. Plump Chibi Diamond-Oval Piranha Body with Bulldog Underbite Jaw!
      const tracePiranhaBody = () => {
        ctx.beginPath();
        ctx.moveTo(-fr * 0.92, 0);
        ctx.bezierCurveTo(-fr * 0.68, -fr * 0.84, fr * 0.46, -fr * 0.92, fr * 0.96, -fr * 0.14);
        // Cute stout piranha snout & plump protruding chin!
        ctx.quadraticCurveTo(fr * 1.12, fr * 0.18, fr * 0.88, fr * 0.46);
        ctx.bezierCurveTo(fr * 0.42, fr * 0.88, -fr * 0.64, fr * 0.78, -fr * 0.92, 0);
        ctx.closePath();
      };

      ctx.save();
      tracePiranhaBody();
      const bodyG = ctx.createLinearGradient(0, -fr * 0.82, 0, fr * 0.78);
      bodyG.addColorStop(0, backHi);
      bodyG.addColorStop(0.54, backMid);
      bodyG.addColorStop(1, bellyMid);
      ctx.fillStyle = bodyG;
      ctx.fill();

      // Clip inside body for iconic glowing red/gold/pink piranha belly & glittering flank speckles!
      ctx.save();
      ctx.clip();
      const bellyG = ctx.createLinearGradient(0, fr * 0.02, 0, fr * 0.85);
      bellyG.addColorStop(0, bellyHi);
      bellyG.addColorStop(1, bellyMid);
      ctx.fillStyle = bellyG;
      ctx.beginPath();
      ctx.moveTo(-fr * 1.0, fr * 0.16);
      ctx.bezierCurveTo(-fr * 0.34, fr * 0.02, fr * 0.34, fr * 0.10, fr * 1.16, -fr * 0.04);
      ctx.lineTo(fr * 1.16, fr * 1.0);
      ctx.lineTo(-fr * 1.0, fr * 1.0);
      ctx.closePath();
      ctx.fill();

      // Cute glittery iridescent piranha scale flecks
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      for (const [sxDot, syDot, srDot] of [[-0.28, -0.22, 0.07], [-0.08, -0.34, 0.06], [-0.42, 0.04, 0.055]]) {
        ctx.beginPath();
        ctx.arc(fr * sxDot, fr * syDot, Math.max(1.2, fr * srDot), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Re-trace body contour before crisp anime outline stroke!
      tracePiranhaBody();
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(2.1, 0.085 * scale);
      ctx.stroke();
      ctx.restore();

      // Glossy jelly-bean anime shine along forehead dome!
      this._drawKawaiiShine(ctx, fr * 0.02, -fr * 0.50, fr * 0.28, fr * 0.10, -0.18);

      // D. Jaunty Mini Golden Crown on the Alpha Leader!
      if (cfg.hasCrown) {
        ctx.save();
        ctx.translate(fr * 0.18, -fr * 0.78 + Math.sin(timeSec * 4.5) * 0.04 * fr);
        ctx.rotate(0.16);
        const cw = fr * 0.34;
        const ch = fr * 0.26;
        ctx.fillStyle = '#fde047';
        ctx.strokeStyle = '#713f12';
        ctx.lineWidth = Math.max(1.3, 0.055 * scale);
        ctx.beginPath();
        ctx.moveTo(-cw, ch * 0.45);
        ctx.lineTo(-cw * 0.85, -ch * 0.65);
        ctx.lineTo(-cw * 0.30, -ch * 0.05);
        ctx.lineTo(0, -ch * 0.90);
        ctx.lineTo(cw * 0.30, -ch * 0.05);
        ctx.lineTo(cw * 0.85, -ch * 0.65);
        ctx.lineTo(cw, ch * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fb7185';
        ctx.beginPath();
        ctx.arc(0, ch * 0.08, Math.max(1.5, cw * 0.16), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // E. Fluttering Near-Side Pectoral Fin
      ctx.save();
      ctx.translate(-fr * 0.08, fr * 0.26);
      ctx.rotate(finFlap);
      ctx.fillStyle = bellyHi;
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(1.5, 0.065 * scale);
      ctx.beginPath();
      ctx.ellipse(-fr * 0.16, fr * 0.16, fr * 0.24, fr * 0.15, -0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // F. GIANT Sparkling Chibi Anime Eyes (3/4 Pair!) + Rosy Blush!
      this._drawKawaiiAnimeEye(ctx, fr * 0.30, -fr * 0.14, fr * 0.24, fr * 0.28, scale * (fr / Math.max(1, r)), {
        irisTop: cfg.irisTop,
        irisBot: cfg.irisBot,
        outline,
        isStunned,
        isHurt: isHurt || boss.defeated,
        isDormant: boss.aiState === 'dormant',
        isAngry,
        side: 0,
        timeSec,
      });
      this._drawKawaiiAnimeEye(ctx, fr * 0.78, -fr * 0.15, fr * 0.16, fr * 0.22, scale * (fr / Math.max(1, r)), {
        irisTop: cfg.irisTop,
        irisBot: cfg.irisBot,
        outline,
        isStunned,
        isHurt: isHurt || boss.defeated,
        isDormant: boss.aiState === 'dormant',
        isAngry,
        side: 1,
        timeSec,
      });
      this._drawKawaiiBlush(ctx, fr * 0.08, fr * 0.14, fr * 0.16, fr * 0.09, scale, 'rgba(255, 228, 230, 0.65)');
      this._drawKawaiiBlush(ctx, fr * 0.86, fr * 0.10, fr * 0.10, fr * 0.07, scale, 'rgba(255, 228, 230, 0.55)');

      // G. Iconic Kawaii Piranha Underbite Mouth with Tiny Snow-White Zig-Zag Baby Fangs!
      ctx.save();
      const mx = fr * 0.62;
      const my = fr * 0.28;
      if (isStunned) {
        this._drawKawaiiMouth(ctx, mx, my, fr * 0.16, scale, { outline, isStunned: true });
      } else if (isAngry) {
        // Snapping open chomp mouth with 3 cute white triangle fangs!
        const openH = fr * (0.14 + chomp * 0.12);
        ctx.fillStyle = '#4c0519';
        ctx.strokeStyle = outline;
        ctx.lineWidth = Math.max(1.5, 0.06 * scale);
        ctx.beginPath();
        ctx.ellipse(mx, my, fr * 0.28, openH, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Cute pink tongue
        ctx.fillStyle = '#fb7185';
        ctx.beginPath();
        ctx.ellipse(mx, my + openH * 0.35, fr * 0.16, openH * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        // Snowy-white zig-zag piranha teeth!
        ctx.fillStyle = '#ffffff';
        for (let t = -1; t <= 1; t++) {
          const tx = mx + t * fr * 0.12;
          // Upper baby fang
          ctx.beginPath();
          ctx.moveTo(tx - fr * 0.05, my - openH * 0.72);
          ctx.lineTo(tx, my - openH * 0.05);
          ctx.lineTo(tx + fr * 0.05, my - openH * 0.72);
          ctx.closePath();
          ctx.fill();
          // Lower underbite fang
          ctx.beginPath();
          ctx.moveTo(tx - fr * 0.05, my + openH * 0.75);
          ctx.lineTo(tx, my + openH * 0.12);
          ctx.lineTo(tx + fr * 0.05, my + openH * 0.75);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        // Cheeky happy piranha underbite grin with 3 cute upward baby-fangs!
        ctx.strokeStyle = outline;
        ctx.lineWidth = Math.max(1.7, 0.065 * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(mx - fr * 0.24, my - fr * 0.02);
        ctx.quadraticCurveTo(mx + fr * 0.02, my + fr * 0.14, mx + fr * 0.26, my - fr * 0.06);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = outline;
        ctx.lineWidth = Math.max(1.0, 0.04 * scale);
        for (const [fx, fy, fh] of [[-0.12, 0.04, 0.12], [0.02, 0.07, 0.14], [0.15, 0.03, 0.11]]) {
          ctx.beginPath();
          ctx.moveTo(mx + fr * (fx - 0.05), my + fr * fy);
          ctx.lineTo(mx + fr * fx, my + fr * (fy - fh));
          ctx.lineTo(mx + fr * (fx + 0.05), my + fr * fy);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.restore();

      ctx.restore();
    };

    // 2. Render the 3 Coordinated Piranha Fish in Dynamic Orbiting Delta Pack Formation!
    const spread = isStunned ? 1.15 : isAngry ? 0.94 : 1.02;
    const bob1 = Math.sin(timeSec * (3.6 * frenzySpeed) + 1.4) * r * 0.12;
    const bob2 = Math.sin(timeSec * (3.9 * frenzySpeed) + 3.6) * r * 0.12;
    const bob3 = Math.sin(timeSec * (3.3 * frenzySpeed)) * r * 0.10;
    const surge1 = Math.cos(timeSec * (2.6 * frenzySpeed) + 0.8) * r * 0.08;
    const surge2 = Math.cos(timeSec * (2.8 * frenzySpeed) + 2.9) * r * 0.08;
    const surge3 = Math.cos(timeSec * (2.4 * frenzySpeed)) * r * 0.06;

    // Wingman 1 (Top-Left — Sunburst Gold-Bellied Piranha)
    drawPiranha(-r * 0.56 * spread + surge1, -r * 0.62 * spread + bob1, r * 0.56, {
      backHi: '#38bdf8',
      backMid: '#0284c7',
      bellyHi: '#fef08a',
      bellyMid: '#f59e0b',
      irisTop: '#fef9c3',
      irisBot: '#ea580c',
      phase: 1.5,
      hasCrown: false,
    });

    // Wingman 2 (Bottom-Left — Berry Magenta-Bellied Piranha)
    drawPiranha(-r * 0.50 * spread + surge2, r * 0.62 * spread + bob2, r * 0.56, {
      backHi: '#a78bfa',
      backMid: '#6d28d9',
      bellyHi: '#fbcfe8',
      bellyMid: '#db2777',
      irisTop: '#fce7f3',
      irisBot: '#be185d',
      phase: 3.7,
      hasCrown: false,
    });

    // Alpha Leader (Front-Right — Classic Emerald & Ruby Crimson-Bellied Piranha with Mini Crown!)
    drawPiranha(r * 0.58 * spread + surge3, r * 0.02 + bob3, r * 0.68, {
      backHi: '#2dd4bf',
      backMid: '#0f766e',
      bellyHi: '#fda4af',
      bellyMid: '#e11d48',
      irisTop: '#fde68a',
      irisBot: '#e11d48',
      phase: 0.0,
      hasCrown: true,
    });

    ctx.restore();
    this._drawBossStatusEmotes(ctx, boss, sx, sy, r, floatBobY, scale, timeSec);
  },
};
