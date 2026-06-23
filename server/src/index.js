import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import productsRouter from "./routes/products.js";
import tasksRouter from "./routes/tasks.js";
import syncRouter from "./routes/sync.js";
import { createStore } from "./services/store.js";
import { syncSheet } from "./services/sheetSync.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 5050);

process.env.DESIGN_ACCESS_CODE ||= "001Mutant";
app.locals.store = await createStore();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

app.get("/api/health", async (_req, res) => {
  res.json({ ok: true, mode: app.locals.store.mode, time: new Date().toISOString() });
});
app.get("/api/activity", async (req, res) => {
  res.json(await req.app.locals.store.activity());
});
app.use("/api/products", productsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/sync", syncRouter);

const intervalMinutes = Number(process.env.SHEET_SYNC_INTERVAL_MINUTES || 0);
if ((process.env.GOOGLE_SHEET_CSV_URL || process.env.GOOGLE_SHEET_ID) && intervalMinutes > 0) {
  syncSheet(app.locals.store).then((result) => console.log(result.message)).catch((error) => console.warn(error.message));
  setInterval(() => {
    syncSheet(app.locals.store).then((result) => console.log(result.message)).catch((error) => console.warn(error.message));
  }, intervalMinutes * 60 * 1000);
}

app.listen(port, () => {
  console.log(`Design dashboard API running on http://localhost:${port} (${app.locals.store.mode})`);
});
