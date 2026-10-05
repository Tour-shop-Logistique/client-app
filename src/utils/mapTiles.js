// Fonds de carte communs à toutes les cartes Leaflet de l'app.
// OpenStreetMap : sans clé API (les fonds CARTO « basemaps » en exigent une
// désormais et affichent « API KEY REQUIRED » à la place des tuiles).
// La politique d'usage d'OSM impose d'afficher l'attribution.
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
