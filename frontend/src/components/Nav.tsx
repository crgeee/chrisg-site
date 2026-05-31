import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import "./Nav.css";

const LINKS = [
  { to: "/about", label: "About" },
  { to: "/projects", label: "Projects" },
  { to: "/blog", label: "Blog" },
  { to: "/uses", label: "Uses" },
  { to: "/contact", label: "Contact" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`nav ${scrolled ? "is-scrolled" : ""}`}>
      <div className="nav__inner">
        <Link to="/" className="nav__logo" aria-label="Home">
          <span className="nav__logo-mark" aria-hidden="true" />
          CRG
        </Link>
        <div className="nav__links">
          {LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? "is-active" : "")}
            >
              {label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
