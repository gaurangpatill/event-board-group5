// src/composition.ts

import { CreateAdminUserService } from "./auth/AdminUserService";
import { CreateAuthController } from "./auth/AuthController";
import { CreateAuthService } from "./auth/AuthService";
import { CreateInMemoryUserRepository } from "./auth/InMemoryUserRepository";
import { CreatePasswordHasher } from "./auth/PasswordHasher";
import { CreateApp } from "./app";
import type { IApp } from "./contracts";
import { CreateLoggingService } from "./service/LoggingService";
import type { ILoggingService } from "./service/LoggingService";

// ── F6 ───────────────────────────────────────────────────────────────────────
import { CreateInMemoryEventRepository } from "./repository/InMemoryEventRepository";
import { CreateEventService } from "./service/EventService";
import { CreateEventController } from "./controller/EventController";

export function createComposedApp(logger?: ILoggingService): IApp {
  const resolvedLogger = logger ?? CreateLoggingService();

  // Auth (existing — do not change)
  const authUsers = CreateInMemoryUserRepository();
  const passwordHasher = CreatePasswordHasher();
  const authService = CreateAuthService(authUsers, passwordHasher);
  const adminUserService = CreateAdminUserService(authUsers, passwordHasher);
  const authController = CreateAuthController(
    authService,
    adminUserService,
    resolvedLogger,
  );

  // F6: event listing
  const eventRepo = CreateInMemoryEventRepository();
  const eventService = CreateEventService(eventRepo);
  const eventController = CreateEventController(eventService, resolvedLogger);

  return CreateApp(authController, eventController, resolvedLogger);
}