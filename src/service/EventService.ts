
import { Ok, Err } from "../lib/result";
import type { Result } from "../lib/result";
import type { EventError } from "../lib/eventErrors";
import type { IEventRecord } from "../lib/event";
import type { IAuthenticatedUser } from "../auth/User";
import type { IEventRepository } from "../repo/IEventRepository";
import type {
  IEventService,
  CreateEventInput,
  UpdateEventInput,
  OrganizerDashboardData,
} from "./IEventService";

class EventService implements IEventService {
  constructor(private readonly repo: IEventRepository) {}

  async createEvent(
    actor: IAuthenticatedUser,
    input: CreateEventInput,
  ): Promise<Result<IEventRecord, EventError>> {
    throw new Error("Not implemented yet");
  }

  async getEvent(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>> {
    throw new Error("Not implemented yet");
  }

  async updateEvent(
    actor: IAuthenticatedUser,
    eventId: string,
    input: UpdateEventInput,
  ): Promise<Result<IEventRecord, EventError>> {
    throw new Error("Not implemented yet");
  }

  async publishEvent(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>> {
    throw new Error("Not implemented yet");
  }

  async cancelEvent(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>> {
    throw new Error("Not implemented yet");
  }

  async listEvents(
    actor: IAuthenticatedUser,
    filters?: { category?: string; timeframe?: string },
  ): Promise<Result<IEventRecord[], EventError>> {
    throw new Error("Not implemented yet");
  }

  async getOrganizerDashboard(
    actor: IAuthenticatedUser,
  ): Promise<Result<OrganizerDashboardData, EventError>> {
    throw new Error("Not implemented yet");
  }

  async searchEvents(
    actor: IAuthenticatedUser,
    query: string,
  ): Promise<Result<IEventRecord[], EventError>> {
    throw new Error("Not implemented yet");
  }
}

export function CreateEventService(repo: IEventRepository): IEventService {
  return new EventService(repo);
}