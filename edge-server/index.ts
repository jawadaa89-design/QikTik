/**
 * QikTik Edge Server
 * Runs on venue LAN (Raspberry Pi / NUC) for offline operation.
 *
 * Start: npm run edge:dev
 */

import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import { startSyncLoop, stopSyncLoop } from "../src/lib/sync";
import { enqueuePrint, type PrintJob, type PrinterConfig } from "./print/queue";
import printerConfig from "./print/config.json";

const PORT = parseInt(process.env.EDGE_PORT ?? "4000", 10);
const WS_PORT = parseInt(process.env.EDGE_WS_PORT ?? "4001", 10);

let online = false;

async function checkCloudHealth(): Promise<boolean> {
  const cloudUrl = process.env.CLOUD_SYNC_URL;
  if (!cloudUrl || cloudUrl.includes("yourvenue")) return false;
  try {
    const res = await fetch(`${cloudUrl}/api/v1/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function updateOnlineStatus() {
  online = await checkCloudHealth();
  process.env.EDGE_ONLINE = online ? "true" : "false";
  console.log(`[edge] cloud ${online ? "online" : "offline"}`);
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/health") {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        mode: "edge",
        online,
        port: PORT,
        wsPort: WS_PORT,
        uptime: process.uptime(),
      })
    );
    return;
  }

  if (req.url === "/api/v1/print/test" && req.method === "POST") {
    const job: PrintJob = {
      orderId: "test",
      tableNumber: 0,
      section: "INSIDE",
      orderNumber: 0,
      items: [
        {
          name: "TEST PRINT",
          quantity: 1,
          route: "MAIN_KITCHEN",
        },
      ],
      createdAt: new Date(),
    };
    enqueuePrint(job, printerConfig as PrinterConfig);
    res.writeHead(200);
    res.end(JSON.stringify({ printed: true }));
    return;
  }

  if (req.url === "/api/v1/print" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const job = JSON.parse(body) as PrintJob;
      job.createdAt = new Date(job.createdAt ?? Date.now());
      enqueuePrint(job, printerConfig as PrinterConfig);
      res.writeHead(200);
      res.end(JSON.stringify({ queued: true }));
    } catch {
      res.writeHead(400);
      res.end(JSON.stringify({ error: "Invalid print job" }));
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

const wsServer = createServer();
const io = new SocketServer(wsServer, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log(`[ws] client ${socket.id}`);
  socket.on("subscribe", (room: string) => {
    socket.join(room);
  });
  socket.on("broadcast", (msg: { event: string; payload: unknown; room?: string }) => {
    if (msg.room) io.to(msg.room).emit(msg.event, msg.payload);
    else io.emit(msg.event, msg.payload);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[edge] HTTP server on :${PORT}`);
  updateOnlineStatus();
  setInterval(updateOnlineStatus, 15_000);
  startSyncLoop(async () => []);
});

wsServer.listen(WS_PORT, "0.0.0.0", () => {
  console.log(`[edge] WebSocket (socket.io) on :${WS_PORT}`);
});

process.on("SIGINT", () => {
  stopSyncLoop();
  server.close();
  wsServer.close();
  process.exit(0);
});
