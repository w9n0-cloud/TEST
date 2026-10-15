import http from "node:http";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 3000);
const simulationEnabled = process.env.SENTINEL_SIMULATION !== "false";
const db = new Database(join(root, "sentinel.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(await readFile(join(root, "schema.sql"), "utf8"));
const clients = new Set();
const now = () => new Date().toISOString();
const cookieName = "sentinel_session";
const sessions = new Map();
const hashPassword = (password, salt = crypto.randomBytes(16).toString("hex")) => `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
const verifyPassword = (password, stored) => { const [salt, hash] = stored.split(":"); return crypto.timingSafeEqual(Buffer.from(hash, "hex"), crypto.scryptSync(password, salt, 64)); };
const parseCookies = (header = "") => Object.fromEntries(header.split(";").map((part) => part.trim().split("=")).filter(([key, value]) => key && value));
function userFor(request) {
  const token = parseCookies(request.headers.cookie)[cookieName]; const session = token && sessions.get(token);
  if (!session || new Date(session.expiresAt) < new Date()) return null;
  return db.prepare("SELECT id, email, role, name, active FROM users WHERE id = ? AND active = 1").get(session.userId) || null;
}
function audit(user, action, request, metadata = {}) {
  db.prepare("INSERT INTO audit_log (user_id, action, ip, created_at, metadata) VALUES (?, ?, ?, ?, ?)").run(user?.id || null, action, request.socket.remoteAddress || "local", now(), JSON.stringify(metadata));
}
function unauthorized(response) { return json(response, 401, { error: "Authentification requise" }); }
function forbidden(response) { return json(response, 403, { error: "Droits administrateur requis" }); }

const seedAssets = [
  ["srv-web-01", "192.0.2.10", "server", "online", 32],
  ["db-primary", "192.0.2.20", "database", "online", 18],
  ["poste-042", "192.0.2.42", "workstation", "warning", 57],
  ["api-gateway", "192.0.2.5", "gateway", "online", 41]
];
if (db.prepare("SELECT COUNT(*) AS count FROM users").get().count === 0) {
  const adminPassword = process.env.SENTINEL_ADMIN_PASSWORD || "ChangeMe!123";
  db.prepare("INSERT INTO users (email, password_hash, role, name, created_at) VALUES (?, ?, 'admin', ?, ?)")
    .run("admin@sentinel.local", hashPassword(adminPassword), "Administrateur", now());
  console.log(`Compte admin initial : admin@sentinel.local / ${adminPassword}`);
}
if (db.prepare("SELECT COUNT(*) AS count FROM log_sources").get().count === 0) {
  db.prepare("INSERT INTO log_sources (name, source_type, path, created_at) VALUES (?, ?, ?, ?)")
    .run("API logs locale", "http-json", "POST /api/ingest/log", now());
}
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
function ingestLog(payload) {
  const createdAt = now(); const status = Number(payload.statusCode || payload.status || 0);
  const path = String(payload.path || payload.url || "/"); const source = String(payload.source || "local-web-app");
  db.prepare("INSERT INTO ingested_logs (source, method, path, status_code, client_ip, raw, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(source, String(payload.method || "GET"), path, status || null, String(payload.ip || payload.clientIp || "127.0.0.1"), JSON.stringify(payload), createdAt);
  let alert = null;
  if (status >= 500 || path.includes("..") || /(\.env|wp-admin|\/etc\/passwd|admin-login)/i.test(path)) {
    const id = `LOG-${Date.now()}`;
    const level = status >= 500 ? "high" : "critical";
    const title = status >= 500 ? "Erreur serveur répétée" : "Chemin sensible détecté dans les logs";
    const detail = `${payload.method || "GET"} ${path} · HTTP ${status || "?"} · IP ${payload.ip || "127.0.0.1"}`;
    db.prepare("INSERT INTO alerts (id, level, title, source, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, level, title, source, detail, createdAt);
    db.prepare("INSERT INTO events (kind, message, source, severity, created_at, alert_id) VALUES ('log-detection', ?, ?, ?, ?, ?)")
      .run(title, source, level, createdAt, id);
    alert = { id, level, title, source, detail, status: "open", createdAt };
  }
  broadcast("dashboard", dashboard()); if (alert) broadcast("alert", alert); return { accepted: true, alert };
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
    events: db.prepare("SELECT id, kind, message, source, severity, created_at AS createdAt FROM events ORDER BY created_at DESC LIMIT 12").all(),
    ingest: db.prepare("SELECT COUNT(*) AS total, MAX(created_at) AS lastSeen FROM ingested_logs").get()
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
    if (url.pathname === "/api/auth/me" && request.method === "GET") return json(response, 200, { user: userFor(request) });
    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      const payload = await body(request); const user = db.prepare("SELECT * FROM users WHERE email = ? AND active = 1").get(payload.email);
      if (!user || typeof payload.password !== "string" || !verifyPassword(payload.password, user.password_hash)) return json(response, 401, { error: "Identifiants invalides" });
      const token = crypto.randomBytes(32).toString("hex"); const expiresAt = new Date(Date.now() + 8 * 3600000).toISOString();
      sessions.set(token, { userId: user.id, expiresAt }); db.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(now(), user.id); audit(user, "login", request);
      response.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800` }); return response.end(JSON.stringify({ user: { id: user.id, email: user.email, role: user.role, name: user.name } }));
    }
    if (url.pathname === "/api/auth/logout" && request.method === "POST") { const token = parseCookies(request.headers.cookie)[cookieName]; sessions.delete(token); response.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` }); return response.end(JSON.stringify({ ok: true })); }
    const user = userFor(request);
    if (!user && url.pathname.startsWith("/api/")) return unauthorized(response);
    if (url.pathname === "/api/admin/users" && request.method === "GET") { if (user.role !== "admin") return forbidden(response); return json(response, 200, db.prepare("SELECT id, email, name, role, active, created_at AS createdAt, last_login AS lastLogin FROM users ORDER BY id").all()); }
    if (url.pathname === "/api/admin/audit" && request.method === "GET") { if (user.role !== "admin") return forbidden(response); return json(response, 200, db.prepare("SELECT audit_log.*, users.email FROM audit_log LEFT JOIN users ON users.id = audit_log.user_id ORDER BY audit_log.created_at DESC LIMIT 100").all()); }
    if (url.pathname === "/api/admin/users" && request.method === "POST") {
      if (user.role !== "admin") return forbidden(response); const payload = await body(request);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email || "") || typeof payload.password !== "string" || payload.password.length < 10) return json(response, 400, { error: "Email invalide ou mot de passe trop court (10 caractères minimum)" });
      try { const result = db.prepare("INSERT INTO users (email, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?)").run(payload.email, hashPassword(payload.password), ["admin", "analyst", "viewer"].includes(payload.role) ? payload.role : "viewer", payload.name || payload.email, now()); audit(user, "create_user", request, { userId: result.lastInsertRowid }); return json(response, 201, { ok: true }); } catch { return json(response, 409, { error: "Cet email existe déjà" }); }
    }
    if (url.pathname === "/api/ingest/log" && request.method === "POST") { if (!user || !["admin", "analyst"].includes(user.role)) return forbidden(response); const result = ingestLog(await body(request)); audit(user, "ingest_log", request); return json(response, 202, result); }
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
if (simulationEnabled) setInterval(() => { if (Math.random() > 0.45) insertSimulation(); else broadcast("heartbeat", { generatedAt: now(), summary: summary() }); }, 7000);
server.listen(port, () => console.log(`Sentinel Lab disponible sur http://localhost:${port}`));
