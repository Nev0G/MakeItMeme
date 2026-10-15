// Règles du Quoridor (plateau 9×9) : déplacements, sauts, murs, chemin garanti jusqu'au but.
export const N = 9;
export type Pos = [number, number]; // [ligne, colonne]
export type Wall = [number, number, 'h' | 'v']; // 'h' : sous la ligne r, sur les colonnes c et c+1 — 'v' : à droite de la colonne c, sur les lignes r et r+1

// Départs et buts selon le nombre de joueurs (2 ou 4)
export const STARTS: Pos[] = [[8, 4], [0, 4], [4, 0], [4, 8]];
export const goalReached = (i: number, [r, c]: Pos) => (i === 0 ? r === 0 : i === 1 ? r === 8 : i === 2 ? c === 8 : c === 0);

const inside = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N;
const has = (walls: Wall[], r: number, c: number, o: string) => walls.some((w) => w[0] === r && w[1] === c && w[2] === o);

// Un mur bloque-t-il le passage entre deux cases voisines ?
export const blocked = (walls: Wall[], r1: number, c1: number, r2: number, c2: number) => {
  if (c1 === c2) {
    const r = Math.min(r1, r2);
    return has(walls, r, c1, 'h') || has(walls, r, c1 - 1, 'h');
  }
  const c = Math.min(c1, c2);
  return has(walls, r1, c, 'v') || has(walls, r1 - 1, c, 'v');
};

const DIRS: Pos[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// Cases atteignables en un tour (pas de côté, saut par-dessus un pion, saut en diagonale)
export const legalMoves = (walls: Wall[], pawns: Pos[], me: number): Pos[] => {
  const [r, c] = pawns[me];
  const occupied = (a: number, b: number) => pawns.some((p, i) => i !== me && p && p[0] === a && p[1] === b);
  const out: Pos[] = [];
  for (const [dr, dc] of DIRS) {
    const nr = r + dr;
    const nc = c + dc;
    if (!inside(nr, nc) || blocked(walls, r, c, nr, nc)) continue;
    if (!occupied(nr, nc)) {
      out.push([nr, nc]);
      continue;
    }
    const jr = nr + dr;
    const jc = nc + dc;
    if (inside(jr, jc) && !blocked(walls, nr, nc, jr, jc) && !occupied(jr, jc)) {
      out.push([jr, jc]);
      continue;
    }
    for (const [sr, sc] of dr === 0 ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]]) {
      const ar = nr + sr;
      const ac = nc + sc;
      if (inside(ar, ac) && !blocked(walls, nr, nc, ar, ac) && !occupied(ar, ac)) out.push([ar, ac]);
    }
  }
  return out;
};

// Le pion peut-il encore rejoindre son but ? (les autres pions ne comptent pas)
const hasPath = (walls: Wall[], from: Pos, idx: number) => {
  const seen = new Set<number>([from[0] * N + from[1]]);
  const stack: Pos[] = [from];
  while (stack.length) {
    const [r, c] = stack.pop() as Pos;
    if (goalReached(idx, [r, c])) return true;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inside(nr, nc) || seen.has(nr * N + nc) || blocked(walls, r, c, nr, nc)) continue;
      seen.add(nr * N + nc);
      stack.push([nr, nc]);
    }
  }
  return false;
};

// `idx` : indices (dans pawns) des joueurs encore en jeu
export const canPlaceWall = (walls: Wall[], pawns: Pos[], active: number[], [r, c, o]: Wall) => {
  if (!(r >= 0 && r < N - 1 && c >= 0 && c < N - 1) || (o !== 'h' && o !== 'v')) return false;
  if (has(walls, r, c, 'h') || has(walls, r, c, 'v')) return false;
  if (o === 'h' && (has(walls, r, c - 1, 'h') || has(walls, r, c + 1, 'h'))) return false;
  if (o === 'v' && (has(walls, r - 1, c, 'v') || has(walls, r + 1, c, 'v'))) return false;
  const next: Wall[] = [...walls, [r, c, o]];
  return active.every((i) => hasPath(next, pawns[i], i));
};
