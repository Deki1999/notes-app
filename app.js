// @ts-nocheck

const STORAGE_KEY = "notes.v2"; // v2: dodati tagovi + boje
let notes = load();
let query = "";
let sortBy = "updated"; // updated | title
let tagFilter = "";     // "" = all

// elements
const listEl   = document.querySelector("#list");
const addBtn   = document.querySelector("#add");
const searchEl = document.querySelector("#search");
const sortEl   = document.querySelector("#sort");
const tagbarEl = document.querySelector("#tagbar");
const exportBtn= document.querySelector("#export");
const importEl = document.querySelector("#import");

// init
renderTagbar();
render();

// events
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
    // mali sanitize
    notes = data.map(safeNoteFromObj).filter(Boolean);
    save(); render(); renderTagbar();
  } catch {
    alert("Import failed. Invalid file.");
  } finally {
    importEl.value = "";
  }
});

// keyboard shortcuts
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

// ------- data helpers -------
function createNote() {
  const id = crypto.randomUUID();
  const now = Date.now();
  return { id, title: "Untitled", body: "", pinned: false, color: "slate", tags: [], updated: now };
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
    updated: Number(o.updated ?? Date.now())
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

// ------- tags -------
function allTags() {
  const set = new Set();
  notes.forEach(n => n.tags.forEach(t => set.add(t)));
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}
function renderTagbar() {
  tagbarEl.innerHTML = "";
  const all = allTags();
  if (!all.length) return;
  const chipAll = chip("All", tagFilter==="", () => { tagFilter=""; render(); renderTagbar(); });
  tagbarEl.appendChild(chipAll);
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

// ------- render -------
function render() {
  listEl.innerHTML = "";
  let data = [...notes];

  // filter pretraga + tag
  if (query) {
    data = data.filter(n =>
      n.title.toLowerCase().includes(query) ||
      n.body.toLowerCase().includes(query) ||
      n.tags.some(t => ("#"+t).includes(query) || t.includes(query))
    );
  }
  if (tagFilter) {
    data = data.filter(n => n.tags.includes(tagFilter));
  }

  // sort: pinned on top, pa po izboru
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

  const pinBtn = btn("📌", "Pin/Unpin");
  const delBtn = btn("🗑️", "Delete");
  actions.append(colors, pinBtn, delBtn);

  header.append(left, actions);

  // body
  const body = document.createElement("div");
  body.className = "body";
  body.contentEditable = "true";
  body.textContent = n.body;

  // meta
  const meta = document.createElement("div");
  meta.className = "meta";
  const up = document.createElement("span");
  up.textContent = "Updated: " + timeAgo(n.updated);
  const count = document.createElement("span");
  count.textContent = `${n.body.length} chars`;
  meta.append(up, count);

  // events
  const saveDebounced = debounce(() => {
    n.title = sanitize(title.textContent);
    n.body  = sanitize(body.textContent);
    n.tags  = parseTags(tags.textContent);
    touch(n); save(); render(); renderTagbar();
  }, 300);

  title.addEventListener("input", saveDebounced);
  body.addEventListener("input", saveDebounced);
  tags.addEventListener("input", saveDebounced);

  pinBtn.addEventListener("click", () => {
    n.pinned = !n.pinned;
    touch(n); save(); render();
  });

  delBtn.addEventListener("click", () => {
    if (!confirm("Delete this note?")) return;
    notes = notes.filter(x => x.id !== n.id);
    save(); render(); renderTagbar();
  });

  card.append(header, body, meta);
  return card;
}

// helpers UI
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

// utils
function parseTags(s=""){
  return s.split(",")
    .map(x=>x.trim().replace(/^#/, "")) // skini # ako ga unese
    .filter(Boolean)
    .slice(0, 10); // safety
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