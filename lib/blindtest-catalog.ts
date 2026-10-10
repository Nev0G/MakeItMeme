// Catalogue du Blind Test : catégories, sources et listes de recherche.
// Pour ajouter une catégorie : une entrée de plus ici (et, si besoin, une source dans blindtest-server.ts).
//
// kind    : 'audio' (extrait sonore) ou 'image' (image floutée qui se dissipe)
// source  : 'itunes-artist' (le titre du morceau est la réponse), 'itunes-title' (la réponse est le film / jeu / série
//           dont on entend la musique), 'tmdb' (films & séries), 'rawg' (jeux vidéo), 'jikan' (anime)
// needs   : variable d'environnement requise (la catégorie est grisée si elle manque)

export type BlindCategory = {
  id: string;
  label: string;
  emoji: string;
  group: 'Musique' | 'Films & séries' | 'Jeux vidéo & anime';
  kind: 'audio' | 'image';
  source: 'itunes-artist' | 'itunes-title' | 'tmdb' | 'rawg' | 'jikan';
  ask: string; // la question posée aux joueurs
  needs?: string[]; // une de ces variables doit exister
  // itunes-artist : liste d'artistes. itunes-title : [recherche, réponse, ...autres réponses acceptées]
  artists?: string[];
  titles?: string[][];
  tmdb?: { type: 'movie' | 'tv'; shot: boolean };
};

const ARTISTS = {
  hitsFr: ['Stromae', 'Angèle', 'Aya Nakamura', 'Indila', 'Soprano', 'Jul', 'PNL', 'Orelsan', 'Vianney', 'Louane', 'Maître Gims', 'Kendji Girac', 'Julien Doré', 'Christine and the Queens', 'Zaz', 'M. Pokora', 'Slimane', 'Black M', 'Amir', 'Bigflo & Oli', 'Clara Luciani', 'Mylène Farmer', 'Jean-Jacques Goldman', 'Patrick Bruel', 'Francis Cabrel', 'Céline Dion'],
  hitsInt: ['Dua Lipa', 'The Weeknd', 'Ed Sheeran', 'Taylor Swift', 'Billie Eilish', 'Bruno Mars', 'Rihanna', 'Adele', 'Coldplay', 'Imagine Dragons', 'Harry Styles', 'Ariana Grande', 'Post Malone', 'Katy Perry', 'Lady Gaga', 'Justin Bieber', 'Maroon 5', 'Sia', 'Shawn Mendes', 'Olivia Rodrigo', 'Lizzo', 'Doja Cat', 'Lewis Capaldi', 'Miley Cyrus', 'Sam Smith'],
  rapFr: ['Booba', 'Nekfeu', 'Damso', 'Ninho', 'SCH', 'Gazo', 'Naps', 'Lomepal', 'Vald', 'Kaaris', 'Niska', 'Alonzo', 'MC Solaar', 'IAM', 'Maes', 'Hamza', 'Lacrim', 'Tiakola', 'Werenoi', 'Dadju', 'Koba LaD', 'Josman'],
  rock: ['Queen', 'AC/DC', 'Nirvana', 'Led Zeppelin', "Guns N' Roses", 'Metallica', 'Red Hot Chili Peppers', 'Muse', 'Oasis', 'Green Day', 'The Rolling Stones', 'Pink Floyd', 'Linkin Park', 'Foo Fighters', 'The Beatles', 'U2', 'Bon Jovi', 'Aerosmith', 'Scorpions', 'Radiohead', 'Arctic Monkeys', 'The Killers', 'System of a Down'],
  eighties: ['Michael Jackson', 'Madonna', 'Prince', 'a-ha', 'Depeche Mode', 'Duran Duran', 'Cyndi Lauper', 'Whitney Houston', 'Eurythmics', 'Indochine', 'The Police', 'Phil Collins', 'Wham!', 'Tears for Fears', 'Kate Bush', 'Toto', 'Europe', 'Survivor', 'Simple Minds', 'Dire Straits', 'Billy Idol', 'Rick Astley', 'Culture Club', 'Bonnie Tyler'],
  nineties: ['Backstreet Boys', 'Spice Girls', 'Britney Spears', 'Eiffel 65', 'Aqua', 'Céline Dion', 'Mariah Carey', 'The Cranberries', 'Roxette', 'Ace of Base', 'Los del Rio', 'Haddaway', '2 Unlimited', 'Alanis Morissette', "Destiny's Child", 'NSYNC', 'TLC', 'Savage Garden', 'Robbie Williams', 'Take That', 'Fugees', '2Pac', 'The Notorious B.I.G.', 'Vengaboys', 'Cher', 'Shania Twain', 'Blur'],
  tens: ['Rihanna', 'Drake', 'Ed Sheeran', 'Maroon 5', 'Bruno Mars', 'The Weeknd', 'Katy Perry', 'Lady Gaga', 'Imagine Dragons', 'Pharrell Williams', 'Daft Punk', 'Stromae', 'Indila', 'Lorde', 'Calvin Harris', 'David Guetta', 'Avicii', 'Sia', 'Adele', 'Justin Bieber', 'Ariana Grande', 'Shawn Mendes', 'Camila Cabello', 'Sam Smith', 'Charlie Puth', 'Zedd', 'Clean Bandit', 'Martin Garrix', 'Kygo', 'Passenger', 'Louane', 'Maître Gims'],
  twenties: ['Dua Lipa', 'Olivia Rodrigo', 'Harry Styles', 'Doja Cat', 'The Kid LAROI', 'Glass Animals', 'Lil Nas X', 'SZA', 'Billie Eilish', 'Miley Cyrus', 'Taylor Swift', 'Bad Bunny', 'Måneskin', 'Tate McRae', 'Sabrina Carpenter', 'Chappell Roan', 'Gazo', 'Tiakola', 'Zaho de Sagazan', 'Angèle', 'Aya Nakamura', 'Slimane', 'Ninho', 'Hoshi', 'RAYE', 'Benson Boone', 'Lewis Capaldi', 'Stromae', 'Jul', 'Shakira'],
  noughties: ['Beyoncé', 'Black Eyed Peas', 'Shakira', 'Avril Lavigne', 'Gorillaz', 'Amy Winehouse', 'Justin Timberlake', 'Kelly Clarkson', 'Rihanna', 'Eminem', '50 Cent', 'Usher', 'Nelly Furtado', 'Sean Paul', 'Gwen Stefani', 'Kanye West', 'Christina Aguilera', 'P!nk', 'Evanescence', 'The White Stripes', 'Franz Ferdinand', 'Jason Mraz', 'Akon', 'Coldplay'],
};

