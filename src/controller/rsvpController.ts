import type { Response } from "express";
import type { IAppBrowserSession } from "../session/AppSession";
import type { ILoggingService } from "../service/LoggingService";
import type { IRSVPService } from "../service/rsvpService";

export interface IRSVPController {
    toggleRSVP(res: Response, eventId: string, session: IAppBrowserSession, isHtmx: boolean): Promise<void>;
    getWaitlistPosition(res: Response, eventId: string, session: IAppBrowserSession, isHtmx: boolean): Promise<void>;
    getMyRSVPs(res: Response, session: IAppBrowserSession): Promise<void>;
}

export class RSVPController implements IRSVPController {
    constructor(
        private readonly rsvpService: IRSVPService,
        private readonly logger: ILoggingService,
    ) {}

    async toggleRSVP(res: Response, eventId: string, session: IAppBrowserSession, isHtmx: boolean): Promise<void> {
        if (!session.authenticatedUser) {
            res.status(401).render("partials/error", {
                message: "You must be logged in to RSVP.",
                layout: false,
            });
            return;
        }

        const result = await this.rsvpService.toggleRSVP(eventId, session.authenticatedUser.userId);

        if (result.ok) {
            if (isHtmx) {
                res.status(200).render("partials/rsvp/button", {
                    rsvp: result.value,
                    eventId,
                    layout: false,
                });
            } else {
                res.redirect(`/events/${eventId}`);
            }
        } else {
            this.logger.error(`toggleRSVP failed for event ${eventId} and user ${session.authenticatedUser.userId}: ${result.value.message}`);
            res.status(500).render("partials/error", {
                message: result.value.message,
                layout: false,
            });
        }
    }

    async getWaitlistPosition(res: Response, eventId: string, session: IAppBrowserSession, isHtmx: boolean): Promise<void> {
        if (!session.authenticatedUser) {
            res.status(401).render("partials/error", {
                message: "You must be logged in to view your waitlist position.",
                layout: false,
            });
            return;
        }

        const result = await this.rsvpService.getWaitlistPosition(eventId, session.authenticatedUser.userId);

        if (result.ok) {
            if (isHtmx) {
                res.status(200).render("partials/rsvp/waitlist-position", {
                    position: result.value,
                    eventId,
                    layout: false,
                });
            } else {
                res.redirect(`/events/${eventId}`);
            }
        } else {
            this.logger.error(`getWaitlistPosition failed for event ${eventId} and user ${session.authenticatedUser.userId}: ${result.value.message}`);
            res.status(500).render("partials/error", {
                message: result.value.message,
                layout: false,
            });
        }
    }

    async getMyRSVPs(res: Response, session: IAppBrowserSession): Promise<void> {
        if (!session.authenticatedUser) {
            res.status(401).render("partials/error", {
                message: "You must be logged in to view your RSVPs.",
                layout: false,
            });
            return;
        }

        const actor = {
            id: session.authenticatedUser.userId,
            email: session.authenticatedUser.email,
            displayName: session.authenticatedUser.displayName,
            role: session.authenticatedUser.role,
        };

        const result = await this.rsvpService.getMyRSVPs(actor);

        if (result.ok) {
            res.status(200).render("partials/rsvp/my-rsvps", {
                rsvps: result.value,
                layout: false,
            });
        } else {
            this.logger.error(`getMyRSVPs failed for user ${session.authenticatedUser.userId}: ${result.value.message}`);
            res.status(500).render("partials/error", {
                message: result.value.message,
                layout: false,
            });
        }
    }
}

export function CreateRSVPController(rsvpService: IRSVPService, logger: ILoggingService): IRSVPController {
    return new RSVPController(rsvpService, logger);
}
