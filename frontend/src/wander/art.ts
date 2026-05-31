// art.ts — naturalistic hand-drawn landscape generators (ported from the
// Claude Design handoff). Built from primitives + seeded jitter; colors
// reference CSS vars. Returns SVG-markup strings.

type Pt = [number, number];
type LandOpts = { fill?: string; rough?: number; highlight?: boolean };

function makeRng(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f1 = (n: number) => Math.round(n * 10) / 10;
let UID = 0;

// smooth path through top points (quadratic midpoint smoothing)
function smoothTop(pts: Pt[]): string {
  let d = `L ${f1(pts[0][0])},${f1(pts[0][1])} `;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += `Q ${f1(pts[i][0])},${f1(pts[i][1])} ${f1(mx)},${f1(my)} `;
  }
  const n = pts.length - 1;
  d += `L ${f1(pts[n][0])},${f1(pts[n][1])} `;
  return d;
}

// --- LAND MASS (rolling ground / ridge) ---
function landMass(seed: number, w: number, baseY: number, amp: number, bottom: number, opts?: LandOpts): { svg: string; tops: Pt[] } {
  opts = opts || {};
  const r = makeRng(seed);
  const seg = Math.max(6, Math.round(w / 150));
  const pts: Pt[] = [];
  const bigPhase = r() * 6.28;
  for (let i = 0; i <= seg; i++) {
    const x = w * (i / seg);
    const big = Math.sin((i / seg) * Math.PI * (0.8 + (opts.rough || 1.4)) + bigPhase) * amp * 0.6;
    const detail = (r() - 0.5) * amp * 0.5;
    pts.push([x, baseY - big - detail]);
  }
  const fillCls = opts.fill || "land-mid";
  const d = `M 0,${f1(bottom)} ` + smoothTop(pts) + `L ${f1(w)},${f1(bottom)} Z`;
  let topD = `M ${f1(pts[0][0])},${f1(pts[0][1])} `;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    topD += `Q ${f1(pts[i][0])},${f1(pts[i][1])} ${f1(mx)},${f1(my)} `;
  }
  const hi = opts.highlight === false ? "" : `<path class="land-hi" d="${topD}"/>`;
  return { svg: `<g class="land"><path class="${fillCls}" d="${d}"/>${hi}</g>`, tops: pts };
}

// --- STRATIFIED BUTTE / MESA ---
function butteBlock(seed: number, w: number, h: number, x0: number, y0: number) {
  const r = makeRng(seed);
  const topY = y0 + h * (0.03 + r() * 0.05);
  const cliffBot = y0 + h * (0.6 + r() * 0.12);
  const plCenter = x0 + w * (0.36 + r() * 0.28);
  const plHalf = w * (0.16 + r() * 0.26);
  const plL = plCenter - plHalf, plR = plCenter + plHalf;
  const baseL = x0 + w * (0.02 + r() * 0.07);
  const baseR = x0 + w * (0.93 - r() * 0.07);
  const tiltD = (r() - 0.5) * h * 0.07;
  const ledgeYL = topY + (cliffBot - topY) * (0.36 + r() * 0.22);
  const ledgeYR = topY + (cliffBot - topY) * (0.36 + r() * 0.22);
  const sil = "M " + ([
    [baseL, cliffBot],
    [plL - w * 0.012, ledgeYL + h * 0.016],
    [plL + w * 0.016, ledgeYL - h * 0.01],
    [plL, topY + tiltD + h * 0.03],
    [plL, topY + tiltD],
    [plCenter, topY + tiltD * 0.4 - r() * h * 0.02],
    [plR, topY - tiltD],
    [plR, topY - tiltD + h * 0.045],
    [plR + w * 0.014, ledgeYR - h * 0.012],
    [plR - w * 0.008, ledgeYR + h * 0.018],
    [baseR, cliffBot],
  ] as Pt[]).map((p) => f1(p[0]) + "," + f1(p[1])).join(" L ") + " Z";

  let strata = "";
  const nb = 6 + Math.floor(r() * 4);
  for (let i = 0; i < nb; i++) {
    const y = topY + h * 0.04 + ((cliffBot - topY) * 0.92) * (i / nb);
    const th = ((cliffBot - topY) / nb) * (0.4 + r() * 0.18);
    const dip = (r() - 0.4) * h * 0.05;
    strata += `<path class="${i % 2 ? "strata-l" : "strata-d"}" d="M ${f1(x0 - w * 0.05)},${f1(y)} L ${f1(x0 + w * 1.05)},${f1(y + dip)} L ${f1(x0 + w * 1.05)},${f1(y + dip + th)} L ${f1(x0 - w * 0.05)},${f1(y + th)} Z"/>`;
    if (i % 2 === 0) strata += `<path class="strata-line" d="M ${f1(plL - w * 0.04)},${f1(y)} L ${f1(plR + w * 0.04)},${f1(y + dip)}"/>`;
  }
  const splitX = plCenter + plHalf * (0.1 + r() * 0.2);
  const shadow = `<path class="butte-sh" d="M ${f1(splitX)},${f1(topY)} L ${f1(plR)},${f1(topY - tiltD)} L ${f1(baseR)},${f1(cliffBot)} L ${f1(splitX)},${f1(cliffBot)} Z"/>`;
  let gully = "";
  const ng = 3 + Math.floor(r() * 3);
  for (let i = 0; i < ng; i++) {
    const gx = x0 + w * (0.2 + (i / ng) * 0.6 + (r() - 0.5) * 0.08);
    gully += `<path class="butte-gully" d="M ${f1(gx)},${f1(topY + h * 0.08)} q ${f1((r() - 0.5) * 8)},${f1(h * 0.3)} ${f1((r() - 0.5) * 6)},${f1((cliffBot - topY) * 0.92)}"/>`;
  }
  return { sil, strata, shadow, gully, cliffBot, plL, plR, topY };
}

