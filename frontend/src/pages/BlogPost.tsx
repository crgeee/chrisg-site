import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getPost } from "../services/api";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import type { Post } from "../types";
import "./BlogPost.css";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState(false);
  useDocumentTitle(post?.title);

  useEffect(() => {
    if (!slug) return;
    getPost(slug)
      .then(setPost)
      .catch(() => setError(true));
  }, [slug]);

  if (error) {
    return (
      <div className="blog-post container fade-in">
        <p>Post not found.</p>
        <Link to="/blog">&larr; Back to blog</Link>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="blog-post container fade-in">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <article className="blog-post container fade-in">
      <Link to="/blog" className="blog-post__back">&larr; Back to blog</Link>
      <header className="blog-post__header">
        <time>{new Date(post.created_at).toLocaleDateString("en-US", {
          year: "numeric", month: "long", day: "numeric"
        })}</time>
        <h1>{post.title}</h1>
      </header>
      <div className="blog-post__content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {post.content}
        </ReactMarkdown>
      </div>
    </article>
  );
}
