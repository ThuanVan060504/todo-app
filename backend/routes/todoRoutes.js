const express = require("express");
const Todo = require("../models/Todo");
const router = express.Router();

// Lấy toàn bộ tasks
router.get("/", async (req, res) => {
  try {
    const todos = await Todo.find().sort({ createdAt: -1 }); // sort mới nhất lên đầu
    res.json(todos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Thêm task
router.post("/", async (req, res) => {
  try {
    const { text, deadline } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });

    const newTodo = new Todo({ text, deadline, done: false });
    await newTodo.save();
    res.status(201).json(newTodo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Cập nhật task
router.put("/:id", async (req, res) => {
  try {
    const { text, deadline, done } = req.body;
    const updated = await Todo.findByIdAndUpdate(
      req.params.id,
      { text, deadline, done },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: "Task not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Xoá task
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Todo.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Task not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
