// Clés API du Blind Test — fichier utilisé UNIQUEMENT côté serveur (route /api/blindtest), jamais envoyé au navigateur.
// Les clés se règlent par variables d'environnement sur l'hébergeur (recommandé), ou en les écrivant ici après le « || ».
export const KEYS: Record<string, string> = {
  // TMDB (films et séries) : jeton d'accès en lecture, ou clé d'API simple
  TMDB_READ_TOKEN: process.env.TMDB_READ_TOKEN || '',
  TMDB_API_KEY: process.env.TMDB_API_KEY || '',
  // RAWG (captures de jeux, en plus de Steam qui marche sans clé)
  RAWG_API_KEY: process.env.RAWG_API_KEY || '',
};
