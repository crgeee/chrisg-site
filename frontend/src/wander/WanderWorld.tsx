import { useEffect, useRef } from "react";
import { mountWorld } from "./engine";
import { Art } from "./art";
import { SITE } from "./content";
import "./wander.css";

/**
 * Full-screen "wandering portfolio" — a drag-to-explore illustrated desert
 * with five content stations. Renders the DOM scaffold and runs the vanilla
 * engine inside it, tearing the engine down on unmount.
 */
export default function WanderWorld() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = `${SITE.name} — a wandering portfolio`;
    document.body.classList.add("wander-lock");
    const root = rootRef.current;
    const destroy = root ? mountWorld(root, SITE, Art) : () => {};
    return () => {
      destroy();
      document.body.classList.remove("wander-lock");
    };
  }, []);

  return (
    <div className="wander" data-palette="sunset" ref={rootRef}>
      {/* shared filters: hand-drawn edge wobble for the landforms */}
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
        <span className="arrow r">→</span>
        <span className="lbl">Drag</span>
      </div>

      <nav className="ui progress" aria-label="Stations" />

      <button className="ui menu-btn" aria-label="Open travel menu">···</button>
      <div className="sheet" role="menu" />
    </div>
  );
}
