import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Client } from "ssh2";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // SSH Execution Endpoint
  app.post("/api/ssh/execute", (req, res) => {
    console.log(`SSH Request for host: ${req.body.host}`);
    const { host, port, username, password, privateKey, command } = req.body;

    if (!host || !username || (!password && !privateKey)) {
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

    conn.on("ready", () => {
      console.log(`SSH Connection ready for ${host}`);
      conn.exec(command, (err, stream) => {
        if (err) {
          console.error(`SSH Exec Error for ${host}: ${err.message}`);
          conn.end();
          return sendResponse(500, { error: err.message });
        }
        stream
          .on("close", (code: number, signal: string) => {
            console.log(`SSH Stream closed for ${host} with code ${code}`);
            conn.end();
            sendResponse(200, { output, errorOutput, code, signal });
          })
          .on("data", (data: Buffer) => {
            output += data.toString();
          })
          .stderr.on("data", (data: Buffer) => {
            errorOutput += data.toString();
          });
      });
    }).on("error", (err) => {
      console.error(`SSH Connection Error for ${host}: ${err.message}`);
      sendResponse(500, { error: err.message });
    }).connect({
      host,
      port: port || 22,
      username,
      password,
      privateKey,
      readyTimeout: 30000,
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