function butte(seed: number, w: number, h: number): string {
  const r = makeRng(seed);
  const id = "cp" + (UID++);
  const lower = butteBlock(seed, w, h, 0, h * 0.0);
  const tBot = h;
  const talus = `<path class="talus" d="M ${f1(-w * 0.06)},${f1(tBot)} Q ${f1(w * 0.5)},${f1(lower.cliffBot - h * 0.04)} ${f1(w * 1.06)},${f1(tBot)} Z"/>`;

  let upper = "", upperOutline = "", upClip = "";
  if (r() > 0.45) {
    const uw = w * (0.42 + r() * 0.16);
    const ux = w * (0.22 + r() * 0.18);
    const uh = h * (0.34 + r() * 0.14);
    const ub = butteBlock(seed * 3 + 1, uw, uh, ux, lower.topY - uh * 0.62);
    const uid = "cu" + (UID++);
    upper = `<path class="fill-butte" d="${ub.sil}"/>
      <g clip-path="url(#${uid})">${ub.strata}${ub.shadow}${ub.gully}</g>`;
    upClip = `<clipPath id="${uid}"><path d="${ub.sil}"/></clipPath>`;
    upperOutline = `<path class="butte-outline" d="${ub.sil}"/>`;
  }

  return `<g class="butte">
    ${talus}
    <defs><clipPath id="${id}"><path d="${lower.sil}"/></clipPath>${upClip}</defs>
    <path class="fill-butte" d="${lower.sil}"/>
    <g clip-path="url(#${id})">${lower.strata}${lower.shadow}${lower.gully}</g>
    <path class="butte-outline" d="${lower.sil}"/>
    ${upper}
    ${upperOutline}
  </g>`;
}

// --- BOULDER ---
function rock(seed: number, w: number, h: number): string {
  const r = makeRng(seed);
  const id = "rk" + (UID++);
  const sides = 6 + Math.floor(r() * 3);
  const pts: Pt[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const rr = 0.82 + (r() - 0.5) * 0.3;
    const x = w * 0.5 + Math.cos(a) * w * 0.5 * rr;
    let y = h * 0.5 + Math.sin(a) * h * 0.5 * rr;
    if (Math.sin(a) > 0.45) y = h * (0.93 + r() * 0.07);
    pts.push([x, y]);
  }
  const sil = "M " + pts.map((p) => f1(p[0]) + "," + f1(p[1])).join(" L ") + " Z";
  const shadow = `<path class="butte-sh" d="M ${f1(w * 0.52)},${f1(h * 0.14)} L ${f1(w * (0.8 + r() * 0.1))},${f1(h * 0.5)} L ${f1(w * 0.76)},${f1(h * 0.95)} L ${f1(w * 0.5)},${f1(h * 0.95)} Z"/>`;
  let strata = "";
  if (r() > 0.4) {
    for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
      const y = h * (0.4 + i * 0.18);
      strata += `<path class="strata-d" d="M ${f1(w * 0.1)},${f1(y)} L ${f1(w * 0.9)},${f1(y + (r() - 0.5) * 6)} L ${f1(w * 0.9)},${f1(y + 3)} L ${f1(w * 0.1)},${f1(y + 3)} Z"/>`;
    }
  }
  return `<g class="rock">
    <defs><clipPath id="${id}"><path d="${sil}"/></clipPath></defs>
    <path class="fill-rock" d="${sil}"/>
    <g clip-path="url(#${id})">${shadow}${strata}</g>
    <path class="butte-outline" d="${sil}"/>
  </g>`;
}

