import request from "supertest";
import { createComposedApp } from "../src/composition";

function createApp() {
  return createComposedApp().getExpressApp();
}

function createAgent(app = createApp()) {
  return request.agent(app);
}

async function loginAsStaff(agent: ReturnType<typeof createAgent>) {
  await agent
    .post("/login")
    .type("form")
    .send({
      email: "staff@app.test",
      password: "password123",
    })
    .expect(302);
}

async function loginAsUser(agent: ReturnType<typeof createAgent>) {
  await agent
    .post("/login")
    .type("form")
    .send({
      email: "user@app.test",
      password: "password123",
    })
    .expect(302);
}

async function createDraftEventAsStaff(
  agent: ReturnType<typeof createAgent>,
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
    const agent = createAgent();
    await loginAsStaff(agent);
    const eventId = await createDraftEventAsStaff(agent);

    const response = await agent.get(`/events/${eventId}/edit`);

    expect(response.status).toBe(200);
    expect(response.text).toContain("Edit Event");
    expect(response.text).toContain('value="Draft Event"');
  });

  it("updates a draft event and redirects back to the edit page", async () => {
    const agent = createAgent();
    await loginAsStaff(agent);
    const eventId = await createDraftEventAsStaff(agent);

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
    const app = createApp();
    const staffAgent = createAgent(app);
    await loginAsStaff(staffAgent);
    const eventId = await createDraftEventAsStaff(staffAgent);

    const userAgent = createAgent(app);
    await loginAsUser(userAgent);

    const response = await userAgent.get(`/events/${eventId}/edit`);

    expect(response.status).toBe(403);
    expect(response.text).toContain(
      "You are not allowed to edit this event.",
    );
  });

  it("returns 404 when editing a non-existent event", async () => {
    const agent = createAgent();
    await loginAsStaff(agent);

    const response = await agent.get("/events/not-a-real-event-id/edit");

    expect(response.status).toBe(404);
    expect(response.text).toContain("Event not found.");
  });

  it("returns 409 when trying to edit a cancelled event", async () => {
    const agent = createAgent();
    await loginAsStaff(agent);
    const eventId = await createDraftEventAsStaff(agent);

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
    const agent = createAgent();
    await loginAsStaff(agent);
    const eventId = await createDraftEventAsStaff(agent);

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
