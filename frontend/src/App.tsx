import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ScrollToTop from "./components/ScrollToTop";
import ProtectedRoute from "./components/ProtectedRoute";
import WanderWorld from "./wander/WanderWorld";
import { PIXI_WORLD } from "./wander/featureFlags";
import { useAuth } from "./hooks/useAuth";

// The Pixi (WebGL) world is lazy-loaded so the Pixi bundle is code-split and
// never weighs down the SVG homepage or the blog/admin routes.
const PixiWanderWorld = lazy(() => import("./wander/PixiWanderWorld"));

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
          {/* The whole "site" is the wandering world. The SVG engine is the
              production default; the Pixi (WebGL) path is opt-in behind the
              PIXI_WORLD flag (`?pixi=1` or VITE_PIXI_WORLD=true). */}
          <Route path="/" element={PIXI_WORLD ? <PixiWanderWorld /> : <WanderWorld />} />

          {/* Debug route: always render the Pixi path, regardless of the flag. */}
          <Route path="/wander-v2" element={<PixiWanderWorld />} />

          {/* Blog (reading) + admin keep the simple chrome. */}
          <Route element={<Layout />}>
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
