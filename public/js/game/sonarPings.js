/**
 * Synced Tactical Sonar Waypoint Pings (v207).
 *
 * Shared across LAN WebSocket, P2P Trystero Co-op, and Solo AI Dive Squads:
 * - Tap anywhere on the Tactical Sonar Scope to drop a ping at exact world (x, y)
 * - Or tap a quick-ping badge (Follow / Relic / Gas / Hazard) to drop at diver position
 * - Renders pulsing sonar ripples on the Sonar Overlay + holographic world markers &
 *   off-screen edge arrows so teammates never miss a callout in dark passages or silt-outs.
 */

export const SONAR_PING_KINDS = Object.freeze({
  rally: Object.freeze({
    id: 'rally',
    icon: '📍',
    shortLabel: 'FOLLOW',
    label: 'Rally / Follow',
    color: '#38bdf8',
    rgb: '56, 189, 248',
    durationSec: 16,
  }),
  relic: Object.freeze({
    id: 'relic',
    icon: '💎',
    shortLabel: 'RELIC',
    label: 'Artifact / POI',
    color: '#fde047',
    rgb: '253, 224, 71',
    durationSec: 20,
  }),
  gas: Object.freeze({
    id: 'gas',
    icon: '⛽',
    shortLabel: 'GAS',
    label: 'Gas / Deco Check',
    color: '#34d399',
    rgb: '52, 211, 153',
    durationSec: 18,
  }),
  hazard: Object.freeze({
    id: 'hazard',
    icon: '⚠️',
    shortLabel: 'HAZARD',
    label: 'Hazard / Danger',
    color: '#f87171',
    rgb: '248, 113, 113',
    durationSec: 18,
  }),
});

export const SONAR_PING_ORDER = Object.freeze(['rally', 'relic', 'gas', 'hazard']);
export const MAX_ACTIVE_SONAR_PINGS = 6;

export function getSonarPingKind(kind) {
  return SONAR_PING_KINDS[kind] || SONAR_PING_KINDS.rally;
}

/**
 * Sanitize a local or network-received tactical sonar ping payload.
 */
