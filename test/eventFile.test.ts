import request from "supertest";
import { createComposedApp } from "../src/composition";

function createAgent() {
  return request.agent(createComposedApp().getExpressApp());
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

describe("event creation HTTP contracts", () => {
  it("creates an event for a staff user and redirects to the event detail page", async () => {
    const agent = createAgent();
    await loginAsStaff(agent);

    const response = await agent.post("/events").type("form").send({
      title: "Sprint 2 Planning Session",
      description: "Plan the test suite and HTMX work.",
      location: "Room 204",
      category: "workshop",
      startDateTime: "2026-05-01T10:00",
      endDateTime: "2026-05-01T11:30",
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
    const agent = createAgent();
    await loginAsUser(agent);

    const response = await agent.post("/events").type("form").send({
      title: "Unauthorized Event",
      description: "A regular user should not be allowed to create this.",
      location: "Room 100",
      category: "social",
      startDateTime: "2026-05-02T10:00",
      endDateTime: "2026-05-02T11:00",
      maxCapacity: "10",
    });

    expect(response.status).toBe(403);
    expect(response.text).toContain("Only organizers can create events.");
  });

  it("returns 400 and the validation message when the title is missing", async () => {
    const agent = createAgent();
    await loginAsStaff(agent);

    const response = await agent.post("/events").type("form").send({
      title: "",
      description: "Missing title should fail validation.",
      location: "Room 101",
      category: "academic",
      startDateTime: "2026-05-03T09:00",
      endDateTime: "2026-05-03T10:00",
      maxCapacity: "20",
    });

    expect(response.status).toBe(400);
    expect(response.text).toContain(
      "Title must be between 1 and 100 characters.",
    );
  });

  it("returns 400 when the event end time is not in the future", async () => {
    const agent = createAgent();
    await loginAsStaff(agent);

    const response = await agent.post("/events").type("form").send({
      title: "Past Event",
      description: "Past events should be rejected on creation.",
      location: "Room 102",
      category: "academic",
      startDateTime: "2026-01-01T09:00",
      endDateTime: "2026-01-01T10:00",
      maxCapacity: "15",
    });

    expect(response.status).toBe(400);
    expect(response.text).toContain("Event end time must be in the future.");
  });
});
