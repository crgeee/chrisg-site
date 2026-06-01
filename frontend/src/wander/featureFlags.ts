// featureFlags.ts — opt-in switches for in-progress render paths.
//
// PIXI_WORLD turns on the experimental Pixi.js v8 (WebGL) rendering path for
// the wandering portfolio. It is OFF by default; the production homepage keeps
// using the SVG engine. Enable it with the `VITE_PIXI_WORLD=true` env var at
// build time, or per-visit with the `?pixi=1` query string.

export const PIXI_WORLD: boolean =
  import.meta.env.VITE_PIXI_WORLD === "true" ||
  (typeof window !== "undefined" && window.location.search.includes("pixi=1"));
