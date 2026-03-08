import { useDocumentTitle } from "../hooks/useDocumentTitle";
import ImageGallery from "../components/ImageGallery";
import { projects } from "../data/projects";
import "./Projects.css";

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
