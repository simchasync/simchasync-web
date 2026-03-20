import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Shield } from "lucide-react";
import { format } from "date-fns";

function adminAction(action: string, body: Record<string, any>) {
  return supabase.functions.invoke("admin-manage-tenant", { body: { action, ...body } });
}

const ACTION_COLORS: Record<string, string> = {
  extend_trial: "bg-amber-500/10 text-amber-700 border-amber-200",
  change_plan: "bg-blue-500/10 text-blue-700 border-blue-200",
  set_custom_price: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  reset_password: "bg-destructive/10 text-destructive border-destructive/30",
  invite_tenant: "bg-primary/10 text-primary border-primary/30",
  resync_stripe: "bg-muted text-muted-foreground",
  assign_admin_role: "bg-purple-500/10 text-purple-700 border-purple-200",
  remove_admin_role: "bg-destructive/10 text-destructive border-destructive/30",
  update_tenant_notes: "bg-muted text-muted-foreground",
};

export default function AdminAuditLog() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: async () => {
      const { data, error } = await adminAction("list_audit_logs", { limit: 200 });
      if (error) throw error;
      return data.logs;
    },
  });
  const logs = data || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h1 className="font-display text-2xl font-bold">Audit Log</h1>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead><TableHead>Admin</TableHead><TableHead>Action</TableHead><TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{format(new Date(log.created_at), "MMM d, HH:mm")}</TableCell>
                  <TableCell><div className="text-sm font-medium">{log.profiles?.full_name || "Unknown"}</div><div className="text-xs text-muted-foreground">{log.profiles?.email}</div></TableCell>
                  <TableCell><Badge variant="outline" className={`text-xs ${ACTION_COLORS[log.action] || ""}`}>{log.action.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                    {log.target_tenant_id && <span className="font-mono">{log.target_tenant_id.slice(0, 8)}…</span>}
                    {log.details && Object.keys(log.details).length > 0 && <span className="ml-2">{JSON.stringify(log.details)}</span>}
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No audit logs yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}