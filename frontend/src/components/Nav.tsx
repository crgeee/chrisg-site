import { Link } from "react-router-dom";
import "./Nav.css";

export default function Nav() {
  return (
    <nav className="nav">
      <div className="nav__inner">
        <Link to="/" className="nav__logo">CRG</Link>
        <div className="nav__links">
          <Link to="/about">About</Link>
          <Link to="/projects">Projects</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/uses">Uses</Link>
        </div>
      </div>
    </nav>
  );
}
