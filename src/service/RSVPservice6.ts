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
  //
  // Returns every RSVP (any status) for the authenticated member, joined
  // with the corresponding event record so the view can display event details.
  // Organizers and admins are rejected — they have their own dashboard.

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

    // Stub implementation - will be filled in next commits
    return Ok([]);
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

// ── Factory ───────────────────────────────────────────────────────────────────

export function CreateRSVPService(
  rsvpRepo: IRSVPRepository,
  eventRepo: IEventRepository,
): IRSVPService {
  return new RSVPService(rsvpRepo, eventRepo);
}