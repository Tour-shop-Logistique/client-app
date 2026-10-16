# Récap — Géolocalisation de retrait obligatoire sur les annonces marketplace

## Pourquoi ce changement

Le mécanisme existait déjà (adresse de retrait par annonce, snapshotée sur la commande à l'achat, exploitée par le livreur pour calculer une distance), mais tous les champs étaient optionnels. Rien n'empêchait de publier une annonce sans aucun moyen réel de la faire livrer : sans coordonnées, le livreur ne peut pas calculer de distance ni filtrer les livraisons disponibles par sa zone (`LivraisonMarketplaceController::disponibles`) ; sans contact, il n'a personne à joindre au retrait.

## Ce qui a changé

### `POST /marketplace/vendeur/annonces/store`

Ces 5 champs passent de `nullable` à **obligatoires** :

| Champ | Type | Règle |
|---|---|---|
| `retrait_nom` | string | requis, max 255 |
| `retrait_telephone` | string | requis, max 20 |
| `retrait_ville` | string | requis, max 100 |
| `retrait_latitude` | numeric | requis, entre -90 et 90 |
| `retrait_longitude` | numeric | requis, entre -180 et 180 |

Restent **facultatifs** (complément d'affichage, pas indispensables au calcul) :
- `retrait_adresse` (texte libre)
- `retrait_quartier`

Sans ces 5 champs, `store()` renvoie désormais un **422** avec les erreurs de validation habituelles (`{ success: false, errors: { retrait_latitude: [...], ... } }`).

### `PUT /marketplace/vendeur/annonces/update/{id}`

Reste en modification partielle (`sometimes` — un champ omis ne touche pas à la valeur existante), mais **un champ envoyé doit désormais être une vraie valeur**, pas `null`. Concrètement : vous pouvez ne pas inclure `retrait_latitude` dans un update qui ne touche que le prix, mais vous ne pouvez plus envoyer `retrait_latitude: null` pour l'effacer.

## Ce qu'il faut côté app client

1. **Formulaire de création d'annonce** : rendre obligatoires à l'écran les champs nom, téléphone et ville de retrait, plus la capture de position (GPS du téléphone ou sélection sur carte) pour latitude/longitude — même pattern que ce qui existe déjà pour l'enlèvement à domicile côté Interville (géolocalisation du navigateur/app, avec un bouton "Détecter ma position").
2. **Annonces déjà publiées sans ces champs** : ce changement n'affecte que les créations/modifications futures — aucune migration de données, les annonces existantes restent en l'état jusqu'à leur prochaine modification par le vendeur. Si vous voulez forcer les vendeurs existants à compléter leur adresse de retrait, ce serait une action séparée côté app (ex. bannière "Complétez votre adresse de retrait" sur les annonces publiées sans coordonnées).
3. **Gestion de l'erreur 422** : si le vendeur tente de publier sans position (ex. a refusé la permission de géolocalisation), afficher clairement quel champ manque plutôt qu'une erreur générique.

## Hors scope de ce changement

Pas de notion de "profil vendeur" ou de "boutique" avec une adresse par défaut réutilisable sur plusieurs annonces — chaque annonce porte sa propre adresse de retrait, cohérent avec le fait qu'un même vendeur peut avoir plusieurs points de dépôt. Si un besoin de pré-remplissage automatique (adresse par défaut réutilisée à chaque nouvelle annonce) se confirme à l'usage, ce serait un chantier séparé à cadrer (nouveau champ sur le profil utilisateur, logique de pré-remplissage) — pas fait ici.
