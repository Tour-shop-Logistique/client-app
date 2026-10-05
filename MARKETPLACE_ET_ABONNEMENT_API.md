# Marketplace et Abonnement marketplace — Documentation API

Ce document décrit deux modules backend destinés à être intégrés dans l'application cliente et l'application livreur :

1. **Marketplace** : vente d'articles entre clients (vendeur ↔ acheteur), avec livraison assurée par le réseau de livreurs, un livreur choisi directement, ou en dehors de l'application.
2. **Abonnement marketplace** : commission périodique (mensuelle par défaut) facturée aux vendeurs et livreurs actifs sur la marketplace, avec rappel avant échéance, validation manuelle du paiement par le backoffice, et blocage d'accès en cas de non-paiement.

Toutes les routes sont préfixées par l'URL de base de l'API et nécessitent un token Sanctum (`Authorization: Bearer {token}`), sauf mention contraire. Toutes les réponses sont au format JSON avec une enveloppe `{"success": bool, ...}`.

**Périmètre** : ce document couvre uniquement le module Marketplace (vente entre clients) et son Abonnement. Le **parcours complet du livreur** (inscription/onboarding, missions d'expédition Interville/Extraville classiques, notifications générales) est documenté séparément dans `docs/PARCOURS_LIVREUR_API.md`. La [section 7](#7-rôle-du-livreur-dans-le-module-marketplace-pas-son-parcours-complet) documente uniquement ce qu'un livreur fait *dans* Marketplace (livrer des articles vendus entre clients), qui n'est qu'une petite partie de son usage réel de l'app.

---

## Sommaire

- [1. Concepts clés](#1-concepts-clés) (1.6 : affectation directe, le livreur doit accepter)
- [2. Marketplace — Vendeur (annonces)](#2-marketplace--vendeur-annonces)
- [3. Marketplace — Vendeur (moyens de paiement acceptés)](#3-marketplace--vendeur-moyens-de-paiement-acceptés)
- [4. Marketplace — Acheteur (catalogue, panier, achats)](#4-marketplace--acheteur-catalogue-panier-achats)
- [5. Marketplace — Confirmation du paiement (vendeur)](#5-marketplace--confirmation-du-paiement-vendeur)
- [6. Marketplace — Choix et suivi de la livraison (vendeur)](#6-marketplace--choix-et-suivi-de-la-livraison-vendeur)
- [7. Rôle du livreur dans Marketplace (pas son parcours complet)](#7-rôle-du-livreur-dans-le-module-marketplace-pas-son-parcours-complet)
- [8. Marketplace — Solde vendeur (informatif)](#8-marketplace--solde-vendeur-informatif)
- [9. Abonnement marketplace](#9-abonnement-marketplace)
- [10. Workflows complets (schémas de bout en bout)](#10-workflows-complets)
- [11. Codes d'erreur et cas particuliers](#11-codes-derreur-et-cas-particuliers)
- [12. Annexe — Routes backoffice](#12-annexe--routes-backoffice-contexte-pas-à-intégrer-côté-app-clientelivreur)

---

## 1. Concepts clés

### 1.1 Qui fait quoi

| Rôle | Type utilisateur (`UserType`) | Peut... |
|---|---|---|
| Vendeur | `CLIENT` | Publier des annonces, configurer ses moyens de paiement, recevoir des commandes, confirmer la réception d'un paiement, choisir le mode de livraison |
| Acheteur | `CLIENT` | Parcourir le catalogue, acheter, déclarer un paiement, suivre sa commande |
| Livreur | `LIVREUR` | Voir les livraisons disponibles (mode réseau, filtrées par ville), proposer un prix, accepter/refuser une affectation directe, livrer avec preuve, valider par code |

Un même compte `CLIENT` peut être vendeur et acheteur — ce n'est pas un rôle séparé, c'est contextuel selon qui a créé l'annonce/la commande. **Un vendeur voit ses propres annonces dans son catalogue acheteur** (pour prévisualiser le rendu côté client), mais ne peut pas les acheter (voir [section 4](#4-marketplace--acheteur-catalogue-panier-achats)).

### 1.2 L'argent circule toujours hors application

**Point fondamental du modèle économique** : ni la vente d'un article, ni la livraison, ne font transiter d'argent réel par la plateforme. Deux cas possibles, à la charge du vendeur/acheteur/livreur de s'entendre :

- L'acheteur paie directement le vendeur (mobile money vers son numéro, ou cash à la livraison), en dehors de l'application.
- Le livreur encaisse le paiement (cash) à la livraison pour le compte du vendeur, et le lui reverse plus tard, hors application.

**Le backoffice ne détient jamais cet argent et n'intervient jamais dans ce flux.** Le solde `solde_marketplace` affiché à un vendeur/livreur (voir [section 8](#8-marketplace--solde-vendeur-informatif)) est donc **purement informatif** : un compteur de ce qui a été vendu/livré, jamais un vrai solde retirable. Il n'existe **aucune route de retrait**.

Le **seul** flux d'argent réellement géré par le backoffice est l'**abonnement marketplace** (commission périodique pour continuer à utiliser le service, [section 9](#9-abonnement-marketplace)) : l'utilisateur paie hors application vers un compte du backoffice, puis déclare son paiement avec une preuve, et le backoffice valide manuellement.

### 1.3 Modes de livraison d'une commande

Une fois la commande **payée** (c'est-à-dire confirmée par le vendeur, voir [section 5](#5-marketplace--confirmation-du-paiement-vendeur)), le **vendeur** choisit un des trois modes :

| Mode | Valeur API | Comportement |
|---|---|---|
| Réseau de livreurs | `reseau_livreurs` | La livraison est proposée à tous les livreurs du pays. Ils font des offres de prix, le vendeur en accepte une. |
| Livreur direct | `livreur_direct` | Le vendeur choisit lui-même un livreur (ex. quelqu'un qu'il connaît déjà) et fixe le montant. |
| Hors plateforme | `hors_plateforme` | Le vendeur livre lui-même ou via un tiers non géré par l'app. Aucune `LivraisonMarketplace` n'est créée. |

### 1.4 Code de validation de livraison

Pour les modes `reseau_livreurs` et `livreur_direct`, un code à 4 chiffres (`code_validation_livraison`) est généré automatiquement sur la commande dès qu'un livreur **accepte** la livraison (voir 1.6 ci-dessous — pas dès l'affectation du vendeur en mode direct). **L'acheteur doit communiquer ce code au livreur** à la remise. Le livreur saisit ce code pour valider la livraison — sans ce code, il ne peut pas clôturer.

### 1.6 Affectation directe : le livreur doit accepter (nouveau)

En mode `livreur_direct`, le vendeur choisit un livreur et fixe un montant, mais la livraison passe d'abord au statut **`proposee`** (pas `assignee`) — le livreur dispose de **15 minutes** pour l'accepter ou la refuser (voir [section 7.4](#74-accepter-ou-refuser-une-affectation-directe-nouveau)). En mode réseau, ce palier n'existe pas : proposer une offre de prix vaut déjà accord implicite du livreur, l'acceptation par le vendeur assigne directement.

Pour `hors_plateforme`, il n'y a pas de code : le vendeur confirme lui-même que la commande est livrée.

### 1.5 Paiement d'une commande : déclaratif, avec confirmation du vendeur

**Aucune passerelle mobile money réelle n'est intégrée à ce jour.** Le paiement d'une commande marketplace se fait en deux temps :

1. **L'acheteur déclare** avoir payé (moyen de paiement utilisé + référence + capture d'écran optionnelle) → la commande passe en statut `paiement_a_confirmer`. **Ce n'est pas encore un paiement confirmé.**
2. **Le vendeur confirme ou infirme** avoir bien reçu ce paiement (il a vu l'argent arriver sur son compte, ou reçu le cash) → si confirmé, la commande passe `payee`, l'article passe `vendue`, et le choix du mode de livraison devient possible. Si infirmé, la commande retourne en attente et l'acheteur peut re-déclarer.

Voir [section 4](#4-marketplace--acheteur-catalogue-panier-achats) pour la déclaration et [section 5](#5-marketplace--confirmation-du-paiement-vendeur) pour la confirmation.

---

## 2. Marketplace — Vendeur (annonces)

Base : `/marketplace/vendeur`

> Toutes les routes de ce groupe sont protégées par le middleware d'abonnement (voir [section 9](#9-abonnement-marketplace)) : si le vendeur est en retard de paiement de son abonnement marketplace, toutes les routes ci-dessous renvoient **403** avec `code: "ABONNEMENT_BLOQUE"`.

### GET `/marketplace/vendeur/annonces/list`

Liste les annonces du vendeur connecté (tous statuts confondus).

**Réponse 200**
```json
{
  "success": true,
  "annonces": [
    {
      "id": "5b1e2b2a-1111-4a3b-9c1a-000000000001",
      "vendeur_id": "5b1e2b2a-1111-4a3b-9c1a-000000000010",
      "titre": "Canapé 3 places",
      "description": "Bon état, peu servi",
      "prix": 75000,
      "devise": "XOF",
      "statut": "brouillon",
      "code_pays": "CI",
      "backoffice_id": "5b1e2b2a-1111-4a3b-9c1a-000000000099",
      "publiee_le": null,
      "vendue_le": null,
      "created_at": "2026-09-24T09:00:00.000000Z",
      "updated_at": "2026-09-24T09:00:00.000000Z",
      "photos": [
        { "id": "5b1e2b2a-1111-4a3b-9c1a-000000000101", "annonce_marketplace_id": "5b1e2b2a-1111-4a3b-9c1a-000000000001", "path": "marketplace/produits/5b1e2b2a-1111-4a3b-9c1a-000000000001/xxx.jpg", "ordre": 0 }
      ]
    }
  ]
}
```

Statuts possibles (`statut`, type ENUM natif Postgres `annonce_marketplace_statut_enum`) : `brouillon`, `publiee`, `depubliee`, `vendue`, `masquee` (masquée par le backoffice pour modération).

### GET `/marketplace/vendeur/annonces/show/{id}`

Détail d'une annonce du vendeur connecté. 404 si elle n'existe pas ou n'appartient pas à l'utilisateur.

**Réponse 200** : `{ "success": true, "annonce": {...} }` (même forme qu'un élément de la liste).

**Réponse 404** : `{ "success": false, "message": "Annonce introuvable." }`

### POST `/marketplace/vendeur/annonces/store`

Crée une annonce en statut `brouillon`. Il faut appeler `/publier` ensuite pour la rendre visible aux acheteurs.

**Corps (multipart/form-data si photos)**
| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `titre` | string | oui | max 255 |
| `description` | string | non | max 5000 |
| `prix` | number | oui | ≥ 0 |
| `photos` | file[] | non | max 10 fichiers, `image` jpeg/png/jpg/webp, max 5 Mo chacun |
| `retrait_nom` | string | non | nouveau — nom de contact pour le retrait |
| `retrait_telephone` | string | non | max 20 |
| `retrait_adresse` | string | non | max 255 |
| `retrait_quartier` | string | non | max 100 |
| `retrait_ville` | string | non | max 100 |
| `retrait_latitude` | numérique | non | -90 à 90 |
| `retrait_longitude` | numérique | non | -180 à 180 |

**Nouveau — adresse de retrait** : saisie une fois sur l'annonce, copiée (snapshot) sur chaque commande au moment où le vendeur choisit un mode de livraison (réseau ou direct) — voir sections 6 et 7. Sans elle, le livreur ne connaissait ni l'adresse ni le contact pour récupérer l'article. Tous les champs restent optionnels pour ne pas bloquer la création d'annonce (mais fortement recommandés avant de choisir un mode de livraison livreur).

**Requête**
```json
{
  "titre": "Canapé 3 places", "description": "Bon état, peu servi", "prix": 75000,
  "retrait_nom": "Kouassi Jean", "retrait_telephone": "+2250701020304",
  "retrait_adresse": "Rue des Jardins", "retrait_ville": "Abidjan", "retrait_quartier": "Cocody",
  "retrait_latitude": 5.3599, "retrait_longitude": -3.9870
}
```

**Réponse 201**
```json
{
  "success": true,
  "message": "Annonce créée.",
  "annonce": {
    "id": "5b1e2b2a-1111-4a3b-9c1a-000000000001",
    "vendeur_id": "5b1e2b2a-1111-4a3b-9c1a-000000000010",
    "titre": "Canapé 3 places",
    "description": "Bon état, peu servi",
    "prix": 75000,
    "devise": "XOF",
    "statut": "brouillon",
    "code_pays": "CI",
    "backoffice_id": "5b1e2b2a-1111-4a3b-9c1a-000000000099",
    "retrait_nom": "Kouassi Jean", "retrait_telephone": "+2250701020304",
    "retrait_adresse": "Rue des Jardins", "retrait_ville": "Abidjan", "retrait_quartier": "Cocody",
    "retrait_latitude": 5.3599, "retrait_longitude": -3.9870,
    "photos": []
  }
}
```

**Erreur 422** : `{ "success": false, "errors": { "titre": ["Le champ titre est obligatoire."] } }`

### PUT `/marketplace/vendeur/annonces/update/{id}`

Modifie `titre`, `description`, `prix`, et désormais `retrait_nom`/`retrait_telephone`/`retrait_adresse`/`retrait_quartier`/`retrait_ville`/`retrait_latitude`/`retrait_longitude` (tous optionnels, `sometimes`). Ne modifie pas les photos (voir suppression de photo ci-dessous ; il n'y a pas de route d'ajout de photo séparée — les photos s'ajoutent uniquement à la création).

**Requête** : `{ "prix": 70000, "retrait_ville": "Bouaké" }`

**Réponse 200** : `{ "success": true, "message": "Annonce mise à jour.", "annonce": {...} }`

### POST `/marketplace/vendeur/annonces/{id}/publier`

Passe l'annonce en statut `publiee`, la rend visible dans le catalogue acheteur.

**⚠️ Effet de bord important** : la première publication d'annonce d'un vendeur **déclenche automatiquement le démarrage de son abonnement marketplace** (voir [section 9](#9-abonnement-marketplace)). Ce n'est pas bloquant pour la publication elle-même — l'abonnement démarre en arrière-plan, la première échéance tombera dans `periodicite_jours` (30 jours par défaut).

**Réponse 200** : `{ "success": true, "message": "Annonce publiée.", "annonce": { "...": "...", "statut": "publiee", "publiee_le": "2026-09-24T09:05:00.000000Z" } }`

### POST `/marketplace/vendeur/annonces/{id}/depublier`

Repasse l'annonce en `depubliee`, elle disparaît du catalogue. Réactivable avec `/publier` à nouveau.

**Réponse 200** : `{ "success": true, "message": "Annonce dépubliée.", "annonce": { "...": "...", "statut": "depubliee" } }`

### DELETE `/marketplace/vendeur/annonces/{id}/photos/{photoId}`

Supprime une photo (fichier + enregistrement).

**Réponse 200** : `{ "success": true, "message": "Photo supprimée." }`

**Réponse 404** : `{ "success": false, "message": "Photo introuvable." }`

---

## 3. Marketplace — Vendeur (moyens de paiement acceptés)

Base : `/marketplace/vendeur`. Même middleware d'abonnement que la section 2.

Un vendeur configure une fois pour toutes les moyens de paiement qu'il accepte (ex. Orange Money vers son numéro, cash à la livraison). Cette configuration est **valable pour toutes ses annonces** — pas de configuration par annonce. L'acheteur les consulte au moment de déclarer son paiement (voir [section 4](#4-marketplace--acheteur-catalogue-panier-achats)).

### GET `/marketplace/vendeur/moyens-paiement/list`

**Réponse 200**
```json
{
  "success": true,
  "moyens_paiement": [
    {
      "id": "5b1e2b2a-2222-4a3b-9c1a-000000000001",
      "vendeur_id": "5b1e2b2a-1111-4a3b-9c1a-000000000010",
      "methode": "mobile_money",
      "numero_destinataire": "0700000000",
      "libelle": "Orange Money",
      "actif": true,
      "created_at": "2026-09-24T09:00:00.000000Z"
    },
    {
      "id": "5b1e2b2a-2222-4a3b-9c1a-000000000002",
      "vendeur_id": "5b1e2b2a-1111-4a3b-9c1a-000000000010",
      "methode": "cash",
      "numero_destinataire": null,
      "libelle": "Cash à la livraison",
      "actif": true,
      "created_at": "2026-09-24T09:01:00.000000Z"
    }
  ]
}
```

`methode` (enum `PaymentMethod`) : `cash`, `mobile_money`, `bank_transfer`, `card`, `other`. Pour ce module, en pratique seuls `cash` (cash à la livraison) et `mobile_money` (paiement en ligne vers le numéro du vendeur) sont attendus — les autres valeurs restent disponibles si un vendeur a un besoin particulier. Le détail de l'opérateur (Orange/MTN/Wave) se met dans `libelle`, en texte libre.

### POST `/marketplace/vendeur/moyens-paiement/store`

**Corps**
| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `methode` | string | oui | une valeur de `PaymentMethod` |
| `numero_destinataire` | string | non | max 50 |
| `libelle` | string | non | max 255 |
| `actif` | boolean | non | défaut `true` |

**Requête**
```json
{ "methode": "mobile_money", "numero_destinataire": "0700000000", "libelle": "Orange Money" }
```

**Réponse 201** : `{ "success": true, "message": "Moyen de paiement ajouté.", "moyen_paiement": {...} }`

### PUT `/marketplace/vendeur/moyens-paiement/update/{id}`

Mêmes champs que `store`, tous en `sometimes`. Permet notamment de désactiver un moyen (`{ "actif": false }`) sans le supprimer.

**Réponse 200** : `{ "success": true, "message": "Moyen de paiement mis à jour.", "moyen_paiement": {...} }`

**Réponse 404** : `{ "success": false, "message": "Moyen de paiement introuvable." }`

### DELETE `/marketplace/vendeur/moyens-paiement/{id}`

**Réponse 200** : `{ "success": true, "message": "Moyen de paiement supprimé." }`

---

## 4. Marketplace — Acheteur (catalogue, panier, achats)

Base : `/marketplace/acheteur`. **Pas de middleware d'abonnement sur ce groupe** — un acheteur n'est jamais bloqué, seuls les vendeurs/livreurs le sont.

### GET `/marketplace/acheteur/catalogue/list`

Parcourt les annonces publiées, **y compris celles du vendeur connecté lui-même** (pour lui permettre de prévisualiser le rendu côté acheteur). Le frontend doit comparer `vendeur.id` à l'utilisateur connecté pour désactiver le bouton "Acheter" sur ses propres annonces — la vraie protection contre l'auto-achat est côté serveur (voir plus bas, `panier/valider`).

**Query params**
| Param | Type | Effet |
|---|---|---|
| `code_pays` | string | Filtre par pays (ex. `CI`) |
| `recherche` | string | Recherche texte sur `titre` OU `description` (LIKE) |
| `per_page` | int | Pagination, défaut 20 |

**Réponse 200** : pagination Laravel standard.
```json
{
  "success": true,
  "annonces": {
    "current_page": 1,
    "data": [
      {
        "id": "5b1e2b2a-1111-4a3b-9c1a-000000000001",
        "titre": "Canapé 3 places",
        "prix": 75000,
        "devise": "XOF",
        "statut": "publiee",
        "photos": [{ "id": "...", "path": "marketplace/produits/.../xxx.jpg", "ordre": 0 }],
        "vendeur": { "id": "5b1e2b2a-1111-4a3b-9c1a-000000000010", "nom": "Kouassi", "prenoms": "Jean" }
      }
    ],
    "total": 42,
    "per_page": 20,
    "last_page": 3
  }
}
```

### GET `/marketplace/acheteur/catalogue/show/{id}`

Détail d'une annonce publiée (n'importe quel vendeur, y compris soi-même). 404 si non publiée ou inexistante.

**Réponse 200**
```json
{
  "success": true,
  "annonce": {
    "id": "5b1e2b2a-1111-4a3b-9c1a-000000000001",
    "titre": "Canapé 3 places",
    "description": "Bon état, peu servi",
    "prix": 75000,
    "devise": "XOF",
    "statut": "publiee",
    "photos": [...],
    "vendeur": { "id": "5b1e2b2a-1111-4a3b-9c1a-000000000010", "nom": "Kouassi", "prenoms": "Jean" }
  },
  "est_ma_propre_annonce": false
}
```
`est_ma_propre_annonce` : `true` si l'annonce appartient à l'utilisateur connecté — le frontend doit alors masquer/désactiver l'achat.

### GET `/marketplace/acheteur/vendeurs/{vendeurId}/moyens-paiement`

Liste les moyens de paiement **actifs** d'un vendeur donné. À appeler juste avant de déclarer un paiement, pour proposer à l'acheteur le choix parmi ce que le vendeur accepte réellement.

**Réponse 200** : même forme que `GET /marketplace/vendeur/moyens-paiement/list` (voir section 3), filtrée sur `actif = true`.

### POST `/marketplace/acheteur/panier/valider`

Valide un panier d'annonces. **Si le panier contient des articles de plusieurs vendeurs, il est automatiquement scindé en plusieurs `CommandeMarketplace`** (une par vendeur). Verrouille les annonces pour éviter un double achat concurrent. **Refuse l'achat de ses propres annonces.**

**Corps**
```json
{
  "annonce_ids": ["5b1e2b2a-1111-4a3b-9c1a-000000000001", "5b1e2b2a-1111-4a3b-9c1a-000000000002"],
  "adresse_livraison": {
    "nom": "Fatou Diallo",
    "telephone": "+2250705060708",
    "adresse": "Rue du Docteur Blanchard",
    "ville": "Abidjan",
    "quartier": "Zone 4",
    "latitude": 5.2970,
    "longitude": -3.9960,
    "instructions": "Sonner au portail bleu"
  }
}
```
`annonce_ids` : requis, tableau non vide, chaque id doit exister dans `annonces_marketplace`. `adresse_livraison` : **requis** (nouveau) — `nom`, `telephone`, `adresse`, `ville` requis ; `quartier`, `latitude`/`longitude`, `instructions` optionnels. **Une seule adresse pour tout le panier**, même s'il est scindé en plusieurs commandes (l'acheteur ne livre qu'à une adresse par validation). Sans ce champ, impossible pour le livreur de savoir où livrer — absent avant ce chantier.

**Réponse 201**
```json
{
  "success": true,
  "message": "Panier validé.",
  "commandes": [
    {
      "id": "5b1e2b2a-3333-4a3b-9c1a-000000000001",
      "acheteur_id": "5b1e2b2a-1111-4a3b-9c1a-000000000020",
      "vendeur_id": "5b1e2b2a-1111-4a3b-9c1a-000000000010",
      "montant_articles": 150000,
      "statut": "en_attente_paiement",
      "livraison_nom": "Fatou Diallo", "livraison_telephone": "+2250705060708",
      "livraison_adresse": "Rue du Docteur Blanchard", "livraison_ville": "Abidjan", "livraison_quartier": "Zone 4",
      "livraison_latitude": 5.2970, "livraison_longitude": -3.9960,
      "livraison_instructions": "Sonner au portail bleu",
      "items": [
        { "id": "...", "annonce_marketplace_id": "5b1e2b2a-1111-4a3b-9c1a-000000000001", "titre_snapshot": "Canapé 3 places", "prix_unitaire": 75000 }
      ]
    }
  ]
}
```

**Erreur 422** si un article n'est plus disponible :
```json
{ "success": false, "message": "Article(s) déjà vendu(s) ou indisponible(s) : Canapé 3 places" }
```

**Erreur 422** si tentative d'achat de sa propre annonce :
```json
{ "success": false, "message": "Vous ne pouvez pas acheter votre propre annonce : Canapé 3 places" }
```

**Erreur 422** si `adresse_livraison` absente ou incomplète : format Laravel Validator standard (`errors.adresse_livraison.*`).

> Le frontend doit gérer le cas multi-commandes : après validation du panier, il faut faire déclarer le paiement de **chaque commande séparément** (une par vendeur).

### POST `/marketplace/acheteur/commandes/{id}/declarer-paiement`

L'acheteur déclare avoir payé (hors application). La commande doit être en statut `en_attente_paiement`. **Ne finalise pas le paiement** : passe la commande en `paiement_a_confirmer`, en attente de confirmation du vendeur (voir [section 5](#5-marketplace--confirmation-du-paiement-vendeur)).

**Corps (multipart/form-data si preuve)**
| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `payment_method` | string | oui | une valeur de `PaymentMethod` (`cash`, `mobile_money`, ...) |
| `reference` | string | non | max 255 |
| `preuve` | file | non | image jpeg/png/jpg/webp, max 5 Mo (capture d'écran de la transaction) |

**Réponse 200**
```json
{
  "success": true,
  "message": "Paiement déclaré, en attente de confirmation du vendeur.",
  "commande": {
    "id": "5b1e2b2a-3333-4a3b-9c1a-000000000001",
    "statut": "paiement_a_confirmer",
    "payment_method_choisi": "mobile_money",
    "reference_paiement": "MM-240924-XYZ",
    "preuve_paiement_path": "marketplace/preuves-paiement/5b1e2b2a-3333-4a3b-9c1a-000000000001/abc.jpg",
    "paiement_declare_le": "2026-09-24T10:00:00.000000Z"
  }
}
```

**Erreur 422** si déjà déclarée ou déjà traitée : `{ "success": false, "message": "Cette commande a déjà été traitée ou est en attente de confirmation." }`

### GET `/marketplace/acheteur/commandes/list`

Liste des achats de l'acheteur connecté, avec `items`, `vendeur:id,nom,prenoms`, `livraisonMarketplace`.

**Réponse 200**
```json
{
  "success": true,
  "commandes": [
    {
      "id": "5b1e2b2a-3333-4a3b-9c1a-000000000001",
      "acheteur_id": "5b1e2b2a-1111-4a3b-9c1a-000000000020",
      "vendeur_id": "5b1e2b2a-1111-4a3b-9c1a-000000000010",
      "montant_articles": 75000,
      "statut": "livree",
      "mode_livraison": "reseau_livreurs",
      "code_validation_livraison": "4821",
      "payee_le": "2026-09-24T10:05:00.000000Z",
      "livraison_validee_le": "2026-09-24T11:00:00.000000Z",
      "items": [
        { "id": "...", "annonce_marketplace_id": "5b1e2b2a-1111-4a3b-9c1a-000000000001", "titre_snapshot": "Canapé 3 places", "prix_unitaire": 75000 }
      ],
      "vendeur": { "id": "5b1e2b2a-1111-4a3b-9c1a-000000000010", "nom": "Kouassi", "prenoms": "Jean" },
      "livraison_marketplace": { "id": "5b1e2b2a-5555-4a3b-9c1a-000000000001", "mode": "reseau", "statut": "terminee", "livreur_id": "5b1e2b2a-1111-4a3b-9c1a-000000000030", "montant_final": 1500 }
    }
  ]
}
```

### GET `/marketplace/acheteur/commandes/show/{id}`

Détail d'une commande (accessible si l'utilisateur connecté est vendeur OU acheteur de cette commande), avec `livraisonMarketplace.offres`.

**Réponse 200**
```json
{
  "success": true,
  "commande": {
    "id": "5b1e2b2a-3333-4a3b-9c1a-000000000001",
    "acheteur_id": "5b1e2b2a-1111-4a3b-9c1a-000000000020",
    "vendeur_id": "5b1e2b2a-1111-4a3b-9c1a-000000000010",
    "montant_articles": 75000,
    "montant_commission_vendeur": 7500,
    "montant_commission_livreur": null,
    "statut": "livree",
    "mode_livraison": "reseau_livreurs",
    "payment_method_choisi": "mobile_money",
    "reference_paiement": "MM-240924-XYZ",
    "preuve_paiement_path": "marketplace/preuves-paiement/5b1e2b2a-3333-4a3b-9c1a-000000000001/abc.jpg",
    "paiement_confirme_par_id": "5b1e2b2a-1111-4a3b-9c1a-000000000010",
    "items": [{ "id": "...", "titre_snapshot": "Canapé 3 places", "prix_unitaire": 75000 }],
    "vendeur": { "id": "5b1e2b2a-1111-4a3b-9c1a-000000000010", "nom": "Kouassi", "prenoms": "Jean" },
    "acheteur": { "id": "5b1e2b2a-1111-4a3b-9c1a-000000000020", "nom": "Diallo", "prenoms": "Fatou" },
    "livraison_marketplace": {
      "id": "5b1e2b2a-5555-4a3b-9c1a-000000000001",
      "mode": "reseau",
      "statut": "terminee",
      "livreur_id": "5b1e2b2a-1111-4a3b-9c1a-000000000030",
      "montant_final": 1500,
      "offres": [
        { "id": "...", "livreur_id": "5b1e2b2a-1111-4a3b-9c1a-000000000030", "montant_propose": 1500, "statut": "acceptee" },
        { "id": "...", "livreur_id": "5b1e2b2a-1111-4a3b-9c1a-000000000031", "montant_propose": 1800, "statut": "refusee" }
      ]
    }
  }
}
```

**Réponse 404** : `{ "success": false, "message": "Commande introuvable." }`

---

## 5. Marketplace — Confirmation du paiement (vendeur)

Base : `/marketplace/vendeur`. Même middleware d'abonnement que la section 2.

Une fois que l'acheteur a déclaré son paiement, la commande est en statut `paiement_a_confirmer`. **Le vendeur doit vérifier lui-même** (a-t-il bien reçu l'argent mobile money, ou le cash) avant de confirmer — le backend ne vérifie rien automatiquement.

### POST `/marketplace/vendeur/ventes/{id}/paiement/confirmer`

Confirme la réception du paiement. La commande doit être en statut `paiement_a_confirmer`. **C'est cette action qui finalise réellement le paiement** : crée un enregistrement `Transaction` (journal, à titre indicatif — l'argent a déjà été réglé hors plateforme), passe la commande `payee`, passe le ou les articles `vendue`. Le choix du mode de livraison devient alors possible.

**Réponse 200**
```json
{
  "success": true,
  "message": "Paiement confirmé, commande payée.",
  "commande": {
    "id": "5b1e2b2a-3333-4a3b-9c1a-000000000001",
    "statut": "payee",
    "transaction_id": "5b1e2b2a-4444-4a3b-9c1a-000000000001",
    "payee_le": "2026-09-24T10:05:00.000000Z",
    "paiement_confirme_par_id": "5b1e2b2a-1111-4a3b-9c1a-000000000010"
  }
}
```

**Erreur 422** si rien à confirmer : `{ "success": false, "message": "Aucun paiement en attente de confirmation pour cette commande." }`

### POST `/marketplace/vendeur/ventes/{id}/paiement/infirmer`

Infirme la réception (le vendeur n'a rien reçu, ou une preuve invalide). La commande doit être en statut `paiement_a_confirmer`. Remet la commande en `en_attente_paiement` — l'acheteur peut re-déclarer un paiement (éventuellement avec un autre moyen).

**Réponse 200**
```json
{
  "success": true,
  "message": "Paiement infirmé, en attente de nouvelle déclaration.",
  "commande": { "id": "5b1e2b2a-3333-4a3b-9c1a-000000000001", "statut": "en_attente_paiement" }
}
```

**Erreur 422** : même message que `confirmer` si rien n'est en attente.

---

## 6. Marketplace — Choix et suivi de la livraison (vendeur)

Base : `/marketplace/vendeur` (mêmes routes que la section 2, même middleware d'abonnement). **Toutes ces routes nécessitent que la commande soit en statut `payee`** (donc après confirmation du paiement, section 5).

### GET `/marketplace/vendeur/ventes/list`

Liste des ventes du vendeur connecté, avec `items`, `acheteur:id,nom,prenoms`, `livraisonMarketplace`.

**Réponse 200**
```json
{
  "success": true,
  "commandes": [
    {
      "id": "5b1e2b2a-3333-4a3b-9c1a-000000000001",
      "acheteur_id": "5b1e2b2a-1111-4a3b-9c1a-000000000020",
      "vendeur_id": "5b1e2b2a-1111-4a3b-9c1a-000000000010",
      "montant_articles": 75000,
      "statut": "paiement_a_confirmer",
      "mode_livraison": null,
      "items": [{ "id": "...", "titre_snapshot": "Canapé 3 places", "prix_unitaire": 75000 }],
      "acheteur": { "id": "5b1e2b2a-1111-4a3b-9c1a-000000000020", "nom": "Diallo", "prenoms": "Fatou" },
      "livraison_marketplace": null
    }
  ]
}
```

### GET `/marketplace/vendeur/ventes/show/{id}`

Détail d'une vente (doit appartenir au vendeur connecté).

**Réponse 200** : même forme qu'un élément de la liste ci-dessus.

**Réponse 404** : `{ "success": false, "message": "Commande introuvable." }`

### POST `/marketplace/vendeur/ventes/{id}/livraison/reseau`

Choisit le mode réseau. La commande doit être en statut `payee` (sinon 422 : `"Cette commande n'est pas en attente de choix de livraison."`). Crée une `LivraisonMarketplace` (statut `en_attente`, mode `reseau`), diffuse la disponibilité à tous les livreurs du réseau du pays.

**Réponse 201**
```json
{
  "success": true,
  "message": "Livraison mise en attente sur le réseau.",
  "livraison": {
    "id": "5b1e2b2a-5555-4a3b-9c1a-000000000001",
    "commande_marketplace_id": "5b1e2b2a-3333-4a3b-9c1a-000000000001",
    "mode": "reseau",
    "statut": "en_attente",
    "livreur_id": null,
    "montant_final": null
  }
}
```

### POST `/marketplace/vendeur/ventes/{id}/livraison/direct`

Choisit un livreur directement et fixe le montant. La commande doit être en statut `payee`.

**Corps**
| Champ | Type | Requis |
|---|---|---|
| `livreur_id` | uuid | oui, doit exister dans `users` |
| `montant` | number | oui, ≥ 0 |

**Réponse 201**
```json
{
  "success": true,
  "message": "Livraison proposée au livreur.",
  "livraison": {
    "id": "5b1e2b2a-5555-4a3b-9c1a-000000000002",
    "commande_marketplace_id": "5b1e2b2a-3333-4a3b-9c1a-000000000001",
    "mode": "direct",
    "statut": "proposee",
    "livreur_id": "5b1e2b2a-1111-4a3b-9c1a-000000000030",
    "montant_propose_vendeur": 1500,
    "montant_final": 1500,
    "proposee_le": "2026-09-24T10:10:00.000000Z",
    "expire_le": "2026-09-24T10:25:00.000000Z"
  }
}
```
⚠️ **Changement de comportement** : la livraison passe désormais en `proposee`, pas `assignee`. Le livreur doit explicitement accepter avant que la livraison ne lui soit réellement confiée (délai 15 minutes, voir section 7.4). `code_validation_livraison` et le démarrage de l'abonnement marketplace du livreur sont **différés jusqu'à son acceptation** — ils n'ont plus lieu à cet appel. Si le livreur refuse ou ne répond pas dans le délai, la commande revient en statut `payee` et le vendeur peut re-choisir un mode de livraison.

### POST `/marketplace/vendeur/ventes/{id}/livraison/hors-plateforme`

Choisit le mode hors plateforme. Aucune `LivraisonMarketplace` créée, aucun code de validation.

**Réponse 200** : `{ "success": true, "message": "Livraison hors plateforme choisie.", "commande": { "...": "...", "mode_livraison": "hors_plateforme" } }`

### POST `/marketplace/vendeur/ventes/{id}/livraison/marquer-livree`

**Uniquement pour le mode hors plateforme.** Le vendeur confirme lui-même que la commande a été livrée. Déclenche le crédit informatif du solde vendeur (commission 10 % appliquée, voir [section 8](#8-marketplace--solde-vendeur-informatif)).

**Réponse 200** : `{ "success": true, "message": "Commande marquée comme livrée.", "commande": { "...": "...", "statut": "livree" } }`

### GET `/marketplace/vendeur/ventes/{id}/livraison/offres`

Liste les offres actives des livreurs sur la livraison associée à cette commande (mode réseau uniquement), triées par montant croissant.

**Réponse 200**
```json
{
  "success": true,
  "offres": [
    { "id": "5b1e2b2a-6666-4a3b-9c1a-000000000001", "livreur_id": "5b1e2b2a-1111-4a3b-9c1a-000000000030", "montant_propose": 1500, "statut": "active", "livreur": { "id": "5b1e2b2a-1111-4a3b-9c1a-000000000030", "nom": "Yao", "prenoms": "Paul" } }
  ]
}
```

### POST `/marketplace/vendeur/ventes/{id}/livraison/offres/{offreId}/accepter`

Le vendeur accepte une offre. Toutes les autres offres actives sur cette livraison passent automatiquement à `refusee`. La livraison passe à `assignee`, `montant_final` = montant de l'offre acceptée, un code de validation est généré sur la commande. **Déclenche le démarrage de l'abonnement marketplace du livreur choisi** (pas celui du vendeur connecté).

**Réponse 200** : `{ "success": true, "message": "Offre acceptée.", "livraison": { "...": "...", "statut": "assignee", "livreur_id": "...", "montant_final": 1500 } }`

---

## 7. Rôle du livreur DANS le module Marketplace (pas son parcours complet)

⚠️ **Cette section ne couvre que ce qu'un livreur fait dans le module Marketplace** (livrer les articles vendus entre clients). Elle ne documente ni son inscription/onboarding, ni ses missions d'expédition classiques (Interville/Extraville), ni ses notifications générales — ce parcours complet est documenté dans `docs/PARCOURS_LIVREUR_API.md`.

Base : `/marketplace/livreur`. **Protégé par le middleware d'abonnement** (voir section 9) pour les actions actives (proposer/accepter/refuser/démarrer/valider) : un livreur en retard de paiement reçoit 403 `ABONNEMENT_BLOQUE`. Le solde informatif (7.6) reste accessible même bloqué.

> Ne pas confondre avec les routes `expedition/livreur/missions-disponibles` (offres de livraison sur les expéditions Interville classiques) : système totalement distinct, aucun rapport avec la marketplace, documenté dans `PARCOURS_LIVREUR_API.md`.

### 7.1 GET `/marketplace/livreur/livraisons-disponibles`

Liste les `LivraisonMarketplace` en mode réseau, statut `en_attente`, **filtrées par ville de retrait du livreur** (ou ville/position passées en requête — voir tableau ci-dessous), avec adresses minimales (ville/quartier seulement, pas de contact ni adresse exacte — confidentialité tant que non assignée).

**Query params optionnels**
| Paramètre | Type | Effet |
|---|---|---|
| `ville` | string | Remplace la ville du profil livreur pour cette requête |
| `latitude`, `longitude` | numérique | Calcule `distance_km` jusqu'au point de retrait, filtre sur `zone_de_livraison_km` du profil, trie par distance croissante |

**Réponse 200**
```json
{
  "success": true,
  "livraisons": [
    {
      "id": "5b1e2b2a-5555-4a3b-9c1a-000000000001",
      "mode": "reseau",
      "statut": "en_attente",
      "retrait": { "ville": "Abidjan", "quartier": "Cocody" },
      "livraison": { "ville": "Abidjan", "quartier": "Marcory" },
      "commande": { "id": "...", "montant_articles": 150000, "nombre_articles": 2 },
      "distance_km": 3.2,
      "created_at": "2026-10-02T09:00:00.000000Z"
    }
  ]
}
```
Un livreur sans `ville` renseignée sur son profil continue de voir toutes les livraisons disponibles (pas de régression).

### 7.2 POST `/marketplace/livreur/livraisons/{id}/proposer`

Propose ou met à jour un prix sur une livraison en attente (mode réseau uniquement, la livraison doit encore être `en_attente`, sinon 404).

**Corps** : `{ "montant_propose": 1500 }` (requis, numérique, ≥ 0)

Idempotent : si le livreur avait déjà une offre active sur cette livraison, son montant est simplement mis à jour (pas de doublon).

**Réponse 201** : `{ "success": true, "message": "Offre enregistrée.", "offre": { "id": "...", "livraison_marketplace_id": "...", "livreur_id": "...", "montant_propose": 1500, "statut": "active" } }`

### 7.3 DELETE `/marketplace/livreur/livraisons/{id}/offre`

Retire l'offre active du livreur connecté sur cette livraison (statut passe à `retiree`).

**Réponse 200** : `{ "success": true, "message": "Offre retirée." }`

### 7.4 Accepter ou refuser une affectation directe (nouveau)

Quand le vendeur affecte directement un livreur (sans passer par le réseau d'offres, voir section 6 `livraison/direct`), la livraison passe désormais au statut **`proposee`** (pas `assignee`) avec un délai d'acceptation de **15 minutes**. Le livreur doit explicitement accepter ou refuser — contrairement au mode réseau où proposer une offre vaut déjà accord implicite.

**POST `/marketplace/livreur/livraisons/{id}/accepter`**

Passe la livraison en `assignee`, génère le code de validation sur la commande et **démarre l'abonnement marketplace du livreur** (idempotent) — ces deux effets sont désormais différés jusqu'à cette acceptation, ils n'ont plus lieu à l'affectation par le vendeur.

**Réponse 200** : `{ "success": true, "message": "Livraison acceptée.", "livraison": { "id": "...", "statut": "assignee", "acceptee_le": "...", "...": "..." } }`

**Erreurs**
| Cas | Code | Message |
|---|---|---|
| Livraison pas `proposee` à ce livreur | 404 | `Livraison non trouvée.` |
| Délai dépassé (`expire_le` passé) | 422 | `Cette proposition a expiré.` |
| `users.disponible = false` | 422 | `Vous devez être disponible pour accepter une livraison.` |

**POST `/marketplace/livreur/livraisons/{id}/refuser`**

Corps : `{ "motif": "Trop loin" }` (optionnel, max 255). Passe la livraison en `refusee`, remet la commande en statut `payee` — le vendeur peut alors choisir à nouveau un mode de livraison (réseau ou direct avec un autre livreur).

**Réponse 200** : `{ "success": true, "message": "Livraison refusée." }`

**Expiration automatique** : sans réponse du livreur dans les 15 minutes, une tâche planifiée serveur traite la livraison comme refusée (`motif_refus = "Expiré"`), sans action de l'app.

### 7.5 POST `/marketplace/livreur/livraisons/{id}/demarrer`

Le livreur démarre la course (il va récupérer l'article chez le vendeur). La livraison doit lui être assignée (statut `assignee`), sinon 422 : `"Cette livraison ne peut pas être démarrée."`. Passe la livraison en statut `en_cours`.

**Corps (multipart/form-data, nouveau — preuve de retrait optionnelle)**
| Champ | Type | Requis |
|---|---|---|
| `photo` | fichier image (jpeg/png/jpg/webp, max 5 Mo) | non |
| `signature` | string (base64) | non |
| `latitude` | numérique (-90 à 90) | non |
| `longitude` | numérique (-180 à 180) | non |

Si au moins un champ est fourni, une preuve structurée (étape `retrait`) est enregistrée et horodatée côté serveur — visible par le vendeur (section 6).

**Réponse 200** : `{ "success": true, "message": "Livraison démarrée.", "livraison": { "...": "...", "statut": "en_cours" } }`

### 7.6 POST `/marketplace/livreur/livraisons/{id}/valider`

Valide la livraison par code + preuve.

**Corps (multipart/form-data)**
| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `code` | string | oui | doit correspondre exactement à `code_validation_livraison` de la commande |
| `preuve` | file | non | **ancien nom, conservé pour compatibilité** — alias de `photo` |
| `photo` | file | non | image jpeg/png/jpg/webp, max 5 Mo (nouveau nom, aligné sur le reste de l'API) |
| `signature` | string (base64) | non | nouveau |
| `latitude` | numérique (-90 à 90) | non | nouveau |
| `longitude` | numérique (-180 à 180) | non | nouveau |

**Erreur 422 si code incorrect** : `{ "success": false, "message": "Code de validation incorrect." }`

**Réponse 200 si succès**
```json
{
  "success": true,
  "message": "Livraison validée.",
  "commande": {
    "id": "5b1e2b2a-3333-4a3b-9c1a-000000000001",
    "statut": "livree",
    "preuve_livraison_path": "marketplace/preuves/5b1e2b2a-3333-4a3b-9c1a-000000000001/xxx.jpg",
    "livraison_validee_le": "2026-09-24T11:00:00.000000Z"
  }
}
```
Si `signature`/`latitude`/`longitude` fournis (avec ou sans photo), une seconde preuve structurée (étape `remise`) est enregistrée en plus de l'ancien `preuve_livraison_path`. Déclenche le crédit informatif du solde vendeur (commission 10 % déduite).

### 7.7 GET `/marketplace/livreur/livraisons/mes-livraisons`

Historique des livraisons assignées au livreur connecté (tous statuts), avec adresses et contacts complets (voir 7.8 pour le détail).

**Réponse 200**
```json
{
  "success": true,
  "livraisons": [
    {
      "id": "5b1e2b2a-5555-4a3b-9c1a-000000000001",
      "mode": "reseau",
      "statut": "terminee",
      "montant_final": 1500,
      "retrait": { "nom": "Kouassi Jean", "telephone": "+2250701020304", "adresse": "Rue des Jardins", "quartier": "Cocody", "ville": "Abidjan", "latitude": 5.3599, "longitude": -3.9870 },
      "livraison": { "nom": "Fatou Diallo", "telephone": "+2250705060708", "adresse": "Rue du Docteur Blanchard", "quartier": "Zone 4", "ville": "Abidjan", "latitude": 5.2970, "longitude": -3.9960, "instructions": "Sonner au portail bleu" },
      "commande": { "id": "5b1e2b2a-3333-4a3b-9c1a-000000000001", "montant_articles": 75000, "items": [{ "titre_snapshot": "Canapé 3 places", "prix_unitaire": 75000 }] },
      "created_at": "2026-09-24T10:00:00.000000Z",
      "assignee_le": "2026-09-24T10:20:00.000000Z"
    }
  ]
}
```

### 7.8 GET `/marketplace/livreur/livraisons/{id}` (nouveau — détail)

Détail d'une livraison assignée au livreur connecté, même forme qu'un élément de `mes-livraisons` ci-dessus (adresses/contacts/articles complets). **404 si la livraison n'est pas assignée au livreur connecté** — ces informations ne sont jamais exposées à un autre livreur.

### 7.9 Solde marketplace informatif du livreur (nouveau)

Distinct du solde réel des missions classiques (`users.solde_livreur`, voir `PARCOURS_LIVREUR_API.md` 4.7) — ici c'est le même principe que le solde vendeur (section 8) : **purement informatif, aucun argent réel transite par la plateforme**. Accessible même si le livreur est bloqué pour abonnement (hors middleware).

**GET `/marketplace/livreur/solde`**
```json
{ "success": true, "solde_marketplace": 4500 }
```

**GET `/marketplace/livreur/solde/historique`**
Une ligne par livraison marketplace terminée, montant = commission informative calculée pour le livreur (actuellement 0 % par défaut, configurable).
```json
{
  "success": true,
  "historique": [
    { "livraison_id": "5b1e2b2a-5555-4a3b-9c1a-000000000001", "montant": 0, "date": "2026-09-24T11:00:00.000000Z" }
  ]
}
```

---

## 8. Marketplace — Solde vendeur (informatif)

Base : `/marketplace` (accessible au type `CLIENT` uniquement, **pas** derrière le middleware d'abonnement — un vendeur bloqué doit pouvoir consulter son solde).

**⚠️ Ce solde ne représente jamais de l'argent détenu par la plateforme.** Il sert uniquement à donner au vendeur une vision de ses ventes cumulées (montant vendu moins commission), à titre indicatif. Il n'existe **aucune route de retrait** — l'argent a déjà été réglé directement entre acheteur/livreur et vendeur, hors application.

### GET `/marketplace/solde`

**Réponse 200** : `{ "success": true, "solde_marketplace": 135000 }`

### GET `/marketplace/solde/historique`

Liste les crédits informatifs (une ligne par vente livrée), triés par date décroissante.

**Réponse 200**
```json
{
  "success": true,
  "historique": [
    {
      "type": "credit",
      "montant": 67500,
      "date": "2026-09-24T11:00:00.000000Z",
      "detail": {
        "id": "5b1e2b2a-7777-4a3b-9c1a-000000000001",
        "vendeur_id": "5b1e2b2a-1111-4a3b-9c1a-000000000010",
        "commande_marketplace_id": "5b1e2b2a-3333-4a3b-9c1a-000000000001",
        "montant_vente": 75000,
        "taux_commission": 10,
        "montant_commission": 7500,
        "montant_credite": 67500,
        "commande": { "id": "5b1e2b2a-3333-4a3b-9c1a-000000000001", "montant_articles": 75000 }
      }
    }
  ]
}
```

---

## 9. Abonnement marketplace

### 9.1 Pourquoi ce module existe

Vendeurs et livreurs qui utilisent activement la marketplace paient une commission périodique (abonnement) pour continuer à utiliser le service — c'est le **seul** flux d'argent réel géré par le backoffice dans tout le module marketplace (voir [1.2](#12-largent-circule-toujours-hors-application)). Ce n'est **pas** lié à l'inscription : un client qui ne publie jamais d'annonce, ou un livreur qui ne livre jamais sur la marketplace, ne paie rien.

### 9.2 Quand l'abonnement démarre

| Type d'utilisateur | Déclencheur du démarrage |
|---|---|
| Vendeur (`CLIENT`) | Première publication d'annonce (`POST .../annonces/{id}/publier`) |
| Livreur (`LIVREUR`) | Première offre acceptée par un vendeur (mode réseau) OU première assignation directe (mode direct) |

Le démarrage est **automatique et invisible** pour l'utilisateur — pas d'action explicite à faire. Le frontend n'a rien à déclencher : c'est un effet de bord des routes déjà décrites plus haut. En revanche, il faut **afficher le statut d'abonnement** (section 9.5) pour informer l'utilisateur.

Si le backoffice n'a configuré aucun montant pour ce type d'abonné (`montant_vendeur` ou `montant_livreur` = 0), **aucun abonnement n'est créé** — l'utilisateur n'est jamais assujetti.

### 9.3 Cycle de vie d'une échéance

```
A_PAYER ──(J-2 avant periode_fin)──> RAPPEL_ENVOYE ──(non payé après periode_fin)──> EN_RETARD
   │                                        │                                            │
   └──(paiement déclaré, mais pas encore validé backoffice)──> reste inchangé jusqu'à validation
                                                                          │
                                                                          ▼
                                                                       PAYEE (uniquement après validation backoffice)
```

- `a_payer` : échéance créée, rien envoyé encore.
- `rappel_envoye` : notification push + email envoyée automatiquement (cron quotidien, 06h00) quand on atteint `periode_fin - delai_rappel_jours` (2 jours par défaut, configurable par backoffice).
- `en_retard` : la date d'échéance (`periode_fin`) est dépassée sans paiement validé. **L'utilisateur est bloqué à ce moment précis** (voir 9.6).
- `payee` : le backoffice a **validé manuellement** le paiement. Une nouvelle échéance est générée immédiatement, avec `periode_debut` = **ancienne `periode_fin`** (pas la date réelle du paiement — évite de décaler le cycle si l'utilisateur paie en avance).

**Important** : déclarer un paiement (9.7) ne change PAS le statut de l'échéance et ne débloque PAS l'utilisateur. Seule la validation par le backoffice (9.8, hors scope de l'app cliente/livreur — action backoffice) fait passer l'échéance à `payee` et débloque l'accès.

### 9.4 Cycle de vie d'un paiement déclaré (`PaiementAbonnement.statut`)

```
EN_ATTENTE ──(backoffice valide)──> VALIDE   (débloque l'utilisateur, échéance → PAYEE)
     │
     └──(backoffice rejette)──> REJETE   (utilisateur reste bloqué, peut re-déclarer sur la même échéance)
```

Une re-déclaration après un rejet **réutilise la même ligne** `PaiementAbonnement` (contrainte : un seul paiement par échéance) — repasse simplement en `EN_ATTENTE` avec les nouvelles données.

### 9.5 GET `/abonnement/statut`

**Accessible même si l'utilisateur est bloqué** (volontairement hors middleware — sinon un utilisateur bloqué ne pourrait jamais voir pourquoi ni tenter de se débloquer). Réservé aux types `CLIENT` et `LIVREUR`.

**Réponse si aucun abonnement démarré**
```json
{ "success": true, "abonnement": null, "echeance_courante": null }
```

**Réponse si abonnement actif**
```json
{
  "success": true,
  "abonnement": {
    "id": "5b1e2b2a-8888-4a3b-9c1a-000000000001",
    "user_id": "5b1e2b2a-1111-4a3b-9c1a-000000000010",
    "backoffice_id": "5b1e2b2a-1111-4a3b-9c1a-000000000099",
    "type_abonne": "vendeur",
    "demarre_le": "2026-01-01T10:00:00.000000Z",
    "periodicite_jours": 30,
    "montant": 5000
  },
  "echeance_courante": {
    "id": "5b1e2b2a-9999-4a3b-9c1a-000000000001",
    "abonnement_marketplace_id": "5b1e2b2a-8888-4a3b-9c1a-000000000001",
    "periode_debut": "2026-01-01T10:00:00.000000Z",
    "periode_fin": "2026-01-31T10:00:00.000000Z",
    "montant": 5000,
    "statut": "a_payer",
    "notifie_le": null,
    "payee_le": null,
    "bloque_le": null
  },
  "bloque": false
}
```
`echeance_courante` est la première échéance non soldée (`a_payer`, `rappel_envoye` ou `en_retard`), triée par `periode_fin` croissant. `bloque` reflète directement `users.bloque_pour_abonnement`.

**Usage frontend recommandé** : appeler cette route au chargement de l'app (ou de l'écran marketplace) pour un vendeur/livreur, et afficher un bandeau si `echeance_courante.statut` est `rappel_envoye` ou `en_retard`, ou si `bloque` est `true`.

### 9.6 Blocage d'accès

Si `bloquerEcheancesEnRetard` (cron quotidien) détecte une échéance `periode_fin` dépassée sans paiement **validé** :
- `users.bloque_pour_abonnement` passe à `true`
- **Tous les tokens Sanctum de l'utilisateur sont révoqués immédiatement** (déconnexion forcée)
- Toutes les routes `marketplace/vendeur/*` et `marketplace/livreur/*` renvoient **403** :
```json
{
  "success": false,
  "message": "Votre abonnement marketplace est en retard de paiement. Veuillez régulariser pour continuer.",
  "code": "ABONNEMENT_BLOQUE"
}
```
- **Le reste de l'application reste utilisable** (expéditions, Interville, etc.) — le blocage est strictement scopé au module marketplace.
- Les routes `/abonnement/*` (statut, historique, déclarer-paiement) et `marketplace/acheteur/*` restent accessibles.

**Important pour le frontend** : comme les tokens sont révoqués, un appel API sur une route marketplace/vendeur ou marketplace/livreur peut renvoyer soit un **401** (token révoqué, session expirée) soit un **403 `ABONNEMENT_BLOQUE`** (si l'utilisateur s'est reconnecté entre-temps avec un nouveau token). Le frontend doit intercepter le code `ABONNEMENT_BLOQUE` spécifiquement (pas juste le statut HTTP 403) pour distinguer ce cas d'un 403 d'autorisation classique, et rediriger vers un écran de régularisation plutôt qu'un écran d'erreur générique.

### 9.7 GET `/abonnement/historique`

Historique paginé de toutes les échéances de l'utilisateur connecté, avec le paiement associé le cas échéant.

**Query** : `per_page` (défaut 20)

**Réponse 200** : pagination Laravel standard, `historique.data[]` = tableau d'`EcheanceAbonnement` avec relation `paiement` chargée (`null` si pas encore de paiement déclaré).
```json
{
  "success": true,
  "historique": {
    "current_page": 1,
    "data": [
      {
        "id": "5b1e2b2a-9999-4a3b-9c1a-000000000001",
        "periode_debut": "2026-01-01T10:00:00.000000Z",
        "periode_fin": "2026-01-31T10:00:00.000000Z",
        "montant": 5000,
        "statut": "payee",
        "payee_le": "2026-01-29T08:00:00.000000Z",
        "paiement": {
          "id": "5b1e2b2a-aaaa-4a3b-9c1a-000000000001",
          "montant": 5000,
          "methode": "mobile_money",
          "reference_transaction": "REF123",
          "preuve_url": "abonnements/preuves/5b1e2b2a-9999-4a3b-9c1a-000000000001/xxx.jpg",
          "statut": "valide",
          "valide_par_id": "5b1e2b2a-1111-4a3b-9c1a-000000000050",
          "valide_le": "2026-01-29T09:00:00.000000Z",
          "commentaire_backoffice": null
        }
      }
    ],
    "total": 3,
    "per_page": 20,
    "last_page": 1
  }
}
```

### 9.8 POST `/abonnement/{echeanceId}/declarer-paiement`

L'utilisateur déclare avoir payé son abonnement **hors application**, vers un compte communiqué par le backoffice, et fournit une preuve. **Ne débloque PAS immédiatement l'accès** — le déblocage n'intervient qu'après validation manuelle par le backoffice (action côté outil backoffice, hors scope de cette doc app cliente/livreur).

**Corps (multipart/form-data si preuve)**
| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `methode` | string | oui | une valeur de `PaymentMethod` |
| `reference_transaction` | string | non | max 255 |
| `preuve` | file | non | image jpeg/png/jpg/webp, max 5 Mo (capture d'écran de la transaction) |

**Réponse 201**
```json
{
  "success": true,
  "message": "Paiement déclaré, en attente de validation par le backoffice.",
  "paiement": {
    "id": "5b1e2b2a-aaaa-4a3b-9c1a-000000000001",
    "echeance_abonnement_id": "5b1e2b2a-9999-4a3b-9c1a-000000000001",
    "user_id": "5b1e2b2a-1111-4a3b-9c1a-000000000010",
    "montant": 5000,
    "methode": "mobile_money",
    "reference_transaction": "REF123",
    "preuve_url": "abonnements/preuves/5b1e2b2a-9999-4a3b-9c1a-000000000001/xxx.jpg",
    "statut": "en_attente",
    "valide_par_id": null,
    "valide_le": null
  }
}
```

**Erreur 422 si échéance déjà payée** : `{ "success": false, "message": "Cette échéance a déjà été payée." }`
**Erreur 404** si l'échéance n'existe pas ou n'appartient pas à l'utilisateur connecté.

**Usage frontend recommandé** : après cet appel, afficher un état "en attente de validation" (pas "débloqué"). Continuer à appeler `GET /abonnement/statut` périodiquement (ou au retour dans l'app) pour détecter le passage effectif à `bloque: false` une fois le backoffice passé par là. Un paiement peut aussi être rejeté (`paiement.statut === "rejete"`, visible via l'historique 9.7, avec `commentaire_backoffice` expliquant pourquoi) — dans ce cas, permettre à l'utilisateur de re-déclarer un paiement sur la même échéance via ce même endpoint.

---

## 10. Workflows complets

### 10.1 Vente simple, livraison réseau

```
Vendeur : POST annonces/store (brouillon)
Vendeur : POST annonces/{id}/publier
          → annonce visible catalogue acheteur
          → [effet de bord] démarrage abonnement vendeur si 1ère publication
Vendeur : POST moyens-paiement/store { methode: mobile_money, numero_destinataire, libelle }
          (une fois, valable pour toutes ses annonces)

Acheteur : GET catalogue/list → choisit article(s) (n'affiche pas ses propres annonces comme achetables)
Acheteur : GET vendeurs/{vendeurId}/moyens-paiement → affiche les options de paiement du vendeur
Acheteur : POST panier/valider { annonce_ids: [...] }
           → 1 commande par vendeur, statut en_attente_paiement
Acheteur : (paie le vendeur hors application, ex. mobile money ou cash à la livraison)
Acheteur : POST commandes/{id}/declarer-paiement { payment_method, reference, preuve? }
           → statut paiement_a_confirmer (PAS encore payee, annonce toujours publiee)

Vendeur : (vérifie avoir bien reçu l'argent)
Vendeur : POST ventes/{id}/paiement/confirmer
          → statut payee, annonce passe vendue, Transaction créée (journal)
          (ou POST ventes/{id}/paiement/infirmer si rien reçu → retour en_attente_paiement, acheteur re-déclare)

Vendeur : POST ventes/{id}/livraison/reseau
          → LivraisonMarketplace créée, statut en_attente, diffusée à tous les livreurs du pays

Livreur A : GET livraisons-disponibles → voit la livraison
Livreur A : POST livraisons/{id}/proposer { montant_propose }
Livreur B : POST livraisons/{id}/proposer { montant_propose }   (offre concurrente)

Vendeur : GET ventes/{id}/livraison/offres → compare les offres
Vendeur : POST ventes/{id}/livraison/offres/{offreId}/accepter
          → offre A acceptée, offre B auto-refusée, livraison assignee, code généré
          → [effet de bord] démarrage abonnement livreur A si 1ère offre acceptée

Acheteur : communique le code à Livreur A à la remise

Livreur A : POST livraisons/{id}/demarrer   (récupération chez le vendeur)
Livreur A : POST livraisons/{id}/valider { code, preuve? }
            → commande livree, solde vendeur crédité (informatif, commission 10% déduite)
```

### 10.2 Vente avec livreur direct

Identique à 10.1 jusqu'à la confirmation du paiement (étape vendeur `ventes/{id}/paiement/confirmer`), puis :
```
Vendeur : POST ventes/{id}/livraison/direct { livreur_id, montant }
          → livraison assignee immédiatement, code généré
          → [effet de bord] démarrage abonnement de ce livreur si 1ère assignation

Livreur : POST livraisons/{id}/demarrer
Livreur : POST livraisons/{id}/valider { code, preuve? }
```

### 10.3 Vente hors plateforme

```
Vendeur : POST ventes/{id}/livraison/hors-plateforme
          → mode_livraison = hors_plateforme, pas de code, pas de LivraisonMarketplace

Vendeur : (livre lui-même en dehors de l'app)
Vendeur : POST ventes/{id}/livraison/marquer-livree
          → commande livree, solde vendeur crédité (informatif) directement
```

### 10.4 Cycle de vie de l'abonnement (vu du frontend)

```
Jour 0  : vendeur publie sa 1ère annonce → abonnement créé en interne, échéance à J+30, statut a_payer
          (rien à afficher de spécial pour l'instant)

Jour 28 (J-2) : cron envoie push + email "échéance proche"
                → GET /abonnement/statut renvoie désormais echeance_courante.statut = "rappel_envoye"
                → frontend affiche un bandeau d'alerte non bloquant

Jour 30+ (non payé) : cron marque EN_RETARD, bloque l'utilisateur, révoque ses tokens
                       → tout appel marketplace/vendeur/* ou /livreur/* renvoie 403 ABONNEMENT_BLOQUE (ou 401 si token déjà expiré)
                       → frontend redirige vers écran de régularisation, affichant echeance_courante.montant

Utilisateur : (paie hors application vers le compte communiqué par le backoffice)
Utilisateur : POST /abonnement/{echeanceId}/declarer-paiement { methode, reference_transaction, preuve? }
              → paiement.statut = en_attente, utilisateur TOUJOURS bloqué
              → frontend affiche "en attente de validation par le backoffice"

[le backoffice vérifie la preuve et valide ou rejette, action hors scope app cliente]

Si validé : GET /abonnement/statut → bloque devient false, nouvelle échéance générée
            → frontend redemande une connexion si un appel suivant renvoie 401 (tokens révoqués au moment du blocage)

Si rejeté : GET /abonnement/historique → dernier paiement.statut = "rejete", commentaire_backoffice renseigné
            → frontend affiche le motif, permet de re-déclarer via le même endpoint declarer-paiement
```

---

## 11. Codes d'erreur et cas particuliers

| Situation | Code HTTP | Corps |
|---|---|---|
| Champ de validation manquant/invalide | 422 | `{ success: false, errors: {...} }` (format Laravel Validator) |
| Ressource introuvable ou n'appartenant pas à l'utilisateur | 404 | `{ success: false, message: "... introuvable." }` |
| Utilisateur du mauvais type (`CLIENT` attendu, `LIVREUR` reçu, etc.) | 403 | `{ success: false, message: "Non autorisé." }` |
| Vendeur/livreur bloqué pour retard d'abonnement | 403 | `{ success: false, message: "...", code: "ABONNEMENT_BLOQUE" }` |
| Action sur une commande déjà traitée / en attente de confirmation | 422 | `{ success: false, message: "Cette commande a déjà été traitée ou est en attente de confirmation." }` |
| Rien à confirmer/infirmer sur une commande | 422 | `{ success: false, message: "Aucun paiement en attente de confirmation pour cette commande." }` |
| Tentative d'achat de sa propre annonce | 422 | `{ success: false, message: "Vous ne pouvez pas acheter votre propre annonce : ..." }` |
| Code de validation de livraison incorrect | 422 | `{ success: false, message: "Code de validation incorrect." }` |
| Article déjà vendu au moment de valider le panier | 422 | `{ success: false, message: "Article(s) déjà vendu(s) ou indisponible(s) : ..." }` |
| Adresse de livraison manquante ou incomplète (`panier/valider`) | 422 | `{ success: false, errors: { "adresse_livraison.*": [...] } }` |
| Livraison proposée introuvable, déjà traitée ou pas à ce livreur | 404 | `{ success: false, message: "Livraison non trouvée." }` |
| Proposition de livraison expirée (délai 15 min dépassé) | 422 | `{ success: false, message: "Cette proposition a expiré." }` |
| Erreur serveur inattendue | 500 | `{ success: false, message: "Erreur serveur.", errors: "..." }` |

### Limitation connue : bascule interville d'une livraison marketplace

Le cahier des charges (workflow 8.4, étape 8) prévoit qu'une livraison marketplace sur un trajet intervilles bascule vers le système de missions d'expédition (workflow 8.1 puis 8.3 pour le dernier segment). **Ce comportement n'est pas implémenté à ce jour** : une `LivraisonMarketplace` reste toujours un segment unique porté par un seul livreur, du retrait chez le vendeur jusqu'à la remise à l'acheteur, quelle que soit la distance réelle entre les deux villes. Aucune relation entre `LivraisonMarketplace` et `Mission`/`Expedition` n'existe dans le code. Si ce besoin devient prioritaire, il nécessitera une clarification métier (comment découper les deux segments, qui porte le second) avant implémentation.

**Notifications temps réel** : plusieurs actions diffusent un événement WebSocket (paiement déclaré, paiement confirmé, nouvelle livraison disponible, offre acceptée/refusée, livraison démarrée/livrée) sur des canaux nommés `client.{id}`, `livreur.{id}`, `livreurs.reseau`. Si l'app cliente/livreur écoute déjà ces canaux pour le système d'expédition classique, le même mécanisme s'applique ici — se rapprocher de l'équipe backend pour la liste exacte des noms d'événements si un affichage temps réel est prévu côté marketplace.

**Devise** : `devise` sur `AnnonceMarketplace` est un champ libre par défaut `XOF`, purement informatif à ce stade — aucune conversion automatique n'est appliquée dans le flux marketplace (contrairement au module expédition qui a un système de conversion dédié).

---

## 12. Annexe — Routes backoffice (contexte, pas à intégrer côté app cliente/livreur)

Ces routes tournent dans l'outil backoffice, pas dans l'app cliente/livreur. Elles sont documentées ici pour que le dev frontend comprenne **pourquoi** une commande ou une échéance change d'état sans action explicite de l'utilisateur (le backoffice agit dessus de son côté).

### Modération marketplace — `/marketplace/backoffice`

- `GET /marketplace/backoffice/annonces/list` (filtre `statut`, paginé) et `POST /marketplace/backoffice/annonces/{id}/masquer` — passe une annonce en `masquee`, elle disparaît immédiatement du catalogue acheteur.
- `GET /marketplace/backoffice/commandes/list` (filtre `statut`, paginé) et `GET /marketplace/backoffice/commandes/show/{id}` — supervision en lecture seule des commandes, y compris leur `Transaction` associée une fois confirmées.

Aucune de ces routes ne modifie le statut d'une commande (hormis le masquage d'annonce) — le cycle de vie de la commande reste entièrement piloté par l'acheteur/le vendeur.

### Configuration de l'abonnement — `/abonnement/backoffice/settings`

Un enregistrement par backoffice (`AbonnementSetting`), lu/modifié par le backoffice pour fixer les montants et délais.

**GET `/abonnement/backoffice/settings`**
```json
{
  "success": true,
  "setting": {
    "id": "5b1e2b2a-bbbb-4a3b-9c1a-000000000001",
    "backoffice_id": "5b1e2b2a-1111-4a3b-9c1a-000000000099",
    "montant_vendeur": 5000,
    "montant_livreur": 3000,
    "periodicite_jours": 30,
    "delai_rappel_jours": 2
  }
}
```
Si aucune config n'existe encore pour ce backoffice, `setting` renvoie des valeurs par défaut à 0 (`montant_vendeur: 0, montant_livreur: 0`) — dans ce cas, `demarrerSiNecessaire` ne crée jamais d'abonnement (voir 9.2), donc aucun utilisateur de ce backoffice n'est assujetti tant que ces montants restent à 0.

**PUT `/abonnement/backoffice/settings`** — corps `{ montant_vendeur, montant_livreur, periodicite_jours, delai_rappel_jours }` (tous requis), réponse `{ "success": true, "message": "Configuration de l'abonnement mise à jour.", "setting": {...} }`.

### Suivi des échéances et paiements — `/abonnement/backoffice`

**GET `/abonnement/backoffice/echeances`** (filtres `statut`, `type_abonne`, `user_id`, paginé)
```json
{
  "success": true,
  "echeances": {
    "current_page": 1,
    "data": [
      {
        "id": "5b1e2b2a-9999-4a3b-9c1a-000000000001",
        "user_id": "5b1e2b2a-1111-4a3b-9c1a-000000000010",
        "periode_debut": "2026-01-01T10:00:00.000000Z",
        "periode_fin": "2026-01-31T10:00:00.000000Z",
        "montant": 5000,
        "statut": "en_retard",
        "bloque_le": "2026-01-31T10:00:00.000000Z",
        "user": { "id": "5b1e2b2a-1111-4a3b-9c1a-000000000010", "nom": "Kouassi", "prenoms": "Jean", "telephone": "+2250700000000" },
        "abonnement": { "id": "...", "type_abonne": "vendeur", "backoffice_id": "5b1e2b2a-1111-4a3b-9c1a-000000000099" },
        "paiement": {
          "id": "5b1e2b2a-aaaa-4a3b-9c1a-000000000001",
          "statut": "en_attente",
          "methode": "mobile_money",
          "reference_transaction": "REF123",
          "preuve_url": "abonnements/preuves/5b1e2b2a-9999-4a3b-9c1a-000000000001/xxx.jpg"
        }
      }
    ],
    "total": 1, "per_page": 20, "last_page": 1
  }
}
```

**GET `/abonnement/backoffice/echeances/{id}`** — même forme qu'un élément de la liste, avec en plus `paiement.validateur:id,nom,prenoms` si déjà traité.

**POST `/abonnement/backoffice/paiements/{id}/valider`** — valide le paiement, débloque l'utilisateur, génère la période suivante (voir 9.3/9.4).
```json
{
  "success": true,
  "message": "Paiement validé.",
  "paiement": {
    "id": "5b1e2b2a-aaaa-4a3b-9c1a-000000000001",
    "statut": "valide",
    "valide_par_id": "5b1e2b2a-1111-4a3b-9c1a-000000000050",
    "valide_le": "2026-01-29T09:00:00.000000Z"
  }
}
```

**POST `/abonnement/backoffice/paiements/{id}/rejeter`** — corps `{ "commentaire": "Preuve illisible" }` (optionnel, max 1000). Ne débloque pas, l'échéance reste `en_retard`/`a_payer`.
```json
{
  "success": true,
  "message": "Paiement rejeté.",
  "paiement": {
    "id": "5b1e2b2a-aaaa-4a3b-9c1a-000000000001",
    "statut": "rejete",
    "valide_par_id": "5b1e2b2a-1111-4a3b-9c1a-000000000050",
    "valide_le": "2026-01-29T09:00:00.000000Z",
    "commentaire_backoffice": "Preuve illisible"
  }
}
```
