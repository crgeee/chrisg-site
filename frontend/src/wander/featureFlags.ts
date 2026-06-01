// featureFlags.ts — render-path switch for the wandering portfolio.
//
// PIXI_WORLD selects the Pixi.js v8 (WebGL) desert world. It is now ON by
// default — the Pixi world is the live homepage. Fall back to the older SVG
// engine per-visit with `?svg=1`, or disable it at build with
// `VITE_PIXI_WORLD=false`.

export const PIXI_WORLD: boolean =
  import.meta.env.VITE_PIXI_WORLD !== "false" &&
  !(typeof window !== "undefined" && window.location.search.includes("svg=1"));
