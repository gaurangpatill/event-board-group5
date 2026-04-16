import type { Response } from "express";
import type { IAuthenticatedUser } from "../auth/User";
import type { EventCategory, IEventRecord } from "../lib/event";
import type { IAppBrowserSession } from "../session/AppSession";
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

  async createEventFromForm(
    res: Response,
    actor: IAuthenticatedUser,
    session: IAppBrowserSession,
    values: EventFormValues,
  ): Promise<void> {
    const input = this.toCreateEventInput(values);
    const result = await this.eventService.createEvent(actor, input);

    if (!result.ok) {
      const status = this.mapErrorStatus(result.value.name);
      this.logger.warn(`Create event failed: ${result.value.message}`);
      res.status(status);
      await this.showCreateForm(res, session, result.value.message, values);
      return;
    }

    res.redirect("/home");
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

    if (!result.ok) {
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

    if (!result.ok) {
      const status = this.mapErrorStatus(result.value.name);
      this.logger.warn(`Update event failed: ${result.value.message}`);
      res.status(status);
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