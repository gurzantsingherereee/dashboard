import express from "express";
import { syncSheet } from "../services/sheetSync.js";

const router = express.Router();

router.post("/sheet", async (req, res) => {
  try {
    res.json(await syncSheet(req.app.locals.store));
  } catch (error) {
    res.status(500).json({ ok: false, imported: 0, skipped: 0, message: error.message });
  }
});

export default router;