// --- RIVER ---
function river(seed: number, w: number, y: number, width: number): string {
  const r = makeRng(seed);
  const seg = Math.max(10, Math.round(w / 110));
  const top: Pt[] = [], bot: Pt[] = [];
  const ph = r() * 6.28;
  for (let i = 0; i <= seg; i++) {
    const x = w * (i / seg);
    const mid = y + Math.sin((i / seg) * Math.PI * 3 + ph) * width * 0.9 + (r() - 0.5) * width * 0.3;
    const hw = width * (0.28 + Math.sin((i / seg) * Math.PI) * 0.85);
    top.push([x, mid - hw]);
    bot.push([x, mid + hw]);
  }
  let d = "M " + top.map((p) => f1(p[0]) + "," + f1(p[1])).join(" L ");
  for (let i = bot.length - 1; i >= 0; i--) d += " L " + f1(bot[i][0]) + "," + f1(bot[i][1]);
  d += " Z";
  const hl = "M " + top.map((p) => f1(p[0]) + "," + f1(p[1] + width * 0.18)).join(" L ");
  let ripples = "";
  for (let i = 0; i < seg; i += 2) {
    const p = top[i];
    ripples += `<path class="ripple" d="M ${f1(p[0] - 6)},${f1(p[1] + width * 0.6)} q 6,-2 12,0"/>`;
  }
  return `<g class="river"><path class="river-fill" d="${d}"/><path class="river-hl" d="${hl}"/>${ripples}</g>`;
}

// --- SUN ---
function sun(rad: number): string {
  return `<g class="sun"><circle class="sun-halo" cx="0" cy="0" r="${f1(rad * 1.7)}"/><circle class="fill-sun" cx="0" cy="0" r="${f1(rad)}"/></g>`;
}

// --- CLOUDS ---
function cloud(seed: number, w: number): string {
  const r = makeRng(seed);
  const h = w * (0.2 + r() * 0.12);
  const j = () => (r() - 0.5);
  const d = `M 0,${f1(h)}
    C ${f1(w * (0.06 + j() * 0.04))},${f1(h * 0.45)} ${f1(w * 0.18)},${f1(h * (0.12 + r() * 0.1))} ${f1(w * 0.36)},${f1(h * (0.2 + r() * 0.1))}
    C ${f1(w * 0.46)},${f1(h * (0.24 + r() * 0.08))} ${f1(w * 0.52)},${f1(-h * 0.05 + r() * h * 0.1)} ${f1(w * 0.68)},${f1(h * (0.14 + r() * 0.1))}
    C ${f1(w * 0.82)},${f1(h * (0.22 + r() * 0.1))} ${f1(w * 0.92)},${f1(h * 0.4)} ${f1(w)},${f1(h)} Z`;
  return `<g class="cloud"><path class="fill-cloud" d="${d}"/></g>`;
}

// --- PINE / CONIFER ---
function pine(seed: number, h: number): string {
  const r = makeRng(seed);
  const w = h * (0.42 + r() * 0.12);
  let tiers = "";
  const nt = 3 + Math.floor(r() * 2);
  const trunk = `<path class="pine-trunk" d="M 0,0 L 0,${f1(-h * 0.14)}"/>`;
  for (let i = 0; i < nt; i++) {
    const ty = -h * 0.1 - (h * 0.86) * (i / nt);
    const tw = w * (1 - (i / nt) * 0.5);
    const th = (h * 0.92 / nt) * 1.7;
    const lean = (r() - 0.5) * tw * 0.12;
    tiers += `<path class="pine-body" d="M ${f1(-tw / 2)},${f1(ty)} L ${f1(lean)},${f1(ty - th)} L ${f1(tw / 2)},${f1(ty)} Z"/>`;
  }
  return `<g class="pine">${trunk}${tiers}</g>`;
}

function pineCluster(seed: number, n: number): string {
  const r = makeRng(seed);
  let s = '<g class="pinecluster">';
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * (8 + r() * 8) + (r() - 0.5) * 6;
    const h = 22 + r() * 26;
    s += `<g transform="translate(${f1(x)},${f1((r() - 0.5) * 3)}) scale(1)">${pine((seed * 31 + i) | 0, h)}</g>`;
  }
  return s + "</g>";
}

