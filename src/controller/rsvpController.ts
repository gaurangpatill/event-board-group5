import type { Response } from "express";
import type { IAppBrowserSession } from "../session/AppSession";
import type { ILoggingService } from "../service/LoggingService";
import type { IRSVPService } from "../service/rsvpService";

export interface IRSVPController {
    toggleRSVP(res: Response, eventId: string, session: IAppBrowserSession, isHtmx: boolean): Promise<void>;
    getWaitlistPosition(res: Response, eventId: string, session: IAppBrowserSession, isHtmx: boolean): Promise<void>;
    getMyRSVPs(res: Response, session: IAppBrowserSession): Promise<void>;
}
