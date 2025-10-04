// server.js (nâng cấp)
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ======================== Middleware ========================
app.use(cors()); // Cho phép các request từ domain khác (tránh lỗi CORS)
app.use(express.json()); // Giúp Express hiểu dữ liệu JSON gửi từ client

// Cấu hình cho phép Express phục vụ các file tĩnh (HTML, CSS, JS) trong thư mục "public"
// Vì server.js nằm trong folder "backend", nên phải dùng "../public"
app.use(express.static(path.join(__dirname, "../public")));

// ======================== Mongoose Model ========================
const todoSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },         // Nội dung công việc
    deadline: { type: Date, required: true },       // Thời hạn
    done: { type: Boolean, default: false }         // Trạng thái hoàn thành
  },
  { timestamps: true } // Tự động thêm createdAt và updatedAt
);

const Todo = mongoose.model("Todo", todoSchema);

// ======================== MongoDB Connection ========================
const MONGO = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/todoapp";
mongoose
  .connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ======================== API Routes ========================

// Lấy toàn bộ danh sách todos (sắp xếp theo thời gian mới nhất trước)
app.get("/api/todos", async (req, res) => {
  try {
    const todos = await Todo.find().sort({ createdAt: -1 });
    res.json(todos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tạo mới một todo
app.post("/api/todos", async (req, res) => {
  try {
    const { text, deadline } = req.body;

    // Kiểm tra dữ liệu hợp lệ
    if (!text || !deadline) {
      return res.status(400).json({ error: "Text và deadline là bắt buộc" });
    }

    const due = new Date(deadline);
    if (isNaN(due.getTime())) {
      return res.status(400).json({ error: "Deadline không hợp lệ" });
    }

    // Tạo todo mới
    const newTodo = new Todo({ text, deadline: due });
    await newTodo.save();

    res.status(201).json(newTodo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Cập nhật một todo theo ID (chỉ cập nhật field có trong body)
app.put("/api/todos/:id", async (req, res) => {
  try {
    const updates = {};
    const { text, deadline, done } = req.body;

    if (text !== undefined) updates.text = text;

    if (deadline !== undefined) {
      const d = new Date(deadline);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ error: "Deadline không hợp lệ" });
      }
      updates.deadline = d;
    }

    if (done !== undefined) updates.done = done;

    const todo = await Todo.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!todo) return res.status(404).json({ error: "Todo không tồn tại" });

    res.json(todo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Xóa một todo theo ID
app.delete("/api/todos/:id", async (req, res) => {
  try {
    await Todo.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ======================== Default Route ========================
// Khi người dùng truy cập "/" thì gửi file index.html từ thư mục public
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ======================== Start Server ========================
app.listen(PORT, () => {
  console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
});
