// src/controller/EventController.ts

import type { Request, Response } from "express";
import type { IEventService } from "../service/IEventService";
import type { ILoggingService } from "../service/LoggingService";

export interface IEventController {
  showEventList(req: Request, res: Response): Promise<void>;
}

class EventController implements IEventController {
  constructor(
    private readonly eventService: IEventService,
    private readonly logger: ILoggingService,
  ) {}

  async showEventList(req: Request, res: Response): Promise<void> {
    throw new Error("Not implemented yet");
  }
}

export function CreateEventController(
  eventService: IEventService,
  logger: ILoggingService,
): IEventController {
  return new EventController(eventService, logger);
}