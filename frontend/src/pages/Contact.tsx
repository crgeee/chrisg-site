import { useState } from "react";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "./Contact.css";

export default function Contact() {
  useDocumentTitle("Contact");
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setStatus("sent");
        setForm({ name: "", email: "", message: "" });
      } else {
        const data = await res.json().catch(() => null);
        setErrorMsg(data?.error || "Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch (err) {
      console.error("Contact form error:", err);
      setErrorMsg("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  };

  return (
    <div className="contact container fade-in">
      <h1 className="page-title">Contact</h1>
      <p className="page-intro">
        Have a question, want to collaborate, or just want to say hi? Send me a message.
      </p>

      {status === "sent" ? (
        <div className="contact__success">
          <p>Message sent. I'll get back to you soon.</p>
        </div>
      ) : (
        <form className="contact__form" onSubmit={handleSubmit}>
          <div className="contact__field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your name"
            />
          </div>
          <div className="contact__field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
            />
          </div>
          <div className="contact__field">
            <label htmlFor="message">Message</label>
            <textarea
              id="message"
              required
              rows={6}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="What's on your mind?"
            />
          </div>
          {status === "error" && (
            <p className="contact__error">{errorMsg}</p>
          )}
          <button type="submit" disabled={status === "sending"} className="contact__submit">
            {status === "sending" ? "Sending..." : "Send message"}
          </button>
        </form>
      )}
    </div>
  );
}
