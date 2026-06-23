import express from "express";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";

const router = express.Router();
const storage = multer.diskStorage({
  destination: "uploads",
  filename(_req, file, callback) {
    const ext = path.extname(file.originalname || "");
    callback(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  }
});
const upload = multer({ storage });

function parseList(value, fallback = []) {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return String(value).split(",").map((item) => item.trim()).filter(Boolean);
  }
}

function payload(body) {
  return {
    title: body.title,
    date: body.date,
    time: body.time,
    driveLink: body.driveLink,
    sharedWith: body.sharedWith,
    type: body.type || "Google Drive Folder",
    channels: parseList(body.channels, ["shared"]),
    status: body.status || "Ready",
    notes: body.notes || ""
  };
}

function fileImages(req) {
  return (req.files || []).map((file) => ({
    id: crypto.randomUUID(),
    url: `/uploads/${file.filename}`,
    caption: file.originalname,
    source: "upload",
    uploadedAt: new Date().toISOString()
  }));
}

function urlImages(body) {
  return parseList(body.imageUrls).map((url) => ({
    id: crypto.randomUUID(),
    url,
    caption: "Manual preview",
    source: "manual",
    uploadedAt: new Date().toISOString()
  }));
}

router.get("/", async (req, res) => {
  res.json(await req.app.locals.store.listProducts());
});

router.post("/", upload.array("images"), async (req, res) => {
  const product = await req.app.locals.store.createProduct({
    ...payload(req.body),
    images: [...fileImages(req), ...urlImages(req.body)]
  });
  res.status(201).json(product);
});

router.put("/:id", upload.array("images"), async (req, res) => {
  const product = await req.app.locals.store.updateProduct(req.params.id, payload(req.body));
  if (!product) return res.status(404).json({ error: "Product not found" });
  const images = [...fileImages(req), ...urlImages(req.body)];
  if (images.length) return res.json(await req.app.locals.store.appendImages(req.params.id, images));
  res.json(product);
});

router.delete("/:id", async (req, res) => {
  const product = await req.app.locals.store.deleteProduct(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json({ ok: true });
});

router.post("/:id/images", upload.array("images"), async (req, res) => {
  const product = await req.app.locals.store.appendImages(req.params.id, [...fileImages(req), ...urlImages(req.body)]);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

router.delete("/:id/images/:imageId", async (req, res) => {
  const product = await req.app.locals.store.deleteImage(req.params.id, req.params.imageId);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

export default router;
