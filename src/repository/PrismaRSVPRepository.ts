import { IRSVPRepository, CreateRSVPInput } from "./IRSVPRepository";
import { Result, Err, Ok } from "../lib/result";
import { InvalidRSVPState, RSVPAlreadyExists, RSVPError, UnexpectedDependencyError } from "../lib/rsvpErrors";
import { Prisma, PrismaClient } from "@prisma/client";
import { IRSVPRecord, RSVPStatus } from "../lib/rsvp";

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

    async createRSVP(input: CreateRSVPInput): Promise<Result<IRSVPRecord, RSVPError>> {
        try {
            const record = await this.prisma.rsvp.create({
                data: input,
            });

            return Ok(record);
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2002") { // Unique constraint failed
                    return Err(RSVPAlreadyExists("User already has an RSVP for this event"));
                }
            }

            return Err(UnexpectedDependencyError("Failed to create RSVP"));
        }
    }

    async updateRSVP(id: string, status: RSVPStatus): Promise<Result<IRSVPRecord, RSVPError>> {
        try {
            const record = await this.prisma.rsvp.update({
                where: { id },
                data: { status, updatedAt: new Date() },
            });

            return Ok(record);
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2025") { // Record not found
                    return Err(InvalidRSVPState("RSVP not found"));
                }
            }

            return Err(UnexpectedDependencyError("Failed to update RSVP"));
        }
    }

    async listRSVPByUser(userId: string): Promise<Result<IRSVPRecord[], RSVPError>> {
        try {
            const records = await this.prisma.rsvp.findMany({
                where: {
                    userId,
                }
            });

            return Ok(records);
        } catch (error) {
            return Err(UnexpectedDependencyError("Failed to list RSVPs by user"));
        }
    }

    async listRSVPByEvent(eventId: string): Promise<Result<IRSVPRecord[], RSVPError>> {
        try {
            const records = await this.prisma.rsvp.findMany({
                where: {
                    eventId,
                }
            });

            return Ok(records);
        } catch (error) {
            return Err(UnexpectedDependencyError("Failed to list RSVPs by event"));
        }
    }
}
