import dotenv from "dotenv";
if (process.env.NODE_ENV !== "production") dotenv.config();

import express from "express";
import http from "http";
import { initSocket } from "./websocket/socket";
import { router } from "./routes/index";

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use("/api", router);

app.get("/health", (_req, res) => res.json({ ok: true }));

initSocket(server);

const PORT = process.env.PORT ?? 3000;
server.listen(PORT, () => console.log(`DefendX listening on :${PORT}`));