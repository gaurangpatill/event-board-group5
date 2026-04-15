import type { Result } from "../lib/result";
import type { IAuthenticatedUser
 } from "../auth/User";
import type { IEventRecord } from "../lib/event";
import type { EventError } from "../lib/errors";



export interface IEventService {
  getEvent(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IEventRecord, EventError>>;
}