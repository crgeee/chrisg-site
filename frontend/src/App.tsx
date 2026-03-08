import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import BlogList from "./pages/BlogList";
import BlogPost from "./pages/BlogPost";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import PostEditor from "./pages/PostEditor";
import { useAuth } from "./hooks/useAuth";

export default function App() {
  const { user, login, logout } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
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
    </BrowserRouter>
  );
}
