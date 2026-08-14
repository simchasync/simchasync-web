import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserCog, Plus, Trash2, Loader2, Search, Clock, Key } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

import { adminAction } from "@/lib/admin-functions";

const ROLE_INFO: Record<string, { label: string; description: string }> = {
  admin: { label: "Admin (Owner)", description: "Full system access" },
  billing_admin: { label: "Billing Admin", description: "Manage plans, pricing, subscriptions" },
  support_agent: { label: "Support Agent", description: "View tenants, reset passwords, impersonate" },
};

export default function AdminManageAdmins() {
  const queryClient = useQueryClient();
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("support_agent");
  const [foundUsers, setFoundUsers] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("admin");
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const { data: adminUsers, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await adminAction("list_admin_users", {});
      if (error) throw error;
      return data.admin_users;
    },
  });

  const { data: activityData } = useQuery({
    queryKey: ["admin-activity"],
    queryFn: async () => {
      const { data, error } = await adminAction("list_admin_activity", {});
      if (error) throw error;
      return data.activity as Record<string, { last_action: string; last_active_at: string }>;
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ target_user_id, role }: { target_user_id: string; role: string }) => {
      const { data, error } = await adminAction("assign_admin_role", { target_user_id, role });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Role assigned ✓" });
      setFoundUsers([]);
      setSearchEmail("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async ({ target_user_id, role }: { target_user_id: string; role: string }) => {
      const { data, error } = await adminAction("remove_admin_role", { target_user_id, role });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Role removed ✓" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await adminAction("create_admin", { email: newEmail.trim(), password: newPassword, role: newRole });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Admin created ✓" });
      setNewEmail(""); setNewPassword("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetPwMutation = useMutation({
    mutationFn: async ({ target_user_id, new_password }: { target_user_id: string; new_password: string }) => {
      const { data, error } = await adminAction("reset_password", { target_user_id, new_password });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => { toast({ title: "Password reset ✓" }); setResetUserId(null); setResetPassword(""); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    try {
      const { data, error } = await adminAction("find_user_by_email", { email: searchEmail });
      if (error) throw error;
      setFoundUsers(data?.users || []);
      if (!data?.users?.length) {
        toast({ title: "No users found with that email" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const roleBadgeColor: Record<string, string> = {
    admin: "bg-primary/10 text-primary border-primary/30",
    billing_admin: "bg-blue-500/10 text-blue-700 border-blue-200",
    support_agent: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-display text-2xl font-bold">Manage Admins</h1>

      {/* Role Legend */}
      <div className="grid gap-3 sm:grid-cols-3">
        {Object.entries(ROLE_INFO).map(([key, info]) => (
          <Card key={key}>
            <CardContent className="p-4">
              <Badge variant="outline" className={`mb-1 ${roleBadgeColor[key] || ""}`}>{info.label}</Badge>
              <p className="text-xs text-muted-foreground mt-1">{info.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Admin */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Assign Admin Role
          </CardTitle>
          <CardDescription>Search for a user by email and assign an admin role</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search by email..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searching} variant="outline">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {foundUsers.length > 0 && (
            <div className="space-y-2">
              {foundUsers.map((u: any) => (
                <div key={u.user_id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="text-sm font-medium">{u.full_name || "No name"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger className="w-44 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_INFO).map(([key, info]) => (
                          <SelectItem key={key} value={key}>
                            {info.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => assignMutation.mutate({ target_user_id: u.user_id, role: selectedRole })}
                      disabled={assignMutation.isPending}
                      className="bg-gradient-gold text-primary-foreground"
                    >
                      Assign
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Admin */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Create Admin
          </CardTitle>
          <CardDescription>Create a brand-new admin account with an email and password</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Email</label>
              <Input type="email" placeholder="admin@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Password (min 8)</label>
              <Input type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="w-44 h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_INFO).map(([key, info]) => (
                  <SelectItem key={key} value={key}>{info.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !newEmail.trim() || newPassword.length < 8}
              className="bg-gradient-gold text-primary-foreground"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Admins */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            Current Admin Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {(adminUsers || []).map((ar: any) => {
                const profile = ar.profiles;
                const activity = activityData?.[ar.user_id];
                return (
                  <div key={ar.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="text-sm font-medium">{profile?.full_name || "No name"}</div>
                        <div className="text-xs text-muted-foreground">{profile?.email}</div>
                        {activity && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 mt-0.5">
                            <Clock className="h-3 w-3" />
                            Last active {formatDistanceToNow(new Date(activity.last_active_at), { addSuffix: true })}
                            <span className="text-muted-foreground/50">({activity.last_action})</span>
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className={roleBadgeColor[ar.role] || ""}>
                        {ROLE_INFO[ar.role]?.label || ar.role}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {resetUserId === ar.user_id ? (
                        <div className="flex items-center gap-1">
                          <Input type="password" placeholder="New password (min 8)" className="h-8 w-44 text-xs" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
                          <Button size="sm" variant="outline" className="h-8 text-xs" disabled={resetPassword.length < 8 || resetPwMutation.isPending} onClick={() => resetPwMutation.mutate({ target_user_id: ar.user_id, new_password: resetPassword })}>Set</Button>
                          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setResetUserId(null); setResetPassword(""); }}>✕</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setResetUserId(ar.user_id); setResetPassword(""); }}>
                          <Key className="mr-1 h-3.5 w-3.5" /> Reset PW
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeMutation.mutate({ target_user_id: ar.user_id, role: ar.role })}
                        disabled={removeMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {(!adminUsers || adminUsers.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No admin users configured yet</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
