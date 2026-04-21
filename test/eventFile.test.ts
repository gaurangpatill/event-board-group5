import request from "supertest";
import app from "../src/app";

describe("Category and Date Filter", () => {
  describe("GET /events", () => {
    it("returns events page", async () => {
      const res = await request(app).get("/events");

      expect(res.status).toBe(200);
      expect(res.text).toContain("Events");
    });
  });
});