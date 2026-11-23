import { evaluateCaveSDF } from '../collision.js';

/**
 * Draws submerged storytelling set-pieces and overhead pelagic shadow crossings (extracted v171).
 */
export function drawSubmergedStories(renderer, ctx, stories, xMin, xMax, yMin, yMax, toScreenX, toScreenY, scale, timeSec, pass = 'world') {

    // Overhead Pelagic Shadow Crossing: slow colossal Whale Shark or Giant Manta silhouette gliding across open-water light (v156)
    const pelagic = stories?.pelagicShadow;
    if (pass === 'world' && pelagic && (pelagic.enabled !== false)) {
      const period = pelagic.periodSec || 46;
      const crossDur = pelagic.crossingDurationSec || Math.min(22, period * 0.48);
      const phaseTime = (((timeSec + (pelagic.phaseOffset || 0)) % period) + period) % period;
      if (phaseTime < crossDur) {
        const u = phaseTime / crossDur;
        const span = Math.max(12, pelagic.xMax - pelagic.xMin);
        const dir = (pelagic.direction ?? 1) >= 0 ? 1 : -1;
        const wx = dir > 0 ? pelagic.xMin + u * span : pelagic.xMax - u * span;
        const baseY = Number.isFinite(pelagic.y) ? pelagic.y : (pelagic.depthM || 6.0);
        const wy = baseY + Math.sin(u * Math.PI * 2) * 0.65;
        const sizeM = pelagic.size || pelagic.sizeM || 6.2;
        const halfM = sizeM * 0.42;
        if (wx + halfM < xMin || wx - halfM > xMax || wy + sizeM * 1.5 < yMin || wy - sizeM > yMax) {
          // Off-viewport pelagic shadow: skip all 3 SDF queries
        } else {
        // Hard SDF rock-wall clearance guard: never draw pelagic shadow inside or clipping through solid rock!
        const sdfMax = renderer.level
          ? Math.max(
              evaluateCaveSDF(renderer.level, wx, wy),
              evaluateCaveSDF(renderer.level, wx - halfM, wy),
              evaluateCaveSDF(renderer.level, wx + halfM, wy)
            )
          : -5;
        const rockClearFade = Math.max(0, Math.min(1, (-sdfMax - 0.35) / 1.45));
        const psx = toScreenX(wx);
        const psy = toScreenY(wy);
        const len = sizeM * scale;
        const fade = Math.sin(Math.min(1, Math.max(0, u)) * Math.PI) * rockClearFade;
        const alpha = 0.24 * fade;
        if (alpha > 0.01) {
          ctx.save();
          const sg = ctx.createLinearGradient?.(psx, psy, psx, psy + len * 1.45);
          if (sg && typeof sg.addColorStop === 'function') {
            sg.addColorStop(0, `rgba(2, 6, 23, ${(alpha * 0.85).toFixed(3)})`);
            sg.addColorStop(0.55, `rgba(2, 6, 23, ${(alpha * 0.38).toFixed(3)})`);
            sg.addColorStop(1, 'rgba(2, 6, 23, 0)');
            ctx.fillStyle = sg;
          } else {
            ctx.fillStyle = `rgba(2, 6, 23, ${(alpha * 0.45).toFixed(3)})`;
          }
          ctx.beginPath();
          ctx.moveTo(psx - len * 0.42, psy);
          ctx.lineTo(psx + len * 0.42, psy);
          ctx.lineTo(psx + len * 0.72, psy + len * 1.45);
          ctx.lineTo(psx - len * 0.72, psy + len * 1.45);
          ctx.closePath();
          ctx.fill();

          ctx.translate(psx, psy);
          ctx.scale(dir, 1);
          ctx.fillStyle = `rgba(3, 12, 26, ${(alpha * 1.65).toFixed(3)})`;
          if (pelagic.kind === 'manta' || pelagic.species === 'giant-manta') {
            const wingFlap = Math.sin(timeSec * 1.65) * len * 0.08;
            ctx.beginPath();
            ctx.moveTo(len * 0.36, 0);
            ctx.quadraticCurveTo(len * 0.08, -len * 0.28 + wingFlap, -len * 0.12, -len * 0.32 + wingFlap);
            ctx.quadraticCurveTo(-len * 0.2, -len * 0.06, -len * 0.48, 0);
            ctx.quadraticCurveTo(-len * 0.2, len * 0.06, -len * 0.12, len * 0.28 - wingFlap * 0.7);
            ctx.quadraticCurveTo(len * 0.08, len * 0.24 - wingFlap * 0.7, len * 0.36, 0);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = `rgba(3, 12, 26, ${(alpha * 1.5).toFixed(3)})`;
            ctx.lineWidth = Math.max(1.2, 0.045 * scale);
            ctx.beginPath();
            ctx.moveTo(-len * 0.42, 0);
            ctx.quadraticCurveTo(-len * 0.64, Math.sin(timeSec * 2.2) * len * 0.05, -len * 0.84, 0);
            ctx.stroke();
          } else {
            const tailWag = Math.sin(timeSec * 1.35) * len * 0.055;
            ctx.beginPath();
            ctx.moveTo(len * 0.46, -len * 0.03);
            ctx.quadraticCurveTo(len * 0.12, -len * 0.16, -len * 0.34, -len * 0.04 + tailWag * 0.4);
            ctx.lineTo(-len * 0.56, -len * 0.18 + tailWag);
            ctx.lineTo(-len * 0.48, tailWag * 0.5);
            ctx.lineTo(-len * 0.54, len * 0.13 + tailWag);
            ctx.lineTo(-len * 0.34, len * 0.05 + tailWag * 0.4);
            ctx.quadraticCurveTo(len * 0.1, len * 0.14, len * 0.46, len * 0.04);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(len * 0.04, -len * 0.12);
            ctx.lineTo(-len * 0.06, -len * 0.23);
            ctx.lineTo(-len * 0.12, -len * 0.1);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }
        }
      }
    }
    const list = stories?.setPieces;
    if (!Array.isArray(list) || list.length === 0) return;

    ctx.save();
    for (let i = 0; i < list.length; i++) {
      const sp = list[i];
      if (!sp || sp.x < xMin || sp.x > xMax || sp.y < yMin || sp.y > yMax) continue;

      const sx = toScreenX(sp.x);
      const sy = toScreenY(sp.y);
      const sz = (sp.size || 1.0) * scale;

      if (pass === 'emissive') {
        if (sp.kind === 'emergency-lamp') {
          // Erratic dying-battery red-amber emergency bulkhead lamp glow
          const flick =
            0.38 +
            0.35 * Math.max(0, Math.sin(timeSec * 3.1 + sp.phase)) +
            0.27 * (Math.sin(timeSec * 19.3 + sp.phase * 2.7) > 0.72 ? 0.15 : 1);
          const rad = sz * 3.6;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const redStamp = renderer.glowStamps?.red;
          if (redStamp && typeof ctx.drawImage === 'function') {
            ctx.globalAlpha = Math.max(0.05, Math.min(1, 0.72 * flick));
            ctx.drawImage(redStamp, sx - rad, sy + sz * 0.25 - rad, rad * 2, rad * 2);
            ctx.globalAlpha = 1;
          } else {
            ctx.fillStyle = `rgba(220, 38, 38, ${(0.28 * flick).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(sx, sy + sz * 0.25, rad, 0, Math.PI * 2);
            ctx.fill();
          }
          // Glowing crimson bulb filament core
          ctx.fillStyle = `rgba(254, 202, 202, ${(0.85 * flick).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(sx, sy + sz * 0.22, Math.max(2, sz * 0.14), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (sp.kind === 'porthole-shaft') {
          // Volumetric tilted cobalt-cyan porthole light shaft with drifting dust motes
          const len = (sp.shaftLen || 4.8) * scale;
          const ang = sp.shaftAngle || 0.44;
          const sway = Math.sin(timeSec * 1.1 + sp.phase) * 0.04;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(ang + sway);
          ctx.globalCompositeOperation = 'screen';
          const sg = ctx.createLinearGradient?.(0, 0, 0, len);
          if (sg && typeof sg.addColorStop === 'function') {
            sg.addColorStop(0, 'rgba(125, 211, 252, 0.32)');
            sg.addColorStop(0.5, 'rgba(56, 189, 248, 0.12)');
            sg.addColorStop(1, 'rgba(14, 165, 233, 0)');
            ctx.fillStyle = sg;
          } else {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
          }
          ctx.beginPath();
          ctx.moveTo(-sz * 0.34, 0);
          ctx.lineTo(sz * 0.34, 0);
          ctx.lineTo(sz * 1.28, len);
          ctx.lineTo(-sz * 1.05, len);
          ctx.closePath();
          ctx.fill();
          // Backlit dust motes suspended inside the porthole shaft
          ctx.fillStyle = 'rgba(224, 242, 254, 0.42)';
          for (let m = 0; m < 5; m++) {
            const frac = ((timeSec * 0.12 + m * 0.21 + sp.phase) % 1);
            const mx = Math.sin(timeSec * 1.4 + m * 2.1) * sz * (0.28 + frac * 0.52);
            const my = frac * len * 0.92;
            ctx.beginPath();
            ctx.arc(mx, my, Math.max(1.1, 0.038 * scale), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        } else if (sp.kind === 'halocline-lens') {
          // Soft edge-faded freshwater-over-saltwater halocline density shimmer (no hard oval boundary — v167)
          const hw = (sp.halfWidth || 3.2) * scale;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          // 3 gentle liquid-glass refraction wave filaments sharing a single linear gradient (v171)
          const ribbonGrad = ctx.createLinearGradient?.(sx - hw, sy, sx + hw, sy);
          if (ribbonGrad && typeof ribbonGrad.addColorStop === 'function') {
            ribbonGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
            ribbonGrad.addColorStop(0.22, 'rgba(103, 232, 249, 0.65)');
            ribbonGrad.addColorStop(0.5, 'rgba(224, 242, 254, 1)');
            ribbonGrad.addColorStop(0.78, 'rgba(103, 232, 249, 0.65)');
            ribbonGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
            ctx.strokeStyle = ribbonGrad;
          } else {
            ctx.strokeStyle = 'rgba(125, 211, 252, 1)';
          }
          for (let wIdx = 0; wIdx < 3; wIdx++) {
            const yOff = (wIdx - 1) * 0.11 * scale;
            ctx.globalAlpha = wIdx === 1 ? 0.36 : 0.20;
            ctx.lineWidth = Math.max(1.1, (wIdx === 1 ? 0.06 : 0.038) * scale);
            ctx.beginPath();
            const steps = 16;
            for (let k = 0; k <= steps; k++) {
              const u = (k / steps) * 2 - 1;
              const wx = sx + u * hw;
              const env = Math.max(0, 1 - u * u);
              const wy = sy + yOff + Math.sin(timeSec * (1.8 + wIdx * 0.55) + u * 5.4 + sp.phase + wIdx) * 0.11 * scale * env;
              if (k === 0) ctx.moveTo(wx, wy);
              else ctx.lineTo(wx, wy);
            }
            ctx.stroke();
          }
          ctx.restore();
        } else if (sp.kind === 'ice-arch' && Number.isFinite(sp.ceilY) && Number.isFinite(sp.floorY)) {
          // Subtle subglacial sapphire crystal refraction pulse along the ice arch
          const cy0 = toScreenY(sp.ceilY);
          const shimmer = 0.25 + 0.25 * Math.sin(timeSec * 1.9 + sp.phase);
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.strokeStyle = `rgba(125, 211, 252, ${shimmer.toFixed(3)})`;
          ctx.lineWidth = Math.max(1.5, 0.07 * scale);
          ctx.beginPath();
          ctx.moveTo(sx - sz * 0.55, cy0);
          ctx.quadraticCurveTo(sx, cy0 + sz * 0.9, sx + sz * 0.55, cy0);
          ctx.stroke();
          ctx.restore();
        } else if (sp.kind === 'air-dome') {
          // Trapped Overhead Air Pocket: razor-flat horizontal water-air total-internal-reflection meniscus
          // strictly clipped to [leftX, rightX] so it never floats into open water or bleeds onto rock (v167).
          const lx = Number.isFinite(sp.leftX) ? toScreenX(sp.leftX) : sx - (sp.halfWidth || 1.8) * scale;
          const rx = Number.isFinite(sp.rightX) ? toScreenX(sp.rightX) : sx + (sp.halfWidth || 1.8) * scale;
          const spanPx = Math.max(8, rx - lx);
          const midX = (lx + rx) * 0.5;
          const isCalming = Boolean(stories.inAirDome && stories.activeAirDome === sp);
          ctx.save();
          // Subtle thin underside mirror sheen fading smoothly to 0 at left & right rock walls
          ctx.globalCompositeOperation = 'screen';
          const hg = ctx.createLinearGradient?.(lx, sy, rx, sy);
          if (hg && typeof hg.addColorStop === 'function') {
            hg.addColorStop(0, 'rgba(186, 230, 253, 0)');
            hg.addColorStop(0.14, isCalming ? 'rgba(125, 211, 252, 0.34)' : 'rgba(186, 230, 253, 0.22)');
            hg.addColorStop(0.5, isCalming ? 'rgba(224, 242, 254, 0.48)' : 'rgba(224, 242, 254, 0.30)');
            hg.addColorStop(0.86, isCalming ? 'rgba(125, 211, 252, 0.34)' : 'rgba(186, 230, 253, 0.22)');
            hg.addColorStop(1, 'rgba(186, 230, 253, 0)');
            ctx.fillStyle = hg;
          } else {
            ctx.fillStyle = 'rgba(186, 230, 253, 0.22)';
          }
          ctx.beginPath();
          ctx.rect(lx, sy - 0.04 * scale, spanPx, 0.16 * scale);
          ctx.fill();

          // Crisp horizontal liquid-mercury surface tension meniscus line with delicate ripples
          const lineGrad = ctx.createLinearGradient?.(lx, sy, rx, sy);
          if (lineGrad && typeof lineGrad.addColorStop === 'function') {
            lineGrad.addColorStop(0, 'rgba(224, 242, 254, 0.05)');
            lineGrad.addColorStop(0.12, 'rgba(224, 242, 254, 0.82)');
            lineGrad.addColorStop(0.5, isCalming ? 'rgba(125, 211, 252, 0.98)' : 'rgba(248, 250, 252, 0.90)');
            lineGrad.addColorStop(0.88, 'rgba(224, 242, 254, 0.82)');
            lineGrad.addColorStop(1, 'rgba(224, 242, 254, 0.05)');
            ctx.strokeStyle = lineGrad;
          } else {
            ctx.strokeStyle = 'rgba(240, 249, 255, 0.86)';
          }
          ctx.lineWidth = Math.max(1.4, (isCalming ? 0.068 : 0.052) * scale);
          ctx.beginPath();
          const steps = 16;
          for (let k = 0; k <= steps; k++) {
            const frac = k / steps;
            const wx = lx + spanPx * frac;
            const env = Math.sin(frac * Math.PI);
            const wy = sy + Math.sin(timeSec * 3.0 + frac * 11.0 + sp.phase) * 0.038 * scale * env;
            if (k === 0) ctx.moveTo(wx, wy);
            else ctx.lineTo(wx, wy);
          }
          ctx.stroke();

          // Delicate rising micro-bubbles flattening against the horizontal water-air boundary
          ctx.fillStyle = 'rgba(224, 242, 254, 0.72)';
          for (let b = 0; b < 4; b++) {
            const bPhase = ((timeSec * 0.55 + b * 0.27 + sp.phase) % 1);
            const bx = lx + spanPx * (0.18 + 0.64 * ((b * 0.31 + 0.12) % 1)) + Math.sin(timeSec * 2.2 + b * 2.1) * 0.06 * scale;
            const by = sy + (1 - bPhase) * 0.42 * scale;
            const br = Math.max(1.1, (0.032 + bPhase * 0.025) * scale);
            ctx.globalAlpha = Math.min(0.85, (1 - Math.abs(bPhase - 0.75)) * 0.9);
            ctx.beginPath();
            ctx.ellipse(bx, by, br * (1 + bPhase * 0.65), br * (1 - bPhase * 0.42), 0, 0, Math.PI * 2);
            ctx.fill();
          }

          // Clear, subtle diegetic callout so players immediately know what the Air Pocket is & when it's calming HR
          if (isCalming || sp.discovered) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = isCalming ? 0.96 : 0.68;
            const label = isCalming ? 'AIR POCKET · CALMING HR' : 'AIR POCKET';
            const fontPx = Math.max(9, Math.min(12, Math.round(scale * 0.25)));
            ctx.font = `700 ${fontPx}px ui-monospace, SFMono-Regular, Menlo, monospace`;
            const tw = ctx.measureText ? ctx.measureText(label).width : label.length * 6;
            const padX = 7;
            const pillH = fontPx + 6;
            const topYSc = Number.isFinite(sp.topY) ? toScreenY(sp.topY) : sy - 0.55 * scale;
            const pillY = Math.min(sy - pillH - 4, (topYSc + sy) * 0.5 - pillH * 0.5);
            ctx.fillStyle = isCalming ? 'rgba(8, 47, 73, 0.84)' : 'rgba(6, 17, 31, 0.66)';
            ctx.strokeStyle = isCalming ? 'rgba(125, 211, 252, 0.82)' : 'rgba(148, 163, 184, 0.38)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(midX - tw * 0.5 - padX, pillY, tw + padX * 2, pillH, 999);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = isCalming ? '#e0f2fe' : '#bae6fd';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, midX, pillY + pillH * 0.5 + 0.5);
          }
          ctx.restore();
        } else if (sp.kind === 'survey-station') {
          // Retro-reflective tape glint on vintage explorer cave survey marker
          const glint = 0.35 + 0.65 * Math.max(0, Math.sin(timeSec * 2.8 + sp.phase));
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(254, 240, 138, ${(0.55 * glint).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(sx, sy - sz * 0.42, Math.max(1.8, 0.075 * scale), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        continue;
      }

      // === PRE-LIGHTING WORLD GEOMETRY PASS ===
      if (sp.kind === 'air-dome') {
        // Dark dry-air pocket cavity carved snugly beneath the real SDF ceiling contour down to flat waterY (v167)
        const lx = Number.isFinite(sp.leftX) ? toScreenX(sp.leftX) : sx - (sp.halfWidth || 1.8) * scale;
        const rx = Number.isFinite(sp.rightX) ? toScreenX(sp.rightX) : sx + (sp.halfWidth || 1.8) * scale;
        const topYSc = Number.isFinite(sp.topY) ? toScreenY(sp.topY) : sy - 0.55 * scale;
        const prof = Array.isArray(sp.ceilingProfile) && sp.ceilingProfile.length >= 2 ? sp.ceilingProfile : null;
        ctx.save();
        const airGrad = ctx.createLinearGradient?.(sx, topYSc, sx, sy);
        if (airGrad && typeof airGrad.addColorStop === 'function') {
          airGrad.addColorStop(0, 'rgba(2, 6, 14, 0.92)');
          airGrad.addColorStop(0.65, 'rgba(10, 24, 42, 0.78)');
          airGrad.addColorStop(1, 'rgba(30, 64, 96, 0.42)');
          ctx.fillStyle = airGrad;
        } else {
          ctx.fillStyle = 'rgba(4, 12, 24, 0.85)';
        }
        ctx.beginPath();
        ctx.moveTo(lx, sy);
        if (prof) {
          for (let k = 0; k < prof.length; k++) {
            ctx.lineTo(toScreenX(prof[k].x), toScreenY(prof[k].ceilY));
          }
        } else {
          ctx.quadraticCurveTo(sx, topYSc, rx, sy);
        }
        ctx.lineTo(rx, sy);
        ctx.closePath();
        ctx.fill();

        // For flat deck-beam bays / flat karst roofs, draw authentic structural coaming lips trapping the air
        if (sp.bayCoaming) {
          const lipW = Math.max(4, 0.16 * scale);
          const lipTop = topYSc - 0.08 * scale;
          const lipBot = sy + 0.12 * scale;
          if (sp.isWreckBay) {
            // Riveted corroded steel transverse hull I-beam coamings
            ctx.fillStyle = '#3b2820';
            ctx.strokeStyle = '#6b422d';
            ctx.lineWidth = Math.max(1, 0.03 * scale);
            ctx.fillRect(lx - lipW * 0.6, lipTop, lipW, lipBot - lipTop);
            ctx.strokeRect(lx - lipW * 0.6, lipTop, lipW, lipBot - lipTop);
            ctx.fillRect(rx - lipW * 0.4, lipTop, lipW, lipBot - lipTop);
            ctx.strokeRect(rx - lipW * 0.4, lipTop, lipW, lipBot - lipTop);
            // I-beam lower flange lip
            ctx.fillStyle = '#523426';
            ctx.fillRect(lx - lipW * 0.9, lipBot - lipW * 0.35, lipW * 1.6, lipW * 0.38);
            ctx.fillRect(rx - lipW * 0.7, lipBot - lipW * 0.35, lipW * 1.6, lipW * 0.38);
          } else {
            // Natural downward-protruding dark limestone rock lips sealing left & right ends
            ctx.fillStyle = '#1f2937';
            ctx.beginPath();
            ctx.moveTo(lx - lipW * 1.2, lipTop);
            ctx.lineTo(lx + lipW * 0.7, lipTop);
            ctx.quadraticCurveTo(lx + lipW * 0.1, lipBot, lx - lipW * 0.5, lipBot + 0.06 * scale);
            ctx.lineTo(lx - lipW * 1.4, lipTop);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(rx + lipW * 1.2, lipTop);
            ctx.lineTo(rx - lipW * 0.7, lipTop);
            ctx.quadraticCurveTo(rx - lipW * 0.1, lipBot, rx + lipW * 0.5, lipBot + 0.06 * scale);
            ctx.lineTo(rx + lipW * 1.4, lipTop);
            ctx.closePath();
            ctx.fill();
          }
        }
        ctx.restore();
      } else if (sp.kind === 'speleothem-cathedral' && Number.isFinite(sp.ceilY) && Number.isFinite(sp.floorY)) {
        // Monumental Ice-Age fluted calcite stalactite & stalagmite cathedral pillars
        const cy0 = toScreenY(sp.ceilY);
        const fy0 = toScreenY(sp.floorY);
        const span = Math.max(scale * 1.5, fy0 - cy0);
        const topLen = Math.min(span * 0.42, sz * 1.95);
        const botLen = Math.min(span * 0.44, sz * 2.1);

        // Delicate translucent calcite soda-straws flanking cathedral column (v168)
        ctx.strokeStyle = 'rgba(226, 211, 186, 0.42)';
        ctx.lineWidth = Math.max(1, 0.028 * scale);
        for (const strawOff of [-0.62, -0.48, 0.50, 0.66]) {
          const stX = sx + strawOff * sz;
          const stL = topLen * (0.32 + Math.abs(strawOff) * 0.28);
          ctx.beginPath();
          ctx.moveTo(stX, cy0);
          ctx.lineTo(stX, cy0 + stL);
          ctx.stroke();
        }
        // Twin ceiling stalactite icicles
        for (let k = -1; k <= 1; k++) {
          const ox = sx + k * sz * 0.34;
          const len = topLen * (k === 0 ? 1.0 : 0.68);
          const halfW = sz * (k === 0 ? 0.22 : 0.14);
          ctx.fillStyle = k === 0 ? '#786852' : '#615342';
          ctx.beginPath();
          ctx.moveTo(ox - halfW, cy0);
          ctx.lineTo(ox + halfW, cy0);
          ctx.lineTo(ox + halfW * 0.18, cy0 + len);
          ctx.lineTo(ox - halfW * 0.18, cy0 + len);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(214, 198, 170, 0.45)';
          ctx.lineWidth = Math.max(1, 0.03 * scale);
          ctx.beginPath();
          ctx.moveTo(ox - halfW * 0.2, cy0 + 2);
          ctx.lineTo(ox - halfW * 0.06, cy0 + len * 0.88);
          ctx.stroke();
        }
        // Twin floor stalagmite domes reaching upward
        for (let k = -1; k <= 1; k++) {
          const ox = sx + k * sz * 0.36;
          const len = botLen * (k === 0 ? 1.0 : 0.62);
          const halfW = sz * (k === 0 ? 0.28 : 0.18);
          ctx.fillStyle = k === 0 ? '#85735a' : '#6b5c48';
          ctx.beginPath();
          ctx.moveTo(ox - halfW, fy0);
          ctx.quadraticCurveTo(ox - halfW * 0.55, fy0 - len * 0.65, ox, fy0 - len);
          ctx.quadraticCurveTo(ox + halfW * 0.55, fy0 - len * 0.65, ox + halfW, fy0);
          ctx.closePath();
          ctx.fill();
          // Mineral drip rings
          ctx.strokeStyle = 'rgba(226, 211, 186, 0.32)';
          ctx.lineWidth = Math.max(1, 0.032 * scale);
          ctx.beginPath();
          ctx.moveTo(ox - halfW * 0.45, fy0 - len * 0.35);
          ctx.lineTo(ox + halfW * 0.45, fy0 - len * 0.35);
          ctx.stroke();
        }
      } else if (sp.kind === 'mine-timber' && Number.isFinite(sp.ceilY) && Number.isFinite(sp.floorY)) {
        // Historic flooded wooden mine drift shoring timbers & rusted iron joiner plates
        const cy0 = toScreenY(sp.ceilY);
        const fy0 = toScreenY(sp.floorY);
        const halfW = sz * 0.72;
        const beamW = Math.max(3, 0.18 * scale);
        ctx.fillStyle = '#452b17';
        ctx.strokeStyle = '#29180b';
        ctx.lineWidth = Math.max(1, 0.04 * scale);
        // Left & right vertical shoring posts
        ctx.fillRect(sx - halfW, cy0, beamW, fy0 - cy0);
        ctx.strokeRect(sx - halfW, cy0, beamW, fy0 - cy0);
        ctx.fillRect(sx + halfW - beamW, cy0, beamW, fy0 - cy0);
        ctx.strokeRect(sx + halfW - beamW, cy0, beamW, fy0 - cy0);
        // Overhead cross-lintel timber
        ctx.fillStyle = '#5c3a1e';
        ctx.fillRect(sx - halfW - beamW * 0.3, cy0, halfW * 2 + beamW * 0.6, beamW * 1.15);
        ctx.strokeRect(sx - halfW - beamW * 0.3, cy0, halfW * 2 + beamW * 0.6, beamW * 1.15);
        // Rusted iron corner gusset plates with bolts
        ctx.fillStyle = '#7c2d12';
        ctx.fillRect(sx - halfW, cy0 + beamW * 0.85, beamW * 1.25, beamW * 1.25);
        ctx.fillRect(sx + halfW - beamW * 1.25, cy0 + beamW * 0.85, beamW * 1.25, beamW * 1.25);
      } else if (sp.kind === 'ice-arch' && Number.isFinite(sp.ceilY) && Number.isFinite(sp.floorY)) {
        // Sculpted translucent subglacial blue-ice ribs
        const cy0 = toScreenY(sp.ceilY);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.32)';
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.65)';
        ctx.lineWidth = Math.max(1.2, 0.045 * scale);
        ctx.beginPath();
        ctx.moveTo(sx - sz * 0.7, cy0);
        ctx.quadraticCurveTo(sx, cy0 + sz * 1.15, sx + sz * 0.7, cy0);
        ctx.lineTo(sx + sz * 0.42, cy0);
        ctx.quadraticCurveTo(sx, cy0 + sz * 0.65, sx - sz * 0.42, cy0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (sp.kind === 'emergency-lamp') {
        // Cast-iron caged bulkhead sconce
        ctx.fillStyle = '#334155';
        ctx.fillRect(sx - sz * 0.24, sy - sz * 0.08, sz * 0.48, sz * 0.14);
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.arc(sx, sy + sz * 0.2, sz * 0.18, 0, Math.PI * 2);
        ctx.fill();
        // Brass protective cage bars
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = Math.max(1, 0.04 * scale);
        ctx.beginPath();
        ctx.arc(sx, sy + sz * 0.2, sz * 0.22, 0, Math.PI);
        ctx.moveTo(sx, sy + sz * 0.04);
        ctx.lineTo(sx, sy + sz * 0.42);
        ctx.stroke();
      } else if (sp.kind === 'porthole-shaft') {
        // Heavy bolted bronze ship porthole frame
        ctx.fillStyle = '#0c4a6e';
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = Math.max(2.2, 0.1 * scale);
        ctx.beginPath();
        ctx.arc(sx, sy, sz * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // 6 brass perimeter clamping dogs
        ctx.fillStyle = '#f59e0b';
        for (let b = 0; b < 6; b++) {
          const a = (b / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(sx + Math.cos(a) * sz * 0.44, sy + Math.sin(a) * sz * 0.44, Math.max(1.4, 0.045 * scale), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (sp.kind === 'cargo-vehicle') {
        // Iconic submerged WWII Bedford QL Cargo Truck / Lorry resting inside flooded ship hold (v168)
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(sp.tilt || 0);
        const w = sz * 1.65;
        const h = sz * 0.92;
        // Rusted steel chassis rail
        ctx.fillStyle = '#3b2419';
        ctx.strokeStyle = '#6b3e28';
        ctx.lineWidth = Math.max(1.1, 0.04 * scale);
        ctx.fillRect(-w * 0.55, -h * 0.32, w * 1.12, h * 0.14);
        // Rear cargo flatbed & corroded arched canvas canopy hoops
        ctx.fillStyle = '#4a2e1f';
        ctx.fillRect(-w * 0.54, -h * 0.58, w * 0.68, h * 0.28);
        ctx.strokeRect(-w * 0.54, -h * 0.58, w * 0.68, h * 0.28);
        ctx.strokeStyle = '#7c4a30';
        ctx.lineWidth = Math.max(1.2, 0.042 * scale);
        for (let hoop = 0; hoop < 4; hoop++) {
          const hx = -w * 0.50 + hoop * (w * 0.20);
          ctx.beginPath();
          ctx.moveTo(hx, -h * 0.58);
          ctx.quadraticCurveTo(hx + w * 0.02, -h * 1.02, hx + w * 0.08, -h * 0.98);
          ctx.stroke();
        }
        // Forward armored cab & shattered windshield bay
        ctx.fillStyle = '#442b1d';
        ctx.beginPath();
        ctx.moveTo(w * 0.16, -h * 0.30);
        ctx.lineTo(w * 0.16, -h * 0.86);
        ctx.lineTo(w * 0.44, -h * 0.86);
        ctx.lineTo(w * 0.56, -h * 0.56);
        ctx.lineTo(w * 0.58, -h * 0.30);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#0c1d30';
        ctx.fillRect(w * 0.24, -h * 0.78, w * 0.18, h * 0.20);
        // Twin heavy spoked military rubber tires resting on deck
        for (const tx of [-w * 0.34, w * 0.36]) {
          ctx.fillStyle = '#18181b';
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = Math.max(1.2, 0.04 * scale);
          ctx.beginPath();
          ctx.arc(tx, -h * 0.18, h * 0.21, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.arc(tx, -h * 0.18, h * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
        // Soft coral & rusticle encrustation tufts on roof
        ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
        ctx.beginPath();
        ctx.arc(-w * 0.30, -h * 0.62, h * 0.09, 0, Math.PI * 2);
        ctx.arc(w * 0.30, -h * 0.88, h * 0.07, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (sp.kind === 'carrier-aircraft') {
        // Submerged Naval Swept-Wing Carrier Airframe on Oriskany Hangar / Flight Deck (v168)
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(sp.tilt || 0);
        const L = sz * 1.9;
        const H = sz * 0.85;
        // Swept tail stabilizer fin
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = Math.max(1.1, 0.036 * scale);
        ctx.beginPath();
        ctx.moveTo(-L * 0.56, -H * 0.36);
        ctx.lineTo(-L * 0.72, -H * 0.96);
        ctx.lineTo(-L * 0.46, -H * 0.92);
        ctx.lineTo(-L * 0.32, -H * 0.38);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Riveted aluminum naval fuselage & pointed nosecone
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(-L * 0.58, -H * 0.24);
        ctx.lineTo(L * 0.28, -H * 0.42);
        ctx.quadraticCurveTo(L * 0.68, -H * 0.34, L * 0.64, -H * 0.20);
        ctx.lineTo(-L * 0.56, -H * 0.14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Flooded plexiglass cockpit canopy bubble
        ctx.fillStyle = 'rgba(56, 189, 248, 0.32)';
        ctx.strokeStyle = '#94a3b8';
        ctx.beginPath();
        ctx.ellipse(L * 0.16, -H * 0.44, L * 0.18, H * 0.12, -0.08, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Swept low delta wing & landing gear struts
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(-L * 0.18, -H * 0.24);
        ctx.lineTo(L * 0.18, -H * 0.22);
        ctx.lineTo(-L * 0.08, -H * 0.06);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#64748b';
        ctx.beginPath();
        ctx.moveTo(-L * 0.06, -H * 0.18);
        ctx.lineTo(-L * 0.06, 0);
        ctx.moveTo(L * 0.34, -H * 0.22);
        ctx.lineTo(L * 0.34, 0);
        ctx.stroke();
        ctx.restore();
      } else if (sp.kind === 'grand-staircase') {
        // Ornate Ocean-Liner First-Class Grand Staircase & Gilded Bronze Balustrade (v168)
        ctx.save();
        ctx.translate(sx, sy);
        const w = sz * 1.45;
        const h = sz * 1.15;
        // Sweeping stepped oak/marble stair stringer
        ctx.fillStyle = '#3f2a1d';
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = Math.max(1.1, 0.036 * scale);
        ctx.beginPath();
        ctx.moveTo(-w * 0.55, 0);
        const steps = 6;
        for (let st = 0; st < steps; st++) {
          const x0 = -w * 0.55 + (st / steps) * w * 0.95;
          const y0 = -(st / steps) * h * 0.85;
          const x1 = -w * 0.55 + ((st + 1) / steps) * w * 0.95;
          const y1 = -((st + 1) / steps) * h * 0.85;
          ctx.lineTo(x0, y1);
          ctx.lineTo(x1, y1);
        }
        ctx.lineTo(w * 0.45, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Gilded bronze sweeping handrail & vertical wrought-iron balusters
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = Math.max(1.8, 0.06 * scale);
        ctx.beginPath();
        ctx.moveTo(-w * 0.52, -h * 0.24);
        ctx.quadraticCurveTo(-w * 0.05, -h * 0.62, w * 0.42, -h * 1.06);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(217, 119, 6, 0.65)';
        ctx.lineWidth = Math.max(1.0, 0.03 * scale);
        for (let b = 0; b <= 5; b++) {
          const frac = b / 5;
          const bx = -w * 0.48 + frac * w * 0.86;
          const byBot = -frac * h * 0.78;
          const byTop = byBot - h * 0.24;
          ctx.beginPath();
          ctx.moveTo(bx, byBot);
          ctx.lineTo(bx, byTop);
          ctx.stroke();
        }
        // Ornate gilded brass newel post orb at foot of stairs
        ctx.fillStyle = '#b45309';
        ctx.fillRect(-w * 0.58, -h * 0.30, w * 0.11, h * 0.30);
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(-w * 0.525, -h * 0.34, Math.max(2.2, sz * 0.08), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (sp.kind === 'gorgonian-fan') {
        // Swaying Deep-Water Crimson/Magenta Gorgonian Sea Fan Colony (v168)
        ctx.save();
        ctx.translate(sx, sy);
        const sway = Math.sin(timeSec * 1.45 + (sp.phase || 0)) * 0.12;
        ctx.rotate(sway);
        ctx.strokeStyle = '#e11d48';
        ctx.lineWidth = Math.max(1.5, 0.06 * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -sz * 0.78);
        ctx.moveTo(0, -sz * 0.22);
        ctx.quadraticCurveTo(-sz * 0.28, -sz * 0.42, -sz * 0.46, -sz * 0.74);
        ctx.moveTo(0, -sz * 0.26);
        ctx.quadraticCurveTo(sz * 0.28, -sz * 0.44, sz * 0.48, -sz * 0.76);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(251, 113, 133, 0.72)';
        ctx.lineWidth = Math.max(1.0, 0.032 * scale);
        for (const [x0, y0, x1, y1] of [
          [-sz * 0.20, -sz * 0.42, -sz * 0.28, -sz * 0.88],
          [-sz * 0.34, -sz * 0.56, -sz * 0.62, -sz * 0.62],
          [sz * 0.20, -sz * 0.44, sz * 0.28, -sz * 0.90],
          [sz * 0.34, -sz * 0.58, sz * 0.60, -sz * 0.64],
          [0, -sz * 0.54, -sz * 0.14, -sz * 0.94],
          [0, -sz * 0.58, sz * 0.16, -sz * 0.92],
        ]) {
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
        ctx.restore();
      } else if (sp.kind === 'brass-telegraph') {
        // Tilted Chadburn Engine-Room Brass Telegraph pedestal
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(sp.tilt || 0);
        // Cast-bronze flared base & column
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.moveTo(-sz * 0.24, 0);
        ctx.lineTo(sz * 0.24, 0);
        ctx.lineTo(sz * 0.1, -sz * 0.78);
        ctx.lineTo(-sz * 0.1, -sz * 0.78);
        ctx.closePath();
        ctx.fill();
        // Brass circular engraved dial head
        ctx.fillStyle = '#d97706';
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = Math.max(1.2, 0.045 * scale);
        ctx.beginPath();
        ctx.arc(0, -sz * 0.92, sz * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Cream enamel inner dial & order pointer
        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.arc(0, -sz * 0.92, sz * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = Math.max(1.2, 0.04 * scale);
        ctx.beginPath();
        ctx.moveTo(0, -sz * 0.92);
        ctx.lineTo(sz * 0.15, -sz * 0.98);
        ctx.stroke();
        // Brass telegraph control lever sticking out top
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = Math.max(1.8, 0.06 * scale);
        ctx.beginPath();
        ctx.moveTo(0, -sz * 0.92);
        ctx.lineTo(sz * 0.34, -sz * 1.18);
        ctx.stroke();
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.arc(sz * 0.34, -sz * 1.18, Math.max(2, sz * 0.07), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (sp.kind === 'ship-wheel') {
        // Corroded 8-spoke teak & brass ship's helm wheel
        ctx.save();
        ctx.translate(sx, sy - sz * 0.56);
        ctx.rotate((sp.tilt || 0) * 1.5);
        const r = sz * 0.44;
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = Math.max(2.2, 0.08 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = Math.max(1.3, 0.048 * scale);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * r * 1.28, Math.sin(a) * r * 1.28);
          ctx.stroke();
        }
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (sp.kind === 'boiler-panel') {
        // Riveted iron boiler gauge board + twin cracked dials + copper pipes
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate((sp.tilt || 0) * 0.5);
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = Math.max(1.2, 0.045 * scale);
        ctx.fillRect(-sz * 0.48, -sz * 0.72, sz * 0.96, sz * 0.68);
        ctx.strokeRect(-sz * 0.48, -sz * 0.72, sz * 0.96, sz * 0.68);
        // Copper steam lines
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = Math.max(1.8, 0.06 * scale);
        ctx.beginPath();
        ctx.moveTo(-sz * 0.22, -sz * 0.04);
        ctx.lineTo(-sz * 0.22, -sz * 0.88);
        ctx.moveTo(sz * 0.22, -sz * 0.04);
        ctx.lineTo(sz * 0.22, -sz * 0.88);
        ctx.stroke();
        // Twin Bourdon dials
        for (const ox of [-sz * 0.22, sz * 0.22]) {
          ctx.fillStyle = '#e2e8f0';
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = Math.max(1.2, 0.045 * scale);
          ctx.beginPath();
          ctx.arc(ox, -sz * 0.42, sz * 0.16, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = Math.max(1, 0.03 * scale);
          ctx.beginPath();
          ctx.moveTo(ox, -sz * 0.42);
          ctx.lineTo(ox - sz * 0.09, -sz * 0.34);
          ctx.stroke();
        }
        ctx.restore();
      } else if (sp.kind === 'mayan-vessel') {
        // Sculpted submerged Mayan ceramic offering vessel resting on cenote silt
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(sp.tilt || 0);
        ctx.fillStyle = '#9a3412';
        ctx.strokeStyle = '#431407';
        ctx.lineWidth = Math.max(1.1, 0.04 * scale);
        ctx.beginPath();
        ctx.ellipse(0, -sz * 0.28, sz * 0.32, sz * 0.26, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Flared ceramic neck & rim
        ctx.fillStyle = '#c2410c';
        ctx.beginPath();
        ctx.roundRect(-sz * 0.17, -sz * 0.62, sz * 0.34, sz * 0.16, sz * 0.05);
        ctx.fill();
        ctx.stroke();
        // Ochre geometric rim band
        ctx.strokeStyle = '#fdba74';
        ctx.lineWidth = Math.max(1.1, 0.04 * scale);
        ctx.beginPath();
        ctx.moveTo(-sz * 0.26, -sz * 0.3);
        ctx.lineTo(sz * 0.26, -sz * 0.3);
        ctx.stroke();
        ctx.restore();
      } else if (sp.kind === 'fossil-bed') {
        // Embedded logarithmic spiral ammonite fossil in limestone slab
        ctx.save();
        ctx.translate(sx, sy - sz * 0.24);
        ctx.fillStyle = '#57534e';
        ctx.beginPath();
        ctx.ellipse(0, sz * 0.08, sz * 0.44, sz * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d6d3d1';
        ctx.lineWidth = Math.max(1.4, 0.05 * scale);
        ctx.beginPath();
        for (let t = 0; t <= 18; t++) {
          const ang = t * 0.58;
          const rad = (t / 18) * sz * 0.26;
          const fx = Math.cos(ang) * rad;
          const fy = Math.sin(ang) * rad;
          if (t === 0) ctx.moveTo(fx, fy);
          else ctx.lineTo(fx, fy);
        }
        ctx.stroke();
        ctx.restore();
      } else if (sp.kind === 'survey-station') {
        // Hammered stainless cave survey piton & weathered brass station plate
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = Math.max(1.6, 0.055 * scale);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy - sz * 0.45);
        ctx.stroke();
        ctx.fillStyle = '#eab308';
        ctx.strokeStyle = '#713f12';
        ctx.lineWidth = Math.max(1, 0.035 * scale);
        ctx.beginPath();
        ctx.moveTo(sx - sz * 0.22, sy - sz * 0.42);
        ctx.lineTo(sx + sz * 0.14, sy - sz * 0.54);
        ctx.lineTo(sx + sz * 0.24, sy - sz * 0.42);
        ctx.lineTo(sx + sz * 0.14, sy - sz * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();

}
