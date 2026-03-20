import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, FileText, Image, File, Mic, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import VoiceNoteRecorder from "./VoiceNoteRecorder";

interface Props {
  eventId: string;
  canWrite: boolean;
}

export default function AttachmentsSection({ eventId, canWrite }: Props) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [] } = useQuery({
    queryKey: ["event_attachments", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_attachments")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${eventId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("event-files").upload(path, file);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from("event-files").getPublicUrl(path);
        const fileType = file.type.startsWith("image/") ? "image" : file.type.includes("pdf") ? "pdf" : "document";
        const { error: dbErr } = await supabase.from("event_attachments").insert({
          event_id: eventId,
          file_url: publicUrl,
          name: file.name,
          file_type: fileType,
        });
        if (dbErr) throw dbErr;
      }
      qc.invalidateQueries({ queryKey: ["event_attachments", eventId] });
      toast({ title: `${files.length} file(s) uploaded` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (att: any) => {
      const urlParts = att.file_url.split("/event-files/");
      if (urlParts[1]) {
        await supabase.storage.from("event-files").remove([decodeURIComponent(urlParts[1])]);
      }
      const { error } = await supabase.from("event_attachments").delete().eq("id", att.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event_attachments", eventId] });
      toast({ title: "File removed" });
    },
  });

  const getIcon = (type: string | null) => {
    if (type === "voice_note") return <Mic className="h-4 w-4 text-purple-500" />;
    if (type === "image") return <Image className="h-4 w-4 text-blue-500" />;
    if (type === "pdf") return <FileText className="h-4 w-4 text-red-500" />;
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const isVoiceNote = (type: string | null) => type === "voice_note";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Documents, Photos & Voice Notes ({attachments.length})</h4>
        {canWrite && (
          <div className="flex gap-2">
            <VoiceNoteRecorder eventId={eventId} onUploaded={() => qc.invalidateQueries({ queryKey: ["event_attachments", eventId] })} />
            <label className="cursor-pointer">
              <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                <span>
                  <Upload className="mr-1 h-3 w-3" />
                  {uploading ? "Uploading..." : "Upload"}
                </span>
              </Button>
              <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} accept="image/*,.pdf,.doc,.docx,.txt" />
            </label>
          </div>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="grid gap-2">
          {attachments.map((att: any) => (
            <div key={att.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getIcon(att.file_type)}
                {isVoiceNote(att.file_type) ? (
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <span className="text-sm truncate">{att.name || "Voice Note"}</span>
                    <audio controls preload="none" className="h-8 w-full max-w-[280px]">
                      <source src={att.file_url} type="audio/webm" />
                    </audio>
                  </div>
                ) : (
                  <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline truncate">
                    {att.name || "Untitled"}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a href={att.file_url} download className="inline-flex">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7">
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </a>
                {canWrite && (
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(att)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
