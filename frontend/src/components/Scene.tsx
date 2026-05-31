import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useParallax } from "../hooks/useParallax";
import "./Scene.css";

type SceneProps = {
  narration?: string;
  children?: ReactNode;
};

/** Small ink "pebble" marks scattered across the sand (deterministic spread). */
const SPECKLES = Array.from({ length: 52 }, (_, i) => {
  const x = (i * 211) % 1600;
  const y = 545 + ((i * 97) % 320);
  const r = 0.8 + (i % 3) * 0.8;
  const o = 0.12 + ((i * 7) % 5) * 0.04;
  return { x, y: Math.min(y, 884), r, o };
});

/** A stylized cloud — lumpy top, flat base, faint ink edge + cream highlight. */
function Cloud({ x, y, s, o }: { x: number; y: number; s: number; o: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>
      <path
        d="M0 34 Q1 13 24 16 Q32 1 54 9 Q70 -6 90 7 Q114 -4 130 13 Q150 9 150 29 Q150 40 132 40 L11 40 Q0 40 0 34 Z"
        fill="#e9bcc6"
        stroke="#3a2c28"
        strokeOpacity="0.16"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M14 17 Q28 7 48 13 Q64 3 84 11"
        fill="none"
        stroke="#f6dde0"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.65"
      />
    </g>
  );
}

/** Cotton-grass tuft: curved stalks topped with soft white puffs. Sways. */
function Tuft({ flip = false }: { flip?: boolean }) {
  return (
    <g transform={flip ? "scale(-1,1) translate(-120,0)" : undefined}>
      <g className="scene__sway">
        <path d="M30 120 C 22 80 14 56 8 30" fill="none" stroke="#6f7d59" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M52 120 C 50 78 48 50 50 22" fill="none" stroke="#7c8a63" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M74 120 C 80 82 88 58 96 34" fill="none" stroke="#6f7d59" strokeWidth="2.4" strokeLinecap="round" />
        <ellipse cx="8" cy="24" rx="9" ry="11" fill="#f7f1e6" stroke="#3a2c28" strokeOpacity="0.12" strokeWidth="1" />
        <ellipse cx="50" cy="16" rx="9.5" ry="12" fill="#fbf6ec" stroke="#3a2c28" strokeOpacity="0.12" strokeWidth="1" />
        <ellipse cx="96" cy="28" rx="9" ry="11" fill="#f7f1e6" stroke="#3a2c28" strokeOpacity="0.12" strokeWidth="1" />
      </g>
    </g>
  );
}

/** A little curled green sprout, like the reference's fern spirals. */
function Sprout({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} className="scene__sway">
      <path
        d="M6 40 C 6 22 2 10 12 6 C 20 3 22 12 16 14 C 12 15 12 9 15 9"
        fill="none"
        stroke="#7c8a63"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </g>
  );
}

