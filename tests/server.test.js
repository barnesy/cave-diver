import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

test('LAN server serves app, reports LAN URLs, and relays 2-player room state', async () => {
  const port = 3457;
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    // Wait for server startup output
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server start timeout')), 5000);
      proc.stdout.on('data', (chunk) => {
        if (chunk.toString().includes('LAN Server Ready')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      proc.stderr.on('data', (chunk) => {
        clearTimeout(timeout);
        reject(new Error(chunk.toString()));
      });
    });

    // 1. HTTP index & /api/lan-info
    const htmlRes = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    assert.ok(html.includes('CENOTE EL ABISMO'));

    const joinRes = await fetch(`http://127.0.0.1:${port}/join/ABCD`);
    assert.equal(joinRes.status, 200);
    const joinHtml = await joinRes.text();
    assert.ok(joinHtml.includes('lan-invite-url'));

    const healthRes = await fetch(`http://127.0.0.1:${port}/healthz`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.ok, true);

    const manifestRes = await fetch(`http://127.0.0.1:${port}/manifest.json`);
    assert.equal(manifestRes.status, 200);
    const manifest = await manifestRes.json();
    assert.equal(manifest.display, 'standalone');
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);

    const swRes = await fetch(`http://127.0.0.1:${port}/sw.js`);
    assert.equal(swRes.status, 200);
    assert.ok((await swRes.text()).includes('CORE_SHELL'));

    const infoRes = await fetch(`http://127.0.0.1:${port}/api/lan-info`);
    assert.equal(infoRes.status, 200);
    const info = await infoRes.json();
    assert.equal(info.port, port);
    assert.ok(Array.isArray(info.urls));

    // 2. WebSocket 2-player room creation, join, and peer_state relay
    const ws1 = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const ws2 = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    const nextMsg = (ws, type) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          ws.off('message', handler);
          reject(new Error(`Timed out waiting for WebSocket message type "${type}"`));
        }, 4000);
        const handler = (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === type) {
            clearTimeout(timer);
            ws.off('message', handler);
            resolve(msg);
          }
        };
        ws.on('message', handler);
      });

    await Promise.all([nextMsg(ws1, 'welcome'), nextMsg(ws2, 'welcome')]);

    ws1.send(JSON.stringify({ type: 'create_room', name: 'Lead', maxPlayers: 3 }));
    const created = await nextMsg(ws1, 'room_joined');
    assert.equal(created.room.players.length, 1);
    assert.equal(created.room.maxPlayers, 3);

    const levelUpdatePromise = nextMsg(ws1, 'room_update');
    ws1.send(JSON.stringify({ type: 'set_level', levelId: 'eagles-nest-sink' }));
    const lvlUpdated = await levelUpdatePromise;
    assert.equal(lvlUpdated.room.levelId, 'eagles-nest-sink');

    ws2.send(JSON.stringify({ type: 'join_room', code: created.room.code, name: 'Buddy' }));
    const joined = await nextMsg(ws2, 'room_joined');
    assert.equal(joined.room.players.length, 2);

    ws1.send(JSON.stringify({ type: 'start_dive' }));
    await Promise.all([nextMsg(ws1, 'dive_started'), nextMsg(ws2, 'dive_started')]);

    const peerPromise = nextMsg(ws2, 'peer_state');
    ws1.send(
      JSON.stringify({
        type: 'player_state',
        state: {
          x: 25,
          y: 12,
          angle: 0.1,
          gasId: 'TMX1455',
          activeBar: 142,
          cnsPercent: 42,
          dcsStress: 18,
          heartRateBpm: 158,
          cardiacStress: 34,
          healthPct: 76,
          exploredPct: 58,
          condition: 'O2 TOX',
        },
      })
    );
    const relayed = await peerPromise;
    assert.equal(relayed.state.x, 25);
    assert.equal(relayed.state.y, 12);
    assert.equal(relayed.state.activeBar, 142);
    assert.equal(relayed.state.cnsPercent, 42);
    assert.equal(relayed.state.heartRateBpm, 158);
    assert.equal(relayed.state.cardiacStress, 34);
    assert.equal(relayed.state.healthPct, 76);
    assert.equal(relayed.state.exploredPct, 58);
    assert.equal(relayed.state.condition, 'O2 TOX');

    const collectPromise = nextMsg(ws2, 'peer_collectible');
    ws1.send(JSON.stringify({ type: 'collectible_hit', collectibleId: 'l1-jade' }));
    const relayedCollect = await collectPromise;
    assert.equal(relayedCollect.collectibleId, 'l1-jade');

    const siltPromise = nextMsg(ws2, 'peer_silt');
    ws1.send(JSON.stringify({ type: 'silt_event', plume: { x: 40, y: 20, radius: 1.1 } }));
    const relayedSilt = await siltPromise;
    assert.equal(relayedSilt.plume.x, 40);
    assert.equal(relayedSilt.plume.y, 20);

    // 3. Staggered mid-dive drop-in succeeds when slots remain, and rejects when full (plus rejoin via reconnectToken)
    const ws3 = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await nextMsg(ws3, 'welcome');
    const ws3JoinedP = nextMsg(ws3, 'room_joined');
    const ws3DiveP = nextMsg(ws3, 'dive_started');
    const hostMidNotifyP = nextMsg(ws1, 'room_update');
    ws3.send(JSON.stringify({ type: 'join_room', code: created.room.code, name: 'Latecomer' }));
    const [ws3Joined, ws3Dive, hostMidNotify] = await Promise.all([ws3JoinedP, ws3DiveP, hostMidNotifyP]);
    assert.equal(ws3Joined.room.players.length, 3);
    assert.equal(ws3Dive.lateJoin, true);
    assert.ok(ws3Dive.collectibles.includes('l1-jade'));
    assert.equal(hostMidNotify.joinedMidDiveName, 'Latecomer');

    // Full 3/3 room rejects 4th diver
    const ws4 = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await nextMsg(ws4, 'welcome');
    const fullErrP = nextMsg(ws4, 'error');
    ws4.send(JSON.stringify({ type: 'join_room', code: created.room.code, name: 'Fourth' }));
    const fullErr = await fullErrP;
    assert.ok(fullErr.message.includes('already has 3 divers'));
    ws4.close();

    // Latecomer leaves explicitly before rejoin/prepare tests
    const afterLateLeaveP = nextMsg(ws1, 'room_update');
    ws3.send(JSON.stringify({ type: 'leave_room' }));
    await afterLateLeaveP;

    // Simulate ws2 mid-dive drop + seamless rejoin_room
    ws2.close();
    const disconnectedUpdate = await nextMsg(ws1, 'room_update');
    const ghostBuddy = disconnectedUpdate.room.players.find((p) => p.name === 'Buddy');
    assert.equal(ghostBuddy.connected, false);

    const ws2Re = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await nextMsg(ws2Re, 'welcome');
    const rejoinedJoinedPromise = nextMsg(ws2Re, 'room_joined');
    const rejoinedDivePromise = nextMsg(ws2Re, 'dive_started');
    ws2Re.send(
      JSON.stringify({
        type: 'rejoin_room',
        code: created.room.code,
        reconnectToken: joined.reconnectToken,
        name: 'Buddy',
      })
    );
    const [rejoinedMsg, diveStartedRe] = await Promise.all([rejoinedJoinedPromise, rejoinedDivePromise]);
    assert.equal(rejoinedMsg.rejoined, true);
    assert.equal(rejoinedMsg.clientId, joined.clientId);
    assert.equal(diveStartedRe.rejoined, true);
    assert.ok(diveStartedRe.collectibles.includes('l1-jade'));

    // 4. Return to lobby, switch to Level 5, prepare_dive -> auto launch on ready, and diver_signal relay
    const lobbyP1 = nextMsg(ws1, 'returned_to_lobby');
    const lobbyP2 = nextMsg(ws2Re, 'returned_to_lobby');
    ws1.send(JSON.stringify({ type: 'return_to_lobby' }));
    await Promise.all([lobbyP1, lobbyP2]);

    const lvl5RoomP1 = nextMsg(ws1, 'room_update');
    ws1.send(JSON.stringify({ type: 'set_level', levelId: 'boesmansgat-abyss' }));
    const lvl5Room = await lvl5RoomP1;
    assert.equal(lvl5Room.room.levelId, 'boesmansgat-abyss');
    assert.equal(lvl5Room.room.started, false);

    // Host clicks Start -> prepare_dive transitions crew into dive_preparing until both load Level 5
    const waitStatusAck = (ws) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timed out waiting for buddy idle room_update')), 4000);
        const onMsg = (raw) => {
          const msg = JSON.parse(raw.toString());
          const buddy = msg.room?.players?.find((p) => p.name === 'Buddy');
          if (msg.type === 'room_update' && buddy?.loadedLevelId === 'cenote-el-abismo' && buddy?.loadStatus === 'idle') {
            clearTimeout(timer);
            ws.off('message', onMsg);
            resolve(msg);
          }
        };
        ws.on('message', onMsg);
      });
    const ackP1 = waitStatusAck(ws1);
    const ackP2 = waitStatusAck(ws2Re);
    ws1.send(
      JSON.stringify({
        type: 'set_player_status',
        loadStatus: 'ready',
        loadPct: 100,
        loadedLevelId: 'boesmansgat-abyss',
      })
    );
    ws2Re.send(
      JSON.stringify({
        type: 'set_player_status',
        loadStatus: 'idle',
        loadPct: 0,
        loadedLevelId: 'cenote-el-abismo',
      })
    );
    await Promise.all([ackP1, ackP2]);

    const prepP1 = nextMsg(ws1, 'dive_preparing');
    const prepP2 = nextMsg(ws2Re, 'dive_preparing');
    ws1.send(JSON.stringify({ type: 'prepare_dive' }));
    await Promise.all([prepP1, prepP2]);

    // Buddy still loading -> direct force-less start_dive stays gated cleanly
    const waitErrPromise = nextMsg(ws1, 'error');
    ws1.send(JSON.stringify({ type: 'start_dive' }));
    const waitErr = await waitErrPromise;
    assert.ok(waitErr.message.includes('Waiting for Buddy'));

    const roomsListPromise = nextMsg(ws3, 'rooms_list');
    ws3.send(JSON.stringify({ type: 'list_rooms' }));
    const listMsg = await roomsListPromise;
    const listedRoom = listMsg.rooms.find((r) => r.code === created.room.code);
    assert.ok(listedRoom);
    assert.equal(listedRoom.levelId, 'boesmansgat-abyss');
    assert.equal(listedRoom.playerCount, 2);

    // Buddy finishes loading -> room auto-launches dive_started for both simultaneously!
    const startP1 = nextMsg(ws1, 'dive_started');
    const startP2 = nextMsg(ws2Re, 'dive_started');
    ws2Re.send(
      JSON.stringify({
        type: 'set_player_status',
        loadStatus: 'ready',
        loadPct: 100,
        loadedLevelId: 'boesmansgat-abyss',
      })
    );
    const [s1, s2] = await Promise.all([startP1, startP2]);
    assert.equal(s1.levelId, 'boesmansgat-abyss');
    assert.equal(s2.levelId, 'boesmansgat-abyss');

    // Quick diver hand-signal relay & co-op guideline reel sync
    const sigPromise = nextMsg(ws2Re, 'peer_signal');
    ws1.send(JSON.stringify({ type: 'diver_signal', signal: 'LOW GAS ⛽' }));
    const relayedSig = await sigPromise;
    assert.equal(relayedSig.signal, 'LOW GAS ⛽');

    const linePromise = nextMsg(ws2Re, 'peer_guideline');
    ws1.send(
      JSON.stringify({
        type: 'guideline_sync',
        reelingActive: true,
        chains: [[{ x: 14, y: 10 }, { x: 24, y: 12.5 }]],
      })
    );
    const relayedLine = await linePromise;
    assert.equal(relayedLine.reelingActive, true);
    assert.equal(relayedLine.chains[0].length, 2);
    assert.equal(relayedLine.chains[0][1].x, 24);

    // Rejoining mid-dive preserves peer_guideline playerLines in dive_started, and restart_dive clears them
    ws2Re.close();
    await nextMsg(ws1, 'room_update');
    const ws2Re2 = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await nextMsg(ws2Re2, 'welcome');
    const rejoinedDive2P = nextMsg(ws2Re2, 'dive_started');
    ws2Re2.send(
      JSON.stringify({
        type: 'rejoin_room',
        code: created.room.code,
        reconnectToken: joined.reconnectToken,
        name: 'Buddy',
      })
    );
    const rejoinedDive2 = await rejoinedDive2P;
    assert.equal(rejoinedDive2.rejoined, true);
    assert.ok(Array.isArray(rejoinedDive2.playerLines));
    const hostLineEntry = rejoinedDive2.playerLines.find((pl) => pl.playerId === created.clientId);
    assert.ok(hostLineEntry);
    assert.equal(hostLineEntry.chains[0][1].x, 24);

    // Body recovery event relays to peer and persists in rejoin_room dive_started snapshot
    const recPromise = nextMsg(ws1, 'peer_body_recovered');
    ws2Re2.send(JSON.stringify({ type: 'body_recovered', targetId: 'fallen-explorer' }));
    const recMsg = await recPromise;
    assert.equal(recMsg.playerId, joined.clientId);

    ws2Re2.close();
    await nextMsg(ws1, 'room_update');
    const ws2Re3 = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await nextMsg(ws2Re3, 'welcome');
    const rejoinedDive3P = nextMsg(ws2Re3, 'dive_started');
    ws2Re3.send(
      JSON.stringify({
        type: 'rejoin_room',
        code: created.room.code,
        reconnectToken: joined.reconnectToken,
        name: 'Buddy',
      })
    );
    const rejoinedDive3 = await rejoinedDive3P;
    assert.equal(rejoinedDive3.bodyRecoveredBy, joined.clientId);

    const retLobbyP1 = nextMsg(ws1, 'returned_to_lobby');
    const retLobbyP2 = nextMsg(ws2Re3, 'returned_to_lobby');
    ws1.send(JSON.stringify({ type: 'return_to_lobby' }));
    await Promise.all([retLobbyP1, retLobbyP2]);

    const lvl6UpdateP = nextMsg(ws1, 'room_update');
    ws1.send(JSON.stringify({ type: 'set_level', levelId: 'orda-crystal-maze' }));
    await lvl6UpdateP;

    const restartP1 = nextMsg(ws1, 'dive_started');
    const restartP2 = nextMsg(ws2Re3, 'dive_started');
    ws1.send(JSON.stringify({ type: 'start_dive', force: true }));
    const [rst1, rst2] = await Promise.all([restartP1, restartP2]);
    assert.equal(rst1.levelId, 'orda-crystal-maze');
    assert.equal(rst1.playerLines?.length || 0, 0);
    assert.equal(rst2.playerLines?.length || 0, 0);
    assert.equal(rst1.bodyRecoveredBy ?? null, null);

    // Return to lobby, verify host disconnect preserves room so guest can still join & host can rejoin
    const retLobby2P1 = nextMsg(ws1, 'returned_to_lobby');
    const retLobby2P2 = nextMsg(ws2Re3, 'returned_to_lobby');
    ws1.send(JSON.stringify({ type: 'return_to_lobby' }));
    await Promise.all([retLobby2P1, retLobby2P2]);
    ws2Re3.send(JSON.stringify({ type: 'leave_room' }));
    await nextMsg(ws1, 'room_update');

    // Host creates fresh lobby room, closes WS (simulates app-switch/navigate away to share)
    ws1.close();
    const wsHost = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await nextMsg(wsHost, 'welcome');
    wsHost.send(JSON.stringify({ type: 'create_room', name: 'HostAway', maxPlayers: 2 }));
    const awayCreated = await nextMsg(wsHost, 'room_joined');
    wsHost.close();

    // While host is away, guest joins via invite code!
    const wsGuestWhileAway = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await nextMsg(wsGuestWhileAway, 'welcome');
    const guestJoinedP = nextMsg(wsGuestWhileAway, 'room_joined');
    wsGuestWhileAway.send(
      JSON.stringify({ type: 'join_room', code: awayCreated.room.code, name: 'InvitedBuddy' })
    );
    const guestJoined = await guestJoinedP;
    assert.equal(guestJoined.room.code, awayCreated.room.code);
    assert.equal(guestJoined.room.players.length, 2);
    assert.equal(guestJoined.room.players[0].isHost, true);
    assert.equal(guestJoined.room.players[0].connected, false);

    // Host returns and reclaims Host seat without duplication
    const wsHostBack = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await nextMsg(wsHostBack, 'welcome');
    const hostRejoinedP = nextMsg(wsHostBack, 'room_joined');
    const guestNotifiedP = nextMsg(wsGuestWhileAway, 'room_update');
    wsHostBack.send(
      JSON.stringify({
        type: 'rejoin_room',
        code: awayCreated.room.code,
        reconnectToken: awayCreated.reconnectToken,
        name: 'HostAway',
      })
    );
    const [hostBackMsg, guestNotified] = await Promise.all([hostRejoinedP, guestNotifiedP]);
    assert.equal(hostBackMsg.rejoined, true);
    assert.equal(hostBackMsg.room.players.length, 2);
    const meHost = hostBackMsg.room.players.find((p) => p.id === hostBackMsg.clientId);
    assert.equal(meHost.isHost, true);
    assert.equal(meHost.connected, true);
    assert.equal(guestNotified.room.players.find((p) => p.id === hostBackMsg.clientId).connected, true);

    // Mid-dive room creation over LAN WS drops joining guest straight into started dive with carried state
    const wsLiveHost = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await nextMsg(wsLiveHost, 'welcome');
    wsLiveHost.send(
      JSON.stringify({
        type: 'create_room',
        name: 'LiveHost',
        levelId: 'silfra-katla-aurora-abyss',
        maxPlayers: 4,
        initialDiveState: {
          checkpoints: ['cp1'],
          collectibles: ['col-1'],
          bodyRecovered: false,
          playerLines: [[{ x: -3, y: 12 }, { x: 12, y: 26 }]],
        },
      })
    );
    const liveCreated = await nextMsg(wsLiveHost, 'room_joined');
    assert.equal(liveCreated.room.started, true);
    assert.equal(liveCreated.room.maxPlayers, 4);
    const wsLiveGuest = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await nextMsg(wsLiveGuest, 'welcome');
    const liveGuestStartP = nextMsg(wsLiveGuest, 'dive_started');
    wsLiveGuest.send(JSON.stringify({ type: 'join_room', code: liveCreated.room.code, name: 'LinkGuest' }));
    const liveGuestStart = await liveGuestStartP;
    assert.equal(liveGuestStart.lateJoin, true);
    assert.deepEqual(liveGuestStart.checkpoints, ['cp1']);
    assert.deepEqual(liveGuestStart.collectibles, ['col-1']);
    assert.equal(liveGuestStart.playerLines[0].chains[0].length, 2);
    wsLiveGuest.close();
    wsLiveHost.close();

    wsHostBack.close();
    wsGuestWhileAway.close();
    ws2Re3.close();
    ws3.close();

    // 4. Global Leaderboard REST endpoints (Solo PB, Team deduplication, Bounds, Overall)
    const rejectBad = await fetch(`http://127.0.0.1:${port}/api/leaderboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'solo', levelId: 'cenote-el-abismo', score: 999999, timeSec: 60, grade: 'S+' }),
    });
    assert.equal(rejectBad.status, 400);

    const p1 = await fetch(`http://127.0.0.1:${port}/api/leaderboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'solo',
        levelId: 'cenote-el-abismo',
        playerId: 'diver_chris',
        diverName: 'Chris',
        score: 2700,
        timeSec: 118.2,
        exploredPct: 91,
        grade: 'S',
      }),
    }).then((r) => r.json());
    assert.equal(p1.ok, true);
    assert.equal(p1.rank, 1);

    // Beat own solo PB -> replaces, no duplicate row
    await fetch(`http://127.0.0.1:${port}/api/leaderboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'solo',
        levelId: 'cenote-el-abismo',
        playerId: 'diver_chris',
        diverName: 'Chris',
        score: 2890,
        timeSec: 110.5,
        exploredPct: 95,
        grade: 'S+',
      }),
    });

    // Team run submitted twice with identical runId (e.g. host + guest surfacing) deduplicates cleanly
    for (const submitter of ['Chris', 'Buddy']) {
      await fetch(`http://127.0.0.1:${port}/api/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'team',
          levelId: 'cenote-el-abismo',
          runId: 'ROOM4-d1-cenote-el-abismo',
          playerId: submitter,
          crew: [
            { name: 'Chris', score: 2600, alive: true },
            { name: 'Buddy', score: 2550, alive: true },
          ],
          teamSize: 2,
          score: 3280,
          timeSec: 121.0,
          exploredPct: 96,
          grade: 'S',
        }),
      });
    }

    const soloBoard = await fetch(`http://127.0.0.1:${port}/api/leaderboard?mode=solo&level=cenote-el-abismo`).then((r) => r.json());
    const teamBoard = await fetch(`http://127.0.0.1:${port}/api/leaderboard?mode=team&level=cenote-el-abismo`).then((r) => r.json());
    assert.equal(soloBoard.entries.length, 1);
    assert.equal(soloBoard.entries[0].score, 2890);
    assert.equal(teamBoard.entries.length, 1);
    assert.equal(teamBoard.entries[0].displayName, 'Chris + Buddy');
  } finally {
    proc.kill();
  }
});

