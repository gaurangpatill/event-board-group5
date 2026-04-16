
import type { Result } from "../lib/result";
import type { EventError } from "../lib/eventErrors";
import type { IEventRecord, EventStatus, EventCategory } from "../lib/event";

// ── Filter options ──────────────────────────────────────────────────────────
// Used by listEvents (Feature 6) and getOrganizerDashboard (Feature 8).
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

// ── Repository interface ────────────────────────────────────────────────────
export interface IEventRepository {
  /** Create a new event record. Returns the saved record. */
  createEvent(
    event: Omit<IEventRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<Result<IEventRecord, EventError>>;

  /** Return a single event by id, or null if not found. */
  findEventById(id: string): Promise<Result<IEventRecord | null, EventError>>;

  /**
   * Update mutable fields of an existing event.
   * organizerId and createdAt may never be changed through this method.
   */
  updateEvent(
    id: string,
    changes: Partial<Omit<IEventRecord, "id" | "organizerId" | "createdAt">>,
  ): Promise<Result<IEventRecord, EventError>>;

  /**
   * Return events matching the given filters.
   * Only call with already-validated filter values.
   */
  listEvents(
    filters?: EventFilterOptions,
  ): Promise<Result<IEventRecord[], EventError>>;

  /** Return the count of RSVPs with status "going" for an event. */
  countAttendees(eventId: string): Promise<Result<number, EventError>>;
}