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

describe("event creation HTMX contracts", () => {
  it("returns a success fragment for a valid HTMX create request", async () => {
    const agent = createAgent();
    await loginAsStaff(agent);

    const response = await agent
      .post("/events")
      .set("HX-Request", "true")
      .type("form")
      .send({
        title: "HTMX Event",
        description: "Created through an HTMX request.",
        location: "Room 204",
        category: "workshop",
        startDateTime: "2026-05-01T10:00",
        endDateTime: "2026-05-01T11:30",
        maxCapacity: "25",
      });

    expect(response.status).toBe(200);
    expect(response.text).toContain('id="event-create-form"');
    expect(response.text).toContain("Event Created");
    expect(response.text).toContain("HTMX Event");
    expect(response.text).toContain("View Event");
  });

  it("returns the form fragment with validation errors for an invalid HTMX create request", async () => {
    const agent = createAgent();
    await loginAsStaff(agent);

    const response = await agent
      .post("/events")
      .set("HX-Request", "true")
      .type("form")
      .send({
        title: "",
        description: "Missing title should fail validation.",
        location: "Room 101",
        category: "academic",
        startDateTime: "2026-05-03T09:00",
        endDateTime: "2026-05-03T10:00",
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
