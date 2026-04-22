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
    describe("No Results", () => {
        it("returns an empty array when nothing matches", async () => {
            const { service, eventRepository } = createService();
            await eventRepository.createEvent(makeEvent({ title: "Jazz Night", description: "Live jazz and cocktails", location: "Amherst, MA" }));
            const result = await service.searchEvents(mockUser, "Cooking");
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value).toHaveLength(0);
        });
        it("returns an empty array when the store has no events", async () => {
            const { service } = createService();
            const result = await service.searchEvents(mockUser, "Anything");
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value).toHaveLength(0);
        });
        it("does not return draft events even if they match the query", async () => {
            const { service, eventRepository } = createService();
            await eventRepository.createEvent(makeEvent({ title: "Secret Draft Event", status: "draft" }));
            const result = await service.searchEvents(mockUser, "Secret");
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value).toHaveLength(0);
        });
        it("does not return past events even if they match the query", async () => {
            const { service, eventRepository } = createService();
            await eventRepository.createEvent(makeEvent({ 
                title: "Old Jazz Event", status: "published", startDateTime: new Date(Date.now() - 1000 * 60 * 60 * 48), endDateTime: new Date(Date.now() - 1000 * 60 * 60 * 24)
            }));
            const result = await service.searchEvents(mockUser, "Jazz");
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value).toHaveLength(0);
        });
    });
    describe("Empty Query", () => {
        it("returns all published upcoming events when query is an empty string", async() => {
            const { service, eventRepository } = createService();
            await eventRepository.createEvent(makeEvent({ title: "Event A" }));
            await eventRepository.createEvent(makeEvent({ title: "Event B" }));
            const result = await service.searchEvents(mockUser, "");
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value).toHaveLength(2);
        })
        it("returns all published upcoming events when query is only whitespace", async() => {
            const { service, eventRepository } = createService();
            await eventRepository.createEvent(makeEvent({ title: "Event A" }));
            await eventRepository.createEvent(makeEvent({ title: "Event B" }));
            const result = await service.searchEvents(mockUser, "   ");
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value).toHaveLength(2);
        })
    });
    describe("Invalid Input", () => {
        it("returns an error when the query exceeds 200 characters", async () => {
            const { service } = createService();
            const longQuery = "a".repeat(201);
            const result = await service.searchEvents(mockUser, longQuery);
            expect(result.ok).toBe(false);
            if (result.ok) return;
            expect(result.value.name).toBe("InvalidSearchInputError");
        })
        it("returns an error when the query contains only special characters", async () => {
            const { service } = createService();
            const longQuery = "!!!###$$$";
            const result = await service.searchEvents(mockUser, longQuery);
            expect(result.ok).toBe(false);
            if (result.ok) return;
            expect(result.value.name).toBe("InvalidSearchInputError");
        })
    })
});