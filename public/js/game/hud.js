import { GAS_MIXES, GAS_ORDER, computePPO2, getRecommendedGas, getAscentInstruction } from '../physics/diveModel.js';
import { getAscentConfig } from '../levels/index.js';

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
  };
}

function stepAndDrawEkg(canvas, state, bpm, alive, dt = 0.016) {
  if (!canvas) return false;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const w = canvas.width;
  const h = canvas.height;
  if (state.samples.length !== w) {
    state.samples = new Float32Array(w);
    state.cursor = 0;
  }

  const effectiveBpm = alive ? Math.max(40, Math.min(210, bpm || 68)) : 0;
  const beatHz = effectiveBpm / 60;
  const sweepPxPerSec = 48;
  const stepPx = sweepPxPerSec * dt;
  const prevCursor = state.cursor;
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

export class DiveComputerHUD {
  constructor({ onGasSelect, onReelToggle, onReelRewind }) {
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
    this.elDepth.textContent = diveState.depthM.toFixed(1);
    this.elMaxDepth.textContent = `MAX ${diveState.maxDepthM.toFixed(1)}m`;
    this.elTime.textContent = formatClock(diveState.diveTimeSec);

    // NDL vs Mandatory Deco Stop
    if (diveState.stopDepthM > 0) {
      const violating = diveState.depthM < diveState.ceilingM - 0.5;
      this.elDecoLabel.textContent = violating ? 'BELOW CEIL!' : `STOP ${diveState.stopDepthM}m`;
      this.elDecoVal.textContent = formatClock(diveState.stopRemainingSec);
      this.elDecoVal.className = `dc-val ${violating ? 'danger blink' : 'warn'}`;
      this.elDecoLabel.className = `dc-lbl ${violating ? 'danger' : 'warn'}`;
    } else {
      this.elDecoLabel.textContent = 'NDL';
      this.elDecoLabel.className = 'dc-lbl';
      this.elDecoVal.textContent = `${diveState.ndlMin}m`;
      this.elDecoVal.className = `dc-val ${diveState.ndlMin <= 2 ? 'warn' : 'ok'}`;
    }

    // PPO2 color grading
    this.elPPO2.textContent = diveState.ppo2.toFixed(2);
    if (diveState.ppo2 < 0.16 && diveState.depthM > 0.2) {
      this.elPPO2.className = 'dc-val cyan blink';
    } else if (diveState.ppo2 > 1.6) {
      this.elPPO2.className = 'dc-val danger blink';
    } else if (diveState.ppo2 > 1.4) {
      this.elPPO2.className = 'dc-val warn';
    } else {
      this.elPPO2.className = 'dc-val ok';
    }

    // CNS & END & Self Vitals Bars
    this.elCNS.textContent = `${Math.round(diveState.cnsPercent)}%`;
    this.elCNS.className = `dc-subval ${diveState.cnsPercent >= 80 ? 'danger' : diveState.cnsPercent >= 40 ? 'warn' : ''}`;
    this.elEND.textContent = `END ${Math.round(diveState.endM)}m`;
    this.elEND.className = `dc-subval ${diveState.narcosisLevel > 0.35 ? 'warn' : ''}`;

    this._updateVitalBar(this.vitalEls.tox, diveState.cnsPercent, 30, 70);
    this._updateVitalBar(this.vitalEls.dcs, diveState.dcsStress, 22, 65);
    this._updateVitalBar(this.vitalEls.narc, (diveState.narcosisLevel || 0) * 100, 28, 68);
    this._updateVitalBar(this.vitalEls.hyp, diveState.hypoxiaStress, 22, 65);

    // Local Heartbeat, Self Name & EKG Waveform Monitor
    const myBpm = diveState.alive === false ? 0 : Math.round(diveState.heartRateBpm ?? 68);
    if (this.elSelfName) {
      const cleanName = typeof playerName === 'string' ? playerName.trim() : '';
      const selfLabel = cleanName ? `YOU · ${cleanName}` : 'YOU';
      if (this.elSelfName.textContent !== selfLabel) this.elSelfName.textContent = selfLabel;
    }
    if (this.elEkgBpm) this.elEkgBpm.textContent = diveState.alive === false ? '--' : String(myBpm);
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
    if (this.elSelfHealth) {
      const selfCardCls = `self-health-card ${selfSev}`.trim();
      if (this.elSelfHealth.className !== selfCardCls) this.elSelfHealth.className = selfCardCls;
    }
    if (this.elEkgRow) {
      const hrCls = diveState.alive === false || myBpm >= 145 ? 'danger' : myBpm >= 115 ? 'warn' : '';
      this.elEkgRow.className = `dc-ekg-row ${hrCls}`.trim();
    }
    const qrsPeak = stepAndDrawEkg(this.elEkgCanvas, this.selfEkg, myBpm, diveState.alive !== false, dt);
    if (this.elEkgHeart) this.elEkgHeart.classList.toggle('pulse', qrsPeak);

    // Deployable Guideline Spool Dock & Bottom-Center Line Status (unlined labyrinth caves)
    const showReel = reelMaxMeters > 0;
    if (this.elReelStatus) this.elReelStatus.hidden = !showReel;
    if (this.elReelRow) {
      if (showReel) {
        this.elReelRow.hidden = false;
        const remM = Math.max(0, Math.round(reelRemainingM));
        const rCls = remM <= 1 ? 'danger' : remM < 35 ? 'warn' : reelingActive ? 'active' : '';
        this.elReelRow.className = `hud-reel-dock ${reelingActive ? 'active' : ''} ${rCls}`.replace(/\s+/g, ' ').trim();
        if (this.elReelStatus) {
          this.elReelStatus.className = `reel-dock-status ${reelingActive ? 'active' : ''} ${rCls}`.replace(/\s+/g, ' ').trim();
        }
        if (this.elReelMeters) this.elReelMeters.textContent = `${remM}m / ${reelMaxMeters}m`;
        if (this.btnReelToggle) {
          this.btnReelToggle.className = `reel-btn ${reelingActive ? 'active' : ''}`.trim();
          this.btnReelToggle.textContent = reelingActive
            ? '[G] TERMINATE LINE'
            : remM < 1
              ? 'SPOOL EMPTY'
              : '[G] DEPLOY LINE';
        }
      } else {
        this.elReelRow.hidden = true;
      }
    }

    // Ascent rate meter (0 to 18 m/min)
    const upRate = Math.max(0, diveState.ascentRateMPerMin);
    const pct = Math.min(100, (upRate / 18) * 100);
    this.elAscentFill.style.height = `${pct}%`;
    this.elAscentFill.className = `dc-ascent-fill ${upRate > 12 ? 'danger' : upRate > 9 ? 'warn' : 'ok'}`;
    this.elAscentVal.textContent = `${Math.round(upRate)}`;

    // Gas Tank Selectors & Optimal Depth Recommendation
    const resolvedAscent = ascentConfig || getAscentConfig(level);
    const ascending = checkpointsHit.has(resolvedAscent.turnaroundId);
    const recGasId = getRecommendedGas(diveState, { ascending });
    const ascentStep = getAscentInstruction(diveState, diver.y, checkpointsHit, resolvedAscent);

    const mixMap = diveState.mixes || GAS_MIXES;
    for (const id of GAS_ORDER) {
      const tank = diveState.tanks[id];
      const mix = mixMap[id];
      const ui = this.tankButtons[id];
      if (ui.nameEl) ui.nameEl.textContent = mix.name;
      if (ui.metaEl) ui.metaEl.textContent = mix.role;
      const isActive = diveState.activeGasId === id;
      const isRec = recGasId === id && !isActive;
      const futurePPO2 = computePPO2(diveState.depthM, mix);
      const unsafeAtDepth = (futurePPO2 > 1.6 || (futurePPO2 < 0.16 && diveState.depthM > 0.2));

      ui.btn.classList.toggle('active', isActive);
      ui.btn.classList.toggle('recommended', isRec);
      ui.btn.classList.toggle('unsafe', unsafeAtDepth);
      ui.btn.classList.toggle('empty', tank.bar <= 0.5);
      ui.barTxt.textContent = isRec ? 'USE!' : `${Math.round(tank.bar)}b`;
      const fillPct = Math.max(0, Math.min(100, (tank.bar / mix.startBar) * 100));
      ui.fill.style.width = `${fillPct}%`;
      ui.fill.style.backgroundColor = tank.bar < 45 ? '#ef4444' : mix.color;
    }

    // Alerts Strip
    if (diveState.warnings.length > 0) {
      this.elAlerts.textContent = diveState.warnings[0];
      this.elAlerts.className = `dc-alerts ${diveState.criticalAlarm ? 'danger' : 'warn'}`;
    } else if (ascentStep) {
      this.elAlerts.textContent = ascentStep.title;
      this.elAlerts.className = `dc-alerts ${ascentStep.action === 'STOP' ? 'warn' : 'ok'}`;
    } else if (recGasId !== diveState.activeGasId) {
      this.elAlerts.textContent = `SWITCH → ${GAS_MIXES[recGasId].name}`;
      this.elAlerts.className = 'dc-alerts warn';
    } else {
      this.elAlerts.textContent = `${GAS_MIXES[diveState.activeGasId].name} · NOMINAL`;
      this.elAlerts.className = 'dc-alerts ok';
    }

    // Concise Objective Tracker
    const recName = GAS_MIXES[recGasId].name;
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
    if (ascentStep && (!level?.recoveryTarget || bodyRecovered)) {
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
        objectiveHtml = `
          <div class="obj-top-row">
            <span class="obj-count">CP ${checkpointsHit.size}/${totalCheckpoints}${extraStat}</span>
            ${gasBadge}
          </div>
          <span class="obj-name">↑ Locate Resurgence Exit</span>
          <span class="obj-hint">Follow your deployed line or ascend to East Karst Spring</span>
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
      this.elBuddy.hidden = false;
      const seenIds = new Set();
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
          ui = {
            card,
            nameEl: card.querySelector('.mate-name'),
            condEl: card.querySelector('.mate-cond'),
            posEl: card.querySelector('.mate-pos'),
            gasEl: card.querySelector('.mate-gas'),
            gasFill: card.querySelector('.mate-gas-fill'),
            stressFill: card.querySelector('.mate-stress-fill'),
            hrEl: card.querySelector('.mate-hr'),
            canvasEl: card.querySelector('.mate-ekg-canvas'),
            ekg: createEkgState(110),
          };
          this.mateCards.set(pid, ui);
        }

        const dist = Math.hypot(p.x - diver.x, p.y - diver.y);
        const bar = Math.round(p.activeBar ?? 200);
        const gasPct = Math.max(0, Math.min(100, (bar / 200) * 100));
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
        const gasColor = bar < 45 ? '#ef4444' : (GAS_MIXES[p.gasId]?.color || '#38bdf8');
        const stressColor = stress >= 65 ? '#ef4444' : stress >= 25 ? '#fbbf24' : '#4ade80';

        ui.card.className = `mate-card ${sevCls}`.trim();
        ui.nameEl.textContent = p.name || 'Buddy';
        ui.condEl.className = `mate-cond ${sevCls}`.trim();
        ui.condEl.textContent = cond;
        ui.posEl.textContent = `${(p.depthM ?? 0).toFixed(1)}m · ${Math.round(dist)}m away`;
        ui.gasEl.textContent = `${p.gasId || 'EAN32'} ${bar}b`;
        ui.gasFill.style.width = `${gasPct}%`;
        ui.gasFill.style.background = gasColor;
        ui.stressFill.style.width = `${stress}%`;
        ui.stressFill.style.background = stressColor;

        const hrCls = p.alive === false || mateBpm >= 145 ? 'danger' : mateBpm >= 115 ? 'warn' : '';
        ui.hrEl.className = `mate-hr ${hrCls}`.trim();
        ui.hrEl.textContent = p.alive === false ? '♥ --' : `♥ ${mateBpm}`;
        stepAndDrawEkg(ui.canvasEl, ui.ekg, mateBpm, p.alive !== false, dt);
      }

      for (const [pid, ui] of this.mateCards.entries()) {
        if (!seenIds.has(pid)) {
          ui.card.remove();
          this.mateCards.delete(pid);
        }
      }
    } else {
      this.elBuddy.hidden = true;
      for (const ui of this.mateCards.values()) {
        ui.card.remove();
      }
      this.mateCards.clear();
    }
  }
}
