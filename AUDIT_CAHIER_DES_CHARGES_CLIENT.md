# Audit — Application Client face au cahier des charges

Comparaison entre la **section 4 du cahier des charges v2** (Application Client) et les étapes client des workflows de la section 8, et le code de `client-app` au 4 octobre 2026.

- **Sources** : `src/` (pages, services, `config/features.js`), docs API du dépôt (`api-*.md`, `MARKETPLACE_ET_ABONNEMENT_API.md`) et `livreur-app/PARCOURS_LIVREUR_API.md` pour les routes partagées.
- **Statuts** : **Couvert** = fonctionne avec une API documentée · **Partiel** = une partie manque · **Absent** = rien d'utilisable.
- **Bloqué par** : **App** = faisable sans backend · **API** = une route ou un champ manque côté backend.

## Synthèse

Sur **40 exigences**, **15 sont couvertes, 13 partielles et 12 absentes**.

- La **marketplace** (§4.4) et le **parrainage** sont presque complets : toutes les routes documentées sont branchées.
- Les manques se concentrent sur **la seconde moitié du parcours d'expédition**, après l'enregistrement : enlèvement à domicile, suivi par étape, choix et offres de livraison, preuves, évaluation, paiement et factures. L'app a déjà des écrans pour une partie de ces fonctions (suivi, factures), mais ils sont **désactivés** (`config/features.js`) parce que leurs routes n'existent pas.
- **4 points sont réalisables sans backend** : notifications push, statut détaillé et frise de suivi, WhatsApp vers l'agence depuis une expédition, temps réel marketplace (voir [Faisable sans backend](#faisable-sans-backend)).

| Domaine | Exigences | Couvert | Partiel | Absent |
|---|---|---|---|---|
| 4.1 Authentification et profil | 3 | 2 | 1 | 0 |
| 4.2 Expédition Interville | 11 | 2 | 4 | 5 |
| 4.3 Expédition Extraville | 11 | 3 | 4 | 4 |
| 4.4 Marketplace | 9 | 6 | 2 | 1 |
| 4.5 Autres fonctionnalités | 6 | 2 | 2 | 2 |
| **Total** | **40** | **15** | **13** | **12** |

---

## Couverture exigence par exigence

### 4.1 Authentification et profil

| # | Exigence | Statut | Ce que fait l'app | Bloqué par |
|---|---|---|---|---|
| 1 | Navigation libre sans inscription (mode invité) | Couvert | Devis, catalogue et agences accessibles sans compte | — |
| 2 | Inscription / connexion avec vérification **WhatsApp**, demandée seulement au moment d'une action majeure | Partiel | Le moment est respecté (`useRequireAuth` à la validation d'une expédition ou d'une commande). La vérification se fait **par email**, pas par WhatsApp | API : vérification WhatsApp annoncée comme chantier futur |
| 3 | Profil utilisateur | Couvert | Modifier le profil, mot de passe, adresses favorites, photo, suppression du compte | — |

### 4.2 Expédition — Mode Interville

| # | Exigence | Statut | Ce que fait l'app | Bloqué par |
|---|---|---|---|---|
| 4 | Estimation du coût (ville de destination, poids, taille) | Couvert | `simulate-interville` : commune, poids, format, dimensions, emballage | — |
| 5 | Formulaire intelligent avec **photo du colis** | Partiel | Formulaire en 4 étapes, multi-colis, contacts préremplis. Pas de photo | API : aucun champ photo sur `store` |
| 6 | Choix de l'agence de départ (l'agence choisit ensuite l'agence d'arrivée) | Couvert | Sélecteur d'agence ; le choix de l'arrivée revient à l'agence | — |
| 7 | Planification d'un **enlèvement à domicile** | Absent | Aucune option : le client dépose le colis en agence | API : pas de champ ni de créneau d'enlèvement à la création |
| 8 | Suivi de l'acheminement avec **notifications à chaque étape** | Partiel | Le détail affiche « En cours » pour 8 statuts intermédiaires distincts. L'écran de suivi existe mais est désactivé. Toasts temps réel seulement app ouverte, aucun push | App : statut détaillé et push. API : dates par étape |
| 9 | Choix entre **retrait en agence ou livraison à domicile** | Absent | Rien en Interville (le cahier place ce choix à l'arrivée, workflow 8.1 étape 7) | API : aucune route de choix à l'arrivée |
| 10 | Réception des **offres de prix des livreurs** et sélection | Absent | Écran non branché ; appelle des routes devinées (`/expeditions/{id}/offres/...`) | API : pas de liste d'offres client (seule l'acceptation est citée dans `PARCOURS_LIVREUR_API.md` §4.5) |
| 11 | Réception des **preuves de livraison** (photo + signature) et validation par code | Absent | Rien d'affiché ; le code de réception n'est pas montré au destinataire | API : preuves (`PreuveMission`) et code non exposés au client |
| 12 | **Évaluation** du service | Absent | Étoiles dans l'écran de suivi désactivé, route devinée | API : aucune route d'évaluation |
| 13 | **Paiement** mobile money (Orange, MTN, Wave) ou à la livraison | Partiel | Statut « Payé / Non payé » affiché. Aucun paiement dans l'app : le paiement se fait de fait à la livraison ou en agence | API : aucune passerelle |
| 14 | **Factures PDF** et historique des expéditions | Partiel | Historique complet (filtres, statistiques, annulation). Page Factures désactivée | API : route de facture non documentée |

