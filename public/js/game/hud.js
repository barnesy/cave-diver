import { GAS_MIXES, GAS_ORDER, computePPO2, getRecommendedGas, getAscentInstruction, getGasSwitchCoach } from '../physics/diveModel.js';
import { getAscentConfig } from '../levels/index.js';

const GAS_HOTKEY_LABELS = { EAN32: '1', TMX1455: '2', O2: '3' };

function formatClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

/**
 * Sample normalized P-QRS-T cardiac EKG deflection (-0.4..+1.0) at beat phase [0..1).
 */
export function sampleEkgWave(phase, alive = true) {
  if (!alive) return 0;
  const p = ((phase % 1) + 1) % 1;
  // P wave
  if (p >= 0.09 && p < 0.19) {
    return 0.16 * Math.sin(((p - 0.09) / 0.1) * Math.PI);
  }
  // Q dip
  if (p >= 0.21 && p < 0.235) {
    return -0.2 * Math.sin(((p - 0.21) / 0.025) * Math.PI);
  }
  // Sharp R spike
  if (p >= 0.235 && p < 0.275) {
    const t = (p - 0.235) / 0.04;
    return t < 0.5 ? t * 2.0 : (1 - t) * 2.0;
  }
  // S dip
  if (p >= 0.275 && p < 0.315) {
    return -0.36 * Math.sin(((p - 0.275) / 0.04) * Math.PI);
  }
  // T wave
  if (p >= 0.44 && p < 0.62) {
    return 0.25 * Math.sin(((p - 0.44) / 0.18) * Math.PI);
  }
  return 0;
}

function createEkgState(width = 160) {
  return {
    samples: new Float32Array(Math.max(40, width)),
    cursor: 0,
    phase: Math.random(),
    accumX: 0,
    ctx: null,
    layoutW: width,
    layoutH: 22,
    measured: false,
    visible: true,
  };
}

function measureEkgCanvas(canvas, state) {
  if (!canvas || !state) return;
  const w = Math.round(canvas.clientWidth || 0);
  const h = Math.round(canvas.clientHeight || 0);
  const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
  state.measured = true;
  state.dpr = dpr;
  if (w > 0 && h > 0) {
    state.visible = true;
    state.layoutW = w;
    state.layoutH = h;
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
  } else {
    // Hidden canvas (e.g. mobile compact card) — skip expensive 2D strokes until visible
    state.visible = canvas.offsetParent !== null && canvas.width > 0 && canvas.height > 0;
  }
}

