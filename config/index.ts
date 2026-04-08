import dotenv from "dotenv";
import axios from "axios";

if (process.env.NODE_ENV !== "production") dotenv.config();

export const PORT = process.env.PORT || 3000;

// Loki Configs
export const LOKI_ADDR = process.env.LOKI_ADDR;
export const LOKI_AUTH = {
    username: process.env.LOKI_USERNAME || "",
    password: process.env.LOKI_PASSWORD || "",
};
//loki client
export const lokiClient = axios.create({
    baseURL: LOKI_ADDR,
    auth: LOKI_AUTH,
    headers: { "Content-Type": "application/json" },
    timeout: 10000,
});

//openrouter client
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
export const OPENROUTER_MODEL = "openai/gpt-4o";

export const commanderClient = axios.create({
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000", 
        "X-Title": "DefendX Commander",        
    },
    timeout: 60000, // Increased to 60s since LLM analysis takes time
});