// engine-pixi.ts — Pixi.js v8 (WebGL) "wide-world" render path for the
// wandering portfolio, behind the `?pixi=1` / `/wander-v2` flag.
//
// Unlike the SVG engine (which is procedural), this path paints REAL illustrated
// PNG assets (black-ink outline + light fill on transparent backgrounds, so
// `sprite.tint` recolours them cleanly) over a programmatic gradient sky:
//
//   • a Pixi Graphics SKY that cycles sunrise → day → golden → sunset → night,
//     with a sun that arcs across the sky by time of day and a moon at night;
//   • parallax LAND layers across the wide world, with formation variety per
//     region (mesa / arch / spires / butte mixed; a far range tiled hazily),
//     every land sprite tinted by the time-of-day land colours;
//   • animated CRITTERS — roadrunner & lizard wander + pause + flip, jackrabbit
//     hops, a bird flies across the sky, a tumbleweed rolls + respawns, plants
//     sway about their base — plus drifting dust.
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
const FORMATIONS = ["mesa", "butte", "arch", "spires", "range", "boulders"] as const;
const PLANTS = ["saguaro", "agave", "grass"] as const;
const CRITTERS = ["jackrabbit", "roadrunner", "lizard", "bird", "tumbleweed"] as const;
type AssetKey =
  | (typeof FORMATIONS)[number]
  | (typeof PLANTS)[number]
  | (typeof CRITTERS)[number];
const ALL_KEYS: AssetKey[] = [...FORMATIONS, ...PLANTS, ...CRITTERS];

type Layer = { c: Container; factor: number };

