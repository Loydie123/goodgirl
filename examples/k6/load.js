import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "2s", target: 5 },
    { duration: "3s", target: 5 },
    { duration: "1s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<400"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:4173";

export default function () {
  // 1. Fetch user list
  const usersRes = http.get(`${BASE_URL}/api/users`, {
    tags: { name: "GET /api/users" },
  });
  check(usersRes, {
    "users status is 200": (r) => r.status === 200,
  });

  // 2. Create item payload
  const payload = JSON.stringify({
    name: `Load Test Item ${Date.now()}-${__VU}-${__ITER}`,
  });
  const params = {
    headers: { "Content-Type": "application/json" },
    tags: { name: "POST /api/items" },
  };

  const createRes = http.post(`${BASE_URL}/api/items`, payload, params);
  check(createRes, {
    "item created status is 201": (r) => r.status === 201,
    "item has created: true": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.created === true;
      } catch {
        return false;
      }
    },
  });

  sleep(0.05);
}
