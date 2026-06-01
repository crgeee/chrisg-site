// pixiTint.ts — CSS-var → Pixi-tint adapter for the WebGL render path.
//
// main's `palette.ts` owns the time-of-day model: it interpolates the scene's
// colours across the day and writes them as CSS custom properties onto the
// `.wander` root (so the HTML content panels, the SVG engine, and this module
// all read from one source of truth). The SVG engine colours itself purely
// through those `var(--…)` references; the Pixi path can't lean on CSS class
// resolution, so this module reads the *computed* values of those same custom
// properties off the live `.wander` root and exposes them as Pixi numeric
// tints. Re-reading after each `applyPalette()` call keeps the WebGL scene in
// lock-step with whatever hour the Customize slider (or the visitor's local
// clock) has selected.

export type PaletteKey =
  | "skyTop"
  | "skyBot"
  | "sun"
  | "sunCore"
  | "glow"
  | "cloud"
  | "landFar"
  | "landMid"
  | "hill"
  | "butte"
  | "bank"
  | "sand"
  | "sandDeep"
  | "river"
  | "riverHi"
  | "rock"
  | "pine"
  | "sage"
  | "ink"
  | "inkSoft"
  | "plant"
  | "tuft";

export type Palette = Record<PaletteKey, number>;

const VAR_NAMES: Record<PaletteKey, string> = {
  skyTop: "--sky-top",
  skyBot: "--sky-bot",
  sun: "--sun",
  sunCore: "--sun-core",
  glow: "--glow",
  cloud: "--cloud",
  landFar: "--land-far",
  landMid: "--land-mid",
  hill: "--hill",
  butte: "--butte",
  bank: "--bank",
  sand: "--sand",
  sandDeep: "--sand-deep",
  river: "--river",
  riverHi: "--river-hi",
  rock: "--rock",
  pine: "--pine",
  sage: "--sage",
  ink: "--ink",
  inkSoft: "--ink-soft",
  plant: "--plant",
  tuft: "--tuft",
};

// Sensible sunset fallbacks, in case the computed style isn't ready yet.
const FALLBACK: Palette = {
  skyTop: 0xa6c6d8,
  skyBot: 0xf8dccb,
  sun: 0xfae6a2,
  sunCore: 0xfff5d2,
  glow: 0xf8d79a,
  cloud: 0xf3c9cd,
  landFar: 0xddc1b9,
  landMid: 0xcd9f93,
  hill: 0xc1897c,
  butte: 0xbd8071,
  bank: 0xdac99e,
  sand: 0xecdabd,
  sandDeep: 0xdcc69f,
  river: 0x8ea7c2,
  riverHi: 0xd6e1ea,
  rock: 0x7e5448,
  pine: 0x6b5a48,
  sage: 0x9aa07b,
  ink: 0x362620,
  inkSoft: 0x6d5347,
  plant: 0x5e7e56,
  tuft: 0xf9f6ef,
};

/** Parse a CSS colour string (hex or rgb()) into a 24-bit integer. */
export function parseColor(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  if (s[0] === "#") {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (hex.length === 6) {
      const n = parseInt(hex, 16);
      return Number.isNaN(n) ? null : n;
    }
    return null;
  }
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const parts = m[1].split(/[ ,/]+/).filter(Boolean).slice(0, 3);
    if (parts.length === 3) {
      const [r, g, b] = parts.map((p) => {
        if (p.endsWith("%")) return Math.round((parseFloat(p) / 100) * 255);
        return Math.round(parseFloat(p));
      });
      return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
    }
  }
  return null;
}

/**
 * Read the active palette off the live `.wander` root's computed style. Any var
 * that can't be parsed (e.g. an unsupported `color-mix()` left unresolved) falls
 * back to the sunset default for that slot.
 */
export function readPalette(root: HTMLElement): Palette {
  const cs = getComputedStyle(root);
  const out = {} as Palette;
  (Object.keys(VAR_NAMES) as PaletteKey[]).forEach((key) => {
    const raw = cs.getPropertyValue(VAR_NAMES[key]);
    out[key] = parseColor(raw) ?? FALLBACK[key];
  });
  return out;
}

/** Linear blend of two 24-bit colours. t=0 → a, t=1 → b. */
export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/** Perceived luminance (0..1) of a 24-bit colour — used to tell day from night. */
export function luma(c: number): number {
  const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
