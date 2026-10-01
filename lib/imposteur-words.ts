// Paires [mot A, mot B] proches l'une de l'autre : les civils reçoivent l'un des
// deux mots, l'imposteur reçoit l'autre (mode "mot proche") ou rien (mode "sans mot").
const WORD_PAIRS: [string, string][] = [
  ['Pizza', 'Quiche'], ['Plage', 'Désert'], ['Chat', 'Tigre'], ['Chien', 'Loup'], ['Café', 'Thé'],
  ['Vélo', 'Moto'], ['Avion', 'Hélicoptère'], ['Football', 'Rugby'], ['Tennis', 'Badminton'], ['Piano', 'Guitare'],
  ['Pomme', 'Poire'], ['Fraise', 'Framboise'], ['Lait', 'Crème'], ['Beurre', 'Margarine'], ['Pain', 'Brioche'],
  ['Croissant', 'Pain au chocolat'], ['Docteur', 'Infirmier'], ['Pompier', 'Policier'], ['Roi', 'Empereur'],
  ['Château', 'Palais'], ['Lune', 'Soleil'], ['Étoile', 'Planète'], ['Pluie', 'Neige'], ['Orage', 'Tempête'],
  ['Montagne', 'Colline'], ['Rivière', 'Fleuve'], ['Lac', 'Étang'], ['Forêt', 'Jungle'], ['Cinéma', 'Théâtre'],
  ['Livre', 'Magazine'], ['Stylo', 'Crayon'], ['Table', 'Bureau'], ['Chaise', 'Tabouret'], ['Canapé', 'Fauteuil'],
  ['Lit', 'Hamac'], ['Douche', 'Bain'], ['Savon', 'Shampoing'], ['Brosse à dents', 'Peigne'], ['Chaussette', 'Collant'],
  ['Pantalon', 'Short'], ['Manteau', 'Veste'], ['Chapeau', 'Casquette'], ['Lunettes', 'Jumelles'], ['Montre', 'Horloge'],
  ['Téléphone', 'Tablette'], ['Ordinateur', 'Télévision'], ['Voiture', 'Camion'], ['Train', 'Tramway'],
  ['Bateau', 'Sous-marin'], ['Mer', 'Océan'], ['Piscine', 'Baignoire'], ['Sirop', 'Jus'], ['Vin', 'Champagne'],
  ['Bière', 'Cidre'], ['Chocolat', 'Caramel'], ['Glace', 'Sorbet'], ['Gâteau', 'Tarte'], ['Bonbon', 'Chewing-gum'],
  ['Soupe', 'Bouillon'], ['Spaghetti', 'Tagliatelles'], ['Riz', 'Quinoa'], ['Frites', 'Chips'], ['Hamburger', 'Sandwich'],
  ['Sushi', 'Maki'], ['Poisson', 'Crevette'], ['Poulet', 'Dinde'], ['Jambon', 'Saucisson'], ['Fromage', 'Yaourt'],
  ['Œuf', 'Omelette'], ['Carotte', 'Radis'], ['Tomate', 'Poivron'], ['Citron', 'Orange'], ['Banane', 'Mangue'],
  ['Ananas', 'Noix de coco'], ['Chêne', 'Sapin'], ['Rose', 'Tulipe'], ['Abeille', 'Guêpe'], ['Papillon', 'Libellule'],
  ['Lion', 'Léopard'], ['Dauphin', 'Requin'], ['Cheval', 'Âne'], ['Vache', 'Chèvre'], ['Mouton', 'Lama'],
  ['Grenouille', 'Crapaud'], ['Serpent', 'Lézard'], ['Aigle', 'Faucon'], ['Pirate', 'Viking'], ['Cowboy', 'Indien'],
  ['Sorcier', 'Magicien'], ['Fantôme', 'Zombie'], ['Dragon', 'Dinosaure'], ['Robot', 'Alien'], ['Superman', 'Batman'],
  ['Mario', 'Sonic'], ['Noël', 'Halloween'], ['Anniversaire', 'Mariage'], ['Vacances', 'Week-end'],
  ['École', 'Université'], ['Professeur', 'Directeur'], ['Boulanger', 'Pâtissier'], ['Coiffeur', 'Barbier'],
  ['Hôpital', 'Clinique'], ['Musée', 'Galerie'], ['Zoo', 'Cirque'], ['Camping', 'Randonnée'], ['Ski', 'Snowboard'],
  ['Natation', 'Plongée'], ['Boxe', 'Karaté'], ['Échecs', 'Dames'], ['Poker', 'Belote'], ['Guitare', 'Violon'],
  ['Batterie', 'Tambour'], ['Micro', 'Haut-parleur'], ['Appareil photo', 'Caméra'], ['Parapluie', 'Imperméable'],
];

type WordPick = { civil: string; imposter: string };

// Tire une paire au hasard ; le sens est aussi tiré au hasard pour que le mot des
// civils ne soit pas toujours le premier de la paire.
const pickWordPair = (): WordPick => {
  const [a, b] = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
  return Math.random() < 0.5 ? { civil: a, imposter: b } : { civil: b, imposter: a };
};

// Comparaison tolérante pour la "dernière chance" : casse, accents, espaces et
// ponctuation ignorés ("Œuf" == "oeuf").
const normalizeWord = (s: string) =>
  (s || '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

export { WORD_PAIRS, pickWordPair, normalizeWord };