const FILMS: string[][] = [
  ['Star Wars', 'Star Wars'],
  ['Le Seigneur des anneaux', 'Le Seigneur des anneaux', 'The Lord of the Rings', 'LOTR'],
  ['Harry Potter', 'Harry Potter'],
  ['Pirates des Caraïbes', 'Pirates des Caraïbes', 'Pirates of the Caribbean'],
  ['Interstellar', 'Interstellar'],
  ['Inception', 'Inception'],
  ['Gladiator', 'Gladiator'],
  ['Titanic', 'Titanic'],
  ['Jurassic Park', 'Jurassic Park', 'Jurassic World'],
  ['Le Parrain', 'Le Parrain', 'The Godfather'],
  ['Retour vers le futur', 'Retour vers le futur', 'Back to the Future'],
  ['Mission Impossible', 'Mission Impossible', 'Mission: Impossible'],
  ['James Bond', 'James Bond', '007'],
  ['Indiana Jones', 'Indiana Jones'],
  ['Avengers', 'Avengers', 'Marvel'],
  ['La La Land', 'La La Land'],
  ['Le Roi Lion', 'Le Roi Lion', 'The Lion King'],
  ['La Reine des neiges', 'La Reine des neiges', 'Frozen'],
  ['Toy Story', 'Toy Story'],
  ['Les Choristes', 'Les Choristes'],
  ['Le Fabuleux Destin d\'Amélie Poulain', 'Amélie Poulain', 'Le Fabuleux Destin d\'Amélie Poulain', 'Amélie'],
  ['Intouchables', 'Intouchables'],
  ['Matrix', 'Matrix', 'The Matrix'],
  ['The Dark Knight', 'The Dark Knight', 'Batman', 'Batman The Dark Knight'],
  ['Rocky', 'Rocky'],
  ['Ghostbusters', 'Ghostbusters', 'SOS Fantômes'],
  ['E.T. l\'extra-terrestre', 'E.T.', 'ET', 'E.T. l\'extra-terrestre'],
  ['Dune', 'Dune'],
  ['Joker', 'Joker'],
  ['Top Gun', 'Top Gun'],
  ['Forrest Gump', 'Forrest Gump'],
  ['Shrek', 'Shrek'],
  ['Les Dents de la mer', 'Les Dents de la mer', 'Jaws'],
  ['Le Bon, la Brute et le Truand', 'Le Bon, la Brute et le Truand', 'The Good, the Bad and the Ugly'],
  ['La Liste de Schindler', 'La Liste de Schindler', 'Schindler\'s List'],
  ['Braveheart', 'Braveheart'],
  ['Les Évadés', 'Les Évadés', 'The Shawshank Redemption'],
];

