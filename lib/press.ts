// Petits contenus "de presse" : dateline, météo, horoscope.

// 1994, mais le jour et le mois d'aujourd'hui (le jour de la semaine est celui de 1994)
const dateline = (now = new Date()) => {
  const d = new Date(1994, now.getMonth(), now.getDate());
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const dayOfYear = (now = new Date()) =>
  Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(now.getFullYear(), 0, 0)) / 86400000);

const WEATHER = [
  'Ciel dégagé, sauf celui de ta mauvaise foi.',
  'Averses de blagues douteuses en soirée.',
  'Éclaircies de génie entre deux fous rires.',
  'Brouillard épais sur l’identité de l’imposteur.',
  'Pluie de memes, prévoir un parapluie.',
  'Vent de panique à l’annonce du vote final.',
  'Chaleur écrasante : 40 °C dans le salon.',
  'Grand soleil sur les mauvais perdants.',
];
const weatherOf = (now = new Date()) => WEATHER[dayOfYear(now) % WEATHER.length];

const SIGNS = [
  'Bélier', 'Taureau', 'Gémeaux', 'Cancer', 'Lion', 'Vierge',
  'Balance', 'Scorpion', 'Sagittaire', 'Capricorne', 'Verseau', 'Poissons',
];

const FORTUNES = [
  'Mercure entre en Imposteur : méfie-toi de celui qui sourit trop.',
  'Une légende géniale t’attend dans ta tête. Ne la gâche pas avec un « mdr ».',
  'Tu seras désigné(e) par la moitié du salon. L’autre moitié n’a pas osé.',
  'La Lune te conseille de voter en dernier. Les astres adorent les lâches.',
  'Un ami proche cache un secret : il a aimé ton meme dès la première seconde.',
  'Jour idéal pour bluffer. Évite juste les yeux de ton voisin.',
  'Saturne gronde : quelqu’un va deviner ton mot trop tôt.',
  'Vénus te sourit, mais le vote final te réserve une surprise.',
  'Aujourd’hui, ton pire indice sera le plus drôle.',
  'Les étoiles prédisent une égalité. Elles n’ont jamais su compter.',
  'Un inconnu va rejoindre ton salon et gagner. Garde ta fierté au chaud.',
  'Pluton te souffle : écris la légende que tu n’oserais pas dire à voix haute.',
];

const GAME_ADVICE = ['caption-battle', 'imposteur', 'qui-de-nous'];

// Prédiction du jour pour un signe : stable toute la journée
const horoscope = (signIndex: number, now = new Date()) => {
  const i = (dayOfYear(now) + signIndex * 5) % FORTUNES.length;
  const game = GAME_ADVICE[(dayOfYear(now) + signIndex) % GAME_ADVICE.length];
  return { text: FORTUNES[i], game };
};

// Signe "par défaut" tiré d'un pseudo (pour que chacun ait le sien sans rien choisir)
const signFromName = (name: string) => {
  let h = 0;
  for (let k = 0; k < name.length; k++) h = (h * 31 + name.charCodeAt(k)) >>> 0;
  return h % SIGNS.length;
};

export { dateline, weatherOf, SIGNS, horoscope, signFromName };

