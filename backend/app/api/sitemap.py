import logging

from flask import Blueprint, Response
from ..models.post import Post

logger = logging.getLogger(__name__)

sitemap_bp = Blueprint("sitemap", __name__)

BASE_URL = "https://chrisgonzalez.dev"

STATIC_PAGES = [
    {"path": "/", "priority": "1.0", "changefreq": "weekly"},
    {"path": "/about", "priority": "0.8", "changefreq": "monthly"},
    {"path": "/projects", "priority": "0.8", "changefreq": "monthly"},
    {"path": "/uses", "priority": "0.6", "changefreq": "monthly"},
    {"path": "/contact", "priority": "0.6", "changefreq": "monthly"},
    {"path": "/blog", "priority": "0.9", "changefreq": "weekly"},
]


def _url_entry(loc, changefreq, priority, lastmod=None):
    parts = [
        f"    <loc>{loc}</loc>",
        f"    <changefreq>{changefreq}</changefreq>",
        f"    <priority>{priority}</priority>",
    ]
    if lastmod:
        parts.insert(1, f"    <lastmod>{lastmod}</lastmod>")
    return "  <url>\n" + "\n".join(parts) + "\n  </url>"


@sitemap_bp.route("/sitemap.xml")
def sitemap():
    urls = [
        _url_entry(f"{BASE_URL}{page['path']}", page["changefreq"], page["priority"])
        for page in STATIC_PAGES
    ]

    try:
        posts = Post.query.filter_by(published=True).order_by(Post.created_at.desc()).all()
        for post in posts:
            lastmod = (post.updated_at or post.created_at).strftime("%Y-%m-%d")
            urls.append(
                _url_entry(f"{BASE_URL}/blog/{post.slug}", "monthly", "0.7", lastmod)
            )
    except Exception:
        logger.exception("Failed to query posts for sitemap, serving static-only sitemap")

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls) + "\n"
        "</urlset>"
    )

    return Response(xml, mimetype="application/xml")
