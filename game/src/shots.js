// The screenshot scenes behind ?shot=start|sneak|alert|win. Each one plays the
// real rules forward from a fresh world, steered by a scripted autopilot that
// walks between waypoints, waits out the vault laser and grabs loot on the
// way, so the frame is what a short game really looks like and the same seed
// always gives the same frame.
import { LASER, STEP } from './config.js';
import {
  EVENT_BUSTED,
  EVENT_WIN,
} from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 4;
const SAMPLE = STEP;

/** Waypoints are {x, y, sneak} the thief walks to in order. */
function follow(state, target) {
  const p = state.player;
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 16) return { arrived: true, input: { x: 0, y: 0, sneak: target.sneak, grab: false } };
  // Wait out a live laser rather than walk into the vault mouth.
  if (
    state.laserOn &&
    p.y > LASER.y + 16 &&
    target.y < LASER.y &&
    Math.abs(p.x - 640) < 200
  ) {
    return { arrived: false, input: { x: 0, y: 0, sneak: target.sneak, grab: false } };
  }
  const nearLoot = state.loots.some(
    (l) => !l.taken && Math.hypot(l.x - p.x, l.y - p.y) <= 56,
  );
  return {
    arrived: false,
    input: { x: dx, y: dy, sneak: !!target.sneak, grab: nearLoot },
  };
}

/** Walk the waypoint list; stop early when `until(state)` is true. Returns events. */
function walkWaypoints(world, waypoints, maxSeconds, until) {
  const state = world.state;
  let events = 0;
  let index = 0;
  let stuck = 0;
  let lastDist = Infinity;
  const limit = Math.floor(maxSeconds / SAMPLE);
  for (let step = 0; step < limit; step += 1) {
    if (until && until(state)) break;
    if (index >= waypoints.length) break;
    const target = waypoints[index];
    const { arrived, input } = follow(state, target);
    if (arrived) {
      index += 1;
      stuck = 0;
      lastDist = Infinity;
      continue;
    }
    const dist = Math.hypot(target.x - state.player.x, target.y - state.player.y);
    if (dist > lastDist - 0.05) stuck += 1;
    else stuck = 0;
    lastDist = dist;
    if (stuck > 3 / SAMPLE) {
      index += 1; // a waypoint that cannot be reached is skipped, not waited on
      stuck = 0;
      lastDist = Infinity;
      continue;
    }
    events |= world.step(SAMPLE, input, false);
    if (events & (EVENT_WIN | EVENT_BUSTED)) break;
  }
  return events;
}

const SNEAK_ROUTE = [
  { x: 640, y: 560, sneak: false },
  { x: 640, y: 470, sneak: true },
  { x: 640, y: 300, sneak: true },
  { x: 640, y: 215, sneak: true },
];

const ALERT_ROUTE = [
  { x: 640, y: 560, sneak: false },
  { x: 500, y: 300, sneak: false },
  { x: 420, y: 180, sneak: false },
];

const WIN_ROUTE = [
  { x: 300, y: 660, sneak: false },
  { x: 110, y: 660, sneak: true },
  { x: 112, y: 300, sneak: true },
  { x: 110, y: 470, sneak: true },
  { x: 640, y: 470, sneak: true },
  { x: 640, y: 215, sneak: true },
  { x: 640, y: 95, sneak: true },
  { x: 640, y: 215, sneak: true },
  { x: 350, y: 480, sneak: true },
  { x: 150, y: 600, sneak: true },
  { x: 96, y: 636, sneak: true },
];

/**
 * Set `world` to the named scene (start, sneak, alert or win; any other name
 * is start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'sneak' && name !== 'alert' && name !== 'win') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { x: 0, y: 0, sneak: false, grab: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'sneak') {
    walkWaypoints(world, SNEAK_ROUTE, 60);
    return { screen: SCREEN_PLAY, best: state.score };
  }
  if (name === 'alert') {
    walkWaypoints(world, ALERT_ROUTE, 30);
    // Stand in the guard's lane until the alarm is properly up.
    const limit = Math.floor(20 / SAMPLE);
    for (let step = 0; step < limit; step += 1) {
      if (state.alarm >= 65 || state.status !== 'play') break;
      world.step(SAMPLE, { x: 0, y: 0, sneak: false, grab: false }, false);
    }
    return { screen: SCREEN_PLAY, best: state.score };
  }
  const events = walkWaypoints(world, WIN_ROUTE, 150, (s) => s.status === 'won');
  return { screen: events & EVENT_WIN ? SCREEN_WIN : SCREEN_PLAY, best: state.score };
}
