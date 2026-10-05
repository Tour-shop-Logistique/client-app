# Notifications à intégrer côté app client & app livreur

Le backend vient d'ajouter de nouveaux événements temps réel (WebSocket), des notifications push persistées, et des SMS/emails sur des actions qui ne notifiaient personne jusqu'ici. Ce document liste tout ce qui est nouveau, avec le contrat exact (canal, action, payload) pour que l'app client et l'app livreur puissent les afficher.

---

## Rappel du système (rien de nouveau dans la mécanique)

### 1. WebSocket (Laravel Reverb)

Un seul event Pusher/Echo, `.model.updated`, sur des canaux privés `client.{userId}`, `livreur.{userId}`, `backoffice.{id}`, `agence.{id}`. Le payload porte toujours `model` et `action` — filtrez sur ces deux champs, jamais sur le nom du canal seul.

```js
echo.private(`client.${userId}`)
  .listen('.model.updated', (payload) => {
    if (payload.model === 'Mission' && payload.action === 'proposee') {
      // ...
    }
  });
```

Contrat complet : `WEBSOCKETS.md` à la racine du repo backend.

### 2. Push + historique persisté

Notification WebPush (navigateur/mobile) **et** une ligne dans l'historique serveur consultable même après coup. Routes livreur disponibles :

| Route | Effet |
|---|---|
| `GET /livreur/notifications` | Liste paginée, 20/page |
| `POST /livreur/notifications/{id}/lue` | Marque une notification lue |
| `POST /livreur/notifications/tout-lire` | Marque tout lu |

Équivalent côté client à vérifier avec le backend si le même mécanisme existe sur `/profile/*` — sinon demander l'ouverture des routes.

### 3. SMS + email

