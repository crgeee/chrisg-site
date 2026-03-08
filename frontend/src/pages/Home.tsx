import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiGithub, FiLinkedin, FiSend } from "react-icons/fi";
import { getPosts } from "../services/api";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import type { Post } from "../types";
import "./Home.css";

const FEATURED_PROJECTS = [
  {
    name: "reps.sh",
    url: "https://reps.sh",
    tag: "Live",
    description: "Task tracker with built-in spaced repetition and AI-powered interview coaching. Used by developers preparing for technical interviews.",
    tech: "React \u00B7 TypeScript \u00B7 Python",
  },
  {
    name: "alphascan.ai",
    url: "https://alphascan.ai",
    tag: "Live",
    description: "AI-powered market intelligence platform that surfaces actionable insights from financial data and news sources.",
    tech: "React \u00B7 Python \u00B7 AI/ML",
  },
  {
    name: "App Store Toolkit",
    url: "https://github.com/crgeee/apple-appstore-toolkit",
    tag: "Open Source",
    description: "Claude Code plugin with 8 AI agents for automated App Store readiness reviews of iOS apps.",
    tech: "Claude Code \u00B7 AI Agents \u00B7 iOS",
  },
];

const SOCIAL_LINKS = [
  { href: "https://linkedin.com/in/crgee", icon: FiLinkedin, label: "LinkedIn" },
  { href: "https://github.com/crgeee", icon: FiGithub, label: "GitHub" },
  { href: "/contact", icon: FiSend, label: "Contact" },
];

export default function Home() {
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  useDocumentTitle();

  useEffect(() => {
    getPosts(1).then((data) => {
      setRecentPosts(data.posts.slice(0, 3));
    }).catch(() => {});
  }, []);

  return (
    <div className="home">
      {/* Dark Hero */}
      <section className="home__hero">
        <div className="home__hero-inner">
          <p className="home__label">Staff Software Engineer</p>
          <h1 className="home__name">Christopher R.<br />Gonzalez</h1>
          <p className="home__tagline">
            I build platforms that scale to tens of millions of users.
            Currently leading UI Platform at Intuit TurboTax.
          </p>
          <div className="home__cta">
            <Link to="/projects" className="home__btn home__btn--primary">See my work</Link>
            <Link to="/blog" className="home__btn home__btn--ghost">Read the blog</Link>
          </div>
          <div className="home__hero-social">
            {SOCIAL_LINKS.map(({ href, icon: Icon, label }) => (
              href.startsWith("/") ? (
                <Link key={label} to={href} aria-label={label}><Icon size={20} /></Link>
              ) : (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}><Icon size={20} /></a>
              )
            ))}
          </div>
        </div>
      </section>

      {/* What I Do — dark section */}
      <section className="home__skills">
        <div className="container--wide">
          <div className="home__skills-grid">
            <div className="home__skill-card">
              <span className="home__skill-number">01</span>
              <h3>Full-Stack Development</h3>
              <p>Python, Flask, React, TypeScript. End-to-end ownership from database schema to pixel-perfect UI.</p>
            </div>
            <div className="home__skill-card">
              <span className="home__skill-number">02</span>
              <h3>Platform Engineering</h3>
              <p>Building internal tools and infrastructure that make entire engineering teams more productive.</p>
            </div>
            <div className="home__skill-card">
              <span className="home__skill-number">03</span>
              <h3>Engineering Leadership</h3>
              <p>Technical strategy, architecture reviews, and mentoring engineers across a $4B revenue product.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Projects */}
      <section className="home__projects">
        <div className="container--wide">
          <h2 className="home__section-title">Featured Projects</h2>
          <p className="home__section-desc">Things I've built outside of work</p>
          <div className="home__project-grid">
            {FEATURED_PROJECTS.map((project) => (
              <a key={project.name} href={project.url} target="_blank" rel="noopener noreferrer" className="home__project-card">
                <span className="home__project-tag">{project.tag}</span>
                <h3>{project.name}</h3>
                <p>{project.description}</p>
                <span className="home__project-tech">{project.tech}</span>
              </a>
            ))}
          </div>
          <Link to="/projects" className="home__view-all">All projects &rarr;</Link>
        </div>
      </section>

      {/* Recent Posts */}
      {recentPosts.length > 0 && (
        <section className="home__posts">
          <div className="container">
            <h2 className="home__section-title">Recent Writing</h2>
            <p className="home__section-desc">Thoughts on engineering, career, and building things</p>
            <div className="home__post-list">
              {recentPosts.map((post) => (
                <Link to={`/blog/${post.slug}`} key={post.id} className="home__post-card">
                  <time>{new Date(post.created_at).toLocaleDateString("en-US", {
                    year: "numeric", month: "long", day: "numeric"
                  })}</time>
                  <h3>{post.title}</h3>
                  <p>{post.excerpt}</p>
                </Link>
              ))}
            </div>
            <Link to="/blog" className="home__view-all">All posts &rarr;</Link>
          </div>
        </section>
      )}

      {/* Connect — dark */}
      <section className="home__connect">
        <div className="container">
          <h2>Get in touch</h2>
          <p>Always open to interesting conversations and collaborations.</p>
          <div className="home__connect-links">
            {SOCIAL_LINKS.map(({ href, icon: Icon, label }) => (
              href.startsWith("/") ? (
                <Link key={label} to={href} className="home__connect-link">
                  <Icon size={24} />
                  <span>{label}</span>
                </Link>
              ) : (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="home__connect-link">
                  <Icon size={24} />
                  <span>{label}</span>
                </a>
              )
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
