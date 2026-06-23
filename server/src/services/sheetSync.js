import crypto from "node:crypto";
import { parse } from "csv-parse/sync";
import { toDriveThumbnail } from "../seedData.js";

const columnAliases = {
  title: ["product/folder name", "product name", "folder name", "title", "product"],
  driveLink: ["google drive link", "drive link", "link", "folder link", "product link"],
  sharedWith: ["shared with", "owner", "assigned to", "person", "team member"],
  type: ["type", "asset type"],
  date: ["date"],
  time: ["time"],
  channel: ["channel", "team", "audience", "part"],
  status: ["status", "upload status"],
  imageUrls: ["image url", "image urls", "preview", "preview image", "thumbnail", "images", "image link", "image links"]
};

function getCsvUrl() {
  if (process.env.GOOGLE_SHEET_CSV_URL) return process.env.GOOGLE_SHEET_CSV_URL;
  if (!process.env.GOOGLE_SHEET_ID) return "";
  const gid = process.env.GOOGLE_SHEET_GID || "0";
  return `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/export?format=csv&gid=${gid}`;
}

function find(row, key) {
  const normalized = Object.fromEntries(Object.entries(row).map(([name, value]) => [normalizeHeader(name), value]));
  for (const alias of columnAliases[key] || []) {
    const value = normalized[normalizeHeader(alias)];
    if (value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function inferChannel(row) {
  const explicit = find(row, "channel").toLowerCase();
  if (explicit.includes("quick") || explicit.includes("instamart") || explicit.includes("cred")) return "quick";
  if (explicit.includes("ecom") || explicit.includes("amazon")) return "ecommerce";
  const shared = find(row, "sharedWith").toLowerCase();
  if (shared.includes("instamart") || shared.includes("cred") || shared.includes("listing")) return "quick";
  if (shared.includes("amazon")) return "ecommerce";
  return "shared";
}

function imagesFrom(row, driveLink) {
  const raw = find(row, "imageUrls");
  const urls = raw
    ? raw.split(/[\n,]+/).map((url) => url.trim()).filter(Boolean)
    : [];
  if (!urls.length && driveLink.includes("/file/d/")) urls.push(toDriveThumbnail(driveLink));
  return urls.map((url) => ({
    id: crypto.randomUUID(),
    url,
    caption: "Sheet preview",
    source: "google-sheet"
  }));
}

function rowToProduct(row) {
  const title = find(row, "title");
  const driveLink = find(row, "driveLink");
  if (!title || !driveLink) return null;
  return {
    title,
    driveLink,
    date: find(row, "date"),
    time: find(row, "time"),
    sharedWith: find(row, "sharedWith"),
    type: find(row, "type") || "Google Drive Folder",
    channels: [inferChannel(row)],
    status: find(row, "status") || "Ready",
    images: imagesFrom(row, driveLink),
    source: "google-sheet",
    sourceKey: driveLink,
    lastSyncedAt: new Date().toISOString()
  };
}

export async function syncSheet(store) {
  const csvUrl = getCsvUrl();
  if (!csvUrl) {
    return { ok: false, imported: 0, skipped: 0, message: "No Google Sheet CSV URL configured." };
  }

  const response = await fetch(csvUrl);
  if (!response.ok) {
    return { ok: false, imported: 0, skipped: 0, message: `Sheet fetch failed: ${response.status}` };
  }

  const csv = await response.text();
  const records = parse(csv, { columns: true, skip_empty_lines: true, relax_column_count: true, trim: true });
  let imported = 0;
  let skipped = 0;

  for (const row of records) {
    const product = rowToProduct(row);
    if (!product) {
      skipped += 1;
      continue;
    }
    await store.upsertProductFromSheet(product);
    imported += 1;
  }

  return { ok: true, imported, skipped, message: `Synced ${imported} product${imported === 1 ? "" : "s"} from Google Sheet.` };
}
