import { Navigate, Outlet } from "react-router-dom";
import type { User } from "../types";

export default function ProtectedRoute({ user }: { user: User | null }) {
  if (!user) return <Navigate to="/admin/login" replace />;
  return <Outlet />;
}
