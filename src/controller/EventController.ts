import type { Result } from "../lib/result";
import type { Request, Response } from "express";
import {
  getAuthenticatedUser,
  recordPageView,
  touchAppSession,
  type AppSessionStore,
  type IAppBrowserSession,
} from "../session/AppSession";
import type { EventError } from "../lib/errors";
import type { IAuthenticatedUser } from "../auth/User";
import type { EventCategory, IEventRecord } from "../lib/event";
import type { ILoggingService } from "../service/LoggingService";
import type {
  CreateEventInput,
  IEventService,
  UpdateEventInput,
} from "../service/EventService";

export interface EventFormValues {
  title: string;
  description: string;
  location: string;
  category: string;
  startDateTime: string;
  endDateTime: string;
  maxCapacity: string;
}

export interface IEventController {
  showEventList(req: Request, res: Response): Promise<void>;
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
  showCreateForm(
    res: Response,
    session: IAppBrowserSession,
    pageError?: string | null,
    values?: EventFormValues,
  ): Promise<void>;

  createEventFromForm(
    res: Response,
    actor: IAuthenticatedUser,
    session: IAppBrowserSession,
    values: EventFormValues,
  ): Promise<void>;

  showEditForm(
    res: Response,
    actor: IAuthenticatedUser,
    session: IAppBrowserSession,
    eventId: string,
    pageError?: string | null,
    values?: EventFormValues,
  ): Promise<void>;

  updateEventFromForm(
    res: Response,
    actor: IAuthenticatedUser,
    session: IAppBrowserSession,
    eventId: string,
    values: EventFormValues,
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

  async showCreateForm(
    res: Response,
    session: IAppBrowserSession,
    pageError: string | null = null,
    values: EventFormValues = emptyFormValues(),
  ): Promise<void> {
    res.render("events/new", {
      session,
      pageError,
      values,
    });
  }

  async showEventList(req: Request, res: Response): Promise<void> {
    const store = req.session as AppSessionStore;
    const session = recordPageView(store);
    const actor = toActor(store);
    if (!actor) {
      res.redirect("/login");
      return;
    }

    const category =
      typeof req.query.category === "string" ? req.query.category : undefined;
    const timeframe =
      typeof req.query.timeframe === "string" ? req.query.timeframe : undefined;
    const query = typeof req.query.q === "string" ? req.query.q : undefined;

    const result = await this.eventService.listEvents(actor, {
      category,
      timeframe,
      searchQuery: query,
    });

    if (result.ok === false) {
      const status = mapErrorStatus(result.value);
      this.logger.warn(`showEventList failed: ${result.value.message}`);
      res.status(status);

      if (req.get("HX-Request") === "true") {
        res.render("partials/event-list", {
          events: [],
          category,
          timeframe,
          pageError: result.value.message,
          layout: false,
        });
        return;
      }

      res.render("list", {
        session,
        events: [],
        category,
        timeframe,
        q: query,
        pageError: result.value.message,
      });
      return;
    }

    if (req.get("HX-Request") === "true") {
      res.render("partials/event-list", {
        events: result.value,
        category,
        timeframe,
        layout: false,
      });
      return;
    }

    res.render("list", {
      session,
      events: result.value,
      category,
      timeframe,
      q: query,
      pageError: null,
    });
  }

  async createEventFromForm(
    res: Response,
    actor: IAuthenticatedUser,
    session: IAppBrowserSession,
    values: EventFormValues,
  ): Promise<void> {
    const input = this.toCreateEventInput(values);
    const result = await this.eventService.createEvent(actor, input);

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value.name);
      this.logger.warn(`Create event failed: ${result.value.message}`);
      res.status(status);
      if (res.req?.get("HX-Request") === "true") {
        res.render("partials/event-create-form", {
          values,
          pageError: result.value.message,
          layout: false,
        });
        return;
      }
      await this.showCreateForm(res, session, result.value.message, values);
      return;
    }

    if (res.req?.get("HX-Request") === "true") {
      res.render("partials/event-create-success", {
        event: result.value,
        layout: false,
      });
      return;
    }

