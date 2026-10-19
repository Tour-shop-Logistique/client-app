# Marketplace — Nouveaux modes de livraison (3 modes)

**Date** : 2026-10-19  
**Concerne** : App client (vendeur + acheteur), app livreur

---

## Résumé des changements

Le système d'offres livreur (proposer/retirer/accepter une offre) est **supprimé**. Il est remplacé par trois modes à prix calculé ou défini à l'avance :

| Mode | Qui livre | Prix | Comment ça marche |
|------|-----------|------|-------------------|
| `standard` | Livreur backoffice | Grille km backoffice | Le backoffice assigne un livreur via son interface |
| `express` | N'importe quel livreur du réseau | Standard × taux express | Diffusé au réseau, premier arrivé premier servi |
| `livreur_magasin` | Livreur propre du vendeur | Défini par le vendeur par commune | Sur plateforme (livreur proposé) ou hors plateforme |

L'acheteur voit les **3 prix avant de commander**, pas seulement après. Le mode `livreur_magasin` n'apparaît que si le vendeur a défini des tarifs.

---

## Nouvelles colonnes

### Annonce (`AnnonceMarketplace`)
- `commune_id` — UUID nullable : commune de retrait/départ de l'annonce (utile pour la grille km)

### Commande (`CommandeMarketplace`)
- `commune_livraison_id` — UUID nullable : commune de destination (utile pour la grille km et le tarif vendeur)
- `livreur_magasin_id` — UUID nullable : livreur sur plateforme désigné par le vendeur (mode livreur_magasin seulement)
- `montant_livraison` — décimal : maintenant renseigné automatiquement à la création de la livraison

---

## Flux acheteur

### 1. Obtenir les 3 tarifs avant commande

```
GET /api/marketplace/acheteur/tarifs-livraison
?vendeur_id=<uuid>
&commune_depart_id=<uuid>
&commune_arrivee_id=<uuid>
&distance_km=2.4
Authorization: Bearer <token>
```

> **Note :** `distance_km` ici sert à estimer les tarifs AVANT commande. Lors du **choix effectif** du mode, envoyer à nouveau `distance_km` — c'est cette valeur qui est utilisée pour facturer (même logique que dans les expéditions classiques).

**Réponse 200 :**
```json
{
  "success": true,
  "tarifs": {
    "standard": 1500,
    "express": 2250,
    "livreur_magasin": 2000
  }
}
```

- Un champ à `null` = mode indisponible (aucun tarif défini ou taux express non configuré).
- `livreur_magasin` à `null` = le vendeur n'a pas de livreur propre → ne pas afficher cette option.

### 2. Savoir si le vendeur a des tarifs livreur (pour décider d'afficher l'option)

```
GET /api/marketplace/acheteur/vendeurs/{vendeurId}/tarifs-livraison
```

**Réponse 200 :**
```json
{
  "success": true,
  "tarifs": [
    {
      "id": "uuid",
      "commune_destination_id": "uuid",
      "montant": 2000,
      "commune_destination": { "id": "uuid", "nom": "YOPOUGON" }
    }
  ]
}
```

Liste vide = pas de mode livreur_magasin disponible pour ce vendeur.

### 3. Valider le panier

Inchangé — `POST /api/marketplace/acheteur/panier/valider`. L'acheteur fournit l'adresse de livraison (ville + `livraison_latitude`/`longitude` recommandés pour le fallback GPS).

> La `commune_livraison_id` et `distance_km` **ne sont pas** envoyées au panier — elles sont envoyées lors du choix du mode.

### 4. Choisir le mode de livraison

Voir la section **Flux acheteur — choisir le mode de livraison** ci-dessous.

---

## Flux acheteur — choisir le mode de livraison

Après confirmation du paiement par le vendeur (`POST /api/marketplace/vendeur/ventes/{id}/paiement/confirmer`), c'est **l'acheteur** qui choisit son mode de livraison. Il a vu les 3 prix en amont et sélectionne le mode qui lui convient.

