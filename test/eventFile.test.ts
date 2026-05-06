import { CreateInMemoryEventRepository } from "../src/repository/InMemoryEventRepository";
import { CreateInMemoryRSVPRepository } from "../src/repository/InMemoryRSVPRepository";
import { CreateEventService } from "../src/service/EventService";
import type { IAuthenticatedUser } from "../src/auth/User";
import type { IEventRepository } from "../src/repository/EventRepository";
import type { IEventRecord } from "../src/lib/event";
import request from 'supertest';
import { createComposedApp } from '../src/composition';
import { CreateLoggingService } from '../src/service/LoggingService';
import type { IApp } from '../src/contracts';

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


//helper functions used for feature 6 tests
const member: IAuthenticatedUser = {
  id: "user-reader",
  email: "user@app.test",
  displayName: "Una User",
  role: "user",
};

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0);
  return d;
}

function dateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nextSaturday(): Date {
  const d = new Date();
  const daysUntil = (6 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntil);
  d.setHours(14, 0, 0, 0);
  return d;
}

async function seedPublished(
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
  if (!result.ok) throw new Error("Seed failed: " + result.value.message);
  return result.value;
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



describe('Feature 2 and 5 Tests', () => {
  let app: IApp;
  let agent: ReturnType<typeof request.agent>
  

  beforeEach(() => {
    app = createComposedApp(CreateLoggingService());
    agent = request.agent(app.getExpressApp());
  });

  // Helper function - login as admin
  async function loginAsAdmin(): Promise<void> {
    const login = await agent
      .post('/login').type('form')
      .send({ email: 'admin@app.test', password: 'password123' });
  }

  // Helper function - login as organizer
  async function loginAsStaff(): Promise<void> {
    const login = await agent
      .post('/login').type('form')
      .send({ email: 'staff@app.test', password: 'password123' });
  }

  // Helper function - login as user
  async function loginAsUser(): Promise<void> {
    const login = await agent
      .post('/login').type('form')
      .send({ email: 'user@app.test', password: 'password123' });
  }

  // Helper function - logout
  async function logout(): Promise<void>{
    const logout = await agent.post('/logout')
  }

  const createTestEvent = async (eventData: any = {}) => {
    const testEvent = {
      title: 'testing title',
      description: 'test desc',
      location: 'test area',
      category: 'academic',
      startDateTime: dateTimeLocal(daysFromNow(30)),
      endDateTime: dateTimeLocal(daysFromNow(31)),
      maxCapacity: '1',
      ...eventData
    };

    const response = await agent
      .post('/events').type('form')
      .send(testEvent);
    expect(response.status).toBe(302);

    // Extract event ID from redirect URL
    const redirectUrl = response.headers.location;
    const eventId = redirectUrl.split('/').pop();
    return eventId;
  };

  describe('Feature 2: Event Detail Page', () => {
    it('should show event details', async () => {
      await loginAsStaff();

      const eventId = await createTestEvent()
      const response = await agent
        .get(`/events/${eventId}`).type('form');
      expect(response.status).toBe(200);
      expect(response.text).toContain('testing title');
      expect(response.text).toContain('test desc');
      expect(response.text).toContain('test area');
    });

    it('should show RSVP status for authenticated users', async () => {
      await loginAsStaff();
      const eventId = await createTestEvent();

      const publish = await agent.post(`/events/${eventId}/publish`);
      expect(publish.status).toBe(302);

      const logout = await agent.post('/logout');
      expect(logout.status).toBe(302);

      await loginAsUser();

      const response = await agent
        .get(`/events/${eventId}`);
      expect(response.status).toBe(200);
      expect(response.text).toContain('rsvp');
    });

    it('should show event details to staff member that created it', async () => {
      await loginAsStaff();
      const eventId = await createTestEvent();
      const response = await agent.get(`/events/${eventId}`);
      expect(response.status).toBe(200);
      expect(response.text).toContain('testing title');
      expect(response.text).toContain('test desc');
      expect(response.text).toContain('test area');
    })

    it('should return 404 for a non-existent event', async () => {
      await loginAsStaff();
      const response = await agent.get('/events/891739813791873');
      expect(response.status).toBe(404);
    });

    it('should return 404 when a regular user tries to view a draft event', async () => {
      await loginAsStaff();
      const eventId = await createTestEvent();
      await logout();
 
      await loginAsUser();
      const response = await agent.get(`/events/${eventId}`);
      expect(response.status).toBe(404);
    });

    it('should redirect unauthenticated users away from event detail', async () => {
      const response = await agent.get('/events/some-event-id');
      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/login');
    });

    // Edge case: event detail page shows all key fields
    it('should display all event metadata on the detail page', async () => {
      await loginAsStaff();
      const startDate = daysFromNow(30);
      const endDate = daysFromNow(31);
      const eventId = await createTestEvent({
        startDateTime: dateTimeLocal(startDate),
        endDateTime: dateTimeLocal(endDate),
      });
      const response = await agent.get(`/events/${eventId}`);
      expect(response.status).toBe(200);
      expect(response.text).toContain('testing title');
      expect(response.text).toContain('test desc');
      expect(response.text).toContain('test area');
      expect(response.text).toContain('Academic');
      expect(response.text).toContain(startDate.toLocaleString());
      expect(response.text).toContain(endDate.toLocaleString());

    });
  });

describe('Feature 5: Event Publishing and Cancellation', () => {
    it('should publish a draft event', async () => {
      await loginAsStaff();

      const eventId = await createTestEvent();

      const publish = await agent
        .post(`/events/${eventId}/publish`);
      expect(publish.status).toBe(302);

      const dashboardResponse = await agent
        .get('/dashboard/events');
      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.text).toContain('Published');
    });

    it('should cancel a published event', async () => {
      await loginAsStaff();

      const eventId = await createTestEvent();

      const publish = await agent
        .post(`/events/${eventId}/publish`);
      expect(publish.status).toBe(302);

      const cancel = await agent
        .post(`/events/${eventId}/cancel`);
      expect(cancel.status).toBe(302);

      const dashboardResponse = await agent
        .get('/dashboard/events');
      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.text).toContain('Cancelled');
    });

    it('should allow cancelling a draft event', async () => {
      await loginAsStaff();
      const eventId = await createTestEvent();
 
      const cancel = await agent.post(`/events/${eventId}/cancel`);
      expect(cancel.status).toBe(302);
 
      const dashboard = await agent.get('/dashboard/events');
      expect(dashboard.status).toBe(200);
      expect(dashboard.text).toContain('Cancelled');
    });

    it('should not allow publishing an already published event', async () => {
      await loginAsStaff();
      const eventId = await createTestEvent();
 
      await agent.post(`/events/${eventId}/publish`);
 
      const publish2 = await agent.post(`/events/${eventId}/publish`);
      expect(publish2.status).toBe(400);
    });


    it('should not allow cancelling already cancelled events', async () => {
      await loginAsStaff();

      const eventId = await createTestEvent();

      const cancel1 = await agent
        .post(`/events/${eventId}/cancel`);
      expect(cancel1.status).toBe(302);

      const cancel2 = await agent
        .post(`/events/${eventId}/cancel`);
      expect(cancel2.status).toBe(400); 
    });


    it('should not allow publishing a cancelled event', async () => {
      await loginAsStaff();
      const eventId = await createTestEvent();
 
      await agent.post(`/events/${eventId}/cancel`);
 
      const publish = await agent.post(`/events/${eventId}/publish`);
      expect(publish.status).toBe(400);
    });

    it('should not allow a regular user to publish an event', async () => {
      await loginAsStaff();
      const eventId = await createTestEvent();
      await logout();
 
      await loginAsUser();
      const publish = await agent.post(`/events/${eventId}/publish`);
      expect(publish.status).toBe(403);
    });

    // Edge case - unauthorized attempts 
    it('should block and redirect unauthenticated publish attempts', async () => {
      await loginAsStaff();
      const eventId = await createTestEvent();
      await logout();
 
      const publish = await agent.post(`/events/${eventId}/publish`);
      expect(publish.status).toBe(401);
    });

    // Edge case - publish/cancel a non-existent event 
    it('should return 404 when publishing a non-existent event', async () => {
      await loginAsStaff();
      const publish = await agent.post('/events/non-existent-id-99912121299/publish');
      expect(publish.status).toBe(404);
    });
 
    it('should return 404 when cancelling a non-existent event', async () => {
      await loginAsStaff();
      const cancel = await agent.post('/events/non-existent-id-9912121999/cancel');
      expect(cancel.status).toBe(404);
    });

    // Edge case - dashboard separates published, draft, and cancelled events properly
    it('should show correct counts of event states on the dashboard', async () => {
      await loginAsStaff();
 
      await createTestEvent({ title: 'Draft Event' });
      const pubId = await createTestEvent({ title: 'Published Event' });
      const cancelId = await createTestEvent({ title: 'Cancelled Event' });
 
      await agent.post(`/events/${pubId}/publish`);
      await agent.post(`/events/${cancelId}/cancel`);
 
      const dashboard = await agent.get('/dashboard/events');
      expect(dashboard.status).toBe(200);
      expect(dashboard.text).toContain('Draft Event');
      expect(dashboard.text).toContain('Published Event');
      expect(dashboard.text).toContain('Cancelled Event');
    });



  });
  describe("Category and Date Filter", () => {

  describe("GET /events with no filters", () => {
    it("returns all published events when no filters are applied", async () => {
      const repo    = CreateInMemoryEventRepository();
      const rsvpRepo = CreateInMemoryRSVPRepository();
      const service = CreateEventService(repo, rsvpRepo);

      const start = daysFromNow(3);
      await seedPublished(repo, { title: "Published Event", startDateTime: start, endDateTime: new Date(start.getTime() + 3_600_000) });

      const result = await service.listEvents(member);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBeGreaterThanOrEqual(1);
    });

    it("does not return unpublished events", async () => {
      const repo    = CreateInMemoryEventRepository();
      const rsvpRepo = CreateInMemoryRSVPRepository();
      const service = CreateEventService(repo, rsvpRepo);

      const start = daysFromNow(3);
      await repo.createEvent({
        title: "Draft Event", description: "hidden", location: "X",
        category: "other", maxCapacity: null, status: "draft",
        organizerId: "user-staff",
        startDateTime: start, endDateTime: new Date(start.getTime() + 3_600_000),
      });

      const result = await service.listEvents(member);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      result.value.forEach(e => expect(e.status).toBe("published"));
    });

    it("handles empty string filters gracefully", async () => {
      const repo    = CreateInMemoryEventRepository();
      const rsvpRepo = CreateInMemoryRSVPRepository();
      const service = CreateEventService(repo, rsvpRepo);

      const result = await service.listEvents(member, { category: "" as any, timeframe: "" as any });

      expect(result.ok).toBe(true);
    });
  });

  describe("GET /events filtered by category", () => {
    it("returns only events matching the requested category", async () => {
      const repo    = CreateInMemoryEventRepository();
      const rsvpRepo = CreateInMemoryRSVPRepository();
      const service = CreateEventService(repo, rsvpRepo);

      const start = daysFromNow(4);
      const end   = new Date(start.getTime() + 3_600_000);

      await seedPublished(repo, { category: "sports",   title: "Sports Event",   startDateTime: start, endDateTime: end });
      await seedPublished(repo, { category: "academic", title: "Academic Event", startDateTime: start, endDateTime: end });

      const result = await service.listEvents(member, { category: "sports" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBeGreaterThanOrEqual(1);
      result.value.forEach(e => expect(e.category).toBe("sports"));
    });

    it("returns an empty list when no published events match the category", async () => {
      const repo    = CreateInMemoryEventRepository();
      const rsvpRepo = CreateInMemoryRSVPRepository();
      const service = CreateEventService(repo, rsvpRepo);

      const result = await service.listEvents(member, { category: "workshop" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(0);
    });

    it("returns EventValidationError for an invalid category", async () => {
      const repo    = CreateInMemoryEventRepository();
      const rsvpRepo = CreateInMemoryRSVPRepository();
      const service = CreateEventService(repo, rsvpRepo);

      const result = await service.listEvents(member, { category: "INVALID" as any });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.value.name).toBe("EventValidationError");
    });
  });

  describe("GET /events filtered by timeframe", () => {
    it("filters events by timeframe = this_week", async () => {
      const repo    = CreateInMemoryEventRepository();
      const rsvpRepo = CreateInMemoryRSVPRepository();
      const service = CreateEventService(repo, rsvpRepo);

      const nearStart    = daysFromNow(3);
      const distantStart = daysFromNow(14);

      await seedPublished(repo, { title: "Near Event",    startDateTime: nearStart,    endDateTime: new Date(nearStart.getTime()    + 3_600_000) });
      await seedPublished(repo, { title: "Distant Event", startDateTime: distantStart, endDateTime: new Date(distantStart.getTime() + 3_600_000) });

      const result = await service.listEvents(member, { timeframe: "this_week" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const titles = result.value.map(e => e.title);
      expect(titles).toContain("Near Event");
      expect(titles).not.toContain("Distant Event");
    });

    it("filters events by timeframe = this_weekend", async () => {
      const repo    = CreateInMemoryEventRepository();
      const rsvpRepo = CreateInMemoryRSVPRepository();
      const service = CreateEventService(repo, rsvpRepo);

      const satStart = nextSaturday();
      await seedPublished(repo, { title: "Weekend Event", startDateTime: satStart, endDateTime: new Date(satStart.getTime() + 3_600_000) });

      const result = await service.listEvents(member, { timeframe: "this_weekend" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const titles = result.value.map(e => e.title);
      expect(titles).toContain("Weekend Event");
    });

    it("returns EventValidationError for an invalid timeframe", async () => {
      const repo    = CreateInMemoryEventRepository();
      const rsvpRepo = CreateInMemoryRSVPRepository();
      const service = CreateEventService(repo, rsvpRepo);

      const result = await service.listEvents(member, { timeframe: "invalid-time" as any });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.value.name).toBe("EventValidationError");
    });
  });

  describe("GET /events with both category and timeframe filters", () => {
    it("applies both category and timeframe filters together", async () => {
      const repo    = CreateInMemoryEventRepository();
      const rsvpRepo = CreateInMemoryRSVPRepository();
      const service = CreateEventService(repo, rsvpRepo);

      const nearStart    = daysFromNow(2);
      const distantStart = daysFromNow(20);
      const nearEnd      = new Date(nearStart.getTime()    + 3_600_000);
      const distantEnd   = new Date(distantStart.getTime() + 3_600_000);

      await seedPublished(repo, { title: "Near Academic",    category: "academic", startDateTime: nearStart,    endDateTime: nearEnd });
      await seedPublished(repo, { title: "Near Social",      category: "social",   startDateTime: nearStart,    endDateTime: nearEnd });
      await seedPublished(repo, { title: "Distant Academic", category: "academic", startDateTime: distantStart, endDateTime: distantEnd });

      const result = await service.listEvents(member, { category: "academic", timeframe: "this_week" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const titles = result.value.map(e => e.title);
      expect(titles).toContain("Near Academic");
      expect(titles).not.toContain("Near Social");
      expect(titles).not.toContain("Distant Academic");
    });
  });

});

});

function createEventHttpAgent() {
  return request.agent(createComposedApp().getExpressApp());
}

async function loginAsStaffForEventCreation(
  agent: ReturnType<typeof createEventHttpAgent>,
) {
  await agent
    .post("/login")
    .type("form")
    .send({
      email: "staff@app.test",
      password: "password123",
    })
    .expect(302);
}

async function loginAsUserForEventCreation(
  agent: ReturnType<typeof createEventHttpAgent>,
) {
  await agent
    .post("/login")
    .type("form")
    .send({
      email: "user@app.test",
      password: "password123",
    })
    .expect(302);
}

describe("event creation HTTP contracts", () => {
  it("creates an event for a staff user and redirects to the event detail page", async () => {
    const agent = createEventHttpAgent();
    await loginAsStaffForEventCreation(agent);

    const response = await agent.post("/events").type("form").send({
      title: "Sprint 2 Planning Session",
      description: "Plan the test suite and HTMX work.",
      location: "Room 204",
      category: "workshop",
      startDateTime: dateTimeLocal(daysFromNow(30)),
      endDateTime: dateTimeLocal(new Date(daysFromNow(30).getTime() + 90 * 60_000)),
      maxCapacity: "25",
    });

    expect(response.status).toBe(302);
    expect(response.headers.location).toMatch(/^\/events\/.+/);

    const detailResponse = await agent.get(response.headers.location);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.text).toContain("Sprint 2 Planning Session");
    expect(detailResponse.text).toContain("Draft");
  });

  it("rejects event creation for a regular user with 403", async () => {
    const agent = createEventHttpAgent();
    await loginAsUserForEventCreation(agent);

    const response = await agent.post("/events").type("form").send({
      title: "Unauthorized Event",
      description: "A regular user should not be allowed to create this.",
      location: "Room 100",
      category: "social",
      startDateTime: dateTimeLocal(daysFromNow(30)),
      endDateTime: dateTimeLocal(new Date(daysFromNow(30).getTime() + 3_600_000)),
      maxCapacity: "10",
    });

    expect(response.status).toBe(403);
    expect(response.text).toContain("Only organizers can create events.");
  });

  it("returns 400 and the validation message when the title is missing", async () => {
    const agent = createEventHttpAgent();
    await loginAsStaffForEventCreation(agent);

    const response = await agent.post("/events").type("form").send({
      title: "",
      description: "Missing title should fail validation.",
      location: "Room 101",
      category: "academic",
      startDateTime: dateTimeLocal(daysFromNow(30)),
      endDateTime: dateTimeLocal(new Date(daysFromNow(30).getTime() + 3_600_000)),
      maxCapacity: "20",
    });

    expect(response.status).toBe(400);
    expect(response.text).toContain(
      "Title must be between 1 and 100 characters.",
    );
  });

  it("returns 400 when the event end time is not in the future", async () => {
    const agent = createEventHttpAgent();
    await loginAsStaffForEventCreation(agent);

    const response = await agent.post("/events").type("form").send({
      title: "Past Event",
      description: "Past events should be rejected on creation.",
      location: "Room 102",
      category: "academic",
      startDateTime: dateTimeLocal(daysFromNow(-365)),
      endDateTime: dateTimeLocal(daysFromNow(-364)),
      maxCapacity: "15",
    });

    expect(response.status).toBe(400);
    expect(response.text).toContain("Event end time must be in the future.");
  });
});

function createEventHtmxAgent() {
  return request.agent(createComposedApp().getExpressApp());
}

async function loginAsStaffForEventHtmx(
  agent: ReturnType<typeof createEventHtmxAgent>,
) {
  await agent
    .post("/login")
    .type("form")
    .send({
      email: "staff@app.test",
      password: "password123",
    })
    .expect(302);
}

describe("event creation HTMX contracts", () => {
  it("returns a success fragment for a valid HTMX create request", async () => {
    const agent = createEventHtmxAgent();
    await loginAsStaffForEventHtmx(agent);

    const response = await agent
      .post("/events")
      .set("HX-Request", "true")
      .type("form")
      .send({
        title: "HTMX Event",
        description: "Created through an HTMX request.",
        location: "Room 204",
        category: "workshop",
        startDateTime: dateTimeLocal(daysFromNow(30)),
        endDateTime: dateTimeLocal(new Date(daysFromNow(30).getTime() + 90 * 60_000)),
        maxCapacity: "25",
      });

    expect(response.status).toBe(200);
    expect(response.text).toContain('id="event-create-form"');
    expect(response.text).toContain("Event Created");
    expect(response.text).toContain("HTMX Event");
    expect(response.text).toContain("View Event");
  });

  it("returns the form fragment with validation errors for an invalid HTMX create request", async () => {
    const agent = createEventHtmxAgent();
    await loginAsStaffForEventHtmx(agent);

    const response = await agent
      .post("/events")
      .set("HX-Request", "true")
      .type("form")
      .send({
        title: "",
        description: "Missing title should fail validation.",
        location: "Room 101",
        category: "academic",
        startDateTime: dateTimeLocal(daysFromNow(30)),
        endDateTime: dateTimeLocal(new Date(daysFromNow(30).getTime() + 3_600_000)),
        maxCapacity: "20",
      });

    expect(response.status).toBe(400);
    expect(response.text).toContain('id="event-create-form"');
    expect(response.text).toContain('hx-post="/events"');
    expect(response.text).toContain(
      "Title must be between 1 and 100 characters.",
    );
  });
});
