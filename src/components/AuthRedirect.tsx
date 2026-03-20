import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function AuthRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const hash = window.location.hash;
    // If we're already on /reset-password, don't redirect again
    if (location.pathname === "/reset-password") return;
    
    // Catch invite or recovery tokens on any route and redirect to password setup
    // Supabase redirects with hash like: #access_token=...&type=invite
    if (
      hash.includes("type=invite") || 
      hash.includes("type=recovery") ||
      (hash.includes("access_token") && (hash.includes("type=invite") || hash.includes("type=recovery")))
    ) {
      navigate("/reset-password" + hash, { replace: true });
    }
  }, [navigate, location]);

  return null;
}
