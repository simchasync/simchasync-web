/// <reference path="../_shared/deno-runtime.d.ts" />

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();

    const eventType  = typeof body.event_type  === "string" ? body.event_type.slice(0, 100)  : "";
    const venue      = typeof body.venue        === "string" ? body.venue.slice(0, 200)        : "";
    const clientName = typeof body.client_name  === "string" ? body.client_name.slice(0, 100) : "";
    const platform   = typeof body.platform     === "string" ? body.platform.slice(0, 50)     : "instagram";
    const tone       = typeof body.tone         === "string" ? body.tone.slice(0, 50)         : "warm";
    const tenantName = typeof body.tenant_name  === "string" ? body.tenant_name.slice(0, 200) : "us";

    const apiKey = Deno.env.get("AI_API_KEY") ?? Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return jsonError("AI not configured", 503);

    const baseUrl = Deno.env.get("AI_BASE_URL") ?? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    const model   = Deno.env.get("AI_MODEL") ?? Deno.env.get("GEMINI_MODEL") ?? "gemini-3.1-flash-lite";

    const eventDesc = [
      eventType && `Event type: ${eventType}`,
      venue      && `Venue: ${venue}`,
      clientName && `Client: ${clientName}`,
    ].filter(Boolean).join("\n") || "a special event";

    const systemPrompt = `You are a social media copywriter for ${tenantName}, a professional event entertainer (DJ/musician). Write engaging ${platform} captions for events they performed at. Keep captions authentic, warm, and professional. Include 1–2 relevant emojis. Do NOT use generic filler phrases like "What an amazing time!" at the very start.`;

    const userPrompt = `Write a ${platform} caption for a post about this event:
${eventDesc}

Tone: ${tone}

Return a JSON object with exactly two string fields:
- "caption": the post caption (2–4 sentences, suitable for ${platform})
- "hashtags": a string of 8–12 relevant hashtags starting with #, space-separated`;

    const response = await fetch(baseUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 400,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("AI error:", err);
      return jsonError("AI request failed", 502);
    }

    const json = await response.json();
    const text = json.choices?.[0]?.message?.content ?? "";

    let parsed: { caption?: string; hashtags?: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      return jsonError("AI returned unexpected format", 502);
    }

    return new Response(
      JSON.stringify({
        caption:  typeof parsed.caption  === "string" ? parsed.caption.trim()  : "",
        hashtags: typeof parsed.hashtags === "string" ? parsed.hashtags.trim() : "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("generate-caption error:", err);
    return jsonError("Internal error", 500);
  }
});
