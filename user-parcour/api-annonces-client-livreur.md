# Annonces Tourshop — apps client et livreur

Le backoffice peut diffuser une annonce (information générale, lancement, maintenance…) aux **agences**, aux **clients** et/ou aux **livreurs**.

Côté apps client et livreur, **l'annonce arrive dans les notifications existantes**. Aucun nouvel écran ni nouvelle route : seulement un type de notification de plus à reconnaître.

## Ce que reçoit l'utilisateur

1. **Une notification en base**, renvoyée par les routes habituelles :
   - client : `GET /api/expedition/client/notifications`
   - livreur : `GET /api/livreur/notifications`

   Son champ `data` :
   ```json
   {
     "type": "annonce",
     "titre": "Lancement officiel",
     "message": "Bonsoir chers partenaires…",
     "cible": { "type": "annonce", "id": "uuid-de-l-annonce" }
   }
   ```
2. **Une notification push web** (titre et corps = ceux de l'annonce). Au clic, elle ouvre `/notifications` sur l'app client et `/activite` sur l'app livreur.
3. Un **email**, et un message WhatsApp si `whatsapp_number` est renseigné.

## Ce qu'il faut adapter dans les apps

- **Affichage** : reconnaître `data.type === "annonce"` et lui donner une icône dédiée (par exemple un mégaphone).
  - Le message peut être long (jusqu'à 2000 caractères) et contenir des retours à la ligne. Prévoir un affichage complet au clic, pas seulement un texte tronqué.
- **Filtres** : une annonce n'est ni « Colis », ni « Marketplace », ni « Missions ». Elle doit apparaître au moins dans « Toutes ». Un filtre « Annonces » peut être ajouté si souhaité.
- **Lecture** : rien de nouveau. Les appels existants suffisent : `POST …/notifications/{id}/lue` et `POST …/notifications/tout-lire`.
  - Le backend enregistre automatiquement la lecture côté backoffice, qui voit qui a lu l'annonce et quand.
  - L'annonce ne compte comme lue qu'au moment de cet appel. Si l'app ne l'appelle jamais, le backoffice ne verra jamais l'utilisateur parmi les lecteurs.

## Temps réel (optionnel)

À l'envoi, un événement est aussi diffusé sur le canal privé de l'utilisateur :

```json
{ "model": "Announcement", "action": "created", "items": [{ "id": "uuid", "titre": "…", "message": "…", "date": "…", "lu": false }] }
```

Il peut servir à recharger la liste des notifications sans attendre. L'ignorer ne casse rien.
