import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiGithub, FiLinkedin, FiSend, FiArrowUpRight } from "react-icons/fi";
import Scene from "../components/Scene";
import { getPosts } from "../services/api";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useReveal } from "../hooks/useReveal";
import { formatDate } from "../utils/formatDate";
import { FEATURED_PROJECTS } from "../data/projects";
import type { Post } from "../types";
import "./Home.css";

const SOCIAL_LINKS = [
  { href: "https://linkedin.com/in/crgee", icon: FiLinkedin, label: "LinkedIn" },
  { href: "https://github.com/crgeee", icon: FiGithub, label: "GitHub" },
  { href: "/contact", icon: FiSend, label: "Contact" },
];

const PRACTICES = [
  { n: "01", title: "Full-Stack Craft", body: "Python, Flask, React, TypeScript — end-to-end ownership from database schema to the last pixel." },
  { n: "02", title: "Platform Engineering", body: "Internal tools and infrastructure that make whole engineering teams faster and calmer." },
  { n: "03", title: "Engineering Leadership", body: "Technical strategy, architecture reviews, and mentorship across a $4B-revenue product." },
];

export default function Home() {
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  useDocumentTitle();
  useReveal([recentPosts.length]);

  useEffect(() => {
    getPosts(1)
      .then((data) => setRecentPosts(data.posts.slice(0, 3)))
      .catch((err) => console.error("Failed to load recent posts:", err));
  }, []);

  return (
    <div className="home">
      <Scene narration="Everything worth making starts as open country — quiet, unmarked, and yours to cross.">
        <p className="home__kicker">Staff Software Engineer · San Diego</p>
        <h1 className="home__name">
          Christopher R.
          <br />
          Gonzalez
        </h1>
        <p className="home__tagline">
          I build platforms that scale to tens of millions of people.
          Currently leading UI Platform at Intuit TurboTax.
        </p>
        <div className="home__cta">
          <Link to="/projects" className="home__btn home__btn--primary">See my work</Link>
          <Link to="/blog" className="home__btn home__btn--ghost">Read the blog</Link>
        </div>
        <div className="home__social">
          {SOCIAL_LINKS.map(({ href, icon: Icon, label }) =>
            href.startsWith("/") ? (
              <Link key={label} to={href} aria-label={label}><Icon size={19} /></Link>
            ) : (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}><Icon size={19} /></a>
            ),
          )}
        </div>
      </Scene>

      {/* What I do */}
      <section className="home__practice">
        <div className="container--wide">
          <h2 className="home__eyebrow reveal">The work</h2>
          <div className="home__practice-grid">
            {PRACTICES.map((p) => (
              <div key={p.n} className="home__practice-card reveal">
                <span className="home__practice-n">{p.n}</span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured projects */}
      <section className="home__projects">
        <div className="container--wide">
          <div className="home__section-head reveal">
            <h2 className="home__section-title">Featured projects</h2>
            <p className="home__section-desc">Things I've built outside of work</p>
          </div>
          <div className="home__project-grid">
            {FEATURED_PROJECTS.map((project) => (
              <a
                key={project.name}
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="home__project-card reveal"
              >
                <span className="home__project-tag">{project.tag}</span>
                <h3>{project.name}</h3>
                <p>{project.description}</p>
                <span className="home__project-tech">{project.tech}</span>
                <FiArrowUpRight className="home__project-arrow" size={18} />
              </a>
            ))}
          </div>
          <Link to="/projects" className="home__view-all">All projects →</Link>
        </div>
      </section>

      {/* Recent writing */}
      {recentPosts.length > 0 && (
        <section className="home__posts">
          <div className="container">
            <div className="home__section-head reveal">
              <h2 className="home__section-title">From the journal</h2>
              <p className="home__section-desc">Notes on engineering, craft, and building things</p>
            </div>
            <div className="home__post-list">
              {recentPosts.map((post) => (
                <Link to={`/blog/${post.slug}`} key={post.id} className="home__post-card reveal">
                  <time>{formatDate(post.created_at)}</time>
                  <h3>{post.title}</h3>
                  <p>{post.excerpt}</p>
                </Link>
              ))}
            </div>
            <Link to="/blog" className="home__view-all">All posts →</Link>
          </div>
        </section>
      )}

      {/* Connect */}
      <section className="home__connect">
        <div className="container">
          <h2 className="reveal">Let's build something</h2>
          <p className="reveal">Always open to interesting conversations and good problems.</p>
          <div className="home__connect-links reveal">
            {SOCIAL_LINKS.map(({ href, icon: Icon, label }) =>
              href.startsWith("/") ? (
                <Link key={label} to={href} className="home__connect-link">
                  <Icon size={22} />
                  <span>{label}</span>
                </Link>
              ) : (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="home__connect-link">
                  <Icon size={22} />
                  <span>{label}</span>
                </a>
              ),
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
