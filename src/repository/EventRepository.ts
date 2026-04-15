import type { Result } from "../lib/result";
import type { EventError } from "../lib/errors";
import type { IEventRecord } from "../lib/event";
import {Ok, Err} from "../lib/result";
import { randomUUID } from "node:crypto";
import {
  EventNotFound,
  UnexpectedDependencyError,
} from "../lib/errors";
 
 
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

export const eventStorage: IEventRecord[] = [];

class InMemoryEventRepository implements IEventRepository {

  async findEventById(
    id: string,
  ): ReturnType<IEventRepository["findEventById"]> {
    try {
      const match = eventStorage.find((e) => e.id === id) ?? null;
      return Ok(match);
    } catch {
      return Err(UnexpectedDependencyError("Failed to read events."));
    }
  }

  async createEvent(
    event: Omit<IEventRecord, "id" | "createdAt" | "updatedAt">
  ): Promise<Result<IEventRecord, EventError>> {
    try {
      const now = new Date();
      const newEvent: IEventRecord = {
        ...event,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      };

      eventStorage.push(newEvent);

      return Ok(newEvent);
    } catch {
      return Err(UnexpectedDependencyError("Failed to create event."));
    }
  }
}

export function CreateInMemoryEventRepository(): IEventRepository {
  return new InMemoryEventRepository();
}