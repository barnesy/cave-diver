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

    // 3. Reject fresh join into an active dive, allow rejoin via reconnectToken
    const ws3 = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await nextMsg(ws3, 'welcome');
    const busyErrPromise = nextMsg(ws3, 'error');
    ws3.send(JSON.stringify({ type: 'join_room', code: created.room.code, name: 'Latecomer' }));
    const busyErr = await busyErrPromise;
    assert.ok(busyErr.message.includes('already underway'));

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

    wsHostBack.close();
    wsGuestWhileAway.close();
    ws2Re3.close();
    ws3.close();
  } finally {
    proc.kill();
  }
});
