const list = document.getElementById("todo-list");
const addBtn = document.getElementById("add-btn");
const input = document.getElementById("todo-input");
const deadlineInput = document.getElementById("deadline-input");

const API_URL = "http://localhost:3000/api/todos";

// Kiểm tra element tồn tại
if (!list || !addBtn || !input || !deadlineInput) {
  console.error("Missing DOM element. Expect ids: todo-list, add-btn, todo-input, deadline-input");
}

// Helper: format ISO -> hiển thị đẹp
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString();
}

// Helper: convert Date -> giá trị cho input datetime-local (local time)
function toDatetimeLocalValue(date) {
  if (!date) return "";
  const d = new Date(date);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Set min attribute cho input datetime-local (không cho chọn quá khứ)
function setMinDeadlineInputs() {
  const now = new Date();
  deadlineInput.min = toDatetimeLocalValue(now);
}
// gọi 1 lần khi load
setMinDeadlineInputs();
// cập nhật min mỗi phút để luôn chính xác nếu trang mở lâu
setInterval(setMinDeadlineInputs, 60 * 1000);

// Tải danh sách todos từ server và render
async function loadTodos() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    let todos = await res.json();

    // Lọc những todos có deadline hợp lệ (nếu có thể)
    // Sắp xếp theo deadline: gần nhất -> xa nhất
    todos.sort((a, b) => {
      const da = a.deadline ? new Date(a.deadline) : new Date(8640000000000000); // nếu không có deadline -> đặt rất xa
      const db = b.deadline ? new Date(b.deadline) : new Date(8640000000000000);
      return da - db;
    });

    list.innerHTML = "";
    todos.forEach(todo => {
      const li = createTaskElement(todo._id, todo.text, todo.deadline, todo.done);
      list.appendChild(li);
    });
  } catch (err) {
    console.error("Lỗi khi load todos:", err);
    list.innerHTML = `<li style="color:crimson">Không thể tải dữ liệu. Kiểm tra console.</li>`;
  }
}
loadTodos();

// reload định kỳ để "đồng hồ" cập nhật màu (nếu trang mở lâu)
const AUTO_REFRESH_MS = 30 * 1000; // 30s (bạn có thể tăng/giảm)
setInterval(loadTodos, AUTO_REFRESH_MS);

// Tạo DOM cho 1 task
function createTaskElement(id, text, deadline, done = false) {
  const li = document.createElement("li");
  li.dataset.id = id;
  li.style.listStyle = "none";
  li.style.padding = "8px";
  li.style.marginBottom = "8px";
  li.style.borderRadius = "8px";
  li.style.display = "flex";
  li.style.justifyContent = "space-between";
  li.style.alignItems = "center";
  li.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";

  const deadlineDate = deadline ? new Date(deadline) : null;
  const now = new Date();

  // Nếu deadline hợp lệ thì đánh màu theo khoảng thời gian còn lại (so với giờ hiện tại)
  if (deadlineDate && !isNaN(deadlineDate)) {
    const diff = deadlineDate - now; // ms
    const diffDays = diff / (1000 * 60 * 60 * 24);
    if (diff < 0) {
      li.style.background = "#ffcccc"; // đỏ: đã quá hạn
    } else if (diff <= 3 * 24 * 60 * 60 * 1000) {
      li.style.background = "#fff3cd"; // vàng: <= 3 ngày
    } else {
      li.style.background = "#ffffff"; // trắng
    }
  } else {
    li.style.background = "#ffffff";
  }

  // left: text + deadline
  const left = document.createElement("div");
  left.style.flex = "1";
  left.style.paddingRight = "12px";
  const textSpan = document.createElement("span");
  textSpan.textContent = `${text}`;
  textSpan.style.fontWeight = "500";
  if (done) textSpan.style.textDecoration = "line-through";

  const small = document.createElement("small");
  small.style.display = "block";
  small.style.color = "#333";
  small.style.opacity = "0.9";
  small.textContent = deadline ? `Hạn: ${fmtDate(deadline)}` : "Không có deadline";

  left.appendChild(textSpan);
  left.appendChild(small);

  // right: actions
  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "6px";

  // Done/Undone
  const doneBtn = document.createElement("button");
  doneBtn.textContent = done ? "Undone" : "Done";
  doneBtn.onclick = async () => {
    try {
      doneBtn.disabled = true;
      await updateTask(id, { done: !done });
      await loadTodos();
    } catch (err) {
      alert("Không thể cập nhật task. Xem console.");
      console.error(err);
    } finally {
      doneBtn.disabled = false;
    }
  };

  // Edit -> chuyển sang chế độ edit inline (form giống thêm)
  const editBtn = document.createElement("button");
  editBtn.textContent = "Edit";
  editBtn.onclick = () => enterEditMode(li, id, text, deadline, done);

  // Delete
  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete";
  deleteBtn.onclick = async () => {
    if (!confirm("Bạn có chắc muốn xóa task này?")) return;
    try {
      deleteBtn.disabled = true;
      await deleteTask(id);
      await loadTodos();
    } catch (err) {
      alert("Xóa thất bại. Xem console.");
      console.error(err);
    } finally {
      deleteBtn.disabled = false;
    }
  };

  actions.appendChild(doneBtn);
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  li.appendChild(left);
  li.appendChild(actions);

  return li;
}

