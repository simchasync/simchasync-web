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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, query, types, lat, lng } = body;
    
    console.log('Request received:', { action, hasQuery: !!query, hasLat: lat !== undefined, hasLng: lng !== undefined });

    // ── Reverse geocode (lat/lng → address) ──────────────────────────────
    if (action === 'geocode' && lat !== undefined && lng !== undefined) {
      console.log('Processing geocode action');
      try {
        const nomResp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
          { headers: { 'User-Agent': 'SimchaSync/1.0' } },
        );

        if (!nomResp.ok) {
          console.error(`Nominatim API error: HTTP ${nomResp.status}`);
          const errorText = await nomResp.text();
          console.error('Nominatim error response:', errorText);
          return new Response(JSON.stringify({ 
            predictions: [{ 
              place_id: `geocode-${lat}-${lng}`, 
              name: '', 
              address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, 
              full_description: `${lat.toFixed(4)}, ${lng.toFixed(4)}` 
            }] 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const nomData = await nomResp.json();
        console.log('Nominatim response:', { lat, lng, hasData: !!nomData, displayName: nomData?.display_name });

        if (!nomData || nomData.error) {
          console.error('Nominatim returned error:', nomData?.error);
          return new Response(JSON.stringify({ 
            predictions: [{ 
              place_id: `geocode-${lat}-${lng}`, 
              name: '', 
              address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, 
              full_description: `${lat.toFixed(4)}, ${lng.toFixed(4)}` 
            }] 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const addr = nomData.address || {};
        const streetParts = [addr.house_number, addr.road, addr.suburb].filter(Boolean);
        const street = streetParts.join(' ') || '';
        const city = addr.city || addr.town || addr.village || addr.municipality || '';
        const state = addr.state || '';
        const country = addr.country || '';
        const fallbackAddress = [street, city, state, country].filter(Boolean).join(', ');

        // Nominatim display_name is always the full human-readable address
        const displayName = nomData.display_name || fallbackAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        
        // nomData.name is the POI name for named places (hotels, halls, restaurants).
        const venueName = nomData.name || '';

        const predictions: Prediction[] = [{
          place_id: nomData.place_id || `geocode-${lat}-${lng}`,
          name: venueName,
          address: displayName,
          full_description: displayName,
        }];

        console.log('Geocoding result:', { venueName, displayName });
        return new Response(JSON.stringify({ predictions }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Geocoding exception:', error);
        return new Response(JSON.stringify({ 
          predictions: [{ 
            place_id: `geocode-${lat}-${lng}`, 
            name: '', 
            address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, 
            full_description: `${lat.toFixed(4)}, ${lng.toFixed(4)}` 
          }] 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Text autocomplete (query → predictions) ─────────────────────────
    if (!query || query.length < 2) {
      console.log('Query too short or missing, returning empty for text search');
      return new Response(JSON.stringify({ predictions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    const gBody: Record<string, unknown> = { input: query };
    const includedTypes = types && Array.isArray(types) ? types : ['establishment'];
    if (includedTypes.length > 0 && !(includedTypes.length === 1 && includedTypes[0] === '')) {
      gBody.includedPrimaryTypes = includedTypes;
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