    res.redirect(`/events/${result.value.id}`);
  }

  async showEditForm(
    res: Response,
    actor: IAuthenticatedUser,
    session: IAppBrowserSession,
    eventId: string,
    pageError: string | null = null,
    values?: EventFormValues,
  ): Promise<void> {
    const result = await this.eventService.getEventForEdit(actor, eventId);

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value.name);
      this.logger.warn(`Load edit event failed: ${result.value.message}`);
      res.status(status).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    res.render("events/edit", {
      session,
      pageError,
      event: result.value,
      values: values ?? this.toFormValues(result.value),
    });
  }

  async updateEventFromForm(
    res: Response,
    actor: IAuthenticatedUser,
    session: IAppBrowserSession,
    eventId: string,
    values: EventFormValues,
  ): Promise<void> {
    const input = this.toUpdateEventInput(values);
    const result = await this.eventService.updateEvent(actor, eventId, input);

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value.name);
      this.logger.warn(`Update event failed: ${result.value.message}`);
      res.status(status);
      if (res.req?.get("HX-Request") === "true") {
        const eventResult = await this.eventService.getEventForEdit(actor, eventId);
        if (eventResult.ok === false) {
          res.render("partials/error", {
            message: eventResult.value.message,
            layout: false,
          });
          return;
        }

        res.render("partials/event-edit-form", {
          event: eventResult.value,
          values,
          pageError: result.value.message,
          layout: false,
        });
        return;
      }
      await this.showEditForm(
        res,
        actor,
        session,
        eventId,
        result.value.message,
        values,
      );
      return;
    }

    if (res.req?.get("HX-Request") === "true") {
      res.render("partials/event-edit-success", {
        event: result.value,
        layout: false,
      });
      return;
    }

    res.redirect(`/events/${result.value.id}/edit`);
  }

  private toCreateEventInput(values: EventFormValues): CreateEventInput {
    return {
      title: values.title,
      description: values.description,
      location: values.location,
      category: values.category as EventCategory,
      startDateTime: new Date(values.startDateTime),
      endDateTime: new Date(values.endDateTime),
      maxCapacity: values.maxCapacity.trim() === "" ? null : Number(values.maxCapacity),
    };
  }

  private toUpdateEventInput(values: EventFormValues): UpdateEventInput {
    return {
      title: values.title,
      description: values.description,
      location: values.location,
      category: values.category as EventCategory,
      startDateTime: new Date(values.startDateTime),
      endDateTime: new Date(values.endDateTime),
      maxCapacity: values.maxCapacity.trim() === "" ? null : Number(values.maxCapacity),
    };
  }

  private toFormValues(event: IEventRecord): EventFormValues {
    return {
      title: event.title,
      description: event.description,
      location: event.location,
      category: event.category,
      startDateTime: toDateTimeLocalValue(event.startDateTime),
      endDateTime: toDateTimeLocalValue(event.endDateTime),
      maxCapacity: event.maxCapacity === null ? "" : String(event.maxCapacity),
    };
  }

  private mapErrorStatus(errorName: string): number {
    if (errorName === "EventValidationError") return 400;
    if (errorName === "EventAuthorizationError") return 403;
    if (errorName === "EventNotFound") return 404;
    if (errorName === "InvalidEventState") return 409;
    return 500;
  }

  private renderDetail(
    res: Response,
    session: IAppBrowserSession,
    event: IEventRecord | null,
    pageError: string | null = null,
  ): void {
    res.render("events/detail", { session, event, pageError });
  }

  private async renderOrganizerDashboard(
    res: Response,
    actor: IAuthenticatedUser,
    session: IAppBrowserSession,
    status = 200,
  ): Promise<void> {
    const dashboardResult = await this.eventService.getOrganizerDashboard(actor);
    if (dashboardResult.ok === false) {
      res.status(500).render("partials/error", {
        message: dashboardResult.value.message,
        layout: false,
      });
      return;
    }

    res.status(status).render("partials/dashboard-table", {
      dashboard: dashboardResult.value,
      session,
      layout: false,
    });
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
    if (res.req?.get("HX-Request") === "true") {
      await this.renderOrganizerDashboard(res, actor, session);
      return;
    }
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
    if (res.req?.get("HX-Request") === "true") {
      await this.renderOrganizerDashboard(res, actor, session);
      return;
    }
    res.redirect(`/events/${result.value.id}`);
  }
}

function emptyFormValues(): EventFormValues {
  return {
    title: "",
    description: "",
    location: "",
    category: "academic",
    startDateTime: "",
    endDateTime: "",
    maxCapacity: "",
  };
}

function toDateTimeLocalValue(date: Date): string {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
}

export function CreateEventController(
  eventService: IEventService,
  logger: ILoggingService,
): IEventController {
  return new EventController(eventService, logger);
}
