// src/service/IRSVPService.ts
// Service interface for all RSVP-related features.
// Branch: feature-7-interface

import type { Result } from "../lib/result";
import type { RSVPError } from "../lib/rsvpErrors";
import type { IRSVPRecord } from "../lib/rsvp";
import type { IEventRecord } from "../lib/event";
import type { IAuthenticatedUser } from "../auth/User";

// Feature 7 returns RSVPs joined with their event data so the view can
// show event details (title, date, location) alongside the RSVP status.
export interface RSVPWithEvent {
  rsvp: IRSVPRecord;
  event: IEventRecord;
}

export interface IRSVPService {
  /**
   * Feature 4 & 9.
   * If the actor has no RSVP → create one ("going" or "waitlisted").
   * If the actor has a "going" or "waitlisted" RSVP → cancel it and
   *   promote the next waitlisted person (Feature 9).
   * If the actor has a "cancelled" RSVP → re-activate it.
   */
  toggleRSVP(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IRSVPRecord, RSVPError>>;

  /**
   * Feature 7. Returns all RSVPs for the actor joined with event data.
   * Organizers ("staff") and admins are rejected — only regular members
   * ("user") may view their own RSVP dashboard.
   */
  getMyRSVPs(
    actor: IAuthenticatedUser,
  ): Promise<Result<RSVPWithEvent[], RSVPError>>;

  /**
   * Feature 9. Returns the actor's 1-indexed position in the waitlist,
   * or null if they are not currently waitlisted for that event.
   */
  getWaitlistPosition(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<number | null, RSVPError>>;

  /**
   * Returns the actor's current RSVP for the given event, or null if none exists.
   */
  getRSVP(
    actor: IAuthenticatedUser,
    eventId: string,
  ): Promise<Result<IRSVPRecord | null, RSVPError>>;
}