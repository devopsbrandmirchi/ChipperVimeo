"use client";

import {
  Area,
  AreaChart as ReAreaChart,
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as ReLineChart,
  Pie,
  PieChart as RePieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "@/components/common/feedback";

const COLORS = ["#18181b", "#52525b", "#a1a1aa", "#3f3f46", "#71717a", "#d4d4d8"];

export type ChartPoint = { name: string; value: number };

function ChartShell({
  title,
  note,
  children,
  empty,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {note ? (
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{note}</p>
        ) : null}
      </div>
      {empty ? (
        <EmptyState
          title="No series data yet"
          description={note ?? "Placeholder analytics — breakdowns arrive in a later phase."}
        />
      ) : (
        <div className="h-56 w-full">{children}</div>
      )}
    </div>
  );
}

export function LineChart({
  title,
  data,
  note,
}: {
  title: string;
  data: ChartPoint[];
  note?: string;
}) {
  const empty = data.length === 0;
  return (
    <ChartShell title={title} note={note} empty={empty}>
      <ResponsiveContainer width="100%" height="100%">
        <ReLineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--border)]" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#18181b" strokeWidth={2} dot={false} />
        </ReLineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function AreaChart({
  title,
  data,
  note,
}: {
  title: string;
  data: ChartPoint[];
  note?: string;
}) {
  const empty = data.length === 0;
  return (
    <ChartShell title={title} note={note} empty={empty}>
      <ResponsiveContainer width="100%" height="100%">
        <ReAreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Area type="monotone" dataKey="value" stroke="#18181b" fill="#a1a1aa" fillOpacity={0.35} />
        </ReAreaChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function BarChart({
  title,
  data,
  note,
}: {
  title: string;
  data: ChartPoint[];
  note?: string;
}) {
  const empty = data.length === 0;
  return (
    <ChartShell title={title} note={note} empty={empty}>
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="value" fill="#18181b" radius={[4, 4, 0, 0]} />
        </ReBarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function PieChart({
  title,
  data,
  note,
}: {
  title: string;
  data: ChartPoint[];
  note?: string;
}) {
  const empty = data.length === 0 || data.every((d) => d.value === 0);
  return (
    <ChartShell title={title} note={note} empty={empty}>
      <ResponsiveContainer width="100%" height="100%">
        <RePieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={80} label>
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </RePieChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
