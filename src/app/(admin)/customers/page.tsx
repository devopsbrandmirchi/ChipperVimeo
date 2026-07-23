import { Topbar } from "@/components/layout/Topbar";
import { ComingSoon } from "@/components/ui/ComingSoon";

export default function CustomersPage() {
  return (
    <>
      <Topbar title="Customers" />
      <ComingSoon
        title="Customers coming soon"
        description="Phase 2 will aggregate customer identity from webhook payloads."
      />
    </>
  );
}
