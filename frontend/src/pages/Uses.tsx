import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "./Uses.css";

const categories = [
  {
    title: "Development",
    items: [
      { name: "VS Code", desc: "Primary editor. Vim keybindings, minimal extensions." },
      { name: "iTerm2 + zsh", desc: "Terminal with Oh My Zsh and custom aliases." },
      { name: "Docker", desc: "All projects containerized for consistent dev/prod parity." },
      { name: "Git + GitHub", desc: "Version control with GitHub Actions for CI/CD." },
    ],
  },
  {
    title: "Languages & Frameworks",
    items: [
      { name: "TypeScript + React", desc: "Frontend framework of choice. Vite for tooling." },
      { name: "Python + Flask", desc: "Backend API development. SQLAlchemy for ORM." },
      { name: "CSS", desc: "No frameworks. CSS custom properties and vanilla CSS." },
    ],
  },
  {
    title: "Infrastructure",
    items: [
      { name: "Hetzner VPS", desc: "Affordable, reliable hosting for all my projects." },
      { name: "Nginx", desc: "Reverse proxy and static file serving." },
      { name: "Let's Encrypt", desc: "Free SSL certificates via Certbot." },
      { name: "GitHub Actions", desc: "Automated testing and deployment on push to main." },
    ],
  },
  {
    title: "Productivity",
    items: [
      { name: "reps.sh", desc: "My own task tracker with spaced repetition. I use it daily." },
      { name: "Notion", desc: "Long-form notes, project planning, and documentation." },
      { name: "Claude Code", desc: "AI pair programming for rapid prototyping and code review." },
    ],
  },
];

export default function Uses() {
  useDocumentTitle("Uses");

  return (
    <div className="uses container fade-in">
      <h1>Uses</h1>
      <p className="uses__intro">
        Tools, software, and hardware I use for development. Updated for 2026.
      </p>

      {categories.map((cat) => (
        <section key={cat.title} className="uses__section">
          <h2>{cat.title}</h2>
          <div className="uses__items">
            {cat.items.map((item) => (
              <div key={item.name} className="uses__item">
                <h3>{item.name}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
