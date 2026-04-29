// src/repository/IRSVPRepository.ts
// Interface contract for the RSVP data-access layer.
// Branch: feature-7-interface

import type { Result } from "../lib/result";
import type { RSVPError } from "../lib/rsvpErrors";
import type { IRSVPRecord, RSVPStatus } from "../lib/rsvp";
import type { RSVPWithEvent } from "../service/iRsvpService";
export type CreateRSVPInput = Omit<IRSVPRecord, "id" | "createdAt" | "updatedAt">;

export interface IRSVPRepository {
  findRSVP(
    eventId: string,
    userId: string,
  ): Promise<Result<IRSVPRecord | null, RSVPError>>;

  createRSVP(rsvp: CreateRSVPInput): Promise<Result<IRSVPRecord, RSVPError>>;

  updateRSVP(
    id: string,
    status: RSVPStatus,
  ): Promise<Result<IRSVPRecord, RSVPError>>;

  /** All RSVPs (any status) for a given user. Used by Feature 7. */
  listRSVPByUser(userId: string): Promise<Result<IRSVPRecord[], RSVPError>>;
  listRSVPByEvent(eventId: string): Promise<Result<IRSVPRecord[], RSVPError>>;

  findNextWaitlisted(
    eventId: string,
  ): Promise<Result<IRSVPRecord | null, RSVPError>>;

  /** Atomically cancel one RSVP and promote the waitlisted one. */
  cancelAndPromoteWaitlist(
    cancelId: string,
    promoteId: string,
  ): Promise<Result<void, RSVPError>>;

  //loads all the RSVPs for thr user along with event details in one database query 
  listRSVPByUserWithEvents?(
  userId: string,
): Promise<Result<RSVPWithEvent[], RSVPError>>;
}