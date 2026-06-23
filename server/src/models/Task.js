import mongoose from "mongoose";

const TaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    owner: { type: String, required: true },
    productId: { type: String, default: "all" },
    priority: { type: String, enum: ["High", "Medium", "Low"], default: "Medium" },
    due: String,
    status: { type: String, enum: ["To do", "In review", "Blocked", "Done"], default: "To do" }
  },
  { timestamps: true }
);

export const Task = mongoose.model("Task", TaskSchema);
