import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 1,
  duration: "3s",
  thresholds: {
    http_req_duration: ["p(95)<400"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:4173";

export default function () {
  // 1. Health check endpoint
  const healthRes = http.get(`${BASE_URL}/api/health`, {
    tags: { name: "GET /api/health" },
  });
  check(healthRes, {
    "health status is 200": (r) => r.status === 200,
    "service is goodgirl-fixture-server": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === "ok" && body.service === "goodgirl-fixture-server";
      } catch {
        return false;
      }
    },
  });

  // 2. Users endpoint
  const usersRes = http.get(`${BASE_URL}/api/users`, {
    tags: { name: "GET /api/users" },
  });
  check(usersRes, {
    "users status is 200": (r) => r.status === 200,
    "users list has at least 2 users": (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body) && body.length >= 2;
      } catch {
        return false;
      }
    },
  });

  sleep(0.1);
}
