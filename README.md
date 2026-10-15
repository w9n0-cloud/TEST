# Sentinel Lab

**Sentinel Lab** est un mini tableau de bord web pédagogique sur le thème **cybersécurité, réseau et développement**. Il présente un risque global, des alertes, des actifs réseau, une courbe d'activité et un playbook de réponse à incident.

> Les données sont fictives et l'application n'exécute aucun scan réseau réel. Les adresses de documentation `192.0.2.0/24` sont réservées aux exemples.

## Lancer le projet

Le projet ne demande aucune installation :

1. Télécharger ou cloner le dépôt.
2. Ouvrir `index.html` dans un navigateur.

Pour un aperçu local avec VS Code, l'extension **Live Server** peut être utilisée, mais elle n'est pas obligatoire.

## Technologies

- HTML sémantique et accessible
- CSS responsive, sans framework
- JavaScript vanilla pour les données et les interactions
- SVG pour le graphique réseau

## Fonctionnalités

- Score de risque et indicateurs SOC
- Liste d'alertes récentes avec niveaux de sévérité
- Filtre des actifs réseau
- Graphique d'activité sur 24 h ou 7 jours
- Bouton de rafraîchissement simulé
- Playbook en quatre étapes : identifier, isoler, analyser, rétablir

## Pistes d'amélioration

- Remplacer les données simulées par une API backend authentifiée.
- Ajouter une base de données pour historiser les événements.
- Ajouter des tests et une journalisation côté serveur.
- Connecter un outil de supervision autorisé, sans contourner les contrôles d'accès.
