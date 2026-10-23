'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Settings, Crown, Check, Undo2, SkipForward, Repeat } from 'lucide-react';
import { makeId, PlayerDot, playSfx, useSoundAndClickFx, fireConfetti, RoomOptions, KickButton, ToggleRow, toast, useRefState } from '@/lib/shared';
import { useGameRoom, GameHome, GameShell, RoomCodeBlock, RulesDialog, WaitingForHost } from '@/lib/gameroom';
import { SIZE, POINTS, buildBag, shuffled, emptyBoard, classicBonus, randomBonus, evaluateMove, rackAllows, loadDictionary, type Tile } from '@/lib/scrabble';
import { ChoiceRow, VariantsPanel, TimerRow, TurnClock, nextDeadline, timerOf } from '@/lib/variants';
import { GameArt } from '@/lib/art';

const GAME_ID = 'scrabble';

const DEFAULT_SETTINGS = { visibility: 'private', roomName: '', chatEnabled: true, dictionary: true, rack: 7, goal: 0, randomBonus: false, timer: 0 };
const INITIAL_S: any = {
  phase: 'lobby', // 'lobby' | 'play' | 'over'
  gameId: null,
  order: [] as string[],
  board: [] as string[], // 225 cases
  racks: {} as Record<string, string[]>,
  bag: [] as string[],
  scores: {} as Record<string, number>,
  turn: null as any,
  passes: 0, // tours « passés » consécutifs
  out: [] as string[],
  last: null as any, // { id, kind: 'play' | 'pass' | 'swap', words, total, bingo }
  winners: [] as string[],
  reason: null as any,
  wins: {} as Record<string, number>,
  opts: { rack: 7, goal: 0, randomBonus: false, timer: 0 } as any, // variantes de la partie en cours
  bonus: [] as string[], // cases bonus de la partie (vide = classiques)
  deadline: null as any, // fin du tour (si chronomètre)
};

const BONUS_STYLE: Record<string, { cls: string; label: string }> = {
  W3: { cls: 'bg-red-600/80 text-white', label: 'MT' },
  W2: { cls: 'bg-pink-400/70 text-gray-950', label: 'MD' },
  L3: { cls: 'bg-blue-600/80 text-white', label: 'LT' },
  L2: { cls: 'bg-sky-300/70 text-gray-950', label: 'LD' },
};

const RULES_STEPS = [
  { title: 'Pose tes lettres', text: 'Tu as 7 lettres (réglable). Clique une lettre de ton chevalet, puis une case du plateau. Le premier mot doit passer par la case centrale ★.' },
  { title: 'Forme de vrais mots', text: 'Tes lettres doivent être sur une même ligne ou colonne, former un mot et toucher une lettre déjà posée. Tous les mots formés doivent exister dans le dictionnaire.' },
  { title: 'Cases bonus', text: 'MD / MT : le mot compte double / triple. LD / LT : la lettre compte double / triple. Les bonus ne servent qu’une fois, quand la lettre est posée.' },
  { title: 'Jokers', text: 'Un joker (?) remplace n’importe quelle lettre mais vaut 0 point. Poser les 7 lettres d’un coup rapporte 50 points de bonus.' },
  { title: 'Passer ou échanger', text: 'Pas d’inspiration ? Passe ton tour, ou échange des lettres avec le sac (s’il reste au moins 7 lettres).' },
  { title: 'Variantes', text: 'Le host peut fixer un objectif de points pour finir plus vite, mélanger les cases bonus, changer la taille du chevalet (5, 7 ou 9) et limiter le temps par tour.' },
  { title: 'Fin de partie', text: 'La partie s’arrête quand le sac est vide et qu’un joueur n’a plus de lettres (ou après 2 tours de passes). Les lettres restantes sont retirées du score.' },
];

