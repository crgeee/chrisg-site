import { Outlet } from "react-router-dom";
import Nav from "./Nav";
import "./Layout.css";

export default function Layout() {
  return (
    <div className="layout">
      <Nav />
      <main className="layout__content"><Outlet /></main>
      <footer className="layout__footer">
        <div className="container">
          <p>&copy; {new Date().getFullYear()} Christopher R. Gonzalez</p>
        </div>
      </footer>
    </div>
  );
}
