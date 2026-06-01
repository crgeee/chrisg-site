// engine-pixi.ts — experimental Pixi.js v8 (WebGL) render path for the
// wandering portfolio, behind the `?pixi=1` / `/wander-v2` flag.
//
// It reuses the render-agnostic controller in `worldCore.ts` for all input,
// momentum, snap-to-station, keyboard nav, the UI chrome and the HTML content
// panels (which stay DOM over the transparent canvas, exactly like the SVG
// engine). Only the scenery is redrawn here: a Pixi Graphics sky gradient plus
// parallax Containers — at the SAME depth factors as the SVG engine — holding
// the sun, far/mid ridges and buttes, a river, near-ground scatter, drifting
// dust and wandering creatures. Colours come from `palette.ts`, which reads the
// live `.wander` CSS custom properties so WebGL stays in sync with the panels.
//
// This is a first-cut parallax desert (Phase 1), not full visual parity with
// the SVG art — see PixiWanderWorld / the PR for the parity TODO list.

import { Application, Container, Graphics, FillGradient } from "pixi.js";
import type { SiteContent } from "./content";
import type { ArtKit } from "./art";
import { createWorldCore, type FrameState } from "./worldCore";
import { readPalette, mix, type Palette } from "./palette";

type Layer = { c: Container; factor: number };
type Creature = { g: Graphics; baseX: number; baseY: number; sc: number; range: number; speed: number; phase: number; bob: number };
type Dust = { g: Graphics; x: number; y: number; amp: number; sp: number; ph: number };

