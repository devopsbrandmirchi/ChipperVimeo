import { Topbar } from "@/components/layout/Topbar";
import { ComingSoon } from "@/components/ui/ComingSoon";

export default function WebhookEventsPage() {
  return (
    <>
      <Topbar title="Webhook events" />
      <ComingSoon
        title="Webhook events coming soon"
        description="Phase 2 will browse and filter rows from vott_events (topic, customer, date range)."
      />
    </>
  );
}
