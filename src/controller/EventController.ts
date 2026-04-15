import type { Response } from "express";
import type { AppSessionStore, IAppBrowserSession } from "../session/AppSession";

export interface IEventController {
  showDetail(
    res: Response,
    store: AppSessionStore,
    eventId: string,
  ): Promise<void>;
}