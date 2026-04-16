import type { IEventRecord } from "../lib/event";
import type { Result } from "../lib/result";
import type { EventError } from "../lib/errors";

export interface IEventRepository {
  findEventById(id: string): Promise<Result<IEventRecord | null, EventError>>;
  createEvent(
    event: Omit<IEventRecord, "id" | "createdAt" | "updatedAt">
  ): Promise<Result<IEventRecord, EventError>>;

  updateEvent(
    id: string,
    changes: Partial<Omit<IEventRecord, "id" | "organizerId" | "createdAt">>
  ): Promise<Result<IEventRecord, EventError>>;

  listEvents(): Promise<Result<IEventRecord[], EventError>>;
}