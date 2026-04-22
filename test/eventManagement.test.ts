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
    return {service, eventRepository};
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
    describe("Visibility", () => {})
    describe("Status Grouping", () => {})
    describe("Attendee Counting", () => {})
})


