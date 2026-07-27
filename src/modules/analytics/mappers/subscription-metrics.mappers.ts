import type {
  SubscriptionGainLossRow,
  SubscriptionGainLossTotals,
  SubscriptionMetricsResponse,
} from "@/modules/analytics/dto/responses";
import type { SubscriptionMetricsFilters } from "@/modules/analytics/dto/filters";
import type { SubscriptionMetricsDbRow } from "@/modules/analytics/repository/subscription-metrics.repository";

function num(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function resolveSubscriptionMetricsRange(
  filters: SubscriptionMetricsFilters,
): { startDate: string; endDate: string; preset: string } {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const preset = filters.preset ?? "last7";

  if (preset === "custom" || filters.startDate || filters.endDate) {
    const start = filters.startDate ?? filters.endDate ?? todayStr;
    const end = filters.endDate ?? filters.startDate ?? todayStr;
    return { startDate: start, endDate: end, preset: "custom" };
  }

  if (preset === "today") {
    return { startDate: todayStr, endDate: todayStr, preset };
  }
  if (preset === "yesterday") {
    const y = new Date(today);
    y.setUTCDate(y.getUTCDate() - 1);
    const s = y.toISOString().slice(0, 10);
    return { startDate: s, endDate: s, preset };
  }
  if (preset === "last30") {
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - 29);
    return {
      startDate: from.toISOString().slice(0, 10),
      endDate: todayStr,
      preset,
    };
  }
  // last7
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - 6);
  return {
    startDate: from.toISOString().slice(0, 10),
    endDate: todayStr,
    preset: "last7",
  };
}

function emptyTotals(): SubscriptionGainLossTotals {
  return {
    subscriptionGain: 0,
    subscriptionLoss: 0,
    trialGain: 0,
    trialLoss: 0,
    trialConversion: 0,
    combinedGain: 0,
    combinedLoss: 0,
    uniqueCustomersGain: 0,
    uniqueCustomersLoss: 0,
    conversionRate: 0,
  };
}

function addRow(
  acc: SubscriptionGainLossTotals,
  row: SubscriptionMetricsDbRow,
): void {
  acc.subscriptionGain += num(row.subscription_gain);
  acc.subscriptionLoss += num(row.subscription_loss);
  acc.trialGain += num(row.trial_gain);
  acc.trialLoss += num(row.trial_loss);
  acc.trialConversion += num(row.trial_conversion);
  acc.combinedGain += num(row.combined_gain);
  acc.combinedLoss += num(row.combined_loss);
  acc.uniqueCustomersGain += num(row.unique_customers_gain);
  acc.uniqueCustomersLoss += num(row.unique_customers_loss);
}

function withConversionRate(
  t: SubscriptionGainLossTotals,
): SubscriptionGainLossTotals {
  return {
    ...t,
    conversionRate:
      t.trialGain > 0
        ? Number(((t.trialConversion / t.trialGain) * 100).toFixed(2))
        : 0,
  };
}

function groupRows(
  rows: SubscriptionMetricsDbRow[],
  mode: "day" | "platform" | "country" | "product",
): SubscriptionGainLossRow[] {
  const map = new Map<string, SubscriptionGainLossTotals & { meta: Partial<SubscriptionGainLossRow> }>();

  for (const row of rows) {
    let key: string;
    let label: string;
    const meta: Partial<SubscriptionGainLossRow> = {};
    if (mode === "day") {
      key = row.report_date;
      label = row.report_date;
      meta.reportDate = row.report_date;
    } else if (mode === "platform") {
      key = row.platform;
      label = row.platform;
      meta.platform = row.platform;
    } else if (mode === "country") {
      key = row.country;
      label = row.country;
      meta.country = row.country;
    } else {
      key = row.product_id;
      label = row.product_id;
      meta.productId = row.product_id;
    }

    const cur = map.get(key) ?? { ...emptyTotals(), meta };
    addRow(cur, row);
    map.set(key, cur);
  }

  return [...map.entries()]
    .map(([key, value]) => {
      const totals = withConversionRate(value);
      return {
        key,
        label: value.meta.reportDate ?? value.meta.platform ?? value.meta.country ?? value.meta.productId ?? key,
        ...value.meta,
        ...totals,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function mapSubscriptionMetricsResponse(
  rows: SubscriptionMetricsDbRow[],
  range: { startDate: string; endDate: string; preset: string },
): SubscriptionMetricsResponse {
  const totals = emptyTotals();
  for (const row of rows) addRow(totals, row);

  const byPlatform = groupRows(rows, "platform");
  const platformTotal: SubscriptionGainLossRow = {
    key: "TOTAL",
    label: "TOTAL",
    platform: "TOTAL",
    ...withConversionRate(totals),
  };

  return {
    startDate: range.startDate,
    endDate: range.endDate,
    preset: range.preset,
    totals: withConversionRate(totals),
    series: groupRows(rows, "day"),
    byPlatform: [...byPlatform, platformTotal],
    byCountry: groupRows(rows, "country"),
    byProduct: groupRows(rows, "product"),
    source: "subscription_events",
  };
}
