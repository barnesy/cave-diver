/**
 * Mechanical Craft & Articulated Apparatus Visual/Animation State Engine (v148).
 *
 * Drives smooth 3D bulkhead door swings, Bourdon pressure-gauge needle sweeps,
 * articulated diver working-arm reach poses, titanium shears slash arcs,
 * stainless bolt-snap glints, and pooled mechanical micro-particles (rust flakes,
 * severed monofilament curls, compressed gas bleed mist) across all 33 dive sites.
 *
 * Pure zero-DOM module with bounded particle capacity for mobile 60 FPS stability.
 */

export const MAX_MECH_PARTICLES = 96;

/**
 * Create a fresh mechanical animation & particle state attached to a DiveSession.
 */
export function createMechanicalFxState() {
  return {
    hatchOpenAnims: new Map(),
    valveAnims: new Map(),
    activeAction: null,
    particles: [],
  };
}

function pushParticle(fx, p) {
  if (!fx || !Array.isArray(fx.particles)) return;
  if (fx.particles.length >= MAX_MECH_PARTICLES) {
    fx.particles.shift();
  }
  fx.particles.push(p);
}

/**
 * Record a discrete mechanical interaction event (valve bleed, bulkhead unseal,
 * shears cut, bolt-snap clip, stage refill/drop, jump-spool arrow, lift-bag fill).
 */
