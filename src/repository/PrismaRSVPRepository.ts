import { IRSVPRepository, CreateRSVPInput } from "./IRSVPRepository";
import { Result, Err, Ok } from "../lib/result";
import { RSVPError, UnexpectedDependencyError } from "../lib/rsvpErrors";
import { PrismaClient } from "@prisma/client";
import { IRSVPRecord } from "../lib/rsvp";

export class PrismaRSVPRepository implements IRSVPRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async findRSVP(eventId: string, userId: string): Promise<Result<IRSVPRecord | null, RSVPError>> {
        try {
            const record = await this.prisma.rsvp.findUnique({
                where: {
                    eventId_userId: {
                        eventId,
                        userId,
                    }
                }
            })

            return Ok(record);
        } catch (error) {
            return Err(UnexpectedDependencyError("Failed to find RSVP"));
        }
    }
}
