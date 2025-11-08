// @ts-nocheck

/* ========= Storage & State ========= */
const STORAGE_KEY = "notes.v3"; // v3: theme + markdown + undo/redo + export-one
let notes = load();
let query = "";
let sortBy = "updated"; // updated | title
let tagFilter = "";     // "" = all
let theme = loadTheme(); // "dark" | "light"

/* ========= Elements ========= */
const listEl   = document.querySelector("#list");
const addBtn   = document.querySelector("#add");
const searchEl = document.querySelector("#search");
const sortEl   = document.querySelector("#sort");
const tagbarEl = document.querySelector("#tagbar");
const exportBtn= document.querySelector("#export");
const importEl = document.querySelector("#import");
const themeBtn = document.querySelector("#theme");

/* ========= Boot ========= */
applyTheme(theme);
renderTagbar();
render();

/* ========= Events ========= */
addBtn.addEventListener("click", () => {
  const n = createNote();
  notes.unshift(n);
  save(); render(); renderTagbar();
  focusTitle(n.id);
});

searchEl.addEventListener("input", () => {
  query = searchEl.value.toLowerCase();
  render();
});

sortEl.addEventListener("change", () => {
  sortBy = sortEl.value;
  render();
});

exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(notes, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "notes-export.json";
  a.click();
  URL.revokeObjectURL(url);
});

importEl.addEventListener("change", async () => {
  const file = importEl.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("bad file");
    notes = data.map(safeNoteFromObj).filter(Boolean);
    save(); render(); renderTagbar();
  } catch {
    alert("Import failed. Invalid file.");
  } finally {
    importEl.value = "";
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    addBtn.click();
  }
  if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    searchEl.focus();
  }
});

themeBtn.addEventListener("click", () => {
  theme = (theme === "dark") ? "light" : "dark";
  saveTheme(theme);
  applyTheme(theme);
});

/* ========= Data helpers ========= */
function createNote() {
  const id = crypto.randomUUID();
  const now = Date.now();
  return {
    id, title: "Untitled", body: "", pinned: false, color: "slate",
    tags: [], updated: now,
    mode: "edit", // "edit" | "preview"
    hist: [], // undo stack (strings)
    fut: []   // redo stack
  };
}
function safeNoteFromObj(o) {
  if (!o || typeof o !== "object") return null;
  return {
    id: String(o.id ?? crypto.randomUUID()),
    title: String(o.title ?? "Untitled"),
    body: String(o.body ?? ""),
    pinned: !!o.pinned,
    color: ["yellow","red","green","blue","purple","slate"].includes(o.color) ? o.color : "slate",
    tags: Array.isArray(o.tags) ? o.tags.map(x=>String(x).trim()).filter(Boolean) : [],
    updated: Number(o.updated ?? Date.now()),
    mode: (o.mode === "preview" ? "preview" : "edit"),
    hist: Array.isArray(o.hist) ? o.hist.map(String).slice(-50) : [],
    fut:  Array.isArray(o.fut)  ? o.fut.map(String).slice(-50)  : []
  };
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY))?.map(safeNoteFromObj) ?? []; }
  catch { return []; }
}
function touch(note) {
  note.updated = Date.now();
}

/* ========= Theme ========= */
function loadTheme(){
  try { return localStorage.getItem("notes.theme") || "dark"; }
  catch { return "dark"; }
}
function saveTheme(t){
  localStorage.setItem("notes.theme", t);
}
function applyTheme(t){
  document.documentElement.setAttribute("data-theme", t);
  themeBtn.textContent = `Theme: ${t[0].toUpperCase()+t.slice(1)}`;
}

/* ========= Tags ========= */
function allTags() {
  const set = new Set();
  notes.forEach(n => n.tags.forEach(t => set.add(t)));
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}
function renderTagbar() {
  tagbarEl.innerHTML = "";
  const all = allTags();
  if (!all.length) return;
  tagbarEl.appendChild(chip("All", tagFilter==="", () => { tagFilter=""; render(); renderTagbar(); }));
  all.forEach(t => {
    tagbarEl.appendChild(
      chip("#"+t, tagFilter===t, () => { tagFilter = (tagFilter===t ? "" : t); render(); renderTagbar(); })
    );
  });
}
function chip(text, active, onClick) {
  const el = document.createElement("button");
  el.className = "chip" + (active ? " active" : "");
  el.textContent = text;
  el.addEventListener("click", onClick);
  return el;
}

