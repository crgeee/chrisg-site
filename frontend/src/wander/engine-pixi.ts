// engine-pixi.ts — Pixi.js v8 (WebGL) "wide-world" render path for the
// wandering portfolio, behind the `?pixi=1` / `/wander-v2` flag.
//
// Unlike the SVG engine (which is procedural), this path paints REAL illustrated
// PNG assets (black-ink outline + light fill on transparent backgrounds, so
// `sprite.tint` recolours them cleanly) over a programmatic gradient sky:
//
//   • a Pixi Graphics SKY that cycles sunrise → day → golden → sunset → night,
//     with a sun that arcs across the sky by time of day and a moon at night;
//   • a believable, VARIED landscape: a deck of named formation assets
//     (cliff / mitten / twins / mesa / bluff / spires / hoodoos / arch) placed
//     by depth so they read like a real place at different distances — farther
//     ones are smaller, hazier (tint blended toward the sky), lower-contrast and
//     parallax slower; nearer ones are larger, more saturated and parallax
//     faster. No type repeats adjacent; every instance is uniquely seeded (scale,
//     flip, vertical offset, tint jitter). The far skyline is built from several
//     small hazed instances (the `range` asset + small formations) with gaps —
//     never one PNG tiled into a strip;
//   • animated CRITTERS — roadrunner & lizard wander + pause + flip, jackrabbit
//     hops, a bird flies across the sky, a tumbleweed rolls + respawns, plants
//     (saguaro / agave / cottongrass) sway about their base — plus drifting dust.
//
// It reuses the render-agnostic controller in `worldCore.ts` for input,
// momentum, snap-to-station, keyboard nav, the UI chrome and the HTML content
// panels (DOM over the transparent canvas, exactly like the SVG engine). Time of
// day is driven by main's `palette.ts` (`applyPalette`/`paletteAt`), and colours
// are read back as Pixi tints via `pixiTint.ts`, so the WebGL scene, the DOM
// panels and the Customize slider all stay in lock-step.

import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Texture,
  FillGradient,
  BlurFilter,
} from "pixi.js";
import type { SiteContent } from "./content";
import type { ArtKit } from "./art";
import { createWorldCore, type FrameState } from "./worldCore";
import { readPalette, mix, luma, type Palette } from "./pixiTint";
import { paletteAt, applyPalette, localHourNow } from "./palette";

// ---- asset manifest (copied + renamed into /wander-assets) -----------------
const BASE = "/wander-assets/";
// Iconic formations, varied in shape — mixed across the world by depth + region.
const FORMATIONS = [
  "cliff",
  "mitten",
  "twins",
  "mesa",
  "bluff",
  "spires",
  "hoodoos",
  "arch",
] as const;
const RANGE = "range" as const;
const PLANTS = ["saguaro", "agave", "cottongrass"] as const;
const CRITTERS = ["jackrabbit", "roadrunner", "lizard", "bird", "tumbleweed"] as const;
type FormationKey = (typeof FORMATIONS)[number];
type AssetKey =
  | FormationKey
  | typeof RANGE
  | (typeof PLANTS)[number]
  | (typeof CRITTERS)[number];
const ALL_KEYS: AssetKey[] = [...FORMATIONS, RANGE, ...PLANTS, ...CRITTERS];

// A formation asset's natural ground-height as a fraction of its bitmap height —
// i.e. how much of the PNG is "above the base line". All of these illustrations
// are framed with the base resting on the bottom edge, so we scale by a target
// on-screen HEIGHT (not width) to keep wildly different aspect ratios reading at
// a consistent ground-relative size.
type Layer = { c: Container; factor: number };

// A sprite that gets re-tinted each time the palette changes. `haze` (0..1) is
// the atmospheric-perspective amount — how far this instance's tint is blended
// toward the sky/horizon colour (farther = hazier). `jitter` adds a small
// per-instance hue nudge so no two formations tint identically.
type Tintable = {
  s: Sprite;
  role: "formation" | "plant" | "ink";
  haze: number;
  jitter: number;
};

// Wandering ground critter (roadrunner / lizard): walk + pause + flip.
type Wanderer = {
  s: Sprite;
  baseY: number;
  x: number;
  dir: number;
  speed: number;
  sc: number;
  state: "walk" | "pause";
  timer: number;
  bobAmp: number;
  bobSp: number;
  phase: number;
  min: number;
  max: number;
};

