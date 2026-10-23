'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Settings, Crown, Eye, EyeOff, Send, Search, ShieldQuestion } from 'lucide-react';
import { makeId, PlayerDot, playSfx, useSoundAndClickFx, fireConfetti, RoomOptions, KickButton, toast, useRefState } from '@/lib/shared';
import { useGameRoom, GameHome, GameShell, RoomCodeBlock, RulesDialog, WaitingForHost } from '@/lib/gameroom';
import { LOCATIONS, deal, encodeSecret, decodeSecret, tally, accusationPassed, accusationRejected, shuffled } from '@/lib/spyfall';
import { ChoiceRow, VariantsPanel } from '@/lib/variants';
import { GameArt } from '@/lib/art';

const GAME_ID = 'spyfall';

const DEFAULT_SETTINGS = { visibility: 'private', roomName: '', chatEnabled: true, minutes: 8, spies: 1 };
const FINAL_VOTE_MS = 60000;
const INITIAL_SF: any = {
  phase: 'lobby', // 'lobby' | 'play' | 'over'
  gameId: null,
  order: [] as string[],
  out: [] as string[],
  secret: '', // lieu, rôles et espions (encodé)
  opts: { minutes: 8, spies: 1 },
  endsAt: 0, // fin de la manche (timestamp)
  turn: null as any, // { asker, target, q, stage: 'pick' | 'answer' }
  lastAsker: null as any,
  log: [] as any[], // { from, to, q, a }
  accuse: null as any, // { by, suspect, votes: { id: bool } }
  notice: '' as string, // dernier événement (accusation refusée...)
  finalVote: null as any, // { votes: { id: suspect }, until }
  result: null as any, // { winner: 'players' | 'spies' | 'none', reason, suspect?, by? }
  wins: { players: 0, spies: 0 },
};

const RULES_STEPS = [
  { title: 'Un lieu secret', text: 'Tous les joueurs connaissent le lieu (et ont un rôle lié à ce lieu), sauf l’espion qui doit le deviner. Avec 7 joueurs ou plus, il peut y avoir 2 espions.' },
  { title: 'Questions à tour de rôle', text: 'Le joueur dont c’est le tour choisit quelqu’un et lui pose une question sur le lieu (« Est-ce qu’on y mange ? »). La personne répond, puis c’est à son tour de questionner. Impossible de renvoyer la question à celui qui vient de t’interroger.' },
  { title: 'Reste discret', text: 'Réponds avec assez de précision pour prouver que tu connais le lieu, sans en dire trop : l’espion écoute et cherche à deviner.' },
  { title: 'Accuser', text: 'À tout moment, tu peux accuser un joueur. Tous les autres votent : si c’est unanime et que c’est l’espion, vous gagnez. Si vous vous trompez, l’espion gagne.' },
  { title: 'L’espion devine', text: 'L’espion peut tenter de nommer le lieu quand il veut : s’il a raison il gagne, sinon il perd tout de suite.' },
  { title: 'Fin du temps', text: 'Quand le chrono arrive à zéro, tout le monde vote pour désigner l’espion. S’il n’est pas démasqué, il gagne.' },
];

