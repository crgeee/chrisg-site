import { Link } from "react-router-dom";
import "./Nav.css";

export default function Nav() {
  return (
    <nav className="nav">
      <div className="nav__inner">
        <Link to="/" className="nav__logo">Christopher R. Gonzalez</Link>
        <div className="nav__links">
          <Link to="/">Home</Link>
          <Link to="/blog">Blog</Link>
        </div>
      </div>
    </nav>
  );
}
