import type { Logger } from "@/processors/logger/logger";
import { BaseService } from "@/services/shared/base.service";
import type { IWebhookEventService } from "@/services/interfaces/webhook-event-service.interface";
import type { IVottEventRepository } from "@/services/interfaces/repositories";
import type { VottEvent } from "@/types/vimeo";
import type {
  ResourceStatistics,
  WebhookEventListFilters,
} from "@/types/common";
import type { ApiPageRequest, PaginatedResult } from "@/types/pagination";
import { toPaginateOptions } from "@/types/pagination";

export class WebhookEventService
  extends BaseService
  implements IWebhookEventService
{
  constructor(
    private readonly events: IVottEventRepository,
    logger: Logger,
  ) {
    super("WebhookEventService", logger);
  }

  async getById(id: string): Promise<VottEvent> {
    return this.timed("getById", async () => {
      try {
        const row = await this.events.findById(id);
        return this.requireFound(row, "webhook_event", id);
      } catch (error) {
        this.mapRepositoryError(error, "getById");
      }
    });
  }

  async list(
    filters: WebhookEventListFilters = {},
    page: ApiPageRequest = {},
  ): Promise<PaginatedResult<VottEvent>> {
    return this.timed("list", async () => {
      try {
        const needsList =
          Boolean(filters.email) ||
          Boolean(filters.from) ||
          Boolean(filters.to) ||
          Boolean(filters.topic) ||
          typeof filters.customerId === "number" ||
          typeof filters.productId === "number";

        if (needsList) {
          let candidates: VottEvent[];

          if (typeof filters.productId === "number" && !filters.email) {
            candidates = await this.events.findProductEvents(
              filters.productId,
              200,
            );
          } else if (
            typeof filters.customerId === "number" &&
            !filters.email &&
            !filters.from &&
            !filters.to &&
            !filters.topic
          ) {
            candidates = await this.events.findCustomerEvents(
              filters.customerId,
              200,
            );
          } else {
            candidates = await this.events.list({
              topic: filters.topic,
              customerId: filters.customerId,
              customerEmail: filters.email,
              from: filters.from,
              to: filters.to,
              limit: 200,
              offset: 0,
            });
          }

          let filtered = candidates;
          if (typeof filters.productId === "number") {
            filtered = filtered.filter(
              (e) => e.product_id === filters.productId,
            );
          }
          return this.paginateCandidates(filtered, page);
        }

        return await this.events.paginate({
          ...toPaginateOptions(page, "received_at"),
          sortDirection: page.direction ?? "desc",
        });
      } catch (error) {
        this.mapRepositoryError(error, "list");
      }
    });
  }

  async getStatistics(): Promise<ResourceStatistics> {
    return this.timed("getStatistics", async () => {
      try {
        const total = await this.events.count();
        return {
          total,
          note: "Topic breakdown deferred to analytics phase",
        };
      } catch (error) {
        this.mapRepositoryError(error, "getStatistics");
      }
    });
  }
}
