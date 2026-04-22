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

describe("event editing HTMX contracts", () => {
  it("returns a success fragment for a valid HTMX edit request", async () => {
    const agent = createAgent();
    await loginAsStaff(agent);
    const eventId = await createDraftEventAsStaff(agent);

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
    const agent = createAgent();
    await loginAsStaff(agent);
    const eventId = await createDraftEventAsStaff(agent);

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
