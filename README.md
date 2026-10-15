# Sentinel Lab

**Sentinel Lab** est une application SOC full-stack pédagogique sur le thème **cybersécurité, réseau et développement**. Elle propose une supervision interactive avec incidents, threat intelligence, inventaire, timeline opérationnelle, API REST, base SQLite et flux temps réel.

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

## Pistes d'amélioration

- Remplacer le générateur par des événements provenant d'une source autorisée et authentifiée.
- Ajouter une authentification et une autorisation côté API avant tout déploiement.
- Ajouter des tests et une journalisation côté serveur.
- Connecter un outil de supervision autorisé, sans contourner les contrôles d'accès.

## Sécurité et limites

Le projet est volontairement un laboratoire local : les adresses `192.0.2.0/24` sont réservées à la documentation et aucun paquet réseau n'est capturé. En production, ajouter HTTPS, une validation stricte des payloads, une limitation de débit et une politique de conservation des données.
