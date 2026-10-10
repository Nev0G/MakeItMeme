'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, RotateCcw, Settings, Shuffle, Eye, Skull } from 'lucide-react';
import { makeId, shuffle, PlayerDot, playSfx, useSoundAndClickFx, fireConfetti, RoomOptions, KickButton, toast, useRefState } from '@/lib/shared';
import { useGameRoom, GameHome, GameShell, RoomCodeBlock, RulesDialog, WaitingForHost } from '@/lib/gameroom';
import { pickWords } from '@/lib/codenames-words';
import { GameArt } from '@/lib/art';

const GAME_ID = 'codenames';

const DEFAULT_SETTINGS = { visibility: 'private', roomName: '', chatEnabled: true };
const INITIAL_CN = {
  phase: 'lobby', // 'lobby' | 'play' | 'over'
  gameId: null,
  words: [], // 25 mots
  key: '', // carte secrète (encodée) : R, B, N (neutre) ou A (assassin) pour chaque mot
  rev: [], // 1 si le mot est révélé
  start: 'red', // équipe qui commence (9 mots)
  turn: 'red',
  step: 'clue', // 'clue' : le maître-espion donne un indice — 'guess' : l'équipe devine
  clue: null, // { word, num }
  left: 0, // essais restants
  guessed: 0, // mots révélés ce tour-ci
  teams: {}, // id -> 'red' | 'blue'
  spies: { red: null, blue: null },
  marks: {}, // idx -> [ids] : mots proposés par les coéquipiers
  log: [], // { team, clue, num, results: [{ w, c }] }
  winner: null,
  reason: null,
  wins: { red: 0, blue: 0 },
};

const TEAM = {
  red: { label: 'Rouges', emoji: '🔴', letter: 'R', card: 'bg-[#b5382e] text-white border-[#7d231c]', tint: 'border-red-500 bg-red-900/30', text: 'text-red-300', bar: 'bg-[#b5382e]' },
  blue: { label: 'Bleus', emoji: '🔵', letter: 'B', card: 'bg-[#2c6fa8] text-white border-[#1c4a74]', tint: 'border-sky-500 bg-sky-900/30', text: 'text-sky-300', bar: 'bg-[#2c6fa8]' },
};
const other = (t: string) => (t === 'red' ? 'blue' : 'red');
const letterOf = (t: string) => TEAM[t].letter;
const enc = (s: string) => btoa(s);
const dec = (s: string) => {
  try {
    return atob(s);
  } catch {
    return '';
  }
};
const normW = (w: string) => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const RULES_STEPS = [
  { title: 'Deux équipes, deux maîtres-espions', text: 'Rouges et Bleus ont chacun un maître-espion qui connaît la carte secrète : quels mots sont à son équipe, lesquels sont neutres, et lequel est l’assassin.' },
  { title: 'Un indice, un nombre', text: 'Le maître-espion donne UN mot d’indice et un nombre (combien de mots de l’équipe ce mot évoque). Il n’a pas le droit de dire un mot du plateau.' },
  { title: 'Les agents devinent', text: 'Les autres joueurs de l’équipe cliquent sur les mots qu’ils pensent liés à l’indice (clic pour proposer, second clic pour valider). Ils ont droit à « nombre + 1 » essais.' },
  { title: 'Bonne ou mauvaise carte', text: 'Un mot de ton équipe : tu continues. Un mot neutre ou de l’autre équipe : ton tour s’arrête. L’assassin : tu perds immédiatement !' },
  { title: 'Gagner', text: 'La première équipe qui a trouvé tous ses mots gagne. L’équipe qui commence en a 9, l’autre 8.' },
];

