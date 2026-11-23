/**
 * Interactive Dive Computer Depth Profile SVG Chart & Telemetry Scrubber (v144).
 *
 * Extracted from main.js into a standalone UI module supporting local gas-colored
 * depth curves, deco-stop shading, co-op buddy overlay traces, and pointer scrubbing.
 */

import { sampleDiveProfileAtTime } from '../game/hud.js';
import { formatClock as defaultFormatClock } from '../util/common.js';

const CHART_W = 420;
const CHART_H = 124;
const PAD_L = 34;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 20;
const PLOT_W = CHART_W - PAD_L - PAD_R;
const PLOT_H = CHART_H - PAD_T - PAD_B;
const BUDDY_PALETTE = ['#f472b6', '#c084fc', '#fb923c'];

function defaultGasColor(g) {
  return g === 'O2' ? '#34d399' : g === 'TMX1455' ? '#fbbf24' : '#38bdf8';
}

function defaultEscapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Pure deterministic layout & SVG markup builder for the dive depth profile chart.
 */
export function buildDebriefDepthChartData(
  profile,
  maxDepthM,
  { success = true, peerProfiles = null, highlights = null, formatRunClock = defaultFormatClock, escapeHtml = defaultEscapeHtml } = {}
) {
  if (!Array.isArray(profile) || profile.length < 2) {
    return null;
  }

  const buddyTraces = [];
  if (peerProfiles instanceof Map) {
    for (const rec of peerProfiles.values()) {
      if (rec && Array.isArray(rec.points) && rec.points.length >= 2) {
        buddyTraces.push(rec);
      }
    }
  }

  let maxT = Math.max(10, profile[profile.length - 1].t || 10);
  let peakAllD = Math.max(maxDepthM || 0, ...profile.map((p) => p.d));
  for (const bt of buddyTraces) {
    const lastPt = bt.points[bt.points.length - 1];
    if (lastPt?.t > maxT) maxT = lastPt.t;
    for (const pt of bt.points) {
      if (pt.d > peakAllD) peakAllD = pt.d;
    }
  }
  const maxD = Math.max(12, Math.ceil(peakAllD / 10) * 10);

  const sx = (t) => PAD_L + (t / maxT) * PLOT_W;
  const sy = (d) => PAD_T + (d / maxD) * PLOT_H;

  let markup = '';
  for (const frac of [0, 0.5, 1]) {
    const dVal = Math.round(maxD * frac);
    const y = sy(dVal).toFixed(1);
    markup += `<line x1="${PAD_L}" y1="${y}" x2="${CHART_W - PAD_R}" y2="${y}" stroke="rgba(148,163,184,0.16)" stroke-dasharray="${frac === 0 ? '' : '3 3'}"/>`;
    markup += `<text x="${PAD_L - 5}" y="${Number(y) + 3}" text-anchor="end" fill="#94a3b8" font-size="9" font-family="ui-monospace,monospace">${dVal}m</text>`;
  }

  let areaPts = `${sx(profile[0].t).toFixed(1)},${PAD_T} `;
  for (const p of profile) {
    areaPts += `${sx(p.t).toFixed(1)},${sy(p.d).toFixed(1)} `;
  }
  areaPts += `${sx(profile[profile.length - 1].t).toFixed(1)},${PAD_T}`;
  markup += `<polygon points="${areaPts}" fill="rgba(14,165,233,0.12)"/>`;

  buddyTraces.forEach((bt, bIdx) => {
    const col = BUDDY_PALETTE[bIdx % BUDDY_PALETTE.length];
    const polyPts = bt.points.map((pt) => `${sx(pt.t).toFixed(1)},${sy(pt.d).toFixed(1)}`).join(' ');
    markup += `<polyline points="${polyPts}" fill="none" stroke="${col}" stroke-width="1.8" stroke-dasharray="4 3" stroke-linecap="round" stroke-linejoin="round" opacity="0.88"/>`;
  });

  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1];
    const b = profile[i];
    const x1 = sx(a.t).toFixed(1);
    const y1 = sy(a.d).toFixed(1);
    const x2 = sx(b.t).toFixed(1);
    const y2 = sy(b.d).toFixed(1);
    if (b.deco > 0 && Math.abs(b.d - b.deco) <= 2.2) {
      markup += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(52,211,153,0.35)" stroke-width="6" stroke-linecap="round"/>`;
    }
    markup += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${defaultGasColor(b.gas)}" stroke-width="2.3" stroke-linecap="round"/>`;
  }

  let peak = profile[0];
  for (const p of profile) {
    if (p.d > peak.d) peak = p;
  }
  const px = sx(peak.t).toFixed(1);
  const py = sy(peak.d).toFixed(1);
  markup += `<circle cx="${px}" cy="${py}" r="3.4" fill="#f87171" stroke="#0f172a" stroke-width="1.2"/>`;
  markup += `<text x="${Math.min(CHART_W - 44, Math.max(PAD_L + 24, Number(px)))}" y="${Math.min(CHART_H - 5, Number(py) + 12)}" text-anchor="middle" fill="#fca5a5" font-size="9" font-weight="700" font-family="ui-monospace,monospace">MAX ${peak.d.toFixed(0)}m</text>`;

  const endP = profile[profile.length - 1];
  markup += `<circle cx="${sx(endP.t).toFixed(1)}" cy="${sy(endP.d).toFixed(1)}" r="3.4" fill="${success ? '#34d399' : '#ef4444'}" stroke="#0f172a" stroke-width="1.2"/>`;
  markup += `<text x="${CHART_W - PAD_R}" y="${CHART_H - 4}" text-anchor="end" fill="#94a3b8" font-size="9" font-family="ui-monospace,monospace">${formatRunClock(maxT)}</text>`;

  // Clickable Black-Box Highlight & Pin diamond markers along the depth profile (v174)
  if (Array.isArray(highlights) && highlights.length > 0) {
    for (let hi = 0; hi < Math.min(8, highlights.length); hi++) {
      const hl = highlights[hi];
      const ht = Math.max(0, Math.min(maxT, Number(hl?.tSec) || 0));
      const sample = sampleDiveProfileAtTime(profile, ht);
      const hd = Number.isFinite(hl?.depthM) && hl.depthM > 0 ? hl.depthM : (sample?.d ?? 0);
      const hx = sx(ht).toFixed(1);
      const hy = sy(Math.min(maxD, Math.max(0, hd))).toFixed(1);
      const titleTxt = escapeHtml(`${hl.icon || '★'} ${hl.label || 'Highlight'} (${formatRunClock(ht)})`);
      markup += `<g class="debrief-hl-marker" data-hl-t="${ht.toFixed(2)}" style="cursor:pointer"><title>${titleTxt}</title><polygon points="${hx},${(Number(hy) - 4.4).toFixed(1)} ${(Number(hx) + 4.4).toFixed(1)},${hy} ${hx},${(Number(hy) + 4.4).toFixed(1)} ${(Number(hx) - 4.4).toFixed(1)},${hy}" fill="#facc15" stroke="#0f172a" stroke-width="1.1"/></g>`;
    }
  }

  if (buddyTraces.length > 0) {
    const names = buddyTraces
      .slice(0, 2)
      .map((bt, idx) => `<tspan fill="${BUDDY_PALETTE[idx % BUDDY_PALETTE.length]}">╌ ${escapeHtml((bt.name || 'Buddy').slice(0, 10))}</tspan>`)
      .join('  ');
    markup += `<text x="${CHART_W - PAD_R}" y="10" text-anchor="end" font-size="8.5" font-weight="700" font-family="ui-monospace,monospace"><tspan fill="#38bdf8">━ You</tspan>  ${names}</text>`;
  }

  markup += `<g id="debrief-scrub-cursor" visibility="hidden">`;
  markup += `<line id="debrief-scrub-line" x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${CHART_H - PAD_B}" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="3 2"/>`;
  markup += `<circle id="debrief-scrub-dot" cx="${PAD_L}" cy="${PAD_T}" r="4.2" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.8"/>`;
  markup += `</g>`;

  return {
    markup,
    maxT,
    maxD,
    peakDepthM: peak.d,
    buddyCount: buddyTraces.length,
    sx,
    sy,
  };
}

