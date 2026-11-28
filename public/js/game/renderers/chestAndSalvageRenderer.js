/**
 * 3D Cave-Embedded Treasure Chests, Armored Gear Caches & Rigged Lift-Bag Salvage Cradle (v294)
 *
 * Modular renderer helpers extracted to keep renderer.js, lightingAndFxRenderer.js, and
 * wreckAndInteractivesRenderer.js lean while delivering:
 * - True 3/4 perspective 3D chests & Pelican tech cases wedged naturally into cave rock walls/ledges
 * - Full multi-stage opening animation (latch pop -> 3D hinged barrel lid swing -> volumetric light cone
 *   & rising illuminated item presentation -> persistent open state)
 * - Authentic rigged aluminum/brass salvage cargo cradle displaying the diver's actual collected relics
 *   inside a braided yellow nylon cargo net beneath the lift bag (replacing the old floating brown orb).
 */

import { drawStyledArtifact } from '../artSprites.js';
import { getHyperRealSprite } from '../hyperRealSprites.js';

const TIER_PALETTES = Object.freeze({
  uncommon: { rgb: '52, 211, 153', hex: '#34d399', light: '#d1fae5', trim: '#10b981' },
  rare: { rgb: '56, 189, 248', hex: '#38bdf8', light: '#e0f2fe', trim: '#0ea5e9' },
  epic: { rgb: '192, 132, 252', hex: '#c084fc', light: '#f3e8ff', trim: '#a855f7' },
  mythic: { rgb: '250, 204, 21', hex: '#facc15', light: '#fef9c3', trim: '#eab308' },
  legendary: { rgb: '255, 149, 36', hex: '#ff9524', light: '#ffedd5', trim: '#f97316' },
});

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = clamp(t, 0, 1) - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}

function easeOutCubic(t) {
  const x = 1 - clamp(t, 0, 1);
  return 1 - x * x * x;
}

/**
 * Draw rugged cave rock encrustation, sediment collar, barnacles & swaying cave moss gripping the
 * base of an embedded chest or gear case so it feels physically wedged into the cave wall.
 */
function drawRockEmbedCollar(ctx, cw, ch, timeSec, seed = 0) {
  const baseY = ch * 0.44;
  // Back dark rock shadow wedge anchoring chest into cave wall
  ctx.fillStyle = 'rgba(7, 13, 24, 0.72)';
  ctx.beginPath();
  ctx.ellipse(cw * 0.08, baseY + ch * 0.08, cw * 0.78, ch * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();

  // Layered jagged karst limestone shards gripping lower left & right corners
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.26)';
  ctx.lineWidth = Math.max(0.8, cw * 0.025);
  ctx.beginPath();
  ctx.moveTo(-cw * 0.68, baseY + ch * 0.14);
  ctx.lineTo(-cw * 0.56, baseY - ch * 0.14);
  ctx.lineTo(-cw * 0.34, baseY - ch * 0.04);
  ctx.lineTo(-cw * 0.14, baseY + ch * 0.08);
  ctx.lineTo(cw * 0.22, baseY + ch * 0.06);
  ctx.lineTo(cw * 0.46, baseY - ch * 0.08);
  ctx.lineTo(cw * 0.72, baseY - ch * 0.16);
  ctx.lineTo(cw * 0.80, baseY + ch * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Warm sediment / silt crust tucked along front lower edge
  ctx.fillStyle = 'rgba(51, 65, 85, 0.86)';
  ctx.beginPath();
  ctx.moveTo(-cw * 0.52, baseY + ch * 0.10);
  ctx.quadraticCurveTo(-cw * 0.15, baseY - ch * 0.05, cw * 0.18, baseY + ch * 0.08);
  ctx.quadraticCurveTo(cw * 0.44, baseY - ch * 0.02, cw * 0.64, baseY + ch * 0.12);
  ctx.closePath();
  ctx.fill();

  // Tiny pale cave barnacles + gentle swaying kelp/moss tendril
  if (cw >= 16) {
    ctx.fillStyle = 'rgba(203, 213, 225, 0.55)';
    ctx.beginPath();
    ctx.arc(-cw * 0.44, baseY - ch * 0.02, cw * 0.048, 0, Math.PI * 2);
    ctx.arc(-cw * 0.36, baseY + ch * 0.02, cw * 0.036, 0, Math.PI * 2);
    ctx.arc(cw * 0.52, baseY - ch * 0.03, cw * 0.042, 0, Math.PI * 2);
    ctx.fill();

    const sway = Math.sin(timeSec * 2.1 + seed) * cw * 0.07;
    ctx.strokeStyle = 'rgba(45, 134, 108, 0.52)';
    ctx.lineWidth = Math.max(1, cw * 0.038);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-cw * 0.48, baseY);
    ctx.quadraticCurveTo(-cw * 0.56 + sway, baseY - ch * 0.34, -cw * 0.46 + sway * 1.4, baseY - ch * 0.58);
    ctx.stroke();
  }
}

/**
 * Draw a true 3D cave-embedded Treasure Chest (Brass, Deep Grotto, or Map Vault) with a full
 * multi-stage opening animation: latch pop -> 3D arched lid hinge swing -> volumetric god-ray light
 * eruption & rising rarity item medallion -> persistent open state in the rock wall.
 */