// A sprite that gets re-tinted each time the palette changes.
type Tintable = { s: Sprite; role: "land" | "far" | "plant" | "ink" };

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

  // ---- helpers -------------------------------------------------------------
  function addLayer(factor: number): Layer {
    const c = new Container();
    rootStage.addChild(c);
    const L = { c, factor };
    layers.push(L);
    return L;
  }

  // Place a tinted formation/plant sprite anchored at its base-centre.
  function placeSprite(
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
    tintables.push({ s, role });
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

  // Redraw the gradient sky for the current palette + hour.
  function drawSky() {
    if (destroyed || !skyG) return;
    const { W, H, HZ } = core.layout;
    const night = luma(pal.skyTop) < 0.42;
    const horizon = HZ / H;

    skyG.clear();
    const grad = new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: pal.skyTop },
        { offset: Math.max(0.05, horizon - 0.32), color: mix(pal.skyTop, pal.skyBot, 0.5) },
        { offset: horizon - 0.06, color: pal.skyBot },
        { offset: horizon, color: mix(pal.skyBot, pal.glow, 0.55) },
        { offset: Math.min(0.98, horizon + 0.04), color: mix(pal.glow, pal.landFar, 0.45) },
        { offset: 1, color: mix(pal.sand, pal.sandDeep, 0.4) },
      ],
    });
    skyG.rect(0, 0, W, H).fill(grad);

    // Warm horizon glow band (the "sunrise/sunset" bloom), strongest low in the sky.
    const glow = new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: Math.max(0, horizon - 0.18), color: pal.glow },
        { offset: horizon, color: pal.glow },
        { offset: horizon + 0.08, color: pal.glow },
      ],
    });
    skyG.rect(0, H * (horizon - 0.18), W, H * 0.26).fill({ fill: glow, alpha: night ? 0.18 : 0.5 });

    // sun + moon position/visibility
    const sp = sunPos(hour, W, H);
    const mp = moonPos(hour, W, H);

    sunG.clear();
    if (sp.up) {
      const R = Math.round(H * 0.055);
      sunG.circle(0, 0, R * 3.2).fill({ color: pal.sun, alpha: 0.1 });
      sunG.circle(0, 0, R * 2).fill({ color: pal.sun, alpha: 0.18 });
      sunG.circle(0, 0, R).fill({ color: pal.sun });
      sunG.circle(0, 0, R * 0.66).fill({ color: pal.sunCore });
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

  // Re-tint every land/plant sprite for the current palette.
  function retint() {
    if (destroyed) return;
    for (const t of tintables) {
      if (t.role === "land") t.s.tint = pal.landMid;
      else if (t.role === "far") t.s.tint = mix(pal.landFar, pal.skyBot, 0.35);
      else if (t.role === "plant") t.s.tint = mix(pal.plant, pal.sage, 0.4);
      else t.s.tint = mix(pal.ink, pal.landMid, 0.18);
    }
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

    const { W, H, HZ, stationStep, maxScroll, N } = core.layout;
    const localW = (factor: number) => Math.ceil(maxScroll * factor + W + 200);

    // ---- SKY (own layer at factor 0; never scrolls) ----
    const Lsky = addLayer(0);
    skyG = new Graphics();
    sunG = new Graphics();
    moonG = new Graphics();
    Lsky.c.addChild(skyG, sunG, moonG);
    drawSky();

    // ---- FAR RANGE — tiled hazily along the horizon ----
    {
      const L = addLayer(0.12);
      const lw = localW(0.12);
      const tileW = Math.min(W * 0.9, 760);
      const baseY = HZ + H * 0.01;
      const n = Math.ceil(lw / (tileW * 0.82)) + 1;
      for (let i = 0; i < n; i++) {
        const x = i * tileW * 0.82;
        const s = placeSprite(L, "range", x, baseY, tileW, "far", { alpha: 0.82 });
        s.y += (i % 2) * 6;
      }
      if (!coarse) L.c.filters = [new BlurFilter({ strength: 2 })];
    }

    // ---- MID FORMATIONS — varied per region, no repeat adjacent ----
    {
      const L = addLayer(0.26);
      const lw = localW(0.26);
      const baseY = HZ + H * 0.07;
      const r = rnd(41);
      const pool: AssetKey[] = ["mesa", "butte", "arch", "spires"];
      let prev = -1;
      const step = Math.max(360, W * 0.42);
      for (let x = step * 0.5, i = 0; x < lw; x += step * (0.7 + r() * 0.6), i++) {
        let pick = Math.floor(r() * pool.length);
        if (pick === prev) pick = (pick + 1) % pool.length;
        prev = pick;
        const key = pool[pick];
        const w = (220 + r() * 200) * (key === "spires" ? 0.8 : 1);
        placeSprite(L, key, x + (r() - 0.5) * 60, baseY + (r() - 0.5) * 12, w, "far", {
          alpha: 0.9,
          flip: r() > 0.5,
        });
      }
    }

    // ---- HERO FORMATIONS — big, near each station, with variety ----
    {
      const L = addLayer(0.46);
      const r = rnd(59);
      const groundY = HZ + H * 0.17;
      const heroPool: AssetKey[] = ["mesa", "arch", "spires", "butte", "boulders"];
      let prev = -1;
      for (let i = 0; i < N + 1; i++) {
        // 1–2 hero formations clustered around each station, never repeating type
        const count = 1 + (r() > 0.55 ? 1 : 0);
        for (let j = 0; j < count; j++) {
          let pick = Math.floor(r() * heroPool.length);
          if (pick === prev) pick = (pick + 1) % heroPool.length;
          prev = pick;
          const key = heroPool[pick];
          const x = i * stationStep + (r() - 0.5) * stationStep * 0.5;
          const w =
            (key === "boulders" ? 260 : 420) * (0.78 + r() * 0.5);
          placeSprite(L, key, x, groundY, w, "land", { flip: r() > 0.5, alpha: 0.98 });
        }
      }
    }

    // ---- NEAR GROUND band (sand) — a simple tinted ridge under the foreground ----
    {
      const L = addLayer(0.62);
      const lw = localW(0.62);
      const g = new Graphics();
      const r = rnd(83);
      const seg = Math.max(8, Math.round(lw / 220));
      const baseY = HZ + H * 0.26;
      const amp = H * 0.02;
      g.moveTo(0, H);
      g.lineTo(0, baseY);
      for (let i = 0; i <= seg; i++) {
        const x = lw * (i / seg);
        const y = baseY - Math.sin((i / seg) * Math.PI * 2.2 + r() * 6) * amp - r() * amp * 0.4;
        g.lineTo(x, y);
      }
      g.lineTo(lw, H);
      g.lineTo(0, H);
      g.fill({ color: mix(pal.sand, pal.sandDeep, 0.4) });
      L.c.addChild(g);
    }

    // ---- PLANTS (saguaro / agave / grass) — sway about base; scatter across ----
    {
      const L = addLayer(0.84);
      const lw = localW(0.84);
      const r = rnd(91);
      const plantPool: AssetKey[] = ["saguaro", "agave", "grass", "agave", "grass"];
      const count = Math.round(lw / 240);
      for (let i = 0; i < count; i++) {
        const x = lw * ((i + r() * 0.85) / count);
        const key = plantPool[Math.floor(r() * plantPool.length)];
        const baseY = H - 8 - r() * H * 0.16;
        const w =
          key === "saguaro" ? 70 + r() * 60 : key === "agave" ? 70 + r() * 50 : 90 + r() * 70;
        const s = placeSprite(L, key, x, baseY, w, "plant", { flip: r() > 0.5 });
        // sway pivots near the base: nudge the anchor up so rotation looks rooted
        s.anchor.set(0.5, 0.96);
        swayers.push({ s, amp: 0.015 + r() * 0.03, sp: 0.5 + r() * 0.7, ph: r() * 6.28 });
      }
    }

    // ---- CONTENT PANELS (DOM) — above the canvas, parallaxed by worldCore ----
    core.buildPanels(panelHolder);

    // ---- NEAR FOREGROUND CRITTERS + boulders ----
    {
      const L = addLayer(1.0);
      const lw = localW(1.0);
      const r = rnd(97);

      // a few foreground boulders for depth
      for (let i = 0; i < N + 1; i++) {
        const x = i * stationStep + (r() - 0.5) * stationStep * 0.4;
        placeSprite(L, "boulders", x, H - 4, 150 + r() * 120, "land", { flip: r() > 0.5, alpha: 0.96 });
      }

      // roadrunners & lizards wander the foreground
      const groundCritters: AssetKey[] = ["roadrunner", "lizard", "roadrunner", "lizard"];
      const nWander = 5;
      for (let i = 0; i < nWander; i++) {
        const key = groundCritters[i % groundCritters.length];
        const sc = key === "lizard" ? 0.36 + r() * 0.14 : 0.42 + r() * 0.16;
        const baseY = H - 12 - r() * H * 0.14;
        const min = (i / nWander) * lw + 40;
        const max = ((i + 1) / nWander) * lw - 40;
        const x = min + (max - min) * r();
        const s = placeSprite(L, key, x, baseY, textures[key].width * sc, "ink", {
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
        const sc = 0.34 + r() * 0.12;
        const baseX = (i + 0.5) * (lw / 2) + (r() - 0.5) * 300;
        const baseY = H - 16 - r() * H * 0.1;
        const s = placeSprite(L, "jackrabbit", baseX, baseY, textures.jackrabbit.width * sc, "ink", {
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
      const sc = 0.5;
      const s = placeSprite(L, "bird", 0, 0, textures.bird.width * sc, "ink", {});
      s.anchor.set(0.5, 0.5);
      s.tint = mix(pal.ink, pal.skyTop, 0.25);
      bird = { s, x: -200, y0: H * (0.18 + Math.random() * 0.12), speed: 60 + Math.random() * 30, span: W + 400 };
    }

    // ---- TUMBLEWEED rolling across the foreground ----
    {
      const L = addLayer(1.0);
      const sc = 0.3;
      const s = placeSprite(L, "tumbleweed", -100, H - 30, textures.tumbleweed.width * sc, "plant", {});
      s.anchor.set(0.5, 0.5);
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
        g.circle(0, 0, 0.8 + r() * 1.6).fill({ color: pal.inkSoft, alpha: 0.1 + r() * 0.16 });
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
      bird.s.scale.y = (0.5) * (0.9 + Math.abs(Math.sin(time * 7)) * 0.2);
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
