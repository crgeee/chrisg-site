export interface Project {
  name: string;
  url: string | null;
  images: string[];
  status: "Live" | "In Progress";
  description: string;
  tech: string[];
  highlights: string[];
}

export const projects: Project[] = [
  {
    name: "reps.sh",
    url: "https://reps.sh",
    images: ["/images/reps-sh.png", "/images/reps-sh-how-it-works.png", "/images/reps-sh-blog.png"],
    status: "Live",
    description:
      "Task tracker with built-in spaced repetition and AI-powered interview coaching. Helps developers prepare for technical interviews by scheduling review sessions using the SM-2 algorithm.",
    tech: ["React", "TypeScript", "Python", "Spaced Repetition"],
    highlights: [
      "SM-2 algorithm implementation for optimal review scheduling",
      "AI interview coaching with real-time feedback",
      "Blog with 3 published articles on spaced repetition and productivity",
    ],
  },
  {
    name: "alphascan.ai",
    url: "https://alphascan.ai",
    images: ["/images/alphascan-ai.png"],
    status: "Live",
    description:
      "AI-powered market intelligence platform that analyzes financial data and news to surface actionable insights for investors and analysts.",
    tech: ["React", "Python", "AI/ML", "Data Pipeline"],
    highlights: [
      "Real-time data aggregation from multiple financial sources",
      "AI-driven analysis and summarization",
      "Secure authentication and personalized dashboards",
    ],
  },
  {
    name: "Find My Value",
    url: null,
    images: [],
    status: "In Progress",
    description:
      "Salary benchmarking tool that helps software engineers understand their market worth. Aggregates compensation data and provides personalized salary insights based on role, location, and experience.",
    tech: ["React", "Flask", "PostgreSQL", "Data Analysis"],
    highlights: [
      "Compensation data aggregation and normalization",
      "Location and experience-adjusted benchmarking",
      "Interactive salary exploration interface",
    ],
  },
  {
    name: "Apple App Store Toolkit",
    url: "https://github.com/crgeee/apple-appstore-toolkit",
    images: ["/images/appstore-toolkit.png"],
    status: "Live",
    description:
      "Claude Code plugin for App Store readiness reviews. Uses 8 specialized AI agents to review React Native and Swift iOS apps against Apple's guidelines before submission.",
    tech: ["Claude Code", "Plugin", "AI Agents", "iOS"],
    highlights: [
      "8 specialized review agents (security, privacy, UI/UX, performance, etc.)",
      "Automated App Store guideline compliance checking",
      "Supports React Native and native Swift apps",
    ],
  },
  {
    name: "Google Play Store Toolkit",
    url: "https://github.com/crgeee/google-playstore-toolkit",
    images: [],
    status: "Live",
    description:
      "Claude Code plugin for Google Play Store readiness reviews. 8 specialized agents review Android, React Native, and Expo apps for Play Store compliance.",
    tech: ["Claude Code", "Plugin", "AI Agents", "Android"],
    highlights: [
      "8 specialized agents covering billing, security, privacy, Material Design",
      "Android manifest analysis and data safety section review",
      "Supports native Android, React Native, and Expo apps",
    ],
  },
  {
    name: "UI Component Library",
    url: "https://github.com/crgeee/ui",
    images: [],
    status: "Live",
    description:
      "Dark-first React component library built with Tailwind CSS v4. A reusable set of components for rapid UI development across projects.",
    tech: ["React", "Tailwind CSS v4", "TypeScript"],
    highlights: [
      "Dark-first design with light mode support",
      "Built on Tailwind CSS v4",
      "Reusable across multiple projects",
    ],
  },
  {
    name: "chrisgonzalez.dev",
    url: "https://chrisgonzalez.dev",
    images: ["/images/chrisgonzalez-dev.png", "/images/chrisgonzalez-dev-projects.png"],
    status: "Live",
    description:
      "This site. A full-stack Flask + React application with a blog CMS, JWT authentication, and automated CI/CD deployment. Built to demonstrate production-grade fullstack engineering.",
    tech: ["Flask", "React", "TypeScript", "Docker", "GitHub Actions"],
    highlights: [
      "Multi-stage Docker build with Nginx reverse proxy",
      "JWT authentication with in-memory token storage",
      "Automated test, build, and deploy pipeline",
    ],
  },
];

export const FEATURED_PROJECTS = projects
  .filter((p) => ["reps.sh", "alphascan.ai", "Apple App Store Toolkit"].includes(p.name))
  .map((p) => ({
    name: p.name,
    url: p.url!,
    tag: p.status,
    description: p.description,
    tech: p.tech.slice(0, 3).join(" \u00B7 "),
  }));
