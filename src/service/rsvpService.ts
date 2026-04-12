import { IAuthenticatedUser } from "../auth/User";
import { Result, Err, Ok } from "../lib/result";
import { RSVPError, UnexpectedDependencyError } from "../lib/rsvpErrors";
import { IRSVPRecord } from "../repository/rsvp";
import { IRSVPRepository, CreateRSVPInput } from "../repository/rsvpRepository";
import { IEventRepository } from "../repository/eventRepository";
import { ILoggingService } from "./LoggingService";


export interface IRSVPService {
    toggleRSVP(eventId: string, userId: string): Promise<Result<IRSVPRecord, RSVPError>>;
    getMyRSVPs(actor: IAuthenticatedUser): Promise<Result<IRSVPRecord[], RSVPError>>;
    getWaitlistPosition(eventId: string, userId: string): Promise<Result<number | null, RSVPError>>;
}

export class RSVPService implements IRSVPService {
    private readonly rsvpRepository: IRSVPRepository;
    private readonly eventRepository: IEventRepository;
    private readonly logger: ILoggingService;
    constructor(rsvpRepository: IRSVPRepository, eventRepository: IEventRepository, logger: ILoggingService) {
        this.rsvpRepository = rsvpRepository;
        this.eventRepository = eventRepository;
        this.logger = logger;
    }

    private async getEventMaxCapacity(eventId: string): Promise<Result<number, RSVPError>> {
        const eventResult = await this.eventRepository.getEventById(eventId);

        if (eventResult.ok) {
            const event = eventResult.value;
            if (event) {
                this.logger.info(`Retrieved max capacity for event ${eventId}: ${event.maxCapacity}.`);
                return Ok(event.maxCapacity);
            } else {
                this.logger.error(`Event with id ${eventId} not found when retrieving max capacity.`);
                return Err(UnexpectedDependencyError(`Event with id ${eventId} not found when retrieving max capacity.`));
            }
        } else {
            this.logger.error(`Failed to retrieve event with id ${eventId} when getting max capacity: ${eventResult.value.message}`);
            return Err(UnexpectedDependencyError(`Failed to retrieve event with id ${eventId} when getting max capacity: ${eventResult.value.message}`));
        }
    }

    private async getCurrentAttendeesCount(eventId: string): Promise<Result<number, RSVPError>> {
        const rsvpsResult = await this.rsvpRepository.listRSVPByEvent(eventId);

        if (rsvpsResult.ok) {
            const rsvps = rsvpsResult.value;
            const attendeesCount = rsvps.filter(r => r.status === "going").length;
            this.logger.info(`Current attendees count for event ${eventId} is ${attendeesCount}.`);
            return Ok(attendeesCount);
        } else {
            this.logger.error(`Failed to retrieve RSVPs for event ${eventId} when counting attendees: ${rsvpsResult.value.message}`);
            return Err(UnexpectedDependencyError(`Failed to retrieve RSVPs for event ${eventId} when counting attendees: ${rsvpsResult.value.message}`));
        }
    }

    private async cancelAndPromoteWaitlist(rsvp: IRSVPRecord, eventId: string): Promise<Result<IRSVPRecord, RSVPError>> {
        const cancelResult = await this.rsvpRepository.updateRSVP(rsvp.id, "cancelled");

        if (cancelResult.ok) {
            const nextWaitlistedResult = await this.rsvpRepository.findNextWaitlisted(eventId);
            if (nextWaitlistedResult.ok) {
                if (nextWaitlistedResult.value === null) {
                    this.logger.info(`No waitlisted RSVPs to promote for event ${eventId} after cancelling RSVP with id ${rsvp.id}.`);
                    return Ok(cancelResult.value);
                } else {
                    const promoteResult = await this.rsvpRepository.updateRSVP(nextWaitlistedResult.value.id, "going");
                    if (promoteResult.ok) {
                        this.logger.info(`Promoted waitlisted RSVP with id ${nextWaitlistedResult.value.id} to 'going' for event ${eventId} after cancelling RSVP with id ${rsvp.id}.`);
                        return Ok(cancelResult.value);
                    } else {
                        this.logger.error(`Failed to promote waitlisted RSVP with id ${nextWaitlistedResult.value.id} for event ${eventId} after cancelling RSVP with id ${rsvp.id}: ${promoteResult.value.message}`);
                        return Err(UnexpectedDependencyError(`Failed to promote waitlisted RSVP with id ${nextWaitlistedResult.value.id} for event ${eventId} after cancelling RSVP with id ${rsvp.id}: ${promoteResult.value.message}`));
                    }
                }
            } else {
                this.logger.error(`Failed to find next waitlisted RSVP for event ${eventId} after cancelling RSVP with id ${rsvp.id}: ${nextWaitlistedResult.value.message}`);
                return Err(UnexpectedDependencyError(`Failed to find next waitlisted RSVP for event ${eventId} after cancelling RSVP with id ${rsvp.id}: ${nextWaitlistedResult.value.message}`));
            }
        } else {
            this.logger.error(`Failed to cancel RSVP with id ${rsvp.id} for event ${eventId}: ${cancelResult.value.message}`);
            return Err(UnexpectedDependencyError(`Failed to cancel RSVP with id ${rsvp.id} for event ${eventId}: ${cancelResult.value.message}`));
        }
    }

