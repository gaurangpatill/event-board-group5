import { CreateInMemoryEventRepository } from "../src/repository/InMemoryEventRepository";
import { CreateInMemoryRSVPRepository } from "../src/repository/InMemoryRSVPRepository";
import type { IAuthenticatedUser } from "../src/auth/User";
import type { EventFilterOptions, IEventRepository } from "../src/repository/EventRepository";
import type { EventError } from "../src/lib/errors";
import { Ok, Err } from "../src/lib/result";
import type { IRSVPService } from "../src/service/iRsvpService";
import { CreateRSVPService } from "../src/service/rsvpService";
import type { IEventRecord } from "../src/lib/event";
import type { IRSVPRecord } from "../src/lib/rsvp";
import { CreateRSVPInput, IRSVPRepository } from "../src/repository/IRSVPRepository";


//helper functions for the RSVP Dashboard tests, will change so we don't need them later -ananya 
const member: IAuthenticatedUser = {
  id: "user-reader",
  email: "user@app.test",
  displayName: "Una User",
  role: "user",
};

const organizer: IAuthenticatedUser = {
  id: "user-staff",
  email: "staff@app.test",
  displayName: "Sam Staff",
  role: "staff",
};

async function seedEvent(
  repo: IEventRepository,
  overrides: Partial<Omit<IEventRecord, "id" | "createdAt" | "updatedAt">> & {
    startDateTime: Date;
    endDateTime: Date;
  },
): Promise<IEventRecord> {
  const result = await repo.createEvent({
    title: "Test Event",
    description: "A test description.",
    location: "Room 101",
    category: "social",
    maxCapacity: null,
    status: "published",
    organizerId: "user-staff",
    ...overrides,
  });
  if (!result.ok) throw new Error("Seed event failed: " + result.value.message);
  return result.value;
}

async function seedRSVP(
  repo: IRSVPRepository,
  eventId: string,
  userId: string,
  status: IRSVPRecord["status"],
): Promise<IRSVPRecord> {
  const result = await repo.createRSVP({ eventId, userId, status });
  if (!result.ok) throw new Error("Seed RSVP failed: " + result.value.message);
  return result.value;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0);
  return d;
}

