import type { IAuthenticatedUser } from "../auth/User";
import type { EventCategory, IEventRecord } from "../lib/event";
import type { EventError } from "../lib/errors";
import {
  EventAuthorizationError,
  EventNotFound,
  EventValidationError,
  InvalidEventState,
} from "../lib/errors";
import { Err, Ok, type Result } from "../lib/result";
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
  createEvent(
    actor: IAuthenticatedUser,
    input: CreateEventInput,
  ): Promise<Result<IEventRecord, EventError>>;

  getEventForEdit(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>>;

  updateEvent(
    actor: IAuthenticatedUser,
    eventId: string,
    input: UpdateEventInput,
  ): Promise<Result<IEventRecord, EventError>>;
}

class EventService implements IEventService {
  constructor(private readonly eventRepository: IEventRepository) {}

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

    const repoResult = await this.eventRepository.createEvent({
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

    if (!this.isValidCategory(input.category)) {
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

  private isValidCategory(category: string): category is EventCategory {
    return ["academic", "social", "sports", "workshop", "other"].includes(
      category,
    );
  }
}

export function CreateEventService(
  eventRepository: IEventRepository,
): IEventService {
  return new EventService(eventRepository);
}