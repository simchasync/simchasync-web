// Translates raw Supabase storage / Postgres upload errors into a short,
// plain-English sentence a non-technical user can act on. The raw error is
// never shown to the user — log it to the console at the call site for
// debugging. Rules are evaluated in order; the first match wins, fallback last.

type UploadErrorRule = {
  test: (message: string, status: number | undefined) => boolean;
  message: string;
};

function extract(err: unknown): { message: string; status: number | undefined } {
  if (err && typeof err === "object") {
    const e = err as { message?: unknown; statusCode?: unknown; status?: unknown };
    const message = typeof e.message === "string" ? e.message : "";
    const rawStatus = e.statusCode ?? e.status;
    const status =
      typeof rawStatus === "number"
        ? rawStatus
        : typeof rawStatus === "string" && rawStatus.trim() !== "" && !Number.isNaN(Number(rawStatus))
          ? Number(rawStatus)
          : undefined;
    return { message: message.toLowerCase(), status };
  }
  if (typeof err === "string") return { message: err.toLowerCase(), status: undefined };
  return { message: "", status: undefined };
}

const RULES: readonly UploadErrorRule[] = [
  {
    test: (m, s) => m.includes("row-level security") || m.includes("not authorized") || m.includes("unauthorized") || s === 403,
    message:
      "You don't have permission to upload here. Make sure you're signed in to the right workspace and try again.",
  },
  {
    test: (m, s) => m.includes("exceeded the maximum allowed size") || m.includes("payload too large") || m.includes("too large") || s === 413,
    message: "That file is too large. Please choose a smaller file and try again.",
  },
  {
    test: (m) => m.includes("mime type") || m.includes("invalid type") || (m.includes("not allowed") && m.includes("type")),
    message: "That file type isn't supported. Please upload an image (JPG, PNG, or WebP).",
  },
  {
    test: (m, s) => m.includes("jwt") || m.includes("expired") || m.includes("token") || s === 401,
    message: "Your session expired. Please refresh the page and sign in again.",
  },
  {
    test: (m) => m.includes("duplicate") || m.includes("already exists"),
    message: "A file with that name already exists. Rename it and try again.",
  },
  {
    test: (m) => m.includes("failed to fetch") || m.includes("network") || m.includes("timeout") || m.includes("timed out"),
    message: "Couldn't reach the server. Check your internet connection and try again.",
  },
];

const FALLBACK =
  "Something went wrong while uploading. Please try again — if it keeps happening, contact support.";

export function friendlyUploadError(err: unknown): string {
  const { message, status } = extract(err);
  for (const rule of RULES) {
    if (rule.test(message, status)) return rule.message;
  }
  return FALLBACK;
}