const GAMES: string[][] = [
  ['The Legend of Zelda', 'Zelda', 'The Legend of Zelda'],
  ['Super Mario', 'Super Mario', 'Mario'],
  ['Tetris', 'Tetris'],
  ['Minecraft', 'Minecraft'],
  ['Pokémon', 'Pokémon', 'Pokemon'],
  ['Sonic the Hedgehog', 'Sonic', 'Sonic the Hedgehog'],
  ['Final Fantasy', 'Final Fantasy'],
  ['Halo', 'Halo'],
  ['The Elder Scrolls Skyrim', 'Skyrim', 'The Elder Scrolls', 'The Elder Scrolls V: Skyrim'],
  ['The Witcher 3', 'The Witcher', 'The Witcher 3', 'Witcher'],
  ['Undertale', 'Undertale'],
  ['DOOM', 'Doom', 'DOOM'],
  ['Street Fighter', 'Street Fighter'],
  ['Kingdom Hearts', 'Kingdom Hearts'],
  ['Persona 5', 'Persona 5', 'Persona'],
  ['Red Dead Redemption', 'Red Dead Redemption', 'Red Dead'],
  ['Grand Theft Auto', 'GTA', 'Grand Theft Auto'],
  ['Animal Crossing', 'Animal Crossing'],
  ['Dark Souls', 'Dark Souls'],
  ['Celeste', 'Celeste'],
  ['Hollow Knight', 'Hollow Knight'],
  ['Portal', 'Portal'],
  ['BioShock', 'BioShock', 'Bioshock'],
  ['God of War', 'God of War'],
  ['Assassin\'s Creed', 'Assassin\'s Creed', 'Assassins Creed'],
  ['Mass Effect', 'Mass Effect'],
  ['Metal Gear Solid', 'Metal Gear Solid', 'Metal Gear'],
  ['Crash Bandicoot', 'Crash Bandicoot', 'Crash'],
  ['Donkey Kong', 'Donkey Kong'],
  ['Kirby', 'Kirby'],
  ['Splatoon', 'Splatoon'],
  ['Stardew Valley', 'Stardew Valley'],
  ['Fallout', 'Fallout'],
  ['Cyberpunk 2077', 'Cyberpunk 2077', 'Cyberpunk'],
  ['Genshin Impact', 'Genshin Impact', 'Genshin'],
  ['Overwatch', 'Overwatch'],
];

