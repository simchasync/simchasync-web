import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Music } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const SEGMENTS = [
  { value: "chuppah", label: "Chuppah" },
  { value: "meal", label: "Meal" },
  { value: "dance_one", label: "Dance 1" },
  { value: "dance_two", label: "Dance 2" },
] as const;

interface Props {
  eventId: string;
  canWrite: boolean;
}

export default function SongsSection({ eventId, canWrite }: Props) {
  const qc = useQueryClient();
  const [newSong, setNewSong] = useState({ title: "", artist: "", segment: "chuppah" });

  const { data: songs = [] } = useQuery({
    queryKey: ["event_songs", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_songs")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const addMutation = useMutation({
    mutationFn: async (segment: string) => {
      const { error } = await supabase.from("event_songs").insert({
        event_id: eventId,
        segment,
        song_title: newSong.title,
        artist: newSong.artist || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event_songs", eventId] });
      setNewSong({ title: "", artist: "", segment: "chuppah" });
      toast({ title: "Song added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_songs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event_songs", eventId] });
      toast({ title: "Song removed" });
    },
  });

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold flex items-center gap-1.5">
        <Music className="h-4 w-4" /> Requested Songs
      </h4>
      <Tabs defaultValue="chuppah" className="w-full">
        <TabsList className="w-full grid grid-cols-4">
          {SEGMENTS.map((seg) => {
            const count = songs.filter((s: any) => s.segment === seg.value).length;
            return (
              <TabsTrigger key={seg.value} value={seg.value} className="text-xs">
                {seg.label} {count > 0 && `(${count})`}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {SEGMENTS.map((seg) => (
          <TabsContent key={seg.value} value={seg.value} className="space-y-2 mt-2">
            {songs
              .filter((s: any) => s.segment === seg.value)
              .map((s: any) => (
                <div key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">{s.song_title}</span>
                    {s.artist && <span className="text-muted-foreground ml-2">— {s.artist}</span>}
                  </div>
                  {canWrite && (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(s.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            {canWrite && (
              <div className="flex gap-2">
                <Input
                  placeholder="Song title"
                  value={newSong.title}
                  onChange={(e) => setNewSong({ ...newSong, title: e.target.value })}
                  className="text-sm"
                />
                <Input
                  placeholder="Artist"
                  value={newSong.artist}
                  onChange={(e) => setNewSong({ ...newSong, artist: e.target.value })}
                  className="text-sm w-32"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!newSong.title || addMutation.isPending}
                  onClick={() => addMutation.mutate(seg.value)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
