/* ============================================================================
   Haven — Life Admin  ·  app.js
   Created by Suryandu Ganguly

   Features:
   - Google Sign-In (real, via Google Identity Services) with a built-in
     fallback so the app works out of the box on GitHub Pages with no setup.
   - Per-account data: everything is keyed by the signed-in Google account, so
     logging in from another device restores the same tasks, docs, bills, etc.
   - Add + delete on every list (tasks, bills, documents, home items) and
     customisable vault categories.
   - Dark / light mode only, both fully readable.
   - Add-to-Calendar (Google Calendar) and auto-generated WhatsApp reminders.
   - User-provided money figures drive the Money page and "at a glance" card.
   ========================================================================== */

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* --------------------------------------------------------------------------
   1. GOOGLE SIGN-IN CONFIG
   --------------------------------------------------------------------------
   To enable REAL Google login:
     1. Go to https://console.cloud.google.com/apis/credentials
     2. Create an "OAuth 2.0 Client ID" of type "Web application".
     3. Add your GitHub Pages URL (e.g. https://username.github.io) to
        "Authorised JavaScript origins".
     4. Paste the client ID below.
   If left as-is, the app uses a built-in local sign-in instead (still works).   */
const GOOGLE_CLIENT_ID = ""; // e.g. "1234567890-abcxyz.apps.googleusercontent.com"

/* --------------------------------------------------------------------------
   2. STATE — user + per-account data
   -------------------------------------------------------------------------- */
const guest = { sub: "guest", name: "", email: "", picture: "", dob: "", location: "" };

// Which account is active (its id becomes part of every storage key).
let account = JSON.parse(localStorage.getItem("haven-account") || "null") || guest;

const prefDefaults = { theme: "light", language: "en", reminders: true, phone: "", onboarded: false };
const moneyDefaults = { spent: 0, upcoming: 0, budget: 0, cards: [
  { label: "This month", value: 0, note: "Your spending so far" },
  { label: "Auto-pay covered", value: 0, note: "Upcoming payments" },
  { label: "Subscriptions", value: 0, note: "Active services" }
] };

// Fresh accounts start with example content so the app never looks empty.
const seedTasks = [
  { name: "Renew car insurance", meta: "Insurance", due: "Next week", tag: "Important", urgent: true },
  { name: "Schedule a dental check-up", meta: "Health", due: "This week", tag: "This week" },
  { name: "Review your Netflix plan", meta: "Subscription", due: "This week", tag: "Quick win" }
];
const seedBills = [
  { logo: "⚡", name: "Electricity", when: "Due today", amount: 1860 },
  { logo: "N", name: "Netflix", when: "19 Jul · Auto-pay", amount: 649 }
];
const seedDocs = [
  { icon: "⌑", name: "Car insurance", detail: "Policy #IC-7429 · Expires 20 Jul 2026", status: "Renewal due soon", cat: "Insurance" },
  { icon: "▤", name: "Phone warranty", detail: "iPhone 15 · Valid until 14 Sep 2026", status: "Protected", cat: "Warranties" }
];
const seedHome = [
  { icon: "❄", name: "Air conditioner", detail: "Last serviced 10 months ago", service: "Book a service" },
  { icon: "◉", name: "Car — Honda City", detail: "Insurance renewal in 8 days", service: "Review insurance" }
];
const seedCategories = ["Insurance", "Warranties", "Home"];

// Loaded per-account in loadData().
let prefs, tasks, bills, docs, home, categories, money, activeVault = "All", activeTaskFilter = "all";

/* --------------------------------------------------------------------------
   3. STORAGE  (namespaced by account id → cross-device restore on re-login)
   -------------------------------------------------------------------------- */
const key = name => `haven:${account.sub}:${name}`;
const read = (name, fallback) => JSON.parse(localStorage.getItem(key(name)) || "null") ?? fallback;

function loadData() {
  prefs      = { ...prefDefaults, ...read("prefs", {}) };
  tasks      = read("tasks", structuredClone(seedTasks));
  bills      = read("bills", structuredClone(seedBills));
  docs       = read("docs", structuredClone(seedDocs));
  home       = read("home", structuredClone(seedHome));
  categories = read("categories", [...seedCategories]);
  money      = { ...moneyDefaults, ...read("money", {}), cards: read("money", {}).cards || structuredClone(moneyDefaults.cards) };
}

function save() {
  localStorage.setItem("haven-account", JSON.stringify(account));
  localStorage.setItem(key("prefs"), JSON.stringify(prefs));
  localStorage.setItem(key("tasks"), JSON.stringify(tasks));
  localStorage.setItem(key("bills"), JSON.stringify(bills));
  localStorage.setItem(key("docs"), JSON.stringify(docs));
  localStorage.setItem(key("home"), JSON.stringify(home));
  localStorage.setItem(key("categories"), JSON.stringify(categories));
  localStorage.setItem(key("money"), JSON.stringify(money));
}

/* --------------------------------------------------------------------------
   4. GOOGLE LOGIN
   -------------------------------------------------------------------------- */
function decodeJwt(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(atob(base64).split("").map(c =>
      "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
    return JSON.parse(json);
  } catch { return {}; }
}

// Called by Google Identity Services after a successful sign-in.
function handleGoogleCredential(response) {
  const p = decodeJwt(response.credential);
  signInWith({
    sub: p.sub || ("g-" + (p.email || "user")),
    name: p.given_name || p.name || "Friend",
    email: p.email || "",
    picture: p.picture || "",
    dob: p.birthdate || "",         // present when the DOB scope is granted
    location: p.locale || ""
  });
}

function initGoogle() {
  if (GOOGLE_CLIENT_ID && window.google?.accounts?.id) {
    google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
    google.accounts.id.renderButton($("#googleBtn"), { theme: "outline", size: "large", width: 320, text: "continue_with" });
    $("#localLoginBtn").style.display = "none";
  } else {
    // No client ID configured → use the built-in local sign-in button.
    $("#googleBtn").style.display = "none";
    $("#loginHint").textContent = "Sign in to create your personal space. Add a Google Client ID in app.js to enable full Google login.";
  }
}

function signInWith(profile) {
  account = { ...guest, ...profile };
  loadData();
  // First time this account signs in, pull whatever Google shared into details.
  prefs.name = prefs.name || account.name;
  account.dob = account.dob || read("account-dob", "");
  account.location = account.location || read("account-location", "");
  prefs.onboarded = true;
  save();
  applyAll();
  hideWelcome();
  toast(`Welcome to Haven, ${prefs.name || account.name}.`);
}

function localLogin() {
  // A friendly stand-in when no Google Client ID is set. Uses a stable id so
  // the same person keeps their data across visits on this browser.
  signInWith({ sub: "local-user", name: "Surya", email: "you@gmail.com", picture: "", dob: "", location: "Bengaluru, India" });
}

function signOut() {
  if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
  account = guest;
  localStorage.setItem("haven-account", JSON.stringify(account));
  closeSettings();
  showWelcome();
  toast("Signed out. Your data is safely stored.");
}

function showWelcome() { $("#welcomeScreen").classList.remove("hide"); }
function hideWelcome() { $("#welcomeScreen").classList.add("hide"); }

/* --------------------------------------------------------------------------
   5. TRANSLATIONS (nav labels + greeting)
   -------------------------------------------------------------------------- */
const translations = {
  en: { overview:"Overview", tasks:"Tasks", money:"Money", documents:"Documents", home:"Home & things", settings:"Settings", greet:"Good morning" },
  hi: { overview:"अवलोकन", tasks:"काम", money:"पैसे", documents:"दस्तावेज़", home:"घर और चीज़ें", settings:"सेटिंग्स", greet:"नमस्ते" },
  bn: { overview:"পর্যালোচনা", tasks:"কাজ", money:"অর্থ", documents:"নথি", home:"বাড়ি ও জিনিস", settings:"সেটিংস", greet:"নমস্কার" }
};

/* --------------------------------------------------------------------------
   6. APPLY PREFERENCES / PROFILE
   -------------------------------------------------------------------------- */
function applyPrefs() {
  document.body.dataset.theme = prefs.theme;
  document.documentElement.lang = prefs.language;
  const t = translations[prefs.language];
  const displayName = prefs.name || account.name || "Friend";

  $("#profileName").textContent = displayName;
  $("#profileEmail").textContent = account.email || "Personal space";
  $("#avatarLetter").textContent = displayName.slice(0, 1).toUpperCase();
  $("#greeting").textContent = `${t.greet}, ${displayName}`;

  // Theme toggle labels
  const dark = prefs.theme === "dark";
  $("#themeToggle").textContent = dark ? "☀" : "☾";
  $("#themeQuick").innerHTML = dark ? "☀ Light mode" : "☾ Dark mode";

  // Settings fields
  $("#settingName").value = displayName;
  $("#settingLanguage").value = prefs.language;
  $("#remindersToggle").checked = prefs.reminders;
  $("#settingPhone").value = prefs.phone || "";
  $("#settingDob").value = account.dob || "";
  $("#settingLocation").value = account.location || "";
  $("#settingAccountName").textContent = account.name || displayName;
  $("#settingAccountEmail").textContent = account.email || "Personal account";
  $("#settingAvatar").textContent = displayName.slice(0, 1).toUpperCase();
  $("#googleTag").style.display = account.email ? "" : "none";

  // Selected theme swatch
  $$(".theme-options button").forEach(b => b.classList.toggle("selected", b.dataset.theme === prefs.theme));

  // Nav labels
  $$(".nav-item").forEach(n => {
    const label = { dashboard:t.overview, tasks:t.tasks, money:t.money, documents:t.documents, home:t.home }[n.dataset.page];
    const textNode = [...n.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.nodeValue = " " + label + " ";
  });
  $("#settingsBtn").innerHTML = `⚙ ${t.settings}`;
}

/* --------------------------------------------------------------------------
   7. HELPERS — calendar + WhatsApp links, formatting
   -------------------------------------------------------------------------- */
const money0 = n => "₹" + Number(n || 0).toLocaleString("en-IN");

// Google Calendar "add event" link for tomorrow 9am (a gentle default reminder).
function calendarLink(title, details = "") {
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
  const start = d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  d.setHours(10);
  const end = d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const p = new URLSearchParams({ action: "TEMPLATE", text: "Haven · " + title, details, dates: `${start}/${end}` });
  return "https://calendar.google.com/calendar/render?" + p.toString();
}

// WhatsApp reminder link. Uses the saved number if present, else opens a share.
function whatsappLink(title, meta = "") {
  const msg = `🔔 Haven reminder: ${title}${meta ? " — " + meta : ""}. Let's keep it handled! ✅`;
  const num = (prefs.phone || "").replace(/\D/g, "");
  return num ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
             : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

function actionBtns(title, meta) {
  return `<div class="row-actions">
    <a class="mini-action cal" title="Add to Google Calendar" target="_blank" rel="noopener" href="${calendarLink(title, meta)}">📅</a>
    <a class="mini-action wa" title="Send WhatsApp reminder" target="_blank" rel="noopener" href="${whatsappLink(title, meta)}">💬</a>
  </div>`;
}

/* --------------------------------------------------------------------------
   8. RENDERING
   -------------------------------------------------------------------------- */
function render() {
  renderTimeline();
  renderNudges();
  renderTasks();
  renderBills();
  renderMoney();
  renderVaultFilters();
  renderDocs();
  renderVaultPreview();
  renderHome();

  const open = tasks.filter(t => !t.done).length;
  $("#taskBadge").textContent = open;
  $("#nudgeCount").textContent = Math.min(open, 3);
  $("#doneCount").textContent = tasks.filter(t => t.done).length;

  // Dashboard focus
  const firstUrgent = tasks.find(t => !t.done && t.urgent) || tasks.find(t => !t.done);
  $("#focusText").textContent = firstUrgent
    ? `Set aside a few minutes for: ${firstUrgent.name}.`
    : "You're all caught up. Enjoy the calm. ✦";
}

function renderTimeline() {
  const items = tasks.filter(t => !t.done).slice(0, 5);
  $("#timeline").innerHTML = items.length ? items.map(t => `
    <div class="timeline-item ${t.urgent ? "urgent" : ""}">
      <div class="timeline-date">${(t.due || "SOON").toUpperCase().slice(0,7)}</div>
      <div class="timeline-line"></div>
      <div class="timeline-content"><strong>${esc(t.name)}</strong><span>${esc(t.meta || "")}</span></div>
    </div>`).join("") : `<p class="empty">Nothing scheduled — add a task to see it here.</p>`;
}

function renderNudges() {
  const open = tasks.filter(t => !t.done).slice(0, 3);
  $("#nudgeList").innerHTML = open.length ? open.map(t => {
    const i = tasks.indexOf(t);
    return `<div class="nudge">
      <div class="nudge-icon">${t.urgent ? "⌑" : "◉"}</div>
      <div><strong>${esc(t.name)}</strong><span>${esc(t.meta || "")}</span></div>
      ${actionBtns(t.name, t.meta)}
      <button class="complete-nudge" data-i="${i}" title="Mark done">✓</button>
    </div>`;
  }).join("") : `<p class="empty">No actions right now. 🌱</p>`;
}

function renderTasks() {
  const list = tasks.filter(t =>
    activeTaskFilter === "all" ? true :
    activeTaskFilter === "open" ? !t.done : t.done);

  $("#allTasks").innerHTML = list.length ? list.map(t => {
    const i = tasks.indexOf(t);
    return `<div class="task-row ${t.done ? "done" : ""}">
      <input class="task-check" data-i="${i}" type="checkbox" ${t.done ? "checked" : ""}>
      <div class="task-info"><strong>${esc(t.name)}</strong><span>${esc([t.meta, t.due].filter(Boolean).join(" · "))}</span></div>
      <span class="tag ${t.urgent ? "urgent" : ""}">${esc(t.tag || "Task")}</span>
      ${actionBtns(t.name, t.meta)}
      <button class="delete-btn" data-del="task" data-i="${i}" title="Delete">🗑</button>
    </div>`;
  }).join("") : `<p class="empty">No tasks here yet. Tap “+ New task”.</p>`;
}

function renderBills() {
  $("#billsList").innerHTML = bills.length ? bills.map((b, i) => `
    <div class="bill-row">
      <div class="bill-logo">${esc(b.logo || "₹")}</div>
      <div class="bill-info"><strong>${esc(b.name)}</strong><span>${esc(b.when || "")}</span></div>
      <div class="bill-amount"><strong>${money0(b.amount)}</strong><span>Upcoming</span></div>
      ${actionBtns(b.name + " payment", money0(b.amount))}
      <button class="delete-btn" data-del="bill" data-i="${i}" title="Delete">🗑</button>
    </div>`).join("") : `<p class="empty">No bills added yet.</p>`;
}

function renderMoney() {
  const spent = money.spent || bills.reduce((s, b) => s + Number(b.amount || 0), 0);
  const upcoming = money.upcoming || bills.reduce((s, b) => s + Number(b.amount || 0), 0);
  const budget = money.budget || (spent + upcoming) || 1;
  const pct = Math.min(100, Math.round((spent / budget) * 100));

  $("#mpSpent").textContent = money0(spent);
  $("#mpUpcoming").textContent = money0(upcoming);
  $("#mpBar").style.width = pct + "%";
  $("#mpNote").textContent = money.budget ? `${pct}% of your ${money0(budget)} monthly budget` : "Set your monthly budget with “Edit figures”.";

  $("#moneyOverview").innerHTML = money.cards.map(c => `
    <article><span>${esc(c.label)}</span><strong>${money0(c.value)}</strong><small>${esc(c.note || "")}</small></article>`).join("");
}

function renderVaultFilters() {
  const chips = ["All", ...categories];
  $("#vaultFilters").innerHTML = chips.map(c => `
    <button class="filter ${c === activeVault ? "active" : ""}" data-cat="${esc(c)}">
      ${esc(c)}${c !== "All" ? `<i class="chip-x" data-rmcat="${esc(c)}" title="Remove category">×</i>` : ""}
    </button>`).join("") + `<button class="filter add-cat" id="addCatBtn">+ Category</button>`;
}

function renderDocs() {
  const list = activeVault === "All" ? docs : docs.filter(d => d.cat === activeVault);
  $("#documentGrid").innerHTML = list.length ? list.map(d => {
    const i = docs.indexOf(d);
    return `<article class="document-card">
      <button class="delete-btn corner" data-del="doc" data-i="${i}" title="Delete">🗑</button>
      <div class="big-doc-icon">${esc(d.icon || "▤")}</div>
      <h3>${esc(d.name)}</h3><p>${esc(d.detail || "")}</p>
      <span class="status">● ${esc(d.status || "Saved")}</span>
      <span class="cat-pill">${esc(d.cat || "General")}</span>
    </article>`;
  }).join("") : `<p class="empty wide">No documents in “${esc(activeVault)}”. Tap “+ Add document”.</p>`;
}

function renderVaultPreview() {
  $("#vaultPreview").innerHTML = docs.slice(0, 2).map(d => `
    <div class="doc-preview">
      <div class="doc-icon insurance">${esc(d.icon || "▤")}</div>
      <div><strong>${esc(d.name)}</strong><span>${esc(d.status || "")}</span></div>
    </div>`).join("") || `<p class="empty">Your vault is empty.</p>`;
}

function renderHome() {
  $("#homeGrid").innerHTML = home.length ? home.map((h, i) => `
    <article class="home-item">
      <button class="delete-btn corner" data-del="home" data-i="${i}" title="Delete">🗑</button>
      <div class="home-symbol">${esc(h.icon || "⌂")}</div>
      <h3>${esc(h.name)}</h3><p>${esc(h.detail || "")}</p>
      <span class="service">${esc(h.service || "Set reminder")}</span>
    </article>`).join("") : `<p class="empty wide">No items yet. Tap “+ Add item”.</p>`;
}

// Basic HTML escaping so user input can't break the layout.
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }

/* --------------------------------------------------------------------------
   9. EVENT WIRING — rendered lists (add / delete / complete)
   -------------------------------------------------------------------------- */
document.addEventListener("click", e => {
  const del = e.target.closest("[data-del]");
  if (del) {
    const i = +del.dataset.i;
    ({ task: tasks, bill: bills, doc: docs, home: home }[del.dataset.del]).splice(i, 1);
    save(); render(); toast("Removed.");
    return;
  }
  const complete = e.target.closest(".complete-nudge");
  if (complete) { tasks[+complete.dataset.i].done = true; save(); render(); toast("Marked complete — nicely done."); return; }

  const rmcat = e.target.closest("[data-rmcat]");
  if (rmcat) {
    e.stopPropagation();
    const c = rmcat.dataset.rmcat;
    categories = categories.filter(x => x !== c);
    docs.forEach(d => { if (d.cat === c) d.cat = "General"; });
    if (activeVault === c) activeVault = "All";
    save(); render(); toast(`Category “${c}” removed.`);
    return;
  }
  const catBtn = e.target.closest("[data-cat]");
  if (catBtn) { activeVault = catBtn.dataset.cat; render(); return; }

  if (e.target.id === "addCatBtn") {
    const name = prompt("New vault category name:");
    if (name && name.trim()) { categories.push(name.trim()); activeVault = name.trim(); save(); render(); toast("Category added."); }
  }
});

document.addEventListener("change", e => {
  if (e.target.classList.contains("task-check")) {
    tasks[+e.target.dataset.i].done = e.target.checked;
    save(); render(); toast(e.target.checked ? "Nice — marked complete." : "Moved back to your list.");
  }
});

// Task filters
$("#taskFilters").addEventListener("click", e => {
  const f = e.target.closest(".filter"); if (!f) return;
  activeTaskFilter = f.dataset.filter;
  $$("#taskFilters .filter").forEach(b => b.classList.toggle("active", b === f));
  renderTasks();
});

/* --------------------------------------------------------------------------
   10. ADD / EDIT MODAL — dynamic form per type
   -------------------------------------------------------------------------- */
const modal = $("#modalBackdrop");
let modalType = "task";

const modalForms = {
  task: {
    title: "New task",
    fields: `<label>What needs attention?<input name="name" required placeholder="e.g. Book a dental check-up" /></label>
             <label>Category / note<input name="meta" placeholder="e.g. Health" /></label>
             <label>When?<select name="due"><option>Today</option><option>This week</option><option>Next week</option><option>No due date</option></select></label>
             <label class="check-inline"><input type="checkbox" name="urgent" /> Mark as important</label>`,
    add: f => tasks.unshift({ name: f.name, meta: f.meta, due: f.due, tag: f.urgent ? "Important" : "New", urgent: !!f.urgent })
  },
  bill: {
    title: "Add bill",
    fields: `<label>Bill name<input name="name" required placeholder="e.g. Internet" /></label>
             <label>When / note<input name="when" placeholder="e.g. 23 Jul · Auto-pay" /></label>
             <label>Amount (₹)<input name="amount" type="number" min="0" required placeholder="999" /></label>
             <label>Icon (emoji, optional)<input name="logo" maxlength="2" placeholder="⚡" /></label>`,
    add: f => bills.push({ logo: f.logo || "₹", name: f.name, when: f.when, amount: +f.amount || 0 })
  },
  doc: {
    title: "Add document",
    fields: () => `<label>Document name<input name="name" required placeholder="e.g. Health insurance" /></label>
             <label>Details<input name="detail" placeholder="Policy no · expiry date" /></label>
             <label>Status<input name="status" placeholder="e.g. Protected" /></label>
             <label>Category<select name="cat">${categories.map(c => `<option>${esc(c)}</option>`).join("")}<option>General</option></select></label>
             <label>Icon (emoji, optional)<input name="icon" maxlength="2" placeholder="▤" /></label>`,
    add: f => docs.unshift({ icon: f.icon || "▤", name: f.name, detail: f.detail, status: f.status || "Saved", cat: f.cat || "General" })
  },
  home: {
    title: "Add item",
    fields: `<label>Item name<input name="name" required placeholder="e.g. Washing machine" /></label>
             <label>Details<input name="detail" placeholder="e.g. Warranty until 2027" /></label>
             <label>Action label<input name="service" placeholder="e.g. Set reminder" /></label>
             <label>Icon (emoji, optional)<input name="icon" maxlength="2" placeholder="⌂" /></label>`,
    add: f => home.unshift({ icon: f.icon || "⌂", name: f.name, detail: f.detail, service: f.service || "Set reminder" })
  }
};

function openModal(type) {
  modalType = type;
  const cfg = modalForms[type];
  $("#modalTitle").textContent = cfg.title;
  $("#entryForm").innerHTML = (typeof cfg.fields === "function" ? cfg.fields() : cfg.fields)
    + `<button class="add-btn" type="submit">Save it</button>`;
  modal.classList.add("show");
  $("#entryForm").querySelector("input,select")?.focus();
}
function closeModal() { modal.classList.remove("show"); }

$("#entryForm").addEventListener("submit", e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target).entries());
  f.urgent = e.target.querySelector('[name="urgent"]')?.checked;
  modalForms[modalType].add(f);
  save(); render(); closeModal();
  const page = { task: "tasks", bill: "money", doc: "documents", home: "home" }[modalType];
  openPage(page);
  toast("Saved to your Haven.");
});

