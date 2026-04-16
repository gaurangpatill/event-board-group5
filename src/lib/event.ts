export type EventStatus = "draft" | "published" | "cancelled" | "past";
 
export type EventCategory =
  | "academic"
  | "social"
  | "sports"
  | "workshop"
  | "other";

export interface IEventRecord {
  id: string;           // UUID / cuid
  title: string;        // 1–100 chars
  description: string;  // 1–2000 chars
  location: string;     // 1–200 chars
  category: EventCategory;
  startDateTime: Date;
  endDateTime: Date;    // must be after startDateTime
  maxCapacity: number | null; // null = unlimited
  status: EventStatus;  // starts as "draft" on creation
  organizerId: string;  // FK → User.id; set from session, never from form
  createdAt: Date;
  updatedAt: Date;
}
export interface EventWithCount extends IEventRecord {
  attendeeCount: number;
}

export interface OrganizerDashboardData{
  published: EventWithCount[];
  draft: EventWithCount[];
  cancelledOrPast: EventWithCount[];
}
