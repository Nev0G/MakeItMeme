// Loup-Garou : automate de partie (nuit / jour / vote). Fonctions pures : chaque action renvoie un nouvel état.
// Le host appelle `tick` à intervalle régulier ; `act*` valident les actions des joueurs.
export type Role = 'villager' | 'wolf' | 'seer' | 'witch' | 'hunter' | 'cupid' | 'guard';
export type Step = 'reveal' | 'cupid' | 'seer' | 'guard' | 'wolves' | 'witch' | 'dawn' | 'hunter' | 'day' | 'vote' | 'voteResult';

export const ROLE_INFO: Record<Role, { name: string; emoji: string; camp: 'village' | 'wolves'; text: string }> = {
  villager: { name: 'Villageois', emoji: '🧑‍🌾', camp: 'village', text: 'Tu n’as aucun pouvoir. Observe, débats et vote pour démasquer les loups.' },
  wolf: { name: 'Loup-Garou', emoji: '🐺', camp: 'wolves', text: 'Chaque nuit, avec les autres loups, tu dévores un villageois. Le jour, fais-toi passer pour un innocent.' },
  seer: { name: 'Voyante', emoji: '🔮', camp: 'village', text: 'Chaque nuit, tu découvres le vrai rôle d’un joueur. Guide le village sans te faire dévorer.' },
  witch: { name: 'Sorcière', emoji: '🧙‍♀️', camp: 'village', text: 'Tu as une potion de vie (sauve la victime des loups) et une potion de mort. Chacune ne sert qu’une fois.' },
  hunter: { name: 'Chasseur', emoji: '🏹', camp: 'village', text: 'Si tu meurs, tu emportes immédiatement un joueur de ton choix avec toi.' },
  cupid: { name: 'Cupidon', emoji: '💘', camp: 'village', text: 'La première nuit, tu lies deux joueurs par l’amour : si l’un meurt, l’autre le suit dans la tombe.' },
  guard: { name: 'Garde', emoji: '🛡️', camp: 'village', text: 'Chaque nuit, tu protèges un joueur des loups (pas deux nuits de suite le même).' },
};

export type Opts = {
  dayS: number; // durée de la discussion
  voteS: number; // durée du vote
  roles: { seer: boolean; witch: boolean; hunter: boolean; cupid: boolean; guard: boolean };
  wolves: number; // 0 = automatique
  reveal: boolean; // révéler le rôle des morts
};
export const DEFAULT_OPTS: Opts = { dayS: 120, voteS: 45, roles: { seer: true, witch: true, hunter: true, cupid: true, guard: true }, wolves: 0, reveal: true };

export type Death = { id: string; cause: 'wolves' | 'poison' | 'love' | 'vote' | 'hunter' | 'left'; night?: number };

export type WW = {
  opts: Opts;
  order: string[];
  roles: Record<string, Role>;
  dead: string[];
  night: number;
  step: Step;
  until: number; // fin de l'étape (timestamp)
  fake: boolean; // étape « leurre » : le rôle concerné est mort, on attend quelques secondes pour ne rien révéler
  lovers: string[] | null;
  cupidPick: string[] | null;
  seerPick: string | null;
  seerSeen: Record<string, Role>; // ce que la voyante a découvert depuis le début
  guardPick: string | null;
  lastGuard: string | null;
  wolfVotes: Record<string, string>;
  wolfTarget: string | null;
  healUsed: boolean;
  poisonUsed: boolean;
  witchHeal: boolean; // décision de la nuit en cours
  witchPoison: string | null;
  witchDone: boolean;
  deaths: Death[]; // morts annoncées à l'aube / après le vote
  graveyard: Death[]; // tous les morts de la partie, dans l'ordre
  hunterQueue: string[]; // chasseurs morts qui doivent tirer
  hunterFrom: 'night' | 'vote'; // d'où l'on vient (pour savoir quoi enchaîner)
  readyDay: string[]; // joueurs prêts à passer au vote
  votes: Record<string, string>; // vote du jour : id -> cible ou 'blank'
  voteOutcome: { target: string | null; counts: Record<string, number> } | null;
  winner: null | 'village' | 'wolves' | 'lovers' | 'none';
  log: { n: number; text: string }[];
};

