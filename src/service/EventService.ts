import type { IAuthenticatedUser } from "../auth/User";
import type { EventCategory, IEventRecord, EventWithCount, OrganizerDashboardData } from "../lib/event";
import {
  EventAuthorizationError,
  EventNotFound,
  EventValidationError,
  InvalidEventState,
} from "../lib/errors";
import { Ok, Err, Result } from "../lib/result";
import type { IEventRepository } from "../repository/EventRepository";

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

export interface IEventService {
  getEvent(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>>;
  createEvent(
    actor: IAuthenticatedUser,
    input: CreateEventInput,
  ): Promise<Result<IEventRecord, EventError>>;

  getEventForEdit(
    actor: IAuthenticatedUser,
    eventId: string,
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

    const createdEvent = repoResult.value;
    return Ok(createdEvent);
  }

  async getEventForEdit(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>> {
    const eventResult = await this.eventRepository.findEventById(eventId);

    if (!eventResult.ok) {
      return eventResult;
    }

    const event = eventResult.value;
    if (!event) {
      return Err(EventNotFound("Event not found."));
    }

    if (!this.canEditEvent(actor, event)) {
      return Err(
        EventAuthorizationError("You are not allowed to edit this event."),
      );
    }

    if (event.status === "cancelled") {
      return Err(InvalidEventState("Cancelled events cannot be edited."));
    }

    if (event.endDateTime <= new Date()) {
      return Err(InvalidEventState("Past events cannot be edited."));
    }

    return Ok(event);
  }

  async updateEvent(
    actor: IAuthenticatedUser,
    eventId: string,
    input: UpdateEventInput,
  ): Promise<Result<IEventRecord, EventError>> {
    const editableEventResult = await this.getEventForEdit(actor, eventId);
    if (!editableEventResult.ok) {
      return editableEventResult;
    }

    const normalizedInput = this.normalizeUpdateInput(input);
    if (!normalizedInput.ok) {
      return normalizedInput;
    }

    const validationResult = this.validateCreateEventInput(normalizedInput.value);
    if (!validationResult.ok) {
      return validationResult;
    }

    const repoResult = await this.eventRepository.updateEvent(eventId, {
      ...validationResult.value,
    });

    if (!repoResult.ok) {
      return repoResult;
    }

    return Ok(repoResult.value);
  }

  async getOrganizerDashboard(actor: IAuthenticatedUser,): Promise<Result<OrganizerDashboardData, EventError>> {
    if (actor.role !== "staff" && actor.role !== "admin") {
      return Err(EventAuthorizationError("Only organizers can access the event dashboard."));
    }

    const filters = actor.role === "admin" ? {} : { organizerId: actor.id };
    const listResult = await this.repo.listEvents(filters);
    if (!listResult.ok) return Err(listResult.value);

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
  private canEditEvent(actor: IAuthenticatedUser, event: IEventRecord): boolean {
    if (actor.role === "admin") {
      return true;
    }
    return actor.role === "staff" && event.organizerId === actor.id;
  }

  private normalizeUpdateInput(
    input: UpdateEventInput,
  ): Result<CreateEventInput, EventError> {
    if (
      input.title === undefined ||
      input.description === undefined ||
      input.location === undefined ||
      input.category === undefined ||
      input.startDateTime === undefined ||
      input.endDateTime === undefined
    ) {
      return Err(EventValidationError("All event fields are required."));
    }

    return Ok({
      title: input.title,
      description: input.description,
      location: input.location,
      category: input.category,
      startDateTime: input.startDateTime,
      endDateTime: input.endDateTime,
      maxCapacity: input.maxCapacity ?? null,
    });
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