function stepAndDrawEkg(canvas, state, bpm, alive, dt = 0.016) {
  if (!canvas) return false;
  if (!state.measured) {
    measureEkgCanvas(canvas, state);
  }
  const effectiveBpm = alive ? Math.max(40, Math.min(210, bpm || 68)) : 0;
  const beatHz = effectiveBpm / 60;
  if (!state.visible) {
    state.phase = (state.phase + beatHz * dt) % 1;
    return alive && state.phase >= 0.22 && state.phase <= 0.34;
  }
  const ctx = state.ctx || (state.ctx = canvas.getContext('2d'));
  if (!ctx) return false;

  const dpr = state.dpr || 1;
  const w = state.layoutW || Math.round(canvas.width / dpr);
  const h = state.layoutH || Math.round(canvas.height / dpr);
  if (w <= 0 || h <= 0) return false;
  if (state.samples.length !== w) {
    state.samples = new Float32Array(w);
    state.cursor = 0;
  }
  if (ctx.setTransform) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const sweepPxPerSec = 48;
  const stepPx = sweepPxPerSec * dt;
  state.accumX += stepPx;

  const pxAdvance = Math.min(8, Math.floor(state.accumX));
  if (pxAdvance > 0) {
    state.accumX -= pxAdvance;
    const subDt = dt / pxAdvance;
    for (let i = 0; i < pxAdvance; i++) {
      state.phase = (state.phase + beatHz * subDt) % 1;
      state.cursor = (state.cursor + 1) % w;
      state.samples[state.cursor] = sampleEkgWave(state.phase, alive);
    }
  } else {
    state.phase = (state.phase + beatHz * dt) % 1;
  }

  // Subtle background grid + phosphor trace sweep
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  ctx.lineTo(w, h * 0.62);
  ctx.stroke();

  const color = !alive || effectiveBpm >= 145 ? '#f87171' : effectiveBpm >= 115 ? '#fbbf24' : '#4ade80';
  const baseY = h * 0.64;
  const ampUp = h * 0.52;
  const gap = 7;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let penDown = false;
  for (let x = 0; x < w; x++) {
    const ahead = (x - state.cursor + w) % w;
    if (ahead > 0 && ahead < gap) {
      penDown = false;
      continue;
    }
    const y = baseY - state.samples[x] * ampUp;
    if (!penDown) {
      ctx.moveTo(x, y);
      penDown = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // Leading sweep dot
  const dotY = baseY - state.samples[state.cursor] * ampUp;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(state.cursor, dotY, 1.8, 0, Math.PI * 2);
  ctx.fill();

  return alive && state.phase >= 0.22 && state.phase <= 0.34;
}

const _domState = new WeakMap();
function _getCache(el) {
  let c = _domState.get(el);
  if (!c) {
    c = {};
    _domState.set(el, c);
  }
  return c;
}
function setText(el, val) {
  if (!el) return;
  const c = _getCache(el);
  if (c.t !== val) {
    c.t = val;
    el.textContent = val;
  }
}
function setClass(el, cls) {
  if (!el) return;
  const c = _getCache(el);
  if (c.c !== cls) {
    c.c = cls;
    el.className = cls;
  }
}
function setHidden(el, hidden) {
  if (!el) return;
  const c = _getCache(el);
  if (c.h !== hidden) {
    c.h = hidden;
    el.hidden = hidden;
  }
}
function setStyleProp(el, prop, val) {
  if (!el) return;
  const c = _getCache(el);
  if (c[prop] !== val) {
    c[prop] = val;
    el.style[prop] = val;
  }
}

export class DiveComputerHUD {
  constructor({ onGasSelect, onReelToggle, onReelRewind, onHeartbeatPulse }) {
    this.onHeartbeatPulse = onHeartbeatPulse;
    this._isTouchDevice =
      typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches);
    this.elDepth = document.getElementById('dc-depth');
    this.elMaxDepth = document.getElementById('dc-max-depth');
    this.elTime = document.getElementById('dc-time');
    this.elDecoLabel = document.getElementById('dc-deco-label');
    this.elDecoVal = document.getElementById('dc-deco-val');
    this.elPPO2 = document.getElementById('dc-ppo2');
    this.elCNS = document.getElementById('dc-cns');
    this.elEND = document.getElementById('dc-end');
    this.elAscentFill = document.getElementById('dc-ascent-fill');
    this.elAscentVal = document.getElementById('dc-ascent-val');
    this.elAlerts = document.getElementById('dc-alerts');
    this.elObjective = document.getElementById('dc-objective');
    this.elBuddy = document.getElementById('dc-buddy');
    this.elSelfHealth = document.getElementById('hud-self-health');
    this.elSelfName = document.getElementById('dc-self-name');
    this.elGasCallout = document.getElementById('hud-gas-callout');
    this.elGasCalloutTitle = document.getElementById('hud-gas-callout-title');
    this.elGasCalloutDetail = document.getElementById('hud-gas-callout-detail');
    this.elGasCalloutCta = document.getElementById('hud-gas-callout-cta');
    this._gasCalloutTargetId = null;
    this.elGasCallout?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this._gasCalloutTargetId) onGasSelect?.(this._gasCalloutTargetId);
    });
    this.elGasCallout?.addEventListener('click', (e) => {
      if (e.detail === 0 && this._gasCalloutTargetId) onGasSelect?.(this._gasCalloutTargetId);
    });
    this.elEkgRow = document.getElementById('dc-ekg-row');
    this.elEkgHeart = document.getElementById('dc-ekg-heart');
    this.elEkgBpm = document.getElementById('dc-ekg-bpm');
    this.elEkgCanvas = document.getElementById('dc-ekg-canvas');
    this.elReelRow = document.getElementById('hud-reel-dock');
    this.elReelStatus = document.getElementById('hud-reel-status');
    this.elReelMeters = document.getElementById('dc-reel-meters');
    this.btnReelToggle = document.getElementById('btn-reel-toggle');
    this.btnReelRewind = document.getElementById('btn-reel-rewind');
    this.btnReelToggle?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onReelToggle?.();
    });
    this.btnReelToggle?.addEventListener('click', (e) => {
      if (e.detail === 0) onReelToggle?.();
    });
    this.btnReelRewind?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onReelRewind?.();
    });
    this.btnReelRewind?.addEventListener('click', (e) => {
      if (e.detail === 0) onReelRewind?.();
    });
    this.selfEkg = createEkgState(128);
    this.mateCards = new Map();
    this._seenPeerIds = new Set();
    this._ekgStateByCanvas = new WeakMap();
    this._ekgResizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      try {
        this._ekgResizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const st = this._ekgStateByCanvas.get(entry.target);
            if (st) st.measured = false;
          }
        });
      } catch (_) {}
    }
    if (this.elEkgCanvas) {
      this._ekgStateByCanvas.set(this.elEkgCanvas, this.selfEkg);
      this._ekgResizeObserver?.observe(this.elEkgCanvas);
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this._onHudResize = () => {
        this.selfEkg.measured = false;
        for (const ui of this.mateCards.values()) {
          if (ui?.ekg) ui.ekg.measured = false;
        }
      };
      window.addEventListener('resize', this._onHudResize, { passive: true });
    }
    const bindVital = (el) => ({
      el,
      fill: el?.querySelector('.v-fill') || null,
      val: el?.querySelector('.v-val') || null,
      lastPct: -1,
      lastCls: '',
    });
    this.vitalEls = {
      tox: bindVital(document.getElementById('vital-tox')),
      dcs: bindVital(document.getElementById('vital-dcs')),
      narc: bindVital(document.getElementById('vital-narc')),
      hyp: bindVital(document.getElementById('vital-hyp')),
    };
    this._lastObjectiveHtml = '';
    this.tankButtons = {};

    const gasRack = document.getElementById('dc-gas-rack');
    gasRack.innerHTML = '';

    for (const id of GAS_ORDER) {
      const mix = GAS_MIXES[id];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dc-tank-btn';
      btn.dataset.gas = id;
      btn.innerHTML = `
        <div class="tank-top">
          <span class="tank-name">${mix.name}</span>
          <span class="tank-bar-txt">200b</span>
        </div>
        <div class="tank-meta">${mix.role}</div>
        <div class="tank-gauge"><div class="tank-gauge-fill"></div></div>
      `;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        onGasSelect(id);
      });
      btn.addEventListener('click', (e) => {
        if (e.detail === 0) onGasSelect(id);
      });
      gasRack.appendChild(btn);
      this.tankButtons[id] = {
        btn,
        nameEl: btn.querySelector('.tank-name'),
        metaEl: btn.querySelector('.tank-meta'),
        barTxt: btn.querySelector('.tank-bar-txt'),
        fill: btn.querySelector('.tank-gauge-fill'),
      };
    }
  }

  _updateVitalBar(vital, pct, warnAt, dangerAt) {
    if (!vital?.el) return;
    const clamped = Math.max(0, Math.min(100, Math.round(pct || 0)));
    const cls = clamped >= dangerAt ? 'danger' : clamped >= warnAt ? 'warn' : '';
    if (vital.lastCls !== cls) {
      vital.lastCls = cls;
      vital.el.className = cls ? `dc-vital ${cls}` : 'dc-vital';
    }
    if (vital.lastPct !== clamped) {
      vital.lastPct = clamped;
      if (vital.fill) vital.fill.style.width = `${clamped}%`;
      if (vital.val) vital.val.textContent = `${clamped}%`;
    }
  }

  update({
    diveState,
    diver,
    nextCheckpoint,
    exitZone,
    checkpointsHit,
    totalCheckpoints,
    collectedCount = 0,
    collectiblesTotal = 0,
    exploredPct = 0,
    bodyRecovered = false,
    carryingBody = false,
    peerDiver,
    peers,
    playerName = '',
    level,
    ascentConfig,
    reelMaxMeters = 0,
    reelRemainingM = 0,
    reelingActive = false,
    dt = 0.016,
  }) {
    setText(this.elDepth, diveState.depthM.toFixed(1));
    setText(this.elMaxDepth, `MAX ${diveState.maxDepthM.toFixed(1)}m`);
    setText(this.elTime, formatClock(diveState.diveTimeSec));

    // NDL vs Mandatory Deco Stop
    if (diveState.stopDepthM > 0) {
      const violating = diveState.depthM < diveState.ceilingM - 0.5;
      setText(this.elDecoLabel, violating ? 'BELOW CEIL!' : `STOP ${diveState.stopDepthM}m`);
      setText(this.elDecoVal, formatClock(diveState.stopRemainingSec));
      setClass(this.elDecoVal, `dc-val ${violating ? 'danger blink' : 'warn'}`);
      setClass(this.elDecoLabel, `dc-lbl ${violating ? 'danger' : 'warn'}`);
    } else {
      setText(this.elDecoLabel, 'NDL');
      setClass(this.elDecoLabel, 'dc-lbl');
      setText(this.elDecoVal, `${diveState.ndlMin}m`);
      setClass(this.elDecoVal, `dc-val ${diveState.ndlMin <= 2 ? 'warn' : 'ok'}`);
    }

    // PPO2 color grading
    setText(this.elPPO2, diveState.ppo2.toFixed(2));
    if (diveState.ppo2 < 0.16 && diveState.depthM > 0.2) {
      setClass(this.elPPO2, 'dc-val cyan blink');
    } else if (diveState.ppo2 > 1.6) {
      setClass(this.elPPO2, 'dc-val danger blink');
    } else if (diveState.ppo2 > 1.4) {
      setClass(this.elPPO2, 'dc-val warn');
    } else {
      setClass(this.elPPO2, 'dc-val ok');
    }

    // CNS & END & Self Vitals Bars
    setText(this.elCNS, `${Math.round(diveState.cnsPercent)}%`);
    setClass(this.elCNS, `dc-subval ${diveState.cnsPercent >= 80 ? 'danger' : diveState.cnsPercent >= 40 ? 'warn' : ''}`);
    setText(this.elEND, `END ${Math.round(diveState.endM)}m`);
    setClass(this.elEND, `dc-subval ${diveState.narcosisLevel > 0.35 ? 'warn' : ''}`);

    this._updateVitalBar(this.vitalEls.tox, diveState.cnsPercent, 30, 70);
    this._updateVitalBar(this.vitalEls.dcs, diveState.dcsStress, 22, 65);
    this._updateVitalBar(this.vitalEls.narc, (diveState.narcosisLevel || 0) * 100, 28, 68);
    this._updateVitalBar(this.vitalEls.hyp, diveState.hypoxiaStress, 22, 65);

    // Local Heartbeat, Self Name & EKG Waveform Monitor
    const myBpm = diveState.alive === false ? 0 : Math.round(diveState.heartRateBpm ?? 68);
    if (this.elSelfName) {
      const cleanName = typeof playerName === 'string' ? playerName.trim() : '';
      setText(this.elSelfName, cleanName ? `YOU · ${cleanName}` : 'YOU');
    }
    setText(this.elEkgBpm, diveState.alive === false ? '--' : String(myBpm));
    const selfSev =
      diveState.alive === false ||
      diveState.criticalAlarm ||
      myBpm >= 145 ||
      (diveState.cnsPercent || 0) >= 70 ||
      (diveState.dcsStress || 0) >= 65 ||
      (diveState.hypoxiaStress || 0) >= 65 ||
      ((diveState.narcosisLevel || 0) * 100) >= 68
        ? 'danger'
        : myBpm >= 115 ||
            diveState.warnings?.length > 0 ||
            (diveState.cnsPercent || 0) >= 30 ||
            (diveState.dcsStress || 0) >= 22 ||
            (diveState.hypoxiaStress || 0) >= 22 ||
            ((diveState.narcosisLevel || 0) * 100) >= 28
          ? 'warn'
          : '';
    setClass(this.elSelfHealth, selfSev ? `self-health-card ${selfSev}` : 'self-health-card');
    if (this.elEkgRow) {
      const hrCls = diveState.alive === false || myBpm >= 145 ? 'danger' : myBpm >= 115 ? 'warn' : '';
      setClass(this.elEkgRow, hrCls ? `dc-ekg-row ${hrCls}` : 'dc-ekg-row');
    }
    const qrsPeak = stepAndDrawEkg(this.elEkgCanvas, this.selfEkg, myBpm, diveState.alive !== false, dt);
    if (this.elEkgHeart && this._lastQrsPeak !== qrsPeak) {
      this._lastQrsPeak = qrsPeak;
      this.elEkgHeart.classList.toggle('pulse', qrsPeak);
      if (qrsPeak && myBpm >= 130) {
        this.onHeartbeatPulse?.(myBpm);
      }
    }

    // Deployable Guideline Spool Dock & Bottom-Center Line Status (unlined labyrinth caves)
    const showReel = reelMaxMeters > 0;
    setHidden(this.elReelStatus, !showReel);
    if (this.elReelRow) {
      if (showReel) {
        setHidden(this.elReelRow, false);
        const remM = Math.max(0, Math.round(reelRemainingM));
        const rCls = remM <= 1 ? 'danger' : remM < 35 ? 'warn' : reelingActive ? 'active' : '';
        const dockStateCls = `${reelingActive ? 'active ' : ''}${rCls}`.trim();
        setClass(this.elReelRow, dockStateCls ? `hud-reel-dock ${dockStateCls}` : 'hud-reel-dock');
        setClass(this.elReelStatus, dockStateCls ? `reel-dock-status ${dockStateCls}` : 'reel-dock-status');
        setText(this.elReelMeters, `${remM}m / ${reelMaxMeters}m`);
        if (this.btnReelToggle) {
          setClass(this.btnReelToggle, reelingActive ? 'reel-btn active' : 'reel-btn');
          const prefix = this._isTouchDevice ? '' : '[G] ';
          setText(
            this.btnReelToggle,
            reelingActive
              ? `${prefix}TIE OFF`
              : remM < 1
                ? 'SPOOL EMPTY'
                : `${prefix}DEPLOY LINE`
          );
        }
        if (this.btnReelRewind) {
          setText(this.btnReelRewind, this._isTouchDevice ? 'REWIND ↩' : '[R] REWIND ↩');
        }
      } else {
        setHidden(this.elReelRow, true);
      }
    }

    // Ascent rate meter (0 to 18 m/min)
    const upRate = Math.max(0, diveState.ascentRateMPerMin);
    const pct = Math.min(100, Math.round((upRate / 18) * 100));
    setStyleProp(this.elAscentFill, 'height', `${pct}%`);
    setClass(this.elAscentFill, `dc-ascent-fill ${upRate > 12 ? 'danger' : upRate > 9 ? 'warn' : 'ok'}`);
    setText(this.elAscentVal, `${Math.round(upRate)}`);

    // Gas Tank Selectors & Optimal Depth Recommendation
    const resolvedAscent = ascentConfig || getAscentConfig(level);
    const ascending = checkpointsHit.has(resolvedAscent.turnaroundId);
    const recGasId = getRecommendedGas(diveState, { ascending });
    const ascentStep = getAscentInstruction(diveState, diver.y, checkpointsHit, resolvedAscent, nextCheckpoint);
    const gasCoach = getGasSwitchCoach(diveState, diver.y, { ascending });

    // One-tap interactive gas-switch callout banner (descent 22m TMX switch, wrong O2/hypoxic gas, or ascent switch)
    let calloutPrompt = gasCoach;
    if (!calloutPrompt && ascentStep && ascentStep.action === 'STOP' && ascentStep.targetGas && ascentStep.targetGas !== diveState.activeGasId) {
      const tMix = (diveState.mixes || GAS_MIXES)[ascentStep.targetGas] || GAS_MIXES[ascentStep.targetGas];
      const hk = GAS_HOTKEY_LABELS[ascentStep.targetGas] || '';
      calloutPrompt = {
        severity: 'warn',
        targetGas: ascentStep.targetGas,
        gasName: tMix?.name || ascentStep.targetGas,
        hotkey: hk,
        title: ascentStep.title,
        detail: ascentStep.detail,
      };
    }
    if (this.elGasCallout) {
      if (calloutPrompt) {
        this._gasCalloutTargetId = calloutPrompt.targetGas;
        setHidden(this.elGasCallout, false);
        setClass(this.elGasCallout, `hud-gas-callout ${calloutPrompt.severity === 'danger' ? 'danger' : 'warn'}`);
        setText(this.elGasCalloutTitle, `${calloutPrompt.severity === 'danger' ? '⛔' : '■'} ${calloutPrompt.title}`);
        setText(this.elGasCalloutDetail, calloutPrompt.detail);
        setText(
          this.elGasCalloutCta,
          this._isTouchDevice ? `TAP ${calloutPrompt.gasName}` : `TAP ${calloutPrompt.gasName} [${calloutPrompt.hotkey}]`
        );
      } else {
        this._gasCalloutTargetId = null;
        setHidden(this.elGasCallout, true);
      }
    }

    const mixMap = diveState.mixes || GAS_MIXES;
    for (const id of GAS_ORDER) {
      const tank = diveState.tanks[id];
      const mix = mixMap[id];
      const ui = this.tankButtons[id];
      setText(ui.nameEl, mix.name);
      setText(ui.metaEl, mix.role);
      const isActive = diveState.activeGasId === id;
      const isRec = (recGasId === id || calloutPrompt?.targetGas === id) && !isActive;
      const isUrgentRec = isRec && calloutPrompt?.severity === 'danger';
      const futurePPO2 = computePPO2(diveState.depthM, mix);
      const unsafeAtDepth = (futurePPO2 > 1.65 || (futurePPO2 < 0.16 && diveState.depthM > 0.2));
      const isEmpty = tank.bar <= 0.5;
      const btnCls = `dc-tank-btn${isActive ? ' active' : ''}${isRec ? ' recommended' : ''}${isUrgentRec ? ' urgent' : ''}${unsafeAtDepth ? ' unsafe' : ''}${isEmpty ? ' empty' : ''}`;
      setClass(ui.btn, btnCls);
      const recBadge = this._isTouchDevice ? 'TAP!' : `TAP [${GAS_HOTKEY_LABELS[id]}]`;
      setText(ui.barTxt, isRec ? recBadge : `${Math.round(tank.bar)}b`);
      const fillPct = Math.max(0, Math.min(100, Math.round((tank.bar / mix.startBar) * 200) * 0.5));
      setStyleProp(ui.fill, 'width', `${fillPct}%`);
      setStyleProp(ui.fill, 'backgroundColor', tank.bar < 45 ? '#ef4444' : mix.color);
    }

    // Alerts Strip (uses active level mixMap so gasOverrides on L12–L20 display accurately)
    if (gasCoach && gasCoach.severity === 'danger') {
      setText(this.elAlerts, gasCoach.title);
      setClass(this.elAlerts, 'dc-alerts danger');
    } else if (diveState.warnings.length > 0) {
      setText(this.elAlerts, diveState.warnings[0]);
      setClass(this.elAlerts, `dc-alerts ${diveState.criticalAlarm ? 'danger' : 'warn'}`);
    } else if (myBpm >= 138) {
      setText(this.elAlerts, `♥ ${myBpm} BPM — RELEASE CONTROLS TO CALM`);
      setClass(this.elAlerts, 'dc-alerts warn');
    } else if (gasCoach) {
      setText(this.elAlerts, gasCoach.title);
      setClass(this.elAlerts, 'dc-alerts warn');
    } else if (ascentStep) {
      setText(this.elAlerts, ascentStep.title);
      setClass(this.elAlerts, `dc-alerts ${ascentStep.action === 'STOP' ? 'warn' : 'ok'}`);
    } else if (recGasId !== diveState.activeGasId) {
      setText(this.elAlerts, `SWITCH → ${(mixMap[recGasId] || GAS_MIXES[recGasId]).name}`);
      setClass(this.elAlerts, 'dc-alerts warn');
    } else {
      setText(this.elAlerts, `${(mixMap[diveState.activeGasId] || GAS_MIXES[diveState.activeGasId]).name} · NOMINAL`);
      setClass(this.elAlerts, 'dc-alerts ok');
    }

    // Concise Objective Tracker
    const recName = (mixMap[recGasId] || GAS_MIXES[recGasId]).name;
    const gasBadge = recGasId === diveState.activeGasId
      ? `<span class="obj-gas ok">✓ ${recName}</span>`
      : `<span class="obj-gas switch">→ ${recName}</span>`;

    const extraStat =
      collectiblesTotal > 0
        ? `<span class="obj-extra">💎${collectedCount}/${collectiblesTotal} · 🧭${exploredPct}%</span>`
        : '';

    const isProbe = level?.recoveryTarget?.kind === 'probe';
    const recoveryTag = level?.recoveryTarget
      ? carryingBody
        ? isProbe ? ' · 🛰 CORE' : ' · 🛟 TOW'
        : bodyRecovered
          ? ' · ✓ REC'
          : isProbe ? ' · 🛰 PROBE' : ' · 🛟 BODY'
      : '';
    let objectiveHtml = '';
    if (gasCoach && (gasCoach.severity === 'danger' || !ascentStep)) {
      const cls = gasCoach.severity === 'danger' ? 'danger' : 'stop';
      const icon = gasCoach.severity === 'danger' ? '⛔' : '■';
      objectiveHtml = `
        <div class="obj-top-row">
          <span class="obj-count">GAS SWITCH · CP ${checkpointsHit.size}/${totalCheckpoints}${extraStat}${recoveryTag}</span>
          ${gasBadge}
        </div>
        <div class="obj-action ${cls}">${icon} ${gasCoach.title}</div>
        <span class="obj-hint">${gasCoach.detail}</span>
      `;
    } else if (ascentStep && (!level?.recoveryTarget || bodyRecovered)) {
      const cls = ascentStep.action === 'STOP' ? 'stop' : 'move';
      const icon = ascentStep.action === 'STOP' ? '■' : '▲';
      objectiveHtml = `
        <div class="obj-top-row">
          <span class="obj-count">ASCENT · CP ${checkpointsHit.size}/${totalCheckpoints}${extraStat}${recoveryTag}</span>
          ${gasBadge}
        </div>
        <div class="obj-action ${cls}">${icon} ${ascentStep.title}</div>
        <span class="obj-hint">${ascentStep.detail}</span>
      `;
    } else if (nextCheckpoint) {
      if (level?.hideWaypointCompass) {
        objectiveHtml = `
          <div class="obj-top-row">
            <span class="obj-count">MAZE · CP ${checkpointsHit.size}/${totalCheckpoints}${extraStat}${recoveryTag}</span>
            ${gasBadge}
          </div>
          <span class="obj-name">${level.recoveryTarget && !bodyRecovered ? `Recover ${level.recoveryTarget.name} (${Math.round(level.recoveryTarget.y)}m)` : `Tag cave hubs (${checkpointsHit.size}/${totalCheckpoints})`}</span>
          <span class="obj-hint">Unlined · [G] deploy reel (${Math.round(reelRemainingM)}m)</span>
        `;
      } else {
        const dist = Math.hypot(nextCheckpoint.x - diver.x, nextCheckpoint.y - diver.y);
        const dir = nextCheckpoint.x > diver.x + 1.5 ? '→' : nextCheckpoint.x < diver.x - 1.5 ? '←' : '';
        const vDir = nextCheckpoint.y > diver.y + 1.5 ? '↓' : nextCheckpoint.y < diver.y - 1.5 ? '↑' : '';
        objectiveHtml = `
          <div class="obj-top-row">
            <span class="obj-count">CP ${checkpointsHit.size}/${totalCheckpoints}${extraStat}</span>
            ${gasBadge}
          </div>
          <span class="obj-name">${dir}${vDir} ${nextCheckpoint.name} (${Math.round(dist)}m)</span>
          <span class="obj-hint">${nextCheckpoint.hint}</span>
        `;
      }
    } else {
      if (level?.hideWaypointCompass) {
        const needsRecovery = Boolean(level?.recoveryTarget && !bodyRecovered);
        objectiveHtml = `
          <div class="obj-top-row">
            <span class="obj-count">CP ${checkpointsHit.size}/${totalCheckpoints}${extraStat}${recoveryTag}</span>
            ${gasBadge}
          </div>
          <span class="obj-name">${needsRecovery ? `Recover ${level.recoveryTarget.name} (${Math.round(level.recoveryTarget.y)}m)` : `↑ Locate ${exitZone?.name || 'Resurgence Exit'}`}</span>
          <span class="obj-hint">${needsRecovery ? `Recovery required before surfacing at ${exitZone?.name || 'exit'}` : `Follow your deployed line or ascend to ${exitZone?.name || 'surface exit'}`}</span>
        `;
      } else {
        const dist = Math.hypot(exitZone.x - diver.x, exitZone.y - diver.y);
        objectiveHtml = `
          <div class="obj-top-row">
            <span class="obj-count">CP ${checkpointsHit.size}/${totalCheckpoints}${extraStat}</span>
            ${gasBadge}
          </div>
          <span class="obj-name">↑ ${exitZone.name} (${Math.round(dist)}m)</span>
          <span class="obj-hint">Ascend smoothly to surface exit</span>
        `;
      }
    }
    if (objectiveHtml !== this._lastObjectiveHtml) {
      this._lastObjectiveHtml = objectiveHtml;
      this.elObjective.innerHTML = objectiveHtml;
    }

    // Team Vitals & Live EKG Monitors (LAN Multiplayer, keyed DOM reuse so EKG traces sweep smoothly)
    const teamList = Array.isArray(peers) ? peers : (peerDiver ? [peerDiver] : []);
    if (teamList.length > 0) {
      setHidden(this.elBuddy, false);
      const seenIds = this._seenPeerIds;
      seenIds.clear();
      for (const p of teamList) {
        const pid = p.id || p.name || 'peer';
        seenIds.add(pid);
        let ui = this.mateCards.get(pid);
        if (!ui) {
          const card = document.createElement('div');
          card.className = 'mate-card';
          card.innerHTML = `
            <div class="mate-top">
              <span class="mate-name"></span>
              <span class="mate-cond"></span>
            </div>
            <div class="mate-meta">
              <span class="mate-pos"></span>
              <span class="mate-gas"></span>
            </div>
            <div class="mate-bars">
              <div class="mate-bar" title="Gas Remaining"><div class="mate-bar-fill mate-gas-fill"></div></div>
              <div class="mate-bar" title="Physiological Stress"><div class="mate-bar-fill mate-stress-fill"></div></div>
            </div>
            <div class="mate-ekg-row">
              <span class="mate-hr">♥ --</span>
              <canvas class="mate-ekg-canvas" width="110" height="18"></canvas>
            </div>
          `;
          this.elBuddy.appendChild(card);
          const canvasEl = card.querySelector('.mate-ekg-canvas');
          const ekg = createEkgState(110);
          if (canvasEl) {
            this._ekgStateByCanvas.set(canvasEl, ekg);
            this._ekgResizeObserver?.observe(canvasEl);
          }
          ui = {
            card,
            nameEl: card.querySelector('.mate-name'),
            condEl: card.querySelector('.mate-cond'),
            posEl: card.querySelector('.mate-pos'),
            gasEl: card.querySelector('.mate-gas'),
            gasFill: card.querySelector('.mate-gas-fill'),
            stressFill: card.querySelector('.mate-stress-fill'),
            hrEl: card.querySelector('.mate-hr'),
            canvasEl,
            ekg,
          };
          this.mateCards.set(pid, ui);
        }

        const dist = Math.hypot(p.x - diver.x, p.y - diver.y);
        const bar = Math.round(p.activeBar ?? 200);
        const mateMix = mixMap[p.gasId] || GAS_MIXES[p.gasId];
        const startBar = mateMix?.startBar || 200;
        const gasPct = Math.max(0, Math.min(100, Math.round((bar / startBar) * 100)));
        const stress = Math.round(
          Math.max(
            p.cnsPercent || 0,
            p.dcsStress || 0,
            p.hypoxiaStress || 0,
            p.cardiacStress || 0,
            (p.narcosisLevel || 0) * 80
          )
        );
        const mateBpm = p.alive === false ? 0 : Math.round(p.heartRateBpm ?? 68);
        const cond = p.alive === false ? 'DOWN' : (p.condition || 'NOMINAL');
        const sevCls =
          p.alive === false ||
          cond === 'NO GAS' ||
          cond === 'HYPOXIA' ||
          cond === 'O2 TOX' ||
          stress >= 65 ||
          mateBpm >= 150
            ? 'danger'
            : cond !== 'NOMINAL' || bar < 50 || stress >= 25 || mateBpm >= 118
              ? 'warn'
              : '';
        const gasColor = bar < 45 ? '#ef4444' : (mateMix?.color || '#38bdf8');
        const stressColor = stress >= 65 ? '#ef4444' : stress >= 25 ? '#fbbf24' : '#4ade80';

        setClass(ui.card, sevCls ? `mate-card ${sevCls}` : 'mate-card');
        setText(ui.nameEl, p.name || 'Buddy');
        setClass(ui.condEl, sevCls ? `mate-cond ${sevCls}` : 'mate-cond');
        setText(ui.condEl, cond);
        setText(ui.posEl, `${(p.depthM ?? 0).toFixed(1)}m · ${Math.round(dist)}m away`);
        setText(ui.gasEl, `${mateMix?.name || p.gasId || 'EAN32'} ${bar}b`);
        setStyleProp(ui.gasFill, 'width', `${gasPct}%`);
        setStyleProp(ui.gasFill, 'background', gasColor);
        setStyleProp(ui.stressFill, 'width', `${stress}%`);
        setStyleProp(ui.stressFill, 'background', stressColor);

        const hrCls = p.alive === false || mateBpm >= 145 ? 'danger' : mateBpm >= 115 ? 'warn' : '';
        setClass(ui.hrEl, hrCls ? `mate-hr ${hrCls}` : 'mate-hr');
        setText(ui.hrEl, p.alive === false ? '♥ --' : `♥ ${mateBpm}`);
        stepAndDrawEkg(ui.canvasEl, ui.ekg, mateBpm, p.alive !== false, dt);
      }

      for (const [pid, ui] of this.mateCards.entries()) {
        if (!seenIds.has(pid)) {
          if (ui.canvasEl) {
            this._ekgResizeObserver?.unobserve(ui.canvasEl);
            ui.canvasEl.width = 0;
            ui.canvasEl.height = 0;
          }
          ui.card.remove();
          this.mateCards.delete(pid);
        }
      }
    } else {
      setHidden(this.elBuddy, true);
      if (this.mateCards.size > 0) {
        for (const ui of this.mateCards.values()) {
          if (ui.canvasEl) {
            this._ekgResizeObserver?.unobserve(ui.canvasEl);
            ui.canvasEl.width = 0;
            ui.canvasEl.height = 0;
          }
          ui.card.remove();
        }
        this.mateCards.clear();
      }
    }
  }
}
