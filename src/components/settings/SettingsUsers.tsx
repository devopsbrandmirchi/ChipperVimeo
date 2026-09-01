"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/auth/hooks/useAuth";
import type { AdminUserRecord } from "@/auth/repositories/admin-user.repository";
import type { AuthAuditEvent } from "@/auth/repositories/auth-audit.repository";
import type { AppRole } from "@/auth/types/roles";
import { APP_ROLES } from "@/auth/types/roles";
import {
  ErrorCard,
  LoadingSpinner,
  ModulePlaceholder,
  StatusChip,
} from "@/components/common/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/lib/api/errors";
import {
  apiGetClient,
  apiPatchClient,
  apiPostClient,
} from "@/lib/api/client";
import { formatDateTime } from "@/lib/utils";

type AdminUsersPayload = {
  users: AdminUserRecord[];
  audit: AuthAuditEvent[];
};

export function SettingsUsers() {
  const { hasPermission, user: me } = useAuth();
  const canManage = hasPermission("settings:manage");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [audit, setAudit] = useState<AuthAuditEvent[]>([]);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("ANALYST");
  const [method, setMethod] = useState<"invite" | "create">("invite");
  const [password, setPassword] = useState("");

  const load = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetClient<AdminUsersPayload>("/admin/users");
      setUsers(res.data.users);
      setAudit(res.data.audit);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load users",
      );
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canManage) {
    return (
      <ModulePlaceholder
        title="Users & access"
        description="Only ADMIN (settings:manage) can invite users and change roles."
      >
        <p className="text-sm text-[var(--muted-foreground)]">
          Your role ({me?.role ?? "none"}) cannot manage panel users. Ask an
          ADMIN to grant access.
        </p>
      </ModulePlaceholder>
    );
  }

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiPostClient<AdminUserRecord>("/admin/users", {
        email,
        role,
        method,
        password: method === "create" ? password : undefined,
      });
      setNotice(
        method === "invite"
          ? `Invite sent to ${email}. They set a password via the email link.`
          : `User ${email} created with role ${role}.`,
      );
      setEmail("");
      setPassword("");
      await load();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to add user",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onRoleChange(userId: string, nextRole: AppRole) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiPatchClient<AdminUserRecord>(`/admin/users/${userId}`, {
        role: nextRole,
      });
      setNotice("Role updated.");
      await load();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to update role",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <ModulePlaceholder
        title="Users & access"
        description="Invite or create panel users and assign ADMIN / MANAGER / ANALYST / READ_ONLY."
      >
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-6">
            {error ? (
              <ErrorCard title="User admin error" message={error} />
            ) : null}
            {notice ? (
              <p className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-sm">
                {notice}
              </p>
            ) : null}

            <form onSubmit={onInvite} className="space-y-3">
              <p className="text-sm font-medium">Add user</p>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@company.com"
                  disabled={saving}
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as AppRole)}
                  className="h-9 rounded-md border border-[var(--input)] bg-transparent px-3 text-sm"
                  aria-label="Role"
                  disabled={saving}
                >
                  {APP_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <select
                  value={method}
                  onChange={(e) =>
                    setMethod(e.target.value as "invite" | "create")
                  }
                  className="h-9 rounded-md border border-[var(--input)] bg-transparent px-3 text-sm"
                  aria-label="Provision method"
                  disabled={saving}
                >
                  <option value="invite">Invite by email</option>
                  <option value="create">Create with password</option>
                </select>
                {method === "create" ? (
                  <Input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Temp password (min 8)"
                    disabled={saving}
                  />
                ) : (
                  <div />
                )}
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                Invite requires Supabase Auth email configured. Create is useful
                when SMTP is not set up. Users need a role to pass access checks.
              </p>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                {saving ? "Saving…" : method === "invite" ? "Send invite" : "Create user"}
              </Button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-[var(--muted-foreground)]">
                  <tr>
                    <th className="pb-2 font-medium">Email</th>
                    <th className="pb-2 font-medium">Role</th>
                    <th className="pb-2 font-medium">Last sign-in</th>
                    <th className="pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-[var(--border)]">
                      <td className="py-2">
                        <div className="font-medium">{u.email || "—"}</div>
                        <div className="font-mono text-xs text-[var(--muted-foreground)]">
                          {u.id.slice(0, 8)}…
                        </div>
                      </td>
                      <td className="py-2">
                        <select
                          value={u.role ?? ""}
                          onChange={(e) => {
                            const next = e.target.value as AppRole;
                            if (!next || next === u.role) return;
                            void onRoleChange(u.id, next);
                          }}
                          className="h-8 rounded-md border border-[var(--input)] bg-transparent px-2 text-sm"
                          aria-label={`Role for ${u.email}`}
                          disabled={saving}
                        >
                          {!u.role ? (
                            <option value="">No role</option>
                          ) : null}
                          {APP_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 text-[var(--muted-foreground)]">
                        {formatDateTime(u.lastSignInAt)}
                      </td>
                      <td className="py-2 text-[var(--muted-foreground)]">
                        {formatDateTime(u.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  No auth users found.
                </p>
              ) : null}
            </div>
          </div>
        )}
      </ModulePlaceholder>

      <ModulePlaceholder
        title="Access audit"
        description="Recent invite / create / role_change events (requires migration 038)."
      >
        {audit.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            No audit events yet. Apply migration{" "}
            <code className="text-xs">038_auth_audit_events.sql</code> if this
            stays empty after actions.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {audit.map((ev) => (
              <li
                key={ev.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div>
                  <StatusChip status={ev.action} />
                  <p className="mt-1">
                    {ev.actor_email ?? "system"} →{" "}
                    {ev.target_email ?? ev.target_user_id ?? "—"}
                  </p>
                </div>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {formatDateTime(ev.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ModulePlaceholder>
    </div>
  );
}
