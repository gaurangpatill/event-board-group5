import { CreateAdminUserService } from "./auth/AdminUserService";
import { CreateAuthController } from "./auth/AuthController";
import { CreateAuthService } from "./auth/AuthService";
import { CreateInMemoryUserRepository } from "./auth/InMemoryUserRepository";
import { CreatePasswordHasher } from "./auth/PasswordHasher";
import { CreateApp } from "./app";
import type { IApp } from "./contracts";
import { CreateEventController } from "./controller/EventController";
import { CreateRSVPController } from "./controller/rsvpController";
import { CreateInMemoryEventRepository } from "./repository/InMemoryEventRepository";
import { CreateInMemoryRSVPRepository } from "./repository/InMemoryRSVPRepository";
import { CreateEventService } from "./service/EventService";
import type { ILoggingService } from "./service/LoggingService";
import { CreateLoggingService } from "./service/LoggingService";
import { CreateRSVPService } from "./service/rsvpService";

export function createComposedApp(logger?: ILoggingService): IApp {
  const resolvedLogger = logger ?? CreateLoggingService();

  const authUsers = CreateInMemoryUserRepository();
  const passwordHasher = CreatePasswordHasher();
  const authService = CreateAuthService(authUsers, passwordHasher);
  const adminUserService = CreateAdminUserService(authUsers, passwordHasher);
  const authController = CreateAuthController(
    authService,
    adminUserService,
    resolvedLogger,
  );

  const eventRepo = CreateInMemoryEventRepository();
  const rsvpRepo = CreateInMemoryRSVPRepository();

  const eventService = CreateEventService(eventRepo, rsvpRepo);
  const eventController = CreateEventController(eventService, resolvedLogger);

  const rsvpService = CreateRSVPService(rsvpRepo, eventRepo, resolvedLogger);
  const rsvpController = CreateRSVPController(rsvpService, resolvedLogger);

  return CreateApp(
    authController,
    rsvpController,
    eventController,
    resolvedLogger,
    eventService,
  );
}
