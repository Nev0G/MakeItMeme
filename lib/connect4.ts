// Règles du Puissance 4 : grille 7 colonnes × 6 lignes, la ligne 0 est en haut.
export const COLS = 7;
export const ROWS = 6;

export const emptyBoard = () => Array(COLS * ROWS).fill(0) as number[];

// Ligne où tombe un jeton dans la colonne (-1 si pleine)
export const dropRow = (board: number[], col: number) => {
  if (!(col >= 0 && col < COLS)) return -1;
  for (let r = ROWS - 1; r >= 0; r--) if (!board[r * COLS + col]) return r;
  return -1;
};

// Cases alignées (4 ou plus) passant par (r, c), ou null
export const winLine = (board: number[], r: number, c: number): number[] | null => {
  const me = board[r * COLS + c];
  if (!me) return null;
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const line = [r * COLS + c];
    for (const sign of [1, -1]) {
      let rr = r + dr * sign;
      let cc = c + dc * sign;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr * COLS + cc] === me) {
        line.push(rr * COLS + cc);
        rr += dr * sign;
        cc += dc * sign;
      }
    }
    if (line.length >= 4) return line;
  }
  return null;
};

export const isFull = (board: number[]) => board.every((x) => x);
