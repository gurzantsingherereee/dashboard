import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { Product } from "../models/Product.js";
import { Task } from "../models/Task.js";
import { seedProducts, seedTasks } from "../seedData.js";

const dataFile = path.resolve("data/db.json");

function now() {
  return new Date().toISOString();
}

function normalizeProduct(product) {
  const plain = product.toObject ? product.toObject({ versionKey: false }) : product;
  return {
    ...plain,
    id: plain.uid || plain.id || String(plain._id || crypto.randomUUID()),
    _id: undefined
  };
}

function normalizeTask(task) {
  const plain = task.toObject ? task.toObject({ versionKey: false }) : task;
  return {
    ...plain,
    id: plain.uid || plain.id || String(plain._id || crypto.randomUUID()),
    _id: undefined
  };
}

async function readJsonDb() {
  try {
    const raw = await fs.readFile(dataFile, "utf8");
    return JSON.parse(raw);
  } catch {
    const initial = {
      products: seedProducts,
      tasks: seedTasks,
      activity: [{ id: crypto.randomUUID(), text: "Seeded dashboard with initial design data", createdAt: now() }]
    };
    await writeJsonDb(initial);
    return initial;
  }
}

async function writeJsonDb(db) {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(db, null, 2));
}

function addActivity(db, text) {
  db.activity = [{ id: crypto.randomUUID(), text, createdAt: now() }, ...(db.activity || [])].slice(0, 40);
}

function createLocalStore() {
  return {
    mode: "local-json",
    async listProducts() {
      const db = await readJsonDb();
      return db.products;
    },
    async getProduct(id) {
      const db = await readJsonDb();
      return db.products.find((product) => product.id === id);
    },
    async createProduct(input) {
      const db = await readJsonDb();
      const product = { id: crypto.randomUUID(), images: [], source: "manual", createdAt: now(), updatedAt: now(), ...input };
      db.products.unshift(product);
      addActivity(db, `Added product "${product.title}"`);
      await writeJsonDb(db);
      return product;
    },
    async updateProduct(id, input) {
      const db = await readJsonDb();
      const index = db.products.findIndex((product) => product.id === id);
      if (index === -1) return null;
      db.products[index] = { ...db.products[index], ...input, updatedAt: now() };
      addActivity(db, `Updated product "${db.products[index].title}"`);
      await writeJsonDb(db);
      return db.products[index];
    },
    async deleteProduct(id) {
      const db = await readJsonDb();
      const product = db.products.find((item) => item.id === id);
      db.products = db.products.filter((item) => item.id !== id);
      db.tasks = db.tasks.map((task) => (task.productId === id ? { ...task, productId: "all" } : task));
      if (product) addActivity(db, `Removed product "${product.title}"`);
      await writeJsonDb(db);
      return product;
    },
    async appendImages(id, images) {
      const db = await readJsonDb();
      const product = db.products.find((item) => item.id === id);
      if (!product) return null;
      product.images = [...(product.images || []), ...images];
      product.updatedAt = now();
      addActivity(db, `Added ${images.length} image${images.length === 1 ? "" : "s"} to "${product.title}"`);
      await writeJsonDb(db);
      return product;
    },
    async deleteImage(productId, imageId) {
      const db = await readJsonDb();
      const product = db.products.find((item) => item.id === productId);
      if (!product) return null;
      product.images = (product.images || []).filter((image) => image.id !== imageId);
      product.updatedAt = now();
      await writeJsonDb(db);
      return product;
    },
    async upsertProductFromSheet(input) {
      const db = await readJsonDb();
      const sourceKey = input.sourceKey || input.driveLink || input.title;
      const index = db.products.findIndex((product) => product.sourceKey === sourceKey || product.driveLink === input.driveLink);
      if (index === -1) {
        const product = { id: crypto.randomUUID(), ...input, sourceKey, source: "google-sheet", createdAt: now(), updatedAt: now() };
        db.products.unshift(product);
        addActivity(db, `Synced new Sheet product "${product.title}"`);
      } else {
        const existing = db.products[index];
        db.products[index] = {
          ...existing,
          ...input,
          id: existing.id,
          images: mergeImages(existing.images || [], input.images || []),
          sourceKey,
          source: existing.source || "google-sheet",
          lastSyncedAt: now(),
          updatedAt: now()
        };
      }
      await writeJsonDb(db);
    },
    async listTasks() {
      const db = await readJsonDb();
      return db.tasks;
    },
    async createTask(input) {
      const db = await readJsonDb();
      const task = { id: crypto.randomUUID(), status: "To do", ...input, createdAt: now(), updatedAt: now() };
      db.tasks.unshift(task);
      addActivity(db, `Added task "${task.title}"`);
      await writeJsonDb(db);
      return task;
    },
    async updateTask(id, input) {
      const db = await readJsonDb();
      const index = db.tasks.findIndex((task) => task.id === id);
      if (index === -1) return null;
      db.tasks[index] = { ...db.tasks[index], ...input, updatedAt: now() };
      await writeJsonDb(db);
      return db.tasks[index];
    },
    async deleteTask(id) {
      const db = await readJsonDb();
      const task = db.tasks.find((item) => item.id === id);
      db.tasks = db.tasks.filter((item) => item.id !== id);
      await writeJsonDb(db);
      return task;
    },
    async activity() {
      const db = await readJsonDb();
      return db.activity || [];
    }
  };
}

