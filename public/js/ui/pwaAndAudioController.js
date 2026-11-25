/**
 * PWA Service Worker Lifecycle, Screen Wake Lock, Install Prompt &
 * Spatial 3D Underwater Audio Mixer Controller (modularized from main.js in v212).
 */

const AUDIO_MIXER_PREF_KEY = 'caveDiverAudioMix_v1';

export function createAudioMixerController({
  audio,
  setHomeMenuOpen,
  setHudMenuOpen,
  showToast,
}) {
  const audioMixerModalEl = document.getElementById('audio-mixer-modal');
  const btnOpenAudioMixer = document.getElementById('btn-open-audio-mixer');
  const btnHudAudioMixer = document.getElementById('btn-hud-audio-mixer');
  const btnAudioMixerClose = document.getElementById('btn-audio-mixer-close');
  const btnMixerDone = document.getElementById('btn-mixer-done');
  const btnMixerTest = document.getElementById('btn-mixer-test');
  const mixerSfxRange = document.getElementById('mixer-sfx-range');
  const mixerAmbRange = document.getElementById('mixer-amb-range');
  const mixerRadioRange = document.getElementById('mixer-radio-range');
  const mixerSfxVal = document.getElementById('mixer-sfx-val');
  const mixerAmbVal = document.getElementById('mixer-amb-val');
  const mixerRadioVal = document.getElementById('mixer-radio-val');
  const mixerSpatialCheck = document.getElementById('mixer-spatial-check');
  const mixerHapticsCheck = document.getElementById('mixer-haptics-check');

  try {
    const rawMix = localStorage.getItem(AUDIO_MIXER_PREF_KEY);
    if (rawMix) {
      const parsedMix = JSON.parse(rawMix);
      if (parsedMix && typeof parsedMix === 'object') {
        audio.setMixerSettings(parsedMix);
      }
    }
  } catch {}

  function saveAudioMixerPrefs() {
    try {
      localStorage.setItem(AUDIO_MIXER_PREF_KEY, JSON.stringify(audio.getMixerSettings()));
    } catch {}
  }

  function syncAudioMixerModalUi() {
    const s = audio.getMixerSettings();
    const sfxPct = Math.round(s.sfxVolume * 100);
    const ambPct = Math.round(s.ambienceVolume * 100);
    const radPct = Math.round(s.radioVolume * 100);
    if (mixerSfxRange) mixerSfxRange.value = String(sfxPct);
    if (mixerAmbRange) mixerAmbRange.value = String(ambPct);
    if (mixerRadioRange) mixerRadioRange.value = String(radPct);
    if (mixerSfxVal) mixerSfxVal.textContent = `${sfxPct}%`;
    if (mixerAmbVal) mixerAmbVal.textContent = `${ambPct}%`;
    if (mixerRadioVal) mixerRadioVal.textContent = `${radPct}%`;
    if (mixerSpatialCheck) mixerSpatialCheck.checked = Boolean(s.spatialEnabled);
    if (mixerHapticsCheck) mixerHapticsCheck.checked = Boolean(s.hapticsEnabled);
  }

  function openAudioMixerModal() {
    if (!audioMixerModalEl) return;
    setHomeMenuOpen(false);
    setHudMenuOpen(false);
    syncAudioMixerModalUi();
    audioMixerModalEl.hidden = false;
  }

  function closeAudioMixerModal() {
    if (audioMixerModalEl) audioMixerModalEl.hidden = true;
  }

  btnOpenAudioMixer?.addEventListener('click', openAudioMixerModal);
  btnHudAudioMixer?.addEventListener('click', openAudioMixerModal);
  btnAudioMixerClose?.addEventListener('click', closeAudioMixerModal);
  btnMixerDone?.addEventListener('click', closeAudioMixerModal);
  audioMixerModalEl?.addEventListener('click', (e) => {
    if (e.target === audioMixerModalEl) closeAudioMixerModal();
  });
  mixerSfxRange?.addEventListener('input', () => {
    const v = Math.max(0, Math.min(100, Number(mixerSfxRange.value) || 0));
    audio.setMixerSettings({ sfxVolume: v / 100 });
    if (mixerSfxVal) mixerSfxVal.textContent = `${v}%`;
    saveAudioMixerPrefs();
  });
  mixerAmbRange?.addEventListener('input', () => {
    const v = Math.max(0, Math.min(100, Number(mixerAmbRange.value) || 0));
    audio.setMixerSettings({ ambienceVolume: v / 100 });
    if (mixerAmbVal) mixerAmbVal.textContent = `${v}%`;
    saveAudioMixerPrefs();
  });
  mixerRadioRange?.addEventListener('input', () => {
    const v = Math.max(0, Math.min(100, Number(mixerRadioRange.value) || 0));
    audio.setMixerSettings({ radioVolume: v / 100 });
    if (mixerRadioVal) mixerRadioVal.textContent = `${v}%`;
    saveAudioMixerPrefs();
  });
  mixerSpatialCheck?.addEventListener('change', () => {
    audio.setMixerSettings({ spatialEnabled: Boolean(mixerSpatialCheck.checked) });
    saveAudioMixerPrefs();
  });
  mixerHapticsCheck?.addEventListener('change', () => {
    audio.setMixerSettings({ hapticsEnabled: Boolean(mixerHapticsCheck.checked) });
    saveAudioMixerPrefs();
  });
  btnMixerTest?.addEventListener('click', () => {
    audio.playSpatialTestSweep();
    showToast('🎧 Left → Center → Right spatial sonar sweep!', 2.0);
  });

  return {
    audioMixerModalEl,
    openAudioMixerModal,
    closeAudioMixerModal,
    syncAudioMixerModalUi,
  };
}