### 4.3 Expédition — Mode Extraville

| # | Exigence | Statut | Ce que fait l'app | Bloqué par |
|---|---|---|---|---|
| 15 | Estimation (pays/ville, poids, taille) | Couvert | `pays-disponibles` puis `devis`, par type de service | — |
| 16 | Formulaire avec **photo du colis** | Partiel | Formulaire complet avec contenu des colis (produits). Pas de photo | API : aucun champ photo |
| 17 | Choix de l'agence de départ dans le pays d'origine | Couvert | Sélecteur d'agence filtré par pays | — |
| 18 | Planification d'un **enlèvement à domicile** | Absent | Aucune option | API |
| 19 | Suivi à **chaque étape du transit international** | Partiel | Même limite qu'au #8 : statut agrégé « En cours » (départ, transit, arrivée confondus) | App : statut détaillé. API : dates par étape |
| 20 | Choix **retrait sur place ou livraison à domicile** dans le pays d'arrivée | Couvert | Choisi à la création (mode `livraison_domicile` ou `recuperation_agence`) | — (le cahier le place à l'arrivée, workflow 8.2 étape 8 : à confirmer) |
| 21 | Offres de prix des **livreurs locaux** | Absent | Idem #10 | API |
| 22 | Preuves de livraison et validation par code | Absent | Idem #11 | API |
| 23 | Évaluation du service | Absent | Idem #12 | API |
| 24 | Paiement mobile money ou à la livraison | Partiel | Idem #13 | API |
| 25 | Factures PDF et historique | Partiel | Idem #14 | API |

### 4.4 Espace Marketplace

