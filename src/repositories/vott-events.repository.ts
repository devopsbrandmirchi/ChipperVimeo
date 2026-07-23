import { createServiceClient } from "@/lib/supabase/server";
import type { VottEvent, VottEventFilters, VottEventInsert } from "@/types/vimeo";

const TABLE = "vott_events";

export async function insertEvent(
  event: VottEventInsert,
): Promise<VottEvent> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from(TABLE)
    .insert(event)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert vott_events row: ${error.message}`);
  }

  return data as VottEvent;
}

/**
 * Phase 2: list/filter webhook events for admin UI + API.
 * Implemented now so admin pages can wire up without reshaping the repo layer.
 */
export async function listEvents(
  filters: VottEventFilters = {},
): Promise<VottEvent[]> {
  const supabase = createServiceClient();
  const limit = Math.min(filters.limit ?? 50, 200);
  const offset = filters.offset ?? 0;

  let query = supabase
    .from(TABLE)
    .select("*")
    .order("received_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.topic) {
    query = query.eq("topic", filters.topic);
  }
  if (typeof filters.customerId === "number") {
    query = query.eq("customer_id", filters.customerId);
  }
  if (filters.customerEmail) {
    query = query.ilike("customer_email", filters.customerEmail);
  }
  if (filters.from) {
    query = query.gte("received_at", filters.from);
  }
  if (filters.to) {
    query = query.lte("received_at", filters.to);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list vott_events: ${error.message}`);
  }

  return (data ?? []) as VottEvent[];
}

export async function getEventById(id: string): Promise<VottEvent | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get vott_events row: ${error.message}`);
  }

  return (data as VottEvent | null) ?? null;
}
