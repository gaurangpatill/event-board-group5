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

    it("applies category and timeframe together", async () => {
        const res = await request(app)
            .get("/events?category=tech&timeframe=this-week");

        expect(res.status).toBe(200);
    });

    it("returns 400 for invalid category", async () => {
        const res = await request(app).get("/events?category=INVALID");

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("InvalidInputError");
    });

    it("returns 400 for invalid timeframe", async () => {
        const res = await request(app).get("/events?timeframe=bad");

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("InvalidInputError");
    });



  });
});