/* ========= Render ========= */
function render() {
  listEl.innerHTML = "";
  let data = [...notes];

  // filter by search and tag
  if (query) {
    data = data.filter(n =>
      n.title.toLowerCase().includes(query) ||
      n.body.toLowerCase().includes(query) ||
      n.tags.some(t => ("#"+t).includes(query) || t.includes(query))
    );
  }
  if (tagFilter) data = data.filter(n => n.tags.includes(tagFilter));

  // sort with pinned on top
  data.sort((a,b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (sortBy === "title") return a.title.localeCompare(b.title);
    return b.updated - a.updated;
  });

  for (const n of data) listEl.appendChild(renderNote(n));
}

function renderNote(n) {
  const card = document.createElement("div");
  card.className = `note c-${n.color}` + (n.pinned ? " pinned" : "");

  // header
  const header = document.createElement("header");

  const left = document.createElement("div");
  left.style.display = "flex";
  left.style.flexDirection = "column";
  left.style.gap = "4px";

  const title = document.createElement("div");
  title.className = "title";
  title.contentEditable = "true";
  title.textContent = n.title;

  const tags = document.createElement("div");
  tags.className = "tags";
  tags.contentEditable = "true";
  tags.setAttribute("aria-label","Tags");
  tags.textContent = n.tags.join(", ");

  left.append(title, tags);

  const actions = document.createElement("div");
  actions.className = "actions";

  const colors = document.createElement("div");
  colors.className = "colors";
  ["yellow","red","green","blue","purple","slate"].forEach(c=>{
    const s = document.createElement("div");
    s.className = "swatch";
    s.dataset.c = c;
    if (c === n.color) s.style.outline = "2px solid #e2e8f0";
    s.addEventListener("click", ()=>{
      n.color = c; touch(n); save(); render();
    });
    colors.appendChild(s);
  });

  const badge = document.createElement("span");
  badge.className = "mode-badge";
  badge.textContent = n.mode === "preview" ? "Preview" : "Edit";

  const undoBtn   = btn("↩️","Undo");
  const redoBtn   = btn("↪️","Redo");
  const modeBtn   = btn("📝/👁️","Toggle edit/preview");
  const exportOne = btn("⬇️","Export note");
  const pinBtn    = btn("📌","Pin/Unpin");
  const delBtn    = btn("🗑️","Delete");

  actions.append(colors, badge, undoBtn, redoBtn, modeBtn, exportOne, pinBtn, delBtn);
  header.append(left, actions);

  // body or markdown preview
  const body = document.createElement("div");
  body.className = "body";
  body.contentEditable = "true";
  body.textContent = n.body;

  const md = document.createElement("div");
  md.className = "md";
  md.style.display = "none";
  md.innerHTML = renderMarkdown(n.body);

  if (n.mode === "preview") {
    body.style.display = "none";
    md.style.display = "block";
  }

  // meta
  const meta = document.createElement("div");
  meta.className = "meta";
  const up = document.createElement("span");
  up.textContent = "Updated: " + timeAgo(n.updated);
  const count = document.createElement("span");
  count.textContent = `${n.body.length} chars`;
  meta.append(up, count);

  // events & logic
  const saveDebounced = debounce(() => {
    pushHistory(n, n.body); // pre change already pushed in oninput below
    n.title = sanitize(title.textContent);
    n.body  = sanitize(body.textContent);
    n.tags  = parseTags(tags.textContent);
    md.innerHTML = renderMarkdown(n.body);
    count.textContent = `${n.body.length} chars`;
    touch(n); save(); renderTagbar();
  }, 300);

  // track changes for undo
  body.addEventListener("input", () => {
    // push the snapshot only if different from last
    const last = n.hist[n.hist.length-1];
    if (last !== body.textContent) pushHistory(n, body.textContent);
    saveDebounced();
  });

  title.addEventListener("input", saveDebounced);
  tags.addEventListener("input", saveDebounced);

  undoBtn.addEventListener("click", () => {
    if (!n.hist.length) return;
    const current = body.textContent;
    const prev = n.hist.pop();
    n.fut.push(current);
    body.textContent = prev;
    n.body = sanitize(prev);
    md.innerHTML = renderMarkdown(n.body);
    touch(n); save();
  });

  redoBtn.addEventListener("click", () => {
    if (!n.fut.length) return;
    const current = body.textContent;
    const next = n.fut.pop();
    n.hist.push(current);
    body.textContent = next;
    n.body = sanitize(next);
    md.innerHTML = renderMarkdown(n.body);
    touch(n); save();
  });

  modeBtn.addEventListener("click", () => {
    n.mode = (n.mode === "edit") ? "preview" : "edit";
    badge.textContent = n.mode === "preview" ? "Preview" : "Edit";
    if (n.mode === "preview") {
      md.innerHTML = renderMarkdown(n.body);
      body.style.display = "none";
      md.style.display = "block";
    } else {
      body.style.display = "block";
      md.style.display = "none";
      body.focus();
    }
    save();
  });

  exportOne.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(n, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeTitle = (n.title || "note").replace(/[^\w\- ]+/g,"").trim().replace(/\s+/g,"-");
    a.href = url; a.download = `${safeTitle || "note"}.json`;
    a.click(); URL.revokeObjectURL(url);
  });

  pinBtn.addEventListener("click", () => {
    n.pinned = !n.pinned;
    touch(n); save(); render();
  });

  delBtn.addEventListener("click", () => {
    if (!confirm("Delete this note?")) return;
    notes = notes.filter(x => x.id !== n.id);
    save(); render(); renderTagbar();
  });

  card.append(header, body, md, meta);
  return card;
}

