import { CreateInMemoryRSVPRepository } from "../src/repository/InMemoryRSVPRepository";
import type { IAuthenticatedUser } from "../src/auth/User";
import type { EventFilterOptions, IEventRepository } from "../src/repository/EventRepository";
import type { EventError } from "../src/lib/errors";
import { Ok, Err } from "../src/lib/result";
import type { IRSVPService } from "../src/service/iRsvpService";
import { CreateRSVPService } from "../src/service/rsvpService";
import type { IEventRecord } from "../src/lib/event";
import type { IRSVPRecord } from "../src/lib/rsvp";

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

        it("returns an error result if the event repository throws an error", async () => {
            eventRepository.findEventById.mockResolvedValueOnce(Err({name: "EventNotFound", message: "uniqueErrorMessage"} as EventError));

            const result = await rsvpService.toggleRSVP(mockUser, "event-1");

            expect(eventRepository.findEventById).toHaveBeenCalledWith("event-1");

            expect(result.ok).toBe(false);

            if (!result.ok) {
                expect(result.value.name).toBe("UnexpectedDependencyError");
                expect(result.value.message).toContain("uniqueErrorMessage");
            }
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
            const pastEvent = { ...baseEvent, endDateTime: new Date("2024-01-01T18:00:00.000Z") } as IEventRecord;
            eventRepository.findEventById.mockResolvedValueOnce(Ok(pastEvent));

            const result = await rsvpService.toggleRSVP(mockUser, "event-1");

            expect(eventRepository.findEventById).toHaveBeenCalledWith("event-1");

            expect(result.ok).toBe(false);
        
            if (!result.ok) {
                expect(result.value.name).toBe("RSVPToInvalidEvent");
            }
        });

        it("rsvp is created successfully for a valid event when no rsvp exists and there is capacity", async () => {
            eventRepository.findEventById.mockResolvedValueOnce(Ok(baseEvent));

            const result = await rsvpService.toggleRSVP(mockUser, "event-1");

            expect(eventRepository.findEventById).toHaveBeenCalledWith("event-1");

            expect(result.ok).toBe(true);

            if(result.ok) {
                expect(result.value).toMatchObject({
                    userId: mockUser.id,
                    eventId: "event-1",
                    status: "going"
                })
            }
        });

        it("rsvp is updated to cancelled successfully for a valid event when an active rsvp exists", async () => {
            eventRepository.findEventById.mockResolvedValue(Ok(baseEvent));

            // First create an active RSVP
            const createResult = await rsvpService.toggleRSVP(mockUser, "event-1");
            expect(createResult.ok).toBe(true);

            // Then toggle it again to cancel
            const cancelResult = await rsvpService.toggleRSVP(mockUser, "event-1");
            expect(cancelResult.ok).toBe(true);

            if(cancelResult.ok) {
                expect(cancelResult.value).toMatchObject({
                    userId: mockUser.id,
                    eventId: "event-1",
                    status: "cancelled"
                })
            }
        });

        it("rsvp is updated to going successfully for a valid event when a cancelled rsvp exists and there is capacity", async () => {
            eventRepository.findEventById.mockResolvedValue(Ok(baseEvent));

            // First create an active RSVP
            const createResult = await rsvpService.toggleRSVP(mockUser, "event-1");
            expect(createResult.ok).toBe(true);

            // Then toggle it again to cancel
            const cancelResult = await rsvpService.toggleRSVP(mockUser, "event-1");
            expect(cancelResult.ok).toBe(true);

            // Then toggle it again to go
            const goResult = await rsvpService.toggleRSVP(mockUser, "event-1");
            expect(goResult.ok).toBe(true);

            if(goResult.ok) {
                expect(goResult.value).toMatchObject({
                    userId: mockUser.id,
                    eventId: "event-1",
                    status: "going"
                })
            }
        });

        it("rsvp is updated to waitlisted successfully for a valid event when no rsvp exists but there is no capacity", async () => {
            eventRepository.findEventById.mockResolvedValueOnce(Ok({ ...baseEvent, maxCapacity: 0 }));

            const result = await rsvpService.toggleRSVP(mockUser, "event-1");

            expect(eventRepository.findEventById).toHaveBeenCalledWith("event-1");
            expect(result.ok).toBe(true);

            if(result.ok) {
                expect(result.value).toMatchObject({
                    userId: mockUser.id,
                    eventId: "event-1",
                    status: "waitlisted"
                })
            }
        });

        it("rsvp is updated to cancelled successfully for a valid event when a waitlisted rsvp exists", async () => {
            eventRepository.findEventById.mockResolvedValue(Ok({ ...baseEvent, maxCapacity: 0 }));

            // First create a waitlisted RSVP
            const createResult = await rsvpService.toggleRSVP(mockUser, "event-1");
            expect(createResult.ok).toBe(true);

            // Then toggle it again to cancel
            const cancelResult = await rsvpService.toggleRSVP(mockUser, "event-1");
            expect(cancelResult.ok).toBe(true);

            if(cancelResult.ok) {
                expect(cancelResult.value).toMatchObject({
                    userId: mockUser.id,
                    eventId: "event-1",
                    status: "cancelled"
                })
            }
        });

        it("rsvp is updated to waitlisted successfully for a valid event when a cancelled rsvp exists but there is no capacity", async () => {
            eventRepository.findEventById.mockResolvedValue(Ok({ ...baseEvent, maxCapacity: 0 }));

            // First create a waitlisted RSVP
            const createResult = await rsvpService.toggleRSVP(mockUser, "event-1");
            expect(createResult.ok).toBe(true);

            // Then toggle it again to cancel
            const cancelResult = await rsvpService.toggleRSVP(mockUser, "event-1");
            expect(cancelResult.ok).toBe(true);

            // Then toggle it again to waitlist
            const waitlistResult = await rsvpService.toggleRSVP(mockUser, "event-1");
            expect(waitlistResult.ok).toBe(true);

            if(waitlistResult.ok) {
                expect(waitlistResult.value).toMatchObject({
                    userId: mockUser.id,
                    eventId: "event-1",
                    status: "waitlisted"
                })
            }
        });

        it("automatically moves waitlisted users to going when capacity is freed up", async () => {
            eventRepository.findEventById.mockResolvedValue(Ok({ ...baseEvent, maxCapacity: 1 }));

            const user2: IAuthenticatedUser = {
                id: "user2",
                email: "user2@example.com",
                displayName: "User 2",
                role: "user",
            };

            // User 1 RSVPs and takes the only spot
            const rsvp1 = await rsvpService.toggleRSVP(mockUser, "event-1");
            expect(rsvp1.ok).toBe(true);
            expect(rsvp1.ok && rsvp1.value.status).toBe("going");

            // User 2 RSVPs and gets waitlisted
            const rsvp2 = await rsvpService.toggleRSVP(user2, "event-1");
            expect(rsvp2.ok).toBe(true);
            expect(rsvp2.ok && rsvp2.value.status).toBe("waitlisted");

            // User 1 cancels, which should move User 2 to going
            const cancel1 = await rsvpService.toggleRSVP(mockUser, "event-1");
            expect(cancel1.ok).toBe(true);

            // Check User 2's RSVP status
            const rsvp2Status = await rsvpService.getRSVP(user2, "event-1");
            expect(rsvp2Status.ok).toBe(true);

            expect(rsvp2Status.ok && rsvp2Status.value).not.toBe(null);

            if (rsvp2Status.ok && rsvp2Status.value) {
                expect(rsvp2Status.value.status).toBe("going");
            }
        });
    });
});