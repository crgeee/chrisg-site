import { useDocumentTitle } from "../hooks/useDocumentTitle";
import {
  FiCode, FiTerminal, FiBox, FiGitBranch, FiCpu,
  FiServer, FiShield, FiZap, FiLayers, FiDatabase,
  FiGlobe, FiMonitor, FiCheckSquare, FiFileText, FiTool,
  FiHeadphones, FiSmartphone, FiStar, FiCloud, FiKey,
  FiPackage, FiSend, FiActivity,
} from "react-icons/fi";
import "./Uses.css";

const categories = [
  {
    title: "Development",
    items: [
      { name: "VS Code", icon: FiCode, desc: "Primary editor. Vim keybindings, minimal extensions. Monokai Pro theme." },
      { name: "Claude Code", icon: FiStar, desc: "AI pair programming for rapid prototyping, code review, and plugin development." },
      { name: "iTerm2 + zsh", icon: FiTerminal, desc: "Terminal with Oh My Zsh, Powerlevel10k prompt, and custom aliases." },
      { name: "Docker", icon: FiBox, desc: "All projects containerized for consistent dev/prod parity." },
      { name: "Git + GitHub", icon: FiGitBranch, desc: "Version control with squash-merge, branch protection, and GitHub Actions CI/CD." },
      { name: "Postman", icon: FiZap, desc: "API testing and documentation. Saved collections for every project." },
    ],
  },
  {
    title: "Languages & Frameworks",
    items: [
      { name: "TypeScript + React", icon: FiLayers, desc: "Frontend framework of choice. Vite for tooling, React Router for navigation." },
      { name: "Python + Flask", icon: FiCpu, desc: "Backend API development. SQLAlchemy ORM, Flask-Migrate for schema changes." },
      { name: "Tailwind CSS", icon: FiMonitor, desc: "Utility-first CSS for component libraries. Vanilla CSS for this site." },
      { name: "PostgreSQL", icon: FiDatabase, desc: "Primary database. Used across all production apps." },
      { name: "SQLAlchemy", icon: FiDatabase, desc: "Python ORM. Alembic migrations for schema evolution." },
      { name: "Node.js", icon: FiPackage, desc: "Runtime for build tools, scripts, and occasional backend services." },
    ],
  },
  {
    title: "Infrastructure & Services",
    items: [
      { name: "Hetzner", icon: FiServer, desc: "Affordable, reliable VPS hosting. Running multiple sites on a single instance." },
      { name: "Railway", icon: FiCloud, desc: "Quick deploys for side projects. Postgres and Redis with zero config." },
      { name: "Supabase", icon: FiDatabase, desc: "Postgres + auth + realtime. Used for projects needing fast backend setup." },
      { name: "Netlify", icon: FiGlobe, desc: "Static site and serverless function hosting. Used for alphascan.ai." },
      { name: "Nginx", icon: FiGlobe, desc: "Reverse proxy, SSL termination, and static file serving. Virtual hosts for multi-site." },
      { name: "Let's Encrypt", icon: FiShield, desc: "Free SSL certificates via Certbot with auto-renewal." },
      { name: "GitHub Actions", icon: FiZap, desc: "Automated testing, building, and deployment on push to main." },
      { name: "Docker Compose", icon: FiBox, desc: "Multi-container orchestration for local dev and production deployments." },
      { name: "Clerk", icon: FiKey, desc: "Auth provider for alphascan.ai. Social login, session management, user profiles." },
      { name: "Sentry", icon: FiActivity, desc: "Error tracking and performance monitoring in production." },
      { name: "Resend", icon: FiSend, desc: "Transactional email API. Used for contact forms and notifications." },
    ],
  },
  {
    title: "Productivity",
    items: [
      { name: "reps.sh", icon: FiCheckSquare, desc: "My own task tracker with spaced repetition. I use it daily for interview prep." },
      { name: "Notion", icon: FiFileText, desc: "Long-form notes, project planning, and documentation." },
      { name: "Raycast", icon: FiTool, desc: "Launcher, clipboard manager, snippets, and window management." },
      { name: "Arc Browser", icon: FiGlobe, desc: "Primary browser. Spaces for context switching between projects." },
    ],
  },
  {
    title: "Hardware",
    items: [
      { name: "MacBook Pro 14\" M3 Pro", icon: FiSmartphone, desc: "Primary machine. 18GB RAM, plenty for Docker and local dev." },
      { name: "Apple Studio Display", icon: FiMonitor, desc: "27\" 5K Retina. Clean desk setup with a single Thunderbolt cable." },
      { name: "AirPods Pro", icon: FiHeadphones, desc: "Noise cancellation for focus. Transparency mode for meetings." },
    ],
  },
];

export default function Uses() {
  useDocumentTitle("Uses");

  return (
    <div className="uses container fade-in">
      <h1 className="page-title">Uses</h1>
      <p className="page-intro">
        Tools, software, and hardware I use for development. Updated for 2026.
      </p>

      {categories.map((cat) => (
        <section key={cat.title} className="uses__section">
          <h2>{cat.title}</h2>
          <div className="uses__items">
            {cat.items.map((item) => (
              <div key={item.name} className="uses__item">
                <div className="uses__item-icon">
                  <item.icon size={20} />
                </div>
                <div className="uses__item-content">
                  <h3>{item.name}</h3>
                  <p>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
