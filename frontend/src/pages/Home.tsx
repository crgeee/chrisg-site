import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPosts } from "../services/api";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import type { Post } from "../types";
import "./Home.css";

export default function Home() {
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  useDocumentTitle();

  useEffect(() => {
    getPosts(1).then((data) => {
      setRecentPosts(data.posts.slice(0, 3));
    }).catch(() => {});
  }, []);

  return (
    <div className="home fade-in">
      {/* Hero */}
      <section className="home__hero">
        <div className="container">
          <p className="home__label">Staff Software Engineer</p>
          <h1 className="home__name">Christopher R. Gonzalez</h1>
          <p className="home__tagline">
            I build platforms that scale to tens of millions of users.
            Currently leading UI Platform at Intuit TurboTax.
          </p>
          <div className="home__cta">
            <Link to="/projects" className="home__btn home__btn--primary">See my work</Link>
            <Link to="/blog" className="home__btn home__btn--secondary">Read the blog</Link>
          </div>
        </div>
      </section>

      {/* What I Do */}
      <section className="home__skills">
        <div className="container">
          <div className="home__skills-grid">
            <div className="home__skill-card">
              <h3>Full-Stack Development</h3>
              <p>Python, Flask, React, TypeScript. End-to-end ownership from database schema to pixel-perfect UI.</p>
            </div>
            <div className="home__skill-card">
              <h3>Platform Engineering</h3>
              <p>Building internal tools and infrastructure that make entire engineering teams more productive.</p>
            </div>
            <div className="home__skill-card">
              <h3>Engineering Leadership</h3>
              <p>Technical strategy, architecture reviews, and mentoring engineers across a $4B revenue product.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Projects */}
      <section className="home__projects">
        <div className="container">
          <h2>Projects</h2>
          <p className="home__section-desc">Things I've built outside of work</p>
          <div className="home__project-grid">
            <a href="https://reps.sh" target="_blank" rel="noopener noreferrer" className="home__project-card">
              <span className="home__project-tag">Live</span>
              <h3>reps.sh</h3>
              <p>Task tracker with built-in spaced repetition and AI-powered interview coaching. Used by developers preparing for technical interviews.</p>
              <span className="home__project-tech">React &middot; TypeScript &middot; Python</span>
            </a>
            <a href="https://alphascan.ai" target="_blank" rel="noopener noreferrer" className="home__project-card">
              <span className="home__project-tag">Live</span>
              <h3>alphascan.ai</h3>
              <p>AI-powered market intelligence platform that surfaces actionable insights from financial data and news sources.</p>
              <span className="home__project-tech">React &middot; Python &middot; AI/ML</span>
            </a>
            <a href="https://github.com/crgeee/apple-appstore-toolkit" target="_blank" rel="noopener noreferrer" className="home__project-card">
              <span className="home__project-tag">Open Source</span>
              <h3>App Store Toolkit</h3>
              <p>Claude Code plugin with 8 AI agents for automated App Store readiness reviews of iOS apps.</p>
              <span className="home__project-tech">Claude Code &middot; AI Agents &middot; iOS</span>
            </a>
          </div>
          <Link to="/projects" className="home__view-all">All projects &rarr;</Link>
        </div>
      </section>

      {/* Recent Posts */}
      {recentPosts.length > 0 && (
        <section className="home__posts">
          <div className="container">
            <h2>Recent Writing</h2>
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

      {/* Connect */}
      <section className="home__connect">
        <div className="container">
          <h2>Get in touch</h2>
          <p>I'm always open to interesting conversations and collaborations.</p>
          <div className="home__links">
            <a href="https://linkedin.com/in/crgee" target="_blank" rel="noopener noreferrer">LinkedIn</a>
            <a href="https://github.com/crgeee" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="mailto:crg167@gmail.com">Email</a>
          </div>
        </div>
      </section>
    </div>
  );
}
