// Règles de Liar's Bar (jeu de bluff aux cartes), en fonctions pures.
// Paquet : 6 Rois (K), 6 Dames (Q), 6 As (A) et 2 Jokers (J). Chaque manche annonce une carte de la table ;
// on pose 1 à 3 cartes face cachée en prétendant qu'elles sont de ce type, ou on traite le joueur précédent de menteur.
// Le perdant de l'épreuve tire sur son revolver (6 chambres, 1 balle) : une balle et il est éliminé.
export type Card = 'K' | 'Q' | 'A' | 'J';
export const CARD_NAME: Record<string, string> = { K: 'Roi', Q: 'Dame', A: 'As', J: 'Joker' };
export const CHAMBERS = 6;
export const HAND = 5;

export type Reveal = {
  caller: string;
  liar: string; // joueur dont on a vérifié les cartes
  cards: Card[];
  truthful: boolean; // true : le joueur disait vrai, c'est l'accusateur qui perd
  loser: string;
  hit: boolean; // la balle était dans la chambre
  chamber: number; // numéro de la chambre tirée (1 à 6)
  until: number; // fin de l'animation côté host
};

export type LiarState = {
  order: string[];
  out: string[]; // joueurs éliminés ou partis
  hands: Record<string, Card[]>;
  table: Card; // carte de la table (K, Q ou A)
  turn: string;
  lastPlay: { id: string; count: number } | null;
  played: Card[]; // cartes réelles du dernier coup (cachées aux joueurs)
  guns: Record<string, { shots: number; bullet: number }>;
  reveal: Reveal | null;
  winner: string | null;
  round: number;
  log: string;
};

export const shuffled = <T,>(arr: T[], rnd: () => number = Math.random) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const buildDeck = (): Card[] => [...Array(6).fill('K'), ...Array(6).fill('Q'), ...Array(6).fill('A'), 'J', 'J'];
export const aliveOf = (s: Pick<LiarState, 'order' | 'out'>) => s.order.filter((id) => !s.out.includes(id));

export const nextAlive = (s: Pick<LiarState, 'order' | 'out'>, from: string) => {
  const n = s.order.length;
  let i = s.order.indexOf(from);
  for (let k = 0; k < n; k++) {
    i = (i + 1) % n;
    if (!s.out.includes(s.order[i])) return s.order[i];
  }
  return from;
};

// Nouvelle manche : nouvelle carte de la table, 5 cartes chacun, `starter` ouvre le tour
const startRound = (s: LiarState, starter: string, rnd: () => number): LiarState => {
  const alive = aliveOf(s);
  let deck = shuffled(buildDeck(), rnd);
  const hands: Record<string, Card[]> = {};
  for (const id of s.order) hands[id] = [];
  for (const id of alive) {
    hands[id] = deck.slice(0, HAND);
    deck = deck.slice(HAND);
  }
  const table = (['K', 'Q', 'A'] as Card[])[Math.floor(rnd() * 3)];
  return { ...s, hands, table, turn: alive.includes(starter) ? starter : alive[0], lastPlay: null, played: [], reveal: null, round: s.round + 1, log: '' };
};

export const newGame = (order: string[], rnd: () => number = Math.random): LiarState => {
  const guns: LiarState['guns'] = {};
  for (const id of order) guns[id] = { shots: 0, bullet: Math.floor(rnd() * CHAMBERS) };
  const base: LiarState = { order, out: [], hands: {}, table: 'K', turn: order[0], lastPlay: null, played: [], guns, reveal: null, winner: null, round: 0, log: '' };
  return startRound(base, order[0], rnd);
};

// Poser 1 à 3 cartes (indices dans la main)
export const playCards = (s: LiarState, id: string, idxs: number[]): LiarState | null => {
  if (s.winner || s.reveal || s.turn !== id) return null;
  const hand = s.hands[id] || [];
  const uniq = [...new Set(idxs)];
  if (uniq.length < 1 || uniq.length > 3 || uniq.some((i) => !Number.isInteger(i) || i < 0 || i >= hand.length)) return null;
  const played = uniq.map((i) => hand[i]);
  return {
    ...s,
    hands: { ...s.hands, [id]: hand.filter((_, i) => !uniq.includes(i)) },
    lastPlay: { id, count: played.length },
    played,
    turn: nextAlive(s, id),
    log: '',
  };
};

// « Menteur ! » : on vérifie les cartes du joueur précédent, le perdant tire
export const callLiar = (s: LiarState, id: string, until: number): LiarState | null => {
  if (s.winner || s.reveal || s.turn !== id || !s.lastPlay) return null;
  const liar = s.lastPlay.id;
  const truthful = s.played.every((c) => c === s.table || c === 'J');
  const loser = truthful ? id : liar;
  const gun = s.guns[loser];
  const hit = gun.shots === gun.bullet;
  const reveal: Reveal = { caller: id, liar, cards: s.played, truthful, loser, hit, chamber: gun.shots + 1, until };
  return { ...s, guns: { ...s.guns, [loser]: { ...gun, shots: gun.shots + 1 } }, reveal };
};

// Fin de l'animation : élimination éventuelle, puis nouvelle manche ou victoire
export const afterReveal = (s: LiarState, rnd: () => number = Math.random): LiarState => {
  if (!s.reveal) return s;
  const { loser, hit } = s.reveal;
  const out = hit ? [...s.out, loser] : s.out;
  const next = { ...s, out, reveal: null };
  const alive = aliveOf(next);
  if (alive.length <= 1) return { ...next, winner: alive[0] ?? loser, log: '' };
  return startRound(next, hit ? nextAlive({ order: s.order, out: s.out }, loser) : loser, rnd);
};

// Un joueur quitte la partie
export const forfeitPlayer = (s: LiarState, id: string, rnd: () => number = Math.random): LiarState => {
  if (s.out.includes(id) || !s.order.includes(id) || s.winner) return s;
  const out = [...s.out, id];
  const alive = s.order.filter((x) => !out.includes(x));
  if (alive.length <= 1) return { ...s, out, reveal: null, winner: alive[0] ?? id };
  if (s.reveal) {
    // Une épreuve est en cours : elle va à son terme, le départ est pris en compte juste après
    return { ...s, out };
  }
  return startRound({ ...s, out }, nextAlive({ order: s.order, out }, s.turn === id ? id : s.turn), rnd);
};

// Le joueur peut-il poser des cartes ? Sinon il doit traiter le précédent de menteur.
export const mustCallLiar = (s: LiarState, id: string) => (s.hands[id]?.length ?? 0) === 0 && !!s.lastPlay;
