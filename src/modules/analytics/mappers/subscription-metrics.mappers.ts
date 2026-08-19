import type {
  SubscriptionGainLossRow,
  SubscriptionGainLossTotals,
  SubscriptionMetricsResponse,
} from "@/modules/analytics/dto/responses";
import type { SubscriptionMetricsFilters } from "@/modules/analytics/dto/filters";
import type {
  SubscriptionMetricsDbRow,
  SubscriptionMetricsDayCountryDbRow,
  SubscriptionMetricsGrouped,
} from "@/modules/analytics/repository/subscription-metrics.repository";

function num(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

type SubscriptionMetricsRangeInput = Pick<
  Partial<SubscriptionMetricsFilters>,
  "preset" | "startDate" | "endDate"
>;

export function resolveSubscriptionMetricsRange(
  filters: SubscriptionMetricsRangeInput,
): {
  startDate: string;
  endDate: string;
  preset: NonNullable<SubscriptionMetricsFilters["preset"]>;
} {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const preset = filters.preset ?? "yesterday";

  if (preset === "custom" || filters.startDate || filters.endDate) {
    let start = filters.startDate ?? filters.endDate ?? todayStr;
    let end = filters.endDate ?? filters.startDate ?? todayStr;
    if (start > end) {
      const tmp = start;
      start = end;
      end = tmp;
    }
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
  if (preset === "last7") {
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - 6);
    return {
      startDate: from.toISOString().slice(0, 10),
      endDate: todayStr,
      preset: "last7",
    };
  }
  // default: yesterday
  const y = new Date(today);
  y.setUTCDate(y.getUTCDate() - 1);
  const s = y.toISOString().slice(0, 10);
  return { startDate: s, endDate: s, preset: "yesterday" };
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

function toBreakdownRow(
  row: SubscriptionMetricsDbRow,
  mode: "day" | "platform" | "country" | "product",
): SubscriptionGainLossRow {
  const totals = withConversionRate({
    subscriptionGain: num(row.subscription_gain),
    subscriptionLoss: num(row.subscription_loss),
    trialGain: num(row.trial_gain),
    trialLoss: num(row.trial_loss),
    trialConversion: num(row.trial_conversion),
    combinedGain: num(row.combined_gain),
    combinedLoss: num(row.combined_loss),
    uniqueCustomersGain: num(row.unique_customers_gain),
    uniqueCustomersLoss: num(row.unique_customers_loss),
    conversionRate: 0,
  });

  if (mode === "day") {
    return {
      key: row.report_date,
      label: row.report_date,
      reportDate: row.report_date,
      ...totals,
    };
  }
  if (mode === "platform") {
    return {
      key: row.platform,
      label: row.platform,
      platform: row.platform,
      ...totals,
    };
  }
  if (mode === "country") {
    return {
      key: row.country,
      label: row.country,
      country: row.country,
      ...totals,
    };
  }
  return {
    key: row.product_id,
    label: row.product_id,
    productId: row.product_id,
    ...totals,
  };
}

/** Legacy helper for tests that still pass fine-grained rows. */
function groupRows(
  rows: SubscriptionMetricsDbRow[],
  mode: "day" | "platform" | "country" | "product",
): SubscriptionGainLossRow[] {
  const map = new Map<
    string,
    SubscriptionGainLossTotals & { meta: Partial<SubscriptionGainLossRow> }
  >();

  for (const row of rows) {
    let key: string;
    const meta: Partial<SubscriptionGainLossRow> = {};
    if (mode === "day") {
      key = row.report_date;
      meta.reportDate = row.report_date;
    } else if (mode === "platform") {
      key = row.platform;
      meta.platform = row.platform;
    } else if (mode === "country") {
      key = row.country;
      meta.country = row.country;
    } else {
      key = row.product_id;
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
        label:
          value.meta.reportDate ??
          value.meta.platform ??
          value.meta.country ??
          value.meta.productId ??
          key,
        ...value.meta,
        ...totals,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function mapSubscriptionMetricsResponse(
  grouped: SubscriptionMetricsGrouped | SubscriptionMetricsDbRow[],
  dayCountryRows: SubscriptionMetricsDayCountryDbRow[],
  range: { startDate: string; endDate: string; preset: string },
): SubscriptionMetricsResponse {
  // Back-compat: tests may still pass a flat row array.
  const grains: SubscriptionMetricsGrouped = Array.isArray(grouped)
    ? {
        byDay: grouped,
        byPlatform: groupRows(grouped, "platform").map((r) => ({
          report_date: "",
          platform: r.platform ?? r.key,
          country: "",
          product_id: "",
          subscription_gain: r.subscriptionGain,
          subscription_loss: r.subscriptionLoss,
          trial_gain: r.trialGain,
          trial_loss: r.trialLoss,
          trial_conversion: r.trialConversion,
          combined_gain: r.combinedGain,
          combined_loss: r.combinedLoss,
          unique_customers_gain: r.uniqueCustomersGain,
          unique_customers_loss: r.uniqueCustomersLoss,
        })),
        byCountry: groupRows(grouped, "country").map((r) => ({
          report_date: "",
          platform: "",
          country: r.country ?? r.key,
          product_id: "",
          subscription_gain: r.subscriptionGain,
          subscription_loss: r.subscriptionLoss,
          trial_gain: r.trialGain,
          trial_loss: r.trialLoss,
          trial_conversion: r.trialConversion,
          combined_gain: r.combinedGain,
          combined_loss: r.combinedLoss,
          unique_customers_gain: r.uniqueCustomersGain,
          unique_customers_loss: r.uniqueCustomersLoss,
        })),
        byProduct: groupRows(grouped, "product").map((r) => ({
          report_date: "",
          platform: "",
          country: "",
          product_id: r.productId ?? r.key,
          subscription_gain: r.subscriptionGain,
          subscription_loss: r.subscriptionLoss,
          trial_gain: r.trialGain,
          trial_loss: r.trialLoss,
          trial_conversion: r.trialConversion,
          combined_gain: r.combinedGain,
          combined_loss: r.combinedLoss,
          unique_customers_gain: r.uniqueCustomersGain,
          unique_customers_loss: r.uniqueCustomersLoss,
        })),
      }
    : grouped;

  const totals = emptyTotals();
  for (const row of grains.byDay) addRow(totals, row);

  const todayUtc = utcToday();
  const byDayCountry: SubscriptionGainLossRow[] = dayCountryRows
    .filter((row) => row.report_date < todayUtc)
    .map((row) => {
      const baseTotals: SubscriptionGainLossTotals = {
        subscriptionGain: num(row.subscription_gain),
        subscriptionLoss: num(row.subscription_loss),
        trialGain: num(row.trial_gain),
        trialLoss: num(row.trial_loss),
        trialConversion: num(row.trial_conversion),
        combinedGain: num(row.combined_gain),
        combinedLoss: num(row.combined_loss),
        uniqueCustomersGain: num(row.unique_customers_gain),
        uniqueCustomersLoss: num(row.unique_customers_loss),
        conversionRate: 0,
      };

      const totalsWithRate = withConversionRate(baseTotals);
      return {
        key: `${row.report_date}|${row.country}`,
        label: row.country,
        reportDate: row.report_date,
        country: row.country,
        uniqueSubscriptionGain: num(row.unique_subscription_gain),
        uniqueSubscriptionLoss: num(row.unique_subscription_loss),
        uniqueTrialGain: num(row.unique_trial_gain),
        uniqueTrialLoss: num(row.unique_trial_loss),
        ...totalsWithRate,
      };
    })
    .sort((a, b) => {
      const dayCmp = (b.reportDate ?? "").localeCompare(a.reportDate ?? "");
      if (dayCmp !== 0) return dayCmp;
      const gainCmp = b.uniqueCustomersGain - a.uniqueCustomersGain;
      if (gainCmp !== 0) return gainCmp;
      return b.combinedLoss - a.combinedLoss;
    });

  const byPlatform = grains.byPlatform
    .filter((r) => r.platform)
    .map((r) => toBreakdownRow(r, "platform"))
    .sort((a, b) => a.key.localeCompare(b.key));

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
    series: grains.byDay
      .filter((r) => r.report_date)
      .map((r) => toBreakdownRow(r, "day"))
      .sort((a, b) => a.key.localeCompare(b.key)),
    byPlatform: [...byPlatform, platformTotal],
    byCountry: grains.byCountry
      .filter((r) => r.country)
      .map((r) => toBreakdownRow(r, "country"))
      .sort((a, b) => a.key.localeCompare(b.key)),
    byProduct: grains.byProduct
      .filter((r) => r.product_id)
      .map((r) => toBreakdownRow(r, "product"))
      .sort((a, b) => a.key.localeCompare(b.key)),
    byDayCountry,
    source: "subscription_events",
  };
}
