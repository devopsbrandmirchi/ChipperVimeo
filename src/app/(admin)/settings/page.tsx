import { Topbar } from "@/components/layout/Topbar";
import { ComingSoon } from "@/components/ui/ComingSoon";

export default function SettingsPage() {
  return (
    <>
      <Topbar title="Settings" />
      <ComingSoon
        title="Settings coming soon"
        description="Phase 2 will cover webhook endpoint info, env checks, and admin preferences."
      />
    </>
  );
}