// Hopping jackrabbit.
type Hopper = {
  s: Sprite;
  baseX: number;
  baseY: number;
  sc: number;
  dir: number;
  t: number;
  period: number;
  hop: number;
  dist: number;
  fromX: number;
};

// Plant that sways about its base.
type Swayer = { s: Sprite; amp: number; sp: number; ph: number };

// Drifting dust mote.
type Dust = { g: Graphics; x: number; y: number; amp: number; sp: number; ph: number };

export async function mountWorldPixi(
  root: HTMLElement,
  SITE: SiteContent,
  A: ArtKit,
): Promise<() => void> {
  const stage = root.querySelector("#stage") as HTMLElement;
  const world = root.querySelector("#world") as HTMLElement;
  const core = createWorldCore(root, SITE);

  const coarse =
    !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

  let pal: Palette = readPalette(root);
  let hour = 12; // current time-of-day hour (0..24), kept in sync with the slider

  // ---- preload the illustrated assets --------------------------------------
  const textures: Record<AssetKey, Texture> = {} as Record<AssetKey, Texture>;
  await Promise.all(
    ALL_KEYS.map(async (k) => {
      textures[k] = await Assets.load(`${BASE}${k}.png`);
    }),
  );

  // ---- Pixi application (transparent, full-screen) -------------------------
  const app = new Application();
  await app.init({
    backgroundAlpha: 0,
    antialias: !coarse,
    resolution: Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2),
    autoDensity: true,
    resizeTo: window,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });

  let destroyed = false;

  const canvas = app.canvas as HTMLCanvasElement;
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  // Sit above the (now hidden) SVG sky but below the DOM content layer.
  world.parentElement!.insertBefore(canvas, world);

  // The SVG sky/sunglow divs are redundant once Pixi paints its own sky.
  const skyDiv = root.querySelector("#sky") as HTMLElement | null;
  const glowDiv = root.querySelector("#sunglow") as HTMLElement | null;
  if (skyDiv) skyDiv.style.opacity = "0";
  if (glowDiv) glowDiv.style.opacity = "0";

  // Panels live in a DOM holder inside #world (parallaxed by worldCore).
  world.innerHTML = "";
  const panelHolder = document.createElement("div");
  panelHolder.style.cssText =
    "position:absolute;inset:0;will-change:transform;pointer-events:none;";
  const panelLayer = document.createElement("div");
  panelLayer.className = "layer content";
  panelLayer.appendChild(panelHolder);
  world.appendChild(panelLayer);

  const rootStage = app.stage;
  const rnd = A.makeRng;

  // scene state (rebuilt on resize)
  let skyG!: Graphics;
  let sunG!: Graphics;
  let moonG!: Graphics;
  let layers: Layer[] = [];
  let tintables: Tintable[] = [];
  let wanderers: Wanderer[] = [];
  let hoppers: Hopper[] = [];
  let swayers: Swayer[] = [];
  let dust: Dust[] = [];
  let bird: { s: Sprite; x: number; y0: number; speed: number; span: number } | null = null;
  let tumble: { s: Sprite; x: number; y: number; speed: number; spin: number; sc: number } | null = null;
  let groundG: Graphics | null = null; // near sand band — re-tinted with the palette

  // ---- helpers -------------------------------------------------------------
  function addLayer(factor: number): Layer {
    const c = new Container();
    rootStage.addChild(c);
    const L = { c, factor };
    layers.push(L);
    return L;
  }

  // Place a tinted formation/plant sprite scaled to a target on-screen HEIGHT
  // and anchored at its base-centre. `haze`/`jitter` feed the re-tint pass.
  function placeFormation(
    L: Layer,
    key: FormationKey | typeof RANGE,
    x: number,
    baseY: number,
    targetH: number,
    haze: number,
    jitter: number,
    opts: { alpha?: number; flip?: boolean } = {},
  ): Sprite {
    const tex = textures[key];
    const s = new Sprite(tex);
    s.anchor.set(0.5, 1);
    const scale = targetH / tex.height;
    s.scale.set((opts.flip ? -1 : 1) * scale, scale);
    s.x = x;
    s.y = baseY;
    if (opts.alpha != null) s.alpha = opts.alpha;
    L.c.addChild(s);
    tintables.push({ s, role: "formation", haze, jitter });
    return s;
  }

  // Place a sprite scaled to a target on-screen WIDTH (plants/critters).
  function placeByWidth(
    L: Layer,
    key: AssetKey,
    x: number,
    baseY: number,
    targetW: number,
    role: Tintable["role"],
    opts: { alpha?: number; anchorY?: number; flip?: boolean } = {},
  ): Sprite {
    const tex = textures[key];
    const s = new Sprite(tex);
    s.anchor.set(0.5, opts.anchorY ?? 1);
    const scale = targetW / tex.width;
    s.scale.set((opts.flip ? -1 : 1) * scale, scale);
    s.x = x;
    s.y = baseY;
    if (opts.alpha != null) s.alpha = opts.alpha;
    L.c.addChild(s);
    tintables.push({ s, role, haze: 0, jitter: 0 });
    return s;
  }

  // The sun's normalised screen position for a given hour: it rises low in the
  // east (~6am), peaks at noon, and sets low in the west (~18–20h).
  function sunPos(h: number, W: number, H: number): { x: number; y: number; up: boolean } {
    // daylight window 5.5 → 20.5; t in 0..1 across it
    const lo = 5.5, hi = 20.5;
    const t = (h - lo) / (hi - lo);
    const up = t >= 0 && t <= 1;
    const x = W * (0.1 + 0.8 * Math.max(0, Math.min(1, t)));
    const arc = Math.sin(Math.max(0, Math.min(1, t)) * Math.PI); // 0 at horizon, 1 at noon
    const y = H * (0.86 - 0.72 * arc);
    return { x, y, up };
  }
  // Moon rides the complementary arc (night window 18 → 6, wrapping midnight).
  function moonPos(h: number, W: number, H: number): { x: number; y: number; up: boolean } {
    let nh = h;
    if (nh >= 18) nh -= 18;
    else if (nh <= 6) nh += 6;
    else return { x: 0, y: 0, up: false };
    const t = nh / 12; // 0..1 across the night
    const x = W * (0.12 + 0.76 * t);
    const arc = Math.sin(t * Math.PI);
    const y = H * (0.82 - 0.62 * arc);
    return { x, y, up: true };
  }

  // The colour the haze blends toward: the pale band just above the horizon.
  function hazeColor(): number {
    return mix(pal.skyBot, pal.glow, 0.4);
  }

  // Redraw the gradient sky for the current palette + hour.
  function drawSky() {
    if (destroyed || !skyG) return;
    const { W, H, HZ } = core.layout;
    const night = luma(pal.skyTop) < 0.42;
    const horizon = HZ / H;

    skyG.clear();
    // A SOFT pastel sky: a gentle blue at the top easing through a pale band into
    // a peach/rose glow at the horizon — never a hard or saturated transition.
    const grad = new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: pal.skyTop },
        { offset: Math.max(0.05, horizon - 0.42), color: mix(pal.skyTop, pal.skyBot, 0.38) },
        { offset: Math.max(0.1, horizon - 0.18), color: mix(pal.skyTop, pal.skyBot, 0.74) },
        { offset: horizon - 0.05, color: pal.skyBot },
        { offset: horizon, color: mix(pal.skyBot, pal.glow, 0.45) },
        { offset: Math.min(0.985, horizon + 0.05), color: mix(pal.glow, pal.sand, 0.5) },
        { offset: 1, color: mix(pal.sand, pal.sandDeep, 0.35) },
      ],
    });
    skyG.rect(0, 0, W, H).fill(grad);

    // Soft horizon glow band (the "sunrise/sunset" bloom) — kept pale + diffuse.
    const glow = new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: mix(pal.glow, pal.skyBot, 0.5) },
        { offset: 0.5, color: pal.glow },
        { offset: 1, color: mix(pal.glow, pal.sand, 0.5) },
      ],
    });
    skyG.rect(0, H * (horizon - 0.2), W, H * 0.3).fill({ fill: glow, alpha: night ? 0.16 : 0.38 });

    // sun + moon position/visibility
    const sp = sunPos(hour, W, H);
    const mp = moonPos(hour, W, H);

    sunG.clear();
    if (sp.up) {
      // A big, soft, pale sun like the reference — wide diffuse halo, gentle core.
      const R = Math.round(H * 0.085);
      sunG.circle(0, 0, R * 2.6).fill({ color: pal.sun, alpha: 0.08 });
      sunG.circle(0, 0, R * 1.7).fill({ color: pal.sun, alpha: 0.14 });
      sunG.circle(0, 0, R * 1.15).fill({ color: pal.sun, alpha: 0.5 });
      sunG.circle(0, 0, R).fill({ color: mix(pal.sun, pal.sunCore, 0.6) });
      sunG.circle(0, 0, R * 0.82).fill({ color: pal.sunCore });
      sunG.x = sp.x;
      sunG.y = sp.y;
      sunG.visible = true;
    } else {
      sunG.visible = false;
    }

    moonG.clear();
    if (mp.up && night) {
      const R = Math.round(H * 0.042);
      moonG.circle(0, 0, R * 2.4).fill({ color: pal.sunCore, alpha: 0.12 });
      moonG.circle(0, 0, R).fill({ color: pal.tuft });
      // crescent shadow
      moonG.circle(R * 0.5, -R * 0.2, R * 0.92).fill({ color: pal.skyTop, alpha: 0.92 });
      moonG.x = mp.x;
      moonG.y = mp.y;
      moonG.visible = true;
    } else {
      moonG.visible = false;
    }
  }

  // The soft, pale dusty-rose/mauve a formation tints to at zero haze. Built from
  // the palette's land colours but deliberately desaturated toward the sand so
  // daytime stays GENTLE (pastel) rather than golden/orange.
  function formationBase(): number {
    return mix(mix(pal.landMid, pal.landFar, 0.52), pal.sand, 0.34);
  }

  // Re-tint every formation/plant/critter sprite for the current palette.
  // Formations apply atmospheric perspective: each is blended from its base tint
  // toward the haze (sky) colour by its own `haze`, plus a small `jitter` nudge.
  function retint() {
    if (destroyed) return;
    const base = formationBase();
    const haze = hazeColor();
    const inkTint = mix(pal.ink, pal.landMid, 0.12);
    if (groundG) groundG.tint = mix(pal.sand, pal.sandDeep, 0.4);
    for (const t of tintables) {
      if (t.role === "formation") {
        // jitter shifts slightly cooler (toward landFar) or warmer (toward hill)
        const warm = t.jitter >= 0;
        const nudge = warm
          ? mix(base, pal.hill, Math.min(0.3, t.jitter))
          : mix(base, pal.landFar, Math.min(0.3, -t.jitter));
        t.s.tint = mix(nudge, haze, t.haze);
      } else if (t.role === "plant") {
        t.s.tint = mix(pal.plant, pal.sage, 0.4);
      } else {
        // critters: keep them as ink outlines, barely shifted by time of day
        t.s.tint = inkTint;
      }
    }
  }

  // ---- formation deck: deterministic, varied, no adjacent repeats ----------
  // A small stateful picker over the formation pool seeded per build.
  function makePicker(r: () => number) {
    let prev = -1;
    const pool = FORMATIONS;
    return (): FormationKey => {
      let pick = Math.floor(r() * pool.length);
      if (pick === prev) pick = (pick + 1) % pool.length;
      // a second nudge for runs of 3 so we don't ping-pong between two types
      if (pick === prev) pick = (pick + 2) % pool.length;
      prev = pick;
      return pool[pick];
    };
  }

  // ---- build the full scene from current layout + palette ------------------
  function build() {
    // Re-assert the hidden SVG sky each build (a resize rebuild must not reveal
    // it under our transparent canvas).
    if (skyDiv) skyDiv.style.opacity = "0";
    if (glowDiv) glowDiv.style.opacity = "0";
    rootStage.removeChildren();
    layers = [];
    tintables = [];
    wanderers = [];
    hoppers = [];
    swayers = [];
    dust = [];
    bird = null;
    tumble = null;
    groundG = null;

    const { W, H, HZ, stationStep, maxScroll, N } = core.layout;
    const localW = (factor: number) => Math.ceil(maxScroll * factor + W + 200);
    const groundSpan = H - HZ; // pixels of sand below the horizon

    // ---- SKY (own layer at factor 0; never scrolls) ----
    const Lsky = addLayer(0);
    skyG = new Graphics();
    sunG = new Graphics();
    moonG = new Graphics();
    Lsky.c.addChild(skyG, sunG, moonG);
    drawSky();

    // ---- FAR SKYLINE — several SMALL hazed instances with gaps (no tiling) ----
    // A believable distant ridge: a varied mix of the `range` asset and small
    // formations, each at its own scale/flip, heavily hazed toward the sky, sat
    // right on the horizon with breathing room between them.
    {
      const L = addLayer(0.1);
      const lw = localW(0.1);
      const r = rnd(31);
      const pick = makePicker(r);
      const baseY = HZ + groundSpan * 0.015;
      let x = -W * 0.1;
      while (x < lw + W * 0.1) {
        const useRange = r() < 0.45;
        if (useRange) {
          // a short slice of the range asset as a low distant ridge
          const targetH = groundSpan * (0.07 + r() * 0.05);
          placeFormation(L, RANGE, x, baseY, targetH, 0.78 + r() * 0.12, (r() - 0.5) * 0.3, {
            alpha: 0.55 + r() * 0.12,
            flip: r() > 0.5,
          });
          x += (340 + r() * 320) * (W / 1200);
        } else {
          const targetH = groundSpan * (0.1 + r() * 0.08);
          placeFormation(L, pick(), x, baseY, targetH, 0.7 + r() * 0.12, (r() - 0.5) * 0.4, {
            alpha: 0.55 + r() * 0.14,
            flip: r() > 0.5,
          });
          x += (190 + r() * 240) * (W / 1200);
        }
        // occasional larger gap so the ridge doesn't read as evenly spaced
        if (r() < 0.22) x += (160 + r() * 220) * (W / 1200);
      }
      if (!coarse) L.c.filters = [new BlurFilter({ strength: 2 })];
    }

    // ---- DISTANT formations — small, hazy, slow parallax ----
    {
      const L = addLayer(0.2);
      const lw = localW(0.2);
      const r = rnd(43);
      const pick = makePicker(r);
      const baseY = HZ + groundSpan * 0.06;
      const step = Math.max(300, W * 0.34);
      for (let x = step * 0.4; x < lw; x += step * (0.7 + r() * 0.7)) {
        const targetH = groundSpan * (0.18 + r() * 0.1);
        placeFormation(L, pick(), x + (r() - 0.5) * 60, baseY + (r() - 0.5) * 10, targetH,
          0.4 + r() * 0.18, (r() - 0.5) * 0.6, { alpha: 0.78 + r() * 0.12, flip: r() > 0.5 });
      }
      if (!coarse) L.c.filters = [new BlurFilter({ strength: 0.8 })];
    }

    // ---- MID formations — medium, light haze, medium parallax ----
    {
      const L = addLayer(0.34);
      const lw = localW(0.34);
      const r = rnd(53);
      const pick = makePicker(r);
      const baseY = HZ + groundSpan * 0.14;
      const step = Math.max(420, W * 0.46);
      for (let x = step * 0.3; x < lw; x += step * (0.7 + r() * 0.6)) {
        // sometimes a tight pair (e.g. twins-like grouping of different types)
        const count = r() < 0.28 ? 2 : 1;
        for (let j = 0; j < count; j++) {
          const targetH = groundSpan * (0.3 + r() * 0.16);
          placeFormation(L, pick(), x + j * (110 + r() * 60), baseY + (r() - 0.5) * 14, targetH,
            0.16 + r() * 0.14, (r() - 0.5) * 0.8, { alpha: 0.94, flip: r() > 0.5 });
        }
      }
    }

    // ---- HERO formations — big, saturated, near each station, fast parallax ----
    {
      const L = addLayer(0.5);
      const r = rnd(61);
      const pick = makePicker(r);
      const groundY = HZ + groundSpan * 0.28;
      for (let i = 0; i < N + 1; i++) {
        const count = 1 + (r() > 0.55 ? 1 : 0);
        for (let j = 0; j < count; j++) {
          const targetH = groundSpan * (0.52 + r() * 0.28);
          const x = i * stationStep + (r() - 0.5) * stationStep * 0.55;
          placeFormation(L, pick(), x, groundY, targetH, r() * 0.08, (r() - 0.5) * 1, {
            alpha: 0.99,
            flip: r() > 0.5,
          });
        }
      }
    }

    // ---- NEAR GROUND band (sand) — a soft tinted ridge under the foreground ----
    {
      const L = addLayer(0.62);
      const lw = localW(0.62);
      const g = new Graphics();
      const r = rnd(83);
      const seg = Math.max(8, Math.round(lw / 220));
      const baseY = HZ + groundSpan * 0.42;
      const amp = groundSpan * 0.04;
      g.moveTo(0, H);
      g.lineTo(0, baseY);
      for (let i = 0; i <= seg; i++) {
        const x = lw * (i / seg);
        const y = baseY - Math.sin((i / seg) * Math.PI * 2.2 + r() * 6) * amp - r() * amp * 0.4;
        g.lineTo(x, y);
      }
      g.lineTo(lw, H);
      g.lineTo(0, H);
      g.fill({ color: 0xffffff });
      g.tint = mix(pal.sand, pal.sandDeep, 0.4);
      L.c.addChild(g);
      groundG = g;
    }

    // ---- PLANTS (saguaro / agave / cottongrass) — sway about base ----
    {
      const L = addLayer(0.84);
      const lw = localW(0.84);
      const r = rnd(91);
      const plantPool: AssetKey[] = ["saguaro", "agave", "cottongrass", "agave", "cottongrass"];
      const count = Math.round(lw / 260);
      for (let i = 0; i < count; i++) {
        const x = lw * ((i + r() * 0.85) / count);
        const key = plantPool[Math.floor(r() * plantPool.length)];
        const baseY = H - 8 - r() * groundSpan * 0.28;
        const w =
          key === "saguaro" ? 54 + r() * 46 : key === "agave" ? 76 + r() * 54 : 50 + r() * 40;
        const s = placeByWidth(L, key, x, baseY, w, "plant", { flip: r() > 0.5 });
        // sway pivots near the base: nudge the anchor up so rotation looks rooted
        s.anchor.set(0.5, 0.97);
        swayers.push({ s, amp: 0.012 + r() * 0.026, sp: 0.5 + r() * 0.7, ph: r() * 6.28 });
      }
    }

    // ---- CONTENT PANELS (DOM) — above the canvas, parallaxed by worldCore ----
    core.buildPanels(panelHolder);

    // ---- NEAR FOREGROUND CRITTERS ----
    {
      const L = addLayer(1.0);
      const lw = localW(1.0);
      const r = rnd(97);

      // roadrunners & lizards wander the foreground
      const groundCritters: AssetKey[] = ["roadrunner", "lizard", "roadrunner", "lizard"];
      const nWander = 5;
      for (let i = 0; i < nWander; i++) {
        const key = groundCritters[i % groundCritters.length];
        const sc = key === "lizard" ? 0.18 + r() * 0.08 : 0.34 + r() * 0.14;
        const baseY = H - 12 - r() * groundSpan * 0.22;
        const min = (i / nWander) * lw + 40;
        const max = ((i + 1) / nWander) * lw - 40;
        const x = min + (max - min) * r();
        const s = placeByWidth(L, key, x, baseY, textures[key].width * sc, "ink", {
          flip: r() > 0.5,
        });
        s.anchor.set(0.5, 1);
        wanderers.push({
          s,
          baseY,
          x,
          dir: r() > 0.5 ? 1 : -1,
          speed: (key === "roadrunner" ? 26 : 14) + r() * 12,
          sc,
          state: "walk",
          timer: 1 + r() * 2,
          bobAmp: key === "roadrunner" ? 2.4 : 1.2,
          bobSp: 6 + r() * 3,
          phase: r() * 6.28,
          min,
          max,
        });
      }

      // jackrabbits hop periodically
      for (let i = 0; i < 2; i++) {
        const sc = 0.16 + r() * 0.07;
        const baseX = (i + 0.5) * (lw / 2) + (r() - 0.5) * 300;
        const baseY = H - 16 - r() * groundSpan * 0.16;
        const s = placeByWidth(L, "jackrabbit", baseX, baseY, textures.jackrabbit.width * sc, "ink", {
          flip: r() > 0.5,
        });
        s.anchor.set(0.5, 1);
        hoppers.push({
          s,
          baseX,
          baseY,
          sc,
          dir: r() > 0.5 ? 1 : -1,
          t: r() * 3,
          period: 2.4 + r() * 1.6,
          hop: 26 + r() * 18,
          dist: 60 + r() * 50,
          fromX: baseX,
        });
      }
    }

    // ---- BIRD flying across the sky (own slow layer) ----
    {
      const L = addLayer(0.2);
      const sc = 0.32;
      const s = placeByWidth(L, "bird", 0, 0, textures.bird.width * sc, "ink", {});
      s.anchor.set(0.5, 0.5);
      s.tint = mix(pal.ink, pal.skyTop, 0.25);
      bird = { s, x: -200, y0: H * (0.18 + Math.random() * 0.12), speed: 60 + Math.random() * 30, span: W + 400 };
    }

    // ---- TUMBLEWEED rolling across the foreground ----
    {
      const L = addLayer(1.0);
      const sc = 0.22;
      const s = placeByWidth(L, "tumbleweed", -100, H - 30, textures.tumbleweed.width * sc, "plant", {});
      s.anchor.set(0.5, 0.5);
      s.tint = mix(pal.rock, pal.sand, 0.45);
      tumble = { s, x: -100, y: H - 40, speed: 90 + Math.random() * 50, spin: 3 + Math.random() * 2, sc };
    }

    // ---- DUST (floating, animated) ----
    {
      const L = addLayer(0.55);
      const lw = localW(0.55);
      const r = rnd(109);
      const count = Math.round(lw / 120);
      for (let i = 0; i < count; i++) {
        const x = lw * (i / count) + r() * 70;
        const y = H * (0.12 + r() * 0.5);
        const g = new Graphics();
        g.circle(0, 0, 0.8 + r() * 1.6).fill({ color: pal.inkSoft, alpha: 0.08 + r() * 0.12 });
        g.x = x;
        g.y = y;
        L.c.addChild(g);
        dust.push({ g, x, y, amp: 6 + r() * 14, sp: 0.2 + r() * 0.5, ph: r() * 6.28 });
      }
    }

    retint();
  }

  // ---- per-frame parallax + animation --------------------------------------
  function render(state: FrameState) {
    for (const L of layers) {
      if (L.factor === 0) {
        L.c.x = 0;
        L.c.y = 0;
        continue;
      }
      L.c.x = -state.scroll * L.factor + state.curX * L.factor;
      L.c.y = state.curY * L.factor * 0.4;
    }
    core.positionPanels(state);
    core.syncProgress(state.scroll);
  }

  let lastNow = performance.now();
  function animate(state: FrameState, dt: number) {
    const time = state.time;

    // plants sway about their base
    for (const sw of swayers) {
      sw.s.rotation = Math.sin(time * sw.sp + sw.ph) * sw.amp;
    }

    // wandering ground critters: walk / pause / flip, with a little bob
    for (const w of wanderers) {
      w.timer -= dt;
      if (w.timer <= 0) {
        if (w.state === "walk") {
          w.state = "pause";
          w.timer = 0.6 + Math.random() * 1.6;
        } else {
          w.state = "walk";
          w.timer = 1.2 + Math.random() * 2.4;
          if (Math.random() < 0.5) w.dir *= -1;
        }
      }
      if (w.state === "walk") {
        w.x += w.dir * w.speed * dt;
        if (w.x < w.min) { w.x = w.min; w.dir = 1; }
        if (w.x > w.max) { w.x = w.max; w.dir = -1; }
      }
      const bob = w.state === "walk" ? Math.abs(Math.sin(time * w.bobSp + w.phase)) * w.bobAmp : 0;
      w.s.x = w.x;
      w.s.y = w.baseY - bob;
      w.s.scale.x = w.dir * w.sc;
    }

    // jackrabbits hop in arcs
    for (const h of hoppers) {
      h.t += dt;
      const u = (h.t % h.period) / h.period; // 0..1 within a hop cycle
      if (u < 0.55) {
        const k = u / 0.55; // airborne portion
        const arc = Math.sin(k * Math.PI);
        h.s.x = h.fromX + h.dir * h.dist * k;
        h.s.y = h.baseY - arc * h.hop;
        h.s.scale.x = h.dir * h.sc;
      } else {
        // landed; settle, then pick the next hop target at the cycle wrap
        h.s.y = h.baseY;
        if (h.t >= h.period) {
          h.t -= h.period;
          h.fromX = h.s.x;
          // turn around near the edges of its roaming band
          if (h.fromX > h.baseX + 260) h.dir = -1;
          else if (h.fromX < h.baseX - 260) h.dir = 1;
          else if (Math.random() < 0.3) h.dir *= -1;
        }
      }
    }

    // bird glides across the sky, looping
    if (bird) {
      bird.x += bird.speed * dt;
      if (bird.x > bird.span) {
        bird.x = -200;
        bird.y0 = core.layout.H * (0.16 + Math.random() * 0.16);
      }
      bird.s.x = bird.x;
      bird.s.y = bird.y0 + Math.sin(time * 1.6) * 10;
      // gentle wing-flap via vertical squash
      bird.s.scale.y = 0.32 * (0.9 + Math.abs(Math.sin(time * 7)) * 0.2);
    }

    // tumbleweed rolls + spins across the foreground, respawning
    if (tumble) {
      tumble.x += tumble.speed * dt;
      const span = core.layout.maxScroll + core.layout.W + 300;
      if (tumble.x > span) {
        tumble.x = -120;
        tumble.y = core.layout.H - 30 - Math.random() * 30;
        tumble.speed = 90 + Math.random() * 60;
      }
      tumble.s.x = tumble.x;
      tumble.s.y = tumble.y + Math.sin(time * 6) * 6;
      tumble.s.rotation += tumble.spin * dt;
    }

    // drifting dust
    for (const d of dust) {
      const dx = Math.sin(time * d.sp + d.ph) * d.amp;
      const dy = Math.cos(time * d.sp * 0.7 + d.ph) * d.amp * 0.6;
      d.g.x = d.x + dx;
      d.g.y = d.y + dy;
    }
  }

  // ---- ticker --------------------------------------------------------------
  const onTick = () => {
    const now = performance.now();
    let dt = (now - lastNow) / 1000;
    lastNow = now;
    if (dt > 0.1) dt = 0.1; // clamp after tab-switch
    const state = core.step(now);
    if (!core.reduceMotion) animate(state, dt);
    render(state);
  };

  // ---- resize (debounced rebuild, preserving scroll ratio) -----------------
  let rt: ReturnType<typeof setTimeout> | undefined;
  const onResize = () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (destroyed) return;
      const ratio = core.getScrollRatio();
      core.measure();
      pal = readPalette(root);
      build();
      core.setScrollRatio(ratio);
    }, 180);
  };

  // ---- time-of-day + Customize wiring (mirrors the SVG engine) -------------
  // applyPalette() writes CSS vars; we then re-read them as Pixi tints and
  // redraw the sky + sun/moon so WebGL tracks the slider.
  function setupCustomize() {
    const overlay = root.querySelector(".customize") as HTMLElement | null;
    const slider = root.querySelector(".customize__slider") as HTMLInputElement | null;
    const timeLbl = root.querySelector(".customize__time");
    const fmt = (min: number) => {
      const h24 = Math.floor(min / 60), m = min % 60;
      const ap = h24 < 12 ? "AM" : "PM";
      let hh = h24 % 12;
      if (hh === 0) hh = 12;
      return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
    };
    const store = (val: string | null) => {
      try {
        if (val == null) localStorage.removeItem("wander-tod");
        else localStorage.setItem("wander-tod", val);
      } catch {
        /* ignore */
      }
    };
    const read = () => {
      try {
        return localStorage.getItem("wander-tod");
      } catch {
        return null;
      }
    };
    const setTime = (min: number, manual: boolean) => {
      hour = min / 60;
      applyPalette(root, paletteAt(hour));
      pal = readPalette(root);
      drawSky();
      retint();
      if (bird) bird.s.tint = mix(pal.ink, pal.skyTop, 0.25);
      if (tumble) tumble.s.tint = mix(pal.rock, pal.sand, 0.45);
      if (timeLbl) timeLbl.textContent = fmt(min);
      if (slider) slider.value = String(min);
      if (manual) store(String(min));
    };
    const stored = read();
    setTime(stored != null ? parseInt(stored, 10) : Math.round(localHourNow() * 60), false);
    const open = () => overlay?.classList.add("open");
    const close = () => overlay?.classList.remove("open");
    if (slider) slider.addEventListener("input", () => setTime(parseInt(slider.value, 10), true));
    (root.querySelector(".customize__done") as HTMLElement | null)?.addEventListener("click", close);
    (root.querySelector(".customize__close") as HTMLElement | null)?.addEventListener("click", close);
    (root.querySelector(".customize__auto") as HTMLElement | null)?.addEventListener("click", () => {
      store(null);
      setTime(Math.round(localHourNow() * 60), false);
    });
    (root.querySelector(".sheet-customize") as HTMLElement | null)?.addEventListener("click", () => {
      open();
      const sheet = root.querySelector(".sheet");
      sheet?.classList.remove("open");
    });
  }

  // ---- init ----------------------------------------------------------------
  core.buildUI();
  build();
  setupCustomize(); // applies the stored/local hour → sky + tints
  const detachInput = core.bindInput(stage, onResize);
  app.ticker.add(onTick);

  // Dev-only debug handle so a headless screenshot can pause the ticker and use
  // Pixi's extractor for a deterministic capture. Stripped from production builds.
  if (import.meta.env.DEV) {
    (window as unknown as { __pixiApp?: Application }).__pixiApp = app;
  }

  // ---- teardown ------------------------------------------------------------
  return function destroy() {
    destroyed = true;
    clearTimeout(rt);
    detachInput();
    app.ticker.remove(onTick);
    app.destroy(true, { children: true, texture: false });
    if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
    if (skyDiv) skyDiv.style.opacity = "";
    if (glowDiv) glowDiv.style.opacity = "";
  };
}
