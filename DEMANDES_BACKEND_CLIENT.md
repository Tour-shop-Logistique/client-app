# Demandes d'évolution backend — Application Client

Ce document liste ce qu'il manque côté backend pour finir de câbler l'application client, après intégration de `REPONSE_AUDIT_CAHIER_DES_CHARGES_CLIENT (1).md`, `NOTIFICATIONS_A_INTEGRER.md`, `WEBSOCKETS.md`, `MARKETPLACE_ET_ABONNEMENT_API.md` et `PARCOURS_LIVREUR_API (1).md`.

- **Date** : 4 octobre 2026
- **Émetteur** : équipe application client
- **Conventions reprises de l'existant** : token Sanctum, enveloppe `{ "success": bool, ... }`, identifiants UUID, erreurs de validation Laravel en 422, événement WebSocket unique `model.updated` filtré sur `model` / `action`

Les routes et noms de champs proposés sont des **propositions** : vous restez libres de les adapter, tant que le besoin et les critères d'acceptation sont respectés. Merci de documenter le contrat final, comme pour `REPONSE_AUDIT_CAHIER_DES_CHARGES_CLIENT.md`.

---

## Sommaire

| # | Demande | Exigence du cahier | Priorité |
|---|---|---|---|
| [C1](#c1--coordonnées-gps-et-instructions-en-entrée-de-store) | Coordonnées GPS et instructions en entrée de `store` | §4.5 géolocalisation, §5 (livreur) navigation et instructions | **P1** |
| [C2](#c2--suivi-dexpédition-en-temps-réel-côté-client) | Suivi d'expédition en temps réel côté client | §4.2 / §4.3 « notifications à chaque étape », 8.1 étapes 4 et 6 | **P1** |
| [C3](#c3--contrat-de-demander-enlevement-et-demander-livraison) | Contrat de `demander-enlevement` et `demander-livraison` | §4.2 enlèvement, 8.1 étape 7, 8.2 étape 8 | **P1** |
| [C4](#c4--champ-mode-et-livreur-dans-les-missions-format-des-offres) | Champ `mode` et livreur dans les missions, format des offres | §4.2 « offres de prix des livreurs », 8.3 étape 3 | **P1** |
| [C5](#c5--historique-des-notifications-du-client) | Historique des notifications du client | §4.5 notifications, §7.8 | P2 |
| [C6](#c6--distance-denlèvement) | Distance d'enlèvement | §4.2 enlèvement à domicile | P2 |
| [C7](#c7--champs-non-documentés-facture-motif-de-refus) | Champs non documentés : facture, motif de refus | §4.2 factures, notification `demande_refusee` | P2 |
| [C8](#c8--incohérences-de-documentation) | Incohérences de documentation | — | P3 |
| [Q1–Q5](#questions-ouvertes) | Questions ouvertes | voir chaque question | À clarifier |

**Priorités**
- **P1** : exigence du cahier, aujourd'hui partielle ou reposant sur une supposition côté app.
- **P2** : exigence du cahier à faible risque, ou fiabilité de l'affichage.
- **P3** : documentation.

---

## C1 — Coordonnées GPS et instructions en entrée de `store`

**Priorité** : P1

### Constat

`PARCOURS_LIVREUR_API (1).md` §4.2 indique que l'expédition renvoyée au livreur contient `expediteur_latitude` / `expediteur_longitude`, `destinataire_latitude` / `destinataire_longitude`, `instructions_enlevement` et `instructions_livraison`, « renseignés si le client les a fournis à la création ». Mais aucune doc client ne définit ces champs en **entrée** de `POST /api/expedition/client/store`.

### Ce que fait l'app aujourd'hui

Quand le client demande un enlèvement à domicile, l'app envoie, en plus des champs `enlevement_*` :

```json
{
  "expediteur_latitude": 5.3599,
  "expediteur_longitude": -3.9870,
  "instructions_enlevement": "Sonner au portail bleu"
}
```

Ces noms sont **supposés** (identiques aux champs de sortie). Les champs côté destinataire ne sont pas encore envoyés.

### Demande

1. Confirmer ou corriger les noms des 6 champs en entrée de `store`, pour les modes `interville`, `livraison_domicile` et `recuperation_agence`.
2. Préciser les contraintes (latitude -90 à 90, longitude -180 à 180, instructions max 500 ?).

### Critères d'acceptation

- [ ] Les 6 champs sont documentés en entrée de `store`, tous optionnels.
- [ ] Une valeur envoyée par l'app client apparaît dans la mission du livreur (`GET /expedition/livreur/missions`).

---

## C2 — Suivi d'expédition en temps réel côté client

**Priorité** : P1

### Constat

- `WEBSOCKETS.md` n'émet les événements `Expedition` (`created`, `status_changed`, `payment_confirmed`) que sur `agence.{id}` et `backoffice.{id}`. **Rien n'est émis sur `client.{userId}`.**
- Les 5 étapes de mission (`enlevement_demarre`, `colis_recupere`, `colis_depose_agence_livreur`, `livraison_demarree`, `colis_livre`) partent uniquement par SMS, email et push (`NOTIFICATIONS_A_INTEGRER.md`, famille 1).

Conséquence : l'écran de suivi d'une expédition ne se met à jour qu'au rechargement, alors que l'app sait déjà afficher la frise des jalons et écouter `client.{userId}`.

### Proposition

Émettre sur `client.{clientId}` (le client propriétaire de l'expédition) :

| `model` | `action` | Quand | `data` attendu |
|---|---|---|---|
| `Expedition` | `status_changed` | `statut_expedition` change | `{ id, reference, statut_expedition, date_* }` (les jalons déjà renvoyés par `show`) |
| `Expedition` | `refusee` | Une agence refuse la demande | `{ id, reference, motif }` |
| `Mission` | `assignee` | Un livreur est assigné à une mission de l'expédition (groupage accepté ou offre express acceptée) | `{ id, expedition_id, type, statut }` |
| `Mission` | `etape` (ou une action par étape) | Chacune des 5 étapes de la famille 1 | `{ id, expedition_id, type, etape }` |

Avec `RealtimeBroadcaster::send()`, cela revient à ajouter un paramètre « clients » aux appels existants.

### Critères d'acceptation

- [ ] Un changement de statut d'expédition produit un événement sur `client.{clientId}` du propriétaire.
- [ ] Chaque étape de mission du dernier kilomètre produit un événement sur ce même canal.
- [ ] Les ids présents dans `ids` / `data[].expedition_id` permettent de rattacher l'événement à l'expédition ouverte à l'écran.

---

## C3 — Contrat de `demander-enlevement` et `demander-livraison`

**Priorité** : P1

### Constat

`REPONSE_AUDIT_CAHIER_DES_CHARGES_CLIENT (1).md` cite deux routes existantes, sans leur corps ni leur réponse :

- `POST /api/expedition/client/{id}/demander-enlevement` — « mode groupage / express, distance, type de véhicule ».
- `POST /api/expedition/client/{id}/demander-livraison` — le client expéditeur déclenche la livraison à domicile après coup.

L'app ne les appelle pas pour ne pas deviner les noms de champs (défaut déjà relevé par l'audit sur d'anciens écrans). Ces deux routes sont pourtant les seules à couvrir :

- l'enlèvement pour le mode `recuperation_agence` (non pris en charge par `store`) ;
- le choix « livraison à domicile » à l'arrivée (8.1 étape 7, 8.2 étape 8).

### Demande

Pour chacune des deux routes, documenter :

| Élément | Détail attendu |
|---|---|
| Corps | Noms exacts des champs, obligatoires ou non, valeurs possibles (ex. `mode`, `distance_km`, `type_vehicule`, adresse de livraison ?) |
| Statuts d'expédition autorisés | Ex. `en_attente` / `accepted` pour l'enlèvement, `recu_agence_destination` pour la livraison |
| Réponse 200 | Expédition mise à jour, mission créée (id, statut, mode) |
| Erreurs | 422 si déjà demandé, statut incompatible, etc., avec les messages |

### Critères d'acceptation

- [ ] Le contrat des deux routes est documenté.
- [ ] La mission créée apparaît ensuite dans `GET /api/expedition/client/{id}/missions`.

---

## C4 — Champ `mode` et livreur dans les missions, format des offres

**Priorité** : P1

### Constat

`GET /api/expedition/client/{id}/missions` renvoie `id`, `type`, `statut`, `preuve`. Il manque :

1. **`mode`** (`express` / `groupage`). En groupage, il n'y a pas d'offres de prix ; en express, le client doit choisir une offre. Sans ce champ, l'app traite toute mission `en_attente` comme express et peut afficher « en attente d'offres » à tort.
2. **Le livreur assigné** (nom, téléphone, véhicule) pour une mission `assignee` : le client ne sait pas qui va venir.
3. Le format d'une **offre** dans `GET /api/expedition/client/missions/{missionId}/offres` n'est pas documenté (nom du livreur, véhicule, montant, statut).

### Proposition

```json
{
  "id": "uuid-mission",
  "type": "livraison",
  "mode": "express",
  "statut": "assignee",
  "expire_le": null,
  "livreur": { "nom": "Yao", "prenoms": "Paul", "telephone": "0705060708", "type_vehicule": "moto" },
  "preuve": null
}
```

Offre :

```json
{ "id": "uuid", "montant_propose": 1500, "statut": "active", "livreur": { "nom": "Yao", "prenoms": "Paul", "type_vehicule": "moto" } }
```

Le téléphone du livreur n'est exposé qu'une fois la mission `assignee`.

### Critères d'acceptation

- [ ] `mode` est présent sur chaque mission.
- [ ] `livreur` est présent pour une mission `assignee` ou `terminee`, `null` sinon.
- [ ] Le format d'une offre est documenté.

---

## C5 — Historique des notifications du client

**Priorité** : P2

### Constat

`NOTIFICATIONS_A_INTEGRER.md` liste des notifications « push + historique » pour le client (`colis_livre`, `demande_refusee`, parrainage, abonnement, annonce masquée), mais seules les routes livreur existent (`/livreur/notifications`). Côté client, une notification reçue app fermée ou sans abonnement push est perdue.

### Proposition

Mêmes routes et même format que pour le livreur (`PARCOURS_LIVREUR_API (1).md` §7.3), pour le type `CLIENT` :

| Méthode | Route | Effet |
|---|---|---|
| GET | `/client/notifications?page=1` | Liste paginée, 20 par page |
| POST | `/client/notifications/{id}/lue` | Marque une notification lue |
| POST | `/client/notifications/tout-lire` | Marque tout lu |

`data.cible` doit permettre d'ouvrir le bon écran : `{ "type": "expedition" | "commande_marketplace" | "annonce" | "echeance", "id": "uuid" }`.

### Critères d'acceptation

- [ ] Chaque notification push client est aussi enregistrée et consultable.
- [ ] L'état lu ou non lu est partagé entre les appareils du client.

---

## C6 — Distance d'enlèvement

**Priorité** : P2

### Constat

`enlevement_distance_km` (champ de `store`) doit être une distance **routière** calculée par l'app. L'app n'a pas de service d'itinéraire : elle **n'envoie pas** ce champ, et le backoffice doit alors saisir le montant à l'assignation.

### Demande

Choisir une des options :

1. Le backend calcule la distance à partir de l'agence de départ et de `expediteur_latitude` / `expediteur_longitude` (voir C1) ;
2. ou il accepte une distance à vol d'oiseau, en appliquant lui-même un coefficient ;
3. ou il confirme que l'absence de distance est le fonctionnement normal.

---

## C7 — Champs non documentés : facture, motif de refus

**Priorité** : P2

L'app lit ces champs « au mieux », en essayant plusieurs noms possibles. Merci de documenter les noms exacts :

| Route | Champs à documenter |
|---|---|
| `GET /api/expedition/client/factures` | numéro de facture, montant (HT/TTC), date d'émission, devise, `expedition.id` |
| `GET /api/expedition/client/show/{id}` | motif et date du refus quand `statut_expedition = refused` (notification `demande_refusee`) |

---

## C8 — Incohérences de documentation

**Priorité** : P3

| Document | Constat |
|---|---|
| `MARKETPLACE_ET_ABONNEMENT_API.md` §10.2 | Indique « livraison assignee immédiatement, code généré » pour l'affectation directe, alors que §6 et §7.4 décrivent le statut `proposee` (15 min) et le code généré à l'acceptation. L'app suit §6 / §7.4. |
| `MARKETPLACE_ET_ABONNEMENT_API.md` §10.1 | L'exemple `panier/valider` n'a pas `adresse_livraison`, désormais obligatoire. |
| `MARKETPLACE_ET_ABONNEMENT_API.md` §1 | La section 1.6 est placée avant la 1.5. |
| `REPONSE_AUDIT_CAHIER_DES_CHARGES_CLIENT.md` et `… (1).md` | Deux versions dans le dépôt ; la `(1)` ajoute le §6 (enlèvement dans `store`). Merci de n'en garder qu'une. Idem pour `PARCOURS_LIVREUR_API.md` et `PARCOURS_LIVREUR_API (1).md`. |
| `REPONSE_AUDIT…` §1 | La liste des statuts `ExpeditionStatus` n'inclut pas `en_cours_depot`, `refused` ni `cancelled`, utilisés ailleurs. Merci de donner la liste complète. |

---

## Questions ouvertes

**Q1 — Enlèvement et photo en mode `recuperation_agence`.** Ce mode peut créer plusieurs expéditions par requête. Faut-il une mission d'enlèvement pour l'ensemble ou une par expédition ? Une photo par article ? En attendant, l'app ne propose ni l'un ni l'autre dans ce mode.

**Q2 — Choix « retrait ou domicile » par un destinataire sans compte** (cahier 8.1 étape 7). Faut-il un lien avec token envoyé par SMS au destinataire, ouvrant une page publique de l'app client ? Si oui, merci de proposer le contrat (génération du token, durée de validité, route publique).

**Q3 — Paiement mobile money intégré** (#13, #24, #29, #34, #38). Chantier commun avec la demande B9 de l'app livreur : quel agrégateur et quel calendrier ? L'app client a besoin des mêmes routes pour les expéditions, les commandes marketplace et l'abonnement vendeur.

**Q4 — Vérification par SMS à l'inscription** (#2, 8.1 étape 2). Le service `BrevoSmsGateway` existe déjà : peut-on prévoir un code OTP par SMS à l'inscription, à la place ou en plus de l'email ? Contrat attendu : envoi du code, vérification, renvoi.

**Q5 — Bascule Interville d'une livraison marketplace** (#33). Décision produit en attente, voir Q1 de `livreur-app/DEMANDES_BACKEND_LIVREUR.md`.

---

## Récapitulatif de ce que l'app client fait en attendant

| Demande | Comportement actuel de l'app |
|---|---|
| C1 | Envoie `expediteur_latitude` / `longitude` et `instructions_enlevement` avec les noms supposés, seulement en cas d'enlèvement |
| C2 | Suivi mis à jour au rechargement de l'écran |
| C3 | Routes non appelées |
| C4 | Mission sans `mode` traitée comme express ; nom du livreur lu de façon défensive |
| C5 | Push et toast in-app seulement, pas d'historique |
| C6 | `enlevement_distance_km` non envoyé |
| C7 | Lecture défensive de plusieurs noms de champs |