// Which "+" button opens which form
$("#addBtn").onclick     = () => openModal("task");
$("#newTaskBtn").onclick = () => openModal("task");
$("#newBillBtn").onclick = () => openModal("bill");
$("#uploadBtn").onclick  = () => openModal("doc");
$("#newItemBtn").onclick = () => openModal("home");
$(".close-modal").onclick = closeModal;
modal.onclick = e => { if (e.target === modal) closeModal(); };
$("#focusTaskBtn").onclick = () => openPage("tasks");

/* --------------------------------------------------------------------------
   11. MONEY "edit figures" — quick inline editor
   -------------------------------------------------------------------------- */
$("#editMoneyBtn").onclick = () => {
  const spent = prompt("Amount spent so far this month (₹):", money.spent || "");
  if (spent === null) return;
  const upcoming = prompt("Amount coming up (₹):", money.upcoming || "");
  const budget = prompt("Your monthly budget (₹):", money.budget || "");
  money.spent = +spent || 0;
  money.upcoming = +upcoming || 0;
  money.budget = +budget || 0;
  // Keep the three overview cards in step with the headline figures.
  money.cards[0].value = money.spent;
  money.cards[1].value = money.upcoming;
  save(); render(); toast("Your figures are updated.");
};

/* --------------------------------------------------------------------------
   12. NAVIGATION
   -------------------------------------------------------------------------- */
