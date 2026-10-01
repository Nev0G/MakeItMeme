// Fin de phrase de « Qui est le plus susceptible de… ? »
const SOFT_QUESTIONS = [
  "oublier l'anniversaire d'un ami proche",
  "arriver en retard à son propre mariage",
  "s'endormir pendant un film au cinéma",
  "se perdre avec un GPS",
  "pleurer devant un dessin animé",
  "rater son train à cause d'un « encore 5 minutes »",
  "devenir célèbre sur Internet",
  "survivre à une apocalypse zombie",
  "manger un plat tombé par terre",
  "parler tout seul dans la rue",
  "gagner au loto et tout dépenser en une semaine",
  "adopter dix chats",
  "faire un discours improvisé devant tout le monde",
  "casser son téléphone en le faisant tomber",
  "devenir président",
  "partir vivre sur une île déserte",
  "raconter trois fois la même anecdote dans la soirée",
  "se faire tatouer sur un coup de tête",
  "oublier où il a garé sa voiture",
  "mettre du ketchup sur ses pâtes",
  "tomber amoureux en vacances",
  "ne jamais répondre aux messages",
  "se battre avec un pigeon",
  "commencer un régime tous les lundis",
  "rire à un enterrement",
  "dépenser tout son salaire en jeux vidéo",
  "devenir un super-héros",
  "finir dans une télé-réalité",
  "adorer l'ananas sur la pizza",
  "rester coincé dans un ascenseur",
];

const SPICY_QUESTIONS = [
  "mentir sans cligner des yeux",
  "stalker son ex sur les réseaux",
  "se vanter de choses qu'il n'a jamais faites",
  "pleurer après deux verres",
  "tout balancer à la moindre pression",
  "fouiller dans le téléphone de quelqu'un",
  "parler mal de quelqu'un dans son dos",
  "draguer le serveur ou la serveuse",
  "se faire virer dès le premier jour",
  "avoir un faux compte secret",
  "danser sur la table en soirée",
  "oublier de payer sa part",
  "faire semblant d'être malade pour éviter une soirée",
  "ghoster tout le monde pendant un mois",
  "envoyer un message à la mauvaise personne",
  "devenir riche en faisant quelque chose de louche",
  "se réveiller sans aucun souvenir de la veille",
  "poster une photo gênante de quelqu'un sans lui demander",
];

const shuffled = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Tire `count` questions différentes selon la catégorie ('soft' | 'spicy' | 'mix')
const pickQuestions = (category: string, count: number): string[] => {
  const pool = category === 'soft' ? SOFT_QUESTIONS : category === 'spicy' ? SPICY_QUESTIONS : [...SOFT_QUESTIONS, ...SPICY_QUESTIONS];
  return shuffled(pool).slice(0, Math.min(count, pool.length));
};

export { SOFT_QUESTIONS, SPICY_QUESTIONS, pickQuestions };
