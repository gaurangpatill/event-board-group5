import type { Request, Response } from "express";
import type { IAuthenticatedUser } from "../auth/User";
import type { ILoggingService } from "../service/LoggingService";
import type { IRSVPService, RSVPWithEvent } from "../service/iRsvpService";
import {
  getAuthenticatedUser,
  recordPageView,
  type AppSessionStore,
  type IAppBrowserSession,
} from "../session/AppSession";

export interface IRSVPController {
  toggleRSVP(
    res: Response,
    eventId: string,
    session: IAppBrowserSession,
    isHtmx: boolean,
  ): Promise<void>;
  getWaitlistPosition(
    res: Response,
    eventId: string,
    session: IAppBrowserSession,
    isHtmx: boolean,
  ): Promise<void>;
  showMyRSVPs(req: Request, res: Response): Promise<void>;
}

export class RSVPController implements IRSVPController {
  constructor(
    private readonly rsvpService: IRSVPService,
    private readonly logger: ILoggingService,
  ) {}

  async toggleRSVP(
    res: Response,
    eventId: string,
    session: IAppBrowserSession,
    isHtmx: boolean,
  ): Promise<void> {
    if (!session.authenticatedUser) {
      res.status(401).render("partials/error", {
        message: "You must be logged in to RSVP.",
        layout: false,
      });
      return;
    }

    const actor = this.toActor(session);
    const result = await this.rsvpService.toggleRSVP(actor, eventId);

    if (result.ok === false) {
      this.logger.error(
        `toggleRSVP failed for event ${eventId} and user ${actor.id}: ${result.value.message}`,
      );
      res.status(500).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    if (!isHtmx) {
      res.redirect(`/events/${eventId}`);
      return;
    }

    const myRsvpsResult = await this.rsvpService.getMyRSVPs(actor);
    if (myRsvpsResult.ok === false) {
      res.redirect(`/events/${eventId}`);
      return;
    }

    const item = myRsvpsResult.value.find((entry) => entry.event.id === eventId);
    if (!item) {
      res.redirect(`/events/${eventId}`);
      return;
    }

    res.status(200).render("partials/rsvp-card", {
      item,
      statusColor: this.statusColor(item),
      layout: false,
    });
  }

  async getWaitlistPosition(
    res: Response,
    eventId: string,
    session: IAppBrowserSession,
    isHtmx: boolean,
  ): Promise<void> {
    if (!session.authenticatedUser) {
      res.status(401).render("partials/error", {
        message: "You must be logged in to view your waitlist position.",
        layout: false,
      });
      return;
    }

    const actor = this.toActor(session);
    const result = await this.rsvpService.getWaitlistPosition(actor, eventId);

    if (result.ok === false) {
      this.logger.error(
        `getWaitlistPosition failed for event ${eventId} and user ${actor.id}: ${result.value.message}`,
      );
      res.status(500).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    if (isHtmx) {
      res.status(200).render("partials/waitlist-position", {
        eventId,
        position: result.value,
        layout: false,
      });
      return;
    }

    res.redirect(`/events/${eventId}`);
  }

  async showMyRSVPs(req: Request, res: Response): Promise<void> {
    const store = req.session as AppSessionStore;
    const session = recordPageView(store);

    if (!session.authenticatedUser) {
      res.redirect("/login");
      return;
    }

    const actor = this.toActor(session);
    const result = await this.rsvpService.getMyRSVPs(actor);

    if (result.ok === false) {
      const statusCode =
        result.value.name === "RSVPAuthorizationError" ? 403 : 500;
      this.logger.warn(`getMyRSVPs error: ${result.value.message}`);
      res.status(statusCode).render("rsvps", {
        session,
        rsvps: [] as RSVPWithEvent[],
        pageError: result.value.message,
      });
      return;
    }

    res.render("rsvps", {
      session,
      rsvps: result.value,
      pageError: null,
    });
  }

  private toActor(session: IAppBrowserSession): IAuthenticatedUser {
    return {
      id: session.authenticatedUser!.userId,
      email: session.authenticatedUser!.email,
      displayName: session.authenticatedUser!.displayName,
      role: session.authenticatedUser!.role,
    };
  }

  private statusColor(item: RSVPWithEvent): "green" | "yellow" | "slate" {
    if (item.rsvp.status === "going") return "green";
    if (item.rsvp.status === "waitlisted") return "yellow";
    return "slate";
  }
}

export function CreateRSVPController(
  rsvpService: IRSVPService,
  logger: ILoggingService,
): IRSVPController {
  return new RSVPController(rsvpService, logger);
}
