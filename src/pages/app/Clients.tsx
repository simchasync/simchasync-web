import { useState, useEffect, useMemo, useRef } from "react";
import { isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
import { CardListSkeleton, TableSkeleton } from "@/components/ui/page-skeletons";
import { StatCard, SectionHeader } from "@/components/ui/stat-card";
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
  Chip,
  IconButton,
} from "@mui/material";
import { Plus, Users, Search, Pencil, Trash2, History, UserPlus, AlertCircle, Mail, Phone, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import { useUserRole } from "@/hooks/useUserRole";
import ClientHistoryDialog from "@/components/clients/ClientHistoryDialog";
import { ConfirmDestructiveDialog } from "@/components/ConfirmDestructiveDialog";
import { getOrCreateClient } from "@/lib/clientDedup";

type Client = Tables<"clients">;

const emptyForm = { name: "", email: "", phone: "", notes: "" };

const clientInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

function ClientAvatar({ name }: { name: string }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {clientInitials(name) || "?"}
    </div>
  );
}

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
  const searchInputRef = useRef<HTMLInputElement>(null);

  // "/" focuses the search field (unless already typing somewhere)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(target.tagName) && !target.isContentEditable) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

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

  const stats = useMemo(() => {
    const now = new Date();
    const month = { start: startOfMonth(now), end: endOfMonth(now) };
    return {
      total: clients.length,
      newThisMonth: clients.filter((cl) => cl.created_at && isWithinInterval(new Date(cl.created_at), month)).length,
      missingContact: clients.filter((cl) => !cl.email && !cl.phone).length,
    };
  }, [clients]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl tracking-tight mb-0.5">{c.title}</h1>
          <p className="text-sm text-muted-foreground">{c.subtitle}</p>
        </div>
        {canWrite && (
          <Button
            onClick={openNew}
            variant="contained"
            disableElevation
            className="w-full sm:w-auto bg-gradient-gold text-primary-foreground font-semibold shadow-gold"
            startIcon={<Plus className="h-4 w-4" />}
          >
            {c.newClient}
          </Button>
        )}
      </div>

      {/* Stats */}
      {!isLoading && clients.length > 0 && (
        <section>
          <SectionHeader title={t.app.dashboard.overview} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            <StatCard label={c.totalClients} value={`${stats.total}`} icon={Users} accent="violet" />
            <StatCard label={c.newThisMonth} value={`${stats.newThisMonth}`} icon={UserPlus} accent="emerald" />
            <StatCard
              label={c.missingContact}
              value={`${stats.missingContact}`}
              sub={stats.missingContact > 0 ? c.missingContactSub.replace("{count}", String(stats.missingContact)) : undefined}
              icon={AlertCircle}
              accent={stats.missingContact > 0 ? "amber" : "emerald"}
            />
          </div>
        </section>
      )}

      {/* Search toolbar */}
      {clients.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
          <TextField
            size="small"
            fullWidth
            placeholder={c.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            inputRef={searchInputRef}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search className="h-4 w-4 text-muted-foreground" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    {search ? (
                      <IconButton size="small" onClick={() => setSearch("")} title={c.clearSearch} sx={{ width: 28, height: 28 }}>
                        <X className="h-3.5 w-3.5" />
                      </IconButton>
                    ) : (
                      <kbd className="hidden md:inline-flex h-5 items-center rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">/</kbd>
                    )}
                  </InputAdornment>
                ),
              },
            }}
          />
          <Chip
            label={c.resultsCount.replace("{shown}", String(filtered.length)).replace("{total}", String(clients.length))}
            variant="outlined"
            size="small"
            className="shrink-0 self-end sm:self-auto font-medium text-muted-foreground"
            sx={{ height: 24, fontSize: "11px" }}
          />
        </div>
      )}

      {isLoading ? (
        <><CardListSkeleton count={3} /><TableSkeleton columns={4} rows={4} /></>
      ) : clients.length === 0 ? (
        <Card variant="outlined" className="animate-card-in">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <p className="font-display text-lg font-semibold">{c.emptyTitle}</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{c.emptyHint}</p>
            {canWrite && (
              <Button
                onClick={openNew}
                variant="contained"
                disableElevation
                className="mt-5 bg-gradient-gold text-primary-foreground font-semibold shadow-gold"
                startIcon={<Plus className="h-4 w-4" />}
              >
                {c.addFirst}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card variant="outlined" className="animate-card-in">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Search className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="font-medium">{c.noMatches}</p>
            <p className="mt-1 text-sm text-muted-foreground">{c.noMatchesHint}</p>
            <Button variant="outlined" size="small" className="mt-4" onClick={() => setSearch("")} startIcon={<X className="h-3.5 w-3.5" />}>
              {c.clearSearch}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((cl) => (
              <Card key={cl.id} variant="outlined" className="animate-card-in card-interactive">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <ClientAvatar name={cl.name} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{cl.name}</p>
                      {cl.email && (
                        <a href={`mailto:${cl.email}`} className="flex items-center gap-1.5 text-sm text-muted-foreground truncate hover:text-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0" />{cl.email}
                        </a>
                      )}
                      {cl.phone && (
                        <a href={`tel:${cl.phone}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />{cl.phone}
                        </a>
                      )}
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
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2.5">
                          <ClientAvatar name={cl.name} />
                          <span className="truncate">{cl.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {cl.email
                          ? <a href={`mailto:${cl.email}`} className="text-muted-foreground hover:text-foreground hover:underline">{cl.email}</a>
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {cl.phone
                          ? <a href={`tel:${cl.phone}`} className="text-muted-foreground hover:text-foreground hover:underline">{cl.phone}</a>
                          : "—"}
                      </TableCell>
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
