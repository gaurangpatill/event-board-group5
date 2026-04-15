
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

  // Stub — implemented by Gaurang in task/add-event-creation-service
  async createEvent(
    _actor: IAuthenticatedUser,
    _input: CreateEventInput,
  ): Promise<Result<IEventRecord, EventError>> {
    throw new Error("Not implemented yet");
  }

  // Stub — implemented by Paul in task/add-event-detail-service
  async getEvent(
    _actor: IAuthenticatedUser,
    _eventId: string,
  ): Promise<Result<IEventRecord, EventError>> {
    throw new Error("Not implemented yet");
  }

  // Stub — implemented by Gaurang in task/add-event-edit-service
  async updateEvent(
    _actor: IAuthenticatedUser,
    _eventId: string,
    _input: UpdateEventInput,
  ): Promise<Result<IEventRecord, EventError>> {
    throw new Error("Not implemented yet");
  }

  // Stub — implemented by Paul in task/add-event-publish-service
  async publishEvent(
    _actor: IAuthenticatedUser,
    _eventId: string,
  ): Promise<Result<IEventRecord, EventError>> {
    throw new Error("Not implemented yet");
  }

  // Stub — implemented by Paul in task/add-event-cancel-service
  async cancelEvent(
    _actor: IAuthenticatedUser,
    _eventId: string,
  ): Promise<Result<IEventRecord, EventError>> {
    throw new Error("Not implemented yet");
  }

  // Feature 6 — implemented in this branch
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

  // Stub — implemented by Gauri in task/add-organizer-dashboard-service
  async getOrganizerDashboard(
    _actor: IAuthenticatedUser,
  ): Promise<Result<OrganizerDashboardData, EventError>> {
    throw new Error("Not implemented yet");
  }

  // Stub — implemented by Gauri in task/add-event-search-service
  async searchEvents(
    _actor: IAuthenticatedUser,
    _query: string,
  ): Promise<Result<IEventRecord[], EventError>> {
    throw new Error("Not implemented yet");
  }
}

export function CreateEventService(repo: IEventRepository): IEventService {
  return new EventService(repo);
}