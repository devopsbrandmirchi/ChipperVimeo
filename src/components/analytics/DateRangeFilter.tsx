"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarDays, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7" },
  { id: "last30", label: "Last 30" },
] as const;

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format UTC calendar day as YYYY-MM-DD. */
export function toUtcYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Parse YYYY-MM-DD as a UTC noon Date (stable calendar math). */
export function parseUtcYmd(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, day] = ymd.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, day, 12));
  if (
    d.getUTCFullYear() !== y ||
    d.getUTCMonth() !== m - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}

function displayDmy(ymd: string): string {
  const d = parseUtcYmd(ymd);
  if (!d) return "";
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

function utcTodayYmd(): string {
  return toUtcYmd(new Date());
}

function addUtcMonths(d: Date, months: number): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, 12),
  );
}

function monthTitle(d: Date): string {
  return d.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function daysInMonthGrid(view: Date): Array<Date | null> {
  const year = view.getUTCFullYear();
  const month = view.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1, 12));
  const startPad = first.getUTCDay();
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let day = 1; day <= count; day++) {
    cells.push(new Date(Date.UTC(year, month, day, 12)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function compareYmd(a: string, b: string): number {
  return a.localeCompare(b);
}

export function DateRangeFilter({
  preset,
  startDate,
  endDate,
}: {
  preset: string;
  startDate: string;
  endDate: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const today = utcTodayYmd();
  const [isPending, startTransition] = useTransition();
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);

  // Clear optimistic selection once server props catch up.
  useEffect(() => {
    setPendingPreset(null);
  }, [preset, startDate, endDate]);

  const activePreset = pendingPreset ?? preset;

  const [open, setOpen] = useState(preset === "custom");
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const [picking, setPicking] = useState<"start" | "end">("start");
  const [leftMonth, setLeftMonth] = useState(() => {
    const d = parseUtcYmd(startDate) ?? new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12));
  });

  const rightMonth = useMemo(() => addUtcMonths(leftMonth, 1), [leftMonth]);

  function navigatePreset(id: string) {
    setOpen(false);
    setPendingPreset(id);
    startTransition(() => {
      router.push(`${pathname}?preset=${id}`);
    });
  }

  function applyCustom(start: string, end: string) {
    let s = start;
    let e = end;
    if (compareYmd(s, e) > 0) {
      const tmp = s;
      s = e;
      e = tmp;
    }
    if (compareYmd(e, today) > 0) e = today;
    if (compareYmd(s, e) > 0) s = e;
    setOpen(false);
    setPendingPreset("custom");
    startTransition(() => {
      router.push(
        `${pathname}?preset=custom&startDate=${encodeURIComponent(s)}&endDate=${encodeURIComponent(e)}`,
      );
    });
  }

  function onDayClick(day: Date) {
    const ymd = toUtcYmd(day);
    if (compareYmd(ymd, today) > 0) return;

    if (picking === "start") {
      setDraftStart(ymd);
      setPicking("end");
      if (compareYmd(ymd, draftEnd) > 0) setDraftEnd(ymd);
      return;
    }

    setDraftEnd(ymd);
    if (compareYmd(ymd, draftStart) < 0) {
      setDraftStart(ymd);
    }
    setPicking("start");
  }

  function inRange(ymd: string): boolean {
    if (!draftStart || !draftEnd) return false;
    return (
      compareYmd(ymd, draftStart) >= 0 && compareYmd(ymd, draftEnd) <= 0
    );
  }

  function onTypedChange(which: "start" | "end", value: string) {
    // Accept YYYY-MM-DD from native date input
    if (!parseUtcYmd(value)) return;
    if (which === "start") {
      setDraftStart(value);
      if (compareYmd(value, draftEnd) > 0) setDraftEnd(value);
    } else {
      setDraftEnd(value);
      if (compareYmd(value, draftStart) < 0) setDraftStart(value);
    }
  }

  const isCustom = activePreset === "custom";

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <Button
          key={p.id}
          size="sm"
          variant={activePreset === p.id ? "default" : "outline"}
          onClick={() => navigatePreset(p.id)}
          type="button"
          disabled={isPending}
          aria-pressed={activePreset === p.id}
        >
          {p.label}
        </Button>
      ))}
      <Button
        size="sm"
        variant={isCustom || open ? "default" : "outline"}
        type="button"
        disabled={isPending}
        onClick={() => {
          setDraftStart(startDate);
          setDraftEnd(endDate);
          setPicking("start");
          setOpen((v) => !v);
        }}
      >
        <CalendarDays className="size-3.5" />
        Custom
      </Button>
      {isPending ? (
        <span className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
          <Loader2 className="size-3.5 animate-spin" />
          Updating…
        </span>
      ) : null}

      {open ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-[min(100vw-2rem,40rem)] rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 shadow-lg">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-[var(--muted-foreground)]">Start Date</span>
              <Input
                type="date"
                max={today}
                value={draftStart}
                onChange={(e) => onTypedChange("start", e.target.value)}
                onFocus={() => setPicking("start")}
                aria-label="Start date"
              />
              <span className="block text-xs text-[var(--muted-foreground)]">
                {displayDmy(draftStart) || "DD/MM/YYYY"}
              </span>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--muted-foreground)]">End Date</span>
              <Input
                type="date"
                max={today}
                min={draftStart}
                value={draftEnd}
                onChange={(e) => onTypedChange("end", e.target.value)}
                onFocus={() => setPicking("end")}
                aria-label="End date"
              />
              <span className="block text-xs text-[var(--muted-foreground)]">
                {displayDmy(draftEnd) || "DD/MM/YYYY"}
              </span>
            </label>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Previous months"
              onClick={() => setLeftMonth((m) => addUtcMonths(m, -1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
              <MonthGrid
                title={monthTitle(leftMonth)}
                view={leftMonth}
                today={today}
                draftStart={draftStart}
                draftEnd={draftEnd}
                inRange={inRange}
                onDayClick={onDayClick}
              />
              <MonthGrid
                title={monthTitle(rightMonth)}
                view={rightMonth}
                today={today}
                draftStart={draftStart}
                draftEnd={draftEnd}
                inRange={inRange}
                onDayClick={onDayClick}
              />
            </div>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Next months"
              onClick={() => setLeftMonth((m) => addUtcMonths(m, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
            <p className="text-xs text-[var(--muted-foreground)]">
              Selecting {picking === "start" ? "start" : "end"} · UTC days ·
              future dates disabled
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => applyCustom(draftStart, draftEnd)}
                disabled={!draftStart || !draftEnd}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MonthGrid({
  title,
  view,
  today,
  draftStart,
  draftEnd,
  inRange,
  onDayClick,
}: {
  title: string;
  view: Date;
  today: string;
  draftStart: string;
  draftEnd: string;
  inRange: (ymd: string) => boolean;
  onDayClick: (day: Date) => void;
}) {
  const cells = daysInMonthGrid(view);

  return (
    <div>
      <p className="mb-2 text-center text-sm font-medium">{title}</p>
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-[var(--muted-foreground)]">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 font-medium">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (!day) {
            return <div key={`e-${idx}`} className="h-8" />;
          }
          const ymd = toUtcYmd(day);
          const disabled = compareYmd(ymd, today) > 0;
          const isStart = ymd === draftStart;
          const isEnd = ymd === draftEnd;
          const selected = isStart || isEnd;
          const ranged = !selected && inRange(ymd);

          return (
            <button
              key={ymd}
              type="button"
              disabled={disabled}
              onClick={() => onDayClick(day)}
              className={cn(
                "h-8 rounded-md text-sm transition-colors",
                disabled && "cursor-not-allowed text-[var(--muted-foreground)]/40",
                !disabled && !selected && !ranged && "hover:bg-[var(--accent)]",
                ranged && "bg-[var(--accent)]/70",
                selected &&
                  "bg-[var(--primary)] text-[var(--primary-foreground)]",
              )}
            >
              {day.getUTCDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
