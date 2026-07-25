"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/auth/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 gap-2 px-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[140px] truncate text-sm md:inline">
            {loading ? "…" : (user?.email ?? "Account")}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-[var(--foreground)]">
              {user?.email ?? "Signed out"}
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              {user?.role ?? "No role"}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/change-password">
            <KeyRound className="mr-2 h-4 w-4" />
            Change password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
