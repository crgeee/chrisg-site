// The five stations along the world, filled with real content.
// Order = left→right travel order.

export type StationLink = { label: string; meta?: string; href?: string };

export type Station = {
  id: string;
  label: string;
  kicker: string;
  title: string; // \n allowed (rendered with white-space: pre-line)
  body: string;
  links: StationLink[];
};

export type SiteContent = {
  name: string;
  tagline: string;
  intro: string;
  stations: Station[];
};

export const SITE: SiteContent = {
  name: "Christopher Gonzalez",
  tagline: "staff engineer · platform builder · san diego",
  intro: "Everything worth making starts as open country — quiet, unmarked, and yours to cross.",
  stations: [
    {
      id: "about",
      label: "About",
      kicker: "01 — Who",
      title: "I build platforms\nfor millions of people.",
      body: "Staff Software Engineer in San Diego. I lead the UI Platform team at Intuit TurboTax, building the tools and infrastructure that power tax filing for 40M+ people. Before that, full-stack work across enterprise and government — including mission-critical systems for the U.S. Navy.",
      links: [],
    },
    {
      id: "work",
      label: "Work",
      kicker: "02 — Made",
      title: "Things I've built.",
      body: "A handful of projects beyond the day job — products, tools, and the occasional experiment. Drag onward to keep exploring; open a title to visit it.",
      links: [
        { label: "reps.sh", meta: "spaced-repetition interview prep", href: "https://reps.sh" },
        { label: "alphascan.ai", meta: "AI market intelligence", href: "https://alphascan.ai" },
        { label: "App Store Toolkit", meta: "Claude Code plugin · 2025", href: "https://github.com/crgeee/apple-appstore-toolkit" },
      ],
    },
    {
      id: "now",
      label: "Now",
      kicker: "03 — Lately",
      title: "What I'm building\nright now.",
      body: "Leading UI Platform at TurboTax, shipping side projects on nights and weekends, and writing about the craft. Stack of the moment: Python, React, TypeScript, and a small Hetzner box running a few quiet things. Updated whenever the wind changes.",
      links: [],
    },
    {
      id: "writing",
      label: "Writing",
      kicker: "04 — Words",
      title: "Notes from\nthe work.",
      body: "Occasional essays on engineering, platforms, and building things that last. No schedule, no newsletter funnel — just things worth writing down.",
      links: [
        { label: "Read the blog", meta: "essays & notes", href: "/blog" },
      ],
    },
    {
      id: "contact",
      label: "Contact",
      kicker: "05 — Hello",
      title: "Say hello.",
      body: "Always up for a good problem or an interesting conversation. I read everything, and I reply to most.",
      links: [
        { label: "Email", meta: "crg167@gmail.com", href: "mailto:crg167@gmail.com" },
        { label: "LinkedIn", meta: "in/crgee", href: "https://linkedin.com/in/crgee" },
        { label: "GitHub", meta: "@crgeee", href: "https://github.com/crgeee" },
      ],
    },
  ],
};
