/**
 * Interactive Diver Avatar Creator Controller (v296)
 *
 * Allows first-time & returning divers to customize their topside avatar
 * (Male/Female, body shape, skin tone, hair color, bathing suit style & colors),
 * spin Front / Side / Back, preview their live dock jump-in animation, and save
 * so their exact avatar appears across topside docks, boats, site jump-ins & victory dances.
 */

import {
  AVATAR_SKIN_PRESETS,
  AVATAR_HAIR_PRESETS,
  AVATAR_FEMALE_BODIES,
  AVATAR_MALE_BODIES,
  AVATAR_FEMALE_TOP_STYLES,
  AVATAR_FEMALE_SWIMS,
  AVATAR_MALE_SWIMS,
  loadPlayerAvatar,
  savePlayerAvatar,
  normalizePlayerAvatar,
  buildTopsideSpecFromAvatar,
  triggerAvatarSiteJump,
} from '../game/playerAvatar.js';
import {
  drawTopsidePerson,
  drawPlayerAvatarSiteJump,
  drawBeachUmbrella,
} from '../game/renderers/topsidePeopleRenderer.js';

export function createAvatarCreatorController({
  setHomeMenuOpen = null,
  showToast = null,
  getActiveLevelId = () => '',
  onAvatarSaved = null,
} = {}) {
  const modalEl = document.getElementById('avatar-creator-modal');
  const closeBtn = document.getElementById('btn-avatar-creator-close');
  const saveBtn = document.getElementById('btn-avatar-creator-save');
  const jumpTestBtn = document.getElementById('btn-avatar-test-jump');
  const cycleDanceBtn = document.getElementById('btn-avatar-cycle-dance');
  const previewCanvas = document.getElementById('avatar-creator-canvas');
  const viewBtns = Array.from(document.querySelectorAll('[data-avatar-view]'));
  const genderBtns = Array.from(document.querySelectorAll('[data-avatar-gender]'));
  const bodyHost = document.getElementById('avatar-body-pills');
  const skinHost = document.getElementById('avatar-skin-swatches');
  const hairHost = document.getElementById('avatar-hair-swatches');
  const topSection = document.getElementById('avatar-top-section');
  const topHost = document.getElementById('avatar-top-pills');
  const swimLabelEl = document.getElementById('avatar-swim-label');
  const swimHost = document.getElementById('avatar-swim-swatches');

  const firstPlayStrip = document.getElementById('first-play-avatar-strip');
  const firstPlayMiniCanvas = document.getElementById('first-play-avatar-mini');
  const menuOpenBtn = document.getElementById('btn-home-open-avatar');

  const PREVIEW_DANCES = [
    { id: 'kpop-hip-sway', label: '✨ K-Pop Sway' },
    { id: 'kpop-point', label: '💜 K-Pop Point' },
    { id: 'tiktok-wave', label: '🌊 TikTok Wave' },
    { id: 'tiktok-hip-dip', label: '🔥 Hip Dip' },
    { id: 'salsa', label: '💃 Salsa' },
    { id: 'disco', label: '🕺 Disco' },
    { id: 'twerk', label: '🍑 Twerk' },
  ];

  let draft = loadPlayerAvatar();
  let previewView = 'front';
  let previewDanceIdx = 0;
  let previewJumpStartedAt = -99;
  let rafId = 0;

  function renderMiniStripIcon() {
    if (!firstPlayMiniCanvas) return;
    const ctx = firstPlayMiniCanvas.getContext?.('2d');
    if (!ctx) return;
    const w = firstPlayMiniCanvas.width;
    const h = firstPlayMiniCanvas.height;
    ctx.clearRect(0, 0, w, h);
    const av = loadPlayerAvatar();
    const spec = buildTopsideSpecFromAvatar(av, {
      id: 888001,
      role: 'party-dance',
      danceMove: 'disco',
      view: 'front',
      seed: 11,
      facing: 1,
    });
    drawTopsidePerson(ctx, w * 0.5, h - 4, h * 0.44, 1.4, spec);
  }

  function syncFirstPlayStrip() {
    const saved = loadPlayerAvatar();
    if (firstPlayStrip) {
      firstPlayStrip.hidden = Boolean(saved.configured);
      if (!saved.configured) renderMiniStripIcon();
    }
  }

  function renderControls() {
    for (const btn of genderBtns) {
      const g = btn.getAttribute('data-avatar-gender');
      const active = draft.gender === g;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    for (const btn of viewBtns) {
      const v = btn.getAttribute('data-avatar-view');
      const active = previewView === v;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    // Body type pills
    if (bodyHost) {
      const bodies = draft.gender === 'male' ? AVATAR_MALE_BODIES : AVATAR_FEMALE_BODIES;
      bodyHost.innerHTML = bodies
        .map((b) => `<button type="button" class="av-pill${draft.bodyType === b.id ? ' active' : ''}" data-av-body="${b.id}">${b.label}</button>`)
        .join('');
    }

    // Skin swatches
    if (skinHost) {
      skinHost.innerHTML = AVATAR_SKIN_PRESETS
        .map((sk, idx) => `<button type="button" class="av-swatch${draft.skinIdx === idx ? ' active' : ''}" data-av-skin="${idx}" title="${sk.label}" aria-label="${sk.label}" style="background:${sk.skin}"></button>`)
        .join('');
    }

    // Hair swatches
    if (hairHost) {
      hairHost.innerHTML = AVATAR_HAIR_PRESETS
        .map((hr, idx) => `<button type="button" class="av-swatch${draft.hairIdx === idx ? ' active' : ''}" data-av-hair="${idx}" title="${hr.label}" aria-label="${hr.label}" style="background:${hr.color}"></button>`)
        .join('');
    }

    // Female swimsuit cut / top styles
    if (topSection && topHost) {
      const showTop = draft.gender === 'female';
      topSection.hidden = !showTop;
      if (showTop) {
        topHost.innerHTML = AVATAR_FEMALE_TOP_STYLES
          .map((t) => `<button type="button" class="av-pill${draft.topStyle === t.id ? ' active' : ''}" data-av-top="${t.id}">${t.label}</button>`)
          .join('');
      }
    }

    // Swimsuit colors (female) OR boardshorts/rashguard/shirt styles (male)
    if (swimHost) {
      const isMale = draft.gender === 'male';
      if (swimLabelEl) swimLabelEl.textContent = isMale ? 'Swimwear & Colors' : 'Bathing Suit Color';
      const list = isMale ? AVATAR_MALE_SWIMS : AVATAR_FEMALE_SWIMS;
      swimHost.innerHTML = list
        .map((sw, idx) => {
          const bg = `linear-gradient(135deg, ${sw.primary} 0%, ${sw.primary} 62%, ${sw.accent} 62%, ${sw.accent} 100%)`;
          return `<button type="button" class="av-swim-chip${draft.swimIdx === idx ? ' active' : ''}" data-av-swim="${idx}" title="${sw.label}"><span class="av-swim-dot" style="background:${bg}"></span><span>${sw.label}</span></button>`;
        })
        .join('');
    }
  }

  function renderPreviewFrame(nowMs) {
    if (!modalEl || modalEl.hidden) {
      rafId = 0;
      return;
    }
    const ctx = previewCanvas?.getContext?.('2d');
    if (ctx && previewCanvas) {
      const w = previewCanvas.width;
      const h = previewCanvas.height;
      const t = nowMs * 0.001;
      const waterY = Math.round(h * 0.78);
      const dockY = Math.round(h * 0.74);

      // Sunlit tropical sky & shimmering turquoise water backdrop
      const sky = ctx.createLinearGradient(0, 0, 0, waterY);
      sky.addColorStop(0, '#0284c7');
      sky.addColorStop(0.62, '#38bdf8');
      sky.addColorStop(1, '#bae6fd');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, waterY);

      // Warm golden sun halo in upper right sky
      ctx.fillStyle = 'rgba(254, 240, 138, 0.20)';
      ctx.beginPath();
      ctx.arc(w * 0.82, h * 0.17, Math.min(w, h) * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(w * 0.82, h * 0.17, Math.min(w, h) * 0.068, 0, Math.PI * 2);
      ctx.fill();

      const sea = ctx.createLinearGradient(0, waterY, 0, h);
      sea.addColorStop(0, '#06b6d4');
      sea.addColorStop(1, '#0e7490');
      ctx.fillStyle = sea;
      ctx.fillRect(0, waterY, w, h - waterY);

      // Gentle sunlit water ripples
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.38)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 5; i++) {
        const rx = ((i * 98 + Math.sin(t * 1.9 + i) * 16) % w + w) % w;
        const ry = waterY + 12 + i * 16;
        ctx.beginPath();
        ctx.moveTo(rx - 26, ry);
        ctx.lineTo(rx + 26, ry);
        ctx.stroke();
      }

      // Wooden sunlit launch dock on the left-center (plenty of clear water on the right for the fluid dive!)
      const dockEndX = Math.round(w * 0.56);
      ctx.fillStyle = '#5c2d0c';
      ctx.fillRect(36, dockY, 12, h - dockY);
      ctx.fillRect(dockEndX - 22, dockY, 12, h - dockY);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(0, dockY - 7, dockEndX, 13);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(0, dockY - 7, dockEndX, 4);

      // Hyper-real beach umbrella planted at far left of dock
      drawBeachUmbrella(ctx, 56, dockY - 5, 58, 0, -0.08);

      // Either play the fluid 4.0s Jump-In choreography OR showcase the larger dancing avatar!
      const jumpElapsed = t - previewJumpStartedAt;
      const jumping = jumpElapsed >= 0 && jumpElapsed < 4.0;
      if (jumping) {
        drawPlayerAvatarSiteJump(ctx, 82, dockEndX - 8, dockY - 6, waterY + 4, 1, 62, t, {
          forcedElapsed: jumpElapsed,
          avatar: draft,
        });
      } else {
        const px = Math.round(dockEndX * 0.58);
        const py = dockY - 6;
        const danceMove = PREVIEW_DANCES[previewDanceIdx % PREVIEW_DANCES.length]?.id || 'kpop-hip-sway';
        const spec = buildTopsideSpecFromAvatar(draft, {
          id: 888099,
          role: 'party-dance',
          danceMove,
          view: previewView,
          seed: 11,
          facing: 1,
          hypeEnergy: 0.35,
        });
        drawTopsidePerson(ctx, px, py, Math.round(h * 0.275), t, spec);
      }
    }
    rafId = requestAnimationFrame(renderPreviewFrame);
  }

  function openAvatarCreator() {
    if (!modalEl) return;
    setHomeMenuOpen?.(false);
    draft = loadPlayerAvatar();
    previewJumpStartedAt = -99;
    renderControls();
    modalEl.hidden = false;
    if (!rafId && typeof requestAnimationFrame !== 'undefined') {
      rafId = requestAnimationFrame(renderPreviewFrame);
    }
  }

  function closeAvatarCreator() {
    if (!modalEl) return;
    modalEl.hidden = true;
    if (rafId && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function isOpen() {
    return Boolean(modalEl && !modalEl.hidden);
  }

  // Wire UI event handlers
  firstPlayStrip?.addEventListener('click', openAvatarCreator);
  menuOpenBtn?.addEventListener('click', openAvatarCreator);
  closeBtn?.addEventListener('click', closeAvatarCreator);
  modalEl?.addEventListener('click', (e) => {
    if (e.target === modalEl) closeAvatarCreator();
  });

  for (const btn of genderBtns) {
    btn.addEventListener('click', () => {
      const g = btn.getAttribute('data-avatar-gender') === 'male' ? 'male' : 'female';
      if (draft.gender === g) return;
      draft = normalizePlayerAvatar({
        ...draft,
        gender: g,
        bodyType: g === 'male' ? 'athletic-m' : 'hourglass',
        swimIdx: 0,
      });
      renderControls();
    });
  }

  for (const btn of viewBtns) {
    btn.addEventListener('click', () => {
      previewView = btn.getAttribute('data-avatar-view') || 'front';
      previewJumpStartedAt = -99;
      renderControls();
    });
  }

  bodyHost?.addEventListener('click', (e) => {
    const b = e.target?.closest?.('[data-av-body]');
    if (!b) return;
    draft = normalizePlayerAvatar({ ...draft, bodyType: b.getAttribute('data-av-body') });
    renderControls();
  });

  skinHost?.addEventListener('click', (e) => {
    const b = e.target?.closest?.('[data-av-skin]');
    if (!b) return;
    draft = normalizePlayerAvatar({ ...draft, skinIdx: Number(b.getAttribute('data-av-skin')) });
    renderControls();
  });

  hairHost?.addEventListener('click', (e) => {
    const b = e.target?.closest?.('[data-av-hair]');
    if (!b) return;
    draft = normalizePlayerAvatar({ ...draft, hairIdx: Number(b.getAttribute('data-av-hair')) });
    renderControls();
  });

  topHost?.addEventListener('click', (e) => {
    const b = e.target?.closest?.('[data-av-top]');
    if (!b) return;
    draft = normalizePlayerAvatar({ ...draft, topStyle: b.getAttribute('data-av-top') });
    renderControls();
  });

  swimHost?.addEventListener('click', (e) => {
    const b = e.target?.closest?.('[data-av-swim]');
    if (!b) return;
    draft = normalizePlayerAvatar({ ...draft, swimIdx: Number(b.getAttribute('data-av-swim')) });
    renderControls();
  });

  cycleDanceBtn?.addEventListener('click', () => {
    previewJumpStartedAt = -99;
    previewDanceIdx = (previewDanceIdx + 1) % PREVIEW_DANCES.length;
    cycleDanceBtn.textContent = PREVIEW_DANCES[previewDanceIdx].label;
  });

  jumpTestBtn?.addEventListener('click', () => {
    previewJumpStartedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
  });

  saveBtn?.addEventListener('click', () => {
    const saved = savePlayerAvatar({ ...draft, configured: true });
    syncFirstPlayStrip();
    closeAvatarCreator();
    // Immediately let your newly created diver sprint out and jump into the live water!
    triggerAvatarSiteJump(getActiveLevelId?.() || '');
    onAvatarSaved?.(saved);
    showToast?.('✨ Diver Avatar saved! Watch them jump in!', { critical: true });
  });

  syncFirstPlayStrip();

  return {
    openAvatarCreator,
    closeAvatarCreator,
    isOpen,
    syncFirstPlayStrip,
  };
}
