const alerts = [
  { level: "high", title: "Tentatives de connexion inhabituelles", source: "Pare-feu · 192.0.2.44", time: "il y a 4 min" },
  { level: "medium", title: "Port sensible détecté ouvert", source: "srv-web-01 · TCP/22", time: "il y a 18 min" },
  { level: "medium", title: "Trafic sortant inhabituel", source: "poste-042 · DNS", time: "il y a 31 min" },
  { level: "high", title: "Certificat bientôt expiré", source: "api-gateway · J-12", time: "il y a 46 min" }
];

const assets = [
  { icon: "▣", name: "srv-web-01", ip: "192.0.2.10", status: "online", label: "En ligne", seen: "À l'instant" },
  { icon: "▤", name: "db-primary", ip: "192.0.2.20", status: "online", label: "En ligne", seen: "Il y a 2 min" },
  { icon: "▥", name: "poste-042", ip: "192.0.2.42", status: "warning", label: "À vérifier", seen: "Il y a 31 min" },
  { icon: "▣", name: "api-gateway", ip: "192.0.2.5", status: "online", label: "En ligne", seen: "Il y a 4 min" }
];

const traffic = [42, 48, 38, 57, 50, 71, 63, 78, 65, 92, 84, 76, 88, 69, 73, 61, 79, 67, 96, 74, 81, 62, 70, 58, 65];

function renderAlerts() {
  document.querySelector("#alert-list").innerHTML = alerts.map((alert) => `
    <div class="alert-item">
      <span class="alert-severity ${alert.level}"></span>
      <div class="alert-copy"><strong>${alert.title}</strong><small>${alert.source}</small></div>
      <span class="alert-time">${alert.time}</span><span class="alert-arrow">›</span>
    </div>`).join("");
}

function renderAssets(filter = "all") {
  const filtered = filter === "online" ? assets.filter((asset) => asset.status === "online") : assets;
  document.querySelector("#asset-table").innerHTML = filtered.map((asset) => `
    <tr><td><span class="asset-name"><span class="device-icon">${asset.icon}</span>${asset.name}</span></td>
    <td class="ip">${asset.ip}</td><td><span class="status ${asset.status}">${asset.label}</span></td><td class="last-seen">${asset.seen}</td></tr>`).join("");
}

function renderChart(values = traffic) {
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 720},${190 - value * 1.45}`).join(" ");
  document.querySelector("#chart-line").setAttribute("d", `M ${points.replaceAll(" ", " L ")}`);
  document.querySelector("#chart-fill").setAttribute("d", `M ${points.replaceAll(" ", " L ")} L 720,190 L 0,190 Z`);
}

document.querySelector("#current-date").textContent = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date()).toUpperCase();
renderAlerts();
renderAssets();
renderChart();

document.querySelector("#dismiss-notice").addEventListener("click", (event) => event.currentTarget.closest(".notice").remove());
document.querySelector("#refresh-button").addEventListener("click", (event) => {
  event.currentTarget.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: 550 });
  const score = 64 + Math.floor(Math.random() * 9);
  document.querySelector("#risk-score").textContent = score;
  document.querySelector("#risk-meter").style.width = `${score}%`;
  document.querySelector("#event-count").textContent = `${(1250 + Math.floor(Math.random() * 80)).toLocaleString("fr-FR")}`;
});
document.querySelector("#filter-assets").addEventListener("click", (event) => {
  const onlineOnly = event.currentTarget.dataset.filter === "online";
  event.currentTarget.dataset.filter = onlineOnly ? "all" : "online";
  event.currentTarget.textContent = onlineOnly ? "Tous les actifs ▾" : "En ligne uniquement ▾";
  renderAssets(onlineOnly ? "all" : "online");
});
document.querySelector("#chart-range").addEventListener("change", (event) => {
  renderChart(event.target.value === "7" ? traffic.map((value, i) => Math.min(105, value + (i % 4) * 7)) : traffic);
});
document.querySelector("#view-all").addEventListener("click", (event) => {
  event.currentTarget.textContent = "Toutes les alertes sont affichées";
});