const SERIES: string[][] = [
  ['Game of Thrones', 'Game of Thrones', 'GOT'],
  ['Friends', 'Friends'],
  ['Stranger Things', 'Stranger Things'],
  ['Breaking Bad', 'Breaking Bad'],
  ['Les Simpson', 'Les Simpson', 'The Simpsons', 'Simpsons'],
  ['Peaky Blinders', 'Peaky Blinders'],
  ['La Casa de Papel', 'La Casa de Papel', 'Money Heist'],
  ['Kaamelott', 'Kaamelott'],
  ['The Office', 'The Office'],
  ['Black Mirror', 'Black Mirror'],
  ['Narcos', 'Narcos'],
  ['Dexter', 'Dexter'],
  ['Westworld', 'Westworld'],
  ['Mr. Robot', 'Mr. Robot', 'Mr Robot'],
  ['The Mandalorian', 'The Mandalorian', 'Mandalorian'],
  ['Squid Game', 'Squid Game'],
  ['Sherlock', 'Sherlock'],
  ['Doctor Who', 'Doctor Who'],
  ['The X-Files', 'X-Files', 'The X-Files', 'X Files'],
  ['Wednesday', 'Mercredi', 'Wednesday'],
  ['The Witcher', 'The Witcher', 'Witcher'],
  ['Vikings', 'Vikings'],
  ['The Walking Dead', 'The Walking Dead', 'Walking Dead'],
  ['Lupin', 'Lupin'],
  ['House of Cards', 'House of Cards'],
  ['Succession', 'Succession'],
  ['Les Mystérieuses Cités d\'or', 'Les Mystérieuses Cités d\'or', 'Cités d\'or'],
  ['Dragon Ball Z', 'Dragon Ball Z', 'Dragon Ball', 'DBZ'],
  ['Naruto', 'Naruto'],
  ['One Piece', 'One Piece'],
];

const DISNEY: string[][] = [
  ['Le Roi Lion', 'Le Roi Lion', 'The Lion King'],
  ['La Reine des neiges', 'La Reine des neiges', 'Frozen'],
  ['Aladdin', 'Aladdin'],
  ['La Petite Sirène', 'La Petite Sirène', 'The Little Mermaid'],
  ['La Belle et la Bête', 'La Belle et la Bête', 'Beauty and the Beast'],
  ['Le Livre de la jungle', 'Le Livre de la jungle', 'The Jungle Book'],
  ['Vaiana', 'Vaiana', 'Moana'],
  ['Encanto', 'Encanto'],
  ['Coco', 'Coco'],
  ['Ratatouille', 'Ratatouille'],
  ['Mulan', 'Mulan'],
  ['Pocahontas', 'Pocahontas'],
  ['Tarzan', 'Tarzan'],
  ['Cendrillon', 'Cendrillon', 'Cinderella'],
  ['Blanche-Neige et les sept nains', 'Blanche-Neige', 'Blanche Neige', 'Snow White'],
  ['Raiponce', 'Raiponce', 'Tangled'],
  ['Hercule', 'Hercule', 'Hercules'],
  ['Les Aristochats', 'Les Aristochats', 'The Aristocats'],
  ['Peter Pan', 'Peter Pan'],
  ['Alice au pays des merveilles', 'Alice au pays des merveilles', 'Alice in Wonderland'],
  ['Monstres & Cie', 'Monstres & Cie', 'Monsters Inc', 'Monstres et Cie'],
  ['Le Monde de Nemo', 'Nemo', 'Le Monde de Nemo', 'Finding Nemo'],
  ['Là-haut', 'Là-haut', 'Up'],
  ['Wall-E', 'Wall-E', 'WALL-E'],
  ['Vice-Versa', 'Vice-Versa', 'Inside Out'],
];

