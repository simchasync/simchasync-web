import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Users, CreditCard, AlertTriangle, TrendingUp, Loader2,
  MoreHorizontal, RefreshCw, ShieldOff,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, addDays, isBefore } from "date-fns";
import { useState } from "react";

import { adminAction } from "@/lib/admin-functions";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription-tiers";

// Plan options derived from the shared tier source (auto-includes Premium and
// keeps labels in sync), plus the non-Stripe "trial" plan.
const PLAN_OPTIONS: { value: string; label: string }[] = [
  { value: "trial", label: "Trial" },
  ...Object.entries(SUBSCRIPTION_TIERS).map(([key, tier]) => ({ value: key, label: tier.name })),
];

export default function AdminBilling() {
  const queryClient = useQueryClient();
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [trialDate, setTrialDate] = useState("");
  const [filter, setFilter] = useState<string | null>(null); // null = all

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
  const isFailedPayment = (t: any) => t.stripe_subscription_status === "past_due" || t.stripe_subscription_status === "unpaid";
  const failedPayments = tenants.filter(isFailedPayment).length;

  // Clicking a summary card filters the table below; clicking it again (or "Total") clears.
  const matchesFilter = (t: any) => {
    switch (filter) {
      case "paid": return t.plan !== "trial";
      case "trial": return t.plan === "trial" && !isBefore(new Date(t.trial_ends_at), now);
      case "expiring": return t.plan === "trial" && isBefore(new Date(t.trial_ends_at), addDays(now, 7)) && !isBefore(new Date(t.trial_ends_at), now);
      case "failed": return isFailedPayment(t);
      default: return true;
    }
  };
  const filteredTenants = tenants.filter(matchesFilter);

  const summaryCards = [
    { key: "all", label: "Total Tenants", value: totalTenants, Icon: Users, wrap: "bg-primary/10", color: "text-primary" },
    { key: "paid", label: "Paid Subscriptions", value: activeSubs, Icon: CreditCard, wrap: "bg-emerald-500/10", color: "text-emerald-600" },
    { key: "trial", label: "Active Trials", value: activeTrial, Icon: TrendingUp, wrap: "bg-amber-500/10", color: "text-amber-600" },
    { key: "expiring", label: "Expiring in 7 days", value: expiringSoon, Icon: AlertTriangle, wrap: "bg-destructive/10", color: "text-destructive" },
    { key: "failed", label: "Failed Payments", value: failedPayments, Icon: ShieldOff, wrap: "bg-rose-500/10", color: "text-rose-600" },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-display text-2xl font-bold">Billing Overview</h1>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Summary Cards — click to filter the table below */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {summaryCards.map((c) => {
              const active = c.key === "all" ? !filter : filter === c.key;
              return (
                <Card
                  key={c.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setFilter(c.key === "all" ? null : (filter === c.key ? null : c.key))}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFilter(c.key === "all" ? null : (filter === c.key ? null : c.key)); } }}
                  className={`cursor-pointer transition-shadow hover:shadow-md ${active ? "ring-2 ring-primary" : ""}`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.wrap}`}>
                        <c.Icon className={`h-5 w-5 ${c.color}`} />
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{c.value}</div>
                        <div className="text-xs text-muted-foreground">{c.label}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="font-display text-lg">
                {filter ? summaryCards.find((c) => c.key === filter)?.label : "All Tenants"} — Billing
                <span className="ml-2 text-sm font-normal text-muted-foreground">({filteredTenants.length})</span>
              </CardTitle>
              {filter && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setFilter(null)}>Clear filter</Button>
              )}
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Trial Ends</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No tenants match this filter.</TableCell>
                  </TableRow>
                )}
                {filteredTenants.map((t: any) => {
                  const trialExpired = t.plan === "trial" && isBefore(new Date(t.trial_ends_at), now);
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.slug}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
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
                              {PLAN_OPTIONS.map((p) => (
                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {t.is_manual_override && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-300/40 text-[10px]">
                              Override
                            </Badge>
                          )}
                        </div>
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
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {trialExpired && (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                              Expired
                            </Badge>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Billing actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem
                                onClick={() => {
                                  if (window.confirm(`Resync ${t.name} from Stripe? This pulls the live subscription state.`)) {
                                    actionMutation.mutate({ action: "resync_stripe", tenant_id: t.id });
                                  }
                                }}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" /> Resync from Stripe
                              </DropdownMenuItem>
                              {t.is_manual_override && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => {
                                      if (window.confirm(`Remove the manual override for ${t.name}? Its plan will follow Stripe again.`)) {
                                        actionMutation.mutate({ action: "remove_override", tenant_id: t.id });
                                      }
                                    }}
                                  >
                                    <ShieldOff className="h-4 w-4 mr-2" /> Remove override
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
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