/* ========= Helpers ========= */
function btn(text, aria) {
  const b = document.createElement("button");
  b.className = "icon-btn";
  b.setAttribute("aria-label", aria);
  b.textContent = text;
  return b;
}
function focusTitle(id) {
  const all = [...document.querySelectorAll(".note .title")];
  const el = all.find(Boolean);
  el?.focus();
  document.getSelection()?.selectAllChildren(el);
}
function parseTags(s=""){
  return s.split(",").map(x=>x.trim().replace(/^#/, "")).filter(Boolean).slice(0, 10);
}
function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
function sanitize(str="") {
  return str.replace(/[\u0000-\u001F\u007F]/g, "").trim();
}
function debounce(fn, ms=300) {
  let t; 
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ========= Undo/Redo history ========= */
function pushHistory(n, text){
  if (n.hist.length && n.hist[n.hist.length-1] === text) return;
  n.hist.push(text);
  if (n.hist.length > 50) n.hist.shift();
  n.fut = []; // clear redo on new typing
}

/* ========= Markdown Renderer (basic) ========= */
/* Podržava: # ### naslove, **bold**, *italic*, `code`, ```code blocks```, -/• liste, linkove [txt](url) */
function renderMarkdown(src=""){
  const esc = (s)=>s
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  // code blocks ``` ```
  src = src.replace(/```([\s\S]*?)```/g, (_,code)=>`<pre><code>${esc(code)}</code></pre>`);
  // inline code `
  src = src.replace(/`([^`]+)`/g, (_,code)=>`<code>${esc(code)}</code>`);
  // headers
  src = src.replace(/^### (.*)$/gm, "<h3>$1</h3>")
           .replace(/^## (.*)$/gm, "<h2>$1</h2>")
           .replace(/^# (.*)$/gm, "<h1>$1</h1>");
  // bold / italic
  src = src.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
           .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  // links
  src = src.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, `<a href="$2" target="_blank" rel="noopener">$1</a>`);
  // lists
  src = src.replace(/^(?:-|\*) (.*(?:\n(?:-|\*) .*)*)/gm, (m)=>{
    const items = m.split(/\n/).map(x=>x.replace(/^(?:-|\*) /,'').trim()).map(li=>`<li>${li}</li>`).join("");
    return `<ul>${items}</ul>`;
  });
  // paragraphs
  const lines = src.split(/\n{2,}/).map(p=>{
    if (/^<\/?(h\d|ul|pre)/.test(p)) return p;
    return `<p>${p.replace(/\n/g,"<br/>")}</p>`;
  });
  return lines.join("\n");
}