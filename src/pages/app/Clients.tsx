import { useState, useEffect } from "react";
import { CardListSkeleton, TableSkeleton } from "@/components/ui/page-skeletons";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTenantId } from "@/hooks/useTenantId";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  Button,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
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
          <Button
            onClick={openNew}
            variant="contained"
            className="bg-gradient-gold text-primary-foreground font-semibold shadow-gold"
            startIcon={<Plus className="h-4 w-4" />}
          >
            {c.newClient}
          </Button>
        )}
      </div>

      {clients.length > 0 && (
        <TextField
          size="small"
          placeholder={t.common.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm w-full"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search className="h-4 w-4 text-muted-foreground" />
                </InputAdornment>
              ),
            },
          }}
        />
      )}

      {isLoading ? (
        <><CardListSkeleton count={3} /><TableSkeleton columns={4} rows={4} /></>
      ) : filtered.length === 0 ? (
        <Card variant="outlined">
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
              <Card key={cl.id} variant="outlined" className="animate-card-in card-interactive">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{cl.name}</p>
                      {cl.email && <p className="text-sm text-muted-foreground truncate">{cl.email}</p>}
                      {cl.phone && <p className="text-sm text-muted-foreground">{cl.phone}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outlined" size="small" className="flex-1 h-9" onClick={() => setHistoryClient(cl)} startIcon={<History className="h-3.5 w-3.5" />}>
                      {c.history}
                    </Button>
                    {canWrite && (
                      <>
                        <Button variant="outlined" size="small" className="flex-1 h-9" onClick={() => openEdit(cl)} startIcon={<Pencil className="h-3.5 w-3.5" />}>
                          {t.common.edit}
                        </Button>
                        <Button variant="text" size="small" className="h-9 shrink-0 text-destructive hover:text-destructive" onClick={() => setDeleteTargetId(cl.id)} startIcon={<Trash2 className="h-3.5 w-3.5" />}>
                          {t.common.delete}
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop Table */}
          <Card variant="outlined" className="hidden md:block">
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell>{c.phone}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((cl) => (
                    <TableRow key={cl.id} className="animate-row-in row-interactive">
                      <TableCell className="font-medium">{cl.name}</TableCell>
                      <TableCell>{cl.email ?? "—"}</TableCell>
                      <TableCell>{cl.phone ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button variant="text" size="small" className="h-8 px-2.5 text-xs" onClick={() => setHistoryClient(cl)} startIcon={<History className="h-3.5 w-3.5" />}>
                            {c.history}
                          </Button>
                          {canWrite && (
                            <>
                              <Button variant="text" size="small" className="h-8 px-2.5 text-xs" onClick={() => openEdit(cl)} startIcon={<Pencil className="h-3.5 w-3.5" />}>
                                {t.common.edit}
                              </Button>
                              <Button variant="text" size="small" className="h-8 px-2.5 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteTargetId(cl.id)} startIcon={<Trash2 className="h-3.5 w-3.5" />}>
                                {t.common.delete}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? t.common.edit : t.common.create} {c.title.toLowerCase()}</DialogTitle>
        <DialogContent>
          <DialogContentText className="mb-2">{editing ? c.editHint : c.addHint}</DialogContentText>
          <form
            id="client-form"
            onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }}
            className="flex flex-col gap-4 pt-2"
          >
            <TextField label={c.name} required fullWidth size="small" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <TextField label={c.email} type="email" fullWidth size="small" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <TextField label={c.phone} fullWidth size="small" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <TextField label={c.notes} fullWidth size="small" multiline rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </form>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={closeDialog}>{t.common.cancel}</Button>
          <Button type="submit" form="client-form" variant="contained" disabled={saveMutation.isPending} className="bg-gradient-gold text-primary-foreground font-semibold">
            {saveMutation.isPending ? t.common.loading : t.common.save}
          </Button>
        </DialogActions>
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
