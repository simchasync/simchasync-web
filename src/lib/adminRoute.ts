// ── Admin route base ──────────────────────────────────────────────────────────
// The admin portal lives behind an obscured, hard-to-guess path instead of the
// obvious `/admin`. This is defense-in-depth ONLY — the real protection is the
// server-side role checks in every admin edge function and the RLS policies.
// Obscuring the path just keeps the admin login off bots/scanners and casual
// discovery.
//
// To rotate the admin URL later, change this ONE value (keep the leading slash,
// no trailing slash) and redeploy. Remember to also update the Supabase Auth
// "Redirect URLs" allow-list so Google/OAuth admin sign-in can return here.
export const ADMIN_BASE = "/mgmt-9f27qk3x";

/** Build an admin path, e.g. adminPath("overview") -> "/mgmt-9f27qk3x/overview". */
export const adminPath = (sub = ""): string =>
  sub ? `${ADMIN_BASE}/${sub.replace(/^\/+/, "")}` : ADMIN_BASE;
