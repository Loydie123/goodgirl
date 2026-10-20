import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startFixtureServer, type FixtureServerInstance } from "./fixture-server.js";

describe("GoodGirl Fixture Server", () => {
  let instance: FixtureServerInstance;

  beforeAll(async () => {
    // Port 0 picks any available ephemeral port
    instance = await startFixtureServer(0);
  });

  afterAll(async () => {
    await instance.close();
  });

  it("serves HTML homepage with heading", async () => {
    const res = await fetch(`${instance.url}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("GoodGirl QA Test Bench");
    expect(html).toContain("action-btn");
  });

  it("serves /api/health with status ok", async () => {
    const res = await fetch(`${instance.url}/api/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  it("handles valid POST /api/items with 201", async () => {
    const res = await fetch(`${instance.url}/api/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Unit Test Item" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { created: boolean; name: string };
    expect(body.created).toBe(true);
    expect(body.name).toBe("Unit Test Item");
  });

  it("rejects invalid POST /api/items with 400", async () => {
    const res = await fetch(`${instance.url}/api/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Name is required");
  });
});
