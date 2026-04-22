import { CreateEventService } from "../src/service/EventService";
import { CreateInMemoryEventRepository } from "../src/repository/InMemoryEventRepository";
import { CreateInMemoryRSVPRepository } from "../src/repository/InMemoryRSVPRepository";
import type { IAuthenticatedUser } from "../src/auth/User";
import request from "supertest";
import { createComposedApp } from "../src/composition";

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
    describe("Status Grouping", () => {
        test("draft events appear only in the draft bucket", async () => {
            const { service, eventRepository, rsvpRepository } = createService();
            await service.createEvent(organizer1, {...makeEvent({ title: "My Draft" })});
            const result = await service.getOrganizerDashboard(organizer1);
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value.draft).toHaveLength(1);
            expect(result.value.draft[0].title).toBe("My Draft");
            expect(result.value.published).toHaveLength(0);
            expect(result.value.cancelledOrPast).toHaveLength(0);
        })
        test("published events appear only in the published bucket", async () => {
            const { service, eventRepository, rsvpRepository } = createService();
            const created = await service.createEvent(organizer1, {...makeEvent({ title: "Active Event" })});
            expect(created.ok).toBe(true);
            if (!created.ok) return;
            await service.publishEvent(organizer1, created.value.id);
            const result = await service.getOrganizerDashboard(organizer1);
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            expect(result.value.published).toHaveLength(1);
            expect(result.value.published[0].title).toBe("Active Event");
            expect(result.value.draft).toHaveLength(0);
        })
        test("cancelled events appear only in the cancelledOrPast bucket", async () => {
            const { service, eventRepository, rsvpRepository } = createService();
            const created = await service.createEvent(organizer1, {...makeEvent({ title: "Cancelled Event" })});
            expect(created.ok).toBe(true);
            if (!created.ok) return;
            await service.publishEvent(organizer1, created.value.id);
            await service.cancelEvent(organizer1, created.value.id);
            const result = await service.getOrganizerDashboard(organizer1);
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            
            expect(result.value.cancelledOrPast).toHaveLength(1);
            expect(result.value.cancelledOrPast[0].status).toBe("cancelled");
            expect(result.value.published).toHaveLength(0);
            expect(result.value.draft).toHaveLength(0);
        })
        test("past events are put as 'past' and appear in cancelledOrPast bucket", async () => {
            const { service, eventRepository, rsvpRepository } = createService();
            await eventRepository.createEvent({
                title: "Past Event", description: "Already over", location: "Somewhere", category: "social", startDateTime: new Date(Date.now() - 1000 * 60 * 60 * 48), endDateTime: new Date(Date.now() - 1000 * 60 * 60 * 24), maxCapacity: null, status: "published", organizerId: organizer1.id,
            })
            const result = await service.getOrganizerDashboard(organizer1);
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            
            expect(result.value.cancelledOrPast).toHaveLength(1);
            expect(result.value.cancelledOrPast[0].status).toBe("past");
            expect(result.value.published).toHaveLength(0);
        })
    })
    describe("Attendee Counting", () => {
        test("attendeeCount is 0 when there are no RSVPs", async () => {
            const { service, eventRepository, rsvpRepository } = createService();
            await service.createEvent(organizer1, makeEvent());
            const result = await service.getOrganizerDashboard(organizer1);
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value.draft[0].attendeeCount).toBe(0);
        })
        test("attendeeCount reflects only 'going' RSVPs, not waitlisted or cancelled ones", async () => {
            const { service, eventRepository, rsvpRepository } = createService();
            const created = await service.createEvent(organizer1, {...makeEvent({title: "Random Event"})});
            expect(created.ok).toBe(true);
            if (!created.ok) return;
            const eventId = created.value.id;

            await rsvpRepository.createRSVP({ eventId, userId: "u-1", status: "going" });
            await rsvpRepository.createRSVP({ eventId, userId: "u-2", status: "going" });
            await rsvpRepository.createRSVP({ eventId, userId: "u-3", status: "waitlisted" });
            await rsvpRepository.createRSVP({ eventId, userId: "u-4", status: "cancelled" });
            const result = await service.getOrganizerDashboard(organizer1);
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.value.draft[0].attendeeCount).toBe(2);
        })
        test("attendeeCount is accurate when multiple events have different RSVP counts", async () => {
            const { service, eventRepository, rsvpRepository } = createService();
            const eventA = await service.createEvent(organizer1, {...makeEvent({ title: "Event A"})});
            const eventB = await service.createEvent(organizer1, {...makeEvent({ title: "Event B"})});
            expect(eventA.ok).toBe(true);
            expect(eventB.ok).toBe(true);
            if (!eventA.ok || !eventB.ok) return;

            await rsvpRepository.createRSVP({ eventId: eventA.value.id, userId: "u-1", status: "going" });
            await rsvpRepository.createRSVP({ eventId: eventB.value.id, userId: "u-2", status: "going" });
            await rsvpRepository.createRSVP({ eventId: eventB.value.id, userId: "u-3", status: "going" });
            await rsvpRepository.createRSVP({ eventId: eventB.value.id, userId: "u-4", status: "going" });
            const result = await service.getOrganizerDashboard(organizer1);
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            const drafts = result.value.draft;
            const countByTitle = Object.fromEntries(drafts.map((e) => [e.title, e.attendeeCount]));
            expect(countByTitle["Event A"]).toBe(1);
            expect(countByTitle["Event B"]).toBe(3);
        })
    })
})