/**
 * Mount the interactive Debrief Depth Profile SVG chart + pointer scrubber onto DOM elements.
 */
export function renderDebriefDepthChart({
  wrapEl,
  svgEl,
  scrubEl,
  profile,
  maxDepthM,
  success,
  peerProfiles = null,
  highlights = null,
  onScrubTime = null,
  formatRunClock = defaultFormatClock,
  escapeHtml = defaultEscapeHtml,
}) {
  if (!wrapEl || !svgEl) return null;
  const chart = buildDebriefDepthChartData(profile, maxDepthM, {
    success,
    peerProfiles,
    highlights,
    formatRunClock,
    escapeHtml,
  });
  if (!chart) {
    wrapEl.hidden = true;
    return null;
  }
  wrapEl.hidden = false;
  svgEl.innerHTML = chart.markup;

  const cursorGroup = svgEl.querySelector?.('#debrief-scrub-cursor');
  const cursorLine = svgEl.querySelector?.('#debrief-scrub-line');
  const cursorDot = svgEl.querySelector?.('#debrief-scrub-dot');
  const defaultScrubHint = 'Hover or drag across the depth curve to scrub Dive Replay & inspect PPO₂, CNS%, GF99%, HR & Bar';
  if (scrubEl) scrubEl.textContent = defaultScrubHint;

  const setCursorTime = (tSec, { notify = false } = {}) => {
    const clampedT = Math.max(0, Math.min(chart.maxT, Number(tSec) || 0));
    const sample = sampleDiveProfileAtTime(profile, clampedT);
    if (!sample) return null;
    const cx = chart.sx(sample.t).toFixed(1);
    const cy = chart.sy(sample.d).toFixed(1);
    if (cursorGroup) cursorGroup.setAttribute('visibility', 'visible');
    if (cursorLine) {
      cursorLine.setAttribute('x1', cx);
      cursorLine.setAttribute('x2', cx);
    }
    if (cursorDot) {
      cursorDot.setAttribute('cx', cx);
      cursorDot.setAttribute('cy', cy);
    }
    if (scrubEl) {
      const decoTxt = sample.deco > 0 ? ` · STOP ${sample.deco}m` : '';
      scrubEl.textContent =
        `⏱ ${formatRunClock(sample.t)} · ${sample.d.toFixed(1)}m · ${sample.gas} (${sample.bar}b) · PPO₂ ${sample.ppo2.toFixed(2)} · CNS ${sample.cns}% · GF99 ${sample.gf99}% · ♥ ${sample.hr}bpm${decoTxt}`;
    }
    if (notify && typeof onScrubTime === 'function') {
      onScrubTime(sample.t);
    }
    return sample;
  };

  const clearCursor = () => {
    if (cursorGroup) cursorGroup.setAttribute('visibility', 'hidden');
    if (scrubEl) scrubEl.textContent = defaultScrubHint;
  };

  const updateScrubFromClientX = (clientX) => {
    const rect = svgEl.getBoundingClientRect?.();
    if (!rect || rect.width <= 0) return;
    const svgX = ((clientX - rect.left) / rect.width) * CHART_W;
    const clampedFrac = Math.max(0, Math.min(1, (svgX - PAD_L) / PLOT_W));
    setCursorTime(clampedFrac * chart.maxT, { notify: true });
  };
  svgEl.onpointermove = (e) => updateScrubFromClientX(e.clientX);
  svgEl.onpointerdown = (e) => {
    const hlEl = e.target?.closest?.('[data-hl-t]');
    if (hlEl) {
      setCursorTime(Number(hlEl.getAttribute('data-hl-t')) || 0, { notify: true });
      return;
    }
    updateScrubFromClientX(e.clientX);
  };
  svgEl.onpointerleave = () => {
    // Keep cursor visible when Replay Theater is actively synced; reset hint text only if no active sync callback
    if (typeof onScrubTime !== 'function') clearCursor();
  };

  return { setCursorTime, clearCursor, maxT: chart.maxT };
}
