import { CreateInMemoryEventRepository } from "../src/repository/InMemoryEventRepository";
import { CreateInMemoryRSVPRepository } from "../src/repository/InMemoryRSVPRepository";
import { CreateEventService } from "../src/service/EventService";
import type { IAuthenticatedUser } from "../src/auth/User";

// Mock authenticated user for testing
const mockUser: IAuthenticatedUser = {
  id: "user-123",
  email: "test@example.com",
  displayName: "Test User",
  role: "user",
};

//Helper function to create a new event for testing
function makeEvent(overrides: Record<string, unknown> = {}) {
    return{
        title: "Generic Event",
    description: "A generic description",
    location: "Boston, MA",
    status: "published" as const,
    category: "social" as const,
    startDateTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    endDateTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7 + 3_600_000),
    organizerId: "org-1",
    maxCapacity: null,
    ...overrides,
    }
}

// Helper function to create new event service and repositories for testing
function createService(){
    const eventRepository = CreateInMemoryEventRepository();
    const rsvpRepository = CreateInMemoryRSVPRepository();
    const service = CreateEventService(eventRepository, rsvpRepository);
    return {service, eventRepository};
}

describe("Event Search Feature 10 Tests", () => {
    describe("Matching Results", () => {
        it("returns an event whose title matches the query", async () => {
            const { service, eventRepository } = createService();
            await eventRepository.createEvent(makeEvent({ title: "Jazz Night" }));
            await eventRepository.createEvent(makeEvent({ title: "Art Fair" }));
            const result = await service.searchEvents(mockUser, "Jazz");
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value).toHaveLength(1);
            expect(result.value[0].title).toBe("Jazz Night");
        })
        it("returns an event whose description matches the query", async () => {
            const { service, eventRepository } = createService();
            await eventRepository.createEvent(makeEvent({ title: "Event A", description: "Live jazz and cocktails" }));
            await eventRepository.createEvent(makeEvent({ title: "Event B", description: "Pottery for beginners" }));
            const result = await service.searchEvents(mockUser, "cocktails");
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value).toHaveLength(1);
            expect(result.value[0].title).toBe("Event A");
        })
        it("returns an event whose location matches the query", async () => {
            const { service, eventRepository } = createService();
            await eventRepository.createEvent(makeEvent({ title: "Event A", location: "Amherst, MA" }));
            await eventRepository.createEvent(makeEvent({ title: "Event B", location: "Boston, MA" }));
            const result = await service.searchEvents(mockUser, "Amherst");
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value).toHaveLength(1);
            expect(result.value[0].title).toBe("Event A");
        })
        it("matching is case-insensitive", async () => {
            const { service, eventRepository } = createService();
            await eventRepository.createEvent(makeEvent({ title: "Jazz Night" }));
            const result = await service.searchEvents(mockUser, "jazz");
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value).toHaveLength(1);
        })
        it("trims whitespace from the query before matching", async () => {
            const { service, eventRepository } = createService();
            await eventRepository.createEvent(makeEvent({ title: "Jazz Night" }));
            const result = await service.searchEvents(mockUser, "  Jazz  ");
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value).toHaveLength(1);
        })
        it("returns multiple events when more than one matches", async () => {
            const { service, eventRepository } = createService();
            await eventRepository.createEvent(makeEvent({ title: "Jazz Night" }));
            await eventRepository.createEvent(makeEvent({ title: "Jazz Brunch" }));
            await eventRepository.createEvent(makeEvent({ title: "Coding Meeting" }));
            const result = await service.searchEvents(mockUser, "Jazz");
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value).toHaveLength(2);
        })
    });
    describe("No Results", () => {});
    describe("Empty Query", () => {});
    describe("Invalid Input", () => {})
});