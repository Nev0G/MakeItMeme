# MakeItMeme

Des jeux entre potes, jouables dans le navigateur, avec un habillage « vieux journal new-yorkais ».

- `/` : la page d'accueil (la « une »), avec les salons ouverts, l'horoscope du jour et la saisie d'un code
- `/caption-battle` : légende les memes de tes potes, puis votez
- `/imposteur` : un mot pour tous sauf un imposteur
- `/bomb-party` : trouve un mot avec la syllabe avant que la bombe explose
- `/pictionary` : dessine un mot, les autres devinent (palette complète, malus et chaos)
- `/blind-test` : devine des extraits sonores et des images floutées qui se dévoilent (musiques, films, séries, jeux vidéo, anime)

Chaque jeu a des salons **fermés** (code) ou **ouverts** (listés sur l'accueil), un chat écrit, et le host peut expulser un joueur.
La connexion Discord est optionnelle.

## Lancer en local

```bash
npm install
npm run dev
```

Variables d'environnement (sinon un projet Supabase de démo est utilisé) :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Blind Test (`/api/blindtest`, côté serveur — les clés ne sont jamais envoyées au navigateur). Les clés se règlent par variables d'environnement (ou dans `lib/blindtest-keys.ts`) :

- `TMDB_API_KEY` (ou `TMDB_READ_TOKEN`) : affiches et scènes de films et de séries (clé gratuite sur themoviedb.org)
- `RAWG_API_KEY` : captures de jeux vidéo, source en plus (clé gratuite sur rawg.io)
- Les captures de jeux « Steam » marchent sans clé (SteamSpy + boutique Steam).
- Sans ces clés, les catégories concernées sont grisées dans le lobby ; les musiques (iTunes) et les anime (Jikan) marchent sans clé.
- `BLINDTEST_MOCK=1` : fausses données sans réseau, pour tester la page.

Supabase sert au temps réel (broadcast + présence), à la connexion Discord (Authentication > Providers) et,
pour Caption Battle, au stockage des fichiers (bucket public `game-media`).

## Où est quoi

- `lib/shared.tsx` : briques communes aux jeux (connexion Supabase, sons, avatars, chat, annuaire des salons, « une » de fin de partie)
- `lib/press.ts` : contenus de presse (date, météo, horoscope, gros titres)
- `tailwind.config.js` : palette « papier/encre » (les échelles de couleurs de Tailwind y sont inversées)
- `app/globals.css` : papier, trame, filets, lettrine, tampon
