import { useDocumentTitle } from "../hooks/useDocumentTitle";
import ImageGallery from "../components/ImageGallery";
import "./Projects.css";

const projects = [
  {
    name: "reps.sh",
    url: "https://reps.sh",
    images: ["/images/reps-sh.png", "/images/reps-sh-how-it-works.png", "/images/reps-sh-blog.png"],
    status: "Live" as const,
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
    status: "Live" as const,
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
    status: "In Progress" as const,
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
    status: "Live" as const,
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
    status: "Live" as const,
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
    status: "Live" as const,
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
    status: "Live" as const,
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

export default function Projects() {
  useDocumentTitle("Projects");

  return (
    <div className="projects container fade-in">
      <h1 className="page-title">Projects</h1>
      <p className="page-intro">
        Things I build to explore ideas, learn new tech, and solve real problems.
      </p>

      <div className="projects__list">
        {projects.map((project) => (
          <article key={project.name} className="projects__card">
            {project.images.length > 0 && (
              <ImageGallery images={project.images} alt={project.name} />
            )}
            <div className="projects__card-header">
              <div>
                <span className={`projects__status ${project.status === "In Progress" ? "projects__status--wip" : ""}`}>
                  {project.status}
                </span>
                <h2>
                  {project.url ? (
                    <a href={project.url} target="_blank" rel="noopener noreferrer">
                      {project.name} &#8599;
                    </a>
                  ) : (
                    project.name
                  )}
                </h2>
              </div>
            </div>
            <p className="projects__desc">{project.description}</p>
            <ul className="projects__highlights">
              {project.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <div className="projects__tech">
              {project.tech.map((t) => (
                <span key={t} className="projects__tech-tag">{t}</span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
