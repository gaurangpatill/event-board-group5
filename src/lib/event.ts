export type EventStatus = "draft" | "published" | "cancelled" | "past";
 
export type EventCategory =
  | "academic"
  | "social"
  | "sports"
  | "workshop"
  | "other";
 
export interface IEventRecord {
  id: string;
  title: string;
  description: string;
  location: string;
  category: EventCategory;
  startDateTime: Date;
  endDateTime: Date;
  maxCapacity: number | null;
  status: EventStatus;
  organizerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventWithCount extends IEventRecord {
  attendeeCount: number;
}

export interface OrganizerDashboardData {
  published: EventWithCount[];
  draft: EventWithCount[];
  cancelledOrPast: EventWithCount[];
}
