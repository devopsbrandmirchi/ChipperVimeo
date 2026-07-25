import { describe, expect, it, vi } from "vitest";

import { MetricsBuilderService } from "@/modules/analytics/metrics-builder/metrics-builder.service";
import type { DailyMetricsRepository } from "@/modules/analytics/repository/daily-metrics.repository";
import { Logger } from "@/processors/logger/logger";

function mockDailyRepo(
  overrides: Partial<DailyMetricsRepository> = {},
): DailyMetricsRepository {
  return {
    buildForDate: vi.fn().mockResolvedValue(undefined),
    earliestMetricsDate: vi.fn().mockResolvedValue("2026-07-01"),
    listSubscriptionMetrics: vi.fn(),
    listTrialMetrics: vi.fn(),
    listPaymentMetrics: vi.fn(),
    listCustomerMetrics: vi.fn(),
    listProductMetrics: vi.fn(),
    listCountryMetrics: vi.fn(),
    listPlatformMetrics: vi.fn(),
    ...overrides,
  } as unknown as DailyMetricsRepository;
}

describe("MetricsBuilderService", () => {
  const logger = new Logger({ service: "test" });

  it("buildForDate is idempotent when called twice", async () => {
    const repo = mockDailyRepo();
    const service = new MetricsBuilderService(repo, logger);
    const a = await service.buildForDate("2026-07-01");
    const b = await service.buildForDate("2026-07-01");
    expect(repo.buildForDate).toHaveBeenCalledTimes(2);
    expect(a.built).toBe(1);
    expect(b.built).toBe(1);
    expect(a.failed).toEqual([]);
  });

  it("buildRange continues after a single day failure", async () => {
    const buildForDate = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);
    const repo = mockDailyRepo({ buildForDate });
    const service = new MetricsBuilderService(repo, logger);
    const result = await service.buildRange("2026-07-01", "2026-07-03");
    expect(result.built).toBe(2);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.date).toBe("2026-07-02");
  });

  it("rebuildAll uses earliest date through today", async () => {
    const repo = mockDailyRepo({
      earliestMetricsDate: vi.fn().mockResolvedValue("2026-07-24"),
    });
    const service = new MetricsBuilderService(repo, logger);
    const result = await service.rebuildAll();
    expect(result.mode).toBe("all");
    expect(result.dateFrom).toBe("2026-07-24");
    expect(result.built).toBeGreaterThanOrEqual(1);
  });
});
