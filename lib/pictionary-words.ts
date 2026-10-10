// Mots du Pictionary : faciles à dessiner, moyens, puis expressions pour les courageux.
const EASY = [
  'chat', 'chien', 'maison', 'soleil', 'lune', 'étoile', 'fleur', 'arbre', 'voiture', 'avion', 'bateau', 'vélo', 'pizza', 'banane', 'pomme',
  'fromage', 'glace', 'gâteau', 'cœur', 'main', 'pied', 'oeil', 'nez', 'bouche', 'lunettes', 'chapeau', 'chaussure', 'parapluie', 'clé',
  'livre', 'téléphone', 'ordinateur', 'horloge', 'lit', 'chaise', 'table', 'fenêtre', 'porte', 'escalier', 'montagne', 'plage', 'vague',
  'nuage', 'pluie', 'neige', 'bonhomme de neige', 'fusée', 'robot', 'fantôme', 'dragon', 'licorne', 'poisson', 'oiseau', 'serpent',
  'araignée', 'escargot', 'papillon', 'girafe', 'éléphant', 'singe', 'pingouin', 'canard', 'cochon', 'vache', 'lapin', 'tortue',
];
const MEDIUM = [
  'baguette', 'croissant', 'raclette', 'tour Eiffel', 'guitare', 'piano', 'microscope', 'télescope', 'aspirateur', 'machine à laver',
  'grille-pain', 'trottinette', 'hélicoptère', 'sous-marin', 'montgolfière', 'château fort', 'pirate', 'astronaute', 'sorcière', 'vampire',
  'zombie', 'sirène', 'cowboy', 'ninja', 'chevalier', 'clown', 'magicien', 'plombier', 'pompier', 'dentiste', 'facteur', 'cuisinier',
  'karaoké', 'barbecue', 'camping', 'piscine', 'toboggan', 'balançoire', 'cerf-volant', 'feu d\'artifice', 'arc-en-ciel', 'volcan',
  'tornade', 'igloo', 'pyramide', 'phare', 'moulin', 'pont', 'tunnel', 'mégaphone', 'selfie', 'wifi', 'emoji', 'mème', 'tiktok',
  'hamburger', 'sushi', 'spaghetti', 'popcorn', 'hot-dog', 'crêpe',
];
const HARD = [
  'avoir un chat dans la gorge', 'tomber dans les pommes', 'poser un lapin', 'avoir le cafard', 'être dans la lune', 'mettre son grain de sel',
  'coup de foudre', 'pleuvoir des cordes', 'prendre ses jambes à son cou', 'vendre la peau de l\'ours', 'revenir à ses moutons',
  'se jeter à l\'eau', 'casser la baraque', 'avoir les yeux plus gros que le ventre', 'faire d\'une pierre deux coups', 'la fin du monde',
  'un jour sans fin', 'la loi de Murphy', 'le syndrome de l\'imposteur', 'un cheval de Troie', 'le père Noël en vacances',
  'un déménagement raté', 'la crise de la quarantaine', 'un lundi matin', 'le réveil qui sonne', 'une panne de wifi',
  'un mariage qui tourne mal', 'la queue à la boulangerie', 'une soirée pyjama', 'le dernier carré de chocolat',
];

const WORDS = { easy: EASY, mix: [...EASY, ...MEDIUM], medium: MEDIUM, hard: [...MEDIUM, ...HARD], chaos: HARD };

const norm = (w: string) => w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/œ/g, 'oe').replace(/[^a-z0-9]/g, '');

// Trois mots au hasard (sans répéter ceux déjà joués)
const pickChoices = (difficulty: string, used: string[]) => {
  const pool = (WORDS[difficulty] || WORDS.mix).filter((w) => !used.includes(w));
  const bag = [...(pool.length >= 3 ? pool : WORDS.mix)];
  const out: string[] = [];
  while (out.length < 3 && bag.length) out.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]);
  return out;
};

// Même mot, à un pluriel près
const sameWord = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  return !!x && (x === y || x.replace(/[sx]$/, '') === y.replace(/[sx]$/, ''));
};

// Distance de Levenshtein (pour « tu chauffes ! »)
const distance = (a: string, b: string) => {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
};
const isClose = (guess: string, word: string) => {
  const g = norm(guess);
  const w = norm(word);
  return g.length >= 4 && w.length >= 4 && distance(g, w) <= 1;
};

export { pickChoices, sameWord, isClose, norm };
