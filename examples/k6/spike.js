import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "1s", target: 2 },
    { duration: "1s", target: 20 },
    { duration: "2s", target: 20 },
    { duration: "1s", target: 2 },
    { duration: "1s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<600"],
    http_req_failed: ["rate<0.10"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:4173";

export default function () {
  const res = http.get(`${BASE_URL}/api/health`, {
    tags: { name: "GET /api/health" },
  });
  check(res, {
    "status is 200 during spike": (r) => r.status === 200,
  });

  sleep(0.05);
}