const STEP_S: Record<string, number> = { reveal: 10, cupid: 25, seer: 20, guard: 20, wolves: 35, witch: 25, dawn: 8, hunter: 25, voteResult: 8 };

export const aliveOf = (s: Pick<WW, 'order' | 'dead'>) => s.order.filter((id) => !s.dead.includes(id));
export const wolvesAlive = (s: WW) => aliveOf(s).filter((id) => s.roles[id] === 'wolf');
const withRole = (s: WW, role: Role) => s.order.filter((id) => s.roles[id] === role);

export const shuffled = <T,>(arr: T[], rnd: () => number = Math.random) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const wolfCount = (n: number, opts: Opts) => (opts.wolves > 0 ? Math.min(opts.wolves, Math.max(1, Math.floor((n - 1) / 2))) : n <= 6 ? 1 : n <= 11 ? 2 : n <= 15 ? 3 : 4);

// Répartition des rôles selon le nombre de joueurs et les rôles activés
export const makeRoles = (order: string[], opts: Opts, rnd: () => number = Math.random): Record<string, Role> => {
  const n = order.length;
  const list: Role[] = Array(wolfCount(n, opts)).fill('wolf');
  const specials: [Role, number][] = [['seer', 5], ['witch', 6], ['hunter', 7], ['cupid', 8], ['guard', 9]];
  for (const [r, min] of specials) if ((opts.roles as any)[r] && n >= min && list.length < n - 1) list.push(r);
  while (list.length < n) list.push('villager');
  const mixed = shuffled(list, rnd);
  const roles: Record<string, Role> = {};
  order.forEach((id, i) => (roles[id] = mixed[i]));
  return roles;
};

export const composition = (s: Pick<WW, 'order' | 'roles'>) => {
  const c: Partial<Record<Role, number>> = {};
  s.order.forEach((id) => (c[s.roles[id]] = (c[s.roles[id]] || 0) + 1));
  return c;
};

const say = (s: WW, text: string): WW => ({ ...s, log: [...s.log, { n: s.night, text }].slice(-80) });

export const newGame = (order: string[], opts: Opts, now: number, rnd: () => number = Math.random): WW => ({
  opts, order, roles: makeRoles(order, opts, rnd), dead: [], night: 0, step: 'reveal', until: now + STEP_S.reveal * 1000, fake: false,
  lovers: null, cupidPick: null, seerPick: null, seerSeen: {}, guardPick: null, lastGuard: null, wolfVotes: {}, wolfTarget: null,
  healUsed: false, poisonUsed: false, witchHeal: false, witchPoison: null, witchDone: false,
  deaths: [], graveyard: [], hunterQueue: [], hunterFrom: 'night', readyDay: [], votes: {}, voteOutcome: null, winner: null,
  log: [{ n: 0, text: 'Le village s’endort pour la première nuit…' }],
});

// ---------- Qui doit agir à l'étape en cours ? ----------
export const actorsOf = (s: WW): string[] => {
  switch (s.step) {
    case 'cupid': return s.night === 1 ? withRole(s, 'cupid').filter((id) => !s.dead.includes(id)) : [];
    case 'seer': return withRole(s, 'seer').filter((id) => !s.dead.includes(id));
    case 'guard': return withRole(s, 'guard').filter((id) => !s.dead.includes(id));
    case 'wolves': return wolvesAlive(s);
    case 'witch': return withRole(s, 'witch').filter((id) => !s.dead.includes(id));
    case 'hunter': return s.hunterQueue.slice(0, 1);
    case 'vote': return aliveOf(s);
    default: return [];
  }
};

