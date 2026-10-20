import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "2s", target: 5 },
    { duration: "3s", target: 15 },
    { duration: "2s", target: 15 },
    { duration: "1s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.05"],
    checks: ["rate>0.95"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:4173";

export default function () {
  const usersRes = http.get(`${BASE_URL}/api/users`, {
    tags: { name: "GET /api/users" },
  });
  check(usersRes, {
    "users status is 200": (r) => r.status === 200,
  });

  const payload = JSON.stringify({
    name: `Stress Item ${__VU}-${__ITER}`,
  });
  const params = {
    headers: { "Content-Type": "application/json" },
    tags: { name: "POST /api/items" },
  };

  const createRes = http.post(`${BASE_URL}/api/items`, payload, params);
  check(createRes, {
    "item created status is 201": (r) => r.status === 201,
  });

  sleep(0.02);
}
