import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ImpersonationBanner from "@/components/admin/ImpersonationBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Loader2, Users, CalendarDays, FileText, CreditCard, Building2,
} from "lucide-react";
import { format } from "date-fns";

function adminAction(action: string, body: Record<string, any>) {
  return supabase.functions.invoke("admin-manage-tenant", {
    body: { action, ...body },
  });
}

export default function AdminImpersonate() {
  const { tenantId } = useParams<{ tenantId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-impersonate", tenantId],
    queryFn: async () => {
      const { data, error } = await adminAction("impersonate_tenant", { tenant_id: tenantId });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    enabled: !!tenantId,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.tenant) {
    return (
      <div className="p-6">
        <p className="text-destructive">Failed to load tenant data: {(error as Error)?.message || "Not found"}</p>
      </div>
    );
  }

  const { tenant, members, eventsCount, recentEvents, invoicesCount, recentInvoices, clientsCount } = data;
  const owner = members.find((m: any) => m.role === "owner");

  return (
    <div>
      <ImpersonationBanner tenantName={tenant.name} />
      <div className="p-6 space-y-6">
        <h1 className="font-display text-2xl font-bold">{tenant.name}</h1>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">Plan</div>
                <div className="font-semibold capitalize">{tenant.plan}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <CreditCard className="h-5 w-5 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">MRR</div>
                <div className="font-semibold">
                  {tenant.stripe_mrr_cents ? `$${(tenant.stripe_mrr_cents / 100).toFixed(2)}` : "—"}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">Members</div>
                <div className="font-semibold">{members.length}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <CalendarDays className="h-5 w-5 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">Events</div>
                <div className="font-semibold">{eventsCount}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">Invoices</div>
                <div className="font-semibold">{invoicesCount}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tenant Details */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Subscription Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subscription</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stripe Status</span>
                <Badge variant="outline">{tenant.stripe_subscription_status || "Not connected"}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trial Ends</span>
                <span>{format(new Date(tenant.trial_ends_at), "MMM d, yyyy")}</span>
              </div>
              {tenant.stripe_current_period_end && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Period End</span>
                  <span>{format(new Date(tenant.stripe_current_period_end), "MMM d, yyyy")}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(tenant.created_at), "MMM d, yyyy")}</span>
              </div>
              {tenant.notes && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground text-xs">Notes:</span>
                  <p className="text-sm mt-1">{tenant.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team Members */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team Members ({members.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {members.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="text-sm font-medium">{m.profiles?.full_name || "No name"}</div>
                      <div className="text-xs text-muted-foreground">{m.profiles?.email}</div>
                    </div>
                    <Badge variant="outline" className="text-xs">{m.role}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Events */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Events ({eventsCount} total)</CardTitle>
          </CardHeader>
          <CardContent>
            {recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No events</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEvents.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm">{format(new Date(e.event_date), "MMM d, yyyy")}</TableCell>
                      <TableCell className="text-sm capitalize">{e.event_type}</TableCell>
                      <TableCell className="text-sm">{e.clients?.name || "—"}</TableCell>
                      <TableCell className="text-sm">{e.venue || "—"}</TableCell>
                      <TableCell className="text-sm">{e.total_price ? `$${e.total_price}` : "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{e.payment_status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Invoices ({invoicesCount} total)</CardTitle>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No invoices</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentInvoices.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-sm">{format(new Date(inv.created_at), "MMM d, yyyy")}</TableCell>
                      <TableCell className="text-sm">{inv.clients?.name || "—"}</TableCell>
                      <TableCell className="text-sm">${inv.amount}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{inv.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