test('Vercel API handlers validate inputs and shared clients target Vercel global URLs', async () => {
  const { GET: healthGet, OPTIONS: healthOptions } = await import('../api/healthz.js');
  const { POST: lbPost, OPTIONS: lbOptions } = await import('../api/leaderboard.js');
  const { POST: roomPost, OPTIONS: roomOptions } = await import('../api/room.js');
  const { GLOBAL_LEADERBOARD_URL, LeaderboardClient } = await import('../public/js/net/leaderboardClient.js');
  const { GLOBAL_ROOM_API_URL } = await import('../public/js/net/lanClient.js');

  assert.equal(GLOBAL_LEADERBOARD_URL, 'https://cave-diver.vercel.app/api/leaderboard');
  assert.equal(GLOBAL_ROOM_API_URL, 'https://cave-diver.vercel.app/api/room');

  assert.equal(healthOptions().status, 204);
  assert.equal(lbOptions().status, 204);
  assert.equal(roomOptions().status, 204);

  const healthRes = healthGet();
  assert.equal(healthRes.status, 200);
  const healthJson = await healthRes.json();
  assert.equal(healthJson.ok, true);
  assert.equal(healthJson.platform, 'vercel');

  const badLbJson = await lbPost(new Request('https://example.com/api/leaderboard', { method: 'POST', body: '{bad' }));
  assert.equal(badLbJson.status, 400);
  const badLbPayload = await lbPost(
    new Request('https://example.com/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'solo', levelId: 'unknown-cave' }),
    })
  );
  assert.equal(badLbPayload.status, 400);

  const badRoomJson = await roomPost(new Request('https://example.com/api/room', { method: 'POST', body: 'nope' }));
  assert.equal(badRoomJson.status, 400);
  const missingCode = await roomPost(
    new Request('https://example.com/api/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync', code: '!!!' }),
    })
  );
  assert.equal(missingCode.status, 400);

  // Verify GitHub Pages origin falls back cleanly to GLOBAL_LEADERBOARD_URL
  const prevLoc = globalThis.location;
  try {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { hostname: 'barnesy.github.io', protocol: 'https:', search: '' },
    });
    const client = new LeaderboardClient();
    const resolved = await client.resolveEndpoint();
    assert.equal(resolved, 'https://cave-diver.vercel.app/api/leaderboard');

    // Verify local-cache entries sync cleanly to global endpoint when fetchBoard runs
    const { normalizeLeaderboardSubmission } = await import('../public/js/game/leaderboardModel.js');
    let posted = [];
    const prevFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      if (opts?.method === 'POST') {
        const norm = normalizeLeaderboardSubmission(JSON.parse(opts.body));
        posted.push(norm.entry);
        return new Response(JSON.stringify({ ok: true, entry: norm.entry, entries: posted }), { status: 200 });
      }
      return new Response(JSON.stringify({ mode: 'solo', levelId: 'cenote-el-abismo', entries: posted }), { status: 200 });
    };
    try {
      client._localEntries = [
        normalizeLeaderboardSubmission({
          mode: 'solo',
          levelId: 'cenote-el-abismo',
          playerId: 'diver_chris_local',
          diverName: 'Chris',
          score: 2650,
          grade: 'S',
          timeSec: 112.4,
          exploredPct: 91,
          collectiblesFound: 3,
        }).entry,
      ];
      client._loadLocalCache = () => client._localEntries;
      const syncedBoard = await client.fetchBoard({ mode: 'solo', levelId: 'cenote-el-abismo', limit: 20 });
      assert.equal(posted.length, 1);
      assert.equal(syncedBoard.source, 'global');
      assert.equal(syncedBoard.entries.length, 1);
      assert.equal(syncedBoard.entries[0].displayName, 'Chris');
    } finally {
      globalThis.fetch = prevFetch;
    }

    // Verify batch sync + transient 503 auto-retry + fair per-site pruning
    const {
      mergeLeaderboardEntries,
      pruneLeaderboardEntries,
    } = await import('../public/js/game/leaderboardModel.js');
    const a1 = normalizeLeaderboardSubmission({
      mode: 'solo',
      levelId: 'cenote-el-abismo',
      playerId: 'p1',
      diverName: 'P1',
      score: 2100,
      grade: 'B',
      timeSec: 120,
      exploredPct: 80,
      collectiblesFound: 2,
    }).entry;
    const dupSame = { ...a1 };
    const { changed: dupChanged } = mergeLeaderboardEntries([a1], [dupSame]);
    assert.equal(dupChanged, false, 'Identical duplicate entry should not trigger Blob mutation');

    const overflowEntries = [];
    for (let i = 0; i < 12; i++) {
      overflowEntries.push(
        normalizeLeaderboardSubmission({
          mode: 'solo',
          levelId: 'silfra-katla-aurora-abyss',
          playerId: `abyss_${i}`,
          diverName: `A${i}`,
          score: 5000 + i,
          grade: 'S',
          timeSec: 300,
          exploredPct: 90,
          collectiblesFound: 8,
        }).entry
      );
    }
    overflowEntries.push(a1);
    const pruned = pruneLeaderboardEntries(overflowEntries, 8, 2);
    assert.ok(pruned.some((e) => e.levelId === 'cenote-el-abismo'), 'Fair pruning must preserve top scores on lower-point levels');

    // Retry client checks: transient 503 on first POST retries once and succeeds on second attempt
    const retryClient = new LeaderboardClient();
    let postAttempts = 0;
    const prevFetch2 = globalThis.fetch;
    globalThis.fetch = async (_url, opts) => {
      if (opts?.method === 'POST') {
        postAttempts += 1;
        if (postAttempts === 1) {
          return new Response(JSON.stringify({ error: 'Blob busy' }), { status: 503 });
        }
        const norm = normalizeLeaderboardSubmission(JSON.parse(opts.body));
        return new Response(JSON.stringify({ ok: true, entry: norm.entry, rank: 1, total: 1, entries: [norm.entry] }), { status: 200 });
      }
      return new Response(JSON.stringify({ entries: [] }), { status: 200 });
    };
    try {
      const subRes = await retryClient.submitRun({
        mode: 'solo',
        levelId: 'cenote-el-abismo',
        playerId: 'retry_diver',
        diverName: 'RetryDiver',
        score: 2500,
        grade: 'S',
        timeSec: 115,
        exploredPct: 88,
        collectiblesFound: 3,
      });
      assert.equal(postAttempts, 2);
      assert.equal(subRes.ok, true);
      assert.equal(subRes.source, 'global');
      assert.equal(subRes.pendingSync, false);
    } finally {
      globalThis.fetch = prevFetch2;
    }

    // Overall board ("All Sites") merges unsynced local cache when remote overall is empty or partial
    const overallClient = new LeaderboardClient();
    overallClient._resolvedEndpoint = 'https://cave-diver.vercel.app/api/leaderboard';
    overallClient._localEntries = [
      a1,
      normalizeLeaderboardSubmission({
        mode: 'solo',
        levelId: 'eagles-nest-sink',
        playerId: 'p1',
        diverName: 'P1',
        score: 2800,
        grade: 'S',
        timeSec: 110,
        exploredPct: 85,
        collectiblesFound: 3,
      }).entry,
    ];
    overallClient._loadLocalCache = () => overallClient._localEntries;
    const prevFetch3 = globalThis.fetch;
    globalThis.fetch = async (_url, opts) => {
      if (opts?.method === 'POST') {
        return new Response(JSON.stringify({ error: 'Blob busy' }), { status: 500 });
      }
      return new Response(JSON.stringify({ mode: 'solo', levelId: 'overall', entries: [] }), { status: 200 });
    };
    try {
      const overallEmptyRemote = await overallClient.fetchBoard({ mode: 'solo', levelId: 'overall', limit: 20 });
      assert.equal(overallEmptyRemote.entries.length, 1);
      assert.equal(overallEmptyRemote.entries[0].levelId, 'overall');
      assert.equal(overallEmptyRemote.entries[0].sitesCompleted, 2);
      assert.equal(overallEmptyRemote.entries[0].score, 4900);

      // Now simulate remote returning another diver + an older lower score for p1
      globalThis.fetch = async (_url, opts) => {
        if (opts?.method === 'POST') {
          return new Response(JSON.stringify({ error: 'Blob busy' }), { status: 500 });
        }
        return new Response(
          JSON.stringify({
            mode: 'solo',
            levelId: 'overall',
            entries: [
              {
                mode: 'solo',
                levelId: 'overall',
                playerId: 'remote_ace',
                displayName: 'RemoteAce',
                teamSize: 1,
                sitesCompleted: 3,
                totalSites: 14,
                score: 7200,
                grade: '3/14 SITES',
                timeSec: 360,
                exploredPct: 90,
                createdAt: 1000,
              },
              {
                mode: 'solo',
                levelId: 'overall',
                playerId: 'p1',
                displayName: 'P1',
                teamSize: 1,
                sitesCompleted: 1,
                totalSites: 14,
                score: 2100,
                grade: '1/14 SITES',
                timeSec: 120,
                exploredPct: 80,
                createdAt: 1000,
              },
            ],
          }),
          { status: 200 }
        );
      };
      const overallMerged = await overallClient.fetchBoard({ mode: 'solo', levelId: 'overall', limit: 20 });
      assert.equal(overallMerged.entries.length, 2);
      assert.equal(overallMerged.entries[0].displayName, 'RemoteAce');
      assert.equal(overallMerged.entries[1].displayName, 'P1');
      assert.equal(overallMerged.entries[1].score, 4900);
      assert.equal(overallMerged.entries[1].sitesCompleted, 2);
    } finally {
      globalThis.fetch = prevFetch3;
    }
  } finally {
    if (prevLoc === undefined) {
      delete globalThis.location;
    } else {
      Object.defineProperty(globalThis, 'location', { configurable: true, value: prevLoc });
    }
  }
});

