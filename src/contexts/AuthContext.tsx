import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

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