const Tile_ = ({ ch, blank = false, small = false, selected = false, onClick, staged = false }: { ch: string; blank?: boolean; small?: boolean; selected?: boolean; onClick?: () => void; staged?: boolean }) => {
  const cls = `relative flex items-center justify-center rounded-md font-heading font-black text-gray-900 ${staged ? 'bg-amber-200 ring-2 ring-purple-300' : 'bg-amber-100'} border border-amber-700/60 shadow ${small ? 'w-full h-full text-[11px] sm:text-base' : 'w-10 h-10 sm:w-12 sm:h-12 text-xl sm:text-2xl'} ${selected ? '-translate-y-2 ring-2 ring-purple-300' : ''} ${blank ? 'italic text-gray-500' : ''}`;
  const pts = blank ? 0 : POINTS[ch.toUpperCase()] ?? 0;
  const inner = (
    <>
      {ch === '?' ? '' : ch.toUpperCase()}
      {ch === '?' && <span className="text-gray-400">★</span>}
      {!(ch === '?') && !blank && <span className={`absolute bottom-0 right-0.5 font-sans font-bold leading-none ${small ? 'text-[6px] sm:text-[8px]' : 'text-[9px] sm:text-[10px]'}`}>{pts}</span>}
    </>
  );
  return onClick ? (
    <button type="button" data-sfx="off" onClick={onClick} className={`${cls} cursor-pointer transition-transform`}>{inner}</button>
  ) : (
    <div className={cls}>{inner}</div>
  );
};

