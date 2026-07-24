import type { SubscriptionEvent } from "@/types/database";

export type TimelineRecordInput = {
  customerId: string;
  subscriptionId: string;
  vottEventId: string;
  previousStatus: string | null;
  newStatus: string | null;
  eventCreatedAt: string | null;
  payload?: unknown;
};

export interface ITimelineService {
  findByVottEventId(vottEventId: string): Promise<SubscriptionEvent | null>;
  recordCreated(input: TimelineRecordInput): Promise<SubscriptionEvent | null>;
  recordUpdated(input: TimelineRecordInput): Promise<SubscriptionEvent | null>;
  recordRenewal(input: TimelineRecordInput): Promise<SubscriptionEvent | null>;
  recordPaused(input: TimelineRecordInput): Promise<SubscriptionEvent | null>;
  recordResumed(input: TimelineRecordInput): Promise<SubscriptionEvent | null>;
  recordCancelled(input: TimelineRecordInput): Promise<SubscriptionEvent | null>;
  recordExpired(input: TimelineRecordInput): Promise<SubscriptionEvent | null>;
  recordChargeFailed(input: TimelineRecordInput): Promise<SubscriptionEvent | null>;
  recordTrialStarted(input: TimelineRecordInput): Promise<SubscriptionEvent | null>;
  recordTrialConverted(input: TimelineRecordInput): Promise<SubscriptionEvent | null>;
  recordRecovered(input: TimelineRecordInput): Promise<SubscriptionEvent | null>;
}
