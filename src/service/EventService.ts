import type { IAuthenticatedUser } from "../auth/User";
import type { EventCategory, IEventRecord, EventWithCount, OrganizerDashboardData } from "../lib/event";
import {
  EventAuthorizationError,
  EventNotFound,
import { Ok, Err } from "../lib/result";
import type { Result } from "../lib/result";
import { 
  EventAuthorizationError, 
  EventNotFound, 
  EventValidationError,
  InvalidEventState,
  type EventError 
} from "../lib/errors";
import type { IEventRepository } from "../repository/InMemoryEventRepository";

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

export interface OrganizerDashboardData {
  // Define as needed
}

export interface IEventService {
  getEvent(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>>;
  createEvent(
    actor: IAuthenticatedUser,
    input: CreateEventInput,
  ): Promise<Result<IEventRecord, EventError>>;
  listEvents(
    actor: IAuthenticatedUser,
    filters?: { category?: string; timeframe?: string },
  ): Promise<Result<IEventRecord[], EventError>>;
  updateEvent(
    actor: IAuthenticatedUser,
    eventId: string,
    input: UpdateEventInput,
  ): Promise<Result<IEventRecord, EventError>>;
  publishEvent(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>>;
  cancelEvent(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>>;
  getOrganizerDashboard(
    actor: IAuthenticatedUser,
  ): Promise<Result<OrganizerDashboardData, EventError>>;
  searchEvents(
    actor: IAuthenticatedUser,
    query: string,
  ): Promise<Result<IEventRecord[], EventError>>;
}

const VALID_CATEGORIES: EventCategory[] = [
  "academic",
  "social",
  "sports",
  "workshop",
  "other",
];

const VALID_TIMEFRAMES = ["all", "this_week", "this_weekend"] as const;
type ValidTimeframe = (typeof VALID_TIMEFRAMES)[number];

function isValidCategory(v: string): v is EventCategory {
  return (VALID_CATEGORIES as string[]).includes(v);
}

function isValidTimeframe(v: string): v is ValidTimeframe {
  return (VALID_TIMEFRAMES as readonly string[]).includes(v);
}

class EventService implements IEventService {
  constructor(private readonly repo: IEventRepository) {}

  async getEvent(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>> {
    const result = await this.repo.findEventById(eventId);
    if (!result.ok) return result;

    const event = result.value;
    if (event === null) return Err(EventNotFound("Event not found."));

    if (event.status === "draft") {
      const isOrganizer = actor.id === event.organizerId;
      const isAdmin = actor.role === "admin";
      if (!isOrganizer && !isAdmin) {
        return Err(EventNotFound("Event not found."));
      }
    }

    return Ok(event);
  }

  async createEvent(
    actor: IAuthenticatedUser,
    input: CreateEventInput,
  ): Promise<Result<IEventRecord, EventError>> {
    if (actor.role !== "staff") {
      return Err(
        EventAuthorizationError("Only organizers can create events."),
      );
    }

    const validationResult = this.validateCreateEventInput(input);
    if (!validationResult.ok) {
      return validationResult;
    }

    const repoResult = await this.repo.createEvent({
      ...validationResult.value,
      status: "draft",
      organizerId: actor.id,
    });

    if (!repoResult.ok) {
      return repoResult;
    }

    return Ok(repoResult.value);
  }

  async listEvents(
    _actor: IAuthenticatedUser,
    filters?: { category?: string; timeframe?: string },
  ): Promise<Result<IEventRecord[], EventError>> {
    let category: EventCategory | undefined;
    if (filters?.category && filters.category !== "") {
      if (!isValidCategory(filters.category)) {
        return Err(
          EventValidationError(
            `Invalid category "${filters.category}". Allowed values: ${VALID_CATEGORIES.join(", ")}.`,
          ),
        );
      }
      category = filters.category;
    }

    let timeframe: ValidTimeframe | undefined;
    if (filters?.timeframe && filters.timeframe !== "") {
      if (!isValidTimeframe(filters.timeframe)) {
        return Err(
          EventValidationError(
            `Invalid timeframe "${filters.timeframe}". Allowed values: ${VALID_TIMEFRAMES.join(", ")}.`,
          ),
        );
      }
      timeframe = filters.timeframe;
    }

    return this.repo.listEvents({
      category,
      timeframe,
      status: "published",
    });
  }

  async updateEvent(
    _actor: IAuthenticatedUser,
    _eventId: string,
    _input: UpdateEventInput,
  ): Promise<Result<IEventRecord, EventError>> {
    throw new Error("Not implemented yet");
  }

  async publishEvent(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>> {
    const result = await this.repo.findEventById(eventId);
    if (!result.ok) return result;

    const event = result.value;
    if (event === null) return Err(EventNotFound("Event not found."));

    const isOrganizer = actor.id === event.organizerId;
    const isAdmin = actor.role === "admin";
    if (!isOrganizer && !isAdmin) {
      return Err(
        EventAuthorizationError(
          "You do not have permission to publish this event.",
        ),
      );
    }

    if (event.status !== "draft") {
      return Err(
        InvalidEventState(
          `Cannot publish an event with status "${event.status}".`,
        ),
      );
    }

    return this.repo.updateEvent(eventId, { status: "published" });
  }

  async cancelEvent(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>> {
    const result = await this.repo.findEventById(eventId);
    if (!result.ok) return result;

    const event = result.value;
    if (event === null) return Err(EventNotFound("Event not found."));

    const isOrganizer = actor.id === event.organizerId;
    const isAdmin = actor.role === "admin";
    if (!isOrganizer && !isAdmin) {
      return Err(
        EventAuthorizationError(
          "You do not have permission to cancel this event.",
        ),
      );
    }

    if (event.status !== "published") {
      return Err(
        InvalidEventState(
          `Cannot cancel an event with status "${event.status}".`,
        ),
      );
    }

    return this.repo.updateEvent(eventId, { status: "cancelled" });
  }

  async getOrganizerDashboard(
    _actor: IAuthenticatedUser,
  ): Promise<Result<OrganizerDashboardData, EventError>> {
    if (actor.role !== "staff" && actor.role !== "admin") {
      return Err(EventAuthorizationError("Only organizers can access the event dashboard."));
    }

    const filters = actor.role === "admin" ? {} : { organizerId: actor.id };
    const listResult = await this.repo.listEvents(filters);
    if (!listResult.ok) return listResult;

    const withCounts: EventWithCount[] = [];
    for (const event of listResult.value) {
      const countResult = await this.repo.countAttendees(event.id);
      if (!countResult.ok) return Err(countResult.value);
      withCounts.push({ ...event, attendeeCount: countResult.value });
    }

    return Ok({
      published:       withCounts.filter(e => e.status === "published"),
      draft:           withCounts.filter(e => e.status === "draft"),
      cancelledOrPast: withCounts.filter(e => e.status === "cancelled" || e.status === "past"),
    });
  }

  async searchEvents(
    _actor: IAuthenticatedUser,
    _query: string,
  ): Promise<Result<IEventRecord[], EventError>> {
    throw new Error("Not implemented yet");
  }

  private validateCreateEventInput(
    input: CreateEventInput,
  ): Result<
    Omit<IEventRecord, "id" | "status" | "organizerId" | "createdAt" | "updatedAt">,
    EventError
  > {
    const title = input.title.trim();
    if (title.length < 1 || title.length > 100) {
      return Err(
        EventValidationError("Title must be between 1 and 100 characters."),
      );
    }

    const description = input.description.trim();
    if (description.length < 1 || description.length > 2000) {
      return Err(
        EventValidationError(
          "Description must be between 1 and 2000 characters.",
        ),
      );
    }

    const location = input.location.trim();
    if (location.length < 1 || location.length > 200) {
      return Err(
        EventValidationError("Location must be between 1 and 200 characters."),
      );
    }

    if (!isValidCategory(input.category)) {
      return Err(EventValidationError("Invalid event category."));
    }

    if (
      Number.isNaN(input.startDateTime.getTime()) ||
      Number.isNaN(input.endDateTime.getTime())
    ) {
      return Err(EventValidationError("Invalid event date/time."));
    }

    if (input.endDateTime <= input.startDateTime) {
      return Err(EventValidationError("End time must be after start time."));
    }

    const maxCapacity = input.maxCapacity ?? null;
    if (
      maxCapacity !== null &&
      (!Number.isInteger(maxCapacity) || maxCapacity <= 0)
    ) {
      return Err(
        EventValidationError(
          "Max capacity must be a positive integer when provided.",
        ),
      );
    }

    return Ok({
      title,
      description,
      location,
      category: input.category,
      startDateTime: input.startDateTime,
      endDateTime: input.endDateTime,
      maxCapacity,
    });
  }
}

export function CreateEventService(repo: IEventRepository): IEventService {
  return new EventService(repo);
}
