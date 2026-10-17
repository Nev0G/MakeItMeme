// Règles du Scrabble (version française) : sac de lettres, plateau 15×15, cases bonus, formation et score des mots.
export const SIZE = 15;
export const CENTER = 7 * SIZE + 7;

// Distribution française : [lettre, nombre, valeur] — 102 jetons dont 2 jokers (« ? »)
const DISTRIBUTION: [string, number, number][] = [
  ['A', 9, 1], ['B', 2, 3], ['C', 2, 3], ['D', 3, 2], ['E', 15, 1], ['F', 2, 4], ['G', 2, 2], ['H', 2, 4], ['I', 8, 1],
  ['J', 1, 8], ['K', 1, 10], ['L', 5, 1], ['M', 3, 2], ['N', 6, 1], ['O', 6, 1], ['P', 2, 3], ['Q', 1, 8], ['R', 6, 1],
  ['S', 6, 1], ['T', 6, 1], ['U', 6, 1], ['V', 2, 4], ['W', 1, 10], ['X', 1, 10], ['Y', 1, 10], ['Z', 1, 10], ['?', 2, 0],
];
export const POINTS: Record<string, number> = Object.fromEntries(DISTRIBUTION.map(([l, , p]) => [l, p]));
export const buildBag = () => DISTRIBUTION.flatMap(([l, n]) => Array(n).fill(l) as string[]);

export const shuffled = <T,>(arr: T[], rnd: () => number = Math.random) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Cases bonus : 'W3' mot compte triple, 'W2' mot compte double, 'L3' lettre triple, 'L2' lettre double
const BONUS: Record<number, string> = {};
const put = (kind: string, cells: [number, number][]) => cells.forEach(([r, c]) => (BONUS[r * SIZE + c] = kind));
put('W3', [[0, 0], [0, 7], [0, 14], [7, 0], [7, 14], [14, 0], [14, 7], [14, 14]]);
put('W2', [[1, 1], [2, 2], [3, 3], [4, 4], [10, 10], [11, 11], [12, 12], [13, 13], [1, 13], [2, 12], [3, 11], [4, 10], [10, 4], [11, 3], [12, 2], [13, 1], [7, 7]]);
put('L3', [[1, 5], [1, 9], [5, 1], [5, 5], [5, 9], [5, 13], [9, 1], [9, 5], [9, 9], [9, 13], [13, 5], [13, 9]]);
put('L2', [[0, 3], [0, 11], [2, 6], [2, 8], [3, 0], [3, 7], [3, 14], [6, 2], [6, 6], [6, 8], [6, 12], [7, 3], [7, 11], [8, 2], [8, 6], [8, 8], [8, 12], [11, 0], [11, 7], [11, 14], [12, 6], [12, 8], [14, 3], [14, 11]]);
export const bonusAt = (idx: number) => BONUS[idx] || '';

// Plateau : tableau de 225 chaînes — '' vide, 'A' lettre, 'a' joker représentant A (vaut 0 point)
export const emptyBoard = () => Array(SIZE * SIZE).fill('') as string[];
export const letterPoints = (cell: string) => (cell === cell.toLowerCase() ? 0 : POINTS[cell] ?? 0);

export type Tile = { r: number; c: number; ch: string; blank?: boolean };
export type Word = { text: string; pts: number };
export type MoveResult = { ok: false; error: string } | { ok: true; words: Word[]; total: number; bingo: boolean };

// Les tuiles posées sont-elles bien prises dans le chevalet ? (un joker remplace n'importe quelle lettre)
export const rackAllows = (rack: string[], tiles: Tile[]) => {
  const left = [...rack];
  for (const t of tiles) {
    const k = left.indexOf(t.blank ? '?' : t.ch);
    if (k < 0) return false;
    left.splice(k, 1);
  }
  return true;
};