// --- SAGEBRUSH ---
function sage(seed: number): string {
  const r = makeRng(seed);
  const n = 6 + Math.floor(r() * 6);
  let s = '<g class="sage">';
  const spread = 8 + r() * 10;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const rr = r() * spread;
    const x = Math.cos(a) * rr;
    const y = -Math.abs(Math.sin(a)) * rr * 0.7 - 3;
    s += `<circle class="sage-d" cx="${f1(x)}" cy="${f1(y)}" r="${f1(2.6 + r() * 3.4)}"/>`;
  }
  s += `<path class="sage-stem" d="M ${f1(-spread * 0.3)},0 l 1,-7 M 1,0 l -1,-9 M ${f1(spread * 0.3)},0 l 0,-6"/></g>`;
  return s;
}

// --- SMALL PLANTS ---
function cottonFlower(seed: number): string {
  const r = makeRng(seed);
  const n = 3 + Math.floor(r() * 3);
  let s = '<g class="cotton">';
  for (let i = 0; i < n; i++) {
    const bx = (i - (n - 1) / 2) * (4 + r() * 3);
    const top = -10 - r() * 12;
    const sway = (r() - 0.5) * 7;
    s += `<path class="stem-green" d="M ${f1(bx)},0 q ${f1(sway)},${f1(top * 0.5)} ${f1(sway * 0.7)},${f1(top)}"/>`;
    s += `<circle class="fill-tuft" cx="${f1(bx + sway * 0.7)}" cy="${f1(top)}" r="${f1(2 + r() * 1.6)}"/>`;
  }
  s += `<path class="grass" d="M ${f1(-n)},0 q -4,-4 -7,-3 M ${f1(n)},0 q 4,-4 7,-3"/>`;
  return s + "</g>";
}

function spiralFern(seed: number): string {
  const r = makeRng(seed);
  const dir = r() > 0.5 ? 1 : -1;
  const H = 22 + r() * 12;
  const d = `M 0,0 C ${f1(dir * 4)},${f1(-H * 0.5)} ${f1(dir * 2)},${f1(-H * 0.8)} ${f1(dir * 6)},${f1(-H)} `;
  const cx = dir * 6, cy = -H;
  let coil = "";
  const turns = 1.5, steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * turns * Math.PI * 2;
    const rr = 1 + t * 0.8;
    coil += (i ? "L " : "M ") + f1(cx + Math.cos(t) * rr * dir) + "," + f1(cy + Math.sin(t) * rr) + " ";
  }
  return `<g class="fern"><path class="stem-green" d="${d}"/><path class="stem-green" d="${coil}"/></g>`;
}

function grassTuft(seed: number): string {
  const r = makeRng(seed);
  const n = 4 + Math.floor(r() * 4);
  let d = "";
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 3;
    const h = 9 + r() * 12;
    d += `M ${f1(x)},0 q ${f1((r() - 0.5) * 7)},${f1(-h * 0.6)} ${f1((r() - 0.5) * 10)},${f1(-h)} `;
  }
  return `<g class="grasstuft"><path class="grass" d="${d}"/></g>`;
}

function pebble(seed: number): string {
  const r = makeRng(seed);
  const w = 4 + r() * 8;
  return `<g class="pebble"><ellipse class="fill-rock" cx="0" cy="0" rx="${f1(w)}" ry="${f1(w * 0.5)}"/></g>`;
}

function speck(seed: number): string {
  const r = makeRng(seed);
  return `<path class="speck" d="M 0,0 l ${f1((r() - 0.5) * 3)},${f1(3 + r() * 5)}"/>`;
}

// --- CREATURE (cloaked wanderer) ---
function creature(seed: number): string {
  const r = makeRng(seed);
  const w = 10 + r() * 3, h = 24 + r() * 6;
  const d = `M 0,0
    C ${f1(-w * 0.5)},${f1(-h * 0.2)} ${f1(-w * 0.62)},${f1(-h * 0.72)} 0,${f1(-h)}
    C ${f1(w * 0.62)},${f1(-h * 0.72)} ${f1(w * 0.5)},${f1(-h * 0.2)} 0,0 Z`;
  return `<g class="creature"><path class="fill-ink" d="${d}"/></g>`;
}

export const Art = {
  makeRng, landMass, butte, rock, river, sun, cloud,
  pine, pineCluster, sage, cottonFlower, spiralFern, grassTuft, pebble, speck, creature,
};

export type ArtKit = typeof Art;
