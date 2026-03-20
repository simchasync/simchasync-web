import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { QueryClient, useQueryClient } from "@tanstack/react-query";

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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        void ensureOnboarding(nextSession.user.id);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(async ({ data: { session: nextSession } }) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        await ensureOnboarding(nextSession.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
