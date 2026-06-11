import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import { Music, ArrowLeft, ArrowRight, Loader2, Eye, EyeOff, Send, MailCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ThemeToggle from "@/components/ThemeToggle";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthMode = "login" | "signup" | "reset";

interface FieldState {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  phone: string;
}

const INITIAL_FIELDS: FieldState = {
  email: "",
  password: "",
  confirmPassword: "",
  name: "",
  phone: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function modeFromPath(pathname: string): AuthMode {
  if (pathname === "/auth/register") return "signup";
  if (pathname === "/auth/login") return "login";
  return "login";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function FormField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function ModeTabs({
  mode,
  onLogin,
  onSignup,
}: {
  mode: AuthMode;
  onLogin: () => void;
  onSignup: () => void;
}) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
      {(["login", "signup"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={m === "login" ? onLogin : onSignup}
          className={[
            "rounded-md py-1.5 text-sm font-medium transition-all",
            mode === m
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {m === "login" ? "Log in" : "Sign up"}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Auth() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [mode, setMode] = useState<AuthMode>(() => modeFromPath(location.pathname));
  const [fields, setFields] = useState<FieldState>(INITIAL_FIELDS);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  // Sync mode when URL changes (e.g. back/forward)
  useEffect(() => {
    setMode(modeFromPath(location.pathname));
    setAwaitingConfirmation(false);
  }, [location.pathname]);

  const setField = useCallback(
    (key: keyof FieldState) => (value: string) =>
      setFields((prev) => ({ ...prev, [key]: value })),
    []
  );

  const goLogin = () => navigate("/auth/login");
  const goSignup = () => navigate("/auth/register");
  const goReset = () => setMode("reset");

  // ── Resend confirmation ────────────────────────────────────────────────────

  const handleResend = async () => {
    if (!fields.email.trim()) {
      toast({ title: "Error", description: t.auth.resendEmailMissing, variant: "destructive" });
      return;
    }
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: fields.email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      toast({ title: t.auth.confirmEmailTitle, description: t.auth.resendConfirmationSuccess });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not resend";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setResendLoading(false);
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: fields.email,
          password: fields.password,
        });
        if (error) throw error;
        navigate("/app");

      } else if (mode === "signup") {
        if (!fields.name.trim()) {
          toast({ title: "Error", description: "Enter your full name.", variant: "destructive" });
          return;
        }
        if (!fields.phone.trim()) {
          toast({ title: "Error", description: "Enter your phone number.", variant: "destructive" });
          return;
        }
        if (fields.password !== fields.confirmPassword) {
          toast({ title: "Error", description: t.auth.passwordsDoNotMatch, variant: "destructive" });
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: fields.email,
          password: fields.password,
          options: {
            data: { full_name: fields.name.trim(), phone: fields.phone.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate("/app");
          return;
        }
        setAwaitingConfirmation(true);
        toast({ title: t.auth.confirmEmailTitle, description: t.auth.confirmEmailDescription });

      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(fields.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({ title: "Check your email", description: "We sent you a password reset link." });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/phone`,
        },
      });
      if (error) {
        if (error.code === "validation_failed" && error.message?.includes("Unsupported provider")) {
          throw new Error(
            "Google auth is not enabled in Supabase. Enable the Google provider in your Supabase Auth settings and add the redirect URL /auth/phone."
          );
        }
        throw error;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in with Google.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Derived UI values ──────────────────────────────────────────────────────

  const submitLabel = {
    login: t.auth.login,
    signup: t.auth.signup,
    reset: t.auth.sendReset,
  }[mode];

  const headingLabel = {
    login: t.auth.login,
    signup: t.auth.signup,
    reset: t.auth.resetPassword,
  }[mode];

  const busy = loading || resendLoading;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4">
      {/* Theme toggle */}
      <div className="absolute right-4 top-4">
        <ThemeToggle variant="icon" />
      </div>

      {/* Logo */}
      <Link
        to="/"
        className="mb-8 flex items-center gap-2.5 transition-opacity hover:opacity-80"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Music className="h-4 w-4 text-primary" />
        </div>
        <span className="font-display text-lg font-semibold tracking-tight">SimchaSync</span>
      </Link>

      {/* Card */}
      <Card className="w-full max-w-sm border-border/60 shadow-sm">
        <CardContent className="p-7">

          {awaitingConfirmation ? (
            /* ── Email confirmation screen (replaces form) ── */
            <div className="space-y-6 py-2 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <MailCheck className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold">Check your email</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  We sent a confirmation link to
                </p>
                <p className="mt-0.5 text-sm font-medium text-foreground break-all">{fields.email}</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Click the link in the email to activate your account.
                It expires in 24 hours.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={resendLoading}
                onClick={handleResend}
              >
                {resendLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t.auth.resendConfirmation}
              </Button>
              <button
                type="button"
                onClick={goLogin}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              {/* Mode tabs (login / signup only) */}
              {mode !== "reset" && (
                <ModeTabs mode={mode} onLogin={goLogin} onSignup={goSignup} />
              )}

              {/* Heading for reset */}
              {mode === "reset" && (
                <div className="mb-6 text-center">
                  <h1 className="font-display text-xl font-semibold">{headingLabel}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enter your email and we'll send a reset link.
                  </p>
                </div>
              )}

              {/* Trial note */}
              {mode === "signup" && (
                <p className="mb-5 text-center text-xs text-muted-foreground">
                  {t.auth.trialNote}
                </p>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {mode === "signup" && (
                  <>
                    <FormField label={t.auth.name} htmlFor="name">
                      <Input
                        id="name"
                        value={fields.name}
                        onChange={(e) => setField("name")(e.target.value)}
                        autoComplete="name"
                        required
                      />
                    </FormField>
                    <FormField label={t.auth.phone} htmlFor="phone">
                      <Input
                        id="phone"
                        type="tel"
                        value={fields.phone}
                        onChange={(e) => setField("phone")(e.target.value)}
                        autoComplete="tel"
                      />
                    </FormField>
                  </>
                )}

                <FormField label={t.auth.email} htmlFor="email">
                  <Input
                    id="email"
                    type="email"
                    value={fields.email}
                    onChange={(e) => setField("email")(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </FormField>

                {mode !== "reset" && (
                  <FormField label={t.auth.password} htmlFor="password">
                    <PasswordInput
                      id="password"
                      value={fields.password}
                      onChange={setField("password")}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                    />
                  </FormField>
                )}

                {mode === "signup" && (
                  <FormField label={t.auth.confirmPassword} htmlFor="confirm-password">
                    <PasswordInput
                      id="confirm-password"
                      value={fields.confirmPassword}
                      onChange={setField("confirmPassword")}
                      autoComplete="new-password"
                    />
                  </FormField>
                )}

                {/* Forgot password link */}
                {mode === "login" && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={goReset}
                      className="text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                    >
                      {t.auth.forgotPassword}
                    </button>
                  </div>
                )}

                {/* Submit */}
                <Button type="submit" className="w-full gap-2 font-semibold" disabled={busy}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : mode === "reset" ? (
                    <Send className="h-4 w-4" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {submitLabel}
                </Button>
              </form>

              {(mode === "login" || mode === "signup") && (
                <div className="mt-4">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="block h-px flex-1 bg-border" />
                    <span>Or</span>
                    <span className="block h-px flex-1 bg-border" />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 w-full"
                    disabled={busy}
                    onClick={handleGoogleAuth}
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                          <path d="M23.64 12.204c0-.78-.07-1.53-.2-2.25H12v4.26h6.34c-.27 1.47-1.07 2.72-2.3 3.56v2.96h3.72c2.17-2 3.42-4.95 3.42-8.53Z" fill="#4285F4"/>
                          <path d="M12 24c2.97 0 5.46-.98 7.28-2.66l-3.72-2.96c-1.03.69-2.36 1.1-3.56 1.1-2.74 0-5.05-1.85-5.88-4.34H2.24v2.72C4.03 21.88 7.74 24 12 24Z" fill="#34A853"/>
                          <path d="M6.12 14.14a7.3 7.3 0 0 1 0-4.28V7.14H2.24a11.95 11.95 0 0 0 0 9.72l3.88-2.72Z" fill="#FBBC05"/>
                          <path d="M12 4.48c1.62 0 3.08.56 4.23 1.66l3.17-3.18C17.44 1.1 14.96 0 12 0 7.74 0 4.03 2.12 2.24 5.86l3.88 2.72C6.95 6.33 9.26 4.48 12 4.48Z" fill="#EA4335"/>
                        </svg>
                      </span>
                    )}
                    {mode === "login" ? "Continue with Google" : "Sign up with Google"}
                  </Button>
                </div>
              )}

              {/* Footer links */}
              <div className="mt-5 text-center text-sm text-muted-foreground">
                {mode === "login" && (
                  <p>
                    {t.auth.noAccount}{" "}
                    <button
                      type="button"
                      onClick={goSignup}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {t.auth.signup}
                    </button>
                  </p>
                )}
                {mode === "signup" && (
                  <p>
                    {t.auth.hasAccount}{" "}
                    <button
                      type="button"
                      onClick={goLogin}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {t.auth.login}
                    </button>
                  </p>
                )}
                {mode === "reset" && (
                  <button
                    type="button"
                    onClick={goLogin}
                    className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    {t.auth.login}
                  </button>
                )}
              </div>
            </>
          )}

        </CardContent>
      </Card>
    </div>
  );
}