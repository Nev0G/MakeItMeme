// Règles du Puissance 4. La ligne 0 est en haut de la grille.
export type Dims = { cols: number; rows: number; need: number };

export const SIZES: Record<string, Dims & { label: string }> = {
  classic: { cols: 7, rows: 6, need: 4, label: 'Classique 7×6 (aligne 4)' },
  mini: { cols: 5, rows: 4, need: 3, label: 'Mini 5×4 (aligne 3)' },
  big: { cols: 9, rows: 7, need: 5, label: 'Grand 9×7 (aligne 5)' },
};
export const dimsOf = (size: string | undefined): Dims => SIZES[size || 'classic'] || SIZES.classic;

export const emptyBoard = (d: Dims) => Array(d.cols * d.rows).fill(0) as number[];

// Ligne où tombe un jeton dans la colonne (-1 si pleine)
export const dropRow = (board: number[], col: number, d: Dims) => {
  if (!(col >= 0 && col < d.cols)) return -1;
  for (let r = d.rows - 1; r >= 0; r--) if (!board[r * d.cols + col]) return r;
  return -1;
};

// Cases alignées (au moins d.need) passant par (r, c), ou null
export const winLine = (board: number[], r: number, c: number, d: Dims): number[] | null => {
  const me = board[r * d.cols + c];
  if (!me) return null;
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const line = [r * d.cols + c];
    for (const sign of [1, -1]) {
      let rr = r + dr * sign;
      let cc = c + dc * sign;
      while (rr >= 0 && rr < d.rows && cc >= 0 && cc < d.cols && board[rr * d.cols + cc] === me) {
        line.push(rr * d.cols + cc);
        rr += dr * sign;
        cc += dc * sign;
      }
    }
    if (line.length >= d.need) return line;
  }
  return null;
};

// Une ligne gagnante de `who` n'importe où sur la grille (utile après un retrait Pop-out)
export const winAny = (board: number[], who: number, d: Dims): number[] | null => {
  for (let r = 0; r < d.rows; r++)
    for (let c = 0; c < d.cols; c++) if (board[r * d.cols + c] === who) {
      const line = winLine(board, r, c, d);
      if (line) return line;
    }
  return null;
};

export const isFull = (board: number[]) => board.every((x) => x);

// Pop-out : retire le jeton du bas de la colonne (il doit appartenir à `who`), les autres descendent d'un cran
export const popOut = (board: number[], col: number, who: number, d: Dims): number[] | null => {
  if (!(col >= 0 && col < d.cols) || board[(d.rows - 1) * d.cols + col] !== who) return null;
  const next = [...board];
  for (let r = d.rows - 1; r > 0; r--) next[r * d.cols + col] = next[(r - 1) * d.cols + col];
  next[col] = 0;
  return next;
};

// Coup automatique quand le temps est écoulé : colonne jouable la plus proche du centre
export const autoColumn = (board: number[], d: Dims) => {
  const mid = (d.cols - 1) / 2;
  const cols = Array.from({ length: d.cols }, (_, c) => c).filter((c) => dropRow(board, c, d) >= 0);
  return cols.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b)[0] ?? -1;
};
