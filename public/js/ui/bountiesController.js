import { escapeHtml } from '../util/common.js';
import { resolveBountyBoardState } from '../game/bossBounties.js';
import { bossAndLairMethods } from '../game/renderers/bossAndLairRenderer.js';
import { drawStyledArtifact } from '../game/artSprites.js';

const PORTRAIT_W = 400;
const PORTRAIT_H = 200;
const PING_DURATION_SEC = 1.85;
const BOUNTY_FRAME_INTERVAL_MS = 42; // Smooth ~24 FPS portrait animation with zero GPU jitter
const BOUNTY_ENTRANCE_DEFER_MS = 560; // Let elastic bubble-in complete before starting live canvas loop

function toTitleCase(str = '') {
  return String(str)
    .toLowerCase()
    .replace(/(^|[\s'’\-])([a-z])/g, (_, sep, ch) => `${sep}${ch.toUpperCase()}`);
}

const bossPreviewHost = {
  ...bossAndLairMethods,
  _cachedDpr: 1,
  glowStamps: {},
};

/**
 * Draw a single animated deep-sea portrait frame of one of the 12 Abyssal Guardians (v200 / v201 ROV Ping).
 */
export function renderAnimatedBossPortrait(ctx, bounty, timeSec = 0, idx = 0, { pingAgeSec = -1 } = {}) {
  if (!ctx || !bounty) return false;
  const w = ctx.canvas?.width || PORTRAIT_W;
  const h = ctx.canvas?.height || PORTRAIT_H;
  const pingActive = pingAgeSec >= 0 && pingAgeSec < PING_DURATION_SEC;
  const pingFrac = pingActive ? Math.max(0, Math.min(1, pingAgeSec / PING_DURATION_SEC)) : 0;
  const reactionIntensity = pingActive ? Math.sin(pingFrac * Math.PI) : 0;
  const t = timeSec + idx * 1.17 + (pingActive ? pingAgeSec * 1.25 : 0);
  const accent = bounty.accentColor || '#38bdf8';

  ctx.save();
  ctx.clearRect(0, 0, w, h);

  // 1. Deep-sea ROV camera backdrop with biome-tinted radial glow
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.5, 10, w * 0.5, h * 0.5, w * 0.62);
  bg.addColorStop(0, bounty.claimed ? 'rgba(16, 185, 129, 0.24)' : 'rgba(14, 34, 58, 0.92)');
  bg.addColorStop(0.55, 'rgba(6, 16, 30, 0.96)');
  bg.addColorStop(1, 'rgba(2, 7, 15, 0.99)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle biome color wash (flares brighter during interactive ROV ping!)
  ctx.save();
  ctx.globalAlpha = (bounty.claimed ? 0.16 : 0.19) + reactionIntensity * 0.22;
  const tint = ctx.createRadialGradient(w * 0.5, h * 0.46, 4, w * 0.5, h * 0.46, w * 0.48);
  tint.addColorStop(0, accent);
  tint.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // 2. Pulsing acoustic hydrophone sweep ring behind the guardian
  const pulse = (t * 0.34) % 1;
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.globalAlpha = (1 - pulse) * 0.22;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.5, 16 + pulse * (w * 0.42), 0, Math.PI * 2);
  ctx.stroke();

  // Interactive ROV Sonar Ping shockwave rings (v201)
  if (pingActive) {
    for (let k = 0; k < 2; k++) {
      const f = Math.max(0, Math.min(1, pingFrac * 1.35 - k * 0.22));
      if (f <= 0 || f >= 1) continue;
      ctx.strokeStyle = k === 0 ? '#38bdf8' : accent;
      ctx.globalAlpha = (1 - f) * 0.78;
      ctx.lineWidth = 2.6 - f * 1.4;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, 12 + f * (w * 0.48), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Subtle reticle ticks
  ctx.globalAlpha = 0.13 + reactionIntensity * 0.14;
  ctx.strokeStyle = accent;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(14, h * 0.5);
  ctx.lineTo(w - 14, h * 0.5);
  ctx.moveTo(w * 0.5, 10);
  ctx.lineTo(w * 0.5, h - 10);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // 3. Gently drifting deep-water bioluminescent marine snow
  ctx.save();
  for (let i = 0; i < 9; i++) {
    const px = ((i * 53.7 + t * (9 + (i % 3) * 4)) % (w + 20)) - 10;
    const py = ((i * 31.3 + Math.sin(t * 0.9 + i * 1.4) * 14 + h) % h);
    const pr = 1.1 + (i % 3) * 0.55;
    ctx.fillStyle = i % 2 === 0 ? accent : '#bae6fd';
    ctx.globalAlpha = 0.22 + 0.18 * Math.sin(t * 2.1 + i) + reactionIntensity * 0.15;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 4. Live fully animated Boss Guardian rendered by the game's real Boss Renderer!
  const scale = (bounty.previewScale || 8.6) * (1 + reactionIntensity * 0.08);
  const cx = w * 0.5 + Math.sin(t * 0.85) * 9;
  const cy = h * 0.5 + (bounty.previewOffsetY || 0) + Math.cos(t * 1.25) * 4.5 - reactionIntensity * 3.5;
  const blinkCycle = (t * 0.28) % 1;
  const blink = !pingActive && blinkCycle > 0.95 ? Math.sin(((blinkCycle - 0.95) / 0.05) * Math.PI) : 0;
  const facing = bounty.bossKind === 'cave-kraken' || bounty.bossKind === 'abyssal-empress' || bounty.bossKind === 'orichalcum-colossus'
    ? (Math.sin(t * 0.45) >= 0 ? 1 : -1)
    : -1;

  const previewBoss = {
    id: bounty.id,
    kind: bounty.bossKind || 'cave-kraken',
    name: bounty.displayName,
    x: 0,
    y: 0,
    vx: Math.cos(t * 0.85) * 0.6,
    vy: Math.sin(t * 1.25) * 0.3,
    angle: facing < 0 ? Math.PI + Math.sin(t * 0.9) * 0.08 : Math.sin(t * 0.9) * 0.08,
    radius: 4.5,
    hp: 4000,
    maxHp: 4000,
    phase: pingActive ? 3 : 1,
    active: true,
    defeated: false,
    hitFlash: pingActive && pingFrac < 0.09 ? 0.12 : 0,
    aiState: pingActive ? 'roar' : 'idle',
    stateTimer: 2.0,
    anim: {
      facing,
      blink,
      squashX: 1 + Math.sin(t * (pingActive ? 6.5 : 2.2)) * (pingActive ? 0.075 : 0.03),
      squashY: 1 - Math.sin(t * (pingActive ? 6.5 : 2.2)) * (pingActive ? 0.075 : 0.03),
      hurtSec: 0,
      lookX: facing * 0.55,
      lookY: Math.sin(t * 1.1) * 0.22,
      roarProgress: reactionIntensity,
      slamProgress: 0,
      tailPhase: t * (pingActive ? 4.4 : 2.6),
    },
  };

  bossPreviewHost._drawSecretLairBoss(
    ctx,
    previewBoss,
    (wx) => cx + wx * scale,
    (wy) => cy + wy * scale,
    scale,
    t
  );

  // 5. Atmospheric lens vignette around frame edges
  const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, h * 0.35, w * 0.5, h * 0.5, w * 0.65);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(2, 6, 15, 0.58)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // 6. On CLAIMED posters, float the recovered glowing Trophy Relic badge in the bottom-left corner!
  if (bounty.claimed && bounty.trophyRelicId) {
    ctx.save();
    ctx.fillStyle = 'rgba(4, 24, 24, 0.82)';
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.65)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(30, h - 26, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawStyledArtifact(ctx, { id: bounty.trophyRelicId, name: bounty.trophyName }, 30, h - 26, 13, t, {
      index: idx,
      isGrand: true,
    });
    ctx.restore();
  }

  ctx.restore();
  return true;
}

/**
 * Abyssal Wanted Bounty Board Modal Controller (v200 / v201 Interactive ROV Pings & Hunter Milestones).
 */
export function createBountiesController({
  loadCareerLogbook,
  setHomeMenuOpen,
  onBountyPing,
  onOpenOutfitter,
  els = {},
} = {}) {
  const { btnOpenBounties, bountiesModal, btnBountiesClose, bountiesGrid, bountiesSubEl, bountiesMilestonesEl } = els;

  let animRafId = 0;
  let animStartTimer = 0;
  let lastFrameMs = 0;
  let activeCanvases = [];
  let visibleCanvases = new Set();
  let portraitObserver = null;
  const pingStartById = new Map();

  function stopBountyAnimation() {
    if (animStartTimer) {
      clearTimeout(animStartTimer);
      animStartTimer = 0;
    }
    if (animRafId) {
      cancelAnimationFrame(animRafId);
      animRafId = 0;
    }
    if (portraitObserver) {
      try { portraitObserver.disconnect(); } catch (_) {}
      portraitObserver = null;
    }
    visibleCanvases.clear();
  }

  function triggerBountyPing(bountyId) {
    if (!bountyId) return false;
    pingStartById.set(bountyId, performance.now());
    onBountyPing?.(bountyId);
    const cardEl = bountiesGrid?.querySelector?.(`[data-bounty-id="${bountyId}"]`);
    if (cardEl) {
      cardEl.classList.remove('pinging');
      void cardEl.offsetWidth;
      cardEl.classList.add('pinging');
      setTimeout(() => cardEl.classList.remove('pinging'), 900);
    }
    // Start loop immediately if user pings during the entrance defer window
    if (!animRafId && bountiesModal && !bountiesModal.hidden) {
      if (animStartTimer) {
        clearTimeout(animStartTimer);
        animStartTimer = 0;
      }
      lastFrameMs = 0;
      animRafId = requestAnimationFrame(stepBountyAnimation);
    }
    return true;
  }

  function stepBountyAnimation(nowMs) {
    if (!bountiesModal || bountiesModal.hidden) {
      animRafId = 0;
      return;
    }
    const now = nowMs || performance.now();
    if (lastFrameMs && now - lastFrameMs < BOUNTY_FRAME_INTERVAL_MS) {
      animRafId = requestAnimationFrame(stepBountyAnimation);
      return;
    }
    lastFrameMs = now;
    const timeSec = now * 0.001;

    for (let i = 0; i < activeCanvases.length; i++) {
      const entry = activeCanvases[i];
      if (!entry.ctx || !entry.canvas.isConnected) continue;
      if (visibleCanvases.size > 0 && !visibleCanvases.has(entry.canvas)) continue;
      const pingStart = pingStartById.get(entry.bounty.id);
      const pingAgeSec = Number.isFinite(pingStart) ? (now - pingStart) * 0.001 : -1;
      if (pingAgeSec >= PING_DURATION_SEC) pingStartById.delete(entry.bounty.id);
      renderAnimatedBossPortrait(entry.ctx, entry.bounty, timeSec, i, { pingAgeSec });
    }

    animRafId = requestAnimationFrame(stepBountyAnimation);
  }

  function renderBountiesModal() {
    if (!bountiesGrid) return;
    stopBountyAnimation();

    const book = loadCareerLogbook?.() || {};
    const { bounties, claimedCount, totalCount, milestones } = resolveBountyBoardState(book);

    if (bountiesSubEl) {
      bountiesSubEl.textContent = `${claimedCount}/${totalCount} Claimed · Tap any portrait to ping`;
    }

    if (bountiesMilestonesEl && Array.isArray(milestones)) {
      bountiesMilestonesEl.innerHTML = milestones
        .map(
          (m) => `
          <div class="bounty-milestone-chip${m.unlocked ? ' unlocked' : ''}">
            <span class="bounty-ms-icon">${m.icon}</span>
            <span class="bounty-ms-label">${escapeHtml(m.rewardLabel)}</span>
            ${m.unlocked ? `<button type="button" class="btn tiny primary bounty-ms-equip" data-bounty-equip="1">Equip</button>` : `<span class="bounty-ms-prog">${Math.min(claimedCount, m.threshold)}/${m.threshold}</span>`}
          </div>`
        )
        .join('');
      bountiesMilestonesEl.querySelectorAll('[data-bounty-equip]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          closeBountiesModal();
          onOpenOutfitter?.();
        });
      });
    }

    bountiesGrid.innerHTML = bounties
      .map((b) => {
        const cleanName = toTitleCase(b.displayName);
        const rightMeta = b.claimed
          ? `<span class="bounty-pts claimed">🏆 ${escapeHtml(b.trophyName)}</span>`
          : `<span class="bounty-pts">${b.bountyPts.toLocaleString()} pts</span>`;

        const stampHtml = b.claimed
          ? `<span class="bounty-stamp claimed">✓ Claimed</span>`
          : `<span class="bounty-stamp wanted">Wanted</span>`;

        return `
        <article class="bounty-card${b.claimed ? ' claimed' : ''}" style="--bounty-accent:${b.accentColor};" data-bounty-id="${escapeHtml(b.id)}" tabindex="0" role="button" title="${escapeHtml(b.tale)}">
          <div class="bounty-portrait${b.claimed ? ' claimed' : ''}">
            <canvas class="bounty-boss-canvas" width="${PORTRAIT_W}" height="${PORTRAIT_H}" data-bounty-idx="${escapeHtml(b.id)}" aria-label="${escapeHtml(cleanName)} animated preview"></canvas>
            ${stampHtml}
          </div>
          <div class="bounty-meta-row">
            <h3 class="bounty-name">${escapeHtml(cleanName)}</h3>
            ${rightMeta}
          </div>
          <div class="bounty-waters">${escapeHtml(b.watersRumor)}</div>
        </article>`;
      })
      .join('');

    activeCanvases = [];
    const byId = new Map(bounties.map((b) => [b.id, b]));
    const nowSec = performance.now() * 0.001;
    bountiesGrid.querySelectorAll('canvas[data-bounty-idx]').forEach((canvas, idx) => {
      const bounty = byId.get(canvas.getAttribute('data-bounty-idx'));
      const ctx = canvas.getContext?.('2d') || null;
      if (bounty && ctx) {
        const entry = { canvas, ctx, bounty, idx, painted: false };
        activeCanvases.push(entry);
        // Paint only the first 4 above-the-fold portraits immediately so modal entrance has zero stutter
        if (idx < 4) {
          renderAnimatedBossPortrait(ctx, bounty, nowSec, idx);
          entry.painted = true;
          visibleCanvases.add(canvas);
        }
      }
    });

    if (typeof IntersectionObserver !== 'undefined' && bountiesModal) {
      const rootEl = bountiesModal.querySelector('.bounties-card') || bountiesModal;
      portraitObserver = new IntersectionObserver(
        (entries) => {
          const tSec = performance.now() * 0.001;
          for (const io of entries) {
            if (io.isIntersecting) {
              visibleCanvases.add(io.target);
              const hit = activeCanvases.find((e) => e.canvas === io.target);
              if (hit && !hit.painted) {
                renderAnimatedBossPortrait(hit.ctx, hit.bounty, tSec, hit.idx);
                hit.painted = true;
              }
            } else {
              visibleCanvases.delete(io.target);
            }
          }
        },
        { root: rootEl, rootMargin: '120px 0px' }
      );
      for (const entry of activeCanvases) {
        portraitObserver.observe(entry.canvas);
      }
    } else {
      for (const entry of activeCanvases) {
        if (!entry.painted) {
          renderAnimatedBossPortrait(entry.ctx, entry.bounty, nowSec, entry.idx);
          entry.painted = true;
        }
        visibleCanvases.add(entry.canvas);
      }
    }
  }

  bountiesGrid?.addEventListener('click', (e) => {
    const card = e.target.closest?.('.bounty-card[data-bounty-id]');
    if (!card) return;
    triggerBountyPing(card.getAttribute('data-bounty-id'));
  });
  bountiesGrid?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest?.('.bounty-card[data-bounty-id]');
    if (!card) return;
    e.preventDefault();
    triggerBountyPing(card.getAttribute('data-bounty-id'));
  });

  function openBountiesModal() {
    if (!bountiesModal) return;
    setHomeMenuOpen?.(false);
    renderBountiesModal();
    bountiesModal.hidden = false;
    lastFrameMs = 0;
    // Defer live 24fps canvas loop until the elastic bubble entrance settles smoothly
    animStartTimer = setTimeout(() => {
      animStartTimer = 0;
      if (bountiesModal && !bountiesModal.hidden && !animRafId) {
        animRafId = requestAnimationFrame(stepBountyAnimation);
      }
    }, BOUNTY_ENTRANCE_DEFER_MS);
  }

  function closeBountiesModal() {
    stopBountyAnimation();
    if (bountiesModal) bountiesModal.hidden = true;
  }

  btnOpenBounties?.addEventListener('click', openBountiesModal);
  btnBountiesClose?.addEventListener('click', closeBountiesModal);
  bountiesModal?.addEventListener('click', (e) => {
    if (e.target === bountiesModal) closeBountiesModal();
  });

  return {
    openBountiesModal,
    closeBountiesModal,
    renderBountiesModal,
    triggerBountyPing,
  };
}
