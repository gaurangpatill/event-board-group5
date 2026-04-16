// src/composition.ts
// Dependency wiring — creates every concrete object and hands them to CreateApp.
// Feature 6 and Feature 7 additions are marked with ── F6 ── and ── F7 ──.
// Merge note: if teammates have also edited this file, add their wiring blocks
// alongside yours — the sections do not overlap.

import { CreateAdminUserService } from "./auth/AdminUserService";
import { CreateAuthController } from "./auth/AuthController";
import { CreateAuthService } from "./auth/AuthService";
import { CreateInMemoryUserRepository } from "./auth/InMemoryUserRepository";
import { CreatePasswordHasher } from "./auth/PasswordHasher";
import { CreateApp } from "./app";
import type { IApp } from "./contracts";
import { CreateLoggingService } from "./service/LoggingService";
import type { ILoggingService } from "./service/LoggingService";
import { CreateInMemoryEventRepository } from "./repository/InMemoryEventRepository";
import { CreateEventService } from "./service/EventService";
import { CreateEventController } from "./controller/EventController";
import { CreateInMemoryEventRepository } from "./repository/InMemoryEventRepository";
import { CreateEventService } from "./service/EventService";
import { CreateEventController } from "./controller/EventController";
import { CreateInMemoryRSVPRepository } from "./repository/MemoryRsvpRepo";
import { CreateRSVPService } from "./service/iRsvpService";
import { CreateRSVPController } from "./controller/rsvpcontroller6";

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
  const rsvpRepo = CreateInMemoryRSVPRepository(resolvedLogger);
  const rsvpService = CreateRSVPService(rsvpRepo, eventRepo, resolvedLogger);
  const rsvpController = CreateRSVPController(rsvpService, resolvedLogger);
  const authController = CreateAuthController(authService, adminUserService, resolvedLogger);
  const eventRepositoryInMemory = CreateInMemoryEventRepository();
  const eventService = CreateEventService(eventRepositoryInMemory)
  const eventController = CreateEventController(eventService, resolvedLogger)

  return CreateApp(authController, rsvpController, eventController, resolvedLogger);
}
