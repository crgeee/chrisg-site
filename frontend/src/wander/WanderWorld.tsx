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
      <main id="stage" aria-label="An illustrated desert you can drag to explore">
        <div id="sky" />
        <div id="world" />
      </main>

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
