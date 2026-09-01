import Link from "next/link";

import { ErrorCard, ModulePlaceholder } from "@/components/common/feedback";
import { PageHeader } from "@/components/layout/PageHeader";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { SettingsProfile } from "@/components/settings/SettingsProfile";
import { SettingsUsers } from "@/components/settings/SettingsUsers";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api/errors";
import { apiGetServer } from "@/lib/api/server";

type HealthData = {
  status: string;
  version: string;
  time: string;
};

export default async function SettingsPage() {
  let health: HealthData | null = null;
  let healthError: string | null = null;

  try {
    const result = await apiGetServer<HealthData>("/health");
    health = result.data;
  } catch (error) {
    healthError =
      error instanceof ApiClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Health check failed";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Profile, theme, user access, and system information."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings" },
        ]}
      />

      <SettingsProfile />

      <SettingsUsers />

      <ModulePlaceholder
        title="Theme"
        description="Light, dark, or system. Preference is persisted in the browser."
      >
        <ThemeToggle />
      </ModulePlaceholder>

      <ModulePlaceholder
        title="System information"
        description="Application health from GET /api/v1/health (authenticated)."
      >
        {healthError ? (
          <ErrorCard title="Health unavailable" message={healthError} />
        ) : health ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-[var(--muted-foreground)]">Status</dt>
              <dd className="font-medium">{health.status}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted-foreground)]">Version</dt>
              <dd className="font-medium">{health.version}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted-foreground)]">Server time</dt>
              <dd className="font-medium">{health.time}</dd>
            </div>
          </dl>
        ) : null}
      </ModulePlaceholder>

      <ModulePlaceholder
        title="Webhook status"
        description="Vimeo ingest remains public and is not gated by admin auth."
      >
        <p className="text-sm">
          Endpoint:{" "}
          <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-xs">
            POST /api/webhooks/vimeo
          </code>
        </p>
      </ModulePlaceholder>

      <ModulePlaceholder title="Security" description="Password management.">
        <Button variant="outline" size="sm" asChild>
          <Link href="/change-password">Change password</Link>
        </Button>
      </ModulePlaceholder>
    </div>
  );
}
