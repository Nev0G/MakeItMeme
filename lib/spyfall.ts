// Spyfall : un lieu secret, un (ou deux) espion(s) qui l'ignorent. Les autres ont un rôle lié au lieu.
// On se pose des questions à tour de rôle pour démasquer l'espion sans trop en dire.
export type Loc = { name: string; emoji: string; roles: string[] };

export const LOCATIONS: Loc[] = [
  { name: 'Avion', emoji: '✈️', roles: ['Pilote', 'Hôtesse de l’air', 'Passager en classe affaires', 'Touriste', 'Steward', 'Passager nerveux', 'Contrôleur de sécurité', 'Enfant turbulent'] },
  { name: 'Banque', emoji: '🏦', roles: ['Directeur', 'Caissier', 'Client mécontent', 'Agent de sécurité', 'Conseiller financier', 'Braqueur', 'Livreur de fonds', 'Stagiaire'] },
  { name: 'Plage', emoji: '🏖️', roles: ['Maître-nageur', 'Vendeur de glaces', 'Surfeur', 'Touriste', 'Photographe', 'Enfant', 'Joueur de volley', 'Retraité'] },
  { name: 'Casino', emoji: '🎰', roles: ['Croupier', 'Joueur compulsif', 'Videur', 'Serveuse', 'Magicien', 'Millionnaire', 'Barman', 'Inspecteur'] },
  { name: 'Cathédrale', emoji: '⛪', roles: ['Prêtre', 'Organiste', 'Touriste', 'Marié', 'Enfant de chœur', 'Pèlerin', 'Guide', 'Sacristain'] },
  { name: 'Cirque', emoji: '🎪', roles: ['Clown', 'Dompteur', 'Trapéziste', 'Jongleur', 'Magicien', 'Spectateur', 'Vendeur de pop-corn', 'Directeur du cirque'] },
  { name: 'Cinéma', emoji: '🎬', roles: ['Caissier', 'Projectionniste', 'Spectateur bruyant', 'Couple', 'Ouvreur', 'Critique', 'Vendeur de confiseries', 'Adolescent'] },
  { name: 'École', emoji: '🏫', roles: ['Professeur', 'Directeur', 'Élève', 'Surveillant', 'Cuisinier de la cantine', 'Parent d’élève', 'Infirmière', 'Délégué de classe'] },
  { name: 'Hôpital', emoji: '🏥', roles: ['Chirurgien', 'Infirmière', 'Patient', 'Médecin urgentiste', 'Visiteur', 'Anesthésiste', 'Brancardier', 'Stagiaire'] },
  { name: 'Hôtel', emoji: '🏨', roles: ['Réceptionniste', 'Portier', 'Client VIP', 'Femme de chambre', 'Chef cuisinier', 'Touriste', 'Directeur', 'Voleur'] },
  { name: 'Supermarché', emoji: '🛒', roles: ['Caissier', 'Client', 'Responsable de rayon', 'Vigile', 'Livreur', 'Boucher', 'Voleur à l’étalage', 'Étudiant en promo'] },
  { name: 'Restaurant', emoji: '🍽️', roles: ['Serveur', 'Chef', 'Client', 'Critique gastronomique', 'Sommelier', 'Plongeur', 'Couple', 'Livreur'] },
  { name: 'Station spatiale', emoji: '🚀', roles: ['Commandant', 'Ingénieur', 'Astronaute', 'Médecin de bord', 'Scientifique', 'Touriste de l’espace', 'Pilote', 'Cuisinier'] },
  { name: 'Sous-marin', emoji: '🛥️', roles: ['Capitaine', 'Sonariste', 'Cuisinier', 'Mécanicien', 'Marin', 'Officier radio', 'Plongeur', 'Médecin'] },
  { name: 'Gare', emoji: '🚉', roles: ['Chef de gare', 'Contrôleur', 'Voyageur pressé', 'Pickpocket', 'Vendeur de journaux', 'Conducteur', 'Touriste perdu', 'Policier'] },
  { name: 'Université', emoji: '🎓', roles: ['Professeur', 'Étudiant', 'Doyen', 'Bibliothécaire', 'Chercheur', 'Délégué', 'Concierge', 'Doctorant'] },
  { name: 'Théâtre', emoji: '🎭', roles: ['Acteur', 'Metteur en scène', 'Souffleur', 'Spectateur', 'Costumière', 'Éclairagiste', 'Critique', 'Ouvreuse'] },
  { name: 'Zoo', emoji: '🦁', roles: ['Soigneur', 'Vétérinaire', 'Visiteur', 'Guide', 'Enfant', 'Photographe animalier', 'Vendeur de souvenirs', 'Directeur'] },
  { name: 'Parc d’attractions', emoji: '🎢', roles: ['Opérateur de manège', 'Enfant', 'Mascotte', 'Parent épuisé', 'Vendeur de barbe à papa', 'Adolescent casse-cou', 'Agent de sécurité', 'Photographe'] },
  { name: 'Salle de sport', emoji: '🏋️', roles: ['Coach', 'Bodybuilder', 'Débutant', 'Réceptionniste', 'Instructeur de yoga', 'Nutritionniste', 'Habitué', 'Retraité'] },
  { name: 'Commissariat', emoji: '🚓', roles: ['Policier', 'Détective', 'Suspect', 'Avocat', 'Témoin', 'Chef de la police', 'Victime', 'Greffier'] },
  { name: 'Station de ski', emoji: '⛷️', roles: ['Moniteur', 'Skieur débutant', 'Secouriste', 'Snowboardeur', 'Serveur de chalet', 'Pisteur', 'Touriste', 'Loueur de matériel'] },
  { name: 'Navire pirate', emoji: '🏴‍☠️', roles: ['Capitaine', 'Matelot', 'Cuistot', 'Prisonnier', 'Vigie', 'Canonnier', 'Perroquet', 'Médecin de bord'] },
  { name: 'Ferme', emoji: '🚜', roles: ['Fermier', 'Vétérinaire', 'Ouvrier agricole', 'Enfant', 'Inspecteur sanitaire', 'Apprenti', 'Vendeur de fromages', 'Touriste'] },
  { name: 'Musée', emoji: '🖼️', roles: ['Conservateur', 'Gardien', 'Guide', 'Visiteur', 'Artiste', 'Voleur d’art', 'Restaurateur', 'Écolier'] },
  { name: 'Studio de télévision', emoji: '📺', roles: ['Présentateur', 'Réalisateur', 'Cameraman', 'Invité', 'Maquilleuse', 'Régisseur', 'Candidat', 'Technicien son'] },
  { name: 'Camp militaire', emoji: '🎖️', roles: ['Colonel', 'Soldat', 'Cuisinier', 'Sniper', 'Médecin militaire', 'Recrue', 'Espion infiltré', 'Mécanicien'] },
  { name: 'Mariage', emoji: '💒', roles: ['Marié', 'Mariée', 'Témoin', 'Photographe', 'Belle-mère', 'DJ', 'Traiteur', 'Enfant d’honneur'] },
  { name: 'Boulangerie', emoji: '🥖', roles: ['Boulanger', 'Vendeuse', 'Client matinal', 'Livreur', 'Apprenti', 'Critique culinaire', 'Retraité', 'Pâtissier'] },
  { name: 'Bibliothèque', emoji: '📚', roles: ['Bibliothécaire', 'Étudiant', 'Écrivain', 'Lecteur assidu', 'Enfant', 'Chercheur', 'Touriste', 'Employé de ménage'] },
];