    async toggleRSVP(eventId: string, userId: string): Promise<Result<IRSVPRecord, RSVPError>> {
        const existingRSVPResult = await this.rsvpRepository.findRSVP(eventId, userId);

        if (existingRSVPResult.ok) {
            const existingRSVP = existingRSVPResult.value;

            if (existingRSVP === null) {
                this.logger.info(`No existing RSVP for user ${userId} and event ${eventId}. Creating new RSVP with status 'going'.`);
                
                const rsvpInput: CreateRSVPInput = {
                    eventId,
                    userId,
                    status: "going"
                };

                return await this.rsvpRepository.createRSVP(rsvpInput);
            } else {
                switch (existingRSVP.status) {
                    case "going":
                        this.logger.info(`Existing RSVP for user ${userId} and event ${eventId} is 'going'. Updating to 'cancelled'.`);
                        return await this.cancelAndPromoteWaitlist(existingRSVP, eventId);
                    case "waitlisted":
                        this.logger.info(`Existing RSVP for user ${userId} and event ${eventId} is 'waitlisted'. Updating to 'cancelled'.`);
                        return await this.rsvpRepository.updateRSVP(existingRSVP.id, "cancelled");
                    case "cancelled":
                    // this is the most complex scenario is it is dependent on the capacity of the event and how full it is
                        const maxCapacityResult = await this.getEventMaxCapacity(eventId);
                        const attendeesCountResult = await this.getCurrentAttendeesCount(eventId);

                        if (maxCapacityResult.ok && attendeesCountResult.ok) {
                            const maxCapacity = maxCapacityResult.value;
                            const attendeesCount = attendeesCountResult.value;

                            if (attendeesCount < maxCapacity) {
                                this.logger.info(`Existing RSVP for user ${userId} and event ${eventId} is 'cancelled'. Event has capacity. Updating to 'going'.`);
                                return await this.rsvpRepository.updateRSVP(existingRSVP.id, "going");
                            } else {
                                this.logger.info(`Existing RSVP for user ${userId} and event ${eventId} is 'cancelled'. Event is at capacity. Updating to 'waitlisted'.`);
                                return await this.rsvpRepository.updateRSVP(existingRSVP.id, "waitlisted");
                            }
                        } else {
                            return Err(UnexpectedDependencyError(`Failed to retrieve event capacity or attendees count for event ${eventId} when toggling RSVP for user ${userId}.`));
                        }
                    default:
                        this.logger.error(`Existing RSVP for user ${userId} and event ${eventId} has invalid status '${existingRSVP.status}'.`);
                        return Err(UnexpectedDependencyError(`Existing RSVP for user ${userId} and event ${eventId} has invalid status '${existingRSVP.status}'.`));
                }
            }
        } else {
            this.logger.error(`Failed to find RSVP for user ${userId} and event ${eventId}: ${existingRSVPResult.value.message}`);
            return Err(UnexpectedDependencyError(`Failed to find RSVP for user ${userId} and event ${eventId}: ${existingRSVPResult.value.message}`));
        }
    }

    async getMyRSVPs(actor: IAuthenticatedUser): Promise<Result<IRSVPRecord[], RSVPError>> {
        return await this.rsvpRepository.listRSVPByUser(actor.id);
    }

    async getWaitlistPosition(eventId: string, userId: string): Promise<Result<number | null, RSVPError>> {
        const rsvpsResult = await this.rsvpRepository.listRSVPByEvent(eventId);

        if (rsvpsResult.ok) {
            const position = rsvpsResult.value.filter(r => r.status === "waitlisted").sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime()).findIndex(r => r.userId === userId);

            if (position !== -1) {
                this.logger.info(`User ${userId} is waitlisted for event ${eventId} at position ${position + 1}.`);
                return Ok(position + 1);
            } else {
                this.logger.info(`User ${userId} is not waitlisted for event ${eventId}.`);
                return Ok(null);
            }
        } else {
            this.logger.error(`Failed to retrieve RSVPs for event ${eventId}: ${rsvpsResult.value.message}`);
            return Err(UnexpectedDependencyError(`Failed to retrieve RSVPs for event ${eventId}: ${rsvpsResult.value.message}`));
        }
    }
}

        
