import type { Logger } from "@/processors/logger/logger";
import { asJson } from "@/processors/helpers/payload";
import { BaseService } from "@/services/shared/base.service";
import { DuplicateEntityError } from "@/services/shared/errors";
import type {
  ITimelineService,
  TimelineRecordInput,
} from "@/services/interfaces/timeline-service.interface";
import type { ISubscriptionEventRepository } from "@/services/interfaces/repositories";
import type { SubscriptionEvent } from "@/types/database";

export class TimelineService extends BaseService implements ITimelineService {
  constructor(
    private readonly events: ISubscriptionEventRepository,
    logger: Logger,
  ) {
    super("TimelineService", logger);
  }

  async findByVottEventId(
    vottEventId: string,
  ): Promise<SubscriptionEvent | null> {
    return this.events.findByVottEventId(vottEventId);
  }

  async recordCreated(input: TimelineRecordInput) {
    return this.record("created", input);
  }

  async recordUpdated(input: TimelineRecordInput) {
    return this.record("updated", input);
  }

  async recordRenewal(input: TimelineRecordInput) {
    return this.record("renewed", input);
  }

  async recordPaused(input: TimelineRecordInput) {
    return this.record("paused", input);
  }

  async recordResumed(input: TimelineRecordInput) {
    return this.record("resumed", input);
  }

  async recordCancelled(input: TimelineRecordInput) {
    return this.record("cancelled", input);
  }

  async recordExpired(input: TimelineRecordInput) {
    return this.record("expired", input);
  }

  async recordChargeFailed(input: TimelineRecordInput) {
    return this.record("charge_failed", input);
  }

  async recordTrialStarted(input: TimelineRecordInput) {
    return this.record("trial_started", input);
  }

  async recordTrialConverted(input: TimelineRecordInput) {
    return this.record("trial_converted", input);
  }

  async recordRecovered(input: TimelineRecordInput) {
    return this.record("recovered", input);
  }

  private async record(
    eventType: string,
    input: TimelineRecordInput,
  ): Promise<SubscriptionEvent | null> {
    return this.timed(`record:${eventType}`, async () => {
      try {
        return await this.events.create({
          customer_id: input.customerId,
          subscription_id: input.subscriptionId,
          vott_event_id: input.vottEventId,
          event_type: eventType,
          previous_status: input.previousStatus,
          new_status: input.newStatus,
          event_created_at: input.eventCreatedAt,
          payload: asJson(input.payload ?? null),
        });
      } catch (error) {
        if (error instanceof DuplicateEntityError) {
          return null;
        }
        try {
          this.mapRepositoryError(error, `record:${eventType}`);
        } catch (mapped) {
          if (mapped instanceof DuplicateEntityError) {
            return null;
          }
          throw mapped;
        }
      }
    });
  }
}
