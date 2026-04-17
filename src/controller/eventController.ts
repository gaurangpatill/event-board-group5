import type { Request, Response } from "express";
import type { IAuthenticatedUser } from "../auth/User";
import type { EventCategory } from "../lib/event";
import type { EventError } from "../lib/errors";
import type {
  CreateEventInput,
  IEventService,
  UpdateEventInput,
} from "../service/EventService";
import type { ILoggingService } from "../service/LoggingService";
import {
  getAuthenticatedUser,
  recordPageView,
  type AppSessionStore,
  type IAppBrowserSession,
} from "../session/AppSession";

interface EventFormValues {
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
  showCreateForm(
    res: Response,
    session: IAppBrowserSession,
    pageError?: string | null,
    values?: Partial<EventFormValues>,
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
    values?: Partial<EventFormValues>,
  ): Promise<void>;
  updateEventFromForm(
    res: Response,
    actor: IAuthenticatedUser,
    session: IAppBrowserSession,
    eventId: string,
    values: EventFormValues,
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

class EventController implements IEventController {
  constructor(
    private readonly eventService: IEventService,
    private readonly logger: ILoggingService,
  ) {}

  async showEventList(req: Request, res: Response): Promise<void> {
    const store = req.session as AppSessionStore;
    const session = recordPageView(store);
    const actorSession = getAuthenticatedUser(store);

    if (!actorSession) {
      res.redirect("/login");
      return;
    }

    const actor = this.toActor(actorSession);
    const category =
      typeof req.query.category === "string" ? req.query.category.trim() : "";
    const timeframe =
      typeof req.query.timeframe === "string" ? req.query.timeframe.trim() : "";

    this.logger.info(
      `GET /events actor=${actor.email} category=${category || "(none)"} timeframe=${timeframe || "(none)"}`,
    );

    const result = await this.eventService.listEvents(actor, {
      category: category || undefined,
      timeframe: timeframe || undefined,
    });

    if (result.ok === false) {
      const statusCode = this.errorStatus(result.value);
      this.logger.warn(`listEvents error: ${result.value.message}`);

      if (req.get("HX-Request") === "true") {
        res.status(statusCode).render("partials/error", {
          message: result.value.message,
          layout: false,
        });
        return;
      }

      res.status(statusCode).render("list", {
        session,
        events: [],
        category,
        timeframe,
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
      pageError: null,
    });
  }

  async showDetail(
    res: Response,
    store: AppSessionStore,
    eventId: string,
  ): Promise<void> {
    const session = recordPageView(store);
    const actorSession = getAuthenticatedUser(store);

    if (!actorSession) {
      res.redirect("/login");
      return;
    }

    const actor = this.toActor(actorSession);
    const result = await this.eventService.getEvent(actor, eventId);

    if (result.ok === false) {
      const statusCode = this.errorStatus(result.value);
      this.logger.warn(`showDetail error for ${eventId}: ${result.value.message}`);
      res.status(statusCode).render("events/detail", {
        session,
        event: null,
        pageError: result.value.message,
      });
      return;
    }

    res.render("events/detail", {
      session,
      event: result.value,
      pageError: null,
    });
  }

  async showCreateForm(
    res: Response,
    session: IAppBrowserSession,
    pageError: string | null = null,
    values: Partial<EventFormValues> = {},
  ): Promise<void> {
    res.render("events/new", {
      session,
      pageError,
      values: this.formDefaults(values),
    });
  }

  async createEventFromForm(
    res: Response,
    actor: IAuthenticatedUser,
    session: IAppBrowserSession,
    values: EventFormValues,
  ): Promise<void> {
    const parsed = this.parseCreateForm(values);
    if (parsed.ok === false) {
      res.status(400);
      await this.showCreateForm(res, session, parsed.value, values);
      return;
    }

    const result = await this.eventService.createEvent(actor, parsed.value);
    if (result.ok === false) {
      const statusCode = this.errorStatus(result.value);
      this.logger.warn(`createEvent error: ${result.value.message}`);
      res.status(statusCode);
      await this.showCreateForm(res, session, result.value.message, values);
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
    values: Partial<EventFormValues> = {},
  ): Promise<void> {
    const result = await this.eventService.getEventForEdit(actor, eventId);
    if (result.ok === false) {
      const statusCode = this.errorStatus(result.value);
      this.logger.warn(`showEditForm error for ${eventId}: ${result.value.message}`);
      res.status(statusCode).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    res.render("events/edit", {
      session,
      event: result.value,
      pageError,
      values: this.formDefaults({
        title: result.value.title,
        description: result.value.description,
        location: result.value.location,
        category: result.value.category,
        startDateTime: this.toDateTimeLocalValue(result.value.startDateTime),
        endDateTime: this.toDateTimeLocalValue(result.value.endDateTime),
        maxCapacity:
          result.value.maxCapacity === null ? "" : String(result.value.maxCapacity),
        ...values,
      }),
    });
  }

  async updateEventFromForm(
    res: Response,
    actor: IAuthenticatedUser,
    session: IAppBrowserSession,
    eventId: string,
    values: EventFormValues,
  ): Promise<void> {
    const parsed = this.parseUpdateForm(values);
    if (parsed.ok === false) {
      res.status(400);
      await this.showEditForm(res, actor, session, eventId, parsed.value, values);
      return;
    }

    const result = await this.eventService.updateEvent(actor, eventId, parsed.value);
    if (result.ok === false) {
      const statusCode = this.errorStatus(result.value);
      this.logger.warn(`updateEvent error for ${eventId}: ${result.value.message}`);
      res.status(statusCode);
      await this.showEditForm(res, actor, session, eventId, result.value.message, values);
      return;
    }

    res.redirect(`/events/${eventId}`);
  }

  async publishFromForm(
    res: Response,
    store: AppSessionStore,
    eventId: string,
  ): Promise<void> {
    const actorSession = getAuthenticatedUser(store);
    if (!actorSession) {
      res.redirect("/login");
      return;
    }

    const actor = this.toActor(actorSession);
    const result = await this.eventService.publishEvent(actor, eventId);
    if (result.ok === false) {
      const statusCode = this.errorStatus(result.value);
      this.logger.warn(`publishEvent error for ${eventId}: ${result.value.message}`);
      res.status(statusCode).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    res.redirect(`/events/${eventId}`);
  }

  async cancelFromForm(
    res: Response,
    store: AppSessionStore,
    eventId: string,
  ): Promise<void> {
    const actorSession = getAuthenticatedUser(store);
    if (!actorSession) {
      res.redirect("/login");
      return;
    }

    const actor = this.toActor(actorSession);
    const result = await this.eventService.cancelEvent(actor, eventId);
    if (result.ok === false) {
      const statusCode = this.errorStatus(result.value);
      this.logger.warn(`cancelEvent error for ${eventId}: ${result.value.message}`);
      res.status(statusCode).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    res.redirect(`/events/${eventId}`);
  }

  private toActor(user: NonNullable<ReturnType<typeof getAuthenticatedUser>>): IAuthenticatedUser {
    return {
      id: user.userId,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  }

  private errorStatus(error: EventError): number {
    if (error.name === "EventValidationError") return 400;
    if (error.name === "EventAuthorizationError") return 403;
    if (error.name === "EventNotFound") return 404;
    if (error.name === "InvalidEventState") return 409;
    return 500;
  }

  private formDefaults(values: Partial<EventFormValues>): EventFormValues {
    return {
      title: values.title ?? "",
      description: values.description ?? "",
      location: values.location ?? "",
      category: values.category ?? "academic",
      startDateTime: values.startDateTime ?? "",
      endDateTime: values.endDateTime ?? "",
      maxCapacity: values.maxCapacity ?? "",
    };
  }

  private parseCreateForm(values: EventFormValues) {
    return this.parseEventInput(values);
  }

  private parseUpdateForm(values: EventFormValues) {
    return this.parseEventInput(values) as
      | { ok: true; value: UpdateEventInput }
      | { ok: false; value: string };
  }

  private parseEventInput(values: EventFormValues):
    | { ok: true; value: CreateEventInput }
    | { ok: false; value: string } {
    const startDateTime = new Date(values.startDateTime);
    const endDateTime = new Date(values.endDateTime);

    if (
      Number.isNaN(startDateTime.getTime()) ||
      Number.isNaN(endDateTime.getTime())
    ) {
      return { ok: false, value: "Start and end times must be valid dates." };
    }

    let maxCapacity: number | null = null;
    if (values.maxCapacity.trim() !== "") {
      const parsedMax = Number(values.maxCapacity);
      if (!Number.isInteger(parsedMax) || parsedMax <= 0) {
        return {
          ok: false,
          value: "Max capacity must be a positive whole number.",
        };
      }
      maxCapacity = parsedMax;
    }

    return {
      ok: true,
      value: {
        title: values.title,
        description: values.description,
        location: values.location,
        category: values.category as EventCategory,
        startDateTime,
        endDateTime,
        maxCapacity,
      },
    };
  }

  private toDateTimeLocalValue(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, "0");
    const day = `${value.getDate()}`.padStart(2, "0");
    const hours = `${value.getHours()}`.padStart(2, "0");
    const minutes = `${value.getMinutes()}`.padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
}

export function CreateEventController(
  eventService: IEventService,
  logger: ILoggingService,
): IEventController {
  return new EventController(eventService, logger);
}
