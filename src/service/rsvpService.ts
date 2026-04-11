import { IAuthenticatedUser } from "../auth/User";
import { Result, Err, Ok } from "../lib/result";
import { RSVPError } from "../lib/rsvpErrors";
import { IRSVPRecord } from "../repository/rsvp";

export interface IRSVPService {
    toggleRSVP(eventId: string, userId: string): Promise<Result<IRSVPRecord, RSVPError>>;
    getMyRSVPs(actor: IAuthenticatedUser): Promise<Result<IRSVPRecord[], RSVPError>>;
    getWaitlistPosition(eventId: string, userId: string): Promise<Result<number | null, RSVPError>>;
}