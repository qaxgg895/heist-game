// The game's rules and state, with no drawing and no browser in it: the thief,
// the patrolling guards and their vision cones, the sweeping cameras, the
// blinking vault laser, the loot and the alarm meter. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react without
// the world knowing about screens or sound. Nothing here allocates after
// createWorld returns, and the layout is fixed, so a seeded run is repeatable.
import {
  ALARM,
  BENCHES,
  CAMERA,
  CAMERAS,
  EXIT,
  FIELD,
  GUARD,
  GUARDS,
  LASER,
  LOOT,
  PLAYER,
  START,
  WALLS,
} from './config.js';

export const EVENT_SPOTTED = 1;
export const EVENT_GRAB = 2;
export const EVENT_WIN = 4;
export const EVENT_BUSTED = 8;
export const EVENT_LASER = 16;
export const EVENT_ALARM_HIGH = 32;

const TWO_PI = Math.PI * 2;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function angleDiff(a, b) {
  let d = (a - b) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

/** True when the segment (x1,y1)-(x2,y2) touches the rectangle. */
function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (dx === 0) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) {
      const t = t1;
      t1 = t2;
      t2 = t;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (dy === 0) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) {
      const t = t1;
      t1 = t2;
      t2 = t;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

/** Line of sight: nothing sight-blocking stands between the two points. */
function lineOfSight(x1, y1, x2, y2) {
  for (let i = 0; i < WALLS.length; i += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, WALLS[i])) return false;
  }
  return true;
}

/**
 * Can the observer (x, y, facing angle, range, half-FOV) see the point?
 * The thief's effective range shrinks while sneaking: a crouched thief is
 * harder to spot at distance.
 */
function canSee(obs, tx, ty, sneaking) {
  const dx = tx - obs.x;
  const dy = ty - obs.y;
  const dist = Math.hypot(dx, dy);
  const range = sneaking ? obs.range * 0.72 : obs.range;
  if (dist > range) return false;
  if (Math.abs(angleDiff(Math.atan2(dy, dx), obs.angle)) > obs.fov) return false;
  return lineOfSight(obs.x, obs.y, tx, ty);
}

/** Move a circle (x, y, radius) by (dx, dy), sliding along walls and benches. */
function moveCircle(body, dx, dy) {
  const solids = WALLS;
  let nx = body.x + dx;
  for (let i = 0; i < solids.length; i += 1) {
    const r = solids[i];
    if (
      nx + body.radius > r.x &&
      nx - body.radius < r.x + r.w &&
      body.y + body.radius > r.y &&
      body.y - body.radius < r.y + r.h
    ) {
      nx = dx > 0 ? r.x - body.radius : r.x + r.w + body.radius;
    }
  }
  body.x = clamp(nx, body.radius, FIELD.width - body.radius);
  let ny = body.y + dy;
  for (let i = 0; i < solids.length; i += 1) {
    const r = solids[i];
    if (
      body.x + body.radius > r.x &&
      body.x - body.radius < r.x + r.w &&
      ny + body.radius > r.y &&
      ny - body.radius < r.y + r.h
    ) {
      ny = dy > 0 ? r.y - body.radius : r.y + r.h + body.radius;
    }
  }
  body.y = clamp(ny, body.radius, FIELD.height - body.radius);
  for (let i = 0; i < BENCHES.length; i += 1) {
    const r = BENCHES[i];
    if (
      body.x + body.radius > r.x &&
      body.x - body.radius < r.x + r.w &&
      body.y + body.radius > r.y &&
      body.y - body.radius < r.y + r.h
    ) {
      // Pushed out along the smallest overlap, so benches are walked around.
      const pushLeft = body.x + body.radius - r.x;
      const pushRight = r.x + r.w - (body.x - body.radius);
      const pushUp = body.y + body.radius - r.y;
      const pushDown = r.y + r.h - (body.y - body.radius);
      const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
      if (min === pushLeft) body.x = r.x - body.radius;
      else if (min === pushRight) body.x = r.x + r.w + body.radius;
      else if (min === pushUp) body.y = r.y - body.radius;
      else body.y = r.y + r.h + body.radius;
    }
  }
}

