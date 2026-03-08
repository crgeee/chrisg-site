import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createPost, updatePost, getPost } from "../services/api";
import "./PostEditor.css";

export default function PostEditor() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(slug);

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (slug) {
      getPost(slug).then((post) => {
        setTitle(post.title);
        setExcerpt(post.excerpt);
        setContent(post.content);
        setPublished(post.published);
      }).catch(() => navigate("/admin"));
    }
  }, [slug, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEditing && slug) {
        await updatePost(slug, { title, excerpt, content, published });
      } else {
        await createPost({ title, excerpt, content, published });
      }
      navigate("/admin");
    } catch {
      alert("Failed to save post");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="editor container--wide fade-in">
      <h1>{isEditing ? "Edit Post" : "New Post"}</h1>
      <div className="editor__layout">
        <form className="editor__form" onSubmit={handleSubmit}>
          <label>Title<input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
          <label>Excerpt<input type="text" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} required /></label>
          <label>Content (Markdown)<textarea value={content} onChange={(e) => setContent(e.target.value)} rows={20} required /></label>
          <label className="editor__checkbox"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />Published</label>
          <div className="editor__buttons">
            <button type="submit" className="admin__btn admin__btn--primary" disabled={saving}>{saving ? "Saving..." : isEditing ? "Update" : "Create"}</button>
            <button type="button" className="admin__btn" onClick={() => navigate("/admin")}>Cancel</button>
          </div>
        </form>
        <div className="editor__preview">
          <h2>Preview</h2>
          <div className="blog-post__content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || "*Start writing to see preview...*"}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
