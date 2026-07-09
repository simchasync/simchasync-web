// Supabase's `functions.invoke` wraps any non-2xx response in a FunctionsHttpError
// whose `.message` is the generic "Edge Function returned a non-2xx status code".
// The actual, user-friendly message our functions return (e.g. "Please connect
// Stripe in Settings first.") lives in the JSON body on `error.context` (a Response).
// This reads that real message, falling back sensibly when it isn't available.
export async function getEdgeFunctionErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): Promise<string> {
  const ctx = (error as { context?: unknown })?.context;
  if (ctx && typeof (ctx as Response).clone === "function") {
    try {
      const body = await (ctx as Response).clone().json();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    } catch {
      // body wasn't JSON — fall through
    }
  }

  const message = (error as { message?: unknown })?.message;
  // Ignore Supabase's opaque wrapper text; it tells the user nothing useful.
  if (typeof message === "string" && message && !/non-2xx status code/i.test(message)) {
    return message;
  }

  return fallback;
}
