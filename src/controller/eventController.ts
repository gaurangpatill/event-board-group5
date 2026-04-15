// src/controller/EventController.ts

import type { Request, Response } from "express";
import type { IEventService } from "../service/IEventService";
import type { ILoggingService } from "../service/LoggingService";
import {
  getAuthenticatedUser,
  recordPageView,
  type AppSessionStore,
} from "../session/AppSession";

export interface IEventController {
  showEventList(req: Request, res: Response): Promise<void>;
}

class EventController implements IEventController {
  constructor(
    private readonly eventService: IEventService,
    private readonly logger: ILoggingService,
  ) {}

  async showEventList(req: Request, res: Response): Promise<void> {
    const store = req.session as AppSessionStore;
    const session = recordPageView(store);
    const actor = getAuthenticatedUser(store);

    if (!actor) {
      res.redirect("/login");
      return;
    }

    const category =
      typeof req.query.category === "string" ? req.query.category.trim() : "";
    const timeframe =
      typeof req.query.timeframe === "string" ? req.query.timeframe.trim() : "";

    this.logger.info(
      `GET /events  actor=${actor.email}  category=${category || "(none)"}  timeframe=${timeframe || "(none)"}`,
    );

    const authenticatedActor = {
      id: actor.userId,
      email: actor.email,
      displayName: actor.displayName,
      role: actor.role,
    };

    const result = await this.eventService.listEvents(authenticatedActor, {
      category: category || undefined,
      timeframe: timeframe || undefined,
    });

    if (!result.ok) {
      this.logger.warn(`listEvents error: ${result.value.message}`);
      const statusCode =
        result.value.name === "EventValidationError" ? 400 : 500;

      // HTMX requests get a lightweight partial error instead of a full page
      if (req.get("HX-Request") === "true") {
        res.status(statusCode).render("partials/error", {
          message: result.value.message,
          layout: false,
        });
        return;
      }

      res.status(statusCode).render("events/list", {
        session,
        events: [],
        category,
        timeframe,
        pageError: result.value.message,
      });
      return;
    }

    // HTMX: swap only the event list partial, not the whole page
    if (req.get("HX-Request") === "true") {
      res.render("events/partials/event-list", {
        events: result.value,
        category,
        timeframe,
        layout: false,
      });
      return;
    }

    // Full page render for normal browser requests
    res.render("events/list", {
      session,
      events: result.value,
      category,
      timeframe,
      pageError: null,
    });
  }
}

export function CreateEventController(
  eventService: IEventService,
  logger: ILoggingService,
): IEventController {
  return new EventController(eventService, logger);
}