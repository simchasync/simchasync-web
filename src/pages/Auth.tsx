import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import { Music, ArrowLeft, Loader2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ThemeToggle from "@/components/ThemeToggle";

export default function Auth() {
  const location = useLocation();
  const isLoginPath = location.pathname === "/auth/login";
  const isRegisterPath = location.pathname === "/auth/register";
  const [searchParams] = useSearchParams();
  const searchSignup = searchParams.get("mode") === "signup";
  const [mode, setMode] = useState<"login" | "signup" | "reset">(() => {
    if (isRegisterPath) return "signup";
    if (isLoginPath) return "login";
    return searchSignup ? "signup" : "login";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [awaitingEmailConfirmation, setAwaitingEmailConfirmation] = useState(false);
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoginPath) setMode("login");
    else if (isRegisterPath) setMode("signup");
  }, [isLoginPath, isRegisterPath]);

  useEffect(() => {
    if (mode !== "signup") setAwaitingEmailConfirmation(false);
  }, [mode]);

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      toast({ title: "Error", description: t.auth.resendEmailMissing, variant: "destructive" });
      return;
    }
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      toast({ title: t.auth.confirmEmailTitle, description: t.auth.resendConfirmationSuccess });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not resend";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setResendLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/app");
      } else if (mode === "signup") {
        if (password !== confirmPassword) {
          toast({ title: "Error", description: t.auth.passwordsDoNotMatch, variant: "destructive" });
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (data.session) {
          setAwaitingEmailConfirmation(false);
          toast({ title: t.auth.signup, description: t.auth.signedInWelcome });
          navigate("/app");
          return;
        }
        setAwaitingEmailConfirmation(true);
        toast({ title: t.auth.confirmEmailTitle, description: t.auth.confirmEmailDescription });
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
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-navy p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle variant="icon" className="hover:bg-secondary/30" />
      </div>
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
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      className="border-secondary/30 bg-secondary/60 pr-10 text-secondary-foreground"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-1/2 h-9 w-9 -translate-y-1/2 text-secondary-foreground/60 hover:text-secondary-foreground"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label className="text-secondary-foreground/70">{t.auth.confirmPassword}</Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="border-secondary/30 bg-secondary/60 pr-10 text-secondary-foreground"
                      autoComplete="new-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-1/2 h-9 w-9 -translate-y-1/2 text-secondary-foreground/60 hover:text-secondary-foreground"
                      onClick={() => setShowConfirmPassword((s) => !s)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      aria-pressed={showConfirmPassword}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
              <Button type="submit" className="w-full bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:opacity-90" disabled={loading || resendLoading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "login" ? t.auth.login : mode === "signup" ? t.auth.signup : t.auth.sendReset}
              </Button>
            </form>

            {mode === "signup" && awaitingEmailConfirmation && (
              <div className="mt-4 space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
                <p className="text-sm text-secondary-foreground/90">{t.auth.confirmEmailDescription}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-primary/30"
                  disabled={resendLoading || loading}
                  onClick={handleResendConfirmation}
                >
                  {resendLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t.auth.resendConfirmation}
                </Button>
              </div>
            )}

            <div className="mt-6 space-y-2 text-center text-sm">
              {mode === "login" && (
                <>
                  <button onClick={() => setMode("reset")} className="text-primary hover:underline block mx-auto">{t.auth.forgotPassword}</button>
                  <p className="text-secondary-foreground/50">
                    {t.auth.noAccount}{" "}
                    <button type="button" onClick={() => navigate("/auth/register")} className="text-primary hover:underline">{t.auth.signup}</button>
                  </p>
                </>
              )}
              {mode === "signup" && (
                <p className="text-secondary-foreground/50">
                  {t.auth.hasAccount}{" "}
                  <button type="button" onClick={() => navigate("/auth/login")} className="text-primary hover:underline">{t.auth.login}</button>
                </p>
              )}
              {mode === "reset" && (
                <button type="button" onClick={() => { setMode("login"); navigate("/auth/login"); }} className="flex items-center justify-center gap-1 text-primary hover:underline mx-auto">
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