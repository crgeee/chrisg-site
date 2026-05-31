import { useEffect } from "react";

/**
 * Reveals elements with the `.reveal` class as they scroll into view by adding
 * `.is-visible`. Run once near the top of a page component.
 */
export function useReveal(deps: unknown[] = []) {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal:not(.is-visible)");
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