test('P2P coordinator arbitration, token migration, and large WS payloads remain solid', async () => {
  const { P2pRoomCoordinator, compareHostAuthority } = await import('../public/js/net/p2pRoomHost.js');

  // 1. Deterministic symmetric host arbitration: started > higher hostEpoch > more players > smaller hostId
  const aStarted = { hostId: 'zzz', hostEpoch: 1, started: true, playerCount: 1 };
  const bLobby = { hostId: 'aaa', hostEpoch: 2, started: false, playerCount: 2 };
  assert.ok(compareHostAuthority(aStarted, bLobby) > 0);
  assert.ok(compareHostAuthority(bLobby, aStarted) < 0);

  const aEpoch2 = { hostId: 'zzz', hostEpoch: 2, started: true, playerCount: 1 };
  const bEpoch1 = { hostId: 'aaa', hostEpoch: 1, started: true, playerCount: 2 };
  assert.ok(compareHostAuthority(aEpoch2, bEpoch1) > 0);
  assert.ok(compareHostAuthority(bEpoch1, aEpoch2) < 0);

  const tieA = { hostId: 'peerA', hostEpoch: 1, started: true, playerCount: 1 };
  const tieB = { hostId: 'peerB', hostEpoch: 1, started: true, playerCount: 1 };
  assert.ok(compareHostAuthority(tieA, tieB) > 0);
  assert.ok(compareHostAuthority(tieB, tieA) < 0);

  // 2. Cloud snapshot recovery adds missing guest as proper Host with bumped epoch & preserves dive state
  const orig = new P2pRoomCoordinator({
    code: 'ABCD',
    hostId: 'host-1',
    hostName: 'Mako',
    levelId: 'silfra-katla-aurora-abyss',
    maxPlayers: 2,
    initialDiveState: { checkpoints: ['cp1'], collectibles: ['c1'] },
  });
  const snap = orig.exportSnapshot();
  const recovered = P2pRoomCoordinator.fromSnapshot(snap, {
    departingHostId: null,
    newHostId: 'guest-2',
    newHostName: 'Vex',
    bumpEpoch: true,
  });
  assert.equal(recovered.room.hostEpoch, 2);
  assert.equal(recovered.room.started, true);
  assert.equal(recovered.room.players.get('guest-2')?.isHost, true);
  assert.equal(recovered.room.players.get('host-1')?.isHost, false);
  assert.ok(recovered.room.sharedCheckpoints.has('cp1'));

  // 3. Reconnect token migration replaces old disconnected peerId in a 2/2 full room cleanly
  const room2p = new P2pRoomCoordinator({ code: 'WXYZ', hostId: 'h1', hostName: 'Host', maxPlayers: 2 });
  const joinMsgs = [];
  room2p.handleRemoteJoin({ name: 'Buddy' }, (m) => joinMsgs.push(m), 'peer-old');
  const firstToken = joinMsgs.find((m) => m.type === 'room_joined').reconnectToken;
  room2p.markDisconnected('peer-old');
  const rejoinMsgs = [];
  const migratedId = room2p.handleRemoteJoin(
    { name: 'Buddy', reconnectToken: firstToken },
    (m) => rejoinMsgs.push(m),
    'peer-refreshed'
  );
  assert.equal(migratedId, 'peer-refreshed');
  assert.equal(room2p.room.players.size, 2);
  assert.equal(room2p.room.players.has('peer-old'), false);
  assert.equal(room2p.room.players.get('peer-refreshed')?.connected, true);

  // 4. WebSocket server handles >16KB guideline payloads and evicts disconnected non-host slots cleanly on join
  const port = 3459;
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('WS server timeout')), 5000);
      proc.stdout.on('data', (c) => { if (c.toString().includes('LAN Server Ready')) { clearTimeout(t); resolve(); } });
    });
    const nextMsg = (ws, type) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${type}`)), 4000);
        const fn = (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === type) { clearTimeout(timer); ws.off('message', fn); resolve(msg); }
        };
        ws.on('message', fn);
      });
    const wsH = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const wsG1 = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await Promise.all([nextMsg(wsH, 'welcome'), nextMsg(wsG1, 'welcome')]);
    wsH.send(JSON.stringify({ type: 'create_room', name: 'H', maxPlayers: 2 }));
    const hJoined = await nextMsg(wsH, 'room_joined');
    wsG1.send(JSON.stringify({ type: 'join_room', code: hJoined.room.code, name: 'G1' }));
    await nextMsg(wsG1, 'room_joined');
    wsH.send(JSON.stringify({ type: 'start_dive' }));
    await Promise.all([nextMsg(wsH, 'dive_started'), nextMsg(wsG1, 'dive_started')]);

    // >20KB guideline payload should relay without closing WebSocket (maxPayload 256KB)
    const hugeChains = Array.from({ length: 12 }, (_, ci) =>
      Array.from({ length: 80 }, (_, pi) => ({ x: ci + pi * 0.5, y: 10 + pi * 0.25 }))
    );
    const bigLineP = nextMsg(wsH, 'peer_guideline');
    wsG1.send(JSON.stringify({ type: 'guideline_sync', chains: hugeChains, reelingActive: false }));
    const bigLine = await bigLineP;
    assert.equal(bigLine.chains.length, 12);

    // G1 drops ungracefully -> new G2 joins full 2/2 room cleanly by evicting disconnected G1 slot
    wsG1.close();
    await nextMsg(wsH, 'room_update');
    const wsG2 = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await nextMsg(wsG2, 'welcome');
    const g2JoinedP = nextMsg(wsG2, 'room_joined');
    wsG2.send(JSON.stringify({ type: 'join_room', code: hJoined.room.code, name: 'G2' }));
    const g2Joined = await g2JoinedP;
    assert.equal(g2Joined.room.players.length, 2);
    wsH.close();
    wsG2.close();
  } finally {
    proc.kill();
  }
});

test('PWA Service Worker and index.html cache versions stay in lockstep and support SKIP_WAITING', async () => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const rootDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
  const [swSrc, htmlSrc, lanSrc] = await Promise.all([
    fs.readFile(path.join(rootDir, 'public/sw.js'), 'utf8'),
    fs.readFile(path.join(rootDir, 'public/index.html'), 'utf8'),
    fs.readFile(path.join(rootDir, 'public/js/net/lanClient.js'), 'utf8'),
  ]);
  const swVer = swSrc.match(/CACHE_VERSION\s*=\s*['"]cave-diver-v(\d+)['"]/)?.[1];
  const metaVer = htmlSrc.match(/<meta\s+name="app-version"\s+content="(\d+)"/)?.[1];
  const htmlMainVer = htmlSrc.match(/\.\/js\/main\.js\?v=(\d+)/)?.[1];
  const lanTrysteroVer = lanSrc.match(/trystero-nostr\.min\.js\?v=(\d+)/)?.[1];

  assert.ok(swVer && Number(swVer) >= 61);
  assert.equal(metaVer, swVer, 'index.html app-version meta must match sw.js CACHE_VERSION');
  assert.equal(htmlMainVer, swVer, 'index.html main.js ?v= query must match sw.js CACHE_VERSION');
  assert.equal(lanTrysteroVer, swVer, 'lanClient.js trystero ?v= query must match sw.js CACHE_VERSION');
  assert.ok(swSrc.includes('SKIP_WAITING'), 'sw.js must listen for SKIP_WAITING messages');
  assert.ok(htmlSrc.includes('pwa-update-banner') && htmlSrc.includes('btn-pwa-update'));
});

test('v115 GitHub OAuth, Private Gist Cloud Save smart-merge & direct Issue submission', async () => {
  const { createGitHubHandler } = await import('../api/github.js');
  const { mergeCareerLogbooks } = await import('../public/js/game/logbookModel.js');
  const { buildPrefilledIssueUrl } = await import('../public/js/net/githubClient.js');

  // 1. Smart logbook merge preserves highest scores, faster times, field guide captures & daily streaks
  const devA = {
    totalDives: 4,
    totalTimeSec: 600,
    deepestM: 65,
    bestScore: 2800,
    cleared: {
      'cenote-el-abismo': { score: 2600, grade: 'A', bestTimeSec: 155, clears: 2, bestDifficulty: 'standard' },
      'eagles-nest-sink': { score: 2800, grade: 'S', bestTimeSec: 180, clears: 1, bestDifficulty: 'hardcore' },
    },
    daily: {
      currentStreak: 2,
      bestStreak: 2,
      totalClears: 2,
      lastClearedDate: '2026-11-20',
      clearedDates: ['2026-11-19', '2026-11-20'],
      records: { '2026-11-20': { levelId: 'cenote-el-abismo', mutatorId: 'turbo-par', score: 2600, grade: 'A', timeSec: 150 } },
    },
    fieldGuide: {
      shark: { count: 1, bestStars: 2, firstSiteId: 'uss-oriskany-carrier', bestSiteName: 'USS Oriskany', bestDepthM: 28 },
    },
  };
  const devB = {
    totalDives: 6,
    totalTimeSec: 720,
    deepestM: 112,
    bestScore: 3100,
    cleared: {
      'cenote-el-abismo': { score: 2950, grade: 'S+', bestTimeSec: 132, clears: 3, bestDifficulty: 'hardcore' },
      'uss-oriskany-carrier': { score: 3100, grade: 'S', bestTimeSec: 210, clears: 1, bestDifficulty: 'standard' },
    },
    daily: {
      currentStreak: 1,
      bestStreak: 1,
      totalClears: 1,
      lastClearedDate: '2026-11-21',
      clearedDates: ['2026-11-21'],
      records: { '2026-11-21': { levelId: 'uss-oriskany-carrier', mutatorId: 'deep-silt', score: 3100, grade: 'S', timeSec: 205 } },
    },
    fieldGuide: {
      shark: { count: 2, bestStars: 3, firstSiteId: 'uss-oriskany-carrier', bestSiteName: 'USS Oriskany', bestDepthM: 34 },
      whaleshark: { count: 1, bestStars: 3, firstSiteId: 'hms-victoria-wreck', bestSiteName: 'HMS Victoria', bestDepthM: 18 },
    },
  };
  const merged = mergeCareerLogbooks(devA, devB);
  assert.equal(merged.totalDives, 6);
  assert.equal(merged.deepestM, 112);
  assert.equal(merged.bestScore, 3100);
  assert.equal(Object.keys(merged.cleared).length, 3);
  assert.equal(merged.cleared['cenote-el-abismo'].grade, 'S+');
  assert.equal(merged.cleared['cenote-el-abismo'].bestTimeSec, 132);
  assert.equal(merged.cleared['cenote-el-abismo'].bestDifficulty, 'hardcore');
  assert.equal(merged.daily.currentStreak, 3, 'Consecutive merged dates 11-19..11-21 must compute 3-day streak');
  assert.equal(merged.daily.bestStreak, 3);
  assert.equal(merged.fieldGuide.shark.bestStars, 3);
  assert.equal(merged.fieldGuide.whaleshark.bestStars, 3);

  // 2. Unconfigured env reports configured: false gracefully
  const uncfg = createGitHubHandler({ env: {} });
  const uncfgRes = await uncfg.GET(new Request('https://cave-diver.vercel.app/api/github/session'));
  assert.equal(uncfgRes.status, 200);
  const uncfgJson = await uncfgRes.json();
  assert.equal(uncfgJson.configured, false);
  assert.equal(uncfgJson.authenticated, false);

  // 3. Full OAuth flow + Private Gist create/merge + Direct Issue creation with mocked GitHub API
  const gistStore = new Map();
  const createdIssues = [];
  const mockFetch = async (url, init = {}) => {
    const u = String(url);
    if (u === 'https://github.com/login/oauth/access_token') {
      return new Response(JSON.stringify({ access_token: 'gho_test_secret_token_999' }), { status: 200 });
    }
    if (u === 'https://api.github.com/user') {
      assert.equal(init.headers.Authorization, 'Bearer gho_test_secret_token_999');
      return new Response(
        JSON.stringify({
          id: 4242,
          login: 'barnesy',
          name: 'Chris Barnes',
          avatar_url: 'https://avatars.githubusercontent.com/u/4242',
          html_url: 'https://github.com/barnesy',
        }),
        { status: 200 }
      );
    }
    if (u.startsWith('https://api.github.com/gists?')) {
      const list = Array.from(gistStore.values());
      return new Response(JSON.stringify(list), { status: 200 });
    }
    if (u === 'https://api.github.com/gists' && init.method === 'POST') {
      const body = JSON.parse(init.body);
      assert.equal(body.public, false, 'Career stats Gist MUST be private (public: false)');
      const id = 'gist_abc123';
      const gistObj = {
        id,
        html_url: `https://gist.github.com/barnesy/${id}`,
        updated_at: '2026-11-21T04:00:00Z',
        files: {
          'techno-dive-logbook.json': { content: body.files['techno-dive-logbook.json'].content },
        },
      };
      gistStore.set(id, gistObj);
      return new Response(JSON.stringify(gistObj), { status: 201 });
    }
    if (u.startsWith('https://api.github.com/gists/gist_abc123')) {
      const existing = gistStore.get('gist_abc123');
      if (!existing) return new Response('Not found', { status: 404 });
      if (init.method === 'PATCH') {
        const body = JSON.parse(init.body);
        existing.files['techno-dive-logbook.json'].content = body.files['techno-dive-logbook.json'].content;
        existing.updated_at = '2026-11-21T04:05:00Z';
      }
      return new Response(JSON.stringify(existing), { status: 200 });
    }
    if (u === 'https://api.github.com/repos/barnesy/cave-diver/issues' && init.method === 'POST') {
      assert.equal(init.headers.Authorization, 'Bearer gho_test_secret_token_999');
      const body = JSON.parse(init.body);
      createdIssues.push(body);
      return new Response(
        JSON.stringify({
          number: 77,
          title: body.title,
          html_url: 'https://github.com/barnesy/cave-diver/issues/77',
        }),
        { status: 201 }
      );
    }
    return new Response(`Unexpected URL ${u}`, { status: 500 });
  };

  const gh = createGitHubHandler({
    fetchImpl: mockFetch,
    env: {
      GITHUB_CLIENT_ID: 'Iv1_test_client_id',
      GITHUB_CLIENT_SECRET: 'super_secret_oauth_key',
      GITHUB_ISSUES_REPO: 'barnesy/cave-diver',
    },
  });

  // Login redirects with CSRF state cookie
  const loginRes = await gh.GET(new Request('https://cave-diver.vercel.app/api/github/login'));
  assert.equal(loginRes.status, 302);
  const authLoc = new URL(loginRes.headers.get('location'));
  assert.equal(authLoc.hostname, 'github.com');
  assert.equal(authLoc.searchParams.get('scope'), 'read:user gist public_repo');
  const stateParam = authLoc.searchParams.get('state');
  const stateCookieHeader = loginRes.headers.get('set-cookie');
  assert.ok(stateCookieHeader.includes('HttpOnly') && stateCookieHeader.includes('Secure'));
  const stateCookiePair = stateCookieHeader.split(';')[0];

  // Callback rejects mismatched CSRF state
  const badCb = await gh.GET(
    new Request('https://cave-diver.vercel.app/api/github/callback?code=abc&state=wrong', {
      headers: { cookie: stateCookiePair },
    })
  );
  assert.equal(badCb.status, 302);
  assert.ok(badCb.headers.get('location').includes('gh=invalid_state'));

  // Callback succeeds with valid state and encrypts token inside HttpOnly cookie
  const okCb = await gh.GET(
    new Request(`https://cave-diver.vercel.app/api/github/callback?code=validcode&state=${encodeURIComponent(stateParam)}`, {
      headers: { cookie: stateCookiePair },
    })
  );
  assert.equal(okCb.status, 302);
  assert.equal(okCb.headers.get('location'), 'https://cave-diver.vercel.app/?gh=connected');
  const allSetCookies = okCb.headers.getSetCookie ? okCb.headers.getSetCookie() : [okCb.headers.get('set-cookie')];
  const sessionSetCookie = allSetCookies.find((c) => c.startsWith('td_gh_session='));
  assert.ok(sessionSetCookie && sessionSetCookie.includes('HttpOnly'));
  assert.ok(!sessionSetCookie.includes('gho_test_secret_token_999'), 'OAuth token must be AES-GCM encrypted, never plaintext');
  const sessionCookiePair = sessionSetCookie.split(';')[0];

  // Session reports authenticated user
  const sessRes = await gh.GET(
    new Request('https://cave-diver.vercel.app/api/github/session', {
      headers: { cookie: sessionCookiePair },
    })
  );
  const sessJson = await sessRes.json();
  assert.equal(sessJson.authenticated, true);
  assert.equal(sessJson.user.login, 'barnesy');

  // First sync creates Private Gist with devA
  const sync1 = await gh.POST(
    new Request('https://cave-diver.vercel.app/api/github/sync', {
      method: 'POST',
      headers: { cookie: sessionCookiePair, 'content-type': 'application/json' },
      body: JSON.stringify({ logbook: devA, prefs: { playerName: 'barnesy', difficulty: 'hardcore' } }),
    })
  );
  assert.equal(sync1.status, 200);
  const sync1Json = await sync1.json();
  assert.equal(sync1Json.ok, true);
  assert.equal(sync1Json.gistId, 'gist_abc123');
  const refreshedCookie = (sync1.headers.getSetCookie?.() || []).find((c) => c.startsWith('td_gh_session='))?.split(';')[0] || sessionCookiePair;

  // Second sync from Device B merges devA + devB without losing either
  const sync2 = await gh.POST(
    new Request('https://cave-diver.vercel.app/api/github/sync', {
      method: 'POST',
      headers: { cookie: refreshedCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ logbook: devB, prefs: { gear: { sonar: true, dpv: false, ccr: true } } }),
    })
  );
  assert.equal(sync2.status, 200);
  const sync2Json = await sync2.json();
  assert.equal(Object.keys(sync2Json.logbook.cleared).length, 3);
  assert.equal(sync2Json.logbook.daily.currentStreak, 3);
  assert.equal(sync2Json.logbook.fieldGuide.whaleshark.bestStars, 3);

  // Unauthenticated issue submission returns 401 + pre-filled GitHub fallback URL
  const unauthIssue = await gh.POST(
    new Request('https://cave-diver.vercel.app/api/github/issue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'bug', title: 'Test bug', description: 'Steps to reproduce' }),
    })
  );
  assert.equal(unauthIssue.status, 401);
  const unauthJson = await unauthIssue.json();
  assert.ok(unauthJson.fallbackUrl.startsWith('https://github.com/barnesy/cave-diver/issues/new?'));

  // Authenticated issue submission posts directly to barnesy/cave-diver with diagnostics
  const authIssue = await gh.POST(
    new Request('https://cave-diver.vercel.app/api/github/issue', {
      method: 'POST',
      headers: { cookie: refreshedCookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'bug',
        title: 'Torch flickers near hatch',
        description: 'Happened on HMS Victoria at 42m depth.',
        context: { appVersion: 'v115', levelName: 'HMS Victoria', difficulty: 'standard', multiplayer: true },
      }),
    })
  );
  assert.equal(authIssue.status, 200);
  const authIssueJson = await authIssue.json();
  assert.equal(authIssueJson.ok, true);
  assert.equal(authIssueJson.issue.number, 77);
  assert.equal(createdIssues.length, 1);
  assert.equal(createdIssues[0].title, '[Bug] Torch flickers near hatch');
  assert.ok(createdIssues[0].body.includes('Techno Dive Diagnostics') && createdIssues[0].body.includes('HMS Victoria'));

  // Logout clears cookie
  const logoutRes = await gh.POST(
    new Request('https://cave-diver.vercel.app/api/github/logout', { method: 'POST' })
  );
  assert.equal(logoutRes.status, 200);
  assert.ok((logoutRes.headers.get('set-cookie') || '').includes('Max-Age=0'));

  // Client pre-filled URL helper works offline
  const preUrl = buildPrefilledIssueUrl({ kind: 'feature', title: 'Dive log CSV', description: 'Export dives' });
  assert.ok(preUrl.includes('github.com/barnesy/cave-diver/issues/new?') && preUrl.includes('Feature'));
});

