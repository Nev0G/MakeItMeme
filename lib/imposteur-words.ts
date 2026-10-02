// Paires [mot A, mot B] proches l'une de l'autre, rangées par catégories : les civils
// reçoivent l'un des deux mots, l'imposteur reçoit l'autre (mode "mot proche") ou rien.
// Pour ajouter des mots : une paire "A|B" de plus dans la bonne catégorie (ou une nouvelle catégorie).
type WordCategory = { id: string; label: string; emoji: string; pairs: [string, string][] };

const parse = (raw: string): [string, string][] =>
  raw
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => x.split('|').map((w) => w.trim()) as [string, string])
    .filter((p) => p.length === 2 && p[0] && p[1] && p[0] !== p[1]);

const WORD_CATEGORIES: WordCategory[] = [
  { id: 'food', label: 'Nourriture & boissons', emoji: '🍕', pairs: parse(
    "Pizza|Quiche;Café|Thé;Pomme|Poire;Fraise|Framboise;Lait|Crème;Beurre|Margarine;Pain|Brioche;Croissant|Pain au chocolat;Sirop|Jus;Vin|Champagne;Bière|Cidre;Chocolat|Caramel;Glace|Sorbet;Gâteau|Tarte;Bonbon|Chewing-gum;Soupe|Bouillon;Spaghetti|Tagliatelles;Riz|Quinoa;Frites|Chips;Hamburger|Sandwich;Sushi|Maki;Poisson|Crevette;Poulet|Dinde;Jambon|Saucisson;Fromage|Yaourt;Œuf|Omelette;Carotte|Radis;Tomate|Poivron;Citron|Orange;Banane|Mangue;Ananas|Noix de coco;Crêpe|Gaufre;Raclette|Fondue;Kebab|Tacos;Nutella|Confiture;Miel|Sirop d'érable;Moutarde|Ketchup;Mayonnaise|Vinaigrette;Pâtes|Nouilles;Lasagnes|Gratin;Cookie|Brownie;Macaron|Éclair;Muffin|Cupcake;Cacahuète|Noisette;Amande|Pistache;Champignon|Aubergine;Courgette|Concombre;Salade|Épinards;Pomme de terre|Patate douce;Raisin|Cerise;Pêche|Abricot;Melon|Pastèque;Kiwi|Litchi;Whisky|Rhum;Vodka|Gin;Cola|Limonade;Smoothie|Milkshake;Cappuccino|Expresso;Chocolat chaud|Thé glacé;Camembert|Roquefort;Baguette|Pain de mie;Céréales|Muesli;Saumon|Thon;Huître|Moule;Steak|Escalope;Barbecue|Plancha;Popcorn|Nachos"
  ) },
  { id: 'animals', label: 'Animaux & nature', emoji: '🦁', pairs: parse(
    "Chat|Tigre;Chien|Loup;Lune|Soleil;Étoile|Planète;Pluie|Neige;Orage|Tempête;Montagne|Colline;Rivière|Fleuve;Lac|Étang;Forêt|Jungle;Mer|Océan;Chêne|Sapin;Rose|Tulipe;Abeille|Guêpe;Papillon|Libellule;Lion|Léopard;Dauphin|Requin;Cheval|Âne;Vache|Chèvre;Mouton|Lama;Grenouille|Crapaud;Serpent|Lézard;Aigle|Faucon;Éléphant|Rhinocéros;Girafe|Zèbre;Singe|Gorille;Ours|Panda;Renard|Loup;Lapin|Lièvre;Hérisson|Porc-épic;Écureuil|Hamster;Souris|Rat;Pigeon|Corbeau;Canard|Oie;Perroquet|Toucan;Pingouin|Manchot;Hibou|Chouette;Crocodile|Alligator;Tortue|Escargot;Araignée|Scorpion;Fourmi|Termite;Moustique|Mouche;Baleine|Orque;Pieuvre|Calamar;Méduse|Étoile de mer;Cactus|Palmier;Marguerite|Tournesol;Volcan|Geyser;Désert|Savane;Tonnerre|Éclair;Arc-en-ciel|Aurore boréale;Brouillard|Nuage;Cascade|Torrent;Falaise|Canyon;Île|Presqu'île;Herbe|Mousse;Champignon|Fougère;Tigre|Panthère;Chameau|Dromadaire;Poule|Coq;Cochon|Sanglier"
  ) },
  { id: 'daily', label: 'Objets de tous les jours', emoji: '🪑', pairs: parse(
    "Livre|Magazine;Stylo|Crayon;Table|Bureau;Chaise|Tabouret;Canapé|Fauteuil;Lit|Hamac;Douche|Bain;Savon|Shampoing;Brosse à dents|Peigne;Chaussette|Collant;Pantalon|Short;Manteau|Veste;Chapeau|Casquette;Lunettes|Jumelles;Montre|Horloge;Téléphone|Tablette;Ordinateur|Télévision;Parapluie|Imperméable;Appareil photo|Caméra;Fourchette|Cuillère;Couteau|Ciseaux;Assiette|Bol;Verre|Tasse;Bouteille|Carafe;Casserole|Poêle;Four|Micro-ondes;Frigo|Congélateur;Aspirateur|Balai;Éponge|Serpillère;Lessive|Adoucissant;Oreiller|Coussin;Couette|Couverture;Rideau|Store;Miroir|Fenêtre;Lampe|Bougie;Ampoule|Néon;Clé|Cadenas;Porte|Portail;Sac à dos|Valise;Portefeuille|Porte-monnaie;Écharpe|Bonnet;Gants|Moufles;Chaussures|Baskets;Sandales|Tongs;Cravate|Nœud papillon;Pull|Gilet;Jean|Jogging;Maillot de bain|Pyjama;Parfum|Déodorant;Rasoir|Épilateur;Sèche-cheveux|Lisseur;Dentifrice|Bain de bouche;Mouchoir|Serviette;Papier toilette|Essuie-tout;Pile|Batterie;Chargeur|Câble;Télécommande|Manette;Réveil|Minuteur;Calendrier|Agenda;Cahier|Carnet;Règle|Équerre;Gomme|Correcteur;Scotch|Colle;Marteau|Tournevis;Échelle|Escabeau;Brosse|Pinceau"
  ) },
  { id: 'places', label: 'Lieux & voyages', emoji: '🏖️', pairs: parse(
    "Plage|Désert;Château|Palais;Piscine|Baignoire;Cinéma|Théâtre;Hôpital|Clinique;Musée|Galerie;Zoo|Cirque;Camping|Randonnée;École|Université;Voiture|Camion;Train|Tramway;Bateau|Sous-marin;Avion|Hélicoptère;Vélo|Moto;Vacances|Week-end;Noël|Halloween;Anniversaire|Mariage;Hôtel|Auberge;Aéroport|Gare;Métro|Bus;Taxi|Uber;Supermarché|Marché;Boulangerie|Pâtisserie;Pharmacie|Hôpital;Bibliothèque|Librairie;Restaurant|Cantine;Bar|Boîte de nuit;Parc|Jardin;Stade|Gymnase;Église|Mosquée;Prison|Commissariat;Banque|Mairie;Centre commercial|Boutique;Tente|Caravane;Cabane|Igloo;Phare|Moulin;Pont|Tunnel;Autoroute|Chemin;Parking|Garage;Ferme|Château d'eau;Station de ski|Station balnéaire;Croisière|Safari;Passeport|Visa;Valise|Sac de voyage;Paris|Londres;France|Belgique;Italie|Espagne;Japon|Chine;Canada|États-Unis;New York|Los Angeles;Tour Eiffel|Arc de Triomphe;Mont Blanc|Everest;Sahara|Amazonie;Atlantique|Pacifique;Rome|Athènes;Marseille|Nice;Bretagne|Normandie;Alpes|Pyrénées;Corse|Sardaigne;Tokyo|Séoul"
  ) },
  { id: 'sport', label: 'Sport & loisirs', emoji: '⚽', pairs: parse(
    "Football|Rugby;Tennis|Badminton;Ski|Snowboard;Natation|Plongée;Boxe|Karaté;Échecs|Dames;Poker|Belote;Basket|Handball;Volley|Beach-volley;Golf|Minigolf;Ping-pong|Tennis;Judo|Taekwondo;Escrime|Tir à l'arc;Course|Marathon;Sprint|Saut en longueur;Gymnastique|Danse;Yoga|Pilates;Musculation|CrossFit;Surf|Planche à voile;Voile|Aviron;Escalade|Alpinisme;Skate|Roller;Trottinette|Vélo;Équitation|Polo;Pêche|Chasse;Cyclisme|Triathlon;Hockey|Curling;Patinage|Luge;Parachute|Parapente;Pétanque|Boules;Fléchettes|Billard;Monopoly|Cluedo;Scrabble|Mots croisés;Puzzle|Légo;Cartes Pokémon|Cartes à jouer;Tarot|Bridge;Loto|Bingo;Sudoku|Rubik's cube;Cache-cache|Colin-maillard;Jeu de société|Jeu de rôle;Escape game|Laser game;Bowling|Karting;Pétanque|Palets;Corde à sauter|Hula hoop;Arbitre|Entraîneur;But|Panier;Coupe du monde|Euro;Jeux olympiques|Tour de France"
  ) },
  { id: 'music', label: 'Musique', emoji: '🎸', pairs: parse(
    "Piano|Guitare;Guitare|Violon;Batterie|Tambour;Micro|Haut-parleur;Basse|Guitare électrique;Flûte|Clarinette;Trompette|Trombone;Saxophone|Hautbois;Harpe|Lyre;Accordéon|Harmonica;Clavier|Synthé;Rap|Rock;Pop|Disco;Jazz|Blues;Techno|House;Reggae|Ska;Opéra|Comédie musicale;Concert|Festival;Chanteur|Rappeur;DJ|Producteur;Spotify|Deezer;Casque|Écouteurs;Vinyle|CD;Radio|Podcast;Playlist|Album;Single|Album;Refrain|Couplet;Karaoké|Blind test;Les Beatles|Rolling Stones;Michael Jackson|Prince;Mozart|Beethoven;Eminem|Drake;Daft Punk|David Guetta;Édith Piaf|Dalida;Johnny Hallyday|Michel Sardou;Aya Nakamura|Angèle;Orchestre|Chorale;Chef d'orchestre|Metteur en scène;Partition|Tablature;Concert|Spectacle;Boîte à musique|Jukebox;Walkman|iPod;Eurovision|The Voice;Soprano|Ténor;Violoncelle|Contrebasse"
  ) },
  { id: 'jobs', label: 'Métiers', emoji: '🧑‍🚒', pairs: parse(
    "Docteur|Infirmier;Pompier|Policier;Professeur|Directeur;Boulanger|Pâtissier;Coiffeur|Barbier;Avocat|Juge;Notaire|Huissier;Dentiste|Orthodontiste;Vétérinaire|Éleveur;Pharmacien|Médecin;Facteur|Livreur;Plombier|Électricien;Maçon|Architecte;Menuisier|Charpentier;Peintre|Décorateur;Boucher|Charcutier;Cuisinier|Serveur;Barman|Sommelier;Pilote|Hôtesse de l'air;Chauffeur|Conducteur de train;Marin|Pêcheur;Agriculteur|Jardinier;Journaliste|Reporter;Photographe|Cameraman;Acteur|Réalisateur;Chanteur|Danseur;Écrivain|Poète;Mécanicien|Garagiste;Informaticien|Développeur;Comptable|Banquier;Patron|Manager;Secrétaire|Assistant;Vendeur|Caissier;Militaire|Gendarme;Président|Premier ministre;Maire|Député;Astronaute|Aviateur;Détective|Espion;Scientifique|Chercheur;Psychologue|Psychiatre;Coach|Entraîneur;Influenceur|Youtubeur;Stagiaire|Apprenti;Magicien|Clown;Géologue|Archéologue;Cascadeur|Acrobate"
  ) },
  { id: 'games', label: 'Jeux vidéo', emoji: '🎮', pairs: parse(
    "Mario|Sonic;Fortnite|Apex Legends;Minecraft|Roblox;FIFA|PES;Pokémon|Digimon;Zelda|Skyrim;GTA|Watch Dogs;League of Legends|Dota;Call of Duty|Battlefield;PlayStation|Xbox;Switch|Game Boy;Among Us|Fall Guys;Tetris|Puyo Puyo;Pac-Man|Space Invaders;Mario Kart|Crash Team Racing;Overwatch|Valorant;Animal Crossing|Les Sims;Dark Souls|Elden Ring;Donkey Kong|Crash Bandicoot;Counter-Strike|Valorant;Rocket League|FIFA;Twitch|YouTube;Pikachu|Salamèche;Bowser|Ganondorf;Luigi|Mario;Kirby|Yoshi;Minecraft|Terraria;Candy Crush|Tetris;Clash Royale|Clash of Clans;The Witcher|Skyrim;Doom|Quake;Hollow Knight|Celeste;Stardew Valley|Animal Crossing;Mario Party|Fall Guys;Just Dance|Guitar Hero;Wii|Switch;Manette|Joystick;Speedrun|Let's play;Boss|Mini-boss;Respawn|Checkpoint;Loot|Butin;Noob|Pro;Battle royale|MOBA;RPG|MMO;Ordinateur gamer|Console;Souris gamer|Clavier gamer;Steam|Epic Games;Nintendo|Sega;Lara Croft|Nathan Drake;Master Chief|Doom Guy;Link|Zelda;Pikachu|Mario;Sims|Roller Coaster Tycoon;Portal|Half-Life;Resident Evil|Silent Hill;Assassin's Creed|Prince of Persia;Rayman|Sonic;Tamagotchi|Pokémon;Mortal Kombat|Street Fighter;Smash Bros|Mortal Kombat;Brawl Stars|Clash Royale;Zelda Breath of the Wild|Genshin Impact;World of Warcraft|Final Fantasy;Cuphead|Undertale"
  ) },
  { id: 'cinema', label: 'Cinéma & séries', emoji: '🎬', pairs: parse(
    "Star Wars|Star Trek;Harry Potter|Le Seigneur des Anneaux;Titanic|Avatar;Batman|Iron Man;Joker|Harley Quinn;Netflix|Disney+;Stranger Things|Black Mirror;Game of Thrones|Vikings;Breaking Bad|Peaky Blinders;Friends|How I Met Your Mother;Les Simpson|Family Guy;Shrek|Madagascar;Le Roi Lion|Bambi;La Reine des neiges|Raiponce;Toy Story|Cars;Némo|Dory;Jurassic Park|King Kong;Terminator|Robocop;Matrix|Inception;Rocky|Creed;James Bond|Mission Impossible;Astérix|Tintin;Oscar|César;Comédie|Drame;Film d'horreur|Thriller;Marvel|DC;Hulk|Thor;Gandalf|Dumbledore;Dark Vador|Voldemort;Yoda|Dobby;Naruto|One Piece;Dragon Ball|Naruto;Pokémon|Dragon Ball;Studio Ghibli|Disney;Totoro|Pikachu;Spider-Man|Superman;Aquaman|Namor;Avengers|Justice League;Wonder Woman|Captain Marvel;Les Minions|Les Schtroumpfs;Bob l'éponge|Dora;Peppa Pig|Winnie l'ourson;Kaamelott|Game of Thrones;Le Père Noël est une ordure|Les Bronzés;Intouchables|Bienvenue chez les Ch'tis;Taxi|Fast & Furious;Les Visiteurs|Retour vers le futur;Pulp Fiction|Reservoir Dogs;Scream|Halloween;Alien|Predator;Hunger Games|Divergente;Twilight|Vampire Diaries;Squid Game|La Casa de Papel;Lupin|Sherlock Holmes;Cinéma|Streaming;Popcorn|Hot-dog;Bande-annonce|Générique;Remake|Suite;Série|Feuilleton;Sitcom|Soap opera;Documentaire|Reportage;Western|Film de pirates;Comédie romantique|Film d'action;Pixar|DreamWorks;Walt Disney|Tim Burton;Spielberg|Tarantino;Tom Cruise|Brad Pitt;Omar Sy|Jamel Debbouze"
  ) },
  { id: 'tech', label: 'Internet & technologie', emoji: '📱', pairs: parse(
    "WhatsApp|Messenger;Instagram|Snapchat;TikTok|YouTube;Google|Bing;iPhone|Samsung;Wi-Fi|Bluetooth;Clé USB|Disque dur;Souris|Clavier;Mail|SMS;Amazon|eBay;Twitter|Facebook;Discord|Skype;Wikipédia|Google;Emoji|Meme;Selfie|Story;Influenceur|Streamer;Mot de passe|Code PIN;Écran|Moniteur;Imprimante|Scanner;Robot|Drone;Intelligence artificielle|Robot;Application|Site web;Vidéo|GIF;Hashtag|Tag;Instagram|Pinterest;LinkedIn|Facebook;Netflix|Prime Video;Uber|Deliveroo;Airbnb|Booking;Windows|macOS;Android|iOS;Chrome|Firefox;Zoom|Teams;Photoshop|Canva;Word|PowerPoint;Excel|Google Sheets;Bitcoin|Ethereum;Cloud|Serveur;Virus|Spam;Pirate informatique|Hacker;Câble HDMI|Câble USB;Ordinateur portable|Tablette;Smartwatch|Montre classique;Écouteurs|AirPods;Alexa|Siri;ChatGPT|Google;Selfie stick|Trépied;Appel vidéo|Message vocal;Notification|Rappel;Abonnement|Compte;Mise à jour|Installation;Bug|Crash;Wi-Fi|4G;Pixel|Mégapixel;Stories|Reels;Like|Partage;Follower|Abonné;Live|Replay;Podcast|Webradio"
  ) },
  { id: 'history', label: 'Histoire & culture', emoji: '🏛️', pairs: parse(
    "Napoléon|César;Louis XIV|Louis XVI;Pyramide|Sphinx;Versailles|Louvre;Chevalier|Gladiateur;Cléopâtre|Néfertiti;Guerre|Révolution;Moyen Âge|Antiquité;Viking|Samouraï;Jeanne d'Arc|Marie-Antoinette;Charlemagne|Clovis;De Gaulle|Churchill;Einstein|Newton;Picasso|Van Gogh;Mona Lisa|La Joconde;Léonard de Vinci|Michel-Ange;Molière|Victor Hugo;Shakespeare|Molière;Dracula|Frankenstein;Excalibur|Mjöllnir;Zeus|Poséidon;Hercule|Achille;Thor|Odin;Anubis|Ra;Zorro|Robin des Bois;Sherlock Holmes|Hercule Poirot;Arsène Lupin|Fantômas;Cendrillon|Blanche-Neige;Pinocchio|Peter Pan;Le Petit Chaperon rouge|Les Trois Petits Cochons;Alice|Dorothée;Le Petit Prince|Pinocchio;Roméo et Juliette|Tristan et Iseult;Odyssée|Iliade;Atlantide|Eldorado;Pirate|Corsaire;Colomb|Magellan;Armstrong|Gagarine;Nobel|Pulitzer;Bastille|Concorde;14 juillet|11 novembre;Marseillaise|Hymne européen;Drapeau|Étendard;Roi|Reine;Prince|Princesse;Chevalier|Écuyer;Château fort|Forteresse;Épée|Sabre;Arc|Arbalète;Bouclier|Armure;Trésor|Butin;Carte au trésor|Boussole"
  ) },
  { id: 'fantasy', label: 'Fantastique & personnages', emoji: '🐉', pairs: parse(
    "Roi|Empereur;Pirate|Viking;Cowboy|Indien;Sorcier|Magicien;Fantôme|Zombie;Dragon|Dinosaure;Robot|Alien;Superman|Batman;Vampire|Loup-garou;Sorcière|Fée;Licorne|Pégase;Sirène|Nymphe;Elfe|Nain;Troll|Ogre;Gobelin|Orc;Géant|Titan;Père Noël|Père Fouettard;Lutin|Fantôme;Momie|Squelette;Hobbit|Nain;Ninja|Samouraï;Chevalier|Paladin;Princesse|Reine;Prince charmant|Chevalier blanc;Super-héros|Super-vilain;Mutant|Cyborg;Extraterrestre|Martien;Yéti|Bigfoot;Monstre du Loch Ness|Kraken;Phénix|Griffon;Baguette magique|Sceptre;Balai de sorcière|Tapis volant;Chaudron|Grimoire;Potion|Philtre;Pierre philosophale|Anneau unique;Épée magique|Bouclier magique;Boule de cristal|Miroir magique;Cape d'invisibilité|Bague magique"
  ) },
  { id: 'fun', label: 'Délires entre potes', emoji: '😈', pairs: parse(
    "Surcoté|Sous-Coté;Vin rouge|Sang menstruel;WC|Trône;Apéro|Soirée;Gueule de bois|Fatigue;Ex|Crush;Grasse mat'|Sieste;Pote|Meilleur ami;Boomer|Vieux;Procrastination|Flemme;Selfie|Photo de groupe;Être en retard|Rater son train;Barbecue|Raclette;Tinder|Meetic;Ghosting|Rupture;Soirée pyjama|Soirée jeux;Câlin|Bisou;Ronflement|Pet;Hoquet|Rot;Chatouille|Pincement;Chaussette trouée|Slip troué;Radin|Économe;Menteur|Mythomane;Râleur|Rabat-joie;Bavard|Moulin à paroles;Fêtard|Noctambule;Timide|Réservé;Cuisinier du dimanche|Chef étoilé;Colocataire|Voisin;Beauf|Bobo;Tonton|Cousin;Belle-mère|Beau-père;Parrain|Marraine;Bébé|Nourrisson;Ado|Étudiant;Retraité|Senior;Cadeau|Surprise;Blague|Canular;Gaffe|Bourde;Honte|Malaise;Fou rire|Sourire;Colère|Rage;Jalousie|Envie;Stress|Panique;Rêve|Cauchemar;Insomnie|Somnambulisme;Rhume|Grippe;Bosse|Bleu;Boutons|Verrue;Barbe|Moustache;Perruque|Chignon;Tatouage|Piercing;Dispute|Débat;Pari|Défi;Gage|Pénitence;Karma|Chance;Hasard|Destin;Vérité|Mensonge;Action|Vérité"
  ) },
];
const WORD_PAIRS: [string, string][] = WORD_CATEGORIES.flatMap((c) => c.pairs);

