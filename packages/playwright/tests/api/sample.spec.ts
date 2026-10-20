import { test, expect } from "@playwright/test";

test.describe("GoodGirl API Smoke Suite", () => {
  test("GET /api/health returns 200 and conforms to health schema", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      status: "ok",
      service: "goodgirl-fixture-server",
    });
    expect(typeof body.timestamp).toBe("string");
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  test("GET /api/users returns 200 and list of test users", async ({ request }) => {
    const response = await request.get("/api/users");
    expect(response.status()).toBe(200);

    const users = await response.json();
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
    expect(users[0]).toHaveProperty("id");
    expect(users[0]).toHaveProperty("name");
    expect(users[0]).toHaveProperty("role");
  });

  test("POST /api/items creates item and returns 201 when payload is valid", async ({ request }) => {
    const response = await request.post("/api/items", {
      data: { name: "Smoke Item Alpha" },
    });
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.created).toBe(true);
    expect(body.name).toBe("Smoke Item Alpha");
    expect(body.id).toBe(101);
  });

  test("POST /api/items returns 400 with validation error when payload is empty or invalid", async ({
    request,
  }) => {
    const response = await request.post("/api/items", {
      data: {},
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Name is required");
    expect(body.code).toBe("VALIDATION_FAILED");
  });
});