export function recordMechanicalEvent(fx, kind, payload = {}) {
  if (!fx || !kind) return;
  const x = Number(payload.x) || 0;
  const y = Number(payload.y) || 0;
  const targetId = payload.targetId || null;
  const angle = Number.isFinite(payload.angle) ? payload.angle : 0;

  if (kind === 'valve-equalize') {
    if (targetId) fx.valveAnims.set(targetId, 0.001);
    fx.activeAction = { kind: 'valve-equalize', x, y, targetId, angle, timer: 0, duration: 0.72 };
    // High-velocity directional compressed-gas bleed jet + brass spark glint
    const jetAngle = angle || -Math.PI * 0.25;
    for (let i = 0; i < 16; i++) {
      const spread = (Math.random() - 0.5) * 0.42;
      const spd = 2.1 + Math.random() * 2.8;
      pushParticle(fx, {
        kind: 'jet',
        x: x + (Math.random() - 0.5) * 0.14,
        y: y + (Math.random() - 0.5) * 0.14,
        vx: Math.cos(jetAngle + spread) * spd,
        vy: Math.sin(jetAngle + spread) * spd - 0.35,
        size: 0.07 + Math.random() * 0.09,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 3,
        age: 0,
        life: 0.42 + Math.random() * 0.38,
        color: i % 3 === 0 ? '#bae6fd' : '#e0f2fe',
      });
    }
    pushParticle(fx, {
      kind: 'glint',
      x,
      y,
      vx: 0,
      vy: 0,
      size: 0.42,
      rot: Math.random() * 0.6,
      vRot: 2.2,
      age: 0,
      life: 0.45,
      color: '#fde047',
    });
    return;
  }

  if (kind === 'hatch-open') {
    if (targetId) fx.hatchOpenAnims.set(targetId, 0.001);
    fx.activeAction = { kind: 'hatch-open', x, y, targetId, angle, timer: 0, duration: 0.55 };
    const r = Number(payload.radius) || 1.8;
    // Tumbling iron-oxide rust flakes shearing off the bulkhead gasket
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const rad = r * (0.55 + Math.random() * 0.38);
      const spd = 0.45 + Math.random() * 1.15;
      pushParticle(fx, {
        kind: 'rust',
        x: x + Math.cos(a) * rad,
        y: y + Math.sin(a) * rad,
        vx: Math.cos(a) * spd + (Math.random() - 0.5) * 0.4,
        vy: Math.sin(a) * spd * 0.6 + 0.18 + Math.random() * 0.35,
        size: 0.06 + Math.random() * 0.08,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 7.5,
        age: 0,
        life: 1.4 + Math.random() * 1.1,
        color: i % 3 === 0 ? '#b45309' : i % 3 === 1 ? '#7c2d12' : '#92400e',
      });
    }
    pushParticle(fx, {
      kind: 'glint',
      x,
      y,
      vx: 0,
      vy: 0,
      size: 0.68,
      rot: 0,
      vRot: 1.8,
      age: 0,
      life: 0.52,
      color: '#34d399',
    });
    return;
  }

  if (kind === 'cut-net') {
    fx.activeAction = { kind: 'cut-net', x, y, targetId, angle, timer: 0, duration: 0.46 };
    const isLineTrap = Boolean(payload.isLineTrap);
    // Severed curling monofilament / nylon line strands snapping apart
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 0.8 + Math.random() * 1.8;
      pushParticle(fx, {
        kind: 'filament',
        x: x + (Math.random() - 0.5) * 0.5,
        y: y + (Math.random() - 0.5) * 0.5,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 0.22 + Math.random() * 0.24,
        rot: a,
        vRot: (Math.random() - 0.5) * 11,
        age: 0,
        life: 0.75 + Math.random() * 0.55,
        color: isLineTrap ? '#fef08a' : '#fbbf24',
      });
    }
    pushParticle(fx, {
      kind: 'glint',
      x,
      y,
      vx: 0,
      vy: 0,
      size: 0.58,
      rot: 0.35,
      vRot: 4.5,
      age: 0,
      life: 0.34,
      color: '#f8fafc',
    });
    return;
  }

  if (kind === 'clip-line' || kind === 'unclip-line' || kind === 'place-marker' || kind === 'claim-beacon') {
    fx.activeAction = { kind, x, y, targetId, angle, timer: 0, duration: 0.38 };
    const col =
      kind === 'place-marker'
        ? '#facc15'
        : kind === 'claim-beacon'
          ? '#2dd4bf'
          : kind === 'clip-line'
            ? '#38bdf8'
            : '#e2e8f0';
    pushParticle(fx, {
      kind: 'glint',
      x,
      y,
      vx: 0,
      vy: 0,
      size: 0.54,
      rot: 0,
      vRot: 3.4,
      age: 0,
      life: 0.38,
      color: col,
    });
    return;
  }

  if (kind === 'refill-stage' || kind === 'drop-stage' || kind === 'retrieve-stage') {
    fx.activeAction = { kind, x, y, targetId, angle, timer: 0, duration: 0.45 };
    pushParticle(fx, {
      kind: 'glint',
      x,
      y,
      vx: 0,
      vy: 0,
      size: 0.56,
      rot: 0.2,
      vRot: 2.8,
      age: 0,
      life: 0.42,
      color: '#bae6fd',
    });
    const mistCount = kind === 'refill-stage' ? 10 : 5;
    for (let i = 0; i < mistCount; i++) {
      const a = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.4;
      const spd = 0.7 + Math.random() * 1.3;
      pushParticle(fx, {
        kind: 'jet',
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 0.06 + Math.random() * 0.06,
        rot: 0,
        vRot: 0,
        age: 0,
        life: 0.35 + Math.random() * 0.28,
        color: '#e0f2fe',
      });
    }
    return;
  }

  if (kind === 'liftbag-inflate' || kind === 'liftbag-vent') {
    fx.activeAction = { kind, x, y, targetId, angle, timer: 0, duration: kind === 'liftbag-inflate' ? 0.52 : 0.36 };
    for (let i = 0; i < 10; i++) {
      const spread = (Math.random() - 0.5) * 0.55;
      const spd = 1.4 + Math.random() * 1.8;
      pushParticle(fx, {
        kind: 'jet',
        x: x + (Math.random() - 0.5) * 0.2,
        y: y - (kind === 'liftbag-vent' ? 1.5 : 0.35),
        vx: Math.sin(spread) * spd * 0.65,
        vy: -Math.cos(spread) * spd,
        size: 0.07 + Math.random() * 0.07,
        rot: 0,
        vRot: 0,
        age: 0,
        life: 0.36 + Math.random() * 0.26,
        color: kind === 'liftbag-inflate' ? '#fef3c7' : '#e0f2fe',
      });
    }
    pushParticle(fx, {
      kind: 'glint',
      x,
      y: y - 0.2,
      vx: 0,
      vy: 0,
      size: 0.46,
      rot: 0,
      vRot: 2.6,
      age: 0,
      life: 0.36,
      color: '#fb923c',
    });
    return;
  }

  if (kind === 'gas-switch') {
    fx.activeAction = {
      kind: 'gas-switch',
      x,
      y,
      targetId,
      angle,
      gasId: payload.gasId || 'EAN32',
      timer: 0,
      duration: 0.44,
    };
    const purgeCol = payload.gasId === 'O2' ? '#6ee7b7' : payload.gasId === 'TMX1455' ? '#fde68a' : '#bae6fd';
    for (let i = 0; i < 9; i++) {
      const a = angle + (Math.random() - 0.5) * 1.1;
      const spd = 1.0 + Math.random() * 1.5;
      pushParticle(fx, {
        kind: 'jet',
        x: x + (Math.random() - 0.5) * 0.12,
        y: y + (Math.random() - 0.5) * 0.12,
        vx: Math.cos(a) * spd * 0.65,
        vy: Math.sin(a) * spd * 0.4 - 0.65 - Math.random() * 0.5,
        size: 0.055 + Math.random() * 0.055,
        rot: 0,
        vRot: 0,
        age: 0,
        life: 0.34 + Math.random() * 0.24,
        color: purgeCol,
      });
    }
    pushParticle(fx, {
      kind: 'glint',
      x,
      y,
      vx: 0,
      vy: 0,
      size: 0.44,
      rot: 0.25,
      vRot: 3.1,
      age: 0,
      life: 0.34,
      color: purgeCol,
    });
    return;
  }

  if (kind === 'mask-purge') {
    fx.activeAction = { kind: 'mask-purge', x, y, targetId, angle, timer: 0, duration: 0.58 };
    for (let i = 0; i < 14; i++) {
      const spread = (Math.random() - 0.5) * 0.9;
      const spd = 0.8 + Math.random() * 1.5;
      pushParticle(fx, {
        kind: 'jet',
        x: x + (Math.random() - 0.5) * 0.16,
        y: y - 0.06,
        vx: Math.sin(spread) * spd * 0.7,
        vy: -0.9 - Math.random() * 1.4,
        size: 0.06 + Math.random() * 0.065,
        rot: 0,
        vRot: 0,
        age: 0,
        life: 0.42 + Math.random() * 0.3,
        color: i % 2 === 0 ? '#e0f2fe' : '#a5f3fc',
      });
    }
    return;
  }

  if (kind === 'free-flow-shutoff') {
    fx.activeAction = { kind: 'free-flow-shutoff', x, y, targetId, angle, timer: 0, duration: 0.62 };
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.3;
      const spd = 1.2 + Math.random() * 1.8;
      pushParticle(fx, {
        kind: 'jet',
        x,
        y: y - 0.12,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 0.065 + Math.random() * 0.06,
        rot: 0,
        vRot: 0,
        age: 0,
        life: 0.38 + Math.random() * 0.28,
        color: '#fef3c7',
      });
    }
    pushParticle(fx, {
      kind: 'glint',
      x,
      y: y - 0.14,
      vx: 0,
      vy: 0,
      size: 0.5,
      rot: 0,
      vRot: 3.6,
      age: 0,
      life: 0.44,
      color: '#fde047',
    });
    return;
  }

  if (kind === 'drill-clear') {
    fx.activeAction = { kind: 'drill-clear', x, y, targetId, angle, timer: 0, duration: 0.42 };
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.8;
      const spd = 0.9 + Math.random() * 1.4;
      pushParticle(fx, {
        kind: 'jet',
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 0.06 + Math.random() * 0.05,
        rot: 0,
        vRot: 0,
        age: 0,
        life: 0.32 + Math.random() * 0.24,
        color: '#a7f3d0',
      });
    }
  }
}

