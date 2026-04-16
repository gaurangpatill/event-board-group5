// src/controller/RSVPController.ts
// HTTP layer for Feature 7: My RSVPs Dashboard (GET /dashboard/rsvps).
// Branch: feature-7-controller

import type { Request, Response } from "express";
import type { IRSVPService } from "../service/iRsvpService";
import type { ILoggingService } from "../service/LoggingService";
import {
  getAuthenticatedUser,
  recordPageView,
  type AppSessionStore,
} from "../session/AppSession";

export interface IRSVPController {
  /** GET /dashboard/rsvps — My RSVPs dashboard for members */
  showMyRSVPs(req: Request, res: Response): Promise<void>;
}

class RSVPController implements IRSVPController {
  constructor(
    private readonly rsvpService: IRSVPService,
    private readonly logger: ILoggingService,
  ) {}

  async showMyRSVPs(req: Request, res: Response): Promise<void> {
    const store = req.session as AppSessionStore;
    const session = recordPageView(store);
    const actor = getAuthenticatedUser(store);

    if (!actor) {
      res.redirect("/login");
      return;
    }

    this.logger.info(`GET /dashboard/rsvps  actor=${actor.email}`);

    const authenticatedActor = {
      id: actor.userId,
      email: actor.email,
      displayName: actor.displayName,
      role: actor.role,
    };

    const result = await this.rsvpService.getMyRSVPs(authenticatedActor);

    if (!result.ok) {
      this.logger.warn(`getMyRSVPs error: ${result.value.message}`);
      const statusCode =
        result.value.name === "RSVPAuthorizationError" ? 403 : 500;
      res.status(statusCode).render("dashboard/rsvps", {
        session,
        rsvps: [],
        pageError: result.value.message,
      });
      return;
    }

    res.render("dashboard/rsvps", {
      session,
      rsvps: result.value,
      pageError: null,
    });
  }
}

export function CreateRSVPController(
  rsvpService: IRSVPService,
  logger: ILoggingService,
): IRSVPController {
  return new RSVPController(rsvpService, logger);
}