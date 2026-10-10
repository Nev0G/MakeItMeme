// Mots du Pictionary : faciles à dessiner, moyens, puis expressions pour les courageux.
const EASY = [
  'chat', 'chien', 'maison', 'soleil', 'lune', 'étoile', 'fleur', 'arbre', 'voiture', 'avion', 'bateau', 'vélo', 'pizza', 'banane', 'pomme',
  'fromage', 'glace', 'gâteau', 'cœur', 'main', 'pied', 'oeil', 'nez', 'bouche', 'lunettes', 'chapeau', 'chaussure', 'parapluie', 'clé',
  'livre', 'téléphone', 'ordinateur', 'horloge', 'lit', 'chaise', 'table', 'fenêtre', 'porte', 'escalier', 'montagne', 'plage', 'vague',
  'nuage', 'pluie', 'neige', 'bonhomme de neige', 'fusée', 'robot', 'fantôme', 'dragon', 'licorne', 'poisson', 'oiseau', 'serpent',
  'araignée', 'escargot', 'papillon', 'girafe', 'éléphant', 'singe', 'pingouin', 'canard', 'cochon', 'vache', 'lapin', 'tortue',
  'cheval', 'mouton', 'poule', 'coq', 'oie', 'âne',
  'chèvre', 'chameau', 'zèbre', 'lion', 'tigre', 'ours',
  'loup', 'renard', 'écureuil', 'hérisson', 'souris', 'rat',
  'hamster', 'grenouille', 'crapaud', 'crocodile', 'requin', 'baleine',
  'dauphin', 'pieuvre', 'crabe', 'étoile de mer', 'méduse', 'hibou',
  'chouette', 'aigle', 'perroquet', 'flamant rose', 'kangourou', 'koala',
  'panda', 'ours polaire', 'abeille', 'mouche', 'moustique', 'fourmi',
  'coccinelle', 'chenille', 'libellule', 'ver de terre', 'cygne', 'paon',
  'hippopotame', 'rhinocéros', 'gorille', 'taupe', 'cerf', 'sanglier',
  'dromadaire', 'phoque', 'morse', 'toucan', 'pélican', 'autruche',
  'vautour', 'corbeau', 'pigeon', 'moineau', 'tortue de mer', 'lézard',
  'caméléon', 'scorpion', 'cigale', 'sauterelle', 'ballon', 'bougie',
  'bouteille', 'brosse à dents', 'cadeau', 'camion', 'casque', 'ciseaux',
  'couteau', 'cuillère', 'fourchette', 'assiette', 'verre', 'tasse',
  'théière', 'casserole', 'marteau', 'tournevis', 'scie', 'échelle',
  'valise', 'sac à dos', 'cadenas', 'drapeau', 'couronne', 'épée',
  'bouclier', 'arc et flèche', 'tente', 'feu de camp', 'lampe', 'ampoule',
  'miroir', 'peigne', 'savon', 'serviette', 'baignoire', 'douche',
  'toilettes', 'canapé', 'tapis', 'rideau', 'cheminée', 'télévision',
  'télécommande', 'radio', 'tambour', 'trompette', 'violon', 'micro',
  'appareil photo', 'ballon de foot', 'raquette', 'moto', 'tracteur', 'train',
  'bus', 'ancre', 'tipi', 'cabane', 'tour', 'église',
  'poire', 'fraise', 'cerise', 'raisin', 'citron', 'orange',
  'ananas', 'pastèque', 'carotte', 'tomate', 'maïs', 'champignon',
  'oignon', 'œuf', 'pain', 'frites', 'saucisse', 'jambon',
  'poulet', 'biscuit', 'bonbon', 'sucette', 'chocolat', 'gaufre',
  'beignet', 'donut', 'cupcake', 'tarte', 'sandwich', 'soupe',
  'café', 'thé', 'lait', 'bière', 'éclair', 'île',
  'cascade', 'rivière', 'lac', 'forêt', 'désert', 'cactus',
  'palmier', 'sapin', 'rose', 'tournesol', 'tulipe', 'feuille',
  'nid', 'bras', 'jambe', 'dos', 'oreille', 'dent',
  'langue', 'cheveux', 'barbe', 'moustache', 'genou', 'doigt',
  'pouce', 'cerveau', 'squelette', 'crâne', 'bébé', 'roi',
  'reine', 'princesse', 'père Noël', 'extraterrestre', 'bonhomme', 'momie',
  'étoile filante', 'comète', 'planète', 'ovni', 'satellite', 'diamant',
  'pièce de monnaie', 'billet', 'coffre au trésor', 'carte', 'boussole', 'sablier',
  'calendrier', 'bulle', 'bottes', 'écharpe', 'bonnet', 'gant',
  'cravate', 'robe', 'jupe', 'chemise', 'short', 'maillot de bain',
  'tongs', 'casquette', 'ceinture', 'sac à main', 'jumelles', 'loupe',
  'bougeoir', 'lanterne', 'torche', 'allumette', 'briquet', 'cigare',
  'pipe', 'tube de dentifrice', 'rouleau de papier', 'poubelle', 'balai', 'seau',
  'arrosoir', 'brouette', 'pelle', 'râteau', 'hache', 'pioche',
  'clou', 'vis', 'cadre photo', 'vase', 'bouquet', 'couronne de fleurs',
  'nœud papillon', 'baguette magique', 'boule de cristal', 'chapeau de sorcière', 'citrouille', 'squelette de dinosaure',
  'goutte d\'eau', 'flocon de neige', 'iglou', 'sapin de Noël', 'guirlande', 'cloche',
  'cadeau de Noël', 'œuf de Pâques', 'lapin de Pâques', 'gâteau d\'anniversaire', 'bougie d\'anniversaire', 'ballon de baudruche',
  'confettis', 'masque', 'domino', 'dé', 'carte à jouer', 'pièce d\'échecs',
  'puzzle', 'toupie', 'yo-yo', 'ours en peluche', 'poupée', 'robot jouet',
  'train électrique', 'bac à sable', 'château de sable', 'seau et pelle', 'bouée', 'palmes',
  'tuba', 'planche de surf', 'voilier', 'canot', 'radeau', 'sous-marin jaune',
  'bateau pirate', 'trésor', 'carte au trésor', 'perroquet pirate', 'crochet', 'jambe de bois',
];
const MEDIUM = [
  'baguette', 'croissant', 'raclette', 'tour Eiffel', 'guitare', 'piano', 'microscope', 'télescope', 'aspirateur', 'machine à laver',
  'grille-pain', 'trottinette', 'hélicoptère', 'sous-marin', 'montgolfière', 'château fort', 'pirate', 'astronaute', 'sorcière', 'vampire',
  'zombie', 'sirène', 'cowboy', 'ninja', 'chevalier', 'clown', 'magicien', 'plombier', 'pompier', 'dentiste', 'facteur', 'cuisinier',
  'karaoké', 'barbecue', 'camping', 'piscine', 'toboggan', 'balançoire', 'cerf-volant', 'feu d\'artifice', 'arc-en-ciel', 'volcan',
  'tornade', 'igloo', 'pyramide', 'phare', 'moulin', 'pont', 'tunnel', 'mégaphone', 'selfie', 'wifi', 'emoji', 'mème', 'tiktok',
  'hamburger', 'sushi', 'spaghetti', 'popcorn', 'hot-dog', 'crêpe',
  'boulanger', 'médecin', 'infirmier', 'policier', 'soldat', 'jardinier',
  'peintre', 'coiffeur', 'mécanicien', 'serveur', 'professeur', 'avocat',
  'juge', 'détective', 'espion', 'pilote', 'marin', 'pêcheur',
  'bûcheron', 'fermier', 'boucher', 'photographe', 'danseur', 'chanteur',
  'acrobate', 'jongleur', 'funambule', 'cascadeur', 'nager', 'courir',
  'sauter', 'dormir', 'pleurer', 'rire', 'manger', 'boire',
  'danser', 'chanter', 'pêcher', 'jardiner', 'cuisiner', 'repasser',
  'éternuer', 'bâiller', 'applaudir', 'escalader', 'plonger', 'patiner',
  'skier', 'surfer', 'faire du vélo', 'faire un câlin', 'se brosser les dents', 'prendre une douche',
  'faire la vaisselle', 'passer l\'aspirateur', 'tondre la pelouse', 'jouer aux échecs', 'bibliothèque', 'cinéma',
  'zoo', 'cirque', 'hôpital', 'école', 'banque', 'aéroport',
  'gare', 'supermarché', 'boulangerie', 'stade', 'musée', 'prison',
  'ferme', 'station-service', 'feu rouge', 'passage piéton', 'panneau stop', 'ascenseur',
  'escalator', 'manège', 'grande roue', 'montagnes russes', 'parc d\'attractions', 'port',
  'sèche-cheveux', 'fer à repasser', 'micro-ondes', 'réfrigérateur', 'cafetière', 'mixeur',
  'balance', 'thermomètre', 'stéthoscope', 'seringue', 'béquilles', 'fauteuil roulant',
  'parachute', 'extincteur', 'caméra', 'drone', 'casque de réalité virtuelle', 'console de jeux',
  'manette', 'clavier', 'souris d\'ordinateur', 'imprimante', 'haut-parleur', 'casque audio',
  'enceinte', 'anniversaire', 'mariage', 'Noël', 'Halloween', 'Pâques',
  'galette des rois', 'vacances', 'déménagement', 'embouteillage', 'tempête', 'inondation',
  'tremblement de terre', 'éruption volcanique', 'éclipse', 'marée', 'canicule', 'centaure',
  'minotaure', 'cyclope', 'yéti', 'Frankenstein', 'Dracula', 'Cendrillon',
  'Peter Pan', 'Pinocchio', 'Blanche-Neige', 'Petit Chaperon rouge', 'Aladin', 'Robin des Bois',
  'Zorro', 'Spider-Man', 'Batman', 'Superman', 'Mario', 'Pikachu',
  'Mickey', 'Astérix', 'Tintin', 'tour de Pise', 'statue de la Liberté', 'Big Ben',
  'Colisée', 'Sphinx', 'Taj Mahal', 'Mont-Saint-Michel', 'Arc de Triomphe', 'Grande Muraille',
  'football', 'rugby', 'tennis', 'ping-pong', 'golf', 'basket',
  'volley', 'natation', 'plongeon', 'ski', 'snowboard', 'patinage',
  'boxe', 'judo', 'escrime', 'tir à l\'arc', 'équitation', 'cyclisme',
  'marathon', 'saut à la perche', 'haltérophilie', 'gymnastique', 'planche à voile', 'pétanque',
  'bowling', 'billard', 'fléchettes', 'girafe qui mange', 'éléphant qui barrit', 'serpent à sonnette',
  'araignée dans sa toile', 'pieuvre géante', 'requin blanc', 'baleine à bosse', 'ours qui dort', 'loup qui hurle',
  'renard rusé', 'hibou la nuit', 'coq au lever du soleil', 'poule qui pond', 'vache qui meugle', 'cochon dans la boue',
  'cheval au galop', 'chien qui aboie', 'chat sur un toit', 'souris dans un trou', 'tortue qui court', 'escargot lent',
  'grenouille qui saute', 'papillon sur une fleur', 'abeille et miel', 'ruche', 'toile d\'araignée', 'fourmilière',
  'nid d\'oiseau', 'terrier de lapin', 'grotte', 'montagne enneigée', 'cascade géante', 'geyser',
  'iceberg', 'oasis', 'dune de sable', 'île déserte', 'volcan en éruption', 'forêt en feu',
  'champ de blé', 'vignoble', 'verger', 'potager', 'serre', 'moulin à vent',
  'château d\'eau', 'barrage', 'pont suspendu', 'autoroute', 'rond-point', 'feu tricolore',
  'parking', 'garage', 'station de métro', 'quai de gare', 'piste d\'atterrissage', 'tour de contrôle',
  'port de pêche', 'phare dans la tempête', 'plage de sable', 'parasol', 'serviette de plage', 'crème solaire',
  'coup de soleil', 'bronzage', 'glace à l\'italienne', 'barbe à papa', 'pomme d\'amour', 'stand de tir',
  'auto-tamponneuses', 'train fantôme', 'maison hantée', 'cimetière', 'citrouille d\'Halloween', 'chauve-souris',
  'toile de fantôme', 'chaudron', 'grimoire', 'baguette de chef d\'orchestre', 'partition', 'piano à queue',
  'batterie', 'saxophone', 'accordéon', 'harpe', 'flûte', 'micro de karaoké',
  'boule à facettes', 'piste de danse', 'DJ', 'concert', 'festival', 'scène de théâtre',
  'rideau rouge', 'projecteur', 'clap de cinéma', 'affiche de film', 'tapis rouge', 'trophée',
  'médaille d\'or', 'podium', 'coupe', 'ligne d\'arrivée', 'chronomètre', 'sifflet',
  'carton rouge', 'ballon de rugby', 'filet de tennis', 'panier de basket', 'but de football', 'terrain de golf',
  'piste de ski', 'télésiège', 'luge', 'bonnet de ski', 'raquettes à neige', 'chien de traîneau',
  'igloo esquimau', 'ours blanc', 'manchot empereur', 'aurore boréale',
];
const HARD = [
  'avoir un chat dans la gorge', 'tomber dans les pommes', 'poser un lapin', 'avoir le cafard', 'être dans la lune', 'mettre son grain de sel',
  'coup de foudre', 'pleuvoir des cordes', 'prendre ses jambes à son cou', 'vendre la peau de l\'ours', 'revenir à ses moutons',
  'se jeter à l\'eau', 'casser la baraque', 'avoir les yeux plus gros que le ventre', 'faire d\'une pierre deux coups', 'la fin du monde',
  'un jour sans fin', 'la loi de Murphy', 'le syndrome de l\'imposteur', 'un cheval de Troie', 'le père Noël en vacances',
  'un déménagement raté', 'la crise de la quarantaine', 'un lundi matin', 'le réveil qui sonne', 'une panne de wifi',
  'un mariage qui tourne mal', 'la queue à la boulangerie', 'une soirée pyjama', 'le dernier carré de chocolat',
  'avoir le cœur sur la main', 'tomber des nues', 'coûter les yeux de la tête', 'avoir la tête dans les nuages', 'mettre les pieds dans le plat', 'tourner autour du pot',
  'avoir un poil dans la main', 'sauter du coq à l\'âne', 'être sur son trente-et-un', 'avoir une mémoire d\'éléphant', 'têtu comme une mule', 'rusé comme un renard',
  'fort comme un bœuf', 'muet comme une carpe', 'doux comme un agneau', 'bavard comme une pie', 'heureux comme un poisson dans l\'eau', 'quand les poules auront des dents',
  'les murs ont des oreilles', 'appeler un chat un chat', 'donner sa langue au chat', 'mettre de l\'huile sur le feu', 'filer à l\'anglaise', 'pleurer comme une madeleine',
  'faire la grasse matinée', 'une hirondelle ne fait pas le printemps', 'après la pluie le beau temps', 'mieux vaut tard que jamais', 'petit à petit l\'oiseau fait son nid', 'l\'habit ne fait pas le moine',
  'chat échaudé craint l\'eau froide', 'trembler comme une feuille', 'dormir comme un loir', 'manger comme quatre', 'être au bout du rouleau', 'prendre le taureau par les cornes',
  'avoir le bras long', 'rire jaune', 'rire aux éclats', 'rouge comme une tomate', 'blanc comme un linge', 'avoir une faim de loup',
  'avoir un cœur de pierre', 'avoir la chair de poule', 'avoir la grosse tête', 'avoir les jambes en coton', 'avoir le trac', 'avoir la main verte',
  'avoir un trou de mémoire', 'se jeter dans la gueule du loup', 'mettre la charrue avant les bœufs', 'courir comme un lièvre', 'être fauché comme les blés', 'être dans de beaux draps',
  'être au pied du mur', 'tirer le diable par la queue', 'avoir du pain sur la planche', 'casser du sucre sur le dos', 'broyer du noir', 'voir la vie en rose',
  'voir trente-six chandelles', 'être sur un petit nuage', 'tomber à l\'eau', 'mettre la clé sous la porte', 'être sur la corde raide', 'jouer avec le feu',
  'jeter l\'éponge', 'tourner la page', 'brûler la chandelle par les deux bouts', 'ouvrir la boîte de Pandore', 'le talon d\'Achille', 'le nerf de la guerre',
  'le fil d\'Ariane', 'la goutte d\'eau qui fait déborder le vase', 'une tempête dans un verre d\'eau', 'noyer le poisson', 'faire la pluie et le beau temps', 'dormir sur ses deux oreilles',
  'un froid de canard', 'un temps de chien', 'une peur bleue', 'une colère noire', 'une fièvre de cheval', 'un remède de cheval',
  'une langue de vipère', 'une tête de linotte', 'un pied de nez', 'un coup de théâtre', 'un coup de main', 'un coup de fil',
  'un coup de pouce', 'un air de famille', 'un dîner aux chandelles', 'un cadeau empoisonné', 'un éléphant dans un magasin de porcelaine', 'un ours mal léché',
  'un chien dans un jeu de quilles', 'un lapin dans les phares', 'un mouton noir', 'un oiseau de mauvais augure', 'un canard boiteux', 'un loup solitaire',
  'une poule mouillée', 'un cheval de bataille', 'un panier de crabes', 'un château de cartes', 'un château en Espagne', 'un cercle vicieux',
  'une épée de Damoclès', 'une bouteille à la mer', 'une aiguille dans une botte de foin', 'une goutte d\'eau dans l\'océan', 'une bulle de savon', 'un tour de magie',
  'un jeu d\'enfant', 'une partie de cache-cache', 'une course contre la montre', 'une chasse au trésor', 'une nuit blanche', 'un mal de mer',
  'un ticket gagnant', 'un fantôme dans le placard', 'une soirée karaoké', 'une panne d\'oreiller', 'un selfie raté', 'une panne de batterie',
  'un message envoyé au mauvais destinataire', 'un spoiler', 'la file d\'attente à la caisse', 'un embouteillage sur l\'autoroute', 'un barbecue sous la pluie', 'un parapluie retourné par le vent',
  'une glace qui fond', 'un château de sable emporté par la marée', 'un pique-nique avec des fourmis', 'un cambrioleur maladroit', 'un magicien qui rate son tour', 'un pirate sans bateau',
  'un vampire au soleil', 'un fantôme qui a peur', 'un robot qui danse', 'un dragon qui crache du feu', 'un astronaute perdu', 'un cow-boy sur un cactus',
  'un chevalier sans cheval', 'une sirène à la plage', 'un zombie au supermarché', 'un père Noël en maillot de bain', 'un bonhomme de neige en été', 'une licorne arc-en-ciel',
  'un poisson qui sort de l\'eau', 'un chat qui tombe du canapé', 'un chien qui court après sa queue', 'un oiseau qui fait caca', 'un éléphant qui a peur d\'une souris', 'une girafe dans un ascenseur',
  'un pingouin à la plage', 'un singe qui mange une banane', 'un ours qui pêche', 'un requin dans une piscine', 'un escargot de compétition', 'une tortue ninja',
  'un hamster dans sa roue', 'une araignée au plafond', 'un moustique la nuit', 'un lion qui se brosse les dents', 'le déjeuner sur l\'herbe', 'le fantôme de l\'opéra',
  'le tour du monde en quatre-vingts jours', 'le château ambulant', 'le seigneur des anneaux', 'le roi du monde', 'la belle au bois dormant', 'la guerre des étoiles',
  'le petit poucet', 'le chat botté', 'les trois mousquetaires', 'le bossu de Notre-Dame', 'le tour de France', 'la cérémonie des Oscars',
  'la finale de la Coupe du monde', 'la course de Formule 1', 'le marathon de New York', 'la ola dans un stade', 'le dernier métro', 'le premier jour d\'école',
  'la rentrée des classes', 'le dernier jour de vacances', 'le réveil du lundi', 'le week-end qui passe trop vite', 'un dimanche soir', 'un jour de grève',
  'un jour sans pain', 'une soirée pizza', 'une soirée jeux de société', 'une soirée film d\'horreur', 'un voyage en avion', 'un voyage en train',
  'une randonnée en montagne', 'une nuit sous la tente', 'une sortie au cinéma', 'un rendez-vous chez le dentiste', 'un cours de danse', 'un cours de cuisine',
  'un examen de conduite', 'un entretien d\'embauche', 'un premier rendez-vous', 'une demande en mariage', 'un faire-part de naissance', 'un gâteau raté',
  'un plat qui brûle', 'une cuisine en désordre', 'une chambre en bazar', 'une valise trop lourde', 'des clés perdues', 'un portable dans les toilettes',
  'un wifi qui coupe', 'une batterie à plat', 'un mot de passe oublié', 'un SMS maladroit', 'un appel manqué',
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

// Même mot, à un pluriel près, et sans tenir compte de l'article du début (« un pirate sans bateau » = « pirate sans bateau »)
const ARTICLES = ['un', 'une', 'le', 'la', 'les', 'l', 'du', 'des', 'de', 'd', 'mon', 'ma', 'ton', 'ta', 'son', 'sa', 'the', 'a'];
const noArticle = (w: string) => {
  const words = w
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  while (words.length > 1 && ARTICLES.includes(words[0])) words.shift();
  return words.join('');
};
const sameWord = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  if (!x) return false;
  if (x === y || x.replace(/[sx]$/, '') === y.replace(/[sx]$/, '')) return true;
  const x2 = noArticle(a);
  const y2 = noArticle(b);
  return !!x2 && (x2 === y2 || x2.replace(/[sx]$/, '') === y2.replace(/[sx]$/, ''));
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