// L'étape peut-elle se terminer avant la fin du temps ?
export const stepDone = (s: WW): boolean => {
  if (s.fake) return false;
  switch (s.step) {
    case 'cupid': return !!s.cupidPick;
    case 'seer': return !!s.seerPick;
    case 'guard': return !!s.guardPick;
    case 'wolves': return wolvesAlive(s).every((id) => id in s.wolfVotes);
    case 'witch': return s.witchDone;
    case 'vote': return aliveOf(s).every((id) => id in s.votes);
    case 'day': return s.readyDay.filter((id) => !s.dead.includes(id)).length * 2 > aliveOf(s).length;
    default: return false;
  }
};

// ---------- Étapes de la nuit ----------
const NIGHT_ORDER: Step[] = ['cupid', 'seer', 'guard', 'wolves', 'witch'];
const stepRole: Record<string, Role> = { cupid: 'cupid', seer: 'seer', guard: 'guard', wolves: 'wolf', witch: 'witch' };

// Étape suivante de la nuit après `from` ('' = début). Un rôle en jeu mais mort donne une étape leurre.
const nextNightStep = (s: WW, from: Step | '', now: number, rnd: () => number): WW => {
  let i = from === '' ? 0 : NIGHT_ORDER.indexOf(from as Step) + 1;
  for (; i < NIGHT_ORDER.length; i++) {
    const st = NIGHT_ORDER[i];
    const role = stepRole[st];
    if (st === 'cupid' && s.night !== 1) continue;
    if (!withRole(s, role).length) continue; // rôle absent de la partie : étape sautée
    const alive = withRole(s, role).some((id) => !s.dead.includes(id));
    const fake = !alive;
    const secs = fake ? 4 + Math.floor(rnd() * 4) : STEP_S[st];
    return { ...s, step: st, fake, until: now + secs * 1000 };
  }
  return resolveDawn({ ...s, step: 'dawn' }, now);
};

const startNight = (s: WW, now: number, rnd: () => number): WW => {
  const night = s.night + 1;
  const base: WW = { ...s, night, seerPick: null, guardPick: null, wolfVotes: {}, wolfTarget: null, witchHeal: false, witchPoison: null, witchDone: false, votes: {}, voteOutcome: null, readyDay: [], deaths: [], hunterQueue: [] };
  return nextNightStep(say(base, `Nuit ${night} : le village s’endort…`), '', now, rnd);
};

// ---------- Morts, amoureux, chasseurs ----------
const kill = (s: WW, id: string, cause: Death['cause']): WW => {
  if (s.dead.includes(id)) return s;
  const death: Death = { id, cause, night: s.night };
  let next: WW = { ...s, dead: [...s.dead, id], deaths: [...s.deaths, death], graveyard: [...s.graveyard, death] };
  if (s.roles[id] === 'hunter' && cause !== 'left') next = { ...next, hunterQueue: [...next.hunterQueue, id] };
  // Les amoureux meurent ensemble
  if (next.lovers && next.lovers.includes(id)) {
    const other = next.lovers.find((x) => x !== id);
    if (other && !next.dead.includes(other)) next = kill(next, other, 'love');
  }
  return next;
};

export const checkWinner = (s: WW): WW['winner'] => {
  const alive = aliveOf(s);
  if (alive.length === 0) return 'none';
  const wolves = alive.filter((id) => s.roles[id] === 'wolf').length;
  if (s.lovers && alive.length === 2 && s.lovers.every((id) => alive.includes(id)) && s.lovers.some((id) => s.roles[id] === 'wolf') && s.lovers.some((id) => s.roles[id] !== 'wolf')) return 'lovers';
  if (wolves === 0) return 'village';
  if (wolves >= alive.length - wolves) return 'wolves';
  return null;
};

const finish = (s: WW): WW => {
  const winner = checkWinner(s);
  return winner ? { ...s, winner, step: 'dawn', until: Infinity, fake: false } : s;
};