function mergeImages(existing, incoming) {
  const urls = new Set(existing.map((image) => image.url));
  return [...existing, ...incoming.filter((image) => image.url && !urls.has(image.url))];
}

function createMongoStore() {
  const productFilter = (id) => {
    const filters = [{ uid: id }];
    if (mongoose.isValidObjectId(id)) filters.push({ _id: id });
    return { $or: filters };
  };

  return {
    mode: "mongo",
    async listProducts() {
      const products = await Product.find().sort({ updatedAt: -1 });
      return products.map(normalizeProduct);
    },
    async getProduct(id) {
      const product = await Product.findOne(productFilter(id));
      return product ? normalizeProduct(product) : null;
    },
    async createProduct(input) {
      const product = await Product.create({ uid: crypto.randomUUID(), images: [], source: "manual", ...input });
      return normalizeProduct(product);
    },
    async updateProduct(id, input) {
      const product = await Product.findOneAndUpdate(productFilter(id), input, { new: true });
      return product ? normalizeProduct(product) : null;
    },
    async deleteProduct(id) {
      const product = await Product.findOneAndDelete(productFilter(id));
      return product ? normalizeProduct(product) : null;
    },
    async appendImages(id, images) {
      const product = await Product.findOneAndUpdate(productFilter(id), { $push: { images: { $each: images } } }, { new: true });
      return product ? normalizeProduct(product) : null;
    },
    async deleteImage(productId, imageId) {
      const product = await Product.findOneAndUpdate(productFilter(productId), { $pull: { images: { id: imageId } } }, { new: true });
      return product ? normalizeProduct(product) : null;
    },
    async upsertProductFromSheet(input) {
      const sourceKey = input.sourceKey || input.driveLink || input.title;
      const existing = await Product.findOne({ $or: [{ sourceKey }, { driveLink: input.driveLink }] });
      if (!existing) {
        await Product.create({ uid: crypto.randomUUID(), ...input, sourceKey, source: "google-sheet", lastSyncedAt: new Date() });
        return;
      }
      const images = mergeImages(existing.images || [], input.images || []);
      await Product.updateOne({ _id: existing._id }, { ...input, images, sourceKey, lastSyncedAt: new Date() });
    },
    async listTasks() {
      const tasks = await Task.find().sort({ updatedAt: -1 });
      return tasks.map(normalizeTask);
    },
    async createTask(input) {
      const task = await Task.create(input);
      return normalizeTask(task);
    },
    async updateTask(id, input) {
      const task = await Task.findByIdAndUpdate(id, input, { new: true });
      return task ? normalizeTask(task) : null;
    },
    async deleteTask(id) {
      const task = await Task.findByIdAndDelete(id);
      return task ? normalizeTask(task) : null;
    },
    async activity() {
      return [];
    }
  };
}

export async function createStore() {
  if (!process.env.MONGO_URI) return createLocalStore();

  try {
    await mongoose.connect(process.env.MONGO_URI);
    if ((await Product.countDocuments()) === 0) {
      await Product.insertMany(seedProducts.map((product) => ({ ...product, uid: product.id })));
      await Task.insertMany(seedTasks);
    }
    return createMongoStore();
  } catch (error) {
    console.warn(`MongoDB unavailable, using local JSON store: ${error.message}`);
    return createLocalStore();
  }
}
