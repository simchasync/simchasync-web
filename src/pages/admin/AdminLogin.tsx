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
        navigate("/admin/tenants", { replace: true });
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
