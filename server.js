import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 3000);
const db = new Database(join(root, "sentinel.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(await readFile(join(root, "schema.sql"), "utf8"));
const clients = new Set();
const now = () => new Date().toISOString();

const seedAssets = [
  ["srv-web-01", "192.0.2.10", "server", "online", 32],
  ["db-primary", "192.0.2.20", "database", "online", 18],
  ["poste-042", "192.0.2.42", "workstation", "warning", 57],
  ["api-gateway", "192.0.2.5", "gateway", "online", 41]
];
const seedAlerts = [
  ["INC-1042", "high", "Tentatives de connexion inhabituelles", "Pare-feu · 192.0.2.44", "18 tentatives SSH sur srv-web-01 en moins de 90 secondes.", 4],
  ["INC-1041", "medium", "Port sensible détecté ouvert", "srv-web-01 · TCP/22", "Le port SSH est accessible depuis un segment non administrateur.", 18],
  ["INC-1040", "medium", "Trafic sortant inhabituel", "poste-042 · DNS", "Hausse de requêtes vers un domaine classé à surveiller.", 31],
  ["INC-1039", "high", "Certificat bientôt expiré", "api-gateway · J-12", "Le certificat TLS expire dans 12 jours.", 46]
];

if (db.prepare("SELECT COUNT(*) AS count FROM assets").get().count === 0) {
  const insertAsset = db.prepare("INSERT INTO assets (name, ip, type, status, last_seen, risk_score) VALUES (?, ?, ?, ?, ?, ?)");
  const seed = db.transaction(() => seedAssets.forEach(([name, ip, type, status, risk]) => insertAsset.run(name, ip, type, status, now(), risk)));
  seed();
}
if (db.prepare("SELECT COUNT(*) AS count FROM alerts").get().count === 0) {
  const insertAlert = db.prepare("INSERT INTO alerts (id, level, title, source, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)");
  const insertEvent = db.prepare("INSERT INTO events (kind, message, source, severity, created_at, alert_id) VALUES ('alert', ?, ?, ?, ?, ?)");
  const seed = db.transaction(() => seedAlerts.forEach(([id, level, title, source, detail, minutes]) => {
    const created = new Date(Date.now() - minutes * 60000).toISOString();
    insertAlert.run(id, level, title, source, detail, created);
    insertEvent.run(title, source, level, created, id);
  }));
  seed();
}
if (db.prepare("SELECT COUNT(*) AS count FROM traffic").get().count === 0) {
  const insertTraffic = db.prepare("INSERT INTO traffic (incoming, outgoing, recorded_at) VALUES (?, ?, ?)");
  for (let index = 23; index >= 0; index -= 1) insertTraffic.run(35 + Math.round(Math.random() * 65), 22 + Math.round(Math.random() * 54), new Date(Date.now() - index * 3600000).toISOString());
}

function summary() {
  const alerts = db.prepare("SELECT COUNT(*) AS count FROM alerts WHERE status = 'open'").get().count;
  const events = db.prepare("SELECT COUNT(*) AS count FROM events WHERE created_at >= datetime('now', '-24 hours')").get().count;
  const assets = db.prepare("SELECT COUNT(*) AS count FROM assets").get().count;
  const online = db.prepare("SELECT COUNT(*) AS count FROM assets WHERE status = 'online'").get().count;
  const risk = Math.min(99, Math.round(db.prepare("SELECT COALESCE(AVG(risk_score), 0) AS score FROM assets").get().score + alerts * 3));
  return { risk, alerts, events: Math.max(1284, events), protected: Math.round((online / assets) * 100), uptime: 99.98, generatedAt: now() };
}
function dashboard() {
  return {
    summary: summary(),
    alerts: db.prepare("SELECT id, level, title, source, detail, status, created_at AS createdAt FROM alerts ORDER BY created_at DESC LIMIT 25").all(),
    assets: db.prepare("SELECT id, name, ip, type, status, last_seen AS lastSeen, risk_score AS riskScore FROM assets ORDER BY name").all(),
    traffic: db.prepare("SELECT incoming, outgoing, recorded_at AS recordedAt FROM traffic ORDER BY recorded_at DESC LIMIT 24").all().reverse(),
    events: db.prepare("SELECT id, kind, message, source, severity, created_at AS createdAt FROM events ORDER BY created_at DESC LIMIT 12").all()
  };
}
function broadcast(type, payload) {
  const data = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  clients.forEach((client) => client.write(data));
}
function insertSimulation() {
  const id = `INC-${1043 + db.prepare("SELECT COUNT(*) AS count FROM alerts").get().count}`;
  const source = `Simulation · 192.0.2.${60 + Math.floor(Math.random() * 30)}`;
  const alert = { id, level: Math.random() > 0.75 ? "critical" : "high", title: "Anomalie comportementale détectée", source, detail: "Un profil de trafic inhabituel vient d'être corrélé par le moteur de démonstration.", status: "open", createdAt: now() };
  const insert = db.transaction(() => {
    db.prepare("INSERT INTO alerts (id, level, title, source, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(alert.id, alert.level, alert.title, alert.source, alert.detail, alert.createdAt);
    db.prepare("INSERT INTO events (kind, message, source, severity, created_at, alert_id) VALUES ('alert', ?, ?, ?, ?, ?)").run(alert.title, alert.source, alert.level, alert.createdAt, alert.id);
    db.prepare("INSERT INTO traffic (incoming, outgoing, recorded_at) VALUES (?, ?, ?)").run(55 + Math.floor(Math.random() * 50), 25 + Math.floor(Math.random() * 55), alert.createdAt);
  });
  insert();
  broadcast("alert", alert);
  broadcast("dashboard", dashboard());
  return alert;
}
function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(payload));
}
async function body(request) {
  let raw = ""; for await (const chunk of request) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
async function serveStatic(request, response) {
  const requested = request.url === "/" ? "/index.html" : request.url.split("?")[0];
  const file = normalize(join(root, requested));
  if (!file.startsWith(root)) return json(response, 403, { error: "Accès refusé" });
  try { const content = await readFile(file); response.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" }); response.end(content); }
  catch { json(response, 404, { error: "Ressource introuvable" }); }
}
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === "/api/stream") {
      response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
      response.write(`event: dashboard\ndata: ${JSON.stringify(dashboard())}\n\n`); clients.add(response);
      request.on("close", () => clients.delete(response)); return;
    }
    if (url.pathname === "/api/dashboard" && request.method === "GET") return json(response, 200, dashboard());
    if (url.pathname === "/api/alerts" && request.method === "GET") return json(response, 200, db.prepare("SELECT * FROM alerts ORDER BY created_at DESC LIMIT 100").all());
    if (url.pathname === "/api/simulate" && request.method === "POST") return json(response, 201, insertSimulation());
    if (url.pathname === "/api/alerts/ack" && request.method === "POST") {
      const payload = await body(request);
      if (typeof payload.id !== "string" || !payload.id.trim()) return json(response, 400, { error: "Identifiant d'incident invalide" });
      const result = db.prepare("UPDATE alerts SET status = 'acknowledged', acknowledged_at = @acknowledgedAt WHERE id = @id").run({ acknowledgedAt: now(), id: payload.id });
      if (!result.changes) return json(response, 404, { error: "Incident introuvable" });
      broadcast("dashboard", dashboard()); return json(response, 200, { ok: true });
    }
    return serveStatic(request, response);
  } catch (error) { console.error(error); return json(response, 500, { error: "Erreur interne du serveur" }); }
});
setInterval(() => { if (Math.random() > 0.45) insertSimulation(); else broadcast("heartbeat", { generatedAt: now(), summary: summary() }); }, 7000);
server.listen(port, () => console.log(`Sentinel Lab disponible sur http://localhost:${port}`));
