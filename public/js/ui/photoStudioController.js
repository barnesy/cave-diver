/**
 * Freeze-Frame Underwater Photo Mode Studio UI Controller (v263).
 * Extracted from main.js to keep main.js modular and cleanly below the 8,000-line ceiling.
 */
import { escapeHtml } from '../util/common.js';
import { CAMPAIGN_PLAN } from '../levels/campaign.js';
import { formatLatLng } from '../game/worldMapData.js';
import {
  PHOTO_FILTERS,
  PHOTO_FRAMES,
  getPhotoFrame,
  createPhotoModeState,
  clampPhotoModeState,
  renderPhotoSnapshot,
  detectPhotoCompositionSubject,
  stampExpeditionPostcardOverlay,
} from '../game/photoStudio.js';

export function createPhotoStudioController({
  canvas,
  renderer,
  hudPauseOverlay,
  screenHud,
  input,
  audio,
  lan,
  getMode,
  getSession,
  getEcosystem,
  getIsMultiplayer,
  setDivePaused,
  renderCurrentFrameForPhoto,
  getActiveGasName,
  getEnteredCallsign,
  showToast,
}) {
  const photoModeState = createPhotoModeState();
  const photoStudioOverlayEl = document.getElementById('photo-studio-overlay');
  const btnPausePhotoMode = document.getElementById('btn-pause-photo-mode');
  const btnPhotoExit = document.getElementById('btn-photo-exit');
  const photoZoomRangeEl = document.getElementById('photo-zoom-range');
  const photoZoomValEl = document.getElementById('photo-zoom-val');
  const btnPhotoCenter = document.getElementById('btn-photo-center');
  const btnPhotoGrid = document.getElementById('btn-photo-grid');
  const btnPhotoFrame = document.getElementById('btn-photo-frame');
  const btnPhotoSave = document.getElementById('btn-photo-save');
  const photoFilterPillsEl = document.getElementById('photo-filter-pills');

  function syncPhotoStudioUi() {
    clampPhotoModeState(photoModeState);
    if (photoZoomRangeEl) photoZoomRangeEl.value = String(Math.round(photoModeState.zoom * 100));
    if (photoZoomValEl) photoZoomValEl.textContent = `${photoModeState.zoom.toFixed(2)}×`;
    if (btnPhotoGrid) btnPhotoGrid.classList.toggle('active', photoModeState.showGrid);
    if (btnPhotoFrame) {
      const fr = getPhotoFrame(photoModeState.frameId);
      btnPhotoFrame.textContent = `🖼 ${fr.shortName}`;
    }
    if (photoFilterPillsEl) {
      photoFilterPillsEl.querySelectorAll('button[data-photo-filter]').forEach((btn) => {
        const active = btn.getAttribute('data-photo-filter') === photoModeState.filterId;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-checked', active ? 'true' : 'false');
      });
    }
  }

  if (photoFilterPillsEl) {
    photoFilterPillsEl.innerHTML = PHOTO_FILTERS.map(
      (f) => `<button type="button" class="photo-filter-pill${f.id === photoModeState.filterId ? ' active' : ''}" data-photo-filter="${f.id}" role="radio" aria-checked="${f.id === photoModeState.filterId}">${escapeHtml(f.shortName)}</button>`
    ).join('');
    photoFilterPillsEl.querySelectorAll('button[data-photo-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fid = btn.getAttribute('data-photo-filter');
        if (!fid) return;
        photoModeState.filterId = fid;
        syncPhotoStudioUi();
      });
    });
  }

  function setPhotoModeActive(nextActive) {
    const want = Boolean(nextActive);
    const session = getSession();
    if (want) {
      if (getMode() !== 'diving' || !session || session.endedState) return false;
      if (getIsMultiplayer() && lan.getPeers().length > 0) {
        showToast('📸 Photo Mode freezes time — available on solo dives!', 2.2);
        return false;
      }
      photoModeState.active = true;
      photoModeState.panX = 0;
      photoModeState.panY = 0;
      photoModeState.zoom = 1.0;
      photoModeState.hideOverlayForCapture = false;
      setDivePaused(true);
      input?.resetAll?.();
      audio.resetEnvironmentFilter();
      if (hudPauseOverlay) hudPauseOverlay.hidden = true;
      if (screenHud) screenHud.hidden = true;
      if (photoStudioOverlayEl) photoStudioOverlayEl.hidden = false;
      syncPhotoStudioUi();
      return true;
    }
    if (!photoModeState.active) return false;
    photoModeState.active = false;
    photoModeState.hideOverlayForCapture = false;
    setDivePaused(false);
    if (photoStudioOverlayEl) photoStudioOverlayEl.hidden = true;
    if (screenHud && getMode() === 'diving') screenHud.hidden = false;
    return true;
  }

  function savePhotoStudioSnapshot() {
    const session = getSession();
    const ecosystem = getEcosystem();
    if (!photoModeState.active || !session || !canvas) return false;
    const wasGrid = photoModeState.showGrid;
    const prevHide = photoModeState.hideOverlayForCapture;
    photoModeState.showGrid = false;
    photoModeState.hideOverlayForCapture = true;
    try {
      renderCurrentFrameForPhoto(photoModeState);
      const outCanvas = document.createElement('canvas');
      outCanvas.width = 1200;
      outCanvas.height = 675;
      const outCtx = outCanvas.getContext('2d');
      const verMeta = document.querySelector('meta[name="app-version"]')?.content || '263';
      const comp = detectPhotoCompositionSubject({
        level: session.level,
        diver: session.diver,
        camX: renderer.camX,
        camY: renderer.camY,
        ecosystem,
        stories: session.stories,
      });
      if (comp) {
        if (!session._photoCompKinds) session._photoCompKinds = new Set();
        if (!session._photoCompKinds.has(comp.kind)) {
          session._photoCompKinds.add(comp.kind);
          session.photoCompositionBonus = (session.photoCompositionBonus || 0) + comp.bonusPts;
        }
      }
      const sitePlanSlot = CAMPAIGN_PLAN.find((s) => s.id === session.level?.id);
      const gpsLabel =
        sitePlanSlot && Number.isFinite(sitePlanSlot.lat) && Number.isFinite(sitePlanSlot.lng)
          ? formatLatLng(sitePlanSlot.lat, sitePlanSlot.lng)
          : '';
      const siteName = session.level?.name || 'Expedition Site';
      const depthM = session.diveState?.depthM || session.diver?.y || 0;
      const diverName = session.diverName || getEnteredCallsign() || 'Diver';
      renderPhotoSnapshot(outCtx, canvas, {
        width: 1200,
        height: 675,
        filterId: photoModeState.filterId,
        frameId: photoModeState.frameId,
        siteName,
        depthM,
        gasLabel: getActiveGasName(session.diveState?.activeGasId || 'EAN32'),
        diverName,
        weatherLabel: session.weather?.label || '',
        version: `v${verMeta}`,
      });
      if (photoModeState.frameId !== 'clean') {
        stampExpeditionPostcardOverlay(outCtx, 1200, 675, {
          siteName,
          depthM,
          diverName,
          gpsLabel,
          subjectLabel: comp?.label || '',
          topOffset: photoModeState.frameId === 'cinema' ? Math.round(675 * 0.11) + 14 : undefined,
        });
      }
      const dataUrl = outCanvas.toDataURL('image/png');
      const slug = String(session.level?.id || 'dive').replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `techno-dive-photo-${slug}-${Math.round(depthM)}m.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      audio.playCameraShutter(true, false);
      showToast(comp ? `${comp.badge} · Postcard saved!` : '📸 High-res Expedition Postcard saved as PNG!', 2.6);
    } catch {
      showToast('Could not export photograph on this browser.', 2.0);
    } finally {
      photoModeState.showGrid = wasGrid;
      photoModeState.hideOverlayForCapture = prevHide;
    }
    return true;
  }

  btnPausePhotoMode?.addEventListener('click', () => setPhotoModeActive(true));
  btnPhotoExit?.addEventListener('click', () => setPhotoModeActive(false));
  photoZoomRangeEl?.addEventListener('input', () => {
    photoModeState.zoom = (Number(photoZoomRangeEl.value) || 100) / 100;
    syncPhotoStudioUi();
  });
  btnPhotoCenter?.addEventListener('click', () => {
    photoModeState.panX = 0;
    photoModeState.panY = 0;
    photoModeState.zoom = 1.0;
    syncPhotoStudioUi();
  });
  btnPhotoGrid?.addEventListener('click', () => {
    photoModeState.showGrid = !photoModeState.showGrid;
    syncPhotoStudioUi();
  });
  btnPhotoFrame?.addEventListener('click', () => {
    const idx = PHOTO_FRAMES.findIndex((f) => f.id === photoModeState.frameId);
    photoModeState.frameId = PHOTO_FRAMES[(idx + 1) % PHOTO_FRAMES.length].id;
    syncPhotoStudioUi();
  });
  btnPhotoSave?.addEventListener('click', () => savePhotoStudioSnapshot());

  // Canvas pointer drag-pan & scroll-wheel zoom while Photo Mode Studio is active
  let photoDragPointerId = null;
  let photoDragLastX = 0;
  let photoDragLastY = 0;
  canvas?.addEventListener('pointerdown', (e) => {
    if (!photoModeState.active) return;
    photoDragPointerId = e.pointerId;
    photoDragLastX = e.clientX;
    photoDragLastY = e.clientY;
    try { canvas.setPointerCapture?.(e.pointerId); } catch {}
  });
  canvas?.addEventListener('pointermove', (e) => {
    if (!photoModeState.active || photoDragPointerId !== e.pointerId) return;
    const dx = e.clientX - photoDragLastX;
    const dy = e.clientY - photoDragLastY;
    photoDragLastX = e.clientX;
    photoDragLastY = e.clientY;
    const pxPerM = Math.max(12, (renderer.pxPerM || 28) * photoModeState.zoom);
    photoModeState.panX -= dx / pxPerM;
    photoModeState.panY -= dy / pxPerM;
    clampPhotoModeState(photoModeState);
  });
  const endPhotoDrag = (e) => {
    if (photoDragPointerId === e.pointerId) {
      photoDragPointerId = null;
      try { canvas?.releasePointerCapture?.(e.pointerId); } catch {}
    }
  };
  canvas?.addEventListener('pointerup', endPhotoDrag);
  canvas?.addEventListener('pointercancel', endPhotoDrag);
  canvas?.addEventListener('wheel', (e) => {
    if (!photoModeState.active) return;
    e.preventDefault();
    photoModeState.zoom += e.deltaY < 0 ? 0.1 : -0.1;
    syncPhotoStudioUi();
  }, { passive: false });

  return {
    photoModeState,
    syncPhotoStudioUi,
    setPhotoModeActive,
    savePhotoStudioSnapshot,
  };
}
