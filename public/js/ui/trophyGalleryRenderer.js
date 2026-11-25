import { drawStyledArtifact } from '../game/artSprites.js';
import { drawMiniDiverAvatar, resolveDiverLiveryPalette } from '../game/rigLivery.js';

/**
 * Living Underwater Relic Museum Diorama Renderer (v213).
 * Renders an illuminated sunken limestone cathedral gallery with up to 5 carved stone
 * pedestals showcasing claimed Boss Trophies & top recovered relics alongside your custom
 * diver hovering in the gallery. Returns clickable pedestal hitboxes for Curator Inspector!
 */
export function drawTrophyGalleryDiorama(
  ctx,
  w,
  h,
  artifacts = [],
  { livery = null, hasCcr = false, pinnedId = '', timeSec = 0 } = {}
) {
  if (!ctx || !w || !h) return [];
  const featured = Array.isArray(artifacts) ? artifacts.slice(0, 5) : [];
  const hitboxes = [];

  ctx.save();
  ctx.clearRect(0, 0, w, h);

  // Sunken cathedral water backdrop
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#041428');
  bg.addColorStop(0.55, '#07223a');
  bg.addColorStop(1, '#020914');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Cathedral limestone arches in the background
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.10)';
  ctx.lineWidth = 2;
  for (let a = 0; a < 4; a++) {
    const ax = w * (0.14 + a * 0.24);
    ctx.beginPath();
    ctx.arc(ax, h * 0.72, w * 0.14, Math.PI, 0);
    ctx.stroke();
  }

  // Soft overhead volumetric gallery spotlights
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < Math.max(3, featured.length); i++) {
    const lx = w * (0.26 + i * 0.155);
    const sway = Math.sin(timeSec * 0.7 + i * 1.4) * 8;
    const sg = ctx.createLinearGradient(lx + sway, 0, lx, h * 0.88);
    sg.addColorStop(0, 'rgba(186, 230, 253, 0.15)');
    sg.addColorStop(0.7, 'rgba(56, 189, 248, 0.05)');
    sg.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(lx + sway - 14, 0);
    ctx.lineTo(lx + sway + 14, 0);
    ctx.lineTo(lx + 34, h * 0.88);
    ctx.lineTo(lx - 34, h * 0.88);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Floor terrace
  const floorY = h * 0.79;
  const fg = ctx.createLinearGradient(0, floorY, 0, h);
  fg.addColorStop(0, '#0f2338');
  fg.addColorStop(1, '#030a14');
  ctx.fillStyle = fg;
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.24)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, floorY);
  ctx.lineTo(w, floorY);
  ctx.stroke();

  // Floating ambient dust & rising bubbles
  for (let i = 0; i < 18; i++) {
    const px = (((i * 63 + timeSec * (7 + (i % 3) * 3)) % w) + w) % w;
    const py = (((i * 39 - timeSec * (8 + (i % 4) * 3)) % floorY) + floorY) % floorY;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(253, 224, 71, 0.30)' : 'rgba(186, 230, 253, 0.22)';
    ctx.beginPath();
    ctx.arc(px, py, 1.1 + (i % 2) * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hovering Curator Diver on the left side admiring the Trophy Gallery
  if (livery) {
    const pal = resolveDiverLiveryPalette(livery);
    const dvW = 112;
    const dvH = 68;
    const dvX = 14;
    const dvY = h * 0.27 + Math.sin(timeSec * 1.6) * 4;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect?.(dvX, dvY, dvW, dvH, 12);
    ctx.clip?.();
    ctx.translate(dvX, dvY);
    drawMiniDiverAvatar(ctx, dvW, dvH, livery, { hasCcr });
    ctx.restore();
    ctx.strokeStyle = pal.setSynergy ? pal.setSynergy.color : 'rgba(56, 189, 248, 0.36)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect?.(dvX, dvY, dvW, dvH, 12);
    ctx.stroke();
    ctx.font = '700 8.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText('CURATOR RIG', dvX + dvW * 0.5, dvY + dvH + 11);
  }

  // Header kicker
  ctx.font = '800 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#fde047';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(
    featured.length > 0
      ? `🏛️ LIVING TROPHY GALLERY · TAP ANY PEDESTAL TO INSPECT`
      : `🏛️ LIVING TROPHY GALLERY · RECOVER RELICS & BOSS TROPHIES TO FILL PEDESTALS`,
    12,
    8
  );

  // Render up to 5 illuminated museum pedestals
  const galleryLeft = livery ? 142 : 28;
  const galleryW = Math.max(120, w - galleryLeft - 18);
  const slotCount = Math.max(3, Math.min(5, featured.length || 3));
  const stepX = galleryW / slotCount;

  for (let i = 0; i < slotCount; i++) {
    const cx = galleryLeft + stepX * (i + 0.5);
    const pedW = Math.min(62, stepX * 0.62);
    const pedH = 26 + (i % 2 === 0 ? 8 : 0);
    const pedTop = floorY - pedH;
    const item = featured[i] || null;
    const isPinned = Boolean(item && pinnedId && item.id === pinnedId);
    const isGrand = Boolean(item && ((item.scale || 1) >= 1.35 || (item.points || 0) >= 1500));

    // Carved stone pedestal
    const pg = ctx.createLinearGradient(cx - pedW * 0.5, pedTop, cx + pedW * 0.5, floorY);
    pg.addColorStop(0, '#334155');
    pg.addColorStop(0.5, '#1e293b');
    pg.addColorStop(1, '#0f172a');
    ctx.fillStyle = pg;
    ctx.fillRect(cx - pedW * 0.5, pedTop, pedW, pedH);
    ctx.fillStyle = isPinned ? '#facc15' : isGrand ? '#fde047' : '#64748b';
    ctx.fillRect(cx - pedW * 0.56, pedTop - 4, pedW * 1.12, 4);

    if (item) {
      const bobY = pedTop - 26 + Math.sin(timeSec * 2.1 + i * 1.3) * 3.2;
      // Soft halo behind artifact
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const hg = ctx.createRadialGradient(cx, bobY, 3, cx, bobY, 30);
      hg.addColorStop(0, isPinned || isGrand ? 'rgba(250, 204, 21, 0.42)' : 'rgba(56, 189, 248, 0.34)');
      hg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(cx, bobY, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      drawStyledArtifact(ctx, item, cx, bobY, isGrand ? 22 : 18, timeSec + i * 0.8, {
        index: i,
        isGrand,
      });

      ctx.font = '700 9px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = isPinned ? '#fde047' : '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const rawName = String(item.name || 'Relic').trim();
      const maxChars = slotCount <= 3 ? 20 : 15;
      const shortName = rawName.length > maxChars ? `${rawName.slice(0, maxChars - 1).trimEnd()}…` : rawName;
      ctx.fillText(`${isPinned ? '★ ' : ''}${shortName}`, cx, floorY + 13);

      hitboxes.push({ x: cx, y: bobY, r: 30, item });
    } else {
      ctx.font = '700 8.5px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('EMPTY', cx, pedTop - 16);
    }
  }

  ctx.restore();
  return hitboxes;
}
