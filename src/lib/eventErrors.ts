export type EventError =
  | { name: "EventNotFound"; message: string }
  | { name: "EventValidationError"; message: string }
  | { name: "EventAuthorizationError"; message: string }
  | { name: "InvalidEventState"; message: string }
  | { name: "UnexpectedDependencyError"; message: string };

export const EventNotFound = (message: string): EventError => ({
  name: "EventNotFound",
  message,
});

export const EventValidationError = (message: string): EventError => ({
  name: "EventValidationError",
  message,
});

export const EventAuthorizationError = (message: string): EventError => ({
  name: "EventAuthorizationError",
  message,
});

export const InvalidEventState = (message: string): EventError => ({
  name: "InvalidEventState",
  message,
});

export const UnexpectedDependencyError = (message: string): EventError => ({
  name: "UnexpectedDependencyError",
  message,
});