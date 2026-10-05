# Demande backend — Application Client complète

Ce document liste **tout ce qu'il faut ajouter ou modifier côté backend** pour que l'application client couvre entièrement le cahier des charges v2 (section 4 « Application Client » et étapes client des workflows de la section 8), sans contournement côté app.

Il complète `DEMANDES_BACKEND_CLIENT.md`. Cette première demande portait sur les points flous des dernières docs. Celle-ci couvre **tout le parcours client** et inclut les chantiers de fond (paiement, OTP, destinataire sans compte…). Les points déjà demandés y sont repris pour que ce document se suffise à lui-même.

- **Date** : 4 octobre 2026
- **Émetteur** : équipe application client
- **Base analysée** : code de `client-app` au 4 octobre 2026 et docs `api-*.md`, `MARKETPLACE_ET_ABONNEMENT_API.md`, `REPONSE_AUDIT_CAHIER_DES_CHARGES_CLIENT (1).md`, `NOTIFICATIONS_A_INTEGRER.md`, `WEBSOCKETS.md`, `PARCOURS_LIVREUR_API (1).md`
- **Conventions** : token Sanctum, enveloppe `{ "success": bool, ... }`, UUID, erreurs Laravel en 422, événement WebSocket unique `model.updated` filtré sur `model` / `action`, diffusion via `RealtimeBroadcaster::send()`

Les routes et champs proposés sont des **propositions** : adaptez-les librement tant que le besoin et les critères d'acceptation sont respectés. Merci de documenter le contrat final de chaque point livré.

---

## Sommaire

| Domaine | # | Demande | Priorité |
|---|---|---|---|
| **A. Compte** | A1 | Vérification par SMS (puis WhatsApp) à l'inscription et à la connexion | P1 |
| | A2 | Estimation Interville sans compte | **P0** |
| | A3 | Upload de la photo de profil | P3 |
| **B. Création d'expédition** | B1 | Coordonnées GPS et instructions en entrée de `store` | P1 |
| | B2 | Estimation du coût de l'enlèvement avant validation | P1 |
| | B3 | Enlèvement et photo en mode `recuperation_agence` | P2 |
| | B4 | Événement `Expedition/created` pour les créations client | P2 |
| **C. Suivi et dernier kilomètre** | C1 | Suivi en temps réel sur le canal client | **P0** |
| | C2 | Contrat de `demander-enlevement` et `demander-livraison` | P1 |
| | C3 | Missions : `mode`, livreur, délai ; format des offres ; annulation | P1 |
| | C4 | Espace destinataire sans compte (lien sécurisé) | P1 |
| | C5 | Notification du destinataire à chaque étape clé | P1 |
| | C6 | Agence d'arrivée et motif de refus exposés sur l'expédition | P2 |
| **D. Paiement et factures** | D1 | Passerelle mobile money (expédition, commande, abonnement) | **P0** |
| | D2 | Compte de réception de l'abonnement (paiement déclaratif) | **P0** |
| | D3 | Factures : format documenté et émission automatique | P2 |
| **E. Marketplace** | E1 | Recherche d'un livreur pour l'affectation directe | **P0** |
| | E2 | Annulation et expiration d'une commande non payée | P1 |
| | E3 | Événement « nouvelle commande » pour le vendeur | P1 |
| | E4 | Format des preuves de livraison marketplace | P1 |
| | E5 | Ajout et ordre des photos d'une annonce existante | P2 |
| | E6 | Catégories et filtres du catalogue | P2 |
| | E7 | Favoris et panier côté serveur | P3 |
| | E8 | Bascule Interville d'une livraison inter-villes | Décision produit |
| **F. Notifications** | F1 | Historique des notifications du client | P1 |
| | F2 | Annonces et nouveautés envoyées aux clients | P2 |
| | F3 | Liste officielle des push envoyés au client | P2 |
| **G. Référentiels** | G1 | Coordonnées, WhatsApp et horaires de toutes les agences | P2 |
| | G2 | Configuration publique de l'app (support, liens) | P3 |
| **H. Parrainage** | H1 | Demande de retrait du solde de parrainage | P2 |
| **I. Documentation** | I1 | Corrections et dédoublonnage des docs | P3 |

**Priorités**
- **P0** : une exigence explicite du cahier est impossible ou un parcours est cassé.
- **P1** : exigence du cahier aujourd'hui partielle.
- **P2** : exigence couverte de façon approximative, ou fiabilité.
- **P3** : confort.

