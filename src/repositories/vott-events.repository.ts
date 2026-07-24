/**
 * Compatibility shim for Phase 1 webhook ingest and early list helpers.
 * Prefer `VottEventRepository` for new code.
 */
import { VottEventRepository } from "@/repositories/vott-event.repository";
import type { VottEvent, VottEventFilters, VottEventInsert } from "@/types/vimeo";

const repo = new VottEventRepository();

export async function insertEvent(
  event: VottEventInsert,
): Promise<VottEvent> {
  return repo.insert(event);
}

export async function listEvents(
  filters: VottEventFilters = {},
): Promise<VottEvent[]> {
  return repo.list(filters);
}

export async function getEventById(id: string): Promise<VottEvent | null> {
  return repo.findById(id);
}
