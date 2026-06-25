/// <reference path="../_shared/deno-runtime.d.ts" />

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 2000;
const MAX_CONTEXT_LENGTH = 8000;
const MAX_TENANT_NAME_LENGTH = 200;

type ChatMessage = { role: "user" | "assistant"; content: string };

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) return null;
  const messages: ChatMessage[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) return null;
    const { role, content } = item as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string" || content.length === 0 || content.length > MAX_CONTENT_LENGTH) return null;
    messages.push({ role, content });
  }
  return messages;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const messages = parseMessages(body.messages);
    if (!messages) return jsonError("Invalid messages", 400);

    const tenantName = typeof body.tenant_name === "string" ? body.tenant_name.slice(0, MAX_TENANT_NAME_LENGTH) : "this business";
    const context = typeof body.context === "string" ? body.context.slice(0, MAX_CONTEXT_LENGTH) : "";

    // Any OpenAI-compatible provider (Groq, Gemini, OpenRouter...) — switch via secrets, no redeploy.
    const apiKey = Deno.env.get("AI_API_KEY") ?? Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("AI_API_KEY is not configured");
    const baseUrl = Deno.env.get("AI_BASE_URL") ?? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    const model = Deno.env.get("AI_MODEL") ?? Deno.env.get("GEMINI_MODEL") ?? "gemini-3.1-flash-lite";

    const systemPrompt = `You are a friendly, professional assistant for "${tenantName}". You help potential clients learn about their services, packages, pricing, and availability. Answer questions based on the following business information:

${context}

Guidelines:
- Be warm, concise, and helpful
- Only state facts (prices, dates, packages, services) that appear verbatim in the business info above — never estimate, infer, or round a number that wasn't given
- If asked about something not covered in the business info (exact availability, discounts, custom requests, anything not listed above), say you don't have that specific information and suggest contacting the business directly or using the booking form
- Encourage visitors to book through the booking form on the page
- Keep responses under 3 sentences unless more detail is needed
- Do not make up information not provided in the business context`;

    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return jsonError("Rate limited", 429);
      const t = await response.text();
      console.error("AI provider error:", response.status, t);
      return jsonError("AI service error", 500);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("public-chat error:", e);
    return jsonError(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