---

# A. Compte

## A1 — Vérification par SMS (puis WhatsApp) à l'inscription et à la connexion

**Priorité** : P1 · **Cahier** : §4.1 « vérification WhatsApp », 8.1 étape 2 (SMS), 8.2 étape 2 (WhatsApp)

**Constat** : la vérification se fait uniquement par email. `BrevoSmsGateway` envoie déjà des SMS pour les colis.

**Proposition** — étape 1, SMS (réutilise Brevo) :

| Méthode | Route | Corps | Effet |
|---|---|---|---|
| POST | `/otp/envoyer` | `{ "telephone": "+2250700000000", "canal": "sms", "motif": "inscription" \| "connexion" }` | Envoie un code à 6 chiffres, valide 10 min |
| POST | `/otp/verifier` | `{ "telephone", "code", "motif" }` | `inscription` : marque le téléphone vérifié. `connexion` : renvoie un token Sanctum (connexion sans mot de passe) |

Règles : 5 envois par heure et par numéro au maximum, 5 essais par code, réponse identique que le numéro existe ou non (pas de fuite de comptes).

Étape 2 : `canal: "whatsapp"` via WhatsApp Business API, même contrat.

**Critères d'acceptation**
- [ ] Un client peut créer son compte en validant son téléphone par SMS, sans email.
- [ ] Un client peut se connecter avec son numéro et un code reçu par SMS.
- [ ] Les limites anti-abus renvoient 429 avec un message lisible.

---

## A2 — Estimation Interville sans compte

**Priorité** : **P0** · **Cahier** : §4.1 « navigation libre sans inscription », 8.1 étape 1 « estimation… sans compte »

**Constat** : `POST /expedition/client/simulate-interville` et `GET /expedition/client/formats-colis` exigent un token. Un invité ne peut donc pas estimer une expédition Interville, alors que le `devis` international est public. `formats-colis` déduit le backoffice du `code_pays` du compte, qu'un invité n'a pas.

**Proposition**
- Rendre `simulate-interville` public. Le backoffice se déduit de `agence_id`, déjà obligatoire.
- Rendre `formats-colis` public avec un paramètre `code_pays` (ou `agence_id`). Il garde le comportement actuel quand un token est présent.
- Limite de débit sur ces routes publiques (ex. 60 requêtes par minute et par IP).

**Critères d'acceptation**
- [ ] Sans token, `formats-colis?code_pays=CI` et `simulate-interville` renvoient le même résultat qu'avec un compte.
- [ ] `store` reste réservé aux comptes connectés.

---

## A3 — Upload de la photo de profil

**Priorité** : P3 · **Cahier** : §4.1 profil

**Constat** : `PUT /profile/avatar` n'accepte qu'une URL déjà hébergée. L'app demande donc au client de coller une URL, ce qu'aucun utilisateur ne sait faire.

**Proposition** : `POST /profile/avatar` en `multipart/form-data`, champ `avatar` (jpeg/png/webp, 5 Mo max). Réponse : `{ success, user: { avatar: "https://..." } }`.

---

# B. Création d'expédition

## B1 — Coordonnées GPS et instructions en entrée de `store`

**Priorité** : P1 · **Cahier** : §4.5 géolocalisation ; côté livreur, navigation et instructions

**Constat** : l'app livreur lit `expediteur_latitude` / `longitude`, `destinataire_latitude` / `longitude`, `instructions_enlevement` et `instructions_livraison`, « fournis par le client à la création ». Ces champs ne sont pas documentés en entrée de `store`. L'app envoie aujourd'hui les champs côté expéditeur avec des noms supposés, et seulement en cas d'enlèvement.

**Demande** : documenter ces 6 champs, optionnels, en entrée de `store` pour les trois modes (latitude -90 à 90, longitude -180 à 180, instructions max 500). Les accepter aussi dans `demander-enlevement` et `demander-livraison` (C2).

**Critères d'acceptation**
- [ ] Une valeur envoyée à la création apparaît dans la mission du livreur.

---

## B2 — Estimation du coût de l'enlèvement avant validation

**Priorité** : P1 · **Cahier** : §4.2 « planification d'un enlèvement à domicile »

