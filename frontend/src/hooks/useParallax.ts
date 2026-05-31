import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Pointer + drag parallax. Writes smoothed --mx / --my (≈ -1.3..1.3) onto the
 * target element; layers inside translate by `--mx * --depth`. Hover gives a
 * gentle float; click-drag pans the world further (makemepulse-style explore).
 */
export function useParallax<T extends HTMLElement>(ref: RefObject<T | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let hoverX = 0, hoverY = 0; // pointer position, -1..1
    let panX = 0, panY = 0;     // accumulated drag
    let curX = 0, curY = 0;     // smoothed output
    let dragging = false;
    let lastX = 0, lastY = 0;
    let raf = 0;

    // Cache the scene rect; it only changes on scroll/resize, not per pointer move.
    let rect = el.getBoundingClientRect();
    const refreshRect = () => { rect = el.getBoundingClientRect(); };

    const onMove = (e: PointerEvent) => {
      if (!rect.width || !rect.height) return;
      hoverX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      hoverY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      if (dragging) {
        panX = Math.max(-1, Math.min(1, panX + (e.clientX - lastX) / (rect.width * 0.5)));
        panY = Math.max(-0.6, Math.min(0.6, panY + (e.clientY - lastY) / (rect.height * 0.5)));
        lastX = e.clientX;
        lastY = e.clientY;
      }
    };
    const onDown = (e: PointerEvent) => {
      refreshRect();
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture?.(e.pointerId);
      el.classList.add("is-dragging");
    };
    const onUp = () => {
      dragging = false;
      el.classList.remove("is-dragging");
    };
    const onLeave = () => { hoverX = 0; hoverY = 0; };

    const tick = () => {
      const tx = hoverX * 0.55 + panX;
      const ty = hoverY * 0.55 + panY;
      curX += (tx - curX) * 0.06;
      curY += (ty - curY) * 0.06;
      el.style.setProperty("--mx", curX.toFixed(4));
      el.style.setProperty("--my", curY.toFixed(4));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("scroll", refreshRect, { passive: true });
    window.addEventListener("resize", refreshRect);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("scroll", refreshRect);
      window.removeEventListener("resize", refreshRect);
    };
  }, [ref]);
}
