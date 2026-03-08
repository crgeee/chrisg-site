import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "./About.css";

export default function About() {
  useDocumentTitle("About");

  return (
    <div className="about container fade-in">
      <h1>About Me</h1>

      <section className="about__intro">
        <p>
          I'm a Staff Software Engineer based in San Diego, California.
          I lead the UI Platform team at Intuit's TurboTax, where I build the
          infrastructure that powers tax filing experiences for over 40 million customers.
        </p>
      </section>

      <section className="about__section">
        <h2>What I Do</h2>
        <p>
          My work sits at the intersection of platform engineering and full-stack development.
          I design systems that other engineers build on top of &mdash; component libraries,
          build tooling, performance monitoring, and developer experience improvements
          that make teams move faster without sacrificing quality.
        </p>
        <p>
          Before Intuit, I spent years building full-stack applications across enterprise
          and government &mdash; including mission-critical systems for the U.S. Navy.
          That background gave me a deep appreciation for reliability, security,
          and the kind of engineering discipline that doesn't cut corners.
        </p>
      </section>

      <section className="about__section">
        <h2>Technical Focus</h2>
        <ul className="about__list">
          <li><strong>Languages:</strong> Python, TypeScript, JavaScript</li>
          <li><strong>Frontend:</strong> React, Next.js, design systems, performance optimization</li>
          <li><strong>Backend:</strong> Flask, FastAPI, REST APIs, SQL &amp; NoSQL databases</li>
          <li><strong>Infrastructure:</strong> Docker, CI/CD, Nginx, cloud platforms</li>
          <li><strong>Leadership:</strong> Architecture reviews, technical strategy, mentoring</li>
        </ul>
      </section>

      <section className="about__section">
        <h2>Outside of Work</h2>
        <p>
          I build side projects to explore ideas and sharpen skills.
          <a href="https://reps.sh"> reps.sh</a> combines spaced repetition with task management.
          <a href="https://alphascan.ai"> alphascan.ai</a> uses AI to surface market intelligence.
          This site itself is a Flask + React app deployed with Docker &mdash; I write about
          the process on <a href="/blog">the blog</a>.
        </p>
      </section>

      <section className="about__section">
        <h2>Get in Touch</h2>
        <p>
          I'm always interested in talking about engineering, career growth, or interesting problems.
          Find me on <a href="https://linkedin.com/in/crgee" target="_blank" rel="noopener noreferrer">LinkedIn</a>,
          <a href="https://github.com/crgeee" target="_blank" rel="noopener noreferrer"> GitHub</a>,
          or <a href="mailto:crg167@gmail.com">send me an email</a>.
        </p>
      </section>
    </div>
  );
}
