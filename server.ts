import dotenv from "dotenv";
if (process.env.NODE_ENV !== "production") dotenv.config();
import express from "express";
import http from "http";
import { initSocket } from "./websocket/socket";
import { router } from "./routes/index";
import morgan from "morgan";
const app = express();
const server = http.createServer(app);

app.use(morgan("dev"));
app.use(express.json());
app.get("/", (req, res) => {
    return res.send("DefendX API are running healthy...");
})
app.use("/api", router);

app.get("/health", (_req, res) => res.json({ ok: true }));

// const DOMAINS = ["http", "infra", "auth"] as const;
// 🧪 Simple OpenRouter Connectivity Test
// app.post("/test/ai", async (req, res) => {
//   console.log("🤖 [TEST] AI connection started...");

//   try {
//     const response = await commanderClient.post("/chat/completions", {
//       model: OPENROUTER_MODEL,
//       messages: [
//         {
//           role: "user",
//           content: "Respond with the result of 2 + 2. Only return the number."
//         },
//       ],
//       // Keep it cheap and fast
//       max_tokens: 10,
//       temperature: 0,
//     });

//     const answer = response.data.choices[0].message.content.trim();

//     console.log(`✅ [AI TEST SUCCESS] Answer: ${answer}`);

//     res.json({
//       success: true,
//       model_used: OPENROUTER_MODEL,
//       result: answer,
//       full_response: response.data
//     });

//   } catch (err: any) {
//     // Detailed error logging to catch that 402 or key issues
//     const statusCode = err.response?.status;
//     const errorData = err.response?.data;

//     console.error(`❌ [AI TEST FAILED] Status: ${statusCode}`);
//     console.error("Error Detail:", JSON.stringify(errorData, null, 2));

//     res.status(statusCode || 500).json({
//       success: false,
//       status: statusCode,
//       error: err.message,
//       details: errorData
//     });
//   }

initSocket(server);

const PORT = process.env.PORT ?? 3000;
server.listen(PORT, () => console.log(`DefendX listening on :${PORT}`));