Géré entièrement côté backend (pas d'intégration frontend requise) — listé ici seulement pour information, au cas où un utilisateur signale un SMS reçu sans notification in-app correspondante.

---

## Famille 1 — Suivi d'une mission, étape par étape (app client)

Le plus gros changement. Avant, rien n'était envoyé entre l'assignation d'un livreur et la fin de la mission. Désormais, chaque étape notifie (SMS + email).

| Event | Canal | Déclencheur |
|---|---|---|
| `enlevement_demarre` | SMS + email | Le livreur a démarré le trajet vers l'expéditeur |
| `colis_recupere` | SMS + email | Le livreur a récupéré le colis chez l'expéditeur |
| `colis_depose_agence_livreur` | SMS + email | Colis arrivé à l'agence de départ (dépôt par le livreur, distinct de `colis_receptionne_depart` qui concerne le flux agence classique) |
| `livraison_demarree` | SMS + email | Le livreur est en route vers le destinataire final |
| `colis_livre` | **SMS + email + push** | **Le plus important des cinq.** Colis livré, mission terminée — à afficher en priorité |

⚠️ Ces 5 events n'ont pas de canal WebSocket dédié, uniquement SMS/email (+ push pour `colis_livre`). Si un signal temps réel in-app est nécessaire en plus, le demander au backend (non fait, volontairement limité pour ce chantier).

---

## Famille 2 — Abonnement marketplace (app client + app livreur)

| Notification | Canal | Détail |
|---|---|---|
| `AbonnementBloquePushNotification` | push + historique | Déclenchée au blocage pour retard de paiement. **Les tokens Sanctum sont révoqués juste après l'envoi** — gérer l'erreur 401 qui suivra et rediriger vers la reconnexion / l'écran de régularisation. |
| `PaiementAbonnementValidePushNotification` | push + historique | Le backoffice a validé le paiement déclaré, l'accès est débloqué au même moment |
| `PaiementAbonnementRejettePushNotification` | push + historique | Paiement rejeté, motif inclus si renseigné — afficher un CTA « re-déclarer un paiement » sur la même échéance |

---

## Famille 3 — Inscription livreur / KYC (app livreur)

| Notification | Canal | Détail |
|---|---|---|
| `InscriptionLivreurValideePushNotification` | push + historique | Documents validés, compte actif — rediriger vers la connexion |
| `InscriptionLivreurRejeteePushNotification` | push + historique | Documents rejetés, motif inclus si renseigné, compte reste inactif |

⚠️ **Portée limitée du push pour ces deux events** : le compte est inactif tant qu'il n'est pas validé, donc le livreur n'a jamais pu se connecter ni s'abonner au WebPush avant de recevoir cette notification. Le push peut n'atteindre personne la première fois. Le canal historique persisté (`GET /livreur/notifications`) reste la seule garantie réelle — à consulter dès la première connexion réussie, pas seulement en réaction à un push qui n'arrivera peut-être jamais.

---

## Famille 4 — Retraits et bonus financiers (app client + app livreur)

| Notification | App | Canal | Détail |
|---|---|---|---|
| `BonusParrainageCreditePushNotification` | client | push + historique | Un filleul a généré un bonus crédité au solde de parrainage du parrain, montant inclus |
| `RetraitParrainageEnregistrePushNotification` | client | push + historique | Le backoffice a enregistré un retrait déjà remis hors application (solde décrémenté) |
| `RetraitLivreurConfirmePushNotification` | livreur | push + historique | Le backoffice a confirmé le retrait demandé, fonds remis hors application |
| `RetraitLivreurRejettePushNotification` | livreur | push + historique | Retrait rejeté, solde inchangé |
| `RetraitLivreur` / `demande` | — | WebSocket `backoffice.{id}` | Hors scope app livreur/client, pour contexte : quand un livreur demande un retrait, le backoffice le voit en temps réel (pas de push, UI backoffice déjà ouverte en continu) |

---

## Famille 5 — Marketplace (app client, acheteur et vendeur)

| Event | Canal | Détail |
|---|---|---|
| `CommandeMarketplace` / `paiement_infirme` | WebSocket `client.{acheteurId}` | Le vendeur a infirmé avoir reçu le paiement déclaré — afficher « vous devez re-déclarer un paiement » côté acheteur |
| `AnnonceMarketplaceMasqueePushNotification` | push + historique | Le backoffice a masqué l'annonce pour modération (disparaît du catalogue), titre inclus — destinataire : le vendeur |

---

## Famille 6 — Expédition et colis (app client)

Deux incohérences corrigées — leurs actions inverses (acceptation, blocage) notifiaient déjà.

| Event | Canal | Détail |
|---|---|---|
| `demande_refusee` | SMS + email + push | Une agence a refusé la demande d'expédition, motif inclus — symétrique de `demande_acceptee`, déjà en place |
| `unblocked` | SMS + email | Un colis précédemment bloqué repasse en traitement normal — symétrique de `blocked`, déjà en place |

---

## Checklist d'intégration

- [ ] App client : afficher `colis_livre` en priorité (SMS/email déjà actifs, vérifier l'affichage du push si reçu)
- [ ] App client : câbler les 4 autres events du suivi mission (famille 1) si une timeline de statut existe déjà
- [ ] App client : écouter `CommandeMarketplace / paiement_infirme` sur le canal `client.{id}`
- [ ] App client : afficher les notifications de parrainage (famille 4) si un écran de solde parrainage existe
- [ ] App client : afficher `demande_refusee` et `unblocked` au même endroit que leurs équivalents déjà gérés
- [ ] App livreur : intégrer `GET /livreur/notifications` si pas encore fait — seule garantie de visibilité pour les notifications KYC (famille 3)
- [ ] App livreur : afficher les notifications de solde (famille 4 : confirmation/rejet de retrait)
- [ ] App livreur : afficher les notifications d'abonnement (famille 2) avec gestion du 401 après `AbonnementBloquePushNotification`
- [ ] Vendeur (app client) : afficher `AnnonceMarketplaceMasqueePushNotification` sur l'écran de gestion des annonces

---

Questions sur un payload exact → vérifier `WEBSOCKETS.md` et `docs/PARCOURS_LIVREUR_API.md` dans le repo backend, sinon demander.
