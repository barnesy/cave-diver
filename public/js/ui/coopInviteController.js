/**
 * Co-op Room Invite URL, OS Join Notifications, Clipboard & LAN Rooms List Controller (v263).
 * Extracted from main.js to keep main.js modular and cleanly below the 8,000-line ceiling.
 */
import { escapeHtml } from '../util/common.js';
import { LEVELS, getLevelById } from '../levels/index.js';

export function createCoopInviteController({
  lan,
  lanInviteUrlInput,
  btnShareInvite,
  btnHudInvite,
  btnHudShare,
  btnNotifyToggle,
  lanConnBadge,
  lanRoomsSection,
  lanRoomsList,
  getMode,
  getSession,
  getCopyInviteFeedbackTimer,
  setCoopDockExpanded,
  showToast,
}) {
  let cachedLanUrls = [];
  let notifyPromptedOnce = false;
  let notifyAlertsMuted = false;

  function isLoopbackHost(hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  }

  function getAppBasePath() {
    return location.pathname
      .replace(/\/index\.html$/, '')
      .replace(/\/join\/.*$/, '')
      .replace(/\/+$/, '');
  }

  function getLanJoinBaseUrl() {
    const basePath = getAppBasePath();
    if (!isLoopbackHost(location.hostname)) {
      return `${location.origin}${basePath}`;
    }
    const lanIp = cachedLanUrls.find((u) => !u.includes('127.0.0.1') && !u.includes('localhost'));
    const root = lanIp || cachedLanUrls[0] || location.origin;
    return `${root}${basePath}`;
  }

  function buildRoomInviteUrl(code) {
    if (!code) return '';
    const params = new URLSearchParams();
    params.set('room', code);
    const currentParams = new URLSearchParams(location.search);
    const forcedTransport = currentParams.get('transport');
    if (forcedTransport) params.set('transport', forcedTransport);
    return `${getLanJoinBaseUrl()}/?${params.toString()}`;
  }

  function syncBrowserRoomUrl(code) {
    try {
      const nextUrl = new URL(location.href);
      const joinMatch = nextUrl.pathname.match(/^(.*)\/join\/[A-Za-z0-9]{1,8}\/?$/);
      if (joinMatch) {
        nextUrl.pathname = `${joinMatch[1] || ''}/`;
      }
      if (code) {
        nextUrl.searchParams.set('room', code);
      } else {
        nextUrl.searchParams.delete('room');
        nextUrl.searchParams.delete('join');
      }
      if (nextUrl.toString() !== location.href) {
        history.replaceState(null, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      }
    } catch {
      // ignore history restriction
    }
  }

  function syncNotifyToggleUi() {
    if (!btnNotifyToggle) return;
    if (!('Notification' in window)) {
      btnNotifyToggle.hidden = true;
      return;
    }
    btnNotifyToggle.hidden = false;
    const perm = Notification.permission;
    if (perm === 'denied') {
      btnNotifyToggle.textContent = '🔕 Blocked';
      btnNotifyToggle.title = 'Notifications blocked in browser site settings';
    } else if (perm === 'granted') {
      btnNotifyToggle.textContent = notifyAlertsMuted ? '🔕 Muted' : '🔔 Alerts';
      btnNotifyToggle.title = notifyAlertsMuted
        ? 'Tap to unmute join notifications'
        : 'You will get a notification when a diver joins while app is in background';
    } else {
      btnNotifyToggle.textContent = '🔔 Alerts';
      btnNotifyToggle.title = 'Enable notification when a diver joins';
    }
  }

  function syncRoomInviteUi(room) {
    const code = room?.code || '';
    const inviteUrl = buildRoomInviteUrl(code);
    const maxP = room?.maxPlayers || 4;
    const hasOpenSlots = Boolean(code && Array.isArray(room?.players) && room.players.length < maxP);
    const showInSoloDive = !code && getMode() === 'diving' && Boolean(getSession());
    if (lanInviteUrlInput) {
      lanInviteUrlInput.value = inviteUrl;
    }
    if (btnShareInvite) {
      btnShareInvite.hidden = !(code && typeof navigator.share === 'function');
    }
    if (btnHudInvite) {
      btnHudInvite.hidden = !(hasOpenSlots || showInSoloDive);
      if (!getCopyInviteFeedbackTimer()) {
        btnHudInvite.textContent = code ? `🔗 ${code}` : '🔗 Invite';
      }
      if (hasOpenSlots) {
        btnHudInvite.title = `Copy drop-in link (${room.players.length}/${maxP} divers · Room ${code})`;
      } else if (showInSoloDive) {
        btnHudInvite.title = 'Open Co-op Room & copy drop-in invite link for friends';
      }
    }
    if (btnHudShare) {
      btnHudShare.hidden = !((hasOpenSlots || showInSoloDive) && typeof navigator.share === 'function');
      if (showInSoloDive) {
        btnHudShare.title = 'Open Co-op Room & share invite link';
      }
    }
    syncNotifyToggleUi();
  }

  async function requestDiverNotificationPermission({ userTriggered = false } = {}) {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') {
      syncNotifyToggleUi();
      return 'granted';
    }
    if (Notification.permission === 'denied') {
      syncNotifyToggleUi();
      if (userTriggered) {
        showToast('Notifications are blocked in your browser site settings.', 3.4);
      }
      return 'denied';
    }
    if (!userTriggered && notifyPromptedOnce) return Notification.permission;
    notifyPromptedOnce = true;
    try {
      const res = await Notification.requestPermission();
      syncNotifyToggleUi();
      if (userTriggered && res === 'granted') {
        showToast('Join alerts enabled — you will be notified when a buddy enters!', 3.0);
      }
      return res;
    } catch {
      return Notification.permission;
    }
  }

  async function showJoinOsNotification(room, joiners, siteNum, siteLevel) {
    if (!('Notification' in window) || Notification.permission !== 'granted' || notifyAlertsMuted) return;
    if (!document.hidden && document.hasFocus()) return;
    const names = joiners.map((p) => p.name || 'Buddy Diver').join(', ');
    const maxP = room.maxPlayers || 2;
    const title = `${names} joined Room ${room.code}`;
    const options = {
      body: `L${siteNum}: ${siteLevel.name} (${room.players.length}/${maxP} divers)`,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: `cave-diver-join-${room.code}`,
      renotify: true,
      data: { url: buildRoomInviteUrl(room.code) },
    };
    try {
      if (navigator.serviceWorker?.controller) {
        const reg = await navigator.serviceWorker.ready;
        if (reg?.showNotification) {
          await reg.showNotification(title, options);
          return;
        }
      }
    } catch {
      // Fallback to foreground Notification constructor below
    }
    try {
      const n = new Notification(title, options);
      n.onclick = () => {
        try { window.focus(); } catch {}
        n.close();
      };
    } catch {
      // Some mobile browsers require ServiceWorkerRegistration.showNotification
    }
  }

  async function fetchLanUrls() {
    const transport = lan.getTransportMode();
    if (transport === 'p2p') {
      if (lan.room) syncRoomInviteUi(lan.room);
      return;
    }
    try {
      const res = await fetch('./api/lan-info');
      if (!res.ok) throw new Error('no lan-info');
      const info = await res.json();
      cachedLanUrls = Array.isArray(info.urls) ? info.urls : [];
      if (lan.room) syncRoomInviteUi(lan.room);
    } catch {
      cachedLanUrls = [];
    }
  }

  async function copyText(text, toastLabel, { selectEl = null } = {}) {
    let copied = false;
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (!copied && selectEl) {
      try {
        selectEl.focus();
        selectEl.select();
        selectEl.setSelectionRange?.(0, text.length);
        copied = Boolean(document.execCommand?.('copy'));
      } catch {
        copied = false;
      }
    }
    if (!copied) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange?.(0, text.length);
      try {
        copied = Boolean(document.execCommand?.('copy'));
      } catch {
        copied = false;
      }
      ta.remove();
    }
    if (copied) {
      showToast(toastLabel, 2.4);
    } else {
      if (selectEl) {
        selectEl.focus();
        selectEl.select();
        selectEl.setSelectionRange?.(0, text.length);
      }
      showToast(`Select & copy invite link: ${text}`, 4.0);
    }
    return copied;
  }

  function setLanConnectionBadge(state, text) {
    if (!lanConnBadge) return;
    lanConnBadge.className = `lan-conn-badge ${state}`;
    lanConnBadge.textContent = text;
  }

  function renderRoomsList(rooms = lan.rooms) {
    if (!lanRoomsSection || !lanRoomsList) return;
    if (lan.room || !Array.isArray(rooms) || rooms.length === 0) {
      lanRoomsSection.hidden = true;
      lanRoomsList.innerHTML = '';
      return;
    }
    lanRoomsSection.hidden = false;
    if (typeof setCoopDockExpanded === 'function') setCoopDockExpanded(true);
    lanRoomsList.innerHTML = rooms
      .map((r) => {
        const lvl = getLevelById(r.levelId);
        const lvlIdx = LEVELS.findIndex((l) => l.id === lvl.id) + 1;
        const full = r.playerCount >= r.maxPlayers;
        const busy = full;
        const stateText = full
          ? 'Full'
          : r.started
            ? `In Dive · ${r.playerCount}/${r.maxPlayers} Divers`
            : `${r.playerCount}/${r.maxPlayers} Divers`;
        const safeCode = escapeHtml(r.code);
        return `
          <div class="lan-room-row">
            <div class="lan-room-row-info">
              <span><strong>${safeCode}</strong> · Host: ${escapeHtml(r.hostName)}</span>
              <span class="lan-room-row-sub">L${lvlIdx}: ${escapeHtml(lvl.name)} · ${stateText}</span>
            </div>
            <button
              type="button"
              class="btn tiny ${busy ? 'ghost' : 'primary'}"
              data-join-code="${safeCode}"
              ${busy ? 'disabled' : ''}
            >
              ${full ? 'Full' : r.started ? 'Drop In' : 'Join'}
            </button>
          </div>
        `;
      })
      .join('');
  }

  function toggleNotifyAlertsMuted() {
    notifyAlertsMuted = !notifyAlertsMuted;
    syncNotifyToggleUi();
    return notifyAlertsMuted;
  }

  return {
    isLoopbackHost,
    getAppBasePath,
    getLanJoinBaseUrl,
    buildRoomInviteUrl,
    syncBrowserRoomUrl,
    syncRoomInviteUi,
    syncNotifyToggleUi,
    requestDiverNotificationPermission,
    showJoinOsNotification,
    fetchLanUrls,
    copyText,
    setLanConnectionBadge,
    renderRoomsList,
    toggleNotifyAlertsMuted,
  };
}
