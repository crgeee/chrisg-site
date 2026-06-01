// engine-pixi.ts — Pixi.js v8 (WebGL) "wide-world" render path for the
// wandering portfolio, behind the `?pixi=1` / `/wander-v2` flag.
//
// Unlike the SVG engine (which is procedural), this path paints REAL illustrated
// PNG assets (black-ink outline + light fill on transparent backgrounds, so
// `sprite.tint` recolours them cleanly) over a programmatic gradient sky.
//
// The scene is deliberately MINIMAL and SPACIOUS — a calm open desert with the
// occasional butte on the horizon, lots of negative space, clear front-to-back
// depth. Concretely:
//
//   • a Pixi Graphics SKY that cycles sunrise → day → golden → sunset → night,
//     with a sun that arcs across the sky by time of day and a moon at night;
//   • ONE faint hazy distant ridge (a couple of tiny pale formations near the
//     horizon, widely spaced), ONE prominent formation per station region at
//     clearly different sizes / haze / parallax speeds, and a FEW spaced plants —
//     never overlapping, never a row, with large empty stretches between them;
//   • soft translucent pale BUBBLES that drift slowly up and gently sideways,
//     fading in and out (the only lively motion), plus subtle plant sway.
//
// Atmospheric haze is done purely via sprite `tint` + `alpha` (no blur filters).
// Sprites are only re-tinted when the palette changes (the time-of-day callback),
// never per frame; the ticker only updates parallax, bubble drift and plant sway.
//
// It reuses the render-agnostic controller in `worldCore.ts` for input,
// momentum, snap-to-station, keyboard nav, the UI chrome and the HTML content
// panels (DOM over the transparent canvas, exactly like the SVG engine). Time of
// day is driven by main's `palette.ts`, read back as Pixi tints via `pixiTint.ts`.

import {
  Application,
  Assets,
  Container,
  Graphics,
  Particle,
  ParticleContainer,
  Sprite,
  Texture,
  FillGradient,
} from "pixi.js";
import type { SiteContent } from "./content";
import type { ArtKit } from "./art";
import { createWorldCore, type FrameState } from "./worldCore";
import { readPalette, mix, luma, type Palette } from "./pixiTint";
import { paletteAt, applyPalette, localHourNow } from "./palette";

// ---- asset manifest (copied + renamed into /wander-assets) -----------------
const BASE = "/wander-assets/";
// A small deck of iconic formations — one is chosen per station region, plus a
// couple of tiny pale ones on the far horizon. No critters, no clutter.
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
const PLANTS = ["saguaro", "agave", "cottongrass"] as const;
type FormationKey = (typeof FORMATIONS)[number];
type PlantKey = (typeof PLANTS)[number];
type AssetKey = FormationKey | PlantKey;
const ALL_KEYS: AssetKey[] = [...FORMATIONS, ...PLANTS];

type Layer = { c: Container; factor: number };

// A sprite that gets re-tinted only when the palette changes. `haze` (0..1) is
// the atmospheric-perspective amount — how far this instance's tint is blended
// toward the sky/horizon colour (farther = hazier). `band` drives which haze
// colour and how warm the base reads.
type Tintable = {
  s: Sprite;
  role: "formation" | "plant";
  haze: number;
  band: "far" | "mid" | "near";
};

// Plant that sways gently about its base.
type Swayer = { s: Sprite; amp: number; sp: number; ph: number; gust: number };

