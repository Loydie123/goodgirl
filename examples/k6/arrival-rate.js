import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    constant_rate: {
      executor: "constant-arrival-rate",
      rate: 20,
      timeUnit: "1s",
      duration: "3s",
      preAllocatedVUs: 5,
      maxVUs: 20,
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<300"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:4173";

export default function () {
  const res = http.get(`${BASE_URL}/api/health`, {
    tags: { name: "GET /api/health" },
  });
  check(res, {
    "arrival rate check: status is 200": (r) => r.status === 200,
  });
}
