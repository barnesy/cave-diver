#!/usr/bin/env node
/**
 * 4-Diver Hardcore Stress Test & Live Bot Crew Runner (v140).
 *
 * Usage:
 *   1. Full automated 4-diver headless WebSocket + Hardcore physics stress benchmark:
 *        node scripts/stress-4diver.mjs
 *        node scripts/stress-4diver.mjs --level orda-crystal-maze --ticks 360
 *
 *   2. Drop 3 live autonomous bot divers into YOUR local browser room (`npm start`):
 *        node scripts/stress-4diver.mjs --join ABCD
 *        node scripts/stress-4diver.mjs --join ABCD --bots 3 --difficulty hardcore --aggressive
 */

import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { WebSocket } from 'ws';
import { getLevelById } from '../public/js/levels/index.js';
import { createDiveSession, stepDiveSession } from '../public/js/game/diveSession.js';
import { evaluateCaveSDF } from '../public/js/game/collision.js';

const BOT_PROFILES = [
  { name: 'APEX-1', livery: { suitId: 'zissou-classic', torchId: 'tech-led', patchId: 'cave-arrow' } },
  { name: 'COBRA-2', livery: { suitId: 'arctic-cobalt', torchId: 'amber-silt', patchId: 'cenote-explorer' } },
  { name: 'ORCA-3', livery: { suitId: 'expedition-amber', torchId: 'warm-halogen', patchId: 'wreck-penetrator' } },
  { name: 'TITAN-4', livery: { suitId: 'wreck-titanium', torchId: 'emerald-spot', patchId: 'abyss-veteran' } },
];

function parseArgs(argv) {
  const args = {
    join: '',
    url: 'ws://127.0.0.1:3000/ws',
    bots: 3,
    level: 'cenote-el-abismo',
    ticks: 300,
    difficulty: 'hardcore',
    aggressive: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--join' && argv[i + 1]) args.join = argv[++i].trim().toUpperCase();
    else if (a === '--url' && argv[i + 1]) args.url = argv[++i];
    else if (a === '--bots' && argv[i + 1]) args.bots = Math.max(1, Math.min(3, parseInt(argv[++i], 10) || 3));
    else if (a === '--level' && argv[i + 1]) args.level = argv[++i];
    else if (a === '--ticks' && argv[i + 1]) args.ticks = Math.max(60, parseInt(argv[++i], 10) || 300);
    else if (a === '--difficulty' && argv[i + 1]) args.difficulty = argv[++i];
    else if (a === '--aggressive') args.aggressive = true;
  }
  return args;
}

function nextMsg(ws, type, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', handler);
      reject(new Error(`Timed out waiting for WS "${type}"`));
    }, timeoutMs);
    const handler = (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === type) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(msg);
        }
      } catch {}
    };
    ws.on('message', handler);
  });
}

function buildStatePacket(sess, seq) {
  const { diver, diveState } = sess;
  const tank = diveState.tanks?.[diveState.activeGasId];
  return {
    seq,
    x: Number(diver.x.toFixed(3)),
    y: Number(diver.y.toFixed(3)),
    vx: Number(diver.vx.toFixed(3)),
    vy: Number(diver.vy.toFixed(3)),
    angle: Number((diver.angle || 0).toFixed(3)),
    gasId: diveState.activeGasId,
    activeBar: Math.round(tank?.bar || 0),
    cnsPercent: Math.round(diveState.cnsPercent || 0),
    dcsStress: Math.round(diveState.dcsStress || 0),
    heartRateBpm: Math.round(diveState.heartRateBpm || 75),
    depthM: Number((diveState.depthM || diver.y || 0).toFixed(2)),
    torchOn: true,
    torchAngle: Number((diver.torchAngle ?? diver.angle ?? 0).toFixed(3)),
    torchManualAim: false,
    livery: diver.livery || null,
    alive: diveState.alive !== false,
    surfaced: Boolean(sess.surfaced),
    name: sess.diverName,
  };
}

