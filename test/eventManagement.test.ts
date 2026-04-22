import { CreateEventService } from "../src/service/EventService";
import { CreateInMemoryEventRepository } from "../src/repository/InMemoryEventRepository";
import { CreateInMemoryRSVPRepository } from "../src/repository/InMemoryRSVPRepository";
import type { IAuthenticatedUser } from "../src/auth/User";

//Mock authenticated users for testing
const organizer1: IAuthenticatedUser = { id: "org-1", email: "org1@example.com", displayName: "Organizer One", role: "staff" };
const organizer2: IAuthenticatedUser = { id: "org-2", email: "org2@example.com", displayName: "Organizer Two", role: "staff" };
const adminUser:  IAuthenticatedUser = { id: "admin-1", email: "admin@example.com", displayName: "Admin User", role: "admin" };
const memberUser: IAuthenticatedUser = { id: "member-1", email: "member@example.com", displayName: "Member User", role: "user" };

//Helper function to create a new event for testing
function makeEvent(overrides: Record<string, unknown> = {}) {
    return {
        title: "Generic Event",
        description: "A test event description",
        location: "Room 101",
        category: "academic" as const,
        maxCapacity: null,
        startDateTime: new Date(Date.now() + 1000 * 60 * 60 * 24),
        endDateTime:   new Date(Date.now() + 1000 * 60 * 60 * 25),
        ...overrides,
    };
}

// Helper function to create new event service and repositories for testing
function createService() {
    const eventRepository = CreateInMemoryEventRepository();
    const rsvpRepository = CreateInMemoryRSVPRepository();
    const service = CreateEventService(eventRepository, rsvpRepository);
    return {service, eventRepository, rsvpRepository};
}

describe("Organizer Event Dashboard Feature 8 Tests", () => {
    describe("Access Control", () => {
        test("Member (role: user) is rejected with EventAuthorizationError", async () => {
            const { service } = createService();
            const result = await service.getOrganizerDashboard(memberUser);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.value.name).toBe("EventAuthorizationError");
            }
        })
        test("Organizer (role: staff) is granted access and receives an Ok result", async () => {
            const { service } = createService();
            const result = await service.getOrganizerDashboard(organizer1);
            expect(result.ok).toBe(true);
        })
        test("Admin (role: admin) is granted access and receives an Ok result", async () => {
            const { service } = createService();
            const result = await service.getOrganizerDashboard(adminUser);
            expect(result.ok).toBe(true);
        })
    })
    describe("Visibility", () => {
        test("organizer only sees their own events, not events owned by another organizer", async () => {
            const { service, eventRepository, rsvpRepository } = createService();
            await service.createEvent(organizer1, makeEvent({ title: "Org1 Event" }));
            await service.createEvent(organizer2, makeEvent({ title: "Org2 Event" }));
            const result = await service.getOrganizerDashboard(organizer1);
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            const allEvents = [...result.value.published, ...result.value.draft, ...result.value.cancelledOrPast];
            expect(allEvents).toHaveLength(1);
            expect(allEvents[0].title).toBe("Org1 Event");
        })
        test("organizer sees all of their own events regardless of status", async () => {
            const { service, eventRepository, rsvpRepository } = createService();
            const draftResult = await service.createEvent(organizer1, {...makeEvent({ title: "Draft Event"})});
            expect(draftResult.ok).toBe(true);
            if (!draftResult.ok) return;

            const publishedSourceResult = await service.createEvent(organizer1, {...makeEvent({ title: "Published Event"})});
            expect(publishedSourceResult.ok).toBe(true);
            if (!publishedSourceResult.ok) return;
            await service.publishEvent(organizer1, publishedSourceResult.value.id);

            const cancelledSourceResult = await service.createEvent(organizer1, {...makeEvent({ title: "Cancelled Event"})});
            expect(cancelledSourceResult.ok).toBe(true);
            if (!cancelledSourceResult.ok) return;
            await service.publishEvent(organizer1, cancelledSourceResult.value.id);
            await service.cancelEvent(organizer1, cancelledSourceResult.value.id);

            const result = await service.getOrganizerDashboard(organizer1);
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value.draft).toHaveLength(1);
            expect(result.value.published).toHaveLength(1);
            expect(result.value.cancelledOrPast).toHaveLength(1);
        })
        test("admin sees events from ALL organizers", async () => {
            const { service, eventRepository, rsvpRepository } = createService();
            await service.createEvent(organizer1, makeEvent({ title: "Org1 Event" }));
            await service.createEvent(organizer2, makeEvent({ title: "Org2 Event" }));
            const result = await service.getOrganizerDashboard(adminUser);
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            const allEvents = [...result.value.published, ...result.value.draft, ...result.value.cancelledOrPast];
            expect(allEvents).toHaveLength(2);
            const titles = allEvents.map((e) => e.title);
            expect(titles).toContain("Org1 Event");
            expect(titles).toContain("Org2 Event");
        })
        test("admin with no events sees three empty buckets", async () => {
            const { service, eventRepository, rsvpRepository } = createService();
            const result = await service.getOrganizerDashboard(adminUser);
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value.published).toHaveLength(0);
            expect(result.value.draft).toHaveLength(0);
            expect(result.value.cancelledOrPast).toHaveLength(0);
        })
    })
    describe("Status Grouping", () => {})
    describe("Attendee Counting", () => {})
})


