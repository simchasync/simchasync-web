import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

// Auto sign-out after this much inactivity (no mouse/keyboard/touch/scroll).
const IDLE_LIMIT_MS = 10 * 60 * 1000; // 10 minutes
const IDLE_ACTIVITY_KEY = "ss:last-activity";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const urlAuthFailSafeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ensureOnboarding = useCallback(async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke("ensure-user-onboarding");
      if (error) {
        console.error("[AuthContext] ensure-user-onboarding failed", error);
      } else {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["tenant-id", userId] }),
          queryClient.invalidateQueries({ queryKey: ["user-tenants", userId] }),
          queryClient.invalidateQueries({ queryKey: ["user-role"] }),
        ]);
      }
    } catch (error) {
      console.error("[AuthContext] ensure-user-onboarding crashed", error);
    }
  }, [queryClient]);

  useEffect(() => {
    const hasPendingUrlAuth = () => {
      if (typeof window === "undefined") return false;
      const h = window.location.hash;
      const s = window.location.search;
      return h.includes("access_token=") || s.includes("code=");
    };

    const clearUrlAuthTimeout = () => {
      if (urlAuthFailSafeRef.current) {
        clearTimeout(urlAuthFailSafeRef.current);
        urlAuthFailSafeRef.current = null;
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        void ensureOnboarding(nextSession.user.id);
      }
      // getSession() can return null in the first tick while email-confirm
      // or PKCE ?code= is still being applied; keep splash until SIGNED_IN or fail-safe.
      if (event === "INITIAL_SESSION" && !nextSession && hasPendingUrlAuth()) {
        clearUrlAuthTimeout();
        urlAuthFailSafeRef.current = setTimeout(() => setLoading(false), 15_000);
        return;
      }
      clearUrlAuthTimeout();
      setLoading(false);
    });

    void (async () => {
      for (const ms of [0, 100, 400] as const) {
        if (ms) await new Promise((r) => setTimeout(r, ms));
        const { data: { session: s } } = await supabase.auth.getSession();
        if (s) {
          setSession(s);
          setUser(s.user);
          if (s.user) await ensureOnboarding(s.user.id);
          clearUrlAuthTimeout();
          setLoading(false);
          return;
        }
      }
      if (!hasPendingUrlAuth()) {
        setLoading(false);
      }
    })();

    return () => {
      subscription.unsubscribe();
      clearUrlAuthTimeout();
    };
  }, [ensureOnboarding]);

  // Auto-logout on inactivity. Activity is shared across tabs via localStorage,
  // so being active in any tab keeps the whole session alive; once every tab has
  // been idle for IDLE_LIMIT_MS the user is signed out.
  useEffect(() => {
    if (!user) return;

    let lastWrite = 0;
    const markActive = () => {
      const now = Date.now();
      if (now - lastWrite > 5_000) {
        lastWrite = now;
        try { localStorage.setItem(IDLE_ACTIVITY_KEY, String(now)); } catch { /* ignore */ }
      }
    };
    // Seed on mount so a fresh login isn't treated as already idle.
    try { localStorage.setItem(IDLE_ACTIVITY_KEY, String(Date.now())); } catch { /* ignore */ }

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));

    const interval = setInterval(() => {
      const last = Number(localStorage.getItem(IDLE_ACTIVITY_KEY)) || Date.now();
      if (Date.now() - last >= IDLE_LIMIT_MS) {
        toast({ title: "Signed out", description: "You were signed out after 10 minutes of inactivity." });
        void supabase.auth.signOut();
      }
    }, 30_000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, markActive));
      clearInterval(interval);
    };
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return <AuthContext.Provider value={{ user, session, loading, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
