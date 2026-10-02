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

const pickSyllable = (difficulty: string, avoid: string[] = []) => {
  const pool = difficulty === 'hard' ? HARD : difficulty === 'mix' ? [...EASY, ...HARD] : EASY;
  const fresh = pool.filter((s) => !avoid.includes(s));
  const list = fresh.length ? fresh : pool;
  return list[Math.floor(Math.random() * list.length)];
};

export { pickSyllable };
