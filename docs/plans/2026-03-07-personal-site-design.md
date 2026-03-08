# Personal Site Design -- chrisg-site

**Date:** 2026-03-07
**Purpose:** Personal website (Home + Blog) to demonstrate fullstack Flask + React skills for an Apple MLAI fullstack engineer role.

## Architecture

**Monorepo** with two applications: Flask REST API backend and React TypeScript frontend.

### Backend (Flask API)

- Flask application organized with Blueprints
- Exposes a RESTful JSON API consumed by the React frontend
- SQLAlchemy ORM with SQLite (swappable to PostgreSQL)
- Flask-Migrate (Alembic) for database schema migrations
- JWT authentication via Flask-JWT-Extended (stateless, no server-side sessions)
- Serves zero HTML -- only JSON responses and static files (built React app in production)

### Frontend (React + TypeScript)

- Single-page application built with React and TypeScript
- Vite for dev server and build tooling
- React Router for client-side routing
- Two areas: public site (Home, Blog) and authenticated admin panel
- In production, built to static files and served by Flask/Nginx

### Communication

- All frontend-backend communication over REST API returning JSON
- JWT stored in memory (not localStorage) and sent via Authorization headers

### Project Structure

```
chrisg-site/
├── backend/
│   ├── app/
│   │   ├── __init__.py          # App factory
│   │   ├── config.py            # Configuration classes
│   │   ├── models/
│   │   │   ├── user.py          # User model
│   │   │   └── post.py          # Blog post model
│   │   ├── api/
│   │   │   ├── auth.py          # Login/register/refresh endpoints
│   │   │   ├── posts.py         # CRUD endpoints for blog posts
│   │   │   └── health.py        # Health check endpoint
│   │   └── extensions.py        # SQLAlchemy, Migrate, JWT init
│   ├── migrations/              # Alembic migrations
│   ├── tests/
│   ├── requirements.txt
│   └── wsgi.py                  # Gunicorn entrypoint
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   ├── pages/               # Home, Blog, Admin pages
│   │   ├── hooks/               # Custom React hooks
│   │   ├── services/            # API client functions
│   │   ├── types/               # TypeScript interfaces
│   │   └── App.tsx              # Router + layout
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── docker-compose.yml
├── Dockerfile
├── nginx.conf
└── .github/workflows/deploy.yml
```

## Data Models

### User

| Field         | Type     | Notes                          |
|---------------|----------|--------------------------------|
| id            | Integer  | Primary key                    |
| username      | String   | Unique                         |
| email         | String   | Unique                         |
| password_hash | String   | Werkzeug bcrypt-based hashing  |
| created_at    | DateTime | Auto-set on creation           |

No public registration. Single admin user only.

### Post

| Field      | Type     | Notes                                    |
|------------|----------|------------------------------------------|
| id         | Integer  | Primary key                              |
| title      | String   | Post headline                            |
| slug       | String   | URL-friendly, auto-generated, editable   |
| content    | Text     | Markdown body                            |
| excerpt    | String   | Short preview for listing page           |
| published  | Boolean  | Draft vs. public toggle                  |
| created_at | DateTime | Auto-set on creation                     |
| updated_at | DateTime | Auto-updated on edits                    |
| author_id  | Integer  | FK to User                               |

**Relationship:** User has many Posts (one-to-many).

## API Endpoints

### Auth (`/api/auth/`)

| Method | Endpoint            | Auth     | Description                    |
|--------|---------------------|----------|--------------------------------|
| POST   | /api/auth/login     | Public   | Returns JWT access + refresh   |
| POST   | /api/auth/refresh   | Refresh  | Returns new access token       |
| GET    | /api/auth/me        | Required | Current user info              |

### Posts (`/api/posts/`)

| Method | Endpoint            | Auth     | Description                    |
|--------|---------------------|----------|--------------------------------|
| GET    | /api/posts          | Public   | List published posts (paginated) |
| GET    | /api/posts/<slug>   | Public   | Single post by slug (published only) |
| POST   | /api/posts          | Required | Create new post                |
| PUT    | /api/posts/<slug>   | Required | Update a post                  |
| DELETE | /api/posts/<slug>   | Required | Delete a post                  |
| GET    | /api/posts/drafts   | Required | List unpublished drafts        |

### Utility

| Method | Endpoint     | Auth   | Description        |
|--------|------------- |--------|--------------------|
| GET    | /api/health  | Public | Health check       |

All protected endpoints require `Authorization: Bearer <token>`. Unauthorized = 401.

## Frontend Pages

### Public

- **Home** -- Hero with name ("Christopher R. Gonzalez"), one-liner ("Staff Software Engineer -- Building scalable platforms for millions of users"), location, links to LinkedIn/GitHub/email. Brief about blurb. 3 most recent blog posts.
- **Blog List** -- Published posts with title, excerpt, date. Paginated. Newest first.
- **Blog Detail** -- Full markdown-rendered post. Syntax-highlighted code blocks. Clean reading typography.

### Admin (authenticated)

- **Login** -- Username + password form. No public registration.
- **Dashboard** -- Table of all posts (published + drafts) with title, status, date, actions (edit, delete, toggle publish). "New Post" button.
- **Post Editor** -- Form: title, excerpt, content textarea (markdown with preview), published checkbox. Used for create and edit.

### Design System

- **Font:** System font stack (`-apple-system, BlinkMacSystemFont, "SF Pro"...`)
- **Colors:** Near-black text on white, one accent color for links/buttons
- **Spacing:** Generous padding and margins
- **Responsive:** Mobile and desktop
- **CSS:** Hand-written, no framework
- **Style:** Apple-inspired -- big typography, whitespace, subtle fade-in animations

## CI/CD & Deployment

### GitHub

- Private repository
- Created via `gh` CLI

### GitHub Actions (`.github/workflows/deploy.yml`)

On every push to `main`:
1. **Test** -- pytest (backend) + lint/type-check (frontend)
2. **Build** -- Docker image
3. **Deploy** -- SSH into Hetzner VPS, pull latest, `docker-compose up --build -d`

### Hetzner VPS

- Docker + Docker Compose
- Nginx reverse proxy with Let's Encrypt SSL (Certbot, auto-renewing)
- Deploy SSH key stored as GitHub Actions secret
- `.env` on VPS with production secrets (JWT key, database URL)

### GitHub Actions Secrets

- `VPS_HOST` -- Hetzner IP or domain
- `VPS_SSH_KEY` -- Deploy key
- `VPS_USER` -- SSH username

### Docker

- Multi-stage Dockerfile: build React frontend, copy into Flask backend image
- Gunicorn serves Flask app
- SQLite as Docker volume for persistence
- Nginx serves static files directly, proxies `/api/*` to Gunicorn

## Learning Approach

Code will be built incrementally (models -> API -> frontend -> deployment) with detailed inline comments explaining what each piece does and why. Explanations provided at each step.
