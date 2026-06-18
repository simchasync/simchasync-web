import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Shield, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { hasAnyAdminRole, loading: roleLoading } = useAdminRole();
  const navigate = useNavigate();
  const { toast } = useToast();

  // If already logged in with admin role, redirect
  useEffect(() => {
    if (!authLoading && !roleLoading && user) {
      if (hasAnyAdminRole) {
        navigate("/admin/overview", { replace: true });
      } else {
        setAccessDenied(true);
      }
    }
  }, [authLoading, roleLoading, user, hasAnyAdminRole, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAccessDenied(false);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Role check will happen via useEffect after auth state updates
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setAccessDenied(false);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        // Return to /admin so the role check + redirect to /admin/overview runs
        // (or "Access Denied" shows if the Google account isn't an admin).
        options: { redirectTo: `${window.location.origin}/admin` },
      });
      if (error) {
        if (error.code === "validation_failed" && error.message?.includes("Unsupported provider")) {
          throw new Error(
            "Google auth is not enabled in Supabase. Enable the Google provider in your Supabase Auth settings and add the redirect URL /admin."
          );
        }
        throw error;
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Unable to sign in with Google.", variant: "destructive" });
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAccessDenied(false);
  };

  if (authLoading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-navy">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-navy p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Shield className="h-8 w-8 text-primary" />
          <span className="font-display text-2xl font-bold text-primary">Admin Portal</span>
        </div>

        {accessDenied ? (
          <Card className="border-destructive/30 bg-secondary/40 backdrop-blur-sm">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="font-display text-xl text-secondary-foreground">
                Access Denied
              </CardTitle>
              <CardDescription className="text-secondary-foreground/50">
                Your account does not have administrator privileges.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleSignOut} variant="outline" className="w-full">
                Sign Out & Try Another Account
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-secondary/20 bg-secondary/40 backdrop-blur-sm">
            <CardHeader className="text-center">
              <CardTitle className="font-display text-2xl text-secondary-foreground">
                Admin Login
              </CardTitle>
              <CardDescription className="text-secondary-foreground/50">
                Sign in with your administrator credentials
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-secondary-foreground/70">Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border-secondary/30 bg-secondary/60 text-secondary-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-secondary-foreground/70">Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="border-secondary/30 bg-secondary/60 text-secondary-foreground"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:opacity-90"
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </form>

              <div className="mt-4">
                <div className="flex items-center gap-3 text-xs text-secondary-foreground/40">
                  <span className="block h-px flex-1 bg-secondary/30" />
                  <span>Or</span>
                  <span className="block h-px flex-1 bg-secondary/30" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full border-secondary/30 bg-secondary/60 text-secondary-foreground hover:bg-secondary/80"
                  disabled={loading}
                  onClick={handleGoogleAuth}
                >
                  <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                      <path d="M23.64 12.204c0-.78-.07-1.53-.2-2.25H12v4.26h6.34c-.27 1.47-1.07 2.72-2.3 3.56v2.96h3.72c2.17-2 3.42-4.95 3.42-8.53Z" fill="#4285F4"/>
                      <path d="M12 24c2.97 0 5.46-.98 7.28-2.66l-3.72-2.96c-1.03.69-2.36 1.1-3.56 1.1-2.74 0-5.05-1.85-5.88-4.34H2.24v2.72C4.03 21.88 7.74 24 12 24Z" fill="#34A853"/>
                      <path d="M6.12 14.14a7.3 7.3 0 0 1 0-4.28V7.14H2.24a11.95 11.95 0 0 0 0 9.72l3.88-2.72Z" fill="#FBBC05"/>
                      <path d="M12 4.48c1.62 0 3.08.56 4.23 1.66l3.17-3.18C17.44 1.1 14.96 0 12 0 7.74 0 4.03 2.12 2.24 5.86l3.88 2.72C6.95 6.33 9.26 4.48 12 4.48Z" fill="#EA4335"/>
                    </svg>
                  </span>
                  Continue with Google
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
