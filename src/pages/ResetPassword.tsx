import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { Music, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const tenantId = new URLSearchParams(window.location.search).get("tenant");

  // Detect if this is an invite flow from the hash (before Supabase consumes it)
  const hash = window.location.hash;
  const isInvite = hash.includes("type=invite");

  useEffect(() => {
    // Listen for auth state changes — Supabase will process the hash tokens
    // and fire TOKEN_REFRESHED or SIGNED_IN when the session is established
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") {
        if (session) {
          setSessionReady(true);
          setChecking(false);
        }
      }
    });

    // Also check if there's already a session (e.g., page refresh after token exchange)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      }
      setChecking(false);
    });

    // Timeout: if no session after 10s, redirect to auth
    const timeout = setTimeout(() => {
      setChecking(false);
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // If checking is done and no session, redirect to auth
  useEffect(() => {
    if (!checking && !sessionReady) {
      navigate(tenantId ? `/auth?tenant=${tenantId}` : "/auth");
    }
  }, [checking, sessionReady, navigate, tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Password updated", description: "You can now access your account." });
      navigate(tenantId ? `/app?tenant=${tenantId}` : "/app");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-navy p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-navy p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Music className="h-8 w-8 text-primary" />
          <span className="font-display text-2xl font-bold text-primary">SimchaSync</span>
        </div>
        <Card className="border-secondary/20 bg-secondary/40 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-2xl text-secondary-foreground">
              {isInvite ? "Set Your Password" : t.auth.resetPassword}
            </CardTitle>
            {isInvite && (
              <p className="text-sm text-secondary-foreground/60 mt-2">
                Create a password to access your team workspace.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-secondary-foreground/70">{t.auth.newPassword}</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="border-secondary/30 bg-secondary/60 text-secondary-foreground" />
              </div>
              <Button type="submit" className="w-full bg-gradient-gold text-primary-foreground font-semibold" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isInvite ? "Set Password & Continue" : t.auth.updatePassword}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
