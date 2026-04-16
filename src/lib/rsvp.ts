
export type RSVPStatus = "going" | "waitlisted" | "cancelled";

export interface IRSVPRecord {
  id: string;        // UUID / cuid
  eventId: string;   // FK → Event.id
  userId: string;    // FK → User.id
  status: RSVPStatus;
  createdAt: Date;
  updatedAt: Date;
}