"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

export function SearchBox() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) {
      router.push("/customers");
      return;
    }
    router.push(`/customers?search=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={onSubmit} className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search customers…"
        className="pl-8"
        aria-label="Search customers"
      />
    </form>
  );
}
