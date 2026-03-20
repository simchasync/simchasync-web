import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, CreditCard, AlertTriangle, TrendingUp, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, addDays, isBefore } from "date-fns";
import { useState } from "react";

function adminAction(action: string, body: Record<string, any>) {
  return supabase.functions.invoke("admin-manage-tenant", {
    body: { action, ...body },
  });
}

export default function AdminBilling() {
  const queryClient = useQueryClient();
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [trialDate, setTrialDate] = useState("");

  const { data: tenantsData, isLoading } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: async () => {
      const { data, error } = await adminAction("list_tenants", {});
      if (error) throw error;
      return data.tenants;
    },
  });

  const tenants = tenantsData || [];

  const actionMutation = useMutation({
    mutationFn: async ({ action, ...params }: any) => {
      const { data, error } = await adminAction(action, params);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      toast({ title: "Updated ✓" });
      setEditingRow(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const now = new Date();
  const totalTenants = tenants.length;
  const activeSubs = tenants.filter((t: any) => t.plan !== "trial").length;
  const activeTrial = tenants.filter((t: any) => t.plan === "trial" && !isBefore(new Date(t.trial_ends_at), now)).length;
  const expiringSoon = tenants.filter(
    (t: any) => t.plan === "trial" && isBefore(new Date(t.trial_ends_at), addDays(now, 7)) && !isBefore(new Date(t.trial_ends_at), now)
  ).length;
  const expired = tenants.filter(
    (t: any) => t.plan === "trial" && isBefore(new Date(t.trial_ends_at), now)
  ).length;

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-display text-2xl font-bold">Billing Overview</h1>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{totalTenants}</div>
                    <div className="text-xs text-muted-foreground">Total Tenants</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                    <CreditCard className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{activeSubs}</div>
                    <div className="text-xs text-muted-foreground">Paid Subscriptions</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                    <TrendingUp className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{activeTrial}</div>
                    <div className="text-xs text-muted-foreground">Active Trials</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{expiringSoon}</div>
                    <div className="text-xs text-muted-foreground">Expiring in 7 days</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">All Tenants — Billing</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Trial Ends</TableHead>
                  <TableHead>Custom Price</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t: any) => {
                  const trialExpired = t.plan === "trial" && isBefore(new Date(t.trial_ends_at), now);
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.slug}</div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={t.plan}
                          onValueChange={(val) =>
                            actionMutation.mutate({ action: "change_plan", tenant_id: t.id, plan: val })
                          }
                        >
                          <SelectTrigger className="w-24 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="trial">Trial</SelectItem>
                            <SelectItem value="lite">Lite</SelectItem>
                            <SelectItem value="full">Full</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${trialExpired ? "text-destructive" : ""}`}>
                            {t.trial_ends_at ? format(new Date(t.trial_ends_at), "MMM d, yyyy") : "—"}
                          </span>
                          {editingRow === t.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="date"
                                className="h-7 w-36 text-xs"
                                value={trialDate}
                                onChange={(e) => setTrialDate(e.target.value)}
                              />
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                  actionMutation.mutate({ action: "extend_trial", tenant_id: t.id, new_trial_end: trialDate });
                                }}
                                disabled={!trialDate || actionMutation.isPending}
                              >
                                Set
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => {
                                setEditingRow(t.id);
                                setTrialDate(t.trial_ends_at?.slice(0, 10) || "");
                              }}
                            >
                              Edit
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {t.custom_price_cents != null ? `$${(t.custom_price_cents / 100).toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell>
                        {trialExpired && (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                            Expired
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