export type Secret = { loc: number; roles: Record<string, string>; spies: string[] };

export const shuffled = <T,>(arr: T[], rnd: () => number = Math.random) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Tire un lieu, les espions, et un rôle différent pour chacun des autres joueurs
export const deal = (order: string[], spyCount: number, rnd: () => number = Math.random): Secret => {
  const loc = Math.floor(rnd() * LOCATIONS.length);
  const n = Math.max(1, Math.min(spyCount, order.length >= 7 ? 2 : 1));
  const spies = shuffled(order, rnd).slice(0, n);
  const pool = shuffled(LOCATIONS[loc].roles, rnd);
  const roles: Record<string, string> = {};
  let k = 0;
  order.forEach((id) => {
    if (!spies.includes(id)) roles[id] = pool[k++ % pool.length];
  });
  return { loc, roles, spies };
};

// Le secret circule encodé (pas lisible d'un coup d'œil dans les messages du salon)
export const encodeSecret = (s: Secret) => btoa(unescape(encodeURIComponent(JSON.stringify(s))));
export const decodeSecret = (e: string): Secret | null => {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(e))));
  } catch {
    return null;
  }
};

// Vote final : l'accusé est celui qui reçoit le plus de voix (égalité = personne)
export const tally = (votes: Record<string, string>) => {
  const count: Record<string, number> = {};
  Object.values(votes).forEach((s) => (count[s] = (count[s] || 0) + 1));
  const sorted = Object.entries(count).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return { suspect: null as string | null, count: 0 };
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) return { suspect: null as string | null, count: sorted[0][1] };
  return { suspect: sorted[0][0], count: sorted[0][1] };
};

// Accusation : tous les joueurs sauf l'accusé doivent voter « oui »
export const accusationPassed = (votes: Record<string, boolean>, voters: string[]) => voters.length > 0 && voters.every((v) => votes[v] === true);
export const accusationRejected = (votes: Record<string, boolean>) => Object.values(votes).some((v) => v === false);

export const normLoc = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
