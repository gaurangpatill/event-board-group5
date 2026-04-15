import type { Result } from "../lib/result";
import type { IAuthenticatedUser
 } from "../auth/User";
import type { IEventRecord } from "../lib/event";
import type { EventError } from "../lib/errors";
import {
  EventNotFound,
  EventAuthorizationError,
  InvalidEventState,
} from "../lib/errors";
import type { IEventRepository } from "../repository/InMemoryEventRepository";
import {Ok, Err} from "../lib/result"



export interface IEventService {
  getEvent(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>>;
}


class EventService implements IEventService {
  constructor(private readonly eventRepo: IEventRepository) {}

  async getEvent(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>> {
    const result = await this.eventRepo.findEventById(eventId);
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
}

export function CreateEventService(
  eventRepo: IEventRepository,
): IEventService {
  return new EventService(eventRepo);
}