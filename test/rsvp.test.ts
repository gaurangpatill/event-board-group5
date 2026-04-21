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
    const mockUser: IAuthenticatedUser = {
            id: "user1",
            email: "user1@app.test",
            displayName: "User One",
            role: "user",
    };

    let rsvpService: IRSVPService;

    describe("getRSVP", () => {
        let eventRepository: jest.Mocked<IEventRepository>;

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
                findEventById: jest.fn(async (_id: string) => Ok(baseEvent)),
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

        it("returns null when the user has no RSVP for the event", async () => {
            const result = await rsvpService.getRSVP(mockUser, "event-1");

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBeNull();
            }
        });

        it("returns the existing RSVP after toggle creates one", async () => {
            const createResult = await rsvpService.toggleRSVP(mockUser, "event-1");
            expect(createResult.ok).toBe(true);

            const getResult = await rsvpService.getRSVP(mockUser, "event-1");
            expect(getResult.ok).toBe(true);

            if (getResult.ok) {
                expect(getResult.value).not.toBeNull();
                expect(getResult.value).toMatchObject({
                    userId: mockUser.id,
                    eventId: "event-1",
                    status: "going",
                });
            }
        });

        it("returns only the requesting user's RSVP", async () => {
            const user2: IAuthenticatedUser = {
                id: "user2",
                email: "user2@example.com",
                displayName: "User Two",
                role: "user",
            };

            await rsvpService.toggleRSVP(user2, "event-1");

            const getResult = await rsvpService.getRSVP(mockUser, "event-1");
            expect(getResult.ok).toBe(true);

            if (getResult.ok) {
                expect(getResult.value).toBeNull();
            }
        });
    });

    describe("getMyRSVPs", () => {
        let eventRepository: jest.Mocked<IEventRepository>;

        const eventA: IEventRecord = {
            id: "event-a",
            title: "Event A",
            description: "A",
            location: "Hall A",
            category: "academic",
            startDateTime: new Date("2026-06-01T18:00:00.000Z"),
            endDateTime: new Date("2026-06-01T19:00:00.000Z"),
            maxCapacity: 10,
            status: "published",
            organizerId: "org-1",
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
        };

        const eventB: IEventRecord = {
            ...eventA,
            id: "event-b",
            title: "Event B",
            startDateTime: new Date("2026-05-01T18:00:00.000Z"),
            endDateTime: new Date("2026-05-01T19:00:00.000Z"),
        };

        const cancelledEvent: IEventRecord = {
            ...eventA,
            id: "event-cancelled",
            status: "cancelled",
        };

        function createMockEventRepository(): jest.Mocked<IEventRepository> {
            const eventsById: Record<string, IEventRecord> = {
                [eventA.id]: eventA,
                [eventB.id]: eventB,
                [cancelledEvent.id]: cancelledEvent,
            };

            return {
                findEventById: jest.fn(async (id: string) => Ok(eventsById[id] ?? null)),
                createEvent: jest.fn(async (_event) => Ok(eventA)),
                updateEvent: jest.fn(async (_id, _changes) => Ok(eventA)),
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

        it("rejects non-user roles", async () => {
            const staff: IAuthenticatedUser = {
                id: "staff-1",
                email: "staff@app.test",
                displayName: "Staff",
                role: "staff",
            };

            const result = await rsvpService.getMyRSVPs(staff);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.value.name).toBe("RSVPAuthorizationError");
            }
        });

        it("returns only visible RSVPs and sorts by event start date", async () => {
            const user2: IAuthenticatedUser = {
                id: "user2",
                email: "user2@app.test",
                displayName: "User Two",
                role: "user",
            };

            await rsvpService.toggleRSVP(mockUser, eventA.id);
            await rsvpService.toggleRSVP(mockUser, eventB.id);
            await rsvpService.toggleRSVP(mockUser, cancelledEvent.id);
            await rsvpService.toggleRSVP(user2, eventA.id);

            const result = await rsvpService.getMyRSVPs(mockUser);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toHaveLength(2);
                expect(result.value.map((entry) => entry.event.id)).toEqual([
                    eventB.id,
                    eventA.id,
                ]);
                expect(result.value.every((entry) => entry.rsvp.userId === mockUser.id)).toBe(true);
                expect(result.value.find((entry) => entry.event.id === cancelledEvent.id)).toBeUndefined();
            }
        });
    });

    describe("getWaitlistPosition", () => {
        let eventRepository: jest.Mocked<IEventRepository>;

        const limitedEvent: IEventRecord = {
            id: "event-limited",
            title: "Limited Event",
            description: "Only one spot",
            location: "Room 10",
            category: "workshop",
            startDateTime: new Date("2026-06-10T18:00:00.000Z"),
            endDateTime: new Date("2026-06-10T20:00:00.000Z"),
            maxCapacity: 1,
            status: "published",
            organizerId: "org-1",
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
        };

        function createMockEventRepository(): jest.Mocked<IEventRepository> {
            return {
                findEventById: jest.fn(async (id: string) => Ok(id === limitedEvent.id ? limitedEvent : null)),
                createEvent: jest.fn(async (_event) => Ok(limitedEvent)),
                updateEvent: jest.fn(async (_id, _changes) => Ok(limitedEvent)),
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

        it("returns null when actor is not waitlisted", async () => {
            const result = await rsvpService.getWaitlistPosition(mockUser, limitedEvent.id);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBeNull();
            }
        });

        it("returns 1-indexed waitlist position", async () => {
            const user2: IAuthenticatedUser = {
                id: "user2",
                email: "user2@app.test",
                displayName: "User Two",
                role: "user",
            };
            const user3: IAuthenticatedUser = {
                id: "user3",
                email: "user3@app.test",
                displayName: "User Three",
                role: "user",
            };

            await rsvpService.toggleRSVP(mockUser, limitedEvent.id);
            await rsvpService.toggleRSVP(user2, limitedEvent.id);
            await rsvpService.toggleRSVP(user3, limitedEvent.id);

            const user2Pos = await rsvpService.getWaitlistPosition(user2, limitedEvent.id);
            const user3Pos = await rsvpService.getWaitlistPosition(user3, limitedEvent.id);

            expect(user2Pos.ok).toBe(true);
            expect(user3Pos.ok).toBe(true);
            if (user2Pos.ok) {
                expect(user2Pos.value).toBe(1);
            }
            if (user3Pos.ok) {
                expect(user3Pos.value).toBe(2);
            }
        });

        it("returns dependency error when RSVP listing fails", async () => {
            const failingRepository = {
                findRSVP: jest.fn(async () => Ok(null)),
                createRSVP: jest.fn(),
                updateRSVP: jest.fn(),
                listRSVPByUser: jest.fn(async () => Ok([] as IRSVPRecord[])),
                listRSVPByEvent: jest.fn(async () => Err({ name: "UnexpectedDependencyError", message: "list failed" })),
                findNextWaitlisted: jest.fn(async () => Ok(null)),
                cancelAndPromoteWaitlist: jest.fn(async () => Ok(undefined)),
            };

            const logger = {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
            };

            rsvpService = CreateRSVPService(
                failingRepository as ReturnType<typeof CreateInMemoryRSVPRepository>,
                eventRepository,
                logger,
            );

            const result = await rsvpService.getWaitlistPosition(mockUser, limitedEvent.id);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.value.name).toBe("UnexpectedDependencyError");
                expect(result.value.message).toContain("list failed");
            }
        });
    });

    describe("toggleRSVP", () => {
        let eventRepository: jest.Mocked<IEventRepository>;

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