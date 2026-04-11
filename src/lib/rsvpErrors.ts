export type RSVPError = 
  | { name: "RSVPNotFound";            message: string }
  | { name: "RSVPAuthorizationError";  message: string }
  | { name: "InvalidRSVPState";        message: string }
  | { name: "UnexpectedDependencyError"; message: string }
  | { name: "RSVPAlreadyExists";       message: string }

export const RSVPNotFound = (message: string): RSVPError =>
  ({ name: "RSVPNotFound", message });

export const RSVPAuthorizationError = (message: string): RSVPError =>
  ({ name: "RSVPAuthorizationError", message });

export const InvalidRSVPState = (message: string): RSVPError =>
  ({ name: "InvalidRSVPState", message });

export const UnexpectedDependencyError = (message: string): RSVPError =>
  ({ name: "UnexpectedDependencyError", message });

export const RSVPAlreadyExists = (message: string): RSVPError =>
  ({ name: "RSVPAlreadyExists", message });