import { useDocumentTitle } from "../hooks/useDocumentTitle";
import {
  FiCode, FiBox, FiGitBranch, FiCpu,
  FiServer, FiShield, FiZap, FiLayers, FiDatabase,
  FiGlobe, FiMonitor, FiStar, FiCloud, FiKey,
  FiPackage,
} from "react-icons/fi";
import "./Uses.css";

const categories = [
  {
    title: "Development",
    items: [
      { name: "Claude Code", icon: FiStar, desc: "AI pair programming for rapid prototyping, code review, and plugin development." },
      { name: "VS Code", icon: FiCode, desc: "Primary editor." },
      { name: "Docker", icon: FiBox, desc: "All projects containerized for consistent dev/prod parity." },
      { name: "Git + GitHub", icon: FiGitBranch, desc: "Version control with squash-merge, branch protection, and GitHub Actions CI/CD." },
    ],
  },
  {
    title: "Languages & Frameworks",
    items: [
      { name: "TypeScript + React", icon: FiLayers, desc: "Frontend framework of choice. Vite for tooling, React Router for navigation." },
      { name: "Python + Flask", icon: FiCpu, desc: "Backend API development. SQLAlchemy ORM, Flask-Migrate for schema changes." },
      { name: "Tailwind CSS", icon: FiMonitor, desc: "Utility-first CSS for component libraries. Vanilla CSS for this site." },
      { name: "PostgreSQL", icon: FiDatabase, desc: "Primary database. Used across all production apps." },
      { name: "Node.js", icon: FiPackage, desc: "Runtime for build tools, scripts, and occasional backend services." },
    ],
  },
  {
    title: "Infrastructure & Services",
    items: [
      { name: "Hetzner", icon: FiServer, desc: "VPS hosting. Running multiple sites on a single instance." },
      { name: "Railway", icon: FiCloud, desc: "Quick deploys for side projects." },
      { name: "Supabase", icon: FiDatabase, desc: "Postgres + auth + realtime for projects needing fast backend setup." },
      { name: "Netlify", icon: FiGlobe, desc: "Static site and serverless function hosting. Used for alphascan.ai." },
      { name: "Nginx", icon: FiGlobe, desc: "Reverse proxy, SSL termination, and static file serving." },
      { name: "Let's Encrypt", icon: FiShield, desc: "Free SSL certificates via Certbot with auto-renewal." },
      { name: "GitHub Actions", icon: FiZap, desc: "Automated testing, building, and deployment on push to main." },
      { name: "Clerk", icon: FiKey, desc: "Auth provider for alphascan.ai. Social login and session management." },
    ],
  },
];

export default function Uses() {
  useDocumentTitle("Uses");

  return (
    <div className="uses container fade-in">
      <h1 className="page-title">Uses</h1>
      <p className="page-intro">
        Tools and services I use for development.
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
