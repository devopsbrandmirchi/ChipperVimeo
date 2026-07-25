"use client";

import { useAuth } from "@/auth/hooks/useAuth";
import {
  LoadingSpinner,
  ModulePlaceholder,
} from "@/components/common/feedback";

export function SettingsProfile() {
  const { user, loading } = useAuth();

  return (
    <ModulePlaceholder
      title="Profile"
      description="Signed-in admin identity from Supabase Auth."
    >
      {loading ? (
        <LoadingSpinner />
      ) : (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-[var(--muted-foreground)]">Email</dt>
            <dd className="font-medium">{user?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted-foreground)]">Role</dt>
            <dd className="font-medium">{user?.role ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted-foreground)]">User id</dt>
            <dd className="font-mono text-xs">{user?.id ?? "—"}</dd>
          </div>
        </dl>
      )}
    </ModulePlaceholder>
  );
}
