import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ScrollToTop from "./components/ScrollToTop";
import ProtectedRoute from "./components/ProtectedRoute";
import WanderWorld from "./wander/WanderWorld";
import { useAuth } from "./hooks/useAuth";

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
          {/* The whole "site" is the wandering world. */}
          <Route path="/" element={<WanderWorld />} />

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