function computeSteerToward(diver, tx, ty, speedScale = 1.0) {
  const dx = tx - diver.x;
  const dy = ty - diver.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.25) return { x: 0, y: 0 };
  const mag = Math.min(1, dist / 2.4) * speedScale;
  return { x: (dx / dist) * mag, y: (dy / dist) * mag };
}

function percentile(sortedArr, p) {
  if (!sortedArr.length) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.floor((sortedArr.length - 1) * p));
  return sortedArr[idx];
}

/**
 * Mode 1: Headless 4-Diver Full-Stack Stress Benchmark (real server.js + 4 WS clients + Hardcore collisions)
 */
async function runHeadlessBenchmark(args) {
  const port = 3499;
  const level = getLevelById(args.level);
  console.log(`\n🤿 4-Diver Hardcore Stress Test — ${level.name} (${args.difficulty.toUpperCase()}, ${args.ticks} ticks @ 30Hz)`);

  const serverProc = spawn(process.execPath, ['server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const sockets = [];
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('LAN server startup timeout')), 6000);
      serverProc.stdout.on('data', (chunk) => {
        if (chunk.toString().includes('LAN Server Ready')) {
          clearTimeout(timer);
          resolve();
        }
      });
      serverProc.stderr.on('data', (chunk) => {
        clearTimeout(timer);
        reject(new Error(chunk.toString()));
      });
    });

    // Connect 4 real WebSocket clients
    const clients = [];
    for (let i = 0; i < 4; i++) {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      sockets.push(ws);
      const welcome = await nextMsg(ws, 'welcome');
      clients.push({
        slot: i,
        ws,
        playerId: welcome.playerId,
        profile: BOT_PROFILES[i],
        peers: new Map(),
        rxPackets: 0,
        rxBytes: 0,
        liveryChecks: 0,
        seq: 0,
      });
    }

    // Create 4-player room and join all 4 divers
    const createdP = nextMsg(clients[0].ws, 'room_joined');
    clients[0].ws.send(JSON.stringify({ type: 'create_room', name: clients[0].profile.name, maxPlayers: 4 }));
    const created = await createdP;
    const code = created.room.code;
    if (created.room.levelId !== level.id) {
      const updP = nextMsg(clients[0].ws, 'room_update');
      clients[0].ws.send(JSON.stringify({ type: 'set_level', levelId: level.id }));
      await updP;
    }

    for (let i = 1; i < 4; i++) {
      const joinP = nextMsg(clients[i].ws, 'room_joined');
      clients[i].ws.send(JSON.stringify({ type: 'join_room', code, name: clients[i].profile.name }));
      await joinP;
    }

    const startPromises = clients.map((c) => nextMsg(c.ws, 'dive_started'));
    clients[0].ws.send(JSON.stringify({ type: 'start_dive' }));
    await Promise.all(startPromises);

    // Attach live peer_state listeners on all 4 sockets
    for (const c of clients) {
      c.ws.on('message', (raw) => {
        const str = raw.toString();
        c.rxBytes += Buffer.byteLength(str, 'utf8');
        let msg;
        try { msg = JSON.parse(str); } catch { return; }
        if (msg.type === 'peer_state' && msg.playerId && msg.playerId !== c.playerId) {
          c.rxPackets += 1;
          if (msg.state?.livery?.suitId) c.liveryChecks += 1;
          c.peers.set(msg.playerId, { id: msg.playerId, ...msg.state });
        }
      });
    }

    // Create 4 real Hardcore dive sessions with spawn offsets
    const slotOffsets = [0, -1.35, 1.35, -2.5];
    const sessions = clients.map((c, idx) => {
      const s = createDiveSession(level, {
        diverName: c.profile.name,
        spawnOffsetX: slotOffsets[idx],
        difficulty: args.difficulty,
        livery: c.profile.livery,
      });
      s.simTimeSec = 2.5; // Past surface spawn grace window so collisions engage immediately
      return s;
    });

    // Place divers along the first real cave corridor for immediate high-density crossing stress
    const cp0 = level.checkpoints[0] || level.spawn;
    const cp1 = level.checkpoints[1] || cp0;
    const midX = (cp0.x + cp1.x) * 0.5;
    const midY = (cp0.y + cp1.y) * 0.5;
    for (let i = 0; i < 4; i++) {
      const startTarget = i % 2 === 0 ? cp0 : cp1;
      sessions[i].diver.x = startTarget.x + (i - 1.5) * 0.45;
      sessions[i].diver.y = startTarget.y;
    }

    const dt = 1 / 30;
    const tickTimesMs = [];
    let totalBumps = 0;
    let totalWallClips = 0;
    let totalNaNs = 0;
    let minPairDist = Infinity;
    let totalTxPackets = 0;
    let totalTxBytes = 0;

    const benchStart = performance.now();
    for (let tick = 0; tick < args.ticks; tick++) {
      const t0 = performance.now();

      for (let i = 0; i < 4; i++) {
        const c = clients[i];
        const s = sessions[i];
        // Pair 0&2 swim cp0->cp1, Pair 1&3 swim cp1->cp0 so all 4 repeatedly cross head-on in the restriction!
        const phase = Math.floor(tick / 90) % 2;
        const goForward = (i % 2 === 0) ? phase === 0 : phase === 1;
        const target = goForward ? cp1 : cp0;
        const wobbleY = Math.sin(tick * 0.11 + i * 1.7) * 0.45;
        const thrust = computeSteerToward(s.diver, tick % 90 < 45 ? midX : target.x, (tick % 90 < 45 ? midY : target.y) + wobbleY, 0.95);

        // Combine live WS-relayed peer snapshots (falling back to current sim peers on tick 0)
        const livePeers = c.peers.size > 0
          ? Array.from(c.peers.values())
          : sessions.filter((_, j) => j !== i).map((os, j) => ({ id: clients[j].playerId, name: os.diverName, ...os.diver, alive: true, surfaced: false }));

        stepDiveSession(s, thrust, dt, {
          peers: livePeers,
          onImpactSound: () => { totalBumps += 1; },
        });

        // Safety checks: finite numbers & strictly inside open cave water
        if (!Number.isFinite(s.diver.x) || !Number.isFinite(s.diver.y) || !Number.isFinite(s.diver.vx) || !Number.isFinite(s.diver.vy)) {
          totalNaNs += 1;
        }
        const sdf = evaluateCaveSDF(level, s.diver.x, s.diver.y);
        if (sdf >= 0.05) {
          totalWallClips += 1;
        }

        // Transmit real WebSocket player_state packet
        c.seq += 1;
        const payload = JSON.stringify({ type: 'player_state', state: buildStatePacket(s, c.seq) });
        totalTxPackets += 1;
        totalTxBytes += Buffer.byteLength(payload, 'utf8');
        c.ws.send(payload);
      }

      // Measure pairwise spacing across all 6 diver pairs
      for (let a = 0; a < 4; a++) {
        for (let b = a + 1; b < 4; b++) {
          const d = Math.hypot(sessions[a].diver.x - sessions[b].diver.x, sessions[a].diver.y - sessions[b].diver.y);
          if (d < minPairDist) minPairDist = d;
        }
      }

      tickTimesMs.push(performance.now() - t0);
      // Brief 4ms yield every 5 ticks so live WS frames flush & relay realistically
      if (tick % 5 === 4) await new Promise((r) => setTimeout(r, 4));
    }

    // Allow final in-flight WS packets to settle
    await new Promise((r) => setTimeout(r, 60));
    const wallElapsedSec = (performance.now() - benchStart) / 1000;

    // Phase B: Multi-site 4-diver pinch gauntlet across tight caves & wrecks
    const gauntletSites = ['cenote-el-abismo', 'orda-crystal-maze', 'ss-thistlegorm-wreck', 'krubera-voronya-abyssal'];
    let gauntletClips = 0;
    let gauntletNaNs = 0;
    let gauntletBumps = 0;
    for (const siteId of gauntletSites) {
      const gLvl = getLevelById(siteId);
      const anchor = gLvl.checkpoints[Math.min(1, gLvl.checkpoints.length - 1)] || gLvl.spawn;
      const gSessions = BOT_PROFILES.map((bp, i) => {
        const gs = createDiveSession(gLvl, { diverName: bp.name, difficulty: 'hardcore', livery: bp.livery });
        gs.simTimeSec = 10;
        const ang = (i * Math.PI) / 2;
        gs.diver.x = anchor.x + Math.cos(ang) * 2.2;
        gs.diver.y = anchor.y + Math.sin(ang) * 1.1;
        gs.diver.vx = -Math.cos(ang) * 2.4;
        gs.diver.vy = -Math.sin(ang) * 1.2;
        return gs;
      });
      for (let t = 0; t < 120; t++) {
        for (let i = 0; i < 4; i++) {
          const gs = gSessions[i];
          const peers = gSessions
            .filter((_, j) => j !== i)
            .map((os, j) => ({ id: `g-${j}`, name: os.diverName, x: os.diver.x, y: os.diver.y, vx: os.diver.vx, vy: os.diver.vy, alive: true, surfaced: false }));
          const thrust = { ...computeSteerToward(gs.diver, anchor.x, anchor.y, 1.0), boost: true };
          stepDiveSession(gs, thrust, 1 / 30, {
            peers,
            onImpactSound: () => { gauntletBumps += 1; },
          });
          if (!Number.isFinite(gs.diver.x) || !Number.isFinite(gs.diver.y)) gauntletNaNs += 1;
          if (evaluateCaveSDF(gLvl, gs.diver.x, gs.diver.y) >= 0.05) gauntletClips += 1;
        }
      }
    }

    const sortedTicks = tickTimesMs.slice().sort((a, b) => a - b);
    const avgTick = tickTimesMs.reduce((s, v) => s + v, 0) / tickTimesMs.length;
    const p95Tick = percentile(sortedTicks, 0.95);
    const maxTick = sortedTicks[sortedTicks.length - 1] || 0;
    const totalRxPackets = clients.reduce((s, c) => s + c.rxPackets, 0);
    const totalRxBytes = clients.reduce((s, c) => s + c.rxBytes, 0);
    const totalLiveryChecks = clients.reduce((s, c) => s + c.liveryChecks, 0);

    console.log('────────────────────────────────────────────────────────────');
    console.log(`  Room Code        : ${code} (4/4 live WebSocket divers)`);
    console.log(`  Sim Budget       : avg ${avgTick.toFixed(2)}ms · p95 ${p95Tick.toFixed(2)}ms · max ${maxTick.toFixed(2)}ms (all 4 divers/tick)`);
    console.log(`  WS Relay Fan-Out : ${totalTxPackets} TX → ${totalRxPackets} RX packets (${(totalRxBytes / 1024 / Math.max(0.1, wallElapsedSec)).toFixed(1)} KB/s)`);
    console.log(`  Livery Integrity : ${totalLiveryChecks}/${totalRxPackets} relayed peer_state frames carried custom rig livery`);
    console.log(`  Hardcore Bumps   : ${totalBumps} corridor impacts · ${gauntletBumps} multi-site pinch impacts`);
    console.log(`  Min Pair Spacing : ${minPairDist.toFixed(2)}m across 6 diver pairs`);
    console.log(`  Safety Invariants: ${totalWallClips + gauntletClips} rock clips · ${totalNaNs + gauntletNaNs} NaN states`);
    console.log('────────────────────────────────────────────────────────────');

    const failed = totalWallClips > 0 || gauntletClips > 0 || totalNaNs > 0 || gauntletNaNs > 0 || totalRxPackets === 0;
    if (failed) {
      console.error('❌ STRESS TEST FAILED — safety or relay invariant violated!');
      process.exitCode = 1;
    } else {
      console.log('✅ 4-DIVER HARDCORE STRESS TEST PASSED!');
    }
  } finally {
    for (const ws of sockets) {
      try { ws.close(); } catch {}
    }
    try { serverProc.kill(); } catch {}
  }
}

