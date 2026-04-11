import { Result } from "../lib/result";
import { RSVPError } from "../lib/rsvpErrors";
import type { IRSVPRecord, RSVPStatus } from "./rsvp";

export interface IRSVPRepository {
    findRSVP(eventId: string, userId: string): Promise<Result<IRSVPRecord | null, RSVPError>>;
    createRSVP(rsvp: CreateRSVPInput): Promise<Result<IRSVPRecord, RSVPError>>;
    updateRSVP(id: string, status: RSVPStatus): Promise<Result<IRSVPRecord, RSVPError>>;
    listRSVPByUser(userId: string): Promise<Result<IRSVPRecord[], RSVPError>>;
    listRSVPByEvent(eventId: string): Promise<Result<IRSVPRecord[], RSVPError>>;
    findNextWaitlisted(eventId: string): Promise<Result<IRSVPRecord | null, RSVPError>>;
    cancelAndPromoteWaitlist(cancelId: string, promoteId: string): Promise<Result<void, RSVPError>>;
}

export type CreateRSVPInput = Omit<IRSVPRecord, "id" | "createdAt" | "updatedAt">;