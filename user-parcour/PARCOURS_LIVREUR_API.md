# Parcours Livreur — Documentation API

Ce document décrit le parcours complet du livreur pour l'application mobile livreur (développée par une équipe externe) : inscription/onboarding, missions d'expédition classiques (Interville/International, enlèvement et livraison à domicile), rôle du livreur dans le module Marketplace, et notifications reçues à chaque étape.

Toutes les routes sont préfixées par l'URL de base de l'API et nécessitent un token Sanctum (`Authorization: Bearer {token}`), sauf mention contraire. Toutes les réponses sont au format JSON avec une enveloppe `{"success": bool, ...}`.

---

## Sommaire

- [1. Inscription self-service avec vérification KYC](#1-inscription-self-service-avec-vérification-kyc)
- [2. Authentification et session](#2-authentification-et-session)
- [3. Profil, véhicule et disponibilité](#3-profil-véhicule-et-disponibilité)
- [4. Missions d'expédition classiques](#4-missions-dexpédition-classiques)
  - 4.1bis Accepter ou refuser une mission groupage proposée
  - 4.6 Notes libres du livreur sur une mission
  - 4.8 Statistiques personnelles
- [5. Rôle du livreur dans le Marketplace](#5-rôle-du-livreur-dans-le-marketplace)
- [6. Abonnement marketplace côté livreur](#6-abonnement-marketplace-côté-livreur)
- [7. Notifications (WebSocket, push, email)](#7-notifications-websocket-push-email)
  - 7.3 Historique persisté des notifications
- [8. Workflows complets](#8-workflows-complets)
- [9. Codes d'erreur et cas particuliers](#9-codes-derreur-et-cas-particuliers)

---

## 1. Inscription self-service avec vérification KYC

Un livreur peut désormais s'inscrire lui-même depuis l'app mobile, sans passer par le backoffice. Le compte reste **inactif** tant que le backoffice n'a pas validé ses documents.

### POST `/register-livreur` (hors authentification)

**Corps (`multipart/form-data`, obligatoire à cause des fichiers)**

| Champ | Type | Requis | Détail |
|---|---|---|---|
| `nom` | string | oui | |
| `prenoms` | string | non | |
| `telephone` | string | oui | unique |
| `indicatif_telephone` | string | oui | max 6, regex stricte `/^\+[0-9]{1,5}$/` (ex. `+225`, `+33`) |
| `whatsapp_number` | string | **oui** | format E.164 strict, regex `/^\+[1-9]\d{6,14}$/` (ex. `+2250700000000`) — distinct de `telephone`/`indicatif_telephone`, pas éditable ensuite via `PUT /profile/update` |
| `email` | string | oui | unique |
| `password` | string | oui | min 8, avec `password_confirmation` |
| `code_pays` | string | oui | résout le backoffice de rattachement (`Backoffice.code_pays`, actif) |
| `type_piece_identite` | string | oui | `cni`, `passeport` ou `permis_conduire` |
| `numero_piece_identite` | string | oui | max 100 |
| `piece_identite` | fichier image | oui | jpeg/png/jpg/webp, max 5 Mo |
| `photo_profil` | fichier image | non | jpeg/png/jpg/webp, max 5 Mo |
| `type_vehicule` | string | oui | `moto` ou `voiture` |
| `numero_vehicule` | string | non | |
| `permis_de_conduire` | string | non | numéro, texte libre |
| `zone_de_livraison_km` | numérique | non | rayon en km, utilisé pour le filtrage géographique des missions disponibles (voir 4.5/5) |
| `ville` | string | **oui** | ville d'exercice, utilisée pour filtrer les missions/livraisons disponibles par zone géographique |

**Réponse 201**
```json
{
  "success": true,
  "message": "Inscription reçue. Vérifiez votre email, votre compte sera activé après validation de vos documents par notre équipe.",
  "user": { "id": "uuid", "nom": "Yao", "telephone": "+2250700000000", "email": "paul@example.com", "type": "livreur", "actif": false },
  "livreur": { "id": "uuid", "statut_validation": "en_attente", "type_vehicule": "moto", "...": "..." }
}
```

**Erreurs**
| Cas | Code | Corps |
|---|---|---|
| Aucun backoffice actif pour `code_pays` | 404 | `{ "success": false, "message": "Aucun backoffice actif pour ce pays." }` |
| Échec upload pièce d'identité | 500 | `{ "success": false, "message": "Erreur lors de l'upload de la pièce d'identité." }` |
| Validation (téléphone/email déjà pris, fichier invalide, etc.) | 422 | `{ "success": false, "message": "Erreur de validation des données.", "errors": {...} }` |

### Vérification email

Un code de vérification est envoyé automatiquement à l'inscription — même mécanisme que pour les autres types de compte : `POST /verify-email { "email": "...", "code": "123456" }`.

⚠️ **Chantier futur, hors scope de cette version** : la vérification passera aussi par WhatsApp Business en parallèle de l'email pour tous les acteurs (client, agence, backoffice, livreur), pas seulement le livreur. Non implémenté à ce jour.

### Validation des documents par le backoffice

Le compte reste `actif: false` — **la connexion échoue** (`Votre compte est désactivé.`) tant que le backoffice n'a pas validé.

**GET `/backoffice/livreurs-en-attente`** (session backoffice, permission `livreurs.view`)
Liste les livreurs de statut `en_attente` rattachés au backoffice connecté, avec leur `user` chargé.

**POST `/backoffice/livreurs/{livreur}/valider`** (permission `livreurs.edit`)
Passe `statut_validation` à `valide`, renseigne `valide_par_id`/`valide_le`, et **active le compte** (`user.actif = true`). Le livreur peut alors se connecter.

**POST `/backoffice/livreurs/{livreur}/rejeter`** (permission `livreurs.edit`)
Corps `{ "commentaire": "document illisible" }` (optionnel). Passe `statut_validation` à `rejete`, renseigne `commentaire_rejet`. Le compte reste inactif — le livreur doit être informé hors app pour corriger et être réinscrit ou recontacté (aucune route de resoumission dédiée à ce jour).

**Notification de validation/rejet (mise à jour)** : contrairement à ce qu'on pourrait croire, le backoffice déclenche désormais une notification à chaque décision — `InscriptionLivreurValideePushNotification` (validation) / `InscriptionLivreurRejeteePushNotification` (rejet, avec le `commentaire` dans le message). Chacune part sur deux canaux : `WebPushChannel` (push navigateur/app) et `database` (persistée, lisible via `GET /livreur/notifications`, voir section 7.3). **Limite réelle** : tant que le compte est inactif, le livreur n'a jamais pu se connecter ni s'abonner au WebPush (aucun token obtenu à l'inscription) — le push ne peut donc atteindre personne à cet instant précis. Le canal `database` reste cependant écrit en base et devient visible dès la première connexion réussie après validation.

**Conséquence pour l'app mobile** : après l'inscription, afficher un écran d'attente ("vos documents sont en cours de vérification") ; retenter `POST /login` régulièrement ou attendre un contact du backoffice. Dans la pratique, seule une tentative de connexion (ou un contact hors app) révèle le résultat de la vérification — le push n'a aucune chance d'être reçu avant la première connexion réussie.

---

## 2. Authentification et session

Le livreur utilise le **même `AuthController`** que tous les autres types d'utilisateurs (client, agence, backoffice) — aucun flux dédié.

### POST `/login`

**Corps**
| Champ | Type | Requis |
|---|---|---|
| `telephone` | string | oui si `email` absent |
| `email` | string | oui si `telephone` absent |
| `password` | string | oui |
| `type` | string | oui, doit valoir `"livreur"` |

**Réponse 200**
```json
{
  "success": true,
  "message": "Connexion réussie",
  "user": {
    "id": "uuid",
    "nom": "Yao",
    "prenoms": "Paul",
    "telephone": "+2250700000000",
    "email": "paul@example.com",
    "type": "livreur",
    "backoffice_id": null,
    "actif": true,
    "disponible": true
  },
  "token": "..."
}
```
⚠️ **Le compte `Livreur` (véhicule, backoffice, statut) n'est jamais renvoyé dans la réponse de login** — seul l'objet `User` brut. `backoffice_id` sur `User` est généralement `null` pour un livreur (le rattachement au backoffice se fait via `livreurs.backoffice_id`, pas sur `User`). Le token créé porte le libellé `livreur_token_tour_shop`. Pour récupérer la fiche `Livreur` complète (véhicule, statut de validation, pièce d'identité), appeler `GET /livreur/profil` juste après (section 3).

**Erreurs**
| Cas | Code | Corps |
|---|---|---|
| Identifiants incorrects | 422 | `{ "success": false, "errors": { "auth": ["Les identifiants fournis sont incorrects."] } }` |
| Trop de tentatives (5 échecs → 10 min de blocage) | 422 | `{ "success": false, "errors": { "auth": ["Trop de tentatives échouées. Réessayez dans X minute(s)."] } }` |
| Compte désactivé | 422 | `{ "success": false, "errors": { "account": ["Votre compte est désactivé."] } }` |
| Email non vérifié | 422 | `{ "success": false, "errors": { "email": ["Veuillez vérifier votre adresse email avant de vous connecter."] } }` |

### POST `/logout`

Révoque le token courant. Réponse `{ "success": true, "message": "Déconnexion réussie." }`.

### GET `/profil`

Retourne le `User` connecté (même limite que le login : pas de fiche `Livreur`).

---

## 3. Profil, véhicule et disponibilité

### GET `/livreur/profil` (nouveau)

Retourne le `User` connecté avec sa fiche `Livreur` chargée (véhicule, statut de validation, pièce d'identité, backoffice de rattachement).

**Réponse 200**
```json
{
  "success": true,
  "user": {
    "id": "uuid", "nom": "Yao", "prenoms": "Paul", "telephone": "+2250700000000", "email": "paul@example.com",
    "type": "livreur", "actif": true, "disponible": true, "solde_livreur": "12500.00",
    "livreur": {
      "id": "uuid", "backoffice_id": "uuid", "type_vehicule": "moto", "numero_vehicule": "AB-1234-CI",
      "permis_de_conduire": "P123456", "zone_de_livraison_km": 15, "statut": "disponible",
      "statut_validation": "valide", "nom_piece_identite": "cni", "numero_piece_identite": "CI0012345",
      "piece_identite_url": "https://.../pieces-identite/....jpg",
      "photo_profil_url": "https://.../photos-profil/....jpg",
      "valide_le": "2026-09-27T10:00:00.000000Z", "commentaire_rejet": null
    }
  }
}
```

### PUT `/livreur/vehicule` (nouveau)

Le livreur modifie lui-même ses informations de véhicule — auparavant réservé au backoffice.

**Corps** (tous les champs optionnels, `sometimes`) : `type_vehicule` (`moto`/`voiture`), `numero_vehicule`, `permis_de_conduire`, `zone_de_livraison_km`, `ville`.

**Réponse 200** : `{ "success": true, "message": "Véhicule mis à jour.", "livreur": {...} }`. Ne touche pas au statut de validation (ce n'est pas un document d'identité, aucune re-vérification requise).

### Routes génériques (`/profile/*`, tous types d'utilisateurs)

**GET `/profile/`** — retourne `user.toArray()`, sans la relation `Livreur` (préférer `GET /livreur/profil` ci-dessus).

**PUT `/profile/update`** — modifiable : `nom`, `prenoms`, `telephone`, `indicatif_telephone`, `email` (redemande une vérification si changé). `code_pays` est interdit pour un livreur (réservé au client).

**PUT `/profile/change-password`** — corps `{ "current_password": "...", "password": "...", "password_confirmation": "..." }`. Révoque tous les tokens existants après changement (déconnexion forcée de tous les appareils).

**PUT `/profile/avatar`** — corps `{ "avatar": "url" }` — attend une URL déjà uploadée ailleurs, pas un upload de fichier binaire direct.

### PUT `/profile/availability` — disponibilité déclarative

**Corps** : `{ "disponible": true }` (ou `false`)

**Réponse 200**
```json
{ "success": true, "message": "Vous êtes maintenant disponible.", "disponible": true }
```

Ce flag a désormais un effet réel sur l'assignation de missions (contrairement à avant) :

| Champ | Portée | Modifiable via API ? | Utilisé pour quoi ? |
|---|---|---|---|
| `livreurs.statut` (`disponible`/`en_service`/`en_pause`/`hors_service`) | Table `Livreur` | Non — aucune route ne le modifie | Rien actuellement (indicateur déclaratif réservé à un usage futur, ex. congé) |
| `users.disponible` (booléen) | Table `User` | Oui, via `PUT /profile/availability` | **Bloque désormais** la proposition d'offre express et l'assignation groupage si `false` (voir 4.1 et 4.5) |
| **Absence de mission `ASSIGNEE` en cours** | Calculé (`Livreur::estDisponible()`) | Non — déduit automatiquement | Contrainte dure supplémentaire : un livreur ne peut jamais avoir 2 missions actives |

**En clair** : passer `disponible: false` empêche désormais de proposer une offre express (422) et empêche le backoffice d'assigner ce livreur en mode groupage (422). Un livreur qui veut se retirer temporairement du réseau doit appeler cette route avant de couper l'app.

---

## 4. Missions d'expédition classiques

Ce système gère les étapes de **dernier kilomètre** (enlèvement chez l'expéditeur, livraison chez le destinataire) pour les expéditions Interville et internationales (Groupage Afrique/DHD/CA, tous types sauf `LD` qui n'a pas de mission de livraison). Il est **totalement distinct** du module Marketplace (vente entre clients) décrit en section 5 — ne pas confondre `MissionMarketplaceController` (nom historique trompeur) avec le vrai module Marketplace.

### 4.1 Deux modes d'assignation

| Mode | Comment | Concerne |
|---|---|---|
| `GROUPAGE` | Le backoffice assigne manuellement un livreur qui lui est rattaché (`livreurs.backoffice_id`), tarif fixe résolu par une grille de tranches kilométriques. **La mission passe `proposee`, pas `assignee`** — le livreur doit l'accepter ou la refuser (voir 4.1bis). | Réservé au backoffice pour la proposition, le livreur décide ensuite. **Bloqué (422) si le livreur ciblé a `disponible = false`.** |
| `EXPRESS` | Diffusée à tous les livreurs indépendants (réseau), qui proposent un prix ; le client compare et choisit. Dès que le client accepte une offre, la mission passe directement `assignee` (l'offre du livreur valait déjà son accord, pas de palier supplémentaire). | Le livreur propose une offre via les routes 4.5. **Bloqué (422) si le livreur a `disponible = false`.** |

⚠️ "Groupage" ici désigne le **mode d'assignation** (manuel vs offres), sans rapport avec `TypeExpedition::GROUPAGE_*` (type d'expédition). Les deux notions sont indépendantes.

### 4.1bis Accepter ou refuser une mission groupage proposée (nouveau)

Quand le backoffice assigne manuellement un livreur en mode groupage, la mission passe au statut **`proposee`** (pas `assignee`) avec un délai d'acceptation de **15 minutes** (`expire_le`). Le livreur doit explicitement accepter ou refuser — contrairement au mode express où son offre vaut déjà accord.

**POST `/expedition/livreur/missions/{missionId}/accepter`**

Passe la mission en `assignee`, génère le code de validation de réception (si livraison) et répercute l'assignation sur l'expédition.

**Réponse 200**
```json
{ "success": true, "message": "Mission acceptée.", "mission": { "id": "uuid", "statut": "assignee", "acceptee_le": "2026-10-02T10:05:00.000000Z", "...": "..." } }
```

**Erreurs** (dans cet ordre de vérification)
| Cas | Code | Message |
|---|---|---|
| Mission pas `proposee` à ce livreur | 404 | `Mission non trouvée.` |
| Délai dépassé (`expire_le` passé) | 422 | `Cette proposition a expiré.` |
| `users.disponible = false` | 422 | `Vous devez être disponible pour accepter une mission.` |
| Le livreur a déjà une autre mission `assignee` en cours | 422 | `Vous avez déjà une mission en cours.` |

**POST `/expedition/livreur/missions/{missionId}/refuser`**

Corps : `{ "motif": "Trop loin de ma position" }` (`motif` optionnel, max 255).

Remet la mission en `en_attente` sans livreur (`livreur_id = null`) — elle retourne dans la file du backoffice qui réassignera manuellement à un autre livreur. **Pas de republication automatique en mode express.**

**Réponse 200** : `{ "success": true, "message": "Mission refusée." }`

**Expiration automatique** : si le livreur ne répond pas dans les 15 minutes, une tâche planifiée serveur (`missions:expire-propositions`, exécutée chaque minute) traite la mission exactement comme un refus (`motif_refus = "Expiré"`), sans action de l'app.

**Conséquence pour l'app mobile** : afficher les missions `proposee` avec un compte à rebours basé sur `expire_le`, et deux boutons Accepter/Refuser. Une mission qui disparaît de la liste sans action explicite de l'utilisateur a probablement expiré côté serveur.

### 4.2 GET `/expedition/livreur/missions`

Liste paginée (20/page) des missions du livreur connecté, **y compris celles `proposee`** (en attente de son accord) sans filtre explicite.

**Query** : `statut` (optionnel — `proposee`, `assignee`, `refusee`, `expiree`, `terminee`, `annulee`)

**Réponse 200**
```json
{
  "success": true,
  "missions": {
    "data": [
      {
        "id": "uuid",
        "expedition_id": "uuid",
        "type": "enlevement",
        "mode": "express",
        "statut": "assignee",
        "montant_final": 1500,
        "proposee_le": null,
        "expire_le": null,
        "acceptee_le": null,
        "assignee_le": "2026-09-27T09:00:00.000000Z",
        "statut_paiement": "en_attente",
        "expedition": {
          "id": "uuid", "reference": "TSH-XXXX",
          "expediteur": { "nom_prenom": "...", "ville": "Abidjan", "...": "..." },
          "expediteur_latitude": 5.3599, "expediteur_longitude": -3.9870,
          "destinataire": { "nom_prenom": "...", "ville": "Abidjan", "...": "..." },
          "destinataire_latitude": 5.2970, "destinataire_longitude": -3.9960,
          "instructions_enlevement": "Sonner au portail bleu", "instructions_livraison": null,
          "agence": { "id": "uuid", "nom_agence": "...", "latitude": 5.32, "longitude": -4.017 },
          "agenceArrivee": null
        }
      }
    ],
    "current_page": 1, "last_page": 1, "total": 3
  }
}
```
`type` : `enlevement` (chez l'expéditeur) ou `livraison` (chez le destinataire) — jamais les deux sur une même mission.

**Nouveau — coordonnées GPS et instructions** : `expediteur_latitude`/`longitude` et `destinataire_latitude`/`longitude` (nullable, renseignées si le client les a fournies à la création de l'expédition) permettent une navigation GPS directe sans recherche d'adresse textuelle. `instructions_enlevement`/`instructions_livraison` (texte libre, nullable) sont saisies par l'expéditeur/destinataire à la création — lecture seule pour le livreur, à afficher avant l'étape correspondante. `agence`/`agenceArrivee` incluent désormais `latitude`/`longitude` quand disponibles.

### 4.3 Cycle de vie — Enlèvement

```
POST /expedition/livreur/enlevement/{expeditionId}/start
```
Vérifie qu'une mission ENLEVEMENT `assignee` existe pour cette expédition et ce livreur. Passe `Expedition.statut_expedition` à `en_cours_enlevement`.

```
POST /expedition/livreur/enlevement/{expeditionId}/confirm
```
Le livreur confirme avoir récupéré le colis chez l'expéditeur. Fixe `date_enlevement_client = now()`.

**Corps (optionnel, preuve structurée — nouveau)** :
| Champ | Type | Requis |
|---|---|---|
| `photo` | fichier image (jpeg/png/jpg/webp, max 5 Mo) | non |
| `signature` | string (base64) | non |
| `latitude` | numérique (-90 à 90) | non |
| `longitude` | numérique (-180 à 180) | non |

Si au moins un de ces champs est fourni, une `PreuveMission` est créée/mise à jour avec `horodatage = now()`. Tous restent facultatifs pour ne pas casser l'existant, mais **fortement recommandés** pour tracer la récupération chez l'expéditeur.

```
POST /expedition/livreur/reception-agence/{expeditionId}/confirm
```
Le livreur confirme avoir déposé le colis à l'agence. Fixe `date_livraison_agence`, `statut_expedition = recu_agence_depart`, **clôture la mission** (`statut = terminee`, `statut_paiement = paye` — le livreur encaisse directement/cash, pas de paiement différé sur ce mode). **Crédite automatiquement le solde du livreur** (voir 4.7).

**Pas de code de validation pour l'enlèvement** — chaque étape est déclarative (le livreur confirme lui-même, aucune saisie de code par un tiers).

### 4.4 Cycle de vie — Livraison à domicile

```
POST /expedition/livreur/livraison/{expeditionId}/start
```
Vérifie qu'une mission LIVRAISON `assignee` existe. Passe `statut_expedition` à `en_cours_livraison`.

```
POST /expedition/livreur/livraison/{expeditionId}/validate
```
**Corps** :
| Champ | Type | Requis |
|---|---|---|
| `code_validation` | string | oui |
| `photo` | fichier image (jpeg/png/jpg/webp, max 5 Mo) | non — preuve structurée, voir 4.3 |
| `signature` | string (base64) | non |
| `latitude` | numérique (-90 à 90) | non |
| `longitude` | numérique (-180 à 180) | non |

Le destinataire communique au livreur un **code à 4 chiffres** (`Expedition.code_validation_reception`, généré automatiquement au moment de l'assignation de la mission). Comparaison stricte :

**Erreur 422 si code incorrect** : `{ "success": false, "message": "Code de réception incorrect" }`

**Réponse 200 si succès** : `statut_expedition = terminee`, `date_reception_client = now()`, le code est effacé (usage unique). Mission → `terminee`/`statut_paiement = paye`. Si `photo`/`signature`/`latitude`/`longitude` fournis, une `PreuveMission` est enregistrée. **Crédite automatiquement le solde du livreur** (voir 4.7).

### 4.5 Mode EXPRESS — offres du livreur

Réservé aux missions **sans livreur rattaché disponible** côté backoffice, ouvertes au réseau.

**GET `/expedition/livreur/missions-disponibles`**
```json
{
  "success": true,
  "missions": [
    { "id": "uuid", "type": "enlevement", "mode": "express", "statut": "en_attente", "expedition": { "id": "uuid", "reference": "...", "pays_depart": "...", "pays_destination": "...", "expediteur": {...}, "destinataire": {...} } }
  ]
}
```

**POST `/expedition/livreur/missions/{missionId}/proposer`**
Corps : `{ "montant_propose": 1500 }` (requis, numérique, ≥ 0). Idempotent : reproposer sur la même mission remplace le montant précédent (pas de doublon) — un livreur ne porte qu'une offre active à la fois par mission.

**Erreur 422 si le livreur n'est pas disponible** (`users.disponible = false`, voir section 3) : `{ "success": false, "message": "Vous devez être disponible pour proposer une offre." }`

**DELETE `/expedition/livreur/missions/{missionId}/offre`**
Retire l'offre active du livreur sur cette mission. 404 si aucune offre active.

**Acceptation côté client** (hors scope livreur, pour contexte) : `POST expedition/client/missions/{missionId}/offres/{offreId}/accepter` — toutes les autres offres actives passent à `refusee`, la mission passe `assignee`, un code de validation est généré si c'est une mission LIVRAISON.

**Filtrage géographique (nouveau)** : la liste ne renvoie par défaut que les missions dont la ville de l'expéditeur (enlèvement) ou du destinataire (livraison) correspond à la `ville` du profil du livreur (section 3). Un livreur sans ville renseignée continue de tout voir (pas de régression). Paramètres optionnels :

| Paramètre | Type | Effet |
|---|---|---|
| `ville` | string | Remplace la ville du profil pour cette requête (livreur en déplacement) |
| `latitude`, `longitude` | numérique | Calcule `distance_km` jusqu'au point de référence de chaque mission, filtre sur `zone_de_livraison_km` du profil, trie par distance croissante |

Chaque mission renvoyée inclut alors `distance_km` (nullable, présent seulement si une position a été fournie et que l'expédition a des coordonnées).

### 4.6 Notes libres du livreur sur une mission (nouveau)

En complément des instructions reçues (lecture seule, voir 4.2), le livreur peut ajouter ses propres notes sur une mission qu'il est en train d'exécuter (ex. "client absent, rappelé à 14h"), visibles par le backoffice et l'agence concernée.

**GET `/expedition/livreur/missions/{missionId}/notes`**
```json
{ "success": true, "notes": [ { "id": "uuid", "contenu": "Client absent, rappelé à 14h", "photo_url": null, "created_at": "..." } ] }
```

**POST `/expedition/livreur/missions/{missionId}/notes`**
Corps (`multipart/form-data` si photo) : `{ "contenu": "...", "photo"?: fichier image }`. `contenu` requis (max 1000). `photo` optionnelle (jpeg/png/jpg/webp, max 5 Mo).

**Réponse 201** : `{ "success": true, "note": { "id": "uuid", "contenu": "...", "photo_url": null, "created_at": "..." } }`

**Erreur 422** si la mission n'est pas `assignee` (ex. déjà `terminee`/`annulee`) : `{ "success": false, "message": "Mission non modifiable." }`

### 4.7 Solde et retrait des gains

Le paiement continue de transiter hors application (cash à la remise/l'enlèvement), mais le livreur dispose maintenant d'un **solde réel consultable** (`users.solde_livreur`), crédité automatiquement à chaque mission clôturée payée (`confirmReceptionAgence` pour un enlèvement, `validateLivraison` pour une livraison). Le crédit est **idempotent** (contrainte unique sur `credits_livreur.mission_id`) : aucun risque de double crédit même en cas de rejeu réseau.

**GET `/livreur/solde`**
```json
{ "success": true, "solde_livreur": 45000.00 }
```

**GET `/livreur/solde/historique`**
Fusion chronologique des crédits (missions payées) et des retraits (demandés/traités), triée par date décroissante, **désormais paginée (20/page)** — `page` en query param.
```json
{
  "success": true,
  "historique": {
    "current_page": 1, "last_page": 3, "total": 45,
    "data": [
      { "type": "credit", "montant": 1500, "date": "2026-09-27T09:00:00.000000Z", "detail": { "id": "uuid", "mission_id": "uuid", "montant": 1500, "mission": {...} } },
      { "type": "retrait", "montant": -20000, "date": "2026-09-26T15:00:00.000000Z", "detail": { "id": "uuid", "montant": 20000, "statut": "traite", "notes": "..." } }
    ]
  }
}
```
`montant` est négatif pour un retrait afin de faciliter le calcul d'un solde courant côté app.

**POST `/livreur/solde/demander-retrait`**
Corps : `{ "montant": 20000, "notes": "Mobile money +2250700000000" }` (`notes` optionnel). Le livreur demande le retrait de ses gains — **le solde n'est pas décrémenté immédiatement**, seulement à la confirmation du backoffice.

**Réponse 201**
```json
{ "success": true, "message": "Demande de retrait enregistrée.", "retrait": { "id": "uuid", "montant": 20000, "statut": "en_attente" } }
```

**Erreur 422 si le montant dépasse le solde disponible** : `{ "success": false, "message": "Le montant dépasse votre solde disponible." }`

**Traitement côté backoffice** (hors scope app mobile, pour contexte) :
- `GET /backoffice/retraits-livreur` — liste filtrable par `livreur_id`/`statut`.
- `POST /backoffice/retraits-livreur/{retrait}/confirmer` — vérifie le solde (verrouillage anti-double-confirmation), décrémente `solde_livreur`, passe `statut = traite`. C'est à ce moment que le backoffice remet réellement l'argent au livreur (hors application, ex. mobile money ou cash), cette route ne fait qu'enregistrer que le paiement a eu lieu.
- `POST /backoffice/retraits-livreur/{retrait}/rejeter` — passe `statut = rejete`, aucun impact sur le solde.

### 4.8 Statistiques personnelles (nouveau)

**GET `/livreur/statistiques?periode=7j|30j|tout`** (défaut `30j`)

```json
{
  "success": true,
  "periode": { "debut": "2026-09-04", "fin": "2026-10-03" },
  "missions": { "terminees": 42, "enlevements": 18, "livraisons": 24, "annulees": 1 },
  "marketplace": { "terminees": 6 },
  "offres": { "proposees": 31, "acceptees": 12, "taux_acceptation": 0.39 },
  "gains": { "total": 105000, "moyenne_par_mission": 2500 },
  "par_jour": [ { "date": "2026-10-01", "missions": 3, "gains": 7500 }, { "date": "2026-10-02", "missions": 0, "gains": 0 } ]
}
```
`par_jour` couvre chaque jour de la période (y compris les jours à zéro) ; absent si `periode=tout` (pas de borne de début). `taux_acceptation` = offres acceptées / offres proposées sur la période, `0` si aucune offre proposée.

---

## 5. Rôle du livreur dans le Marketplace

⚠️ **Cette section renvoie à la doc existante, elle n'est pas dupliquée ici.** Le module Marketplace (vente d'articles entre clients) est un système **entièrement séparé** des missions classiques ci-dessus (modèles différents : `CommandeMarketplace`/`LivraisonMarketplace` vs `Mission`).

Le rôle du livreur dans Marketplace — consulter les livraisons disponibles, proposer une offre, accepter/refuser une affectation directe, démarrer, valider par code avec preuve — est intégralement documenté dans **`tourshop-backend/docs/MARKETPLACE_ET_ABONNEMENT_API.md`, section 7** ("Rôle du livreur dans le module Marketplace").

Points clés à retenir (détails dans la doc citée) :
- Routes sous `/marketplace/livreur/*`.
- **Adresses et contacts complets** (retrait chez le vendeur, livraison chez l'acheteur) désormais disponibles sur une livraison assignée — ville/quartier seulement sur une livraison encore disponible (confidentialité).
- **Affectation directe par le vendeur** : passe par un statut `proposee`, le livreur doit l'accepter ou la refuser avant assignation définitive — même principe que les missions groupage (section 4.1bis).
- **Preuve structurée** (photo, signature, position) au retrait et à la remise.
- **Filtrage géographique** des livraisons disponibles par ville/rayon — même principe que les missions express (section 4.5).
- Le livreur a un solde marketplace informatif (`solde_marketplace`, désormais **accessible via `GET /marketplace/livreur/solde` et `/solde/historique`**) — mais **aucun argent réel ne transite par la plateforme**, l'argent circule toujours hors application. Accessible même bloqué pour abonnement.
- Protégé par le middleware d'abonnement (section suivante) pour les actions actives (proposer/accepter/démarrer/valider) : un livreur en retard de paiement d'abonnement reçoit 403 `ABONNEMENT_BLOQUE` sur ces routes.

---

## 6. Abonnement marketplace côté livreur

⚠️ **Renvoi à la doc existante, section 9** de `MARKETPLACE_ET_ABONNEMENT_API.md` ("Abonnement marketplace") — cycle de vie complet, démarrage automatique à la première offre acceptée ou assignation directe en marketplace, rappel J-2, blocage, déclaration de paiement, validation manuelle par le backoffice.

Point spécifique livreur à retenir : **l'abonnement ne concerne que l'usage du module Marketplace**, pas les missions classiques (section 4). Un livreur qui ne fait jamais de livraison marketplace n'est jamais assujetti à cet abonnement et n'est jamais bloqué sur ses missions classiques.

---

## 7. Notifications (WebSocket, push, email)

Contrat WebSocket général déjà documenté dans `tourshop-backend/WEBSOCKETS.md` (connexion Echo/Reverb, event unique `model.updated`, forme du payload) — se référer à ce fichier pour l'intégration technique, résumé ici pour le périmètre livreur uniquement.

### 7.1 Canaux WebSocket du livreur

| Canal | Qui peut écouter | Autorisation |
|---|---|---|
| `livreur.{livreurId}` (privé) | Le livreur lui-même uniquement | `user.type === LIVREUR && user.id === livreurId` |
| `livreurs.reseau` (public authentifié) | Tout livreur connecté | `user.type === LIVREUR` |

S'abonner via Echo, filtrer sur `payload.model`/`payload.action` (voir `WEBSOCKETS.md` pour le code d'exemple complet).

### 7.2 Événements émis vers le livreur

| Déclencheur métier | `model` | `action` | Canal(x) |
|---|---|---|---|
| Nouvelle mission express disponible | `Mission` | `nouvelle_disponible` | `livreurs.reseau` |
| Mission proposée manuellement (mode groupage, en attente d'accord) | `Mission` | `proposee` | `livreur.{id}` du livreur ciblé |
| Mission assignée (après acceptation groupage, ou offre express acceptée) | `Mission` | `assignee` | `livreur.{id}` |
| Mission clôturée (offre acceptée par le client, mode express) | `Mission` | `cloturee` | `livreur.{id}` de **tous** les livreurs ayant proposé (gagnant + refusés) |
| Mission refusée ou expirée (groupage) | `Mission` | `refusee` / `expiree` | `backoffice.{id}` du backoffice de rattachement |
| Nouvelle livraison marketplace disponible | `LivraisonMarketplace` | `nouvelle_disponible` | `livreurs.reseau` |
| Livraison marketplace proposée directement (en attente d'accord) | `LivraisonMarketplace` | `proposee` | `livreur.{id}` |
| Livraison marketplace assignée (après acceptation) | `LivraisonMarketplace` | `assignee` | `livreur.{id}` |
| Livraison marketplace refusée ou expirée | `LivraisonMarketplace` | `refusee` / `expiree` | `client.{id}` du vendeur |
| Livraison marketplace clôturée (offre réseau acceptée) | `LivraisonMarketplace` | `cloturee` | `livreur.{id}` de tous les offrants |

⚠️ Cette liste n'est **pas encore répercutée dans le tableau de `WEBSOCKETS.md`** (qui référence surtout les événements agence/backoffice) — se fier à ce tableau-ci pour le périmètre livreur.

### 7.3 Notifications push (WebPush) et historique persisté (nouveau)

Les missions classiques déclenchent un push en complément du WebSocket (section 7.2), pour atteindre les livreurs non connectés au moment de l'événement :

| Déclencheur | Notification | Cible |
|---|---|---|
| Inscription self-service validée par le backoffice | `InscriptionLivreurValideePushNotification` — "Inscription validée" | Le livreur inscrit (push sans portée réelle avant sa première connexion, voir section 1) |
| Inscription self-service rejetée par le backoffice | `InscriptionLivreurRejeteePushNotification` — "Inscription rejetée" (inclut le `commentaire` de rejet s'il est renseigné) | Le livreur inscrit (même limite de portée du push) |
| Mission proposée (mode groupage, en attente d'accord) | `MissionProposeePushNotification` — "Nouvelle mission proposée" | Le livreur ciblé |
| Mission acceptée par le livreur (accusé de réception) | `MissionAccepteeParLivreurPushNotification` — "Mission acceptée" | Le livreur lui-même |
| Mission refusée par le livreur ou expirée (accusé de réception) | `MissionRefuseeParLivreurPushNotification` — "Mission refusée" | Le livreur lui-même |
| Offre acceptée par le client (mode express) | `MissionOffreAccepteePushNotification` — "Offre acceptée" | Le livreur gagnant |
| Offre non retenue (une autre a été acceptée) | `MissionOffreRefuseePushNotification` — "Offre non retenue" | Chaque livreur perdant |
| Nouvelle mission express disponible | `MissionExpressDisponiblePushNotification` — "Nouvelle mission disponible" | Tous les livreurs avec `disponible = true` (filtrés par ville, voir 4.5) |

Chaque envoi est protégé individuellement (try/catch par destinataire) : l'échec d'un push (souscription invalide, etc.) n'affecte jamais le flux métier ni les autres destinataires, seulement journalisé (`Log::warning`).

S'y ajoute le rappel d'échéance d'abonnement marketplace (`AbonnementEcheanceProchePushNotification`, voir section 6/doc Marketplace).

**Enregistrement d'un abonnement push** (générique, tous types d'utilisateurs) :
- `GET /push/public-key` → `{ "success": true, "public_key": "..." }`
- `POST /push/subscribe` → corps `{ "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } }`
- `POST /push/unsubscribe` → corps `{ "endpoint": "..." }`

**Historique persisté (nouveau)** : chaque notification push ci-dessus est désormais **aussi enregistrée côté serveur** (canal `database` de Laravel, en plus du push), consultable et marquable lue, partagée entre tous les appareils du livreur — ce qui n'était pas le cas avant (voir ancienne section 7.4, retirée).

**GET `/livreur/notifications`** (paginé, 20/page)
```json
{
  "success": true,
  "notifications": {
    "data": [
      {
        "id": "uuid",
        "type": "App\\Notifications\\MissionProposeePushNotification",
        "data": { "type": "mission_proposee", "titre": "Nouvelle mission proposée", "message": "...", "cible": { "type": "mission", "id": "uuid" } },
        "read_at": null,
        "created_at": "2026-10-02T10:00:00.000000Z"
      }
    ],
    "current_page": 1, "last_page": 2, "total": 23
  }
}
```

**POST `/livreur/notifications/{id}/lue`** → `{ "success": true, "message": "Notification marquée comme lue." }`. 404 si la notification n'appartient pas au livreur.

**POST `/livreur/notifications/tout-lire`** → `{ "success": true, "message": "Toutes les notifications ont été marquées comme lues." }`.

Rétention : les notifications **lues** de plus de 90 jours sont supprimées automatiquement (tâche planifiée quotidienne) ; les non lues sont conservées indéfiniment.

### 7.5 Emails

Aucun email métier (mission assignée, etc.) n'est envoyé au livreur — uniquement les emails génériques applicables à tout type de compte : réinitialisation de mot de passe, vérification d'email, et le rappel d'échéance abonnement marketplace (en parallèle du push, section 7.3). **Il n'y a pas d'email de bienvenue envoyé automatiquement à la création d'un compte livreur** par le backoffice, malgré l'existence d'un mailable `WelcomeAgentMail` prévu pour ce cas (jamais appelé depuis `LivreurController::add()`).

---

## 8. Workflows complets

### 8.1a Inscription self-service (nouveau, chemin recommandé)

```
Livreur : POST /register-livreur { nom, telephone, indicatif_telephone, whatsapp_number, email, password,
                                    code_pays, type_piece_identite, numero_piece_identite, piece_identite (fichier),
                                    type_vehicule, ville, ... }
          → User (actif=false) + Livreur (statut_validation=en_attente) créés
          → email de vérification envoyé

Livreur : POST /verify-email { email, code }
          → email_verified_at renseigné (le compte reste inactif malgré tout)

Livreur : POST /login { telephone, password, type: "livreur" }
          → 422 "Votre compte est désactivé." tant que non validé par le backoffice

[Backoffice consulte GET /backoffice/livreurs-en-attente, vérifie les documents]
Backoffice : POST /backoffice/livreurs/{livreur}/valider
             → statut_validation=valide, user.actif=true
             → push+database InscriptionLivreurValideePushNotification (portée limitée, voir section 1)

Livreur : POST /login { telephone, password, type: "livreur" }
          → connexion réussie, token Sanctum
Livreur : GET /livreur/profil → fiche Livreur complète (véhicule, statut, pièce d'identité)
```

### 8.1b Compte créé directement par le backoffice (chemin existant, toujours disponible)

```
Backoffice : POST /backoffice/add-livreur { nom, prenoms, telephone, password, type_vehicule, ... }
             → User (type=livreur, actif=true) + Livreur (statut=disponible) créés immédiatement, aucun email envoyé

Livreur : reçoit ses identifiants hors application (communiqués par le backoffice)
Livreur : POST /login { telephone, password, type: "livreur" }
          → token Sanctum, GET /livreur/profil pour les détails
```

### 8.2 Mission groupage (assignation manuelle backoffice, avec accord du livreur)

```
Backoffice : assigne un livreur rattaché à une mission d'enlèvement/livraison
             → Mission : proposee, expire_le = maintenant + 15 min
             → WebSocket : Mission/proposee sur livreur.{id}, push MissionProposeePushNotification

Livreur : GET /expedition/livreur/missions?statut=proposee → voit la proposition, expire_le
Livreur : POST /expedition/livreur/missions/{id}/accepter
          → Mission : assignee, acceptee_le renseigné, code de validation généré (si livraison)
          → WebSocket : Mission/assignee sur livreur.{id}

  [Alternative : Livreur : POST /expedition/livreur/missions/{id}/refuser { motif? }
   → Mission : en_attente, livreur_id=null, retourne dans la file du backoffice
   → WebSocket : Mission/refusee sur backoffice.{id}
   (ou expiration automatique après 15 min sans réponse, même effet, motif_refus="Expiré")]

Livreur : POST /expedition/livreur/enlevement/{expeditionId}/start
Livreur : (récupère le colis chez l'expéditeur, photo/signature/position optionnelles)
Livreur : POST /expedition/livreur/enlevement/{expeditionId}/confirm
Livreur : (dépose le colis à l'agence)
Livreur : POST /expedition/livreur/reception-agence/{expeditionId}/confirm
          → mission terminee, statut_paiement=paye (cash direct), solde_livreur crédité
```

### 8.3 Mission express (offres du réseau)

```
[Mission express créée, sans livreur rattaché disponible]
          → WebSocket : Mission/nouvelle_disponible sur livreurs.reseau

Livreur A : GET /expedition/livreur/missions-disponibles → voit la mission
Livreur A : POST /expedition/livreur/missions/{id}/proposer { montant_propose: 1500 }
Livreur B : POST /expedition/livreur/missions/{id}/proposer { montant_propose: 1800 } (offre concurrente)

[Client accepte l'offre de Livreur A]
          → WebSocket : Mission/cloturee sur livreur.{A} ET livreur.{B}
          → Mission A : assignee. Offre B : refusee.

Livreur A : POST /expedition/livreur/livraison/{expeditionId}/start (si type=livraison)
Livreur A : POST /expedition/livreur/livraison/{expeditionId}/validate { code_validation: "1234", photo?, signature?, latitude?, longitude? }
            → mission terminee, solde_livreur crédité
```

### 8.4 Marketplace et abonnement

Voir `MARKETPLACE_ET_ABONNEMENT_API.md`, sections 7 (rôle livreur) et 8.1-8.4 (workflows complets, y compris le cycle de vie de l'abonnement).

---

## 9. Codes d'erreur et cas particuliers

| Situation | Code HTTP | Corps |
|---|---|---|
| Utilisateur pas de type `LIVREUR` sur une route livreur | 403 | `{ "success": false, "message": "Non autorisé" }` |
| Expédition/mission introuvable ou non assignée à ce livreur | 404 | `{ "success": false, "message": "Expédition non trouvée ou non assignée" }` |
| Code de validation de livraison incorrect | 422 | `{ "success": false, "message": "Code de réception incorrect" }` |
| Mission déjà close (offre) | 404 | `{ "success": false, "message": "..." }` |
| Champ de validation manquant/invalide | 422 | `{ "success": false, "errors": {...} }` (format Laravel Validator) |
| Erreur serveur inattendue | 500 | `{ "success": false, "message": "Erreur serveur.", "errors": "..." }` |
| Compte livreur inactif (inscription non encore validée par le backoffice) | 422 | `{ "success": false, "errors": { "account": ["Votre compte est désactivé."] } }` |
| Retrait demandé supérieur au solde disponible | 422 | `{ "success": false, "message": "Le montant dépasse votre solde disponible." }` |
| Offre/assignation refusée car livreur indisponible (`disponible = false`) | 422 | `{ "success": false, "message": "Vous devez être disponible pour proposer une offre." }` ou `{ "success": false, "message": "Ce livreur n'est pas disponible." }` |
| Proposition (mission/livraison) introuvable, déjà traitée ou pas à ce livreur | 404 | `{ "success": false, "message": "Mission non trouvée." }` ou `{ "success": false, "message": "Livraison non trouvée." }` |
| Proposition expirée (délai de 15 min dépassé) | 422 | `{ "success": false, "message": "Cette proposition a expiré." }` |
| Acceptation refusée : livreur déjà engagé sur une autre mission active | 422 | `{ "success": false, "message": "Vous avez déjà une mission en cours." }` |
| Mission non modifiable (ajout de note sur une mission non `assignee`) | 422 | `{ "success": false, "message": "Mission non modifiable." }` |