// À l'aube : on résout les actions de la nuit
const resolveDawn = (s: WW, now: number): WW => {
  let next: WW = { ...s, step: 'dawn', fake: false, until: now + STEP_S.dawn * 1000, deaths: [], hunterQueue: [], hunterFrom: 'night' };
  const victim = next.wolfTarget;
  const protectedByGuard = !!victim && next.guardPick === victim;
  const healed = !!victim && next.witchHeal;
  // La victime meurt si elle n'est pas protégée, ou si elle l'est deux fois (garde + potion : la protection s'annule)
  if (victim && protectedByGuard === healed) next = kill(next, victim, 'wolves');
  if (next.witchPoison) next = kill(next, next.witchPoison, 'poison');
  next = { ...next, lastGuard: next.guardPick, healUsed: next.healUsed || next.witchHeal, poisonUsed: next.poisonUsed || !!next.witchPoison };
  next = say(next, next.deaths.length ? `À l’aube, ${next.deaths.length} mort${next.deaths.length > 1 ? 's' : ''} au village.` : 'À l’aube, personne n’est mort cette nuit.');
  return next;
};

const afterDeaths = (s: WW, from: 'night' | 'vote', now: number, rnd: () => number): WW => {
  const won = finish(s);
  if (won.winner) return won;
  if (s.hunterQueue.length) return { ...s, step: 'hunter', hunterFrom: from, fake: false, until: now + STEP_S.hunter * 1000 };
  return from === 'night'
    ? { ...s, step: 'day', fake: false, readyDay: [], votes: {}, until: now + s.opts.dayS * 1000 }
    : startNight(s, now, rnd);
};

// ---------- Actions des joueurs ----------
const isAlive = (s: WW, id: string) => s.order.includes(id) && !s.dead.includes(id);

export const actCupid = (s: WW, id: string, a: string, b: string): WW | null => {
  if (s.step !== 'cupid' || s.fake || !actorsOf(s).includes(id) || s.cupidPick) return null;
  if (a === b || !isAlive(s, a) || !isAlive(s, b)) return null;
  return { ...s, cupidPick: [a, b], lovers: [a, b] };
};
export const actSeer = (s: WW, id: string, target: string): WW | null => {
  if (s.step !== 'seer' || s.fake || !actorsOf(s).includes(id) || s.seerPick || !isAlive(s, target) || target === id) return null;
  return { ...s, seerPick: target, seerSeen: { ...s.seerSeen, [target]: s.roles[target] } };
};
export const actGuard = (s: WW, id: string, target: string): WW | null => {
  if (s.step !== 'guard' || s.fake || !actorsOf(s).includes(id) || s.guardPick || !isAlive(s, target) || target === s.lastGuard) return null;
  return { ...s, guardPick: target };
};
export const actWolf = (s: WW, id: string, target: string): WW | null => {
  if (s.step !== 'wolves' || s.fake || !wolvesAlive(s).includes(id) || !isAlive(s, target) || s.roles[target] === 'wolf') return null;
  return { ...s, wolfVotes: { ...s.wolfVotes, [id]: target } };
};
export const actWitch = (s: WW, id: string, heal: boolean, poison: string | null): WW | null => {
  if (s.step !== 'witch' || s.fake || !actorsOf(s).includes(id) || s.witchDone) return null;
  if (heal && (s.healUsed || !s.wolfTarget)) return null;
  if (poison && (s.poisonUsed || !isAlive(s, poison) || poison === id)) return null;
  return { ...s, witchHeal: heal, witchPoison: poison, witchDone: true };
};
export const actHunter = (s: WW, id: string, target: string, now: number, rnd: () => number = Math.random): WW | null => {
  if (s.step !== 'hunter' || s.hunterQueue[0] !== id || !isAlive(s, target)) return null;
  let next: WW = { ...s, hunterQueue: s.hunterQueue.slice(1), deaths: [] };
  next = kill(next, target, 'hunter');
  next = say(next, 'Le chasseur tire une dernière balle !');
  next = { ...next, deaths: next.deaths };
  return afterDeaths(next, s.hunterFrom, now, rnd);
};
export const actReady = (s: WW, id: string): WW | null => {
  if (s.step !== 'day' || !isAlive(s, id) || s.readyDay.includes(id)) return null;
  return { ...s, readyDay: [...s.readyDay, id] };
};
export const actVote = (s: WW, id: string, target: string): WW | null => {
  if (s.step !== 'vote' || !isAlive(s, id) || id in s.votes) return null;
  if (target !== 'blank' && (!isAlive(s, target) || target === id)) return null;
  return { ...s, votes: { ...s.votes, [id]: target } };
};

