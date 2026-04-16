
import path from "node:path";
import express, { Request, RequestHandler, Response } from "express";
import session from "express-session";
import Layouts from "express-ejs-layouts";
import { IAuthController } from "./auth/AuthController";
import {
  AuthenticationRequired,
  AuthorizationRequired,
} from "./auth/errors";
import type { UserRole } from "./auth/User";
import { IApp } from "./contracts";
import {
  getAuthenticatedUser,
  isAuthenticatedSession,
  AppSessionStore,
  recordPageView,
  touchAppSession,
} from "./session/AppSession";
import { ILoggingService } from "./service/LoggingService";
import { IEventService } from "./service/EventService";
import type { IAuthenticatedUser } from "./auth/User";
import { IRSVPController } from "./controller/rsvpController";
import { IEventController } from "./controller/EventController";

type AsyncRequestHandler = RequestHandler;

function asyncHandler(fn: AsyncRequestHandler) {
  return function wrapped(
    req: Request,
    res: Response,
    next: (value?: unknown) => void,
  ) {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function sessionStore(req: Request): AppSessionStore {
  return req.session as AppSessionStore;
}

class ExpressApp implements IApp {
  private readonly app: express.Express;

  constructor(
    private readonly authController: IAuthController,
    private readonly rsvpController: IRSVPController,
    private readonly eventController: IEventController,
    private readonly logger: ILoggingService,
    private readonly eventService: IEventService,
  ) {
    this.app = express();
    this.registerMiddleware();
    this.registerTemplating();
    this.registerRoutes();
  }

  private registerMiddleware(): void {
    this.app.use(express.static(path.join(process.cwd(), "src/static")));
    this.app.use(
      session({
        name: "app.sid",
        secret: process.env.SESSION_SECRET ?? "project-starter-demo-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          sameSite: "lax",
        },
      }),
    );
    this.app.use(Layouts);
    this.app.use(express.urlencoded({ extended: true }));
  }

  private registerTemplating(): void {
    this.app.set("view engine", "ejs");
    this.app.set("views", path.join(process.cwd(), "src/views"));
    this.app.set("layout", "layouts/base");
  }

  private isHtmxRequest(req: Request): boolean {
    return req.get("HX-Request") === "true";
  }

  private requireAuthenticated(req: Request, res: Response): boolean {
    const store = sessionStore(req);
    touchAppSession(store);

    if (getAuthenticatedUser(store)) {
      return true;
    }

    this.logger.warn("Blocked unauthenticated request to a protected route");
    if (this.isHtmxRequest(req) || req.method !== "GET") {
      res.status(401).render("partials/error", {
        message: AuthenticationRequired("Please log in to continue.").message,
        layout: false,
      });
      return false;
    }

    res.redirect("/login");
    return false;
  }

  private requireRole(
    req: Request,
    res: Response,
    allowedRoles: UserRole[],
    message: string,
  ): boolean {
    if (!this.requireAuthenticated(req, res)) {
      return false;
    }

    const currentUser = getAuthenticatedUser(sessionStore(req));
    if (currentUser && allowedRoles.includes(currentUser.role)) {
      return true;
    }

    this.logger.warn(
      `Blocked unauthorized request for role ${currentUser?.role ?? "unknown"}`,
    );
    res.status(403).render("partials/error", {
      message: AuthorizationRequired(message).message,
      layout: false,
    });
    return false;
  }

  private currentActor(req: Request): IAuthenticatedUser | null {
    const currentUser = getAuthenticatedUser(sessionStore(req));
    if (!currentUser) {
      return null;
    }

    return {
      id: currentUser.userId,
      email: currentUser.email,
      displayName: currentUser.displayName,
      role: currentUser.role,
    };
  }

  private registerRoutes(): void {
    // ── Public routes ──────────────────────────────────────────────────────

    this.app.get(
      "/",
      asyncHandler(async (req, res) => {
        this.logger.info("GET /");
        const store = sessionStore(req);
        res.redirect(isAuthenticatedSession(store) ? "/home" : "/login");
      }),
    );

      this.app.get(
      "/events/:id",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) return;
        await this.eventController.showDetail(res, sessionStore(req), req.params.id as string);
      }),
    );

      this.app.post(
    "/events/:id/publish",
    asyncHandler(async (req, res) => {
      if (!this.requireAuthenticated(req, res)) return;
      await this.eventController.publishFromForm(res, sessionStore(req), req.params.id as string);
    }),
    );

      this.app.post(
        "/events/:id/cancel",
        asyncHandler(async (req, res) => {
          if (!this.requireAuthenticated(req, res)) return;
          await this.eventController.cancelFromForm(res, sessionStore(req), req.params.id as string);
        }),
      )

    this.app.get(
      "/login",
      asyncHandler(async (req, res) => {
        const store = sessionStore(req);
        const browserSession = recordPageView(store);

        if (getAuthenticatedUser(store)) {
          res.redirect("/home");
          return;
        }

        await this.authController.showLogin(res, browserSession);
      }),
    );

    this.app.post(
      "/login",
      asyncHandler(async (req, res) => {
        const email =
          typeof req.body.email === "string" ? req.body.email : "";
        const password =
          typeof req.body.password === "string" ? req.body.password : "";
        await this.authController.loginFromForm(
          res,
          email,
          password,
          sessionStore(req),
        );
      }),
    );

    this.app.post(
      "/logout",
      asyncHandler(async (req, res) => {
        await this.authController.logoutFromForm(res, sessionStore(req));
      }),
    );

    this.app.post(
      "/events/:id/rsvp",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) return;
        const session = recordPageView(sessionStore(req));
        const eventId = typeof req.params.id === "string" ? req.params.id : "";
        await this.rsvpController.toggleRSVP(res, eventId, session, this.isHtmxRequest(req));
      }),
    );

    this.app.get(
      "/events/:id/waitlist-position",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) return;
        const session = recordPageView(sessionStore(req));
        const eventId = typeof req.params.id === "string" ? req.params.id : "";
        await this.rsvpController.getWaitlistPosition(res, eventId, session, this.isHtmxRequest(req));
      }),
    );

    this.app.get(
      "/dashboard/rsvps",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) return;
        const session = recordPageView(sessionStore(req));
        await this.rsvpController.getMyRSVPs(res, session);
      }),
    );

    // ── Admin routes ─────────────────────────────────────────────────

    this.app.get(
      "/admin/users",
      asyncHandler(async (req, res) => {
        if (
          !this.requireRole(req, res, ["admin"], "Only Admin can manage users.")
        ) {
          return;
        }

        const browserSession = recordPageView(sessionStore(req));
        await this.authController.showAdminUsers(res, browserSession);
      }),
    );

    this.app.post(
      "/admin/users",
      asyncHandler(async (req, res) => {
        if (
          !this.requireRole(req, res, ["admin"], "Only Admin can manage users.")
        ) {
          return;
        }

        const roleValue =
          typeof req.body.role === "string" ? req.body.role : "user";
        const role: UserRole =
          roleValue === "admin" || roleValue === "staff" || roleValue === "user"
            ? roleValue
            : "user";

        await this.authController.createUserFromForm(
          res,
          {
            email: typeof req.body.email === "string" ? req.body.email : "",
            displayName:
              typeof req.body.displayName === "string"
                ? req.body.displayName
                : "",
            password:
              typeof req.body.password === "string" ? req.body.password : "",
            role,
          },
          touchAppSession(sessionStore(req)),
        );
      }),
    );

    this.app.post(
      "/admin/users/:id/delete",
      asyncHandler(async (req, res) => {
        if (
          !this.requireRole(req, res, ["admin"], "Only Admin can manage users.")
        ) {
          return;
        }

        const sess = touchAppSession(sessionStore(req));
        const currentUser = getAuthenticatedUser(sessionStore(req));
        if (!currentUser) {
          res.status(401).render("partials/error", {
            message: AuthenticationRequired(
              "Please log in to continue.",
            ).message,
            layout: false,
          });
          return;
        }

        await this.authController.deleteUserFromForm(
          res,
          typeof req.params.id === "string" ? req.params.id : "",
          currentUser.userId,
          sess,
        );
      }),
    );

    this.app.get(
      "/events/new",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["staff"], "Only organizers can create events.")) {
          return;
        }

        const browserSession = recordPageView(sessionStore(req));
        await this.eventController.showCreateForm(res, browserSession);
      }),
    );

    this.app.post(
      "/events",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["staff"], "Only organizers can create events.")) {
          return;
        }

        const actor = this.currentActor(req);
        if (!actor) {
          res.status(401).render("partials/error", {
            message: AuthenticationRequired("Please log in to continue.").message,
            layout: false,
          });
          return;
        }

        await this.eventController.createEventFromForm(
          res,
          actor,
          touchAppSession(sessionStore(req)),
          {
            title: typeof req.body.title === "string" ? req.body.title : "",
            description: typeof req.body.description === "string" ? req.body.description : "",
            location: typeof req.body.location === "string" ? req.body.location : "",
            category: typeof req.body.category === "string" ? req.body.category : "",
            startDateTime:
              typeof req.body.startDateTime === "string" ? req.body.startDateTime : "",
            endDateTime:
              typeof req.body.endDateTime === "string" ? req.body.endDateTime : "",
            maxCapacity:
              typeof req.body.maxCapacity === "string" ? req.body.maxCapacity : "",
          },
        );
      }),
    );
    // ── Authenticated home page ──────────────────────────────────────
    // TODO: Replace this placeholder with your project's main page.

    this.app.get(
      "/home",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) {
          return;
        }

        const browserSession = recordPageView(sessionStore(req));
        this.logger.info(`GET /home for ${browserSession.browserLabel}`);
        res.render("home", { session: browserSession, pageError: null });
      }),
    );
    
    // ── Organizer Dashboard ───────────────────────────────────────────
    this.app.get(
      "/dashboard/events",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["staff", "admin"], "Only organizers can access the event dashboard.")) {
          return;
        }
        const store = sessionStore(req);
        const browserSession = recordPageView(store);
        const actorSession = getAuthenticatedUser(store);
        if (!actorSession) return;
        const actor: IAuthenticatedUser = {
          id: actorSession.userId,
          email: actorSession.email,
          displayName: actorSession.displayName,
          role: actorSession.role,
        };
        const result = await this.eventService.getOrganizerDashboard(actor);
        if (!result.ok) {
          res.status(500).render("partials/error", {
            message: result.value.message,
            layout: false,
          });
          return;
        }
        const isHtmx = this.isHtmxRequest(req);
        if (isHtmx) {
          res.render("partials/dashboard-table", {
            dashboard: result.value,
            session: browserSession,
            layout: false,
          });
        } else {
          res.render("home", {
            dashboard: result.value,
            session: browserSession,
            pageError: null,
          });
        }
      })
    )

    // ── F6: Event listing with category & date filters ─────────────────────
    // Route: GET /events?category=&timeframe=
    // All authenticated roles may browse published events.

    this.app.get(
      "/events",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) {
          return;
        }
        await this.eventController.showEventList(req, res);
      }),
    );

    // ── F7: My RSVPs dashboard ─────────────────────────────────────────────
    // Route: GET /dashboard/rsvps
    // Only "user" role members may access this. Organizers/admins are
    // rejected inside the service (RSVPAuthorizationError → 403).

    this.app.get(
      "/dashboard/rsvps",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) {
          return;
        }
        await this.rsvpController.showMyRSVPs(req, res);
      }),
    );

    // ── Error handler ──────────────────────────────────────────────────────

    this.app.use(
      (
        err: unknown,
        _req: Request,
        res: Response,
        _next: (value?: unknown) => void,
      ) => {
        const message =
          err instanceof Error ? err.message : "Unexpected server error.";
        this.logger.error(message);
        res.status(500).render("partials/error", {
          message: "Unexpected server error.",
          layout: false,
        });
      },
    );
  }

  getExpressApp(): express.Express {
    return this.app;
  }
}

export function CreateApp(
  authController: IAuthController,
  rsvpController: IRSVPController,
  eventController: IEventController,
  logger: ILoggingService,
): IApp {
  return new ExpressApp(authController, rsvpController, eventController, logger);
}
