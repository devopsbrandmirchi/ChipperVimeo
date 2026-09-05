"use client";

import {
  Area,
  AreaChart as ReAreaChart,
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Cell,
  Legend,
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

const COLORS = [
  "#18181b",
  "#3f3f46",
  "#52525b",
  "#71717a",
  "#a1a1aa",
  "#d4d4d8",
  "#27272a",
  "#09090b",
];

export type ChartPoint = { name: string; value: number };

function ChartShell({
  title,
  note,
  children,
  empty,
  chartClassName = "h-56",
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  empty?: boolean;
  chartClassName?: string;
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
          description={
            note ??
            "No points for this chart. Refresh daily metrics or widen the date range."
          }
        />
      ) : (
        <div className={`w-full ${chartClassName}`}>{children}</div>
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
    <ChartShell title={title} note={note} empty={empty} chartClassName="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RePieChart margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="42%"
            cy="50%"
            outerRadius={78}
            label={false}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [
              typeof value === "number" ? value.toLocaleString("en-US") : value,
              "Count",
            ]}
          />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{
              fontSize: 12,
              lineHeight: "18px",
              maxWidth: "46%",
              overflow: "hidden",
            }}
            formatter={(value) => {
              const point = data.find((d) => d.name === value);
              const count =
                point != null ? point.value.toLocaleString("en-US") : "";
              return `${value}${count ? ` (${count})` : ""}`;
            }}
          />
        </RePieChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
