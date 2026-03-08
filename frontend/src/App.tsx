import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ScrollToTop from "./components/ScrollToTop";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import { useAuth } from "./hooks/useAuth";

const About = lazy(() => import("./pages/About"));
const Projects = lazy(() => import("./pages/Projects"));
const Uses = lazy(() => import("./pages/Uses"));
const Contact = lazy(() => import("./pages/Contact"));
const BlogList = lazy(() => import("./pages/BlogList"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Login = lazy(() => import("./pages/Login"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const PostEditor = lazy(() => import("./pages/PostEditor"));

export default function App() {
  const { user, login, logout } = useAuth();

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Suspense fallback={null}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/uses" element={<Uses />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/blog" element={<BlogList />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/admin/login" element={<Login onLogin={login} />} />
            <Route element={<ProtectedRoute user={user} />}>
              <Route path="/admin" element={<AdminDashboard onLogout={logout} />} />
              <Route path="/admin/new" element={<PostEditor />} />
              <Route path="/admin/edit/:slug" element={<PostEditor />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
