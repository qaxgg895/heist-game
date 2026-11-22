// The Marlow Job — the hand-in program (Node 22, standard library only).
// It copies the playable game and the maker's screenshots into the output
// directory and writes dossier.json with the kit's vendored library, so the
// judge can read the game from its screenshots and its source outline.
//
// Run locally as: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Pre-flight: the hand-in is refused if a screenshot is missing or over the
// scorer's 256 KiB cap, so check before writing the dossier, not after.
const shots = readdirSync(join(here, 'screenshots')).filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`expected 3 or 4 screenshots, found ${shots.length}`);
}
for (const shot of shots) {
  const bytes = statSync(join(here, 'screenshots', shot)).size;
  if (bytes > 262144) throw new Error(`screenshot ${shot} is ${bytes} bytes, over the 256 KiB cap`);
}
console.log(`screenshots ok: ${shots.join(', ')}`);

// The scorer's caps, as the starter's main.ts records them: at most 4
// screenshots of at most 256 KiB each, at most 993 files and 48 MiB under
// game/, and no path under game/ longer than 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Say what was handed in, and refuse to look finished when a part is missing.
const dossier = JSON.parse(
  new TextDecoder().decode(
    new Uint8Array(
      (await import('node:fs')).readFileSync(join(out, 'dossier.json')),
    ),
  ),
);
console.log(`handed in ${dossier.images?.length ?? 0} screenshots, dossier ${dossier.schema ?? 'ok'}`);