// Vérifie la géométrie d'un coup et calcule les mots formés et le score (sans vérifier le dictionnaire)
export const evaluateMove = (board: string[], tiles: Tile[]): MoveResult => {
  if (!tiles.length) return { ok: false, error: 'Pose au moins une lettre.' };
  const seen = new Set<number>();
  for (const t of tiles) {
    if (!(t.r >= 0 && t.r < SIZE && t.c >= 0 && t.c < SIZE) || !/^[A-Z]$/.test(t.ch)) return { ok: false, error: 'Coup invalide.' };
    const k = t.r * SIZE + t.c;
    if (board[k] || seen.has(k)) return { ok: false, error: 'Une case est déjà occupée.' };
    seen.add(k);
  }
  const sameRow = tiles.every((t) => t.r === tiles[0].r);
  const sameCol = tiles.every((t) => t.c === tiles[0].c);
  if (!sameRow && !sameCol) return { ok: false, error: 'Les lettres doivent être sur une même ligne ou colonne.' };

  const cells = board.slice();
  tiles.forEach((t) => (cells[t.r * SIZE + t.c] = t.blank ? t.ch.toLowerCase() : t.ch));
  const fresh = new Set(seen);
  const at = (r: number, c: number) => (r >= 0 && r < SIZE && c >= 0 && c < SIZE ? cells[r * SIZE + c] : '');

  // Pas de trou entre les lettres posées (les lettres déjà sur le plateau comblent les vides)
  if (tiles.length > 1) {
    const [lo, hi] = sameRow ? [Math.min(...tiles.map((t) => t.c)), Math.max(...tiles.map((t) => t.c))] : [Math.min(...tiles.map((t) => t.r)), Math.max(...tiles.map((t) => t.r))];
    for (let i = lo; i <= hi; i++) if (!(sameRow ? at(tiles[0].r, i) : at(i, tiles[0].c))) return { ok: false, error: 'Il ne doit pas y avoir de trou entre les lettres.' };
  }

  const boardEmpty = board.every((x) => !x);
  if (boardEmpty) {
    if (!seen.has(CENTER)) return { ok: false, error: 'Le premier mot doit passer par la case centrale ★.' };
    if (tiles.length < 2) return { ok: false, error: 'Le premier mot doit faire au moins 2 lettres.' };
  } else {
    const touches = tiles.some((t) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => board[(t.r + dr) * SIZE + (t.c + dc)] && at(t.r + dr, t.c + dc) && !fresh.has((t.r + dr) * SIZE + (t.c + dc))));
    if (!touches) return { ok: false, error: 'Le mot doit toucher une lettre déjà posée.' };
  }

  // Mot formé dans une direction à partir d'une case
  const run = (r: number, c: number, dr: number, dc: number) => {
    let rr = r;
    let cc = c;
    while (at(rr - dr, cc - dc)) {
      rr -= dr;
      cc -= dc;
    }
    const idx: number[] = [];
    while (at(rr, cc)) {
      idx.push(rr * SIZE + cc);
      rr += dr;
      cc += dc;
    }
    return idx;
  };
  const score = (idx: number[]): Word => {
    let sum = 0;
    let mult = 1;
    for (const k of idx) {
      let v = letterPoints(cells[k]);
      if (fresh.has(k)) {
        const b = bonusAt(k);
        if (b === 'L2') v *= 2;
        else if (b === 'L3') v *= 3;
        else if (b === 'W2') mult *= 2;
        else if (b === 'W3') mult *= 3;
      }
      sum += v;
    }
    return { text: idx.map((k) => cells[k].toUpperCase()).join(''), pts: sum * mult };
  };

  const words: Word[] = [];
  const t0 = tiles[0];
  if (tiles.length > 1) {
    const main = sameRow ? run(t0.r, t0.c, 0, 1) : run(t0.r, t0.c, 1, 0);
    words.push(score(main));
    for (const t of tiles) {
      const cross = sameRow ? run(t.r, t.c, 1, 0) : run(t.r, t.c, 0, 1);
      if (cross.length > 1) words.push(score(cross));
    }
  } else {
    const h = run(t0.r, t0.c, 0, 1);
    const v = run(t0.r, t0.c, 1, 0);
    if (h.length > 1) words.push(score(h));
    if (v.length > 1) words.push(score(v));
  }
  if (!words.length) return { ok: false, error: 'Aucun mot formé.' };
  const bingo = tiles.length === 7;
  return { ok: true, words, total: words.reduce((n, w) => n + w.pts, 0) + (bingo ? 50 : 0), bingo };
};

// Dictionnaire : liste de mots (MAJUSCULES sans accents) chargée une fois depuis /dict/fr.txt
let dictPromise: Promise<Set<string> | null> | null = null;
export const loadDictionary = () => {
  if (!dictPromise) {
    dictPromise = fetch('/dict/fr.txt')
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('dico'))))
      .then((t) => new Set(t.split('\n')))
      .catch(() => {
        dictPromise = null;
        return null;
      });
  }
  return dictPromise;
};
