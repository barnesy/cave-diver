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

  let draft = loadPlayerAvatar();
  let previewView = 'front';
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
      const waterY = Math.round(h * 0.74);
      const dockY = Math.round(h * 0.71);

      // Sunlit tropical sky & shimmering turquoise water backdrop
      const sky = ctx.createLinearGradient(0, 0, 0, waterY);
      sky.addColorStop(0, '#0284c7');
      sky.addColorStop(0.65, '#38bdf8');
      sky.addColorStop(1, '#bae6fd');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, waterY);

      const sea = ctx.createLinearGradient(0, waterY, 0, h);
      sea.addColorStop(0, '#06b6d4');
      sea.addColorStop(1, '#0e7490');
      ctx.fillStyle = sea;
      ctx.fillRect(0, waterY, w, h - waterY);

      // Gentle sunlit water ripples
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.35)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) {
        const rx = ((i * 86 + Math.sin(t * 2 + i) * 14) % w + w) % w;
        const ry = waterY + 12 + i * 14;
        ctx.beginPath();
        ctx.moveTo(rx - 22, ry);
        ctx.lineTo(rx + 22, ry);
        ctx.stroke();
      }

      // Wooden sunlit launch dock on the left-center
      const dockEndX = Math.round(w * 0.62);
      ctx.fillStyle = '#5c2d0c';
      ctx.fillRect(28, dockY, 10, h - dockY);
      ctx.fillRect(dockEndX - 18, dockY, 10, h - dockY);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(0, dockY - 6, dockEndX, 11);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(0, dockY - 6, dockEndX, 3.5);

      // Hyper-real beach umbrella planted at far left of dock
      drawBeachUmbrella(ctx, 42, dockY - 4, 44, 0, -0.08);

      // Either play the live Jump-In preview OR groove live on the sunlit dock!
      const jumpElapsed = t - previewJumpStartedAt;
      const jumping = jumpElapsed >= 0 && jumpElapsed < 3.65;
      if (jumping) {
        drawPlayerAvatarSiteJump(ctx, 74, dockEndX - 6, dockY - 5, waterY + 4, 1, 56, t, {
          forcedElapsed: jumpElapsed,
          avatar: draft,
        });
      } else {
        const px = Math.round(dockEndX * 0.56);
        const py = dockY - 5;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
        ctx.beginPath();
        ctx.ellipse(px, py + 2, 26, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        const spec = buildTopsideSpecFromAvatar(draft, {
          id: 888099,
          role: 'party-dance',
          danceMove: previewView === 'side' ? 'disco' : previewView === 'back' ? 'hula' : 'shuffle',
          view: previewView,
          seed: 11,
          facing: 1,
          hypeEnergy: 0.4,
        });
        drawTopsidePerson(ctx, px, py, 74, t, spec);
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
