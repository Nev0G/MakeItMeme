// Règles du Uno, en fonctions pures : chaque action renvoie le nouvel état (ou null si elle est interdite).
// Carte = "<couleur><valeur>" : couleur R/Y/G/B (ou W pour les jokers), valeur 0-9, S (passe), R (inverse), D (+2), W (joker), F (+4).
export type UnoState = {
  order: string[]; // joueurs, dans l'ordre des tours
  hands: Record<string, string[]>;
  deck: string[]; // pioche (la fin du tableau est le dessus)
  discard: string[]; // défausse (la fin du tableau est le dessus)
  color: string; // couleur à jouer
  dir: 1 | -1;
  turn: string;
  drew: boolean; // le joueur courant a déjà pioché ce tour-ci (il peut encore jouer cette carte ou passer)
  out: string[]; // joueurs partis
  winner: string | null;
  log: string; // dernier événement, pour l'affichage
};

export const COLORS = ['R', 'Y', 'G', 'B'] as const;
export const COLOR_NAME: Record<string, string> = { R: 'Rouge', Y: 'Jaune', G: 'Vert', B: 'Bleu', W: 'Joker' };

export const buildDeck = () => {
  const deck: string[] = [];
  for (const c of COLORS) {
    deck.push(`${c}0`);
    for (const v of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'S', 'R', 'D']) deck.push(`${c}${v}`, `${c}${v}`);
  }
  for (let i = 0; i < 4; i++) deck.push('WW', 'WF');
  return deck;
};

export const shuffled = <T,>(arr: T[], rnd: () => number = Math.random) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const isWild = (card: string) => card[0] === 'W';
export const canPlay = (card: string, top: string, color: string) => isWild(card) || card[0] === color || card[1] === top[1];
export const cardPoints = (card: string) => (isWild(card) ? 50 : /\d/.test(card[1]) ? Number(card[1]) : 20);

export const activeOf = (s: UnoState) => s.order.filter((id) => !s.out.includes(id));
const nextOf = (s: UnoState, from: string, steps = 1) => {
  const act = activeOf(s);
  const i = act.indexOf(from);
  const n = act.length;
  return act[(((i + s.dir * steps) % n) + n) % n];
};

// Prend n cartes dans la pioche (qui est reconstituée avec la défausse si besoin)
const draw = (s: UnoState, id: string, n: number): UnoState => {
  let { deck, discard } = s;
  const hand = [...s.hands[id]];
  for (let k = 0; k < n; k++) {
    if (!deck.length) {
      if (discard.length <= 1) break;
      deck = shuffled(discard.slice(0, -1));
      discard = [discard[discard.length - 1]];
    }
    hand.push(deck[deck.length - 1]);
    deck = deck.slice(0, -1);
  }
  return { ...s, deck, discard, hands: { ...s.hands, [id]: hand } };
};

export const deal = (order: string[], rnd: () => number = Math.random): UnoState => {
  let deck = shuffled(buildDeck(), rnd);
  const hands: Record<string, string[]> = {};
  for (const id of order) {
    hands[id] = deck.slice(-7);
    deck = deck.slice(0, -7);
  }
  // La carte de départ est une carte chiffrée
  let k = deck.length - 1;
  while (k > 0 && !/\d/.test(deck[k][1])) k--;
  const start = deck[k];
  deck = [...deck.slice(0, k), ...deck.slice(k + 1)];
  return { order, hands, deck, discard: [start], color: start[0], dir: 1, turn: order[0], drew: false, out: [], winner: null, log: 'La partie commence !' };
};

export const playCard = (s: UnoState, id: string, index: number, chosen?: string): UnoState | null => {
  if (s.winner || s.turn !== id) return null;
  const hand = s.hands[id];
  const card = hand?.[index];
  if (!card || !canPlay(card, s.discard[s.discard.length - 1], s.color)) return null;
  if (isWild(card) && !(COLORS as readonly string[]).includes(chosen || '')) return null;
  let next: UnoState = {
    ...s,
    hands: { ...s.hands, [id]: hand.filter((_, i) => i !== index) },
    discard: [...s.discard, card],
    color: isWild(card) ? (chosen as string) : card[0],
    drew: false,
    log: '',
  };
  if (!next.hands[id].length) return { ...next, winner: id, log: 'Plus de cartes !' };
  const act = activeOf(next);
  const v = card[1];
  if (v === 'R') {
    if (act.length === 2) {
      next = { ...next, turn: id, log: 'Sens inversé : le joueur rejoue !' };
      return { ...next, turn: nextOf(next, id, 2) };
    }
    next = { ...next, dir: (next.dir * -1) as 1 | -1, log: 'Changement de sens !' };
  }
  let target = nextOf(next, id);
  if (v === 'S') next = { ...next, log: 'Tour passé !' };
  if (v === 'D') {
    next = { ...draw(next, target, 2), log: 'Pioche 2 cartes !' };
  }
  if (v === 'F') {
    next = { ...draw(next, target, 4), log: 'Pioche 4 cartes !' };
  }
  if (v === 'S' || v === 'D' || v === 'F') target = nextOf(next, target);
  return { ...next, turn: target, drew: false };
};

// Piocher une carte. Si elle ne se joue pas, le tour passe tout de suite.
export const drawOne = (s: UnoState, id: string): UnoState | null => {
  if (s.winner || s.turn !== id || s.drew) return null;
  const next = draw(s, id, 1);
  const hand = next.hands[id];
  const got = hand.length > s.hands[id].length ? hand[hand.length - 1] : null;
  if (got && canPlay(got, next.discard[next.discard.length - 1], next.color)) return { ...next, drew: true, log: '' };
  return { ...next, turn: nextOf(next, id), drew: false, log: '' };
};
export const passTurn = (s: UnoState, id: string): UnoState | null => {
  if (s.winner || s.turn !== id || !s.drew) return null;
  return { ...s, turn: nextOf(s, id), drew: false, log: '' };
};

// Un joueur quitte : ses cartes retournent sous la pioche
export const forfeitPlayer = (s: UnoState, id: string): UnoState => {
  if (s.out.includes(id) || !s.order.includes(id)) return s;
  const wasTurn = s.turn === id;
  const turnNext = wasTurn ? nextOf(s, id) : s.turn;
  const next: UnoState = { ...s, out: [...s.out, id], deck: [...s.hands[id], ...s.deck], hands: { ...s.hands, [id]: [] } };
  const act = activeOf(next);
  if (act.length <= 1) return { ...next, winner: act[0] || id, log: 'Les autres joueurs sont partis.' };
  return { ...next, turn: wasTurn ? turnNext : s.turn, drew: wasTurn ? false : s.drew };
};
