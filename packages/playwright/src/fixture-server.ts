import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export interface FixtureServerInstance {
  server: Server;
  port: number;
  url: string;
  close: () => Promise<void>;
}

const HTML_BODY = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GoodGirl QA Test Bench</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
      color: #333;
    }
    h1 { color: #0969da; }
    button {
      background-color: #2da44e;
      color: white;
      border: none;
      padding: 10px 20px;
      font-size: 16px;
      border-radius: 6px;
      cursor: pointer;
    }
    button:hover { background-color: #2c974b; }
    #status-message {
      margin-top: 16px;
      padding: 12px;
      background: #f6f8fa;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <h1>GoodGirl QA Test Bench</h1>
  <p>Local hermetic test application for cross-platform E2E and API testing.</p>
  <button id="action-btn">Trigger Action</button>
  <div id="status-message">Awaiting User Interaction</div>

  <script>
    document.getElementById("action-btn").addEventListener("click", () => {
      document.getElementById("status-message").innerText = "Action completed successfully!";
    });
  </script>
</body>
</html>
`;

function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

export function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
  const pathname = url.pathname;
  const method = req.method?.toUpperCase() ?? "GET";

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  // HTML Homepage
  if (pathname === "/" && method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(HTML_BODY);
    return;
  }

  // API Health Check
  if (pathname === "/api/health" && method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        status: "ok",
        service: "goodgirl-fixture-server",
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }

  // API Users List
  if (pathname === "/api/users" && method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify([
        { id: 1, name: "Alice QA", role: "lead" },
        { id: 2, name: "Bob Automation", role: "tester" },
      ]),
    );
    return;
  }

  // API Items Create
  if (pathname === "/api/items" && method === "POST") {
    parseJsonBody(req)
      .then((data) => {
        const payload = data as Record<string, unknown>;
        if (!payload || typeof payload.name !== "string" || !payload.name.trim()) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: "Name is required",
              code: "VALIDATION_FAILED",
            }),
          );
          return;
        }

        res.statusCode = 201;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            id: 101,
            name: payload.name.trim(),
            created: true,
            timestamp: new Date().toISOString(),
          }),
        );
      })
      .catch(() => {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid JSON format" }));
      });
    return;
  }

  // 404 Not Found
  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "Endpoint not found" }));
}

export function startFixtureServer(
  port = 4173,
  host = "127.0.0.1",
): Promise<FixtureServerInstance> {
  return new Promise((resolve, reject) => {
    const server = createServer(handleRequest);

    server.listen(port, host, () => {
      const address = server.address();
      const actualPort =
        typeof address === "object" && address !== null ? address.port : port;
      const url = `http://${host}:${actualPort}`;

      resolve({
        server,
        port: actualPort,
        url,
        close: () =>
          new Promise<void>((closeResolve, closeReject) => {
            server.close((err) => (err ? closeReject(err) : closeResolve()));
          }),
      });
    });

    server.on("error", reject);
  });
}

// Allow standalone execution: node fixture-server.js [port]
if (process.argv[1]?.endsWith("fixture-server.js") || process.argv[1]?.endsWith("fixture-server.ts")) {
  const portArg = Number.parseInt(process.argv[2] ?? "4173", 10);
  startFixtureServer(portArg).then(({ url }) => {
    console.log(`GoodGirl Fixture Server running at ${url}`);
  });
}