export function sanitizeSonarPing(raw, { fallbackAuthor = 'DIVER', isSelf = false } = {}) {
  if (!raw || !Number.isFinite(Number(raw.x)) || !Number.isFinite(Number(raw.y))) {
    return null;
  }
  const meta = getSonarPingKind(raw.kind);
  const x = Math.max(-400, Math.min(2000, Number(raw.x)));
  const y = Math.max(-5, Math.min(400, Number(raw.y)));
  const rawAuthor = typeof raw.author === 'string' && raw.author.trim() ? raw.author : fallbackAuthor;
  const author = rawAuthor.replace(/[\r\n\t<>]/g, ' ').trim().slice(0, 14) || 'DIVER';
  const durationSec = Number.isFinite(Number(raw.durationSec))
    ? Math.max(4, Math.min(30, Number(raw.durationSec)))
    : meta.durationSec;
  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 28)
      : `sp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  return {
    id,
    kind: meta.id,
    icon: meta.icon,
    shortLabel: meta.shortLabel,
    color: meta.color,
    rgb: meta.rgb,
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    author,
    isSelf: Boolean(isSelf || raw.isSelf),
    life: durationSec,
    maxLife: durationSec,
    ageSec: 0,
  };
}

/**
 * Add or refresh a synced tactical sonar ping on a live dive session.
 */
export function addSyncedSonarPing(session, raw, opts = {}) {
  if (!session) return null;
  const ping = sanitizeSonarPing(raw, opts);
  if (!ping) return null;
  if (!Array.isArray(session.syncedSonarPings)) session.syncedSonarPings = [];
  const existingIdx = session.syncedSonarPings.findIndex((p) => p.id === ping.id);
  if (existingIdx >= 0) {
    session.syncedSonarPings[existingIdx] = ping;
  } else {
    if (session.syncedSonarPings.length >= MAX_ACTIVE_SONAR_PINGS) {
      session.syncedSonarPings.shift();
    }
    session.syncedSonarPings.push(ping);
  }
  return ping;
}

/**
 * Decay active synced sonar pings in place (zero per-frame allocations).
 */
export function stepSyncedSonarPings(session, dt) {
  if (!session || !Array.isArray(session.syncedSonarPings) || session.syncedSonarPings.length === 0) return;
  if (!Number.isFinite(dt) || dt <= 0) return;
  let w = 0;
  for (let i = 0; i < session.syncedSonarPings.length; i++) {
    const p = session.syncedSonarPings[i];
    p.ageSec = (p.ageSec || 0) + dt;
    p.life -= dt;
    if (p.life > 0) {
      session.syncedSonarPings[w++] = p;
    }
  }
  session.syncedSonarPings.length = w;
}

/**
 * Format a compact tactical toast callout for a synced sonar ping.
 */
export function formatSonarPingCallout(ping) {
  if (!ping) return '';
  const depthM = Math.max(0, Math.round(ping.y || 0));
  const who = ping.isSelf ? 'Sonar Ping' : `${ping.author} pinged`;
  return `${ping.icon} ${who}: ${ping.shortLabel} (${depthM}m)`;
}

/**
 * Modular UI + Co-op Sync controller for the Tactical Sonar Overlay Ping Bar & Tap-to-Ping Scope (v207).
 */
export function createSonarPingController({
  canvasEl,
  pingBarEl,
  computeViewport,
  isAllowed,
  getContext,
  onDropLocal,
  onReceiveRemote,
} = {}) {
  let activeKind = 'rally';

  function syncBarUi() {
    if (!pingBarEl) return;
    const chips = pingBarEl.querySelectorAll('.sonar-ping-chip');
    for (const chip of chips) {
      const isSel = chip.dataset.sonarPing === activeKind;
      chip.classList.toggle('active', isSel);
      chip.setAttribute('aria-pressed', isSel ? 'true' : 'false');
    }
  }

  function dropLocal(kind, wx, wy) {
    const ctx = getContext?.();
    if (!ctx?.active || !ctx.session) return null;
    if (!Number.isFinite(wx) || !Number.isFinite(wy)) return null;
    const diverName = (ctx.session.diver?.name || ctx.fallbackName || 'DIVER').trim() || 'DIVER';
    const ping = addSyncedSonarPing(
      ctx.session,
      { kind: kind || activeKind, x: wx, y: wy, author: diverName },
      { fallbackAuthor: diverName, isSelf: true }
    );
    if (!ping) return null;
    onDropLocal?.(ping, ctx.session);
    return ping;
  }

  function receiveRemote(msg) {
    const ctx = getContext?.();
    if (!ctx?.session || !msg) return null;
    const payload = msg.ping && typeof msg.ping === 'object' ? msg.ping : msg;
    const author = payload.author || msg.name || 'BUDDY';
    const ping = addSyncedSonarPing(
      ctx.session,
      { id: payload.id, kind: payload.kind, x: payload.x, y: payload.y, author },
      { fallbackAuthor: author, isSelf: false }
    );
    if (!ping) return null;
    onReceiveRemote?.(ping, ctx.session);
    return ping;
  }

  pingBarEl?.addEventListener('click', (e) => {
    const chip = e.target?.closest?.('.sonar-ping-chip');
    if (!chip) return;
    e.stopPropagation();
    const nextKind = getSonarPingKind(chip.dataset.sonarPing).id;
    const alreadySelected = activeKind === nextKind;
    activeKind = nextKind;
    syncBarUi();
    const ctx = getContext?.();
    if (alreadySelected && ctx?.active && ctx.session?.diver) {
      dropLocal(nextKind, ctx.session.diver.x, ctx.session.diver.y);
    }
  });

  canvasEl?.addEventListener('click', (e) => {
    e.stopPropagation();
    const ctx = getContext?.();
    if (!ctx?.active || !ctx.session || !ctx.minimapVisible) return;
    if (isAllowed && !isAllowed(ctx.session)) return;
    const rect = canvasEl.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const sx = ((e.clientX - rect.left) / rect.width) * canvasEl.width;
    const sy = ((e.clientY - rect.top) / rect.height) * canvasEl.height;
    const vp = computeViewport?.(ctx.session.level, ctx.session.diver, {
      zoomMode: ctx.zoomMode || 'follow',
      width: canvasEl.width,
      height: canvasEl.height,
      revealSecretLair: ctx.session.secretLair ? Boolean(ctx.session.secretLair.veilBreached) : true,
    });
    if (typeof vp?.fromX !== 'function' || typeof vp?.fromY !== 'function') return;
    dropLocal(activeKind, vp.fromX(sx), vp.fromY(sy));
  });

  syncBarUi();
  return {
    getActiveKind: () => activeKind,
    dropLocal,
    receiveRemote,
    syncBarUi,
  };
}
