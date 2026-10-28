import { describe, expect, it } from "vitest";
import {
  extractTargetUrls,
  isAllowedHost,
  validateScriptTargetSafety,
} from "./safety.js";
import { join } from "node:path";
import { writeFileSync, unlinkSync } from "node:fs";

describe("k6 Target Safety & Allowlist", () => {
  it("extracts target URLs from script content", () => {
    const script = `
      import http from 'k6/http';
      export default function() {
        http.get('http://127.0.0.1:4173/api/health');
        http.post('http://localhost:8080/submit');
        http.get('https://example.com/data');
      }
    `;
    const urls = extractTargetUrls(script);
    expect(urls).toContain("http://127.0.0.1:4173/api/health");
    expect(urls).toContain("http://localhost:8080/submit");
    expect(urls).toContain("https://example.com/data");
  });

  it("identifies localhost and 127.0.0.1 as allowed hosts by default", () => {
    expect(isAllowedHost("127.0.0.1")).toBe(true);
    expect(isAllowedHost("localhost")).toBe(true);
    expect(isAllowedHost("::1")).toBe(true);
    expect(isAllowedHost("0.0.0.0")).toBe(true);
    expect(isAllowedHost("api.production.com")).toBe(false);
  });

  it("supports custom allowlist domains", () => {
    const customAllowed = ["127.0.0.1", "localhost", "test.k6.io", ".internal.company.com"];
    expect(isAllowedHost("test.k6.io", customAllowed)).toBe(true);
    expect(isAllowedHost("service.internal.company.com", customAllowed)).toBe(true);
    expect(isAllowedHost("external.org", customAllowed)).toBe(false);
  });

  it("blocks external targets if not authorized", () => {
    const tempFile = join(process.cwd(), "temp-safety-test.js");
    writeFileSync(tempFile, `http.get('https://external-target.com/api');`);

    try {
      const result = validateScriptTargetSafety(tempFile, { allowExternal: false });
      expect(result.safe).toBe(false);
      expect(result.blockedTargets).toContain("https://external-target.com/api");
      expect(result.reason).toContain("explicit authorization");
    } finally {
      unlinkSync(tempFile);
    }
  });

  it("permits external targets when explicitly authorized", () => {
    const tempFile = join(process.cwd(), "temp-safety-allowed.js");
    writeFileSync(tempFile, `http.get('https://external-target.com/api');`);

    try {
      const result = validateScriptTargetSafety(tempFile, { allowExternal: true });
      expect(result.safe).toBe(true);
      expect(result.blockedTargets.length).toBe(0);
    } finally {
      unlinkSync(tempFile);
    }
  });

  it("inspects CLI environment variable URLs for non-local targets", () => {
    const tempFile = join(process.cwd(), "temp-safety-env.js");
    writeFileSync(tempFile, `http.get((__ENV.BASE_URL || 'http://127.0.0.1:4173') + '/api/health');`);

    try {
      const blockedResult = validateScriptTargetSafety(tempFile, {
        allowExternal: false,
        env: { BASE_URL: "https://staging.external-target.com" },
      });
      expect(blockedResult.safe).toBe(false);
      expect(blockedResult.blockedTargets).toContain("https://staging.external-target.com");

      const allowedResult = validateScriptTargetSafety(tempFile, {
        allowExternal: true,
        env: { BASE_URL: "https://staging.external-target.com" },
      });
      expect(allowedResult.safe).toBe(true);
    } finally {
      unlinkSync(tempFile);
    }
  });
});
