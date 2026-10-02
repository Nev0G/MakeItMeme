# MakeItMeme

Des jeux entre potes, jouables dans le navigateur, avec un habillage « vieux journal new-yorkais ».

- `/` : la page d'accueil (la « une »), avec les salons ouverts, l'horoscope du jour et la saisie d'un code
- `/caption-battle` : légende les memes de tes potes, puis votez
- `/imposteur` : un mot pour tous sauf un imposteur
- `/qui-de-nous` : « qui est le plus susceptible de… ? »

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

Supabase sert au temps réel (broadcast + présence), à la connexion Discord (Authentication > Providers) et,
pour Caption Battle, au stockage des fichiers (bucket public `game-media`).

## Où est quoi

- `lib/shared.tsx` : briques communes aux jeux (connexion Supabase, sons, avatars, chat, annuaire des salons, « une » de fin de partie)
- `lib/press.ts` : contenus de presse (date, météo, horoscope, gros titres)
- `tailwind.config.js` : palette « papier/encre » (les échelles de couleurs de Tailwind y sont inversées)
- `app/globals.css` : papier, trame, filets, lettrine, tampon
