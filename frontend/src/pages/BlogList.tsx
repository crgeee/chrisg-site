import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPosts } from "../services/api";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import type { Post } from "../types";
import "./BlogList.css";

export default function BlogList() {
  useDocumentTitle("Blog");
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPosts(page).then((data) => {
      setPosts(data.posts);
      setTotalPages(data.pages);
    }).finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="blog-list container fade-in">
      <h1>Blog</h1>
      {loading ? (
        <p className="blog-list__loading">Loading...</p>
      ) : posts.length === 0 ? (
        <p className="blog-list__empty">No posts yet. Check back soon.</p>
      ) : (
        <>
          <div className="blog-list__posts">
            {posts.map((post) => (
              <Link to={`/blog/${post.slug}`} key={post.id} className="blog-list__card">
                <time>{new Date(post.created_at).toLocaleDateString("en-US", {
                  year: "numeric", month: "long", day: "numeric"
                })}</time>
                <h2>{post.title}</h2>
                <p>{post.excerpt}</p>
              </Link>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="blog-list__pagination">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>&larr; Newer</button>
              <span>Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Older &rarr;</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
