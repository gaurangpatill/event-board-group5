
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
    _actor: IAuthenticatedUser,
    filters?: { category?: string; timeframe?: string },
  ): Promise<Result<IEventRecord[], EventError>> {
    // Validate category if supplied
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

    // Validate timeframe if supplied
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

    throw new Error("Not fully implemented yet");
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