import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPosts } from "../services/api";
import type { Post } from "../types";
import "./Home.css";

export default function Home() {
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);

  useEffect(() => {
    getPosts(1).then((data) => {
      setRecentPosts(data.posts.slice(0, 3));
    }).catch(() => {});
  }, []);

  return (
    <div className="home fade-in">
      {/* Hero */}
      <section className="home__hero container">
        <h1 className="home__name">Christopher R. Gonzalez</h1>
        <p className="home__tagline">
          Staff Software Engineer &mdash; Building scalable platforms for millions of users
        </p>
        <p className="home__location">San Diego, CA</p>
        <div className="home__links">
          <a href="https://linkedin.com/in/crgee" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          <a href="https://github.com/crgeee" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="mailto:crg167@gmail.com">Email</a>
        </div>
      </section>

      {/* About */}
      <section className="home__about container">
        <p>
          I lead the UI Platform team at Intuit's TurboTax, powering tax filing
          experiences for 40M+ customers. 10+ years building full-stack
          applications across enterprise and government &mdash; from $4B revenue
          systems to Navy mission-critical tools.
        </p>
      </section>

      {/* Projects */}
      <section className="home__projects container">
        <h2>Projects</h2>
        <div className="home__project-grid">
          <a href="https://reps.sh" target="_blank" rel="noopener noreferrer" className="home__project-card">
            <h3>reps.sh</h3>
            <p>Workout tracking from the command line</p>
          </a>
          <a href="https://alphascan.ai" target="_blank" rel="noopener noreferrer" className="home__project-card">
            <h3>alphascan.ai</h3>
            <p>AI-powered market intelligence</p>
          </a>
          <div className="home__project-card">
            <h3>Find My Value</h3>
            <p>Discover what you're worth in the job market</p>
          </div>
        </div>
      </section>

      {/* Recent Posts */}
      {recentPosts.length > 0 && (
        <section className="home__posts container">
          <h2>Recent Writing</h2>
          <div className="home__post-list">
            {recentPosts.map((post) => (
              <Link to={`/blog/${post.slug}`} key={post.id} className="home__post-card">
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
                <time>{new Date(post.created_at).toLocaleDateString("en-US", {
                  year: "numeric", month: "long", day: "numeric"
                })}</time>
              </Link>
            ))}
          </div>
          <Link to="/blog" className="home__view-all">View all posts &rarr;</Link>
        </section>
      )}
    </div>
  );
}
