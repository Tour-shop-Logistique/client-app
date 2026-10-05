# Réponse à l'audit cahier des charges — ce qui a changé côté backend

Suite à `AUDIT_CAHIER_DES_CHARGES_CLIENT.md`, voici ce qui a été vérifié et traité côté backend le 4 octobre 2026. Plusieurs points de l'audit étaient en fait déjà couverts par le code existant (juste non exposés/documentés) ; les autres ont été implémentés dans cette session. Le détail par point de l'audit est mis à jour directement dans la section **Demandes à faire au backend** de `AUDIT_CAHIER_DES_CHARGES_CLIENT.md` — ce document donne le contrat d'API exact à câbler côté app client.

---

## 1. Déjà couvert, rien à construire côté backend (mais à exploiter côté app)

### Offres de livraison à domicile (audit #10, #21, 8.3)

Contrairement à ce qui était supposé, la route de liste existe déjà, dans un controller pensé pour le client :

```
GET  /api/expedition/client/missions/{missionId}/offres
POST /api/expedition/client/missions/{missionId}/offres/{offreId}/accepter
```

Le `missionId` se récupère désormais via la nouvelle route `GET /api/expedition/client/{id}/missions` (voir plus bas).

### Suivi par étape (audit #8, #19)

Pas besoin d'attendre le backend pour la frise de suivi détaillée : `show`/`list` d'une expédition renvoient déjà les dates de chaque jalon :

```json
{
  "date_prevue_enlevement": "...",
  "date_enlevement_client": "...",
  "date_livraison_agence": "...",
  "date_deplacement_entrepot": "...",
  "date_expedition_depart": "...",
  "date_expedition_arrivee": "...",
  "date_reception_agence": "...",
  "date_reception_client": "..."
}
```

Une date `null` = étape pas encore atteinte. Croisez avec `statut_expedition` pour le libellé de l'étape en cours (8 valeurs, voir `ExpeditionStatus` : `en_attente`, `accepted`, `en_cours_enlevement`, `recu_agence_depart`, `en_transit_entrepot`, `depart_expedition_succes`, `arrivee_expedition_succes`, `recu_agence_destination`, `en_cours_livraison`, `termined`).

### Enlèvement à domicile (audit #7, #18)

Déjà complet : `POST /api/expedition/client/{id}/demander-enlevement` (mode `groupage`/`express`, distance, type de véhicule).

### Adresse de livraison marketplace (audit #29)

Déjà fait (confirmé en base), rien à ajouter.

---

## 2. Nouveau — code de réception envoyé au destinataire + preuves de livraison (audit #11, #22)

**Ce qui a changé** : avant, le code à 4 chiffres que le destinataire doit donner au livreur (`code_validation_reception`) n'était envoyé à personne. Il est désormais envoyé par SMS + email au destinataire **dès qu'un livreur est assigné** à la mission de livraison à domicile (donc avant son passage, pas au dernier moment). Le texte SMS :

> TourShop : un livreur va vous livrer votre colis. Communiquez-lui ce code à la réception : 1234.

**Nouvelle route pour consulter les missions et leurs preuves** :

```
GET /api/expedition/client/{id}/missions
```

