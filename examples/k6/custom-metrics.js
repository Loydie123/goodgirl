import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter, Gauge } from "k6/metrics";

// Custom metrics definition
const itemCreationTime = new Trend("item_creation_duration");
const businessSuccessRate = new Rate("business_operation_success");
const totalItemsCreated = new Counter("total_items_created");
const activePoolSize = new Gauge("simulated_pool_size");

export const options = {
  vus: 2,
  duration: "3s",
  thresholds: {
    item_creation_duration: ["p(95)<400"],
    business_operation_success: ["rate>0.95"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:4173";

export default function () {
  activePoolSize.add(__VU * 2);

  const start = Date.now();
  const payload = JSON.stringify({ name: `Custom Metric Item ${__VU}-${__ITER}` });
  const params = {
    headers: { "Content-Type": "application/json" },
  };

  const res = http.post(`${BASE_URL}/api/items`, payload, params);
  const latency = Date.now() - start;

  itemCreationTime.add(latency);

  const ok = check(res, {
    "item created 201": (r) => r.status === 201,
  });

  businessSuccessRate.add(ok ? 1 : 0);
  if (ok) {
    totalItemsCreated.add(1);
  }

  sleep(0.05);
}
