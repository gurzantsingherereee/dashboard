import express from "express";

const router = express.Router();

function requireDesign(req, res, next) {
  if (req.header("x-design-code") !== process.env.DESIGN_ACCESS_CODE) {
    return res.status(403).json({ error: "Design access required" });
  }
  next();
}

router.use(requireDesign);

router.get("/", async (req, res) => {
  res.json(await req.app.locals.store.listTasks());
});

router.post("/", async (req, res) => {
  res.status(201).json(await req.app.locals.store.createTask(req.body));
});

router.patch("/:id", async (req, res) => {
  const task = await req.app.locals.store.updateTask(req.params.id, req.body);
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json(task);
});

router.delete("/:id", async (req, res) => {
  const task = await req.app.locals.store.deleteTask(req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json({ ok: true });
});

export default router;
