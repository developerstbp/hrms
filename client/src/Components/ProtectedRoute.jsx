import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, permission }) {
  const { user, loading, hasPermission } = useAuth();
  const location = useLocation();
  if (loading) return <div className="screen-loader"><span className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword && location.pathname !== "/profile") return <Navigate to="/profile" replace />;
  const allowed = !permission || (Array.isArray(permission) ? permission.some(hasPermission) : hasPermission(permission));
  if (!allowed) return <Navigate to="/dashboard" replace />;
  return children;
}