/**
 * Mode 2: Live Bot Crew — drops 1–3 autonomous bot divers into your live local room (`npm start`).
 */
async function runLiveBotCrew(args) {
  console.log(`\n🤖 Joining room ${args.join} at ${args.url} with ${args.bots} live bot diver(s) (${args.difficulty}${args.aggressive ? ', AGGRESSIVE BUMP MODE' : ''})...`);
  console.log('   Press Ctrl+C to disconnect the bot crew.\n');

  const bots = [];
  for (let i = 0; i < args.bots; i++) {
    const profile = BOT_PROFILES[i + 1] || BOT_PROFILES[i];
    const ws = new WebSocket(args.url);
    const welcome = await nextMsg(ws, 'welcome', 6000);
    ws.send(JSON.stringify({ type: 'join_room', code: args.join, name: profile.name }));
    const joined = await nextMsg(ws, 'room_joined', 6000);
    const level = getLevelById(joined.room.levelId || args.level);
    const bot = {
      slot: i,
      ws,
      playerId: welcome.playerId,
      profile,
      level,
      session: null,
      peers: new Map(),
      seq: 0,
      diving: Boolean(joined.room.started),
    };
    const initSession = (lvlId) => {
      bot.level = getLevelById(lvlId || bot.level.id);
      bot.session = createDiveSession(bot.level, {
        diverName: profile.name,
        spawnOffsetX: [-1.35, 1.35, -2.5][i] || 0,
        difficulty: args.difficulty,
        livery: profile.livery,
      });
      bot.diving = true;
    };
    if (joined.room.started) initSession(joined.room.levelId);
    ws.send(JSON.stringify({ type: 'set_ready', ready: true }));

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.type === 'dive_started') {
        initSession(msg.levelId || bot.level.id);
        console.log(`  🌊 ${profile.name} splashed down into ${bot.level.name}!`);
      } else if (msg.type === 'room_update' && msg.room?.levelId) {
        bot.level = getLevelById(msg.room.levelId);
      } else if (msg.type === 'peer_state' && msg.playerId && msg.playerId !== bot.playerId) {
        bot.peers.set(msg.playerId, { id: msg.playerId, ...msg.state });
      }
    });
    console.log(`  ✓ ${profile.name} joined room ${args.join} (${profile.livery.suitId} · ${profile.livery.torchId})`);
    bots.push(bot);
  }

  const dt = 0.05; // 20 Hz live bot simulation & telemetry relay
  const timer = setInterval(() => {
    const botIds = new Set(bots.map((b) => b.playerId));
    for (let i = 0; i < bots.length; i++) {
      const b = bots[i];
      if (!b.diving || !b.session) continue;
      // Follow the human player (any peer not in botIds), else follow next checkpoint
      let leader = null;
      for (const p of b.peers.values()) {
        if (!botIds.has(p.id) && p.alive !== false) {
          leader = p;
          break;
        }
      }
      const angleOff = (i - 1) * 1.1;
      const distOff = args.aggressive ? 0.55 : 2.1 + i * 0.5;
      const tx = leader ? leader.x + Math.cos(angleOff + b.session.simTimeSec * 0.7) * distOff : b.level.checkpoints[0].x;
      const ty = leader ? Math.max(0.9, leader.y + Math.sin(angleOff + b.session.simTimeSec * 0.7) * (args.aggressive ? 0.45 : 1.0)) : b.level.checkpoints[0].y;
      const thrust = computeSteerToward(b.session.diver, tx, ty, args.aggressive ? 1.0 : 0.82);

      stepDiveSession(b.session, thrust, dt, {
        peers: Array.from(b.peers.values()),
      });
      b.seq += 1;
      if (b.ws.readyState === WebSocket.OPEN) {
        b.ws.send(JSON.stringify({ type: 'player_state', state: buildStatePacket(b.session, b.seq) }));
      }
    }
  }, 50);

  process.on('SIGINT', () => {
    clearInterval(timer);
    for (const b of bots) {
      try { b.ws.close(); } catch {}
    }
    console.log('\n👋 Bot crew surfaced & disconnected.');
    process.exit(0);
  });
}

const args = parseArgs(process.argv.slice(2));
if (args.join) {
  runLiveBotCrew(args).catch((err) => {
    console.error('Bot crew error:', err.message);
    process.exit(1);
  });
} else {
  runHeadlessBenchmark(args).catch((err) => {
    console.error('Stress test error:', err);
    process.exit(1);
  });
}
