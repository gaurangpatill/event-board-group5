import type { Result } from "../lib/result";
import type { EventError } from "../lib/errors";
import type { EventStatus, IEventRecord, EventCategory } from "../lib/event";
import {Ok, Err} from "../lib/result";
import { randomUUID } from "node:crypto";
import {
  EventNotFound,
  UnexpectedDependencyError,
} from "../lib/errors";

 export interface EventFilterOptions {
   category?: EventCategory;
   // "all" returns every published event regardless of date.
   // "this_week" returns events whose startDateTime falls within the next 7 days.
   // "this_weekend" returns events whose startDateTime falls on the coming
   //   Saturday or Sunday (treating "coming" as within the next 7 days).
   timeframe?: "all" | "this_week" | "this_weekend";
   searchQuery?: string;   // used by Feature 10 (Event Search)
   organizerId?: string;   // used by Feature 8 (Organizer Dashboard)
   status?: EventStatus;   // used by Feature 8 (Organizer Dashboard)
 }
 
export interface IEventRepository {
  findEventById(id: string): Promise<Result<IEventRecord | null, EventError>>;
  createEvent(
    event: Omit<IEventRecord, "id" | "createdAt" | "updatedAt">
  ): Promise<Result<IEventRecord, EventError>>;

  updateEvent(
    id: string,
    changes: Partial<Omit<IEventRecord, "id" | "organizerId" | "createdAt">>
  ): Promise<Result<IEventRecord, EventError>>;

  listEvents(
    filters?: EventFilterOptions,
  ): Promise<Result<IEventRecord[], EventError>>;

  countAttendees(eventId: string): Promise<Result<number, EventError>>;
}

export const eventStorage: IEventRecord[] = [];