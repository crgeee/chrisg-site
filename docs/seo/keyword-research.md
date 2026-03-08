# Keyword Research & Content Strategy for chrisgonzalez.dev

**Date:** 2026-03-07
**Goal:** Identify high-value keywords and content opportunities for Christopher R. Gonzalez's personal site, targeting the Apple MLAI fullstack engineer role and broader developer audience.

---

## Current Content Inventory

| Page | Status | Keywords Targeted |
|------|--------|-------------------|
| Home (/) | Live | None — resume dump, title is "frontend" |
| Blog (/blog) | Live | None — empty, "No posts yet" |
| reps.sh/blog | Live (separate domain) | Spaced repetition, SM-2 algorithm, open-source Todoist alternatives |

**SEO Issues Found:**
- Page title is Vite default ("frontend")
- No meta descriptions anywhere
- No Open Graph tags
- No structured data (JSON-LD)
- Homepage is thin content (resume snippet)
- Blog has zero content

---

## Keyword Opportunities — Prioritized

### Tier 1: High Impact, Strong Ranking Potential (Write First)

| # | Page/Article Title | Primary Keyword | Est. Monthly Searches | Difficulty | Why You Can Rank |
|---|---|---|---|---|---|
| 1 | **"How to Build a Full-Stack App with Flask and React (2026 Guide)"** | `flask react tutorial` | 2,000–5,000 | Medium | You literally built this site with Flask+React+Docker. Real project, not toy example. Miguel Grinberg dominates but his tutorials lack Docker/deployment depth. |
| 2 | **"Flask REST API with JWT Authentication: Complete Tutorial"** | `flask jwt authentication` | 1,500–3,000 | Medium | Your site uses Flask-JWT-Extended. Show real implementation with refresh tokens, protected routes, security best practices. |
| 3 | **"Deploying Flask + React with Docker, Nginx & GitHub Actions"** | `deploy flask docker` | 1,000–2,500 | Low-Medium | Most tutorials stop at "run locally." You have production deployment with multi-stage Docker, Nginx reverse proxy, CI/CD. Rare combo. |
| 4 | **"Staff Engineer Career Guide: What Nobody Tells You"** | `staff engineer career path` | 3,000–6,000 | Medium-High | You ARE a staff engineer at a Fortune 500. Personal experience + Will Larson's framework = authoritative content. staffeng.com dominates but hasn't updated since 2021. |
| 5 | **"Platform Engineering at Scale: Lessons from TurboTax"** | `platform engineering` | 5,000–10,000 | High | Trending topic (Gartner: 80% of orgs will have platform teams by 2026). Your UI Platform team experience is exactly this. Case study angle beats generic articles. |

### Tier 2: Medium Impact, Good Ranking Potential

| # | Page/Article Title | Primary Keyword | Est. Monthly Searches | Difficulty | Why You Can Rank |
|---|---|---|---|---|---|
| 6 | **"React TypeScript Project Structure: How I Organize Large Apps"** | `react typescript project structure` | 2,000–4,000 | Medium | Developers constantly search for this. Your enterprise experience gives credibility. Most results are outdated or toy-sized. |
| 7 | **"SQLAlchemy + Flask-Migrate: Database Migrations Done Right"** | `flask sqlalchemy migrations` | 800–1,500 | Low | Underserved niche. Most Flask tutorials skip migrations entirely. You have working Alembic setup. |
| 8 | **"Building a Markdown Blog Engine with Flask and React"** | `flask blog tutorial` | 1,500–3,000 | Medium | Meta content — your blog IS a Flask+React blog. Show how you built the CMS with admin panel, JWT auth, markdown rendering. |
| 9 | **"Python for Frontend Engineers: What I Wish I Knew"** | `python for frontend developers` | 1,000–2,000 | Low | Unique angle. Most content targets backend→frontend, not the reverse. Your fullstack journey is the content. |
| 10 | **"Apple MLAI Fullstack Engineer: How I'm Preparing"** | `apple machine learning engineer interview` | 2,000–4,000 | Medium-High | Highly searched. Your preparation journey = unique content. Interview prep blogs get massive traffic. |

