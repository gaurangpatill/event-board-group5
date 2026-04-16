import type { Response } from "express";
import type {Result} from "../lib/result"
import type { AppSessionStore, IAppBrowserSession } from "../session/AppSession";
import type { EventError } from "../lib/errors";
import type { IAuthenticatedUser } from "../auth/User";
import { getAuthenticatedUser, touchAppSession } from "../session/AppSession";
import { IEventService } from "../service/EventService";
import { ILoggingService } from "../service/LoggingService";
import { IEventRecord } from "../lib/event";

export interface IEventController {
  showDetail(
    res: Response,
    store: AppSessionStore,
    eventId: string,
  ): Promise<void>;
  publishFromForm(
    res: Response,
    store: AppSessionStore,
    eventId: string,
  ): Promise<void>;
  cancelFromForm(
    res: Response,
    store: AppSessionStore,
    eventId: string,
  ): Promise<void>;
}

function mapErrorStatus(error: EventError): number {
  if (error.name === "EventNotFound") return 404;
  if (error.name === "EventAuthorizationError") return 403;
  if (error.name === "InvalidEventState") return 400;
  if (error.name === "EventValidationError") return 400;
  return 500;
}

function toActor(store: AppSessionStore): IAuthenticatedUser | null {
  const sessionUser = getAuthenticatedUser(store);
  if (!sessionUser) return null;
  return {
    id: sessionUser.userId,
    email: sessionUser.email,
    displayName: sessionUser.displayName,
    role: sessionUser.role,
  };

  
}

class EventController implements IEventController {
  constructor(
    private readonly eventService: IEventService,
    private readonly logger: ILoggingService,
  ) {}

  private renderDetail(
    res: Response,
    session: IAppBrowserSession,
    event: IEventRecord | null,
    pageError: string | null = null,
  ): void {
    res.render("events/detail", { session, event, pageError });
  }

  async showDetail(
    res: Response,
    store: AppSessionStore,
    eventId: string,
  ): Promise<void> {
    const actor = toActor(store);
    if (!actor) {
      res.redirect("/login");
      return;
    }
    const session = touchAppSession(store);
    const result: Result<IEventRecord, EventError>  = await this.eventService.getEvent(actor, eventId);

    if (!result.ok) {
      const error = result.value as EventError;
      const status = mapErrorStatus(error);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `showDetail failed: ${error.message}`);
      res.status(status);
      this.renderDetail(res, session, null, error.message);
      return;
    }

    this.logger.info(`GET /events/${eventId} by ${actor.email}`);
    this.renderDetail(res, session, result.value);
  }


  async publishFromForm(
    res: Response,
    store: AppSessionStore,
    eventId: string,
  ): Promise<void> {
    const actor = toActor(store);
    if (!actor) {
      res.redirect("/login");
      return;
    }
    const session = touchAppSession(store);
    const result = await this.eventService.publishEvent(actor, eventId);

    if (!result.ok) {
      const error = result.value as EventError;
      const status = mapErrorStatus(error);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `publishFromForm failed: ${error.message}`);
      // fetching the event again so the page re-renders with current data
      const eventResult = await this.eventService.getEvent(actor, eventId);
      res.status(status);
      this.renderDetail(
        res,
        session,
        eventResult.ok ? eventResult.value : null,
        error.message,
      );
      return;
    }

    this.logger.info(`Published event ${eventId} by ${actor.email}`);
    res.redirect(`/events/${result.value.id}`);
  }


  async cancelFromForm(
    res: Response,
    store: AppSessionStore,
    eventId: string,
  ): Promise<void> {
    const actor = toActor(store);
    if (!actor) {
      res.redirect("/login");
      return;
    }
    const session = touchAppSession(store);
    const result = await this.eventService.cancelEvent(actor, eventId);

    if (!result.ok) {
      const error = result.value as EventError;
      const status = mapErrorStatus(error);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `cancelFromForm failed: ${error.message}`);
            // fetching the event again so the page re-renders with current data
      const eventResult = await this.eventService.getEvent(actor, eventId);
      res.status(status);
      this.renderDetail(
        res,
        session,
        eventResult.ok ? eventResult.value : null,
        error.message,
      );
      return;
    }

    this.logger.info(`Cancelled event ${eventId} by ${actor.email}`);
    res.redirect(`/events/${result.value.id}`);
  }
}

export function CreateEventController(
  eventService: IEventService,
  logger: ILoggingService,
): IEventController {
  return new EventController(eventService, logger);
}