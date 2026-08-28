import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export function ProtectedRoute({ children, requireSpv = false, requireMonitor = false }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-emerald-50">
        <Loader2 className="animate-spin text-emerald-800" size={28} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.status === "pending") return <Navigate to="/pending" replace />;
  if (user.status === "rejected") return <Navigate to="/login" replace />;
  if (requireSpv && user.role !== "spv") return <Navigate to="/" replace />;
  if (requireMonitor && !(user.role === "spv" || user.can_monitor)) return <Navigate to="/" replace />;
  return children;
}
