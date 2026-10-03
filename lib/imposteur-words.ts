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
    "Football|Rugby;Tennis|Badminton;Ski|Snowboard;Natation|Plongée;Boxe|Karaté;Échecs|Dames;Poker|Belote;Basket|Handball;Volley|Beach-volley;Golf|Minigolf;Ping-pong|Tennis de table;Judo|Taekwondo;Escrime|Tir à l'arc;Course|Marathon;Sprint|Saut en longueur;Gymnastique|Danse;Yoga|Pilates;Musculation|CrossFit;Surf|Planche à voile;Voile|Aviron;Escalade|Alpinisme;Skate|Roller;Trottinette|Vélo;Équitation|Polo;Pêche|Chasse;Cyclisme|Triathlon;Hockey|Curling;Patinage|Luge;Parachute|Parapente;Pétanque|Boules;Fléchettes|Billard;Monopoly|Cluedo;Scrabble|Mots croisés;Puzzle|Légo;Cartes Pokémon|Cartes à jouer;Tarot|Bridge;Loto|Bingo;Sudoku|Rubik's cube;Cache-cache|Colin-maillard;Jeu de société|Jeu de rôle;Escape game|Laser game;Bowling|Karting;Pétanque|Palets;Corde à sauter|Hula hoop;Arbitre|Entraîneur;But|Panier;Coupe du monde|Euro;Jeux olympiques|Tour de France"
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
    "Star Wars|Star Trek;Harry Potter|Le Seigneur des Anneaux;Titanic|Avatar;Batman|Iron Man;Joker|Harley Quinn;Netflix|Disney+;Stranger Things|Black Mirror;Game of Thrones|Vikings;Breaking Bad|Peaky Blinders;Friends|How I Met Your Mother;Les Simpson|Family Guy;Shrek|Madagascar;Le Roi Lion|Bambi;La Reine des neiges|Raiponce;Toy Story|Cars;Némo|Dory;Jurassic Park|King Kong;Terminator|Robocop;Matrix|Inception;Rocky|Creed;James Bond|Mission Impossible;Astérix|Tintin;Oscar|César;Comédie|Drame;Film d'horreur|Thriller;Marvel|DC;Hulk|Thor;Gandalf|Dumbledore;Dark Vador|Voldemort;Yoda|Dobby;Naruto|One Piece;Dragon Ball|Naruto;Studio Ghibli|Disney;Totoro|Pikachu;Spider-Man|Superman;Aquaman|Namor;Avengers|Justice League;Wonder Woman|Captain Marvel;Les Minions|Les Schtroumpfs;Bob l'éponge|Dora;Peppa Pig|Winnie l'ourson;Kaamelott|Game of Thrones;Le Père Noël est une ordure|Les Bronzés;Intouchables|Bienvenue chez les Ch'tis;Taxi|Fast & Furious;Les Visiteurs|Retour vers le futur;Pulp Fiction|Reservoir Dogs;Scream|Halloween;Alien|Predator;Hunger Games|Divergente;Twilight|Vampire Diaries;Squid Game|La Casa de Papel;Lupin|Sherlock Holmes;Cinéma|Streaming;Popcorn|Hot-dog;Bande-annonce|Générique;Remake|Suite;Série|Feuilleton;Sitcom|Soap opera;Documentaire|Reportage;Western|Film de pirates;Comédie romantique|Film d'action;Pixar|DreamWorks;Walt Disney|Tim Burton;Spielberg|Tarantino;Tom Cruise|Brad Pitt;Omar Sy|Jamel Debbouze"
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
    "Vin rouge|Vin blanc;WC|Trône;Apéro|Soirée;Gueule de bois|Fatigue;Ex|Crush;Grasse mat'|Sieste;Pote|Meilleur ami;Boomer|Vieux;Procrastination|Flemme;Selfie|Photo de groupe;Être en retard|Rater son train;Barbecue|Raclette;Tinder|Meetic;Ghosting|Rupture;Soirée pyjama|Soirée jeux;Câlin|Bisou;Ronflement|Pet;Hoquet|Rot;Chatouille|Pincement;Chaussette trouée|Slip troué;Radin|Économe;Menteur|Mythomane;Râleur|Rabat-joie;Bavard|Moulin à paroles;Fêtard|Noctambule;Timide|Réservé;Cuisinier du dimanche|Chef étoilé;Colocataire|Voisin;Beauf|Bobo;Tonton|Cousin;Belle-mère|Beau-père;Parrain|Marraine;Bébé|Nourrisson;Ado|Étudiant;Retraité|Senior;Cadeau|Surprise;Blague|Canular;Gaffe|Bourde;Honte|Malaise;Fou rire|Sourire;Colère|Rage;Jalousie|Envie;Stress|Panique;Rêve|Cauchemar;Insomnie|Somnambulisme;Rhume|Grippe;Bosse|Bleu;Boutons|Verrue;Barbe|Moustache;Perruque|Chignon;Tatouage|Piercing;Dispute|Débat;Pari|Défi;Gage|Pénitence;Karma|Chance;Hasard|Destin;Vérité|Mensonge"
  ) },,
  { id: 'body', label: 'Corps & santé', emoji: '🫀', pairs: parse(
    "Main|Pied;Bras|Jambe;Coude|Genou;Épaule|Hanche;Doigt|Orteil;Oreille|Nez;Bouche|Menton;Dent|Langue;Cœur|Poumon;Foie|Rein;Estomac|Intestin;Cerveau|Crâne;Os|Muscle;Peau|Cheveux;Ongle|Griffe;Sourcil|Cil;Joue|Front;Cou|Nuque;Ventre|Dos;Pouce|Index;Rhume|Grippe;Migraine|Vertige;Toux|Éternuement;Fièvre|Frissons;Plâtre|Pansement;Béquille|Fauteuil roulant;Piqûre|Vaccin;Pilule|Sirop;Ordonnance|Certificat médical;Radio|Scanner;Dentiste|Opticien;Lunettes|Lentilles;Fracture|Entorse;Allergie|Intolérance;Régime|Jeûne;Vitamine|Protéine;Sommeil|Sieste;Bâillement|Soupir;Larme|Sueur;Sang|Salive;Rire|Sourire;Barbe|Moustache;Cicatrice|Tatouage;Taille|Poids;Haltère|Tapis de sport;Infirmerie|Urgences;Ambulance|Brancard;Stéthoscope|Thermomètre;Tension|Pouls;Pharmacie|Parapharmacie;Massage|Spa"
  ) },
  { id: 'school', label: 'École & travail', emoji: '🎒', pairs: parse(
    "Cartable|Trousse;Tableau|Ardoise;Craie|Feutre;Cahier|Classeur;Dictée|Rédaction;Maths|Physique;Histoire|Géographie;Français|Anglais;Récréation|Cantine;Prof|Surveillant;Élève|Étudiant;Note|Appréciation;Examen|Contrôle;Bac|Brevet;Diplôme|Certificat;Amphi|Salle de classe;Devoirs|Exposé;Cours|Conférence;Stage|Alternance;CV|Lettre de motivation;Entretien|Casting;Salaire|Prime;Congés|RTT;Réunion|Séminaire;Open space|Bureau;Patron|Collègue;Démission|Licenciement;Retraite|Chômage;Télétravail|Présentiel;Pause café|Pause déj;Badge|Pointeuse;Agrafeuse|Perforatrice;Imprimante|Photocopieuse;Post-it|Marque-page;Dossier|Chemise;Mail|Courrier;Visioconférence|Appel;Facture|Devis;Contrat|CDD;Syndicat|Grève;Promotion|Augmentation;Rentrée|Vacances scolaires;Cour de récré|Préau;Uniforme|Blouse;Lycée|Collège;Maternelle|Primaire;Bibliothèque|CDI"
  ) },
  { id: 'home', label: 'Maison & jardin', emoji: '🏡', pairs: parse(
    "Cuisine|Salon;Chambre|Salle de bain;Cave|Grenier;Garage|Abri de jardin;Balcon|Terrasse;Escalier|Ascenseur;Cheminée|Poêle;Radiateur|Climatisation;Tondeuse|Taille-haie;Râteau|Pelle;Arrosoir|Tuyau;Potager|Verger;Serre|Véranda;Barbecue|Brasero;Hamac|Transat;Parasol|Store;Piscine|Jacuzzi;Clôture|Mur;Boîte aux lettres|Interphone;Sonnette|Digicode;Paillasson|Tapis;Placard|Armoire;Commode|Étagère;Bureau|Secrétaire;Lave-linge|Sèche-linge;Lave-vaisselle|Évier;Grille-pain|Bouilloire;Mixeur|Blender;Cocotte|Faitout;Passoire|Entonnoir;Torchon|Serviette;Nappe|Set de table;Vase|Pot de fleurs;Cadre|Tableau;Tapis|Moquette;Parquet|Carrelage;Peinture|Papier peint;Toit|Plafond;Cave à vin|Cellier;Propriétaire|Locataire;Loyer|Charges;Appartement|Maison;Studio|Loft;Voisin|Concierge;Déménagement|Emménagement;Colocation|Résidence"
  ) },
  { id: 'transport', label: 'Transports', emoji: '🚗', pairs: parse(
    "Voiture|Moto;Camion|Camionnette;Bus|Car;Tramway|Métro;TGV|TER;Avion|Planeur;Hélicoptère|Montgolfière;Bateau|Voilier;Ferry|Paquebot;Péniche|Canoë;Vélo|VTT;Trottinette|Skateboard;Scooter|Mobylette;Taxi|VTC;Ambulance|Corbillard;Camion de pompiers|Voiture de police;Tracteur|Bulldozer;Grue|Pelleteuse;Fusée|Navette spatiale;Satellite|Station spatiale;Peugeot|Renault;Ferrari|Lamborghini;Tesla|Toyota;Porsche|Mercedes;BMW|Audi;Volant|Guidon;Pneu|Chambre à air;Essence|Diesel;Électrique|Hybride;Feu rouge|Stop;Péage|Radar;Permis|Code de la route;Embouteillage|Bouchon;Rond-point|Carrefour;Trottoir|Piste cyclable;Ceinture|Casque;Klaxon|Sirène;Clignotant|Phare;Quai|Voie;Billet|Ticket;Valise|Bagage;Escale|Correspondance;Décollage|Atterrissage;Passager|Conducteur"
  ) },
  { id: 'clothes', label: 'Mode & beauté', emoji: '👗', pairs: parse(
    "Robe|Jupe;Chemise|T-shirt;Blouson|Doudoune;Cardigan|Sweat;Costume|Smoking;Tailleur|Robe de soirée;Talons|Ballerines;Bottes|Bottines;Mocassins|Sneakers;Sac à main|Pochette;Ceinture|Bretelles;Collier|Bracelet;Bague|Boucle d'oreille;Alliance|Bague de fiançailles;Montre|Bracelet connecté;Foulard|Écharpe;Bonnet|Béret;Lunettes de soleil|Lunettes de vue;Maquillage|Vernis;Rouge à lèvres|Gloss;Mascara|Eye-liner;Fond de teint|Poudre;Parfum|Eau de toilette;Crème|Lotion;Gel douche|Savon;Coiffeur|Esthéticienne;Brushing|Permanente;Teinture|Mèches;Rasage|Épilation;Manucure|Pédicure;Barbier|Salon de coiffure;Friperie|Boutique;Soldes|Promotions;Défilé|Podium;Mannequin|Stylo;Couturier|Tailleur;Zara|H&M;Nike|Adidas;Gucci|Louis Vuitton;Chanel|Dior;Jean slim|Jean large;Uniforme|Déguisement;Pyjama|Robe de chambre;Chaussons|Pantoufles"
  ) },
  { id: 'celebs', label: 'Célébrités & internet', emoji: '⭐', pairs: parse(
    "Cristiano Ronaldo|Lionel Messi;Mbappé|Neymar;Zidane|Platini;Federer|Nadal;Teddy Riner|Tony Parker;Beyoncé|Rihanna;Taylor Swift|Ariana Grande;Justin Bieber|Shawn Mendes;Booba|Kaaris;PNL|Jul;Orelsan|Nekfeu;Stromae|Angèle;Squeezie|Cyprien;Mister V|Norman;Léna Situations|EnjoyPhoenix;Elon Musk|Jeff Bezos;Mark Zuckerberg|Bill Gates;Steve Jobs|Elon Musk;Donald Trump|Joe Biden;Macron|Sarkozy;Obama|Clinton;Kim Kardashian|Kylie Jenner;Brad Pitt|Leonardo DiCaprio;Angelina Jolie|Scarlett Johansson;Omar Sy|Gad Elmaleh;Jean Dujardin|Dany Boon;Thierry Ardisson|Cyril Hanouna;Nagui|Laurent Ruquier;Jamy|Fred;Mcfly|Carlito;Inoxtag|Michou;Gotaga|Ninja;Pewdiepie|MrBeast;Lady Gaga|Madonna;Adele|Céline Dion;Ed Sheeran|Bruno Mars;Coldplay|U2;Queen|ABBA;Nirvana|Metallica;AC/DC|Led Zeppelin;Mickey|Donald;Bugs Bunny|Titi et Grosminet;Tom et Jerry|Woody Woodpecker"
  ) },
  { id: 'food2', label: 'Cuisine du monde', emoji: '🍜', pairs: parse(
    "Paella|Risotto;Couscous|Tajine;Ramen|Pho;Pad thaï|Nouilles sautées;Curry|Tikka masala;Naan|Chapati;Falafel|Houmous;Gyros|Kebab;Pizza margherita|Pizza reine;Tiramisu|Panna cotta;Burrito|Fajitas;Guacamole|Salsa;Churros|Beignet;Choucroute|Cassoulet;Bouillabaisse|Ratatouille;Boeuf bourguignon|Blanquette de veau;Quiche lorraine|Tarte flambée;Croque-monsieur|Croque-madame;Crêpe sucrée|Galette;Hachis parmentier|Gratin dauphinois;Escargot|Cuisses de grenouille;Foie gras|Rillettes;Pot-au-feu|Pot-au-feu;Tartiflette|Aligot;Welsh|Fondue bourguignonne;Dim sum|Nems;Bo bun|Riz cantonais;Sashimi|Tempura;Tofu|Seitan;Kimchi|Choucroute;Pierogi|Raviolis;Goulash|Chili con carne;Fish and chips|Hot-dog;Pancake|Waffle;Bagel|Donut;Cheesecake|Carrot cake;Poutine|Frites;Baklava|Loukoum;Feta|Mozzarella;Parmesan|Gruyère;Chorizo|Merguez;Pesto|Sauce tomate;Aïoli|Rouille"
  ) },
  { id: 'nature2', label: 'Sciences & espace', emoji: '🔭', pairs: parse(
    "Mars|Vénus;Jupiter|Saturne;Terre|Lune;Soleil|Étoile;Comète|Astéroïde;Galaxie|Nébuleuse;Trou noir|Big Bang;Télescope|Microscope;Atome|Molécule;Électron|Proton;Gravité|Magnétisme;Électricité|Foudre;Oxygène|Hydrogène;Carbone|Azote;Fer|Cuivre;Or|Argent;Diamant|Rubis;Émeraude|Saphir;Eau|Glace;Vapeur|Fumée;Chaleur|Froid;Séisme|Tsunami;Éruption|Avalanche;Dinosaure|Mammouth;Fossile|Squelette;ADN|Gène;Cellule|Bactérie;Virus|Microbe;Chimie|Biologie;Laboratoire|Observatoire;Éprouvette|Bécher;Newton|Galilée;Darwin|Pasteur;Marie Curie|Einstein;Fusée|Satellite;Astronaute|Cosmonaute;Équateur|Pôle Nord;Boussole|GPS;Carte|Globe;Hémisphère|Continent;Atmosphère|Stratosphère;Éclipse|Pleine lune;Printemps|Automne;Été|Hiver;Solstice|Équinoxe"
  ) },
  { id: 'party', label: 'Fêtes & traditions', emoji: '🎉', pairs: parse(
    "Noël|Nouvel An;Pâques|Toussaint;Halloween|Carnaval;Saint-Valentin|Fête des mères;Sapin|Guirlande;Cadeau|Carte de vœux;Bûche|Galette des rois;Chocolat de Pâques|Œuf en chocolat;Feu d'artifice|Pétard;Champagne|Mousseux;Ballon|Confetti;Gâteau d'anniversaire|Bougie;Mariage|Pacs;Robe de mariée|Costume;Témoin|Demoiselle d'honneur;Lune de miel|Voyage de noces;Baptême|Communion;Enterrement|Obsèques;Réveillon|Dîner;Soirée|Fête;Boîte de nuit|Bar à cocktails;Karaoké|Blind test;Cotillons|Serpentins;Piñata|Chasse aux œufs;Déguisement|Masque;Bonbons|Friandises;Citrouille|Courge;Père Noël|Lutin;Crèche|Santon;Dinde|Chapon;Marron|Châtaigne;Chandeleur|Mardi gras;Fête de la musique|Festival;14 juillet|Feu de joie;Pot de départ|Pot de thèse;Apéro|Brunch;Toast|Discours;Invitation|Faire-part;DJ|Orchestre;Piste de danse|Dancefloor;Photobooth|Livre d'or"
  ) },
  { id: 'emotions', label: 'Mots abstraits', emoji: '💭', pairs: parse(
    "Amour|Amitié;Bonheur|Joie;Tristesse|Mélancolie;Peur|Angoisse;Courage|Audace;Liberté|Indépendance;Justice|Égalité;Paix|Silence;Argent|Richesse;Pouvoir|Autorité;Succès|Gloire;Échec|Défaite;Chance|Bonheur;Patience|Persévérance;Mémoire|Souvenir;Imagination|Créativité;Intelligence|Sagesse;Talent|Don;Ambition|Rêve;Confiance|Espoir;Respect|Honneur;Honte|Culpabilité;Fierté|Orgueil;Nostalgie|Regret;Surprise|Étonnement;Curiosité|Intérêt;Ennui|Lassitude;Fatigue|Épuisement;Énergie|Dynamisme;Solitude|Isolement;Famille|Tribu;Voyage|Aventure;Secret|Mystère;Coïncidence|Hasard;Tradition|Coutume;Modernité|Innovation;Passé|Histoire;Avenir|Futur;Début|Origine;Fin|Conclusion;Gagner|Réussir;Perdre|Échouer;Aider|Soutenir;Mentir|Tricher;Voler|Piller;Cacher|Dissimuler"
  ) },
];
const WORD_PAIRS: [string, string][] = WORD_CATEGORIES.flatMap((c) => c.pairs);

