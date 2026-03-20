import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    const path = location.pathname;
    if (user && (path === "/auth" || path === "/")) {
      navigate("/app", { replace: true });
    }
    if (!user && path.startsWith("/app")) {
      navigate("/auth", { replace: true });
    }
  }, [user, loading, location.pathname, navigate]);

  return null;
}