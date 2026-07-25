"use client";

import { useState } from "react";
import { Bell, Menu, PanelLeftClose, PanelLeft } from "lucide-react";

import { SearchBox } from "@/components/layout/SearchBox";
import { SidebarNav } from "@/components/layout/Sidebar";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { UserMenu } from "@/components/layout/UserMenu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Topbar({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--background)]/90 px-4 backdrop-blur">
      <div className="flex items-center gap-1 md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-4 pt-10">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="hidden md:inline-flex"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={onToggleCollapse}
      >
        {collapsed ? (
          <PanelLeft className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </Button>

      <div className="hidden flex-1 sm:block">
        <SearchBox />
      </div>
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          disabled
          title="Notifications coming soon"
        >
          <Bell className="h-4 w-4" />
        </Button>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