/**
 * Advance bulkhead swing-open animations, pressure-valve sweeps, working-arm action timers,
 * and pooled mechanical micro-particles.
 */
export function stepMechanicalFx(fx, dt) {
  if (!fx || !(dt > 0)) return;

  if (fx.hatchOpenAnims && fx.hatchOpenAnims.size > 0) {
    for (const [id, p] of fx.hatchOpenAnims) {
      if (p < 1) {
        fx.hatchOpenAnims.set(id, Math.min(1, p + dt / 0.68));
      }
    }
  }

  if (fx.valveAnims && fx.valveAnims.size > 0) {
    for (const [id, p] of fx.valveAnims) {
      if (p < 1) {
        fx.valveAnims.set(id, Math.min(1, p + dt / 0.92));
      }
    }
  }

  if (fx.activeAction) {
    fx.activeAction.timer += dt;
    if (fx.activeAction.timer >= fx.activeAction.duration) {
      fx.activeAction = null;
    }
  }

  if (Array.isArray(fx.particles) && fx.particles.length > 0) {
    const drag = Math.exp(-3.4 * dt);
    const jetDrag = Math.exp(-5.2 * dt);
    let writeIdx = 0;
    for (let i = 0; i < fx.particles.length; i++) {
      const p = fx.particles[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      if (p.kind === 'rust') {
        p.vx *= drag;
        p.vy = p.vy * drag + 0.32 * dt; // gentle underwater sink of iron flakes
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vRot * dt;
      } else if (p.kind === 'filament') {
        p.vx *= drag;
        p.vy *= drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vRot * dt;
      } else if (p.kind === 'jet') {
        p.vx *= jetDrag;
        p.vy = p.vy * jetDrag - 0.85 * dt; // buoyant micro-mist rises
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else if (p.kind === 'glint') {
        p.rot += p.vRot * dt;
      }
      fx.particles[writeIdx++] = p;
    }
    fx.particles.length = writeIdx;
  }
}