export default function Scene({ narration, children }: SceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [interacted, setInteracted] = useState(false);

  useParallax(sceneRef);

  // Floating dust motes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf = 0, last = performance.now();
    type Mote = { x: number; y: number; r: number; sp: number; drift: number; ph: number; a: number };
    let motes: Mote[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * DPR);
      canvas.height = Math.round(h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const count = Math.round(Math.min(64, w / 24));
      motes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.9,
        sp: 5 + Math.random() * 14,
        drift: 8 + Math.random() * 18,
        ph: Math.random() * Math.PI * 2,
        a: 0.12 + Math.random() * 0.4,
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.y -= m.sp * dt;
        m.ph += dt;
        if (m.y < -12) {
          m.y = h + 12;
          m.x = Math.random() * w;
        }
        ctx.beginPath();
        ctx.arc(m.x + Math.sin(m.ph) * m.drift, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 248, 232, ${m.a})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const svgProps = {
    viewBox: "0 0 1600 900",
    preserveAspectRatio: "xMidYMax slice",
    xmlns: "http://www.w3.org/2000/svg",
  } as const;

  return (
    <div
      className="scene"
      ref={sceneRef}
      onPointerDown={() => setInteracted(true)}
    >
      {/* Sky */}
      <div className="scene__layer scene__sky" />

      {/* Sun */}
      <div className="scene__layer scene__sun">
        <span className="scene__sun-disc" />
      </div>

      {/* Far clouds */}
      <div className="scene__layer scene__clouds">
        <svg {...svgProps}>
          <g className="scene__drift">
            <Cloud x={120} y={110} s={1.5} o={0.85} />
            <Cloud x={1180} y={80} s={1.9} o={0.9} />
            <Cloud x={760} y={150} s={1.1} o={0.7} />
            <Cloud x={1380} y={210} s={1.2} o={0.75} />
            <Cloud x={430} y={230} s={0.9} o={0.6} />
          </g>
        </svg>
      </div>

      {/* Distant mountains / mesa */}
      <div className="scene__layer scene__mountains">
        <svg {...svgProps}>
          <path
            d="M0 900 L0 300 L70 300 L96 198 L150 198 L172 150 L250 150 L276 214 L342 214 L362 300 L470 360 C620 300 700 384 832 352 C1010 308 1150 404 1342 360 C1452 338 1542 380 1600 360 L1600 900 Z"
            fill="#cba8ae"
          />
          <path
            d="M0 900 L0 472 C250 432 482 504 762 472 C1042 440 1322 514 1600 472 L1600 900 Z"
            fill="#bf97a1"
          />
        </svg>
      </div>

      {/* Sea band + sun reflection */}
      <div className="scene__layer scene__sea">
        <svg {...svgProps}>
          <rect x="0" y="450" width="1600" height="52" fill="#a8c0c4" />
          <rect x="0" y="450" width="1600" height="3" fill="#d2e0dc" opacity="0.7" />
          <g fill="#f3e4bd" opacity="0.55">
            <ellipse cx="1030" cy="468" rx="60" ry="5" />
            <ellipse cx="1030" cy="480" rx="42" ry="4" />
            <ellipse cx="1030" cy="491" rx="26" ry="3" />
          </g>
        </svg>
      </div>

      {/* Mid rock formations */}
      <div className="scene__layer scene__hills">
        <svg {...svgProps}>
          {/* small rocks at the waterline (center) */}
          <g fill="#6f4848">
            <path d="M772 498 L784 470 L796 498 Z" />
            <path d="M792 500 L806 462 L820 500 Z" />
            <path d="M814 500 L824 476 L834 500 Z" />
          </g>
          {/* right-side formation */}
          <path d="M1076 524 L1118 360 L1150 360 L1182 298 L1212 298 L1244 380 L1276 380 L1306 338 L1336 338 L1368 524 Z" fill="#9a6967" />
          <path d="M1212 298 L1244 380 L1276 380 L1306 338 L1336 338 L1368 524 L1248 524 Z" fill="#714b4b" />
          <path d="M1076 524 L1118 360 L1150 360 L1166 392 L1150 524 Z" fill="#b27f7b" />
        </svg>
      </div>

      {/* Foreground sand */}
      <div className="scene__layer scene__sand">
        <svg {...svgProps}>
          <defs>
            <linearGradient id="sandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ecdcbe" />
              <stop offset="1" stopColor="#d7c098" />
            </linearGradient>
          </defs>
          <path
            d="M0 900 L0 524 C300 474 520 544 760 502 C1040 458 1300 542 1600 508 L1600 900 Z"
            fill="url(#sandGrad)"
          />
          <path
            d="M0 560 C320 520 560 580 820 546 C1080 512 1320 576 1600 548"
            fill="none"
            stroke="#cdb78f"
            strokeWidth="2"
            opacity="0.5"
          />
          <path
            d="M0 670 C360 636 640 690 900 662 C1160 634 1400 678 1600 660"
            fill="none"
            stroke="#cdb78f"
            strokeWidth="2"
            opacity="0.35"
          />
          <g>
            {SPECKLES.map((p, i) => (
              <ellipse key={i} cx={p.x} cy={p.y} rx={p.r} ry={p.r * 0.7} fill="#7a5a45" opacity={p.o} />
            ))}
          </g>
          <g transform="translate(560 700)">
            <Sprout x={0} y={0} s={1.1} />
            <Sprout x={40} y={20} s={0.9} />
            <Sprout x={-34} y={26} s={0.8} />
          </g>
        </svg>
      </div>

      {/* Near framing rocks */}
      <div className="scene__layer scene__rocks">
        <svg {...svgProps}>
          {/* bottom-left boulder cluster */}
          <path d="M-20 900 L-20 760 L70 700 L180 730 L250 820 L240 900 Z" fill="#9a6967" stroke="#3a2c28" strokeOpacity="0.18" strokeWidth="2" strokeLinejoin="round" />
          <path d="M70 700 L180 730 L250 820 L150 808 Z" fill="#714b4b" />
          <path d="M-20 760 L70 700 L96 760 L20 800 Z" fill="#b27f7b" opacity="0.8" />
          {/* bottom-right boulder */}
          <path d="M1620 900 L1620 690 L1480 650 L1360 720 L1330 900 Z" fill="#9a6967" stroke="#3a2c28" strokeOpacity="0.18" strokeWidth="2" strokeLinejoin="round" />
          <path d="M1620 690 L1480 650 L1360 720 L1470 760 L1620 740 Z" fill="#b27f7b" opacity="0.75" />
          <path d="M1360 720 L1470 760 L1450 900 L1330 900 Z" fill="#714b4b" />
        </svg>
      </div>

      {/* Nearest plants */}
      <div className="scene__layer scene__grass">
        <svg {...svgProps}>
          <g transform="translate(80 760)"><Tuft /></g>
          <g transform="translate(1380 720)"><Tuft flip /></g>
        </svg>
      </div>

      {/* Floating motes */}
      <canvas ref={canvasRef} className="scene__particles" aria-hidden="true" />

      {/* Atmosphere */}
      <div className="scene__vignette" aria-hidden="true" />

      {/* UI overlay */}
      <div className="scene__overlay">
        <div className="scene__content">{children}</div>
        {narration && (
          <aside className="scene__narration">
            <p>{narration}</p>
          </aside>
        )}
      </div>

      <div className={`scene__drag ${interacted ? "is-hidden" : ""}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
        <span>Drag</span>
      </div>

      <div className={`scene__scrollcue ${interacted ? "is-hidden" : ""}`} aria-hidden="true">
        <span>scroll</span>
        <i />
      </div>
    </div>
  );
}
