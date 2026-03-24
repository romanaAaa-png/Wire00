import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Client } from "ssh2";
import { WebSocketServer } from "ws";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // SSH Execution Endpoint (for one-off commands)
  app.post("/api/ssh/execute", (req, res) => {
    const { host, port, username, password, privateKey, command } = req.body;
    console.log(`[SSH] Request for host: ${host}, user: ${username}, command: ${command.substring(0, 50)}${command.length > 50 ? '...' : ''}`);

    if (!host || !username || (!password && !privateKey)) {
      console.error(`[SSH] Missing credentials for ${host}`);
      return res.status(400).json({ error: "Missing SSH credentials" });
    }

    const conn = new Client();
    let output = "";
    let errorOutput = "";
    let hasResponded = false;

    const sendResponse = (status: number, data: any) => {
      if (!hasResponded) {
        hasResponded = true;
        res.status(status).json(data);
      }
    };

    // Set a global timeout for the entire request
    const timeout = setTimeout(() => {
      if (!hasResponded) {
        console.error(`[SSH] Request timed out for ${host}`);
        conn.end();
        sendResponse(504, { error: "SSH Request Timed Out (60s)" });
      }
    }, 60000);

    conn.on("ready", () => {
      console.log(`[SSH] Connection ready for ${host}`);
      conn.exec(command, (err, stream) => {
        if (err) {
          console.error(`[SSH] Exec Error for ${host}: ${err.message}`);
          clearTimeout(timeout);
          conn.end();
          return sendResponse(500, { error: err.message });
        }
        stream
          .on("close", (code: number, signal: string) => {
            console.log(`[SSH] Stream closed for ${host} with code ${code}`);
            clearTimeout(timeout);
            conn.end();
            sendResponse(200, { stdout: output, stderr: errorOutput, code, signal });
          })
          .on("data", (data: Buffer) => {
            output += data.toString();
          })
          .stderr.on("data", (data: Buffer) => {
            errorOutput += data.toString();
          });
      });
    })
    .on("error", (err) => {
      console.error(`[SSH] Connection Error for ${host}: ${err.message}`);
      clearTimeout(timeout);
      sendResponse(500, { error: err.message });
    })
    .on("timeout", () => {
      console.error(`[SSH] Connection Timeout for ${host}`);
      clearTimeout(timeout);
      sendResponse(504, { error: "SSH Connection Timeout" });
    })
    .connect({
      host,
      port: port || 22,
      username,
      password,
      privateKey,
      readyTimeout: 20000, // 20 seconds to reach "ready" state
      keepaliveInterval: 10000,
      keepaliveCountMax: 3,
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // WebSocket Server for Terminal
  const wss = new WebSocketServer({ server, path: "/terminal" });

  wss.on("connection", (ws) => {
    console.log("[WS] New terminal connection");
    const conn = new Client();
    let shellStream: any = null;

    ws.on("message", (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "connect") {
          const { host, port, username, password, privateKey } = data.config;
          console.log(`[WS] Connecting to ${host}...`);
          conn
            .on("ready", () => {
              console.log(`[WS] Connection ready for ${host}`);
              conn.shell({ term: 'xterm-256color' }, (err, stream) => {
                if (err) {
                  ws.send(JSON.stringify({ type: "error", message: err.message }));
                  return;
                }
                shellStream = stream;
                stream.on("data", (chunk: Buffer) => {
                  ws.send(JSON.stringify({ type: "data", data: chunk.toString() }));
                });
                stream.on("close", () => {
                  console.log(`[WS] Shell closed for ${host}`);
                  conn.end();
                  ws.close();
                });
              });
            })
            .on("error", (err) => {
              console.error(`[WS] SSH Error for ${host}: ${err.message}`);
              ws.send(JSON.stringify({ type: "error", message: err.message }));
            })
            .connect({
              host,
              port: port || 22,
              username,
              password,
              privateKey,
              readyTimeout: 20000,
            });
        } else if (data.type === "data") {
          if (shellStream) {
            shellStream.write(data.data);
          }
        } else if (data.type === "resize") {
          if (shellStream) {
            shellStream.setWindow(data.rows, data.cols, data.height, data.width);
          }
        }
      } catch (err: any) {
        console.error("[WS] Message error:", err.message);
      }
    });

    ws.on("close", () => {
      console.log("[WS] Terminal connection closed");
      if (shellStream) shellStream.end();
      conn.end();
    });
  });
}

startServer();
