import { Ok, Err } from "../lib/result";
import type { Result } from "../lib/result";
import type { EventError } from "../lib/eventErrors";
import { UnexpectedDependencyError } from "../lib/eventErrors";
import type { IEventRecord } from "../lib/event";
import type { IEventRepository, EventFilterOptions } from "./IeventRepository";

class InMemoryEventRepository implements IEventRepository {
  private readonly store = new Map<string, IEventRecord>();

  async createEvent(
    event: Omit<IEventRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<Result<IEventRecord, EventError>> {
    throw new Error("Not implemented yet");
  }

  async findEventById(
    id: string,
  ): Promise<Result<IEventRecord | null, EventError>> {
    throw new Error("Not implemented yet");
  }

  async updateEvent(
    id: string,
    changes: Partial<Omit<IEventRecord, "id" | "organizerId" | "createdAt">>,
  ): Promise<Result<IEventRecord, EventError>> {
    throw new Error("Not implemented yet");
  }

  async listEvents(
    filters?: EventFilterOptions,
  ): Promise<Result<IEventRecord[], EventError>> {
    throw new Error("Not implemented yet");
  }

  async countAttendees(
    eventId: string,
  ): Promise<Result<number, EventError>> {
    throw new Error("Not implemented yet");
  }
}

export function CreateInMemoryEventRepository(): IEventRepository {
  return new InMemoryEventRepository();
}