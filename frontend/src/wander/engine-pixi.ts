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
  role: "formation" | "plant" | "darkPlant" | "ink";
  haze: number;
  jitter: number;
  // depth band drives WHICH haze colour and how warm the base reads:
  //  "far"  → cool/pale far-haze, pushed toward the sky (recedes hard)
  //  "mid"  → standard horizon haze
  //  "near" → warmer, crisper base (the hero formations come forward)
  band?: "far" | "mid" | "near";
};

// Wandering ground critter (roadrunner / lizard / jackrabbit). Each has a small
// state machine — WALK in one direction for a randomised stretch → PAUSE/idle for
// a randomised stretch → maybe TURN (and only THEN flip the sprite) → continue —
// so motion reads as a purposeful animal, never a slider oscillating. The
// jackrabbit additionally arcs into discrete hops while walking. Every field
// (speed, pause/walk durations, phase) is seeded per-instance so the critters are
// never synchronised, and each is bounded to [min,max] so it can't wander off.
type Wanderer = {
  s: Sprite;
  kind: "roadrunner" | "lizard" | "jackrabbit";
  baseY: number;
  x: number;
  dir: 1 | -1;
  speed: number;
  sc: number;
  state: "walk" | "pause";
  timer: number; // seconds left in the current state
  walkLo: number; // randomised walk-duration range
  walkHi: number;
  pauseLo: number; // randomised pause-duration range
  pauseHi: number;
  turnChance: number; // probability of reversing when a walk starts
  // gait: gentle vertical bob (roadrunner/lizard) or discrete hop arcs (rabbit)
  gaitPhase: number;
  gaitSp: number;
  bobAmp: number;
  hop: number; // peak hop height for the jackrabbit (0 for others)
  hopPhase: number; // phase offset so each hop cadence differs
  hopSp: number; // hop cadence (Hz-ish) while walking
  min: number;
  max: number;
};

// Plant that sways about its base.
type Swayer = { s: Sprite; amp: number; sp: number; ph: number; gust: number };

