const seedAlerts = [
  { id: "INC-1042", level: "high", title: "Tentatives de connexion inhabituelles", source: "Pare-feu · 192.0.2.44", time: "il y a 4 min", detail: "18 tentatives SSH sur srv-web-01 en moins de 90 secondes." },
  { id: "INC-1041", level: "medium", title: "Port sensible détecté ouvert", source: "srv-web-01 · TCP/22", time: "il y a 18 min", detail: "Le port SSH est accessible depuis un segment non administrateur." },
  { id: "INC-1040", level: "medium", title: "Trafic sortant inhabituel", source: "poste-042 · DNS", time: "il y a 31 min", detail: "Hausse de requêtes vers un domaine classé à surveiller." },
  { id: "INC-1039", level: "high", title: "Certificat bientôt expiré", source: "api-gateway · J-12", time: "il y a 46 min", detail: "Le certificat TLS expire dans 12 jours." }
];
const alerts = JSON.parse(localStorage.getItem("sentinel-alerts") || "null") || seedAlerts;
const assets = [
  { icon: "▣", name: "srv-web-01", ip: "192.0.2.10", status: "online", label: "En ligne", seen: "À l'instant" },
  { icon: "▤", name: "db-primary", ip: "192.0.2.20", status: "online", label: "En ligne", seen: "Il y a 2 min" },
  { icon: "▥", name: "poste-042", ip: "192.0.2.42", status: "warning", label: "À vérifier", seen: "Il y a 31 min" },
  { icon: "▣", name: "api-gateway", ip: "192.0.2.5", status: "online", label: "En ligne", seen: "Il y a 4 min" }
];
const traffic = [42, 48, 38, 57, 50, 71, 63, 78, 65, 92, 84, 76, 88, 69, 73, 61, 79, 67, 96, 74, 81, 62, 70, 58, 65];
const $ = (selector) => document.querySelector(selector);

