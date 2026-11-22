// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play,
// paused, busted and win.
//
// ?seed=N fixes the run (the layout is fixed, so any seed gives the same
// game). ?shot=start|sneak|alert|win (with &seed=N) stages that scene instead
// of running the loop, paints it twice and sets window.__shotReady for a
// screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_ALARM_HIGH,
  EVENT_BUSTED,
  EVENT_GRAB,
  EVENT_LASER,
  EVENT_SPOTTED,
  EVENT_WIN,
} from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_GRAB,
  ACTION_MUTE,
  ACTION_PAUSE,
  createInput,
} from './input.js';
import { createSound } from './sound.js';
import {
  createRenderer,
  SCREEN_BUSTED,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const sound = createSound();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.toField(x, y));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each event.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    sound.unlock();
    announce('Playing. Steal the Marlow Star and reach the service exit.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_BUSTED;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(
      won
        ? `Clean getaway. Loot $${world.state.score}. Best $${best}.`
        : `Busted. Loot $${world.state.score}. Best $${best}.`,
    );
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = sound.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_WIN || screen === SCREEN_BUSTED)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function react(events) {
    if (events & EVENT_GRAB) {
      if (world.state.hasDiamond) sound.diamond();
      else sound.pickup();
    }
    if (events & EVENT_SPOTTED) sound.spotted();
    if (events & EVENT_LASER) sound.laser();
    if (events & EVENT_ALARM_HIGH) announce('The alarm is climbing — break line of sight!');
    if (events & EVENT_WIN) {
      sound.win();
      endGame(true);
    } else if (events & EVENT_BUSTED) {
      sound.busted();
      endGame(false);
    }
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0, sneak: false, grab: false }, true);
      return;
    }
    const vector = input.vector(world.state.player);
    const events = world.step(
      STEP,
      { x: vector.x, y: vector.y, sneak: vector.sneak, grab: !!(actions & ACTION_GRAB) },
      false,
    );
    react(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the alarm climb unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A tiny hook for automated play-tests: the live score, alarm and status.
  window.__debug = () => ({
    status: world.state.status,
    score: world.state.score,
    alarm: Math.round(world.state.alarm),
    time: Math.round(world.state.time),
    hasDiamond: world.state.hasDiamond,
    loot: world.state.loots.filter((l) => l.taken).map((l) => l.id),
    player: { x: Math.round(world.state.player.x), y: Math.round(world.state.player.y) },
  });

  announce('The Marlow Job. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
