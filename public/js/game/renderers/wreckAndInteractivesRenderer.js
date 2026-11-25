import { evaluateCaveSDF } from '../collision.js';
import { isHatchPressurized } from '../salvagePhysics.js';
import { computeSurgeWave } from '../diveSession.js';

export const wreckAndInteractivesMethods = {
  _drawWreckSurfaceBoat(ctx, visX0, visX1, toScreenX, toScreenY, scale, timeSec) {
    const boatX = this.level.spawn?.x ?? 0;
    if (boatX + 14 < visX0 || boatX - 14 > visX1) return;
    const bobY = Math.sin(timeSec * 1.7) * 0.14;
    const pitch = Math.sin(timeSec * 1.35 + 0.6) * 0.022;
    const bx = toScreenX(boatX);
    const by = toScreenY(bobY);
    const surfY = toScreenY(0);

    const boatImg = this._getSurfaceProp('boat');
    if (boatImg) {
      const iw = boatImg.naturalWidth || boatImg.width;
      const ih = boatImg.naturalHeight || boatImg.height;
      const bw = 12.2 * scale;
      const bh = bw * (ih / iw);
      const hullDraftY = bh * 0.23; // Submerge bottom ~23% (keel + ladder rungs) below waterline

      ctx.save();
      // 1. Live vertically-flipped rippled water reflection synchronized with hull bob & pitch
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx - bw * 0.65, surfY, bw * 1.3, bh * 0.85);
      ctx.clip();
      const bobDelta = by - surfY;
      ctx.translate(bx, surfY - bobDelta * 0.52);
      ctx.scale(1, -0.52);
      ctx.rotate(pitch);
      ctx.globalAlpha = 0.24;
      const rippleShift = Math.sin(timeSec * 2.8) * 0.12 * scale;
      ctx.drawImage(boatImg, -bw * 0.5 + rippleShift, -bh + hullDraftY, bw, bh);
      ctx.restore();

      // Soft dark ambient hull shadow under the keel
      ctx.fillStyle = 'rgba(2, 12, 26, 0.42)';
      ctx.beginPath();
      ctx.ellipse(bx, surfY + 0.45 * scale, bw * 0.44, 0.46 * scale, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Photorealistic Technical Dive Charter Boat rocking on ocean swell
      ctx.translate(bx, by);
      ctx.rotate(pitch);
      ctx.drawImage(boatImg, -bw * 0.5, -bh + hullDraftY, bw, bh);
      ctx.restore();

      // 3. Animated white sea-foam & waterline lapping ripples across hull beam
      ctx.save();
      ctx.strokeStyle = 'rgba(241, 248, 255, 0.62)';
      ctx.lineWidth = Math.max(1.2, 0.065 * scale);
      ctx.lineCap = 'round';
      for (let w = -3; w <= 3; w++) {
        const ox = bx + w * 1.35 * scale + Math.sin(timeSec * 2.4 + w * 1.3) * 0.18 * scale;
        const oy = surfY + Math.sin(timeSec * 3.1 + w) * 0.05 * scale;
        const len = (0.45 + Math.abs(Math.cos(w * 0.9 + timeSec * 1.5)) * 0.48) * scale;
        ctx.beginPath();
        ctx.moveTo(ox - len * 0.5, oy);
        ctx.lineTo(ox + len * 0.5, oy);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(pitch);

    // Soft dark hull reflection in water beneath the charter vessel
    ctx.fillStyle = 'rgba(2, 12, 26, 0.42)';
    ctx.beginPath();
    ctx.ellipse(0, 0.55 * scale, 5.4 * scale, 0.55 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main dive boat hull (deep-water fiberglass charter boat, ~10m long)
    ctx.fillStyle = '#0f2942';
    ctx.beginPath();
    ctx.moveTo(-4.8 * scale, 0.35 * scale);
    ctx.lineTo(4.6 * scale, 0.35 * scale);
    ctx.lineTo(5.6 * scale, -0.75 * scale);
    ctx.lineTo(-4.9 * scale, -0.65 * scale);
    ctx.closePath();
    ctx.fill();

    // White upper freeboard & cyan sheer stripe
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(-4.9 * scale, -0.1 * scale);
    ctx.lineTo(5.15 * scale, -0.1 * scale);
    ctx.lineTo(5.65 * scale, -0.95 * scale);
    ctx.lineTo(-4.95 * scale, -0.82 * scale);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0284c7';
    ctx.fillRect(-4.85 * scale, -0.42 * scale, 10.1 * scale, 0.18 * scale);

    // Wheelhouse cabin & warm lit bridge windows
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-1.3 * scale, -2.25 * scale, 4.1 * scale, 1.42 * scale);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-0.9 * scale, -2.0 * scale, 3.25 * scale, 0.68 * scale);
    ctx.fillStyle = 'rgba(253, 224, 71, 0.42)';
    ctx.fillRect(0.6 * scale, -1.94 * scale, 1.55 * scale, 0.56 * scale);

    // Cabin roof, radar mast & beacon light
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-1.55 * scale, -2.38 * scale, 4.55 * scale, 0.16 * scale);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = Math.max(1.5, 0.08 * scale);
    ctx.beginPath();
    ctx.moveTo(0.8 * scale, -2.38 * scale);
    ctx.lineTo(0.45 * scale, -3.75 * scale);
    ctx.stroke();

    // Fluttering red-and-white Diver Down flag on stern staff
    const flagWave = Math.sin(timeSec * 5.2) * 0.12 * scale;
    const fx = -3.8 * scale;
    const fy = -2.45 * scale;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = Math.max(1.2, 0.06 * scale);
    ctx.beginPath();
    ctx.moveTo(fx, -0.82 * scale);
    ctx.lineTo(fx, fy - 0.1 * scale);
    ctx.stroke();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx - 1.1 * scale, fy + 0.08 * scale + flagWave);
    ctx.lineTo(fx - 1.1 * scale, fy + 0.72 * scale + flagWave);
    ctx.lineTo(fx, fy + 0.68 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.6, 0.11 * scale);
    ctx.beginPath();
    ctx.moveTo(fx - 0.05 * scale, fy + 0.05 * scale);
    ctx.lineTo(fx - 1.05 * scale, fy + 0.66 * scale + flagWave);
    ctx.stroke();

    // Stern dive platform & boarding ladder descending into open water
    ctx.fillStyle = '#475569';
    ctx.fillRect(-5.45 * scale, -0.12 * scale, 0.7 * scale, 0.22 * scale);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = Math.max(1.5, 0.075 * scale);
    ctx.beginPath();
    ctx.moveTo(-5.15 * scale, 0.08 * scale);
    ctx.lineTo(-5.35 * scale, 1.85 * scale);
    ctx.moveTo(-4.75 * scale, 0.08 * scale);
    ctx.lineTo(-4.95 * scale, 1.85 * scale);
    for (let r = 0; r < 4; r++) {
      const ry = (0.42 + r * 0.38) * scale;
      ctx.moveTo(-5.2 * scale, ry);
      ctx.lineTo(-4.8 * scale, ry);
    }
    ctx.stroke();

    ctx.restore();
  },

  _drawWreckShipArchitecture(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec) {
    const level = this.level;
    const deckY = level.wreckDeckY ?? 42;
    const seabedY = level.wreckSeabedY ?? 70;
    const hMin = level.wreckHullXMin ?? -24;
    const hMax = level.wreckHullXMax ?? 96;
    if (hMax + 18 < visX0 || hMin - 18 > visX1 || seabedY + 8 < visY0 || deckY - 24 > visY1) return;

    const profile = level.shipProfile || 'default';
    ctx.save();

    if (profile === 'victoria-vertical-battleship') {
      // Dramatic vertical Victorian ironclad battleship spire standing nose-down from 74m to 145m!
      const xL = toScreenX(hMin);
      const xR = toScreenX(hMax);
      const yTop = toScreenY(deckY);
      const yBot = toScreenY(seabedY);
      // Armored steel hull plating band & rivet lines along vertical column
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
      ctx.lineWidth = Math.max(1.2, 0.08 * scale);
      for (let wy = Math.ceil(deckY / 6) * 6; wy <= seabedY; wy += 6) {
        if (wy < visY0 - 2 || wy > visY1 + 2) continue;
        const sy = toScreenY(wy);
        ctx.beginPath();
        ctx.moveTo(xL, sy);
        ctx.lineTo(xR, sy);
        ctx.stroke();
      }
      // Armored casemate gun ports along both outer sides of the vertical spire
      for (let wy = deckY + 14; wy <= seabedY - 12; wy += 10) {
        if (wy < visY0 - 3 || wy > visY1 + 3) continue;
        const sy = toScreenY(wy);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(xL - 0.5 * scale, sy - 0.55 * scale, 1.4 * scale, 1.1 * scale);
        ctx.fillRect(xR - 0.9 * scale, sy - 0.55 * scale, 1.4 * scale, 1.1 * scale);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = Math.max(1, 0.06 * scale);
        ctx.strokeRect(xL - 0.5 * scale, sy - 0.55 * scale, 1.4 * scale, 1.1 * scale);
        ctx.strokeRect(xR - 0.9 * scale, sy - 0.55 * scale, 1.4 * scale, 1.1 * scale);
      }
      // Upright stern keel rudder blade rising into the blue above 74m
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = Math.max(1.2, 0.09 * scale);
      ctx.beginPath();
      ctx.moveTo(toScreenX(22), yTop);
      ctx.lineTo(toScreenX(25.5), yTop);
      ctx.lineTo(toScreenX(24.8), toScreenY(deckY - 6.5));
      ctx.lineTo(toScreenX(21.8), toScreenY(deckY - 5.2));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Standard horizontal/capsized/split hull silhouette backdrop & bow/stern prow shapes
    const xBow = toScreenX(hMin);
    const xStern = toScreenX(hMax);
    const yDeck = toScreenY(deckY);
    const yBase = toScreenY(seabedY);
    const hullH = Math.max(4, yBase - yDeck);

    // Raked Steel Bow Prow jutting into the deep blue at left end
    if (hMin + 10 >= visX0 && hMin - 18 <= visX1) {
      const bowCol =
        profile === 'fitzgerald-split-freighter'
          ? '#6e2321'
          : profile === 'britannic-hospital-liner'
            ? '#cbd5e1'
            : profile === 'andrea-doria-capsized'
              ? '#334155'
              : '#3b4a5e';
      ctx.fillStyle = bowCol;
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.moveTo(xBow + 2 * scale, yDeck);
      ctx.lineTo(xBow - 9.5 * scale, yDeck - 1.8 * scale);
      ctx.quadraticCurveTo(xBow - 5.5 * scale, yDeck + hullH * 0.55, xBow + 1.5 * scale, yBase);
      ctx.closePath();
      ctx.fill();
      // Anti-fouling red oxide lower bow hull stripe
      ctx.fillStyle = '#7f1d1d';
      ctx.globalAlpha = 0.58;
      ctx.beginPath();
      ctx.moveTo(xBow - 5.2 * scale, yDeck + hullH * 0.55);
      ctx.lineTo(xBow + 2 * scale, yDeck + hullH * 0.55);
      ctx.lineTo(xBow + 2 * scale, yBase);
      ctx.lineTo(xBow - 1.2 * scale, yBase);
      ctx.closePath();
      ctx.fill();
      // Hawsepipe oval & Plimsoll draft marks
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(xBow - 3.6 * scale, yDeck + 2.4 * scale, 0.7 * scale, 0.45 * scale, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = Math.max(1.2, 0.08 * scale);
      ctx.stroke();
    }

    // Counter-stern overhang & rudder post at right end
    if (hMax + 18 >= visX0 && hMax - 10 <= visX1) {
      ctx.fillStyle = profile === 'fitzgerald-split-freighter' ? '#6e2321' : '#334155';
      ctx.globalAlpha = 0.68;
      ctx.beginPath();
      ctx.moveTo(xStern - 2 * scale, yDeck);
      ctx.lineTo(xStern + 7.5 * scale, yDeck - 0.6 * scale);
      ctx.quadraticCurveTo(xStern + 4.5 * scale, yDeck + hullH * 0.45, xStern - 1.5 * scale, yBase);
      ctx.closePath();
      ctx.fill();
    }

    // Ship-specific iconic exterior livery & superstructure details
    ctx.globalAlpha = 1;
    if (profile === 'oriskany-carrier') {
      // Flight Deck angled yellow/white catapult tracks & deck edge stripes
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.42)';
      ctx.lineWidth = Math.max(2, 0.14 * scale);
      ctx.setLineDash([1.6 * scale, 1.1 * scale]);
      ctx.beginPath();
      ctx.moveTo(xBow, yDeck - 0.25 * scale);
      ctx.lineTo(xStern, yDeck - 0.25 * scale);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (profile === 'britannic-hospital-liner') {
      // Iconic HMHS Britannic faded green hospital stripe & Red Cross hull emblem
      const stripeY = yDeck + 3.2 * scale;
      ctx.fillStyle = 'rgba(22, 163, 74, 0.28)';
      ctx.fillRect(xBow, stripeY, xStern - xBow, 2.2 * scale);
      const crossX = toScreenX(42);
      const crossY = yDeck + 4.3 * scale;
      if (42 + 12 >= visX0 && 42 - 12 <= visX1) {
        ctx.fillStyle = 'rgba(248, 250, 252, 0.26)';
        ctx.beginPath();
        ctx.arc(crossX, crossY, 2.7 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(220, 38, 38, 0.48)';
        ctx.fillRect(crossX - 0.55 * scale, crossY - 1.8 * scale, 1.1 * scale, 3.6 * scale);
        ctx.fillRect(crossX - 1.8 * scale, crossY - 0.55 * scale, 3.6 * scale, 1.1 * scale);
      }
    } else if (profile === 'fitzgerald-split-freighter') {
      // Catastrophic jagged midships break & dark iron-ore taconite pellet mounds in the 161m trench
      const breakX1 = toScreenX(48);
      const breakX2 = toScreenX(84);
      const trenchY = toScreenY(161.5);
      if (86 >= visX0 && 44 <= visX1) {
        ctx.fillStyle = 'rgba(30, 27, 24, 0.72)';
        ctx.beginPath();
        ctx.moveTo(breakX1, trenchY + 2 * scale);
        ctx.quadraticCurveTo((breakX1 + breakX2) * 0.5, trenchY - 4.2 * scale, breakX2, trenchY + 2 * scale);
        ctx.closePath();
        ctx.fill();
        // Jagged torn steel hull plates facing inward across the split
        ctx.strokeStyle = 'rgba(180, 83, 9, 0.55)';
        ctx.lineWidth = Math.max(2, 0.14 * scale);
        ctx.beginPath();
        ctx.moveTo(breakX1, toScreenY(134));
        ctx.lineTo(breakX1 + 2.8 * scale, toScreenY(141));
        ctx.lineTo(breakX1 - 0.8 * scale, toScreenY(148));
        ctx.lineTo(breakX1 + 3.2 * scale, toScreenY(155));
        ctx.moveTo(breakX2, toScreenY(142));
        ctx.lineTo(breakX2 - 3.0 * scale, toScreenY(148));
        ctx.lineTo(breakX2 + 1.0 * scale, toScreenY(154));
        ctx.stroke();
      }
    } else if (profile === 'thistlegorm-cargo-wreck') {
      // Dramatic midships WWII ammunition blast crater jagged plates & scattered munitions silhouette
      const bx1 = toScreenX(45);
      const bx2 = toScreenX(65);
      if (67 >= visX0 && 43 <= visX1) {
        ctx.strokeStyle = 'rgba(217, 119, 6, 0.62)';
        ctx.lineWidth = Math.max(2, 0.14 * scale);
        ctx.beginPath();
        ctx.moveTo(bx1, toScreenY(26));
        ctx.lineTo(bx1 + 2.4 * scale, toScreenY(31));
        ctx.lineTo(bx1 - 0.6 * scale, toScreenY(36));
        ctx.lineTo(bx1 + 2.8 * scale, toScreenY(41));
        ctx.moveTo(bx2, toScreenY(26));
        ctx.lineTo(bx2 - 2.6 * scale, toScreenY(32));
        ctx.lineTo(bx2 + 0.8 * scale, toScreenY(37));
        ctx.lineTo(bx2 - 2.2 * scale, toScreenY(42));
        ctx.stroke();
      }
    } else if (profile === 'u1206-submarine') {
      // Type VIIC U-Boat saddle-tank flood vents, bow hydroplanes & hull stencil
      ctx.fillStyle = 'rgba(15, 23, 42, 0.68)';
      const slitStart = Math.max(hMin + 4, Math.floor(visX0 / 4) * 4);
      const slitEnd = Math.min(hMax - 4, visX1 + 4);
      for (let wx = slitStart; wx <= slitEnd; wx += 4) {
        const sx = toScreenX(wx);
        ctx.fillRect(sx - 0.7 * scale, yDeck + 3.2 * scale, 1.4 * scale, 0.55 * scale);
      }
      // Forward & aft submarine diving hydroplanes
      if (hMin + 12 >= visX0 && hMin - 10 <= visX1) {
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = Math.max(1.2, 0.08 * scale);
        ctx.beginPath();
        ctx.ellipse(xBow + 2.5 * scale, yDeck + 5.2 * scale, 3.2 * scale, 0.65 * scale, -0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      if (hMax + 10 >= visX0 && hMax - 12 <= visX1) {
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.ellipse(xStern - 2.2 * scale, yDeck + 6.4 * scale, 2.8 * scale, 0.58 * scale, 0.14, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Subtle riveted vertical hull frame seams along the exterior backdrop
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = Math.max(1, 0.05 * scale);
    const seamStart = Math.max(hMin, Math.floor(visX0 / 8) * 8);
    const seamEnd = Math.min(hMax, visX1 + 8);
    for (let wx = seamStart; wx <= seamEnd; wx += 8) {
      const sx = toScreenX(wx);
      ctx.beginPath();
      ctx.moveTo(sx, yDeck);
      ctx.lineTo(sx, yBase);
      ctx.stroke();
    }

    // Signature underwater shipwreck bridge landmark (Brass Engine Order Telegraph anchored on intact deck)
    if (profile !== 'victoria-vertical-battleship') {
      const teleWx = profile === 'fitzgerald-split-freighter' ? 14 : (hMin + hMax) * 0.5 + 3.2;
      const teleWy = this._getHorizonGroundY(level, teleWx);
      if (teleWx + 4 >= visX0 && teleWx - 4 <= visX1 && teleWy + 4 >= visY0 && teleWy - 6 <= visY1) {
        const tx = toScreenX(teleWx);
        const ty = toScreenY(teleWy);
        ctx.save();
        ctx.translate(tx, ty);
        ctx.fillStyle = '#85622c';
        ctx.fillRect(-0.18 * scale, -1.45 * scale, 0.36 * scale, 1.45 * scale);
        ctx.fillStyle = '#d4a64a';
        ctx.strokeStyle = '#5c4119';
        ctx.lineWidth = Math.max(1.2, 0.06 * scale);
        ctx.beginPath();
        ctx.arc(0, -1.68 * scale, 0.44 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.arc(0, -1.68 * scale, 0.3 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = Math.max(1.2, 0.05 * scale);
        ctx.beginPath();
        ctx.moveTo(0, -1.68 * scale);
        ctx.lineTo(0.28 * scale, -2.18 * scale);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  },

  _drawWreckBackdropDetails(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, wreckState = null) {
    const level = this.level;
    ctx.save();

    // 0. Bespoke Exterior Ship Hull Silhouette, Bow/Stern Prow, Paint Livery & Plate Seams
    this._drawWreckShipArchitecture(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec);

    // 1. Layered Ocean Drift Current flow filaments
    if (Array.isArray(level.driftCurrents)) {
      ctx.lineCap = 'round';
      for (let c = 0; c < level.driftCurrents.length; c++) {
        const cur = level.driftCurrents[c];
        if (cur.yMax < visY0 || cur.yMin > visY1) continue;
        const dir = (cur.vx || 0) >= 0 ? 1 : -1;
        const spd = Math.max(0.4, Math.abs(cur.vx || 0.8));
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.25)';
        ctx.lineWidth = Math.max(1, 0.048 * scale);
        ctx.beginPath();
        for (let k = 0; k < 14; k++) {
          const frac = (k + 0.5) / 14;
          const wy = cur.yMin + (cur.yMax - cur.yMin) * frac;
          if (wy < visY0 - 1 || wy > visY1 + 1) continue;
          const span = Math.max(24, visX1 - visX0 + 14);
          const rawX = ((timeSec * spd * 3.4 * dir + k * 9.7) % span + span) % span;
          const wx = visX0 - 7 + rawX;
          const sx = toScreenX(wx);
          const sy = toScreenY(wy);
          const len = (1.8 + (k % 3) * 0.75) * scale * dir;
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + len, sy + Math.sin(timeSec * 1.4 + k) * 0.14 * scale);
        }
        ctx.stroke();
      }
    }

    // 2. Weighted Anchor / Shot Line from Dive Boat to Wreck Deck + Multi-Stage Deco Bottles & 6m O2 Trapeze Bar
    const shotX = level.shotLine?.x ?? level.spawn?.x ?? 0;
    const shotY0 = 0.35;
    const shotY1 = level.shotLine?.bottomY ?? level.wreckDeckY ?? 40;
    const isClipped = Boolean(wreckState?.clippedToShotLine);
    if (shotX + 8 >= visX0 && shotX - 8 <= visX1 && shotY1 >= visY0 && shotY0 <= visY1) {
      const sway = (y) => Math.sin(y * 0.11 + timeSec * 1.1) * 0.28 * Math.sin(Math.min(1, y / Math.max(1, shotY1)) * Math.PI);
      // Glowing cyan sheath when diver is clipped on for zip-descent/ascent
      if (isClipped) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
        ctx.lineWidth = Math.max(5, 0.26 * scale);
        ctx.beginPath();
        const segs = Math.max(8, Math.ceil((shotY1 - shotY0) / 3));
        for (let i = 0; i <= segs; i++) {
          const wy = shotY0 + ((shotY1 - shotY0) * i) / segs;
          const sx = toScreenX(shotX + sway(wy));
          const sy = toScreenY(wy);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = isClipped ? 'rgba(125, 211, 252, 0.95)' : 'rgba(250, 204, 21, 0.82)';
      ctx.lineWidth = Math.max(1.8, 0.08 * scale);
      ctx.beginPath();
      const segs = Math.max(8, Math.ceil((shotY1 - shotY0) / 3));
      for (let i = 0; i <= segs; i++) {
        const wy = shotY0 + ((shotY1 - shotY0) * i) / segs;
        const sx = toScreenX(shotX + sway(wy));
        const sy = toScreenY(wy);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // Depth distance tick marks every 10m along the shot line so vertical descent has crisp speed feel!
      ctx.font = `600 ${Math.max(9, Math.round(scale * 0.28))}px ui-monospace, monospace`;
      ctx.textAlign = 'left';
      for (let wy = 10; wy < shotY1 - 3; wy += 10) {
        if (wy < visY0 - 2 || wy > visY1 + 2) continue;
        const tx = toScreenX(shotX + sway(wy));
        const ty = toScreenY(wy);
        ctx.fillStyle = 'rgba(226, 232, 240, 0.55)';
        ctx.fillRect(tx - 0.16 * scale, ty - 0.04 * scale, 0.32 * scale, 0.08 * scale);
        ctx.fillStyle = 'rgba(186, 230, 253, 0.68)';
        ctx.fillText(`${wy}m`, tx + 0.35 * scale, ty + 0.1 * scale);
      }

      // Staged spare bailout/deco cylinders clipped along deep shot line (e.g. 22m, 42m, 60m)
      const stages = Array.isArray(level.shotLine?.decoStagesY) ? level.shotLine.decoStagesY : [22.0, 6.0];
      for (let st = 0; st < stages.length; st++) {
        const syW = stages[st];
        if (syW <= 7 || syW >= shotY1 - 2 || syW < visY0 - 3 || syW > visY1 + 3) continue;
        const mx = toScreenX(shotX + sway(syW));
        const my = toScreenY(syW);
        // Hanging AL80 stage bottle clipped to shot line
        ctx.fillStyle = syW <= 25 ? '#fbbf24' : '#38bdf8';
        ctx.fillRect(mx + 0.32 * scale, my - 0.42 * scale, 0.32 * scale, 0.98 * scale);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(mx + 0.32 * scale, my - 0.22 * scale, 0.32 * scale, 0.18 * scale);
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(mx, my, 0.26 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      // 6m O2 Deco Trapeze Bar suspended beneath the dive boat
      const barY = 5.4;
      if (barY >= visY0 - 4 && barY <= visY1 + 4) {
        const bx = toScreenX(shotX + sway(barY));
        const by = toScreenY(barY);
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
        ctx.lineWidth = Math.max(1, 0.045 * scale);
        ctx.beginPath();
        ctx.moveTo(bx - 1.9 * scale, toScreenY(0.3));
        ctx.lineTo(bx - 1.9 * scale, by);
        ctx.moveTo(bx + 1.9 * scale, toScreenY(0.3));
        ctx.lineTo(bx + 1.9 * scale, by);
        ctx.stroke();

        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = Math.max(3, 0.16 * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx - 2.2 * scale, by);
        ctx.lineTo(bx + 2.2 * scale, by);
        ctx.stroke();

        for (const ox of [-1.25, 1.25]) {
          ctx.fillStyle = '#10b981';
          ctx.fillRect(bx + (ox - 0.15) * scale, by + 0.12 * scale, 0.3 * scale, 0.92 * scale);
          ctx.fillStyle = '#ecfdf5';
          ctx.fillRect(bx + (ox - 0.15) * scale, by + 0.25 * scale, 0.3 * scale, 0.16 * scale);
        }
        ctx.font = `700 ${Math.max(10, Math.round(scale * 0.36))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(167, 243, 208, 0.92)';
        ctx.fillText('6m O₂ DECO BAR', bx, by - 0.34 * scale);
      }
    }

    // 3. Shipwreck Architectural Landmarks, Chains, Railings, Davits & Glowing Porthole Light Cones
    if (Array.isArray(level.wreckProps)) {
      for (let i = 0; i < level.wreckProps.length; i++) {
        const prop = level.wreckProps[i];
        const margin = Math.max((prop.scale || 1) * 14, prop.len || 0, prop.chainLen || 0);
        if (prop.x + margin < visX0 || prop.x - margin > visX1 || prop.y + margin < visY0 || prop.y - margin > visY1) continue;
        const sx = toScreenX(prop.x);
        const sy = toScreenY(prop.y);
        const ps = (prop.scale || 1) * scale;

        if (prop.kind === 'anchor') {
          // Heavy iron anchor chain draped down from bow hawsepipe toward seabed gloom
          const clen = (prop.chainLen || 22) * scale;
          ctx.strokeStyle = 'rgba(71, 85, 105, 0.78)';
          ctx.lineWidth = Math.max(2.2, 0.16 * scale);
          ctx.setLineDash([0.35 * scale, 0.16 * scale]);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(sx - 2.4 * scale, sy + clen * 0.55, sx - 1.2 * scale, sy + clen);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (prop.kind === 'railing') {
          // Weathered ship deck stanchions & partially broken handrail
          const rlen = (prop.len || 16) * scale;
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.52)';
          ctx.lineWidth = Math.max(1.2, 0.06 * scale);
          ctx.beginPath();
          ctx.moveTo(sx, sy - 1.05 * scale);
          ctx.lineTo(sx + rlen, sy - 1.05 * scale);
          ctx.moveTo(sx, sy - 0.55 * scale);
          ctx.lineTo(sx + rlen * 0.85, sy - 0.55 * scale);
          const posts = Math.max(3, Math.floor((prop.len || 16) / 2.2));
          for (let p = 0; p <= posts; p++) {
            const px = sx + (p / posts) * rlen;
            ctx.moveTo(px, sy);
            ctx.lineTo(px, sy - 1.1 * scale);
          }
          ctx.stroke();
        } else if (prop.kind === 'davit') {
          // Curved steel ocean-liner lifeboat davit arm jutting out into the blue
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(prop.angle || 0);
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = Math.max(2.5, 0.22 * ps);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(-0.4 * ps, -3.2 * ps, 1.8 * ps, -4.4 * ps);
          ctx.stroke();
          // Dangling pulley fall rope
          ctx.strokeStyle = 'rgba(203, 213, 225, 0.45)';
          ctx.lineWidth = Math.max(1, 0.05 * ps);
          ctx.beginPath();
          ctx.moveTo(1.8 * ps, -4.4 * ps);
          ctx.lineTo(1.8 * ps + Math.sin(timeSec * 1.1 + i) * 0.35 * ps, -1.2 * ps);
          ctx.stroke();
          ctx.restore();
        } else if (prop.kind === 'mast') {
          // Tall lattice radar mast rising into sunlit upper water
          ctx.save();
          ctx.translate(sx, sy);
          ctx.strokeStyle = 'rgba(100, 116, 139, 0.72)';
          ctx.lineWidth = Math.max(1.5, 0.1 * ps);
          ctx.beginPath();
          ctx.moveTo(-1.1 * ps, 0);
          ctx.lineTo(0, -10.5 * ps);
          ctx.lineTo(1.1 * ps, 0);
          ctx.moveTo(-3.4 * ps, -6.5 * ps);
          ctx.lineTo(3.4 * ps, -6.5 * ps);
          ctx.moveTo(-2.1 * ps, -9.2 * ps);
          ctx.lineTo(2.1 * ps, -9.2 * ps);
          ctx.stroke();
          ctx.restore();
        } else if (prop.kind === 'pipe') {
          // Overhead riveted engine-room steam pipe run
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(prop.angle || 0);
          const plen = (prop.len || 10) * scale;
          ctx.fillStyle = '#523a28';
          ctx.fillRect(-plen * 0.5, -0.22 * scale, plen, 0.44 * scale);
          ctx.fillStyle = 'rgba(251, 146, 60, 0.22)';
          ctx.fillRect(-plen * 0.5, -0.18 * scale, plen, 0.12 * scale);
          // Pipe flange rings
          ctx.fillStyle = '#334155';
          for (let f = -plen * 0.4; f <= plen * 0.4; f += 2.8 * scale) {
            ctx.fillRect(f - 0.09 * scale, -0.32 * scale, 0.18 * scale, 0.64 * scale);
          }
          ctx.restore();
        } else if (prop.kind === 'porthole') {
          const ang = prop.angle ?? 0.65;
          const beamLen = (prop.beamLen || 5.8) * scale;
          const grad = ctx.createLinearGradient(sx, sy, sx + Math.cos(ang) * beamLen, sy + Math.sin(ang) * beamLen);
          grad.addColorStop(0, 'rgba(125, 211, 252, 0.36)');
          grad.addColorStop(1, 'rgba(14, 165, 233, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(sx - Math.sin(ang) * 0.32 * scale, sy + Math.cos(ang) * 0.32 * scale);
          ctx.lineTo(sx + Math.sin(ang) * 0.32 * scale, sy - Math.cos(ang) * 0.32 * scale);
          ctx.lineTo(sx + Math.cos(ang) * beamLen + Math.sin(ang) * 1.45 * scale, sy + Math.sin(ang) * beamLen - Math.cos(ang) * 1.45 * scale);
          ctx.lineTo(sx + Math.cos(ang) * beamLen - Math.sin(ang) * 1.45 * scale, sy + Math.sin(ang) * beamLen + Math.cos(ang) * 1.45 * scale);
          ctx.closePath();
          ctx.fill();
        } else if (prop.kind === 'propeller') {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(prop.angle || 0);
          for (let b = 0; b < 3; b++) {
            ctx.save();
            ctx.rotate((b * Math.PI * 2) / 3);
            ctx.fillStyle = '#9a7b4f';
            ctx.strokeStyle = '#4a3721';
            ctx.lineWidth = Math.max(1.2, 0.08 * scale);
            ctx.beginPath();
            ctx.ellipse(0, -1.55 * ps, 0.64 * ps, 1.52 * ps, 0.16, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
          ctx.fillStyle = '#c29e65';
          ctx.beginPath();
          ctx.arc(0, 0, 0.58 * ps, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (prop.kind === 'funnel') {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(prop.angle || 0.35);
          ctx.fillStyle = '#6b4226';
          ctx.fillRect(-2.0 * ps, -4.5 * ps, 4.0 * ps, 9.0 * ps);
          ctx.fillStyle = '#b46534';
          ctx.fillRect(-2.0 * ps, -2.5 * ps, 4.0 * ps, 1.6 * ps);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-2.0 * ps, -4.5 * ps, 4.0 * ps, 1.2 * ps);
          // Steam whistle pipe alongside funnel
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = Math.max(1.2, 0.14 * ps);
          ctx.beginPath();
          ctx.moveTo(2.25 * ps, -4.0 * ps);
          ctx.lineTo(2.25 * ps, 4.2 * ps);
          ctx.stroke();
          ctx.restore();
        } else if (prop.kind === 'island') {
          ctx.save();
          ctx.translate(sx, sy);
          // Tiered Essex-class carrier bridge superstructure with Pri-Fly & hull number "34"
          ctx.fillStyle = '#334155';
          ctx.fillRect(-4.2 * ps, -9.8 * ps, 8.4 * ps, 10.6 * ps);
          ctx.fillStyle = '#475569';
          ctx.fillRect(-2.8 * ps, -14.0 * ps, 5.6 * ps, 4.4 * ps);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(1.6 * ps, -12.6 * ps, 2.2 * ps, 3.2 * ps); // Funnel stack
          // Bridge windows
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.fillRect(-3.4 * ps, -8.5 * ps, 6.4 * ps, 1.15 * ps);
          ctx.fillRect(-2.2 * ps, -12.8 * ps, 3.2 * ps, 0.95 * ps);
          // Hull number "34" painted on the island side
          ctx.font = `800 ${Math.max(10, Math.round(1.9 * ps))}px ui-sans-serif, system-ui, sans-serif`;
          ctx.fillStyle = 'rgba(226, 232, 240, 0.45)';
          ctx.textAlign = 'center';
          ctx.fillText('34', -1.2 * ps, -3.5 * ps);
          ctx.restore();
        } else if (prop.kind === 'turret') {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(prop.angle || 0);
          ctx.fillStyle = '#475569';
          ctx.fillRect(0.6 * ps, -0.6 * ps, 6.6 * ps, 0.44 * ps);
          ctx.fillRect(0.6 * ps, 0.16 * ps, 6.6 * ps, 0.44 * ps);
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.arc(0, 0, 2.3 * ps, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = Math.max(1.5, 0.11 * ps);
          ctx.stroke();
          ctx.restore();
        } else if (prop.kind === 'pilothouse') {
          ctx.save();
          ctx.translate(sx, sy);
          // White Great Lakes forecastle & open Pilot House windows + glowing memorial bronze bell
          ctx.fillStyle = '#64748b';
          ctx.fillRect(-4.2 * ps, -4.6 * ps, 8.4 * ps, 5.0 * ps);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(-4.5 * ps, -5.0 * ps, 9.0 * ps, 0.6 * ps);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-3.4 * ps, -3.6 * ps, 6.8 * ps, 1.5 * ps);
          // Warm memorial halo around 1995 replica bronze bell
          ctx.fillStyle = 'rgba(251, 191, 36, 0.24)';
          ctx.beginPath();
          ctx.arc(0, -5.6 * ps, 1.45 * ps, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(0, -5.6 * ps, 0.68 * ps, Math.PI, 0);
          ctx.lineTo(0.88 * ps, -4.95 * ps);
          ctx.lineTo(-0.88 * ps, -4.95 * ps);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (prop.kind === 'crane') {
          // Angled WWII cargo derrick crane boom + suspended hook cable
          ctx.save();
          ctx.translate(sx, sy);
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = Math.max(2, 0.18 * ps);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -7.8 * ps);
          ctx.stroke();
          ctx.save();
          ctx.translate(0, -6.5 * ps);
          ctx.rotate(prop.angle || 0.25);
          ctx.lineWidth = Math.max(2, 0.16 * ps);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(8.5 * ps, -2.2 * ps);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(203, 213, 225, 0.45)';
          ctx.lineWidth = Math.max(1, 0.05 * ps);
          ctx.beginPath();
          ctx.moveTo(8.5 * ps, -2.2 * ps);
          ctx.lineTo(8.5 * ps + Math.sin(timeSec * 1.2 + i) * 0.35 * ps, 3.8 * ps);
          ctx.stroke();
          ctx.restore();
          ctx.restore();
        } else if (prop.kind === 'locomotive') {
          // Iconic WWII Stanier 8F Steam Locomotive resting upright on the Red Sea floor
          ctx.save();
          ctx.translate(sx, sy);
          ctx.fillStyle = '#47362b';
          ctx.strokeStyle = '#785a46';
          ctx.lineWidth = Math.max(1.2, 0.08 * ps);
          ctx.beginPath();
          ctx.roundRect(-5.2 * ps, -2.9 * ps, 8.2 * ps, 2.2 * ps, 0.6 * ps);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#3b2d24';
          ctx.fillRect(2.6 * ps, -3.5 * ps, 2.6 * ps, 2.9 * ps);
          ctx.fillRect(-4.2 * ps, -4.3 * ps, 0.85 * ps, 1.5 * ps);
          ctx.beginPath();
          ctx.arc(-1.2 * ps, -2.9 * ps, 0.65 * ps, Math.PI, 0);
          ctx.fill();
          ctx.strokeStyle = '#9a7b5c';
          ctx.lineWidth = Math.max(1.5, 0.1 * ps);
          for (let w = -3.4; w <= 3.6; w += 1.75) {
            ctx.beginPath();
            ctx.arc(w * ps, -0.55 * ps, 0.68 * ps, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        } else if (prop.kind === 'conning-tower') {
          // WWII Type VIIC U-Boat armored conning tower with twin periscopes & hull stencil
          ctx.save();
          ctx.translate(sx, sy);
          ctx.fillStyle = '#334155';
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = Math.max(1.5, 0.09 * ps);
          ctx.beginPath();
          ctx.moveTo(-4.8 * ps, 0.5 * ps);
          ctx.lineTo(-3.6 * ps, -5.8 * ps);
          ctx.lineTo(3.2 * ps, -5.8 * ps);
          ctx.lineTo(4.6 * ps, 0.5 * ps);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#475569';
          ctx.fillRect(2.8 * ps, -4.6 * ps, 2.6 * ps, 2.2 * ps);
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = Math.max(2, 0.14 * ps);
          ctx.beginPath();
          ctx.moveTo(-1.2 * ps, -5.8 * ps);
          ctx.lineTo(-1.2 * ps, -10.8 * ps);
          ctx.lineTo(-1.9 * ps, -10.8 * ps);
          ctx.moveTo(0.8 * ps, -5.8 * ps);
          ctx.lineTo(0.8 * ps, -9.2 * ps);
          ctx.stroke();
          ctx.font = `800 ${Math.max(9, Math.round(1.1 * ps))}px ui-sans-serif, system-ui, sans-serif`;
          ctx.fillStyle = 'rgba(226, 232, 240, 0.48)';
          ctx.textAlign = 'center';
          ctx.fillText('U-1206', -0.4 * ps, -2.2 * ps);
          ctx.restore();
        }
      }
    }

    ctx.restore();
  },

  _drawWreckForegroundHazards(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, diver = null, wreckState = null, mechFx = null) {
    const level = this.level;
    ctx.save();

    // 1. Interior Steel Bulkhead Rib Frames along wreck corridors (so interiors read as steel rooms!)
    if (Array.isArray(level.segments)) {
      ctx.strokeStyle = 'rgba(120, 74, 44, 0.34)';
      ctx.lineWidth = Math.max(1.4, 0.11 * scale);
      for (let i = 0; i < level.segments.length; i++) {
        const s = level.segments[i];
        const minX = Math.min(s.ax, s.bx) - 5;
        const maxX = Math.max(s.ax, s.bx) + 5;
        const minY = Math.min(s.ay, s.by) - 5;
        const maxY = Math.max(s.ay, s.by) + 5;
        if (maxX < visX0 || minX > visX1 || maxY < visY0 || minY > visY1) continue;
        const dx = s.bx - s.ax;
        const dy = s.by - s.ay;
        const len = Math.hypot(dx, dy);
        if (len < 4) continue;
        const nx = -dy / len;
        const ny = dx / len;
        const ribs = Math.max(2, Math.floor(len / 7.5));
        for (let r = 1; r < ribs; r++) {
          const t = r / ribs;
          const cx = s.ax + dx * t;
          const cy = s.ay + dy * t;
          const rad = s.ra + (s.rb - s.ra) * t;
          // Draw crisp steel frame brackets on both walls of the corridor
          const p1x = toScreenX(cx + nx * (rad * 0.92));
          const p1y = toScreenY(cy + ny * (rad * 0.92));
          const p2x = toScreenX(cx + nx * (rad * 0.62));
          const p2y = toScreenY(cy + ny * (rad * 0.62));
          const q1x = toScreenX(cx - nx * (rad * 0.92));
          const q1y = toScreenY(cy - ny * (rad * 0.92));
          const q2x = toScreenX(cx - nx * (rad * 0.62));
          const q2y = toScreenY(cy - ny * (rad * 0.62));
          ctx.beginPath();
          ctx.moveTo(p1x, p1y);
          ctx.lineTo(p2x, p2y);
          ctx.moveTo(q1x, q1y);
          ctx.lineTo(q2x, q2y);
          ctx.stroke();
        }
      }
    }

    // 2. Riveted steel beams & brass porthole rims
    if (Array.isArray(level.wreckProps)) {
      for (let i = 0; i < level.wreckProps.length; i++) {
        const prop = level.wreckProps[i];
        if (prop.x + 8 < visX0 || prop.x - 8 > visX1 || prop.y + 8 < visY0 || prop.y - 8 > visY1) continue;
        const sx = toScreenX(prop.x);
        const sy = toScreenY(prop.y);
        if (prop.kind === 'porthole') {
          ctx.fillStyle = 'rgba(186, 230, 253, 0.55)';
          ctx.beginPath();
          ctx.arc(sx, sy, 0.36 * scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#b47b3a';
          ctx.lineWidth = Math.max(2, 0.12 * scale);
          ctx.stroke();
        } else if (prop.kind === 'beam') {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(prop.angle || 0);
          const len = (prop.len || 4.2) * scale;
          ctx.fillStyle = '#4a3525';
          ctx.fillRect(-len * 0.5, -0.18 * scale, len, 0.36 * scale);
          ctx.strokeStyle = '#8b5328';
          ctx.lineWidth = Math.max(1, 0.05 * scale);
          ctx.strokeRect(-len * 0.5, -0.18 * scale, len, 0.36 * scale);
          // Rivet dots along I-beam web
          ctx.fillStyle = '#b47b3a';
          for (let rv = -len * 0.42; rv <= len * 0.42; rv += 0.55 * scale) {
            ctx.beginPath();
            ctx.arc(rv, 0, Math.max(1, 0.04 * scale), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        } else if (prop.kind === 'zero-fighter') {
          // Iconic Chuuk Lagoon sunken WWII A6M Zero Fighter fuselage resting in Hold #2 (v197)
          const sc = (prop.scale || 1.0) * scale;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(prop.angle || 0);
          // Swept port/starboard wing perspective shadow
          ctx.fillStyle = '#2d4739';
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = Math.max(1.5, 0.06 * sc);
          ctx.beginPath();
          ctx.moveTo(-1.1 * sc, 0.25 * sc);
          ctx.lineTo(0.85 * sc, 0.48 * sc);
          ctx.lineTo(0.55 * sc, 0.92 * sc);
          ctx.lineTo(-1.45 * sc, 0.62 * sc);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Tapered olive-slate airframe fuselage + vertical tailfin
          ctx.fillStyle = '#527d65';
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = Math.max(1.4, 0.055 * sc);
          ctx.beginPath();
          ctx.moveTo(2.35 * sc, -0.08 * sc);
          ctx.quadraticCurveTo(0.6 * sc, -0.62 * sc, -2.15 * sc, -0.34 * sc);
          ctx.lineTo(-2.55 * sc, -1.12 * sc);
          ctx.lineTo(-2.95 * sc, -1.02 * sc);
          ctx.lineTo(-2.85 * sc, 0.16 * sc);
          ctx.lineTo(2.32 * sc, 0.36 * sc);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Radial engine cowling nose + weathered bent propeller blades
          ctx.fillStyle = '#334155';
          ctx.fillRect(2.1 * sc, -0.36 * sc, 0.48 * sc, 0.74 * sc);
          ctx.strokeRect(2.1 * sc, -0.36 * sc, 0.48 * sc, 0.74 * sc);
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = Math.max(2.0, 0.09 * sc);
          ctx.beginPath();
          ctx.moveTo(2.62 * sc, -0.82 * sc);
          ctx.lineTo(2.68 * sc, 0.02 * sc);
          ctx.lineTo(2.86 * sc, 0.68 * sc);
          ctx.stroke();

          // Open greenhouse cockpit canopy frame
          ctx.fillStyle = 'rgba(125, 211, 252, 0.48)';
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = Math.max(1.4, 0.055 * sc);
          ctx.beginPath();
          ctx.moveTo(0.85 * sc, -0.44 * sc);
          ctx.quadraticCurveTo(0.12 * sc, -0.98 * sc, -0.78 * sc, -0.42 * sc);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Weathered crimson fuselage roundel emblem with thin white ring
          ctx.fillStyle = 'rgba(239, 68, 68, 0.88)';
          ctx.strokeStyle = 'rgba(241, 245, 249, 0.55)';
          ctx.lineWidth = Math.max(1.0, 0.04 * sc);
          ctx.beginPath();
          ctx.arc(-1.18 * sc, -0.05 * sc, 0.32 * sc, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Colorful Pacific soft coral fans growing along nose & wingtip
          ctx.fillStyle = 'rgba(244, 114, 182, 0.88)';
          ctx.beginPath();
          ctx.arc(1.75 * sc, -0.42 * sc, 0.25 * sc, 0, Math.PI * 2);
          ctx.arc(-0.95 * sc, 0.68 * sc, 0.23 * sc, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(250, 204, 21, 0.85)';
          ctx.beginPath();
          ctx.arc(-2.65 * sc, -1.05 * sc, 0.21 * sc, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // 3. Timed Hull-Breach Surge Current Jet Streams (pulsing in exact phase with physics!)
    if (Array.isArray(level.surgeZones)) {
      for (let z = 0; z < level.surgeZones.length; z++) {
        const zone = level.surgeZones[z];
        const zr = zone.radius || 4.0;
        if (zone.x + zr + 2 < visX0 || zone.x - zr - 2 > visX1 || zone.y + zr + 2 < visY0 || zone.y - zr - 2 > visY1) continue;
        const wave = computeSurgeWave(zone, timeSec);
        const sx = toScreenX(zone.x);
        const sy = toScreenY(zone.y);
        const sr = zr * scale;
        const mag = Math.hypot(zone.vx || 0, zone.vy || 0) || 1;
        const dirX = (zone.vx || 0) / mag;
        const dirY = (zone.vy || 0) / mag;
        const flowSign = wave >= 0 ? 1 : -1;
        const strength = Math.abs(wave);

        if (strength > 0.05) {
          // Active surging water jets & directional chevrons
          const ang = Math.atan2(dirY * flowSign, dirX * flowSign);
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(ang);
          ctx.strokeStyle = `rgba(125, 211, 252, ${0.22 + strength * 0.58})`;
          ctx.lineWidth = Math.max(1.5, (0.06 + strength * 0.06) * scale);
          ctx.lineCap = 'round';
          for (let k = -2; k <= 2; k++) {
            const oy = k * sr * 0.32;
            const travel = ((timeSec * 5.2 + k * 0.7) % 1.0) * 2 - 1;
            const ox = travel * sr * 0.55;
            const segLen = sr * (0.35 + strength * 0.25);
            ctx.beginPath();
            ctx.moveTo(ox - segLen * 0.5, oy);
            ctx.lineTo(ox + segLen * 0.5, oy);
            // Directional chevron tip
            ctx.lineTo(ox + segLen * 0.5 - 0.28 * scale, oy - 0.2 * scale);
            ctx.moveTo(ox + segLen * 0.5, oy);
            ctx.lineTo(ox + segLen * 0.5 - 0.28 * scale, oy + 0.2 * scale);
            ctx.stroke();
          }
          ctx.restore();
        } else {
          // Safe calm lull window indicator
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.32)';
          ctx.lineWidth = Math.max(1.1, 0.045 * scale);
          ctx.setLineDash([5, 6]);
          ctx.beginPath();
          ctx.arc(sx, sy, sr * 0.72, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // 4. Interactive Watertight Bulkhead Hatches (heavy steel door + spinning brass handwheel!)
    this._drawWatertightHatches(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, wreckState, mechFx);

    // 5. Cuttable Fishing-Net & Cable Entanglement Zones (with taut snare strands when hooked!)
    if (Array.isArray(level.snagZones)) {
      const cutSet = wreckState?.cutSnagIds;
      const activeIdx = wreckState?.activeSnagIndex ?? -1;
      for (let s = 0; s < level.snagZones.length; s++) {
        const snag = level.snagZones[s];
        const snagKey = snag.id || `snag_${s}`;
        const r = snag.radius || 2.4;
        if (snag.x + r + 3 < visX0 || snag.x - r - 3 > visX1 || snag.y + r + 3 < visY0 || snag.y - r - 3 > visY1) continue;
        const sx = toScreenX(snag.x);
        const sy = toScreenY(snag.y);
        const sr = r * scale;
        const sway = Math.sin(timeSec * 1.45 + s * 2.1) * 0.22 * scale;
        const isCut = cutSet?.has(snagKey);

        if (isCut) {
          // Sliced & parted harmless frayed net remnants hanging on outer edges
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
          ctx.lineWidth = Math.max(1, 0.035 * scale);
          ctx.beginPath();
          for (const side of [-1, 1]) {
            ctx.moveTo(sx + side * sr * 0.85, sy - sr * 0.75);
            ctx.quadraticCurveTo(sx + side * sr * 0.6 + sway, sy, sx + side * sr * 0.72 + sway, sy + sr * 0.7);
          }
          ctx.stroke();
          continue;
        }

        const isHooked = activeIdx === s;
        ctx.strokeStyle = isHooked ? 'rgba(248, 113, 113, 0.72)' : 'rgba(251, 191, 36, 0.42)';
        ctx.lineWidth = Math.max(1.1, 0.045 * scale);
        ctx.beginPath();
        for (let k = -3; k <= 3; k++) {
          const ox = (k / 3.2) * sr;
          ctx.moveTo(sx + ox, sy - sr * 0.85);
          ctx.quadraticCurveTo(sx + ox + sway, sy, sx + ox * 0.85 + sway * 1.4, sy + sr * 0.85);
          ctx.moveTo(sx - sr * 0.85, sy + ox);
          ctx.quadraticCurveTo(sx + sway * 0.5, sy + ox + sway * 0.4, sx + sr * 0.85 + sway * 0.8, sy + ox);
        }
        ctx.stroke();

        // Taut snare monofilament strands pulled tight from net to hooked diver!
        if (isHooked && diver) {
          const dx = toScreenX(diver.x);
          const dy = toScreenY(diver.y);
          ctx.strokeStyle = 'rgba(251, 146, 60, 0.88)';
          ctx.lineWidth = Math.max(1.6, 0.055 * scale);
          ctx.beginPath();
          ctx.moveTo(sx - sr * 0.35, sy - sr * 0.25);
          ctx.lineTo(dx, dy);
          ctx.moveTo(sx + sr * 0.35, sy + sr * 0.22);
          ctx.lineTo(dx, dy);
          ctx.stroke();
        }

        // Subtle warning perimeter shimmer
        ctx.strokeStyle = isHooked ? 'rgba(248, 113, 113, 0.55)' : 'rgba(251, 146, 60, 0.28)';
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.arc(sx + sway * 0.35, sy, sr * 0.92, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.restore();
  },

  /**
   * Shared Interactive Watertight Bulkhead / Mine Blast-Door Hatch renderer (v148 Mechanical Craft Overhaul):
   * Brushed naval steel bevel, cast-iron hinges, 4 retracting perimeter locking dogs,
   * spinning brass dogging handwheel, analog Bourdon pressure gauge + bypass bleed valve,
   * and smooth 3D foreshortened hinged swing-open animation.
   */
  _drawWatertightHatches(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, wreckState = null, mechFx = null) {
    const level = this.level;
    if (!Array.isArray(level.watertightHatches) || level.watertightHatches.length === 0) return;
    const openedSet = wreckState?.openedHatchIds;
    const crankId = wreckState?.crankingHatchId;
    const crankProg = wreckState?.crankingHatchProgress || 0;

    for (let h = 0; h < level.watertightHatches.length; h++) {
      const hatch = level.watertightHatches[h];
      const hr = hatch.radius || 1.9;
      if (hatch.x + hr + 3 < visX0 || hatch.x - hr - 3 > visX1 || hatch.y + hr + 3 < visY0 || hatch.y - hr - 3 > visY1) continue;
      const sx = toScreenX(hatch.x);
      const sy = toScreenY(hatch.y);
      const sr = hr * scale;
      const isOpen = openedSet?.has(hatch.id);
      const isCranking = !isOpen && crankId === hatch.id;
      const pressurized = isHatchPressurized(level, hatch);
      const equalized = Boolean(wreckState?.equalizedHatchIds?.has(hatch.id));
      const valveProg = mechFx?.valveAnims?.get(hatch.id) ?? (equalized ? 1 : 0);
      const openProg = isOpen ? (mechFx?.hatchOpenAnims?.get(hatch.id) ?? 1) : 0;

      // Subtle mechanical shudder during active pressure bleed or high-torque cranking
      const shudderAmp =
        valveProg > 0 && valveProg < 0.62
          ? (1 - valveProg / 0.62) * 0.045 * scale
          : isCranking
            ? 0.022 * scale
            : 0;
      const jx = shudderAmp > 0 ? Math.sin(timeSec * 52 + h * 3) * shudderAmp : 0;
      const jy = shudderAmp > 0 ? Math.cos(timeSec * 47 + h * 5) * shudderAmp : 0;

      ctx.save();
      ctx.translate(sx + jx, sy + jy);

      // Outer bolted bulkhead coaming flange (always anchored to hull)
      ctx.strokeStyle = isOpen ? 'rgba(52, 211, 153, 0.58)' : 'rgba(71, 85, 105, 0.92)';
      ctx.lineWidth = Math.max(2.6, 0.17 * scale);
      ctx.beginPath();
      ctx.arc(0, 0, sr * 0.97, 0, Math.PI * 2);
      ctx.stroke();

      // Heavy cast-iron twin hinge knuckles bolted on the right coaming
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(1.1, 0.045 * scale);
      for (const hy of [-sr * 0.42, sr * 0.42]) {
        ctx.fillRect(sr * 0.84, hy - sr * 0.11, sr * 0.24, sr * 0.22);
        ctx.strokeRect(sr * 0.84, hy - sr * 0.11, sr * 0.24, sr * 0.22);
        // Brass hinge pin
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(sr * 0.96, hy, Math.max(1.5, 0.055 * scale), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#334155';
      }

      if (isOpen) {
        // Open passable interior portal ring + subtle safe emerald clearance glow
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.72)';
        ctx.lineWidth = Math.max(2.2, 0.12 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, sr * 0.86, 0, Math.PI * 2);
        ctx.stroke();

        // Smooth 3D foreshortened hinged door swing-open animation (0 -> 1 over ~0.68s)
        const easeOpen = 1 - Math.pow(1 - Math.max(0, Math.min(1, openProg)), 3);
        const doorScaleX = Math.max(0.16, 1 - easeOpen * 0.84);
        ctx.save();
        ctx.translate(sr * 0.88, 0);
        ctx.scale(doorScaleX, 1);
        ctx.translate(-sr * 0.88, 0);

        const openDoorGrad = ctx.createLinearGradient(-sr, -sr, sr, sr);
        openDoorGrad.addColorStop(0, '#475569');
        openDoorGrad.addColorStop(0.5, '#1e293b');
        openDoorGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = openDoorGrad;
        ctx.beginPath();
        ctx.arc(0, 0, sr * 0.88, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = Math.max(1.8, 0.09 * scale);
        ctx.stroke();

        // Retracted brass wheel rim silhouette visible on the swung door
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.72)';
        ctx.lineWidth = Math.max(1.5, 0.08 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, sr * 0.42, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        // Sealed heavy naval steel door plate with radial metallic bevel shading
        const plateGrad = ctx.createRadialGradient(-sr * 0.28, -sr * 0.28, sr * 0.08, 0, 0, sr * 0.96);
        plateGrad.addColorStop(0, '#475569');
        plateGrad.addColorStop(0.45, '#293548');
        plateGrad.addColorStop(0.84, '#1e293b');
        plateGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = plateGrad;
        ctx.beginPath();
        ctx.arc(0, 0, sr * 0.91, 0, Math.PI * 2);
        ctx.fill();

        // Oxidized corrosion halo + gasket ring
        ctx.strokeStyle = 'rgba(146, 64, 14, 0.48)';
        ctx.lineWidth = Math.max(2.4, 0.16 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, sr * 0.83, 0, Math.PI * 2);
        ctx.stroke();

        // Active status rim (amber sealed / cyan cranking / emerald equalized ready)
        ctx.strokeStyle = isCranking ? '#38bdf8' : pressurized && !equalized ? '#f87171' : '#f59e0b';
        ctx.lineWidth = Math.max(2.2, 0.12 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, sr * 0.91, 0, Math.PI * 2);
        ctx.stroke();

        // Inner stamped stiffening dish ring
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
        ctx.lineWidth = Math.max(1.2, 0.06 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, sr * 0.62, 0, Math.PI * 2);
        ctx.stroke();

        // 4 Mechanical Locking Dogs (perimeter steel wedges that retract inward as wheel cranks!)
        const dogRetract = isCranking ? crankProg : 0;
        for (let d = 0; d < 4; d++) {
          const da = (d / 4) * Math.PI * 2 + Math.PI * 0.25;
          ctx.save();
          ctx.rotate(da);
          const dogX = sr * (0.86 - dogRetract * 0.22);
          ctx.translate(dogX, 0);
          ctx.rotate(dogRetract * 0.65);
          ctx.fillStyle = dogRetract > 0.55 ? '#94a3b8' : '#cbd5e1';
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = Math.max(1.1, 0.045 * scale);
          ctx.fillRect(-sr * 0.11, -sr * 0.065, sr * 0.22, sr * 0.13);
          ctx.strokeRect(-sr * 0.11, -sr * 0.065, sr * 0.22, sr * 0.13);
          ctx.restore();
        }

        // 10 Forged Perimeter Rivets with metallic top glint
        for (let b = 0; b < 10; b++) {
          const ba = (b / 10) * Math.PI * 2;
          const bx = Math.cos(ba) * sr * 0.76;
          const by = Math.sin(ba) * sr * 0.76;
          const br = Math.max(1.5, 0.06 * scale);
          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.arc(bx - br * 0.28, by - br * 0.28, br * 0.36, 0, Math.PI * 2);
          ctx.fill();
        }

        // Central Brass Dogging Handwheel (tapered spokes + knurled rim + hex center nut)
        ctx.save();
        const wheelRot = isCranking ? crankProg * Math.PI * 5 : Math.sin(timeSec * 0.9 + h) * 0.05;
        ctx.rotate(wheelRot);

        // Soft cast shadow behind wheel
        ctx.strokeStyle = 'rgba(2, 6, 23, 0.45)';
        ctx.lineWidth = Math.max(2.6, 0.14 * scale);
        ctx.beginPath();
        ctx.arc(0.04 * scale, 0.05 * scale, sr * 0.45, 0, Math.PI * 2);
        ctx.stroke();

        // Brass wheel spokes & rim
        const brassGrad = ctx.createLinearGradient(-sr * 0.45, -sr * 0.45, sr * 0.45, sr * 0.45);
        brassGrad.addColorStop(0, '#fef08a');
        brassGrad.addColorStop(0.45, '#f59e0b');
        brassGrad.addColorStop(1, '#92400e');
        ctx.strokeStyle = brassGrad;
        ctx.lineWidth = Math.max(2.2, 0.12 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, sr * 0.45, 0, Math.PI * 2);
        for (let sp = 0; sp < 6; sp++) {
          const sa = (sp / 6) * Math.PI * 2;
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(sa) * sr * 0.45, Math.sin(sa) * sr * 0.45);
        }
        ctx.stroke();

        // Outer grip lugs around brass wheel
        ctx.fillStyle = '#fde047';
        for (let sp = 0; sp < 6; sp++) {
          const sa = (sp / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(Math.cos(sa) * sr * 0.45, Math.sin(sa) * sr * 0.45, Math.max(1.6, 0.065 * scale), 0, Math.PI * 2);
          ctx.fill();
        }

        // Center brass spindle hub + hex locknut
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.arc(0, 0, 0.17 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(0, 0, 0.095 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Outer radial cranking progress ring
        if (isCranking && crankProg > 0) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = Math.max(3, 0.16 * scale);
          ctx.beginPath();
          ctx.arc(0, 0, sr * 1.1, -Math.PI * 0.5, -Math.PI * 0.5 + crankProg * Math.PI * 2);
          ctx.stroke();
        }

        // Pressurized Deep Wreck Bulkhead Copper Bypass Valve & Analog Bourdon Gauge (v148)
        if (pressurized) {
          const vx = sr * 0.64;
          const vy = -sr * 0.64;
          const vr = Math.max(5.5, 0.34 * scale);
          const pulse = 0.65 + 0.35 * Math.sin(timeSec * 4.4 + h);

          // Copper bypass conduit connecting door cavity to bleed gauge
          ctx.strokeStyle = '#b45309';
          ctx.lineWidth = Math.max(2, 0.11 * scale);
          ctx.beginPath();
          ctx.moveTo(sr * 0.34, -sr * 0.56);
          ctx.quadraticCurveTo(sr * 0.56, -sr * 0.72, vx, vy);
          ctx.stroke();

          // Spinning miniature red/brass bleed valve wheel beside the gauge
          const miniX = sr * 0.32;
          const miniY = -sr * 0.58;
          ctx.save();
          ctx.translate(miniX, miniY);
          ctx.rotate(valveProg * Math.PI * 6);
          ctx.strokeStyle = equalized ? '#34d399' : '#f87171';
          ctx.lineWidth = Math.max(1.4, 0.065 * scale);
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(3, 0.16 * scale), 0, Math.PI * 2);
          ctx.moveTo(-0.15 * scale, 0);
          ctx.lineTo(0.15 * scale, 0);
          ctx.moveTo(0, -0.15 * scale);
          ctx.lineTo(0, 0.15 * scale);
          ctx.stroke();
          ctx.restore();

          // Active directional high-pressure bleed jet cone while valve is equalizing!
          if (valveProg > 0 && valveProg < 0.78) {
            const jetFade = Math.sin((valveProg / 0.78) * Math.PI);
            const jetLen = (0.8 + jetFade * 1.35) * scale;
            const jetGrad = ctx.createLinearGradient(vx, vy, vx + jetLen * 0.75, vy - jetLen * 0.75);
            jetGrad.addColorStop(0, `rgba(224, 242, 254, ${(0.82 * jetFade).toFixed(2)})`);
            jetGrad.addColorStop(0.5, `rgba(125, 211, 252, ${(0.45 * jetFade).toFixed(2)})`);
            jetGrad.addColorStop(1, 'rgba(125, 211, 252, 0)');
            ctx.fillStyle = jetGrad;
            ctx.beginPath();
            ctx.moveTo(vx, vy);
            ctx.lineTo(vx + jetLen * 0.55, vy - jetLen * 0.95);
            ctx.lineTo(vx + jetLen * 0.98, vy - jetLen * 0.52);
            ctx.closePath();
            ctx.fill();
          }

          // Brass Bourdon Gauge Housing + Glass Face
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = equalized ? '#34d399' : `rgba(251, 191, 36, ${pulse.toFixed(2)})`;
          ctx.lineWidth = Math.max(1.8, 0.085 * scale);
          ctx.beginPath();
          ctx.arc(vx, vy, vr, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Red High-ΔP & Green Equalized dial arcs
          ctx.lineWidth = Math.max(1.2, 0.055 * scale);
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
          ctx.beginPath();
          ctx.arc(vx, vy, vr * 0.7, Math.PI * 0.78, Math.PI * 1.32);
          ctx.stroke();
          ctx.strokeStyle = `rgba(248, 113, 113, ${equalized ? 0.3 : pulse.toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(vx, vy, vr * 0.7, Math.PI * 1.48, Math.PI * 2.18);
          ctx.stroke();

          // Sweeping Analog Needle (High ΔP red -> Equalized 0 green)
          const needleEase = 1 - Math.pow(1 - Math.max(0, Math.min(1, valveProg)), 2);
          const needleAng = equalized || valveProg > 0
            ? (0.35 - needleEase * 2.15)
            : (0.35 + Math.sin(timeSec * 8 + h) * 0.08);
          ctx.strokeStyle = equalized && valveProg >= 0.8 ? '#6ee7b7' : '#fca5a5';
          ctx.lineWidth = Math.max(1.3, 0.055 * scale);
          ctx.beginPath();
          ctx.moveTo(vx, vy);
          ctx.lineTo(vx + Math.cos(needleAng) * vr * 0.72, vy + Math.sin(needleAng) * vr * 0.72);
          ctx.stroke();
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.arc(vx, vy, Math.max(1.2, 0.05 * scale), 0, Math.PI * 2);
          ctx.fill();

          // Compact status badge just below gauge
          if (scale >= 12) {
            ctx.font = `800 ${Math.max(8, Math.round(scale * 0.25))}px ui-monospace, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = equalized ? '#6ee7b7' : '#fca5a5';
            ctx.fillText(equalized ? 'EQ' : 'ΔP', vx, vy + vr + 1.5);
          }
        }
      }
      ctx.restore();
    }
  },

  /**
   * Render an inflated Safety-Orange Commercial Parachute Lift Bag tethered above the diver (v148):
   * Multi-gore ripstop canopy, SOLAS tape, top spring dump valve + pull-cord lanyard,
   * stainless bolt-snap hardware, pressurized inflator shimmer plume & slung salvage load mesh.
   */
  _drawDiverLiftBag(ctx, diver, salvage, toScreenX, toScreenY, scale, timeSec, mechFx = null) {
    if (!diver || !salvage) return;
    const anim = Math.max(0, Math.min(1, salvage.inflateAnim || (salvage.liftBagActive ? 1 : 0)));
    if (anim <= 0.02) return;

    const anchorX = toScreenX(diver.x);
    const anchorY = toScreenY(diver.y);
    const swayX = Math.max(-0.58, Math.min(0.58, -(diver.vx || 0) * 0.16)) + Math.sin(timeSec * 2.4) * 0.085;
    const strapLen = (1.18 + anim * 0.7) * scale;
    const bagX = anchorX + swayX * scale;
    const bagY = anchorY - strapLen;
    // Subtle Boyle's-Law breathing expansion when ascending or floating empty
    const boylePulse = salvage.status === 'float-warn' ? 1 + 0.06 * Math.sin(timeSec * 5.2) : 1;
    const bagW = (0.36 + anim * 0.46) * scale * boylePulse;
    const bagH = (0.4 + anim * 0.56) * scale * boylePulse;
    const isInflating = anim < 0.92 || mechFx?.activeAction?.kind === 'liftbag-inflate';
    const isDumping = salvage.status === 'float-warn' || (diver.vy || 0) < -0.35;

    ctx.save();

    // 1. Initial pressurized gas-injection shimmer plume from inflator into open canopy mouth
    if (isInflating) {
      const infFade = Math.max(0.15, 1 - anim * 0.72);
      const plumeGrad = ctx.createLinearGradient(anchorX, anchorY - 0.25 * scale, bagX, bagY + bagH * 0.2);
      plumeGrad.addColorStop(0, `rgba(254, 243, 199, ${(0.72 * infFade).toFixed(2)})`);
      plumeGrad.addColorStop(0.6, `rgba(186, 230, 253, ${(0.38 * infFade).toFixed(2)})`);
      plumeGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');
      ctx.fillStyle = plumeGrad;
      ctx.beginPath();
      ctx.moveTo(anchorX - 0.06 * scale, anchorY - 0.18 * scale);
      ctx.lineTo(anchorX + 0.06 * scale, anchorY - 0.18 * scale);
      ctx.lineTo(bagX + bagW * 0.34, bagY + bagH * 0.18);
      ctx.lineTo(bagX - bagW * 0.34, bagY + bagH * 0.18);
      ctx.closePath();
      ctx.fill();
    }

    // 2. Catenary braided yellow lifting tether + 4-point shroud bridle
    const bridleY = bagY + bagH * 0.52;
    const midStrapX = (anchorX + bagX) * 0.5 + swayX * 0.16 * scale;
    const midStrapY = (anchorY + bridleY) * 0.5;
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.94)';
    ctx.lineWidth = Math.max(1.6, 0.068 * scale);
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY - 0.12 * scale);
    ctx.quadraticCurveTo(midStrapX, midStrapY, bagX, bridleY);
    ctx.stroke();

    // 4 canopy shroud lines (outer + inner webbing straps)
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.85)';
    ctx.lineWidth = Math.max(1.1, 0.042 * scale);
    ctx.beginPath();
    for (const frac of [-0.58, -0.22, 0.22, 0.58]) {
      ctx.moveTo(bagX, bridleY);
      ctx.lineTo(bagX + bagW * frac, bagY + bagH * 0.15);
    }
    ctx.stroke();

    // Gleaming stainless steel harness bolt-snap carabiner & bridle D-ring
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = Math.max(1.3, 0.055 * scale);
    ctx.beginPath();
    ctx.arc(anchorX, anchorY - 0.16 * scale, Math.max(2.2, 0.095 * scale), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(bagX, bridleY, Math.max(2, 0.08 * scale), 0, Math.PI * 2);
    ctx.fill();

    // Heavy Salvage Load Mesh Sling visibly suspended beneath the carabiner when carrying >= 6kg!
    if ((salvage.payloadKg || 0) >= 6) {
      const slingX = anchorX + swayX * 0.22 * scale;
      const slingY = anchorY + 0.28 * scale;
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.82)';
      ctx.lineWidth = Math.max(1.1, 0.042 * scale);
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY - 0.08 * scale);
      ctx.lineTo(slingX, slingY);
      ctx.stroke();
      const loadR = Math.min(0.32, 0.16 + ((salvage.payloadKg || 6) / 30) * 0.15) * scale;
      const loadGrad = ctx.createRadialGradient(slingX - loadR * 0.3, slingY - loadR * 0.25, loadR * 0.1, slingX, slingY, loadR);
      loadGrad.addColorStop(0, '#fcd34d');
      loadGrad.addColorStop(0.55, '#b45309');
      loadGrad.addColorStop(1, '#451a03');
      ctx.fillStyle = loadGrad;
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = Math.max(1, 0.038 * scale);
      ctx.beginPath();
      ctx.arc(slingX, slingY + loadR * 0.45, loadR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 3. Multi-Gore Safety-Orange Commercial Ripstop Parachute Canopy
    // Dark open skirt interior shadow
    ctx.fillStyle = 'rgba(67, 20, 7, 0.72)';
    ctx.beginPath();
    ctx.ellipse(bagX, bagY + bagH * 0.16, bagW * 0.6, bagH * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createRadialGradient(bagX - bagW * 0.22, bagY - bagH * 0.36, bagW * 0.08, bagX, bagY, bagH * 1.08);
    grad.addColorStop(0, '#fed7aa');
    grad.addColorStop(0.32, '#fb923c');
    grad.addColorStop(0.72, '#ea580c');
    grad.addColorStop(1, '#9a3412');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = Math.max(1.4, 0.058 * scale);
    ctx.beginPath();
    ctx.moveTo(bagX - bagW * 0.62, bagY + bagH * 0.18);
    ctx.bezierCurveTo(
      bagX - bagW * 0.88,
      bagY - bagH * 0.68,
      bagX + bagW * 0.88,
      bagY - bagH * 0.68,
      bagX + bagW * 0.62,
      bagY + bagH * 0.18
    );
    ctx.quadraticCurveTo(bagX, bagY + bagH * 0.04, bagX - bagW * 0.62, bagY + bagH * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Vertical curved ripstop gore seam stitching
    ctx.strokeStyle = 'rgba(124, 45, 18, 0.52)';
    ctx.lineWidth = Math.max(1, 0.036 * scale);
    ctx.beginPath();
    ctx.moveTo(bagX, bagY - bagH * 0.44);
    ctx.quadraticCurveTo(bagX - bagW * 0.36, bagY - bagH * 0.16, bagX - bagW * 0.24, bagY + bagH * 0.12);
    ctx.moveTo(bagX, bagY - bagH * 0.44);
    ctx.quadraticCurveTo(bagX + bagW * 0.36, bagY - bagH * 0.16, bagX + bagW * 0.24, bagY + bagH * 0.12);
    ctx.stroke();

    // Segmented SOLAS retro-reflective safety tape band
    ctx.strokeStyle = 'rgba(254, 249, 195, 0.92)';
    ctx.lineWidth = Math.max(1.5, 0.072 * scale);
    ctx.setLineDash([Math.max(3, 0.16 * scale), Math.max(2, 0.07 * scale)]);
    ctx.beginPath();
    ctx.moveTo(bagX - bagW * 0.58, bagY - bagH * 0.05);
    ctx.quadraticCurveTo(bagX, bagY - bagH * 0.18, bagX + bagW * 0.58, bagY - bagH * 0.05);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Top Spring-Loaded Overpressure Dump Valve + Fluttering Pull-Cord Lanyard
    const valveLift = isDumping ? (0.04 + 0.03 * Math.sin(timeSec * 18)) * scale : 0;
    const valveY = bagY - bagH * 0.46;
    if (isDumping) {
      // Soft escaping white gas flutter at cracked dump cap
      ctx.fillStyle = 'rgba(224, 242, 254, 0.55)';
      ctx.beginPath();
      ctx.ellipse(bagX, valveY - valveLift - 0.08 * scale, 0.16 * scale, 0.07 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = Math.max(1, 0.04 * scale);
    ctx.beginPath();
    ctx.arc(bagX, valveY - valveLift, Math.max(2.2, 0.095 * scale), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Dangling dump pull-cord + bright red toggle ball
    const cordSway = Math.sin(timeSec * (isDumping ? 9.5 : 3.2)) * 0.1 * scale;
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.78)';
    ctx.lineWidth = Math.max(1, 0.032 * scale);
    ctx.beginPath();
    ctx.moveTo(bagX + 0.08 * scale, valveY);
    ctx.quadraticCurveTo(bagX + bagW * 0.72 + cordSway, bagY + bagH * 0.1, bagX + bagW * 0.42 + cordSway * 1.4, bagY + bagH * 0.58);
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(bagX + bagW * 0.42 + cordSway * 1.4, bagY + bagH * 0.58, Math.max(1.8, 0.065 * scale), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  /**
   * Cave Interactive Parity elements: steady karst spring currents, pulsing tidal blue-hole siphons,
   * clipped staged bailout/deco cylinders, unlined cave junction line-markers & jump spools, and
   * abandoned tangled cave line traps cuttable with shears.
   */
  /**
   * Shared high-detail AL80 technical stage cylinder renderer (v148):
   * Brushed metallic cylindrical gradient, color-coded gas band, cam/bungee hose retainers,
   * brass DIN valve + chrome turret, coiled HP hose + glowing mini SPG pressure dial,
   * and a stainless steel bolt-snap carabiner clipped cleanly to the line.
   */
  _drawDetailedStageCylinder(ctx, scale, { bodyCol, trimCol, claimed = false, cordColor = 'rgba(226, 232, 240, 0.8)', tiltRad = -0.4, timeSec = 0 }) {
    // Braided rigging tether cord + gleaming stainless bolt-snap carabiner
    ctx.strokeStyle = cordColor;
    ctx.lineWidth = Math.max(1.2, 0.046 * scale);
    ctx.beginPath();
    ctx.moveTo(0, -0.5 * scale);
    ctx.lineTo(0, -1.04 * scale);
    ctx.stroke();

    // Stainless steel bolt-snap clip at top anchor
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = Math.max(1.3, 0.052 * scale);
    ctx.beginPath();
    ctx.arc(0, -1.04 * scale, Math.max(2.1, 0.095 * scale), 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.rotate(tiltRad);
    const cw = 0.98 * scale;
    const ch = 0.4 * scale;

    // Metallic brushed-aluminum cylindrical body gradient
    const cylGrad = ctx.createLinearGradient?.(0, -ch * 0.55, 0, ch * 0.55);
    if (cylGrad) {
      if (claimed) {
        cylGrad.addColorStop(0, '#94a3b8');
        cylGrad.addColorStop(0.32, '#475569');
        cylGrad.addColorStop(1, '#1e293b');
      } else {
        cylGrad.addColorStop(0, '#f8fafc');
        cylGrad.addColorStop(0.28, '#cbd5e1');
        cylGrad.addColorStop(0.7, '#64748b');
        cylGrad.addColorStop(1, '#1e293b');
      }
      ctx.fillStyle = cylGrad;
    } else {
      ctx.fillStyle = claimed ? '#475569' : '#cbd5e1';
    }
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(1.2, 0.05 * scale);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(-cw * 0.5, -ch * 0.5, cw, ch, ch * 0.46);
    } else {
      ctx.rect(-cw * 0.5, -ch * 0.5, cw, ch);
    }
    ctx.fill();
    ctx.stroke();

    // Color-coded gas mix shoulder band + glossy specular stripe
    ctx.fillStyle = bodyCol;
    ctx.fillRect(-cw * 0.22, -ch * 0.46, cw * 0.42, ch * 0.92);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
    ctx.fillRect(-cw * 0.4, -ch * 0.34, cw * 0.8, ch * 0.14);

    // Dual matte-black bungee hose-retainer cam bands
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-cw * 0.36, -ch * 0.5, cw * 0.06, ch);
    ctx.fillRect(cw * 0.24, -ch * 0.5, cw * 0.06, ch);

    // Coiled black regulator hose tucked along cylinder + mini glowing SPG pressure dial
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(1.5, 0.062 * scale);
    ctx.beginPath();
    ctx.moveTo(cw * 0.54, 0.06 * scale);
    ctx.bezierCurveTo(cw * 0.52, ch * 0.85, -cw * 0.15, ch * 0.9, -cw * 0.32, ch * 0.28);
    ctx.stroke();

    // Mini SPG dial face (emerald/cyan full vs dim red empty/claimed)
    const spgX = -cw * 0.32;
    const spgY = ch * 0.32;
    const spgR = Math.max(2.3, 0.105 * scale);
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = Math.max(1, 0.036 * scale);
    ctx.beginPath();
    ctx.arc(spgX, spgY, spgR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = claimed ? '#ef4444' : trimCol;
    ctx.beginPath();
    ctx.arc(spgX, spgY, spgR * 0.62, 0, Math.PI * 2);
    ctx.fill();

    // Brass DIN valve manifold + chrome 1st stage turret + knurled rubber knob
    ctx.fillStyle = '#eab308';
    ctx.fillRect(cw * 0.44, -ch * 0.22, 0.14 * scale, ch * 0.44);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(cw * 0.54, -ch * 0.24, 0.14 * scale, ch * 0.48);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(cw * 0.68, -ch * 0.12, Math.max(2, 0.088 * scale), 0, Math.PI * 2);
    ctx.fill();

    // Stainless stage-rigging bolt-snap at cylinder neck
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = Math.max(1.1, 0.044 * scale);
    ctx.beginPath();
    ctx.arc(cw * 0.4, -ch * 0.55, Math.max(1.6, 0.068 * scale), 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  },

  _drawCaveInteractives(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, diver = null, wreckState = null, mechFx = null) {
    const level = this.level;
    ctx.save();

    // 0. Overhead Calcite / Glacial Stalactite Draperies (pre-cached & SDF-anchored to true ceiling rock)
    if (Array.isArray(level.segments)) {
      if (!this._stalactiteCache) {
        const list = [];
        for (let i = 0; i < level.segments.length; i += 2) {
          const seg = level.segments[i];
          const dx = Math.abs(seg.bx - seg.ax);
          const dy = Math.abs(seg.by - seg.ay);
          // Skip steep/vertical shafts where stalactites have no overhead ceiling
          if (dy > dx * 0.75) continue;
          const mx = (seg.ax + seg.bx) * 0.5;
          const my = (seg.ay + seg.by) * 0.5;
          const mr = ((seg.ra || 2.5) + (seg.rb || 2.5)) * 0.5;
          if (mr < 2.5 || my < 8) continue;
          for (let t = -2; t <= 2; t++) {
            const tx = mx + t * 0.42;
            const lenM = 0.46 + (Math.abs(t * 7 + i * 3) % 4) * 0.22;
            const bwM = 0.14 + (t === 0 ? 0.06 : 0);
            // March upward from open passage center to locate the exact ceiling rock surface
            let hitY = null;
            const startY = my - mr * 0.35;
            const maxY = Math.max(4.0, my - mr - 2.4);
            for (let y = startY; y >= maxY; y -= 0.16) {
              if (evaluateCaveSDF(level, tx, y) >= 0.05) {
                hitY = y;
                break;
              }
            }
            if (hitY === null || hitY < 4.2) continue;
            // Verify clear open water below the icicle tip so it hangs cleanly into the cavern
            if (evaluateCaveSDF(level, tx, hitY + lenM + 0.35) > -0.3) continue;
            list.push({ x: tx, y: hitY, len: lenM, bw: bwM });
          }
        }
        this._stalactiteCache = list;
      }
      const stals = this._stalactiteCache;
      if (stals.length > 0) {
        const isGlacial = level.theme?.id === 'kverkfjoll-glacier' || level.theme?.id === 'greenland-iceberg';
        const isMine = level.theme?.id === 'nordic-mine';
        const isBermuda = level.theme?.id === 'bermuda-sargasso';
        const stalCol = isGlacial
          ? 'rgba(125, 211, 252, 0.48)'
          : isMine
            ? 'rgba(92, 84, 78, 0.44)'
            : isBermuda
              ? 'rgba(218, 204, 188, 0.48)'
              : 'rgba(148, 138, 118, 0.42)';
        const stalHi = isGlacial
          ? 'rgba(224, 242, 254, 0.46)'
          : isBermuda
            ? 'rgba(248, 240, 232, 0.38)'
            : 'rgba(214, 204, 184, 0.34)';
        for (let i = 0; i < stals.length; i++) {
          const st = stals[i];
          if (st.x + 1 < visX0 || st.x - 1 > visX1 || st.y + st.len + 1 < visY0 || st.y - 1 > visY1) continue;
          const sx = toScreenX(st.x);
          const sy = toScreenY(st.y);
          const len = st.len * scale;
          const bw = st.bw * scale;
          ctx.fillStyle = stalCol;
          ctx.beginPath();
          ctx.moveTo(sx - bw, sy - 0.14 * scale);
          ctx.lineTo(sx + bw, sy - 0.14 * scale);
          ctx.lineTo(sx, sy + len);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = stalHi;
          ctx.beginPath();
          ctx.moveTo(sx, sy - 0.12 * scale);
          ctx.lineTo(sx + bw * 0.55, sy - 0.12 * scale);
          ctx.lineTo(sx, sy + len * 0.85);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // 1. Steady Karst Spring / Underground River Currents
    if (Array.isArray(level.caveCurrents)) {
      for (let c = 0; c < level.caveCurrents.length; c++) {
        const cur = level.caveCurrents[c];
        const cr = cur.radius || 4.0;
        if (cur.x + cr + 2 < visX0 || cur.x - cr - 2 > visX1 || cur.y + cr + 2 < visY0 || cur.y - cr - 2 > visY1) continue;
        const sx = toScreenX(cur.x);
        const sy = toScreenY(cur.y);
        const sr = cr * scale;
        const ang = Math.atan2(cur.vy || 0, cur.vx || 1);
        const spd = Math.hypot(cur.vx || 0, cur.vy || 0);

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ang);
        ctx.strokeStyle = 'rgba(94, 234, 212, 0.38)';
        ctx.lineWidth = Math.max(1.3, 0.055 * scale);
        ctx.lineCap = 'round';
        for (let k = -2; k <= 2; k++) {
          const oy = k * sr * 0.3;
          const travel = ((timeSec * (1.25 + spd * 0.65) + k * 0.63 + c * 0.4) % 1.0) * 2 - 1;
          const ox = travel * sr * 0.56;
          const segLen = sr * 0.42;
          ctx.beginPath();
          ctx.moveTo(ox - segLen * 0.5, oy);
          ctx.lineTo(ox + segLen * 0.5, oy);
          ctx.lineTo(ox + segLen * 0.5 - 0.24 * scale, oy - 0.17 * scale);
          ctx.moveTo(ox + segLen * 0.5, oy);
          ctx.lineTo(ox + segLen * 0.5 - 0.24 * scale, oy + 0.17 * scale);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 2. Pulsing Tidal Blue-Hole & Karst Siphon Surges (in exact phase with computeSurgeWave!)
    if (Array.isArray(level.surgeZones)) {
      for (let z = 0; z < level.surgeZones.length; z++) {
        const zone = level.surgeZones[z];
        const zr = zone.radius || 4.0;
        if (zone.x + zr + 2 < visX0 || zone.x - zr - 2 > visX1 || zone.y + zr + 2 < visY0 || zone.y - zr - 2 > visY1) continue;
        const wave = computeSurgeWave(zone, timeSec);
        const sx = toScreenX(zone.x);
        const sy = toScreenY(zone.y);
        const sr = zr * scale;
        const mag = Math.hypot(zone.vx || 0, zone.vy || 0) || 1;
        const dirX = (zone.vx || 0) / mag;
        const dirY = (zone.vy || 0) / mag;
        const flowSign = wave >= 0 ? 1 : -1;
        const strength = Math.abs(wave);

        if (strength > 0.05) {
          const ang = Math.atan2(dirY * flowSign, dirX * flowSign);
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(ang);
          ctx.strokeStyle = `rgba(125, 211, 252, ${0.22 + strength * 0.58})`;
          ctx.lineWidth = Math.max(1.5, (0.06 + strength * 0.06) * scale);
          ctx.lineCap = 'round';
          for (let k = -2; k <= 2; k++) {
            const oy = k * sr * 0.32;
            const travel = ((timeSec * 5.0 + k * 0.7) % 1.0) * 2 - 1;
            const ox = travel * sr * 0.55;
            const segLen = sr * (0.35 + strength * 0.25);
            ctx.beginPath();
            ctx.moveTo(ox - segLen * 0.5, oy);
            ctx.lineTo(ox + segLen * 0.5, oy);
            ctx.lineTo(ox + segLen * 0.5 - 0.28 * scale, oy - 0.2 * scale);
            ctx.moveTo(ox + segLen * 0.5, oy);
            ctx.lineTo(ox + segLen * 0.5 - 0.28 * scale, oy + 0.2 * scale);
            ctx.stroke();
          }
          ctx.restore();
        } else {
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.34)';
          ctx.lineWidth = Math.max(1.1, 0.045 * scale);
          ctx.setLineDash([5, 6]);
          ctx.beginPath();
          ctx.arc(sx, sy, sr * 0.72, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // 3. Staged Bailout / Reserve Scuba Cylinders clipped on rock tie-offs
    if (Array.isArray(level.stageCaches)) {
      const claimedSet = wreckState?.claimedStageIds;
      for (let i = 0; i < level.stageCaches.length; i++) {
        const cache = level.stageCaches[i];
        if (cache.x + 3 < visX0 || cache.x - 3 > visX1 || cache.y + 3 < visY0 || cache.y - 3 > visY1) continue;
        const sx = toScreenX(cache.x);
        const sy = toScreenY(cache.y);
        const claimed = claimedSet?.has(cache.id);
        const bob = Math.sin(timeSec * 1.9 + i * 2.1) * 0.09 * scale;
        const isTmx = cache.gasId === 'TMX1455';
        const isO2 = cache.gasId === 'O2';
        const bodyCol = claimed ? '#475569' : isTmx ? '#f59e0b' : isO2 ? '#10b981' : '#0ea5e9';
        const trimCol = claimed ? '#94a3b8' : isTmx ? '#fef08a' : isO2 ? '#a7f3d0' : '#bae6fd';

        ctx.save();
        ctx.translate(sx, sy + bob);

        // Pulsing beacon ring for unclaimed reserve stage bottle
        if (!claimed) {
          const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3.2 + i);
          ctx.strokeStyle = isTmx
            ? `rgba(251, 191, 36, ${0.28 + pulse * 0.34})`
            : isO2
              ? `rgba(52, 211, 153, ${0.28 + pulse * 0.34})`
              : `rgba(56, 189, 248, ${0.28 + pulse * 0.34})`;
          ctx.lineWidth = Math.max(1.5, 0.06 * scale);
          ctx.beginPath();
          ctx.arc(0, 0, (0.95 + pulse * 0.25) * scale, 0, Math.PI * 2);
          ctx.stroke();
        }

        wreckAndInteractivesMethods._drawDetailedStageCylinder(ctx, scale, {
          bodyCol,
          trimCol,
          claimed,
          cordColor: 'rgba(226, 232, 240, 0.78)',
          tiltRad: -0.42 + Math.sin(timeSec * 1.4 + i) * 0.04,
          timeSec,
        });

        // Crisp stenciled tag below cylinder
        if (scale >= 12) {
          ctx.font = `700 ${Math.max(9, Math.round(scale * 0.31))}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = claimed ? 'rgba(148, 163, 184, 0.85)' : trimCol;
          const shortTag = claimed ? '✓ STAGE' : `${isTmx ? 'TMX' : isO2 ? 'O2' : 'EAN'} +${cache.barBonus || 65}b`;
          ctx.fillText(shortTag, 0, 0.58 * scale);
        }
        ctx.restore();
      }
    }

    // 4. Unlined Cave Line-Marker & Jump-Spool Stations
    if (Array.isArray(level.lineAnchors)) {
      const placedSet = wreckState?.placedMarkerIds;
      for (let i = 0; i < level.lineAnchors.length; i++) {
        const anchor = level.lineAnchors[i];
        if (anchor.x + 3 < visX0 || anchor.x - 3 > visX1 || anchor.y + 3 < visY0 || anchor.y - 3 > visY1) continue;
        const sx = toScreenX(anchor.x);
        const sy = toScreenY(anchor.y);
        const placed = placedSet?.has(anchor.id);

        ctx.save();
        ctx.translate(sx, sy);
        if (placed) {
          // Clipped 3D beveled hi-vis yellow ABS cave arrow ("REM cookie") with line-wrap notches!
          ctx.rotate(anchor.dirAngle || -Math.PI * 0.5);
          // Taut cave guideline threaded through arrow wrap notches
          ctx.strokeStyle = 'rgba(248, 250, 252, 0.82)';
          ctx.lineWidth = Math.max(1.1, 0.042 * scale);
          ctx.beginPath();
          ctx.moveTo(-0.78 * scale, 0);
          ctx.lineTo(0.86 * scale, 0);
          ctx.stroke();

          const arrowGrad = ctx.createLinearGradient?.(-0.45 * scale, -0.38 * scale, 0.72 * scale, 0.38 * scale);
          if (arrowGrad) {
            arrowGrad.addColorStop(0, '#fef08a');
            arrowGrad.addColorStop(0.5, '#facc15');
            arrowGrad.addColorStop(1, '#ca8a04');
            ctx.fillStyle = arrowGrad;
          } else {
            ctx.fillStyle = '#facc15';
          }
          ctx.strokeStyle = '#713f12';
          ctx.lineWidth = Math.max(1.2, 0.05 * scale);
          ctx.beginPath();
          ctx.moveTo(0.72 * scale, 0);
          ctx.lineTo(-0.36 * scale, -0.38 * scale);
          ctx.lineTo(-0.22 * scale, -0.14 * scale);
          // Authentic cave-arrow wrap notch
          ctx.lineTo(-0.36 * scale, -0.06 * scale);
          ctx.lineTo(-0.24 * scale, 0);
          ctx.lineTo(-0.36 * scale, 0.06 * scale);
          ctx.lineTo(-0.22 * scale, 0.14 * scale);
          ctx.lineTo(-0.36 * scale, 0.38 * scale);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Glossy bevel ridge
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.lineWidth = Math.max(0.9, 0.032 * scale);
          ctx.beginPath();
          ctx.moveTo(-0.18 * scale, -0.18 * scale);
          ctx.lineTo(0.46 * scale, 0);
          ctx.stroke();
        } else {
          // Waiting machined Delrin jump-spool station with radial lightening holes & double-ender bolt-snap
          const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3.0 + i * 1.4);
          ctx.strokeStyle = `rgba(250, 204, 21, ${0.32 + pulse * 0.35})`;
          ctx.lineWidth = Math.max(1.3, 0.05 * scale);
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(0, 0, 0.85 * scale, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.save();
          ctx.rotate(timeSec * 0.75 + i);
          // Wound white nylon cave line visible inside flange
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.arc(0, 0, 0.34 * scale, 0, Math.PI * 2);
          ctx.fill();
          // Machined Delrin spool flange
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = Math.max(1.5, 0.068 * scale);
          ctx.beginPath();
          ctx.arc(0, 0, 0.42 * scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // 6 machined lightening holes showing wound white line underneath
          ctx.fillStyle = '#f8fafc';
          for (let h = 0; h < 6; h++) {
            const ha = (h / 6) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(Math.cos(ha) * 0.27 * scale, Math.sin(ha) * 0.27 * scale, Math.max(1.2, 0.055 * scale), 0, Math.PI * 2);
            ctx.fill();
          }
          // Center finger-hole hub
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = Math.max(1, 0.04 * scale);
          ctx.beginPath();
          ctx.arc(0, 0, 0.14 * scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          // Clipped stainless double-ender bolt-snap hanging on side
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = Math.max(1.3, 0.05 * scale);
          ctx.beginPath();
          ctx.arc(0.42 * scale, -0.22 * scale, Math.max(2, 0.085 * scale), 0, Math.PI * 2);
          ctx.stroke();

          if (scale >= 12) {
            ctx.font = `700 ${Math.max(9, Math.round(scale * 0.3))}px "JetBrains Mono", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#fef08a';
            ctx.fillText(`+${anchor.reelBonusM || 40}m SPOOL`, 0, 0.58 * scale);
          }
        }
        ctx.restore();
      }
    }

    // 5. Abandoned Tangled Cave Line Traps (cuttable with [E] shears / buddy rescue)
    if (Array.isArray(level.snagZones)) {
      const cutSet = wreckState?.cutSnagIds;
      const activeIdx = wreckState?.activeSnagIndex ?? -1;
      for (let s = 0; s < level.snagZones.length; s++) {
        const snag = level.snagZones[s];
        const snagKey = snag.id || `snag_${s}`;
        const r = snag.radius || 2.1;
        if (snag.x + r + 3 < visX0 || snag.x - r - 3 > visX1 || snag.y + r + 3 < visY0 || snag.y - r - 3 > visY1) continue;
        const sx = toScreenX(snag.x);
        const sy = toScreenY(snag.y);
        const sr = r * scale;
        const sway = Math.sin(timeSec * 1.55 + s * 2.3) * 0.2 * scale;
        const isCut = cutSet?.has(snagKey);

        if (isCut) {
          ctx.strokeStyle = 'rgba(226, 232, 240, 0.34)';
          ctx.lineWidth = Math.max(1, 0.035 * scale);
          ctx.beginPath();
          for (const side of [-1, 1]) {
            ctx.moveTo(sx + side * sr * 0.78, sy - sr * 0.65);
            ctx.quadraticCurveTo(sx + side * sr * 0.55 + sway, sy, sx + side * sr * 0.68 + sway, sy + sr * 0.62);
          }
          ctx.stroke();
          continue;
        }

        const isHooked = activeIdx === s;
        // Loose snarled pale-yellow nylon cave guideline loops
        ctx.strokeStyle = isHooked ? 'rgba(248, 113, 113, 0.85)' : 'rgba(254, 240, 138, 0.58)';
        ctx.lineWidth = Math.max(1.1, 0.045 * scale);
        ctx.beginPath();
        for (let k = -2; k <= 2; k++) {
          const ang = k * 0.62 + sway * 0.02;
          ctx.ellipse(
            sx + Math.cos(ang) * sr * 0.22 + sway * 0.35,
            sy + Math.sin(ang) * sr * 0.22,
            sr * (0.48 + Math.abs(k) * 0.14),
            sr * (0.28 + (2 - Math.abs(k)) * 0.12),
            ang,
            0,
            Math.PI * 2
          );
        }
        ctx.stroke();

        if (isHooked && diver) {
          const dx = toScreenX(diver.x);
          const dy = toScreenY(diver.y);
          ctx.strokeStyle = 'rgba(248, 113, 113, 0.92)';
          ctx.lineWidth = Math.max(1.6, 0.055 * scale);
          ctx.beginPath();
          ctx.moveTo(sx - sr * 0.28, sy - sr * 0.22);
          ctx.lineTo(dx, dy);
          ctx.moveTo(sx + sr * 0.28, sy + sr * 0.22);
          ctx.lineTo(dx, dy);
          ctx.stroke();
        }
      }
    }

    // 6. Crankable Mine / Subterranean Blast-Door Bulkhead Hatches (e.g., Ojamo Flooded Iron Mine)
    if (typeof this._drawWatertightHatches === 'function') {
      this._drawWatertightHatches(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, wreckState, mechFx);
    }

    ctx.restore();
  },

  /**
   * Post-lighting subtle phosphorescent glints for placed yellow cave arrows and clipped stage bottles
   * so divers can navigate by placed markers and spot reserve gas even in deep sumps.
   */
  _drawDroppedStages(ctx, droppedStages, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec) {
    if (!Array.isArray(droppedStages) || droppedStages.length === 0) return;
    for (let i = 0; i < droppedStages.length; i++) {
      const st = droppedStages[i];
      if (!st) continue;
      if (st.x + 3 < visX0 || st.x - 3 > visX1 || st.y + 3 < visY0 || st.y - 3 > visY1) continue;
      const sx = toScreenX(st.x);
      const sy = toScreenY(st.y);
      const bob = Math.sin(timeSec * 2.1 + i * 1.7) * 0.08 * scale;
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3.4 + i);
      const isTmx = st.gasId === 'TMX1455';
      const isO2 = st.gasId === 'O2';
      const bodyCol = st.color || (isTmx ? '#c084fc' : isO2 ? '#4ade80' : '#38bdf8');
      const trimCol = isTmx ? '#f5d0fe' : isO2 ? '#bbf7d0' : '#bae6fd';

      ctx.save();
      ctx.translate(sx, sy + bob);

      // Soft pulsing retrieval locator ring
      ctx.strokeStyle = isTmx
        ? `rgba(192, 132, 252, ${0.32 + pulse * 0.36})`
        : isO2
          ? `rgba(74, 222, 128, ${0.32 + pulse * 0.36})`
          : `rgba(56, 189, 248, ${0.32 + pulse * 0.36})`;
      ctx.lineWidth = Math.max(1.5, 0.06 * scale);
      ctx.beginPath();
      ctx.arc(0, 0, (0.92 + pulse * 0.24) * scale, 0, Math.PI * 2);
      ctx.stroke();

      wreckAndInteractivesMethods._drawDetailedStageCylinder(ctx, scale, {
        bodyCol,
        trimCol,
        claimed: false,
        cordColor: 'rgba(253, 224, 71, 0.88)',
        tiltRad: -0.36 + Math.sin(timeSec * 1.5 + i) * 0.04,
        timeSec,
      });

      // Crisp stenciled bar + mix tag
      if (scale >= 11) {
        ctx.font = `700 ${Math.max(9, Math.round(scale * 0.3))}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = trimCol;
        const shortTag = `${st.bar || 45}b ${st.shortLabel || st.gasId}`;
        ctx.fillText(shortTag, 0, 0.56 * scale);
      }
      ctx.restore();
    }
  },

  _drawCaveInteractiveBeacons(ctx, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, wreckState = null) {
    const level = this.level;
    const placedSet = wreckState?.placedMarkerIds;
    const claimedSet = wreckState?.claimedStageIds;
    const hasAnchors = Array.isArray(level.lineAnchors) && level.lineAnchors.length > 0;
    const hasStages = Array.isArray(level.stageCaches) && level.stageCaches.length > 0;
    if (!hasAnchors && !hasStages) return;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    if (hasAnchors && placedSet && placedSet.size > 0) {
      for (let i = 0; i < level.lineAnchors.length; i++) {
        const anchor = level.lineAnchors[i];
        if (!placedSet.has(anchor.id)) continue;
        if (anchor.x + 3 < visX0 || anchor.x - 3 > visX1 || anchor.y + 3 < visY0 || anchor.y - 3 > visY1) continue;
        const sx = toScreenX(anchor.x);
        const sy = toScreenY(anchor.y);
        const pulse = 0.72 + 0.28 * Math.sin(timeSec * 2.6 + i);
        if (this.glowStamps?.warm) {
          const r = 1.65 * scale;
          ctx.globalAlpha = 0.42 * pulse;
          ctx.drawImage(this.glowStamps.warm, sx - r, sy - r, r * 2, r * 2);
        }
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(anchor.dirAngle || -Math.PI * 0.5);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.moveTo(0.64 * scale, 0);
        ctx.lineTo(-0.38 * scale, -0.32 * scale);
        ctx.lineTo(-0.22 * scale, 0);
        ctx.lineTo(-0.38 * scale, 0.32 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    if (hasStages) {
      for (let i = 0; i < level.stageCaches.length; i++) {
        const cache = level.stageCaches[i];
        if (claimedSet?.has(cache.id)) continue;
        if (cache.x + 3 < visX0 || cache.x - 3 > visX1 || cache.y + 3 < visY0 || cache.y - 3 > visY1) continue;
        const sx = toScreenX(cache.x);
        const sy = toScreenY(cache.y);
        const glint = 0.22 + 0.16 * Math.sin(timeSec * 3.1 + i * 1.9);
        const stamp = cache.gasId === 'TMX1455' ? this.glowStamps?.warm : this.glowStamps?.cyan;
        if (stamp) {
          const r = 1.35 * scale;
          ctx.globalAlpha = glint;
          ctx.drawImage(stamp, sx - r, sy - r, r * 2, r * 2);
        }
      }
    }

    ctx.restore();
  }
};
