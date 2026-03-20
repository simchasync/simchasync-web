import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Users, Search, Loader2, Ban, Trash2, UserCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAdminRole } from "@/hooks/useAdminRole";

function adminAction(action: string, body: Record<string, any>) {
  return supabase.functions.invoke("admin-manage-tenant", { body: { action, ...body } });
}

export default function AdminUsers() {
  const qc = useQueryClient();
  const { isAdmin } = useAdminRole();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const pageSize = 25;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, page],
    queryFn: async () => {
      const { data, error } = await adminAction("list_all_users", { search, page, page_size: pageSize });
      if (error) throw error;
      return data as { users: any[]; total: number };
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async ({ userId, ban }: { userId: string; ban: boolean }) => {
      const { error } = await adminAction("deactivate_user", { target_user_id: userId, ban });
      if (error) throw error;
    },
    onSuccess: (_, { ban }) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: ban ? "User deactivated" : "User activated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await adminAction("delete_user", { target_user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "User deleted" });
      setSelectedUser(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const users = data?.users || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const getPlanBadge = (memberships: any[]) => {
    if (!memberships?.length) return <Badge variant="outline">No workspace</Badge>;
    const tenant = memberships[0]?.tenant;
    if (!tenant) return <Badge variant="outline">Unknown</Badge>;
    const plan = tenant.plan;
    if (plan === "trial") return <Badge className="bg-amber-500/15 text-amber-700 border-amber-200">Trial</Badge>;
    if (plan === "lite") return <Badge className="bg-blue-500/15 text-blue-700 border-blue-200">Lite</Badge>;
    if (plan === "full") return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200">Full</Badge>;
    return <Badge variant="outline">{plan}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> User Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{total} total users</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Joined</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>
                  ) : users.map((u: any) => (
                    <TableRow key={u.user_id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedUser(u)}>
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                      <TableCell>{getPlanBadge(u.memberships)}</TableCell>
                      <TableCell className="text-sm">{u.memberships?.[0]?.tenant?.name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.created_at ? format(new Date(u.created_at), "MMM d, yyyy") : "—"}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); deactivateMutation.mutate({ userId: u.user_id, ban: true }); }}>
                            <Ban className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* User detail dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(o) => !o && setSelectedUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>View and manage this user's account.</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{selectedUser.full_name || "—"}</span></div>
                <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{selectedUser.email || "—"}</span></div>
                <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{selectedUser.phone || "—"}</span></div>
                <div><span className="text-muted-foreground">Joined:</span> <span className="font-medium">{selectedUser.created_at ? format(new Date(selectedUser.created_at), "MMM d, yyyy") : "—"}</span></div>
              </div>

              {selectedUser.memberships?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Workspaces</p>
                  {selectedUser.memberships.map((m: any, i: number) => (
                    <div key={i} className="flex items-center justify-between border rounded-lg px-3 py-2 mb-1">
                      <div>
                        <p className="text-sm font-medium">{m.tenant?.name || m.tenant_id}</p>
                        <p className="text-xs text-muted-foreground">Role: {m.role}</p>
                      </div>
                      {getPlanBadge([m])}
                    </div>
                  ))}
                </div>
              )}

              {isAdmin && (
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => deactivateMutation.mutate({ userId: selectedUser.user_id, ban: false })}>
                    <UserCheck className="mr-2 h-4 w-4" /> Activate
                  </Button>
                  <Button variant="outline" className="text-destructive" onClick={() => deactivateMutation.mutate({ userId: selectedUser.user_id, ban: true })}>
                    <Ban className="mr-2 h-4 w-4" /> Deactivate
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete User?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete the user account. This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(selectedUser.user_id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
