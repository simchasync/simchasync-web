/// <reference path="./deno-runtime.d.ts" />

// Origin allow-list shared by authenticated (non-public) edge functions.
// Mirrors the logic in admin-helpers.ts `adminCors` so browser callers from
// production, Vercel previews, and local dev are accepted — anything else
// falls back to the production origin (never a wildcard).
const PROD_ORIGIN = "https://simchasync-web.vercel.app";

export function isAllowedOrigin(origin: string): boolean {
  if (origin === PROD_ORIGIN || origin === (Deno.env.get("APP_URL") ?? "")) return true;
  if (/^https:\/\/simchasync-web[a-z0-9-]*\.vercel\.app$/.test(origin)) return true;
  return /^http:\/\/localhost:\d+$/.test(origin);
}

const ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

/** Build origin-allow-listed CORS headers for a request.
 * Call once at the top of the handler: `const corsHeaders = buildCorsHeaders(req);` */
export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : PROD_ORIGIN,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
  };
}
