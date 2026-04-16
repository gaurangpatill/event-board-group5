import type { IAuthenticatedUser } from "../auth/User";
import type { EventCategory, IEventRecord } from "../lib/event";
import {
  EventAuthorizationError,
  EventNotFound,
  EventValidationError,
  type EventError,
} from "../lib/errors";
import {Result, Ok, Err} from "../lib/result"
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
}

class EventService implements IEventService {
  constructor(private readonly eventRepository: IEventRepository) {}

  async getEvent(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>> {
    const result = await this.eventRepository.findEventById(eventId);
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

    const repoResult = await this.eventRepository.createEvent({
      ...validationResult.value,
      status: "draft",
      organizerId: actor.id,
    });

    if (!repoResult.ok) {
      return repoResult;
    }

    return Ok(repoResult.value);
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