type WordPick = { civil: string; imposter: string };

// Catégorie spéciale : le mot est le pseudo d'un joueur de la partie (pas de liste de paires).
const PLAYERS_CATEGORY = { id: 'players', label: 'Pseudos des joueurs', emoji: '🙋' };

// Tire une paire au hasard dans les catégories choisies (toutes si aucune). Le sens est
// aussi tiré au hasard pour que le mot des civils ne soit pas toujours le premier.
// La catégorie "players" tire deux pseudos ; sans assez de pseudos, elle est ignorée.
const pickWordPair = (categoryIds: string[] = [], playerNames: string[] = []): WordPick => {
  const wantPlayers = categoryIds.includes(PLAYERS_CATEGORY.id);
  const wordCats = WORD_CATEGORIES.filter((c) => categoryIds.includes(c.id));
  const cats = wordCats.length || wantPlayers ? wordCats : WORD_CATEGORIES;
  // Les pseudos comptent comme une catégorie à part entière dans le tirage
  const slots: (typeof PLAYERS_CATEGORY | WordCategory)[] = wantPlayers ? [...cats, PLAYERS_CATEGORY] : cats;
  const slot = slots[Math.floor(Math.random() * slots.length)];
  if (slot.id === PLAYERS_CATEGORY.id) {
    const fromPlayers = pickPlayerPair(playerNames);
    if (fromPlayers) return fromPlayers;
  }
  const pool = (cats.length ? cats : WORD_CATEGORIES).flatMap((c) => c.pairs);
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

export { WORD_CATEGORIES, PLAYERS_CATEGORY, WORD_PAIRS, pickWordPair, pickPlayerPair, normalizeWord, sameWord };