export function initPwaSupport({
  btnPwaUpdate,
  btnApplyPwaUpdate,
  btnInstallPwa,
  pwaUpdateText,
  pwaUpdateBanner,
  homeMenuUpdateDot,
  lan,
  getMode,
  getJoiningRoomCode,
  initialRoomCode,
  onSyncWakeLockReady,
  showToast,
}) {
  const localVersion = parseInt(document.querySelector('meta[name="app-version"]')?.content || '61', 10) || 61;
  if (btnPwaUpdate) {
    btnPwaUpdate.textContent = `v${localVersion}`;
  }

  let swReg = null;
  let updateAvailable = false;
  let detectedRemoteVer = null;
  let applyingUpdate = false;
  let swReloading = false;
  let lastUpdateCheckAt = 0;

  const reloadApp = () => {
    if (swReloading) return;
    swReloading = true;
    location.reload();
  };

  const markUpdateAvailable = (nextVer = null) => {
    updateAvailable = true;
    if (nextVer && (!detectedRemoteVer || nextVer > detectedRemoteVer)) {
      detectedRemoteVer = nextVer;
    }
    const verLabel = detectedRemoteVer ? `v${detectedRemoteVer}` : 'new build';
    if (pwaUpdateText) {
      pwaUpdateText.textContent = `New version (${verLabel}) ready — tap Update to apply.`;
    }
    if (pwaUpdateBanner) {
      pwaUpdateBanner.hidden = false;
    }
    if (homeMenuUpdateDot) {
      homeMenuUpdateDot.hidden = false;
    }
    if (btnPwaUpdate && !applyingUpdate) {
      btnPwaUpdate.textContent = detectedRemoteVer ? `⬆ v${detectedRemoteVer}` : '⬆ Update';
      btnPwaUpdate.classList.add('has-update');
      btnPwaUpdate.title = `Update Techno Dive to ${verLabel}`;
    }
  };

  const watchedWorkers = new WeakSet();
  const watchInstallingWorker = (worker) => {
    if (!worker || watchedWorkers.has(worker)) return;
    watchedWorkers.add(worker);
    if (worker.state === 'installed' && navigator.serviceWorker?.controller) {
      markUpdateAvailable(detectedRemoteVer);
      return;
    }
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker?.controller) {
        markUpdateAvailable(detectedRemoteVer);
      }
    });
  };

  const fetchRemoteSwVersion = async () => {
    try {
      const res = await fetch(`./sw.js?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const text = await res.text();
      const m = text.match(/CACHE_VERSION\s*=\s*['"]cave-diver-v(\d+)['"]/);
      return m ? parseInt(m[1], 10) : null;
    } catch {
      return null;
    }
  };

  const checkForPwaUpdate = async ({ manual = false } = {}) => {
    if (applyingUpdate) return;
    if (manual && updateAvailable) {
      applyPwaUpdate();
      return;
    }
    const now = Date.now();
    if (!manual && now - lastUpdateCheckAt < 15000) return;
    lastUpdateCheckAt = now;

    if (manual && btnPwaUpdate) {
      btnPwaUpdate.disabled = true;
      btnPwaUpdate.textContent = '↻ ...';
    }
    try {
      const [regRes, remoteVer] = await Promise.all([
        'serviceWorker' in navigator
          ? (swReg || (await navigator.serviceWorker.getRegistration('./').catch(() => null)))
          : Promise.resolve(null),
        fetchRemoteSwVersion(),
      ]);
      if (regRes) {
        swReg = regRes;
        await regRes.update().catch(() => {});
      }
      if (regRes?.installing) {
        watchInstallingWorker(regRes.installing);
      }
      if (remoteVer && remoteVer > localVersion) {
        markUpdateAvailable(remoteVer);
        if (manual) {
          showToast(`⬆ Techno Dive v${remoteVer} is ready — tap Update Now!`, 3.2);
        }
        return;
      }
      if (regRes?.waiting) {
        markUpdateAvailable(remoteVer);
        if (manual) {
          showToast('⬆ New update is ready — tap Update Now!', 3.2);
        }
        return;
      }
      if (manual) {
        showToast(`✓ Techno Dive v${localVersion} is up to date!`, 2.4);
      }
    } finally {
      if (manual && btnPwaUpdate && !applyingUpdate) {
        btnPwaUpdate.disabled = false;
        if (!updateAvailable) {
          btnPwaUpdate.textContent = `v${localVersion}`;
        }
      }
    }
  };

  const applyPwaUpdate = async () => {
    if (applyingUpdate) return;
    applyingUpdate = true;
    if (btnApplyPwaUpdate) {
      btnApplyPwaUpdate.disabled = true;
      btnApplyPwaUpdate.textContent = 'Updating...';
    }
    if (btnPwaUpdate) {
      btnPwaUpdate.disabled = true;
      btnPwaUpdate.textContent = 'Updating...';
    }
    setTimeout(reloadApp, 4500);

    if ('serviceWorker' in navigator && navigator.serviceWorker) {
      try {
        const reg = swReg || (await navigator.serviceWorker.getRegistration('./'));
        if (reg) {
          await reg.update().catch(() => {});
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            return;
          }
          if (reg.installing) {
            await new Promise((resolve) => {
              const w = reg.installing;
              const tm = setTimeout(resolve, 3200);
              w.addEventListener('statechange', () => {
                if (w.state === 'installed' || w.state === 'redundant') {
                  clearTimeout(tm);
                  resolve();
                }
              });
            });
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
              return;
            }
          }
        }
      } catch {}
    }
    reloadApp();
  };

  btnPwaUpdate?.addEventListener('click', () => checkForPwaUpdate({ manual: true }));
  btnApplyPwaUpdate?.addEventListener('click', applyPwaUpdate);

  if ('serviceWorker' in navigator && navigator.serviceWorker) {
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      if (applyingUpdate || (getMode() === 'menu' && !lan.room && !getJoiningRoomCode() && !initialRoomCode && !document.hidden)) {
        reloadApp();
      } else {
        markUpdateAvailable(detectedRemoteVer);
      }
    });
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        swReg = reg;
        if (reg.waiting) markUpdateAvailable(detectedRemoteVer);
        if (reg.installing) watchInstallingWorker(reg.installing);
        reg.addEventListener('updatefound', () => watchInstallingWorker(reg.installing));
        checkForPwaUpdate({ manual: false });
      })
      .catch(() => {
        checkForPwaUpdate({ manual: false });
      });
  } else {
    checkForPwaUpdate({ manual: false });
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkForPwaUpdate({ manual: false });
  });
  window.addEventListener('pageshow', () => checkForPwaUpdate({ manual: false }));
  window.addEventListener('focus', () => checkForPwaUpdate({ manual: false }));
  window.addEventListener('online', () => checkForPwaUpdate({ manual: false }));
  setInterval(() => {
    if (!document.hidden) checkForPwaUpdate({ manual: false });
  }, 5 * 60 * 1000);

  let screenWakeLock = null;
  const syncWakeLock = async () => {
    const shouldHold = !document.hidden && (getMode() === 'diving' || Boolean(lan.room));
    if (shouldHold && navigator.wakeLock && !screenWakeLock) {
      try {
        screenWakeLock = await navigator.wakeLock.request('screen');
        screenWakeLock.addEventListener('release', () => {
          screenWakeLock = null;
        });
      } catch {}
    } else if (!shouldHold && screenWakeLock) {
      try { await screenWakeLock.release(); } catch {}
      screenWakeLock = null;
    }
  };
  onSyncWakeLockReady?.(syncWakeLock);
  document.addEventListener('visibilitychange', syncWakeLock);
  window.addEventListener('focus', syncWakeLock);
  lan.on('room_update', syncWakeLock);
  syncWakeLock();

  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator?.standalone === true;
  if (isStandalone) {
    if (btnInstallPwa) btnInstallPwa.hidden = true;
    return;
  }

  let deferredInstallPrompt = null;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  if (btnInstallPwa && isIos) {
    btnInstallPwa.hidden = false;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (btnInstallPwa) btnInstallPwa.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    if (btnInstallPwa) btnInstallPwa.hidden = true;
    showToast('Techno Dive installed to Home Screen!', 3.0);
  });

  btnInstallPwa?.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      try {
        await deferredInstallPrompt.userChoice;
      } catch {}
      deferredInstallPrompt = null;
      btnInstallPwa.hidden = true;
      return;
    }
    if (isIos) {
      showToast('On iPhone/iPad: tap Share (↑) → "Add to Home Screen"', 4.5);
    } else {
      showToast('Open browser menu (⋮) → "Install app" or "Add to Home Screen"', 4.0);
    }
  });
}