function openPage(id) {
  $$(".page").forEach(p => p.classList.toggle("active-page", p.id === id));
  $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.page === id));
  window.scrollTo(0, 0);
  $(".sidebar").classList.remove("open");
}
$$(".nav-item").forEach(n => n.onclick = e => { e.preventDefault(); openPage(n.dataset.page); });
$$("[data-go]").forEach(b => b.onclick = () => openPage(b.dataset.go));
$(".mobile-menu").onclick = () => $(".sidebar").classList.toggle("open");
$("#notifyBtn").onclick = () => toast(`You have ${tasks.filter(t => !t.done).length} things that need attention.`);

/* --------------------------------------------------------------------------
   13. THEME TOGGLE (dark / light only)
   -------------------------------------------------------------------------- */
function toggleTheme() { prefs.theme = prefs.theme === "dark" ? "light" : "dark"; save(); applyPrefs(); }
$("#themeToggle").onclick = toggleTheme;
$("#themeQuick").onclick = toggleTheme;

/* --------------------------------------------------------------------------
   14. SETTINGS
   -------------------------------------------------------------------------- */
const settings = $("#settingsBackdrop");
function openSettings() { applyPrefs(); settings.classList.add("show"); }
function closeSettings() { settings.classList.remove("show"); }
$("#settingsBtn").onclick = openSettings;
$("#profileBtn").onclick = openSettings;
$(".close-settings").onclick = closeSettings;
settings.onclick = e => { if (e.target === settings) closeSettings(); };
$("#signOutBtn").onclick = signOut;
$$(".theme-options button").forEach(b => b.onclick = () => { prefs.theme = b.dataset.theme; applyPrefs(); });

