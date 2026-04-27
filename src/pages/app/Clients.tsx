import { useState, useEffect } from "react";
import { CardListSkeleton, TableSkeleton } from "@/components/ui/page-skeletons";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTenantId } from "@/hooks/useTenantId";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Users, Search, Pencil, Trash2, History } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import { useUserRole } from "@/hooks/useUserRole";
import ClientHistoryDialog from "@/components/clients/ClientHistoryDialog";
import { ConfirmDestructiveDialog } from "@/components/ConfirmDestructiveDialog";
import { getOrCreateClient } from "@/lib/clientDedup";

type Client = Tables<"clients">;

const emptyForm = { name: "", email: "", phone: "", notes: "" };

export default function Clients() {
  const { t } = useLanguage();
  const c = t.app.clients;
  const { tenantId } = useTenantId();
  const { canWrite } = useUserRole();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [historyClient, setHistoryClient] = useState<Client | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("name");
      if (error) throw error;
      return data as Client[];
    },
    enabled: !!tenantId,
  });

  // Realtime sync for clients
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`clients-realtime-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clients", filter: `tenant_id=eq.${tenantId}` },
        () => { qc.invalidateQueries({ queryKey: ["clients", tenantId] }); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, qc]);

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      if (editing) {
        const { error } = await supabase
          .from("clients")
          .update({ name: values.name, email: values.email || null, phone: values.phone || null, notes: values.notes || null })
          .eq("id", editing.id);
        if (error) throw error;
        return { wasCreated: false };
      }

      if (!tenantId) throw new Error("Workspace not found");

      return getOrCreateClient({
        tenantId,
        name: values.name,
        email: values.email,
        phone: values.phone,
        notes: values.notes,
      });
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      closeDialog();
      toast({
        title: editing
          ? "Client updated"
          : result?.wasCreated
            ? "Client created"
            : "Client already exists — existing record updated",
      });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Client deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (cl: Client) => {
    setEditing(cl);
    setForm({ name: cl.name, email: cl.email ?? "", phone: cl.phone ?? "", notes: cl.notes ?? "" });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };

  const filtered = clients.filter(
    (cl) => cl.name.toLowerCase().includes(search.toLowerCase()) || cl.email?.toLowerCase().includes(search.toLowerCase()) || cl.phone?.includes(search)
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold md:text-3xl">{c.title}</h1>
        {canWrite && (
          <Button onClick={openNew} className="bg-gradient-gold text-primary-foreground font-semibold shadow-gold">
            <Plus className="mr-2 h-4 w-4" /> {c.newClient}
          </Button>
        )}
      </div>

      {clients.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t.common.search} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      )}

      {isLoading ? (
        <><CardListSkeleton count={3} /><TableSkeleton columns={4} rows={4} /></>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">{t.common.noData}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((cl) => (
              <Card key={cl.id} className="animate-card-in card-interactive">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{cl.name}</p>
                      {cl.email && <p className="text-sm text-muted-foreground truncate">{cl.email}</p>}
                      {cl.phone && <p className="text-sm text-muted-foreground">{cl.phone}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1 h-9" onClick={() => setHistoryClient(cl)}>
                      <History className="mr-1.5 h-3.5 w-3.5" /> History
                    </Button>
                    {canWrite && (
                      <>
                        <Button variant="outline" size="sm" className="flex-1 h-9" onClick={() => openEdit(cl)}>
                          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="h-9 shrink-0 text-destructive hover:text-destructive" onClick={() => setDeleteTargetId(cl.id)}>
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop Table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{c.name}</TableHead>
                  <TableHead>{c.email}</TableHead>
                  <TableHead>{c.phone}</TableHead>
                  <TableHead className="w-auto" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((cl) => (
                  <TableRow key={cl.id} className="animate-row-in row-interactive">
                    <TableCell className="font-medium">{cl.name}</TableCell>
                    <TableCell>{cl.email ?? "—"}</TableCell>
                    <TableCell>{cl.phone ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setHistoryClient(cl)}>
                          <History className="mr-1.5 h-3.5 w-3.5" /> History
                        </Button>
                        {canWrite && (
                          <>
                            <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => openEdit(cl)}>
                              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteTargetId(cl.id)}>
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t.common.edit : t.common.create} {c.title.toLowerCase()}</DialogTitle>
            <DialogDescription>{editing ? "Update client details" : "Add a new client to your workspace"}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>{c.name} *</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{c.email}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{c.phone}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{c.notes}</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>{t.common.cancel}</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-gradient-gold text-primary-foreground font-semibold">
                {saveMutation.isPending ? t.common.loading : t.common.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {historyClient && (
        <ClientHistoryDialog
          open={!!historyClient}
          onOpenChange={(o) => !o && setHistoryClient(null)}
          clientId={historyClient.id}
          clientName={historyClient.name}
        />
      )}

      <ConfirmDestructiveDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}
        title={c.confirmDeleteTitle}
        description={c.confirmDeleteDescription}
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        pendingLabel={t.common.deleting}
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (deleteTargetId) deleteMutation.mutate(deleteTargetId); }}
      />
    </div>
  );
}
