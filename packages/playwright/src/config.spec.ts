import { describe, expect, it } from "vitest";
import { createPlaywrightConfig } from "./config.js";

describe("createPlaywrightConfig", () => {
  it("creates default configuration with e2e and api projects", () => {
    const config = createPlaywrightConfig("/tmp/test-project");
    expect(config.timeout).toBe(30000);
    expect(config.use?.browserName).toBe("chromium");
    expect(config.use?.video).toBe("off");

    const projectNames = config.projects?.map((p) => p.name);
    expect(projectNames).toEqual(["e2e", "api"]);
  });

  it("configures multi-browser projects when browsers array is provided", () => {
    const config = createPlaywrightConfig("/tmp/test-project", {
      browsers: ["chromium", "firefox", "webkit"],
    });

    const projectNames = config.projects?.map((p) => p.name);
    expect(projectNames).toEqual(["chromium", "firefox", "webkit", "api"]);

    const firefoxProject = config.projects?.find((p) => p.name === "firefox");
    expect(firefoxProject?.use?.browserName).toBe("firefox");
  });

  it("supports custom projects with device presets and custom use settings", () => {
    const config = createPlaywrightConfig("/tmp/test-project", {
      workers: 4,
      fullyParallel: true,
      video: "on",
      use: {
        storageState: "auth.json",
      },
      projects: [
        {
          name: "Mobile Chrome",
          device: "Pixel 5",
        },
        {
          name: "API Suite",
          testMatch: "**/api/**/*.spec.ts",
        },
      ],
    });

    expect(config.workers).toBe(4);
    expect(config.fullyParallel).toBe(true);
    expect(config.use?.video).toBe("on");
    expect(config.use?.storageState).toBe("auth.json");

    const mobile = config.projects?.find((p) => p.name === "Mobile Chrome");
    expect(mobile).toBeDefined();
    expect(mobile?.use?.defaultBrowserType).toBe("chromium");
  });
});
