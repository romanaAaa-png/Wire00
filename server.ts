import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Client } from "ssh2";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // SSH Execution Endpoint
  app.post("/api/ssh/execute", (req, res) => {
    const { host, port, username, password, privateKey, command } = req.body;

    if (!host || !username || (!password && !privateKey)) {
      return res.status(400).json({ error: "Missing SSH credentials" });
    }

    const conn = new Client();
    let output = "";
    let errorOutput = "";

    conn.on("ready", () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          return res.status(500).json({ error: err.message });
        }
        stream
          .on("close", (code, signal) => {
            conn.end();
            res.json({ output, errorOutput, code, signal });
          })
          .on("data", (data: Buffer) => {
            output += data.toString();
          })
          .stderr.on("data", (data: Buffer) => {
            errorOutput += data.toString();
          });
      });
    }).on("error", (err) => {
      res.status(500).json({ error: err.message });
    }).connect({
      host,
      port: port || 22,
      username,
      password,
      privateKey,
      readyTimeout: 20000,
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
