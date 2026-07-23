import { Topbar } from "@/components/layout/Topbar";
import { ComingSoon } from "@/components/ui/ComingSoon";

export default function SubscriptionsPage() {
  return (
    <>
      <Topbar title="Subscriptions" />
      <ComingSoon
        title="Subscriptions coming soon"
        description="Phase 2 will track product lifecycle topics (created, renewed, cancelled, paused, etc.)."
      />
    </>
  );
}