// Chế độ chỉnh sửa inline (thay thế nội dung li bằng form)
function enterEditMode(li, id, text, deadline, done) {
  li.innerHTML = ""; // xóa nội dung cũ
  li.style.background = "#e9f7ff";

  // input text
  const txt = document.createElement("input");
  txt.type = "text";
  txt.value = text;
  txt.style.flex = "1";
  txt.style.marginRight = "8px";
  txt.style.padding = "6px";

  // input datetime-local
  const dt = document.createElement("input");
  dt.type = "datetime-local";
  dt.value = deadline ? toDatetimeLocalValue(deadline) : "";
  dt.min = toDatetimeLocalValue(new Date());
  dt.style.marginRight = "8px";
  dt.style.padding = "6px";

  // Save & Cancel buttons
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save";
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";

  // container actions
  const right = document.createElement("div");
  right.style.display = "flex";
  right.style.gap = "6px";

  right.appendChild(saveBtn);
  right.appendChild(cancelBtn);

  li.appendChild(txt);
  li.appendChild(dt);
  li.appendChild(right);

  // Cancel -> reload toàn bộ list để trả về trạng thái trước
  cancelBtn.onclick = async () => {
    await loadTodos();
  };

  // Save -> validate + gửi PUT
  saveBtn.onclick = async () => {
    const newText = txt.value.trim();
    const newDeadline = dt.value; // 'YYYY-MM-DDTHH:mm'

    if (!newText) {
      alert("Nội dung không được để trống.");
      return;
    }
    if (newDeadline && new Date(newDeadline) < new Date()) {
      alert("Deadline không được nhỏ hơn thời gian hiện tại!");
      return;
    }

    try {
      saveBtn.disabled = true;
      await updateTask(id, { text: newText, deadline: newDeadline });
      await loadTodos();
    } catch (err) {
      alert("Cập nhật thất bại. Xem console.");
      console.error(err);
    } finally {
      saveBtn.disabled = false;
    }
  };
}

// Thêm task mới (POST)
addBtn.addEventListener("click", async () => {
  const text = input.value.trim();
  const deadline = deadlineInput.value; // 'YYYY-MM-DDTHH:mm' (local)

  if (!text) {
    alert("Vui lòng nhập nội dung!");
    return;
  }
  if (!deadline) {
    alert("Vui lòng chọn deadline!");
    return;
  }
  if (new Date(deadline) < new Date()) {
    alert("Deadline không được nhỏ hơn thời gian hiện tại!");
    return;
  }

  addBtn.disabled = true;
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, deadline })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Server lỗi ${res.status}`);
    }

    await res.json();
    input.value = "";
    deadlineInput.value = "";
    setMinDeadlineInputs(); // cập nhật min
    await loadTodos();
  } catch (err) {
    alert("Thêm thất bại: " + err.message);
    console.error(err);
  } finally {
    addBtn.disabled = false;
  }
});

// Update (PUT)
async function updateTask(id, data) {
  const res = await fetch(`${API_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error || `Server lỗi ${res.status}`);
  }
  return await res.json();
}

// Delete
async function deleteTask(id) {
  const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error || `Server lỗi ${res.status}`);
  }
}