function createRSVPRepositoryTest(fn: () => IRSVPRepository, implementation: string) {
    describe(`RSVP Repository - ${implementation}`, () => {
        let rsvpRepository: IRSVPRepository;

        const mockRSVP: CreateRSVPInput = {
            eventId: "event-1",
            userId: "user-1",
            status: "going",
        };

        beforeEach(() => {
            rsvpRepository = fn();
        });

        describe("createRSVP", () => {
            it("creates and returns a new RSVP record", async () => {
                const result = await rsvpRepository.createRSVP({
                    eventId: "event-2",
                    userId: "user-2",
                    status: "going",
                });

                expect(result.ok).toBe(true);
                
                if (result.ok) {
                    expect(result.value).toMatchObject({
                        eventId: "event-2",
                        userId: "user-2",
                        status: "going",
                    });
                    expect(result.value.id).toBeDefined();
                    expect(result.value.createdAt).toBeInstanceOf(Date);
                    expect(result.value.updatedAt).toBeInstanceOf(Date);
                }
            });

            it("creates multiple RSVPs for different users/events", async () => {
                const r1 = await rsvpRepository.createRSVP({ eventId: "event-3", userId: "user-3", status: "going" });
                
                const r2 = await rsvpRepository.createRSVP({ eventId: "event-3", userId: "user-4", status: "waitlisted" });
                
                expect(r1.ok).toBe(true);
                expect(r2.ok).toBe(true);
                
                if (r1.ok && r2.ok) {
                    expect(r1.value.userId).not.toBe(r2.value.userId);
                    expect(r1.value.eventId).toBe(r2.value.eventId);

                    expect(r1.value.status).toBe("going");
                    expect(r2.value.status).toBe("waitlisted");
                }
            });

            it("Returns error when creating duplicate RSVP for the same user and event", async () => {
                const first = await rsvpRepository.createRSVP({ eventId: "event-4", userId: "user-5", status: "going" });
                const second = await rsvpRepository.createRSVP({ eventId: "event-4", userId: "user-5", status: "waitlisted" });
                
                expect(first.ok).toBe(true);
                expect(second.ok).toBe(false);
            });
        });

        describe("updateRSVP", () => {
            it("updates the status of an existing RSVP", async () => {
                const create = await rsvpRepository.createRSVP({ eventId: "event-10", userId: "user-10", status: "going" });
                
                expect(create.ok).toBe(true);
                
                if (!create.ok) return;
                
                const updated = await rsvpRepository.updateRSVP(create.value.id, "waitlisted");
                
                expect(updated.ok).toBe(true);
                
                if (updated.ok) {
                    expect(updated.value.status).toBe("waitlisted");
                    expect(updated.value.id).toBe(create.value.id);
                }
            });

            it("returns an error if RSVP does not exist", async () => {
                const result = await rsvpRepository.updateRSVP("non-existent-id", "going");
                
                expect(result.ok).toBe(false);
            });

            it("can update to all valid statuses", async () => {
                const create = await rsvpRepository.createRSVP({ eventId: "event-11", userId: "user-11", status: "going" });
                
                expect(create.ok).toBe(true);
                
                if (!create.ok) return;
                
                for (const status of ["going", "waitlisted", "cancelled"] as const) {
                    const updated = await rsvpRepository.updateRSVP(create.value.id, status);
                    expect(updated.ok).toBe(true);
                    if (updated.ok) {
                        expect(updated.value.status).toBe(status);
                    }
                }
            });

            it("updates the updatedAt field on change", async () => {
                const create = await rsvpRepository.createRSVP({ eventId: "event-12", userId: "user-12", status: "going" });
                
                expect(create.ok).toBe(true);
                
                if (!create.ok) return;
                
                const before = create.value.updatedAt;
                
                await new Promise(res => setTimeout(res, 1)); // ensure time passes
                
                const updated = await rsvpRepository.updateRSVP(create.value.id, "cancelled");
                
                expect(updated.ok).toBe(true);
                
                if (updated.ok) {
                    expect(updated.value.updatedAt.getTime()).toBeGreaterThan(before.getTime());
                }
            });
        });

        describe("findRSVP", () => {
            it("returns null when no RSVP exists for the user and event", async () => {
                const result = await rsvpRepository.findRSVP("event-1", "user-1");
                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value).toBeNull();
                }
            });

            it("returns the existing RSVP for the user and event", async () => {
                const result = await rsvpRepository.createRSVP(mockRSVP);

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value).toMatchObject(mockRSVP);
                }

                const findResult = await rsvpRepository.findRSVP("event-1", "user-1");
                expect(findResult.ok).toBe(true);

                if (findResult.ok) {
                    expect(findResult.value).not.toBeNull();
                    expect(findResult.value).toMatchObject(mockRSVP);
                }
            });

            it("returns null for a different user on the same event", async () => {
                await rsvpRepository.createRSVP(mockRSVP);

                const result = await rsvpRepository.findRSVP("event-1", "user-2");
                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value).toBeNull();
                }
            });

            it("returns null for the same user on a different event", async () => {
                await rsvpRepository.createRSVP(mockRSVP);

                const result = await rsvpRepository.findRSVP("event-2", "user-1");
                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value).toBeNull();
                }
            });

            it("returns the updated status after updateRSVP", async () => {
                const createResult = await rsvpRepository.createRSVP(mockRSVP);
                expect(createResult.ok).toBe(true);
                if (!createResult.ok) return;

                await rsvpRepository.updateRSVP(createResult.value.id, "cancelled");

                const findResult = await rsvpRepository.findRSVP("event-1", "user-1");
                expect(findResult.ok).toBe(true);
                if (findResult.ok) {
                    expect(findResult.value).not.toBeNull();
                    expect(findResult.value?.status).toBe("cancelled");
                }
            });

            it("still returns a cancelled RSVP (repository does not filter by status)", async () => {
                const createResult = await rsvpRepository.createRSVP({ ...mockRSVP, status: "cancelled" });
                expect(createResult.ok).toBe(true);

                const findResult = await rsvpRepository.findRSVP("event-1", "user-1");
                expect(findResult.ok).toBe(true);
                if (findResult.ok) {
                    expect(findResult.value).not.toBeNull();
                    expect(findResult.value?.status).toBe("cancelled");
                }
            });
        });

        describe("listRSVPByUser", () => {
            it("returns an empty array if user has no RSVPs", async () => {
                const result = await rsvpRepository.listRSVPByUser("user-x");
                
                expect(result.ok).toBe(true);
                
                if (result.ok) {
                    expect(Array.isArray(result.value)).toBe(true);
                    expect(result.value).toHaveLength(0);
                }
            });

            it("returns all RSVPs for a user across events", async () => {
                await rsvpRepository.createRSVP({ eventId: "event-1", userId: "user-a", status: "going" });
                await rsvpRepository.createRSVP({ eventId: "event-2", userId: "user-a", status: "waitlisted" });
                await rsvpRepository.createRSVP({ eventId: "event-3", userId: "user-a", status: "cancelled" });
                
                const result = await rsvpRepository.listRSVPByUser("user-a");
                
                expect(result.ok).toBe(true);
                
                if (result.ok) {
                    expect(result.value).toHaveLength(3);
                    const eventIds = result.value.map(r => r.eventId);
                    expect(eventIds).toEqual(expect.arrayContaining(["event-1", "event-2", "event-3"]));
                }
            });


            it("does not return RSVPs for other users", async () => {
                await rsvpRepository.createRSVP({ eventId: "event-1", userId: "user-a", status: "going" });
                await rsvpRepository.createRSVP({ eventId: "event-2", userId: "user-b", status: "going" });
                const result = await rsvpRepository.listRSVPByUser("user-a");
                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value).toHaveLength(1);
                    expect(result.value[0].userId).toBe("user-a");
                }
            });

            it("returns RSVPs of all statuses (repo does not filter)", async () => {
                await rsvpRepository.createRSVP({ eventId: "event-1", userId: "user-c", status: "going" });
                await rsvpRepository.createRSVP({ eventId: "event-2", userId: "user-c", status: "waitlisted" });
                await rsvpRepository.createRSVP({ eventId: "event-3", userId: "user-c", status: "cancelled" });
               
                const result = await rsvpRepository.listRSVPByUser("user-c");
                
                expect(result.ok).toBe(true);
                
                if (result.ok) {
                    const statuses = result.value.map(r => r.status);
                    expect(statuses).toEqual(expect.arrayContaining(["going", "waitlisted", "cancelled"]));
                }
            });

            it("handles a large number of RSVPs", async () => {
                for (let i = 0; i < 50; i++) {
                    await rsvpRepository.createRSVP({ eventId: `event-${i}`, userId: "user-bulk", status: "going" });
                }
                
                const result = await rsvpRepository.listRSVPByUser("user-bulk");
                
                expect(result.ok).toBe(true);
                
                if (result.ok) {
                    expect(result.value).toHaveLength(50);
                }
            });
        });

        describe("listRSVPByEvent", () => {
            it("returns an empty array if event has no RSVPs", async () => {
                const result = await rsvpRepository.listRSVPByEvent("event-x");

                expect(result.ok).toBe(true);

                if (result.ok) {
                    expect(Array.isArray(result.value)).toBe(true);
                    expect(result.value).toHaveLength(0);
                }
            });

            it("returns all RSVPs for an event across users", async () => {
                await rsvpRepository.createRSVP({ eventId: "event-a", userId: "user-1", status: "going" });
                await rsvpRepository.createRSVP({ eventId: "event-a", userId: "user-2", status: "waitlisted" });
                await rsvpRepository.createRSVP({ eventId: "event-a", userId: "user-3", status: "cancelled" });
                
                const result = await rsvpRepository.listRSVPByEvent("event-a");
                
                expect(result.ok).toBe(true);
                
                if (result.ok) {
                    expect(result.value).toHaveLength(3);
                    const userIds = result.value.map(r => r.userId);
                    expect(userIds).toEqual(expect.arrayContaining(["user-1", "user-2", "user-3"]));
                }
            });

            it("does not return RSVPs for other events", async () => {
                await rsvpRepository.createRSVP({ eventId: "event-b", userId: "user-1", status: "going" });
                await rsvpRepository.createRSVP({ eventId: "event-c", userId: "user-2", status: "going" });
                const result = await rsvpRepository.listRSVPByEvent("event-b");
                
                expect(result.ok).toBe(true);
                
                if (result.ok) {
                    expect(result.value).toHaveLength(1);
                    expect(result.value[0].eventId).toBe("event-b");
                }
            });

            it("returns RSVPs of all statuses (repo does not filter)", async () => {
                await rsvpRepository.createRSVP({ eventId: "event-d", userId: "user-x", status: "going" });
                await rsvpRepository.createRSVP({ eventId: "event-d", userId: "user-y", status: "waitlisted" });
                await rsvpRepository.createRSVP({ eventId: "event-d", userId: "user-z", status: "cancelled" });
                
                const result = await rsvpRepository.listRSVPByEvent("event-d");
                
                expect(result.ok).toBe(true);
                
                if (result.ok) {
                    const statuses = result.value.map(r => r.status);
                    expect(statuses).toEqual(expect.arrayContaining(["going", "waitlisted", "cancelled"]));
                }
            });

            it("handles a large number of RSVPs", async () => {
                for (let i = 0; i < 50; i++) {
                    await rsvpRepository.createRSVP({ eventId: "event-bulk", userId: `user-${i}`, status: "going" });
                }
                
                const result = await rsvpRepository.listRSVPByEvent("event-bulk");
                
                expect(result.ok).toBe(true);
                
                if (result.ok) {
                    expect(result.value).toHaveLength(50);
                }
            });
        });

        describe("findNextWaitlisted", () => {
            it("returns null if there are no waitlisted RSVPs for the event", async () => {
                await rsvpRepository.createRSVP({ eventId: "event-x", userId: "user-1", status: "going" });
                
                const result = await rsvpRepository.findNextWaitlisted("event-x");
                
                expect(result.ok).toBe(true);
                
                if (result.ok) {
                    expect(result.value).toBeNull();
                }
            });

            it("returns the earliest waitlisted RSVP for the event", async () => {
                await rsvpRepository.createRSVP({ eventId: "event-y", userId: "user-1", status: "waitlisted" });
                await new Promise(res => setTimeout(res, 5));
                await rsvpRepository.createRSVP({ eventId: "event-y", userId: "user-2", status: "waitlisted" });
                
                const result = await rsvpRepository.findNextWaitlisted("event-y");
                
                expect(result.ok).toBe(true);
                
                if (result.ok && result.value) {
                    expect(result.value.userId).toBe("user-1");
                    expect(result.value.status).toBe("waitlisted");
                }
            });

            it("ignores non-waitlisted RSVPs for the event", async () => {
                await rsvpRepository.createRSVP({ eventId: "event-z", userId: "user-1", status: "going" });
                await rsvpRepository.createRSVP({ eventId: "event-z", userId: "user-2", status: "cancelled" });
                
                const result = await rsvpRepository.findNextWaitlisted("event-z");
                
                expect(result.ok).toBe(true);
                
                if (result.ok) {
                    expect(result.value).toBeNull();
                }
            });

            it("returns the earliest by createdAt if multiple waitlisted", async () => {
                await rsvpRepository.createRSVP({ eventId: "event-w", userId: "user-1", status: "waitlisted" });
                
                await new Promise(res => setTimeout(res, 1));
                
                await rsvpRepository.createRSVP({ eventId: "event-w", userId: "user-2", status: "waitlisted" });
                
                await new Promise(res => setTimeout(res, 1));
                
                await rsvpRepository.createRSVP({ eventId: "event-w", userId: "user-3", status: "waitlisted" });
                
                const result = await rsvpRepository.findNextWaitlisted("event-w");
                
                expect(result.ok).toBe(true);
                
                if (result.ok && result.value) {
                    expect(result.value.userId).toBe("user-1");
                }
            });
        });

        describe("cancelAndPromoteWaitlist", () => {
            it("cancels the given RSVP and promotes the next waitlisted RSVP", async () => {
                // Create three RSVPs: one going, two waitlisted
                const r1 = await rsvpRepository.createRSVP({ eventId: "event-promote", userId: "user-1", status: "going" });
                const r2 = await rsvpRepository.createRSVP({ eventId: "event-promote", userId: "user-2", status: "waitlisted" });
                const r3 = await rsvpRepository.createRSVP({ eventId: "event-promote", userId: "user-3", status: "waitlisted" });
                
                expect(r1.ok && r2.ok && r3.ok).toBe(true);
                
                if (!r1.ok || !r2.ok || !r3.ok) return;

                const result = await rsvpRepository.cancelAndPromoteWaitlist(r1.value.id, r2.value.id);
                
                expect(result.ok).toBe(true);

                // r1 should be cancelled
                const cancelled = await rsvpRepository.findRSVP("event-promote", "user-1");
                
                expect(cancelled.ok && cancelled.value && cancelled.value.status).toBe("cancelled");

                // r2 should be going
                const promoted = await rsvpRepository.findRSVP("event-promote", "user-2");
                
                expect(promoted.ok && promoted.value && promoted.value.status).toBe("going");

                // r3 should still be waitlisted
                const stillWaitlisted = await rsvpRepository.findRSVP("event-promote", "user-3");
                
                expect(stillWaitlisted.ok && stillWaitlisted.value && stillWaitlisted.value.status).toBe("waitlisted");
            });

            it("returns an error if either RSVP does not exist", async () => {
                const r1 = await rsvpRepository.createRSVP({ eventId: "event-promote2", userId: "user-1", status: "going" });
                
                expect(r1.ok).toBe(true);
                
                if (!r1.ok) return;
                
                const result = await rsvpRepository.cancelAndPromoteWaitlist(r1.value.id, "non-existent-id");
                
                expect(result.ok).toBe(false);
            });

            it("is atomic: if promoting fails, cancellation is not persisted", async () => {
                if (implementation === "In-Memory") {
                    rsvpRepository = fn();
                    
                    // Create two RSVPs: one going, one waitlisted
                    const r1 = await rsvpRepository.createRSVP({ eventId: "event-atomic", userId: "user-1", status: "going" });
                    const r2 = await rsvpRepository.createRSVP({ eventId: "event-atomic", userId: "user-2", status: "waitlisted" });
                    
                    expect(r1.ok && r2.ok).toBe(true);
                    
                    if (!r1.ok || !r2.ok) return;

                    // Monkey-patch the repo to throw on promoting
                    // Only works for InMemoryRSVPRepository (test contract)

                    // @ts-ignore
                    const origSet = rsvpRepository.store?.set;
                    let throwNow = false;
                    // @ts-ignore
                    if (rsvpRepository.store) {
                        // @ts-ignore
                        rsvpRepository.store.set = function(key, value) {
                            if (throwNow && value.status === "going") throw new Error("Simulated promote error");
                            return origSet.call(this, key, value);
                        };
                    }

                    throwNow = true;

                    const result = await rsvpRepository.cancelAndPromoteWaitlist(r1.value.id, r2.value.id);
                    
                    expect(result.ok).toBe(false);
                    
                    // r1 should still be going, r2 should still be waitlisted
                    const check1 = await rsvpRepository.findRSVP("event-atomic", "user-1");
                    const check2 = await rsvpRepository.findRSVP("event-atomic", "user-2");
                    
                    expect(check1.ok && check1.value?.status).toBe("going");
                    expect(check2.ok && check2.value?.status).toBe("waitlisted");
                    // Restore
                    // @ts-ignore
                    if (rsvpRepository.store) rsvpRepository.store.set = origSet;
                }
            });
        });
    });
}