function persist() { localStorage.setItem("sentinel-alerts", JSON.stringify(alerts)); }
function toast(message) {
  const node = document.createElement("div"); node.className = "toast"; node.textContent = message; $("#toast-region").append(node);
  setTimeout(() => node.remove(), 3200);
}
function renderAlerts() {
  const search = ($("#alert-search")?.value || "").toLowerCase();
  const severity = $("#severity-filter")?.value || "all";
  const filtered = alerts.filter((alert) => (severity === "all" || alert.level === severity) && `${alert.title} ${alert.source}`.toLowerCase().includes(search));
  $("#alert-list").innerHTML = filtered.length ? filtered.map((alert) => `
    <div class="alert-item" data-id="${alert.id}" tabindex="0">
      <span class="alert-severity ${alert.level}"></span><div class="alert-copy"><strong>${alert.title}</strong><small>${alert.source}</small></div>
      <span class="alert-time">${alert.time}</span><span class="alert-arrow">›</span>
    </div>`).join("") : `<p class="muted">Aucune alerte ne correspond à ce filtre.</p>`;
  $("#alert-count").textContent = String(alerts.length).padStart(2, "0");
  $("#nav-alert-count").textContent = alerts.length;
  document.querySelectorAll(".alert-item").forEach((item) => item.addEventListener("click", () => openAlert(item.dataset.id)));
}
function renderAssets(filter = "all") {
  const list = filter === "online" ? assets.filter((asset) => asset.status === "online") : assets;
  $("#asset-table").innerHTML = list.map((asset) => `<tr><td><span class="asset-name"><span class="device-icon">${asset.icon}</span>${asset.name}</span></td><td class="ip">${asset.ip}</td><td><span class="status ${asset.status}">${asset.label}</span></td><td class="last-seen">${asset.seen}</td></tr>`).join("");
}
function renderChart(values = traffic) {
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 720},${190 - value * 1.45}`);
  const path = `M ${points.join(" L ")}`;
  $("#chart-line").setAttribute("d", path); $("#chart-fill").setAttribute("d", `${path} L 720,190 L 0,190 Z`);
}
function renderTimeline() {
  $("#timeline").innerHTML = [
    ["09:42", "Collecte SIEM", "1 284 événements indexés"],
    ["09:38", "Règle déclenchée", "Détection credential stuffing"],
    ["09:31", "Analyste virtuel", "Corrélation terminée"]
  ].map(([time, title, detail]) => `<div class="timeline-item"><strong>${title}</strong><small>${time} · ${detail}</small></div>`).join("");
}
function openAlert(id) {
  const alert = alerts.find((item) => item.id === id); if (!alert) return;
  $("#dialog-title").textContent = alert.title; $("#dialog-source").textContent = `${alert.source} · ${alert.detail}`;
  $("#dialog-level").textContent = alert.level === "high" ? "HAUTE" : "MOYENNE"; $("#dialog-level").style.color = alert.level === "high" ? "var(--orange)" : "var(--blue)";
  $("#dialog-id").textContent = alert.id; $("#alert-dialog").dataset.id = id; $("#alert-dialog").showModal();
}
function download(filename, content, type) {
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = filename; link.click(); URL.revokeObjectURL(link.href);
}
function exportAlerts(format) {
  if (format === "json") download("sentinel-alerts.json", JSON.stringify(alerts, null, 2), "application/json");
  else download("sentinel-alerts.csv", `id,severity,title,source,time\n${alerts.map((item) => [item.id, item.level, item.title, item.source, item.time].map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n")}`, "text/csv");
  toast(`Export ${format.toUpperCase()} généré.`);
}

$("#current-date").textContent = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date()).toUpperCase();
renderAlerts(); renderAssets(); renderChart(); renderTimeline();
$("#dismiss-notice").addEventListener("click", (event) => event.currentTarget.closest(".notice").remove());
$("#refresh-button").addEventListener("click", (event) => {
  event.currentTarget.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: 550 });
  const score = 64 + Math.floor(Math.random() * 9); $("#risk-score").textContent = score; $("#risk-meter").style.width = `${score}%`;
  $("#event-count").textContent = (1250 + Math.floor(Math.random() * 80)).toLocaleString("fr-FR"); toast("Données de simulation actualisées.");
});
$("#filter-assets").addEventListener("click", (event) => { const all = event.currentTarget.dataset.filter !== "online"; event.currentTarget.dataset.filter = all ? "online" : "all"; event.currentTarget.textContent = all ? "En ligne uniquement ▾" : "Tous les actifs ▾"; renderAssets(all ? "online" : "all"); });
$("#chart-range").addEventListener("change", (event) => renderChart(event.target.value === "7" ? traffic.map((value, i) => Math.min(105, value + (i % 4) * 7)) : traffic));
$("#view-all").addEventListener("click", () => { $("#alert-search").value = ""; $("#severity-filter").value = "all"; renderAlerts(); toast("Toutes les alertes sont affichées."); });
$("#alert-search").addEventListener("input", renderAlerts); $("#severity-filter").addEventListener("change", renderAlerts);
$("#global-search").addEventListener("input", (event) => { if (event.target.value.trim()) { $("#alert-search").value = event.target.value; document.querySelector("#events").scrollIntoView({ behavior: "smooth" }); renderAlerts(); } });
document.addEventListener("keydown", (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); $("#global-search").focus(); } });
$("#theme-button").addEventListener("click", () => { document.body.classList.toggle("light"); localStorage.setItem("sentinel-theme", document.body.classList.contains("light") ? "light" : "dark"); });
if (localStorage.getItem("sentinel-theme") === "light") document.body.classList.add("light");
$("#simulate-button").addEventListener("click", () => {
  const id = `INC-${1043 + alerts.length - seedAlerts.length}`; alerts.unshift({ id, level: "high", title: "Nouvelle anomalie détectée", source: "Simulation · 192.0.2.77", time: "à l'instant", detail: "Un événement de démonstration vient d'être injecté dans le flux SOC." }); persist(); renderAlerts(); renderTimeline(); toast(`${id} ajouté au centre d'opérations.`); openAlert(id);
});
$("#export-json").addEventListener("click", () => exportAlerts("json")); $("#export-csv").addEventListener("click", () => exportAlerts("csv"));
$("#rotate-intel").addEventListener("click", () => toast("Signaux threat intel synchronisés."));
$("#dialog-close").addEventListener("click", () => $("#alert-dialog").close());
$("#ack-button").addEventListener("click", () => { $("#alert-dialog").close(); toast(`${$("#dialog-id").textContent} pris en charge par l'analyste.`); });
$("#dialog-export").addEventListener("click", () => { const alert = alerts.find((item) => item.id === $("#alert-dialog").dataset.id); if (alert) download(`${alert.id}.json`, JSON.stringify(alert, null, 2), "application/json"); });
