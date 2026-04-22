import { CreateEventService } from "../src/service/EventService";
import { CreateInMemoryEventRepository } from "../src/repository/InMemoryEventRepository";
import type { IEventRepository } from "../src/repository/EventRepository";
import type { IAuthenticatedUser } from "../src/auth/User";
import type { IEventRecord } from "../src/lib/event";

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

describe("Category and Date Filter", () => {

  describe("GET /events with no filters", () => {
    it("returns all published events when no filters are applied", async () => {
      const repo    = CreateInMemoryEventRepository();
      const service = CreateEventService(repo);

      const start = daysFromNow(3);
      await seedPublished(repo, { title: "Published Event", startDateTime: start, endDateTime: new Date(start.getTime() + 3_600_000) });

      const result = await service.listEvents(member);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBeGreaterThanOrEqual(1);
    });

    it("does not return unpublished events", async () => {
      const repo    = CreateInMemoryEventRepository();
      const service = CreateEventService(repo);

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
      const service = CreateEventService(repo);

      const result = await service.listEvents(member, { category: "" as any, timeframe: "" as any });

      expect(result.ok).toBe(true);
    });
  });

  describe("GET /events filtered by category", () => {
    it("returns only events matching the requested category", async () => {
      const repo    = CreateInMemoryEventRepository();
      const service = CreateEventService(repo);

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
      const service = CreateEventService(repo);

      const result = await service.listEvents(member, { category: "workshop" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(0);
    });

    it("returns EventValidationError for an invalid category", async () => {
      const repo    = CreateInMemoryEventRepository();
      const service = CreateEventService(repo);

      const result = await service.listEvents(member, { category: "INVALID" as any });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.value.name).toBe("EventValidationError");
    });
  });

  describe("GET /events filtered by timeframe", () => {
    it("filters events by timeframe = this_week", async () => {
      const repo    = CreateInMemoryEventRepository();
      const service = CreateEventService(repo);

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
      const service = CreateEventService(repo);

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
      const service = CreateEventService(repo);

      const result = await service.listEvents(member, { timeframe: "invalid-time" as any });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.value.name).toBe("EventValidationError");
    });
  });

  describe("GET /events with both category and timeframe filters", () => {
    it("applies both category and timeframe filters together", async () => {
      const repo    = CreateInMemoryEventRepository();
      const service = CreateEventService(repo);

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