const REASONS: Record<string, string> = {
  caught: 'L’espion a été démasqué par un vote unanime !',
  wrong: 'Un innocent a été accusé : l’espion s’en tire.',
  guess: 'L’espion a deviné le lieu !',
  badguess: 'L’espion s’est trompé de lieu.',
  time: 'Le temps est écoulé : vote final.',
  timeCaught: 'Au vote final, l’espion a été démasqué.',
  timeMissed: 'Au vote final, l’espion n’a pas été démasqué.',
  left: 'Un joueur a quitté la partie.',
  few: 'Il ne reste plus assez de joueurs.',
};

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function Spyfall() {
  const [sf, setSf, sfRef] = useRefState(INITIAL_SF);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [target, setTarget] = useState<string | null>(null);
  const [showCard, setShowCard] = useState(true);
  const [struck, setStruck] = useState<Set<number>>(new Set());
  const [guessing, setGuessing] = useState(false);
  const [accusing, setAccusing] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const cbRef = useRef<any>({});
  const absentRef = useRef<Record<string, number>>({});
  const { soundOn, toggleSound } = useSoundAndClickFx();

  const g = useGameRoom({
    channelName: 'spyfall', gameId: GAME_ID, sessionKey: 'spyfall-session', defaultSettings: DEFAULT_SETTINGS,
    started: sf.phase === 'play', cbRef,
  });
  const { room, players, isHost, isHostRef, broadcast, now, nameOf, avatarOf, presentIds } = g;
  const player: { id: string; name: string; avatar: string } = g.player as any;

  const commitSf = (patch: any) => {
    const next = { ...sfRef.current, ...patch };
    setSf(next);
    broadcast('sf', { sf: next });
  };

  // ==========================================
  // LOGIQUE DE JEU (le host fait foi)
  // ==========================================
  const activeOf = (b: any) => b.order.filter((id: string) => !b.out.includes(id));
  const nextActive = (b: any, from: string) => {
    const act = activeOf(b);
    const i = act.indexOf(from);
    return act[(i + 1) % act.length] || act[0];
  };
  const endGame = (winner: 'players' | 'spies' | 'none', reason: string, extra: any = {}) => {
    const wins = { ...sfRef.current.wins };
    if (winner !== 'none') wins[winner] = (wins[winner] || 0) + 1;
    commitSf({ phase: 'over', result: { winner, reason, ...extra }, wins, turn: null, accuse: null, finalVote: null });
  };

  const startGame = () => {
    if (!isHost) return;
    const ids = players.map((p) => p.id).slice(0, 12);
    if (ids.length < 3) {
      toast('Il faut au moins 3 joueurs.');
      return;
    }
    const st = g.settingsRef.current;
    const opts = { minutes: [5, 8, 10, 15].includes(Number(st.minutes)) ? Number(st.minutes) : 8, spies: ids.length >= 7 && Number(st.spies) === 2 ? 2 : 1 };
    const order = shuffled(ids);
    g.broadcast('roster', { known: g.knownRef.current });
    commitSf({
      ...INITIAL_SF, phase: 'play', gameId: makeId('g'), order, opts, wins: sfRef.current.wins,
      secret: encodeSecret(deal(order, opts.spies)), endsAt: Date.now() + opts.minutes * 60000,
      turn: { asker: order[0], target: null, q: '', stage: 'pick' },
    });
  };
  const backToLobby = () => commitSf({ ...INITIAL_SF, wins: sfRef.current.wins });

  const clean = (t: any) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const handleAsk = (id: string, to: string, q: any) => {
    const b = sfRef.current;
    const question = clean(q);
    if (b.phase !== 'play' || b.accuse || b.finalVote || !b.turn || b.turn.stage !== 'pick' || b.turn.asker !== id) return;
    if (!question || !activeOf(b).includes(to) || to === id || to === b.lastAsker) return;
    commitSf({ turn: { asker: id, target: to, q: question, stage: 'answer' }, notice: '' });
  };
  const handleAnswer = (id: string, a: any) => {
    const b = sfRef.current;
    const text = clean(a);
    if (b.phase !== 'play' || !b.turn || b.turn.stage !== 'answer' || b.turn.target !== id || !text) return;
    commitSf({
      log: [...b.log, { from: b.turn.asker, to: id, q: b.turn.q, a: text }].slice(-60),
      lastAsker: b.turn.asker,
      turn: { asker: id, target: null, q: '', stage: 'pick' },
    });
  };

  const resolveAccusation = (b: any, acc: any) => {
    const secret = decodeSecret(b.secret);
    if (!secret) return;
    if (secret.spies.includes(acc.suspect)) endGame('players', 'caught', { suspect: acc.suspect, by: acc.by });
    else endGame('spies', 'wrong', { suspect: acc.suspect, by: acc.by });
  };
  const handleAccuse = (id: string, suspect: string) => {
    const b = sfRef.current;
    const act = activeOf(b);
    if (b.phase !== 'play' || b.accuse || b.finalVote || !act.includes(id) || !act.includes(suspect) || suspect === id) return;
    const acc = { by: id, suspect, votes: { [id]: true } };
    const voters = act.filter((x: string) => x !== suspect);
    if (accusationPassed(acc.votes, voters)) return resolveAccusation(b, acc);
    commitSf({ accuse: acc, notice: '' });
  };
  const handleVote = (id: string, yes: boolean) => {
    const b = sfRef.current;
    if (b.phase !== 'play' || !b.accuse) return;
    const voters = activeOf(b).filter((x: string) => x !== b.accuse.suspect);
    if (!voters.includes(id) || id in b.accuse.votes) return;
    const acc = { ...b.accuse, votes: { ...b.accuse.votes, [id]: !!yes } };
    if (accusationRejected(acc.votes)) {
      return commitSf({ accuse: null, notice: `Accusation contre ${nameOf(acc.suspect)} refusée : le vote n’est pas unanime.` });
    }
    if (accusationPassed(acc.votes, voters)) return resolveAccusation(b, acc);
    commitSf({ accuse: acc });
  };

  const startFinalVote = () => {
    const b = sfRef.current;
    if (b.phase !== 'play' || b.finalVote) return;
    commitSf({ accuse: null, finalVote: { votes: {}, until: Date.now() + FINAL_VOTE_MS }, notice: 'Temps écoulé : vote final !' });
  };
  const closeFinalVote = (b: any, votes: Record<string, string>) => {
    const secret = decodeSecret(b.secret);
    if (!secret) return;
    const { suspect } = tally(votes);
    if (suspect && secret.spies.includes(suspect)) endGame('players', 'timeCaught', { suspect });
    else endGame('spies', 'timeMissed', { suspect });
  };
  const handleFinalVote = (id: string, suspect: string) => {
    const b = sfRef.current;
    const act = activeOf(b);
    if (b.phase !== 'play' || !b.finalVote || !act.includes(id) || !act.includes(suspect) || suspect === id || id in b.finalVote.votes) return;
    const votes = { ...b.finalVote.votes, [id]: suspect };
    if (act.every((x: string) => x in votes)) return closeFinalVote(b, votes);
    commitSf({ finalVote: { ...b.finalVote, votes } });
  };
  const handleGuess = (id: string, loc: number) => {
    const b = sfRef.current;
    const secret = decodeSecret(b.secret);
    if (b.phase !== 'play' || !secret || !secret.spies.includes(id) || b.out.includes(id) || !(loc >= 0 && loc < LOCATIONS.length)) return;
    if (loc === secret.loc) endGame('spies', 'guess', { by: id, guess: loc });
    else endGame('players', 'badguess', { by: id, guess: loc });
  };
  const forfeit = (id: string) => {
    const b = sfRef.current;
    if (b.phase !== 'play' || b.out.includes(id) || !b.order.includes(id)) return;
    const secret = decodeSecret(b.secret);
    const out = [...b.out, id];
    const next = { ...b, out };
    const act = activeOf(next);
    if (secret?.spies.includes(id)) return endGame('players', 'left', { suspect: id });
    if (act.length < 3) return endGame('none', 'few');
    // Si ce joueur devait poser une question / répondre : le tour revient au suivant
    let turn = b.turn;
    if (turn && (turn.asker === id || turn.target === id)) turn = { asker: nextActive(next, turn.asker === id ? id : turn.asker), target: null, q: '', stage: 'pick' };
    let accuse = b.accuse;
    if (accuse && (accuse.suspect === id || accuse.by === id)) accuse = null;
    commitSf({ out, turn, accuse, lastAsker: b.lastAsker === id ? null : b.lastAsker });
  };

  // Minuteries (host) : fin de manche, fin du vote final, joueurs partis
  useEffect(() => {
    if (!isHostRef.current) return;
    const b = sfRef.current;
    if (b.phase !== 'play') return;
    const t = Date.now();
    if (b.finalVote) {
      if (t > b.finalVote.until) {
        const votes = b.finalVote.votes;
        if (Object.keys(votes).length === 0) return endGame('spies', 'timeMissed', { suspect: null });
        return closeFinalVote(b, votes);
      }
    } else if (t > b.endsAt) {
      return startFinalVote();
    }
    if (g.playersRef.current.length > 0) {
      const present = presentIds();
      for (const id of activeOf(b)) {
        if (present.has(id)) delete absentRef.current[id];
        else {
          absentRef.current[id] = absentRef.current[id] || t;
          if (t - absentRef.current[id] > 8000) {
            delete absentRef.current[id];
            toast(`${nameOf(id)} a quitté la partie.`);
            return forfeit(id);
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // ==========================================
  // CANAL : événements du jeu
  // ==========================================
  cbRef.current = {
    attach: (ch: any) => {
      ch.on('broadcast', { event: 'sf' }, ({ payload }: any) => setSf(payload.sf));
      ch.on('broadcast', { event: 'sf_ask' }, ({ payload }: any) => isHostRef.current && handleAsk(payload?.id, payload?.to, payload?.q));
      ch.on('broadcast', { event: 'sf_answer' }, ({ payload }: any) => isHostRef.current && handleAnswer(payload?.id, payload?.a));
      ch.on('broadcast', { event: 'sf_accuse' }, ({ payload }: any) => isHostRef.current && handleAccuse(payload?.id, payload?.suspect));
      ch.on('broadcast', { event: 'sf_vote' }, ({ payload }: any) => isHostRef.current && handleVote(payload?.id, !!payload?.yes));
      ch.on('broadcast', { event: 'sf_fvote' }, ({ payload }: any) => isHostRef.current && handleFinalVote(payload?.id, payload?.suspect));
      ch.on('broadcast', { event: 'sf_guess' }, ({ payload }: any) => isHostRef.current && handleGuess(payload?.id, Number(payload?.loc)));
      ch.on('broadcast', { event: 'sf_quit' }, ({ payload }: any) => isHostRef.current && forfeit(payload?.id));
    },
    hostSync: (ch: any) => ch.send({ type: 'broadcast', event: 'sf', payload: { sf: sfRef.current } }),
    reset: () => {
      setSf(INITIAL_SF);
      setQuestion('');
      setAnswer('');
      setTarget(null);
      setStruck(new Set());
      setGuessing(false);
      setAccusing(null);
      absentRef.current = {};
    },
  };

  // ==========================================
  // ACTIONS DU JOUEUR
  // ==========================================
  const send = (event: string, host: () => void, payload: any) => (isHost ? host() : broadcast(event, { id: player.id, ...payload }));
  const phase = room ? sf.phase : 'home';
  const secret = sf.secret ? decodeSecret(sf.secret) : null;
  const inGame = sf.order.includes(player.id) && !sf.out.includes(player.id);
  const amSpy = !!secret && secret.spies.includes(player.id);
  const turn = sf.turn;
  const active = sf.order.filter((id: string) => !sf.out.includes(id));

  const doAsk = (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!target || !q) return;
    send('sf_ask', () => handleAsk(player.id, target, q), { to: target, q });
    setQuestion('');
    setTarget(null);
    playSfx('send');
  };
  const doAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    const a = answer.trim();
    if (!a) return;
    send('sf_answer', () => handleAnswer(player.id, a), { a });
    setAnswer('');
    playSfx('send');
  };
  const leaveGame = () => {
    if (sf.phase === 'play' && inGame) send('sf_quit', () => forfeit(player.id), {});
    g.leaveRoom();
  };

  // Sons
  const prev = useRef({ log: 0, phase: 'lobby', turn: '' as any, notice: '', final: false });
  useEffect(() => {
    if (sf.phase === 'play') {
      if (sf.log.length > prev.current.log) playSfx('click');
      const key = `${turn?.asker}:${turn?.stage}`;
      if (turn && (turn.stage === 'pick' ? turn.asker === player.id : turn.target === player.id) && prev.current.turn !== key) playSfx('whoosh');
      prev.current.turn = key;
      if (sf.finalVote && !prev.current.final) playSfx('buzzer');
      if (sf.notice && sf.notice !== prev.current.notice) playSfx('error');
    }
    if (sf.phase === 'over' && prev.current.phase !== 'over') {
      const won = sf.result?.winner === (amSpy ? 'spies' : 'players');
      if (won) {
        playSfx('fanfare');
        fireConfetti();
      } else playSfx('error');
    }
    prev.current = { ...prev.current, log: sf.log.length, phase: sf.phase, notice: sf.notice, final: !!sf.finalVote };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sf]);

  // ==========================================
  // BRIQUES D'AFFICHAGE
  // ==========================================
  const sidebar = (
    <>
      {players.map((p) => {
        const inPlay = sf.phase !== 'lobby' && sf.order.includes(p.id);
        const out = inPlay && sf.out.includes(p.id);
        const hot = sf.phase === 'play' && turn && (turn.stage === 'pick' ? turn.asker === p.id : turn.target === p.id);
        return (
          <div key={p.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${p.id === player.id ? 'bg-black/25 border border-purple-400/30' : ''} ${hot ? 'ring-2 ring-yellow-400/70' : ''} ${out ? 'opacity-40' : ''}`}>
            <PlayerDot id={p.id} avatar={p.avatar} size="md" />
            <span className="font-bold truncate flex-1">{p.name}</span>
            {isHost && p.id !== player.id && <KickButton onClick={() => g.extras.kick(p.id)} />}
            {p.id === g.hostId && <span className="text-[9px] font-bold text-purple-300 bg-purple-900/50 px-1.5 py-0.5 rounded shrink-0">HOST</span>}
          </div>
        );
      })}
    </>
  );

  // ==========================================
  // ÉCRANS
  // ==========================================
  if (phase === 'home') {
    return (
      <>
        <GameHome g={g} gameId={GAME_ID} eyebrow="Espionnage & déduction" title="SPYFALL" tagline="Un espion est parmi vous. Il ignore où vous êtes : à vous de le piéger." soundOn={soundOn} toggleSound={toggleSound} onRules={() => setShowRules(true)} />
        {showRules && <RulesDialog steps={RULES_STEPS} onClose={() => setShowRules(false)} />}
      </>
    );
  }

  const shell = (main: React.ReactNode) => (
    <GameShell g={{ ...g, leaveRoom: leaveGame }} gameId={GAME_ID} soundOn={soundOn} toggleSound={toggleSound} sidebar={sidebar} sidebarTitle="Joueurs">
      {main}
      {showRules && <RulesDialog steps={RULES_STEPS} onClose={() => setShowRules(false)} />}
    </GameShell>
  );

  if (phase === 'lobby') {
    const ready = players.length >= 3;
    const many = players.length >= 7;
    return shell(
      <div className="paper p-6 sm:p-8 w-full max-w-2xl mx-auto text-center md:overflow-y-auto">
        <GameArt id="spyfall" className="h-28 mx-auto -mt-2 mb-2 float-y" />
        <RoomCodeBlock g={g} />
        {(sf.wins.players > 0 || sf.wins.spies > 0) && (
          <p className="mb-4 text-sm text-gray-300">🕵️ Espions {sf.wins.spies} — {sf.wins.players} Enquêteurs 🔎</p>
        )}
        <p className="text-gray-400 text-sm mb-5">
          {ready ? `${Math.min(players.length, 12)} joueurs vont enquêter${players.length > 12 ? ' (les autres regardent)' : ''}.` : 'Il faut au moins 3 joueurs.'}
        </p>
        <div className="text-left mb-5 bg-gray-950/70 border border-gray-800 rounded-xl p-4">
          <h3 className="flex items-center gap-2 text-gray-400 font-bold mb-3 uppercase text-sm"><Settings size={16} /> Paramètres du salon</h3>
          <RoomOptions settings={g.settings} updateSettings={g.updateSettings} isHost={isHost} />
        </div>
        <VariantsPanel isHost={isHost}>
          <ChoiceRow label="Durée de la manche" hint="À la fin du temps, tout le monde vote pour désigner l’espion." value={g.settings.minutes ?? 8} options={[{ value: 5, label: '5 min' }, { value: 8, label: '8 min' }, { value: 10, label: '10 min' }, { value: 15, label: '15 min' }]} onChange={(v) => g.updateSettings({ minutes: Number(v) })} disabled={!isHost} />
          <ChoiceRow label="Nombre d’espions" hint={many ? 'À 2 espions, démasquer l’un d’eux suffit, mais il suffit aussi que l’un trouve le lieu.' : 'Deux espions possibles à partir de 7 joueurs.'} value={many ? (g.settings.spies ?? 1) : 1} options={[{ value: 1, label: '1' }, { value: 2, label: '2' }]} onChange={(v) => g.updateSettings({ spies: Number(v) })} disabled={!isHost || !many} />
        </VariantsPanel>
        {isHost ? (
          <button onClick={startGame} disabled={!ready} className="w-full bg-purple-300 hover:bg-purple-200 !text-gray-950 shadow-md disabled:opacity-50 active:scale-95 font-black py-4 px-6 rounded-lg text-lg transition">
            {ready ? 'Lancer la partie !' : 'Il faut 3 joueurs minimum…'}
          </button>
        ) : (
          <WaitingForHost />
        )}
        <button onClick={() => setShowRules(true)} className="mt-4 text-gray-400 hover:text-purple-300 text-sm font-bold transition">Comment jouer ?</button>
      </div>
    );
  }

  if (!secret) return shell(<WaitingForHost />);

  const loc = LOCATIONS[secret.loc];
  const timeLeft = sf.finalVote ? sf.finalVote.until - now : sf.endsAt - now;

  // ----- Fin de partie -----
  if (phase === 'over') {
    const r = sf.result || {};
    const playersWon = r.winner === 'players';
    return shell(
      <div className="flex-1 min-h-0 md:overflow-y-auto w-full max-w-3xl mx-auto animate-fadein flex flex-col gap-4">
        <div className={`rounded-xl px-5 py-4 text-center text-white ${r.winner === 'none' ? 'bg-gray-700' : playersWon ? 'bg-emerald-600' : 'bg-red-600'}`}>
          <p className="font-heading text-3xl flex items-center justify-center gap-2"><Crown /> {r.winner === 'none' ? 'Partie annulée' : playersWon ? 'Les enquêteurs gagnent !' : 'Les espions gagnent !'}</p>
          <p className="text-sm mt-1 opacity-90">{REASONS[r.reason] || ''}{r.by && r.reason !== 'caught' && r.reason !== 'wrong' ? ` (${nameOf(r.by)})` : ''}</p>
        </div>
        <div className="paper p-5">
          <p className="eyebrow mb-1">Le lieu était</p>
          <p className="font-heading text-3xl">{loc.emoji} {loc.name}</p>
          {r.guess !== undefined && r.guess !== secret.loc && <p className="text-sm text-gray-400 mt-1">L’espion pensait : {LOCATIONS[r.guess].emoji} {LOCATIONS[r.guess].name}</p>}
          <p className="eyebrow mt-4 mb-2">Les rôles</p>
          <ul className="grid sm:grid-cols-2 gap-1.5">
            {sf.order.map((id: string) => {
              const spy = secret.spies.includes(id);
              return (
                <li key={id} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${spy ? 'bg-red-600/20 border border-red-500/50' : 'bg-gray-950/50 border border-gray-800'}`}>
                  <PlayerDot id={id} avatar={avatarOf(id)} />
                  <span className="font-bold truncate flex-1">{nameOf(id)}</span>
                  <span className={spy ? 'text-red-300 font-bold' : 'text-gray-400'}>{spy ? '🕵️ Espion' : secret.roles[id]}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {isHost ? (
            <>
              <button onClick={startGame} className="flex items-center gap-2 bg-purple-300 hover:bg-purple-200 !text-gray-950 active:scale-95 font-bold py-3 px-6 rounded-full transition"><RotateCcw size={16} /> Rejouer</button>
              <button onClick={backToLobby} className="text-sm text-gray-400 hover:text-white font-bold transition px-2">Retour au salon</button>
            </>
          ) : (
            <WaitingForHost />
          )}
        </div>
      </div>
    );
  }

  // ----- Partie en cours -----
  const myTurnToAsk = inGame && turn?.stage === 'pick' && turn.asker === player.id && !sf.accuse && !sf.finalVote;
  const myTurnToAnswer = inGame && turn?.stage === 'answer' && turn.target === player.id;
  const voters = sf.accuse ? active.filter((id: string) => id !== sf.accuse.suspect) : [];
  const iMustVote = !!sf.accuse && voters.includes(player.id) && !(player.id in sf.accuse.votes);

  const card = (
    <div className={`rounded-2xl p-4 border-2 ${amSpy ? 'bg-red-950/50 border-red-500' : 'bg-emerald-950/40 border-emerald-500/70'}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="eyebrow">Ta carte secrète</p>
        <button type="button" onClick={() => setShowCard((v) => !v)} className="inline-flex items-center gap-1 text-xs font-bold text-gray-300 hover:text-white cursor-pointer" aria-pressed={!showCard}>
          {showCard ? <><EyeOff size={14} /> Masquer</> : <><Eye size={14} /> Afficher</>}
        </button>
      </div>
      {!inGame ? (
        <p className="text-sm text-gray-400">Tu regardes la partie 👀</p>
      ) : showCard ? (
        amSpy ? (
          <>
            <p className="font-heading text-2xl text-red-300">🕵️ Tu es l’espion</p>
            <p className="text-sm text-gray-300 mt-1">Trouve le lieu grâce aux réponses des autres, sans te faire repérer.</p>
            <button type="button" onClick={() => setGuessing(true)} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 text-sm active:scale-95 transition cursor-pointer"><Search size={15} /> Je sais où on est !</button>
          </>
        ) : (
          <>
            <p className="font-heading text-2xl">{loc.emoji} {loc.name}</p>
            <p className="text-sm text-gray-300 mt-1">Ton rôle : <b>{secret.roles[player.id]}</b></p>
          </>
        )
      ) : (
        <p className="font-heading text-xl text-gray-500">••••••••</p>
      )}
    </div>
  );

  const qa = (
    <div className="paper p-4 sm:p-5">
      <p className="eyebrow mb-3">Interrogatoire</p>
      {sf.notice && <p className="mb-3 rounded-lg bg-yellow-500/10 border border-yellow-500/40 px-3 py-2 text-sm text-yellow-200" role="status">{sf.notice}</p>}
      {sf.finalVote ? (
        <p className="text-sm text-gray-300">Le temps est écoulé : place au vote final !</p>
      ) : turn?.stage === 'pick' ? (
        myTurnToAsk ? (
          <form onSubmit={doAsk} className="space-y-3">
            <p className="text-sm font-bold">👉 À toi de poser une question. À qui ?</p>
            <div className="flex flex-wrap gap-2">
              {active.filter((id: string) => id !== player.id).map((id: string) => {
                const blocked = id === sf.lastAsker;
                return (
                  <button key={id} type="button" disabled={blocked} onClick={() => setTarget(id)} title={blocked ? 'Il vient de t’interroger' : ''}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${target === id ? 'bg-purple-300 text-gray-950 border-purple-300' : 'border-gray-700 hover:border-gray-500'} ${blocked ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}>
                    <PlayerDot id={id} avatar={avatarOf(id)} /> {nameOf(id)}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input value={question} maxLength={200} onChange={(e) => setQuestion(e.target.value)} placeholder="Ta question (ex. « Y fait-on la queue ? »)" aria-label="Ta question" className="flex-1 min-w-0 bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm" />
              <button type="submit" disabled={!target || !question.trim()} aria-label="Poser la question" className="tag-dark shrink-0 px-4 flex items-center justify-center disabled:opacity-40 active:scale-95 cursor-pointer"><Send size={16} /></button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-gray-300">🤔 <b>{nameOf(turn?.asker)}</b> prépare sa question…</p>
        )
      ) : (
        <div className="space-y-3">
          <p className="text-sm"><b>{nameOf(turn?.asker)}</b> demande à <b>{nameOf(turn?.target)}</b> :</p>
          <p className="rounded-xl bg-gray-950/70 border border-gray-800 px-4 py-3 text-base font-semibold">« {turn?.q} »</p>
          {myTurnToAnswer ? (
            <form onSubmit={doAnswer} className="flex gap-2">
              <input autoFocus value={answer} maxLength={200} onChange={(e) => setAnswer(e.target.value)} placeholder={amSpy ? 'Réponds sans te trahir…' : 'Réponds sans trop en dire…'} aria-label="Ta réponse" className="flex-1 min-w-0 bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm" />
              <button type="submit" disabled={!answer.trim()} aria-label="Envoyer la réponse" className="tag-dark shrink-0 px-4 flex items-center justify-center disabled:opacity-40 active:scale-95 cursor-pointer"><Send size={16} /></button>
            </form>
          ) : (
            <p className="text-sm text-gray-400">✍️ {nameOf(turn?.target)} répond…</p>
          )}
        </div>
      )}
      {sf.log.length > 0 && (
        <ul className="mt-4 space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {[...sf.log].reverse().map((e: any, i: number) => (
            <li key={sf.log.length - i} className="text-sm rounded-lg bg-black/20 px-3 py-2">
              <p className="text-gray-400"><b className="text-gray-200">{nameOf(e.from)}</b> → <b className="text-gray-200">{nameOf(e.to)}</b> : {e.q}</p>
              <p className="mt-0.5">↳ {e.a}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const suspects = (
    <div className="paper p-4 sm:p-5">
      <p className="eyebrow mb-3">Accuser quelqu’un</p>
      {sf.accuse ? (
        <div className="space-y-3" role="alert">
          <p className="text-sm"><b>{nameOf(sf.accuse.by)}</b> accuse <b>{nameOf(sf.accuse.suspect)}</b> d’être l’espion !</p>
          <p className="text-xs text-gray-400">Pour qu’il soit condamné, tous les autres joueurs doivent voter « oui ».</p>
          <div className="flex flex-wrap gap-1.5">
            {voters.map((id: string) => (
              <span key={id} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${id in sf.accuse.votes ? (sf.accuse.votes[id] ? 'border-emerald-500 text-emerald-300' : 'border-red-500 text-red-300') : 'border-gray-700 text-gray-500'}`}>
                {nameOf(id)} {id in sf.accuse.votes ? (sf.accuse.votes[id] ? '✔' : '✘') : '…'}
              </span>
            ))}
          </div>
          {iMustVote && (
            <div className="flex gap-2">
              <button onClick={() => send('sf_vote', () => handleVote(player.id, true), { yes: true })} className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 active:scale-95 transition cursor-pointer">Oui, c’est lui</button>
              <button onClick={() => send('sf_vote', () => handleVote(player.id, false), { yes: false })} className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 active:scale-95 transition cursor-pointer">Non</button>
            </div>
          )}
          {sf.accuse.suspect === player.id && <p className="text-sm text-yellow-200">C’est toi qu’on accuse… garde ton calme !</p>}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {active.filter((id: string) => id !== player.id).map((id: string) => (
            <button key={id} disabled={!inGame || !!sf.finalVote} onClick={() => setAccusing(id)}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-700 px-3 py-1.5 text-sm font-semibold hover:border-red-400 hover:text-red-300 disabled:opacity-40 active:scale-95 transition cursor-pointer">
              <ShieldQuestion size={14} aria-hidden="true" /> {nameOf(id)}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const places = (
    <div className="paper p-4 sm:p-5">
      <p className="eyebrow mb-1">Les lieux possibles</p>
      <p className="text-xs text-gray-500 mb-3">Clique pour barrer ceux que tu élimines (visible seulement par toi).</p>
      <div className="flex flex-wrap gap-1.5">
        {LOCATIONS.map((l, i) => (
          <button key={l.name} type="button" aria-pressed={struck.has(i)} onClick={() => setStruck((cur) => { const n = new Set(cur); n.has(i) ? n.delete(i) : n.add(i); return n; })}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${struck.has(i) ? 'border-gray-800 text-gray-600 line-through' : 'border-gray-700 text-gray-300 hover:border-gray-500'}`}>
            {l.emoji} {l.name}
          </button>
        ))}
      </div>
    </div>
  );

  const final = sf.finalVote && (
    <div className="fixed inset-0 z-[950] bg-black/80 flex items-center justify-center p-4">
      <div className="paper w-full max-w-md p-6 animate-rise">
        <p className="font-heading text-2xl text-center">Vote final</p>
        <p className="text-sm text-gray-400 text-center mb-4">Qui est l’espion ? ({fmt(sf.finalVote.until - now)})</p>
        {inGame && !(player.id in sf.finalVote.votes) ? (
          <div className="flex flex-col gap-2">
            {active.filter((id: string) => id !== player.id).map((id: string) => (
              <button key={id} onClick={() => send('sf_fvote', () => handleFinalVote(player.id, id), { suspect: id })} className="flex items-center gap-2 rounded-xl border border-gray-700 px-3 py-2.5 hover:bg-white/10 active:scale-95 transition cursor-pointer">
                <PlayerDot id={id} avatar={avatarOf(id)} /> <span className="font-bold flex-1 text-left truncate">{nameOf(id)}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-gray-300">{inGame ? 'Vote enregistré.' : 'Tu regardes le vote.'} En attente des autres… ({Object.keys(sf.finalVote.votes).length}/{active.length})</p>
        )}
      </div>
    </div>
  );

  return shell(
    <div className="flex-1 min-h-0 md:overflow-y-auto w-full max-w-4xl mx-auto flex flex-col gap-4">
      <div className={`rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap font-bold ${sf.finalVote || timeLeft < 30000 ? 'bg-red-600 text-white' : 'bg-purple-300 text-gray-950'}`}>
        <span className="font-heading text-lg">{sf.finalVote ? '🗳️ Vote final' : '⏱️ Temps restant'}</span>
        <span className="font-heading text-2xl tabular-nums" role="timer" aria-label={`${fmt(timeLeft)} restantes`}>{fmt(timeLeft)}</span>
      </div>
      {card}
      {qa}
      {suspects}
      {places}

      {accusing && (
        <div className="fixed inset-0 z-[950] bg-black/70 flex items-center justify-center p-4" onClick={() => setAccusing(null)}>
          <div onClick={(e) => e.stopPropagation()} className="paper p-6 text-center animate-rise max-w-sm">
            <p className="font-heading text-xl mb-2">Accuser {nameOf(accusing)} ?</p>
            <p className="text-sm text-gray-400 mb-4">Tous les autres joueurs voteront. Si vous vous trompez, l’espion gagne.</p>
            <div className="flex gap-2">
              <button onClick={() => { const s = accusing; setAccusing(null); send('sf_accuse', () => handleAccuse(player.id, s), { suspect: s }); }} className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 active:scale-95 transition cursor-pointer">Accuser</button>
              <button onClick={() => setAccusing(null)} className="flex-1 rounded-xl border border-gray-600 font-bold py-2.5 hover:bg-white/10 active:scale-95 transition cursor-pointer">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {guessing && (
        <div className="fixed inset-0 z-[950] bg-black/75 flex items-center justify-center p-4" onClick={() => setGuessing(false)}>
          <div onClick={(e) => e.stopPropagation()} className="paper p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto animate-rise">
            <p className="font-heading text-xl text-center">Où sommes-nous ?</p>
            <p className="text-sm text-red-300 text-center mb-4">Une seule tentative : si tu te trompes, tu perds !</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {LOCATIONS.map((l, i) => (
                <button key={l.name} onClick={() => { setGuessing(false); send('sf_guess', () => handleGuess(player.id, i), { loc: i }); }} className="rounded-xl border border-gray-700 px-2 py-2 text-sm font-semibold hover:bg-white/10 hover:border-red-400 active:scale-95 transition cursor-pointer">{l.emoji} {l.name}</button>
              ))}
            </div>
          </div>
        </div>
      )}
      {final}
    </div>
  );
}