$("#saveSettings").onclick = () => {
  prefs.name = $("#settingName").value.trim() || account.name || "Friend";
  prefs.language = $("#settingLanguage").value;
  prefs.reminders = $("#remindersToggle").checked;
  prefs.phone = $("#settingPhone").value.trim();
  account.dob = $("#settingDob").value;
  account.location = $("#settingLocation").value.trim();
  // Remember details even across sign-out on this browser.
  localStorage.setItem(key("account-dob"), JSON.stringify(account.dob));
  localStorage.setItem(key("account-location"), JSON.stringify(account.location));
  save(); applyPrefs(); render(); closeSettings();
  toast("Your Haven has been personalised.");
};

/* --------------------------------------------------------------------------
   15. HAVEN AI (simple offline helper)
   -------------------------------------------------------------------------- */
const ai = $("#aiPanel");
$("#aiFab").onclick = () => ai.classList.toggle("open");
$("#closeAi").onclick = () => ai.classList.remove("open");

function aiReply(q) {
  const s = q.toLowerCase();
  const open = tasks.filter(t => !t.done).length;
  if (s.includes("week") || s.includes("plan"))
    return open ? `A gentle plan: start with “${tasks.find(t=>!t.done).name}”, then work through your ${open} open tasks one at a time.`
                : "You have no open tasks — a rare, lovely kind of week. Enjoy it. ✦";
  if (s.includes("money") || s.includes("save") || s.includes("bill"))
    return `You have ${money0(money.upcoming)} coming up across ${bills.length} bills. Tackle the nearest one first.`;
  if (s.includes("attention") || s.includes("urgent")) {
    const u = tasks.find(t => !t.done && t.urgent) || tasks.find(t => !t.done);
    return u ? `Your clearest next action is “${u.name}”. You have ${open} open tasks in total.` : "Nothing urgent right now. 🌱";
  }
  return "I can help you choose a next step. Try “What needs attention?” or “Plan my week.”";
}
function addMessage(text, who = "ai") {
  const el = document.createElement("div");
  el.className = who === "user" ? "user-message" : "ai-message";
  el.textContent = text;
  $("#aiMessages").appendChild(el);
  $("#aiMessages").scrollTop = 9999;
}
$("#aiForm").onsubmit = e => {
  e.preventDefault();
  const q = $("#aiInput").value.trim(); if (!q) return;
  addMessage(q, "user"); $("#aiInput").value = "";
  setTimeout(() => addMessage(aiReply(q)), 360);
};
$$(".ai-suggestions button").forEach(b => b.onclick = () => { addMessage(b.textContent, "user"); setTimeout(() => addMessage(aiReply(b.textContent)), 300); });

/* --------------------------------------------------------------------------
   16. TOAST + BOOT
   -------------------------------------------------------------------------- */
function toast(t) {
  const el = $("#toast");
  el.textContent = t; el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

function applyAll() { applyPrefs(); render(); }

// Login buttons
$("#localLoginBtn").onclick = localLogin;

// Google script may load after us — poll briefly until it's ready.
(function waitForGoogle(tries = 0) {
  if (window.google?.accounts?.id || tries > 20) initGoogle();
  else setTimeout(() => waitForGoogle(tries + 1), 150);
})();

// Date
const now = new Date();
$("#todayDate").textContent = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

// Boot: if a returning user is already signed in, go straight into the app.
loadData();
if (account.sub !== "guest") { applyAll(); hideWelcome(); }
else { applyPrefs(); showWelcome(); }
