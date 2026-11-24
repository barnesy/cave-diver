import { castTorchFan, computeSpectralAbsorption } from '../lighting.js';
import { computeStormLightningFlash } from '../weather.js';
import { getTorchOptic } from '../rigLivery.js';
import { sampleSiltDensity } from '../silt.js';

const _nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

export const lightingAndFxMethods = {
  _drawVolumetricTorchBeam(ctx, diver, torchData, rangeM, { siltHaze = 0, isPeer = false, intensityMult = 1.0, toScreenX, toScreenY, scale, timeSec = 0 } = {}) {
    if (!torchData) return;
    ctx.save();
    const tx = toScreenX(torchData.ox);
    const ty = toScreenY(torchData.oy);
    const rPx = rangeM * scale;

    ctx.beginPath();
    ctx.moveTo(tx, ty);
    for (let i = 0; i < torchData.rays.length; i++) {
      const pt = torchData.rays[i];
      ctx.lineTo(toScreenX(pt.x), toScreenY(pt.y));
    }
    ctx.closePath();
    ctx.clip();

    ctx.globalCompositeOperation = 'screen';
    const optic = getTorchOptic(diver?.livery?.torchId);
    const intensity = (isPeer ? 0.58 : 1.0) * intensityMult;
    const effectiveHaze = siltHaze * (1 - (optic.siltPierce || 0));
    const warmBoost = Math.min(0.18, effectiveHaze * 0.14);
    const beamAng = Number.isFinite(diver.torchAngle) ? diver.torchAngle : (diver.angle || 0);
    const scatterStamp = this.glowStamps?.torchBeamScatter;
    if (scatterStamp && optic.id === 'tech-led') {
      ctx.globalAlpha = Math.min(1, intensity * 0.85 + warmBoost * 1.4);
      ctx.drawImage(scatterStamp, tx - rPx, ty - rPx, rPx * 2, rPx * 2);
      ctx.globalAlpha = 1;
    } else {
      const scatter = ctx.createRadialGradient(tx, ty, 0.15 * scale, tx, ty, rPx);
      scatter.addColorStop(0, `rgba(${optic.coreRgb}, ${(0.28 * intensity + warmBoost).toFixed(3)})`);
      scatter.addColorStop(0.32, `rgba(${optic.shaftRgb}, ${(0.16 * intensity + warmBoost * 0.45).toFixed(3)})`);
      scatter.addColorStop(0.72, `rgba(${optic.shaftRgb}, ${(0.06 * intensity).toFixed(3)})`);
      scatter.addColorStop(1, `rgba(${optic.shaftRgb}, 0)`);
      ctx.fillStyle = scatter;
      ctx.fillRect(tx - rPx, ty - rPx, rPx * 2, rPx * 2);
    }

    // Tight hotspot beam core (follows torchAngle override for both local & co-divers)
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.arc(tx, ty, rPx * 0.9, beamAng - 0.13, beamAng + 0.13);
    ctx.closePath();
    ctx.fillStyle = `rgba(${optic.coreRgb}, ${(0.12 * intensity).toFixed(3)})`;
    ctx.fill();

    // Smooth feathered 2D Ray-Cast Tyndall / Particulate Light Shafts (coarser stride for remote peers = 2x faster GPU)
    ctx.globalCompositeOperation = 'lighter';
    const rayLen = torchData.rays.length;
    const shaftStep = isPeer ? 4 : 2;
    for (let i = 0; i < rayLen - shaftStep; i += shaftStep) {
      const rA = torchData.rays[i];
      const rB = torchData.rays[Math.min(rayLen - 1, i + shaftStep)];
      const centerDist = Math.abs((i + shaftStep * 0.5) / Math.max(1, rayLen - 1) - 0.5) * 2;
      const rayAlpha = (1 - centerDist * 0.75) * (isPeer ? 0.032 : 0.024) * intensity;
      ctx.fillStyle = `rgba(${optic.shaftRgb}, ${rayAlpha.toFixed(4)})`;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(toScreenX(rA.x), toScreenY(rA.y));
      ctx.lineTo(toScreenX(rB.x), toScreenY(rB.y));
      ctx.closePath();
      ctx.fill();
    }

    if (!isPeer) {
      // Suspended water particulates & soft bokeh plankton inside ray-cast torch polygon (cone-culled + zero-alloc scratch)
      const maxDistSq = rangeM * rangeM;
      const moteStamp = this.glowStamps.cyan;
      const sparks = this._torchSparksScratch;
      sparks.length = 0;
      const beamAng = Number.isFinite(diver.torchAngle) ? diver.torchAngle : (diver.angle || 0);
      const beamFx = Math.cos(beamAng);
      const beamFy = Math.sin(beamAng);
      const cell = 6;
      const gx0 = Math.floor((torchData.ox - rangeM) / cell);
      const gx1 = Math.ceil((torchData.ox + rangeM) / cell);
      const gy0 = Math.floor((torchData.oy - rangeM) / cell);
      const gy1 = Math.ceil((torchData.oy + rangeM) / cell);
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gy = gy0; gy <= gy1; gy++) {
          for (let k = 0; k < 4; k++) {
            const h1 = Math.sin(gx * 127.1 + gy * 311.7 + k * 74.7) * 43758.5453;
            const r1 = h1 - Math.floor(h1);
            const h2 = Math.sin(gx * 269.5 + gy * 183.3 + k * 41.9) * 43758.5453;
            const r2 = h2 - Math.floor(h2);
            const wx = (gx + r1) * cell;
            const wy = (gy + r2) * cell;
            if (wy < 0.25) continue;
            const dx = wx - torchData.ox;
            const dy = wy - torchData.oy;
            const dSq = dx * dx + dy * dy;
            if (dSq > maxDistSq || dSq < 0.35) continue;
            const invDist = 1 / Math.sqrt(dSq);
            if ((dx * beamFx + dy * beamFy) * invDist < 0.72) continue; // Outside torch cone
            const phase = r1 * 6.283;
            const driftX = wx + Math.sin(timeSec * 0.78 + phase) * 0.19;
            const driftY = wy + Math.cos(timeSec * 0.62 + phase) * 0.14;
            const mx = toScreenX(driftX);
            const my = toScreenY(driftY);
            const size = 0.028 + r2 * 0.036;
            if (k === 0 && moteStamp) {
              const fade = Math.max(0, 1 - (dSq * invDist) / rangeM);
              const bokehR = Math.max(3.5, size * 6.2 * scale);
              ctx.globalAlpha = 0.26 * fade;
              ctx.drawImage(moteStamp, mx - bokehR, my - bokehR, bokehR * 2, bokehR * 2);
            }
            sparks.push(mx, my, Math.max(1, size * scale));
          }
        }
      }
      if (sparks.length > 0) {
        ctx.globalAlpha = 0.44;
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        for (let i = 0; i < sparks.length; i += 3) {
          const mx = sparks[i];
          const my = sparks[i + 1];
          const r = sparks[i + 2];
          ctx.moveTo(mx + r, my);
          ctx.arc(mx, my, r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }
    ctx.restore();

    // Normal-weighted 2D diffuse limestone wall scatter + Snell's-window underside surface reflection
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const warmStamp = this.glowStamps.warm;
    const cyanStamp = this.glowStamps.cyan;
    const wallStep = isPeer ? 2 : 1;
    for (let i = 1; i < torchData.rays.length - 1; i += wallStep) {
      const pt = torchData.rays[i];
      if (pt.dist > rangeM) continue;
      if (pt.hitSurface && cyanStamp) {
        const strength = Math.max(0, (1 - pt.dist / rangeM) * (pt.incidence || 0.6)) * 0.24 * intensity;
        if (strength > 0.01) {
          const sx = toScreenX(pt.x);
          const sy = toScreenY(0.05);
          const rad = (0.95 + pt.dist * 0.08) * scale;
          ctx.globalAlpha = Math.min(0.45, strength);
          ctx.drawImage(cyanStamp, sx - rad * 1.4, sy - rad * 0.35, rad * 2.8, rad * 0.7);
        }
        continue;
      }
      if (!pt.hitWall) continue;
      const wx = toScreenX(pt.x + pt.nx * 0.25);
      const wy = toScreenY(pt.y + pt.ny * 0.25);
      const beamWeight = 1 - Math.abs(i / (torchData.rays.length - 1) - 0.5) * 1.1;
      const strength = Math.max(0, (1 - pt.dist / rangeM) * pt.incidence * beamWeight) * 0.16 * intensity;
      if (strength < 0.008) continue;
      const rad = (1.0 + pt.dist * 0.06) * scale;
      ctx.globalAlpha = Math.min(0.45, strength);
      ctx.drawImage(pt.dist < 6.5 ? warmStamp : cyanStamp, wx - rad, wy - rad, rad * 2, rad * 2);

      if (!isPeer && pt.incidence > 0.42 && i % 3 === 0) {
        const glintR = Math.max(2, (0.28 + pt.incidence * 0.22) * scale);
        ctx.globalAlpha = Math.min(0.32, strength * 1.15);
        ctx.drawImage(warmStamp, toScreenX(pt.x) - glintR, toScreenY(pt.y) - glintR, glintR * 2, glintR * 2);
      }
    }
    ctx.restore();
  },

  _drawLighting(ctx, cw, ch, diver, peersInput, checkpointsHit, siltClouds, sunCurtains, toScreenX, toScreenY, scale, timeSec, bodyRecovered = false, localSiltDensity = 0, powerRelays = null, smb = null, ecosystem = null, secretLair = null) {
    const lctx = this.lightCtx;
    const lw = this.lightCanvas.width;
    const lh = this.lightCanvas.height;
    const rx = lw / cw;
    const ry = lh / ch;

    // Ambient cave darkness increases with depth and horizontal cave penetration
    const depthFactor = Math.min(1, Math.max(0, (diver.y - 3.5) / 16));
    let daylight = 0;
    const basins = this.level.openBasins || [];
    for (let i = 0; i < basins.length; i++) {
      const cx = (basins[i].xMin + basins[i].xMax) * 0.5;
      const near = Math.max(0, 1 - Math.hypot(diver.x - cx, diver.y - 3) / 14);
      if (near > daylight) daylight = near;
    }
    const wObj = this._activeWeather;
    const weatherDarkBoost = wObj?.darknessBoost || 0;
    const lightningFlash = wObj?.lightning ? computeStormLightningFlash(wObj, timeSec) : 0;
    const weatherSunScale = Math.min(1, (wObj ? wObj.sunIntensity : 1.0) + lightningFlash * 0.65);
    const effectiveDaylight = daylight * weatherSunScale;
    const darknessAlpha = Math.max(
      0.16,
      Math.min(0.96, 0.28 + depthFactor * 0.7 + weatherDarkBoost * (1 - depthFactor * 0.65) - effectiveDaylight * 0.55 - lightningFlash * 0.22)
    );

    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, lw, lh);
    // Subtle depth-driven spectral absorption tint (shallow teal-navy -> abyssal indigo)
    const ambR = this.level.theme?.id === 'florida-karst' ? 8 : 2;
    const ambG = Math.round(11 - depthFactor * 6);
    const ambB = Math.round(18 + depthFactor * 4);
    lctx.fillStyle = `rgba(${ambR}, ${ambG}, ${ambB}, ${darknessAlpha.toFixed(3)})`;
    lctx.fillRect(0, 0, lw, lh);

    // Cut out open-sky daylight, physical ray-cast cenote sun shafts, and torch cones
    lctx.globalCompositeOperation = 'destination-out';

    // 1. Open sky & cliff-top daylight at Entrance & Exit top (y <= 0 stays sunlit even when diving deeper)
    const surfMaskY = toScreenY(0.1) * ry;
    if (surfMaskY > -20) {
      const fadeBot = surfMaskY + 1.4 * scale * ry;
      if (fadeBot > 0) {
        const cutTop = Math.max(0, surfMaskY - 4);
        const skyCutKey = `${Math.round(cutTop / 2)}|${Math.round(fadeBot / 2)}`;
        if (!this._skyCutGradCache || this._skyCutGradCache.key !== skyCutKey) {
          const skyCut = lctx.createLinearGradient(0, cutTop, 0, fadeBot);
          skyCut.addColorStop(0, 'rgba(0,0,0,1)');
          skyCut.addColorStop(0.65, 'rgba(0,0,0,0.92)');
          skyCut.addColorStop(1, 'rgba(0,0,0,0)');
          this._skyCutGradCache = { key: skyCutKey, grad: skyCut };
        }
        lctx.fillStyle = this._skyCutGradCache.grad;
        lctx.fillRect(0, 0, lw, Math.min(lh, fadeBot));
      }
    }

    // 2. Ray-cast underwater sun shafts entering Cenote Alpha (entrance) & Cenote Beta (exit)
    if (sunCurtains && sunCurtains.length > 0 && weatherSunScale > 0.08) {
      for (const { rays } of sunCurtains) {
        lctx.save();
        lctx.beginPath();
        lctx.moveTo(toScreenX(rays[0].xTop) * rx, toScreenY(rays[0].yTop) * ry);
        for (let i = 1; i < rays.length; i++) {
          lctx.lineTo(toScreenX(rays[i].xTop) * rx, toScreenY(rays[i].yTop) * ry);
        }
        for (let i = rays.length - 1; i >= 0; i--) {
          lctx.lineTo(toScreenX(rays[i].xBot) * rx, toScreenY(rays[i].yBot) * ry);
        }
        lctx.closePath();
        const topPx = toScreenY(0) * ry;
        const botPx = toScreenY(18.5) * ry;
        const sunCut = lctx.createLinearGradient(0, topPx, 0, botPx);
        sunCut.addColorStop(0, `rgba(0,0,0,${(0.98 * weatherSunScale).toFixed(3)})`);
        sunCut.addColorStop(0.35, `rgba(0,0,0,${(0.85 * weatherSunScale).toFixed(3)})`);
        sunCut.addColorStop(0.75, `rgba(0,0,0,${(0.42 * weatherSunScale).toFixed(3)})`);
        sunCut.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = sunCut;
        lctx.fill();
        lctx.restore();
      }
    }

    const localTorchAng = Number.isFinite(diver.torchAngle) ? diver.torchAngle : diver.angle;
    const localRayCount = Math.max(26, Math.round(52 * (this._perfBudget?.rayScale ?? 1)));
    const nowLightMs = _nowMs();
    const hasActiveSilt = siltClouds && siltClouds.length > 0;
    let localTorch = null;
    if (diver.torchOn !== false) {
      const lox = diver.body?.hand ? diver.body.hand.x : diver.x;
      const loy = diver.body?.hand ? diver.body.hand.y : diver.y;
      const lRange = 16.5 * (getTorchOptic(diver?.livery?.torchId).rangeMult || 1.0);
      const prev = this._localTorchCache;
      const canReuse =
        prev &&
        !hasActiveSilt &&
        prev.levelId === this.level?.id &&
        prev.rayCount === localRayCount &&
        prev.range === lRange &&
        nowLightMs - prev.ts < 75 &&
        Math.abs(lox - prev.ox) < 0.03 &&
        Math.abs(loy - prev.oy) < 0.03 &&
        Math.abs(localTorchAng - prev.ang) < 0.008;
      if (canReuse) {
        localTorch = prev.torch;
      } else {
        if (!this._localTorchRaysPool) this._localTorchRaysPool = [];
        const rays = castTorchFan(
          this.level,
          lox,
          loy,
          localTorchAng,
          0.44,
          lRange,
          localRayCount,
          siltClouds,
          this._localTorchRaysPool
        );
        localTorch = { ox: lox, oy: loy, rays };
        this._localTorchCache = {
          levelId: this.level?.id,
          ox: lox,
          oy: loy,
          ang: localTorchAng,
          rayCount: localRayCount,
          range: lRange,
          ts: nowLightMs,
          torch: localTorch,
        };
      }
    }

    const peerList = Array.isArray(peersInput) ? peersInput : (peersInput ? [peersInput] : []);
    const peerTorches = [];
    const halfViewW = (cw / Math.max(1, scale)) * 0.5;
    const halfViewH = (ch / Math.max(1, scale)) * 0.5;
    const viewMinX = this.camX - halfViewW - 2;
    const viewMaxX = this.camX + halfViewW + 2;
    const viewMinY = this.camY - halfViewH - 2;
    const viewMaxY = this.camY + halfViewH + 2;
    const nowPerf = _nowMs();
    const peerRange = 14.0;
    const peerHalfSpread = 0.4;
    const activePeerKeys = this._activePeerKeysScratch || (this._activePeerKeysScratch = new Set());
    activePeerKeys.clear();

    // First pass: directional beam-cone frustum culling so offscreen beams pointing away cost 0 CPU/GPU
    const visibleTorchPeers = this._visibleTorchPeersScratch || (this._visibleTorchPeersScratch = []);
    visibleTorchPeers.length = 0;
    for (let i = 0; i < peerList.length; i++) {
      const p = peerList[i];
      if (!p || p.alive === false || p.torchOn === false) continue;
      const ox = p.body?.hand ? p.body.hand.x : p.x;
      const oy = p.body?.hand ? p.body.hand.y : p.y;
      const pTorchAng = Number.isFinite(p.torchAngle) ? p.torchAngle : (p.angle || 0);
      const a0 = pTorchAng - peerHalfSpread;
      const a1 = pTorchAng + peerHalfSpread;
      const tipX0 = ox + Math.cos(a0) * peerRange;
      const tipY0 = oy + Math.sin(a0) * peerRange;
      const tipX1 = ox + Math.cos(a1) * peerRange;
      const tipY1 = oy + Math.sin(a1) * peerRange;
      const tipXc = ox + Math.cos(pTorchAng) * peerRange;
      const tipYc = oy + Math.sin(pTorchAng) * peerRange;
      const bMinX = Math.min(ox, tipX0, tipX1, tipXc);
      const bMaxX = Math.max(ox, tipX0, tipX1, tipXc);
      const bMinY = Math.min(oy, tipY0, tipY1, tipYc);
      const bMaxY = Math.max(oy, tipY0, tipY1, tipYc);
      if (bMaxX < viewMinX || bMinX > viewMaxX || bMaxY < viewMinY || bMinY > viewMaxY) continue;
      visibleTorchPeers.push({ peer: p, ox, oy, pTorchAng, key: p.id || `peer_${i}` });
    }

    // Adaptive ray budget + pose-delta raycast cache per peer (cuts co-op CPU by 70-90%!)
    const basePeerRays = (this._isCoarseMobile || visibleTorchPeers.length >= 2 || cw < 900) ? 16 : 22;
    const peerRayCount = Math.min(basePeerRays, this._perfBudget?.peerRayMax ?? basePeerRays);
    const hasSilt = siltClouds && siltClouds.length > 0;
    const cacheMaxAgeMs = hasSilt ? 55 : 135;

    for (let i = 0; i < visibleTorchPeers.length; i++) {
      const vp = visibleTorchPeers[i];
      activePeerKeys.add(vp.key);
      const prev = this._peerTorchCache.get(vp.key);
      let rays = null;
      if (prev && prev.levelId === this.level?.id && prev.rayCount === peerRayCount) {
        let angDelta = vp.pTorchAng - prev.angle;
        while (angDelta > Math.PI) angDelta -= Math.PI * 2;
        while (angDelta < -Math.PI) angDelta += Math.PI * 2;
        const posDeltaSq = (vp.ox - prev.ox) * (vp.ox - prev.ox) + (vp.oy - prev.oy) * (vp.oy - prev.oy);
        if (posDeltaSq < 0.0196 && Math.abs(angDelta) < 0.035 && nowPerf - prev.at < cacheMaxAgeMs) {
          rays = prev.rays;
        }
      }
      if (!rays) {
        rays = castTorchFan(this.level, vp.ox, vp.oy, vp.pTorchAng, peerHalfSpread, peerRange, peerRayCount, siltClouds);
        this._peerTorchCache.set(vp.key, {
          levelId: this.level?.id,
          ox: vp.ox,
          oy: vp.oy,
          angle: vp.pTorchAng,
          rayCount: peerRayCount,
          at: nowPerf,
          rays,
        });
      }
      peerTorches.push({
        peer: vp.peer,
        torch: {
          ox: vp.ox,
          oy: vp.oy,
          rays,
        },
      });
    }
    // Prune disconnected/offscreen peer cache entries to prevent stale growth
    if (this._peerTorchCache.size > activePeerKeys.size + 4) {
      for (const k of this._peerTorchCache.keys()) {
        if (!activePeerKeys.has(k)) this._peerTorchCache.delete(k);
      }
    }

    const cutoutStamp = this.glowStamps.cutout;
    const spillCutoutStamp = this.glowStamps.torchSpillCutout;
    const hotCutoutStamp = this.glowStamps.torchHotCutout;
    const carveDiverLight = (d, torchData, rangeM) => {
      const sx = toScreenX(d.x) * rx;
      const sy = toScreenY(d.y) * ry;

      // Soft personal dive-computer / gauge ambient halo via pre-baked radial cutout
      const haloR = 3.4 * scale * rx;
      if (cutoutStamp) {
        lctx.globalAlpha = 0.9;
        lctx.drawImage(cutoutStamp, sx - haloR, sy - haloR, haloR * 2, haloR * 2);
        lctx.globalAlpha = 1;
      } else {
        const halo = lctx.createRadialGradient(sx, sy, 0.25 * scale * rx, sx, sy, haloR);
        halo.addColorStop(0, 'rgba(0,0,0,0.9)');
        halo.addColorStop(0.5, 'rgba(0,0,0,0.45)');
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = halo;
        lctx.beginPath();
        lctx.arc(sx, sy, haloR, 0, Math.PI * 2);
        lctx.fill();
      }

      if (!torchData) return;

      const tx = toScreenX(torchData.ox) * rx;
      const ty = toScreenY(torchData.oy) * ry;
      const rPx = rangeM * scale * rx;
      const beamAng = Number.isFinite(d.torchAngle) ? d.torchAngle : (d.angle || 0);

      // Clip to ray-cast shadow polygon so beam never bleeds through limestone walls
      lctx.save();
      lctx.beginPath();
      lctx.moveTo(tx, ty);
      for (let i = 0; i < torchData.rays.length; i++) {
        const pt = torchData.rays[i];
        lctx.lineTo(toScreenX(pt.x) * rx, toScreenY(pt.y) * ry);
      }
      lctx.closePath();
      lctx.clip();

      // Wide spill cone via pre-baked radial cutout stamp (0 per-frame gradient allocation!)
      if (spillCutoutStamp) {
        lctx.drawImage(spillCutoutStamp, tx - rPx, ty - rPx, rPx * 2, rPx * 2);
      } else {
        const spill = lctx.createRadialGradient(tx, ty, 0.15 * scale * rx, tx, ty, rPx);
        spill.addColorStop(0, 'rgba(0,0,0,1)');
        spill.addColorStop(0.45, 'rgba(0,0,0,0.88)');
        spill.addColorStop(0.78, 'rgba(0,0,0,0.45)');
        spill.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = spill;
        lctx.fillRect(tx - rPx, ty - rPx, rPx * 2, rPx * 2);
      }

      // Tight intense hotspot beam core (follows torchAngle override!)
      const hotR = rPx * 0.92;
      lctx.beginPath();
      lctx.moveTo(tx, ty);
      lctx.arc(tx, ty, hotR, beamAng - 0.14, beamAng + 0.14);
      lctx.closePath();
      if (hotCutoutStamp) {
        lctx.clip();
        lctx.drawImage(hotCutoutStamp, tx - hotR, ty - hotR, hotR * 2, hotR * 2);
      } else {
        const hot = lctx.createRadialGradient(tx, ty, 0.1 * scale * rx, tx, ty, hotR);
        hot.addColorStop(0, 'rgba(0,0,0,1)');
        hot.addColorStop(0.7, 'rgba(0,0,0,0.95)');
        hot.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = hot;
        lctx.fill();
      }

      lctx.restore();
    };

    const localStrobe = Number.isFinite(diver.strobeMod) ? diver.strobeMod : 1.0;
    carveDiverLight(diver, localTorch, 16.5 * (0.28 + 0.72 * localStrobe));
    const torchPeerIds = this._torchPeerIdsScratch || (this._torchPeerIdsScratch = new Set());
    torchPeerIds.clear();
    for (let i = 0; i < peerTorches.length; i++) {
      const pt = peerTorches[i];
      if (pt.peer?.id) torchPeerIds.add(pt.peer.id);
      carveDiverLight(pt.peer, pt.torch, 14.0);
    }
    // Always carve a soft personal ambient halo around dark/downed buddies so they stay visible
    for (let i = 0; i < peerList.length; i++) {
      const p = peerList[i];
      if (!p || (p.id && torchPeerIds.has(p.id)) || p.alive !== false && p.torchOn !== false) continue;
      carveDiverLight(p, null, 0);
    }

    // Active Emergency Wreck Power Relay Chamber Floodlights punch huge 17.5m holes through darkness! (v162)
    if (Array.isArray(powerRelays)) {
      for (let i = 0; i < powerRelays.length; i++) {
        const rel = powerRelays[i];
        if (!rel || !rel.active) continue;
        const rSx = toScreenX(rel.x) * rx;
        const rSy = toScreenY(rel.y) * ry;
        const flick = 0.92 + 0.08 * Math.sin(timeSec * 14 + (rel.flickerPhase || 0)) * Math.sin(timeSec * 3.7);
        const floodR = (rel.radius || 17.5) * scale * rx * flick;
        if (rSx + floodR < 0 || rSx - floodR > lw || rSy + floodR < 0 || rSy - floodR > lh) continue;
        lctx.globalAlpha = 0.96;
        lctx.drawImage(cutoutStamp, rSx - floodR, rSy - floodR, floodR * 2, floodR * 2);
        lctx.globalAlpha = 1;
      }
    }
    // Topside Support Boat Spotlight cutting down onto a surfaced orange dSMB (v162)
    if (smb?.active && smb.surfaced) {
      const smx = toScreenX(smb.x) * rx;
      const smTop = toScreenY(0) * ry;
      const smBot = toScreenY(16) * ry;
      const halfTop = 2.6 * scale * rx;
      const halfBot = 7.2 * scale * rx;
      lctx.save();
      lctx.beginPath();
      lctx.moveTo(smx - halfTop, smTop);
      lctx.lineTo(smx + halfTop, smTop);
      lctx.lineTo(smx + halfBot, smBot);
      lctx.lineTo(smx - halfBot, smBot);
      lctx.closePath();
      const sg = lctx.createLinearGradient(0, smTop, 0, smBot);
      sg.addColorStop(0, 'rgba(0,0,0,0.88)');
      sg.addColorStop(0.65, 'rgba(0,0,0,0.42)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = sg;
      lctx.fill();
      lctx.restore();
    }
    // Soft bioluminescent/moonlit rim reveal on escorting Megafauna (Mantas, Belugas, Reef Sharks) so they shine beside your wing
    if (Array.isArray(ecosystem?.megafauna)) {
      for (let i = 0; i < ecosystem.megafauna.length; i++) {
        const m = ecosystem.megafauna[i];
        if (!m || (m.behavior !== 'escort' && m.behavior !== 'curious')) continue;
        const isEsc = m.behavior === 'escort';
        const mx = toScreenX(m.x) * rx;
        const my = toScreenY(m.y) * ry;
        const mr = Math.max(5.2, (m.size || 1.8) * (isEsc ? 3.2 : 2.3)) * scale * rx;
        if (mx + mr < 0 || mx - mr > lw || my + mr < 0 || my - mr > lh) continue;
        lctx.globalAlpha = isEsc ? 0.76 : 0.44;
        lctx.drawImage(cutoutStamp, mx - mr, my - mr, mr * 2, mr * 2);
        lctx.globalAlpha = 1;
      }
    }

    // Faint marker glows at visible checkpoints via pre-baked cutout stamp
    const cpRad = 2.4 * scale * rx;
    for (const cp of this.level.checkpoints) {
      const sx = toScreenX(cp.x) * rx;
      const sy = toScreenY(cp.y) * ry;
      if (sx + cpRad < 0 || sx - cpRad > lw || sy + cpRad < 0 || sy - cpRad > lh) continue;
      lctx.globalAlpha = checkpointsHit.has(cp.id) ? 0.58 : 0.42;
      lctx.drawImage(cutoutStamp, sx - cpRad, sy - cpRad, cpRad * 2, cpRad * 2);
    }
    lctx.globalAlpha = 1;

    // Luminous outer-reef Arch daylight apertures (e.g. Dahab Red Sea The Arch at 56m)
    if (Array.isArray(this.level.archWindows)) {
      for (const aw of this.level.archWindows) {
        const ax = toScreenX(aw.x) * rx;
        const ay = toScreenY(aw.y) * ry;
        const awRx = (aw.radiusX || 12) * scale * rx;
        const awRy = (aw.radiusY || 8) * scale * ry;
        if (ax + awRx < 0 || ax - awRx > lw || ay + awRy < 0 || ay - awRy > lh) continue;
        lctx.globalAlpha = 0.88;
        lctx.drawImage(cutoutStamp, ax - awRx, ay - awRy, awRx * 2, awRy * 2);
      }
      lctx.globalAlpha = 1;
    }

    // Geothermal vent illumination cutouts (lights up surrounding volcanic basalt/chimney walls)
    if (cutoutStamp && Array.isArray(this.level.geothermalVents)) {
      for (let i = 0; i < this.level.geothermalVents.length; i++) {
        const v = this.level.geothermalVents[i];
        const vx = toScreenX(v.x) * rx;
        const vy = toScreenY(v.y - (v.plumeHeight ? v.plumeHeight * 0.18 : 1.0)) * ry;
        const rad = (4.2 + (v.radius || 1.2) * 1.4) * scale * rx;
        if (vx + rad < 0 || vx - rad > lw || vy + rad < 0 || vy - rad > lh) continue;
        const pulse = 0.62 + 0.22 * Math.sin(timeSec * 3.4 + i * 1.7);
        lctx.globalAlpha = Math.min(0.88, pulse * (0.75 + (v.strength || 0.7) * 0.25));
        lctx.drawImage(cutoutStamp, vx - rad, vy - rad, rad * 2, rad * 2);
      }
      lctx.globalAlpha = 1;
    }

    // Emergency locator beacon cutout around fallen diver recovery target
    if (this.level.recoveryTarget && !bodyRecovered) {
      const rt = this.level.recoveryTarget;
      const sx = toScreenX(rt.x) * rx;
      const sy = toScreenY(rt.y) * ry;
      const rad = 3.2 * scale * rx;
      if (sx + rad >= 0 && sx - rad <= lw && sy + rad >= 0 && sy - rad <= lh) {
        lctx.globalAlpha = 0.55 + 0.35 * Math.pow(0.5 + 0.5 * Math.sin(timeSec * 5.2), 3);
        lctx.drawImage(cutoutStamp, sx - rad, sy - rad, rad * 2, rad * 2);
        lctx.globalAlpha = 1;
      }
    }

    // Dynamic Bioluminescent Cathedral Lighting for Secret Lair Arena, Armory, Boss Aura & Projectiles (v180)
    if (cutoutStamp && secretLair?.veilBreached && secretLair.spec) {
      const ar = secretLair.spec.arena;
      // 1. Broad ambient cathedral illumination so the massive boss arena is vivid & readable!
      if (ar) {
        const ax = toScreenX(ar.cx) * rx;
        const ay = toScreenY(ar.cy) * ry;
        const aRx = (ar.rx * 1.28) * scale * rx;
        const aRy = (ar.ry * 1.38) * scale * ry;
        if (ax + aRx >= 0 && ax - aRx <= lw && ay + aRy >= 0 && ay - aRy <= lh) {
          lctx.globalAlpha = 0.84;
          lctx.drawImage(cutoutStamp, ax - aRx, ay - aRy, aRx * 2, aRy * 2);
        }
        // 2. Pulsing wall crystal sconces around the cathedral perimeter
        for (let i = 0; i < (ar.lightSconces || []).length; i++) {
          const sc = ar.lightSconces[i];
          const sx = toScreenX(sc.x) * rx;
          const sy = toScreenY(sc.y) * ry;
          const sr = (sc.radius || 13) * scale * rx;
          if (sx + sr < 0 || sx - sr > lw || sy + sr < 0 || sy - sr > lh) continue;
          lctx.globalAlpha = 0.72 + 0.16 * Math.sin(timeSec * 2.6 + i * 1.3);
          lctx.drawImage(cutoutStamp, sx - sr, sy - sr, sr * 2, sr * 2);
        }
      }
      // 3. Soft armory glow in the quiet anteroom
      if (!secretLair.weaponEquipped && secretLair.spec.armory) {
        const arm = secretLair.spec.armory;
        const gx = toScreenX(arm.x) * rx;
        const gy = toScreenY(arm.y) * ry;
        const gr = 7.5 * scale * rx;
        if (gx + gr >= 0 && gx - gr <= lw && gy + gr >= 0 && gy - gr <= lh) {
          lctx.globalAlpha = 0.76 + 0.12 * Math.sin(timeSec * 3.8);
          lctx.drawImage(cutoutStamp, gx - gr, gy - gr, gr * 2, gr * 2);
        }
      }
      // 4. Dynamic bioluminescent Kraken boss aura (keeps boss silhouette & tentacles vivid at all times!)
      if (secretLair.boss && (!secretLair.boss.defeated || secretLair.boss.defeatAnimSec > 0)) {
        const b = secretLair.boss;
        const bx = toScreenX(b.x) * rx;
        const by = toScreenY(b.y) * ry;
        const br = (b.radius * (b.phase === 3 ? 4.4 : 3.8)) * scale * rx;
        if (bx + br >= 0 && bx - br <= lw && by + br >= 0 && by - br <= lh) {
          lctx.globalAlpha = 0.92;
          lctx.drawImage(cutoutStamp, bx - br, by - br, br * 2, br * 2);
        }
      }
      // 5. Flying speargun bolts, emerald Bio-Heal Orbs & enemy ink orbs cast dynamic local light!
      for (const sp of secretLair.spears || []) {
        const sx = toScreenX(sp.x) * rx;
        const sy = toScreenY(sp.y) * ry;
        const sr = (sp.piercing ? 5.2 : 3.4) * scale * rx;
        lctx.globalAlpha = sp.piercing ? 0.78 : 0.56;
        lctx.drawImage(cutoutStamp, sx - sr, sy - sr, sr * 2, sr * 2);
      }
      for (const orb of secretLair.healOrbs || []) {
        const ox = toScreenX(orb.x) * rx;
        const oy = toScreenY(orb.y) * ry;
        const or = 4.2 * scale * rx;
        lctx.globalAlpha = 0.68;
        lctx.drawImage(cutoutStamp, ox - or, oy - or, or * 2, or * 2);
      }
      lctx.globalAlpha = 1;
    }

    ctx.drawImage(this.lightCanvas, 0, 0, cw, ch);

    if (Array.isArray(this.level.archWindows)) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const archStamp = this.glowStamps.cyan;
      for (const aw of this.level.archWindows) {
        const ax = toScreenX(aw.x);
        const ay = toScreenY(aw.y);
        const rxW = (aw.radiusX || 12) * scale;
        const ryH = (aw.radiusY || 8) * scale;
        if (ax + rxW < 0 || ax - rxW > cw || ay + ryH < 0 || ay - ryH > ch) continue;
        ctx.globalAlpha = 0.36;
        ctx.drawImage(archStamp, ax - rxW, ay - ryH, rxW * 2, ryH * 2);
      }
      ctx.restore();
    }

    // Volumetric scattering cone + limestone wall bounce highlights for local diver & peer buddies
    if (localTorch) {
      this._drawVolumetricTorchBeam(ctx, diver, localTorch, 15.5 * (0.3 + 0.7 * localStrobe), {
        siltHaze: localSiltDensity,
        isPeer: false,
        intensityMult: 0.22 + 0.78 * localStrobe,
        toScreenX,
        toScreenY,
        scale,
        timeSec,
      });
    }
    for (let i = 0; i < peerTorches.length; i++) {
      const pt = peerTorches[i];
      this._drawVolumetricTorchBeam(ctx, pt.peer, pt.torch, 13.0, {
        siltHaze: sampleSiltDensity(pt.torch.ox, pt.torch.oy, siltClouds),
        isPeer: true,
        toScreenX,
        toScreenY,
        scale,
        timeSec,
      });
    }
  },

  _drawBubbles(ctx, cw, ch, toScreenX, toScreenY, scale, bubbles) {
    if (!bubbles || !bubbles.length) return;
    ctx.save();

    // Pass 1: Fast batched micro-bubbles (< 2.5px)
    let hasMicro = false;
    ctx.fillStyle = 'rgba(210, 240, 255, 0.56)';
    ctx.beginPath();
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      if (b.trapped) continue;
      const r = Math.max(1.1, b.r * scale);
      if (r >= 2.5) continue;
      const sx = toScreenX(b.x);
      const sy = toScreenY(b.y);
      if (sx < -12 || sx > cw + 12 || sy < -12 || sy > ch + 12) continue;
      ctx.moveTo(sx + r, sy);
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      hasMicro = true;
    }
    if (hasMicro) ctx.fill();

    // Pass 2: Oblate wobbling primary bubbles & silver ceiling-trapped mercury bubbles
    const glints = [];
    let hasRising = false;
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.74)';
    ctx.fillStyle = 'rgba(186, 230, 253, 0.22)';
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      if (b.trapped) continue;
      const r = b.r * scale;
      if (r < 2.5) continue;
      const sx = toScreenX(b.x);
      const sy = toScreenY(b.y);
      if (sx < -24 || sx > cw + 24 || sy < -24 || sy > ch + 24) continue;
      const wobble = b.wobbleFreq ? Math.sin((b.age || 0) * b.wobbleFreq + (b.wobblePhase || 0)) : 0;
      const oblate = Math.min(0.28, (r / 14) * 0.22) + Math.abs(wobble) * 0.06;
      const rx = r * (1 + oblate);
      const ry = r * (1 - oblate * 0.65);
      const tilt = wobble * 0.24;
      ctx.moveTo(sx + Math.cos(tilt) * rx, sy + Math.sin(tilt) * rx);
      ctx.ellipse(sx, sy, rx, ry, tilt, 0, Math.PI * 2);
      hasRising = true;
      if (r >= 3.0) {
        glints.push(sx - rx * 0.34, sy - ry * 0.34, Math.max(0.85, r * 0.24));
      }
    }
    if (hasRising) {
      ctx.fill();
      ctx.stroke();
    }

    // Pass 3: Silver ceiling-trapped percolation bubbles hugging overhead rock
    let hasTrapped = false;
    ctx.fillStyle = 'rgba(224, 242, 254, 0.44)';
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.78)';
    ctx.lineWidth = 1.05;
    ctx.beginPath();
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      if (!b.trapped) continue;
      const sx = toScreenX(b.x);
      const sy = toScreenY(b.y);
      if (sx < -24 || sx > cw + 24 || sy < -24 || sy > ch + 24) continue;
      const fade = Math.max(0.2, Math.min(1, b.life / 0.85));
      const r = Math.max(1.6, b.r * scale * (0.75 + 0.25 * fade));
      const rx = r * 1.48;
      const ry = Math.max(1.1, r * 0.46);
      ctx.moveTo(sx + rx, sy);
      ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
      hasTrapped = true;
    }
    if (hasTrapped) {
      ctx.fill();
      ctx.stroke();
    }

    // Pass 4: Specular highlights on primary bubbles
    if (glints.length > 0) {
      ctx.fillStyle = 'rgba(248, 250, 252, 0.82)';
      ctx.beginPath();
      for (let i = 0; i < glints.length; i += 3) {
        const gx = glints[i];
        const gy = glints[i + 1];
        const gr = glints[i + 2];
        ctx.moveTo(gx + gr, gy);
        ctx.arc(gx, gy, gr, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.restore();
  },

  _drawSiltClouds(ctx, cw, ch, toScreenX, toScreenY, scale, siltClouds, diver, peerList = [], timeSec = 0) {
    if (!siltClouds.length) return;
    ctx.save();
    const wispStamp = this.glowStamps.siltWisp || this.glowStamps.silt;
    const baseStamp = this.glowStamps.silt;
    const rustStamp = this.glowStamps.rustSilt || baseStamp;
    const warmStamp = this.glowStamps.warm;

    const localBeamAng = Number.isFinite(diver.torchAngle) ? diver.torchAngle : (diver.angle || 0);
    // Zero-GC reusable light source pool for silt backscatter (v144)
    const lights = this._siltLightsScratch || (this._siltLightsScratch = []);
    let lightCount = 1;
    if (!lights[0]) lights[0] = { x: 0, y: 0, fx: 1, fy: 0, torchOn: true };
    lights[0].x = diver.x;
    lights[0].y = diver.y;
    lights[0].fx = Math.cos(localBeamAng);
    lights[0].fy = Math.sin(localBeamAng);
    lights[0].torchOn = diver.torchOn !== false;
    if (Array.isArray(peerList)) {
      for (let i = 0; i < peerList.length; i++) {
        const p = peerList[i];
        if (!p || p.alive === false) continue;
        const pBeamAng = Number.isFinite(p.torchAngle) ? p.torchAngle : (p.angle || 0);
        if (!lights[lightCount]) lights[lightCount] = { x: 0, y: 0, fx: 1, fy: 0, torchOn: true };
        const slot = lights[lightCount++];
        slot.x = p.x;
        slot.y = p.y;
        slot.fx = Math.cos(pBeamAng);
        slot.fy = Math.sin(pBeamAng);
        slot.torchOn = p.torchOn !== false;
      }
    }

    // Pass 1: all source-over silt bodies & wispy tendrils; collect lit glare records for Pass 2
    const glareList = this._siltGlareScratch;
    glareList.length = 0;
    const tendrilLimit = this._perfBudget?.siltTendrilLimit ?? (this._isCoarseMobile ? 24 : 999);
    const skipSmallAlpha = this._perfBudget?.siltSkipSmallBelow ?? 0;
    ctx.globalCompositeOperation = 'source-over';

    for (let i = 0; i < siltClouds.length; i++) {
      const s = siltClouds[i];
      if (skipSmallAlpha > 0 && s.alpha < skipSmallAlpha) continue;
      const sx = toScreenX(s.x);
      const sy = toScreenY(s.y);
      const r = s.radius * scale;
      if (sx + r * 1.3 < 0 || sx - r * 1.3 > cw || sy + r * 1.3 < 0 || sy - r * 1.3 > ch) continue;

      let lit = 0.24;
      let glare = 0;
      for (let l = 0; l < lightCount; l++) {
        const src = lights[l];
        const dx = s.x - src.x;
        const dy = s.y - src.y;
        const dSq = dx * dx + dy * dy;
        if (dSq >= 210.25) continue; // 14.5^2
        const dist = Math.sqrt(dSq);
        const nearLit = 1 - dist / 14.5;
        if (nearLit > lit) lit = nearLit;
        if (src.torchOn && dist < 13.0) {
          const align = dist > 0.1 ? (dx * src.fx + dy * src.fy) / dist : 1;
          if (align > 0.46) {
            const beamGlare = (align - 0.46) * 1.95 * Math.max(0, 1 - dist / 13.0) * s.alpha;
            if (beamGlare > glare) glare = beamGlare;
          }
        }
      }
      const lifeRatio = s.maxLife > 0 ? s.life / s.maxLife : 1;
      const rot = (s.rot ?? s.seed ?? 0) + Math.sin(timeSec * 0.35 + (s.seed || 0)) * 0.25;

      // Soft ambient silt body + multi-lobed rotating wispy cloud layers in world space
      const cloudBase = s.isRust ? rustStamp : baseStamp;
      ctx.globalAlpha = Math.min(0.72, s.alpha * (0.36 + lit * 0.4));
      ctx.drawImage(cloudBase, sx - r * 0.92, sy - r * 0.92, r * 1.84, r * 1.84);

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(rot);
      ctx.globalAlpha = Math.min(0.88, s.alpha * (0.48 + lit * 0.44));
      ctx.drawImage(s.isRust ? rustStamp : wispStamp, -r * 1.15, -r * 1.05, r * 2.3, r * 2.1);

      // Counter-rotating secondary billowing tendril (governed by adaptive 60 FPS mobile budget)
      if (lifeRatio < 0.96 && siltClouds.length <= tendrilLimit) {
        ctx.rotate(-rot * 1.7 + 1.1);
        ctx.globalAlpha = Math.min(0.54, s.alpha * 0.42);
        ctx.drawImage(s.isRust ? rustStamp : wispStamp, -r * 0.85, -r * 0.95, r * 1.9, r * 1.75);
      }
      ctx.restore();

      if (glare > 0.01) {
        glareList.push(sx, sy, r, glare, s.seed || 0, s.isRust ? 1 : 0);
      }
    }

    // Pass 2: single batched 'screen' torch backscatter (warm limestone vs burnt-orange shipwreck rust!)
    if (glareList.length > 0) {
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < glareList.length; i += 6) {
        const sx = glareList[i];
        const sy = glareList[i + 1];
        const r = glareList[i + 2];
        const glare = glareList[i + 3];
        const isRust = glareList[i + 5] === 1;
        ctx.globalAlpha = Math.min(0.65, glare * (isRust ? 0.82 : 0.72));
        ctx.drawImage(isRust ? rustStamp : warmStamp, sx - r * 0.9, sy - r * 0.9, r * 1.8, r * 1.8);
      }

      // Pass 3: single batched 'source-over' suspended sediment glints
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(236, 224, 198, 0.45)';
      for (let i = 0; i < glareList.length; i += 6) {
        const sx = glareList[i];
        const sy = glareList[i + 1];
        const r = glareList[i + 2];
        const seed = glareList[i + 4];
        for (let k = 0; k < 4; k++) {
          const a = seed + k * 1.65 + timeSec * 0.25;
          const d = r * (0.25 + ((k * 37) % 10) * 0.055);
          ctx.fillRect(sx + Math.cos(a) * d, sy + Math.sin(a * 1.2) * d * 0.75, 2.2, 2.2);
        }
      }
    }

    ctx.restore();
  },

  _getVignetteCache(ctx, cw, ch) {
    if (this._vignetteCache && this._vignetteCache.cw === cw && this._vignetteCache.ch === ch) {
      return this._vignetteCache;
    }
    const build = (innerScale, outerScale, colorRgb) => {
      const g = ctx.createRadialGradient(cw * 0.5, ch * 0.5, cw * innerScale, cw * 0.5, ch * 0.5, cw * outerScale);
      g.addColorStop(0, `rgba(${colorRgb}, 0)`);
      g.addColorStop(1, `rgba(${colorRgb}, 1)`);
      return g;
    };
    this._vignetteCache = {
      cw,
      ch,
      hypoxia: build(0.24, 0.65, '10, 12, 16'),
      danger: build(0.25, 0.72, '220, 38, 38'),
      narcosis: build(0.28, 0.75, '79, 70, 229'),
    };
    return this._vignetteCache;
  },

  _drawPhysiologyOverlay(ctx, cw, ch, diveState, timeSec) {
    const cnsDanger = (diveState.cnsPercent || 0) / 100;
    const dcsDanger = (diveState.dcsStress || 0) / 100;
    const danger = Math.max(cnsDanger, dcsDanger, diveState.ppo2 > 1.6 ? 0.55 : 0);
    const hasHypoxia = diveState.hypoxiaStress > 8;
    const hasDanger = danger > 0.18;
    const hasNarcosis = diveState.narcosisLevel > 0.2;
    if (!hasHypoxia && !hasDanger && !hasNarcosis) return;

    const vig = this._getVignetteCache(ctx, cw, ch);
    ctx.save();
    if (hasHypoxia) {
      const t = Math.min(1, diveState.hypoxiaStress / 100);
      ctx.globalAlpha = 0.45 + t * 0.52;
      ctx.fillStyle = vig.hypoxia;
      ctx.fillRect(0, 0, cw, ch);
    }
    if (hasDanger) {
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * (5 + danger * 6));
      ctx.globalAlpha = Math.min(0.62, danger * (0.28 + pulse * 0.3));
      ctx.fillStyle = vig.danger;
      ctx.fillRect(0, 0, cw, ch);
    }
    if (hasNarcosis) {
      ctx.globalAlpha = diveState.narcosisLevel * 0.34;
      ctx.fillStyle = vig.narcosis;
      ctx.fillRect(0, 0, cw, ch);
    }
    ctx.restore();
  },

  _drawEmergencyDrillOverlay(ctx, cw, ch, drills, timeSec) {
    if (!drills) return;
    const active = drills.active;
    ctx.save();

    if (active?.kind === 'mask-flood') {
      const sev = Math.max(0.25, Math.min(1, active.severity ?? 0.65));
      const waterTopY = ch * (0.72 - sev * 0.44);
      const grad = ctx.createLinearGradient(0, waterTopY - 24, 0, ch);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      grad.addColorStop(0.14, `rgba(125, 211, 252, ${0.22 + sev * 0.24})`);
      grad.addColorStop(0.55, `rgba(14, 116, 144, ${0.32 + sev * 0.26})`);
      grad.addColorStop(1, `rgba(7, 42, 71, ${0.44 + sev * 0.25})`);

      // Rising sloshing water-line meniscus inside the dive mask
      ctx.beginPath();
      ctx.moveTo(0, ch);
      const steps = 16;
      for (let i = 0; i <= steps; i++) {
        const px = (i / steps) * cw;
        const slosh =
          Math.sin(timeSec * 3.8 + i * 0.72) * (6 + sev * 7) +
          Math.cos(timeSec * 2.3 - i * 0.45) * 4;
        ctx.lineTo(px, waterTopY + slosh);
      }
      ctx.lineTo(cw, ch);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Refractive shimmering bright meniscus ridge
      ctx.strokeStyle = `rgba(224, 242, 254, ${0.55 + sev * 0.3})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const px = (i / steps) * cw;
        const slosh =
          Math.sin(timeSec * 3.8 + i * 0.72) * (6 + sev * 7) +
          Math.cos(timeSec * 2.3 - i * 0.45) * 4;
        if (i === 0) ctx.moveTo(px, waterTopY + slosh);
        else ctx.lineTo(px, waterTopY + slosh);
      }
      ctx.stroke();

      // Scattered refraction droplets across upper visor glass
      ctx.fillStyle = `rgba(186, 230, 253, ${0.18 + sev * 0.16})`;
      for (let k = 0; k < 14; k++) {
        const dx = ((k * 197 + 43) % 100) * 0.01 * cw;
        const dy = ((k * 131 + 19) % 100) * 0.01 * waterTopY;
        const r = 4 + (k % 4) * 3.5;
        ctx.beginPath();
        ctx.arc(dx, dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (active?.kind === 'free-flow') {
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * 9.0);
      ctx.strokeStyle = `rgba(251, 191, 36, ${0.26 + pulse * 0.32})`;
      ctx.lineWidth = Math.max(6, Math.min(cw, ch) * 0.014);
      ctx.strokeRect(4, 4, cw - 8, ch - 8);
    } else if (active?.kind === 'torch-fail') {
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * 12.0);
      ctx.strokeStyle = `rgba(248, 113, 113, ${0.22 + pulse * 0.28})`;
      ctx.lineWidth = Math.max(5, Math.min(cw, ch) * 0.012);
      ctx.strokeRect(4, 4, cw - 8, ch - 8);
    }

    if (drills.backupTorchActive && !active) {
      // Subtle warm halogen amber lens tint when operating on backup light
      ctx.fillStyle = 'rgba(251, 191, 36, 0.045)';
      ctx.fillRect(0, 0, cw, ch);
    }

    ctx.restore();
  },

  /**
   * Shimmering animated underwater caustic light webs projected along sunlit shallow floors & wreck decks (v124).
   * Uses ray-traced sunCurtains hit points so dark overhead cave passages stay authentically shadow-free.
   */
  _drawCausticWebs(ctx, sunCurtains, toScreenX, toScreenY, scale, timeSec) {
    if (!Array.isArray(sunCurtains) || sunCurtains.length === 0) return;
    const t = this._reducedMotion ? timeSec * 0.25 : timeSec;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (let c = 0; c < sunCurtains.length; c++) {
      const curtain = sunCurtains[c];
      const rays = Array.isArray(curtain) ? curtain : curtain?.rays;
      if (!Array.isArray(rays) || rays.length < 2) continue;

      // Project caustic dance cells along the sunlit floor/deck contour (0.4m .. 22m depth)
      for (let i = 0; i < rays.length - 1; i++) {
        const a = rays[i];
        const b = rays[i + 1];
        if (!a || !b) continue;
        if (a.hitWall === false && b.hitWall === false) continue;
        const midY = (a.yBot + b.yBot) * 0.5;
        if (midY < 0.35 || midY > 22.5) continue;
        const depthFade = Math.pow(Math.max(0, 1 - midY / 23.0), 1.35);
        if (depthFade <= 0.03) continue;

        const ax = toScreenX(a.xBot);
        const ay = toScreenY(a.yBot);
        const bx = toScreenX(b.xBot);
        const by = toScreenY(b.yBot);
        const segLen = Math.hypot(bx - ax, by - ay);
        if (segLen < 2 || segLen > scale * 9) continue;

        const wave1 = 0.5 + 0.5 * Math.sin(a.xBot * 1.45 + t * 2.35 + c * 1.3);
        const wave2 = 0.5 + 0.5 * Math.cos(a.xBot * 2.4 - t * 1.85 + midY * 0.45);
        const shimmer = (0.35 + 0.65 * wave1 * wave2) * depthFade;

        // Luminous caustic ribbon hugging the rock/deck contour
        ctx.strokeStyle = `rgba(186, 245, 255, ${(0.22 + shimmer * 0.38).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.5, (0.09 + shimmer * 0.14) * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();

        // Interference caustic cell arcs dancing just above the sunlit surface
        const cx = (ax + bx) * 0.5 + Math.sin(t * 2.1 + i * 1.7) * 0.16 * scale;
        const cy = (ay + by) * 0.5 - (0.28 + wave1 * 0.35) * scale;
        const rx = Math.max(4, (0.42 + wave2 * 0.36) * scale);
        const ry = Math.max(2, rx * 0.34);
        ctx.strokeStyle = `rgba(224, 252, 255, ${(shimmer * 0.32).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, 0.045 * scale);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, Math.sin(t * 1.2 + i) * 0.18, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  },

  /**
   * Foreshortened concentric water-surface fin-kick & splash meniscus ripple rings at y = 0 (v124).
   */
  _drawSurfaceRipples(ctx, surfaceRipples, visX0, visX1, toScreenX, toScreenY, scale, timeSec) {
    const surfY = toScreenY(0);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Subtle ambient horizon shimmer along open water surface
    if (Array.isArray(surfaceRipples) && surfaceRipples.length > 0) {
      for (let i = 0; i < surfaceRipples.length; i++) {
        const rp = surfaceRipples[i];
        if (!rp || rp.x + rp.radius < visX0 - 2 || rp.x - rp.radius > visX1 + 2) continue;
        const lifeT = Math.max(0, Math.min(1, rp.age / Math.max(0.2, rp.life)));
        const fade = (1 - lifeT) * (1 - lifeT) * (rp.intensity ?? 0.7);
        if (fade <= 0.02) continue;

        const sx = toScreenX(rp.x);
        const rx = Math.max(3, rp.radius * scale);
        const ry = Math.max(1.2, rx * 0.14);

        // Outer bright meniscus ring
        ctx.strokeStyle = `rgba(224, 248, 255, ${(fade * 0.68).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.1, (0.045 * (1 - lifeT * 0.5)) * scale);
        ctx.beginPath();
        ctx.ellipse(sx, surfY, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Inner harmonic secondary ripple crest
        if (rx > 10) {
          ctx.strokeStyle = `rgba(103, 232, 249, ${(fade * 0.42).toFixed(3)})`;
          ctx.lineWidth = Math.max(0.9, 0.03 * scale);
          ctx.beginPath();
          ctx.ellipse(sx, surfY + 1, rx * 0.64, ry * 0.68, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else {
      // Gentle resting meniscus glints when camera sits near calm surface
      const t = this._reducedMotion ? timeSec * 0.25 : timeSec;
      const startX = Math.floor(visX0 / 6) * 6;
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.24)';
      ctx.lineWidth = 1.2;
      for (let wx = startX; wx <= visX1; wx += 6) {
        const sx = toScreenX(wx + Math.sin(t * 0.8 + wx) * 0.6);
        const w = (0.7 + 0.4 * Math.sin(t * 1.9 + wx * 0.7)) * scale;
        ctx.beginPath();
        ctx.moveTo(sx - w, surfY);
        ctx.lineTo(sx + w, surfY);
        ctx.stroke();
      }
    }

    ctx.restore();
  },

  /**
   * Beer-Lambert depth spectral color absorption + warm high-CRI torch color restoration cone (v124).
   * Below ~6m reds fade into deep cobalt-indigo, while sweeping your torch vividly brings warm hues back.
   */
  _drawSpectralAbsorption(ctx, cw, ch, diver, toScreenX, toScreenY, scale) {
    if (!diver) return;
    const spec = computeSpectralAbsorption(diver.y);
    if (spec.tintAlpha <= 0.005) return;

    ctx.save();
    // 1. Subtle deep-water cobalt spectral wash (reduces red/warm ambient saturation cleanly at depth)
    ctx.fillStyle = `rgba(4, 32, 74, ${spec.tintAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, cw, ch);

    // 2. High-CRI Torch Spectral Restoration Cone: restores warm natural reds/oranges inside the beam!
    if (diver.torchOn !== false && spec.warmRestoreStrength > 0.08) {
      const strobe = Number.isFinite(diver.strobeMod) ? diver.strobeMod : 1.0;
      const beamAlpha = spec.warmRestoreStrength * (0.11 + (diver.backupTorchActive ? 0.05 : 0)) * (0.25 + 0.75 * strobe);
      if (beamAlpha > 0.01) {
        const ang = Number.isFinite(diver.torchAngle) ? diver.torchAngle : diver.angle || 0;
        const ox = toScreenX(diver.x + Math.cos(ang) * 0.45);
        const oy = toScreenY(diver.y + Math.sin(ang) * 0.45);
        const reachPx = Math.max(40, (diver.backupTorchActive ? 9.5 : 13.0) * scale * (0.35 + 0.65 * strobe));
        const tx = ox + Math.cos(ang) * reachPx * 0.48;
        const ty = oy + Math.sin(ang) * reachPx * 0.48;
        const g = ctx.createRadialGradient(ox, oy, 4, tx, ty, reachPx * 0.62);
        const optic = getTorchOptic(diver?.livery?.torchId);
        const warmRgb = diver.backupTorchActive ? '255, 198, 120' : (optic.warmRgb || '255, 224, 182');
        g.addColorStop(0, `rgba(${warmRgb}, ${(beamAlpha * 1.15).toFixed(3)})`);
        g.addColorStop(0.55, `rgba(${warmRgb}, ${(beamAlpha * 0.48).toFixed(3)})`);
        g.addColorStop(1, `rgba(${warmRgb}, 0)`);
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        const halfCone = diver.backupTorchActive ? 0.27 : 0.34;
        ctx.arc(ox, oy, reachPx, ang - halfCone, ang + halfCone);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  },

  /**
   * Dynamic weather & time-of-day sky atmosphere (v137):
   * Golden Hour molten sunset wash, Night Dive starry vault + glowing crescent moon,
   * Tropical Storm brooding cloud veil + lightning sky flash, and Arctic Snow overcast.
   */
  _drawWeatherSkyAtmosphere(ctx, cw, surfY, timeSec) {
    const w = this._activeWeather;
    if (!w || w.id === 'clear-day' || surfY <= 0) return;
    const skyH = Math.max(10, Math.min(ctx.canvas.height, surfY + 8));
    ctx.save();

    if (w.skyDarken > 0) {
      ctx.fillStyle = `rgba(2, 6, 23, ${Math.min(0.88, w.skyDarken).toFixed(3)})`;
      ctx.fillRect(0, 0, cw, skyH);
    }
    if (w.skyTintRgba) {
      const grad = ctx.createLinearGradient(0, 0, 0, skyH);
      grad.addColorStop(0, w.skyTintRgba);
      grad.addColorStop(1, w.id === 'golden-hour' ? 'rgba(251, 191, 36, 0.42)' : 'rgba(2, 6, 23, 0.08)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, skyH);
    }

    // Starfield + crescent moon for Bioluminescent Night Dive
    if (w.stars) {
      const starCount = Math.min(68, Math.max(28, Math.round(cw / 20)));
      for (let i = 0; i < starCount; i++) {
        const sx = ((Math.sin(i * 127.1 + 3.1) * 43758.5453) % 1 + 1) % 1 * cw;
        const sy = ((Math.sin(i * 269.5 + 1.7) * 43758.5453) % 1 + 1) % 1 * (skyH * 0.86);
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(timeSec * (1.4 + (i % 5) * 0.4) + i * 2.1));
        const r = i % 7 === 0 ? 1.8 : 1.05;
        ctx.fillStyle = i % 9 === 0 ? `rgba(186, 230, 253, ${(tw * 0.92).toFixed(3)})` : `rgba(241, 245, 249, ${(tw * 0.82).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Glowing crescent moon
      const mx = cw * 0.78;
      const my = Math.min(skyH * 0.34, 72);
      const mr = Math.max(11, Math.min(18, skyH * 0.12));
      const halo = ctx.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 3.8);
      halo.addColorStop(0, 'rgba(224, 242, 254, 0.36)');
      halo.addColorStop(0.5, 'rgba(125, 211, 252, 0.12)');
      halo.addColorStop(1, 'rgba(125, 211, 252, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(mx, my, mr * 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#07112b';
      ctx.beginPath();
      ctx.arc(mx + mr * 0.42, my - mr * 0.16, mr * 0.88, 0, Math.PI * 2);
      ctx.fill();
    }

    // Golden Hour low horizon sun glow
    if (w.id === 'golden-hour') {
      const sunX = cw * 0.72;
      const sunY = Math.max(18, skyH - 18);
      const g = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, Math.max(120, cw * 0.32));
      g.addColorStop(0, 'rgba(254, 240, 138, 0.62)');
      g.addColorStop(0.35, 'rgba(251, 146, 60, 0.3)');
      g.addColorStop(1, 'rgba(251, 146, 60, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cw, skyH);
    }

    // Storm distant lightning sky illumination
    if (w.lightning) {
      const flash = computeStormLightningFlash(w, timeSec);
      if (flash > 0.02) {
        ctx.fillStyle = `rgba(224, 242, 254, ${(flash * 0.42).toFixed(3)})`;
        ctx.fillRect(0, 0, cw, skyH);
      }
    }

    ctx.restore();
  },

  /**
   * Falling rain streaks (Tropical Storm) or blowing snow flurries (Arctic Snow) above water (v137).
   */
  _drawWeatherPrecipitation(ctx, cw, ch, surfY, timeSec) {
    const w = this._activeWeather;
    if (!w) return;
    const clipH = Math.max(0, Math.min(ch, surfY + 6));
    if (clipH < 8) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cw, clipH);
    ctx.clip();

    if (w.precip === 'rain') {
      const count = Math.min(84, Math.max(36, Math.round(cw / 16)));
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.42)';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const seedX = ((Math.sin(i * 91.7 + 1.3) * 43758.5453) % 1 + 1) % 1;
        const seedY = ((Math.sin(i * 183.1 + 4.9) * 43758.5453) % 1 + 1) % 1;
        const speed = 420 + (i % 5) * 65;
        const y = ((seedY * clipH + timeSec * speed) % (clipH + 40)) - 20;
        const x = ((seedX * cw - timeSec * 125 + y * 0.24) % (cw + 60) + (cw + 60)) % (cw + 60) - 30;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 6.5, y + 18);
      }
      ctx.stroke();

      const flash = computeStormLightningFlash(w, timeSec);
      if (flash > 0.05) {
        ctx.fillStyle = `rgba(224, 242, 254, ${(flash * 0.16).toFixed(3)})`;
        ctx.fillRect(0, 0, cw, clipH);
      }
    } else if (w.precip === 'snow') {
      const count = Math.min(72, Math.max(32, Math.round(cw / 18)));
      ctx.fillStyle = 'rgba(241, 245, 249, 0.78)';
      for (let i = 0; i < count; i++) {
        const seedX = ((Math.sin(i * 63.3 + 2.7) * 43758.5453) % 1 + 1) % 1;
        const seedY = ((Math.sin(i * 149.9 + 5.1) * 43758.5453) % 1 + 1) % 1;
        const speed = 34 + (i % 6) * 11;
        const y = ((seedY * clipH + timeSec * speed) % (clipH + 16)) - 8;
        const drift = Math.sin(timeSec * 1.4 + i * 1.7) * 18 - timeSec * 22;
        const x = ((seedX * cw + drift) % (cw + 20) + (cw + 20)) % (cw + 20) - 10;
        const r = 1.2 + (i % 3) * 0.75;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  },

  /**
   * Draw reactive underwater environmental hazards (v141):
   *   - Cold Thermocline Pockets (shimmering icy-cobalt refraction lenses)
   *   - Overhead Bubble Percolation Ceilings (fragile silt ribbons + cascading sediment streaks)
   *   - Surge-Driven Shifting Wreck Hatches / Tidal Siphon Gates (animated doors + status beacon)
   */
  _drawDynamicHazards(ctx, hazards, visX0, visX1, visY0, visY1, toScreenX, toScreenY, scale, timeSec, diver) {
    if (!hazards) return;
    ctx.save();

    // 1. Cold Thermocline Pockets
    const thermos = hazards.thermoclines || [];
    for (let i = 0; i < thermos.length; i++) {
      const th = thermos[i];
      if (th.x + th.rx < visX0 || th.x - th.rx > visX1 || th.y + th.ry < visY0 || th.y - th.ry > visY1) continue;
      const sx = toScreenX(th.x);
      const sy = toScreenY(th.y);
      const rxPx = th.rx * scale;
      const ryPx = th.ry * scale;
      const grad = ctx.createRadialGradient(sx, sy, rxPx * 0.12, sx, sy, Math.max(rxPx, ryPx));
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.24)');
      grad.addColorStop(0.55, 'rgba(14, 165, 233, 0.14)');
      grad.addColorStop(1, 'rgba(2, 132, 199, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(sx, sy, rxPx, ryPx, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shimmering cold thermal shear ribbons
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.36)';
      ctx.lineWidth = Math.max(1, 0.055 * scale);
      for (let r = -1; r <= 1; r++) {
        ctx.beginPath();
        const yOff = r * ryPx * 0.38;
        const steps = 10;
        for (let k = 0; k <= steps; k++) {
          const frac = k / steps;
          const px = sx - rxPx * 0.85 + frac * rxPx * 1.7;
          const py = sy + yOff + Math.sin(frac * 6.2 + timeSec * 2.4 + th.phase + r) * (0.14 * scale);
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      if (diver && Math.hypot(diver.x - th.x, diver.y - th.y) < th.rx + 4.5) {
        ctx.font = `800 ${Math.max(9, Math.round(scale * 0.34))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(186, 230, 253, 0.85)';
        ctx.fillText(`❄️ -${th.tempDropC}°C THERMOCLINE`, sx, sy - ryPx * 0.72);
      }
    }

    // 2. Overhead Bubble Percolation Ceilings
    const percs = hazards.percolationZones || [];
    for (let i = 0; i < percs.length; i++) {
      const pz = percs[i];
      if (pz.x + pz.halfWidth < visX0 || pz.x - pz.halfWidth > visX1 || pz.ceilY + 6 < visY0 || pz.ceilY - 1 > visY1) continue;
      const sx0 = toScreenX(pz.x - pz.halfWidth);
      const sx1 = toScreenX(pz.x + pz.halfWidth);
      const sy = toScreenY(pz.ceilY);
      const isRust = Boolean(this.level?.isWreck);
      const activeGlow = Math.min(1, pz.intensity || 0);

      // Delicate clinging ceiling silt crust
      ctx.strokeStyle = isRust
        ? `rgba(217, 119, 6, ${(0.34 + activeGlow * 0.45).toFixed(2)})`
        : `rgba(226, 232, 240, ${(0.28 + activeGlow * 0.48).toFixed(2)})`;
      ctx.lineWidth = Math.max(1.5, (0.09 + activeGlow * 0.08) * scale);
      ctx.setLineDash([Math.max(4, scale * 0.25), Math.max(3, scale * 0.16)]);
      ctx.beginPath();
      ctx.moveTo(sx0, sy);
      ctx.lineTo(sx1, sy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Cascading falling sediment streaks
      if (pz.streaks && pz.streaks.length > 0) {
        ctx.strokeStyle = isRust ? 'rgba(245, 158, 11, 0.58)' : 'rgba(203, 213, 225, 0.56)';
        ctx.lineWidth = Math.max(1, 0.05 * scale);
        ctx.beginPath();
        for (let k = 0; k < pz.streaks.length; k++) {
          const st = pz.streaks[k];
          const px = toScreenX(st.x);
          const py = toScreenY(st.y);
          ctx.moveTo(px, py);
          ctx.lineTo(px, py + Math.max(4, scale * 0.35));
        }
        ctx.stroke();
      }
    }

    // 3. Surge-Driven Shifting Wreck Hatches / Tidal Siphon Gates
    const hatches = hazards.shiftingHatches || [];
    for (let i = 0; i < hatches.length; i++) {
      const h = hatches[i];
      if (h.x + h.radius < visX0 || h.x - h.radius > visX1 || h.y + h.radius < visY0 || h.y - h.radius > visY1) continue;
      const sx = toScreenX(h.x);
      const sy = toScreenY(h.y);
      const rPx = h.radius * scale;
      const open = Math.max(0, Math.min(1, h.openness ?? 1));
      const leafSpan = rPx * 0.82 * (1 - open * 0.86);
      const frameW = Math.max(4, 0.24 * scale);

      // Steel bulkhead / karst gate leaves closing from top & bottom
      ctx.fillStyle = h.isWreckHatch ? '#334155' : '#475569';
      ctx.strokeStyle = h.isWreckHatch ? '#94a3b8' : '#7dd3fc';
      ctx.lineWidth = Math.max(1.2, 0.06 * scale);
      ctx.fillRect(sx - frameW * 0.5, sy - rPx, frameW, Math.max(3, leafSpan));
      ctx.strokeRect(sx - frameW * 0.5, sy - rPx, frameW, Math.max(3, leafSpan));
      ctx.fillRect(sx - frameW * 0.5, sy + rPx - Math.max(3, leafSpan), frameW, Math.max(3, leafSpan));
      ctx.strokeRect(sx - frameW * 0.5, sy + rPx - Math.max(3, leafSpan), frameW, Math.max(3, leafSpan));

      // Status timing beacon (Green = wide open window, Amber = closing, Red = slamming/surging)
      const beaconCol = open >= 0.55 ? '#4ade80' : open >= 0.3 ? '#fbbf24' : '#f87171';
      ctx.fillStyle = beaconCol;
      ctx.beginPath();
      ctx.arc(sx, sy - rPx - Math.max(4, scale * 0.22), Math.max(3, scale * 0.14), 0, Math.PI * 2);
      ctx.fill();

      if (open < 0.35) {
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.45)';
        ctx.lineWidth = Math.max(1.2, 0.06 * scale);
        ctx.beginPath();
        ctx.arc(sx, sy, rPx * 0.9, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 4. Living Sump Hydrology: Subtle Tidal Siphon / Outflow Current Drift Streaks (v159)
    const tide = hazards.tidalCurrent;
    if (tide?.enabled && tide.strength >= 0.16 && diver) {
      const dir = Math.sign(tide.vx || 1);
      const streakAlpha = Math.min(0.36, tide.strength * 0.48);
      ctx.strokeStyle = `rgba(186, 230, 253, ${streakAlpha.toFixed(3)})`;
      ctx.lineWidth = Math.max(1, 0.045 * scale);
      ctx.lineCap = 'round';
      const spanX = Math.max(14, visX1 - visX0);
      const spanY = Math.max(10, visY1 - visY0);
      for (let i = 0; i < 14; i++) {
        const seed = i * 19.37;
        const speed = 1.6 + tide.strength * 3.8 + (i % 3) * 0.45;
        const rawX = (((seed * 7.3 + timeSec * speed * dir) % spanX) + spanX) % spanX;
        const wx = visX0 + rawX;
        const wy = Math.max(2.5, visY0 + ((seed * 3.1) % spanY));
        const sx = toScreenX(wx);
        const sy = toScreenY(wy);
        const lenPx = (0.75 + tide.strength * 1.4) * scale;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + dir * lenPx, sy + (tide.vy || 0) * lenPx * 0.4);
        ctx.stroke();
      }
    }

    ctx.restore();
  },

  /**
   * Render hidden Acoustic Black-Box / Lost Hydro-Probe (with sonar-piercing ping waves)
   * and player-clipped glowing directional Line Cookies (v159).
   */
  _drawBlackBoxAndCookies(ctx, blackBox, lineCookies, diver, toScreenX, toScreenY, scale, timeSec, sonarActive = false, surveyPins = null) {
    ctx.save();

    if (blackBox && !blackBox.recovered) {
      const bx = toScreenX(blackBox.x);
      const by = toScreenY(blackBox.y);
      const distM = diver ? Math.hypot(diver.x - blackBox.x, diver.y - blackBox.y) : 99;
      const pulse = Math.max(0, Math.min(1, blackBox.pingPulse || 0));

      if (pulse > 0.02 && (distM <= 28 || sonarActive)) {
        const expand = 1 - pulse;
        const ringR = (0.9 + expand * 7.5) * scale;
        ctx.strokeStyle = blackBox.isWreck
          ? `rgba(251, 146, 60, ${(pulse * 0.72).toFixed(3)})`
          : `rgba(250, 204, 21, ${(pulse * 0.72).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.5, 0.08 * scale);
        ctx.beginPath();
        ctx.arc(bx, by, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (distM <= 18 || sonarActive) {
        const boxW = Math.max(10, 0.56 * scale);
        const boxH = Math.max(7, 0.36 * scale);
        ctx.fillStyle = blackBox.isWreck ? '#f97316' : '#eab308';
        ctx.strokeStyle = '#fff7ed';
        ctx.lineWidth = Math.max(1.2, 0.055 * scale);
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx - boxW * 0.5, by - boxH * 0.5, boxW, boxH, Math.max(2, 0.08 * scale));
        } else {
          ctx.rect(bx - boxW * 0.5, by - boxH * 0.5, boxW, boxH);
        }
        ctx.fill();
        ctx.stroke();

        const ledOn = Math.sin(timeSec * 6.5) > 0;
        ctx.fillStyle = ledOn ? '#38bdf8' : '#7dd3fc';
        ctx.beginPath();
        ctx.arc(bx + boxW * 0.28, by - boxH * 0.12, Math.max(2, 0.09 * scale), 0, Math.PI * 2);
        ctx.fill();

        if (distM <= 9.5) {
          ctx.font = `800 ${Math.max(9, Math.round(scale * 0.34))}px ui-monospace, monospace`;
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fed7aa';
          ctx.fillText(`📟 ${blackBox.isWreck ? 'BLACK BOX' : 'HYDRO-PROBE'}`, bx, by - boxH - Math.max(4, 0.18 * scale));
        }
      }
    }

    if (Array.isArray(lineCookies) && lineCookies.length > 0) {
      for (let i = 0; i < lineCookies.length; i++) {
        const ck = lineCookies[i];
        if (!ck) continue;
        const cx = toScreenX(ck.x);
        const cy = toScreenY(ck.y);
        const rPx = Math.max(6, 0.3 * scale);
        const glow = 0.75 + 0.25 * Math.sin(timeSec * 3.4 + i);

        ctx.fillStyle = `rgba(251, 146, 60, ${(0.24 * glow).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(cx, cy, rPx * 1.9, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ck.exitAngle || 0);
        ctx.fillStyle = '#fb923c';
        ctx.strokeStyle = '#ffedd5';
        ctx.lineWidth = Math.max(1.2, 0.05 * scale);
        ctx.beginPath();
        ctx.moveTo(rPx * 1.25, 0);
        ctx.lineTo(-rPx * 0.85, -rPx * 0.78);
        ctx.lineTo(-rPx * 0.42, 0);
        ctx.lineTo(-rPx * 0.85, rPx * 0.78);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.font = `800 ${Math.max(8, Math.round(scale * 0.28))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 237, 213, 0.92)';
        ctx.fillText(`#${ck.index} 🏠${ck.distToExitM}m`, cx, cy - rPx * 1.45);
      }
    }

    // Custom Wetnotes Survey Pins rendered in-world as glowing golden piton flags (v171)
    if (Array.isArray(surveyPins) && surveyPins.length > 0) {
      for (let i = 0; i < surveyPins.length; i++) {
        const pin = surveyPins[i];
        if (!pin || !Number.isFinite(pin.x) || !Number.isFinite(pin.y)) continue;
        const px = toScreenX(pin.x);
        const py = toScreenY(pin.y);
        const poleH = Math.max(12, 0.62 * scale);
        const pulse = 0.72 + 0.28 * Math.sin(timeSec * 3.0 + i * 1.3);

        ctx.fillStyle = `rgba(250, 204, 21, ${(0.2 * pulse).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py - poleH * 0.45, Math.max(7, 0.34 * scale), 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = Math.max(1.4, 0.06 * scale);
        ctx.beginPath();
        ctx.moveTo(px, py + Math.max(3, 0.12 * scale));
        ctx.lineTo(px, py - poleH);
        ctx.stroke();

        const fw = Math.max(11, 0.52 * scale);
        const fh = Math.max(6, 0.28 * scale);
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.moveTo(px, py - poleH);
        ctx.lineTo(px + fw, py - poleH + fh * 0.5);
        ctx.lineTo(px, py - poleH + fh);
        ctx.closePath();
        ctx.fill();

        if (scale >= 14) {
          ctx.font = `800 ${Math.max(8, Math.round(scale * 0.28))}px ui-monospace, monospace`;
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fef08a';
          ctx.fillText(`📍 ${pin.tag || 'PIN'} ${pin.depthM ?? Math.round(pin.y)}m`, px, py - poleH - Math.max(3, 0.14 * scale));
        }
      }
    }

    ctx.restore();
  },

  /**
   * Render Emergency Wreck Hull Power Relays & Warm Tungsten-Amber Floodlight Glow (v162).
   */
  _drawPowerRelays(ctx, powerRelays, diver, toScreenX, toScreenY, scale, timeSec) {
    if (!Array.isArray(powerRelays) || powerRelays.length === 0) return;
    ctx.save();
    for (let i = 0; i < powerRelays.length; i++) {
      const rel = powerRelays[i];
      if (!rel) continue;
      const sx = toScreenX(rel.x);
      const sy = toScreenY(rel.y);
      const bw = Math.max(12, 0.72 * scale);
      const bh = Math.max(15, 0.88 * scale);

      if (rel.active) {
        // Warm tungsten-amber volumetric chamber bloom
        const flick = 0.93 + 0.07 * Math.sin(timeSec * 14 + (rel.flickerPhase || 0));
        const glowR = (rel.radius || 17.5) * 0.72 * scale * flick;
        const g = ctx.createRadialGradient(sx, sy, bw * 0.3, sx, sy, glowR);
        g.addColorStop(0, 'rgba(251, 191, 36, 0.32)');
        g.addColorStop(0.45, 'rgba(245, 158, 11, 0.12)');
        g.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Watertight steel breaker box housing
      ctx.fillStyle = rel.active ? '#334155' : '#1e293b';
      ctx.strokeStyle = rel.active ? '#fbbf24' : '#64748b';
      ctx.lineWidth = Math.max(1.4, 0.06 * scale);
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(sx - bw * 0.5, sy - bh * 0.5, bw, bh, Math.max(2, 0.08 * scale));
      } else {
        ctx.rect(sx - bw * 0.5, sy - bh * 0.5, bw, bh);
      }
      ctx.fill();
      ctx.stroke();

      // Status LED (pulsing red standby vs steady emerald-amber active)
      const ledPulse = 0.55 + 0.45 * Math.sin(timeSec * (rel.active ? 2.5 : 5.5));
      ctx.fillStyle = rel.active
        ? `rgba(74, 222, 128, ${(0.75 + 0.25 * ledPulse).toFixed(2)})`
        : `rgba(248, 113, 113, ${ledPulse.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(sx, sy - bh * 0.22, Math.max(2.5, 0.13 * scale), 0, Math.PI * 2);
      ctx.fill();

      // Heavy breaker throw handle
      ctx.strokeStyle = rel.active ? '#fde047' : '#cbd5e1';
      ctx.lineWidth = Math.max(2, 0.09 * scale);
      ctx.beginPath();
      ctx.moveTo(sx, sy + bh * 0.05);
      ctx.lineTo(sx + bw * 0.34, sy + (rel.active ? -bh * 0.12 : bh * 0.28));
      ctx.stroke();

      const distM = diver ? Math.hypot(diver.x - rel.x, diver.y - rel.y) : 99;
      if (distM <= 11) {
        ctx.font = `800 ${Math.max(9, Math.round(scale * 0.33))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = rel.active ? '#fde68a' : '#fca5a5';
        ctx.fillText(rel.active ? '⚡ FLOODLIGHTS ON' : '⚡ AUX POWER [E]', sx, sy - bh * 0.72);
      }
    }
    ctx.restore();
  },

  /**
   * Render Deployed Delayed Surface Marker Buoy (dSMB): taut finger-spool line, bobbing 1.8m
   * fluorescent-orange inflatable sausage with SOLAS collar & Topside Boat Spotlight beam (v162).
   */
  _drawSurfaceMarkerBuoy(ctx, smb, toScreenX, toScreenY, scale, timeSec) {
    if (!smb?.active) return;
    ctx.save();
    const sx = toScreenX(smb.x);
    const bobY = smb.surfaced ? Math.sin(timeSec * 3.1) * 0.14 : 0;
    const sy = toScreenY((smb.y || 0.3) + bobY);
    const ax = toScreenX(smb.anchorX ?? smb.x);
    const ay = toScreenY(smb.anchorY ?? (smb.y + 6));

    // 1. Subtle Topside Support Boat amber-white searchlight cone once SMB hits surface
    if (smb.surfaced) {
      const topY = toScreenY(0);
      const botY = toScreenY(15);
      const g = ctx.createLinearGradient(0, topY, 0, botY);
      g.addColorStop(0, 'rgba(254, 240, 138, 0.24)');
      g.addColorStop(0.55, 'rgba(254, 240, 138, 0.08)');
      g.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx - 1.8 * scale, topY);
      ctx.lineTo(sx + 1.8 * scale, topY);
      ctx.lineTo(sx + 5.6 * scale, botY);
      ctx.lineTo(sx - 5.6 * scale, botY);
      ctx.closePath();
      ctx.fill();
    }

    // 2. Taut white finger-spool line from diver/anchor up to the SMB
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.72)';
    ctx.lineWidth = Math.max(1.3, 0.055 * scale);
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(sx, sy + 0.55 * scale);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Fluorescent-orange 1.8m inflatable dSMB sausage with SOLAS reflective silver collar
    const wPx = Math.max(7, 0.28 * scale);
    const hPx = Math.max(26, 1.55 * scale);
    ctx.fillStyle = '#f97316';
    ctx.strokeStyle = '#ffedd5';
    ctx.lineWidth = Math.max(1.2, 0.05 * scale);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(sx - wPx * 0.5, sy - hPx * 0.65, wPx, hPx, wPx * 0.45);
    } else {
      ctx.rect(sx - wPx * 0.5, sy - hPx * 0.65, wPx, hPx);
    }
    ctx.fill();
    ctx.stroke();

    // SOLAS reflective silver band near top
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(sx - wPx * 0.48, sy - hPx * 0.44, wPx * 0.96, Math.max(3, hPx * 0.14));

    ctx.font = `800 ${Math.max(9, Math.round(scale * 0.32))}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fed7aa';
    ctx.fillText(smb.surfaced ? '🎈 SMB · TOPSIDE COPY' : '🎈 SMB RISING', sx, sy - hPx * 0.78);

    ctx.restore();
  },

  _drawThermoclineFrostRim(ctx, cw, ch, hazards, timeSec) {
    const cold = Math.max(0, Math.min(1, hazards?.thermoclineColdFactor || 0));
    if (cold <= 0.05) return;
    ctx.save();
    const pulse = 0.85 + 0.15 * Math.sin(timeSec * 4.5);
    const alpha = Math.min(0.42, cold * 0.36 * pulse);
    const rOuter = Math.hypot(cw * 0.5, ch * 0.5);
    const g = ctx.createRadialGradient(cw * 0.5, ch * 0.5, rOuter * 0.46, cw * 0.5, ch * 0.5, rOuter);
    g.addColorStop(0, 'rgba(56, 189, 248, 0)');
    g.addColorStop(1, `rgba(125, 211, 252, ${alpha.toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
  },

  /**
   * Tactile AAA Mask-Glass Immersion Pass (v161):
   *  - Sparkling water droplets on mask glass near/breaking the surface (<2.0m)
   *  - Plunge-entry surface splash sheen during the first 1.4s
   *  - Cold thermocline mask rim condensation
   *  - Soft foreground exhale bubble parallax during heavy breathing / exhale
   */
  _drawImmersionGlassFx(ctx, cw, ch, diver, diveState, hazards, breathState, timeSec) {
    if (!diver || this._reducedMotion) return;
    const depthM = Math.max(0, Number(diver.y) || 0);
    const hr = Number(diveState?.heartRateBpm) || 72;
    const cold = Math.max(0, Math.min(1, hazards?.thermoclineColdFactor || 0));
    const nearSurface = depthM < 2.0;
    const plungeSplash = timeSec >= 0 && timeSec < 1.4 && depthM < 3.8;
    const showExhaleBubbles = depthM >= 1.5 && (breathState === 'exhale' || hr >= 112);
    if (!nearSurface && !plungeSplash && cold < 0.14 && !showExhaleBubbles) return;

    ctx.save();

    // 1. Sparkling surface mask droplets & gentle sun-glare sheen
    if (nearSurface) {
      const surfFactor = Math.max(0, Math.min(1, (2.0 - depthM) / 1.6));
      for (let i = 0; i < 12; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const edgeFrac = 0.04 + ((i * 37) % 14) * 0.012;
        const x = side > 0 ? cw * edgeFrac : cw * (1 - edgeFrac);
        const slide = ((timeSec * (18 + (i % 4) * 9) + i * 73) % (ch * 0.78)) + ch * 0.08;
        const r = (3.5 + (i % 4) * 2.1) * (cw > 900 ? 1.15 : 0.9);
        ctx.fillStyle = `rgba(224, 242, 254, ${(0.24 * surfFactor).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(x, slide, r * 0.82, r * 1.18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.55 * surfFactor).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x - r * 0.24, slide - r * 0.32, r * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2. Entry plunge splash curtain
    if (plungeSplash) {
      const splashAlpha = Math.max(0, (1 - timeSec / 1.4) * 0.28);
      const grad = ctx.createLinearGradient(0, 0, 0, ch * 0.42);
      grad.addColorStop(0, `rgba(186, 230, 253, ${splashAlpha.toFixed(3)})`);
      grad.addColorStop(1, 'rgba(186, 230, 253, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, ch * 0.42);
    }

    // 3. Cold thermocline mask rim fog condensation
    if (cold >= 0.14) {
      const fogAlpha = Math.min(0.26, (cold - 0.12) * 0.3);
      const cornerR = Math.min(cw, ch) * 0.34;
      const corners = [[0, 0], [cw, 0], [0, ch], [cw, ch]];
      for (let i = 0; i < corners.length; i++) {
        const [cx, cy] = corners[i];
        const fg = ctx.createRadialGradient(cx, cy, cornerR * 0.1, cx, cy, cornerR);
        fg.addColorStop(0, `rgba(224, 242, 254, ${fogAlpha.toFixed(3)})`);
        fg.addColorStop(1, 'rgba(224, 242, 254, 0)');
        ctx.fillStyle = fg;
        ctx.fillRect(cx - cornerR, cy - cornerR, cornerR * 2, cornerR * 2);
      }
    }

    // 4. Soft out-of-focus foreground exhale bubble parallax near viewport margins
    if (showExhaleBubbles) {
      const intensity = Math.min(1, (breathState === 'exhale' ? 0.55 : 0.25) + Math.max(0, (hr - 95) / 85) * 0.55);
      for (let i = 0; i < 6; i++) {
        const side = i % 2 === 0 ? 0.055 : 0.945;
        const bx = cw * side + Math.sin(timeSec * 3.1 + i * 2.1) * 18;
        const by = ch - (((timeSec * (115 + i * 22) + i * 140) % (ch + 60)) - 30);
        const br = 6 + (i % 3) * 4.5;
        ctx.strokeStyle = `rgba(186, 230, 253, ${(0.18 * intensity).toFixed(3)})`;
        ctx.fillStyle = `rgba(224, 242, 254, ${(0.06 * intensity).toFixed(3)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.restore();
  }
};
