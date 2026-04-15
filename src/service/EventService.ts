import type { IAuthenticatedUser } from "../auth/User";
import type { EventCategory, IEventRecord } from "../lib/event";
import type { EventError } from "../lib/errors";
import { EventAuthorizationError } from "../lib/errors";
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

    const repoResult = await this.eventRepository.createEvent({
      title: input.title,
      description: input.description,
      location: input.location,
      category: input.category,
      startDateTime: input.startDateTime,
      endDateTime: input.endDateTime,
      maxCapacity: input.maxCapacity ?? null,
      status: "draft",
      organizerId: actor.id,
    });

    if (!repoResult.ok) {
      return repoResult;
    }

    return Ok(repoResult.value);
  }
}

export function CreateEventService(
  eventRepository: IEventRepository,
): IEventService {
  return new EventService(eventRepository);
}