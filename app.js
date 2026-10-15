let state = { alerts: [], assets: [], traffic: [], events: [], summary: {} };
let currentUser = null;
const API_BASE = String(window.SENTINEL_API_URL || "").replace(/\/$/, "");
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
const relativeTime = (date) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  return minutes < 1 ? "à l'instant" : minutes < 60 ? `il y a ${minutes} min` : `il y a ${Math.floor(minutes / 60)} h`;
};
function toast(message) {
  const node = document.createElement("div"); node.className = "toast"; node.textContent = message; $("#toast-region").append(node);
  setTimeout(() => node.remove(), 3400);
}
function renderSummary() {
  const data = state.summary;
  $("#risk-score").textContent = data.risk; $("#risk-meter").style.width = `${data.risk}%`;
  $("#alert-count").textContent = String(data.alerts).padStart(2, "0"); $("#nav-alert-count").textContent = data.alerts;
  $("#event-count").textContent = Number(data.events).toLocaleString("fr-FR");
  const protectedNode = document.querySelector(".stat-card .unit"); if (protectedNode) protectedNode.previousSibling.textContent = data.protected;
}
function renderAlerts() {
  const search = ($("#alert-search")?.value || "").toLowerCase(); const severity = $("#severity-filter")?.value || "all";
  const filtered = state.alerts.filter((alert) => (severity === "all" || alert.level === severity) && `${alert.title} ${alert.source}`.toLowerCase().includes(search));
  $("#alert-list").innerHTML = filtered.length ? filtered.map((alert) => `<div class="alert-item" data-id="${esc(alert.id)}" tabindex="0"><span class="alert-severity ${esc(alert.level)}"></span><div class="alert-copy"><strong>${esc(alert.title)}</strong><small>${esc(alert.source)}</small></div><span class="alert-time">${relativeTime(alert.createdAt)}</span><span class="alert-arrow">›</span></div>`).join("") : `<p class="muted">Aucune alerte ne correspond à ce filtre.</p>`;
  document.querySelectorAll(".alert-item").forEach((item) => item.addEventListener("click", () => openAlert(item.dataset.id)));
}
function renderAssets(filter = "all") {
  const list = filter === "online" ? state.assets.filter((asset) => asset.status === "online") : state.assets;
  $("#asset-table").innerHTML = list.map((asset) => `<tr><td><span class="asset-name"><span class="device-icon">▣</span>${esc(asset.name)}</span></td><td class="ip">${esc(asset.ip)}</td><td><span class="status ${esc(asset.status)}">${asset.status === "online" ? "En ligne" : "À vérifier"}</span></td><td class="last-seen">${relativeTime(asset.lastSeen)}</td></tr>`).join("");
}
function renderChart() {
  const values = state.traffic.map((item) => item.incoming); if (!values.length) return;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 720},${190 - value * 1.45}`);
  const path = `M ${points.join(" L ")}`; $("#chart-line").setAttribute("d", path); $("#chart-fill").setAttribute("d", `${path} L 720,190 L 0,190 Z`);
}
function renderTimeline() {
  $("#timeline").innerHTML = state.events.slice(0, 3).map((event) => `<div class="timeline-item"><strong>${esc(event.kind === "alert" ? "Alerte corrélée" : event.kind)}</strong><small>${relativeTime(event.createdAt)} · ${esc(event.message)}</small></div>`).join("");
}
async function renderAdmin() {
  if (!currentUser || currentUser.role !== "admin") { $("#admin-panel").hidden = true; return; }
  $("#admin-panel").hidden = false; $("#current-role").textContent = currentUser.role.toUpperCase();
  const [users, audit] = await Promise.all([api("/api/admin/users"), api("/api/admin/audit")]);
  $("#user-table").innerHTML = users.map((user) => `<tr><td><strong>${esc(user.name)}</strong><br><small class="muted">${esc(user.email)}</small></td><td>${esc(user.role)}</td><td><span class="status online">${user.active ? "Actif" : "Désactivé"}</span></td><td class="last-seen">${user.lastLogin ? relativeTime(user.lastLogin) : "Jamais"}</td></tr>`).join("");
  $("#audit-list").innerHTML = audit.slice(0, 8).map((row) => `<div class="audit-row"><strong>${esc(row.action)}</strong><small>${esc(row.email || "système")} · ${relativeTime(row.created_at)}</small></div>`).join("");
}
function render() { renderSummary(); renderAlerts(); renderAssets(); renderChart(); renderTimeline(); }
async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include", headers: { "Content-Type": "application/json", ...options.headers }, ...options });
  if (!response.ok) {
    let message = "Erreur API";
    try { message = (await response.json()).error || message; } catch { /* réponse non JSON */ }
    throw new Error(message);
  }
  return response.json();
}
async function loadDashboard() { state = await api("/api/dashboard"); render(); await renderAdmin(); }
function openAlert(id) {
  const alert = state.alerts.find((item) => item.id === id); if (!alert) return;
  $("#dialog-title").textContent = alert.title; $("#dialog-source").textContent = `${alert.source} · ${alert.detail}`;
  $("#dialog-level").textContent = alert.level.toUpperCase(); $("#dialog-level").style.color = alert.level === "critical" || alert.level === "high" ? "var(--orange)" : "var(--blue)";
  $("#dialog-id").textContent = alert.id; $("#alert-dialog").dataset.id = id; $("#alert-dialog").showModal();
}
function download(filename, content, type) { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = filename; link.click(); URL.revokeObjectURL(link.href); }
async function exportAlerts(format) {
  const alerts = await api("/api/alerts");
  if (format === "json") download("sentinel-alerts.json", JSON.stringify(alerts, null, 2), "application/json");
  else download("sentinel-alerts.csv", `id,severity,title,source,status,created_at\n${alerts.map((item) => [item.id, item.level, item.title, item.source, item.status, item.created_at].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n")}`, "text/csv");
  toast(`Export ${format.toUpperCase()} généré depuis SQLite.`);
}
$("#current-date").textContent = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date()).toUpperCase();
$("#dismiss-notice").addEventListener("click", (event) => event.currentTarget.closest(".notice").remove());
$("#refresh-button").addEventListener("click", async (event) => { event.currentTarget.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: 550 }); await loadDashboard(); toast("Données rechargées depuis SQLite."); });
$("#filter-assets").addEventListener("click", (event) => { const all = event.currentTarget.dataset.filter !== "online"; event.currentTarget.dataset.filter = all ? "online" : "all"; event.currentTarget.textContent = all ? "En ligne uniquement ▾" : "Tous les actifs ▾"; renderAssets(all ? "online" : "all"); });
$("#view-all").addEventListener("click", () => { $("#alert-search").value = ""; $("#severity-filter").value = "all"; renderAlerts(); toast("Toutes les alertes sont affichées."); });
$("#alert-search").addEventListener("input", renderAlerts); $("#severity-filter").addEventListener("change", renderAlerts);
$("#global-search").addEventListener("input", (event) => { if (event.target.value.trim()) { $("#alert-search").value = event.target.value; $("#events").scrollIntoView({ behavior: "smooth" }); renderAlerts(); } });
document.addEventListener("keydown", (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); $("#global-search").focus(); } });
$("#theme-button").addEventListener("click", () => { document.body.classList.toggle("light"); localStorage.setItem("sentinel-theme", document.body.classList.contains("light") ? "light" : "dark"); });
if (localStorage.getItem("sentinel-theme") === "light") document.body.classList.add("light");
$("#simulate-button").addEventListener("click", async () => { const alert = await api("/api/simulate", { method: "POST" }); await loadDashboard(); toast(`${alert.id} enregistré dans SQLite.`); openAlert(alert.id); });
$("#export-json").addEventListener("click", () => exportAlerts("json")); $("#export-csv").addEventListener("click", () => exportAlerts("csv"));
$("#rotate-intel").addEventListener("click", () => toast("Signaux threat intel synchronisés."));
$("#dialog-close").addEventListener("click", () => $("#alert-dialog").close());
$("#ack-button").addEventListener("click", async () => { await api("/api/alerts/ack", { method: "POST", body: JSON.stringify({ id: $("#alert-dialog").dataset.id }) }); $("#alert-dialog").close(); await loadDashboard(); toast("Incident pris en charge et écrit dans SQLite."); });
$("#dialog-export").addEventListener("click", () => { const alert = state.alerts.find((item) => item.id === $("#alert-dialog").dataset.id); if (alert) download(`${alert.id}.json`, JSON.stringify(alert, null, 2), "application/json"); });
$("#login-form").addEventListener("submit", async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); try { const result = await api("/api/auth/login", { method: "POST", body: JSON.stringify(data) }); currentUser = result.user; $("#login-screen").classList.add("hidden"); toast(`Session ouverte : ${currentUser.name}`); await loadDashboard(); } catch (error) { $("#login-error").textContent = error.message; } });
$("#logout-button").addEventListener("click", async () => { await api("/api/auth/logout", { method: "POST" }); location.reload(); });
$("#create-user").addEventListener("click", () => $("#user-dialog").showModal());
$("#user-dialog-close").addEventListener("click", () => $("#user-dialog").close());
$("#user-form").addEventListener("submit", async (event) => { event.preventDefault(); try { await api("/api/admin/users", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); $("#user-dialog").close(); event.currentTarget.reset(); await renderAdmin(); toast("Compte créé."); } catch (error) { toast(error.message); } });
function connectStream() {
  const stream = new EventSource(`${API_BASE}/api/stream`, { withCredentials: true });
  stream.addEventListener("dashboard", (event) => { state = JSON.parse(event.data); render(); renderAdmin(); $("#stream-status").textContent = "Flux temps réel"; });
  stream.addEventListener("alert", (event) => { const alert = JSON.parse(event.data); toast(`Nouvelle alerte temps réel : ${alert.id}`); });
  stream.onerror = () => { $("#stream-status").textContent = "Reconnexion..."; stream.close(); setTimeout(connectStream, 3000); };
}
api("/api/auth/me").then(async (result) => { currentUser = result.user; if (currentUser) { $("#login-screen").classList.add("hidden"); await loadDashboard(); connectStream(); } }).catch((error) => { toast(`Backend indisponible : ${error.message}`); console.error(error); });