// A soft floating bubble (a Particle in a ParticleContainer). Each drifts slowly
// up and gently sideways, fading in and out, looping forever.
type Bubble = {
  p: Particle;
  x: number; // base x (sideways drift oscillates around this)
  y: number; // current y (rises)
  rise: number; // upward speed (px/s)
  driftAmp: number; // sideways drift amplitude
  driftSp: number; // sideways drift rate
  phase: number; // sideways + fade phase
  fadeSp: number; // fade in/out rate
  maxAlpha: number; // peak opacity for this bubble
  baseScale: number; // resting scale
};

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
  // resolution capped at 1 and NO preserveDrawingBuffer — both are big perf
  // wins; we never read the buffer back in production and 2x DPR doubles the
  // fill cost for a soft pastel scene that doesn't need it.
  const app = new Application();
  await app.init({
    backgroundAlpha: 0,
    antialias: !coarse,
    resolution: 1,
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

  // A single soft round bubble texture, generated once and reused by every
  // particle so bubbles cost (almost) nothing — one draw call for the lot.
  const bubbleTex = makeBubbleTexture();

  // scene state (rebuilt on resize)
  let skyG!: Graphics;
  let sunG!: Graphics;
  let moonG!: Graphics;
  let layers: Layer[] = [];
  let tintables: Tintable[] = [];
  let swayers: Swayer[] = [];
  let bubbles: Bubble[] = [];
  let bubbleLayer: ParticleContainer | null = null;
  let groundG: Graphics | null = null; // near sand band — re-tinted with the palette

  // ---- helpers -------------------------------------------------------------
  function addLayer(factor: number): Layer {
    const c = new Container();
    rootStage.addChild(c);
    const L = { c, factor };
    layers.push(L);
    return L;
  }

  // Build a small radial-soft circle texture for bubbles: a pale core fading to
  // transparent. Drawn once via concentric rings (cheap, no filters).
  function makeBubbleTexture(): Texture {
    const g = new Graphics();
    const R = 32;
    const rings = 14;
    for (let i = rings; i >= 1; i--) {
      const t = i / rings;
      // softer toward the edge; brighter, slightly tighter core
      g.circle(R, R, R * t).fill({ color: 0xffffff, alpha: 0.07 * (1 - t) + 0.02 });
    }
    g.circle(R, R, R * 0.34).fill({ color: 0xffffff, alpha: 0.16 });
    const tex = app.renderer.generateTexture(g);
    g.destroy();
    return tex;
  }

  // Place a tinted formation sprite scaled to a target on-screen HEIGHT and
  // anchored at its base-centre. `haze`/`band` feed the re-tint pass.
  function placeFormation(
    L: Layer,
    key: FormationKey,
    x: number,
    baseY: number,
    targetH: number,
    haze: number,
    band: "far" | "mid" | "near",
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
    tintables.push({ s, role: "formation", haze, band });
    return s;
  }

  // Place a plant scaled to a target on-screen WIDTH.
  function placePlant(
    L: Layer,
    key: PlantKey,
    x: number,
    baseY: number,
    targetW: number,
    opts: { flip?: boolean } = {},
  ): Sprite {
    const tex = textures[key];
    const s = new Sprite(tex);
    s.anchor.set(0.5, 0.97); // pivot near the base so sway looks rooted
    const scale = targetW / tex.width;
    s.scale.set((opts.flip ? -1 : 1) * scale, scale);
    s.x = x;
    s.y = baseY;
    L.c.addChild(s);
    tintables.push({ s, role: "plant", haze: 0, band: "near" });
    return s;
  }

  // The sun's normalised screen position for a given hour: it rises low in the
  // east (~6am), peaks at noon, and sets low in the west (~18–20h).
  function sunPos(h: number, W: number, H: number): { x: number; y: number; up: boolean } {
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
    return mix(mix(pal.skyBot, pal.glow, 0.35), pal.skyTop, 0.18);
  }
  // A cooler, paler far-haze for the deepest ridge (aerial perspective).
  function farHazeColor(): number {
    return mix(hazeColor(), pal.skyTop, 0.32);
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
      moonG.circle(R * 0.5, -R * 0.2, R * 0.92).fill({ color: pal.skyTop, alpha: 0.92 });
      moonG.x = mp.x;
      moonG.y = mp.y;
      moonG.visible = true;
    } else {
      moonG.visible = false;
    }
  }

  // The soft, pale dusty-rose a formation tints to at zero haze — desaturated
  // toward the sand so daytime stays GENTLE (pastel), not golden/orange.
  function formationBase(): number {
    return mix(mix(pal.landMid, pal.landFar, 0.52), pal.sand, 0.34);
  }

  // Re-tint formations/plants for the current palette. Formations apply
  // atmospheric perspective: each is blended from its base tint toward the haze
  // (sky) colour by its own `haze`. Called ONLY when the palette changes.
  function retint() {
    if (destroyed) return;
    const base = formationBase();
    const haze = hazeColor();
    const farHaze = farHazeColor();
    if (groundG) groundG.tint = mix(pal.sand, pal.sandDeep, 0.4);
    for (const t of tintables) {
      if (t.role === "formation") {
        let nudge = base;
        if (t.band === "near") nudge = mix(base, pal.hill, 0.22); // warmer hero rock
        else if (t.band === "far") nudge = mix(base, pal.landFar, 0.22); // cooler/paler
        const into = t.band === "far" ? farHaze : haze;
        t.s.tint = mix(nudge, into, t.haze);
      } else {
        t.s.tint = mix(pal.plant, pal.sage, 0.4);
      }
    }
    // bubbles read as the pale tuft/glow colour so they sit gently over the sky
    if (bubbleLayer) {
      const bt = mix(pal.tuft, pal.glow, 0.3);
      for (const b of bubbles) b.p.tint = bt;
    }
  }

  // ---- build the full scene from current layout + palette ------------------
  // Deliberately SPARSE: one far ridge of a couple of pale formations, one hero
  // formation per station region with big gaps between, a handful of plants, and
  // the bubble field. Lots of open sky and sand — nothing overlaps or stacks.
  function build() {
    if (skyDiv) skyDiv.style.opacity = "0";
    if (glowDiv) glowDiv.style.opacity = "0";
    rootStage.removeChildren();
    layers = [];
    tintables = [];
    swayers = [];
    bubbles = [];
    bubbleLayer = null;
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

    // ---- FAR RIDGE — one faint, hazy distant line: a couple of tiny pale
    // formations sat near the horizon, widely spaced, dissolving into the sky.
    // Haze done purely via tint+alpha (no blur). One per ~1.6 station widths.
    {
      const L = addLayer(0.1);
      const lw = localW(0.1);
      const r = rnd(31);
      const baseY = HZ + groundSpan * 0.02;
      const span = stationStep * 1.6;
      let idx = 0;
      for (let x = span * 0.5; x < lw; x += span * (0.85 + r() * 0.4)) {
        const key = FORMATIONS[Math.floor(r() * FORMATIONS.length)];
        const targetH = groundSpan * (0.16 + r() * 0.06);
        placeFormation(L, key, x + (r() - 0.5) * 80, baseY, targetH, 0.72 + r() * 0.1, "far", {
          alpha: 0.5 + r() * 0.1, flip: idx % 2 === 0,
        });
        idx++;
      }
    }

    // ---- HERO formations — ONE prominent butte per station region, at clearly
    // varied sizes, placed near each station with LARGE empty stretches between.
    // No two adjacent the same type; never overlapping.
    {
      const L = addLayer(0.42);
      const r = rnd(61);
      const groundY = HZ + groundSpan * 0.22;
      let prev = -1;
      for (let i = 0; i < N; i++) {
        let pick = Math.floor(r() * FORMATIONS.length);
        if (pick === prev) pick = (pick + 1) % FORMATIONS.length;
        prev = pick;
        // size varies a lot region-to-region so the horizon reads as a real,
        // uneven place rather than a row of equal buttes.
        const targetH = groundSpan * (0.4 + r() * 0.4);
        // nudge off the exact station centre, but keep well clear of neighbours
        const x = (i + 0.5) * stationStep + (r() - 0.5) * stationStep * 0.28;
        placeFormation(L, FORMATIONS[pick], x, groundY, targetH, 0.12 + r() * 0.1, "near", {
          alpha: 0.97, flip: r() > 0.5,
        });
      }
    }

    // ---- GROUND band (sand) — a soft tinted ridge under the foreground ----
    {
      const L = addLayer(0.5);
      const lw = localW(0.5);
      const g = new Graphics();
      const r = rnd(83);
      const seg = Math.max(8, Math.round(lw / 240));
      const baseY = HZ + groundSpan * 0.34;
      const amp = groundSpan * 0.035;
      g.moveTo(0, H);
      g.lineTo(0, baseY);
      for (let i = 0; i <= seg; i++) {
        const x = lw * (i / seg);
        const y = baseY - Math.sin((i / seg) * Math.PI * 2.0 + r() * 6) * amp - r() * amp * 0.4;
        g.lineTo(x, y);
      }
      g.lineTo(lw, H);
      g.lineTo(0, H);
      g.fill({ color: 0xffffff });
      g.tint = mix(pal.sand, pal.sandDeep, 0.4);
      L.c.addChild(g);
      groundG = g;
    }

    // ---- PLANTS — just a FEW, far apart (not a row). Roughly one every ~1.5
    // station widths, alternating type, gently swaying.
    {
      const L = addLayer(0.78);
      const lw = localW(0.78);
      const r = rnd(91);
      const span = stationStep * 1.5;
      let idx = 0;
      for (let x = span * 0.6; x < lw; x += span * (0.8 + r() * 0.5)) {
        const key = PLANTS[idx % PLANTS.length];
        const baseY = H - 10 - r() * groundSpan * 0.1;
        const w =
          key === "saguaro" ? 70 + r() * 40 : key === "agave" ? 90 + r() * 50 : 60 + r() * 36;
        const s = placePlant(L, key, x + (r() - 0.5) * 120, baseY, w, { flip: r() > 0.5 });
        swayers.push({
          s,
          amp: 0.012 + r() * 0.022,
          sp: 0.45 + r() * 0.6,
          ph: r() * 6.28,
          gust: 0.1 + r() * 0.15,
        });
        idx++;
      }
    }

    // ---- CONTENT PANELS (DOM) — above the canvas, parallaxed by worldCore ----
    core.buildPanels(panelHolder);

    // ---- FLOATING BUBBLES — soft pale motes drifting slowly UP and gently
    // sideways, fading in/out, looping forever. One reused texture in a single
    // ParticleContainer = one draw call for the whole field. This is the only
    // lively motion in the scene (besides parallax/sky and a little plant sway).
    if (!core.reduceMotion) {
      const L = addLayer(0.5); // gentle parallax — they live in mid-air
      const r = rnd(137);
      const count = coarse ? 26 : 42;
      const pc = new ParticleContainer({
        dynamicProperties: { position: true, color: true },
      });
      L.c.addChild(pc);
      bubbleLayer = pc;
      const bt = mix(pal.tuft, pal.glow, 0.3);
      const lw = localW(0.5);
      for (let i = 0; i < count; i++) {
        const baseScale = (4 + r() * 14) / 32; // bubble tex is 64px; target ~8–36px
        const x = lw * (i / count) + (r() - 0.5) * 120;
        const y = H * (0.2 + r() * 0.78);
        const maxAlpha = 0.1 + r() * 0.22;
        const p = new Particle({
          texture: bubbleTex,
          x,
          y,
          anchorX: 0.5,
          anchorY: 0.5,
          scaleX: baseScale,
          scaleY: baseScale,
          tint: bt,
          alpha: 0,
        });
        pc.addParticle(p);
        bubbles.push({
          p,
          x,
          y,
          rise: 6 + r() * 14,
          driftAmp: 8 + r() * 22,
          driftSp: 0.15 + r() * 0.35,
          phase: r() * 6.28,
          fadeSp: 0.18 + r() * 0.3,
          maxAlpha,
          baseScale,
        });
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

  function animate(state: FrameState, dt: number) {
    const time = state.time;

    // plants sway about their base — each at its own rate/phase, modulated by a
    // slow secondary "gust" beat so the field never pulses in unison.
    for (const sw of swayers) {
      const gust = 0.6 + 0.4 * Math.sin(time * sw.gust + sw.ph * 0.5);
      sw.s.rotation = Math.sin(time * sw.sp + sw.ph) * sw.amp * gust;
    }

    // floating bubbles: drift slowly up + gently sideways, fading in and out,
    // wrapping back to the bottom when they leave the top so the field loops.
    if (bubbleLayer) {
      const topLimit = -40;
      const H = core.layout.H;
      for (const b of bubbles) {
        b.y -= b.rise * dt;
        if (b.y < topLimit) {
          b.y = H + 20 + Math.random() * 40; // re-enter from below
          b.phase = Math.random() * 6.28;
        }
        b.p.x = b.x + Math.sin(time * b.driftSp + b.phase) * b.driftAmp;
        b.p.y = b.y;
        // soft sine fade in/out around the bubble's own peak opacity
        const f = 0.5 + 0.5 * Math.sin(time * b.fadeSp + b.phase);
        b.p.alpha = b.maxAlpha * f;
      }
      bubbleLayer.update();
    }
  }

  // ---- ticker --------------------------------------------------------------
  let lastNow = performance.now();
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
    bubbleTex.destroy();
    app.destroy(true, { children: true, texture: false });
    if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
    if (skyDiv) skyDiv.style.opacity = "";
    if (glowDiv) glowDiv.style.opacity = "";
  };
}