### Tier 3: Niche but Valuable (Builds Authority)

| # | Page/Article Title | Primary Keyword | Est. Monthly Searches | Difficulty | Why You Can Rank |
|---|---|---|---|---|---|
| 11 | **"Nginx Reverse Proxy for Multiple Sites on One VPS"** | `nginx reverse proxy multiple sites` | 1,500–3,000 | Low | You literally did this (reps.sh + chrisgonzalez.dev on same Hetzner VPS). Practical, detailed guide. |
| 12 | **"GitHub Actions CI/CD for Flask Apps: Test, Build, Deploy"** | `github actions flask deploy` | 800–1,500 | Low | Your deploy.yml is a working example. Most tutorials use Heroku (deprecated free tier) or AWS (complex). |
| 13 | **"Multi-Stage Docker Builds: React Frontend + Python Backend"** | `multi-stage docker build react python` | 500–1,000 | Low | Very specific long-tail. Your Dockerfile IS this pattern. Few good tutorials exist. |
| 14 | **"JWT Security Best Practices: Why I Don't Use localStorage"** | `jwt localstorage security` | 1,000–2,000 | Medium | Your site stores JWT in memory. Controversial topic = engagement. Security content ranks well. |
| 15 | **"From Navy to Staff Engineer: My Career Path in Tech"** | `military to tech career` | 500–1,500 | Low | Personal story. Military→tech is a popular career transition niche with engaged audience. |

---

## Static Pages to Add/Improve

| Page | Purpose | Target Keywords |
|------|---------|-----------------|
| **Home (/)** | Rewrite from resume-dump to marketing copy | `christopher gonzalez software engineer`, `staff engineer san diego` |
| **About (/about)** | Detailed professional story, not just a blurb | `fullstack engineer portfolio`, `staff engineer portfolio` |
| **Projects (/projects)** | Dedicated page with descriptions, tech stack, screenshots | `reps.sh`, `alphascan.ai`, project names as branded keywords |
| **Uses (/uses)** | Tools, setup, tech stack (popular format in dev community) | `developer setup 2026`, `staff engineer tools` |

---

## Quick SEO Fixes (Do Before Writing Content)

1. **Fix page title** — Change from "frontend" to "Christopher R. Gonzalez — Staff Software Engineer"
2. **Add meta descriptions** — Every page needs a unique 150-160 char description
3. **Add Open Graph tags** — For social sharing (LinkedIn especially)
4. **Add JSON-LD structured data** — Person schema on homepage, BlogPosting on articles
5. **Fix project descriptions** — "Workout tracking from the command line" → describe actual value
6. **Add sitemap.xml** — Flask can generate this
7. **Add robots.txt** — Allow all, point to sitemap
8. **Canonical URLs** — Prevent duplicate content issues

---

## Content Calendar Recommendation

**Month 1:** Fix SEO foundations (titles, meta, OG tags, JSON-LD) + Articles #1, #3
**Month 2:** Articles #2, #4 + Add /about and /projects pages
**Month 3:** Articles #6, #11 + Add /uses page
**Month 4:** Articles #8, #10 + Cross-post to dev.to and Medium for backlinks

---

## Competitor Analysis

**Miguel Grinberg** (blog.miguelgrinberg.com) — Dominates Flask tutorials. Weakness: tutorials are standalone, no deployment/production content.

**Will Larson** (lethain.com / staffeng.com) — Dominates staff engineer content. Weakness: theoretical, not code-heavy. Last major update 2021.

**Full Stack Python** (fullstackpython.com) — Comprehensive reference. Weakness: reference-style, not tutorial/narrative.

**Dev.to / Medium** — High volume but individual articles rarely rank long-term. Cross-posting here builds backlinks to your canonical site.

Your edge: **You combine hands-on fullstack code with staff-level engineering experience.** Most Flask tutorial authors aren't staff engineers. Most staff engineer bloggers don't write code tutorials. You can own both lanes.
