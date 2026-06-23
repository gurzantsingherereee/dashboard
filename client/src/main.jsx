import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ClipboardList,
  Download,
  ExternalLink,
  ImagePlus,
  Layers3,
  Lock,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
  Users,
  X
} from "lucide-react";
import "./styles.css";

const API = "/api";
const sourceSheet = "https://docs.google.com/spreadsheets/d/1J3uKsksE5pjhl0ZIjYE_Sck8hhYX9HT8Y-VFYlusoIg/edit?usp=sharing";
const emptyProduct = {
  title: "",
  date: new Date().toISOString().slice(0, 10),
  time: "",
  driveLink: "",
  sharedWith: "",
  type: "Google Drive Folder",
  channels: ["shared"],
  status: "Ready",
  imageUrls: "",
  notes: ""
};

function request(path, options = {}) {
  return fetch(`${API}${path}`, {
    headers: options.body instanceof FormData ? options.headers : { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || "Request failed");
    return data;
  });
}

function productImage(product) {
  return product.images?.[0]?.url || "";
}

function asDate(value) {
  if (!value) return "No date";
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function channelLabel(channel) {
  return channel === "ecommerce" ? "E-commerce" : channel === "quick" ? "Quick commerce" : channel === "design" ? "Design" : "Shared";
}

function App() {
  const [products, setProducts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activity, setActivity] = useState([]);
  const [role, setRole] = useState("ecommerce");
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState("all");
  const [owner, setOwner] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null);
  const [designCode, setDesignCode] = useState(sessionStorage.getItem("designCode") || "");

  const designUnlocked = Boolean(designCode);
  const selected = products.find((product) => product.id === selectedId) || products[0];

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    if (designUnlocked) loadTasks();
  }, [designUnlocked]);

  function notify(message) {
    setToast(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(""), 2200);
  }

  async function refreshAll() {
    const [productData, activityData] = await Promise.all([
      request("/products"),
      request("/activity").catch(() => [])
    ]);
    setProducts(productData);
    setActivity(activityData);
    setSelectedId((current) => current || productData[0]?.id || "");
  }

  async function loadTasks(code = designCode) {
    if (!code) return;
    try {
      const data = await request("/tasks", { headers: { "x-design-code": code } });
      setTasks(data);
    } catch (error) {
      setDesignCode("");
      sessionStorage.removeItem("designCode");
      notify(error.message);
    }
  }

  async function syncSheet() {
    setBusy(true);
    try {
      const result = await request("/sync/sheet", { method: "POST", body: JSON.stringify({}) });
      await refreshAll();
      notify(result.message);
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  }

  const visible = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    const list = products.filter((product) => {
      const roleMatch = role === "design" || product.channels?.includes("shared") || product.channels?.includes(role);
      const searchMatch = !lowered || `${product.title} ${product.sharedWith} ${product.driveLink}`.toLowerCase().includes(lowered);
      const channelMatch = channel === "all" || product.channels?.includes(channel);
      const ownerMatch = owner === "all" || product.sharedWith === owner;
      const statusMatch = status === "all" || product.status === status;
      return roleMatch && searchMatch && channelMatch && ownerMatch && statusMatch;
    });
    list.sort((a, b) => {
      if (sort === "oldest") return String(a.date).localeCompare(String(b.date)) || a.title.localeCompare(b.title);
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "owner") return String(a.sharedWith).localeCompare(String(b.sharedWith)) || a.title.localeCompare(b.title);
      return String(b.date).localeCompare(String(a.date)) || a.title.localeCompare(b.title);
    });
    return list;
  }, [products, role, query, channel, owner, status, sort]);

  const owners = useMemo(() => [...new Set(products.filter((product) => role === "design" || product.channels?.includes("shared") || product.channels?.includes(role)).map((product) => product.sharedWith).filter(Boolean))].sort(), [products, role]);
  const metrics = useMemo(() => {
    const ready = visible.filter((product) => product.status === "Ready").length;
    const imageReady = visible.filter((product) => product.images?.length).length;
    const review = products.filter((product) => product.status === "Needs review").length;
    const openTasks = tasks.filter((task) => task.status !== "Done").length;
    return role === "design"
      ? [
          ["Total products", products.length, "All source records", Layers3],
          ["With previews", products.filter((product) => product.images?.length).length, "Images visible", ImagePlus],
          ["Open tasks", openTasks, "Private design queue", ClipboardList],
          ["Need review", review, "Clean before upload", PackageCheck]
        ]
      : [
          ["Visible assets", visible.length, "Current team view", Layers3],
          ["Ready folders", ready, "Can start upload", PackageCheck],
          ["With previews", imageReady, "Images visible", ImagePlus],
          ["Upload queue", visible.filter((product) => ["Ready", "In upload"].includes(product.status)).length, "Ready or active", UploadCloud]
        ];
  }, [products, visible, role, tasks]);

  async function saveProduct(form, files) {
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(key, Array.isArray(value) ? JSON.stringify(value) : value || ""));
    Array.from(files || []).forEach((file) => data.append("images", file));
    const method = form.id ? "PUT" : "POST";
    const path = form.id ? `/products/${form.id}` : "/products";
    await request(path, { method, body: data, headers: {} });
    setModal(null);
    await refreshAll();
    notify(form.id ? "Product updated" : "Product added");
  }

  async function removeProduct(product) {
    if (!window.confirm(`Remove ${product.title}?`)) return;
    await request(`/products/${product.id}`, { method: "DELETE" });
    await refreshAll();
    notify("Product removed");
  }

  async function addImage(product, imageUrl, files) {
    const data = new FormData();
    if (imageUrl) data.append("imageUrls", imageUrl);
    Array.from(files || []).forEach((file) => data.append("images", file));
    await request(`/products/${product.id}/images`, { method: "POST", body: data, headers: {} });
    await refreshAll();
    notify("Image added");
  }

  async function removeImage(product, image) {
    await request(`/products/${product.id}/images/${image.id}`, { method: "DELETE" });
    await refreshAll();
    notify("Image removed");
  }

  async function updateStatus(product, nextStatus) {
    const data = new FormData();
    Object.entries({ ...product, status: nextStatus, imageUrls: "", channels: product.channels || ["shared"] }).forEach(([key, value]) => {
      if (key !== "images") data.append(key, Array.isArray(value) ? JSON.stringify(value) : value || "");
    });
    await request(`/products/${product.id}`, { method: "PUT", body: data, headers: {} });
    await refreshAll();
  }

  function unlockDesign(code) {
    if (!code.trim()) return;
    sessionStorage.setItem("designCode", code.trim());
    setDesignCode(code.trim());
    setRole("design");
    setModal(null);
    loadTasks(code.trim());
  }

  async function saveTask(task) {
    await request("/tasks", {
      method: "POST",
      headers: { "x-design-code": designCode },
      body: JSON.stringify(task)
    });
    await loadTasks();
    notify("Task added");
  }

  async function updateTask(task, patch) {
    await request(`/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "x-design-code": designCode },
      body: JSON.stringify(patch)
    });
    await loadTasks();
  }

  async function deleteTask(task) {
    await request(`/tasks/${task.id}`, {
      method: "DELETE",
      headers: { "x-design-code": designCode }
    });
    await loadTasks();
    notify("Task removed");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <h1>Design Asset Dashboard</h1>
            <p>Product links, previews, upload status, and private design tasks.</p>
          </div>
        </div>
        <nav className="role-list">
          <RoleButton role="ecommerce" active={role === "ecommerce"} count={products.filter((product) => product.channels?.includes("ecommerce") || product.channels?.includes("shared")).length} onClick={setRole}>E-commerce</RoleButton>
          <RoleButton role="quick" active={role === "quick"} count={products.filter((product) => product.channels?.includes("quick") || product.channels?.includes("shared")).length} onClick={setRole}>Quick commerce</RoleButton>
          <button className={`role-button ${role === "design" ? "active" : ""}`} onClick={() => designUnlocked ? setRole("design") : setModal({ type: "unlock" })}>
            <span>Design team</span><b>{products.length}</b>
          </button>
        </nav>
        <div className="sidebar-note">
          <Lock size={16} />
          Design tasks are server-protected with the access code and hidden from other team views.
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{role === "design" ? "Design Team View" : role === "quick" ? "Quick Commerce View" : "E-commerce View"}</p>
            <h2>{role === "design" ? "Design workspace and product preview control" : "Product folders ready for catalogue upload"}</h2>
            <p>Sync from Google Sheets, add products manually, upload previews, and keep channel handoff clear.</p>
          </div>
          <div className="top-actions">
            <a className="button" href={sourceSheet} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Source Sheet</a>
            <button className="button" onClick={syncSheet} disabled={busy}><RefreshCw size={16} /> Sync Sheet</button>
            <button className="button" onClick={() => exportCsv(visible)}><Download size={16} /> CSV</button>
            <button className="button primary" onClick={() => setModal({ type: "product", product: emptyProduct })}><Plus size={16} /> Add Product</button>
          </div>
        </header>

        <section className="workspace">
          <section className="metrics">
            {metrics.map(([label, value, note, Icon]) => (
              <article className="metric-card" key={label}>
                <div><span>{label}</span><Icon size={18} /></div>
                <strong>{value}</strong>
                <p>{note}</p>
              </article>
            ))}
          </section>

          <section className="filters">
            <div className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product, owner, Drive link" /></div>
            <select value={channel} onChange={(event) => setChannel(event.target.value)}><option value="all">All channels</option><option value="ecommerce">E-commerce</option><option value="quick">Quick commerce</option><option value="shared">Shared</option></select>
            <select value={owner} onChange={(event) => setOwner(event.target.value)}><option value="all">All owners</option>{owners.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All status</option><option>Ready</option><option>In upload</option><option>Uploaded</option><option>Needs review</option></select>
            <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Product A-Z</option><option value="owner">Owner A-Z</option></select>
          </section>

          <section className="content-grid">
            <ProductTable products={visible} selectedId={selected?.id} onSelect={setSelectedId} onEdit={(product) => setModal({ type: "product", product })} onDelete={removeProduct} onStatus={updateStatus} />
            <Inspector product={selected} role={role} onAddImage={addImage} onRemoveImage={removeImage} />
          </section>

          {role === "design" && designUnlocked && (
            <section className="design-grid">
              <Tasks tasks={tasks} products={products} onCreate={saveTask} onUpdate={updateTask} onDelete={deleteTask} />
              <ActivityFeed activity={activity} />
            </section>
          )}
        </section>
      </main>

      {modal?.type === "product" && <ProductModal product={modal.product} onClose={() => setModal(null)} onSave={saveProduct} />}
      {modal?.type === "unlock" && <UnlockModal onClose={() => setModal(null)} onUnlock={unlockDesign} />}
      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
  );
}

function RoleButton({ role, active, count, onClick, children }) {
  return <button className={`role-button ${active ? "active" : ""}`} onClick={() => onClick(role)}><span>{children}</span><b>{count}</b></button>;
}

function ProductTable({ products, selectedId, onSelect, onEdit, onDelete, onStatus }) {
  return (
    <section className="panel table-panel">
      <div className="panel-head">
        <div><h3>Product assets</h3><p>{products.length} visible products after filters.</p></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Preview</th><th>Product</th><th>Shared With</th><th>Channel</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {products.map((product) => (
              <tr className={selectedId === product.id ? "selected" : ""} key={product.id} onClick={() => onSelect(product.id)}>
                <td><Preview image={productImage(product)} title={product.title} /></td>
                <td><b>{product.title}</b><span>{asDate(product.date)} · {product.type}</span></td>
                <td>{product.sharedWith || "Unassigned"}</td>
                <td><div className="chip-list">{(product.channels || ["shared"]).map((item) => <span className={`chip ${item}`} key={item}>{channelLabel(item)}</span>)}</div></td>
                <td><select value={product.status} onClick={(event) => event.stopPropagation()} onChange={(event) => onStatus(product, event.target.value)}><option>Ready</option><option>In upload</option><option>Uploaded</option><option>Needs review</option></select></td>
                <td>
                  <div className="row-actions" onClick={(event) => event.stopPropagation()}>
                    <a className="icon-button" href={product.driveLink} target="_blank" rel="noreferrer" title="Open Drive"><ExternalLink size={16} /></a>
                    <button className="icon-button" onClick={() => onEdit(product)} title="Edit"><ImagePlus size={16} /></button>
                    <button className="icon-button danger" onClick={() => onDelete(product)} title="Delete"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Preview({ image, title }) {
  return image
    ? <img className="preview" src={image} alt={`${title} preview`} />
    : <div className="preview placeholder"><ImagePlus size={18} /></div>;
}

function Inspector({ product, role, onAddImage, onRemoveImage }) {
  const [imageUrl, setImageUrl] = useState("");
  const [files, setFiles] = useState([]);
  if (!product) return <aside className="panel inspector empty-state">No product selected.</aside>;
  return (
    <aside className="panel inspector">
      <div className="panel-head">
        <div><h3>{product.title}</h3><p>{product.images?.length || 0} preview image{product.images?.length === 1 ? "" : "s"}</p></div>
      </div>
      <div className="image-grid">
        {(product.images?.length ? product.images : [{ id: "empty", url: "" }]).map((image) => image.url ? (
          <figure className="image-frame" key={image.id}>
            <img src={image.url} alt={image.caption || product.title} />
            <button onClick={() => onRemoveImage(product, image)} title="Remove image"><Trash2 size={15} /></button>
          </figure>
        ) : <div key={image.id} className="image-empty"><ImagePlus /><span>Add product preview</span></div>)}
      </div>
      <div className="detail-list">
        <p><b>Drive:</b> <a href={product.driveLink} target="_blank" rel="noreferrer">Open product folder</a></p>
        <p><b>Owner:</b> {product.sharedWith || "Unassigned"}</p>
        <p><b>Handoff:</b> {role === "quick" ? "Quick commerce upload flow" : role === "design" ? "Design review and asset cleanup" : "E-commerce upload flow"}</p>
      </div>
      <div className="add-image">
        <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="Paste preview image URL" />
        <input type="file" accept="image/*" multiple onChange={(event) => setFiles(event.target.files)} />
        <button className="button primary" onClick={() => { onAddImage(product, imageUrl, files); setImageUrl(""); setFiles([]); }}><UploadCloud size={16} /> Add image</button>
      </div>
    </aside>
  );
}

function ProductModal({ product, onClose, onSave }) {
  const [form, setForm] = useState({ ...emptyProduct, ...product, channels: product.channels || ["shared"], imageUrls: "" });
  const [files, setFiles] = useState([]);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={(event) => { event.preventDefault(); onSave(form, files); }}>
        <div className="modal-head"><h3>{form.id ? "Edit product" : "Add product"}</h3><button type="button" onClick={onClose}><X size={18} /></button></div>
        <label>Product title<input required value={form.title} onChange={(event) => update("title", event.target.value)} /></label>
        <label>Google Drive link<input required value={form.driveLink} onChange={(event) => update("driveLink", event.target.value)} /></label>
        <div className="form-grid">
          <label>Date<input type="date" value={form.date || ""} onChange={(event) => update("date", event.target.value)} /></label>
          <label>Status<select value={form.status} onChange={(event) => update("status", event.target.value)}><option>Ready</option><option>In upload</option><option>Uploaded</option><option>Needs review</option></select></label>
        </div>
        <div className="form-grid">
          <label>Shared with<input value={form.sharedWith || ""} onChange={(event) => update("sharedWith", event.target.value)} /></label>
          <label>Channel<select value={form.channels?.[0] || "shared"} onChange={(event) => update("channels", [event.target.value])}><option value="ecommerce">E-commerce</option><option value="quick">Quick commerce</option><option value="shared">Shared</option></select></label>
        </div>
        <label>Preview image URL<input value={form.imageUrls || ""} onChange={(event) => update("imageUrls", event.target.value)} placeholder="https://..." /></label>
        <label>Upload images<input type="file" accept="image/*" multiple onChange={(event) => setFiles(event.target.files)} /></label>
        <label>Notes<textarea value={form.notes || ""} onChange={(event) => update("notes", event.target.value)} /></label>
        <div className="modal-actions"><button type="button" className="button" onClick={onClose}>Cancel</button><button className="button primary">Save product</button></div>
      </form>
    </div>
  );
}

function UnlockModal({ onClose, onUnlock }) {
  const [code, setCode] = useState("");
  return (
    <div className="modal-backdrop">
      <form className="modal small" onSubmit={(event) => { event.preventDefault(); onUnlock(code); }}>
        <div className="modal-head"><h3>Design access</h3><button type="button" onClick={onClose}><X size={18} /></button></div>
        <p>Enter the design code to view and manage private tasks.</p>
        <label>Access code<input type="password" value={code} onChange={(event) => setCode(event.target.value)} autoFocus /></label>
        <div className="modal-actions"><button type="button" className="button" onClick={onClose}>Cancel</button><button className="button primary"><Lock size={16} /> Unlock</button></div>
      </form>
    </div>
  );
}

function Tasks({ tasks, products, onCreate, onUpdate, onDelete }) {
  const [task, setTask] = useState({ title: "", owner: "", productId: "all", priority: "Medium", due: "" });
  return (
    <section className="panel task-panel">
      <div className="panel-head"><div><h3>Design tasks</h3><p>Private team queue.</p></div></div>
      <form className="inline-task" onSubmit={(event) => { event.preventDefault(); onCreate(task); setTask({ title: "", owner: "", productId: "all", priority: "Medium", due: "" }); }}>
        <input required placeholder="Task" value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })} />
        <input required placeholder="Owner" value={task.owner} onChange={(event) => setTask({ ...task, owner: event.target.value })} />
        <select value={task.productId} onChange={(event) => setTask({ ...task, productId: event.target.value })}><option value="all">General</option>{products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}</select>
        <button className="button primary"><Plus size={16} /></button>
      </form>
      <div className="task-list">
        {tasks.map((item) => (
          <article className="task-item" key={item.id}>
            <div><b>{item.title}</b><span>{item.owner} · {item.priority}</span></div>
            <div className="task-actions">
              <select value={item.status} onChange={(event) => onUpdate(item, { status: event.target.value })}><option>To do</option><option>In review</option><option>Blocked</option><option>Done</option></select>
              <button className="icon-button danger" onClick={() => onDelete(item)} title="Delete task"><Trash2 size={15} /></button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ActivityFeed({ activity }) {
  return (
    <section className="panel activity-panel">
      <div className="panel-head"><div><h3>Activity</h3><p>Recent local changes.</p></div></div>
      <div className="activity-list">
        {activity.length ? activity.map((item) => <article key={item.id}><span /> <p>{item.text}<small>{new Date(item.createdAt).toLocaleString()}</small></p></article>) : <p className="empty-copy">Mongo mode activity feed starts empty.</p>}
      </div>
    </section>
  );
}

function exportCsv(products) {
  const csv = [["Title", "Date", "Drive Link", "Shared With", "Channel", "Status"], ...products.map((product) => [product.title, product.date, product.driveLink, product.sharedWith, (product.channels || []).join(" / "), product.status])]
    .map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = "design-dashboard-products.csv";
  link.click();
}

createRoot(document.getElementById("root")).render(<App />);
