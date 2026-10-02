// Syllabes de Bomb Party : chacune est contenue dans de très nombreux mots français.
const EASY = [
  'an', 'en', 'on', 'in', 'ou', 'oi', 'ai', 'eu', 'ch', 'qu', 'tion', 'ent', 'ant', 'ment', 'ble', 'ter', 'ver',
  'con', 'com', 'pro', 'pre', 'par', 'per', 'por', 'ris', 'ron', 'lar', 'mar', 'ran', 'ten', 'tou', 'sou', 'ren',
  'rai', 'ille', 'eur', 'age', 'ure', 'ois', 'ard', 'ine', 'ale', 'ion', 'ier', 'ous', 'cou', 'fer', 'ger', 'mon',
  'nat', 'pol', 'rou', 'sec', 'sta', 'tra', 'vol', 'bou', 'cha', 'dis', 'for', 'lan', 'min', 'pla', 'sur', 'tri',
];
const HARD = [
  'ouv', 'oir', 'aut', 'eau', 'gno', 'ps', 'ph', 'xt', 'cti', 'rch', 'mbr', 'ntr', 'ngl', 'uis', 'bri', 'pli', 'gue',
  'kil', 'zon', 'jou', 'vif', 'rag', 'blo', 'dra', 'flo', 'gri', 'pru', 'scr', 'str', 'thé', 'oeu', 'ync', 'quo',
];

// 'progressive' : faciles au début, puis mélangées, puis difficiles quand la partie avance
const pickSyllable = (difficulty: string, avoid: string[] = [], round = 0) => {
  const level = difficulty === 'progressive' ? (round < 5 ? 'easy' : round < 11 ? 'mix' : 'hard') : difficulty;
  const pool = level === 'hard' ? HARD : level === 'mix' ? [...EASY, ...HARD] : EASY;
  const fresh = pool.filter((s) => !avoid.includes(s));
  const list = fresh.length ? fresh : pool;
  return list[Math.floor(Math.random() * list.length)];
};

// Durée de la mèche (en secondes) : aléatoire, et de plus en plus courte au fil des tours
const fuseSeconds = (base: number, round: number) => {
  const shrink = Math.max(0.45, 1 - round * 0.03);
  const random = 0.6 + Math.random() * 0.8; // entre 60 % et 140 % du temps de base
  return Math.max(3, Math.round(base * shrink * random * 10) / 10);
};

export { pickSyllable, fuseSeconds };
