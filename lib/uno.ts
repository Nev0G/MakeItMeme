// Règles du Uno, en fonctions pures : chaque action renvoie le nouvel état (ou null si elle est interdite).
// Carte = "<couleur><valeur>" : couleur R/Y/G/B (ou W pour les jokers), valeur 0-9, S (passe), R (inverse), D (+2), W (joker), F (+4).
// Variantes : taille de la main, cumul des +2/+4, règle 7-0 (échange / rotation des mains), pioche jusqu'à pouvoir jouer
export type UnoOpts = { hand: number; stack: boolean; swap: boolean; drawUntil: boolean };
export const DEFAULT_OPTS: UnoOpts = { hand: 7, stack: false, swap: false, drawUntil: false };

export type UnoState = {
  opts: UnoOpts;
  pending: number; // cartes à piocher accumulées (cumul des +2 / +4)
  pendingKind: 'D' | 'F' | null;
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
// Avec le cumul : face à une pénalité, on ne peut répondre que par un +2 / +4 (un +2 se cumule avec un +2 ou un +4, un +4 seulement avec un +4)
export const canPlayNow = (s: UnoState, card: string) => {
  if (s.pending > 0 && s.opts.stack) return s.pendingKind === 'D' ? card[1] === 'D' || card[1] === 'F' : card[1] === 'F';
  return canPlay(card, s.discard[s.discard.length - 1], s.color);
};
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

export const deal = (order: string[], opts: UnoOpts = DEFAULT_OPTS, rnd: () => number = Math.random): UnoState => {
  let deck = shuffled(buildDeck(), rnd);
  const hands: Record<string, string[]> = {};
  for (const id of order) {
    hands[id] = deck.slice(-opts.hand);
    deck = deck.slice(0, -opts.hand);
  }
  // La carte de départ est une carte chiffrée
  let k = deck.length - 1;
  while (k > 0 && !/\d/.test(deck[k][1])) k--;
  const start = deck[k];
  deck = [...deck.slice(0, k), ...deck.slice(k + 1)];
  return { opts, pending: 0, pendingKind: null, order, hands, deck, discard: [start], color: start[0], dir: 1, turn: order[0], drew: false, out: [], winner: null, log: 'La partie commence !' };
};

export const playCard = (s: UnoState, id: string, index: number, chosen?: string, target?: string): UnoState | null => {
  if (s.winner || s.turn !== id) return null;
  const hand = s.hands[id];
  const card = hand?.[index];
  if (!card || !canPlayNow(s, card)) return null;
  if (isWild(card) && !(COLORS as readonly string[]).includes(chosen || '')) return null;
  const v = card[1];
  const swapSeven = s.opts.swap && v === '7' && hand.length > 1;
  if (swapSeven && !(target && target !== id && activeOf(s).includes(target))) return null;
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

  // Règle 7-0
  if (s.opts.swap && v === '7' && target) {
    const mine = next.hands[id];
    next = { ...next, hands: { ...next.hands, [id]: next.hands[target], [target]: mine }, log: 'Échange de mains !' };
  }
  if (s.opts.swap && v === '0') {
    const hands = { ...next.hands };
    act.forEach((pid) => (hands[nextOf(next, pid)] = next.hands[pid]));
    next = { ...next, hands, log: 'Rotation des mains !' };
  }

  if (v === 'R') {
    if (act.length === 2) {
      next = { ...next, turn: id, log: 'Sens inversé : le joueur rejoue !' };
      return { ...next, turn: nextOf(next, id, 2) };
    }
    next = { ...next, dir: (next.dir * -1) as 1 | -1, log: 'Changement de sens !' };
  }
  let target2 = nextOf(next, id);
  if (v === 'S') next = { ...next, log: 'Tour passé !' };
  if (v === 'D' || v === 'F') {
    const n = v === 'D' ? 2 : 4;
    if (s.opts.stack) {
      // Cumul : la pénalité grossit et passe au joueur suivant, qui peut la relancer
      const pending = s.pending + n;
      return { ...next, pending, pendingKind: v, turn: target2, drew: false, log: `Pénalité : +${pending} !` };
    }
    next = { ...draw(next, target2, n), log: `Pioche ${n} cartes !` };
  }
  if (v === 'S' || v === 'D' || v === 'F') target2 = nextOf(next, target2);
  return { ...next, turn: target2, drew: false };
};

// Piocher une carte. Si elle ne se joue pas, le tour passe tout de suite.
// Face à une pénalité cumulée, on pioche toute la pénalité et on passe son tour.
export const drawOne = (s: UnoState, id: string): UnoState | null => {
  if (s.winner || s.turn !== id || s.drew) return null;
  if (s.pending > 0) {
    const next = draw(s, id, s.pending);
    return { ...next, pending: 0, pendingKind: null, turn: nextOf(next, id), drew: false, log: `${s.pending} cartes piochées !` };
  }
  let next = draw(s, id, 1);
  let hand = next.hands[id];
  let got = hand.length > s.hands[id].length ? hand[hand.length - 1] : null;
  const top = () => next.discard[next.discard.length - 1];
  // Variante : on pioche jusqu'à tomber sur une carte jouable
  while (s.opts.drawUntil && got && !canPlay(got, top(), next.color) && (next.deck.length || next.discard.length > 1)) {
    const before = next.hands[id].length;
    next = draw(next, id, 1);
    hand = next.hands[id];
    got = hand.length > before ? hand[hand.length - 1] : null;
  }
  if (got && canPlay(got, top(), next.color)) return { ...next, drew: true, log: '' };
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

// Coup automatique quand le temps est écoulé
export const autoStep = (s: UnoState): UnoState => {
  const id = s.turn;
  const hand = s.hands[id] || [];
  if (s.pending > 0) return drawOne(s, id) || s;
  const idx = hand.findIndex((c) => canPlayNow(s, c));
  const pick = (st: UnoState, i: number) => {
    const card = st.hands[id][i];
    let color: string | undefined;
    if (isWild(card)) {
      const count: Record<string, number> = { R: 0, Y: 0, G: 0, B: 0 };
      st.hands[id].forEach((c) => !isWild(c) && count[c[0]]++);
      color = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
    }
    let target: string | undefined;
    if (st.opts.swap && card[1] === '7') {
      target = activeOf(st).filter((x) => x !== id).sort((a, b) => st.hands[a].length - st.hands[b].length)[0];
    }
    return playCard(st, id, i, color, target);
  };
  if (idx >= 0) return pick(s, idx) || s;
  const drawn = drawOne(s, id);
  if (!drawn) return s;
  if (drawn.drew && drawn.turn === id) {
    const j = drawn.hands[id].findIndex((c) => canPlayNow(drawn, c));
    return (j >= 0 ? pick(drawn, j) : passTurn(drawn, id)) || drawn;
  }
  return drawn;
};
