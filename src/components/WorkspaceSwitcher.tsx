import { useTenantId } from "@/hooks/useTenantId";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Building2, ChevronDown, Check, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function WorkspaceSwitcher() {
  const { tenantId, userTenants, switchTenant } = useTenantId();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [canCreate, setCanCreate] = useState<boolean | null>(null);

  const current = userTenants.find((t) => t.tenant_id === tenantId);
  const displayName = current?.tenant_name || "Workspace";
  const hasMultiple = userTenants.length > 1;

  const { subscribed, trialActive, plan } = useSubscription();

  const statusBadge = plan === "none" ? "Inactive" : subscribed ? "Active" : trialActive ? "Trial" : "Expired";
  const statusColor = plan === "none" ? "text-destructive" : subscribed ? "text-emerald-500" : trialActive ? "text-amber-500" : "text-destructive";

  // Check server-side permission when dialog opens
  const checkCanCreate = async () => {
    if (!user) return;
    try {
      const { data, error } = await (supabase.rpc as any)("can_create_workspace", { _user_id: user.id });
      if (error) throw error;
      setCanCreate(!!data);
    } catch {
      setCanCreate(false);
    }
  };

  const openCreateDialog = async () => {
    setCanCreate(null);
    setDialogOpen(true);
    await checkCanCreate();
  };

  const handleCreate = async () => {
    if (!newName.trim() || !user) return;

    setCreating(true);
    try {
      const { data, error } = await (supabase.rpc as any)("create_user_workspace", {
        _user_id: user.id,
        _name: newName.trim(),
      });
      if (error) throw error;
      toast.success("Workspace created. It will stay inactive until it has its own subscription.");
      setDialogOpen(false);
      setNewName("");
      if (data) switchTenant(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to create workspace");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between gap-2 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent px-3 py-2.5 h-auto"
          >
            <span className="flex items-center gap-2 truncate min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary/15">
                <Building2 className="h-4 w-4 text-sidebar-primary" />
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="truncate text-sm font-medium">{displayName}</span>
                <div className="flex items-center gap-1.5">
                  {current && (
                    <span className="text-[10px] text-sidebar-foreground/50 capitalize">{current.role}</span>
                  )}
                  <span className={cn("text-[10px] font-medium", statusColor)}>• {statusBadge}</span>
                </div>
              </div>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            {hasMultiple ? "Switch Workspace" : "Your Workspace"}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {userTenants.map((t) => (
            <DropdownMenuItem
              key={t.tenant_id}
              onClick={() => {
                if (t.tenant_id !== tenantId) switchTenant(t.tenant_id);
              }}
              className={cn(
                "flex items-center gap-2 py-2.5 cursor-pointer",
                t.tenant_id === tenantId && "bg-accent"
              )}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <Building2 className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate flex items-center gap-1.5">
                  {t.tenant_name}
                  {t.tenant_id === userTenants[0]?.tenant_id && (
                    <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-semibold uppercase bg-primary/10 text-primary leading-none">Main</span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground capitalize">{t.role}</p>
              </div>
              {t.tenant_id === tenantId && (
                <Check className="h-4 w-4 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={openCreateDialog}
            className="flex items-center gap-2 py-2.5 cursor-pointer text-primary"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-dashed border-primary/30">
              <Plus className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-medium">Create Workspace</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {canCreate === null && (
              <div className="flex items-center justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
            {canCreate === false && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm space-y-2">
                <p className="font-medium text-destructive">Cannot create workspace</p>
                <p className="text-muted-foreground">
                  Unable to create a workspace right now. Please try again in a moment.
                </p>
                <Button size="sm" variant="default" className="mt-1" onClick={() => setDialogOpen(false)}>
                  Close
                </Button>
              </div>
            )}
            {canCreate === true && (
              <>
                <Label htmlFor="ws-name">Workspace Name</Label>
                <Input
                  id="ws-name"
                  placeholder="e.g. My Band, Production Co."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            {canCreate === true && (
              <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
                {creating ? "Creating..." : "Create"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
