import { Prisma, PrismaClient } from "@prisma/client";
import { Err, Ok, type Result } from "../lib/result";
import {
  EventNotFound,
  UnexpectedDependencyError,
  type EventError,
} from "../lib/errors";
import type { EventCategory, EventStatus, IEventRecord } from "../lib/event";
import type { EventFilterOptions, IEventRepository } from "./EventRepository";

function toEventRecord(record: {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  startDateTime: Date;
  endDateTime: Date;
  maxCapacity: number | null;
  status: string;
  organizerId: string;
  createdAt: Date;
  updatedAt: Date;
}): IEventRecord {
  return {
    ...record,
    category: record.category as EventCategory,
    status: record.status as EventStatus,
  };
}

function getThisWeekRange(now: Date): { start: Date; end: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return { start, end };
}

function isThisWeekend(date: Date, now: Date): boolean {
  const { start, end } = getThisWeekRange(now);
  const day = date.getDay();
  return date >= start && date < end && (day === 0 || day === 6);
}

class PrismaEventRepository implements IEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findEventById(
    id: string,
  ): Promise<Result<IEventRecord | null, EventError>> {
    try {
      const record = await this.prisma.event.findUnique({ where: { id } });
      return Ok(record ? toEventRecord(record) : null);
    } catch (error) {
      return Err(
        UnexpectedDependencyError(
          `findEventById failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  async createEvent(
    event: Omit<IEventRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<Result<IEventRecord, EventError>> {
    try {
      const record = await this.prisma.event.create({
        data: {
          title: event.title,
          description: event.description,
          location: event.location,
          category: event.category,
          startDateTime: event.startDateTime,
          endDateTime: event.endDateTime,
          maxCapacity: event.maxCapacity,
          status: event.status,
          organizerId: event.organizerId,
        },
      });

      return Ok(toEventRecord(record));
    } catch (error) {
      return Err(
        UnexpectedDependencyError(
          `createEvent failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  async updateEvent(
    id: string,
    changes: Partial<Omit<IEventRecord, "id" | "organizerId" | "createdAt">>,
  ): Promise<Result<IEventRecord, EventError>> {
    try {
      const existing = await this.prisma.event.findUnique({ where: { id } });
      if (!existing) {
        return Err(EventNotFound(`updateEvent: record ${id} not found`));
      }

      const record = await this.prisma.event.update({
        where: { id },
        data: changes,
      });

      return Ok(toEventRecord(record));
    } catch (error) {
      return Err(
        UnexpectedDependencyError(
          `updateEvent failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  async listEvents(
    filters?: EventFilterOptions,
  ): Promise<Result<IEventRecord[], EventError>> {
    try {
      const now = new Date();
      const where: Prisma.EventWhereInput = {};

      if (filters?.category) {
        where.category = filters.category;
      }

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.organizerId) {
        where.organizerId = filters.organizerId;
      }

      if (filters?.searchQuery && filters.searchQuery.trim() !== "") {
        const query = filters.searchQuery.trim();
        where.OR = [
          { title: { contains: query }, mode: "insensitive" },
          { description: { contains: query }, mode: "insensitive" },
          { location: { contains: query }, mode: "insensitive" },
        ];
      }

      if (
        filters?.timeframe === "this_week" ||
        filters?.timeframe === "this_weekend"
      ) {
        const { start, end } = getThisWeekRange(now);
        where.startDateTime = {
          gte: start,
          lt: end,
        };
      }

      let records = await this.prisma.event.findMany({
        where,
        orderBy: { startDateTime: "asc" },
      });

      if (filters?.timeframe === "this_weekend") {
        records = records.filter((event) =>
          isThisWeekend(event.startDateTime, now),
        );
      }

      return Ok(records.map(toEventRecord));
    } catch (error) {
      return Err(
        UnexpectedDependencyError(
          `listEvents failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  async countAttendees(eventId: string): Promise<Result<number, EventError>> {
    try {
      const count = await this.prisma.rsvp.count({
        where: {
          eventId,
          status: "going",
        },
      });

      return Ok(count);
    } catch (error) {
      return Err(
        UnexpectedDependencyError(
          `countAttendees failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }
}

export function CreatePrismaEventRepository(
  prisma: PrismaClient,
): IEventRepository {
  return new PrismaEventRepository(prisma);
}
