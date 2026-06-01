import { useEffect, useRef } from "react";
import { mountWorldPixi } from "./engine-pixi";
import { Art } from "./art";
import { SITE } from "./content";
import "./wander.css";

/**
 * Experimental Pixi.js v8 (WebGL) render path for the wandering portfolio,
 * behind the `?pixi=1` flag and the `/wander-v2` debug route. It renders the
 * exact same DOM scaffold as the production `WanderWorld` (so `wander.css`, the
 * content panels, the UI chrome and the Customize screen all work unchanged),
 * but the desert scenery is painted by a transparent, full-screen Pixi
 * `Application` using real illustrated PNG assets over a programmatic
 * time-of-day sky — instead of layered procedural SVG.
 *
 * Input / momentum / snap / stations / panels are shared with the SVG path via
 * `worldCore`; the time-of-day palette + Customize slider are shared via main's
 * `palette.ts`, read back into Pixi tints by `pixiTint.ts`.
 *
 * The engine is async (Pixi v8's `Application.init()` + asset preload are
 * promises), so we guard teardown against an unmount that races init, and tear
 * the Pixi app + all listeners down fully on unmount.
 */
export default function PixiWanderWorld() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = `${SITE.name} — a wandering portfolio`;
    document.body.classList.add("wander-lock");
    const root = rootRef.current;

    let destroy: (() => void) | null = null;
    let cancelled = false;

    if (root) {
      mountWorldPixi(root, SITE, Art).then((d) => {
        if (cancelled) d();
        else destroy = d;
      });
    }

    return () => {
      cancelled = true;
      if (destroy) destroy();
      document.body.classList.remove("wander-lock");
    };
  }, []);

  return (
    <div className="wander" data-palette="sunset" ref={rootRef}>
      {/* shared filters: hand-drawn edge wobble for the DOM panels' styling.
          The Pixi canvas paints its own illustrated scenery. */}
      <svg className="wander-defs" aria-hidden="true" width="0" height="0">
        <defs>
          <filter id="wob" x="-6%" y="-6%" width="112%" height="112%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="wob2" x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.03" numOctaves="2" seed="19" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      <main id="stage" aria-label="An illustrated desert you can drag to explore">
        <div id="sky" />
        <div id="sunglow" />
        <div id="world" />
      </main>

      <div id="haze" />
      <div id="vignette" />
      <div id="grain" />

      <header className="ui wordmark">
        <p className="name" />
        <p className="tag" />
      </header>

      <div className="hint" aria-hidden="true">
        <span className="arrow">↔</span>
        <span className="lbl">Drag to explore</span>
      </div>

      <nav className="ui progress" aria-label="Stations" />

      <button className="ui menu-btn" aria-label="Open travel menu">···</button>
      <div className="sheet" role="menu" />

      {/* Customize: set the time of day (= the colors) */}
      <div className="customize" role="dialog" aria-label="Set the time of day">
        <div className="customize__card">
          <button className="customize__close" aria-label="Close">×</button>
          <p className="customize__eyebrow">Customize</p>
          <h2 className="customize__title">Time of day</h2>
          <p className="customize__time">—</p>
          <input
            className="customize__slider"
            type="range"
            min="0"
            max="1439"
            step="1"
            defaultValue="720"
            aria-label="Time of day"
          />
          <div className="customize__marks">
            <span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span>
          </div>
          <div className="customize__actions">
            <button className="customize__auto">Use my local time</button>
            <button className="customize__done">Done</button>
          </div>
          <p className="customize__colophon">
            Landscape inspired by the red-rock country around Sedona, Arizona.
          </p>
        </div>
      </div>
    </div>
  );
}