| # | Exigence | Statut | Ce que fait l'app | Bloqué par |
|---|---|---|---|---|
| 26 | Enregistrement de produits à vendre (photos, description, prix) | Couvert | Création et modification d'annonces, photos | — |
| 27 | Espace de vente dédié | Couvert | Catalogue, fiche produit, favoris | — |
| 28 | Gestion des articles publiés et des ventes en cours | Couvert | Mes annonces (publier / dépublier), mes ventes | — |
| 29 | Achat : **panier et paiement en ligne** | Partiel | Panier multi-vendeurs ✔. Paiement **déclaratif** (l'acheteur paie hors app puis le déclare, le vendeur confirme). **Aucune adresse de livraison** n'est demandée à la commande | API : passerelle de paiement ; adresse de livraison (voir `DEMANDES_BACKEND_LIVREUR.md` B1) |
| 30 | Suivi par le vendeur de l'état de ses livraisons | Couvert | Détail de vente avec statut de livraison | — (temps réel : voir workflow 8.4 étape 9) |
| 31 | Choix du mode de livraison : réseau, affectation directe, hors plateforme | Couvert | Les 3 modes | — |
| 32 | Réception et sélection des offres des livreurs (mode réseau) | Couvert | Liste des offres, acceptation | — |
| 33 | **Bascule automatique vers l'Interville** si la livraison implique deux villes | Absent | Rien | API : comportement non documenté, à confirmer |
| 34 | Paiement de l'**abonnement** via mobile money dans l'espace vendeur | Partiel | Déclaration d'un paiement fait hors app, suivi des échéances, bandeau de rappel, blocage géré | API : aucune passerelle |

### 4.5 Autres fonctionnalités

| # | Exigence | Statut | Ce que fait l'app | Bloqué par |
|---|---|---|---|---|
| 35 | Parrainage par code avec bonus au parrain | Couvert | Code, partage, solde, historique, filleuls (bonus crédité côté serveur) | — |
| 36 | **Chat WhatsApp** avec l'agence de départ et l'agence d'arrivée | Partiel | Bouton WhatsApp sur la fiche agence uniquement. Rien depuis une expédition. Le lien « support » du Profil pointe vers `https://wa.me/message` (lien factice) | App : bouton agence de départ. API : agence d'arrivée non exposée |
| 37 | **Notifications push** (annonces, nouveautés, statuts de commande) | Absent | Aucun abonnement Web Push | **App** : `/push/public-key` et `/push/subscribe` sont documentés et inutilisés. API : envois côté client à confirmer |
| 38 | **Paiement intégré** dans l'application | Absent | Rien | API : passerelle mobile money (§7.12) |
| 39 | Liste des agences et de leurs informations | Couvert | Liste, recherche, carte, fiche détaillée | — |
| 40 | **Géolocalisation** | Partiel | Position et carte pour trouver une agence. Non utilisée pour les adresses d'expédition | API : pas de coordonnées sur les adresses (voir B5 côté livreur) |

---

## Workflows de la section 8 (étapes du client)

| Workflow | Étape | Attendu | Dans l'app |
|---|---|---|---|
| 8.1 Interville | 1 | Estimation, ville de destination, agence de départ, sans compte | Couvert |
| 8.1 Interville | 2 | Authentification **par SMS** à la validation | Partiel : par email |
| 8.1 Interville | 4, 6 | Client notifié du départ, destinataire notifié de l'arrivée | Partiel : toast app ouverte, pas de push ; un destinataire sans compte n'est pas notifié |
| 8.1 Interville | 7 | Le destinataire choisit retrait ou livraison à domicile | Absent |
| 8.1 Interville | 9 | Facture disponible dans l'espace client | Absent |
| 8.2 Extraville | 2 | Authentification **par WhatsApp** | Partiel : par email |
| 8.2 Extraville | 4, 7 | Notifications départ international et arrivée | Partiel : idem 8.1 |
| 8.2 Extraville | 8 | Choix retrait ou domicile à l'arrivée | Partiel : choisi à la création |
| 8.2 Extraville | 10 | Facture disponible | Absent |
| 8.3 Livraison à domicile | 3 | Le destinataire reçoit les offres et choisit un livreur | Absent |
| 8.3 Livraison à domicile | 6, 7 | Le destinataire reçoit un code et le donne au livreur | Absent : code non affiché dans l'app |
| 8.4 Marketplace | 3 | Panier et paiement en ligne | Partiel : paiement déclaratif |
| 8.4 Marketplace | 5, 6 | Choix du mode de livraison, sélection d'une offre | Couvert |
| 8.4 Marketplace | 9 | Le vendeur suit sa livraison **en temps réel** | Partiel : à jour au rechargement ; les événements marketplace ne sont pas écoutés |
| 8.5 Parrainage | 1 → 4 | Partage du code, inscription du filleul, bonus | Couvert |
| 8.6 Abonnement | 2 | Notification 2 jours avant l'échéance | Partiel : bandeau dans l'app, pas de push |
| 8.6 Abonnement | 3 | Règlement via mobile money dans l'app | Partiel : déclaration |
| 8.6 Abonnement | 5 | Blocage après l'échéance | Couvert |

---

## Faisable sans backend

| Priorité | Amélioration | Exigences | Ce qu'il faut faire |
|---|---|---|---|
| 1 | **Notifications push** | #37, 8.1 étapes 4 et 6, 8.6 étape 2 | Activer l'abonnement Web Push avec les routes documentées (`/push/public-key`, `/push/subscribe`, `/push/unsubscribe`) et un réglage dans le Profil. L'app livreur a déjà un service réutilisable (`pushService.js`, `usePushSubscription`). Confirmer avec le backend quels événements client déclenchent un push |
| 2 | **Statut détaillé et frise de suivi** | #8, #19 | Remplacer « En cours » par le libellé précis des 8 statuts intermédiaires (`en_cours_enlevement` … `en_cours_livraison`) et afficher une frise d'étapes dans le détail d'expédition, à partir de `statut_expedition` et des dates déjà renvoyées par `show` |
| 3 | **WhatsApp vers l'agence de départ depuis une expédition** | #36 | Bouton « Discuter avec l'agence » dans le détail d'expédition (agence chargée par `show`), même lien que la fiche agence. Remplacer le lien factice `wa.me/message` du Profil par le vrai numéro du support, ou le retirer |
| 4 | **Temps réel marketplace** | 8.4 étape 9 | Écouter les événements `CommandeMarketplace` / `LivraisonMarketplace` (comme l'app livreur) pour rafraîchir commandes et ventes. Confirmer avec le backend les événements émis côté client |

---

## Demandes à faire au backend

Classées par impact sur le parcours client. Le détail de contrat (routes, champs, critères) reste à rédiger, comme pour `livreur-app/DEMANDES_BACKEND_LIVREUR.md`.

**État au 2026-10-04** — après vérification du code existant, plusieurs points étaient déjà couverts côté backend (juste non exposés/documentés) ; les autres ont été traités dans cette session.

1. ~~**Offres de livraison à domicile côté client**~~ — déjà couvert : `GET` et `POST expedition/client/missions/{missionId}/offres...` existent et sont bien pensés côté client (namespace `Api\Client\MissionOffreController`). Le missionId se retrouve désormais via la nouvelle route `GET expedition/client/{id}/missions`.
2. **Choix retrait ou livraison à domicile à l'arrivée** (#9, 8.1 étape 7) : `POST expedition/client/{id}/demander-livraison` permet déjà au client expéditeur de déclencher la livraison à domicile après coup. **Reste un vrai trou** : rien ne permet à un destinataire sans compte client de faire ce choix lui-même (pas de lien/token public).
3. ✅ **Fait** — Code de réception et preuves de livraison (#11, #22, 8.3 étapes 6–7) : le code `code_validation_reception` est désormais envoyé par SMS/email au destinataire dès l'assignation du livreur (événement `code_livraison_domicile`, même pattern que `otp_pickup`). Nouvelle route `GET expedition/client/{id}/missions` exposant les missions et leur `PreuveMission` (photo, signature, géolocalisation, horodatage) une fois l'étape réalisée.
4. **Suivi par étape** (#8, #19) : déjà couvert, aucune action nécessaire — les dates par jalon (`date_prevue_enlevement`, `date_enlevement_client`, etc.) existent déjà sur `Expedition` et sont déjà renvoyées par `show`/`list`. Le frontend peut construire sa frise directement avec ces champs.
5. ✅ **Fait** — Enlèvement à domicile (#7, #18) : la logique (route, champs, mission) existait déjà mais uniquement comme action séparée après l'enregistrement. Le choix est désormais intégrable directement dans `POST expedition/client/store` (modes `livraison_domicile`/`interville`) via des champs optionnels `enlevement_domicile`/`enlevement_mode`/`enlevement_distance_km`/`enlevement_type_vehicule` — la Mission d'enlèvement est créée dans la foulée de l'expédition. Non branché sur le mode `recuperation_agence` (plusieurs expéditions possibles par requête, design à trancher si besoin). L'ancienne route `POST /{id}/demander-enlevement` reste disponible pour un choix fait après coup.
6. ✅ **Fait** — Factures PDF (#14, #25, 8.1 étape 9) : nouvelles routes `GET expedition/client/factures` (liste) et `GET expedition/client/factures/{id}/download` (PDF), réutilisent `FactureGenerator` déjà utilisé côté agence.
7. ✅ **Fait** — Évaluation (#12, #23) : nouveau modèle `EvaluationExpedition` (note 1-5 + commentaire optionnel), routes `GET`/`POST expedition/client/{id}/evaluation`. Possible uniquement une fois l'expédition `TERMINED`, une seule évaluation par expédition.
8. ✅ **Fait** — Photo du colis (#5, #16) : upload branché sur les formulaires Interville et Livraison à domicile (`colis.*.photo`, image max 5 Mo), accessor `photo_url` ajouté sur `Colis`. Non branché sur le mode groupage/agence (agrégation par catégorie, pas de colis unitaire soumis par le client).
9. **Adresse de livraison marketplace** (#29) : déjà fait (B1 dans `DEMANDES_BACKEND_LIVREUR.md`), confirmé en base (colonnes snapshot sur `commandes_marketplace`/`annonces_marketplace`).
10. **Paiement mobile money intégré** (#13, #24, #29, #34, #38) : confirmé 100% déclaratif aujourd'hui (aucune passerelle dans `composer.json`). Chantier plateforme commun (B9 côté livreur), pas engagé.
11. **Vérification par WhatsApp ou SMS** (#2, 8.1 étape 2, 8.2 étape 2) : chantier annoncé comme futur. Le service SMS (`BrevoSmsGateway`) existe déjà et fonctionne pour les notifications colis — le brancher sur l'inscription serait une réutilisation, pas une intégration from scratch. WhatsApp Business resterait entièrement à construire.
12. **Bascule interville marketplace** (#33) : confirmé non implémenté, système marketplace totalement découplé du système Expedition. Question produit non tranchée avant tout code — voir Q1 (mis à jour) dans `DEMANDES_BACKEND_LIVREUR.md` pour les décisions à prendre.

---

## Défauts relevés pendant l'audit

| Fichier | Constat |
|---|---|
| `src/pages/Profile/ProfilePage.jsx` | Le lien d'aide WhatsApp pointe vers `https://wa.me/message`, qui n'ouvre aucune conversation |
| `src/services/expeditionService.js` | `console.log` des payloads et réponses de `simulateInterville`, `getDevis` et `storeExpedition` : noms, téléphones et adresses apparaissent dans la console en production |
| `src/pages/Expedition/TrackingPage.jsx`, `src/pages/Profile/InvoicesPage.jsx` | Écrans désactivés qui appellent des routes devinées (`/expeditions/{id}`, `/expeditions/{id}/facture`, etc.) : à réécrire sur les vraies routes avant de les réactiver |
| `src/hooks/useRealtimeUpdates.js` | Événements marketplace non gérés ; les autres affichent un toast générique sans rafraîchir la page ouverte |