> **Important :** L'acheteur fournit uniquement sa `commune_livraison_id` (UUID sélectionné depuis une liste dans l'UI, jamais du texte libre). Le serveur dérive tout le reste : commune de départ (depuis l'annonce) et distance (depuis les coordonnées GPS stockées).

### Mode standard

```
POST /api/marketplace/acheteur/commandes/{id}/livraison/standard
Content-Type: application/json
Authorization: Bearer <token>

{
  "commune_livraison_id": "<uuid>",
  "distance_km": 2.4
}
```

- `distance_km` : calculée par l'app via OSM — utilisée pour trouver la tranche tarifaire. Optionnelle (fallback GPS si absente).
- Le serveur dérive `commune_depart_id` depuis la commune de l'annonce.

**Réponse 201 :**
```json
{
  "success": true,
  "message": "Livraison standard sélectionnée.",
  "livraison": { "id": "...", "mode": "standard", "statut": "en_attente", "montant_final": 1500 }
}
```

Le backoffice voit cette livraison dans sa file d'attente et assignera un livreur.

**Erreurs possibles :**
- `422 "La commune de retrait n'est pas définie sur l'annonce."` → le vendeur doit renseigner `commune_id` sur son annonce
- `422 "Les coordonnées GPS sont manquantes."` → lat/lon obligatoires pour ces modes (renseignés à la validation du panier)
- `422` : aucune tranche km définie pour cette distance dans le backoffice
- `422 "La commande doit être confirmée comme payée avant de choisir la livraison."` — statut incorrect
- `422 "Un mode de livraison a déjà été sélectionné pour cette commande."` — doublon

### Mode express

```
POST /api/marketplace/acheteur/commandes/{id}/livraison/express
Content-Type: application/json
Authorization: Bearer <token>

{
  "commune_livraison_id": "<uuid>",
  "distance_km": 2.4
}
```

Même logique que le mode standard. La livraison est diffusée au réseau de livreurs : premier arrivé premier servi.

**Réponse 201 :**
```json
{
  "success": true,
  "message": "Livraison express sélectionnée et diffusée au réseau.",
  "livraison": { "id": "...", "mode": "express", "statut": "en_attente", "montant_final": 2250 }
}
```

**Erreurs possibles :**
- Mêmes erreurs GPS/commune que le mode standard
- `422` : taux express non configuré pour la tranche dans le backoffice

### Mode livreur du magasin

```
POST /api/marketplace/acheteur/commandes/{id}/livraison/livreur-magasin
Content-Type: application/json
Authorization: Bearer <token>

{
  "commune_livraison_id": "<uuid>"
}
```

- L'acheteur choisit ce mode s'il veut le livreur propre du vendeur.
- Le vendeur désignera ensuite son livreur (sur plateforme ou hors plateforme) via `POST /vendeur/ventes/{id}/livraison/magasin/assigner`.

**Réponse 201 :**
```json
{
  "success": true,
  "message": "Livraison par livreur du magasin sélectionnée.",
  "livraison": { "id": "...", "mode": "livreur_magasin", "statut": "en_attente", "montant_final": 2000 }
}
```

`statut: "en_attente"` = en attente que le vendeur désigne son livreur via `/vendeur/ventes/{id}/livraison/magasin/assigner`.

**Erreurs possibles :**
- `422` : aucun tarif vendeur défini vers cette commune (ce mode n'aurait pas dû être proposé)

---

## Flux vendeur — désigner le livreur (mode livreur_magasin seulement)

Une fois que l'acheteur a choisi le mode `livreur_magasin`, le vendeur doit désigner son livreur :

```
POST /api/marketplace/vendeur/ventes/{id}/livraison/magasin/assigner
Content-Type: application/json
Authorization: Bearer <token>

{
  "livreur_id": "<uuid ou null>"
}
```

- `livreur_id` présent → livreur sur plateforme, `statut: "proposee"`, le livreur doit accepter/refuser dans son app
- `livreur_id` absent (ou `null`) → hors plateforme, `statut: "assignee"` d'emblée, le vendeur gère sa livraison directement

**Réponse 200 :**
```json
{
  "success": true,
  "message": "Livreur désigné.",
  "livraison": { "id": "...", "mode": "livreur_magasin", "statut": "proposee|assignee" }
}
```

---

## Flux vendeur — gérer ses tarifs de livraison

**Lister ses tarifs :**
```
GET /api/marketplace/vendeur/tarifs-livraison
```

**Créer ou mettre à jour (upsert par commune) :**
```
POST /api/marketplace/vendeur/tarifs-livraison
Content-Type: application/json
{
  "commune_destination_id": "<uuid>",
  "montant": 2000
}
```
- Si un tarif existe déjà vers cette commune, il est mis à jour.

**Modifier (montant ou actif) :**
```
PUT /api/marketplace/vendeur/tarifs-livraison/{id}
Content-Type: application/json
{
  "montant": 2500,
  "actif": false
}
```

**Supprimer :**
```
DELETE /api/marketplace/vendeur/tarifs-livraison/{id}
```

**Rechercher un livreur (pour le mode livreur_magasin sur plateforme) :**
```
GET /api/marketplace/vendeur/livreurs/recherche?telephone=0700000000
```
Retourne `id, nom, prenoms, type_vehicule, ville, disponible`.

---

## Flux livreur — mode express (premier arrivé premier servi)

### Voir les livraisons disponibles

Inchangé : `GET /api/marketplace/livreur/livraisons-disponibles` — retourne les livraisons `mode=express` ou `mode=standard` en attente dans la zone du livreur.

### Accepter une livraison express

```
POST /api/marketplace/livreur/livraisons/{id}/accepter-express
Authorization: Bearer <token>
```

**Réponse 200 :**
```json
{
  "success": true,
  "message": "Livraison acceptée.",
  "livraison": { "statut": "assignee", "montant_final": 2250 }
}
```

**Erreurs possibles :**
- `422 "Cette livraison n'est pas en mode express."` — mauvais endpoint
- `422 "Vous devez être disponible pour accepter une livraison."` — mettre `disponible = true` d'abord
- `422 "Cette livraison a déjà été prise par un autre livreur."` — race condition normale, afficher "Déjà prise"

**Important** : Le prix est **imposé** (`montant_final` dans la réponse). Il n'y a plus de saisie de prix.

### Mode livreur_magasin — accepter/refuser une proposition

Inchangé :
```
POST /api/marketplace/livreur/livraisons/{id}/accepter
POST /api/marketplace/livreur/livraisons/{id}/refuser
```

### Démarrer et valider

Inchangé :
```
POST /api/marketplace/livreur/livraisons/{id}/demarrer
POST /api/marketplace/livreur/livraisons/{id}/valider
```

---

## Endpoints dépréciés (→ 410)

Ces endpoints répondent encore (pour éviter de casser les versions déployées) mais retournent `HTTP 410 Gone` :

| Méthode | URL | Remplacé par |
|---------|-----|-------------|
| `POST` | `/vendeur/ventes/{id}/livraison/reseau` | `acheteur` : `/acheteur/commandes/{id}/livraison/express` ou `/livraison/standard` |
| `POST` | `/vendeur/ventes/{id}/livraison/direct` | `acheteur` : `/acheteur/commandes/{id}/livraison/livreur-magasin` |
| `POST` | `/vendeur/ventes/{id}/livraison/hors-plateforme` | `acheteur` : `/acheteur/commandes/{id}/livraison/livreur-magasin` |
| `GET` | `/vendeur/ventes/{id}/livraison/offres` | — supprimé |
| `POST` | `/vendeur/ventes/{id}/livraison/offres/{offreId}/accepter` | — supprimé |
| `POST` | `/livreur/livraisons/{id}/proposer` | `accepter-express` (livreur) |
| `DELETE` | `/livreur/livraisons/{id}/offre` | — supprimé |

---

## Gestion des communes

Les IDs de commune (`commune_depart_id`, `commune_arrivee_id`) sont les UUID de la table `communes`. La liste des communes est disponible via l'API existante. L'acheteur doit choisir sa commune de livraison (ou permettre au système de résoudre depuis son GPS en trouvant la commune la plus proche).

Pour le vendeur, la `commune_id` de l'annonce est à renseigner lors de la publication ou mise à jour de l'annonce (champ `commune_id`).

---

## Calcul de la distance

L'app cliente calcule la distance (via OSM ou Haversine) et l'envoie dans `distance_km` lors du choix du mode. **C'est cette valeur qui sert à trouver la tranche tarifaire** — cohérent avec le reste de l'API (expéditions classiques).

**Fallback serveur** : si `distance_km` est absent, le serveur recalcule via Haversine à partir des coordonnées GPS stockées sur la commande (`livraison_latitude`/`longitude`) et sur l'annonce (`retrait_latitude`/`longitude`). Si les GPS sont aussi absents, renvoie `422`.

**Recommandation** : toujours envoyer `distance_km` depuis l'app — le fallback GPS existe mais dépend des GPS renseignés.

---

## Ordre d'implémentation recommandé

1. **GPS à la validation du panier** : s'assurer que `livraison_latitude` + `livraison_longitude` sont envoyés — obligatoires pour standard/express
2. **Tarifs avant commande** : `GET acheteur/tarifs-livraison` — afficher les 3 prix dans l'UI avant que l'acheteur valide
3. **Choix du mode (acheteur)** : 3 endpoints acheteur (`/livraison/standard`, `/livraison/express`, `/livraison/livreur-magasin`) + `commune_livraison_id` requis
4. **Désignation livreur (vendeur)** : `POST /vendeur/ventes/{id}/livraison/magasin/assigner` après que l'acheteur a choisi ce mode
5. **Accepter express (livreur)** : `POST livreur/livraisons/{id}/accepter-express` — enlever la saisie de prix
6. **Tarifs vendeur** : CRUD vendeur `tarifs-livraison` — espace "mes tarifs de livraison"
7. **Commune sur annonce (vendeur)** : ajouter le champ `commune_id` au formulaire de publication de l'annonce