export default function Scrabble() {
  const [s, setS, sRef] = useRefState(INITIAL_S);
  const [staged, setStaged] = useState<Record<number, { rackIdx: number; ch: string; blank: boolean }>>({});
  const [selected, setSelected] = useState<number | null>(null); // lettre du chevalet sélectionnée
  const [blankFor, setBlankFor] = useState<{ rackIdx: number; cell: number } | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [swapSel, setSwapSel] = useState<number[]>([]);
  const [dict, setDict] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const cbRef = useRef<any>({});
  const absentRef = useRef(0);
  const { soundOn, toggleSound } = useSoundAndClickFx();

  const g = useGameRoom({
    channelName: 'scrabble', gameId: GAME_ID, sessionKey: 'scrabble-session', defaultSettings: DEFAULT_SETTINGS,
    started: s.phase === 'play', cbRef,
  });
  const { room, players, isHost, isHostRef, broadcast, now, nameOf, avatarOf, presentIds } = g;
  const player: { id: string; name: string; avatar: string } = g.player as any;

  useEffect(() => {
    loadDictionary().then(setDict);
  }, []);

  const commitS = (patch: any) => {
    const next = { ...sRef.current, ...patch };
    // Chaque action relance le chronomètre
    next.deadline = next.phase === 'play' && next.turn ? nextDeadline(next.opts?.timer) : null;
    setS(next);
    broadcast('sc', { s: next });
  };

  // ==========================================
  // LOGIQUE DE JEU (le host fait foi)
  // ==========================================
  const activeIds = (b: any) => b.order.filter((id: string) => !b.out.includes(id));
  const nextTurn = (b: any, from: string) => {
    const n = b.order.length;
    let i = b.order.indexOf(from);
    for (let k = 0; k < n; k++) {
      i = (i + 1) % n;
      if (!b.out.includes(b.order[i])) return b.order[i];
    }
    return from;
  };
  const refill = (rack: string[], bag: string[]) => {
    const take = Math.max(0, Math.min((sRef.current.opts?.rack || 7) - rack.length, bag.length));
    return { rack: [...rack, ...bag.slice(0, take)], bag: bag.slice(take) };
  };
  const rackValue = (rack: string[]) => rack.reduce((n, l) => n + (POINTS[l] ?? 0), 0);
  const finish = (b: any, reason: string, outId: string | null, extra: any = {}) => {
    const scores = { ...(extra.scores || b.scores) };
    const racks = extra.racks || b.racks;
    let bonus = 0;
    activeIds(b).forEach((id: string) => {
      const left = rackValue(racks[id] || []);
      scores[id] -= left;
      bonus += left;
    });
    if (outId) scores[outId] += bonus;
    const best = Math.max(...activeIds(b).map((id: string) => scores[id]));
    const winners = activeIds(b).filter((id: string) => scores[id] === best);
    const wins = { ...b.wins };
    winners.forEach((id: string) => (wins[id] = (wins[id] || 0) + 1));
    commitS({ ...extra, scores, phase: 'over', winners, reason, turn: null, wins });
  };

  const rejectTo = (id: string, msg: string) => {
    if (id === player.id) toast(msg);
    else broadcast('sc_reject', { id, msg });
    setBusy(false);
  };

  const startGame = () => {
    if (!isHost) return;
    const ids = players.map((p) => p.id).slice(0, 4);
    if (ids.length < 2) {
      toast('Il faut au moins 2 joueurs.');
      return;
    }
    const st = g.settingsRef.current;
    const opts = { rack: [5, 7, 9].includes(Number(st.rack)) ? Number(st.rack) : 7, goal: Number(st.goal) || 0, randomBonus: !!st.randomBonus, timer: timerOf(st) };
    let bag = shuffled(buildBag());
    const racks: Record<string, string[]> = {};
    const scores: Record<string, number> = {};
    const order = shuffled(ids);
    order.forEach((id) => {
      racks[id] = bag.slice(0, opts.rack);
      bag = bag.slice(opts.rack);
      scores[id] = 0;
    });
    g.broadcast('roster', { known: g.knownRef.current });
    absentRef.current = 0;
    commitS({ ...INITIAL_S, phase: 'play', gameId: makeId('g'), order, board: emptyBoard(), racks, bag, scores, turn: order[0], wins: sRef.current.wins, opts, bonus: opts.randomBonus ? randomBonus() : [] });
  };
  const backToLobby = () => commitS({ ...INITIAL_S, wins: sRef.current.wins });

  const handleMove = async (id: string, tiles: Tile[]) => {
    const b = sRef.current;
    if (b.phase !== 'play' || b.turn !== id || !Array.isArray(tiles)) return;
    const clean: Tile[] = tiles.map((t) => ({ r: Number(t.r), c: Number(t.c), ch: String(t.ch).toUpperCase().slice(0, 1), blank: !!t.blank }));
    if (!rackAllows(b.racks[id], clean)) return rejectTo(id, 'Ces lettres ne sont pas dans ton chevalet.');
    const res = evaluateMove(b.board, clean, { bonus: b.bonus, rack: b.opts.rack });
    if (!res.ok) return rejectTo(id, res.error);
    if (sRef.current.phase === 'play' && g.settingsRef.current.dictionary !== false) {
      const d = await loadDictionary();
      if (d) {
        const bad = res.words.filter((w) => !d.has(w.text));
        if (bad.length) return rejectTo(id, `Mot refusé : ${bad.map((w) => w.text).join(', ')}`);
      }
    }
    const cur = sRef.current;
    if (cur.phase !== 'play' || cur.turn !== id || cur.gameId !== b.gameId) return setBusy(false);
    const board = [...cur.board];
    clean.forEach((t) => (board[t.r * SIZE + t.c] = t.blank ? t.ch.toLowerCase() : t.ch));
    const used = [...cur.racks[id]];
    clean.forEach((t) => used.splice(used.indexOf(t.blank ? '?' : t.ch), 1));
    const { rack, bag } = refill(used, cur.bag);
    const racks = { ...cur.racks, [id]: rack };
    const scores = { ...cur.scores, [id]: cur.scores[id] + res.total };
    const last = { id, kind: 'play', words: res.words, total: res.total, bingo: res.bingo };
    const next = { ...cur, board, racks, bag, scores };
    setBusy(false);
    // Objectif de points atteint : fin immédiate, sans retrait des lettres restantes
    if (cur.opts.goal > 0 && scores[id] >= cur.opts.goal) {
      const best = Math.max(...activeIds(cur).map((pid: string) => scores[pid]));
      const winners = activeIds(cur).filter((pid: string) => scores[pid] === best);
      const wins = { ...cur.wins };
      winners.forEach((pid: string) => (wins[pid] = (wins[pid] || 0) + 1));
      return commitS({ board, racks, bag, scores, last, passes: 0, phase: 'over', winners, reason: 'goal', turn: null, wins });
    }
    if (!rack.length && !bag.length) return finish(next, 'out', id, { board, racks, bag, scores, last, passes: 0 });
    commitS({ board, racks, bag, scores, last, passes: 0, turn: nextTurn(cur, id) });
  };
  const handlePass = (id: string) => {
    const b = sRef.current;
    if (b.phase !== 'play' || b.turn !== id) return;
    const passes = b.passes + 1;
    const last = { id, kind: 'pass', words: [], total: 0 };
    if (passes >= activeIds(b).length * 2) return finish(b, 'passes', null, { passes, last });
    commitS({ passes, last, turn: nextTurn(b, id) });
  };
  const handleSwap = (id: string, letters: string[]) => {
    const b = sRef.current;
    if (b.phase !== 'play' || b.turn !== id || !Array.isArray(letters) || !letters.length) return;
    if (b.bag.length < b.opts.rack) return rejectTo(id, `Il reste moins de ${b.opts.rack} lettres dans le sac : échange impossible.`);
    const rack = [...b.racks[id]];
    for (const l of letters) {
      const k = rack.indexOf(l);
      if (k < 0) return rejectTo(id, 'Lettres invalides.');
      rack.splice(k, 1);
    }
    const drawn = b.bag.slice(0, letters.length);
    const bag = shuffled([...b.bag.slice(letters.length), ...letters]);
    const passes = b.passes + 1;
    const last = { id, kind: 'swap', words: [], total: 0, count: letters.length };
    const racks = { ...b.racks, [id]: [...rack, ...drawn] };
    if (passes >= activeIds(b).length * 2) return finish({ ...b, racks }, 'passes', null, { racks, bag, passes, last });
    commitS({ racks, bag, passes, last, turn: nextTurn(b, id) });
  };
  const forfeit = (id: string) => {
    const b = sRef.current;
    if (b.phase !== 'play' || b.out.includes(id) || !b.order.includes(id)) return;
    const out = [...b.out, id];
    const bag = shuffled([...b.bag, ...b.racks[id]]);
    const racks = { ...b.racks, [id]: [] };
    const alive = b.order.filter((x: string) => !out.includes(x));
    if (alive.length <= 1) return finish({ ...b, out }, 'forfeit', null, { out, bag, racks });
    commitS({ out, bag, racks, turn: b.turn === id ? nextTurn({ ...b, out }, id) : b.turn });
  };

  // Joueur dont c'est le tour parti : il est retiré de la partie
  useEffect(() => {
    if (!isHostRef.current) return;
    const b = sRef.current;
    if (b.phase !== 'play' || !b.turn) return;
    // Temps écoulé : le tour est passé
    if (b.deadline && Date.now() > b.deadline) {
      toast(`${nameOf(b.turn)} a été trop lent : tour passé.`);
      return handlePass(b.turn);
    }
    const t = Date.now();
    if (g.playersRef.current.length > 0 && !presentIds().has(b.turn)) {
      absentRef.current = absentRef.current || t;
      if (t - absentRef.current > 10000) {
        absentRef.current = 0;
        toast(`${nameOf(b.turn)} a quitté la partie.`);
        forfeit(b.turn);
      }
    } else absentRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // ==========================================
  // CANAL : événements du jeu
  // ==========================================
  cbRef.current = {
    attach: (ch: any) => {
      ch.on('broadcast', { event: 'sc' }, ({ payload }: any) => setS(payload.s));
      ch.on('broadcast', { event: 'sc_move' }, ({ payload }: any) => isHostRef.current && handleMove(payload?.id, payload?.tiles));
      ch.on('broadcast', { event: 'sc_pass' }, ({ payload }: any) => isHostRef.current && handlePass(payload?.id));
      ch.on('broadcast', { event: 'sc_swap' }, ({ payload }: any) => isHostRef.current && handleSwap(payload?.id, payload?.letters));
      ch.on('broadcast', { event: 'sc_quit' }, ({ payload }: any) => isHostRef.current && forfeit(payload?.id));
      ch.on('broadcast', { event: 'sc_reject' }, ({ payload }: any) => {
        if (payload?.id === playerRef.current.id) {
          toast(String(payload.msg || 'Coup refusé.'));
          setBusy(false);
        }
      });
    },
    hostSync: (ch: any) => ch.send({ type: 'broadcast', event: 'sc', payload: { s: sRef.current } }),
    reset: () => {
      setS(INITIAL_S);
      setStaged({});
      setSelected(null);
      setSwapMode(false);
      setSwapSel([]);
      absentRef.current = 0;
    },
  };
  const playerRef = useRef(player);
  playerRef.current = player;

  // ==========================================
  // ACTIONS DU JOUEUR
  // ==========================================
  const send = (event: string, host: () => void, payload: any) => (isHost ? host() : broadcast(event, { id: player.id, ...payload }));
  const phase = room ? s.phase : 'home';
  const myTurn = s.phase === 'play' && s.turn === player.id;
  const inGame = s.order.includes(player.id) && !s.out.includes(player.id);
  const myRack: string[] = s.racks[player.id] || [];
  const board: string[] = s.board.length ? s.board : emptyBoard();
  const stagedRack = new Set(Object.values(staged).map((x) => x.rackIdx));
  const stagedTiles: Tile[] = Object.entries(staged).map(([cell, x]) => ({ r: Math.floor(Number(cell) / SIZE), c: Number(cell) % SIZE, ch: x.ch, blank: x.blank }));
  const bonusMap: string[] = s.bonus?.length ? s.bonus : classicBonus();
  const rackSize: number = s.phase === 'lobby' ? Number(g.settings.rack) || 7 : s.opts.rack;
  const preview = stagedTiles.length ? evaluateMove(board, stagedTiles, { bonus: s.bonus, rack: rackSize }) : null;
  const badWords = preview && preview.ok && dict && s.phase === 'play' && settingsOn() ? preview.words.filter((w) => !dict.has(w.text)).map((w) => w.text) : [];
  function settingsOn() {
    return g.settings.dictionary !== false;
  }

  // Nouveau tour / partie : on repart d'un plateau propre
  useEffect(() => {
    setStaged({});
    setSelected(null);
    setSwapMode(false);
    setSwapSel([]);
    setBusy(false);
  }, [s.turn, s.gameId]);

  const clickCell = (cell: number) => {
    if (!myTurn || swapMode || busy) return;
    if (staged[cell]) {
      setStaged((m) => {
        const { [cell]: _, ...rest } = m;
        return rest;
      });
      return;
    }
    if (board[cell] || selected === null) return;
    const ch = myRack[selected];
    if (ch === '?') {
      setBlankFor({ rackIdx: selected, cell });
      return;
    }
    setStaged((m) => ({ ...m, [cell]: { rackIdx: selected, ch, blank: false } }));
    setSelected(null);
    playSfx('click');
  };
  const chooseBlank = (letter: string) => {
    if (!blankFor) return;
    setStaged((m) => ({ ...m, [blankFor.cell]: { rackIdx: blankFor.rackIdx, ch: letter, blank: true } }));
    setBlankFor(null);
    setSelected(null);
  };
  const clickRack = (i: number) => {
    if (!myTurn || busy || stagedRack.has(i)) return;
    if (swapMode) setSwapSel((sel) => (sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i]));
    else setSelected((cur) => (cur === i ? null : i));
  };
  const submit = () => {
    if (!preview || !preview.ok || busy) return;
    setBusy(true);
    send('sc_move', () => handleMove(player.id, stagedTiles), { tiles: stagedTiles });
  };
  const doPass = () => {
    if (!myTurn) return;
    if (stagedTiles.length && !window.confirm('Passer ton tour et reprendre tes lettres ?')) return;
    send('sc_pass', () => handlePass(player.id), {});
  };
  const doSwap = () => {
    if (!swapSel.length) return;
    const letters = swapSel.map((i) => myRack[i]);
    send('sc_swap', () => handleSwap(player.id, letters), { letters });
  };
  const leaveGame = () => {
    if (s.phase === 'play' && inGame) send('sc_quit', () => forfeit(player.id), {});
    g.leaveRoom();
  };

  // Sons
  const prev = useRef({ turn: null as any, phase: 'lobby', total: 0 });
  useEffect(() => {
    if (s.phase === 'play' && s.turn === player.id && prev.current.turn !== player.id) playSfx('whoosh');
    const total = Object.values(s.scores as Record<string, number>).reduce((n, x) => n + x, 0);
    if (total > prev.current.total) playSfx('success');
    if (s.phase === 'over' && prev.current.phase !== 'over') {
      if (s.winners.includes(player.id)) {
        playSfx('fanfare');
        fireConfetti();
      } else playSfx('error');
    }
    prev.current = { turn: s.turn, phase: s.phase, total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.turn, s.phase, s.scores]);

  // ==========================================
  // BRIQUES D'AFFICHAGE
  // ==========================================
  const sidebar = (
    <>
      {players.map((p) => {
        const inPlay = s.phase !== 'lobby' && s.order.includes(p.id);
        return (
          <div key={p.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${p.id === player.id ? 'bg-black/25 border border-purple-400/30' : ''} ${s.turn === p.id ? 'ring-2 ring-yellow-400/70' : ''} ${inPlay && s.out.includes(p.id) ? 'opacity-40' : ''}`}>
            <PlayerDot id={p.id} avatar={p.avatar} size="md" />
            <span className="font-bold truncate flex-1">{p.name}</span>
            {inPlay && <span className="text-sm font-black text-purple-300 shrink-0">{s.scores[p.id] ?? 0}</span>}
            {s.wins[p.id] > 0 && <span className="text-xs text-gray-300 shrink-0">🏆{s.wins[p.id]}</span>}
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
        <GameHome g={g} gameId={GAME_ID} eyebrow="Mots & points" title="SCRABBLE" tagline="Pose tes lettres, forme des mots, rafle les cases bonus." soundOn={soundOn} toggleSound={toggleSound} onRules={() => setShowRules(true)} />
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
    const ready = players.length >= 2;
    return shell(
      <div className="paper p-6 sm:p-8 w-full max-w-2xl mx-auto text-center md:overflow-y-auto">
        <GameArt id="scrabble" className="h-28 mx-auto -mt-2 mb-2" />
        <RoomCodeBlock g={g} />
        {Object.keys(s.wins).length > 0 && (
          <p className="mb-4 text-sm text-gray-300">🏆 {Object.entries(s.wins).map(([id, n]) => `${nameOf(id)} ${n}`).join(' · ')}</p>
        )}
        <p className="text-gray-400 text-sm mb-5">
          {ready ? `${Math.min(players.length, 4)} joueurs vont jouer${players.length > 4 ? ' (les autres regardent)' : ''}.` : 'En attente d’au moins un adversaire…'}
        </p>
        <div className="text-left mb-5 bg-gray-950/70 border border-gray-800 rounded-xl p-4">
          <h3 className="flex items-center gap-2 text-gray-400 font-bold mb-3 uppercase text-sm"><Settings size={16} /> Paramètres du salon</h3>
          <RoomOptions settings={g.settings} updateSettings={g.updateSettings} isHost={isHost} />
          <div className="mt-4 pt-4 border-t border-gray-800 text-sm">
            <ToggleRow
              label="Vérifier le dictionnaire"
              hint={dict ? 'Refuse les mots absents de la liste (311 000 mots)' : 'Chargement du dictionnaire…'}
              checked={g.settings.dictionary !== false}
              disabled={!isHost}
              onChange={(v: boolean) => g.updateSettings({ dictionary: v })}
            />
          </div>
        </div>
        <VariantsPanel isHost={isHost}>
          <ChoiceRow label="Fin de la partie" hint="Au premier à atteindre l’objectif, la partie s’arrête tout de suite." value={g.settings.goal ?? 0} options={[{ value: 0, label: 'Sac vide (classique)' }, { value: 100, label: '100 pts' }, { value: 200, label: '200 pts' }, { value: 300, label: '300 pts' }]} onChange={(v) => g.updateSettings({ goal: Number(v) })} disabled={!isHost} />
          <ChoiceRow label="Cases bonus" hint="Aléatoires : les cases bonus changent de place à chaque partie." value={g.settings.randomBonus ? 'rand' : 'classic'} options={[{ value: 'classic', label: 'Classiques' }, { value: 'rand', label: 'Aléatoires' }]} onChange={(v) => g.updateSettings({ randomBonus: v === 'rand' })} disabled={!isHost} />
          <ChoiceRow label="Lettres au chevalet" hint="Poser tout son chevalet d’un coup rapporte 50 points de bonus." value={g.settings.rack ?? 7} options={[{ value: 5, label: '5' }, { value: 7, label: '7 (classique)' }, { value: 9, label: '9' }]} onChange={(v) => g.updateSettings({ rack: Number(v) })} disabled={!isHost} />
          <TimerRow value={timerOf(g.settings)} onChange={(v) => g.updateSettings({ timer: v })} disabled={!isHost} hint="Si le temps est écoulé, ton tour est passé." />
        </VariantsPanel>
        {isHost ? (
          <button onClick={startGame} disabled={!ready} className="w-full bg-purple-300 hover:bg-purple-200 !text-gray-950 shadow-md disabled:opacity-50 active:scale-95 font-black py-4 px-6 rounded-lg text-lg transition">
            {ready ? 'Lancer la partie !' : 'Il faut 2 joueurs minimum…'}
          </button>
        ) : (
          <WaitingForHost />
        )}
        <button onClick={() => setShowRules(true)} className="mt-4 text-gray-400 hover:text-purple-300 text-sm font-bold transition">Comment jouer ?</button>
      </div>
    );
  }

  // ----- Plateau -----
  const boardView = (
    <div className="grid gap-[2px] p-1.5 sm:p-2 rounded-xl bg-emerald-900 w-full max-w-[42rem] mx-auto select-none" style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}>
      {board.map((cell, k) => {
        const st = staged[k];
        const bonus = bonusMap[k];
        const empty = !cell && !st;
        const style = BONUS_STYLE[bonus];
        return (
          <button
            key={k}
            type="button"
            data-sfx="off"
            onClick={() => clickCell(k)}
            disabled={!myTurn || (!!cell && !st)}
            aria-label={cell ? `Lettre ${cell.toUpperCase()}` : st ? `Lettre posée ${st.ch}` : bonus ? `Case ${style.label}` : 'Case vide'}
            className={`relative aspect-square rounded-[3px] flex items-center justify-center p-0 ${empty ? `${style ? style.cls : 'bg-emerald-700/70'} ${myTurn && selected !== null ? 'hover:ring-2 hover:ring-white cursor-pointer' : 'cursor-default'}` : 'cursor-default'}`}
          >
            {cell ? (
              <Tile_ ch={cell} blank={cell === cell.toLowerCase()} small />
            ) : st ? (
              <Tile_ ch={st.ch} blank={st.blank} small staged />
            ) : k === 112 ? (
              <span className="text-[11px] sm:text-base leading-none">★</span>
            ) : style ? (
              <span className="text-[7px] sm:text-[10px] font-bold leading-none">{style.label}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );

  const lastMsg = s.last
    ? s.last.kind === 'play'
      ? `${nameOf(s.last.id)} : ${s.last.words.map((w: any) => w.text).join(', ')} — ${s.last.total} pts${s.last.bingo ? ' (Scrabble ! +50)' : ''}`
      : s.last.kind === 'swap'
        ? `${nameOf(s.last.id)} a échangé ${s.last.count} lettre${s.last.count > 1 ? 's' : ''}.`
        : `${nameOf(s.last.id)} passe son tour.`
    : 'À toi de poser le premier mot !';

  if (phase === 'play') {
    return shell(
      <div className="flex-1 min-h-0 md:overflow-y-auto w-full max-w-3xl mx-auto flex flex-col gap-3">
        <div className="rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap bg-purple-300 text-gray-950 font-bold">
          <span className="font-heading text-lg">{myTurn ? '👉 À toi de jouer !' : `Tour de ${nameOf(s.turn)}`}</span>
          <span className="text-sm flex items-center gap-2">🎒 {s.bag.length} dans le sac{s.opts.goal > 0 ? ` · objectif ${s.opts.goal} pts` : ''}<TurnClock deadline={s.deadline} now={now} className="!bg-black/20" /></span>
        </div>
        <p className="text-xs text-gray-400 text-center" aria-live="polite">{lastMsg}</p>
        {boardView}

        {inGame && (
          <div className="paper p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 min-h-[3.5rem]">
              {myRack.map((ch, i) =>
                stagedRack.has(i) ? (
                  <span key={i} className="w-10 h-10 sm:w-12 sm:h-12 rounded-md border border-dashed border-gray-700" />
                ) : (
                  <Tile_ key={i} ch={ch} selected={selected === i || swapSel.includes(i)} onClick={() => clickRack(i)} />
                )
              )}
            </div>

            {myTurn && (
              <div className="mt-3 flex flex-col items-center gap-2">
                {!swapMode && (
                  <p className={`text-sm font-semibold text-center min-h-[1.25rem] ${preview && !preview.ok ? 'text-red-400' : badWords.length ? 'text-red-400' : 'text-gray-300'}`}>
                    {!preview
                      ? selected !== null ? 'Clique une case du plateau pour poser la lettre.' : 'Choisis une lettre, puis une case.'
                      : !preview.ok
                        ? preview.error
                        : badWords.length
                          ? `Mot inconnu : ${badWords.join(', ')}`
                          : `${preview.words.map((w) => w.text).join(', ')} · +${preview.total} pts${preview.bingo ? ' (Scrabble !)' : ''}`}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {swapMode ? (
                    <>
                      <button onClick={doSwap} disabled={!swapSel.length} className="tag-dark px-4 py-2 flex items-center gap-1.5 disabled:opacity-40 active:scale-95 cursor-pointer"><Repeat size={15} /> Échanger {swapSel.length || ''}</button>
                      <button onClick={() => { setSwapMode(false); setSwapSel([]); }} className="rounded-xl border border-gray-600 px-4 py-2 text-sm font-bold hover:bg-white/10 transition cursor-pointer">Annuler</button>
                    </>
                  ) : (
                    <>
                      <button onClick={submit} disabled={!preview || !preview.ok || busy || badWords.length > 0} className="tag-dark whitespace-nowrap px-5 py-2 flex items-center gap-1.5 disabled:opacity-40 active:scale-95 cursor-pointer"><Check size={16} /> {busy ? 'Vérification…' : 'Valider'}</button>
                      <button onClick={() => { setStaged({}); setSelected(null); }} disabled={!stagedTiles.length} className="rounded-xl border border-gray-600 px-3 py-2 text-sm font-bold hover:bg-white/10 disabled:opacity-40 transition flex items-center gap-1.5 cursor-pointer"><Undo2 size={15} /> Reprendre</button>
                      <button onClick={() => { setSwapMode(true); setStaged({}); setSelected(null); }} disabled={s.bag.length < rackSize} title={s.bag.length < rackSize ? `Il faut au moins ${rackSize} lettres dans le sac` : ''} className="rounded-xl border border-gray-600 px-3 py-2 text-sm font-bold hover:bg-white/10 disabled:opacity-40 transition flex items-center gap-1.5 cursor-pointer"><Repeat size={15} /> Échanger</button>
                      <button onClick={doPass} className="rounded-xl border border-gray-600 px-3 py-2 text-sm font-bold hover:bg-white/10 transition flex items-center gap-1.5 cursor-pointer"><SkipForward size={15} /> Passer</button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {!inGame && <p className="text-center text-sm text-gray-400">Tu regardes la partie 👀</p>}

        {blankFor && (
          <div className="fixed inset-0 z-[950] bg-black/70 flex items-center justify-center p-4" onClick={() => setBlankFor(null)}>
            <div onClick={(e) => e.stopPropagation()} className="paper p-5 text-center animate-rise max-w-sm">
              <p className="font-heading text-xl mb-3">Quelle lettre pour le joker ?</p>
              <div className="grid grid-cols-6 sm:grid-cols-7 gap-1.5">
                {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => (
                  <button key={l} data-sfx="off" onClick={() => chooseBlank(l)} className="h-10 rounded-md bg-amber-100 text-gray-900 font-heading font-black hover:bg-amber-300 active:scale-95 transition cursor-pointer">{l}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // phase === 'over'
  const ranking = [...s.order].sort((a: string, b: string) => s.scores[b] - s.scores[a]);
  return shell(
    <div className="flex-1 min-h-0 md:overflow-y-auto w-full max-w-3xl mx-auto animate-fadein flex flex-col gap-3">
      <div className="rounded-xl px-5 py-4 text-center bg-purple-300 text-gray-950">
        <p className="font-heading text-3xl flex items-center justify-center gap-2"><Crown /> {s.winners.length > 1 ? `Égalité : ${s.winners.map((id: string) => nameOf(id)).join(' & ')}` : `${nameOf(s.winners[0])} gagne !`}</p>
        <p className="text-sm font-semibold mt-1">{s.reason === 'forfeit' ? 'Les autres joueurs ont abandonné.' : s.reason === 'passes' ? 'Tout le monde a passé : la partie est terminée.' : s.reason === 'goal' ? `Objectif de ${s.opts.goal} points atteint !` : 'Le sac est vide et un joueur a posé toutes ses lettres.'}</p>
      </div>
      <div className="paper p-4">
        <p className="eyebrow mb-2">Classement final</p>
        <ol className="space-y-1.5">
          {ranking.map((id: string, i: number) => (
            <li key={id} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-gray-500 font-bold">{i + 1}.</span>
              <PlayerDot id={id} avatar={avatarOf(id)} /> <span className="font-bold flex-1 truncate">{nameOf(id)}</span>
              <span className="font-heading font-black text-purple-300">{s.scores[id]}</span>
            </li>
          ))}
        </ol>
      </div>
      {boardView}
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