// Un joueur quitte la partie : il est retiré (sans tir de chasseur)
export const leave = (s: WW, id: string): WW => {
  if (!isAlive(s, id) || s.winner) return s;
  const next = say(kill(s, id, 'left'), 'Un joueur a quitté le village.');
  return finish(next);
};

// ---------- Avancement automatique ----------
const tallyVotes = (votes: Record<string, string>) => {
  const counts: Record<string, number> = {};
  Object.values(votes).forEach((t) => t !== 'blank' && (counts[t] = (counts[t] || 0) + 1));
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return { target: null as string | null, counts };
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) return { target: null as string | null, counts };
  return { target: sorted[0][0], counts };
};

export const tick = (s: WW, now: number, rnd: () => number = Math.random): WW => {
  if (s.winner) return s;
  const timeUp = now >= s.until;
  if (!timeUp && !stepDone(s)) return s;
  switch (s.step) {
    case 'reveal': return startNight(s, now, rnd);
    case 'cupid': {
      let next = s;
      if (!s.cupidPick && actorsOf(s).length) {
        const alive = shuffled(aliveOf(s), rnd);
        next = { ...s, cupidPick: [alive[0], alive[1]], lovers: [alive[0], alive[1]] };
      }
      return nextNightStep(next, 'cupid', now, rnd);
    }
    case 'seer': return nextNightStep(s, 'seer', now, rnd);
    case 'guard': return nextNightStep(s, 'guard', now, rnd);
    case 'wolves': {
      // Cible : plurality des votes des loups, au hasard en cas d'égalité ; sans vote, au hasard parmi les non-loups
      const counts: Record<string, number> = {};
      Object.values(s.wolfVotes).forEach((t) => (counts[t] = (counts[t] || 0) + 1));
      const best = Math.max(0, ...Object.values(counts));
      let pool = Object.keys(counts).filter((t) => counts[t] === best);
      if (!pool.length) pool = aliveOf(s).filter((id) => s.roles[id] !== 'wolf');
      const target = s.fake ? null : pool[Math.floor(rnd() * pool.length)] ?? null;
      return nextNightStep({ ...s, wolfTarget: target }, 'wolves', now, rnd);
    }
    case 'witch': return nextNightStep(s, 'witch', now, rnd);
    case 'dawn': return afterDeaths(s, 'night', now, rnd);
    case 'hunter': {
      const h = s.hunterQueue[0];
      const targets = aliveOf(s).filter((id) => id !== h);
      if (!h || !targets.length) return afterDeaths({ ...s, hunterQueue: s.hunterQueue.slice(1) }, s.hunterFrom, now, rnd);
      return actHunter(s, h, targets[Math.floor(rnd() * targets.length)], now, rnd) || s;
    }
    case 'day': return { ...s, step: 'vote', votes: {}, voteOutcome: null, until: now + s.opts.voteS * 1000 };
    case 'vote': {
      const out = tallyVotes(s.votes);
      let next: WW = { ...s, step: 'voteResult', voteOutcome: out, deaths: [], hunterQueue: [], hunterFrom: 'vote', until: now + STEP_S.voteResult * 1000 };
      if (out.target) {
        next = kill(next, out.target, 'vote');
        next = say(next, 'Le village a désigné un coupable.');
      } else next = say(next, 'Égalité ou aucun vote : personne n’est éliminé.');
      return next;
    }
    case 'voteResult': return afterDeaths(s, 'vote', now, rnd);
    default: return s;
  }
};
