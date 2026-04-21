import type { IAuthenticatedUser } from "../auth/User";
import type {
  EventCategory,
  EventWithCount,
  IEventRecord,
  OrganizerDashboardData,
} from "../lib/event";
import {
  EventAuthorizationError,
  EventNotFound,
  EventValidationError,
  InvalidEventState,
  UnexpectedDependencyError,
  type EventError,
} from "../lib/errors";
import { Err, Ok, type Result } from "../lib/result";
import type { IEventRepository } from "../repository/EventRepository";
import { IRSVPRepository } from "../repository/IRSVPRepository";

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
    filters?: { category?: string; timeframe?: string; searchQuery?: string },
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

function isValidCategory(value: string): value is EventCategory {
  return (VALID_CATEGORIES as string[]).includes(value);
}

function isValidTimeframe(value: string): value is ValidTimeframe {
  return (VALID_TIMEFRAMES as readonly string[]).includes(value);
}

class EventService implements IEventService {
  constructor(
    private readonly repo: IEventRepository, 
    private readonly rsvpRepo: IRSVPRepository,
  ) {}

  async getEvent(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>> {
    const result = await this.repo.findEventById(eventId);
    if (result.ok === false) {
      return result;
    }

    const event = result.value;
    if (event === null) {
      return Err(EventNotFound("Event not found."));
    }

    if (event.status === "draft" && !this.canManageEvent(actor, event)) {
      return Err(EventNotFound("Event not found."));
    }

    return Ok(this.materializePastStatus(event));
  }

  async createEvent(
    actor: IAuthenticatedUser,
    input: CreateEventInput,
  ): Promise<Result<IEventRecord, EventError>> {
    if (actor.role !== "staff" && actor.role !== "admin") {
      return Err(
        EventAuthorizationError("Only organizers can create events."),
      );
    }

    const validationResult = this.validateEventInput(input);
    if (validationResult.ok === false) {
      return validationResult;
    }

    return this.repo.createEvent({
      ...validationResult.value,
      status: "draft",
      organizerId: actor.id,
    });
  }

  async getEventForEdit(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>> {
    const eventResult = await this.repo.findEventById(eventId);
    if (eventResult.ok === false) {
      return eventResult;
    }

    const event = eventResult.value;
    if (event === null) {
      return Err(EventNotFound("Event not found."));
    }

    if (!this.canManageEvent(actor, event)) {
      return Err(
        EventAuthorizationError("You are not allowed to edit this event."),
      );
    }

    if (event.status === "cancelled") {
      return Err(InvalidEventState("Cancelled events cannot be edited."));
    }

    if (this.isPast(event)) {
      return Err(InvalidEventState("Past events cannot be edited."));
    }

    return Ok(event);
  }

  async listEvents(
    _actor: IAuthenticatedUser,
    filters?: { category?: string; timeframe?: string, searchQuery?: string },
  ): Promise<Result<IEventRecord[], EventError>> {
    let category: EventCategory | undefined;
    if (filters?.category && filters.category !== "") {
      if (!isValidCategory(filters.category)) {
        return Err(
          EventValidationError(`Invalid category "${filters.category}".`),
        );
      }
      category = filters.category;
    }

    let timeframe: ValidTimeframe | undefined;
    if (filters?.timeframe && filters.timeframe !== "") {
      if (!isValidTimeframe(filters.timeframe)) {
        return Err(
          EventValidationError(`Invalid timeframe "${filters.timeframe}".`),
        );
      }
      timeframe = filters.timeframe;
    }

    const result = await this.repo.listEvents({
      category,
      timeframe,
      searchQuery: filters?.searchQuery?.trim(),
      status: "published",
    });
    if (result.ok === false) {
      return result;
    }

    return Ok(result.value.map((event) => this.materializePastStatus(event)));
  }

  async updateEvent(
    actor: IAuthenticatedUser,
    eventId: string,
    input: UpdateEventInput,
  ): Promise<Result<IEventRecord, EventError>> {
    const editableEventResult = await this.getEventForEdit(actor, eventId);
    if (editableEventResult.ok === false) {
      return editableEventResult;
    }

    const normalizedInput = this.normalizeUpdateInput(input);
    if (normalizedInput.ok === false) {
      return normalizedInput;
    }

    const validationResult = this.validateEventInput(normalizedInput.value);
    if (validationResult.ok === false) {
      return validationResult;
    }

    return this.repo.updateEvent(eventId, validationResult.value);
  }

  async publishEvent(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>> {
    const eventResult = await this.repo.findEventById(eventId);
    if (eventResult.ok === false) {
      return eventResult;
    }

    const event = eventResult.value;
    if (event === null) {
      return Err(EventNotFound("Event not found."));
    }

    if (!this.canManageEvent(actor, event)) {
      return Err(
        EventAuthorizationError("You are not allowed to publish this event."),
      );
    }

    if (event.status !== "draft") {
      return Err(
        InvalidEventState("Only draft events can be published."),
      );
    }

    if (this.isPast(event)) {
      return Err(InvalidEventState("Past events cannot be published."));
    }

    return this.repo.updateEvent(eventId, { status: "published" });
  }

  async cancelEvent(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>> {
    const eventResult = await this.repo.findEventById(eventId);
    if (eventResult.ok === false) {
      return eventResult;
    }

    const event = eventResult.value;
    if (event === null) {
      return Err(EventNotFound("Event not found."));
    }

    if (!this.canManageEvent(actor, event)) {
      return Err(
        EventAuthorizationError("You are not allowed to cancel this event."),
      );
    }

    if (event.status === "cancelled") {
      return Err(InvalidEventState("Event is already cancelled."));
    }

    if (this.isPast(event)) {
      return Err(InvalidEventState("Past events cannot be cancelled."));
    }

    return this.repo.updateEvent(eventId, { status: "cancelled" });
  }

  async getOrganizerDashboard(
    actor: IAuthenticatedUser,
  ): Promise<Result<OrganizerDashboardData, EventError>> {
    if (actor.role !== "staff" && actor.role !== "admin") {
      return Err(
        EventAuthorizationError(
          "Only organizers can access the event dashboard.",
        ),
      );
    }

    const listResult = await this.repo.listEvents(
      actor.role === "admin" ? {} : { organizerId: actor.id },
    );
    if (listResult.ok === false) {
      return listResult;
    }

    const withCounts: EventWithCount[] = [];

    for (const event of listResult.value){
      const rsvps = await this.rsvpRepo.listRSVPByEvent(event.id);
      if (rsvps.ok === false) {
        return Err(
          UnexpectedDependencyError("Unable to retrieve RSVP data for organizer dashboard."),
        );
      }

      const attendeeCount = rsvps.value.filter((rsvp) => rsvp.status === "going").length;

      withCounts.push({
        ...this.materializePastStatus(event),
        attendeeCount: attendeeCount,
      });
    }

    return Ok({
      published: withCounts.filter((event) => event.status === "published"),
      draft: withCounts.filter((event) => event.status === "draft"),
      cancelledOrPast: withCounts.filter(
        (event) => event.status === "cancelled" || event.status === "past",
      ),
    });
  }

  async searchEvents(
    _actor: IAuthenticatedUser,
    query: string,
  ): Promise<Result<IEventRecord[], EventError>> {
    const result = await this.repo.listEvents({
      searchQuery: query.trim(),
      status: "published",
    });
    if (result.ok === false) {
      return result;
    }

    return Ok(result.value.map((event) => this.materializePastStatus(event)));
  }

  private canManageEvent(
    actor: IAuthenticatedUser,
    event: IEventRecord,
  ): boolean {
    return actor.role === "admin" ||
      (actor.role === "staff" && event.organizerId === actor.id);
  }

  private isPast(event: IEventRecord): boolean {
    return event.endDateTime.getTime() < Date.now();
  }

  private materializePastStatus(event: IEventRecord): IEventRecord {
    if (event.status === "cancelled" || !this.isPast(event)) {
      return event;
    }

    return {
      ...event,
      status: "past",
    };
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

  private validateEventInput(
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
        EventValidationError("Location must be between 1 and 200 characte."),
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

    if (input.endDateTime.getTime() <= Date.now()) {
      return Err(
        EventValidationError("Event end time must be in the future."),
      );
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

export function CreateEventService(
  repo: IEventRepository,
  rsvpRepo: IRSVPRepository
): IEventService {
  return new EventService(repo, rsvpRepo);
}