export function createWorld(/* random: kept for the harness signature; the layout is fixed */) {
  const player = {
    x: START.x,
    y: START.y,
    radius: PLAYER.radius,
    facing: -Math.PI / 2,
    sneaking: false,
  };
  const guards = GUARDS.map((g) => ({
    name: g.name,
    x: g.x,
    y: g.y,
    radius: GUARD.radius,
    angle: 0,
    waypoints: g.waypoints,
    wp: 1,
    mode: 'patrol',
    wait: 0,
    lastSeenX: 0,
    lastSeenY: 0,
    seen: false,
  }));
  // Face each guard along its first patrol leg.
  for (const guard of guards) {
    const [tx, ty] = guard.waypoints[guard.wp];
    guard.angle = Math.atan2(ty - guard.y, tx - guard.x);
  }
  const cameras = CAMERAS.map((c) => ({
    x: c.x,
    y: c.y,
    baseAngle: c.baseAngle,
    phase: c.phase,
    angle: c.baseAngle,
    range: CAMERA.range,
    fov: CAMERA.fov,
    seen: false,
  }));
  const loots = LOOT.map((l) => ({ ...l, taken: false }));
  const state = {
    player,
    guards,
    cameras,
    loots,
    alarm: 0,
    score: 0,
    time: 0,
    status: 'play', // play | won | busted
    hasDiamond: false,
    laserOn: true,
    laserCooldown: 0,
    seenNow: false,
    timeBonus: 0,
  };

  function reset() {
    player.x = START.x;
    player.y = START.y;
    player.facing = -Math.PI / 2;
    player.sneaking = false;
    for (let i = 0; i < guards.length; i += 1) {
      const g = guards[i];
      const def = GUARDS[i];
      g.x = def.x;
      g.y = def.y;
      g.wp = 1;
      g.mode = 'patrol';
      g.wait = 0;
      g.seen = false;
      const [tx, ty] = g.waypoints[g.wp];
      g.angle = Math.atan2(ty - g.y, tx - g.x);
    }
    for (const cam of cameras) {
      cam.angle = cam.baseAngle;
      cam.seen = false;
    }
    for (const loot of loots) loot.taken = false;
    state.alarm = 0;
    state.score = 0;
    state.time = 0;
    state.status = 'play';
    state.hasDiamond = false;
    state.laserOn = true;
    state.laserCooldown = 0;
    state.seenNow = false;
    state.timeBonus = 0;
  }

  function moveToward(body, tx, ty, speed, dt) {
    const dx = tx - body.x;
    const dy = ty - body.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return true;
    const step = Math.min(dist, speed * dt);
    const nx = (dx / dist) * step;
    const ny = (dy / dist) * step;
    body.angle = Math.atan2(ny, nx);
    moveCircle(body, nx, ny);
    return dist - step < 2;
  }

  /**
   * One fixed step. `input` is {x, y, sneak, grab} with x/y a unit-ish
   * direction. With `harmless` set (the title screen's backdrop) the guards
   * patrol and the cameras sweep, but nothing is spotted and nothing scores.
   */
  function step(dt, input, harmless) {
    let events = 0;
    if (state.status !== 'play') return events;
    state.time += dt;

    // The vault laser blinks on its own clock.
    const cycle = LASER.onSeconds + LASER.offSeconds;
    state.laserOn = state.time % cycle < LASER.onSeconds;
    if (state.laserCooldown > 0) state.laserCooldown -= dt;

    // The thief.
    const speed = input.sneak ? PLAYER.sneak : PLAYER.walk;
    player.sneaking = input.sneak;
    if (input.x !== 0 || input.y !== 0) {
      const len = Math.hypot(input.x, input.y) || 1;
      const dx = (input.x / len) * speed * dt;
      const dy = (input.y / len) * speed * dt;
      player.facing = Math.atan2(dy, dx);
      moveCircle(player, dx, dy);
    }

    // The cameras sweep.
    for (const cam of cameras) {
      cam.angle =
        cam.baseAngle +
        CAMERA.sweep * Math.sin((TWO_PI * state.time) / CAMERA.period + cam.phase);
    }

    // The guards walk their routes, or investigate the last place the thief
    // was seen once the alarm is up.
    const investigating = !harmless && state.alarm >= ALARM.investigateAt;
    for (const guard of guards) {
      if (investigating && guard.mode === 'patrol') guard.mode = 'investigate';
      if (!investigating && guard.mode !== 'patrol') {
        guard.mode = 'patrol';
        guard.wait = 0;
      }
      if (guard.mode === 'patrol') {
        const [tx, ty] = guard.waypoints[guard.wp];
        if (moveToward(guard, tx, ty, GUARD.patrol, dt)) {
          guard.wp = (guard.wp + 1) % guard.waypoints.length;
        }
      } else if (guard.mode === 'investigate') {
        if (guard.wait > 0) {
          guard.wait -= dt;
          guard.angle += dt * 1.4; // scan the room while waiting
          if (guard.wait <= 0) guard.mode = 'patrol';
        } else if (moveToward(guard, guard.lastSeenX, guard.lastSeenY, GUARD.investigate, dt)) {
          guard.wait = 1.6;
        }
      }
    }

    if (harmless) return events;

    // Who sees the thief right now?
    let seenByGuard = false;
    let seenByCam = false;
    for (const guard of guards) {
      guard.seen = canSee(
        { x: guard.x, y: guard.y, angle: guard.angle, range: GUARD.range, fov: GUARD.fov },
        player.x,
        player.y,
        player.sneaking,
      );
      if (guard.seen) {
        seenByGuard = true;
        guard.lastSeenX = player.x;
        guard.lastSeenY = player.y;
      }
    }
    for (const cam of cameras) {
      cam.seen = canSee(cam, player.x, player.y, player.sneaking);
      if (cam.seen) seenByCam = true;
    }
    state.seenNow = seenByGuard || seenByCam;
    if (state.seenNow && !state.seenBefore) events |= EVENT_SPOTTED;
    state.seenBefore = state.seenNow;

    const wasHigh = state.alarm >= 60;
    if (seenByGuard) {
      state.alarm += (player.sneaking ? ALARM.guardSneak : ALARM.guardWalk) * dt;
    } else if (seenByCam) {
      state.alarm += (player.sneaking ? ALARM.camSneak : ALARM.camWalk) * dt;
    } else {
      state.alarm -= ALARM.decay * dt;
    }
    state.alarm = clamp(state.alarm, 0, ALARM.bustedAt);
    if (!wasHigh && state.alarm >= 60) events |= EVENT_ALARM_HIGH;

    // The vault laser stings anyone who crosses it while it is live.
    if (
      state.laserOn &&
      state.laserCooldown <= 0 &&
      player.x + player.radius > LASER.x &&
      player.x - player.radius < LASER.x + LASER.w &&
      player.y + player.radius > LASER.y &&
      player.y - player.radius < LASER.y + LASER.h
    ) {
      state.alarm = clamp(state.alarm + ALARM.laserHit, 0, ALARM.bustedAt);
      state.laserCooldown = ALARM.laserCooldown;
      events |= EVENT_LASER;
    }

    // Grabbing loot: press E (or the autopilot's grab) near a piece.
    if (input.grab) {
      for (const loot of loots) {
        if (loot.taken) continue;
        if (Math.hypot(loot.x - player.x, loot.y - player.y) <= PLAYER.grabRange) {
          loot.taken = true;
          state.score += loot.value;
          if (loot.id === 'diamond') state.hasDiamond = true;
          events |= EVENT_GRAB;
          break;
        }
      }
    }

    // The win: the diamond in hand and the thief through the service exit.
    if (
      state.hasDiamond &&
      player.x > EXIT.x &&
      player.x < EXIT.x + EXIT.w &&
      player.y > EXIT.y &&
      player.y < EXIT.y + EXIT.h
    ) {
      state.status = 'won';
      state.timeBonus = Math.max(0, 240 - Math.floor(state.time) * 2);
      state.score += state.timeBonus;
      events |= EVENT_WIN;
      return events;
    }

    if (state.alarm >= ALARM.bustedAt) {
      state.status = 'busted';
      events |= EVENT_BUSTED;
    }
    return events;
  }

  reset();
  return { state, reset, step };
}
