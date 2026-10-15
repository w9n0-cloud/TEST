# Sentinel Lab

**Sentinel Lab** est une application SOC full-stack pédagogique sur le thème **cybersécurité, réseau et développement**. Elle propose une supervision interactive avec incidents, threat intelligence, inventaire, timeline opérationnelle, comptes avec rôles, panneau admin, audit SQL, ingestion de logs locaux et flux temps réel.

> Les données sont fictives et l'application n'exécute aucun scan réseau réel. Les adresses de documentation `192.0.2.0/24` sont réservées aux exemples.

## Lancer le projet

Le projet possède un vrai backend local. Il faut Node.js 20 ou plus récent.

```bash
npm install
npm start
```

Puis ouvrir http://localhost:3000. Ne pas ouvrir `index.html` directement : l'interface utilise l'API et le flux SSE du serveur.

## Technologies

- HTML sémantique et accessible
- CSS responsive, sans framework
- JavaScript vanilla pour les données et les interactions
- SVG pour le graphique réseau
- Node.js HTTP server
- SQLite avec `better-sqlite3`
- API REST et Server-Sent Events (SSE)
- Schéma SQL relationnel avec index
- Sessions HTTP sécurisées par cookie `HttpOnly` et mots de passe dérivés avec `scrypt`

## Fonctionnalités

- Score de risque et indicateurs SOC
- Liste d'alertes récentes avec niveaux de sévérité
- Filtre des actifs réseau
- Graphique d'activité sur 24 h ou 7 jours
- Bouton de rafraîchissement simulé
- Playbook en quatre étapes : identifier, isoler, analyser, rétablir
- Recherche globale (raccourci `Ctrl K`) et filtres d'incidents
- Fiche incident détaillée avec prise en charge
- Simulation d'une nouvelle alerte avec persistance `localStorage`
- Export des incidents en JSON ou CSV
- Mode clair/sombre conservé entre les sessions
- Timeline d'opérations et signaux threat intelligence
- Base SQL persistante (`sentinel.db`, ignorée par Git)
- API `/api/dashboard`, `/api/alerts`, `/api/simulate`, `/api/alerts/ack`
- Flux temps réel `/api/stream`
- Générateur de télémétrie fictive toutes les 7 secondes
- Comptes `admin`, `analyst` et `viewer`
- Création d'utilisateurs et journal d'audit dans le panneau admin
- Ingestion de logs web/app locaux via `POST /api/ingest/log`
- Détections sur erreurs 5xx et chemins sensibles (`.env`, traversal, `/etc/passwd`, etc.)

## Premier compte administrateur

Au premier démarrage, le serveur crée :

```text
Email : admin@sentinel.local
Mot de passe : ChangeMe!123
```

Pour remplacer ce mot de passe avant le démarrage :

```powershell
$env:SENTINEL_ADMIN_PASSWORD = "un-mot-de-passe-long-et-unique"
npm start
```

Pour surveiller uniquement les alertes réellement ingérées par ton application, désactive le générateur de démonstration :

```powershell
$env:SENTINEL_SIMULATION = "false"
npm start
```

## Envoyer un vrai log de test

Après connexion dans l'interface, une application locale autorisée peut transmettre un événement structuré :

```powershell
Invoke-RestMethod -Method Post http://localhost:3000/api/ingest/log `
  -ContentType "application/json" `
  -Body '{"source":"mon-app","method":"GET","path":"/.env","statusCode":404,"ip":"127.0.0.1"}'
```

Une alerte apparaîtra en temps réel, sera conservée dans SQLite et sera visible dans l'audit. Pour une intégration réelle, le serveur web doit appeler cet endpoint avec la session d'un compte `analyst` ou `admin`, ou un collecteur local authentifié.

## Pistes d'amélioration

- Remplacer le générateur par des événements provenant d'une source autorisée et authentifiée.
- Ajouter HTTPS, une authentification forte (MFA) et une autorisation fine avant tout déploiement.
- Ajouter des tests et une journalisation côté serveur.
- Connecter un outil de supervision autorisé, sans contourner les contrôles d'accès.

## Sécurité et limites

Le projet est volontairement un laboratoire local : les adresses `192.0.2.0/24` sont réservées à la documentation et aucun paquet réseau n'est capturé. En production, ajouter HTTPS, une validation stricte des payloads, une limitation de débit et une politique de conservation des données.
