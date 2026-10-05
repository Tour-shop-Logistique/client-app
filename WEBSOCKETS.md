# WebSocket temps réel — guide d'intégration

Le backend diffuse des événements temps réel via un serveur **Laravel Reverb**
self-hosted (protocole compatible Pusher). Ce doc décrit le contrat pour brancher
un client (React, Flutter, etc.).

## Connexion

- Serveur : `laravel/reverb`, port `6001` (local) — en production ou à distance,
  host/port du service exposé (demander l'URL courante, ex.
  `ws.tourshop-express.com`).
- Librairie recommandée côté web : `laravel-echo` + `pusher-js` (Reverb parle le
  protocole Pusher, la même stack client fonctionne sans changement de lib).
- Auth des canaux privés : `POST {API_URL}/broadcasting/auth`, protégée par
  **Sanctum Bearer token** (pas de cookie/session — même mécanisme que le reste de
  l'API : header `Authorization: Bearer <token>`).

```js
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
window.Pusher = Pusher;

const echo = new Echo({
  broadcaster: 'reverb',
  key: import.meta.env.VITE_REVERB_APP_KEY,
  wsHost: import.meta.env.VITE_REVERB_HOST,
  wsPort: import.meta.env.VITE_REVERB_PORT,
  wssPort: import.meta.env.VITE_REVERB_PORT,
  forceTLS: import.meta.env.VITE_REVERB_SCHEME === 'https',
  enabledTransports: ['ws', 'wss'],
  authorizer: (channel) => ({
    authorize(socketId, callback) {
      // Remplacer par votre client HTTP habituel (doit envoyer le Bearer token)
      api.post('/broadcasting/auth', { socket_id: socketId, channel_name: channel.name })
        .then((res) => callback(false, res.data))
        .catch((err) => callback(true, err));
    },
  }),
});
```

## Canaux privés disponibles

| Canal | Qui peut écouter | Résolution de l'id |
|---|---|---|
| `private-agence.{agenceId}` | Users de type `AGENCE`/`ADMIN` de cette agence | `user.agence_id` |
| `private-backoffice.{backofficeId}` | Users de type `BACKOFFICE`/`ADMIN` de ce backoffice | `user.backoffice_id` |
| `private-client.{userId}` | Le client lui-même uniquement | `user.id === userId` |
| `private-livreur.{userId}` | Le livreur lui-même uniquement (`user.type === LIVREUR`) | `user.id === userId` |
| `livreurs.reseau` (public authentifié) | Tout livreur connecté (`user.type === LIVREUR`) | — canal partagé, non filtrable par destinataire précis |

Autorisation définie dans `routes/channels.php`.

## Un seul event pour tout : `model.updated`

Plutôt qu'un event dédié par cas d'usage métier, **tout passe par un event
unique**. Chaque client s'abonne une fois et filtre sur les champs `model` /
`action` du payload selon ce qui l'intéresse — pas besoin d'attendre une mise à
jour du contrat pour écouter un nouveau cas.

```js
echo.private(`backoffice.${backofficeId}`)
  .listen('.model.updated', (payload) => {
    if (payload.model === 'Expedition' && payload.action === 'status_changed') {
      // ...
    }
  });
```

### Forme du payload

```jsonc
{
  "model": "Expedition",       // entité concernée : "Expedition" | "Colis" | ...
  "action": "status_changed",  // verbe libre (voir tableau ci-dessous)
  "ids": ["uuid1", "uuid2"],   // toujours un tableau, même pour 1 seul élément
  "references": ["REF1"],      // identifiants lisibles (reference / code_colis), même ordre que ids
  "count": 1,                  // nombre d'éléments concernés
  "changes": { "statut_expedition": "recu_agence_destination" }, // champs modifiés, ou null
  "data": [ { "id": "uuid1", "reference": "REF1", "statut_expedition": "recu_agence_destination" } ], // items concernés (partiels ou complets), toujours un tableau
  "at": "2026-07-11 14:32:00"
}
```

`data` peut contenir plusieurs éléments d'un coup (ex. contrôle groupé de 50
colis en une seule opération) — toujours itérer dessus plutôt que supposer un
seul élément.

### Models / actions actuellement émis

