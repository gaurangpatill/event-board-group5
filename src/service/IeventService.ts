
import type { Result } from "../lib/result";
import type { EventError } from "../lib/eventErrors";
import type { IEventRecord, EventCategory } from "../lib/event";
import type { IAuthenticatedUser } from "../auth/User";

// ── Input shapes ─────────────────────────────────────────────────────────────

export interface CreateEventInput {
  title: string;
  description: string;
  location: string;
  category: EventCategory;
  startDateTime: Date;
  endDateTime: Date;
  maxCapacity?: number | null;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  location?: string;
  category?: EventCategory;
  startDateTime?: Date;
  endDateTime?: Date;
  maxCapacity?: number | null;
}

// ── Dashboard return shapes ───────────────────────────────────────────────────

export interface EventWithCount extends IEventRecord {
  attendeeCount: number;
}

export interface OrganizerDashboardData {
  published: EventWithCount[];
  draft: EventWithCount[];
  cancelledOrPast: EventWithCount[];
}

// ── Interface ────────────────────────────────────────────────────────────────

export interface IEventService {
  /** Feature 1. Validates input, sets organizerId from actor. Returns the draft event. */
  createEvent(
    actor: IAuthenticatedUser,
    input: CreateEventInput,
  ): Promise<Result<IEventRecord, EventError>>;

  /**
   * Feature 2. Returns the event if the actor is allowed to see it.
   * Draft events are only visible to their organizer and admins.
   */
  getEvent(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>>;

  /**
   * Feature 3. Validates permissions and state before applying changes.
   * Organizers may only edit their own non-cancelled, non-past events.
   * Admins may edit any non-cancelled, non-past event.
   */
  updateEvent(
    actor: IAuthenticatedUser,
    eventId: string,
    input: UpdateEventInput,
  ): Promise<Result<IEventRecord, EventError>>;

  /**
   * Feature 5. Transitions draft → published.
   * Only the owning organizer or an admin may publish.
   */
  publishEvent(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>>;

  /**
   * Feature 5. Transitions published → cancelled. Cannot be undone.
   * Only the owning organizer or an admin may cancel.
   */
  cancelEvent(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>>;

  /**
   * Feature 6. Returns published events matching optional filters.
   * Invalid filter values return EventValidationError.
   */
  listEvents(
    actor: IAuthenticatedUser,
    filters?: { category?: string; timeframe?: string },
  ): Promise<Result<IEventRecord[], EventError>>;

  /**
   * Feature 8. Returns events created by actor (or all events for admins),
   * grouped by status, with attendee counts attached.
   */
  getOrganizerDashboard(
    actor: IAuthenticatedUser,
  ): Promise<Result<OrganizerDashboardData, EventError>>;

  /**
   * Feature 10. Returns published upcoming events whose title, description,
   * or location contains the query (case-insensitive). Empty query returns all.
   */
  searchEvents(
    actor: IAuthenticatedUser,
    query: string,
  ): Promise<Result<IEventRecord[], EventError>>;
}