export const BLIND_CATEGORIES: BlindCategory[] = [
  { id: 'hits-fr', label: 'Hits français', emoji: '🇫🇷', group: 'Musique', kind: 'audio', source: 'itunes-artist', ask: 'Quel est ce titre ?', artists: ARTISTS.hitsFr },
  { id: 'hits-int', label: 'Hits internationaux', emoji: '🌍', group: 'Musique', kind: 'audio', source: 'itunes-artist', ask: 'Quel est ce titre ?', artists: ARTISTS.hitsInt },
  { id: 'rap-fr', label: 'Rap français', emoji: '🎤', group: 'Musique', kind: 'audio', source: 'itunes-artist', ask: 'Quel est ce titre ?', artists: ARTISTS.rapFr },
  { id: 'rock', label: 'Rock & métal', emoji: '🎸', group: 'Musique', kind: 'audio', source: 'itunes-artist', ask: 'Quel est ce titre ?', artists: ARTISTS.rock },
  { id: 'annees-80', label: 'Années 80', emoji: '🕺', group: 'Musique', kind: 'audio', source: 'itunes-artist', ask: 'Quel est ce titre ?', artists: ARTISTS.eighties },
  { id: 'annees-90', label: 'Années 90', emoji: '📼', group: 'Musique', kind: 'audio', source: 'itunes-artist', ask: 'Quel est ce titre ?', artists: ARTISTS.nineties },
  { id: 'annees-2000', label: 'Années 2000', emoji: '💿', group: 'Musique', kind: 'audio', source: 'itunes-artist', ask: 'Quel est ce titre ?', artists: ARTISTS.noughties },
  { id: 'annees-2010', label: 'Années 2010', emoji: '📱', group: 'Musique', kind: 'audio', source: 'itunes-artist', ask: 'Quel est ce titre ?', artists: ARTISTS.tens },
  { id: 'annees-2020', label: 'Années 2020', emoji: '🚀', group: 'Musique', kind: 'audio', source: 'itunes-artist', ask: 'Quel est ce titre ?', artists: ARTISTS.twenties },
  { id: 'bo-films', label: 'Bandes originales de films', emoji: '🎼', group: 'Films & séries', kind: 'audio', source: 'itunes-title', ask: 'De quel film vient cette musique ?', titles: FILMS },
  { id: 'disney', label: 'Disney & Pixar', emoji: '🏰', group: 'Films & séries', kind: 'audio', source: 'itunes-title', ask: 'Quel film d’animation ?', titles: DISNEY },
  { id: 'generiques', label: 'Musiques de séries', emoji: '📺', group: 'Films & séries', kind: 'audio', source: 'itunes-title', ask: 'Quelle série (ou quel anime) ?', titles: SERIES },
  { id: 'film-affiches', label: 'Affiches de films', emoji: '🎬', group: 'Films & séries', kind: 'image', source: 'tmdb', ask: 'Quel est ce film ?', needs: ['TMDB_API_KEY', 'TMDB_READ_TOKEN'], tmdb: { type: 'movie', shot: false } },
  { id: 'film-scenes', label: 'Scènes de films', emoji: '🍿', group: 'Films & séries', kind: 'image', source: 'tmdb', ask: 'Quel est ce film ?', needs: ['TMDB_API_KEY', 'TMDB_READ_TOKEN'], tmdb: { type: 'movie', shot: true } },
  { id: 'serie-affiches', label: 'Affiches de séries', emoji: '📡', group: 'Films & séries', kind: 'image', source: 'tmdb', ask: 'Quelle est cette série ?', needs: ['TMDB_API_KEY', 'TMDB_READ_TOKEN'], tmdb: { type: 'tv', shot: false } },
  { id: 'serie-scenes', label: 'Scènes de séries', emoji: '🎞️', group: 'Films & séries', kind: 'image', source: 'tmdb', ask: 'Quelle est cette série ?', needs: ['TMDB_API_KEY', 'TMDB_READ_TOKEN'], tmdb: { type: 'tv', shot: true } },
  { id: 'jeux-ost', label: 'Musiques de jeux vidéo', emoji: '🎮', group: 'Jeux vidéo & anime', kind: 'audio', source: 'itunes-title', ask: 'De quel jeu vient cette musique ?', titles: GAMES },
  { id: 'jeux-captures', label: 'Captures de jeux vidéo', emoji: '🕹️', group: 'Jeux vidéo & anime', kind: 'image', source: 'rawg', ask: 'Quel est ce jeu vidéo ?', needs: ['RAWG_API_KEY'] },
  { id: 'anime-affiches', label: 'Affiches d’anime', emoji: '🍥', group: 'Jeux vidéo & anime', kind: 'image', source: 'jikan', ask: 'Quel est cet anime ?' },
];

export const categoryById = (id: string) => BLIND_CATEGORIES.find((c) => c.id === id);
