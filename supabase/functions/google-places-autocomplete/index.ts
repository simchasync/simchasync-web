/// <reference path="../_shared/deno-runtime.d.ts" />

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Prediction {
  place_id: string;
  name: string;
  address: string;
  full_description: string;
}

const MAX_QUERY_LENGTH = 200;
const MAX_TYPES = 10;
// Google Places primary types are lowercase snake_case tokens. Accept only
// well-formed tokens (and cap the count) rather than forwarding arbitrary input.
const TYPE_TOKEN = /^[a-z][a-z_]{0,39}$/;

function sanitizeTypes(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((t): t is string => typeof t === "string" && TYPE_TOKEN.test(t))
    .slice(0, MAX_TYPES);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawQuery = typeof body?.query === "string" ? body.query.trim() : "";

    // ── Text autocomplete (query → predictions) ─────────────────────────
    if (rawQuery.length < 2) {
      return new Response(JSON.stringify({ predictions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const query = rawQuery.slice(0, MAX_QUERY_LENGTH);

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    const gBody: Record<string, unknown> = { input: query };
    // `types` omitted → default to establishments (venue search). An explicit
    // (empty) array → leave unrestricted so address/region lookups still work.
    if (body?.types === undefined) {
      gBody.includedPrimaryTypes = ['establishment'];
    } else {
      const includedTypes = sanitizeTypes(body.types);
      if (includedTypes.length > 0) gBody.includedPrimaryTypes = includedTypes;
    }

    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify(gBody),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const googleMessage = data?.error?.message || `Google API request failed with status ${response.status}`;
      console.error(`Google Places API error: ${googleMessage}`);
      return new Response(JSON.stringify({ predictions: [], warning: googleMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const predictions: Prediction[] = (data.suggestions || [])
      .filter((s: any) => s.placePrediction)
      .map((s: any) => {
        const p = s.placePrediction;
        return {
          place_id: p.placeId,
          name: p.structuredFormat?.mainText?.text || p.text?.text || '',
          address: p.structuredFormat?.secondaryText?.text || '',
          full_description: p.text?.text || '',
        };
      });

    return new Response(JSON.stringify({ predictions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Top-level error:', error);
    return new Response(JSON.stringify({ 
      predictions: [{ 
        place_id: 'error-fallback', 
        name: '', 
        address: 'Error: Could not process location', 
        full_description: 'Error: Could not process location' 
      }] 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
