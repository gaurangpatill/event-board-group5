import { Ok, Err } from "../lib/result";
import type { Result } from "../lib/result";
import type { EventError } from "../lib/eventErrors";
import { UnexpectedDependencyError } from "../lib/eventErrors";
import type { IEventRecord } from "../lib/event";
import type { IEventRepository, EventFilterOptions } from "./IeventRepository";

function clone(record: IEventRecord): IEventRecord {
  return { ...record };
}

class InMemoryEventRepository implements IEventRepository {
  private readonly store = new Map<string, IEventRecord>();

  async createEvent(
    event: Omit<IEventRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<Result<IEventRecord, EventError>> {
    try {
      const now = new Date();
      const record: IEventRecord = {
        ...event,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      this.store.set(record.id, record);
      return Ok(clone(record));
    } catch (e) {
      return Err(
        UnexpectedDependencyError(
          `createEvent failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    }
  }

  async findEventById(
    id: string,
  ): Promise<Result<IEventRecord | null, EventError>> {
    try {
      const record = this.store.get(id) ?? null;
      return Ok(record ? clone(record) : null);
    } catch (e) {
      return Err(
        UnexpectedDependencyError(
          `findEventById failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    }
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