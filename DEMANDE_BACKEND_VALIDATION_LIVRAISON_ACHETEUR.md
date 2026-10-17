# Demande backend — audit de l'app client : parcours actuel et besoins pour qu'elle soit pleinement fonctionnelle

**Pour :** équipe backend (Laravel) et décisions produit · **App concernée :** app client (PWA React) · **Date de l'audit :** 17 octobre 2026

> Ce fichier garde son nom d'origine (il traitait d'abord la validation du tarif de livraison par l'acheteur). Cette validation est maintenant le besoin **B3**, détaillé dans la partie 4.

## 0. Résumé

L'app couvre l'ensemble des parcours décrits dans les contrats backend (`user-parcour/*.md`, `WEBSOCKETS.md`) : inscription, envoi de colis (Interville, International), enlèvement et livraison à domicile avec offres de livreurs, suivi, évaluation, factures, marketplace complète (acheteur, vendeur, livraison, abonnement), parrainage et profil. Les écrans appellent ces routes et réagissent aux événements temps réel.

**Ce qui empêche aujourd'hui un fonctionnement correct de bout en bout :**

| # | Problème | Effet pour l'utilisateur |
|---|---|---|
| B1 | Notifications push à valider en production (clé VAPID configurée, mais envoi non testé de bout en bout) | Pas de notification app fermée tant que non validé |
| B2 | Le vendeur ne voit pas les offres de livraison reçues | Il est notifié mais ne peut ni consulter, ni trier, ni accepter une offre |
| B3 | L'acheteur ne voit ni ne valide le tarif de livraison | Il subit un tarif qu'il n'a pas validé et ne le voit qu'après coup |
| B4 | Données de l'expédition non garanties (agence d'arrivée, code de réception, médias) | Livraison à domicile sans distance ni tarif indicatif, images non affichées |
| B5 | Pas d'historique de notifications côté client | Une notification manquée est perdue ; la cloche de l'accueil ne mène à rien |

Priorités utilisées : **P0** = bloque un parcours, **P1** = dégrade nettement l'usage ou la fiabilité, **P2** = amélioration.

## 1. Périmètre et méthode

