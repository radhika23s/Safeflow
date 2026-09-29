import { createFileRoute } from "@tanstack/react-router";
import {
  Users,
  UserPlus,
  CheckCircle2,
  MoreHorizontal,
  X,
  UserCheck,
  ShieldAlert,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { getUsers, createUser, updateUserStatus, type PlatformUser } from "@/lib/api";
import { useRole } from "@/context/RoleContext";

export const Route = createFileRoute("/dashboard/users")({
  component: UsersPage,
});

function UsersPage() {
  const { role } = useRole();
  const queryClient = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<PlatformUser | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [userRole, setUserRole] = useState("investigator");
  const [password, setPassword] = useState("demo-password");
  const [formError, setFormError] = useState("");

  // Fetch real users from backend SQLite
  const {
    data: users = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
    refetchInterval: 10000,
  });

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setName("");
      setEmail("");
      setUserRole("investigator");
      setPassword("demo-password");
      setShowAdd(false);
      setFormError("");
    },
    onError: (err: any) => {
      setFormError(
        err?.message?.replace("API 400: ", "")?.replace("API 403: ", "") ||
          "Failed to create user."
      );
    },
  });

  // Status toggle mutation
  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      updateUserStatus(userId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setSelected(null);
    },
    onError: (err: any) => {
      alert(`Could not update user status: ${err?.message || "Unknown error"}`);
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!name.trim() || !email.trim()) {
      setFormError("Name and email are required.");
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: userRole,
      password: password || "demo-password",
    });
  };

  const handleToggleStatus = (targetUser: PlatformUser) => {
    const nextStatus = targetUser.status === "Active" ? "Inactive" : "Active";
    statusMutation.mutate({ userId: targetUser.id, status: nextStatus });
  };

  // RBAC Guard
  if (role === "investigator") {
    return (
      <DashboardLayout title="Access Restricted">
        <div className="rounded-2xl border border-risk-high/30 bg-risk-high/10 p-8 text-center max-w-lg mx-auto mt-12">
          <ShieldAlert className="size-12 text-risk-high mx-auto mb-3" />
          <h2 className="text-lg font-bold text-foreground">Restricted Administrative Area</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            User provisioning and access governance require Administrator or Compliance Manager privileges.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="User Management & Directory">
      <div className="space-y-6">
        {/* Header Card */}
        <div className="rounded-2xl border border-border bg-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Platform User Directory</h2>
              <p className="text-xs text-muted-foreground">
                Manage user accounts, security roles, workspace permissions, and analyst credentials in SQLite.
              </p>
            </div>
          </div>
          {role === "administrator" && (
            <Button size="sm" className="gap-2 shrink-0" onClick={() => setShowAdd(true)}>
              <UserPlus className="size-4" />
              Add New User
            </Button>
          )}
        </div>

        {/* Directory Table */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground gap-3">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span>Loading user directory…</span>
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-risk-high">
              <AlertCircle className="size-8 mx-auto mb-2" />
              <p className="text-sm font-semibold">Failed to fetch platform users</p>
              <p className="text-xs text-muted-foreground mt-1">{(error as any)?.message}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-4 text-left">User</th>
                    <th className="px-6 py-4 text-left">Assigned Role</th>
                    <th className="px-6 py-4 text-left">Status</th>
                    <th className="px-6 py-4 text-left">Created</th>
                    <th className="px-6 py-4 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-foreground">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
                            u.role === "administrator"
                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              : u.role === "manager"
                              ? "bg-teal/10 text-teal border border-teal/20"
                              : "bg-primary/10 text-primary border border-primary/20"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                            u.status === "Active"
                              ? "bg-teal/10 text-teal"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <CheckCircle2 className="size-3" />
                          {u.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="size-3" />
                          <span>{u.created_at ? u.created_at.split("T")[0] : "Active"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {role === "administrator" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => setSelected(u)}
                            aria-label={`Open actions for ${u.name}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">View only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShowAdd(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Add New Platform User</h3>
              <button
                onClick={() => setShowAdd(false)}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-risk-high/30 bg-risk-high/10 p-3 text-xs text-risk-high">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form className="mt-5 space-y-4" onSubmit={handleAddSubmit}>
              <div>
                <label className="text-sm font-medium text-foreground">Full Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rachel Zane"
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Work Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@smarthorizon.ai"
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Assigned Role</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="investigator">Investigator (Analysis & Evidence)</option>
                  <option value="manager">Compliance Manager (Signatory Authority)</option>
                  <option value="administrator">System Administrator (Full Control)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Temporary Password</label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="demo-password"
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground font-mono outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Default password is <code className="text-primary font-mono">demo-password</code>.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full mt-2"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Creating User…" : "Create User Account"}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Manage User Status Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Manage User Access</h3>
              <button
                onClick={() => setSelected(null)}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
                <p className="font-semibold text-foreground">{selected.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{selected.email}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground capitalize">
                    {selected.role}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                      selected.status === "Active"
                        ? "bg-teal/10 text-teal"
                        : "bg-risk-high/10 text-risk-high"
                    }`}
                  >
                    {selected.status}
                  </span>
                </div>
              </div>

              <Button
                variant={selected.status === "Active" ? "outline" : "default"}
                className="w-full gap-2"
                disabled={statusMutation.isPending}
                onClick={() => handleToggleStatus(selected)}
              >
                <UserCheck className="size-4" />
                {statusMutation.isPending
                  ? "Updating Status…"
                  : selected.status === "Active"
                  ? "Deactivate Account"
                  : "Reactivate Account"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
