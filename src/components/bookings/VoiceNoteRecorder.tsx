import { useState, useRef, useCallback } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  eventId: string;
  onUploaded: () => void;
}

export default function VoiceNoteRecorder({ eventId, onUploaded }: Props) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunks.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        await upload(blob);
      };
      recorder.start();
      mediaRecorder.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      toast({ title: "Microphone access denied", variant: "destructive" });
    }
  }, [eventId]);

  const stop = useCallback(() => {
    mediaRecorder.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const upload = async (blob: Blob) => {
    const path = `${eventId}/${crypto.randomUUID()}.webm`;
    const { error: upErr } = await supabase.storage.from("event-files").upload(path, blob, { contentType: "audio/webm" });
    if (upErr) { toast({ title: "Upload failed", description: upErr.message, variant: "destructive" }); return; }
    const { data: { publicUrl } } = supabase.storage.from("event-files").getPublicUrl(path);
    const now = new Date();
    const name = `Voice Note - ${now.toLocaleString()}`;
    const { error: dbErr } = await supabase.from("event_attachments").insert({
      event_id: eventId, file_url: publicUrl, name, file_type: "voice_note",
    });
    if (dbErr) { toast({ title: "Save failed", description: dbErr.message, variant: "destructive" }); return; }
    toast({ title: "Voice note saved" });
    onUploaded();
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return recording ? (
    <Button type="button" variant="destructive" size="sm" onClick={stop} className="gap-1.5">
      <Square className="h-3 w-3" />
      Stop {fmt(seconds)}
    </Button>
  ) : (
    <Button type="button" variant="outline" size="sm" onClick={start} className="gap-1.5">
      <Mic className="h-3 w-3" />
      Voice Note
    </Button>
  );
}
