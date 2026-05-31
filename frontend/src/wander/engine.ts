/* eslint-disable */
// engine.ts — builds the world, runs the drag + parallax engine, wanders the
// creatures, and wires the UI. Ported from the Claude Design handoff (scene.js),
// illustrated-mode only, scoped to a root element, with full teardown.
import type { ArtKit } from "./art";
import type { SiteContent } from "./content";

export function mountWorld(root: HTMLElement, SITE: SiteContent, A: ArtKit): () => void {
  const stage = root.querySelector("#stage") as HTMLElement;
  const world = root.querySelector("#world") as HTMLElement;
  const grainEl = root.querySelector("#grain") as HTMLElement;

  let W = 0, H = 0, HZ = 0, stationStep = 0, maxScroll = 0;
  const Fc = 0.86;
  let panelFactor = Fc;
  const N = SITE.stations.length;

  let scroll = 0, vel = 0, target: number | null = null, dragging = false;
  let curX = 0, curXT = 0, curY = 0, curYT = 0;
  let interacted = false;
  let creatures: any[] = [];
  let panels: any[] = [];
  let dust: any[] = [];
  let layers: any[] = [];
  let raf = 0;
  const t0 = performance.now();

  const rnd = A.makeRng;
  const wrap = (x: number, y: number, s: number, inner: string) =>
    `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${(s || 1).toFixed(3)})">${inner}</g>`;

  function makeGrain() {
    const c = document.createElement("canvas");
    c.width = c.height = 150;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(150, 150);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 200 + Math.random() * 55;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = Math.random() * 26;
    }
    ctx.putImageData(img, 0, 0);
    grainEl.style.backgroundImage = `url(${c.toDataURL()})`;
    grainEl.style.backgroundSize = "150px 150px";
  }

  function makeLayer(cls: string, factor: number) {
    const el = document.createElement("div");
    el.className = "layer " + cls;
    const localW = Math.ceil(maxScroll * factor + W + 200);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", String(localW));
    svg.setAttribute("height", String(H));
    svg.setAttribute("viewBox", `0 0 ${localW} ${H}`);
    el.appendChild(svg);
    world.appendChild(el);
    const L: any = { el, svg, factor, localW };
    layers.push(L);
    return L;
  }

  function scatter(seed: number, count: number, xMin: number, xMax: number, build: (r: () => number, x: number, i: number) => string) {
    const r = rnd(seed);
    let s = "";
    for (let i = 0; i < count; i++) {
      const x = xMin + (xMax - xMin) * ((i + r() * 0.9) / count);
      s += build(r, x, i);
    }
    return s;
  }

  function buildIllustrated() {
    W = window.innerWidth; H = window.innerHeight;
    HZ = Math.round(H * 0.5);
    stationStep = Math.max(W * 1.12, 940);
    panelFactor = Fc;
    maxScroll = (N - 1) * stationStep;

    world.innerHTML = "";
    layers = []; creatures = []; panels = []; dust = [];

    const SVGNS = "http://www.w3.org/2000/svg";
    const topYAt = (tops: any[], x: number) => {
      if (!tops || !tops.length) return HZ;
      const n = tops.length - 1, span = tops[n][0] - tops[0][0];
      let t = ((x - tops[0][0]) / span) * n;
      t = Math.max(0, Math.min(n, t));
      const i = Math.floor(t), fr = t - i;
      return tops[i][1] + (tops[Math.min(n, i + 1)][1] - tops[i][1]) * fr;
    };

    /* CLOUDS */
    const Lcloud = makeLayer("depth-far", 0.12);
    Lcloud.svg.innerHTML = scatter(11, Math.max(6, Math.round(Lcloud.localW / 420)), 30, Lcloud.localW - 30, (r, x) => {
      const w = 150 + r() * 240;
      const y = H * (0.05 + r() * 0.28);
      return wrap(x, y, 1, A.cloud((x * 7 | 0) + 3, w));
    });

    /* SUN */
    const Lsun = makeLayer("", 0.07);
    {
      const R = Math.round(H * 0.07);
      const sx = W * 0.62;
      Lsun.svg.innerHTML = wrap(sx, HZ - R * 0.35, 1, A.sun(R));
    }

    /* FAR RIDGE */
    const Lfar = makeLayer("haze-far", 0.15);
    {
      const lm = A.landMass(23, Lfar.localW, HZ - H * 0.04, H * 0.09, H, { fill: "land-far", rough: 1.1, highlight: false });
      let s = lm.svg;
      const r = rnd(29);
      const nb = Math.max(3, Math.round(Lfar.localW / 700));
      for (let i = 0; i < nb; i++) {
        const x = Lfar.localW * ((i + r() * 0.7) / nb);
        const w = 200 + r() * 240, h = H * (0.14 + r() * 0.16);
        s += wrap(x - w / 2, topYAt(lm.tops, x) + 4 - h, 1, A.butte((x * 13 | 0) + 5, w, h));
      }
      for (let i = 0; i < Lfar.localW / 110; i++) {
        const x = r() * Lfar.localW;
        s += wrap(x, topYAt(lm.tops, x) + 2, 0.5 + r() * 0.3, A.pine((x * 3 | 0) + 7, 8 + r() * 8));
      }
      Lfar.svg.innerHTML = s;
    }

    /* MID HILLS */
    const Lmid = makeLayer("haze-mid", 0.28);
    {
      const lm = A.landMass(41, Lmid.localW, HZ + H * 0.03, H * 0.055, H, { fill: "land-mid", rough: 1.5 });
      let s = lm.svg;
      const r = rnd(43);
      for (let i = 0; i < Lmid.localW / 150; i++) {
        const x = r() * Lmid.localW;
        s += wrap(x, topYAt(lm.tops, x) + 3, 0.7 + r() * 0.5, A.pineCluster((x * 5 | 0) + 9, 2 + Math.floor(r() * 3)));
      }
      const nb = Math.max(1, Math.round(Lmid.localW / 1500));
      for (let i = 0; i < nb; i++) {
        const x = Lmid.localW * ((i + 0.3 + r() * 0.4) / nb);
        const w = 240 + r() * 220, h = H * (0.2 + r() * 0.16);
        s += wrap(x - w / 2, topYAt(lm.tops, x) + 4 - h, 1, A.butte((x * 17 | 0) + 11, w, h));
      }
      Lmid.svg.innerHTML = s;
    }

    /* HERO BUTTES */
    const Lhero = makeLayer("", 0.4);
    {
      let s = "";
      const r = rnd(59);
      const groundY = HZ + H * 0.06;
      for (let i = 0; i < N + 1; i++) {
        if (r() > 0.5) continue;
        const x = i * stationStep * 0.4 + (r() - 0.5) * stationStep * 0.3;
        const w = 330 + r() * 360, h = H * (0.32 + r() * 0.24);
        s += wrap(x, groundY - h, 1, A.butte((x * 19 | 0) + 13, w, h));
        if (r() > 0.6) s += wrap(x + w * 0.9, groundY - h * 0.46, 1, A.butte((x * 23 | 0) + 17, w * 0.42, h * 0.46));
      }
      Lhero.svg.innerHTML = s;
    }

    /* RIVER + BANKS + gathering */
    const Lriver = makeLayer("", 0.5);
    {
      const bank = A.landMass(67, Lriver.localW, HZ + H * 0.1, H * 0.03, H, { fill: "land-bank", rough: 1.3, highlight: false });
      let s = bank.svg;
      const riverY = HZ + H * 0.135;
      s += A.river(71, Lriver.localW, riverY, H * 0.022);
      const r = rnd(73);
      for (let i = 0; i < Lriver.localW / 120; i++) {
        const x = r() * Lriver.localW;
        const y = topYAt(bank.tops, x) + 2;
        if (r() > 0.5) s += wrap(x, y, 0.8 + r() * 0.5, A.pineCluster((x * 7 | 0) + 3, 1 + Math.floor(r() * 2)));
        else s += wrap(x, y, 0.7 + r() * 0.5, A.sage((x * 11 | 0) + 5));
      }
      Lriver.svg.innerHTML = s;
      const grp = document.createElementNS(SVGNS, "g");
      const gx = W * 0.5;
      let g = ""; const rr = rnd(77);
      for (let i = 0; i < 5; i++) g += wrap(gx - 20 + i * 9 + (rr() - 0.5) * 4, riverY - 4 + (rr() - 0.5) * 3, 0.55 + rr() * 0.2, A.creature(i + 1));
      grp.innerHTML = g;
      Lriver.svg.appendChild(grp);
    }

    /* NEAR GROUND */
    const Lng = makeLayer("", 0.62);
    {
      const lm = A.landMass(83, Lng.localW, HZ + H * 0.19, H * 0.025, H, { fill: "land-near", rough: 1.2 });
      Lng.svg.innerHTML = lm.svg;
    }

    /* MID SCATTER */
    const Lscat = makeLayer("", 0.76);
    {
      let s = "";
      const r = rnd(91);
      const count = Math.round(Lscat.localW / 118);
      for (let i = 0; i < count; i++) {
        const x = Lscat.localW * ((i + r() * 0.9) / count);
        const depth = r();
        const y = HZ + H * 0.2 + (H - HZ - H * 0.2) * (0.05 + depth * 0.45);
        const sc = 0.5 + depth * 0.6;
        const k = r();
        let piece;
        if (k < 0.34) piece = A.sage(i + 100);
        else if (k < 0.52) piece = A.grassTuft(i + 200);
        else if (k < 0.64) piece = A.pebble(i + 300);
        else if (k < 0.76) piece = A.spiralFern(i + 400);
        else if (k < 0.86) piece = A.cottonFlower(i + 450);
        else if (k < 0.94) piece = A.flowerStalk(i + 470);
        else piece = A.agave(i + 480);
        s += wrap(x, y, sc, piece);
      }
      Lscat.svg.innerHTML = s;
    }

    /* CONTENT PANELS */
    const Lcon = makeLayer("content", Fc);
    buildPanels(Lcon);

    /* NEAR FOREGROUND */
    const Lnear = makeLayer("", 1.0);
    {
      let s = "";
      const r = rnd(97);
      for (let i = 0; i < N + 1; i++) {
        const bx = i * stationStep + (r() - 0.5) * stationStep * 0.34;
        const w = 130 + r() * 160, h = 120 + r() * 150;
        s += wrap(bx, H - h * 0.62, 1, A.rock((bx * 29 | 0) + 17, w, h));
        if (r() > 0.4) s += wrap(bx + w * 0.3, H - h * 0.12, 1.1 + r() * 0.5, A.sage(i + 500));
        if (r() > 0.55) s += wrap(bx - 30 + r() * 60, H - 24 - r() * 30, 1 + r() * 0.6, A.cottonFlower(i + 560));
        if (r() > 0.6) s += wrap(bx + 40, H - h * 0.5, 1, A.pine((bx * 5 | 0) + 3, 60 + r() * 50));
      }
      const count = Math.round(Lnear.localW / 80);
      for (let i = 0; i < count; i++) {
        const x = Lnear.localW * ((i + r() * 0.95) / count);
        const depth = r();
        const y = H - 6 - depth * (H * 0.26);
        const sc = 0.8 + depth * 1.0;
        const k = r();
        let piece;
        if (k < 0.28) piece = A.sage(i + 700);
        else if (k < 0.48) piece = A.grassTuft(i + 800);
        else if (k < 0.6) piece = A.pebble(i + 900);
        else if (k < 0.72) piece = A.spiralFern(i + 1000);
        else if (k < 0.82) piece = A.cottonFlower(i + 1050);
        else if (k < 0.9) piece = A.flowerStalk(i + 1070);
        else if (k < 0.96) piece = A.agave(i + 1080);
        else piece = A.speck(i + 1100);
        s += wrap(x, y, sc, piece);
      }
      Lnear.svg.innerHTML = s;

      const wandererG = document.createElementNS(SVGNS, "g");
      Lnear.svg.appendChild(wandererG);
      for (let i = 0; i < 3; i++) {
        const g = document.createElementNS(SVGNS, "g");
        const baseX = (i + 0.5) * (Lnear.localW / 3) + (r() - 0.5) * 280;
        const baseY = H - 20 - r() * H * 0.2;
        const sc = 1 + r() * 0.6;
        g.innerHTML = A.creature(i + 30);
        wandererG.appendChild(g);
        creatures.push({ g, baseX, baseY, sc, range: 120 + r() * 160, speed: 0.05 + r() * 0.05, phase: r() * 6.28 });
      }
    }

    /* EXTRA NEAR */
    const Lvn = makeLayer("", 1.18);
    {
      let s = "";
      const r = rnd(103);
      const count = Math.round(Lvn.localW / 165);
      for (let i = 0; i < count; i++) {
        const x = Lvn.localW * ((i + r() * 0.9) / count);
        const y = H - 4 - r() * 22;
        const k = r();
        if (k < 0.55) s += wrap(x, y, 1.5 + r(), A.grassTuft(i + 1200));
        else if (k < 0.85) s += wrap(x, y, 1.3 + r() * 0.8, A.sage(i + 1300));
        else s += wrap(x, H - 4, 1.7 + r(), A.pebble(i + 1400));
      }
      Lvn.svg.innerHTML = s;
    }

    /* floating dust */
    const Ldust = makeLayer("", 0.55);
    {
      const r = rnd(109);
      let s = "";
      const arr: any[] = [];
      const count = Math.round(Ldust.localW / 110);
      for (let i = 0; i < count; i++) {
        const x = Ldust.localW * (i / count) + r() * 70;
        const y = H * (0.1 + r() * 0.5);
        s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.8 + r() * 1.6).toFixed(1)}" style="fill:var(--ink-soft)" opacity="${(0.1 + r() * 0.18).toFixed(2)}"/>`;
        arr.push({ x, y, amp: 6 + r() * 14, sp: 0.2 + r() * 0.5, ph: r() * 6.28 });
      }
      Ldust.svg.innerHTML = s;
      dust = arr.map((d, i) => ({ ...d, node: Ldust.svg.children[i] }));
    }

    render(true);
  }

  function buildPanels(L: any) {
    let html = "";
    SITE.stations.forEach((st, i) => {
      const Si = i * stationStep;
      const left = Si * panelFactor + W * 0.07;
      const top = H * (0.2 + (i % 2) * 0.06);
      const isIntro = i === 0;
      let links = "";
      if (st.links && st.links.length) {
        links = '<ul class="plinks">' + st.links.map((l) => {
          const inner = `<span class="lbl">${l.label}</span><span class="meta">${l.meta || ""}</span>`;
          if (!l.href) return `<li><div class="row">${inner}</div></li>`;
          const ext = /^https?:/.test(l.href) ? ' target="_blank" rel="noopener noreferrer"' : "";
          return `<li><a href="${l.href}"${ext}>${inner}</a></li>`;
        }).join("") + "</ul>";
      }
      const lead = isIntro ? `<blockquote class="lead"><em>${SITE.intro}</em></blockquote>` : "";
      html += `<div class="panel ${isIntro ? "about" : ""}" data-i="${i}" style="left:${left.toFixed(0)}px;top:${top.toFixed(0)}px;">
        ${lead}
        <p class="kicker">${st.kicker}</p>
        <h2 class="ptitle">${st.title}</h2>
        <p class="pbody">${st.body}</p>
        ${links}
      </div>`;
    });

    L.el.innerHTML = "";
    const holder = document.createElement("div");
    holder.style.cssText = "position:absolute;inset:0;";
    holder.innerHTML = html;
    L.el.appendChild(holder);
    panels = Array.from(holder.querySelectorAll(".panel")).map((el: any) => ({
      el, i: parseInt(el.dataset.i, 10),
    }));
  }

  function render(_force?: boolean) {
    for (const L of layers) {
      const x = -scroll * L.factor + curX * L.factor;
      const y = curY * L.factor * 0.4;
      L.el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`;
    }
    const near = stationStep * 0.46;
    for (const p of panels) {
      const Si = p.i * stationStep;
      p.el.classList.toggle("is-near", Math.abs(scroll - Si) < near);
    }
    const cur = Math.max(0, Math.min(N - 1, Math.round(scroll / stationStep)));
    root.querySelectorAll(".progress button").forEach((b, i) => {
      b.setAttribute("aria-current", i === cur ? "true" : "false");
    });
  }

  function tick(now: number) {
    const time = (now - t0) / 1000;
    if (!dragging) {
      if (target != null) {
        scroll += (target - scroll) * 0.1;
        vel = 0;
        if (Math.abs(target - scroll) < 0.5) { scroll = target; target = null; }
      } else if (Math.abs(vel) > 0.04) {
        scroll += vel; vel *= 0.93;
      }
    }
    if (scroll < 0) { scroll = 0; vel = 0; }
    if (scroll > maxScroll) { scroll = maxScroll; vel = 0; }

    curX += (curXT - curX) * 0.06;
    curY += (curYT - curY) * 0.06;

    for (const c of creatures) {
      const dx = Math.sin(time * c.speed + c.phase) * c.range;
      const flip = Math.cos(time * c.speed + c.phase) >= 0 ? 1 : -1;
      const bob = Math.sin(time * 2.4 + c.phase) * (c.bob || 1.4);
      c.g.setAttribute("transform", `translate(${(c.baseX + dx).toFixed(1)},${(c.baseY + bob).toFixed(1)}) scale(${(flip * c.sc).toFixed(3)},${c.sc.toFixed(3)})`);
    }
    for (const d of dust) {
      const dx = Math.sin(time * d.sp + d.ph) * d.amp;
      const dy = Math.cos(time * d.sp * 0.7 + d.ph) * d.amp * 0.6;
      d.node.setAttribute("cx", (d.x + dx).toFixed(1));
      d.node.setAttribute("cy", (d.y + dy).toFixed(1));
    }

    render();
    raf = requestAnimationFrame(tick);
  }

  // input
  let lastX = 0, lastT = 0;
  function down(e: any) {
    dragging = true; target = null; vel = 0;
    stage.classList.add("dragging");
    lastX = e.touches ? e.touches[0].clientX : e.clientX;
    lastT = performance.now();
    markInteract();
  }
  function move(e: any) {
    const mx = e.touches ? e.touches[0].clientX : e.clientX;
    const my = e.touches ? e.touches[0].clientY : e.clientY;
    if (!e.touches) {
      curXT = (mx / W - 0.5) * -34;
      curYT = (my / H - 0.5) * -18;
    }
    if (!dragging) return;
    const dx = mx - lastX;
    scroll -= dx;
    const nowT = performance.now();
    const dt = Math.max(1, nowT - lastT);
    vel = -dx / dt * 16;
    vel = Math.max(-60, Math.min(60, vel));
    lastX = mx; lastT = nowT;
    if (e.cancelable) e.preventDefault();
  }
  function up() { dragging = false; stage.classList.remove("dragging"); }

  function markInteract() {
    if (interacted) return;
    interacted = true;
    const hint = root.querySelector(".hint");
    if (hint) hint.classList.add("hide");
  }

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function goTo(i: number) {
    if (reduceMotion) return jumpTo(i);
    target = Math.max(0, Math.min(maxScroll, i * stationStep));
    vel = 0; markInteract();
  }
  function jumpTo(i: number) {
    scroll = Math.max(0, Math.min(maxScroll, i * stationStep));
    target = null; vel = 0; markInteract(); render();
  }

  function toggleSheet(force?: boolean) {
    const sheet = root.querySelector(".sheet")!;
    const open = force === undefined ? !sheet.classList.contains("open") : force;
    sheet.classList.toggle("open", open);
  }

  function buildUI() {
    (root.querySelector(".wordmark .name") as HTMLElement).textContent = SITE.name;
    (root.querySelector(".wordmark .tag") as HTMLElement).textContent = SITE.tagline;
    const prog = root.querySelector(".progress")!;
    prog.innerHTML = SITE.stations.map((st, i) =>
      `<button data-i="${i}" aria-current="${i === 0}"><span class="pl">${st.label}</span></button>`).join("");
    prog.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => goTo(+(b as HTMLElement).dataset.i!)));
    const sheet = root.querySelector(".sheet")!;
    sheet.innerHTML = '<div class="shead">Travel to</div>' + SITE.stations.map((st, i) =>
      `<button class="dest" data-i="${i}"><span>${st.label}</span><span class="n">${String(i + 1).padStart(2, "0")}</span></button>`).join("");
    sheet.querySelectorAll(".dest").forEach((b) => b.addEventListener("click", () => { goTo(+(b as HTMLElement).dataset.i!); toggleSheet(false); }));
    const mb = root.querySelector(".menu-btn") as HTMLElement;
    mb.addEventListener("click", (e) => { e.stopPropagation(); toggleSheet(); });
    docClick = (e: any) => { if (!sheet.contains(e.target) && e.target !== mb) toggleSheet(false); };
    document.addEventListener("click", docClick);
  }

  // window-level handlers (stored for teardown)
  let docClick: (e: any) => void = () => {};
  const onKey = (e: KeyboardEvent) => {
    const cur = Math.round(scroll / stationStep);
    if (e.key === "ArrowRight") goTo(Math.min(N - 1, cur + 1));
    if (e.key === "ArrowLeft") goTo(Math.max(0, cur - 1));
  };
  const onTilt = (e: any) => {
    if (e.gamma == null) return;
    curXT = Math.max(-1, Math.min(1, e.gamma / 30)) * -26;
    curYT = Math.max(-1, Math.min(1, (e.beta - 45) / 40)) * -12;
  };
  let rt: any;
  const onResize = () => {
    clearTimeout(rt);
    rt = setTimeout(() => { const ratio = maxScroll ? scroll / maxScroll : 0; buildIllustrated(); scroll = ratio * maxScroll; }, 180);
  };

  // init
  makeGrain();
  buildUI();
  buildIllustrated();
  stage.addEventListener("mousedown", down);
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
  stage.addEventListener("touchstart", down, { passive: true });
  window.addEventListener("touchmove", move, { passive: false });
  window.addEventListener("touchend", up);
  window.addEventListener("keydown", onKey);
  window.addEventListener("deviceorientation", onTilt);
  window.addEventListener("resize", onResize);
  raf = requestAnimationFrame(tick);

  // teardown
  return function destroy() {
    cancelAnimationFrame(raf);
    clearTimeout(rt);
    stage.removeEventListener("mousedown", down);
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
    stage.removeEventListener("touchstart", down);
    window.removeEventListener("touchmove", move);
    window.removeEventListener("touchend", up);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("deviceorientation", onTilt);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("click", docClick);
  };
}