Réponse :
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-mission",
      "type": "enlevement",
      "statut": "terminee",
      "preuve": {
        "photo_url": "https://.../photo.jpg",
        "signature_data": "...",
        "latitude": 5.32,
        "longitude": -4.02,
        "horodatage": "2026-10-04T18:30:00Z"
      }
    },
    {
      "id": "uuid-mission-2",
      "type": "livraison",
      "statut": "assignee",
      "preuve": null
    }
  ]
}
```

`preuve` est `null` tant que l'étape n'a pas été réalisée par le livreur (pas d'erreur, juste absente). À utiliser pour :
- retrouver le `missionId` nécessaire à l'appel `offres` ci-dessus (plus besoin de le deviner) ;
- afficher la preuve de livraison (photo + signature) une fois le colis remis.

Le `code_validation_reception` lui-même reste visible sur `show`/`list` de l'expédition (déjà exposé, rien de nouveau ici) — mais ne devrait servir que de repli, puisqu'il est maintenant envoyé proactivement.

---

## 3. Nouveau — factures PDF côté client (audit #14, #25, 8.1 étape 9)

```
GET /api/expedition/client/factures
GET /api/expedition/client/factures/{id}/download
```

La première liste toutes les factures du client (toutes expéditions confondues), avec l'expédition associée en aperçu (`reference`, `pays_depart`, `pays_destination`). La seconde télécharge le PDF directement (réponse binaire `application/pdf`, pas de JSON).

Pas de génération depuis l'app client : la facture est émise par l'agence (`AgenceFactureController::store`), le client ne fait que consulter/télécharger.

---

## 4. Nouveau — évaluation du service (audit #12, #23)

```
GET  /api/expedition/client/{id}/evaluation
POST /api/expedition/client/{id}/evaluation
```

`POST` accepte :
```json
{ "note": 5, "commentaire": "Livraison rapide, rien à dire." }
```
- `note` : entier 1 à 5, obligatoire.
- `commentaire` : texte libre, optionnel, 1000 caractères max.

Contraintes à gérer côté UI :
- **422** si l'expédition n'est pas encore `termined` ("Cette expédition ne peut pas encore être évaluée.").
- **422** si une évaluation existe déjà pour cette expédition ("Cette expédition a déjà été évaluée.") — une seule évaluation possible, pas de modification pour l'instant.

`GET` renvoie `data: null` si pas encore évaluée, sinon l'objet `{ id, note, commentaire, created_at }`.

---

## 5. Nouveau — photo du colis (audit #5, #16)

Le champ existait en base mais n'était câblé nulle part. Il est maintenant pris en compte sur les formulaires **Interville** et **Livraison à domicile** (`store`, mode `interville` et `livraison_domicile`) :

- Envoyer en `multipart/form-data`, champ `colis[{index}][photo]` (fichier), en plus des champs déjà existants du même colis.
- Contraintes : image (`jpeg`, `png`, `jpg`, `webp`), 5 Mo max, optionnel.
- La photo uploadée est exposée en lecture via `photo_url` sur chaque objet `colis` dans la réponse de `show`/`list`.

⚠️ Non branché sur le mode groupage/agence (`recuperation_agence`) : dans ce mode, les colis sont reconstruits par catégorie côté serveur à partir des articles soumis, il n'y a pas de colis unitaire sur lequel accrocher une photo. Si ce mode a aussi besoin d'une photo, il faudra en rediscuter le design avec le backend (probablement une photo par article plutôt que par colis).

---

## 6. Pas encore pour vous — ce qui reste bloqué ou en attente

- **Choix retrait/domicile par le destinataire sans compte** (audit #9, 8.1 étape 7) : le client expéditeur peut déjà déclencher la livraison à domicile après coup (`POST .../demander-livraison`), mais rien ne permet à un destinataire non authentifié de faire ce choix lui-même. Si ce cas (destinataire sans compte client) doit vraiment être couvert, il faut un mécanisme par lien/token — pas encore conçu, à discuter avant de coder.
- **Paiement mobile money intégré** (#13, #24, #29, #34, #38) : confirmé 100% déclaratif aujourd'hui, aucune passerelle réelle. Chantier plateforme (identifié B9 côté livreur), pas engagé.
- **Vérification par SMS/WhatsApp à l'inscription** (#2) : toujours par email uniquement. Le service SMS existe déjà et fonctionne pour d'autres usages (le brancher sur l'inscription est jouable rapidement si priorisé) ; WhatsApp Business resterait un vrai chantier à construire.
- **Bascule automatique vers l'Interville pour une livraison marketplace inter-villes** (#33) : confirmé non implémenté, systèmes marketplace et expédition totalement découplés aujourd'hui. C'est d'abord une décision produit (qui paie le tarif Interville, le vendeur garde-t-il un rôle après remise, quelle preuve fait foi) avant d'être un sujet technique — pas de code engagé, voir la question **Q1** mise à jour dans `DEMANDES_BACKEND_LIVREUR.md`.

---

## À corriger côté app client (relevé pendant la vérification, pas un sujet backend)

Signalé dans votre propre audit (`Défauts relevés pendant l'audit`) et confirmé important : `src/services/expeditionService.js` logue en console les payloads et réponses de `simulateInterville`, `getDevis` et `storeExpedition` — noms, téléphones et adresses de vos utilisateurs apparaissent donc en clair dans la console du navigateur, y compris en production. À retirer avant la prochaine mise en prod, indépendamment de tout ce qui précède.
