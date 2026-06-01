// worldCore.ts — render-agnostic controller for the wandering world.
//
// This is the non-visual half of the experience, factored out of `engine.ts`
// so the Pixi render path can reuse it verbatim: the drag/touch/momentum +
// snap-to-station physics, keyboard arrows, device-tilt parallax, the wordmark
// + progress dots + travel sheet UI, and the HTML content panels (which stay as
// DOM over the canvas in both engines) with their parallax positioning.
//
// The SVG engine (`engine.ts`) is intentionally left untouched; this module is
// a clean extraction that the new Pixi engine imports. A renderer plugs in by
// supplying an `onFrame` callback that receives the current scroll/parallax
// state each tick.

import type { SiteContent } from "./content";

export type Layout = {
  W: number;
  H: number;
  HZ: number;
  stationStep: number;
  maxScroll: number;
  panelFactor: number;
  N: number;
};

export type FrameState = {
  scroll: number;
  curX: number;
  curY: number;
  time: number;
};

type Panel = { el: HTMLElement; i: number };

export type WorldCore = {
  layout: Layout;
  /** Re-measure the viewport and recompute layout (call on resize). */
  measure: () => Layout;
  /** Current scroll as a 0..1 ratio of the world (for resize preservation). */
  getScrollRatio: () => number;
  /** Restore scroll from a 0..1 ratio. */
  setScrollRatio: (r: number) => void;
  /** Advance the physics one frame; returns the state a renderer needs. */
  step: (now: number) => FrameState;
  /** (Re)build the HTML content panels into the given holder element. */
  buildPanels: (holder: HTMLElement) => void;
  /** Position the panels for the current scroll (parallax + is-near). */
  positionPanels: (state: FrameState) => void;
  /** Build the wordmark + progress dots + travel sheet, wiring navigation. */
  buildUI: () => void;
  /** Sync the progress dots' aria-current to the nearest station. */
  syncProgress: (scroll: number) => void;
  goTo: (i: number) => void;
  /** Attach pointer/keyboard/resize listeners. Returns a detach fn. */
  bindInput: (stage: HTMLElement, onResize: () => void) => () => void;
  reduceMotion: boolean;
};

