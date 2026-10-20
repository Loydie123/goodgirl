import { describe, expect, it } from "vitest";
import { normalizeCrossPlatformPath, resolveConfigPath } from "./paths.js";
import { join } from "node:path";

describe("paths utility", () => {
  it("normalizes cross-platform paths", () => {
    const raw = join("foo", "bar", "..", "baz");
    expect(normalizeCrossPlatformPath(raw)).toContain("baz");
  });

  it("returns null when config path does not exist", () => {
    const nonexistent = resolveConfigPath(process.cwd(), "nonexistent-config.ts");
    expect(nonexistent).toBeNull();
  });
});
