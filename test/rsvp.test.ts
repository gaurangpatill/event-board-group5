import { CreateInMemoryRSVPRepository } from "../src/repository/InMemoryRSVPRepository";
import type { IAuthenticatedUser } from "../src/auth/User";
import type { EventFilterOptions, IEventRepository } from "../src/repository/EventRepository";
import type { EventError } from "../src/lib/errors";
import { Ok } from "../src/lib/result";
import type { IRSVPService } from "../src/service/iRsvpService";
import { CreateRSVPService } from "../src/service/rsvpService";
import type { IEventRecord } from "../src/lib/event";

describe("RSVP Service", () => {
    describe("RSVP Toggling", () => {
        let rsvpService: IRSVPService;
        let eventRepository: jest.Mocked<IEventRepository>;

        const mockUser: IAuthenticatedUser = {
            id: "user1",
            email: "user1@app.test",
            displayName: "User One",
            role: "user",
        };

        const baseEvent: IEventRecord = {
            id: "event-1",
            title: "Mock Event",
            description: "Mock Description",
            location: "Campus",
            category: "social",
            startDateTime: new Date("2026-05-01T18:00:00.000Z"),
            endDateTime: new Date("2026-05-01T20:00:00.000Z"),
            maxCapacity: 10,
            status: "published",
            organizerId: "organizer-1",
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
        };

        function createMockEventRepository(): jest.Mocked<IEventRepository> {
            return {
                findEventById: jest.fn(async (_id: string) => Ok(null)),
                createEvent: jest.fn(async (_event) => Ok(baseEvent)),
                updateEvent: jest.fn(async (_id, _changes) => Ok(baseEvent)),
                listEvents: jest.fn(async (_filters?: EventFilterOptions) => Ok([])),
                countAttendees: jest.fn(async (_eventId: string) => Ok(0)),
            };
        }

        beforeEach(() => {
            const logger = {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
            };

            const rsvpRepository = CreateInMemoryRSVPRepository();
            eventRepository = createMockEventRepository();
            rsvpService = CreateRSVPService(rsvpRepository, eventRepository, logger);
        });

        it("returns an error result if the event does not exist", async () => {
            eventRepository.findEventById.mockResolvedValueOnce(Ok(null));

            const result = await rsvpService.toggleRSVP(mockUser, "non-existent-event");

            expect(eventRepository.findEventById).toHaveBeenCalledWith("non-existent-event");
            
            expect(result.ok).toBe(false);
            
            if (!result.ok) {
                expect(result.value.name).toBe("RSVPToInvalidEvent");
            }
        });

        it("returns an error result if the event is not published", async () => {
            const draftEvent = { ...baseEvent, status: "draft" } as IEventRecord;
            eventRepository.findEventById.mockResolvedValueOnce(Ok(draftEvent));

            const result = await rsvpService.toggleRSVP(mockUser, "event-1");

            expect(eventRepository.findEventById).toHaveBeenCalledWith("event-1");

            expect(result.ok).toBe(false);

            if (!result.ok) {
                expect(result.value.name).toBe("RSVPToInvalidEvent");
            }
        });

        it("returns an error result if the event is cancelled", async () => {
            const cancelledEvent = { ...baseEvent, status: "cancelled" } as IEventRecord;
            eventRepository.findEventById.mockResolvedValueOnce(Ok(cancelledEvent));

            const result = await rsvpService.toggleRSVP(mockUser, "event-1");

            expect(eventRepository.findEventById).toHaveBeenCalledWith("event-1");

            expect(result.ok).toBe(false);

            if (!result.ok) {
                expect(result.value.name).toBe("RSVPToInvalidEvent");
            }
        });

        it("returns an error result if the event is past", async () => {
            const pastEvent = { ...baseEvent, startDateTime: new Date("2024-01-01T18:00:00.000Z") } as IEventRecord;
            eventRepository.findEventById.mockResolvedValueOnce(Ok(pastEvent));

            const result = await rsvpService.toggleRSVP(mockUser, "event-1");

            expect(eventRepository.findEventById).toHaveBeenCalledWith("event-1");

            expect(result.ok).toBe(false);
        
            if (!result.ok) {
                expect(result.value.name).toBe("RSVPToInvalidEvent");
            }
        });
});
});