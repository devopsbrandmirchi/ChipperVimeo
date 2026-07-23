import { Topbar } from "@/components/layout/Topbar";
import { ComingSoon } from "@/components/ui/ComingSoon";

export default function DashboardPage() {
  return (
    <>
      <Topbar title="Dashboard" />
      <ComingSoon
        title="Dashboard coming soon"
        description="Phase 2 will show ingest health, recent topics, and quick links into events, customers, and subscriptions."
      />
    </>
  );
}
