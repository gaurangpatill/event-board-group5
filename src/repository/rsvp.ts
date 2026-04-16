export type RSVPStatus = "going" | "waitlisted" | "cancelled";

export interface IRSVPRecord {
    id: string;
    eventId: string;
    userId: string;
    status: RSVPStatus;
    createdAt: Date;
    updatedAt: Date;
}