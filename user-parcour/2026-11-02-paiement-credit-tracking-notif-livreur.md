# Changements apps client et livreur — 2 novembre 2026

Document destiné au dev des apps **client** et **livreur**.
Décrit uniquement ce qui change par rapport à l'existant.

Backend : déployé. Aucune migration requise (champs déjà présents).

---

## Sommaire

1. [Paiement à crédit — choix du client à l'enregistrement](#1-paiement-à-crédit)
2. [Code de suivi LD obligatoire avant départ](#2-code-de-suivi-ld)
3. [Normalisation de l'email à la connexion](#3-normalisation-email)
4. [Notification : payer le livreur après réception agence](#4-notif-paiement-livreur)

---

## 1. Paiement à crédit

### Ce qui change

Le champ `is_paiement_credit` est désormais accepté lors de la création d'une expédition **non-LD** (Interville, Groupage, DHD).

- Pour les LD : toujours `false`, le champ est ignoré même s'il est envoyé.
- Pour les autres types : le client peut indiquer `true` pour signaler qu'il paiera à crédit (paiement différé à l'arrivée ou selon accord agence).

### Endpoints concernés

| Endpoint | Méthode | Type |
|---|---|---|
| `POST /client/expeditions` (mode `recuperation_agence`) | Groupage / DHD | Nouveau champ |
| `POST /client/expeditions` (mode `interville`) | Interville | Nouveau champ |

### Champ à ajouter dans le corps de la requête

```json
{
  "is_paiement_credit": true
}
```

Type : `boolean`, nullable. Défaut : `false` si absent.

### Affichage suggéré

Afficher une option "Payer à crédit" dans le formulaire de création d'expédition pour Interville et Groupage. Ne pas afficher pour LD.

La valeur est exposée dans la réponse de création et dans `GET /client/expeditions/{id}` sous le champ `is_paiement_credit`.

---

## 2. Code de suivi LD

### Ce qui change

Pour les expéditions LD (`type_expedition: "simple"`), un `code_suivi_expedition` est désormais obligatoire côté backoffice avant la confirmation du départ. Le backend ne bloque pas encore côté API client, mais le champ sera renseigné dans l'expédition au moment du départ.

### Impact app client

Aucune action requise pour la création. En revanche, **afficher le `code_suivi_expedition`** dans le détail de suivi de l'expédition LD dès qu'il est présent (il est `null` jusqu'au départ, puis renseigné après).

### Champ

```json
{
  "code_suivi_expedition": "TRACK-123456"
}
```

Présent dans `GET /client/expeditions/{id}` et dans les payloads de notifications de statut.

---

## 3. Normalisation email

### Ce qui change

Le backend normalise désormais les emails en **minuscules** avant validation et recherche, dans `register`, `registerLivreur` et `login`.

### Impact apps

- Côté client/livreur : aucune action requise, mais il est recommandé de normaliser aussi côté frontend (`email.toLowerCase().trim()`) avant envoi pour cohérence.
- Les comptes créés avec un email en majuscule sont maintenant accessibles avec l'email en minuscule.

---

## 4. Notif paiement livreur

> **Concerne l'app livreur uniquement.**

### Contexte

Quand une agence confirme la réception d'un colis récupéré à domicile par un livreur, le livreur doit être informé que son paiement est en cours de traitement. Deux modes :

- **EXPRESS** (`mode: "express"`) → l'agence paie directement le livreur ; le paiement arrive rapidement.
- **GROUPAGE** (`mode: "groupage"`) → l'agence transfère au backoffice qui paie ensuite ; délai possible.

### Notification reçue par le livreur

Le livreur reçoit une notification push (`database` + WebPush) avec le type `paiement_livreur_en_cours`.

Structure de la notification en base (`GET /livreur/notifications`) :

```json
{
  "id": "uuid",
  "type": "paiement_livreur_en_cours",
  "data": {
    "mission_id": "uuid",
    "expedition_id": "uuid",
    "reference": "ABC001G",
    "mode": "express",
    "montant": 5000,
    "message": "Votre paiement pour la mission ABC001G est en cours de traitement par l'agence."
  },
  "read_at": null,
  "created_at": "2026-11-02T00:15:00Z"
}
```

> **Note** : la notification est envoyée à l'agence (WebSocket interne backoffice/agence) pour lui rappeler de payer. La notification **au livreur** est distincte et doit être implémentée si elle n'est pas encore en place — vérifier `NOTIFICATIONS_A_INTEGRER.md` pour la liste complète des notifications livreur.

### Affichage suggéré dans l'app livreur

- Afficher un badge/toast "Paiement en cours" sur la mission concernée.
- Message selon le mode :
  - Express : "L'agence va vous payer directement."
  - Groupage : "Le backoffice traitera votre paiement sous peu."
- Mettre à jour le solde livreur (`GET /livreur/solde`) après réception de la notification pour refléter le crédit.

---

## Récapitulatif endpoints

| Endpoint | Changement |
|---|---|
| `POST /client/expeditions` (groupage/interville) | Accepte `is_paiement_credit: boolean` |
| `GET /client/expeditions/{id}` | Retourne `is_paiement_credit` et `code_suivi_expedition` |
| `POST /auth/register` | Email normalisé en minuscules |
| `POST /auth/login` | Email normalisé en minuscules |
| `GET /livreur/notifications` | Nouveau type `paiement_livreur_en_cours` |
