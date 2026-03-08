from flask import Blueprint, Response, url_for
from ..models.post import Post

sitemap_bp = Blueprint("sitemap", __name__)

STATIC_PAGES = [
    {"path": "/", "priority": "1.0", "changefreq": "weekly"},
    {"path": "/about", "priority": "0.8", "changefreq": "monthly"},
    {"path": "/projects", "priority": "0.8", "changefreq": "monthly"},
    {"path": "/uses", "priority": "0.6", "changefreq": "monthly"},
    {"path": "/blog", "priority": "0.9", "changefreq": "weekly"},
]

@sitemap_bp.route("/sitemap.xml")
def sitemap():
    base = "https://chrisgonzalez.dev"
    urls = []

    for page in STATIC_PAGES:
        urls.append(
            f'  <url>\n'
            f'    <loc>{base}{page["path"]}</loc>\n'
            f'    <changefreq>{page["changefreq"]}</changefreq>\n'
            f'    <priority>{page["priority"]}</priority>\n'
            f'  </url>'
        )

    posts = Post.query.filter_by(published=True).order_by(Post.created_at.desc()).all()
    for post in posts:
        lastmod = post.updated_at.strftime("%Y-%m-%d") if post.updated_at else post.created_at.strftime("%Y-%m-%d")
        urls.append(
            f'  <url>\n'
            f'    <loc>{base}/blog/{post.slug}</loc>\n'
            f'    <lastmod>{lastmod}</lastmod>\n'
            f'    <changefreq>monthly</changefreq>\n'
            f'    <priority>0.7</priority>\n'
            f'  </url>'
        )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls) + "\n"
        '</urlset>'
    )

    return Response(xml, mimetype="application/xml")
