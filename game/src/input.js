// Keyboard and pointer input. Held keys give a steering vector; one-shot
// presses (start or restart, pause, grab, mute) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost and
// never counted twice. A mouse click sets a walk target the thief heads for
// until a key is pressed.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_GRAB = 4;
export const ACTION_MUTE = 8;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const GRAB = new Set(['KeyE']);
const MUTE = new Set(['KeyM']);

export function createInput(target, toField) {
  let left = false;
  let right = false;
  let up = false;
  let down = false;
  let sneak = false;
  let actions = 0;
  let walkTarget = null;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') sneak = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (GRAB.has(event.code)) {
      if (!event.repeat) actions |= ACTION_GRAB;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    if (LEFT.has(event.code) || RIGHT.has(event.code) || UP.has(event.code) || DOWN.has(event.code)) {
      walkTarget = null;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') sneak = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
    up = false;
    down = false;
    sneak = false;
  });
  target.addEventListener('pointerdown', (event) => {
    if (event.target !== target) return;
    const point = toField(event.clientX, event.clientY);
    // A click on the canvas walks there; a click anywhere else (a panel is
    // up) still counts as confirm, handled by the loop's confirm action.
    if (point.x >= 0 && point.x <= 1280 && point.y >= 0 && point.y <= 720) {
      walkTarget = point;
    }
    actions |= ACTION_CONFIRM;
  });

  return {
    /** The steering vector for this frame: keys, or toward the click target. */
    vector(player) {
      const kx = (right ? 1 : 0) - (left ? 1 : 0);
      const ky = (down ? 1 : 0) - (up ? 1 : 0);
      if (kx !== 0 || ky !== 0) return { x: kx, y: ky, sneak };
      if (walkTarget) {
        const dx = walkTarget.x - player.x;
        const dy = walkTarget.y - player.y;
        if (Math.hypot(dx, dy) < 10) {
          walkTarget = null;
          return { x: 0, y: 0, sneak };
        }
        return { x: dx, y: dy, sneak };
      }
      return { x: 0, y: 0, sneak };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
