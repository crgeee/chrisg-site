# How I Built This Site with Flask, React, and Docker

> **Target keyword:** `flask react tutorial`
> **Estimated search volume:** 2,000–5,000/month
> **Status:** DRAFT — flesh out each section with your voice

---

## Intro (2-3 paragraphs)

**Hook:** Most Flask + React tutorials stop at "Hello World." This is how I built a production site with auth, CI/CD, and Docker — and what I learned along the way.

**Why I built it:** Wanted a personal site that doubles as a portfolio piece. Needed to demonstrate full-stack skills (Python + React + TypeScript) for a role I'm targeting. Chose Flask over Django for its lightweight flexibility.

**What you'll learn:** The full stack — Flask REST API with JWT auth, React SPA with TypeScript, Docker deployment, and GitHub Actions CI/CD. All running on a $5/month VPS.

---

## The Architecture (3-4 paragraphs + diagram)

**Talk about:**
- Flask app factory pattern and why it matters
- React SPA served by Flask in production via static files
- Vite dev server with proxy to Flask during development
- SQLAlchemy + Alembic for database migrations
- JWT auth with access + refresh tokens stored in memory (not localStorage)

**Include:** A simple architecture diagram (text-based or image)

---

## Building the API (4-5 paragraphs with code)

**Cover:**
- App factory in `__init__.py` — show the pattern
- Blueprint organization (auth, posts, health)
- Post model with auto-slug generation — show the `_slugify` method
- JWT authentication flow — login → access token → refresh
- Pagination on the posts endpoint

**Show real code snippets from your actual codebase.** That's what makes this different from generic tutorials.

---

## The React Frontend (3-4 paragraphs with code)

**Cover:**
- Project structure and routing with React Router v7
- The API service layer — centralized fetch with auto-refresh on 401
- Why JWT tokens go in memory, not localStorage (XSS prevention)
- Markdown rendering with react-markdown + remark-gfm
- CSS approach: no framework, just CSS custom properties (Apple-inspired)

---

## Docker & Deployment (3-4 paragraphs)

**Cover:**
- Multi-stage Dockerfile: Node builds frontend → Python serves everything
- docker-compose for local development
- Nginx reverse proxy configuration (especially for multiple sites on one VPS)
- GitHub Actions: test → deploy via SSH

**This is the section most tutorials skip.** Going from "works on my machine" to "live on the internet" is where the real learning happens.

---

## What I'd Do Differently (2-3 paragraphs)

**Be honest about trade-offs:**
- Flask vs FastAPI — Flask was right for this, but FastAPI's automatic docs are nice
- SQLite vs PostgreSQL — started with SQLite for simplicity, will migrate later
- SPA vs SSR — client-side rendering hurts SEO, might add pre-rendering
- Any gotchas you hit (Python 3.9 hashlib/scrypt, LegacyAPIWarning, etc.)

---

## Conclusion (1-2 paragraphs)

**CTA:** Link to the GitHub repo. Invite readers to fork it and build their own. Mention you write about engineering and career topics on the blog.

---

## SEO Checklist Before Publishing
- [ ] Title: "How I Built a Full-Stack App with Flask, React & Docker (2026)"
- [ ] Excerpt: "A complete walkthrough of building a production Flask + React site with JWT auth, Docker, and CI/CD on a $5 VPS."
- [ ] Include code blocks (Google indexes these well)
- [ ] Internal links to /projects and /about
- [ ] External links to Flask docs, React docs, Docker docs
