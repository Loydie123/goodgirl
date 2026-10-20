import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 3,
  duration: "5s",
  thresholds: {
    http_req_duration: ["p(95)<400"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:4173";

export default function () {
  const res1 = http.get(`${BASE_URL}/api/health`);
  check(res1, { "health ok": (r) => r.status === 200 });

  const res2 = http.get(`${BASE_URL}/api/users`);
  check(res2, { "users ok": (r) => r.status === 200 });

  sleep(0.1);
}