- **Audité :** le code de l'app (`src/services`, pages, hooks, store), confronté aux contrats `user-parcour/` (authentification, expédition, enlèvement/livraison, profil et notifications, marketplace et abonnement, WebSockets) et aux guides de notifications.
- **Non vérifié en conditions réelles :** je n'ai pas pu interroger le serveur de production (toutes les routes utiles exigent un token) ni tester sur appareil. Les constats « côté backend » sont donc des **points à confirmer**, formulés comme tels. Les constats « côté app » viennent de la lecture du code.
- **Corrigé côté app pendant l'audit :** formulaires d'expédition (WhatsApp, position, instructions, pièces d'identité, filtre des produits éligibles), demandes d'enlèvement/livraison après création, écran des offres vendeur (voir B2), bannière de notifications, redirections des liens de notifications.

---

## 2. Parcours actuel de l'app, module par module

Légende : ✅ fonctionne selon le contrat · ⚠️ fonctionne avec une limite ou une donnée non garantie · ❌ manque côté backend.

### 2.1 Compte et connexion — ✅

1. Onboarding de bienvenue, puis navigation en **invité** (agences, devis, catalogue marketplace).
2. Inscription : nom, prénoms, pays, téléphone (indicatif séparé), **WhatsApp (E.164, obligatoire)**, email, mot de passe, code de parrainage facultatif → `POST /register`.
3. Vérification par code reçu par email (et dupliqué sur WhatsApp) → `POST /verify-email`, `POST /resend-email-verification`, puis connexion automatique → `POST /login` (le jeton est conservé et envoyé en `Bearer`).
4. Mot de passe oublié en 3 étapes → `forgot-password`, `verify-reset-code`, `reset-password`.
5. Restauration de session au démarrage → `GET /profil`. Un `401` renvoie l'utilisateur en mode invité.

### 2.2 Envoi de colis — ✅ / ⚠️

- **Interville** : pays → agence de départ → commune d'arrivée → colis (poids, format, photo) → simulation → coordonnées + pièce d'identité → enregistrement. Routes : `GET /communes`, `GET /expedition/client/formats-colis`, `POST /simulate-interville`, `POST /expedition/client/store` (multipart si photo).
- **International – livraison à domicile** : mode → pays de destination (`GET /pays-disponibles`) → colis avec dimensions saisies à la main et produits (`GET /produits`) → agence → devis (`POST /devis`, public) → coordonnées → enregistrement.
- **International – récupération en agence (groupage)** : articles par produit → devis par catégorie → choix du type d'expédition par catégorie → enregistrement, avec résultats partiels gérés (`resultats[]`).
- Pour chaque expéditeur / destinataire : adresses favorites, WhatsApp, position et instructions pour le livreur (destinataire).
- ⚠️ La ville de destination (hors Afrique) est cherchée via un service **tiers** gratuit (voir B10) car le backend n'expose des communes que pour l'Interville.

### 2.3 Enlèvement et livraison à domicile — ✅ / ⚠️

1. À l'enregistrement (modes Interville et livraison à domicile) : l'utilisateur choisit « un livreur vient chercher le colis », mode **express** (offres de prix) ou **groupage** (tarif fixe selon la grille), véhicule, point sur la carte, instructions. L'app calcule la **distance par la route** (service de routage externe) et affiche un tarif indicatif en groupage (`GET /grille-tarifs-enlevement`).
2. Après création, dans le détail de l'expédition : boutons « Faire récupérer le colis à domicile » et « Faire livrer chez le destinataire » → `POST /{id}/demander-enlevement` et `demander-livraison`.
3. En express : la liste des offres s'affiche dans le détail, de la moins chère à la plus chère → « Choisir » → `POST …/offres/{offreId}/accepter`. Une erreur `404` (offre déjà prise) rafraîchit la liste. Annulation possible tant que la mission est `en_attente` → `POST …/annuler`.
4. Le livreur assigné (nom, véhicule, appel, WhatsApp), le code de réception et les preuves (photo, signature, position) s'affichent dans la section « Livreur ».
- ⚠️ La demande de **livraison à domicile** a besoin de l'agence d'arrivée (position, commune) : son emplacement dans la réponse de `show` n'est pas garanti (B4).

### 2.4 Suivi, annulation, évaluation, factures — ✅

Liste des colis et filtres (`GET /list`), statistiques (`GET /statistics`), détail avec frise des jalons (`GET /show/{id}`), annulation avec motif (`PUT /cancel/{id}`), évaluation d'une expédition terminée (`GET/POST /{id}/evaluation`), factures et téléchargement PDF. Le détail se met à jour en temps réel (statut, paiement, étapes du livreur, tarif recalculé).

### 2.5 Marketplace — acheteur — ✅ / ⚠️

Catalogue (recherche, pays, pagination 20 par page), fiche produit, favoris et panier (conservés dans l'app), adresse de livraison saisie au panier → `POST /panier/valider` (une commande par vendeur) → choix du moyen de paiement du vendeur → déclaration du paiement avec preuve → attente de confirmation → code de remise → suivi → annulation avant paiement.
- ⚠️ Le **tri et le filtre de prix** sont faits dans l'app sur les seules annonces déjà chargées ; les **catégories** de l'accueil sont décoratives (B9).
- ❌ L'acheteur **ne voit pas le tarif de livraison avant qu'il soit imposé** (B3).

### 2.6 Marketplace — vendeur — ✅ / ❌

Annonces (création avec photos et adresse de retrait obligatoire avec position GPS, publication, dépublication), moyens de paiement, ventes, confirmation ou refus du paiement, **choix du mode de livraison** (réseau, livreur choisi par téléphone, hors plateforme), solde informatif.
- ❌ En mode réseau, le vendeur est notifié des offres mais **ne parvient pas à les consulter** (B2).

### 2.7 Abonnement marketplace — ✅

Statut, échéance, bandeau d'alerte, blocage (`ABONNEMENT_BLOQUE` détecté et redirigé), moyens de paiement du backoffice, déclaration de paiement avec preuve, historique paginé, re-déclaration après rejet.

### 2.8 Parrainage — ✅ / ⚠️

Code personnel, solde, historique paginé, filleuls (lecture seule). ⚠️ Aucun retrait possible : « Aucun retrait n'est disponible pour le moment ».

### 2.9 Profil — ✅ / ⚠️

Modification du nom, téléphone, email (re-vérification), pays ; changement de mot de passe ; adresses favorites ; suppression du compte. Pour un **invité** : choix du pays directement depuis le profil.
- ⚠️ La **photo de profil** se règle en collant une URL d'image (aucun envoi de fichier possible, B6).
- ⚠️ Le **numéro WhatsApp** n'est plus modifiable après l'inscription (B7).

### 2.10 Notifications — ⚠️ / ❌

- **Temps réel (Reverb, canal `client.{id}`)** : statut d'expédition, paiement, étapes du livreur, offres, événements marketplace, tarif recalculé → notifications à l'écran (toasts) quand l'app est ouverte. ✅
- **Push (app fermée)** : bannière d'activation après connexion, abonnement via `GET /push/public-key` et `POST /push/subscribe`, affichage par le service worker. ⚠️ À valider en production (B1).
- **Historique** : aucun écran ni route côté client. ❌ (B5)

---

## 3. Besoins backend — tableau de bord

| ID | Priorité | Besoin | Détail |
|---|---|---|---|
| **B1** | P0 | Valider les notifications push en production | §3.1 |
| **B2** | P0 | Le vendeur doit pouvoir voir les offres de livraison | §3.2 |
| **B3** | P1 *(décision produit)* | L'acheteur voit et valide le tarif de livraison | Partie 4 |
| **B4** | P1 | Garantir le contenu des réponses d'expédition | §3.3 |
| **B5** | P1 | Historique des notifications côté client | §3.4 |
| **B6** | P1 | Envoi de la photo de profil (fichier) | §3.5 |
| **B7** | P1 | Modifier le numéro WhatsApp | §3.6 |
| **B8** | P1 | Médias : URL absolues et stables | §3.7 |
| **B9** | P1 | Marketplace : tri, filtre et catégories côté serveur | §3.8 |
| **B10** | P1 | Villes : endpoint backend à la place d'un service tiers | §3.9 |
| **B11** | P1 | Calcul de distance fiable pour les courses | §3.10 |
| **B12** | P2 | Offres de livreurs : champs complets | §3.11 |
| **B13** | P2 | Contrat temps réel : noms d'événements à confirmer | §3.12 |
| **B14** | P2 | Liens des notifications (`data.url`) | §3.13 |
| **B15** | P2 | Pagination de la liste des expéditions | §3.14 |
| **B16** | P2 | Produit : parrainage, livraison marketplace inter-villes, préfixe Interville | §3.15 |

### 3.1 B1 — Notifications push en production (P0)

Le backend indique que les clés VAPID sont configurées. Reste à valider de bout en bout :
- [ ] `GET /api/push/public-key` renvoie la clé dans `public_key` (testé avec un jeton client et un jeton livreur) ;
- [ ] `POST /api/push/subscribe` enregistre l'abonnement pour l'utilisateur connecté (plusieurs appareils possibles) ;
- [ ] **le worker de queue tourne en production** (`php artisan queue:work`), sinon rien ne part ;
- [ ] un envoi de test arrive sur Android (Chrome) et sur iPhone avec l'app installée (iOS 16.4 minimum) ;
- [ ] les abonnements expirés (`404`/`410`) sont supprimés ;
- [ ] la configuration CORS autorise l'origine de l'app sur `/api/push/*` et `/broadcasting/auth`.

Détails et format du message : `DEMANDE_BACKEND_NOTIFICATIONS_PUSH.md`, `INTEGRATION_PUSH_NOTIFICATIONS_REACT.md`.

### 3.2 B2 — Le vendeur doit pouvoir voir les offres de livraison (P0)

Constat : quand un livreur propose un prix, le vendeur reçoit la notification mais n'arrive pas à voir les offres. L'app a été corrigée (bouton « Voir » dans la notification, onglet « Offres à comparer » dans « Mes ventes », erreurs affichées au lieu de « En attente d'offres… », tri du moins cher au plus cher), mais le vendeur ne verra les offres que si le backend répond correctement. À vérifier :

- [ ] `GET /marketplace/vendeur/ventes/{id}/livraison/offres` répond `200` pour le vendeur propriétaire, avec `{ "offres": [ … ] }` et, par offre : `id`, `montant_propose`, `statut`, `livreur { id, nom, prenoms }`. Un `403`, `404` ou `500` explique l'absence d'offres à l'écran.
- [ ] `GET /marketplace/acheteur/commandes/show/{id}` (que l'app utilise aussi pour le vendeur) et `GET /marketplace/vendeur/ventes/show/{id}` renvoient `livraison_marketplace.offres`, `acheteur` et les preuves.
- [ ] L'événement `LivraisonMarketplaceOffre / proposee` contient **`commande_marketplace_id`** dans `data`, en plus de `livraison_marketplace_id`.
- [ ] La notification push d'offre reçue (vendeur) porte `data.url` = `/marketplace/ventes/<commandeId>`.
- [ ] Le middleware d'abonnement ne bloque pas à tort un vendeur à jour.

### 3.3 B4 — Contenu des réponses d'expédition à garantir (P1)

`GET /expedition/client/show/{id}` est documenté comme renvoyant « tous les champs ». L'app dépend de champs précis, lus de façon défensive faute de contrat. À garantir et documenter :

| Champ | Utilisé pour |
|---|---|
| `agence_arrivee` (`id`, `nom_agence`, `latitude`, `longitude`, `commune_id`, `ville`) | Demande de **livraison à domicile** : distance, tarif indicatif, grille de la commune. Le nom de la relation n'est pas documenté (l'app essaie `agence_arrivee`, `agenceArrivee`, `agence_destination`). |
| `destinataire_commune_id` | Repli pour retrouver la grille tarifaire (Interville) |
| `code_validation_reception` | Afficher le code de réception au client (livraison assignée) |
| `date_*` (enlèvement, dépôt, expédition, arrivée, réception, remise) | Frise de suivi |
| `expediteur_latitude`, `_longitude`, `instructions_enlevement`, `destinataire_*` équivalents | Pré-remplir la demande d'enlèvement / de livraison |
| `agence.commune_id`, `agence.latitude`, `agence.longitude` | Distance et grille de l'enlèvement |
| `colis[].photo_url` | Photo du colis dans le détail |
| `motif_refus` (ou nom équivalent) | Afficher le motif d'une demande refusée par l'agence (nom du champ non documenté) |

Pour `GET /expedition/client/{id}/missions` : confirmer `preuve { photo, signature, latitude, longitude }` (l'app lit aussi les anciens noms `photo_url`, `signature_data`).

### 3.4 B5 — Historique des notifications côté client (P1)

Le contrat livreur propose `GET /livreur/notifications`, `POST …/{id}/lue`, `POST …/tout-lire`. **Rien d'équivalent pour le client** : la cloche de l'accueil renvoie au profil, et une notification push manquée (ou jamais activée) est perdue. Demande :

- `GET /profile/notifications` (paginé, 20 par page, plus récentes d'abord) : `id`, `type`, `data { titre, message, cible { type, id } }`, `read_at`, `created_at` ;
- `POST /profile/notifications/{id}/lue` et `POST /profile/notifications/tout-lire` ;
- idéalement `GET /profile/notifications/non-lues-count` pour le badge de la cloche ;
- que chaque notification push client soit aussi enregistrée dans cet historique (canal `database`), comme côté livreur.

### 3.5 B6 — Photo de profil (P1)

`PUT /profile/avatar` n'accepte qu'une URL : l'app demande à l'utilisateur de **coller l'adresse d'une image déjà hébergée**, ce qui est irréaliste. Demande : `POST /profile/avatar` en `multipart/form-data` (champ `avatar`, jpeg/png/webp, 5 Mo max) qui stocke le fichier et renvoie l'URL absolue.

### 3.6 B7 — Modifier le numéro WhatsApp (P1)

Obligatoire à l'inscription, mais non modifiable ensuite. Un client qui change de numéro ne reçoit plus ses codes et notifications WhatsApp. Demande : `PUT /profile/update` accepte `whatsapp_number` (E.164 strict, même règle qu'à l'inscription) et le renvoie dans `user`.

### 3.7 B8 — Médias : URL absolues et stables (P1)

Les photos d'annonces, preuves de paiement et preuves de livraison arrivent en **chemin relatif** (`marketplace/produits/…`). L'app les reconstruit avec une adresse de stockage Supabase écrite en dur par défaut et une URL de secours sur le serveur d'API. Demande : renvoyer partout des **URL absolues** (`photo_url`, `preuve_url`…) pointant vers un stockage public stable, pour que l'app n'ait plus à deviner.

### 3.8 B9 — Marketplace : tri, filtre et catégories côté serveur (P1)

`GET /marketplace/acheteur/catalogue/list` ne gère que `code_pays`, `recherche`, `per_page`. Le tri par prix et le filtre de prix sont faits dans l'app **sur les pages déjà chargées** (20 annonces par page) : le résultat est faux dès qu'il y a plus d'une page. Les cinq catégories de l'accueil (Mode, Électronique, Maison, Beauté, Alimentation) mènent au catalogue sans filtrer, car les annonces n'ont pas de catégorie. Demande :
- paramètres `tri` (`recent`, `prix_asc`, `prix_desc`), `prix_min`, `prix_max` ;
- un champ `categorie` sur les annonces (obligatoire à la création, modifiable) et un filtre `categorie` ;
- une liste de catégories : `GET /marketplace/categories`.

### 3.9 B10 — Villes (P1)

Pour la ville de destination des envois internationaux, l'app interroge **CountriesNow**, un service public gratuit, sans garantie de disponibilité. Pour plusieurs pays (RD Congo, Palestine, Soudan du Sud…) la recherche ne fonctionne pas et l'utilisateur doit saisir librement la ville, ce qui crée des erreurs de tarification. Demande : `GET /villes?code_pays=XX` (ou extension de `GET /communes`) avec les villes desservies par les tarifs, et la correspondance avec les lignes tarifaires (DHD ville à ville).

### 3.10 B11 — Calcul de distance fiable (P1)

La distance agence → point d'enlèvement/livraison est calculée **par l'app** via des serveurs de routage publics (OSRM de démonstration, OSRM FOSSGIS). Ces serveurs sont limités et sans garantie ; en cas d'échec l'app n'envoie aucune distance et l'agence doit la confirmer. Deux options : héberger un serveur de routage pour TourShop (l'app le supporte déjà via `VITE_ROUTING_URL`), **ou** exposer côté backend `GET /expedition/client/estimer-course?agence_id=&latitude=&longitude=&type_vehicule=` qui renvoie `distance_km` et le tarif de la grille. Même remarque pour la recherche de lieux (Nominatim public, `VITE_GEOCODING_URL` prévu pour une instance TourShop) et les fonds de carte.

### 3.11 B12 — Offres de livreurs : champs complets (P2)

Le contrat des offres d'une mission (`GET …/missions/{id}/offres`) renvoie `livreur { id, nom, prenoms, telephone }`. L'app affiche aussi le **véhicule** : ajouter `type_vehicule`, et idéalement `note_moyenne` et `nombre_courses` pour aider le choix. Même chose pour les offres de livraison marketplace.

### 3.12 B13 — Contrat temps réel : noms d'événements à confirmer (P2)

L'app écoute sur `client.{id}` (événement `.model.updated`) : `Expedition` (`created`, `status_changed`, `payment_confirmed`, `tarif_recalculated`, et **`delivered`**), `Colis` (**`status_changed`**), `Mission` (`nouvelle_disponible`, `etape`), `MissionOffre` (`proposee`), les modèles marketplace.
- `Expedition / delivered` et `Colis / status_changed` ne figurent pas dans `WEBSOCKETS.md` pour le client. Soit les ajouter au contrat, soit confirmer que la livraison arrive par `Expedition / status_changed` (statut `termined`).
- Le contrat ne liste pas d'événement client pour `Mission / assignee`, `refusee`, `cloturee` : confirmer que l'assignation d'un livreur à la demande du client est bien signalée (sinon l'app ne se rafraîchit pas à ce moment).
- Documenter la forme exacte de `data` des événements `LivraisonMarketplaceOffre` (voir B2).

### 3.13 B14 — Liens des notifications (P2)

Chemins de l'app à utiliser dans `data.url` : `/expeditions/<id>`, `/marketplace/achats/<id>`, `/marketplace/ventes/<id>`, `/marketplace/abonnement`, `/profil/parrainage`. Le guide actuel cite `/parrainage` et `/abonnement` : l'app les redirige, mais autant envoyer les bons chemins.

### 3.14 B15 — Pagination de la liste des expéditions (P2)

`GET /expedition/client/list` renvoie **toutes** les expéditions sans pagination. Ajouter, de façon compatible, `page` et `per_page` optionnels.

### 3.15 B16 — Décisions produit (P2)

- **Parrainage :** aucun retrait de bonus possible. Prévoir un retrait (ou l'utilisation du solde) si c'est voulu.
- **Livraison marketplace entre villes :** le cahier des charges prévoit un basculement vers le système de missions d'expédition ; ce n'est pas implémenté (`MARKETPLACE_ET_ABONNEMENT_API.md`, « Limitation connue »).
- **Préfixe des codes colis Interville :** il retombe sur `DHD-AR` par défaut (limitation connue).

---

## 4. Détail de B3 — L'acheteur voit et valide le tarif de livraison

### 4.1 Le constat

Dans un achat marketplace livré par le réseau de livreurs, **le livreur propose un prix mais l'acheteur n'a aucun moyen de le voir ni de l'accepter avant qu'il soit retenu**.

| Étape | Qui | Existant |
|---|---|---|
| Paiement déclaré puis confirmé | acheteur → vendeur | Oui |
| Choix du mode de livraison | **vendeur** | Oui |
| Le livreur propose un prix | livreur | Oui |
| Le vendeur voit les offres et en accepte une | **vendeur** | Prévu, mais bloqué en pratique (B2) |
| L'acheteur est averti d'une offre | — | **Non** : l'événement n'est diffusé qu'au vendeur |
| L'acheteur voit les offres | — | **Non** : la route est réservée au vendeur |
| L'acheteur valide ou refuse le tarif | — | **Non** : aucune route, aucun statut |
| L'acheteur voit le montant | — | Seulement **après** acceptation par le vendeur (« Frais de livraison »), à titre informatif |

À l'achat, le total affiché ne contient que `montant_articles` : rien n'indique que la livraison coûte quelque chose. Pour une **expédition de colis**, c'est au contraire le client qui voit les offres et choisit : c'est le comportement attendu aussi ici.

### 4.2 Question produit à trancher

**Qui paie la livraison, et qui décide du livreur ?** Le contrat dit seulement que l'argent circule hors application, sans préciser qui règle le livreur.

| Option | Principe | Impact |
|---|---|---|
| **A. Accord de l'acheteur (recommandée)** | Le vendeur retient une offre ; l'acheteur doit l'accepter avant l'assignation. | Minimal : une étape de validation après le choix du vendeur. |
| **B. L'acheteur choisit l'offre** | Offres visibles par l'acheteur, qui en accepte une. | Le vendeur n'intervient plus dans le choix. |
| **C. Frais connus dès l'achat** | Tarif estimé et affiché au panier. | Suppose un barème serveur (distance, véhicule) : plus lourd. |

La suite décrit l'**option A**.

### 4.3 Nouveau statut

`LivraisonMarketplace.statut` reçoit **`en_attente_accord_acheteur`** :

```
en_attente ──(vendeur retient une offre)──> en_attente_accord_acheteur
       ▲                                          │
       │                         ┌────────────────┴───────────────┐
       │                 (acheteur accepte)            (acheteur refuse / délai dépassé)
       │                         ▼                                │
       │                     assignee                             │
       └──────────────────────────────────────────────────────────┘
        (l'offre retenue passe à `refusee`, les autres restent `active`)
```

### 4.4 Changement de `POST /marketplace/vendeur/ventes/{id}/livraison/offres/{offreId}/accepter`

Aujourd'hui : assigne le livreur, refuse les autres offres, génère le code de remise, démarre l'abonnement du livreur. **À la place :**
- la livraison passe en `en_attente_accord_acheteur`, `montant_final` est renseigné, `expire_le` fixé (délai à définir, par ex. 24 h) ;
- les **autres offres restent `active`** ;
- le **code de remise n'est pas généré** et l'**abonnement du livreur ne démarre pas** à ce stade : ces effets passent à l'accord de l'acheteur.

### 4.5 Nouvelles routes côté acheteur

Base `/marketplace/acheteur` (sans middleware d'abonnement).

- `GET /commandes/{id}/livraison/proposition` → `{ proposition: { livraison_id, montant, livreur { id, nom, prenoms, type_vehicule }, expire_le } }`, ou `proposition: null`. `404` si la commande n'est pas à l'acheteur. Les coordonnées du livreur restent masquées avant l'assignation.
- `POST /commandes/{id}/livraison/accepter` → livraison `assignee`, autres offres refusées, **code de remise généré**, **abonnement du livreur démarré**. `422` « Cette proposition n'est plus disponible. » si expirée.
- `POST /commandes/{id}/livraison/refuser` (corps optionnel `{ motif }`) → l'offre retenue passe à `refusee`, la livraison repasse en `en_attente`, le vendeur choisit une autre offre.
- **Expiration automatique** : une tâche planifiée traite une proposition non répondue comme un refus (motif « Expiré »), vendeur et livreur prévenus.

### 4.6 Montants visibles par l'acheteur

Dans `GET /marketplace/acheteur/commandes/show/{id}` : `livraison_marketplace.montant_final` dès qu'une offre est retenue, `expire_le` pendant l'attente, et un champ **`montant_total`** = `montant_articles` + frais de livraison acceptés. Préciser qui encaisse les frais (le livreur en espèces à la remise, d'après le modèle actuel).

### 4.7 Temps réel et notifications

| `model` / `action` | Destinataires | Quand |
|---|---|---|
| `LivraisonMarketplace` / `accord_demande` | **acheteur** (+ vendeur) | Le vendeur retient une offre. `data` : `commande_marketplace_id`, `montant_final`, `expire_le`. |
| `LivraisonMarketplace` / `accord_accepte` | vendeur + livreur | L'acheteur accepte (suivi de `assignee`). |
| `LivraisonMarketplace` / `accord_refuse`, `accord_expire` | vendeur (+ livreur) | Refus ou délai dépassé. |

Notifications push : acheteur « Un livreur propose de livrer votre commande pour 1 500 FCFA. Acceptez-vous ? » (`/marketplace/achats/<id>`) ; vendeur « Tarif accepté » ou « Tarif refusé, choisissez une autre offre » (`/marketplace/ventes/<id>`) ; livreur « Votre offre a été acceptée ».

### 4.8 Travail prévu côté app une fois le backend prêt

Carte « Accord sur la livraison » dans le détail de la commande acheteur (montant, livreur, compte à rebours, boutons Accepter / Refuser) ; état « En attente de l'accord de l'acheteur » côté vendeur avec retour au choix en cas de refus ; totaux avec `montant_total` ; toast temps réel ; nouveaux libellés de statut.

### 4.9 Cas particuliers

- Le vendeur peut-il annuler sa sélection avant la réponse de l'acheteur ? (proposition : oui.)
- Offre retirée par le livreur pendant l'attente : la proposition tombe, la livraison repasse en `en_attente`, acheteur et vendeur sont prévenus.
- Commande annulée pendant l'attente : la proposition est close.
- Mode `livreur_direct` : le vendeur fixe le montant ; demander aussi l'accord de l'acheteur ? À trancher avec la question 4.2.
- Mode `hors_plateforme` : inchangé.

---

## 5. Points à confirmer par le backend

1. Nom de la relation de l'agence d'arrivée dans `show` (B4).
2. Nom du champ du motif de refus d'une demande (B4).
3. Format exact de `data` de `LivraisonMarketplaceOffre / proposee` (B2).
4. Existence des événements `Expedition / delivered` et `Colis / status_changed` côté client (B13).
5. Événement envoyé au client quand un livreur est assigné à sa demande (B13).
6. Qui encaisse les frais de livraison marketplace (B3).

## 6. Checklist de livraison

- [ ] **B1** Push validé en production (queue worker, Android, iPhone)
- [ ] **B2** Le vendeur voit les offres (route, payload de l'événement, `show`)
- [ ] **B3** Décision produit prise, puis statut et routes acheteur livrés
- [ ] **B4** Champs d'expédition garantis et documentés
- [ ] **B5** Historique de notifications côté client
- [ ] **B6** Envoi de fichier pour la photo de profil
- [ ] **B7** `whatsapp_number` modifiable
- [ ] **B8** URL de médias absolues
- [ ] **B9** Tri, filtres et catégories de la marketplace
- [ ] **B10** Endpoint de villes
- [ ] **B11** Calcul de distance côté serveur ou routage hébergé
- [ ] **B12 à B16** Selon les arbitrages
- [ ] `WEBSOCKETS.md`, `MARKETPLACE_ET_ABONNEMENT_API.md` et `api-enregistrement-expedition-client.md` mis à jour
