import { useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { MapPin, Loader2 } from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const icon = L.divIcon({
  className: "bg-transparent",
  html: `<div style="background:hsl(40 88% 52%);color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:16px;">📍</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

interface Coords {
  lat: number;
  lng: number;
}

function ClickHandler({ onPin }: { onPin: (c: Coords) => void }) {
  useMapEvents({
    click(e) {
      onPin({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

interface BookingMapProps {
  onLocationSelect: (venue: string, address: string) => void;
  defaultCenter?: [number, number];
}

export default function BookingMap({ onLocationSelect, defaultCenter }: BookingMapProps) {
  const [visible, setVisible] = useState(false);
  const [marker, setMarker] = useState<Coords | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [pinned, setPinned] = useState(false);

  const center: [number, number] = defaultCenter ?? [32.0853, 34.7818];

  const handlePin = useCallback(async (coords: Coords) => {
    setMarker(coords);
    setGeocoding(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-places-autocomplete", {
        body: { action: "geocode", lat: coords.lat, lng: coords.lng },
      });
      if (!error && data?.predictions?.length > 0) {
        const p = data.predictions[0];
        onLocationSelect(p.name, p.address);
        setPinned(true);
        toast({
          title: p.name ? `📍 ${p.name}` : "📍 Location pinned",
          description: p.address,
        });
      }
    } catch {
      toast({ title: "Could not resolve address", variant: "destructive" });
    } finally {
      setGeocoding(false);
    }
  }, [onLocationSelect]);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={pinned ? "default" : "outline"}
        size="sm"
        onClick={() => { setVisible((v) => !v); if (visible) setPinned(false); }}
        className="gap-1.5 h-8 text-xs"
      >
        <MapPin className="h-3.5 w-3.5" />
        {visible ? "Hide map" : pinned ? "Location pinned ✓" : "Pin on map"}
      </Button>
      {visible && (
        <div className="relative rounded-lg overflow-hidden border" style={{ height: 250 }}>
          <MapContainer center={center} zoom={8} className="h-full w-full" scrollWheelZoom={true}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onPin={handlePin} />
            {marker && <Marker position={[marker.lat, marker.lng]} icon={icon} />}
          </MapContainer>
          {geocoding && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-[1000]">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
