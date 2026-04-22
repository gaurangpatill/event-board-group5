import type { IAuthenticatedUser } from "../auth/User";
import type { IEventRepository } from "../repository/EventRepository";
import type {
  CreateRSVPInput,
  IRSVPRepository,
} from "../repository/IRSVPRepository";
import type { IRSVPRecord, RSVPStatus } from "../lib/rsvp";
import {
  InvalidRSVPState,
  RSVPAuthorizationError,
  type RSVPError,
  RSVPToInvalidEvent,
  UnexpectedDependencyError,
} from "../lib/rsvpErrors";
import { Err, Ok, type Result } from "../lib/result";
import type { ILoggingService } from "./LoggingService";
import type { IRSVPService, RSVPWithEvent } from "./iRsvpService";
import type { IEventRecord } from "../lib/event";

class RSVPService implements IRSVPService {
  constructor(
    private readonly rsvpRepository: IRSVPRepository,
    private readonly eventRepository: IEventRepository,
    private readonly logger: ILoggingService,
  ) {}

  async toggleRSVP(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IRSVPRecord, RSVPError>> {
    const existingRSVPResult = await this.rsvpRepository.findRSVP(
      eventId,
      actor.id,
    );

    if (existingRSVPResult.ok === false) {
      this.logger.error(
        `findRSVP failed for user ${actor.id} and event ${eventId}: ${existingRSVPResult.value.message}`,
      );
      return Err(
        UnexpectedDependencyError(existingRSVPResult.value.message),
      );
    }

    const eventResult = await this.eventRepository.findEventById(eventId);

    if (eventResult.ok === false) {
      this.logger.error(
        `findEventById failed for event ${eventId}: ${eventResult.value.message}`,
      );
      return Err(
        UnexpectedDependencyError(eventResult.value.message),
      );
    }

    if (eventResult.value === null) {
      return Err(
        RSVPToInvalidEvent(
          "Cannot RSVP to an event that does not exist.",
        ),
      );
    }

    if(eventResult.value.status !== "published" || eventResult.value.endDateTime.getTime() < Date.now()) {
      return Err(
        RSVPToInvalidEvent(
          "Cannot RSVP to a cancelled or past event.",
        ),
      );
    }

    const existingRSVP = existingRSVPResult.value;
    if (existingRSVP === null) {

      const nextStatus = await this.getStatusForNewOrReactivatedRSVP(eventResult.value);

      if (nextStatus.ok === false) {
        return nextStatus;
      }

      const input: CreateRSVPInput = {
        eventId,
        userId: actor.id,
        status: nextStatus.value,
      };
      this.logger.info(`Creating new RSVP for user ${actor.id} and event ${eventId} with status ${nextStatus.value}`);
      return this.rsvpRepository.createRSVP(input);
    }

    switch (existingRSVP.status) { 
      case "going":
        return this.cancelAndPromoteWaitlist(existingRSVP, eventResult.value.id);
      case "waitlisted":
        return this.rsvpRepository.updateRSVP(existingRSVP.id, "cancelled");
      case "cancelled": {
        const nextStatus = await this.getStatusForNewOrReactivatedRSVP(eventResult.value);
        if (nextStatus.ok === false) {
          return nextStatus;
        }
        this.logger.info("Reactivating cancelled RSVP with status " + nextStatus.value);
        return this.rsvpRepository.updateRSVP(existingRSVP.id, nextStatus.value);
      }
      default:
        this.logger.error(`Invalid RSVP status ${existingRSVP.status} for record ${existingRSVP.id}`);
        return Err(
          InvalidRSVPState(
            `Record ${existingRSVP.id} has invalid status ${existingRSVP.status}`,
          ),
        );
    }
  }

  async getMyRSVPs(
    actor: IAuthenticatedUser,
  ): Promise<Result<RSVPWithEvent[], RSVPError>> {
    if (actor.role !== "user") {
      return Err(
        RSVPAuthorizationError(
          "Organizers and admins do not have an RSVP dashboard. Use the organizer dashboard instead.",
        ),
      );
    }

    const rsvpsResult = await this.rsvpRepository.listRSVPByUser(actor.id);
    if (rsvpsResult.ok === false) {
      return rsvpsResult;
    }

    const joined: RSVPWithEvent[] = [];
    for (const rsvp of rsvpsResult.value) {
      const eventResult = await this.eventRepository.findEventById(rsvp.eventId);
      if (eventResult.ok === false || eventResult.value === null) {
        continue;
      }
      joined.push({ rsvp, event: eventResult.value });
    }

    joined.sort(
      (left, right) =>
        left.event.startDateTime.getTime() - right.event.startDateTime.getTime(),
    );

    return Ok(joined);
  }

  async getWaitlistPosition(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<number | null, RSVPError>> {
    const rsvpsResult = await this.rsvpRepository.listRSVPByEvent(eventId);
    if (rsvpsResult.ok === false) {
      this.logger.error(
        `listRSVPByEvent failed for event ${eventId}: ${rsvpsResult.value.message}`,
      );
      return Err(UnexpectedDependencyError(rsvpsResult.value.message));
    }

    const position = rsvpsResult.value
      .filter((rsvp) => rsvp.status === "waitlisted")
      .sort((left, right) => left.updatedAt.getTime() - right.updatedAt.getTime())
      .findIndex((rsvp) => rsvp.userId === actor.id);

    return Ok(position === -1 ? null : position + 1);
  }

  async getRSVP(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IRSVPRecord | null, RSVPError>> {
    return this.rsvpRepository.findRSVP(eventId, actor.id);
  }

  private async getStatusForNewOrReactivatedRSVP(
    event: IEventRecord,
  ): Promise<Result<RSVPStatus, RSVPError>> {
    const maxCapacityResult = this.getEventMaxCapacity(event);
    
    if (maxCapacityResult.ok === false) {
      return maxCapacityResult;
    }

    const attendeesCountResult = await this.getCurrentAttendeesCount(event.id);
    if (attendeesCountResult.ok === false) {
      return attendeesCountResult;
    }

    const nextStatus: RSVPStatus =
      attendeesCountResult.value < maxCapacityResult.value
        ? "going"
        : "waitlisted";
    return Ok(nextStatus);
  }

  private getEventMaxCapacity(
    event: IEventRecord,
  ): Result<number, RSVPError> {
    if (event.maxCapacity === null) {
      return Ok(Number.POSITIVE_INFINITY);
    } else {
      return Ok(event.maxCapacity);
    }
  }

  private async getCurrentAttendeesCount(
    eventId: string,
  ): Promise<Result<number, RSVPError>> {
    const rsvpsResult = await this.rsvpRepository.listRSVPByEvent(eventId);
    if (rsvpsResult.ok === false) {
      this.logger.error(
        `listRSVPByEvent failed for ${eventId}: ${rsvpsResult.value.message}`,
      );
      return Err(UnexpectedDependencyError(rsvpsResult.value.message));
    }

    return Ok(
      rsvpsResult.value.filter((rsvp) => rsvp.status === "going").length,
    );
  }

  private async cancelAndPromoteWaitlist(
    rsvp: IRSVPRecord,
    eventId: string,
  ): Promise<Result<IRSVPRecord, RSVPError>> {
    const nextWaitlistedResult = await this.rsvpRepository.findNextWaitlisted(
      eventId,
    );
    if (nextWaitlistedResult.ok === false) {
      this.logger.error(
        `findNextWaitlisted failed for ${eventId}: ${nextWaitlistedResult.value.message}`,
      );
      return Err(UnexpectedDependencyError(nextWaitlistedResult.value.message));
    }

    const nextWaitlisted = nextWaitlistedResult.value;

    if (nextWaitlisted === null || nextWaitlisted.id === rsvp.id) {
      return this.rsvpRepository.updateRSVP(rsvp.id, "cancelled");
    }

    const cancelResult = await this.rsvpRepository.cancelAndPromoteWaitlist(
      rsvp.id,
      nextWaitlisted.id,
    );
    if (cancelResult.ok === false) {
      this.logger.error(
        `cancelAndPromoteWaitlist failed for ${eventId}: ${cancelResult.value.message}`,
      );
      return Err(UnexpectedDependencyError(cancelResult.value.message));
    }

    return Ok({ ...rsvp, status: "cancelled" as RSVPStatus });
  }
}

export function CreateRSVPService(
  rsvpRepository: IRSVPRepository,
  eventRepository: IEventRepository,
  logger: ILoggingService,
): IRSVPService {
  return new RSVPService(rsvpRepository, eventRepository, logger);
}
