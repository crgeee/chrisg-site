import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPosts, getDrafts, deletePost, updatePost } from "../services/api";
import type { Post } from "../types";
import "./AdminDashboard.css";

interface AdminDashboardProps { onLogout: () => void; }

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [posts, setPosts] = useState<Post[]>([]);

  async function loadPosts() {
    const [published, drafts] = await Promise.all([getPosts(1), getDrafts()]);
    const all = [...published.posts, ...drafts.posts].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const seen = new Set<number>();
    setPosts(all.filter((p) => { if (seen.has(p.id)) return false; seen.add(p.id); return true; }));
  }

  useEffect(() => { loadPosts(); }, []);

  async function handleDelete(slug: string) {
    if (!confirm("Delete this post?")) return;
    await deletePost(slug);
    loadPosts();
  }

  async function handleTogglePublish(post: Post) {
    await updatePost(post.slug, { published: !post.published });
    loadPosts();
  }

  return (
    <div className="admin container fade-in">
      <div className="admin__header">
        <h1>Dashboard</h1>
        <div className="admin__actions">
          <Link to="/admin/new" className="admin__btn admin__btn--primary">New Post</Link>
          <button onClick={onLogout} className="admin__btn">Logout</button>
        </div>
      </div>
      <table className="admin__table">
        <thead><tr><th>Title</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id}>
              <td>{post.title}</td>
              <td><span className={`admin__status ${post.published ? "admin__status--live" : ""}`}>{post.published ? "Published" : "Draft"}</span></td>
              <td>{new Date(post.created_at).toLocaleDateString()}</td>
              <td className="admin__cell-actions">
                <Link to={`/admin/edit/${post.slug}`}>Edit</Link>
                <button onClick={() => handleTogglePublish(post)}>{post.published ? "Unpublish" : "Publish"}</button>
                <button onClick={() => handleDelete(post.slug)} className="admin__delete">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {posts.length === 0 && <p className="admin__empty">No posts yet. Create your first one!</p>}
    </div>
  );
}
