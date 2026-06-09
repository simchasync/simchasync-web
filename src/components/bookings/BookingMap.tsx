import { useState, useCallback, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
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

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center);
  }, [center, map]);

  return null;
}

interface BookingMapProps {
  onLocationSelect: (venue: string, address: string) => void;
  defaultCenter?: [number, number];
}

const FALLBACK_CENTER: [number, number] = [32.0853, 34.7818];

export default function BookingMap({ onLocationSelect, defaultCenter }: BookingMapProps) {
  const [visible, setVisible] = useState(false);
  const [marker, setMarker] = useState<Coords | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>(defaultCenter ?? FALLBACK_CENTER);
  const [zoom, setZoom] = useState(11);

  const center = mapCenter;

  const handlePin = useCallback(async (coords: Coords) => {
    setMarker(coords);
    setMapCenter([coords.lat, coords.lng]);
    setZoom(15);
    setGeocoding(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-places-autocomplete", {
        body: { action: "geocode", lat: coords.lat, lng: coords.lng },
      });
      
      if (error) {
        console.error("Geocoding error:", error);
        toast({ title: "Could not resolve address", variant: "destructive" });
        onLocationSelect("", `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
        setPinned(true);
      } else if (data?.predictions?.length > 0) {
        const p = data.predictions[0];
        const locationAddress = p.address || p.full_description || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
        console.log("Geocoding result:", { name: p.name, address: locationAddress });
        onLocationSelect(p.name, locationAddress);
        setPinned(true);
        toast({
          title: p.name ? `📍 ${p.name}` : "📍 Location pinned",
          description: locationAddress || "Address resolved",
        });
      } else {
        console.warn("No predictions returned", data);
        toast({ title: "Location pinned", description: "No address found, using coordinates", variant: "default" });
        onLocationSelect("", `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
        setPinned(true);
      }
    } catch (err) {
      console.error("Exception during geocoding:", err);
      toast({ title: "Could not resolve address", variant: "destructive" });
      onLocationSelect("", `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
      setPinned(true);
    } finally {
      setGeocoding(false);
    }
  }, [onLocationSelect]);

  const requestGeolocation = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      toast({ title: "Location not supported", description: "Your browser does not support location lookup.", variant: "destructive" });
      return;
    }

    setPermissionLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setMapCenter([coords.lat, coords.lng]);
        setZoom(15);
        handlePin(coords).finally(() => setPermissionLoading(false));
      },
      (error) => {
        setPermissionLoading(false);
        const message = error.code === error.PERMISSION_DENIED
          ? "Location access was denied. You can still pin a location manually."
          : "Could not determine your location. Pin a location manually on the map.";
        toast({ title: "Location unavailable", description: message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [handlePin]);

  useEffect(() => {
    if (visible && !permissionRequested) {
      setPermissionRequested(true);
      requestGeolocation();
    }
  }, [visible, permissionRequested, requestGeolocation]);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={pinned ? "default" : "outline"}
        size="sm"
        onClick={() => setVisible((v) => !v)}
        className="gap-1.5 h-8 text-xs"
      >
        <MapPin className="h-3.5 w-3.5" />
        {visible ? "Hide map" : pinned ? "Location pinned ✓" : "Pin on map"}
      </Button>
      {visible && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground/80">
            {permissionLoading
              ? "Requesting your location..."
              : "Allow location access when prompted to auto-pin your current address, or tap the map to choose a place manually."}
          </p>
          <div className="relative rounded-lg overflow-hidden border" style={{ height: 250 }}>
            <MapContainer center={center} zoom={zoom} className="h-full w-full" scrollWheelZoom={true}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <RecenterMap center={center} />
              <ClickHandler onPin={handlePin} />
              {marker && <Marker position={[marker.lat, marker.lng]} icon={icon} />}
            </MapContainer>
            {geocoding && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-[1000]">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