| `model` | `action` | Canaux | Quand |
|---|---|---|---|
| `Expedition` | `created` | `agence.{agenceId}` (créatrice) + `backoffice.{backofficeId}` (départ **et** destination) | Une agence crée une nouvelle expédition, une fois la transaction commitée (colis + tarif déjà calculés dans `data`) |
| `Expedition` | `status_changed` | `agence.{agenceId}` + `backoffice.{backofficeId}` | `statut_expedition` change (y compris via `syncStatutFromColis()`) |
| `Expedition` | `payment_confirmed` | `backoffice.{backofficeId}` | Une agence enregistre un paiement (frais, expédition, ou tout compris) |
| `Expedition` | `frais_annexes_updated` | `agence.{agenceId}` | Le backoffice fixe/modifie les frais annexes à collecter |
| `Colis` | `controlled` | `agence.{agenceId}` | Le backoffice valide le contrôle d'un ou plusieurs colis |
| `Colis` | `blocked` | `agence.{agenceId}` | Le backoffice bloque un ou plusieurs colis |
| `Colis` | `unblocked` | `agence.{agenceId}` | Le backoffice débloque un ou plusieurs colis |
| `Colis` | `assigned` | `agence.{agenceId}` | Colis assignés à une agence de destination |
| `Colis` | `received_by_backoffice` | `agence.{agenceId}` | Le backoffice confirme la réception de colis destinés à cette agence |
| `Agence` | `status_changed` | `agence.{agenceId}` + `backoffice.{backofficeId}` | Une agence est activée/désactivée |
| `TarifSimple` | `updated` | `agence.{agenceId}` (fan-out à toutes les agences impactées) | Un tarif de base backoffice change et se répercute sur les tarifs d'agence |
| `TarifGroupage` | `updated` | `agence.{agenceId}` (fan-out à toutes les agences impactées) | Idem, pour les tarifs groupage |
| `User` | `role_changed` | `backoffice.{backofficeId}` ou `agence.{agenceId}` | L'admin change le `role_id` d'un agent (backoffice ou agence) — `data` contient `{id, role_id, role_details}`, chaque client compare `id` au sien et resynchronise son état en direct (sans déconnexion) — voir `useRealtimeUpdates` (backoffice-app) et le handler `onUserRoleChanged` de `App.jsx` (Gestion_agence_partenaire) |
| `Mission` | `nouvelle_disponible` | `client.{clientId}` (si demande client) + `livreurs.reseau` | Mission express créée, ouverte au réseau de livreurs (`MissionService::diffuserAuxLivreurs()`) |
| `Mission` | `proposee` | `livreur.{livreurId}` | Backoffice assigne manuellement un livreur en mode groupage — la mission attend son accord avant assignation définitive (`MissionService::assignerGroupage()`) |
| `Mission` | `assignee` | `livreur.{livreurId}` | Le livreur accepte une proposition groupage (`accepterProposition()`), ou une offre express est acceptée par le client |
| `Mission` | `refusee` / `expiree` | `backoffice.{backofficeId}` | Le livreur refuse une proposition groupage, ou elle expire sans réponse (délai 15 min) — `MissionService::refuserProposition()` |
| `Mission` | `cloturee` | `livreur.{livreurId}` de tous les livreurs ayant proposé (gagnant + refusés) | Offre express acceptée par le client — `MissionService::accepterOffre()` |
| `MissionOffre` | `proposee` | `client.{clientId}` (demandeur de la mission) | Un livreur dépose/met à jour une offre sur une mission express — `MissionMarketplaceController::proposer()` |
| `LivraisonMarketplace` | `nouvelle_disponible` | `client.{clientId}` (vendeur) + `livreurs.reseau` | Vendeur choisit le mode réseau — `MarketplaceService::choisirLivraisonReseau()` |
| `LivraisonMarketplace` | `proposee` | `client.{clientId}` (vendeur) + `livreur.{livreurId}` | Vendeur affecte directement un livreur — en attente de son accord (`choisirLivraisonDirecte()`) |
| `LivraisonMarketplace` | `assignee` | `client.{clientId}` (vendeur + acheteur) + `livreur.{livreurId}` | Le livreur accepte une affectation directe (`accepterPropositionLivraison()`), ou le vendeur accepte une offre réseau (`accepterOffre()`) |
| `LivraisonMarketplace` | `refusee` / `expiree` | `client.{clientId}` (vendeur) + `livreur.{livreurId}` | Le livreur refuse une affectation directe, ou elle expire — `refuserPropositionLivraison()`. Le livreur reçoit aussi une notification push d'accusé de réception (sauf en cas d'expiration automatique) |
| `LivraisonMarketplace` | `cloturee` | `client.{clientId}` (vendeur + acheteur) + `livreur.{livreurId}` de tous les offrants | Offre réseau acceptée par le vendeur |
| `LivraisonMarketplace` | `demarree` | `client.{clientId}` (vendeur + acheteur) | Le livreur démarre la course, preuve de retrait chargée dans le payload (`demarrerLivraison()`) |
| `LivraisonMarketplaceOffre` | `proposee` | `client.{clientId}` (vendeur) | Un livreur dépose/met à jour une offre sur une livraison marketplace réseau — `MarketplaceService::proposerOffre()` |
| `CommandeMarketplace` | `paiement_declare` | `client.{clientId}` (vendeur + acheteur) | L'acheteur déclare avoir payé |
| `CommandeMarketplace` | `payee` | `client.{clientId}` (vendeur + acheteur) | Le vendeur confirme la réception du paiement |
| `CommandeMarketplace` | `livree` | `client.{clientId}` (vendeur + acheteur) | Livraison validée par code, preuves (retrait + remise) chargées dans le payload — `validerLivraison()` |
| `NoteMission` | `creee` | `backoffice.{backofficeId}` + `agence.{agenceId}` | Le livreur ajoute une note libre sur une mission assignée — `NoteMissionController::store()` |