export function drawEmbeddedChest3D(ctx, tc, sx, sy, scale, timeSec, diver, rigGlowBonus = 0, idx = 0) {
  const openedAge = tc.opened ? Math.max(0, timeSec - (tc.openedAt || 0)) : 0;
  const isLegendary = tc.opened && tc.drop?.tier === 'legendary';
  const isMythic = tc.opened && tc.drop?.tier === 'mythic';
  const spectacleDur = isLegendary ? 6.0 : isMythic ? 5.0 : 4.2;
  const openFrac = tc.opened ? clamp(easeOutBack(clamp(openedAge / 0.52, 0, 1)), 0, 1.06) : 0;

  const pal = tc.opened
    ? (TIER_PALETTES[tc.drop?.tier] || TIER_PALETTES.mythic)
    : tc.isMapVault
      ? { rgb: '255, 180, 48', hex: tc.beamColor || '#ff9524', light: '#fef3c7', trim: '#fbbf24' }
      : tc.chestTier === 'grotto'
        ? { rgb: '56, 189, 248', hex: '#38bdf8', light: '#e0f2fe', trim: '#7dd3fc' }
        : { rgb: '245, 158, 11', hex: '#f59e0b', light: '#fef3c7', trim: '#fbbf24' };

  const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3.6 + (tc.glintPhase || idx));
  const distM = diver ? Math.hypot(diver.x - tc.x, diver.y - tc.y) : 99;
  const flareAlpha = tc.opened ? Math.max(0, 1 - openedAge / spectacleDur) : (distM < 18 || tc.beaconRevealed ? 0.78 : 0.42);
  const wallAngle = Number.isFinite(tc.wallAngle) ? tc.wallAngle : 0;

  const sizeMult = tc.isMapVault ? 1.18 : 1.0;
  const cw = Math.max(16, 0.96 * scale * sizeMult);
  const ch = Math.max(11, 0.62 * scale * sizeMult);
  const dx3 = cw * 0.24; // 3D receding side width
  const dy3 = -ch * 0.18; // 3D receding depth lift
  const halfW = cw * 0.48;
  const rimY = -ch * 0.08;
  const botY = ch * 0.46;

  // 1. Volumetric God-Ray Light Cone & Discovery Shockwaves (aligned to chest outward wall normal!)
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(wallAngle);

  if (!tc.opened || openedAge < spectacleDur) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const tierScale = isLegendary ? 1.55 : isMythic ? 1.28 : tc.opened ? 1.06 : (tc.isMapVault ? 1.18 : 0.88);
    // When closed, keep the beacon subtle & clean unless map-revealed or close; erupt boldly when opened!
    const beamOpen = tc.opened ? easeOutCubic(clamp((openedAge - 0.08) / 0.42, 0, 1)) : 1;
    const pillarH = (tc.opened ? (7.5 + openedAge * 2.1) * tierScale * beamOpen : (2.4 + pulse * 0.8) * tierScale) * scale;
    const pillarW = (tc.opened ? (0.64 + (1 - flareAlpha) * 0.55) * tierScale : (0.28 + pulse * 0.06) * tierScale) * scale;

    if (pillarH > 4 && flareAlpha > 0.02) {
      const pg = ctx.createLinearGradient(0, rimY, 0, rimY - pillarH);
      pg.addColorStop(0, `rgba(255, 251, 235, ${(0.76 * flareAlpha).toFixed(3)})`);
      pg.addColorStop(0.18, `rgba(${pal.rgb}, ${(0.62 * flareAlpha).toFixed(3)})`);
      pg.addColorStop(0.55, `rgba(${pal.rgb}, ${(0.22 * flareAlpha).toFixed(3)})`);
      pg.addColorStop(1, `rgba(${pal.rgb}, 0)`);
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.moveTo(-halfW * 0.72, rimY);
      ctx.lineTo(-pillarW * 1.15, rimY - pillarH);
      ctx.lineTo(pillarW * 1.15, rimY - pillarH);
      ctx.lineTo(halfW * 0.72 + dx3 * 0.65, rimY + dy3 * 0.5);
      ctx.closePath();
      ctx.fill();

      // Fanning volumetric god-ray shafts erupting out of the open lid!
      if (tc.opened && openedAge > 0.08 && openedAge < spectacleDur * 0.9) {
        const fanAngles = isLegendary ? [-0.46, -0.22, 0.22, 0.46] : [-0.30, 0.30];
        for (let fi = 0; fi < fanAngles.length; fi++) {
          ctx.save();
          ctx.translate(dx3 * 0.25, rimY);
          ctx.rotate(fanAngles[fi] + Math.sin(timeSec * 2.6 + fi) * 0.045);
          ctx.fillStyle = pg;
          ctx.globalAlpha = (isLegendary ? 0.54 : 0.36) * flareAlpha * beamOpen;
          ctx.beginPath();
          ctx.moveTo(-cw * 0.22, 0);
          ctx.lineTo(-pillarW * 0.42, -pillarH * 0.84);
          ctx.lineTo(pillarW * 0.42, -pillarH * 0.84);
          ctx.lineTo(cw * 0.22, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // Soft radial cave-wall glow pool around chest
    const auraR = (tc.opened ? 2.6 * tierScale : (1.1 + pulse * 0.26) * tierScale) * scale;
    const ag = ctx.createRadialGradient(dx3 * 0.2, rimY, 0.08 * scale, dx3 * 0.2, rimY, auraR);
    ag.addColorStop(0, `rgba(${pal.rgb}, ${(0.62 * flareAlpha).toFixed(3)})`);
    ag.addColorStop(0.5, `rgba(${pal.rgb}, ${(0.18 * flareAlpha).toFixed(3)})`);
    ag.addColorStop(1, `rgba(${pal.rgb}, 0)`);
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(dx3 * 0.2, rimY, auraR, 0, Math.PI * 2);
    ctx.fill();

    // Latch-pop starburst + expanding discovery shockwave ring(s)
    if (tc.opened && openedAge < 2.2) {
      if (openedAge < 0.35) {
        const popA = 1 - openedAge / 0.35;
        const popR = (0.28 + openedAge * 2.8) * scale;
        ctx.fillStyle = `rgba(255, 253, 230, ${(0.92 * popA).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(0, rimY, popR, 0, Math.PI * 2);
        ctx.fill();
      }
      const prog = openedAge / 2.2;
      const ringR = (0.55 + prog * (isLegendary ? 9.5 : isMythic ? 7.6 : 6.0)) * scale;
      ctx.strokeStyle = `rgba(${pal.rgb}, ${((1 - prog) * 0.92).toFixed(3)})`;
      ctx.lineWidth = Math.max(2.0, (1 - prog) * (isLegendary ? 0.22 : 0.15) * scale);
      ctx.beginPath();
      ctx.arc(0, rimY, ringR, 0, Math.PI * 2);
      ctx.stroke();

      if ((isLegendary || isMythic) && openedAge > 0.25 && openedAge < 2.35) {
        const p2 = Math.min(1, (openedAge - 0.25) / 2.1);
        const r2 = (0.4 + p2 * (isLegendary ? 8.2 : 6.0)) * scale;
        ctx.strokeStyle = `rgba(254, 240, 138, ${((1 - p2) * 0.86).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.5, (1 - p2) * 0.12 * scale);
        ctx.beginPath();
        ctx.arc(0, rimY, r2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 2. High-Res Hyper-Real 3D Cave-Embedded Chest Sprite (with seamless open transition + fallback!)
  const chestKind = tc.isMapVault ? 'vault' : tc.chestTier === 'grotto' ? 'grotto' : 'brass';
  const closedImg = getHyperRealSprite(`chest-${chestKind}-closed`);
  const openImg = getHyperRealSprite(`chest-${chestKind}-open`);

  if (closedImg && openImg) {
    const sprW = cw * 1.44;
    const closedH = sprW * ((closedImg.naturalHeight || closedImg.height) / Math.max(1, closedImg.naturalWidth || closedImg.width));
    const openH = sprW * ((openImg.naturalHeight || openImg.height) / Math.max(1, openImg.naturalWidth || openImg.width));
    const baseLineY = botY + ch * 0.08;

    // Subtle open-pop spring bounce as the lid bursts open
    const springPulse = tc.opened && openedAge < 0.65 ? Math.sin(clamp(openedAge / 0.65, 0, 1) * Math.PI) : 0;
    const popScaleX = 1 + springPulse * 0.07;
    const popScaleY = 1 + springPulse * 0.11;

    ctx.save();
    ctx.translate(0, baseLineY);
    ctx.scale(popScaleX, popScaleY);
    ctx.translate(0, -baseLineY);

    if (!tc.opened) {
      ctx.drawImage(closedImg, -sprW * 0.5, baseLineY - closedH, sprW, closedH);
    } else if (openFrac < 0.44) {
      const blend = clamp((openFrac - 0.12) / 0.32, 0, 1);
      ctx.globalAlpha = 1 - blend * 0.72;
      ctx.drawImage(closedImg, -sprW * 0.5, baseLineY - closedH, sprW, closedH);
      ctx.globalAlpha = blend;
      ctx.drawImage(openImg, -sprW * 0.5, baseLineY - openH, sprW, openH);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(openImg, -sprW * 0.5, baseLineY - openH, sprW, openH);
    }

    // Subtle warm/rarity interior shimmer over the open chest mouth
    if (tc.opened) {
      const innerA = openedAge < spectacleDur ? (0.55 * flareAlpha + 0.12) : (0.18 + pulse * 0.1);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(${pal.rgb}, ${innerA.toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(0, baseLineY - openH * 0.44, sprW * 0.28, openH * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // Cave Rock & Sediment Embed Collar gripping the base (welds sprite physically into cave wall!)
    drawRockEmbedCollar(ctx, cw * 1.06, ch, timeSec, tc.glintPhase || idx);
  } else {
  // Procedural 3D fallback when sprites are still decoding or in headless Node tests
  const woodFront = tc.isMapVault ? '#5c2108' : tc.chestTier === 'grotto' ? '#1e3a5f' : '#5b3416';
  const woodSide = tc.isMapVault ? '#3b1305' : tc.chestTier === 'grotto' ? '#0f233d' : '#381f0c';
  const woodLid = tc.isMapVault ? '#7c2d12' : tc.chestTier === 'grotto' ? '#254d7a' : '#73441e';
  const metalCol = tc.isMapVault ? '#fde047' : tc.chestTier === 'grotto' ? '#7dd3fc' : '#f59e0b';
  const metalDark = tc.isMapVault ? '#ca8a04' : tc.chestTier === 'grotto' ? '#0284c7' : '#b45309';

  // 2a. Recessed 3D open interior & glowing treasure bed (visible behind open lid!)
  if (openFrac > 0.04) {
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.moveTo(-halfW, rimY);
    ctx.lineTo(-halfW + dx3, rimY + dy3);
    ctx.lineTo(halfW + dx3, rimY + dy3);
    ctx.lineTo(halfW, rimY);
    ctx.closePath();
    ctx.fill();

    // Inner blazing golden/rarity treasure glow pulsing softly even after spectacle ends!
    const innerAlpha = openedAge < spectacleDur ? (0.85 * flareAlpha + 0.15) : (0.28 + pulse * 0.12);
    ctx.fillStyle = `rgba(${pal.rgb}, ${innerAlpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(dx3 * 0.45, rimY + dy3 * 0.42, halfW * 0.72, ch * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2b. Solid 3D Articulated Curved Barrel Lid (pivoting smoothly around true back hinge — zero hollow crescent!)
  ctx.save();
  const hingeX = -halfW + dx3 * 0.6;
  const hingeY = rimY + dy3 * 0.6;
  const lidPitch = -openFrac * 0.96;
  ctx.translate(hingeX, hingeY);
  ctx.rotate(lidPitch);
  ctx.translate(-hingeX, -hingeY);

  const lidH = ch * 0.44;
  ctx.lineWidth = Math.max(1.2, 0.048 * scale);
  ctx.strokeStyle = metalDark;

  // Solid 3D barrel lid top/back shell (strictly non-self-intersecting convex hull!)
  ctx.fillStyle = woodLid;
  ctx.beginPath();
  ctx.moveTo(-halfW, rimY);
  ctx.lineTo(-halfW + dx3, rimY + dy3);
  ctx.quadraticCurveTo(-halfW + dx3, rimY + dy3 - lidH * 1.12, dx3, rimY + dy3 - lidH * 1.12);
  ctx.quadraticCurveTo(halfW + dx3, rimY + dy3 - lidH * 1.12, halfW + dx3, rimY + dy3);
  ctx.lineTo(halfW, rimY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Solid front arched wooden lid face (rich slightly lighter timber showing bevelled curvature)
  ctx.fillStyle = woodFront;
  ctx.beginPath();
  ctx.moveTo(-halfW, rimY);
  ctx.quadraticCurveTo(-halfW, rimY - lidH * 1.05, 0, rimY - lidH * 1.05);
  ctx.quadraticCurveTo(halfW, rimY - lidH * 1.05, halfW, rimY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Solid 3D receding right side arch cap (darker shaded depth plane!)
  ctx.fillStyle = woodSide;
  ctx.beginPath();
  ctx.moveTo(halfW, rimY);
  ctx.quadraticCurveTo(halfW + dx3 * 0.45, rimY - lidH * 0.85, halfW + dx3, rimY + dy3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Forged metal arched lid bands strictly hugging the solid front & top barrel vault!
  ctx.strokeStyle = metalCol;
  ctx.lineWidth = Math.max(1.6, cw * 0.088);
  for (const fx of [-0.62, 0.62]) {
    const bx = fx * halfW;
    ctx.beginPath();
    ctx.moveTo(bx, rimY);
    ctx.quadraticCurveTo(bx, rimY - lidH * 0.88, bx + dx3 * 0.85, rimY + dy3 - lidH * 0.78);
    ctx.stroke();
  }
  // Upper front rim molding & lock hasp riding cleanly UP with the opening lid!
  ctx.fillStyle = metalCol;
  ctx.fillRect(-halfW, rimY - Math.max(1.4, ch * 0.065), cw * 0.96, Math.max(1.4, ch * 0.065));
  ctx.fillRect(-cw * 0.065, rimY - ch * 0.14, cw * 0.13, ch * 0.16);
  ctx.restore();

  // 2c. 3D Receding Right Side Face of Lower Chest Body
  ctx.fillStyle = woodSide;
  ctx.strokeStyle = metalDark;
  ctx.lineWidth = Math.max(1.2, 0.048 * scale);
  ctx.beginPath();
  ctx.moveTo(halfW, rimY);
  ctx.lineTo(halfW + dx3, rimY + dy3);
  ctx.lineTo(halfW + dx3, botY + dy3);
  ctx.lineTo(halfW, botY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Side forged iron handle ring on 3D side face
  if (cw >= 16) {
    ctx.strokeStyle = metalCol;
    ctx.lineWidth = Math.max(1.1, cw * 0.045);
    ctx.beginPath();
    ctx.ellipse(halfW + dx3 * 0.52, (rimY + botY) * 0.5 + dy3 * 0.5, cw * 0.06, ch * 0.12, 0.15, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 2d. 3D Front Body Face with weathered horizontal planks & riveted corner straps
  ctx.fillStyle = woodFront;
  ctx.strokeStyle = metalDark;
  ctx.beginPath();
  ctx.rect(-halfW, rimY, cw * 0.96, botY - rimY);
  ctx.fill();
  ctx.stroke();

  // Horizontal oak plank seams
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.42)';
  ctx.lineWidth = Math.max(0.8, 0.028 * scale);
  const midBodyY = (rimY + botY) * 0.5;
  ctx.beginPath();
  ctx.moveTo(-halfW + 1, midBodyY);
  ctx.lineTo(halfW - 1, midBodyY);
  ctx.stroke();

  // Twin vertical forged brass/gold lower straps (STRICTLY bounded to front body — zero floating!)
  ctx.fillStyle = metalCol;
  const strapW = Math.max(1.6, cw * 0.09);
  ctx.fillRect(-halfW * 0.62 - strapW * 0.5, rimY, strapW, botY - rimY);
  ctx.fillRect(halfW * 0.62 - strapW * 0.5, rimY, strapW, botY - rimY);
  // Top & bottom rim trim
  ctx.fillRect(-halfW, rimY, cw * 0.96, Math.max(1.4, ch * 0.075));

  // Heavy 3D front escutcheon lockplate + keyhole glow
  const lockW = Math.max(4, cw * 0.18);
  const lockH = Math.max(4, ch * 0.28);
  ctx.fillStyle = metalCol;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = Math.max(0.8, 0.03 * scale);
  ctx.beginPath();
  ctx.roundRect?.(-lockW * 0.5, rimY + ch * 0.02, lockW, lockH, 2) ??
    ctx.rect(-lockW * 0.5, rimY + ch * 0.02, lockW, lockH);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tc.opened ? pal.light : '#0f172a';
  ctx.beginPath();
  ctx.arc(0, rimY + ch * 0.14, Math.max(1.3, cw * 0.038), 0, Math.PI * 2);
  ctx.fill();

  // 2e. Cave Rock & Sediment Embed Collar gripping the base (drawn OVER lower bottom edge!)
  drawRockEmbedCollar(ctx, cw, ch, timeSec, tc.glintPhase || idx);
  }

  // Subtle sweeping glint when closed
  if (!tc.opened && cw >= 14) {
    const glint = Math.pow(Math.max(0, Math.sin(timeSec * 2.5 + (tc.glintPhase || idx))), 6);
    if (glint > 0.15) {
      ctx.fillStyle = `rgba(255, 251, 235, ${(glint * 0.78).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(-halfW * 0.25, rimY - ch * 0.16, Math.max(1.8, cw * 0.09 * glint), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // 3. Rising Illuminated Item Medallion & Shimmering Motes (in upright screen space above open chest!)
  if (tc.opened && openedAge < spectacleDur) {
    const nx = Number.isFinite(tc.wallNx) ? tc.wallNx : 0;
    const ny = Number.isFinite(tc.wallNy) ? tc.wallNy : -1;
    // Rise smoothly outward from the chest mouth + drift gently upward with buoyancy
    const rise = easeOutCubic(clamp((openedAge - 0.14) / 0.72, 0, 1));
    const fadeOut = openedAge > spectacleDur - 1.1 ? Math.max(0, (spectacleDur - openedAge) / 1.1) : 1;
    const holoX = sx + nx * (0.45 + rise * 0.95) * scale;
    const holoY = sy + ny * (0.45 + rise * 0.95) * scale - rise * 1.15 * scale + Math.sin(timeSec * 3.6) * 0.09 * scale;

    ctx.save();
    // Rising gold/rarity motes streaming upward out of the open chest
    const moteCount = isLegendary ? 14 : isMythic ? 10 : 7;
    for (let mi = 0; mi < moteCount; mi++) {
      const mp = (openedAge * 0.58 + mi / moteCount) % 1;
      const mx = sx + nx * 0.35 * scale + Math.sin(timeSec * 3.2 + mi * 2.1) * (0.35 + mp * 1.15) * scale;
      const my = sy + ny * 0.25 * scale - (0.25 + mp * (isLegendary ? 5.2 : 3.6)) * scale;
      const mr = Math.max(1.4, (1 - mp) * (isLegendary ? 3.8 : 2.6));
      ctx.fillStyle = mi % 2 === 0 ? pal.light : pal.hex;
      ctx.globalAlpha = (1 - mp) * flareAlpha * 0.9;
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Floating holographic item medallion + crisp rarity pill
    if (tc.drop && openedAge > 0.16) {
      ctx.globalAlpha = fadeOut * clamp((openedAge - 0.16) / 0.25, 0, 1);
      const discR = Math.max(13, (isLegendary ? 0.56 : 0.46) * scale);

      // Rotating dashed rarity halo behind medallion
      ctx.save();
      ctx.translate(holoX, holoY);
      ctx.rotate(timeSec * (isLegendary ? 1.8 : 1.1));
      ctx.strokeStyle = `rgba(${pal.rgb}, 0.85)`;
      ctx.lineWidth = Math.max(1.5, 0.055 * scale);
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, discR * 1.32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      ctx.fillStyle = 'rgba(7, 14, 28, 0.92)';
      ctx.strokeStyle = pal.hex;
      ctx.lineWidth = isLegendary ? 2.4 : 1.8;
      ctx.beginPath();
      ctx.arc(holoX, holoY, discR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = `${Math.round(discR * 1.12)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tc.drop.icon || '🧰', holoX, holoY + 1);

      const topTxt =
        tc.drop.kind === 'gear'
          ? `${isLegendary ? '🔥 LEGENDARY · ' : `${(tc.drop.tier || 'rare').toUpperCase()} · `}${tc.drop.name}`
          : `${tc.drop.icon || '🪙'} ${tc.drop.name}`;
      ctx.font = '800 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
      const tw = ctx.measureText(topTxt).width + 14;
      const ly = holoY - discR - 13;
      ctx.fillStyle = isLegendary ? 'rgba(67, 20, 7, 0.94)' : 'rgba(10, 16, 28, 0.92)';
      ctx.strokeStyle = pal.hex;
      ctx.lineWidth = isLegendary ? 1.5 : 1.15;
      ctx.beginPath();
      ctx.roundRect?.(holoX - tw * 0.5, ly - 9, tw, 18, 8) ?? ctx.rect(holoX - tw * 0.5, ly - 9, tw, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = pal.light;
      ctx.fillText(topTxt, holoX, ly);
    }
    ctx.restore();
  }

  // 4. Clean proximity badge when closed (never clutters far-away screen)
  if (!tc.opened && (distM <= 12 + rigGlowBonus || tc.beaconRevealed)) {
    const label = tc.isMapVault ? `👑 ${tc.name.toUpperCase()}` : tc.chestTier === 'grotto' ? '💠 GROTTO CHEST' : '🧰 TREASURE CHEST';
    ctx.save();
    ctx.font = '800 9px ui-monospace, SFMono-Regular, Menlo, monospace';
    const tw = ctx.measureText(label).width + 12;
    const ly = sy - ch * 0.85 - 12;
    ctx.fillStyle = 'rgba(12, 16, 26, 0.88)';
    ctx.strokeStyle = pal.hex;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.roundRect?.(sx - tw * 0.5, ly - 8, tw, 16, 7) ?? ctx.rect(sx - tw * 0.5, ly - 8, tw, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = pal.light;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, sx, ly);
    ctx.restore();
  }
}

/**
 * Draw a 3D Cave-Embedded Armored Expedition Pelican Gear Case (`worldGearCaches`) with hinged
 * lid opening animation, volumetric rarity light beam, and persistent open state in the rock wall!
 */
export function drawEmbeddedGearCache3D(ctx, gc, sx, sy, scale, timeSec, diver, rigGlowBonus = 0, idx = 0) {
  const pal = TIER_PALETTES[gc.tier] || TIER_PALETTES.rare;
  const openedAge = gc.opened ? Math.max(0, timeSec - (gc.openedAt || 0)) : 0;
  const spectacleDur = 4.2;
  const openFrac = gc.opened ? clamp(easeOutBack(clamp(openedAge / 0.48, 0, 1)), 0, 1.04) : 0;
  const pulse = 0.5 + 0.5 * Math.sin(timeSec * 4.0 + idx);
  const flareAlpha = gc.opened ? Math.max(0, 1 - openedAge / spectacleDur) : 0.86;
  const wallAngle = Number.isFinite(gc.wallAngle) ? gc.wallAngle : 0;

  const cw = Math.max(15, 0.88 * scale);
  const ch = Math.max(10, 0.54 * scale);
  const dx3 = cw * 0.22;
  const dy3 = -ch * 0.16;
  const halfW = cw * 0.48;
  const rimY = -ch * 0.04;
  const botY = ch * 0.44;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(wallAngle);

  // Volumetric rarity beam (subtle when closed, blazing cone on open!)
  if (!gc.opened || openedAge < spectacleDur) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const pillarH = (gc.opened ? 7.8 + openedAge * 2.0 : 3.2 + pulse * 1.0) * scale;
    const pillarW = (gc.opened ? 0.54 + (1 - flareAlpha) * 0.48 : 0.28 + pulse * 0.06) * scale;
    const pg = ctx.createLinearGradient(0, rimY, 0, rimY - pillarH);
    pg.addColorStop(0, `rgba(255, 255, 255, ${(0.68 * flareAlpha).toFixed(3)})`);
    pg.addColorStop(0.22, `rgba(${pal.rgb}, ${(0.58 * flareAlpha).toFixed(3)})`);
    pg.addColorStop(1, `rgba(${pal.rgb}, 0)`);
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.moveTo(-halfW * 0.68, rimY);
    ctx.lineTo(-pillarW, rimY - pillarH);
    ctx.lineTo(pillarW, rimY - pillarH);
    ctx.lineTo(halfW * 0.68 + dx3 * 0.6, rimY + dy3 * 0.5);
    ctx.closePath();
    ctx.fill();

    if (gc.opened && openedAge < 1.8) {
      const prog = openedAge / 1.8;
      ctx.strokeStyle = `rgba(${pal.rgb}, ${((1 - prog) * 0.9).toFixed(3)})`;
      ctx.lineWidth = Math.max(1.8, (1 - prog) * 0.14 * scale);
      ctx.beginPath();
      ctx.arc(0, rimY, (0.55 + prog * 6.2) * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  const cacheClosedImg = getHyperRealSprite('gearcache-closed');
  const cacheOpenImg = getHyperRealSprite('gearcache-open');

  if (cacheClosedImg && cacheOpenImg) {
    const sprW = cw * 1.46;
    const closedH = sprW * ((cacheClosedImg.naturalHeight || cacheClosedImg.height) / Math.max(1, cacheClosedImg.naturalWidth || cacheClosedImg.width));
    const openH = sprW * ((cacheOpenImg.naturalHeight || cacheOpenImg.height) / Math.max(1, cacheOpenImg.naturalWidth || cacheOpenImg.width));
    const baseLineY = botY + ch * 0.08;
    const springPulse = gc.opened && openedAge < 0.58 ? Math.sin(clamp(openedAge / 0.58, 0, 1) * Math.PI) : 0;

    ctx.save();
    ctx.translate(0, baseLineY);
    ctx.scale(1 + springPulse * 0.06, 1 + springPulse * 0.1);
    ctx.translate(0, -baseLineY);
    if (!gc.opened) {
      ctx.drawImage(cacheClosedImg, -sprW * 0.5, baseLineY - closedH, sprW, closedH);
    } else if (openFrac < 0.42) {
      const blend = clamp((openFrac - 0.1) / 0.32, 0, 1);
      ctx.globalAlpha = 1 - blend * 0.72;
      ctx.drawImage(cacheClosedImg, -sprW * 0.5, baseLineY - closedH, sprW, closedH);
      ctx.globalAlpha = blend;
      ctx.drawImage(cacheOpenImg, -sprW * 0.5, baseLineY - openH, sprW, openH);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(cacheOpenImg, -sprW * 0.5, baseLineY - openH, sprW, openH);
    }
    // Rarity LED glow accent on case front / interior
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(${pal.rgb}, ${(0.48 + pulse * 0.28).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(0, baseLineY - (gc.opened ? openH * 0.42 : closedH * 0.36), sprW * 0.22, ch * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();

    drawRockEmbedCollar(ctx, cw * 1.06, ch, timeSec, idx + 3);
  } else {
  // Open interior padded foam & glowing gear bay
  if (openFrac > 0.04) {
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.moveTo(-halfW, rimY);
    ctx.lineTo(-halfW + dx3, rimY + dy3);
    ctx.lineTo(halfW + dx3, rimY + dy3);
    ctx.lineTo(halfW, rimY);
    ctx.closePath();
    ctx.fill();

    const innerA = openedAge < spectacleDur ? (0.85 * flareAlpha + 0.15) : (0.25 + pulse * 0.1);
    ctx.fillStyle = `rgba(${pal.rgb}, ${innerA.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(dx3 * 0.45, rimY + dy3 * 0.45, halfW * 0.72, ch * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3D Hinged Pelican Lid
  ctx.save();
  const hingeX = -halfW + dx3;
  const hingeY = rimY + dy3;
  ctx.translate(hingeX, hingeY);
  ctx.rotate(-openFrac * 1.15);
  ctx.translate(-hingeX, -hingeY);

  const lidH = ch * 0.30;
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = pal.hex;
  ctx.lineWidth = Math.max(1.2, 0.045 * scale);
  ctx.beginPath();
  ctx.moveTo(-halfW, rimY);
  ctx.lineTo(-halfW, rimY - lidH);
  ctx.lineTo(halfW, rimY - lidH);
  ctx.lineTo(halfW + dx3, rimY + dy3 - lidH);
  ctx.lineTo(halfW + dx3, rimY + dy3);
  ctx.lineTo(halfW, rimY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Molded lid top plane
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(-halfW, rimY - lidH);
  ctx.lineTo(-halfW + dx3, rimY + dy3 - lidH);
  ctx.lineTo(halfW + dx3, rimY + dy3 - lidH);
  ctx.lineTo(halfW, rimY - lidH);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 3D Side & Front Armored Case Body
  ctx.fillStyle = '#0b1324';
  ctx.strokeStyle = pal.trim;
  ctx.lineWidth = Math.max(1.1, 0.045 * scale);
  ctx.beginPath();
  ctx.moveTo(halfW, rimY);
  ctx.lineTo(halfW + dx3, rimY + dy3);
  ctx.lineTo(halfW + dx3, botY + dy3);
  ctx.lineTo(halfW, botY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.rect(-halfW, rimY, cw * 0.96, botY - rimY);
  ctx.fill();
  ctx.stroke();

  // Structural case ribs + twin tactical cam latches + glowing status LED
  ctx.fillStyle = pal.hex;
  ctx.fillRect(-halfW * 0.62, rimY, cw * 0.11, botY - rimY);
  ctx.fillRect(halfW * 0.42, rimY, cw * 0.11, botY - rimY);
  ctx.fillStyle = pal.light;
  ctx.beginPath();
  ctx.arc(0, (rimY + botY) * 0.5, Math.max(1.8, cw * 0.07), 0, Math.PI * 2);
  ctx.fill();

  drawRockEmbedCollar(ctx, cw, ch, timeSec, idx + 3);
  }
  ctx.restore();

  // Rising gear icon medallion on open!
  if (gc.opened && openedAge > 0.12 && openedAge < spectacleDur) {
    const rise = easeOutCubic(clamp((openedAge - 0.12) / 0.68, 0, 1));
    const fadeOut = openedAge > spectacleDur - 1.0 ? Math.max(0, (spectacleDur - openedAge) / 1.0) : 1;
    const holoY = sy - (0.55 + rise * 1.65) * scale;
    const discR = Math.max(12, 0.42 * scale);
    ctx.save();
    ctx.globalAlpha = fadeOut;
    ctx.fillStyle = 'rgba(7, 14, 28, 0.92)';
    ctx.strokeStyle = pal.hex;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(sx, holoY, discR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = `${Math.round(discR * 1.1)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(gc.icon || '📦', sx, holoY + 1);
    ctx.restore();
  }

  // Clean proximity label when closed
  const distM = diver ? Math.hypot(diver.x - gc.x, diver.y - gc.y) : 99;
  if (!gc.opened && distM <= 13 + rigGlowBonus) {
    const label = `${gc.icon || '📦'} GEAR CACHE · ${String(gc.tier || 'rare').toUpperCase()}`;
    ctx.save();
    ctx.font = '800 9px ui-monospace, SFMono-Regular, Menlo, monospace';
    const tw = ctx.measureText(label).width + 12;
    const ly = sy - ch * 0.85 - 12;
    ctx.fillStyle = 'rgba(7, 18, 34, 0.88)';
    ctx.strokeStyle = pal.hex;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.roundRect?.(sx - tw * 0.5, ly - 8, tw, 16, 7) ?? ctx.rect(sx - tw * 0.5, ly - 8, tw, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = pal.light;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, sx, ly);
    ctx.restore();
  }
}

/**
 * Draw an authentic 3D rigged expedition salvage basket / cargo cradle suspended below the
 * lift-bag's stainless harness D-ring, cradling crisp miniatures of the diver's actual collected
 * artifacts inside a braided yellow nylon cargo net (replacing the weird brown orb!).
 */
export function drawRiggedSalvageCradle(ctx, anchorX, anchorY, swayX, scale, timeSec, payloadKg, collectedItems = null) {
  const pendSway = Math.sin(timeSec * 2.35) * 0.065 + swayX * 0.34;
  const tetherLen = 0.58 * scale;
  const cx = anchorX + pendSway * scale;
  const cy = anchorY + tetherLen;
  const sizeFactor = clamp(0.84 + (payloadKg / 28) * 0.30, 0.84, 1.14);
  const bw = Math.max(12, 0.56 * scale * sizeFactor);
  const bh = Math.max(9, 0.38 * scale * sizeFactor);
  const dx3 = bw * 0.22;
  const dy3 = -bh * 0.18;

  ctx.save();

  // 1. Twin V-rigged yellow nylon lifting straps from diver's hip D-ring shackle down to crate corners
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.90)';
  ctx.lineWidth = Math.max(1.2, 0.044 * scale);
  ctx.beginPath();
  ctx.moveTo(anchorX, anchorY);
  ctx.lineTo(cx - bw * 0.44, cy - bh * 0.36);
  ctx.moveTo(anchorX, anchorY);
  ctx.lineTo(cx + bw * 0.44 + dx3 * 0.4, cy - bh * 0.36 + dy3 * 0.4);
  ctx.stroke();

  // Stainless steel quick-link shackle at bridle apex
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(anchorX, anchorY, Math.max(1.8, 0.065 * scale), 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(cx, cy);
  ctx.rotate(clamp(-pendSway * 0.42, -0.24, 0.24));

  // 2. Dark interior cavity of the recovery basket
  ctx.fillStyle = '#0b1322';
  ctx.beginPath();
  ctx.moveTo(-bw * 0.5, -bh * 0.34);
  ctx.lineTo(-bw * 0.5 + dx3, -bh * 0.34 + dy3);
  ctx.lineTo(bw * 0.5 + dx3, -bh * 0.34 + dy3);
  ctx.lineTo(bw * 0.5, -bh * 0.34);
  ctx.closePath();
  ctx.fill();

  // 3. Render up to 3 actual collected artifacts nestled inside the open recovery cradle!
  const items = Array.isArray(collectedItems) && collectedItems.length > 0 ? collectedItems : null;
  if (items) {
    const shown = items.slice(-3);
    const artR = Math.max(4.5, bh * 0.38);
    for (let i = 0; i < shown.length; i++) {
      const spread = shown.length === 1 ? 0 : (i / (shown.length - 1) - 0.5) * bw * 0.56;
      const ax = spread + dx3 * 0.25;
      const ay = -bh * 0.34 + (i === 1 ? -bh * 0.14 : -bh * 0.06);
      drawStyledArtifact(ctx, shown[i], ax, ay, artR, timeSec, { highlight: false });
    }
  } else {
    // Fallback gleaming brass salvage cylinder / recovery ingot nestled in cradle
    ctx.fillStyle = '#d97706';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = Math.max(0.8, 0.03 * scale);
    ctx.beginPath();
    ctx.roundRect?.(-bw * 0.34, -bh * 0.52, bw * 0.68, bh * 0.28, 3) ??
      ctx.rect(-bw * 0.34, -bh * 0.52, bw * 0.68, bh * 0.28);
    ctx.fill();
    ctx.stroke();
  }

  // 4. 3D Slatted Anodized Salvage Recovery Crate (front + receding depth side!)
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = Math.max(1.1, 0.04 * scale);
  // 3D receding right side wall
  ctx.beginPath();
  ctx.moveTo(bw * 0.5, -bh * 0.34);
  ctx.lineTo(bw * 0.5 + dx3, -bh * 0.34 + dy3);
  ctx.lineTo(bw * 0.5 + dx3, bh * 0.44 + dy3);
  ctx.lineTo(bw * 0.5, bh * 0.44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Front slatted crate panel
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.roundRect?.(-bw * 0.5, -bh * 0.34, bw, bh * 0.78, Math.max(1.5, 0.05 * scale)) ??
    ctx.rect(-bw * 0.5, -bh * 0.34, bw, bh * 0.78);
  ctx.fill();
  ctx.stroke();

  // Criss-crossed translucent yellow nylon diamond cargo net cinching the relics tightly!
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.76)';
  ctx.lineWidth = Math.max(0.85, 0.03 * scale);
  ctx.beginPath();
  ctx.moveTo(-bw * 0.44, -bh * 0.44);
  ctx.lineTo(bw * 0.14, bh * 0.38);
  ctx.moveTo(-bw * 0.12, -bh * 0.44);
  ctx.lineTo(bw * 0.44, bh * 0.38);
  ctx.moveTo(bw * 0.44, -bh * 0.44);
  ctx.lineTo(-bw * 0.14, bh * 0.38);
  ctx.moveTo(bw * 0.12, -bh * 0.44);
  ctx.lineTo(-bw * 0.44, bh * 0.38);
  ctx.stroke();

  // Horizontal heavy cinch band + reflective yellow corner bumpers
  ctx.fillStyle = '#facc15';
  ctx.fillRect(-bw * 0.5, bh * 0.02, bw, Math.max(1.5, bh * 0.14));
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-bw * 0.52, -bh * 0.36, bw * 0.12, bh * 0.14);
  ctx.fillRect(bw * 0.40, -bh * 0.36, bw * 0.12, bh * 0.14);

  ctx.restore();
}