**Constat** : en mode `groupage`, le client choisit l'enlèvement sans connaître son prix. `enlevement_distance_km` doit être une distance routière, que l'app ne sait pas calculer : elle ne l'envoie pas, et le backoffice fixe le montant après coup.

**Proposition**

`POST /expedition/client/simulate-enlevement` (public, comme A2) :

```json
{ "agence_id": "uuid", "latitude": 5.3599, "longitude": -3.9870, "type_vehicule": "moto" }
```

Réponse :

```json
{ "success": true, "distance_km": 6.4, "tranche": "5-10 km", "montant": 2000, "devise": "XOF" }
```

Le backend calcule la distance routière (OSRM, Google…) ou, à défaut, à vol d'oiseau avec un coefficient. `store` refait le calcul et l'enregistre, sans faire confiance à une distance envoyée par l'app.

**Critères d'acceptation**
- [ ] Le client voit le montant de l'enlèvement groupage avant de valider.
- [ ] Le montant enregistré à `store` est celui affiché par la simulation (mêmes entrées).
- [ ] En mode `express`, la simulation renvoie seulement `distance_km` (le prix vient des offres).

---

## B3 — Enlèvement et photo en mode `recuperation_agence`

**Priorité** : P2 · **Cahier** : §4.3 « formulaire avec photo », « enlèvement à domicile »

**Constat** : `store` en `recuperation_agence` ne prend ni l'enlèvement ni la photo, car une requête peut créer plusieurs expéditions (une par catégorie).

**Proposition (à valider)**
- **Une seule mission d'enlèvement** pour toutes les expéditions créées par la requête (un seul passage chez l'expéditeur), rattachée à chaque expédition. Mêmes champs `enlevement_*` qu'en Interville.
- **Photo par article** : `colis[0][articles][i][photo]`, exposée en `photo_url` sur l'article.

**Critères d'acceptation**
- [ ] Une demande `recuperation_agence` avec `enlevement_domicile=true` crée une seule mission, visible depuis chaque expédition (`GET /{id}/missions`).
- [ ] Les photos d'articles sont renvoyées par `show`.

---

## B4 — Événement `Expedition/created` pour les créations client

**Priorité** : P2

