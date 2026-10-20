import { test, expect } from "@playwright/test";

test.describe("Sample Project - REST API Contract Suite", () => {
  test("GET /api/health returns 200 and validates health schema", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("status", "ok");
    expect(data).toHaveProperty("service", "goodgirl-fixture-server");
    expect(typeof data.timestamp).toBe("string");
  });

  test("GET /api/users returns 200 and schema with user records", async ({ request }) => {
    const response = await request.get("/api/users");
    expect(response.status()).toBe(200);

    const users = await response.json();
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
    for (const u of users) {
      expect(typeof u.id).toBe("number");
      expect(typeof u.name).toBe("string");
      expect(typeof u.role).toBe("string");
    }
  });

  test("POST /api/items creates item and returns 201 on valid body", async ({ request }) => {
    const payload = { name: "Automated QA Verification Item" };
    const response = await request.post("/api/items", {
      data: payload,
    });
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.created).toBe(true);
    expect(body.name).toBe(payload.name);
    expect(typeof body.id).toBe("number");
  });

  test("POST /api/items rejects payload without name with 400", async ({ request }) => {
    const response = await request.post("/api/items", {
      data: {},
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty("error", "Name is required");
    expect(body).toHaveProperty("code", "VALIDATION_FAILED");
  });
});
