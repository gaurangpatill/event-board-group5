import { IRSVPRepository, CreateRSVPInput } from "./IRSVPRepository";
import { Result, Err, Ok } from "../lib/result";
import { InvalidRSVPState, RSVPAlreadyExists, RSVPError, RSVPNotFound, UnexpectedDependencyError } from "../lib/rsvpErrors";
import { Prisma, PrismaClient } from "@prisma/client";
import { IRSVPRecord, RSVPStatus } from "../lib/rsvp";
import type { IEventRecord, EventCategory, EventStatus } from "../lib/event";
import type { RSVPWithEvent } from "../service/iRsvpService";


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

    async findNextWaitlisted(eventId: string): Promise<Result<IRSVPRecord | null, RSVPError>> {
        try {
            const record = await this.prisma.rsvp.findFirst({
                where: {
                    eventId,
                    status: "waitlisted",
                },
                orderBy: {
                    updatedAt: "asc",
                },
            });

            return Ok(record);
        } catch (error) {
            return Err(UnexpectedDependencyError("Failed to find next waitlisted RSVP"));
        }
    }

    async cancelAndPromoteWaitlist(cancelId: string, promoteId: string): Promise<Result<void, RSVPError>> {
        try {
            await this.prisma.$transaction(
                async (prisma) => {
                    await prisma.rsvp.update({
                        where: { id: cancelId },
                        data: { status: "cancelled", updatedAt: new Date() },
                    });
                    await prisma.rsvp.update({
                        where: { id: promoteId },
                        data: { status: "going", updatedAt: new Date() },
                    });
                }
            )

            return Ok(undefined);
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2025") { // Record not found
                    return Err(RSVPNotFound("One or both RSVPs not found"));
                }
            }

            return Err(UnexpectedDependencyError("Failed to cancel and promote waitlist"));
        }
    }

    async listRSVPByUserWithEvents(userId: string): Promise<Result<RSVPWithEvent[], RSVPError>> {
        try {
            type RawRow = {
                rsvp_id: string;
                rsvp_eventId: string;
                rsvp_userId: string;
                rsvp_status: string;
                rsvp_createdAt: string | Date;
                rsvp_updatedAt: string | Date;
                ev_id: string;
                ev_title: string;
                ev_description: string;
                ev_location: string;
                ev_category: string;
                ev_startDateTime: string | Date;
                ev_endDateTime: string | Date;
                ev_maxCapacity: number | null;
                ev_status: string;
                ev_organizerId: string;
                ev_createdAt: string | Date;
                ev_updatedAt: string | Date;
            };

            const rows = await this.prisma.$queryRaw<RawRow[]>`
                SELECT
                    r.id            AS rsvp_id,
                    r.eventId       AS rsvp_eventId,
                    r.userId        AS rsvp_userId,
                    r.status        AS rsvp_status,
                    r.createdAt     AS rsvp_createdAt,
                    r.updatedAt     AS rsvp_updatedAt,
                    e.id            AS ev_id,
                    e.title         AS ev_title,
                    e.description   AS ev_description,
                    e.location      AS ev_location,
                    e.category      AS ev_category,
                    e.startDateTime AS ev_startDateTime,
                    e.endDateTime   AS ev_endDateTime,
                    e.maxCapacity   AS ev_maxCapacity,
                    e.status        AS ev_status,
                    e.organizerId   AS ev_organizerId,
                    e.createdAt     AS ev_createdAt,
                    e.updatedAt     AS ev_updatedAt
                FROM rsvps r
                INNER JOIN events e ON e.id = r.eventId
                WHERE r.userId = ${userId}
                ORDER BY e.startDateTime ASC
            `;

            const toDate = (v: string | Date): Date =>
                v instanceof Date ? v : new Date(v);

            const results: RSVPWithEvent[] = rows.map((row) => ({
                rsvp: {
                    id: row.rsvp_id,
                    eventId: row.rsvp_eventId,
                    userId: row.rsvp_userId,
                    status: row.rsvp_status as IRSVPRecord["status"],
                    createdAt: toDate(row.rsvp_createdAt),
                    updatedAt: toDate(row.rsvp_updatedAt),
                },
                event: {
                    id: row.ev_id,
                    title: row.ev_title,
                    description: row.ev_description,
                    location: row.ev_location,
                    category: row.ev_category as EventCategory,
                    startDateTime: toDate(row.ev_startDateTime),
                    endDateTime: toDate(row.ev_endDateTime),
                    maxCapacity: row.ev_maxCapacity,
                    status: row.ev_status as EventStatus,
                    organizerId: row.ev_organizerId,
                    createdAt: toDate(row.ev_createdAt),
                    updatedAt: toDate(row.ev_updatedAt),
                } satisfies IEventRecord,
            }));

            return Ok(results);
        } catch (error) {
            return Err(UnexpectedDependencyError(
                `listRSVPByUserWithEvents failed: ${error instanceof Error ? error.message : String(error)}`,
            ));
        }
    }
}

export function CreatePrismaRSVPRepository(prisma: PrismaClient): IRSVPRepository {
    return new PrismaRSVPRepository(prisma);
}