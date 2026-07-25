"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Package,
  Radio,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/auth/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/products", label: "Products", icon: Package },
  { href: "/payments", label: "Payments", icon: Wallet },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/webhook-events", label: "Webhook Events", icon: Radio },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  async function handleLogout() {
    try {
      await logout();
      toast.success("Signed out");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logout failed");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className={cn(
          "mb-6 flex items-center gap-2 px-2 font-semibold tracking-tight",
          collapsed && "justify-center",
        )}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)] text-xs text-[var(--primary-foreground)]">
          VO
        </span>
        {!collapsed ? <span className="text-sm">Vimeo OTT</span> : null}
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={item.label}
              className={cn(
                "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-[var(--accent)] font-medium text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                collapsed && "justify-center px-2",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span>{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <Button
        variant="ghost"
        className={cn(
          "mt-4 justify-start gap-3 text-[var(--muted-foreground)]",
          collapsed && "justify-center px-2",
        )}
        onClick={handleLogout}
      >
        <LogOut className="h-4 w-4" />
        {!collapsed ? "Log out" : null}
      </Button>
    </div>
  );
}

export function Sidebar({ collapsed }: { collapsed?: boolean }) {
  return (
    <aside
      className={cn(
        "hidden h-screen shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)] px-3 py-4 md:flex",
        collapsed ? "w-[68px]" : "w-60",
      )}
    >
      <SidebarNav collapsed={collapsed} />
    </aside>
  );
}
