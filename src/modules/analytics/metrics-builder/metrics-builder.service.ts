import type { Logger } from "@/processors/logger/logger";
import { BaseService } from "@/services/shared/base.service";
import { DailyMetricsRepository } from "@/modules/analytics/repository/daily-metrics.repository";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type BuildDailyResult = {
  ok: true;
  mode: "date" | "range" | "all";
  dateFrom: string | null;
  dateTo: string | null;
  built: number;
  failed: Array<{ date: string; error: string }>;
};

export interface IMetricsBuilderService {
  buildForDate(date: string): Promise<BuildDailyResult>;
  buildRange(startDate: string, endDate: string): Promise<BuildDailyResult>;
  rebuildAll(): Promise<BuildDailyResult>;
}

function assertDate(value: string, label: string): string {
  if (!DATE_RE.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
  return value;
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function eachDateInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  if (cur > last) {
    throw new Error("startDate must be on or before endDate");
  }
  while (cur <= last) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/**
 * Builds analytics.daily_* from normalized public tables via SQL RPC.
 * Idempotent — rebuilding the same day overwrites snapshot rows only.
 */
export class MetricsBuilderService
  extends BaseService
  implements IMetricsBuilderService
{
  constructor(
    private readonly repo: DailyMetricsRepository,
    logger: Logger,
  ) {
    super("MetricsBuilderService", logger);
  }

  async buildForDate(date: string): Promise<BuildDailyResult> {
    return this.timed("buildForDate", async () => {
      const d = assertDate(date, "date");
      try {
        await this.repo.buildForDate(d);
        this.logger.info("Daily snapshots built", {
          action: "daily_metrics_build",
          date: d,
        });
        return {
          ok: true as const,
          mode: "date" as const,
          dateFrom: d,
          dateTo: d,
          built: 1,
          failed: [],
        };
      } catch (error) {
        this.mapRepositoryError(error, "buildForDate");
      }
    });
  }

  async buildRange(
    startDate: string,
    endDate: string,
  ): Promise<BuildDailyResult> {
    return this.timed("buildRange", async () => {
      const start = assertDate(startDate, "startDate");
      const end = assertDate(endDate, "endDate");
      const days = eachDateInclusive(start, end);
      const failed: Array<{ date: string; error: string }> = [];
      let built = 0;

      for (const day of days) {
        try {
          await this.repo.buildForDate(day);
          built += 1;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown build error";
          failed.push({ date: day, error: message });
          this.logger.error("Daily snapshot build failed for date", {
            action: "daily_metrics_build",
            date: day,
            error: message,
          });
        }
      }

      this.logger.info("Daily snapshots range build complete", {
        action: "daily_metrics_build_range",
        dateFrom: start,
        dateTo: end,
        built,
        failed: failed.length,
      });

      return {
        ok: true as const,
        mode: "range" as const,
        dateFrom: start,
        dateTo: end,
        built,
        failed,
      };
    });
  }

  async rebuildAll(): Promise<BuildDailyResult> {
    return this.timed("rebuildAll", async () => {
      try {
        const earliest = await this.repo.earliestMetricsDate();
        const end = utcToday();
        if (!earliest) {
          return {
            ok: true as const,
            mode: "all" as const,
            dateFrom: null,
            dateTo: end,
            built: 0,
            failed: [],
          };
        }
        const result = await this.buildRange(earliest, end);
        return { ...result, mode: "all" as const };
      } catch (error) {
        this.mapRepositoryError(error, "rebuildAll");
      }
    });
  }
}
