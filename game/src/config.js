// Every tuning number, colour and piece of the floor plan in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  walk: 178,
  sneak: 96,
  grabRange: 56,
};

export const GUARD = {
  radius: 15,
  patrol: 66,
  investigate: 122,
  range: 248,
  /** Half of the vision cone, in radians. */
  fov: 0.55,
};

export const CAMERA = {
  range: 268,
  /** Half of the camera cone, in radians. */
  fov: 0.38,
  /** How far the camera sweeps either side of its base angle, in radians. */
  sweep: 0.6,
  /** Seconds for one full sweep back and forth. */
  period: 4.4,
};

export const ALARM = {
  /** Alarm points per second while a guard watches the thief. */
  guardWalk: 52,
  guardSneak: 22,
  /** Alarm points per second while a camera watches the thief. */
  camWalk: 30,
  camSneak: 14,
  /** Alarm points per second the meter cools down while nobody sees the thief. */
  decay: 10,
  /** Alarm level at which the guards leave their patrols to investigate. */
  investigateAt: 35,
  /** Alarm level at which the job is blown. */
  bustedAt: 100,
  /** Alarm points added by crossing the vault laser while it is live. */
  laserHit: 38,
  /** Seconds after a laser hit before it can sting again. */
  laserCooldown: 0.8,
};

/** The vault laser: a beam across the vault mouth that blinks on and off. */
export const LASER = { x: 544, y: 148, w: 192, h: 10, onSeconds: 2.2, offSeconds: 1.6 };

/** The service exit the thief must reach with the diamond. */
export const EXIT = { x: 48, y: 600, w: 96, h: 72 };

/** Where the thief slips in. */
export const START = { x: 640, y: 640 };

/**
 * Rectangles that block movement and sight: the outer walls, the vault's side
 * walls and the glass display cases. Benches block movement only (see below).
 */
export const WALLS = [
  { x: 0, y: 0, w: 1280, h: 24 }, // north wall
  { x: 0, y: 696, w: 1280, h: 24 }, // south wall
  { x: 0, y: 0, w: 24, h: 720 }, // west wall
  { x: 1256, y: 0, w: 24, h: 720 }, // east wall
  { x: 520, y: 24, w: 24, h: 124 }, // vault west cheek
  { x: 736, y: 24, w: 24, h: 124 }, // vault east cheek
  { x: 280, y: 320, w: 72, h: 48 }, // display case, west
  { x: 928, y: 320, w: 72, h: 48 }, // display case, east
  { x: 280, y: 520, w: 72, h: 48 }, // display case, west
  { x: 928, y: 520, w: 72, h: 48 }, // display case, east
];

/** Low benches: the thief and guards walk around them, but eyes see over them. */
export const BENCHES = [
  { x: 500, y: 300, w: 120, h: 26 },
  { x: 660, y: 560, w: 120, h: 26 },
];

/** The three guards and their patrol routes (waypoints the guard walks between). */
export const GUARDS = [
  { name: 'Bram', x: 300, y: 180, waypoints: [[300, 180], [980, 180]] },
  { name: 'Ilsa', x: 200, y: 380, waypoints: [[200, 380], [200, 620]] },
  { name: 'Dmitri', x: 1080, y: 620, waypoints: [[1080, 620], [1080, 380]] },
];

/** The two wall cameras: position, the direction they face at rest, sweep phase. */
export const CAMERAS = [
  { x: 64, y: 64, baseAngle: Math.PI / 4, phase: 0 },
  { x: 1216, y: 64, baseAngle: (3 * Math.PI) / 4, phase: 1.7 },
];

/** Everything worth stealing. The diamond is the job: without it there is no win. */
export const LOOT = [
  { id: 'painting', x: 112, y: 300, value: 150, label: 'Portrait of the Duchess' },
  { id: 'vase', x: 1168, y: 300, value: 150, label: 'Celadon vase' },
  { id: 'coins', x: 640, y: 470, value: 100, label: 'Coin stack' },
  { id: 'diamond', x: 640, y: 95, value: 500, label: 'The Marlow Star' },
];

/** Paintings hung on the walls: decoration only, drawn by the renderer. */
export const WALL_ART = [
  { x: 120, y: 24, w: 110, h: 14, hue: '#7a4a3a' },
  { x: 420, y: 24, w: 90, h: 14, hue: '#3a5a7a' },
  { x: 820, y: 24, w: 90, h: 14, hue: '#4a7a3a' },
  { x: 1050, y: 24, w: 110, h: 14, hue: '#7a3a6a' },
  { x: 24, y: 120, w: 14, h: 110, hue: '#8a6a2a' },
  { x: 24, y: 430, w: 14, h: 110, hue: '#2a6a7a' },
  { x: 1242, y: 120, w: 14, h: 110, hue: '#6a3a7a' },
  { x: 1242, y: 430, w: 14, h: 110, hue: '#7a2a2a' },
];

export const PALETTE = {
  backdrop: '#0d0f16',
  floorA: '#2b3040',
  floorB: '#252a38',
  carpet: '#6e2430',
  carpetTrim: '#c9a227',
  wall: '#171b26',
  wallTrim: '#3d4457',
  vault: '#39415a',
  vaultDoor: '#4a5468',
  caseGlass: '#7fb3d5',
  caseBase: '#3a3348',
  bench: '#4a3a28',
  guard: '#2e3a56',
  guardAlert: '#a33327',
  camera: '#22242c',
  cone: 'rgba(255, 196, 66, 0.16)',
  coneAlert: 'rgba(255, 64, 48, 0.26)',
  camCone: 'rgba(120, 200, 255, 0.13)',
  thief: '#141a26',
  thiefScarf: '#2dd4bf',
  diamond: '#9be8ff',
  gold: '#f2c94c',
  alarmLow: '#58c98a',
  alarmMid: '#f2c94c',
  alarmHigh: '#e5534b',
  panel: '#1c2130',
  text: '#eef1f5',
  muted: '#9aa3b5',
  exit: '#2fbf71',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'marlow-job.best';