// A small gliding bird in the loose flock — one direction, gentle altitude bob,
// staggered respawn. Depth controls size/speed/tint so the flock reads layered.
type FlockBird = {
  s: Sprite;
  x: number;
  y0: number;
  depth: number; // 0 near → 1 far, drives size/speed/altitude/tint
  baseScale: number; // resting scale (depth-graded)
  speed: number;
  span: number; // x past which it respawns
  bobAmp: number;
  bobSp: number;
  bobPh: number;
  flapSp: number;
  flapPh: number;
  spawnDelay: number; // seconds before it (re)enters from the left
  startX: number; // x it (re)enters at
};

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
  let swayers: Swayer[] = [];
  let dust: Dust[] = [];
  let flock: FlockBird[] = [];
  let tumble: { s: Sprite; x: number; y: number; speed: number; spin: number; sc: number; delay: number } | null = null;
  let groundG: Graphics | null = null; // near sand band — re-tinted with the palette
  let nearDuneG: Graphics | null = null; // near-foreground dune lip (fastest parallax)

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
    opts: { alpha?: number; flip?: boolean; band?: "far" | "mid" | "near" } = {},
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
    tintables.push({ s, role: "formation", haze, jitter, band: opts.band ?? "mid" });
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

  // The critter PNGs (roadrunner / lizard / jackrabbit) are all drawn facing
  // LEFT. To make a critter FACE the way it travels (never moonwalk), the sprite
  // is shown un-flipped (+scale) when moving left and mirrored (−scale) when
  // moving right. `setFacing` is the single source of truth for that mapping.
  function setFacing(w: Wanderer) {
    w.s.scale.x = -w.dir * w.sc;
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

  // The colour the haze blends toward: the pale, slightly cool band just above
  // the horizon. Distant landforms are blended hard toward this so they dissolve
  // into the sky — the core of the atmospheric-recession read.
  function hazeColor(): number {
    return mix(mix(pal.skyBot, pal.glow, 0.35), pal.skyTop, 0.18);
  }
  // A cooler, paler far-haze for the deepest ridges so they read distinctly
  // bluer/colder than the warm near hero formations (aerial perspective).
  function farHazeColor(): number {
    return mix(hazeColor(), pal.skyTop, 0.32);
  }
  // Pack a 24-bit tint + alpha into an `rgba()` string (a ColorSource Pixi
  // accepts), so gradient stops can carry their own opacity.
  function rgba(c: number, a: number): string {
    return `rgba(${(c >> 16) & 0xff},${(c >> 8) & 0xff},${c & 0xff},${a})`;
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
    const farHaze = farHazeColor();
    const inkTint = mix(pal.ink, pal.landMid, 0.12);
    if (groundG) groundG.tint = mix(pal.sand, pal.sandDeep, 0.4);
    if (nearDuneG) nearDuneG.tint = mix(pal.sandDeep, pal.rock, 0.22);
    for (const t of tintables) {
      if (t.role === "formation") {
        const band = t.band ?? "mid";
        // jitter shifts slightly cooler (toward landFar) or warmer (toward hill);
        // near formations bias warmer/crisper, far ones bias cooler/paler.
        const warm = t.jitter >= 0;
        let nudge = warm
          ? mix(base, pal.hill, Math.min(0.3, t.jitter))
          : mix(base, pal.landFar, Math.min(0.3, -t.jitter));
        if (band === "near") nudge = mix(nudge, pal.hill, 0.22); // warmer hero rock
        else if (band === "far") nudge = mix(nudge, pal.landFar, 0.18); // cooler/paler
        const into = band === "far" ? farHaze : haze;
        t.s.tint = mix(nudge, into, t.haze);
      } else if (t.role === "plant") {
        t.s.tint = mix(pal.plant, pal.sage, 0.4);
      } else if (t.role === "darkPlant") {
        // near-foreground silhouette plants: darker, warmer-shadowed green
        t.s.tint = mix(mix(pal.plant, pal.sage, 0.3), pal.ink, 0.42);
      } else {
        // critters: keep them as ink outlines, barely shifted by time of day
        t.s.tint = inkTint;
      }
    }
    // flock birds fade toward the sky with depth so far ones nearly dissolve
    for (const b of flock) {
      b.s.tint = mix(mix(pal.ink, pal.skyTop, 0.25), pal.skyTop, b.depth * 0.45);
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
    swayers = [];
    dust = [];
    flock = [];
    tumble = null;
    groundG = null;
    nearDuneG = null;

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

    // The whole landscape is built as a deep stack of parallax bands. As bands
    // recede they get: SMALLER, HAZIER (tint pushed harder toward the haze/sky
    // colour, lower alpha), COOLER (far band uses the cool far-haze), BLURRIER and
    // SLOWER (lower parallax factor). As they come forward they get larger,
    // crisper, warmer and faster. The factors are pulled apart far more than the
    // old build so the recession actually reads.

    // ---- FAR SKYLINE — a faint paper-cut ridge dissolving into the sky -------
    // The deepest layer: tiny, very pale, cool instances sat right on the horizon
    // with generous gaps. Barely-there — it just gives the horizon a soft tooth.
    {
      const L = addLayer(0.04);
      const lw = localW(0.04);
      const r = rnd(29);
      const pick = makePicker(r);
      const baseY = HZ + groundSpan * 0.004;
      let x = -W * 0.1;
      while (x < lw + W * 0.1) {
        if (r() < 0.5) {
          const targetH = groundSpan * (0.04 + r() * 0.035);
          placeFormation(L, RANGE, x, baseY, targetH, 0.9 + r() * 0.08, (r() - 0.5) * 0.2, {
            alpha: 0.34 + r() * 0.1, flip: r() > 0.5, band: "far",
          });
          x += (420 + r() * 380) * (W / 1200);
        } else {
          const targetH = groundSpan * (0.06 + r() * 0.05);
          placeFormation(L, pick(), x, baseY, targetH, 0.86 + r() * 0.1, (r() - 0.5) * 0.3, {
            alpha: 0.32 + r() * 0.12, flip: r() > 0.5, band: "far",
          });
          x += (240 + r() * 300) * (W / 1200);
        }
        if (r() < 0.3) x += (220 + r() * 260) * (W / 1200);
      }
      // single low-quality blur pass — cheap, and the far ridge is faint anyway
      if (!coarse) L.c.filters = [new BlurFilter({ strength: 2, quality: 1 })];
    }

    // ---- ATMOSPHERIC HAZE BAND — a soft horizontal wash fading the far ridges
    // into the horizon colour. Sits just above the far bases, between the far
    // skyline and the first distant ridge, on its own slow layer.
    {
      const L = addLayer(0.06);
      const lw = localW(0.06);
      const g = new Graphics();
      const top = HZ - groundSpan * 0.16;
      const bandH = groundSpan * 0.3;
      const far = farHazeColor();
      const grad = new FillGradient({
        type: "linear",
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
        colorStops: [
          { offset: 0, color: rgba(far, 0) },
          { offset: 0.55, color: rgba(far, coarse ? 0.5 : 0.62) },
          { offset: 1, color: rgba(hazeColor(), 0) },
        ],
      });
      g.rect(0, top, lw, bandH).fill(grad);
      L.c.addChild(g);
    }

    // ---- DISTANT RIDGE A — small, very hazy, cool, slow ---------------------
    {
      const L = addLayer(0.12);
      const lw = localW(0.12);
      const r = rnd(43);
      const pick = makePicker(r);
      const baseY = HZ + groundSpan * 0.04;
      const step = Math.max(260, W * 0.3);
      for (let x = step * 0.3; x < lw; x += step * (0.6 + r() * 0.7)) {
        const targetH = groundSpan * (0.12 + r() * 0.08);
        placeFormation(L, pick(), x + (r() - 0.5) * 70, baseY + (r() - 0.5) * 8, targetH,
          0.66 + r() * 0.14, (r() - 0.5) * 0.5, {
            alpha: 0.6 + r() * 0.12, flip: r() > 0.5, band: "far",
          });
      }
      if (!coarse) L.c.filters = [new BlurFilter({ strength: 1.2, quality: 1 })];
    }

    // ---- DISTANT RIDGE B — a touch bigger/closer, still hazy, slow ----------
    {
      const L = addLayer(0.22);
      const lw = localW(0.22);
      const r = rnd(47);
      const pick = makePicker(r);
      const baseY = HZ + groundSpan * 0.085;
      const step = Math.max(320, W * 0.36);
      for (let x = step * 0.4; x < lw; x += step * (0.7 + r() * 0.6)) {
        const targetH = groundSpan * (0.2 + r() * 0.11);
        placeFormation(L, pick(), x + (r() - 0.5) * 60, baseY + (r() - 0.5) * 10, targetH,
          0.42 + r() * 0.16, (r() - 0.5) * 0.7, {
            alpha: 0.82 + r() * 0.12, flip: r() > 0.5, band: "mid",
          });
      }
      // no blur here — the haze band + alpha grading already soften this ridge,
      // and a third full-width filter pass isn't worth the GPU cost.
    }

    // ---- MID formations — medium, light haze, medium parallax ----
    {
      const L = addLayer(0.36);
      const lw = localW(0.36);
      const r = rnd(53);
      const pick = makePicker(r);
      const baseY = HZ + groundSpan * 0.15;
      const step = Math.max(440, W * 0.48);
      for (let x = step * 0.3; x < lw; x += step * (0.7 + r() * 0.6)) {
        // sometimes a tight pair (e.g. twins-like grouping of different types)
        const count = r() < 0.28 ? 2 : 1;
        for (let j = 0; j < count; j++) {
          const targetH = groundSpan * (0.34 + r() * 0.16);
          placeFormation(L, pick(), x + j * (110 + r() * 60), baseY + (r() - 0.5) * 14, targetH,
            0.14 + r() * 0.12, (r() - 0.5) * 0.85, {
              alpha: 0.95, flip: r() > 0.5, band: "mid",
            });
        }
      }
    }

    // ---- HERO formations — big, warm, crisp, near each station, fast parallax ----
    {
      const L = addLayer(0.56);
      const r = rnd(61);
      const pick = makePicker(r);
      const groundY = HZ + groundSpan * 0.3;
      for (let i = 0; i < N + 1; i++) {
        const count = 1 + (r() > 0.55 ? 1 : 0);
        for (let j = 0; j < count; j++) {
          const targetH = groundSpan * (0.56 + r() * 0.3);
          const x = i * stationStep + (r() - 0.5) * stationStep * 0.55;
          placeFormation(L, pick(), x, groundY, targetH, r() * 0.05, (r() - 0.5) * 1, {
            alpha: 1, flip: r() > 0.5, band: "near",
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
        // each plant sways at its own rate/phase, with a slow secondary "gust"
        // beat so the field never pulses in unison.
        swayers.push({
          s,
          amp: 0.012 + r() * 0.026,
          sp: 0.5 + r() * 0.7,
          ph: r() * 6.28,
          gust: 0.11 + r() * 0.17,
        });
      }
    }

    // ---- NEAR-FOREGROUND LIP — a low dune edge + a couple of close, larger,
    // slightly darker plants/rocks that parallax the FASTEST, bracketing the
    // depth so the near/far read is unmistakable. Sits in front of the critters'
    // ground but behind the panels visually via draw order below.
    {
      const L = addLayer(1.18);
      const lw = localW(1.18);
      const r = rnd(127);
      // the dune lip itself — a dark, soft sand edge hugging the bottom
      const g = new Graphics();
      const seg = Math.max(8, Math.round(lw / 200));
      const lipBase = H - groundSpan * 0.05;
      const amp = groundSpan * 0.06;
      g.moveTo(0, H + 4);
      g.lineTo(0, lipBase);
      for (let i = 0; i <= seg; i++) {
        const x = lw * (i / seg);
        const y =
          lipBase - Math.sin((i / seg) * Math.PI * 3.1 + r() * 6) * amp - r() * amp * 0.5;
        g.lineTo(x, y);
      }
      g.lineTo(lw, H + 4);
      g.lineTo(0, H + 4);
      g.fill({ color: 0xffffff });
      g.tint = mix(pal.sandDeep, pal.rock, 0.22);
      L.c.addChild(g);
      nearDuneG = g;
      // a couple of close, larger, slightly darker silhouette plants on the lip
      const nearPlants: AssetKey[] = ["agave", "saguaro", "agave"];
      const nNear = 3;
      for (let i = 0; i < nNear; i++) {
        const key = nearPlants[i % nearPlants.length];
        const x = lw * ((i + 0.2 + r() * 0.6) / nNear);
        const baseY = H + groundSpan * 0.01;
        const w = key === "saguaro" ? 120 + r() * 60 : 150 + r() * 80;
        // near plants read darker (silhouette-y) — their own retint role
        const s = placeByWidth(L, key, x, baseY, w, "darkPlant", { flip: r() > 0.5 });
        s.anchor.set(0.5, 0.98);
        swayers.push({
          s,
          amp: 0.01 + r() * 0.018,
          sp: 0.4 + r() * 0.5,
          ph: r() * 6.28,
          gust: 0.09 + r() * 0.12,
        });
      }
    }

    // ---- CONTENT PANELS (DOM) — above the canvas, parallaxed by worldCore ----
    core.buildPanels(panelHolder);

    // ---- NEAR FOREGROUND CRITTERS — each a bounded, state-machine wanderer ----
    {
      const L = addLayer(1.0);
      const lw = localW(1.0);
      const r = rnd(97);

      // roadrunners & lizards roam their own region of the world. No two share a
      // speed/phase/cadence, so they never march in step.
      const groundCritters: ("roadrunner" | "lizard")[] = [
        "roadrunner", "lizard", "roadrunner", "lizard", "roadrunner",
      ];
      const nWander = groundCritters.length;
      for (let i = 0; i < nWander; i++) {
        const kind = groundCritters[i];
        const sc = kind === "lizard" ? 0.18 + r() * 0.08 : 0.34 + r() * 0.14;
        const baseY = H - 12 - r() * groundSpan * 0.22;
        // each owns a slice of the world (with a little overlap) and starts somewhere
        // random inside it, facing a random way, already mid-walk or mid-pause.
        const min = (i / nWander) * lw + 40;
        const max = ((i + 1) / nWander) * lw - 40;
        const x = min + (max - min) * r();
        const startWalking = r() > 0.4;
        const s = placeByWidth(L, kind, x, baseY, textures[kind].width * sc, "ink", {
          flip: r() > 0.5,
        });
        s.anchor.set(0.5, 1);
        const dir: 1 | -1 = r() > 0.5 ? 1 : -1;
        const w: Wanderer = {
          s, kind, baseY, x, dir,
          speed: (kind === "roadrunner" ? 30 : 15) + r() * 14,
          sc,
          state: startWalking ? "walk" : "pause",
          timer: startWalking ? 1.2 + r() * 3 : 0.6 + r() * 2.2,
          walkLo: kind === "roadrunner" ? 1.6 : 1.0,
          walkHi: kind === "roadrunner" ? 4.5 : 3.2,
          pauseLo: 0.7,
          pauseHi: kind === "roadrunner" ? 2.6 : 3.4,
          turnChance: 0.42,
          gaitPhase: r() * 6.28,
          gaitSp: (kind === "roadrunner" ? 9 : 6.5) + r() * 3,
          bobAmp: kind === "roadrunner" ? 3.4 : 1.8,
          hop: 0,
          hopPhase: 0,
          hopSp: 0,
          min, max,
        };
        setFacing(w); // face travel direction from the start
        wanderers.push(w);
      }

      // jackrabbits: same walk/pause machine, but their "gait" is a series of hop
      // arcs while moving (and they sit still on a pause).
      for (let i = 0; i < 2; i++) {
        const kind = "jackrabbit" as const;
        const sc = 0.16 + r() * 0.07;
        const baseY = H - 16 - r() * groundSpan * 0.16;
        const min = i * (lw / 2) + 60;
        const max = (i + 1) * (lw / 2) - 60;
        const x = min + (max - min) * r();
        const startWalking = r() > 0.45;
        const s = placeByWidth(L, kind, x, baseY, textures.jackrabbit.width * sc, "ink", {
          flip: r() > 0.5,
        });
        s.anchor.set(0.5, 1);
        const dir: 1 | -1 = r() > 0.5 ? 1 : -1;
        const w: Wanderer = {
          s, kind, baseY, x, dir,
          speed: 26 + r() * 18,
          sc,
          state: startWalking ? "walk" : "pause",
          timer: startWalking ? 1.4 + r() * 2.4 : 0.8 + r() * 2.4,
          walkLo: 1.2,
          walkHi: 3.0,
          pauseLo: 1.0,
          pauseHi: 3.6,
          turnChance: 0.4,
          gaitPhase: r() * 6.28,
          gaitSp: 0,
          bobAmp: 0,
          hop: 26 + r() * 18,
          hopPhase: r() * 6.28,
          hopSp: 2.3 + r() * 1.0, // hops per second while moving
          min, max,
        };
        setFacing(w);
        wanderers.push(w);
      }
    }

    // ---- BIRD FLOCK — 2–3 small birds gliding one way at staggered depths ----
    // Each bird is a different size/speed/altitude (depth-graded), bobs gently and
    // independently, never flips, and respawns from the left after a stagger so
    // the flock is loose and asynchronous.
    {
      const L = addLayer(0.16);
      const r = rnd(113);
      const n = 2 + (r() > 0.4 ? 1 : 0); // 2 or 3
      for (let i = 0; i < n; i++) {
        // depth 0 = nearer/bigger/faster/lower, 1 = farther/smaller/slower/higher
        const depth = (i + r() * 0.6) / n;
        const baseScale = 0.13 * (0.55 + (1 - depth) * 0.55); // 0.13 ceiling, smaller when far
        const s = placeByWidth(L, "bird", 0, 0, textures.bird.width * baseScale, "ink", {});
        s.anchor.set(0.5, 0.5);
        s.tint = mix(mix(pal.ink, pal.skyTop, 0.25), pal.skyTop, depth * 0.45);
        s.scale.set(baseScale);
        const startX = -120 - r() * 220;
        flock.push({
          s,
          x: startX,
          y0: H * (0.14 + depth * 0.16 + r() * 0.04),
          depth,
          baseScale,
          speed: 44 + (1 - depth) * 46 + r() * 16,
          span: W + 220,
          bobAmp: 6 + (1 - depth) * 10,
          bobSp: 0.9 + r() * 0.9,
          bobPh: r() * 6.28,
          flapSp: 6 + r() * 3,
          flapPh: r() * 6.28,
          spawnDelay: i * (1.6 + r() * 2.4),
          startX,
        });
      }
    }

    // ---- TUMBLEWEED rolling one way across the foreground, respawning ----
    {
      const L = addLayer(1.0);
      const sc = 0.22;
      const s = placeByWidth(L, "tumbleweed", -100, H - 30, textures.tumbleweed.width * sc, "plant", {});
      s.anchor.set(0.5, 0.5);
      s.tint = mix(pal.rock, pal.sand, 0.45);
      tumble = {
        s, x: -100, y: H - 40,
        speed: 90 + Math.random() * 50,
        spin: 3 + Math.random() * 2,
        sc,
        delay: 1 + Math.random() * 6, // staggered first entrance
      };
    }

    // ---- DUST (floating, animated) ----
    {
      const L = addLayer(0.55);
      const lw = localW(0.55);
      const r = rnd(109);
      // cap the mote count so per-frame work stays bounded on very wide worlds
      const count = Math.min(coarse ? 26 : 48, Math.round(lw / 120));
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

    // plants sway about their base — each at its own rate/phase, modulated by a
    // slow secondary "gust" beat so the field never pulses in unison.
    for (const sw of swayers) {
      const gust = 0.6 + 0.4 * Math.sin(time * sw.gust + sw.ph * 0.5);
      sw.s.rotation = Math.sin(time * sw.sp + sw.ph) * sw.amp * gust;
    }

    // ground critters: a small WALK → PAUSE → (maybe TURN) → WALK state machine.
    // Direction only changes between bouts, and the sprite is flipped ONLY when it
    // actually turns — so motion reads as a purposeful animal, not an oscillator.
    for (const w of wanderers) {
      w.timer -= dt;
      if (w.timer <= 0) {
        if (w.state === "walk") {
          // settle into an idle pause
          w.state = "pause";
          w.timer = w.pauseLo + Math.random() * (w.pauseHi - w.pauseLo);
        } else {
          // begin a new walk bout; sometimes pick a new heading first, then face it
          w.state = "walk";
          w.timer = w.walkLo + Math.random() * (w.walkHi - w.walkLo);
          if (Math.random() < w.turnChance) {
            w.dir = (w.dir * -1) as 1 | -1;
            setFacing(w); // flip ONLY on a real turn — and always toward travel
          }
        }
      }

      if (w.state === "walk") {
        w.x += w.dir * w.speed * dt;
        // bounce off the edges of its region — turn (and face) the new way to stay in
        if (w.x < w.min) {
          w.x = w.min;
          if (w.dir < 0) { w.dir = 1; setFacing(w); }
        } else if (w.x > w.max) {
          w.x = w.max;
          if (w.dir > 0) { w.dir = -1; setFacing(w); }
        }
      }

      // gait animation — believable per-animal locomotion, NOT a vertical bounce:
      //  • roadrunner: glides forward smoothly with a small rhythmic head/body
      //    PITCH rock (the bird tips as it scampers) — feet stay on the ground;
      //  • lizard: a low, sinuous side-to-side body UNDULATION (spine wiggle), no
      //    lift off the ground;
      //  • jackrabbit: discrete BOUNDING hop arcs (rabbits really do leap), leaning
      //    forward on launch and levelling at the apex.
      let y = w.baseY;
      let rot = 0;
      let skewX = 0;
      if (w.state === "walk") {
        if (w.kind === "jackrabbit") {
          const ph = time * Math.PI * w.hopSp + w.hopPhase;
          y = w.baseY - Math.abs(Math.sin(ph)) * w.hop;
          rot = -w.dir * 0.16 * Math.cos(ph); // lean into the leap, level at apex
        } else if (w.kind === "roadrunner") {
          // smooth ground travel + a gentle forward-tipping rock synced to stride
          rot = -w.dir * 0.045 * (0.5 + 0.5 * Math.sin(time * w.gaitSp + w.gaitPhase));
        } else {
          // lizard: sinuous lateral undulation via a small horizontal skew; the
          // body slinks side to side without ever leaving the ground.
          skewX = 0.07 * Math.sin(time * w.gaitSp + w.gaitPhase);
        }
      } else if (w.kind !== "jackrabbit") {
        // idle: a near-imperceptible breathing rock, no vertical hopping
        rot = 0.015 * Math.sin(time * 1.3 + w.gaitPhase);
      }
      w.s.x = w.x;
      w.s.y = y;
      // sprite mirrors on facing via scale.x; rotation/skew read correctly for both
      // headings since the anchor sits at the base (feet) — so it pivots on the
      // ground, never floating.
      w.s.rotation = rot;
      w.s.skew.x = skewX;
    }

    // bird flock: each glides one direction, bobs independently, never flips,
    // respawns from the left after its own stagger.
    {
      const Hh = core.layout.H;
      for (const b of flock) {
        if (b.spawnDelay > 0) {
          b.spawnDelay -= dt;
          b.s.visible = false;
          continue;
        }
        b.s.visible = true;
        b.x += b.speed * dt;
        if (b.x > b.span) {
          // re-enter from the left at a fresh altitude/speed after a short stagger
          b.x = b.startX - Math.random() * 160;
          b.y0 = Hh * (0.13 + Math.random() * 0.2);
          b.speed = 44 + Math.random() * 60;
          b.spawnDelay = 0.5 + Math.random() * 3.5;
        }
        b.s.x = b.x;
        b.s.y = b.y0 + Math.sin(time * b.bobSp + b.bobPh) * b.bobAmp;
        // subtle wing-flap via vertical squash, around the bird's resting scale
        b.s.scale.y = b.baseScale * (0.88 + Math.abs(Math.sin(time * b.flapSp + b.flapPh)) * 0.24);
      }
    }

    // tumbleweed rolls ONE way across the foreground, respawning at random gaps
    if (tumble) {
      if (tumble.delay > 0) {
        tumble.delay -= dt;
        tumble.s.visible = false;
      } else {
        tumble.s.visible = true;
        tumble.x += tumble.speed * dt;
        const span = core.layout.maxScroll + core.layout.W + 300;
        if (tumble.x > span) {
          tumble.x = -120;
          tumble.y = core.layout.H - 30 - Math.random() * 30;
          tumble.speed = 90 + Math.random() * 60;
          tumble.delay = 2 + Math.random() * 9; // randomised respawn gap
        }
        tumble.s.x = tumble.x;
        tumble.s.y = tumble.y + Math.abs(Math.sin(time * 4 + tumble.x * 0.01)) * 7;
        tumble.s.rotation += tumble.spin * dt;
      }
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
