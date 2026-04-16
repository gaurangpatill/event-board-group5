import { Ok, Err } from "../lib/result";
import type { Result } from "../lib/result";
import type { EventError } from "../lib/eventErrors";
import { UnexpectedDependencyError } from "../lib/eventErrors";
import type { IEventRecord } from "../lib/event";
import type { IEventRepository, EventFilterOptions } from "./IeventRepository";

function clone(record: IEventRecord): IEventRecord {
  return { ...record };
}

function isThisWeek(date: Date, now: Date): boolean {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date >= start && date < end;
}

function isThisWeekend(date: Date, now: Date): boolean {
  if (!isThisWeek(date, now)) return false;
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6;
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
    try {
      const existing = this.store.get(id);
      if (!existing) {
        return Err(
          UnexpectedDependencyError(`updateEvent: record ${id} not found`),
        );
      }
      const updated: IEventRecord = {
        ...existing,
        ...changes,
        updatedAt: new Date(),
      };
      this.store.set(id, updated);
      return Ok(clone(updated));
    } catch (e) {
      return Err(
        UnexpectedDependencyError(
          `updateEvent failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    }
  }

  async listEvents(
    filters?: EventFilterOptions,
  ): Promise<Result<IEventRecord[], EventError>> {
    try {
      const now = new Date();
      let results = Array.from(this.store.values());

      if (filters) {
        const { category, timeframe, searchQuery, organizerId, status } = filters;

        if (category) {
          results = results.filter((e) => e.category === category);
        }

        if (timeframe && timeframe !== "all") {
          if (timeframe === "this_week") {
            results = results.filter((e) => isThisWeek(e.startDateTime, now));
          } else if (timeframe === "this_weekend") {
            results = results.filter((e) => isThisWeekend(e.startDateTime, now));
          }
        }

        if (searchQuery && searchQuery.trim() !== "") {
          const q = searchQuery.trim().toLowerCase();
          results = results.filter(
            (e) =>
              e.title.toLowerCase().includes(q) ||
              e.description.toLowerCase().includes(q) ||
              e.location.toLowerCase().includes(q),
          );
        }

        if (organizerId) {
          results = results.filter((e) => e.organizerId === organizerId);
        }

        if (status) {
          results = results.filter((e) => e.status === status);
        }
      }

      results.sort(
        (a, b) => a.startDateTime.getTime() - b.startDateTime.getTime(),
      );

      return Ok(results.map(clone));
    } catch (e) {
      return Err(
        UnexpectedDependencyError(
          `listEvents failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    }
  }

  // countAttendees returns 0 as a safe placeholder. The real count lives in
  // the RSVP store which this repo cannot access directly. Wire up a real
  // cross-store count when Prisma is introduced.
  async countAttendees(
    _eventId: string,
  ): Promise<Result<number, EventError>> {
    return Ok(0);
  }
}

export function CreateInMemoryEventRepository(): IEventRepository {
  return new InMemoryEventRepository();
}