test('v116 Upstash Redis KV store + GitHub Private Gist PB Ghost & Loadout sync', async () => {
  const { getUpstashConfig, kvWriteJson, kvReadJson, kvListPaths, kvDeletePath } = await import('../api/_kvStore.js');
  const { normalizeGhostTrack, mergeGhostTracks } = await import('../public/js/game/logbookModel.js');
  const { createGitHubHandler } = await import('../api/github.js');

  // 1. Upstash config supports both UPSTASH_REDIS_REST_* and KV_REST_API_*
  assert.equal(getUpstashConfig({}), null);
  assert.deepEqual(
    getUpstashConfig({ UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io/', UPSTASH_REDIS_REST_TOKEN: 'tok1' }),
    { url: 'https://redis.upstash.io', token: 'tok1' }
  );
  assert.deepEqual(
    getUpstashConfig({ KV_REST_API_URL: 'https://kv.upstash.io', KV_REST_API_TOKEN: 'tok2' }),
    { url: 'https://kv.upstash.io', token: 'tok2' }
  );

  // 2. Mocked Upstash Redis REST endpoint handles SET+EX, SADD, GET, SMEMBERS, DEL+SREM
  const kvData = new Map();
  const kvSets = new Map();
  const seenTtls = new Map();
  const execCmd = (cmd) => {
    const op = cmd[0];
    if (op === 'GET') return kvData.has(cmd[1]) ? kvData.get(cmd[1]) : null;
    if (op === 'SET') {
      kvData.set(cmd[1], cmd[2]);
      if (cmd[3] === 'EX') seenTtls.set(cmd[1], cmd[4]);
      return 'OK';
    }
    if (op === 'DEL') {
      kvData.delete(cmd[1]);
      return 1;
    }
    if (op === 'SADD') {
      if (!kvSets.has(cmd[1])) kvSets.set(cmd[1], new Set());
      kvSets.get(cmd[1]).add(cmd[2]);
      return 1;
    }
    if (op === 'SREM') {
      kvSets.get(cmd[1])?.delete(cmd[2]);
      return 1;
    }
    if (op === 'SMEMBERS') {
      return Array.from(kvSets.get(cmd[1]) || []);
    }
    throw new Error(`Unexpected Redis op ${op}`);
  };
  const mockRedisFetch = async (url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer tok1');
    const body = JSON.parse(init.body);
    if (String(url).endsWith('/pipeline')) {
      return new Response(JSON.stringify(body.map((c) => ({ result: execCmd(c) }))), { status: 200 });
    }
    return new Response(JSON.stringify({ result: execCmd(body) }), { status: 200 });
  };
  const redisOpts = {
    env: { UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'tok1' },
    fetchImpl: mockRedisFetch,
  };

  await kvWriteJson('rooms/ABCD.json', { code: 'ABCD', players: [{ id: 'p1', name: 'Chris' }] }, { ttlSec: 1500, ...redisOpts });
  assert.equal(seenTtls.get('td:rooms/ABCD.json'), 1500, 'Room write must set 25-min Redis EX TTL');
  const listed = await kvListPaths('rooms/', 20, redisOpts);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].pathname, 'rooms/ABCD.json');
  const readBack = await kvReadJson('rooms/ABCD.json', null, redisOpts);
  assert.equal(readBack.notFound, false);
  assert.equal(readBack.data.code, 'ABCD');
  await kvDeletePath('rooms/ABCD.json', redisOpts);
  assert.equal((await kvReadJson('rooms/ABCD.json', null, redisOpts)).notFound, true);
  assert.equal((await kvListPaths('rooms/', 20, redisOpts)).length, 0);

  // 3. PB Ghost Track normalization & faster-PB merge
  const longTrack = Array.from({ length: 900 }, (_, i) => [i * 2, 100 + i, 50 + (i % 40), 0]);
  const compact = normalizeGhostTrack(longTrack, 360);
  assert.ok(compact.length <= 360 && compact.length >= 100);
  assert.deepEqual(compact[0], longTrack[0], 'Compact ghost must preserve start point');
  assert.deepEqual(compact[compact.length - 1], longTrack[longTrack.length - 1], 'Compact ghost must preserve exact finish timestamp');

  const slowGhost = [[0, 10, 10, 0], [1800, 90, 20, 0]];
  const fastGhost = [[0, 10, 10, 0], [1420, 90, 20, 0]];
  const mergedGhosts = mergeGhostTracks(
    { 'cenote-el-abismo': slowGhost, 'eagles-nest-sink': slowGhost },
    { 'cenote-el-abismo': fastGhost, 'uss-oriskany-carrier': fastGhost }
  );
  assert.equal(Object.keys(mergedGhosts).length, 3);
  assert.equal(mergedGhosts['cenote-el-abismo'][1][0], 1420, 'Merge must pick faster PB ghost per site');

  // 4. GitHub Private Gist sync persists & merges PB ghosts + extended loadout prefs
  const { encryptSessionPayload, getGitHubConfig } = await import('../api/_githubAuth.js');
  const env = { GITHUB_CLIENT_ID: 'id1', GITHUB_CLIENT_SECRET: 'sec1' };
  const cfg = getGitHubConfig(env);
  const cookieVal = encryptSessionPayload(
    { token: 'gho_tok', user: { id: 1, login: 'barnesy', name: 'Chris' }, gistId: null },
    cfg
  );
  let savedGistBody = null;
  const mockGhFetch = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith('https://api.github.com/gists?')) return new Response('[]', { status: 200 });
    if (u === 'https://api.github.com/gists' && init.method === 'POST') {
      savedGistBody = JSON.parse(JSON.parse(init.body).files['techno-dive-logbook.json'].content);
      return new Response(
        JSON.stringify({ id: 'g_ghosts', html_url: 'https://gist.github.com/barnesy/g_ghosts', updated_at: '2026-11-21T09:00:00Z' }),
        { status: 201 }
      );
    }
    return new Response('err', { status: 500 });
  };
  const gh = createGitHubHandler({ fetchImpl: mockGhFetch, env });
  const syncRes = await gh.POST(
    new Request('https://cave-diver.vercel.app/api/github/sync', {
      method: 'POST',
      headers: { cookie: `td_gh_session=${cookieVal}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        logbook: { totalDives: 2, cleared: {} },
        prefs: { gear: { sonar: true, dpv: true, ccr: false }, difficulty: 'hardcore', ghostEnabled: true, torchStickEnabled: false },
        ghosts: { 'cenote-el-abismo': fastGhost },
      }),
    })
  );
  assert.equal(syncRes.status, 200);
  const syncJson = await syncRes.json();
  assert.equal(syncJson.ghosts['cenote-el-abismo'][1][0], 1420);
  assert.equal(syncJson.prefs.torchStickEnabled, false);
  assert.equal(syncJson.prefs.gear.dpv, true);
  assert.equal(savedGistBody.ghosts['cenote-el-abismo'][1][0], 1420);
});
