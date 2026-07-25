"use client";

import dynamic from "next/dynamic";

import type { ChartPoint } from "@/components/charts/charts";
import { Skeleton } from "@/components/ui/skeleton";

const LineChart = dynamic(
  () => import("@/components/charts/charts").then((m) => m.LineChart),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full rounded-xl" /> },
);
const AreaChart = dynamic(
  () => import("@/components/charts/charts").then((m) => m.AreaChart),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full rounded-xl" /> },
);
const BarChart = dynamic(
  () => import("@/components/charts/charts").then((m) => m.BarChart),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full rounded-xl" /> },
);
const PieChart = dynamic(
  () => import("@/components/charts/charts").then((m) => m.PieChart),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full rounded-xl" /> },
);

export function DashboardCharts({
  customerGrowth,
  revenueTrend,
  subscriptionGrowth,
  platforms,
  countries,
  topProducts,
  notes,
}: {
  customerGrowth: ChartPoint[];
  revenueTrend: ChartPoint[];
  subscriptionGrowth: ChartPoint[];
  platforms: ChartPoint[];
  countries: ChartPoint[];
  topProducts: ChartPoint[];
  notes: {
    customers?: string;
    revenue?: string;
    subscriptions?: string;
    platforms?: string;
    countries?: string;
    products?: string;
  };
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <LineChart
        title="Customer growth"
        data={customerGrowth}
        note={notes.customers}
      />
      <AreaChart
        title="Revenue trend"
        data={revenueTrend}
        note={notes.revenue}
      />
      <BarChart
        title="Subscription growth"
        data={subscriptionGrowth}
        note={notes.subscriptions}
      />
      <PieChart
        title="Platform distribution"
        data={platforms}
        note={notes.platforms}
      />
      <PieChart
        title="Country distribution"
        data={countries}
        note={notes.countries}
      />
      <BarChart
        title="Top products"
        data={topProducts}
        note={notes.products}
      />
    </div>
  );
}
