import { useEffect, useRef } from "react";
import { mountWorldPixi } from "./engine-pixi";
import { Art } from "./art";
import { SITE } from "./content";
import "./wander.css";

/**
 * Experimental Pixi.js v8 (WebGL) render path for the wandering portfolio,
 * behind the `?pixi=1` flag and the `/wander-v2` debug route. It renders the
 * exact same DOM scaffold as the production `WanderWorld` (so `wander.css`, the
 * content panels and the UI chrome work unchanged), but the desert scenery is
 * painted by a transparent, full-screen Pixi `Application` instead of layered
 * SVG. Input / momentum / snap / stations / panels / time-of-day palette are
 * shared with the SVG path via `worldCore` + `palette`.
 *
 * The engine is async (Pixi v8's `Application.init()` is a promise), so we guard
 * teardown against an unmount that races the init, and tear the Pixi app + all
 * listeners down fully on unmount.
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
      {/* shared filters: hand-drawn edge wobble for the landforms (used by the
          DOM panels' styling; the Pixi canvas paints its own scenery). */}
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
    </div>
  );
}