function createEventManagementApp() {
  return createComposedApp().getExpressApp();
}

function createEventManagementAgent(app = createEventManagementApp()) {
  return request.agent(app);
}

async function loginAsStaffForEventEditing(
  agent: ReturnType<typeof createEventManagementAgent>,
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

async function loginAsUserForEventEditing(
  agent: ReturnType<typeof createEventManagementAgent>,
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

async function createDraftEventForEditing(
  agent: ReturnType<typeof createEventManagementAgent>,
  overrides?: Partial<{
    title: string;
    description: string;
    location: string;
    category: string;
    startDateTime: string;
    endDateTime: string;
    maxCapacity: string;
  }>,
) {
  const createResponse = await agent.post("/events").type("form").send({
    title: "Draft Event",
    description: "A draft event to edit during tests.",
    location: "Room 203",
    category: "workshop",
    startDateTime: "2026-06-01T10:00",
    endDateTime: "2026-06-01T11:00",
    maxCapacity: "20",
    ...overrides,
  });

  expect(createResponse.status).toBe(302);
  const location = createResponse.headers.location as string;
  const eventId = location.split("/").pop();

  expect(eventId).toBeTruthy();
  return eventId as string;
}

describe("event editing HTTP contracts", () => {
  it("loads the edit form for the organizer who owns the draft event", async () => {
    const agent = createEventManagementAgent();
    await loginAsStaffForEventEditing(agent);
    const eventId = await createDraftEventForEditing(agent);

    const response = await agent.get(`/events/${eventId}/edit`);

    expect(response.status).toBe(200);
    expect(response.text).toContain("Edit Event");
    expect(response.text).toContain('value="Draft Event"');
  });

  it("updates a draft event and redirects back to the edit page", async () => {
    const agent = createEventManagementAgent();
    await loginAsStaffForEventEditing(agent);
    const eventId = await createDraftEventForEditing(agent);

    const response = await agent.post(`/events/${eventId}`).type("form").send({
      title: "Updated Draft Event",
      description: "Updated description for the draft event.",
      location: "Room 301",
      category: "academic",
      startDateTime: "2026-06-01T12:00",
      endDateTime: "2026-06-01T13:30",
      maxCapacity: "30",
    });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(`/events/${eventId}/edit`);

    const editPage = await agent.get(response.headers.location);
    expect(editPage.status).toBe(200);
    expect(editPage.text).toContain("Updated Draft Event");
  });

  it("returns 403 when a regular user tries to open the edit page", async () => {
    const app = createEventManagementApp();
    const staffAgent = createEventManagementAgent(app);
    await loginAsStaffForEventEditing(staffAgent);
    const eventId = await createDraftEventForEditing(staffAgent);

    const userAgent = createEventManagementAgent(app);
    await loginAsUserForEventEditing(userAgent);

    const response = await userAgent.get(`/events/${eventId}/edit`);

    expect(response.status).toBe(403);
    expect(response.text).toContain(
      "You are not allowed to edit this event.",
    );
  });

  it("returns 404 when editing a non-existent event", async () => {
    const agent = createEventManagementAgent();
    await loginAsStaffForEventEditing(agent);

    const response = await agent.get("/events/not-a-real-event-id/edit");

    expect(response.status).toBe(404);
    expect(response.text).toContain("Event not found.");
  });

  it("returns 409 when trying to edit a cancelled event", async () => {
    const agent = createEventManagementAgent();
    await loginAsStaffForEventEditing(agent);
    const eventId = await createDraftEventForEditing(agent);

    const publishResponse = await agent
      .post(`/events/${eventId}/publish`)
      .type("form")
      .send({});
    expect(publishResponse.status).toBe(302);

    const cancelResponse = await agent
      .post(`/events/${eventId}/cancel`)
      .type("form")
      .send({});
    expect(cancelResponse.status).toBe(302);

    const response = await agent.get(`/events/${eventId}/edit`);

    expect(response.status).toBe(409);
    expect(response.text).toContain(
      "Cancelled events cannot be edited.",
    );
  });

  it("returns 400 when the updated event end time is before the start time", async () => {
    const agent = createEventManagementAgent();
    await loginAsStaffForEventEditing(agent);
    const eventId = await createDraftEventForEditing(agent);

    const response = await agent.post(`/events/${eventId}`).type("form").send({
      title: "Draft Event",
      description: "Bad update should fail validation.",
      location: "Room 203",
      category: "workshop",
      startDateTime: "2026-06-01T15:00",
      endDateTime: "2026-06-01T14:00",
      maxCapacity: "20",
    });

    expect(response.status).toBe(400);
    expect(response.text).toContain("End time must be after start time.");
  });
});

function createEditHtmxApp() {
  return createComposedApp().getExpressApp();
}

function createEditHtmxAgent(app = createEditHtmxApp()) {
  return request.agent(app);
}

async function loginAsStaffForEditHtmx(
  agent: ReturnType<typeof createEditHtmxAgent>,
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

async function createDraftEventForEditHtmx(
  agent: ReturnType<typeof createEditHtmxAgent>,
  overrides?: Partial<{
    title: string;
    description: string;
    location: string;
    category: string;
    startDateTime: string;
    endDateTime: string;
    maxCapacity: string;
  }>,
) {
  const createResponse = await agent.post("/events").type("form").send({
    title: "Draft Event",
    description: "A draft event to edit during tests.",
    location: "Room 203",
    category: "workshop",
    startDateTime: "2026-06-01T10:00",
    endDateTime: "2026-06-01T11:00",
    maxCapacity: "20",
    ...overrides,
  });

  expect(createResponse.status).toBe(302);
  const location = createResponse.headers.location as string;
  const eventId = location.split("/").pop();

  expect(eventId).toBeTruthy();
  return eventId as string;
}

describe("event editing HTMX contracts", () => {
  it("returns a success fragment for a valid HTMX edit request", async () => {
    const agent = createEditHtmxAgent();
    await loginAsStaffForEditHtmx(agent);
    const eventId = await createDraftEventForEditHtmx(agent);

    const response = await agent
      .post(`/events/${eventId}`)
      .set("HX-Request", "true")
      .type("form")
      .send({
        title: "Updated HTMX Draft Event",
        description: "Updated through an HTMX request.",
        location: "Room 301",
        category: "academic",
        startDateTime: "2026-06-01T12:00",
        endDateTime: "2026-06-01T13:30",
        maxCapacity: "30",
      });

    expect(response.status).toBe(200);
    expect(response.text).toContain('id="event-edit-form"');
    expect(response.text).toContain("Changes Saved");
    expect(response.text).toContain("Updated HTMX Draft Event");
    expect(response.text).toContain("View Event");
  });

  it("returns the edit form fragment with validation errors for an invalid HTMX edit request", async () => {
    const agent = createEditHtmxAgent();
    await loginAsStaffForEditHtmx(agent);
    const eventId = await createDraftEventForEditHtmx(agent);

    const response = await agent
      .post(`/events/${eventId}`)
      .set("HX-Request", "true")
      .type("form")
      .send({
        title: "Draft Event",
        description: "Bad update should fail validation.",
        location: "Room 203",
        category: "workshop",
        startDateTime: "2026-06-01T15:00",
        endDateTime: "2026-06-01T14:00",
        maxCapacity: "20",
      });

    expect(response.status).toBe(400);
    expect(response.text).toContain('id="event-edit-form"');
    expect(response.text).toContain(`hx-post="/events/${eventId}"`);
    expect(response.text).toContain("End time must be after start time.");
  });
});