export async function mountWorldPixi(root: HTMLElement, SITE: SiteContent, A: ArtKit): Promise<() => void> {
  const stage = root.querySelector("#stage") as HTMLElement;
  const world = root.querySelector("#world") as HTMLElement;
  const core = createWorldCore(root, SITE);

  let pal: Palette = readPalette(root);

  // ---- Pixi application (transparent, full-screen) ----
  const app = new Application();
  await app.init({
    backgroundAlpha: 0,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    resizeTo: window,
    powerPreference: "high-performance",
  });

  let destroyed = false;
  if (destroyed) {
    app.destroy(true);
    return () => {};
  }

  const canvas = app.canvas as HTMLCanvasElement;
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  // Sit behind the DOM content layer (#world holds the panels) but above #sky.
  world.parentElement!.insertBefore(canvas, world);

  // The sky <div> gradient is redundant once Pixi paints one; hide it so the
  // WebGL sky shows through the transparent canvas cleanly.
  const skyDiv = root.querySelector("#sky") as HTMLElement | null;
  if (skyDiv) skyDiv.style.opacity = "0";

  // Panels live in a DOM holder inside #world (parallaxed by worldCore).
  world.innerHTML = "";
  const panelHolder = document.createElement("div");
  panelHolder.style.cssText = "position:absolute;inset:0;will-change:transform;pointer-events:none;";
  const panelLayer = document.createElement("div");
  panelLayer.className = "layer content";
  panelLayer.appendChild(panelHolder);
  world.appendChild(panelLayer);

  const rootStage = app.stage;
  let sky!: Graphics;
  let layers: Layer[] = [];
  let creatures: Creature[] = [];
  let dust: Dust[] = [];

  const rnd = A.makeRng;

  // tiny helpers ---------------------------------------------------------
  function addLayer(parent: Container, factor: number): Layer {
    const c = new Container();
    parent.addChild(c);
    const L = { c, factor };
    layers.push(L);
    return L;
  }

  // A rolling ridge silhouette built natively (echoes art.landMass tops).
  function ridge(g: Graphics, seed: number, w: number, baseY: number, amp: number, bottom: number, rough: number, color: number) {
    const r = rnd(seed);
    const seg = Math.max(6, Math.round(w / 150));
    const bigPhase = r() * 6.28;
    g.moveTo(0, bottom);
    const tops: number[] = [];
    for (let i = 0; i <= seg; i++) {
      const x = w * (i / seg);
      const big = Math.sin((i / seg) * Math.PI * (0.8 + rough) + bigPhase) * amp * 0.6;
      const detail = (r() - 0.5) * amp * 0.5;
      const y = baseY - big - detail;
      tops.push(y);
      g.lineTo(x, y);
    }
    g.lineTo(w, bottom);
    g.lineTo(0, bottom);
    g.fill({ color });
    return { seg, tops, w };
  }

  function topYAt(info: { seg: number; tops: number[]; w: number }, x: number) {
    const t = Math.max(0, Math.min(info.seg, (x / info.w) * info.seg));
    const i = Math.floor(t), fr = t - i;
    return info.tops[i] + (info.tops[Math.min(info.seg, i + 1)] - info.tops[i]) * fr;
  }

  // A stratified butte/mesa silhouette with a lit + shadow facet.
  function butte(parent: Container, seed: number, x: number, baseY: number, w: number, h: number, body: number, ink: number) {
    const r = rnd(seed);
    const g = new Graphics();
    const topY = baseY - h;
    const plL = x + w * 0.2, plR = x + w * 0.72;
    const plTop = topY + h * 0.05;
    // silhouette
    g.moveTo(x, baseY);
    g.lineTo(x + w * 0.04, topY + h * 0.34);
    g.lineTo(plL, plTop);
    g.lineTo(x + w * 0.5, topY + (r() - 0.5) * h * 0.06);
    g.lineTo(plR, plTop);
    g.lineTo(x + w * 0.96, topY + h * 0.34);
    g.lineTo(x + w, baseY);
    g.lineTo(x, baseY);
    g.fill({ color: body });
    // shadow facet (right side)
    g.moveTo(x + w * 0.5, plTop);
    g.lineTo(plR, plTop);
    g.lineTo(x + w * 0.96, topY + h * 0.34);
    g.lineTo(x + w, baseY);
    g.lineTo(x + w * 0.5, baseY);
    g.fill({ color: mix(body, ink, 0.22), alpha: 0.5 });
    // strata lines
    const nb = 5 + Math.floor(r() * 3);
    for (let i = 1; i < nb; i++) {
      const y = plTop + (baseY - plTop) * (i / nb);
      g.moveTo(x + w * 0.06, y);
      g.lineTo(x + w * 0.94, y + (r() - 0.5) * 5);
      g.stroke({ color: ink, alpha: 0.14, width: 1.2 });
    }
    // outline
    g.moveTo(x, baseY);
    g.lineTo(x + w * 0.04, topY + h * 0.34);
    g.lineTo(plL, plTop);
    g.lineTo(x + w * 0.5, topY + (r() - 0.5) * h * 0.06);
    g.lineTo(plR, plTop);
    g.lineTo(x + w * 0.96, topY + h * 0.34);
    g.lineTo(x + w, baseY);
    g.stroke({ color: ink, alpha: 0.85, width: 2.6, join: "round", cap: "round" });
    parent.addChild(g);
  }

  function pine(parent: Container, x: number, y: number, h: number, color: number, ink: number) {
    const g = new Graphics();
    g.moveTo(x, y);
    g.lineTo(x, y - h * 0.16);
    g.stroke({ color: mix(color, ink, 0.4), width: 2 });
    const w = h * 0.46;
    const nt = 3;
    for (let i = 0; i < nt; i++) {
      const ty = y - h * 0.1 - h * 0.86 * (i / nt);
      const tw = w * (1 - (i / nt) * 0.5);
      const th = (h * 0.92 / nt) * 1.7;
      g.moveTo(x - tw / 2, ty);
      g.lineTo(x, ty - th);
      g.lineTo(x + tw / 2, ty);
      g.lineTo(x - tw / 2, ty);
      g.fill({ color });
    }
    parent.addChild(g);
  }

  function sage(parent: Container, x: number, y: number, sc: number, seed: number, color: number) {
    const r = rnd(seed);
    const g = new Graphics();
    const n = 5 + Math.floor(r() * 5);
    const spread = (8 + r() * 8) * sc;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const rr = r() * spread;
      g.circle(x + Math.cos(a) * rr, y - Math.abs(Math.sin(a)) * rr * 0.7 - 3 * sc, (2.4 + r() * 3) * sc);
    }
    g.fill({ color, alpha: 0.82 });
    parent.addChild(g);
  }

  function rock(parent: Container, x: number, y: number, w: number, h: number, seed: number, color: number, ink: number) {
    const r = rnd(seed);
    const g = new Graphics();
    const sides = 6 + Math.floor(r() * 3);
    let first = true;
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const rr = 0.82 + (r() - 0.5) * 0.3;
      const px = x + Math.cos(a) * w * 0.5 * rr;
      let py = y - h + h * 0.5 + Math.sin(a) * h * 0.5 * rr;
      if (Math.sin(a) > 0.45) py = y - h * 0.05;
      if (first) { g.moveTo(px, py); first = false; } else g.lineTo(px, py);
    }
    g.fill({ color });
    g.stroke({ color: ink, alpha: 0.85, width: 2.4, join: "round" });
    parent.addChild(g);
  }

  // ---- build the full scene from current layout + palette ----
  function build() {
    rootStage.removeChildren();
    layers = [];
    creatures = [];
    dust = [];

    const { W, H, HZ, stationStep, maxScroll, N } = core.layout;

    // SKY — full-screen vertical gradient (sky-top → sky-bot → glow band).
    // Local texture space (0..1) so the gradient spans the rect's full height.
    sky = new Graphics();
    const grad = new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: pal.skyTop },
        { offset: 0.34, color: mix(pal.skyTop, pal.skyBot, 0.55) },
        { offset: 0.5, color: pal.skyBot },
        { offset: 0.58, color: mix(pal.skyBot, pal.glow, 0.5) },
        { offset: 0.62, color: mix(pal.skyBot, pal.landFar, 0.5) },
        { offset: 1, color: mix(pal.sand, pal.sandDeep, 0.5) },
      ],
    });
    sky.rect(0, 0, W, H).fill(grad);
    rootStage.addChild(sky);

    const localW = (factor: number) => Math.ceil(maxScroll * factor + W + 200);

    // CLOUDS (far)
    {
      const L = addLayer(rootStage, 0.12);
      const lw = localW(0.12);
      const r = rnd(11);
      const count = Math.max(6, Math.round(lw / 420));
      const g = new Graphics();
      for (let i = 0; i < count; i++) {
        const x = 30 + (lw - 60) * ((i + r() * 0.9) / count);
        const w = 150 + r() * 240;
        const y = H * (0.05 + r() * 0.28);
        g.ellipse(x + w * 0.5, y + w * 0.12, w * 0.5, w * 0.13);
      }
      g.fill({ color: pal.cloud, alpha: 0.85 });
      L.c.addChild(g);
    }

    // SUN
    {
      const L = addLayer(rootStage, 0.07);
      const R = Math.round(H * 0.07);
      const sx = W * 0.62, sy = HZ - R * 0.35;
      const g = new Graphics();
      g.circle(sx, sy, R * 2.5).fill({ color: pal.sun, alpha: 0.1 });
      g.circle(sx, sy, R * 1.65).fill({ color: pal.sun, alpha: 0.2 });
      g.circle(sx, sy, R).fill({ color: pal.sun });
      g.circle(sx, sy, R * 0.66).fill({ color: pal.sunCore });
      L.c.addChild(g);
    }

    // FAR RIDGE + buttes + pines
    {
      const L = addLayer(rootStage, 0.15);
      const lw = localW(0.15);
      const g = new Graphics();
      const far = mix(pal.landFar, pal.skyBot, 0.22);
      const info = ridge(g, 23, lw, HZ - H * 0.04, H * 0.09, H, 1.1, far);
      L.c.addChild(g);
      const r = rnd(29);
      const nb = Math.max(3, Math.round(lw / 700));
      for (let i = 0; i < nb; i++) {
        const x = lw * ((i + r() * 0.7) / nb);
        const w = 200 + r() * 240, h = H * (0.14 + r() * 0.16);
        butte(L.c, (x * 13 | 0) + 5, x - w / 2, topYAt(info, x) + 4, w, h, mix(pal.butte, pal.skyBot, 0.4), mix(pal.ink, pal.landFar, 0.6));
      }
      for (let i = 0; i < lw / 220; i++) {
        const x = r() * lw;
        pine(L.c, x, topYAt(info, x) + 2, 8 + r() * 8, mix(pal.pine, pal.landFar, 0.5), pal.ink);
      }
    }

    // MID HILLS
    {
      const L = addLayer(rootStage, 0.28);
      const lw = localW(0.28);
      const g = new Graphics();
      const info = ridge(g, 41, lw, HZ + H * 0.03, H * 0.055, H, 1.5, mix(pal.landMid, pal.skyBot, 0.1));
      L.c.addChild(g);
      const r = rnd(43);
      for (let i = 0; i < lw / 320; i++) {
        const x = r() * lw;
        pine(L.c, x, topYAt(info, x) + 3, 18 + r() * 22, mix(pal.pine, pal.landMid, 0.28), pal.ink);
      }
      const nb = Math.max(1, Math.round(lw / 1500));
      for (let i = 0; i < nb; i++) {
        const x = lw * ((i + 0.3 + r() * 0.4) / nb);
        const w = 240 + r() * 220, h = H * (0.2 + r() * 0.16);
        butte(L.c, (x * 17 | 0) + 11, x - w / 2, topYAt(info, x) + 4, w, h, mix(pal.butte, pal.skyBot, 0.22), pal.ink);
      }
    }

    // HERO BUTTES
    {
      const L = addLayer(rootStage, 0.4);
      const r = rnd(59);
      const groundY = HZ + H * 0.06;
      for (let i = 0; i < N + 1; i++) {
        if (r() > 0.5) continue;
        const x = i * stationStep * 0.4 + (r() - 0.5) * stationStep * 0.3;
        const w = 330 + r() * 360, h = H * (0.32 + r() * 0.24);
        butte(L.c, (x * 19 | 0) + 13, x, groundY, w, h, pal.butte, pal.ink);
      }
    }

    // RIVER + banks + a small gathering of creatures
    {
      const L = addLayer(rootStage, 0.5);
      const lw = localW(0.5);
      const g = new Graphics();
      const info = ridge(g, 67, lw, HZ + H * 0.1, H * 0.03, H, 1.3, pal.bank);
      L.c.addChild(g);
      const riverY = HZ + H * 0.135;
      const rg = new Graphics();
      const seg = Math.max(10, Math.round(lw / 110));
      const r = rnd(71);
      const ph = r() * 6.28;
      const top: number[] = [], bot: number[] = [];
      const width = H * 0.022;
      for (let i = 0; i <= seg; i++) {
        const mid = riverY + Math.sin((i / seg) * Math.PI * 3 + ph) * width * 0.9 + (r() - 0.5) * width * 0.3;
        const hw = width * (0.28 + Math.sin((i / seg) * Math.PI) * 0.85);
        top.push(mid - hw); bot.push(mid + hw);
      }
      rg.moveTo(0, top[0]);
      for (let i = 1; i <= seg; i++) rg.lineTo(lw * (i / seg), top[i]);
      for (let i = seg; i >= 0; i--) rg.lineTo(lw * (i / seg), bot[i]);
      rg.fill({ color: pal.river });
      rg.moveTo(0, top[0] + width * 0.18);
      for (let i = 1; i <= seg; i++) rg.lineTo(lw * (i / seg), top[i] + width * 0.18);
      rg.stroke({ color: pal.riverHi, alpha: 0.65, width: 2.2, cap: "round" });
      L.c.addChild(rg);
      // riverbank flora
      const rr = rnd(73);
      for (let i = 0; i < lw / 200; i++) {
        const x = rr() * lw;
        const y = topYAt(info, x) + 2;
        if (rr() > 0.5) pine(L.c, x, y, 14 + rr() * 16, mix(pal.pine, pal.bank, 0.3), pal.ink);
        else sage(L.c, x, y, 0.8 + rr() * 0.5, (x * 11 | 0) + 5, pal.sage);
      }
      // gathering of small creatures by the water
      const gr = rnd(77);
      const gx = W * 0.5;
      for (let i = 0; i < 5; i++) {
        const cg = makeCreature(pal.ink);
        cg.x = gx - 20 + i * 9 + (gr() - 0.5) * 4;
        cg.y = riverY - 4 + (gr() - 0.5) * 3;
        cg.scale.set(0.55 + gr() * 0.2);
        L.c.addChild(cg);
      }
    }

    // NEAR GROUND (sand)
    {
      const L = addLayer(rootStage, 0.62);
      const lw = localW(0.62);
      const g = new Graphics();
      ridge(g, 83, lw, HZ + H * 0.19, H * 0.025, H, 1.2, pal.sand);
      L.c.addChild(g);
    }

    // MID SCATTER (sage / plants / pebbles)
    {
      const L = addLayer(rootStage, 0.76);
      const lw = localW(0.76);
      const r = rnd(91);
      const count = Math.round(lw / 118);
      for (let i = 0; i < count; i++) {
        const x = lw * ((i + r() * 0.9) / count);
        const depth = r();
        const y = HZ + H * 0.2 + (H - HZ - H * 0.2) * (0.05 + depth * 0.45);
        const sc = 0.5 + depth * 0.6;
        const k = r();
        if (k < 0.5) sage(L.c, x, y, sc, i + 100, pal.sage);
        else scatterDot(L.c, x, y, sc, k < 0.75 ? pal.plant : pal.rock);
      }
    }

    // DUST (floating, animated)
    {
      const L = addLayer(rootStage, 0.55);
      const lw = localW(0.55);
      const r = rnd(109);
      const count = Math.round(lw / 110);
      for (let i = 0; i < count; i++) {
        const x = lw * (i / count) + r() * 70;
        const y = H * (0.1 + r() * 0.5);
        const g = new Graphics();
        g.circle(0, 0, 0.8 + r() * 1.6).fill({ color: pal.inkSoft, alpha: 0.1 + r() * 0.18 });
        g.x = x; g.y = y;
        L.c.addChild(g);
        dust.push({ g, x, y, amp: 6 + r() * 14, sp: 0.2 + r() * 0.5, ph: r() * 6.28 });
      }
    }

    // CONTENT PANELS (DOM) — z above the canvas, parallax handled by worldCore.
    core.buildPanels(panelHolder);

    // NEAR FOREGROUND — rocks, sage, pines, and the wandering creatures.
    {
      const L = addLayer(rootStage, 1.0);
      const lw = localW(1.0);
      const r = rnd(97);
      for (let i = 0; i < N + 1; i++) {
        const bx = i * stationStep + (r() - 0.5) * stationStep * 0.34;
        const w = 130 + r() * 160, h = 120 + r() * 150;
        rock(L.c, bx, H, w, h, (bx * 29 | 0) + 17, pal.rock, pal.ink);
        if (r() > 0.4) sage(L.c, bx + w * 0.3, H - 6, 1.1 + r() * 0.5, i + 500, pal.sage);
        if (r() > 0.6) pine(L.c, bx + 40, H - h * 0.2, 60 + r() * 50, pal.pine, pal.ink);
      }
      const count = Math.round(lw / 90);
      for (let i = 0; i < count; i++) {
        const x = lw * ((i + r() * 0.95) / count);
        const depth = r();
        const y = H - 6 - depth * (H * 0.26);
        const sc = 0.8 + depth * 1.0;
        if (r() < 0.5) sage(L.c, x, y, sc, i + 700, pal.sage);
        else scatterDot(L.c, x, y, sc, pal.plant);
      }
      // three wandering creatures
      for (let i = 0; i < 3; i++) {
        const g = makeCreature(pal.ink);
        const baseX = (i + 0.5) * (lw / 3) + (r() - 0.5) * 280;
        const baseY = H - 20 - r() * H * 0.2;
        const sc = 1 + r() * 0.6;
        L.c.addChild(g);
        creatures.push({ g, baseX, baseY, sc, range: 120 + r() * 160, speed: 0.05 + r() * 0.05, phase: r() * 6.28, bob: 1.4 });
      }
    }

    // EXTRA NEAR (very foreground grass/sage)
    {
      const L = addLayer(rootStage, 1.18);
      const lw = localW(1.18);
      const r = rnd(103);
      const count = Math.round(lw / 165);
      for (let i = 0; i < count; i++) {
        const x = lw * ((i + r() * 0.9) / count);
        const y = H - 4 - r() * 22;
        if (r() < 0.7) sage(L.c, x, y, 1.4 + r(), i + 1300, pal.sage);
        else scatterDot(L.c, x, H - 4, 1.7 + r(), pal.rock);
      }
    }
  }

  function scatterDot(parent: Container, x: number, y: number, sc: number, color: number) {
    const g = new Graphics();
    g.ellipse(x, y, 4 * sc, 2 * sc).fill({ color, alpha: 0.8 });
    parent.addChild(g);
  }

  // hooded-cloak wanderer (echoes art.creature)
  function makeCreature(ink: number): Graphics {
    const g = new Graphics();
    const w = 12, h = 28, hood = h * 0.22;
    g.ellipse(0, 2.4, w * 0.72, 2.4).fill({ color: ink, alpha: 0.14 });
    g.moveTo(-w * 0.62, 0);
    g.bezierCurveTo(-w * 0.72, -h * 0.46, -w * 0.36, -h * 0.78, -w * 0.16, -h + hood);
    g.bezierCurveTo(-w * 0.12, -h - 2, w * 0.12, -h - 2, w * 0.16, -h + hood);
    g.bezierCurveTo(w * 0.36, -h * 0.78, w * 0.72, -h * 0.46, w * 0.62, 0);
    g.lineTo(-w * 0.62, 0);
    g.fill({ color: ink });
    return g;
  }

  // ---- per-frame parallax + animation ----
  function render(state: FrameState) {
    for (const L of layers) {
      L.c.x = -state.scroll * L.factor + state.curX * L.factor;
      L.c.y = state.curY * L.factor * 0.4;
    }
    core.positionPanels(state);
    core.syncProgress(state.scroll);
  }

  function animate(state: FrameState) {
    const time = state.time;
    for (const c of creatures) {
      const dx = Math.sin(time * c.speed + c.phase) * c.range;
      const flip = Math.cos(time * c.speed + c.phase) >= 0 ? 1 : -1;
      const bob = Math.sin(time * 2.4 + c.phase) * c.bob;
      c.g.x = c.baseX + dx;
      c.g.y = c.baseY + bob;
      c.g.scale.set(flip * c.sc, c.sc);
    }
    for (const d of dust) {
      const dx = Math.sin(time * d.sp + d.ph) * d.amp;
      const dy = Math.cos(time * d.sp * 0.7 + d.ph) * d.amp * 0.6;
      d.g.x = d.x + dx;
      d.g.y = d.y + dy;
    }
  }

  // ---- ticker ----
  const onTick = () => {
    const state = core.step(performance.now());
    if (!core.reduceMotion) animate(state);
    render(state);
  };

  // ---- resize (debounced rebuild, preserving scroll ratio) ----
  let rt: ReturnType<typeof setTimeout> | undefined;
  const onResize = () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      const ratio = core.getScrollRatio();
      core.measure();
      pal = readPalette(root);
      build();
      core.setScrollRatio(ratio);
    }, 180);
  };

  // ---- init ----
  core.buildUI();
  build();
  const detachInput = core.bindInput(stage, onResize);
  app.ticker.add(onTick);

  // ---- teardown ----
  return function destroy() {
    destroyed = true;
    clearTimeout(rt);
    detachInput();
    app.ticker.remove(onTick);
    app.destroy(true, { children: true, texture: true });
    if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
    if (skyDiv) skyDiv.style.opacity = "";
  };
}
