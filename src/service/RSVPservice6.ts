// src/service/RSVPService.ts
// Concrete implementation of IRSVPService.
// Features 4, 7, and 9 live here.
// Branch: task/rsvp-dashboard-service

import { Ok, Err } from "../lib/result";
import type { Result } from "../lib/result";
import type { RSVPError } from "../lib/rsvpErrors";
import {
  RSVPAuthorizationError,
  RSVPNotFound,
  UnexpectedDependencyError,
} from "../lib/rsvpErrors";
import type { IRSVPRecord } from "../lib/rsvp";
import type { IAuthenticatedUser } from "../auth/User";
import type { IRSVPRepository } from "../repository/IRSVPrepo";
import type { IEventRepository } from "../repository/EventRepository";
import type { IRSVPService, RSVPWithEvent } from "./iRsvpService";

class RSVPService implements IRSVPService {
  constructor(
    private readonly rsvpRepo: IRSVPRepository,
    private readonly eventRepo: IEventRepository,
  ) {}

  // ── Feature 7: getMyRSVPs ───────────────────────────────────────────────
  async getMyRSVPs(
    actor: IAuthenticatedUser,
  ): Promise<Result<RSVPWithEvent[], RSVPError>> {
    // Only regular members ("user") may use the RSVP dashboard.
    if (actor.role !== "user") {
      return Err(
        RSVPAuthorizationError(
          "Organizers and admins do not have an RSVP dashboard. Use the Organizer Dashboard instead.",
        ),
      );
    }

    const rsvpsResult = await this.rsvpRepo.listRSVPByUser(actor.id);
    if (!rsvpsResult.ok) return rsvpsResult;

    const rsvps = rsvpsResult.value;

    // Join each RSVP with its event. Any missing event is silently skipped
    // (soft-deleted or orphaned data) to keep the dashboard usable.
    const joined: RSVPWithEvent[] = [];
    for (const rsvp of rsvps) {
      const eventResult = await this.eventRepo.findEventById(rsvp.eventId);
      if (!eventResult.ok || !eventResult.value) continue;
      joined.push({ rsvp, event: eventResult.value });
    }

    // Sort by event startDateTime ascending so upcoming events appear first.
    joined.sort(
      (a, b) =>
        a.event.startDateTime.getTime() - b.event.startDateTime.getTime(),
    );

    return Ok(joined);
  }

  // ── Feature 4 & 9: Stubs (not implemented in this branch) ───────────────
  async toggleRSVP(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IRSVPRecord, RSVPError>> {
    throw new Error("toggleRSVP not yet implemented");
  }

  async getWaitlistPosition(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<number | null, RSVPError>> {
    throw new Error("getWaitlistPosition not yet implemented");
  }
}

export function CreateRSVPService(
  rsvpRepo: IRSVPRepository,
  eventRepo: IEventRepository,
): IRSVPService {
  return new RSVPService(rsvpRepo, eventRepo);
}