// ---------- Gros titres de fin de partie ----------
// Le choix du modèle dépend d'un "seed" (identifiant de partie) : tous les joueurs voient la même Une.
const hashSeed = (seed: string) => {
  let h = 7;
  for (let k = 0; k < seed.length; k++) h = (h * 33 + seed.charCodeAt(k)) >>> 0;
  return h;
};
const pickFrom = <T,>(list: T[], seed: string, salt = 0): T => list[(hashSeed(seed) + salt) % list.length];
const upper = (s: string) => s.toLocaleUpperCase('fr-FR');
const joinNames = (names: string[]) =>
  names.length <= 1 ? names[0] || '' : `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;

const imposteurFront = ({ winner, reason, impostorNames, word, rounds, guesserName, seed }) => {
  const who = joinNames(impostorNames) || 'l’imposteur';
  if (winner === 'civils') {
    return {
      kicker: 'Affaire résolue',
      headline: pickFrom([`${upper(who)} DÉMASQUÉ !`, 'COUP DE FILET DANS LE SALON', `L’ENQUÊTE ABOUTIT : ${upper(who)} AVOUE`], seed),
      sub: `Sous les verrous après ${rounds} tour${rounds > 1 ? 's' : ''} d’interrogatoire. Le mot recherché : « ${word} ».`,
      story: `Selon nos informations, les civils ont fini par recouper les indices. « Il y avait quelque chose de louche dans ses réponses », confie un témoin sous couvert d’anonymat.`,
    };
  }
  if (reason === 'guessed') {
    return {
      kicker: 'Coup de théâtre',
      headline: pickFrom([`${upper(guesserName || who)} DEVINE LE MOT !`, 'RETOURNEMENT DE SITUATION AU TRIBUNAL'], seed),
      sub: `Démasqué, mais pas battu : « ${word} » trouvé en dernière chance.`,
      story: `Alors que les civils criaient déjà victoire, l’imposteur a sorti le bon mot de son chapeau. Notre rédaction n’a pas encore fini de s’en remettre.`,
    };
  }
  return {
    kicker: 'Fait divers',
    headline: pickFrom([`${upper(who)} ÉCHAPPE À LA JUSTICE`, 'LE CRIME PARFAIT', 'L’IMPOSTEUR A ROULÉ TOUT LE MONDE'], seed),
    sub: `Personne n’a vu venir ${who}. Le mot des civils, « ${word} », n’a trahi personne.`,
    story: `La police du salon reste perplexe : aucun indice décisif n’a permis de confondre le suspect. L’enquête est classée sans suite, faute de preuves.`,
  };
};

const quiDeNousFront = ({ topNames, topVotes, rounds, worstQuestion, seed }) => {
  if (!topNames.length || topVotes === 0) {
    return {
      kicker: 'Sondage',
      headline: 'AUCUN SUSPECT, AUCUN COUPABLE',
      sub: 'Le salon est resté de marbre : personne n’a voulu désigner personne.',
      story: 'Nos sondeurs n’ont recueilli aucune réponse exploitable. La démocratie a parfois ses limites.',
    };
  }
  const who = joinNames(topNames);
  return {
    kicker: 'Sondage exclusif',
    headline: pickFrom([`${upper(who)}, LE PLUS DÉSIGNÉ DE NEW YORK`, `${upper(who)} PLÉBISCITÉ(E) PAR LE SALON`, `SONDAGE CHOC : TOUS LES DOIGTS POINTENT VERS ${upper(who)}`], seed),
    sub: `${topVotes} désignation${topVotes > 1 ? 's' : ''} en ${rounds} question${rounds > 1 ? 's' : ''}.${worstQuestion ? ` Le pire moment : « ${worstQuestion} ».` : ''}`,
    story: `Interrogé à la sortie du salon, ${who} a refusé de commenter. « Je ne vois vraiment pas pourquoi », aurait-il simplement glissé.`,
  };
};

const captionFront = ({ leaderNames, points, bestCaption, seed }) => {
  if (!leaderNames.length || points === 0) {
    return {
      kicker: 'Concours de légendes',
      headline: 'MATCH NUL : LA RÉDACTION EST BLÊME',
      sub: 'Personne n’a convaincu le jury cette semaine.',
      story: 'Les légendes étaient là, mais le public est resté de glace. Les organisateurs promettent un meilleur cru à la prochaine édition.',
    };
  }
  const who = joinNames(leaderNames);
  return {
    kicker: 'Concours de légendes',
    headline: pickFrom([`${upper(who)} RAFLE LA UNE`, `${upper(who)} DOMINE LE CONCOURS`, `LÉGENDAIRE : ${upper(who)} FAIT TRIOMPHER LA PLUME`], seed),
    sub: `${points} point${points > 1 ? 's' : ''} à la clé.${bestCaption ? ` Punchline de l’édition : « ${bestCaption} ».` : ''}`,
    story: `Plébiscité(e) par le jury populaire, ${who} s’impose avec un humour que nos confrères jugent « tout à fait déplacé, donc parfait ».`,
  };
};

const bombFront = ({ winnerName, rounds, seed }) => {
  if (!winnerName) {
    return {
      kicker: 'Course contre la montre',
      headline: 'PERSONNE NE SORT INDEMNE DE LA SALLE',
      sub: 'La bombe a tout emporté, sans survivant.',
      story: 'Les démineurs sont formels : personne n’a trouvé le bon mot à temps. La rédaction présente ses condoléances au dictionnaire.',
    };
  }
  return {
    kicker: 'Course contre la montre',
    headline: pickFrom([`${upper(winnerName)} DÉSAMORCE LA BOMBE`, `SEUL SURVIVANT : ${upper(winnerName)}`, `${upper(winnerName)} A LE DERNIER MOT`], seed),
    sub: `${rounds} syllabe${rounds > 1 ? 's' : ''} ont été jouées avant le dénouement.`,
    story: `Sorti(e) indemne des décombres, ${winnerName} a simplement déclaré : « J’avais un mot sur le bout de la langue. » Les autorités enquêtent.`,
  };
};

export { imposteurFront, quiDeNousFront, captionFront, bombFront };
