// Time-of-day palette. Interpolates the scene's colors across a day arc based on
// a given hour (the visitor's local time by default), so the world warms toward
// sunset in the evening and cools to dusk at night. Returns CSS custom-property
// values to set on the `.wander` root (these override the static CSS palette).

type Vars = Record<string, string>;

// Day key-moments, reusing three coherent palettes:
//   SUN  = warm pastel sunrise/sunset · DAY = golden daylight · NIGHT = dusk/twilight
const SUN: Vars = {
  "sky-top": "#a6c6d8", "sky-bot": "#f8dccb", "sun": "#fae6a2", "sun-core": "#fff5d2",
  "glow": "#f8d79a", "cloud": "#f3c9cd", "land-far": "#ddc1b9", "land-mid": "#cd9f93",
  "hill": "#c1897c", "butte": "#bd8071", "bank": "#dac99e", "sand": "#ecdabd",
  "sand-deep": "#dcc69f", "river": "#8ea7c2", "river-hi": "#d6e1ea", "rock": "#7e5448",
  "pine": "#6b5a48", "sage": "#9aa07b", "ink": "#362620", "ink-soft": "#6d5347",
  "plant": "#5e7e56", "tuft": "#f9f6ef", "panel": "#f1e9d7", "panel-edge": "#362620",
  "panel-ink": "#362620",
};
const DAY: Vars = {
  "sky-top": "#e7c492", "sky-bot": "#f6e6c0", "sun": "#f7c869", "sun-core": "#fff0c8",
  "glow": "#f7c869", "cloud": "#f2d3a3", "land-far": "#dcb88c", "land-mid": "#cb9c6c",
  "hill": "#bf8455", "butte": "#c0875a", "bank": "#dcc28e", "sand": "#edd8ad",
  "sand-deep": "#dcc086", "river": "#cfb277", "river-hi": "#f0dcab", "rock": "#7d4f32",
  "pine": "#706c3a", "sage": "#9c9560", "ink": "#3a281a", "ink-soft": "#74583e",
  "plant": "#7e7c41", "tuft": "#f7f0de", "panel": "#f1e3c6", "panel-edge": "#3a281a",
  "panel-ink": "#3a281a",
};
const NIGHT: Vars = {
  "sky-top": "#3c4170", "sky-bot": "#8d7aa0", "sun": "#e7c79f", "sun-core": "#f2dcc0",
  "glow": "#9a83b0", "cloud": "#8d7da0", "land-far": "#6f6593", "land-mid": "#5a4f7a",
  "hill": "#4d4370", "butte": "#4b4170", "bank": "#736a93", "sand": "#897fa6",
  "sand-deep": "#776a96", "river": "#33426a", "river-hi": "#6b78a0", "rock": "#332b4a",
  "pine": "#2a2842", "sage": "#5e5a7e", "ink": "#1d1828", "ink-soft": "#3f3656",
  "plant": "#55687e", "tuft": "#e7e1f0", "panel": "#e2dcec", "panel-edge": "#231c38",
  "panel-ink": "#231c38",
};

type Moment = { h: number; set: Vars };
const MOMENTS: Moment[] = [
  { h: 0, set: NIGHT },
  { h: 5.5, set: NIGHT },
  { h: 7, set: SUN },
  { h: 9.5, set: DAY },
  { h: 16, set: DAY },
  { h: 18.5, set: SUN },
  { h: 20.5, set: NIGHT },
  { h: 24, set: NIGHT },
];

const KEYS = Object.keys(SUN);

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function mixHex(a: string, b: string, t: number): string {
  const [r0, g0, b0] = hexToRgb(a);
  const [r1, g1, b1] = hexToRgb(b);
  return rgbToHex(r0 + (r1 - r0) * t, g0 + (g1 - g0) * t, b0 + (b1 - b0) * t);
}

/** Interpolated palette for a given hour (0–24, wraps). */
export function paletteAt(hour: number): Vars {
  const h = ((hour % 24) + 24) % 24;
  let m0 = MOMENTS[0];
  let m1 = MOMENTS[MOMENTS.length - 1];
  for (let i = 0; i < MOMENTS.length - 1; i++) {
    if (h >= MOMENTS[i].h && h <= MOMENTS[i + 1].h) {
      m0 = MOMENTS[i];
      m1 = MOMENTS[i + 1];
      break;
    }
  }
  const span = m1.h - m0.h || 1;
  const t = (h - m0.h) / span;
  const out: Vars = {};
  for (const k of KEYS) out[k] = mixHex(m0.set[k], m1.set[k], t);
  return out;
}

/** Write a palette's values onto the root as CSS custom properties. */
export function applyPalette(root: HTMLElement, vars: Vars): void {
  for (const k of KEYS) root.style.setProperty(`--${k}`, vars[k]);
}

/** The visitor's current local hour as a fractional number (e.g. 18.5). */
export function localHourNow(): number {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}