export default function Codenames() {
  const [cn, setCn, cnRef] = useRefState(INITIAL_CN);
  const [clueWord, setClueWord] = useState('');
  const [clueNum, setClueNum] = useState(1);
  const [clueError, setClueError] = useState('');
  const [showRules, setShowRules] = useState(false);
  const cbRef = useRef<any>({});
  const absentRef = useRef(0);
  const { soundOn, toggleSound } = useSoundAndClickFx();

  const g = useGameRoom({
    channelName: 'codenames', gameId: GAME_ID, sessionKey: 'codenames-session', defaultSettings: DEFAULT_SETTINGS,
    started: cn.phase === 'play', cbRef,
  });
  const { player, room, players, isHost, isHostRef, broadcast, now, nameOf, avatarOf, presentIds } = g;

  const commitCn = (patch: any) => {
    const next = { ...cnRef.current, ...patch };
    setCn(next);
    broadcast('cn', { cn: next });
  };

  // ==========================================
  // LOGIQUE DE JEU (le host fait foi)
  // ==========================================
  const membersOf = (team: string, b = cnRef.current) => players.filter((p) => b.teams[p.id] === team).map((p) => p.id);

  const handleTeam = (id: string, team: any) => {
    const b = cnRef.current;
    if (b.phase !== 'lobby' || !presentIds().has(id)) return;
    const t = team === 'red' || team === 'blue' ? team : null;
    const teams = { ...b.teams };
    if (t) teams[id] = t;
    else delete teams[id];
    const spies = { ...b.spies };
    (['red', 'blue'] as const).forEach((k) => {
      if (spies[k] === id && t !== k) spies[k] = null;
    });
    commitCn({ teams, spies });
  };
  const handleSpy = (id: string) => {
    const b = cnRef.current;
    const team = b.teams[id];
    if (b.phase !== 'lobby' || !team) return;
    commitCn({ spies: { ...b.spies, [team]: b.spies[team] === id ? null : id } });
  };
  const autoTeams = () => {
    if (!isHost) return;
    const b = cnRef.current;
    const ids = shuffle(players.map((p) => p.id));
    const teams: any = {};
    ids.forEach((id, i) => {
      teams[id] = i % 2 === 0 ? 'red' : 'blue';
    });
    const spies: any = { red: ids.find((id) => teams[id] === 'red') || null, blue: ids.find((id) => teams[id] === 'blue') || null };
    commitCn({ teams, spies, phase: b.phase });
  };

  const startGame = () => {
    if (!isHost) return;
    const b = cnRef.current;
    const present = presentIds();
    const teams: any = {};
    Object.entries(b.teams).forEach(([id, t]) => present.has(id) && (teams[id] = t));
    const spies: any = { ...b.spies };
    (['red', 'blue'] as const).forEach((t) => {
      const mem = Object.keys(teams).filter((id) => teams[id] === t);
      if (mem.length < 2) return;
      if (!spies[t] || !mem.includes(spies[t])) spies[t] = mem[0];
    });
    const count = (t: string) => Object.keys(teams).filter((id) => teams[id] === t).length;
    if (count('red') < 2 || count('blue') < 2) {
      toast('Il faut au moins 2 joueurs par équipe (un maître-espion + un agent).');
      return;
    }
    const first = b.gameId ? other(b.start) : Math.random() < 0.5 ? 'red' : 'blue';
    const letters = shuffle([
      ...Array(9).fill(letterOf(first)),
      ...Array(8).fill(letterOf(other(first))),
      ...Array(7).fill('N'),
      'A',
    ]);
    g.broadcast('roster', { known: g.knownRef.current });
    absentRef.current = 0;
    commitCn({
      ...INITIAL_CN,
      phase: 'play',
      gameId: makeId('g'),
      words: pickWords(25),
      key: enc(letters.join('')),
      rev: Array(25).fill(0),
      start: first,
      turn: first,
      step: 'clue',
      teams,
      spies,
      wins: b.wins,
    });
  };
  const backToLobby = () => commitCn({ ...cnRef.current, phase: 'lobby', winner: null, reason: null, clue: null, marks: {}, log: [], words: [], key: '', rev: [] });

  const endTurn = (b: any, extra: any = {}) =>
    commitCn({ ...extra, turn: other(b.turn), step: 'clue', clue: null, left: 0, guessed: 0, marks: {} });
  const endGame = (winner: string, reason: string, extra: any = {}) =>
    commitCn({ ...extra, phase: 'over', winner, reason, wins: { ...cnRef.current.wins, [winner]: (cnRef.current.wins[winner] || 0) + 1 }, marks: {} });

  const handleClue = (id: string, rawWord: any, rawNum: any) => {
    const b = cnRef.current;
    if (b.phase !== 'play' || b.step !== 'clue' || id !== b.spies[b.turn]) return;
    const word = String(rawWord || '').trim().replace(/\s+/g, ' ');
    const num = Math.max(0, Math.min(9, parseInt(rawNum, 10) || 0));
    if (!/^[\p{L}'’-]{2,24}$/u.test(word)) return;
    const n = normW(word);
    const clash = b.words.some((w, i) => !b.rev[i] && (normW(w) === n || (n.length >= 3 && (normW(w).includes(n) || n.includes(normW(w))) && normW(w).length >= 3)));
    if (clash) return;
    commitCn({
      step: 'guess',
      clue: { word: word.toUpperCase(), num },
      left: num === 0 ? 99 : num + 1,
      guessed: 0,
      marks: {},
      log: [...b.log, { team: b.turn, clue: word.toUpperCase(), num, results: [] }],
    });
  };
  const handleMark = (id: string, idx: number) => {
    const b = cnRef.current;
    if (b.phase !== 'play' || b.step !== 'guess' || b.teams[id] !== b.turn || id === b.spies[b.turn] || !(idx >= 0 && idx < 25) || b.rev[idx]) return;
    const marks: any = {};
    Object.entries(b.marks).forEach(([k, ids]: any) => {
      const rest = ids.filter((x) => x !== id);
      if (rest.length) marks[k] = rest;
    });
    const had = (b.marks[idx] || []).includes(id);
    if (!had) marks[idx] = [...(marks[idx] || []), id];
    commitCn({ marks });
  };
  const handleGuess = (id: string, idx: number) => {
    const b = cnRef.current;
    if (b.phase !== 'play' || b.step !== 'guess' || b.teams[id] !== b.turn || id === b.spies[b.turn] || !(idx >= 0 && idx < 25) || b.rev[idx]) return;
    const letters = dec(b.key);
    const c = letters[idx];
    const rev = [...b.rev];
    rev[idx] = 1;
    const log = b.log.map((e, i) => (i === b.log.length - 1 ? { ...e, results: [...e.results, { w: b.words[idx], c }] } : e));
    const base = { rev, log, guessed: b.guessed + 1 };
    const own = letterOf(b.turn);
    const opp = letterOf(other(b.turn));
    const remaining = (letter: string) => letters.split('').filter((l, i) => l === letter && !rev[i]).length;
    if (c === 'A') return endGame(other(b.turn), 'assassin', base);
    if (c === own) {
      if (remaining(own) === 0) return endGame(b.turn, 'words', base);
      const left = b.left - 1;
      if (left <= 0) return endTurn(b, base);
      return commitCn({ ...base, left, marks: {} });
    }
    if (c === opp && remaining(opp) === 0) return endGame(other(b.turn), 'words', base);
    return endTurn(b, base);
  };
  const handlePass = (id: string) => {
    const b = cnRef.current;
    if (b.phase !== 'play' || b.step !== 'guess' || b.teams[id] !== b.turn || id === b.spies[b.turn] || b.guessed < 1) return;
    endTurn(b);
  };

  // Maître-espion parti : un autre joueur de l'équipe prend le relais
  useEffect(() => {
    if (!isHostRef.current) return;
    const b = cnRef.current;
    if (b.phase !== 'play') return;
    const present = presentIds();
    const t = Date.now();
    const spy = b.spies[b.turn];
    if (g.playersRef.current.length > 0 && spy && !present.has(spy)) {
      absentRef.current = absentRef.current || t;
      if (t - absentRef.current > 5000) {
        absentRef.current = 0;
        const next = Object.keys(b.teams).find((id) => b.teams[id] === b.turn && present.has(id) && id !== spy);
        if (next) {
          toast('Le maître-espion est parti : un coéquipier prend le relais.');
          commitCn({ spies: { ...b.spies, [b.turn]: next } });
        } else endGame(other(b.turn), 'forfeit');
      }
    } else absentRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // ==========================================
  // CANAL : événements du jeu
  // ==========================================
  cbRef.current = {
    attach: (ch: any) => {
      ch.on('broadcast', { event: 'cn' }, ({ payload }: any) => setCn(payload.cn));
      ch.on('broadcast', { event: 'cn_team' }, ({ payload }: any) => isHostRef.current && handleTeam(payload?.id, payload?.team));
      ch.on('broadcast', { event: 'cn_spy' }, ({ payload }: any) => isHostRef.current && handleSpy(payload?.id));
      ch.on('broadcast', { event: 'cn_clue' }, ({ payload }: any) => isHostRef.current && handleClue(payload?.id, payload?.word, payload?.num));
      ch.on('broadcast', { event: 'cn_mark' }, ({ payload }: any) => isHostRef.current && handleMark(payload?.id, payload?.idx));
      ch.on('broadcast', { event: 'cn_guess' }, ({ payload }: any) => isHostRef.current && handleGuess(payload?.id, payload?.idx));
      ch.on('broadcast', { event: 'cn_pass' }, ({ payload }: any) => isHostRef.current && handlePass(payload?.id));
    },
    hostSync: (ch: any) => ch.send({ type: 'broadcast', event: 'cn', payload: { cn: cnRef.current } }),
    reset: () => {
      setCn(INITIAL_CN);
      setClueWord('');
      setClueError('');
      absentRef.current = 0;
    },
  };

  // ==========================================
  // ACTIONS DU JOUEUR
  // ==========================================
  const send = (event: string, host: () => void, payload: any) => (isHost ? host() : broadcast(event, { id: player.id, ...payload }));
  const phase = room ? cn.phase : 'home';
  const myTeam = cn.teams[player.id] || null;
  const iAmSpy = cn.phase !== 'lobby' && (cn.spies.red === player.id || cn.spies.blue === player.id);
  const myTurnSpy = cn.phase === 'play' && cn.step === 'clue' && cn.spies[cn.turn] === player.id;
  const iAmOperative = cn.phase === 'play' && cn.step === 'guess' && myTeam === cn.turn && !iAmSpy;
  const letters = cn.key ? dec(cn.key) : '';
  const showKey = iAmSpy || cn.phase === 'over';
  const myMark = Object.entries(cn.marks).find(([, ids]: any) => ids.includes(player.id))?.[0];
  const remainingOf = (team: string) => letters ? letters.split('').filter((l, i) => l === letterOf(team) && !cn.rev[i]).length : 0;

  const setTeam = (team: string | null) => send('cn_team', () => handleTeam(player.id, team), { team });
  const toggleSpy = () => send('cn_spy', () => handleSpy(player.id), {});
  const giveClue = (e: any) => {
    e.preventDefault();
    const word = clueWord.trim();
    if (!/^[\p{L}'’-]{2,24}$/u.test(word)) return setClueError('Un seul mot, sans espace ni chiffre.');
    const n = normW(word);
    const clash = cn.words.some((w, i) => !cn.rev[i] && (normW(w) === n || (n.length >= 3 && (normW(w).includes(n) || n.includes(normW(w))) && normW(w).length >= 3)));
    if (clash) return setClueError('Cet indice ressemble trop à un mot du plateau.');
    setClueError('');
    setClueWord('');
    send('cn_clue', () => handleClue(player.id, word, clueNum), { word, num: clueNum });
    playSfx('send');
  };
  const clickCard = (idx: number) => {
    if (!iAmOperative || cn.rev[idx]) return;
    if (myMark === String(idx)) {
      send('cn_guess', () => handleGuess(player.id, idx), { idx });
    } else {
      send('cn_mark', () => handleMark(player.id, idx), { idx });
      playSfx('click');
    }
  };
  const pass = () => send('cn_pass', () => handlePass(player.id), {});

  // Sons
  const prev = useRef({ rev: 0, phase: 'lobby' });
  useEffect(() => {
    const count = cn.rev.reduce((a, b) => a + b, 0);
    if (count > prev.current.rev && cn.phase === 'play') {
      const last = cn.log[cn.log.length - 1]?.results.slice(-1)[0];
      playSfx(last && last.c === letterOf(last ? cn.turn : 'red') ? 'success' : 'error');
    }
    if (cn.phase === 'over' && prev.current.phase !== 'over') {
      playSfx(cn.reason === 'assassin' ? 'buzzer' : 'fanfare');
      if (cn.reason !== 'assassin') fireConfetti();
    }
    prev.current = { rev: count, phase: cn.phase };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cn.rev, cn.phase]);

  // ==========================================
  // BRIQUES D'AFFICHAGE
  // ==========================================
  const sidebar = (
    <>
      {(['red', 'blue', null] as const).map((team) => {
        const list = players.filter((p) => (cn.teams[p.id] || null) === team);
        if (!list.length && team === null) return null;
        return (
          <div key={String(team)} className="mb-2">
            <p className={`text-[10px] uppercase tracking-wide font-bold mb-1 ${team ? TEAM[team].text : 'text-gray-500'}`}>{team ? `${TEAM[team].emoji} ${TEAM[team].label}` : '⚪ Spectateurs'}</p>
            {list.map((p) => (
              <div key={p.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${p.id === player.id ? 'bg-black/25 border border-purple-400/30' : ''}`}>
                <PlayerDot id={p.id} avatar={p.avatar} size="md" />
                <span className="font-bold truncate flex-1">{p.name}</span>
                {isHost && p.id !== player.id && <KickButton onClick={() => g.extras.kick(p.id)} />}
                {team && cn.spies[team] === p.id && <span title="Maître-espion">🕵️</span>}
                {p.id === g.hostId && <span className="text-[9px] font-bold text-purple-300 bg-purple-900/50 px-1.5 py-0.5 rounded shrink-0">HOST</span>}
              </div>
            ))}
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
        <GameHome g={g} gameId={GAME_ID} eyebrow="Mots & espionnage" title="CODENAMES" tagline="Deux équipes, deux maîtres-espions : trouve tes mots, évite l’assassin." soundOn={soundOn} toggleSound={toggleSound} onRules={() => setShowRules(true)} />
        {showRules && <RulesDialog steps={RULES_STEPS} onClose={() => setShowRules(false)} />}
      </>
    );
  }

  const shell = (main: React.ReactNode) => (
    <GameShell g={g} gameId={GAME_ID} soundOn={soundOn} toggleSound={toggleSound} sidebar={sidebar} sidebarTitle="Joueurs">
      {main}
      {showRules && <RulesDialog steps={RULES_STEPS} onClose={() => setShowRules(false)} />}
    </GameShell>
  );

  if (phase === 'lobby') {
    const count = (t: string) => players.filter((p) => cn.teams[p.id] === t).length;
    const ready = count('red') >= 2 && count('blue') >= 2;
    return shell(
      <div className="paper p-6 sm:p-8 w-full max-w-4xl mx-auto text-center md:overflow-y-auto">
        <GameArt id="codenames" className="h-28 mx-auto -mt-2 mb-2" />
        <RoomCodeBlock g={g} />
        {(cn.wins.red > 0 || cn.wins.blue > 0) && (
          <p className="mb-4 font-heading text-lg">🔴 {cn.wins.red} — {cn.wins.blue} 🔵</p>
        )}
        <div className="grid sm:grid-cols-2 gap-4 text-left mb-5">
          {(['red', 'blue'] as const).map((team) => {
            const mem = players.filter((p) => cn.teams[p.id] === team);
            return (
              <div key={team} className={`rounded-xl border-2 p-4 ${TEAM[team].tint}`}>
                <p className={`font-heading text-xl mb-2 ${TEAM[team].text}`}>{TEAM[team].emoji} Équipe {TEAM[team].label.toLowerCase()} <span className="text-sm text-gray-400">({mem.length})</span></p>
                <div className="space-y-1 min-h-[3.5rem] mb-3">
                  {mem.length === 0 && <p className="text-xs text-gray-500">Personne pour l’instant…</p>}
                  {mem.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-sm">
                      <PlayerDot id={p.id} avatar={p.avatar} /> <span className="font-bold truncate">{p.name}</span>
                      {cn.spies[team] === p.id && <span className="text-xs bg-black/30 rounded-full px-2 py-0.5">🕵️ maître-espion</span>}
                    </div>
                  ))}
                </div>
                {myTeam === team ? (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={toggleSpy} className="text-xs font-bold rounded-full border border-gray-600 px-3 py-1.5 hover:bg-black/30 transition">{cn.spies[team] === player.id ? 'Ne plus être maître-espion' : '🕵️ Devenir maître-espion'}</button>
                    <button onClick={() => setTeam(null)} className="text-xs font-bold rounded-full border border-gray-700 px-3 py-1.5 text-gray-400 hover:bg-black/30 transition">Quitter l’équipe</button>
                  </div>
                ) : (
                  <button onClick={() => setTeam(team)} className="text-sm font-bold rounded-full bg-purple-300 hover:bg-purple-200 !text-gray-950 px-4 py-1.5 active:scale-95 transition">Rejoindre les {TEAM[team].label.toLowerCase()}</button>
                )}
              </div>
            );
          })}
        </div>
        <div className="text-left mb-5 bg-gray-950/70 border border-gray-800 rounded-xl p-4">
          <h3 className="flex items-center gap-2 text-gray-400 font-bold mb-3 uppercase text-sm"><Settings size={16} /> Paramètres du salon</h3>
          <RoomOptions settings={g.settings} updateSettings={g.updateSettings} isHost={isHost} />
        </div>
        {isHost ? (
          <div className="space-y-3">
            <button onClick={autoTeams} disabled={players.length < 4} className="inline-flex items-center gap-2 text-sm font-bold text-gray-300 hover:text-white disabled:opacity-40 transition"><Shuffle size={15} /> Répartir les équipes au hasard</button>
            <button onClick={startGame} disabled={!ready} className="w-full bg-purple-300 hover:bg-purple-200 !text-gray-950 shadow-md disabled:opacity-50 active:scale-95 font-black py-4 px-6 rounded-lg text-lg transition">
              {ready ? 'Lancer la partie !' : 'Il faut 2 joueurs minimum par équipe…'}
            </button>
          </div>
        ) : (
          <WaitingForHost />
        )}
        <button onClick={() => setShowRules(true)} className="mt-4 text-gray-400 hover:text-purple-300 text-sm font-bold transition">Comment jouer ?</button>
      </div>
    );
  }

  // ----- Plateau (partie en cours ou terminée) -----
  const turnTeam = cn.turn;
  const board = (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
      {cn.words.map((w, i) => {
        const c = letters[i];
        const revealed = !!cn.rev[i];
        const team = c === 'R' ? 'red' : c === 'B' ? 'blue' : null;
        let cls = 'bg-gray-900 border-gray-700 text-white hover:border-purple-300';
        if (revealed) {
          cls = c === 'A' ? 'bg-black text-white border-gray-600' : team ? TEAM[team].card : 'bg-[#cdbb9b] text-[#2b1c12] border-[#a38d6a]';
        } else if (showKey) {
          cls = c === 'A' ? 'bg-black/80 border-white/70 text-white' : team ? `${TEAM[team].tint} text-white` : 'bg-gray-700/25 border-gray-500/60 text-gray-300';
        }
        const markers = (cn.marks[i] || []) as string[];
        const marked = myMark === String(i);
        return (
          <button
            key={i}
            data-sfx="off"
            disabled={!iAmOperative || revealed}
            onClick={() => clickCard(i)}
            title={iAmOperative && !revealed ? (marked ? 'Clique à nouveau pour valider' : 'Proposer ce mot') : undefined}
            className={`relative min-h-[3.6rem] sm:min-h-[4.6rem] rounded-lg border-2 px-1 py-2 text-center font-bold uppercase text-[11px] sm:text-sm leading-tight break-words transition active:scale-[0.97] disabled:cursor-default ${cls} ${marked ? 'ring-4 ring-purple-300 -translate-y-0.5' : ''} ${revealed ? 'opacity-95' : ''}`}
          >
            <span className="[overflow-wrap:anywhere]">{w}</span>
            {revealed && c === 'A' && <Skull size={16} className="absolute top-1 right-1 text-white/80" />}
            {!revealed && showKey && c === 'A' && <span className="absolute top-0.5 right-1 text-xs">💀</span>}
            {markers.length > 0 && !revealed && (
              <span className="absolute -top-2 left-1 flex -space-x-1">
                {markers.slice(0, 4).map((id) => (<span key={id} className="inline-block"><PlayerDot id={id} avatar={avatarOf(id)} /></span>))}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  const log = (
    <div className="paper p-3 text-sm max-h-72 overflow-y-auto">
      <p className="eyebrow mb-2">Historique</p>
      {cn.log.length === 0 && <p className="text-xs text-gray-500">Aucun indice pour l’instant.</p>}
      <ul className="space-y-2">
        {[...cn.log].reverse().map((e, i) => (
          <li key={i} className="rounded-lg bg-black/20 px-2.5 py-1.5">
            <p className={`font-bold ${TEAM[e.team].text}`}>{TEAM[e.team].emoji} {e.clue} · {e.num === 0 ? '∞' : e.num}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {e.results.map((r, k) => (
                <span key={k} className={`text-[11px] font-bold rounded px-1.5 py-0.5 ${r.c === 'R' ? 'bg-[#b5382e]' : r.c === 'B' ? 'bg-[#2c6fa8]' : r.c === 'A' ? 'bg-black border border-white/40' : 'bg-[#cdbb9b] text-[#2b1c12]'}`}>{r.w}</span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );

  if (phase === 'play') {
    const spyName = cn.spies[turnTeam] ? nameOf(cn.spies[turnTeam]) : '?';
    return shell(
      <div className="flex-1 min-h-0 md:overflow-y-auto w-full max-w-5xl mx-auto">
        <div className={`rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between gap-3 flex-wrap ${TEAM[turnTeam].bar} text-white`}>
          <span className="font-heading text-lg">{TEAM[turnTeam].emoji} Tour des {TEAM[turnTeam].label.toLowerCase()}</span>
          <span className="text-sm font-bold">🔴 {remainingOf('red') || (iAmSpy ? 0 : '?')} · 🔵 {remainingOf('blue') || (iAmSpy ? 0 : '?')} <span className="font-normal opacity-80">mots restants</span></span>
        </div>
        <div className="paper px-4 py-3 mb-3">
          {cn.step === 'clue' ? (
            myTurnSpy ? (
              <form onSubmit={giveClue} className="space-y-2">
                <p className="eyebrow">🕵️ Tu es le maître-espion : donne ton indice</p>
                <div className="flex gap-2 flex-wrap">
                  <input autoFocus value={clueWord} onChange={(e) => setClueWord(e.target.value)} maxLength={24} placeholder="Un seul mot…" autoComplete="off" className="flex-1 min-w-[10rem] p-3 bg-gray-950 border-2 border-gray-700 rounded-xl font-bold uppercase focus:outline-none" />
                  <select value={clueNum} onChange={(e) => setClueNum(Number(e.target.value))} aria-label="Nombre de mots" className="bg-gray-800 border border-gray-700 rounded-xl px-3 font-bold">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (<option key={n} value={n}>{n}</option>))}
                    <option value={0}>∞</option>
                  </select>
                  <button type="submit" disabled={!clueWord.trim()} data-sfx="off" className="bg-purple-300 hover:bg-purple-200 !text-gray-950 disabled:opacity-40 px-5 rounded-xl font-bold flex items-center gap-2 active:scale-95 transition"><Send size={16} /> Donner</button>
                </div>
                {clueError && <p className="text-sm text-red-400 font-bold">{clueError}</p>}
              </form>
            ) : (
              <p className="text-center font-bold">🕵️ {spyName} cherche son indice… <span className="text-gray-400 font-normal">({iAmSpy ? 'pas à toi de jouer' : myTeam === turnTeam ? 'ton équipe attend' : 'équipe adverse'})</span></p>
            )
          ) : (
            <div className="text-center">
              <p className="text-gray-400 text-xs uppercase tracking-wide font-bold">Indice de {spyName}</p>
              <p className="font-heading text-3xl sm:text-4xl">{cn.clue?.word} <span className={TEAM[turnTeam].text}>· {cn.clue?.num === 0 ? '∞' : cn.clue?.num}</span></p>
              <p className="text-sm text-gray-400 mt-1">{cn.left >= 99 ? 'Essais illimités' : `${cn.left} essai${cn.left > 1 ? 's' : ''} restant${cn.left > 1 ? 's' : ''}`}</p>
              {iAmOperative && (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                  <span className="text-xs text-gray-400">Clique sur un mot pour le proposer, puis re-clique pour valider.</span>
                  <button onClick={pass} disabled={cn.guessed < 1} className="text-sm font-bold rounded-full border border-gray-600 px-4 py-1.5 hover:bg-black/30 disabled:opacity-40 transition active:scale-95">Terminer le tour</button>
                </div>
              )}
              {isHost && !iAmOperative && (
                <button onClick={() => endTurn(cnRef.current)} className="mt-2 text-xs text-gray-500 hover:text-white font-bold transition">Forcer la fin du tour</button>
              )}
            </div>
          )}
        </div>
        <div className="grid lg:grid-cols-[1fr_16rem] gap-3">
          <div>
            {board}
            {iAmSpy && <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5"><Eye size={13} /> Tu vois la carte secrète : ne la montre à personne !</p>}
          </div>
          {log}
        </div>
      </div>
    );
  }

  // phase === 'over'
  const winner = cn.winner;
  return shell(
    <div className="flex-1 min-h-0 md:overflow-y-auto w-full max-w-5xl mx-auto animate-fadein">
      <div className={`rounded-xl px-5 py-4 mb-3 text-center text-white ${winner ? TEAM[winner].bar : 'bg-gray-700'}`}>
        <p className="font-heading text-3xl">{winner ? `${TEAM[winner].emoji} Victoire des ${TEAM[winner].label.toLowerCase()} !` : 'Partie terminée'}</p>
        <p className="text-sm opacity-90 mt-1">
          {cn.reason === 'assassin' ? `L’équipe ${TEAM[other(winner)].label.toLowerCase()} est tombée sur l’assassin 💀` : cn.reason === 'forfeit' ? 'L’équipe adverse a abandonné.' : 'Tous les mots ont été trouvés.'}
        </p>
        <p className="mt-1 font-bold">🔴 {cn.wins.red} — {cn.wins.blue} 🔵</p>
      </div>
      <div className="grid lg:grid-cols-[1fr_16rem] gap-3">
        <div>{board}</div>
        {log}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        {isHost ? (
          <>
            <button onClick={startGame} className="flex items-center gap-2 bg-purple-300 hover:bg-purple-200 !text-gray-950 active:scale-95 font-bold py-3 px-6 rounded-full transition"><RotateCcw size={16} /> Rejouer (mêmes équipes)</button>
            <button onClick={backToLobby} className="text-sm text-gray-400 hover:text-white font-bold transition px-2">Changer les équipes</button>
          </>
        ) : (
          <WaitingForHost />
        )}
      </div>
    </div>
  );
}