**Constat** : `WEBSOCKETS.md` (notes d'infra) précise que `Expedition/created` n'est émis que depuis `AgenceExpeditionController`. Une demande créée depuis l'app client n'apparaît donc pas en temps réel chez l'agence choisie.

**Demande** : dans `ClientExpeditionController::store`, après `DB::commit()`, émettre `Expedition/created` vers `agence.{agenceId}` et `backoffice.{backofficeId}`, ainsi que vers `client.{clientId}` (synchronisation multi-appareils).

---

# C. Suivi et dernier kilomètre

## C1 — Suivi en temps réel sur le canal client

**Priorité** : **P0** · **Cahier** : §4.2 / §4.3 « notifications à chaque étape », 8.1 étapes 4 et 6, 8.2 étapes 4 et 7

**Constat** : aucun événement d'expédition n'est émis sur `client.{userId}`. Les 5 étapes de mission partent seulement par SMS, email et push. L'écran de suivi ne bouge qu'au rechargement.

**Proposition** — émettre sur `client.{clientId}` (propriétaire de l'expédition) :

| `model` | `action` | Quand | `data` |
|---|---|---|---|
| `Expedition` | `status_changed` | Tout changement de `statut_expedition` | `{ id, reference, statut_expedition, date_* }` |
| `Expedition` | `accepted` / `refused` | L'agence accepte ou refuse la demande | `{ id, reference, motif? }` |
| `Expedition` | `payment_confirmed` | Paiement enregistré | `{ id, reference, statut_paiement }` |
| `Mission` | `nouvelle_disponible` | Déjà émis | — |
| `Mission` | `proposee` / `assignee` | Proposition groupage, ou livreur assigné | `{ id, expedition_id, type, mode, statut, livreur? }` |
| `Mission` | `etape` | Chaque étape : `enlevement_demarre`, `colis_recupere`, `colis_depose_agence_livreur`, `livraison_demarree`, `colis_livre` | `{ id, expedition_id, type, etape }` |
| `Facture` | `created` | Facture émise (D3) | `{ id, expedition_id }` |

**Critères d'acceptation**
- [ ] Chaque ligne du tableau produit un événement sur le canal du client propriétaire.
- [ ] `data[].expedition_id` (ou `ids`) permet de rattacher l'événement à l'expédition affichée.

---

## C2 — Contrat de `demander-enlevement` et `demander-livraison`

**Priorité** : P1 · **Cahier** : §4.2 enlèvement, §4.2 « choix retrait / livraison », 8.1 étape 7, 8.2 étape 8

**Constat** : ces deux routes existeraient, mais ni leur corps ni leur réponse ne sont documentés. L'app ne les appelle pas pour ne pas deviner les champs.

**Demande** — pour chaque route, documenter :

| Élément | `demander-enlevement` | `demander-livraison` |
|---|---|---|
| Corps | `mode`, `type_vehicule`, coordonnées et instructions (B1) | `mode`, adresse de livraison si différente du destinataire, coordonnées et instructions (B1) |
| Statuts autorisés | ex. `en_attente`, `accepted` | ex. `arrivee_expedition_succes`, `recu_agence_destination` |
| Prix | via B2 | via une simulation équivalente (`simulate-livraison`) |
| Réponse | expédition mise à jour et mission créée | idem |
| Erreurs | 422 si déjà demandé ou statut incompatible | idem |

**Critères d'acceptation**
- [ ] Le contrat est documenté et la mission créée apparaît dans `GET /{id}/missions`.

---

## C3 — Missions : `mode`, livreur, délai ; format des offres ; annulation

**Priorité** : P1 · **Cahier** : §4.2 « réception des offres et sélection », 8.3 étape 3

**Constat**
- `GET /expedition/client/{id}/missions` ne renvoie pas le `mode` : l'app ne distingue pas une mission groupage (pas d'offres) d'une mission express.
- Le livreur assigné (nom, téléphone, véhicule) n'est pas exposé.
- Le format d'une offre n'est pas documenté.
- Le client ne peut pas annuler une mission express sans offre, ni la convertir en groupage.

**Proposition**

```json
{
  "id": "uuid", "type": "livraison", "mode": "express", "statut": "assignee",
  "montant": 1500, "expire_le": null,
  "livreur": { "nom": "Yao", "prenoms": "Paul", "telephone": "0705060708", "type_vehicule": "moto", "photo_url": null },
  "preuve": null
}
```

Offre : `{ "id", "montant_propose", "statut", "created_at", "livreur": { "nom", "prenoms", "type_vehicule", "note_moyenne"? } }`.

Nouvelle route : `POST /expedition/client/missions/{missionId}/annuler` — possible tant que la mission est `en_attente`. Elle passe `annulee`, et les offres actives passent `refusee` (événement `Mission/cloturee` vers les livreurs offrants).

**Critères d'acceptation**
- [ ] `mode` et `montant` sont présents sur chaque mission ; `livreur` dès `assignee`.
- [ ] Le téléphone du livreur n'est exposé qu'après assignation.
- [ ] Une mission express sans offre peut être annulée.

---

## C4 — Espace destinataire sans compte (lien sécurisé)

**Priorité** : P1 · **Cahier** : 8.1 étapes 6–7, 8.3 étapes 3, 6 et 7

**Constat** : le cahier fait agir le **destinataire** (choisir retrait ou domicile, choisir un livreur, recevoir et donner le code). Aujourd'hui seul l'expéditeur connecté peut agir, et un destinataire sans compte ne reçoit que le code par SMS.

**Proposition** : un lien à jeton envoyé par SMS au destinataire (ex. `https://app.tourshop…/suivi/{token}`), ouvrant une page publique de l'app client.

| Méthode | Route (publique, jeton) | Effet |
|---|---|---|
| GET | `/suivi/{token}` | Expédition en lecture : statut, jalons, agence d'arrivée, missions, preuves. Sans les données personnelles de l'expéditeur au-delà du nom |
| POST | `/suivi/{token}/choix-livraison` | `{ "choix": "retrait_agence" \| "livraison_domicile", "adresse"?, "latitude"?, "longitude"?, "instructions"? }` |
| GET | `/suivi/{token}/missions/{missionId}/offres` | Offres des livreurs |
| POST | `/suivi/{token}/missions/{missionId}/offres/{offreId}/accepter` | Choix d'une offre |

Règles : jeton aléatoire d'au moins 32 octets, valable jusqu'à 7 jours après la remise, révocable, limité en débit. Envoi du lien à `recu_agence_destination` (ou dès la création, au choix produit).

**Critères d'acceptation**
- [ ] Un destinataire sans compte peut suivre son colis, choisir retrait ou domicile et choisir une offre depuis le lien.
- [ ] Un jeton expiré ou invalide renvoie 404 sans détail.

---

## C5 — Notification du destinataire à chaque étape clé

**Priorité** : P1 · **Cahier** : 8.1 étape 6 « destinataire notifié de l'arrivée », 8.2 étape 7

**Constat** : seul le code de réception est envoyé au destinataire (à l'assignation du livreur). Rien n'est documenté pour l'arrivée à l'agence.

**Demande** : SMS (et email si connu) au destinataire à `recu_agence_destination` (« votre colis est arrivé à l'agence X, choisissez retrait ou livraison : lien C4 »), à `livraison_demarree` et à `colis_livre`. Documenter la liste dans `NOTIFICATIONS_A_INTEGRER.md`.

---

## C6 — Agence d'arrivée et motif de refus exposés sur l'expédition

**Priorité** : P2 · **Cahier** : §4.5 « chat WhatsApp avec l'agence de départ **et l'agence d'arrivée** »

**Demande** — dans `show` et `list` :
- `agenceArrivee` (`id`, `nom_agence`, `telephone`, `whatsapp`, `adresse`, `ville`, `latitude`, `longitude`), dès qu'elle est affectée ;
- `motif_refus` et `date_refus` quand `statut_expedition = refused` ;
- la liste complète des valeurs de `statut_expedition`, y compris `en_cours_depot`, `refused` et `cancelled`.

---

# D. Paiement et factures

## D1 — Passerelle mobile money

**Priorité** : **P0** · **Cahier** : §4.2 / §4.3 « paiement mobile money (Orange, MTN, Wave) », §4.4 « paiement en ligne », §4.5 « paiement intégré », 8.4 étape 3, 8.6 étape 3, §7.12

**Constat** : tout est déclaratif (aucune passerelle dans `composer.json`). Chantier commun avec la demande B9 de l'app livreur.

**Proposition** — un module de paiement unique, réutilisé par trois objets :

| Méthode | Route | Corps / effet |
|---|---|---|
| POST | `/paiements/initier` | `{ "objet": "expedition" \| "commande_marketplace" \| "echeance_abonnement", "objet_id": "uuid", "operateur": "orange" \| "mtn" \| "moov" \| "wave", "telephone": "07…" }` → `{ "paiement_id", "statut": "en_cours", "url_redirection"?, "instructions"? }` |
| GET | `/paiements/{id}` | `{ "statut": "en_cours" \| "reussi" \| "echoue", "motif"? }` |
| POST | `/paiements/webhook/{agregateur}` | Appelé par l'agrégateur, signature vérifiée. Solde l'objet sans action manuelle |

Effets selon l'objet :
- **expédition** : `statut_paiement = paye`, événement `Expedition/payment_confirmed` (C1) ;
- **commande marketplace** : commande `payee` directement, sans confirmation du vendeur (le paiement déclaratif reste disponible pour le cash) ;
- **échéance d'abonnement** : échéance `payee`, déblocage immédiat, événement `PaiementAbonnement/valide` sur `client.{id}`.

Pour la marketplace, l'argent arrive sur un compte TourShop : il faut alors trancher le reversement au vendeur (voir question en fin de section).

**Critères d'acceptation**
- [ ] Un paiement réussi met à jour l'objet en moins d'une minute, sans backoffice.
- [ ] Un paiement échoué renvoie un motif et laisse l'objet inchangé.
- [ ] L'app reçoit un événement temps réel à la confirmation.
- [ ] Le webhook rejette une signature invalide et est idempotent.

**Questions** : quel agrégateur (CinetPay, PayDunya…) et quels pays au lancement ? Pour la marketplace, l'argent passe-t-il par TourShop (séquestre et reversement) ou reste-t-il direct entre acheteur et vendeur ?

---

## D2 — Compte de réception de l'abonnement (paiement déclaratif)

**Priorité** : **P0** (tant que D1 n'existe pas) · **Cahier** : 8.6 étape 3

**Constat** : `MARKETPLACE_ET_ABONNEMENT_API.md` §9.8 dit de payer « vers un compte communiqué par le backoffice », mais **aucune route ne donne ce compte**. L'app ne peut afficher que « payez sur le compte communiqué par TourShop » : un vendeur bloqué ne sait pas où payer.

**Proposition** : `GET /abonnement/moyens-paiement` (accessible même bloqué), configuré par le backoffice :

```json
{ "success": true, "moyens": [ { "methode": "mobile_money", "libelle": "Orange Money TourShop", "numero_destinataire": "0700000000", "instructions": "Indiquez votre téléphone en motif" } ] }
```

---

## D3 — Factures : format documenté et émission automatique

**Priorité** : P2 · **Cahier** : §4.2 « factures PDF », 8.1 étape 9, 8.2 étape 10

**Demande**
- Documenter les champs de `GET /expedition/client/factures` : `numero`, `date_emission`, `montant_ht`, `montant_ttc`, `devise`, `statut`, `expedition { id, reference, pays_depart, pays_destination }`.
- Émettre automatiquement la facture au paiement (ou à `termined`) : aujourd'hui elle dépend d'une action manuelle de l'agence (`AgenceFactureController::store`), donc le workflow 8.1 étape 9 n'est pas garanti.
- Ajouter `facture_id` sur `show` pour proposer « Télécharger la facture » depuis le détail d'expédition.

---

# E. Marketplace

## E1 — Recherche d'un livreur pour l'affectation directe

**Priorité** : **P0** · **Cahier** : §4.4 « affectation directe », 8.4 étape 6bis

**Constat** : `POST /marketplace/vendeur/ventes/{id}/livraison/direct` exige un `livreur_id` (UUID), et **aucune route ne permet de le trouver**. L'app oblige le vendeur à saisir l'UUID à la main : en pratique, le mode direct est inutilisable.

**Proposition** : `GET /marketplace/vendeur/livreurs/recherche?telephone=0705060708` (ou `?code=` si les livreurs ont un code court partageable). Renvoie au plus un livreur actif, validé et du même pays :

```json
{ "success": true, "livreur": { "id": "uuid", "nom": "Yao", "prenoms": "Paul", "type_vehicule": "moto", "ville": "Abidjan", "disponible": true } }
```

Option : `GET /marketplace/vendeur/livreurs/recents` (livreurs ayant déjà livré pour ce vendeur).

**Critères d'acceptation**
- [ ] Le vendeur retrouve un livreur par son numéro de téléphone exact, sans liste publique de tous les livreurs.
- [ ] 404 si aucun livreur validé ne correspond (pas d'indice sur l'existence d'un compte non livreur).

---

## E2 — Annulation et expiration d'une commande non payée

**Priorité** : P1 · **Cahier** : §4.4 achat

**Constat** : `panier/valider` verrouille les annonces, mais aucune route ne permet d'annuler une commande `en_attente_paiement`. Un acheteur qui ne paie pas bloque l'article indéfiniment.

**Proposition**
- `POST /marketplace/acheteur/commandes/{id}/annuler` (acheteur) et `POST /marketplace/vendeur/ventes/{id}/annuler` (vendeur), possibles tant que la commande n'est pas `payee`. Corps : `{ "motif"? }`. Les annonces redeviennent `publiee`.
- Expiration automatique après un délai configurable (ex. 48 h sans déclaration de paiement).
- Événement `CommandeMarketplace/annulee` vers l'acheteur et le vendeur.

---

## E3 — Événement « nouvelle commande » pour le vendeur

**Priorité** : P1 · **Cahier** : §4.4 « gestion des ventes en cours »

**Constat** : `WEBSOCKETS.md` n'émet rien à la validation du panier. Le vendeur n'apprend la commande qu'à `paiement_declare`.

**Demande** : `CommandeMarketplace/creee` vers `client.{vendeurId}`, et un push « Nouvelle commande ».

---

## E4 — Format des preuves de livraison marketplace

**Priorité** : P1 · **Cahier** : §4.4 « suivi des livraisons », 8.4 étape 10

**Constat** : les preuves structurées (`retrait`, `remise`) sont dites « visibles par le vendeur », sans format documenté. L'app lit `livraison_marketplace.preuves` par supposition.

**Demande** : documenter dans `commandes/show` et `ventes/show` :

```json
"livraison_marketplace": {
  "...": "...",
  "livreur": { "nom", "prenoms", "telephone", "type_vehicule" },
  "preuves": [ { "etape": "retrait" | "remise", "photo_url", "signature_data", "latitude", "longitude", "horodatage" } ]
}
```

Le téléphone du livreur est exposé à l'acheteur et au vendeur une fois la livraison `assignee`.

---

## E5 — Ajout et ordre des photos d'une annonce existante

**Priorité** : P2 · **Cahier** : §4.4 « enregistrement de produits (photos…) »

**Constat** : les photos ne s'ajoutent qu'à la création ; on peut seulement en supprimer ensuite.

**Proposition** : `POST /marketplace/vendeur/annonces/{id}/photos` (multipart `photos[]`, total de 10 maximum) et `PUT /marketplace/vendeur/annonces/{id}/photos/ordre` (`{ "ids": ["...", "..."] }`).

---

## E6 — Catégories et filtres du catalogue

**Priorité** : P2 · **Cahier** : §4.4 « espace de vente dédié »

**Constat** : le catalogue ne filtre que par `code_pays` et `recherche`.

**Proposition** : champ `categorie_id` sur l'annonce et `GET /marketplace/categories` ; filtres `categorie_id`, `ville` (ville de retrait), `prix_min`, `prix_max`, `tri` (`recent`, `prix_asc`, `prix_desc`) sur `catalogue/list`. La ville de retrait est aussi exposée dans la liste pour afficher « à Abidjan ».

---

## E7 — Favoris et panier côté serveur

**Priorité** : P3

**Constat** : favoris et panier sont stockés dans le navigateur, donc perdus en changeant d'appareil.

**Proposition** : `GET` / `POST` / `DELETE /marketplace/acheteur/favoris/{annonceId}` et `GET` / `PUT /marketplace/acheteur/panier` (`{ "annonce_ids": [...] }`). L'app fusionne le contenu local à la connexion.

---

## E8 — Bascule Interville d'une livraison inter-villes

**Décision produit avant tout code** · **Cahier** : 8.4 étape 8

Le système marketplace est découplé des expéditions. Questions à trancher (voir aussi Q1 de `livreur-app/DEMANDES_BACKEND_LIVREUR.md`) :
1. Qui paie le tarif Interville : acheteur, vendeur, ou inclus dans le prix ?
2. Le livreur marketplace dépose-t-il l'article à l'agence de départ, comme un enlèvement ?
3. Le dernier segment suit-il le workflow 8.3 (offres de livreurs côté acheteur) ?
4. Quel lien entre `LivraisonMarketplace` et la ou les `Expedition` créées, pour que l'acheteur voie un suivi unique ?

Une fois tranché, l'app attend au minimum : sur la commande, `expedition_id` (ou une liste), et un statut de livraison `en_transit_interville`.

---

# F. Notifications

## F1 — Historique des notifications du client

**Priorité** : P1 · **Cahier** : §4.5 notifications, §7.8

**Constat** : `NOTIFICATIONS_A_INTEGRER.md` annonce des notifications « push + historique » pour le client, mais seules les routes livreur existent. Une notification reçue sans push actif est perdue.

**Proposition** : même contrat que `/livreur/notifications` (`PARCOURS_LIVREUR_API (1).md` §7.3), pour le type `CLIENT` :

| Méthode | Route |
|---|---|
| GET | `/client/notifications?page=1` (20 par page, avec `non_lues` au total) |
| POST | `/client/notifications/{id}/lue` |
| POST | `/client/notifications/tout-lire` |

`data.cible` : `{ "type": "expedition" | "mission" | "commande_marketplace" | "annonce" | "echeance" | "parrainage", "id": "uuid" }`. Même rétention de 90 jours pour les notifications lues.

---

## F2 — Annonces et nouveautés envoyées aux clients

**Priorité** : P2 · **Cahier** : §4.5 « notifications push (annonces, nouveautés…) »

**Constat** : les agences ont `Announcement` / `AnnouncementRead`, mais rien n'est prévu pour les clients.

**Proposition** : le backoffice publie une annonce ciblée (pays, tous les clients ou les vendeurs seulement), envoyée en push et visible dans l'app :
- `GET /client/annonces` (actives, avec `titre`, `message`, `image_url`, `lien`, `publiee_le`, `lue`) ;
- `POST /client/annonces/{id}/lue`.

---

## F3 — Liste officielle des push envoyés au client

**Priorité** : P2

**Demande** : documenter, pour chaque push client, le `data.type`, le titre, le corps et la cible (`data.url` ou `data.cible`), à l'image de `PARCOURS_LIVREUR_API (1).md` §7.3. Aujourd'hui l'app déduit le type du texte du message.

Liste attendue au minimum : demande acceptée / refusée, colis arrivé, enlèvement et livraison (5 étapes), offre de livreur reçue, livreur assigné, facture disponible, commande créée / payée / livrée / annulée, paiement infirmé, offre de livraison marketplace, livreur direct refusé ou expiré, annonce masquée, abonnement (rappel, bloqué, validé, rejeté), parrainage (bonus, retrait).

---

# G. Référentiels

## G1 — Coordonnées, WhatsApp et horaires de toutes les agences

**Priorité** : P2 · **Cahier** : §4.5 « liste des agences et leurs informations », « géolocalisation », « chat WhatsApp »

**Demande**
- `latitude` / `longitude` renseignées pour toutes les agences actives (aujourd'hui, une agence sans coordonnées n'apparaît pas sur la carte).
- Un champ `whatsapp` distinct de `telephone`.
- Le format de `horaires` documenté.
- Sur `GET /api/agences` : paramètres `latitude` / `longitude` qui ajoutent `distance_km` et trient par distance.

---

## G2 — Configuration publique de l'app

**Priorité** : P3

**Proposition** : `GET /config/client?code_pays=CI` → `{ "support_whatsapp", "support_telephone", "support_email", "cgu_url", "confidentialite_url", "version_min_app" }`. Le numéro du support n'est alors plus figé au build (`VITE_SUPPORT_WHATSAPP`), et peut varier par pays.

---

# H. Parrainage

## H1 — Demande de retrait du solde de parrainage

**Priorité** : P2 · **Cahier** : §4.5 parrainage

**Constat** : `api-parrainage-client.md` est en lecture seule (« pas d'endpoint de retrait »). Le backoffice enregistre les retraits sans que le client puisse en demander un.

**Proposition** (même modèle que le retrait livreur) : `POST /client/parrainage/demander-retrait` `{ "montant", "moyen": "Orange Money 07…" }`, statut `en_attente` → `traite` / `rejete`, retraits visibles dans `historique`. Montant minimum configurable.

---

# I. Documentation

## I1 — Corrections et dédoublonnage des docs

**Priorité** : P3

| Document | Correction |
|---|---|
| `MARKETPLACE_ET_ABONNEMENT_API.md` §10.2 | Le workflow dit « assignee immédiatement, code généré » pour l'affectation directe, alors que §6 et §7.4 décrivent `proposee` (15 min) |
| `MARKETPLACE_ET_ABONNEMENT_API.md` §10.1 | Ajouter `adresse_livraison` à l'exemple `panier/valider` |
| `MARKETPLACE_ET_ABONNEMENT_API.md` §1 | Remettre la section 1.6 après la 1.5 |
| `REPONSE_AUDIT…` et `REPONSE_AUDIT… (1)` | Garder une seule version (la `(1)`) |
| `PARCOURS_LIVREUR_API.md` et `… (1)` | Garder une seule version (la `(1)`) |
| `api-enregistrement-expedition-client.md` | Ajouter les champs `enlevement_*`, `colis.*.photo` et ceux de B1 |
| `WEBSOCKETS.md` | Ajouter les événements des demandes C1, B4, E2, E3 et D1 |

---

## Proposition de découpage en lots

| Lot | Contenu | Pourquoi ensemble |
|---|---|---|
| **1 — Débloquer les parcours** | A2, D2, E1, C1, C3, E2 | Petits changements qui rendent fonctionnels l'estimation invité, le paiement de l'abonnement, le mode direct et le suivi |
| **2 — Dernier kilomètre** | B1, B2, C2, C5, C6, E4, F3 | Contrats et données pour l'enlèvement, la livraison et les preuves |
| **3 — Destinataire et notifications** | C4, F1, F2, E3, B4 | Destinataire sans compte, historique et annonces |
| **4 — Paiement et identité** | D1, A1, D3, H1 | Chantiers d'intégration externes (agrégateur, SMS / WhatsApp) |
| **5 — Confort** | A3, B3, E5, E6, E7, G1, G2, I1 | Améliorations sans blocage |
| **Hors lot** | E8 | En attente d'une décision produit |

Pour chaque point livré, l'équipe client s'engage à brancher l'app dans la foulée et à retirer les contournements actuels (lecture défensive, saisie d'UUID, champs supposés).
