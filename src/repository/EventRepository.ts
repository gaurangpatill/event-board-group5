import type { Result } from "../lib/result";
import type { EventError } from "../lib/errors";
import type { IEventRecord } from "../lib/event";
import {Ok, Err} from "../lib/result";
import { randomUUID } from "node:crypto";
import {
  EventNotFound,
  UnexpectedDependencyError,
} from "../lib/errors";
import { rsvpStorage } from "./rsvpRepository";
 
 
export interface IEventRepository {
  findEventById(id: string): Promise<Result<IEventRecord | null, EventError>>;
  createEvent(
    event: Omit<IEventRecord, "id" | "createdAt" | "updatedAt">
  ): Promise<Result<IEventRecord, EventError>>;

  updateEvent(
    id: string,
    changes: Partial<Omit<IEventRecord, "id" | "organizerId" | "createdAt">>
  ): Promise<Result<IEventRecord, EventError>>;

  listEvents(filters?: { organizerId?: string }): Promise<Result<IEventRecord[], EventError>>;
  countAttendees(eventId: string): Promise<Result<number, EventError>>;
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

  async updateEvent(
    id: string,
    changes: Partial<Omit<IEventRecord, "id" | "organizerId" | "createdAt">>
  ): Promise<Result<IEventRecord, EventError>> {
    try {
      const index = eventStorage.findIndex((e) => e.id === id);

      if (index === -1) {
        return Err(EventNotFound("Event not found."));
      }

      const existing = eventStorage[index];

      const updated: IEventRecord = {
        ...existing,
        ...changes,
        updatedAt: new Date(),
      };

      eventStorage[index] = updated;

      return Ok(updated);
    } catch {
      return Err(UnexpectedDependencyError("Failed to update event."));
    }
  }

  async listEvents(filters?: { organizerId?: string }): Promise<Result<IEventRecord[], EventError>> {
    try {
      let events = [...eventStorage];
      if (filters?.organizerId) {
        events = events.filter((e) => e.organizerId === filters.organizerId);
      }
      return Ok(events);
    } catch {
      return Err(UnexpectedDependencyError("Failed to list events."));
    }
  }

  async countAttendees(eventId: string): Promise<Result<number, EventError>> {
    try {
      const count = rsvpStorage.filter(r => r.eventId === eventId && r.status === "going").length;
      return Ok(count);
    } catch {
      return Err(UnexpectedDependencyError("Failed to count attendees."));
    }
  }
}

export function CreateInMemoryEventRepository(): IEventRepository {
  return new InMemoryEventRepository();
}