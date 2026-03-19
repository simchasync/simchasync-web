// Lovable integration stub for external Supabase projects
// OAuth sign-in should be handled directly via supabase.auth.signInWithOAuth()

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple", opts?: { redirect_uri?: string; extraParams?: Record<string, string> }) => {
      console.warn("lovable.auth.signInWithOAuth is not available with external Supabase. Use supabase.auth.signInWithOAuth() directly.");
      return { error: new Error("Use supabase.auth.signInWithOAuth() directly with external Supabase projects.") };
    },
  },
};