// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin
// filled with the backdrop colour. Hand-drawn Canvas 2D throughout: marble
// floor, carpet runner, framed art, glass cases, the steel vault, vision
// cones, sweeping cameras and the thief. Text that holds a number is rebuilt
// only when the number changes, so a frame allocates nothing.
import {
  BENCHES,
  EXIT,
  FIELD,
  FONT,
  GUARD,
  LASER,
  PALETTE,
  WALL_ART,
  WALLS,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 150, line: 32, bottom: 72 };
const TILE = 64;

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Loot $');
  const alarmLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function wedge(x, y, angle, range, halfFov, fill) {
    context.fillStyle = fill;
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, range, angle - halfFov, angle + halfFov);
    context.closePath();
    context.fill();
  }

  function drawFloor() {
    for (let ty = 0; ty < FIELD.height / TILE; ty += 1) {
      for (let tx = 0; tx < FIELD.width / TILE; tx += 1) {
        context.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        context.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
    // The red carpet runner from the door to the vault.
    context.fillStyle = PALETTE.carpet;
    context.fillRect(592, 160, 96, 480);
    context.fillStyle = PALETTE.carpetTrim;
    context.fillRect(588, 160, 4, 480);
    context.fillRect(688, 160, 4, 480);
    // The round rug in the middle of the room: a single thin gold ring.
    context.strokeStyle = PALETTE.carpetTrim;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(640, 420, 78, 0, Math.PI * 2);
    context.stroke();
  }

  function drawWallsAndArt() {
    for (const wall of WALLS) {
      context.fillStyle = PALETTE.wall;
      context.fillRect(wall.x, wall.y, wall.w, wall.h);
    }
    context.fillStyle = PALETTE.wallTrim;
    context.fillRect(24, 24, FIELD.width - 48, 3);
    context.fillRect(24, FIELD.height - 27, FIELD.width - 48, 3);
    for (const art of WALL_ART) {
      context.fillStyle = PALETTE.gold;
      context.fillRect(art.x - 3, art.y - 3, art.w + 6, art.h + 6);
      context.fillStyle = art.hue;
      context.fillRect(art.x, art.y, art.w, art.h);
      context.fillStyle = 'rgba(255,255,255,0.25)';
      context.fillRect(art.x, art.y, art.w, 4);
    }
    // The service exit, bottom left: a green door with a lit sign.
    context.fillStyle = '#123524';
    context.fillRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
    context.fillStyle = PALETTE.exit;
    context.fillRect(EXIT.x, EXIT.y, EXIT.w, 8);
    text('EXIT', EXIT.x + EXIT.w / 2, EXIT.y + 34, 22, PALETTE.exit, 'center');
    text('SERVICE', EXIT.x + EXIT.w / 2, EXIT.y + 56, 13, PALETTE.muted, 'center');
  }

  function drawVaultAndLoot(state) {
    // The vault: a steel alcove at the top centre, its mouth guarded by the laser.
    context.fillStyle = PALETTE.vault;
    context.fillRect(544, 24, 192, 124);
    context.fillStyle = PALETTE.vaultDoor;
    context.fillRect(544, 24, 192, 10);
    context.fillStyle = '#2a3040';
    context.fillRect(600, 60, 80, 60);
    text('VAULT', 640, 52, 15, PALETTE.muted, 'center');
    // The laser across the vault mouth: red while live, faint while dark.
    if (state.laserOn) {
      context.fillStyle = 'rgba(255, 40, 40, 0.85)';
      context.fillRect(LASER.x, LASER.y, LASER.w, LASER.h);
      context.fillStyle = '#ff8080';
      context.fillRect(LASER.x, LASER.y + 3, LASER.w, 3);
    } else {
      context.fillStyle = 'rgba(255, 40, 40, 0.18)';
      context.fillRect(LASER.x, LASER.y, LASER.w, LASER.h);
    }
    // Benches.
    for (const bench of BENCHES) {
      context.fillStyle = PALETTE.bench;
      context.fillRect(bench.x, bench.y, bench.w, bench.h);
      context.fillStyle = '#6b5638';
      context.fillRect(bench.x + 6, bench.y + 4, bench.w - 12, 5);
    }
    // Display cases: glass tops over a plinth; the loot glints inside.
    for (const loot of state.loots) {
      if (loot.id === 'diamond') continue;
      const isCase = loot.id === 'painting' || loot.id === 'vase';
      if (loot.taken) continue;
      if (isCase) {
        context.fillStyle = PALETTE.caseBase;
        context.fillRect(loot.x - 26, loot.y - 16, 52, 32);
        context.fillStyle = 'rgba(127, 179, 213, 0.35)';
        context.fillRect(loot.x - 26, loot.y - 16, 52, 32);
      }
      drawLootIcon(loot);
    }
    // The Marlow Star on its pedestal inside the vault.
    const diamond = state.loots.find((l) => l.id === 'diamond');
    if (diamond && !diamond.taken) {
      const pulse = 0.7 + 0.3 * Math.sin(state.time * 3);
      context.fillStyle = '#3a2f4a';
      context.fillRect(624, 88, 32, 22);
      context.save();
      context.translate(diamond.x, diamond.y);
      context.rotate(Math.PI / 4);
      context.fillStyle = PALETTE.diamond;
      context.globalAlpha = pulse;
      context.fillRect(-11, -11, 22, 22);
      context.restore();
      context.globalAlpha = 1;
      context.strokeStyle = 'rgba(155, 232, 255, 0.5)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(diamond.x, diamond.y, 26 + 4 * Math.sin(state.time * 3), 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawLootIcon(loot) {
    if (loot.id === 'painting') {
      context.fillStyle = '#7a4a3a';
      context.fillRect(loot.x - 14, loot.y - 10, 28, 20);
      context.fillStyle = PALETTE.gold;
      context.fillRect(loot.x - 16, loot.y - 12, 32, 3);
      context.fillRect(loot.x - 16, loot.y + 9, 32, 3);
    } else if (loot.id === 'vase') {
      context.fillStyle = '#7fb3d5';
      context.beginPath();
      context.ellipse(loot.x, loot.y, 11, 15, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#a8d0e8';
      context.fillRect(loot.x - 4, loot.y - 19, 8, 6);
    } else if (loot.id === 'coins') {
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(loot.x, loot.y, 13, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#d9a91f';
      text('$', loot.x, loot.y + 5, 15, '#5a430a', 'center');
    }
  }

  function drawConesAndWatchers(state) {
    // Camera cones first (under the guards' cones).
    for (const cam of state.cameras) {
      wedge(cam.x, cam.y, cam.angle, cam.range, cam.fov, cam.seen ? PALETTE.coneAlert : PALETTE.camCone);
    }
    for (const guard of state.guards) {
      const alerted = guard.mode !== 'patrol' || guard.seen;
      wedge(
        guard.x,
        guard.y,
        guard.angle,
        GUARD.range,
        GUARD.fov,
        alerted ? PALETTE.coneAlert : PALETTE.cone,
      );
    }
    // Cameras: small wall boxes with a lens.
    for (const cam of state.cameras) {
      context.fillStyle = PALETTE.camera;
      context.beginPath();
      context.arc(cam.x, cam.y, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = cam.seen ? '#ff5040' : '#ff5040';
      context.beginPath();
      context.arc(
        cam.x + Math.cos(cam.angle) * 6,
        cam.y + Math.sin(cam.angle) * 6,
        3,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    // Guards: navy suits, a cap, and a "!" when they are on to something.
    for (const guard of state.guards) {
      const alerted = guard.mode !== 'patrol' || guard.seen;
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.beginPath();
      context.ellipse(guard.x, guard.y + 10, 14, 5, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = alerted ? PALETTE.guardAlert : PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#d8cdb4';
      context.beginPath();
      context.arc(guard.x, guard.y, 6, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#d8cdb4';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.angle) * 20, guard.y + Math.sin(guard.angle) * 20);
      context.stroke();
      if (alerted) text('!', guard.x, guard.y - 22, 22, '#ff5040', 'center');
    }
  }

  function drawThief(state) {
    const p = state.player;
    context.fillStyle = 'rgba(0,0,0,0.4)';
    context.beginPath();
    context.ellipse(p.x, p.y + 10, 13, 5, 0, 0, Math.PI * 2);
    context.fill();
    // Hooded figure: dark cloak, teal scarf, facing tick.
    context.fillStyle = PALETTE.thief;
    context.beginPath();
    context.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.thiefScarf;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(p.x, p.y, p.radius - 3, p.facing - 0.9, p.facing + 0.9);
    context.stroke();
    context.fillStyle = '#e8e2d2';
    context.beginPath();
    context.arc(
      p.x + Math.cos(p.facing) * 5,
      p.y + Math.sin(p.facing) * 5,
      4,
      0,
      Math.PI * 2,
    );
    context.fill();
    if (p.sneaking) {
      context.setLineDash([4, 4]);
      context.strokeStyle = 'rgba(45, 212, 191, 0.8)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(p.x, p.y, p.radius + 5, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
    }
  }

  function alarmColor(alarm) {
    if (alarm < 35) return PALETTE.alarmLow;
    if (alarm < 70) return PALETTE.alarmMid;
    return PALETTE.alarmHigh;
  }

  function drawHud(state, best) {
    context.textBaseline = 'top';
    // Alarm meter, top left under the score: the number the whole game
    // turns on. (The top centre belongs to the vault, so it lives here.)
    const meter = { x: 30, y: 100, w: 300, h: 20 };
    text('ALARM', meter.x, meter.y - 16, 14, PALETTE.muted, 'left');
    context.fillStyle = '#10131c';
    context.fillRect(meter.x, meter.y, meter.w, meter.h);
    context.fillStyle = alarmColor(state.alarm);
    context.fillRect(meter.x, meter.y, (meter.w * state.alarm) / 100, meter.h);
    context.strokeStyle = PALETTE.text;
    context.lineWidth = 1;
    context.strokeRect(meter.x, meter.y, meter.w, meter.h);
    text(alarmLabel(Math.round(state.alarm)) + '%', meter.x + meter.w + 10, meter.y + 1, 18, alarmColor(state.alarm), 'left');
    // Score left, time right.
    text(scoreLabel(state.score), 30, 32, 24, PALETTE.gold, 'left');
    const taken = state.loots.filter((l) => l.taken).length;
    text(`Loot ${taken}/4${state.hasDiamond ? '  ◆ Star secured' : ''}`, 30, 60, 16, PALETTE.muted, 'left');
    const seconds = Math.floor(state.time);
    // The clock, top right, as mm:ss.
    context.fillStyle = PALETTE.text;
    context.font = `24px ${FONT}`;
    context.textAlign = 'right';
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    context.fillText(`${mm}:${ss}`, FIELD.width - 30, 32);
    if (state.player.sneaking) text('SNEAKING', FIELD.width - 30, 60, 16, PALETTE.thiefScarf, 'right');
    // Context prompt: grab, or the laser warning.
    const near = state.loots.find(
      (l) => !l.taken && Math.hypot(l.x - state.player.x, l.y - state.player.y) <= 56,
    );
    if (near) {
      text(`Press E — take the ${near.label} ($${near.value})`, FIELD.width / 2, FIELD.height - 52, 20, PALETTE.gold, 'center');
    } else if (state.laserOn && state.player.y > 150 && state.player.y < 260 && Math.abs(state.player.x - 640) < 160) {
      text('The vault laser is live — wait for it to go dark', FIELD.width / 2, FIELD.height - 52, 20, '#ff8080', 'center');
    } else {
      text('WASD / arrows to move · Shift to sneak · E to grab · click to walk there · P to pause', FIELD.width / 2, FIELD.height - 52, 16, PALETTE.muted, 'center');
    }
    if (state.seenNow) text('SPOTTED!', FIELD.width / 2, 66, 26, '#ff5040', 'center');
    void best;
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(10, 12, 18, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.gold, 'center');
  }

  const TITLE_LINES = [
    'One gallery. Three guards, two cameras, one blinking laser.',
    'Lift the Marlow Star from the vault and slip out the service exit.',
    'Stay out of the cones — being seen raises the alarm.',
    'Sneak with Shift: slower, quieter, harder to spot. Grab loot with E.',
    '',
  ];
  const PAUSED_LINES = ['The guards will wait for you.'];
  const WIN_LINES = ['', '', ''];
  const BUSTED_LINES = ['', 'The guards close in, and the night is over.'];

  /** Paint one frame: the room, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor();
    drawWallsAndArt();
    drawVaultAndLoot(state);
    drawConesAndWatchers(state);
    drawThief(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = `Best loot $${best}`;
      drawPanel('THE MARLOW JOB', TITLE_LINES, 'Press Space or click to start');
      return;
    }
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = `Loot $${state.score} — including the Marlow Star ($500)`;
      WIN_LINES[1] = `Time bonus $${state.timeBonus} · finished in ${Math.floor(state.time)}s`;
      WIN_LINES[2] = `Best loot $${Math.max(best, state.score)}`;
      drawPanel('CLEAN GETAWAY', WIN_LINES, 'Press Space or click to run it again');
    } else if (screen === SCREEN_BUSTED) {
      BUSTED_LINES[0] = `Loot $${state.score} left behind in the gallery`;
      drawPanel('BUSTED!', BUSTED_LINES, 'Press Space or click to try again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    /** Convert a client (mouse) point to playfield coordinates. */
    toField(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const px = (clientX - rect.left) * ratio;
      const py = (clientY - rect.top) * ratio;
      return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
    },
  };
}
