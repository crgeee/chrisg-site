import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<void>;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await onLogin(username, password);
      navigate("/admin");
    } catch {
      setError("Invalid credentials");
    }
  }

  return (
    <div className="login container fade-in">
      <form className="login__form" onSubmit={handleSubmit}>
        <h1>Admin Login</h1>
        {error && <p className="login__error">{error}</p>}
        <label>
          Username
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit">Sign In</button>
      </form>
    </div>
  );
}
