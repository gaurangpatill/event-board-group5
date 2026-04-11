import { ILoggingService } from "../service/LoggingService";
import { Result, Ok, Err } from "../lib/result";
import { RSVPAlreadyExists, RSVPError, RSVPNotFound } from "../lib/rsvpErrors";
import type { IRSVPRecord, RSVPStatus } from "./rsvp";
import { IRSVPRepository, CreateRSVPInput } from "./rsvpRepository";

export class RSVPRepository implements IRSVPRepository {
    private rsvps: IRSVPRecord[];
    private readonly logger: ILoggingService;
    
    constructor(logger: ILoggingService) {
        this.rsvps = [];
        this.logger = logger;
    }
    
    async findRSVP (eventId: string, userId: string): Promise<Result<IRSVPRecord | null, RSVPError>> {
        const rsvp = this.rsvps.find(r => r.eventId === eventId && r.userId === userId);
        if (!rsvp) {
            this.logger.info(`No RSVP found for user ${userId} and event ${eventId}.`);
            return Ok(null);
        }

        this.logger.info(`RSVP found for user ${userId} and event ${eventId}: ${rsvp.status}.`);
        return Ok(rsvp);
    }

    async createRSVP(rsvp: CreateRSVPInput): Promise<Result<IRSVPRecord, RSVPError>> {
        const newRSVP: IRSVPRecord = {
            id: crypto.randomUUID(),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...rsvp
        };

        const existingRSVP = await this.findRSVP(rsvp.eventId, rsvp.userId);

        if (existingRSVP.ok && existingRSVP.value === null) {
            this.rsvps.push(newRSVP);

            this.logger.info(`Created new RSVP for user ${rsvp.userId} and event ${rsvp.eventId} with status ${rsvp.status}.`);
            return Ok(newRSVP);
        } else {
            this.logger.warn(`Attempted to create duplicate RSVP for user ${rsvp.userId} and event ${rsvp.eventId}.`);
            return Err(RSVPAlreadyExists(`RSVP for user ${rsvp.userId} and event ${rsvp.eventId} already exists.`));
        }
    }

    async updateRSVP(id: string, status: RSVPStatus): Promise<Result<IRSVPRecord, RSVPError>> {
        const rsvpIndex = this.rsvps.findIndex(r => r.id === id);

        if (rsvpIndex === -1) {

            this.logger.error(`RSVP with id ${id} not found.`);
            return Err(RSVPNotFound(`RSVP with id ${id} not found.`));
        }

        if(this.rsvps[rsvpIndex].status === status) {
            this.logger.info(`RSVP with id ${id} already has status ${status}. No update needed.`);
            return Ok(this.rsvps[rsvpIndex]);
        }

        this.rsvps[rsvpIndex].status = status;
        this.rsvps[rsvpIndex].updatedAt = new Date();
        this.logger.info(`Updated RSVP with id ${id} to status ${status}.`);
        return Ok(this.rsvps[rsvpIndex]);
    }

    async listRSVPByUser(userId: string): Promise<Result<IRSVPRecord[], RSVPError>> {
        const userRsvps = this.rsvps.filter(r => r.userId === userId);
        this.logger.info(`Found ${userRsvps.length} RSVPs for user ${userId}.`);
        return Ok(userRsvps);
    }

    async listRSVPByEvent(eventId: string): Promise<Result<IRSVPRecord[], RSVPError>> {
        const eventRsvps = this.rsvps.filter(r => r.eventId === eventId);
        this.logger.info(`Found ${eventRsvps.length} RSVPs for event ${eventId}.`);
        return Ok(eventRsvps);
    }

    async findNextWaitlisted(eventId: string): Promise<Result<IRSVPRecord | null, RSVPError>> {
        const waitlistedRsvps = this.rsvps.filter(r => r.eventId === eventId && r.status === "waitlisted");
        if (waitlistedRsvps.length === 0) {
            this.logger.info(`No waitlisted RSVPs found for event ${eventId}.`);
            return Ok(null);
        }

        const nextWaitlisted = waitlistedRsvps.reduce((prev, curr) => prev.updatedAt < curr.updatedAt ? prev : curr);
        this.logger.info(`Next waitlisted RSVP for event ${eventId} is ${nextWaitlisted.id}.`);
        return Ok(nextWaitlisted);
    }

    async cancelAndPromoteWaitlist(cancelId: string, promoteId: string): Promise<Result<void, RSVPError>> {
        const cancelIndex = this.rsvps.findIndex(r => r.id === cancelId);
        const promoteIndex = this.rsvps.findIndex(r => r.id === promoteId);

        if (cancelIndex === -1) {
            this.logger.error(`RSVP to cancel with id ${cancelId} not found.`);
            return Err(RSVPNotFound(`RSVP to cancel with id ${cancelId} not found.`));
        }

        if (promoteIndex === -1) {
            this.logger.error(`RSVP to promote with id ${promoteId} not found.`);
            return Err(RSVPNotFound(`RSVP to promote with id ${promoteId} not found.`));
        }

        this.rsvps[cancelIndex].status = "cancelled";
        this.rsvps[cancelIndex].updatedAt = new Date();
        this.logger.info(`Cancelled RSVP with id ${cancelId}.`);
        this.rsvps[promoteIndex].status = "going";
        this.rsvps[promoteIndex].updatedAt = new Date();
        this.logger.info(`Promoted RSVP with id ${promoteId} to going.`);
        return Ok(undefined);
    }
}