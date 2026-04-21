import request from "supertest";
import app from "../src/app";

describe("Category and Date Filter", () => {
  describe("GET /events", () => {
    it("returns events page", async () => {
      const res = await request(app).get("/events");

      expect(res.status).toBe(200);
      expect(res.text).toContain("Events");
    });

    it("filters events by category", async () => {
        const res = await request(app).get("/events?category=music");

        expect(res.status).toBe(200);
        expect(res.text).toContain("music");
    });

    it("filters events by timeframe (this-week)", async () => {
        const res = await request(app).get("/events?timeframe=this-week");
        expect(res.status).toBe(200);
    });







  });
});