Cette liste s'enrichit avec le temps sans changer le nom de l'event ni la
structure du payload — se fier au champ `action` (verbe libre) pour découvrir de
nouveaux cas plutôt qu'à une liste figée.

⚠️ `livreurs.reseau` est un canal **public partagé**, non filtrable par
destinataire précis ni par ville/zone géographique côté WebSocket — c'est un
complément best-effort au push individuel (`*PushNotification`), qui lui est
filtré (ex. par disponibilité/ville). Un client qui écoute ce canal reçoit
tout, peu important sa propre zone d'exercice.

## Émettre un nouvel événement (côté backend)

Pas besoin de créer une classe Event : utiliser le helper `RealtimeBroadcaster`.

```php
use App\Support\RealtimeBroadcaster;

RealtimeBroadcaster::send(
    model: 'Transaction',           // nom de l'entité
    action: 'created',              // verbe libre
    items: $transaction->toArray(), // un item, ou un tableau d'items pour du bulk
    agenceIds: [$agenceId],         // notifie agence.{id}
    backofficeIds: [$backofficeId], // notifie backoffice.{id}
    changes: ['status' => 'completed'], // optionnel
);
```

Le helper gère : résolution des canaux, normalisation en tableau, try/catch +
log (n'échoue jamais la requête HTTP si le WS est down). Documenter la nouvelle
ligne `model`/`action` dans le tableau ci-dessus pour que les autres clients
sachent qu'elle existe.

## Notes d'infra

- Le driver de queue est `database` (table `jobs`) — un worker `php artisan
  queue:work` doit tourner en continu, sinon les broadcasts restent en attente
  et ne partent jamais.
- Le serveur WS lui-même doit tourner via `php artisan reverb:start` (process
  séparé du serveur HTTP applicatif). En local : `docker compose up -d
  reverb queue-worker`.
- Reverb tourne nativement sous Windows (contrairement à
  `beyondcode/laravel-websockets`/ReactPHP qui avait un souci connu sur cet OS) —
  plus de contournement Docker nécessaire pour tester en local sous Windows.
- Accès distant (dev qui n'est pas sur le même réseau) : un tunnel ngrok séparé
  est nécessaire sur le port 6001, en plus de celui sur le port de l'API (le
  WebSocket est un serveur distinct, pas servi par la même app HTTP).
- La table `agences` n'a pas de colonne `backoffice_id` — un backoffice couvre
  un pays. Pour résoudre le backoffice d'une agence, utiliser la relation
  `Agence::backoffice()` (jointure par `pays`), pas `$agence->backoffice_id`
  (toujours `null`, bug déjà rencontré et corrigé une fois — éviter de le
  réintroduire dans un futur call site).
- Le broadcast de `Expedition.created` n'est **pas** fait dans
  `ExpeditionObserver::created()` (volontairement absent) : à ce stade,
  l'expédition vient d'être insérée mais ses colis et son tarif ne sont pas
  encore calculés (créés dans les lignes suivantes de la même transaction), et
  un rollback plus loin annulerait une notification déjà partie. Le broadcast
  est fait explicitement dans le contrôleur de création (ex.
  `AgenceExpeditionController`), après `DB::commit()`. Si un futur point de
  création d'expédition doit émettre cet event (ex. `ClientExpeditionController`),
  reproduire le même pattern plutôt que d'ajouter un `created()` à l'Observer.
