// @ts-nocheck

const STORAGE_KEY = "notes.v1";
let notes = load();
let query = "";
let sortBy = "updated"; // updated | title

// elements
const listEl = document.querySelector("#list");
const addBtn = document.querySelector("#add");
const searchEl = document.querySelector("#search");
const sortEl = document.querySelector("#sort");

// init UI
render();

// events
addBtn.addEventListener("click", () => {
  const n = createNote();
  notes.unshift(n);
  save(); render();
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

// ------- data helpers -------
function createNote() {
  const id = crypto.randomUUID();
  const now = Date.now();
  return { id, title: "Untitled", body: "", pinned: false, updated: now };
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? []; }
  catch { return []; }
}

function touch(note) {
  note.updated = Date.now();
}

// ------- render -------
function render() {
  listEl.innerHTML = "";
  let data = [...notes];

  // filter
  if (query) {
    data = data.filter(n =>
      n.title.toLowerCase().includes(query) ||
      n.body.toLowerCase().includes(query)
    );
  }

  // sort: pinned on top, then by chosen sort
  data.sort((a,b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (sortBy === "title") return a.title.localeCompare(b.title);
    return b.updated - a.updated; // default: recently updated
  });

  for (const n of data) listEl.appendChild(renderNote(n));
}

function renderNote(n) {
  const card = document.createElement("div");
  card.className = "note";
  if (n.pinned) card.classList.add("pinned");

  // header
  const header = document.createElement("header");
  const title = document.createElement("div");
  title.className = "title";
  title.contentEditable = "true";
  title.textContent = n.title;

  const actions = document.createElement("div");
  actions.className = "actions";
  const pinBtn = btn("📌", "Pin/Unpin");
  const delBtn = btn("🗑️", "Delete");

  actions.append(pinBtn, delBtn);
  header.append(title, actions);

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

  // wire events
  const saveDebounced = debounce(() => {
    n.title = sanitize(title.textContent);
    n.body  = sanitize(body.textContent);
    touch(n); save(); render(); // re-render to update ordering & timestamps
  }, 300);

  title.addEventListener("input", saveDebounced);
  body.addEventListener("input", saveDebounced);

  pinBtn.addEventListener("click", () => {
    n.pinned = !n.pinned;
    touch(n); save(); render();
  });

  delBtn.addEventListener("click", () => {
    if (!confirm("Delete this note?")) return;
    notes = notes.filter(x => x.id !== n.id);
    save(); render();
  });

  card.append(header, body, meta);
  return card;
}

function btn(text, aria) {
  const b = document.createElement("button");
  b.className = "icon-btn";
  b.setAttribute("aria-label", aria);
  b.textContent = text;
  return b;
}

function focusTitle(id) {
  const first = [...document.querySelectorAll(".note .title")]
    .find(el => el.closest(".note") && notes.some(n => n.id === id && el.textContent === n.title));
  if (first) {
    first.focus();
    document.getSelection()?.selectAllChildren(first);
  }
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
  // ukloni control chars, trim whitespace
  return str.replace(/[\u0000-\u001F\u007F]/g, "").trim();
}

function debounce(fn, ms=300) {
  let t; 
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}