import mongoose from "mongoose";

const ImageSchema = new mongoose.Schema(
  {
    id: String,
    url: String,
    caption: String,
    source: { type: String, default: "manual" },
    uploadedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const ProductSchema = new mongoose.Schema(
  {
    uid: { type: String, index: true },
    title: { type: String, required: true, trim: true },
    date: String,
    time: String,
    driveLink: { type: String, required: true },
    sharedWith: String,
    type: { type: String, default: "Google Drive Folder" },
    channels: [{ type: String, enum: ["ecommerce", "quick", "shared", "design"] }],
    status: { type: String, default: "Ready" },
    images: [ImageSchema],
    notes: String,
    source: { type: String, default: "manual" },
    sourceKey: { type: String, index: true },
    lastSyncedAt: Date
  },
  { timestamps: true }
);

export const Product = mongoose.model("Product", ProductSchema);