type WordPick = { civil: string; imposter: string };

// Tire une paire au hasard ; le sens est aussi tiré au hasard pour que le mot des
// civils ne soit pas toujours le premier de la paire.
const pickWordPair = (categoryIds: string[] = []): WordPick => {
  const chosen = WORD_CATEGORIES.filter((c) => categoryIds.includes(c.id));
  const pool = (chosen.length ? chosen : WORD_CATEGORIES).flatMap((c) => c.pairs);
  const [a, b] = pool[Math.floor(Math.random() * pool.length)];
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

// Mode "pseudo d'un joueur" : le mot des civils est le pseudo d'un joueur, celui de
// l'imposteur le pseudo d'un autre. Retourne null s'il n'y a pas deux pseudos différents.
const pickPlayerPair = (names: string[]): WordPick | null => {
  const seen = new Set<string>();
  const unique = names.filter((n) => {
    const key = normalizeWord(n) || n.trim().toLowerCase();
    if (!n.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (unique.length < 2) return null;
  const a = Math.floor(Math.random() * unique.length);
  let b = Math.floor(Math.random() * (unique.length - 1));
  if (b >= a) b += 1;
  return { civil: unique[a], imposter: unique[b] };
};

// Deux mots identiques ? (un pseudo en emojis ne contient aucun caractère comparable : on compare alors tel quel)
const sameWord = (a: string, b: string) => {
  const na = normalizeWord(a);
  const nb = normalizeWord(b);
  if (na && nb) return na === nb;
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase() && !!(a || '').trim();
};

export { WORD_CATEGORIES, WORD_PAIRS, pickWordPair, pickPlayerPair, normalizeWord, sameWord };
