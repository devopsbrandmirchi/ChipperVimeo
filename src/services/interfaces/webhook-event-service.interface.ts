import type { VottEvent } from "@/types/vimeo";
import type {
  ResourceStatistics,
  WebhookEventListFilters,
} from "@/types/common";
import type { ApiPageRequest, PaginatedResult } from "@/types/pagination";

export interface IWebhookEventService {
  getById(id: string): Promise<VottEvent>;
  list(
    filters?: WebhookEventListFilters,
    page?: ApiPageRequest,
  ): Promise<PaginatedResult<VottEvent>>;
  getStatistics(): Promise<ResourceStatistics>;
}