export function createWorldCore(root: HTMLElement, SITE: SiteContent): WorldCore {
  const N = SITE.stations.length;
  const Fc = 0.86; // content-panel parallax factor (matches the SVG engine)

  const layout: Layout = {
    W: 0,
    H: 0,
    HZ: 0,
    stationStep: 0,
    maxScroll: 0,
    panelFactor: Fc,
    N,
  };

  // physics state
  let scroll = 0;
  let vel = 0;
  let target: number | null = null;
  let dragging = false;
  let curX = 0, curXT = 0, curY = 0, curYT = 0;
  let interacted = false;
  const t0 = performance.now();

  let panels: Panel[] = [];

  const reduceMotion =
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function measure(): Layout {
    layout.W = window.innerWidth;
    layout.H = window.innerHeight;
    layout.HZ = Math.round(layout.H * 0.5);
    layout.stationStep = Math.max(layout.W * 1.12, 940);
    layout.maxScroll = (N - 1) * layout.stationStep;
    layout.panelFactor = Fc;
    return layout;
  }

  function getScrollRatio(): number {
    return layout.maxScroll ? scroll / layout.maxScroll : 0;
  }
  function setScrollRatio(r: number) {
    scroll = r * layout.maxScroll;
  }

  function step(now: number): FrameState {
    const time = (now - t0) / 1000;
    if (!dragging) {
      if (target != null) {
        scroll += (target - scroll) * 0.1;
        vel = 0;
        if (Math.abs(target - scroll) < 0.5) {
          scroll = target;
          target = null;
        }
      } else if (Math.abs(vel) > 0.04) {
        scroll += vel;
        vel *= 0.93;
      }
    }
    if (scroll < 0) { scroll = 0; vel = 0; }
    if (scroll > layout.maxScroll) { scroll = layout.maxScroll; vel = 0; }

    curX += (curXT - curX) * 0.06;
    curY += (curYT - curY) * 0.06;

    return { scroll, curX, curY, time };
  }

  // ---- content panels (DOM over the canvas) ----
  function buildPanels(holder: HTMLElement) {
    const { stationStep, W, H, panelFactor } = layout;
    let html = "";
    SITE.stations.forEach((st, i) => {
      const Si = i * stationStep;
      // On a WIDE screen, alternate the panel side through the stations (even =
      // left, odd = right) for a balanced composition. On a NARROW screen the
      // panel is ~86vw (it nearly fills the width), so there is no room to shift
      // it sideways — centre every panel instead, otherwise the right-side ones
      // run off-screen. 900px is the threshold where a side panel + open space fit.
      const wide = W >= 900;
      const onRight = wide && i % 2 === 1;
      // The rendered panel width mirrors the CSS: mobile (<=720px) caps at
      // min(86vw, 360px), otherwise min(78vw, 392px). Once the px cap kicks in,
      // a flat % margin no longer centres it — compute the EVEN margin from the
      // actual width. Only shift left/right when the screen is wide enough.
      const panelW = W <= 720 ? Math.min(0.86 * W, 360) : Math.min(0.78 * W, 392);
      const left = onRight
        ? Si * panelFactor + W * 0.52
        : wide
          ? Si * panelFactor + W * 0.06
          : Si * panelFactor + (W - panelW) / 2;
      const top = H * (0.19 + (i % 2) * (wide ? 0.05 : 0.03));
      const isIntro = i === 0;
      let links = "";
      if (st.links && st.links.length) {
        links =
          '<ul class="plinks">' +
          st.links
            .map((l) => {
              const inner = `<span class="lbl">${l.label}</span><span class="meta">${l.meta || ""}</span>`;
              if (!l.href) return `<li><div class="row">${inner}</div></li>`;
              const ext = /^https?:/.test(l.href) ? ' target="_blank" rel="noopener noreferrer"' : "";
              return `<li><a href="${l.href}"${ext}>${inner}</a></li>`;
            })
            .join("") +
          "</ul>";
      }
      const lead = isIntro
        ? `<blockquote class="lead"><em>${SITE.intro}</em></blockquote>`
        : "";
      html += `<div class="panel ${isIntro ? "about" : ""}" data-i="${i}" style="left:${left.toFixed(0)}px;top:${top.toFixed(0)}px;">
        ${lead}
        <p class="kicker">${st.kicker}</p>
        <h2 class="ptitle">${st.title}</h2>
        <p class="pbody">${st.body}</p>
        ${links}
      </div>`;
    });
    holder.innerHTML = html;
    panels = Array.from(holder.querySelectorAll<HTMLElement>(".panel")).map((el) => ({
      el,
      i: parseInt(el.dataset.i || "0", 10),
    }));
  }

  function positionPanels(state: FrameState) {
    const { stationStep, panelFactor } = layout;
    const near = stationStep * 0.46;
    const px = -state.scroll * panelFactor + state.curX * panelFactor;
    const py = state.curY * panelFactor * 0.4;
    for (const p of panels) {
      p.el.classList.toggle("is-near", Math.abs(state.scroll - p.i * stationStep) < near);
    }
    // The whole panel layer shares one transform (same as the SVG layer).
    const holder = panels[0]?.el.parentElement;
    if (holder) holder.style.transform = `translate3d(${px.toFixed(2)}px,${py.toFixed(2)}px,0)`;
  }

  function syncProgress(s: number) {
    const cur = Math.max(0, Math.min(N - 1, Math.round(s / layout.stationStep)));
    root.querySelectorAll(".progress button").forEach((b, i) => {
      b.setAttribute("aria-current", i === cur ? "true" : "false");
    });
  }

  // ---- navigation ----
  function markInteract() {
    if (interacted) return;
    interacted = true;
    root.querySelector(".hint")?.classList.add("hide");
  }
  function goTo(i: number) {
    if (reduceMotion) return jumpTo(i);
    target = Math.max(0, Math.min(layout.maxScroll, i * layout.stationStep));
    vel = 0;
    markInteract();
  }
  function jumpTo(i: number) {
    scroll = Math.max(0, Math.min(layout.maxScroll, i * layout.stationStep));
    target = null;
    vel = 0;
    markInteract();
  }

  function toggleSheet(force?: boolean) {
    const sheet = root.querySelector(".sheet");
    if (!sheet) return;
    const open = force === undefined ? !sheet.classList.contains("open") : force;
    sheet.classList.toggle("open", open);
  }

  let docClick: (e: MouseEvent) => void = () => {};
  function buildUI() {
    const nameEl = root.querySelector<HTMLElement>(".wordmark .name");
    const tagEl = root.querySelector<HTMLElement>(".wordmark .tag");
    if (nameEl) nameEl.textContent = SITE.name;
    if (tagEl) tagEl.textContent = SITE.tagline;

    const prog = root.querySelector(".progress");
    if (prog) {
      prog.innerHTML = SITE.stations
        .map(
          (st, i) =>
            `<button data-i="${i}" aria-current="${i === 0}"><span class="pl">${st.label}</span></button>`,
        )
        .join("");
      prog.querySelectorAll("button").forEach((b) =>
        b.addEventListener("click", () => goTo(+(b as HTMLElement).dataset.i!)),
      );
    }

    const sheet = root.querySelector(".sheet");
    const mb = root.querySelector<HTMLElement>(".menu-btn");
    if (sheet) {
      sheet.innerHTML =
        '<div class="shead">Travel to</div>' +
        SITE.stations
          .map(
            (st, i) =>
              `<button class="dest" data-i="${i}"><span>${st.label}</span><span class="n">${String(i + 1).padStart(2, "0")}</span></button>`,
          )
          .join("") +
        '<button class="dest sheet-customize"><span>Customize</span><span class="n">time of day</span></button>';
      sheet.querySelectorAll(".dest").forEach((b) =>
        b.addEventListener("click", () => {
          // the Customize entry opens the time-of-day dialog (wired by the
          // engine's setupCustomize via the `.sheet-customize` class), not a
          // station jump — so skip the goTo here.
          if (b.classList.contains("sheet-customize")) return;
          goTo(+(b as HTMLElement).dataset.i!);
          toggleSheet(false);
        }),
      );
    }
    if (mb && sheet) {
      // The menu button is a persistent scaffold element (it is NOT regenerated
      // like the progress dots / sheet innerHTML), so a remount — e.g. React
      // StrictMode's deliberate double-invoke in dev — would stack a SECOND
      // click listener on the same button. Two listeners → two toggleSheet()
      // calls per click → the sheet opens and instantly closes (a dead menu).
      // Replace the button with a clean clone so exactly one listener is ever
      // attached, and drop the previous mount's document handler before adding
      // ours so those don't accumulate either.
      const freshMb = mb.cloneNode(true) as HTMLElement;
      mb.replaceWith(freshMb);
      freshMb.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleSheet();
      });
      document.removeEventListener("click", docClick);
      docClick = (e: MouseEvent) => {
        if (!sheet.contains(e.target as Node) && e.target !== freshMb) toggleSheet(false);
      };
      document.addEventListener("click", docClick);
    }
  }

  // ---- input (drag / momentum / snap-to-station / keyboard / tilt) ----
  function bindInput(stage: HTMLElement, onResize: () => void): () => void {
    let lastX = 0, lastT = 0;

    const down = (e: MouseEvent | TouchEvent) => {
      dragging = true;
      target = null;
      vel = 0;
      stage.classList.add("dragging");
      lastX = "touches" in e ? e.touches[0].clientX : e.clientX;
      lastT = performance.now();
      markInteract();
    };
    const move = (e: MouseEvent | TouchEvent) => {
      const isTouch = "touches" in e;
      const mx = isTouch ? e.touches[0].clientX : e.clientX;
      const my = isTouch ? e.touches[0].clientY : e.clientY;
      if (!isTouch) {
        curXT = (mx / layout.W - 0.5) * -34;
        curYT = (my / layout.H - 0.5) * -18;
      }
      if (!dragging) return;
      const dx = mx - lastX;
      scroll -= dx;
      const nowT = performance.now();
      const dt = Math.max(1, nowT - lastT);
      vel = (-dx / dt) * 16;
      vel = Math.max(-60, Math.min(60, vel));
      lastX = mx;
      lastT = nowT;
      if (e.cancelable) e.preventDefault();
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove("dragging");
      // Snap to a station on release: a flick advances one; a slow drag rounds.
      const cur = scroll / layout.stationStep;
      let idx = Math.round(cur);
      if (vel > 4) idx = Math.floor(cur) + 1;
      else if (vel < -4) idx = Math.ceil(cur) - 1;
      goTo(Math.max(0, Math.min(N - 1, idx)));
    };
    const onKey = (e: KeyboardEvent) => {
      const cur = Math.round(scroll / layout.stationStep);
      if (e.key === "ArrowRight") goTo(Math.min(N - 1, cur + 1));
      if (e.key === "ArrowLeft") goTo(Math.max(0, cur - 1));
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      curXT = Math.max(-1, Math.min(1, e.gamma / 30)) * -26;
      curYT = Math.max(-1, Math.min(1, (e.beta - 45) / 40)) * -12;
    };

    stage.addEventListener("mousedown", down as EventListener);
    window.addEventListener("mousemove", move as EventListener);
    window.addEventListener("mouseup", up);
    stage.addEventListener("touchstart", down as EventListener, { passive: true });
    window.addEventListener("touchmove", move as EventListener, { passive: false });
    window.addEventListener("touchend", up);
    window.addEventListener("keydown", onKey);
    window.addEventListener("deviceorientation", onTilt);
    window.addEventListener("resize", onResize);

    return () => {
      stage.removeEventListener("mousedown", down as EventListener);
      window.removeEventListener("mousemove", move as EventListener);
      window.removeEventListener("mouseup", up);
      stage.removeEventListener("touchstart", down as EventListener);
      window.removeEventListener("touchmove", move as EventListener);
      window.removeEventListener("touchend", up);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("deviceorientation", onTilt);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("click", docClick);
    };
  }

  measure();
  return {
    layout,
    measure,
    getScrollRatio,
    setScrollRatio,
    step,
    buildPanels,
    positionPanels,
    buildUI,
    syncProgress,
    goTo,
    bindInput,
    reduceMotion,
  };
}
