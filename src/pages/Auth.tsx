import { useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import { Music, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Auth() {
  const [searchParams] = useSearchParams();
  const isSignup = searchParams.get("mode") === "signup";
  const [mode, setMode] = useState<"login" | "signup" | "reset">(isSignup ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/app");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({ title: "Check your email", description: "We sent you a confirmation link." });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({ title: "Check your email", description: "We sent you a password reset link." });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-navy p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <Music className="h-8 w-8 text-primary" />
          <span className="font-display text-2xl font-bold text-primary">SimchaSync</span>
        </Link>

        <Card className="border-secondary/20 bg-secondary/40 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-2xl text-secondary-foreground">
              {mode === "login" ? t.auth.login : mode === "signup" ? t.auth.signup : t.auth.resetPassword}
            </CardTitle>
            {mode === "signup" && (
              <CardDescription className="text-secondary-foreground/50">{t.auth.trialNote}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label className="text-secondary-foreground/70">{t.auth.name}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required className="border-secondary/30 bg-secondary/60 text-secondary-foreground" />
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-secondary-foreground/70">{t.auth.email}</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="border-secondary/30 bg-secondary/60 text-secondary-foreground" />
              </div>
              {mode !== "reset" && (
                <div className="space-y-2">
                  <Label className="text-secondary-foreground/70">{t.auth.password}</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="border-secondary/30 bg-secondary/60 text-secondary-foreground" />
                </div>
              )}
              <Button type="submit" className="w-full bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:opacity-90" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "login" ? t.auth.login : mode === "signup" ? t.auth.signup : t.auth.sendReset}
              </Button>
            </form>

            <div className="mt-6 space-y-2 text-center text-sm">
              {mode === "login" && (
                <>
                  <button onClick={() => setMode("reset")} className="text-primary hover:underline block mx-auto">{t.auth.forgotPassword}</button>
                  <p className="text-secondary-foreground/50">
                    {t.auth.noAccount}{" "}
                    <button onClick={() => setMode("signup")} className="text-primary hover:underline">{t.auth.signup}</button>
                  </p>
                </>
              )}
              {mode === "signup" && (
                <p className="text-secondary-foreground/50">
                  {t.auth.hasAccount}{" "}
                  <button onClick={() => setMode("login")} className="text-primary hover:underline">{t.auth.login}</button>
                </p>
              )}
              {mode === "reset" && (
                <button onClick={() => setMode("login")} className="flex items-center justify-center gap-1 text-primary hover:underline mx-auto">
                  <ArrowLeft className="h-4 w-4" /> {t.auth.login}
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}