createRSVPRepositoryTest(CreateInMemoryRSVPRepository, "In-Memory");

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

        it("passes through repository errors", async () => {
            const failingRepository = {
                findRSVP: jest.fn(async () => Err({ name: "UnexpectedDependencyError", message: "find failed" })),
                createRSVP: jest.fn(),
                updateRSVP: jest.fn(),
                listRSVPByUser: jest.fn(async () => Ok([] as IRSVPRecord[])),
                listRSVPByEvent: jest.fn(async () => Ok([] as IRSVPRecord[])),
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

            const result = await rsvpService.getRSVP(mockUser, "event-1");

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.value.name).toBe("UnexpectedDependencyError");
                expect(result.value.message).toContain("find failed");
            }
        });
    });

    describe("RSVP Dashboard", () => {

        describe("GET /dashboard/rsvps (member)", () => {
            it("returns dashboard for a logged-in member", async () => {
                const eventRepo = CreateInMemoryEventRepository();
                const rsvpRepo  = CreateInMemoryRSVPRepository();
                const service   = CreateRSVPService(rsvpRepo, eventRepo);

                const result = await service.getMyRSVPs(member);

               expect(result.ok).toBe(true);
            });

            it("groups RSVPs into upcoming and past", async () => {
                const eventRepo = CreateInMemoryEventRepository();
                const rsvpRepo  = CreateInMemoryRSVPRepository();
                const service   = CreateRSVPService(rsvpRepo, eventRepo);

                const futureStart = daysFromNow(5);
                const pastStart   = daysFromNow(-5);

                const futureEvent = await seedEvent(eventRepo, { title: "Upcoming Event", startDateTime: futureStart, endDateTime: new Date(futureStart.getTime() + 3_600_000) });
                const pastEvent   = await seedEvent(eventRepo, { title: "Past Event",     startDateTime: pastStart,   endDateTime: new Date(pastStart.getTime()   + 3_600_000) });

                await seedRSVP(rsvpRepo, futureEvent.id, member.id, "going");
                await seedRSVP(rsvpRepo, pastEvent.id,   member.id, "going");

                const result = await service.getMyRSVPs(member);

                expect(result.ok).toBe(true);
                    if (!result.ok) return;

                        const now      = new Date();
                        const upcoming = result.value.filter(r => r.event.startDateTime >= now);
                        const past     = result.value.filter(r => r.event.startDateTime <  now);

                expect(upcoming.length).toBeGreaterThanOrEqual(1);
                expect(past.length).toBeGreaterThanOrEqual(1);
             });
            

            it("sorts upcoming events by start date ascending", async () => {
                const eventRepo = CreateInMemoryEventRepository();
                const rsvpRepo  = CreateInMemoryRSVPRepository();
                const service   = CreateRSVPService(rsvpRepo, eventRepo);

                const laterStart   = daysFromNow(10);
                const earlierStart = daysFromNow(3);

                const laterEvent   = await seedEvent(eventRepo, { title: "Later",   startDateTime: laterStart,   endDateTime: new Date(laterStart.getTime()   + 3_600_000) });
                const earlierEvent = await seedEvent(eventRepo, { title: "Earlier", startDateTime: earlierStart, endDateTime: new Date(earlierStart.getTime() + 3_600_000) });

                await seedRSVP(rsvpRepo, laterEvent.id,   member.id, "going");
                await seedRSVP(rsvpRepo, earlierEvent.id, member.id, "going");

                const result = await service.getMyRSVPs(member);

                expect(result.ok).toBe(true);
                if (!result.ok) return;
                    expect(result.value[0].event.title).toBe("Earlier");
                    expect(result.value[1].event.title).toBe("Later");
            });

             it("prevents organizers from accessing the dashboard", async () => {
                const eventRepo = CreateInMemoryEventRepository();
                const rsvpRepo  = CreateInMemoryRSVPRepository();
                const service   = CreateRSVPService(rsvpRepo, eventRepo);

                const result = await service.getMyRSVPs(organizer);

                expect(result.ok).toBe(false);
                    if (result.ok) return;
                        expect(result.value.name).toBe("RSVPAuthorizationError");
            });
        });

        describe("POST /events/:id/rsvp (cancel RSVP inline)", () => {
            it("cancels an RSVP by toggling — going RSVP becomes cancelled", async () => {
                const eventRepo = CreateInMemoryEventRepository();
                const rsvpRepo  = CreateInMemoryRSVPRepository();

                const start = daysFromNow(5);
                const event = await seedEvent(eventRepo, { startDateTime: start, endDateTime: new Date(start.getTime() + 3_600_000) });
                const rsvp  = await seedRSVP(rsvpRepo, event.id, member.id, "going");

                const cancelResult = await rsvpRepo.updateRSVP(rsvp.id, "cancelled");

                expect(cancelResult.ok).toBe(true);
                    if (!cancelResult.ok) return;
                        expect(cancelResult.value.status).toBe("cancelled");
            });

            it("returns error if the event does not exist", async () => {
                const eventRepo = CreateInMemoryEventRepository();
                const rsvpRepo  = CreateInMemoryRSVPRepository();
                const service   = CreateRSVPService(rsvpRepo, eventRepo);

                await rsvpRepo.createRSVP({ eventId: "ghost-event-id", userId: member.id, status: "going" });

                const result = await service.getMyRSVPs(member);

                expect(result.ok).toBe(true);
                    if (!result.ok) return;
                    expect(result.value).toHaveLength(0);
            });
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

        it("returns repository error when listRSVPByUser fails", async () => {
            const failingRepository = {
                findRSVP: jest.fn(async () => Ok(null)),
                createRSVP: jest.fn(),
                updateRSVP: jest.fn(),
                listRSVPByUser: jest.fn(async () => Err({ name: "UnexpectedDependencyError", message: "list by user failed" })),
                listRSVPByEvent: jest.fn(async () => Ok([] as IRSVPRecord[])),
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

            const result = await rsvpService.getMyRSVPs(mockUser);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.value.name).toBe("UnexpectedDependencyError");
                expect(result.value.message).toContain("list by user failed");
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

        it("returns dependency error when findRSVP fails", async () => {
            const failingRepository = {
                findRSVP: jest.fn(async () => Err({ name: "UnexpectedDependencyError", message: "find failed" })),
                createRSVP: jest.fn(),
                updateRSVP: jest.fn(),
                listRSVPByUser: jest.fn(async () => Ok([] as IRSVPRecord[])),
                listRSVPByEvent: jest.fn(async () => Ok([] as IRSVPRecord[])),
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

            const result = await rsvpService.toggleRSVP(mockUser, "event-1");

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.value.name).toBe("UnexpectedDependencyError");
                expect(result.value.message).toContain("find failed");
            }
        });

        it("returns dependency error when waitlist lookup fails during cancellation", async () => {
            const failingRepository = CreateInMemoryRSVPRepository();
            jest
                .spyOn(failingRepository, "findNextWaitlisted")
                .mockResolvedValue(
                    Err({ name: "UnexpectedDependencyError", message: "waitlist lookup failed" }),
                );

            const logger = {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
            };

            rsvpService = CreateRSVPService(
                failingRepository,
                eventRepository,
                logger,
            );

            eventRepository.findEventById.mockResolvedValue(Ok(baseEvent));

            const createResult = await rsvpService.toggleRSVP(mockUser, "event-1");
            expect(createResult.ok).toBe(true);

            const cancelResult = await rsvpService.toggleRSVP(mockUser, "event-1");
            expect(cancelResult.ok).toBe(false);
            if (!cancelResult.ok) {
                expect(cancelResult.value.name).toBe("UnexpectedDependencyError");
                expect(cancelResult.value.message).toContain("waitlist lookup failed");
            }
        });
    });
});