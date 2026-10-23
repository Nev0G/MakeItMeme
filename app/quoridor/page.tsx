'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Settings, Crown } from 'lucide-react';
import { makeId, shuffle, PlayerDot, playSfx, useSoundAndClickFx, fireConfetti, RoomOptions, KickButton, toast, useRefState } from '@/lib/shared';
import { useGameRoom, GameHome, GameShell, RoomCodeBlock, RulesDialog, WaitingForHost } from '@/lib/gameroom';
import { STARTS, N, goalReached, legalMoves, canPlaceWall, autoMove, type Wall, type Pos } from '@/lib/quoridor';
import { ChoiceRow, VariantsPanel, TimerRow, TurnClock, nextDeadline, timerOf } from '@/lib/variants';
import { GameArt } from '@/lib/art';

const GAME_ID = 'quoridor';

const DEFAULT_SETTINGS = { visibility: 'private', roomName: '', chatEnabled: true, walls: 'auto', obstacles: 0, timer: 0 };
const INITIAL_Q = {
  phase: 'lobby', // 'lobby' | 'play' | 'over'
  gameId: null,
  order: [] as string[], // joueurs en jeu, dans l'ordre des tours (2 ou 4)
  pawns: {} as Record<string, Pos>, // id -> [ligne, colonne]
  walls: [] as Wall[],
  left: {} as Record<string, number>, // murs restants
  out: [] as string[], // joueurs partis en cours de partie
  turn: null as any,
  winner: null as any,
  reason: null as any,
  wins: {} as Record<string, number>,
  opts: { walls: 'auto', obstacles: 0, timer: 0 } as any, // variantes de la partie en cours
  deadline: null as any, // fin du tour (si chronomètre)
};

const COLORS = ['#fbbf24', '#2dd4bf', '#f43f5e', '#a78bfa'];
const GOAL_LABEL = ['en haut', 'en bas', 'à droite', 'à gauche'];

const RULES_STEPS = [
  { title: 'Atteins le bord opposé', text: 'Chaque joueur a un pion. Le premier qui atteint le côté d’en face gagne. À 2 joueurs : haut contre bas ; à 4 : un côté chacun.' },
  { title: 'Un tour = une action', text: 'Soit tu avances ton pion d’une case (haut, bas, gauche, droite), soit tu poses un mur. Clique sur une case en surbrillance pour avancer.' },
  { title: 'Sauts', text: 'Si un pion adverse est devant toi, tu sautes par-dessus. S’il y a un mur derrière lui, tu peux passer en diagonale.' },
  { title: 'Poser un mur', text: 'Un mur fait 2 cases de long et bloque le passage. Survole (ou touche) une rainure entre les cases pour voir le mur, puis clique pour le poser. 10 murs chacun à 2 joueurs, 5 à 4.' },
  { title: 'Jamais de blocus total', text: 'Tu ne peux pas enfermer complètement un joueur : il doit toujours rester au moins un chemin vers son but.' },
];

export default function Quoridor() {
  const [q, setQ, qRef] = useRefState(INITIAL_Q);
  const [hover, setHover] = useState<Wall | null>(null);
  const [showRules, setShowRules] = useState(false);
  const cbRef = useRef<any>({});
  const absentRef = useRef(0);
  const { soundOn, toggleSound } = useSoundAndClickFx();

  const g = useGameRoom({
    channelName: 'quoridor', gameId: GAME_ID, sessionKey: 'quoridor-session', defaultSettings: DEFAULT_SETTINGS,
    started: q.phase === 'play', cbRef,
  });
  const { player: rawPlayer, room, players, isHost, isHostRef, broadcast, now, nameOf, presentIds } = g;
  const player: { id: string; name: string; avatar: string } = rawPlayer as any;

  const commitQ = (patch: any) => {
    const next = { ...qRef.current, ...patch };
    // Chaque coup relance le chronomètre
    next.deadline = next.phase === 'play' && next.turn ? nextDeadline(next.opts?.timer) : null;
    setQ(next);
    broadcast('q', { q: next });
  };

  // ==========================================
  // LOGIQUE DE JEU (le host fait foi)
  // ==========================================
  const pawnList = (b: typeof INITIAL_Q) => b.order.map((id) => (b.out.includes(id) ? (null as any) : b.pawns[id]));
  const activeIdx = (b: typeof INITIAL_Q) => b.order.map((id, i) => i).filter((i) => !b.out.includes(b.order[i]));
  const nextTurn = (b: typeof INITIAL_Q, from: string) => {
    const n = b.order.length;
    let i = b.order.indexOf(from);
    for (let k = 0; k < n; k++) {
      i = (i + 1) % n;
      if (!b.out.includes(b.order[i])) return b.order[i];
    }
    return from;
  };
  const endGame = (winner: string, reason: string, extra: any = {}) =>
    commitQ({ ...extra, phase: 'over', winner, reason, turn: null, wins: { ...qRef.current.wins, [winner]: (qRef.current.wins[winner] || 0) + 1 } });

  const startGame = () => {
    if (!isHost) return;
    const present = players.map((p) => p.id);
    if (present.length < 2) {
      toast('Il faut au moins 2 joueurs.');
      return;
    }
    const order = shuffle(present.slice(0, present.length >= 4 ? 4 : 2));
    const pawns: Record<string, Pos> = {};
    const left: Record<string, number> = {};
    const st = g.settingsRef.current;
    const opts = { walls: st.walls || 'auto', obstacles: Number(st.obstacles) || 0, timer: timerOf(st) };
    const perPlayer = opts.walls === 'auto' ? (order.length === 2 ? 10 : 5) : Number(opts.walls);
    order.forEach((id, i) => {
      pawns[id] = STARTS[i];
      left[id] = perPlayer;
    });
    // Obstacles : quelques murs posés au hasard avant le début (le chemin vers le but reste toujours ouvert)
    const walls: Wall[] = [];
    const pawnArr = order.map((id) => pawns[id]);
    const all = order.map((_, i) => i);
    for (let tries = 0; walls.length < opts.obstacles && tries < 400; tries++) {
      const w: Wall = [Math.floor(Math.random() * (N - 1)), Math.floor(Math.random() * (N - 1)), Math.random() < 0.5 ? 'h' : 'v'];
      if (canPlaceWall(walls, pawnArr, all, w)) walls.push(w);
    }
    g.broadcast('roster', { known: g.knownRef.current });
    absentRef.current = 0;
    commitQ({ ...INITIAL_Q, phase: 'play', gameId: makeId('g'), order, pawns, left, walls, opts, turn: order[0], wins: qRef.current.wins });
  };
  const backToLobby = () => commitQ({ ...INITIAL_Q, wins: qRef.current.wins });

  const handleMove = (id: string, r: number, c: number) => {
    const b = qRef.current;
    if (b.phase !== 'play' || b.turn !== id) return;
    const me = b.order.indexOf(id);
    if (!legalMoves(b.walls, pawnList(b), me).some((m) => m[0] === r && m[1] === c)) return;
    const pawns = { ...b.pawns, [id]: [r, c] as Pos };
    if (goalReached(me, [r, c])) return endGame(id, 'goal', { pawns });
    commitQ({ pawns, turn: nextTurn(b, id) });
  };
  const handleWall = (id: string, r: number, c: number, o: any) => {
    const b = qRef.current;
    if (b.phase !== 'play' || b.turn !== id || (b.left[id] || 0) < 1) return;
    if (!canPlaceWall(b.walls, pawnList(b), activeIdx(b), [r, c, o])) return;
    commitQ({ walls: [...b.walls, [r, c, o] as Wall], left: { ...b.left, [id]: b.left[id] - 1 }, turn: nextTurn(b, id) });
  };
  const forfeit = (id: string) => {
    const b = qRef.current;
    if (b.phase !== 'play' || b.out.includes(id) || !b.order.includes(id)) return;
    const out = [...b.out, id];
    const alive = b.order.filter((x: string) => !out.includes(x));
    if (alive.length <= 1) return endGame(alive[0] || id, 'forfeit', { out });
    commitQ({ out, turn: b.turn === id ? nextTurn({ ...b, out }, id) : b.turn });
  };

  // Joueur dont c'est le tour parti : il est retiré de la partie
  useEffect(() => {
    if (!isHostRef.current) return;
    const b = qRef.current;
    if (b.phase !== 'play' || !b.turn) return;
    // Temps écoulé : le pion avance d'une case vers son but
    if (b.deadline && Date.now() > b.deadline) {
      const me = b.order.indexOf(b.turn);
      const m = autoMove(b.walls, pawnList(b), me);
      if (m) {
        toast(`${nameOf(b.turn)} a été trop lent : coup automatique.`);
        return handleMove(b.turn, m[0], m[1]);
      }
    }
    const t = Date.now();
    if (g.playersRef.current.length > 0 && !presentIds().has(b.turn)) {
      absentRef.current = absentRef.current || t;
      if (t - absentRef.current > 8000) {
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
      ch.on('broadcast', { event: 'q' }, ({ payload }: any) => setQ(payload.q));
      ch.on('broadcast', { event: 'q_move' }, ({ payload }: any) => isHostRef.current && handleMove(payload?.id, payload?.r, payload?.c));
      ch.on('broadcast', { event: 'q_wall' }, ({ payload }: any) => isHostRef.current && handleWall(payload?.id, payload?.r, payload?.c, payload?.o));
      ch.on('broadcast', { event: 'q_quit' }, ({ payload }: any) => isHostRef.current && forfeit(payload?.id));
    },
    hostSync: (ch: any) => ch.send({ type: 'broadcast', event: 'q', payload: { q: qRef.current } }),
    reset: () => {
      setQ(INITIAL_Q);
      setHover(null);
      absentRef.current = 0;
    },
  };

  // ==========================================
  // ACTIONS DU JOUEUR
  // ==========================================
  const send = (event: string, host: () => void, payload: any) => (isHost ? host() : broadcast(event, { id: player.id, ...payload }));
  const phase = room ? q.phase : 'home';
  const myTurn = q.phase === 'play' && q.turn === player.id;
  const myIdx = q.order.indexOf(player.id);
  const pawns = pawnList(q);
  const moves: Pos[] = myTurn ? legalMoves(q.walls, pawns, myIdx) : [];
  const canWall = myTurn && (q.left[player.id] || 0) > 0;
  const colorOf = (id: string) => COLORS[Math.max(0, q.order.indexOf(id))];

  const clickCell = (r: number, c: number) => {
    send('q_move', () => handleMove(player.id, r, c), { r, c });
    playSfx('click');
    setHover(null);
  };
  const clickGroove = (w: Wall) => {
    if (!hover || hover[0] !== w[0] || hover[1] !== w[1] || hover[2] !== w[2]) return setHover(w);
    if (!canPlaceWall(q.walls, pawns, activeIdx(q), w)) {
      toast('Ce mur est interdit (il bloque un joueur ou chevauche un autre mur).');
      return setHover(null);
    }
    send('q_wall', () => handleWall(player.id, w[0], w[1], w[2]), { r: w[0], c: w[1], o: w[2] });
    playSfx('send');
    setHover(null);
  };
  const leaveGame = () => {
    if (q.phase === 'play' && myIdx >= 0 && !q.out.includes(player.id)) send('q_quit', () => forfeit(player.id), {});
    g.leaveRoom();
  };

  // Sons
  const prev = useRef({ walls: 0, phase: 'lobby', turn: null as any });
  useEffect(() => {
    if (q.phase === 'play' && q.turn === player.id && prev.current.turn !== player.id) playSfx('whoosh');
    if (q.phase === 'play' && q.walls.length > prev.current.walls) playSfx('click');
    if (q.phase === 'over' && prev.current.phase !== 'over') {
      if (q.winner === player.id) {
        playSfx('fanfare');
        fireConfetti();
      } else playSfx('error');
    }
    prev.current = { walls: q.walls.length, phase: q.phase, turn: q.turn };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.walls.length, q.phase, q.turn]);
  useEffect(() => setHover(null), [q.turn]);

  // ==========================================
  // BRIQUES D'AFFICHAGE
  // ==========================================
  const sidebar = (
    <>
      {players.map((p) => {
        const i = q.order.indexOf(p.id);
        const playing = q.phase !== 'lobby' && i >= 0;
        return (
          <div key={p.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${p.id === player.id ? 'bg-black/25 border border-purple-400/30' : ''} ${q.turn === p.id ? 'ring-2 ring-yellow-400/70' : ''} ${playing && q.out.includes(p.id) ? 'opacity-40' : ''}`}>
            <PlayerDot id={p.id} avatar={p.avatar} size="md" />
            <span className="font-bold truncate flex-1">{p.name}</span>
            {playing && <span title="Couleur du pion" className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i] }} />}
            {playing && <span title="Murs restants" className="text-xs text-gray-300 shrink-0">🧱{q.left[p.id] ?? 0}</span>}
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
        <GameHome g={g} gameId={GAME_ID} eyebrow="Stratégie & blocus" title="QUORIDOR" tagline="Traverse le plateau en premier, et barre la route aux autres avec tes murs." soundOn={soundOn} toggleSound={toggleSound} onRules={() => setShowRules(true)} />
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
    const playing = Math.min(players.length >= 4 ? 4 : 2, players.length);
    return shell(
      <div className="paper p-6 sm:p-8 w-full max-w-2xl mx-auto text-center md:overflow-y-auto">
        <GameArt id="quoridor" className="h-28 mx-auto -mt-2 mb-2" />
        <RoomCodeBlock g={g} />
        {Object.keys(q.wins).length > 0 && (
          <p className="mb-4 text-sm text-gray-300">🏆 {Object.entries(q.wins).map(([id, n]) => `${nameOf(id)} ${n}`).join(' · ')}</p>
        )}
        <p className="text-gray-400 text-sm mb-5">
          {ready ? `${playing} joueurs vont s’affronter${players.length > playing ? ` (les autres regardent)` : ''}.` : 'En attente d’au moins un adversaire…'} <br />
          <span className="text-xs">Murs et obstacles : voir les variantes ci-dessous.</span>
        </p>
        <div className="text-left mb-5 bg-gray-950/70 border border-gray-800 rounded-xl p-4">
          <h3 className="flex items-center gap-2 text-gray-400 font-bold mb-3 uppercase text-sm"><Settings size={16} /> Paramètres du salon</h3>
          <RoomOptions settings={g.settings} updateSettings={g.updateSettings} isHost={isHost} />
        </div>
        <VariantsPanel isHost={isHost}>
          <ChoiceRow label="Murs par joueur" hint="Auto : 10 murs à 2 joueurs, 5 à 4 joueurs." value={g.settings.walls ?? 'auto'} options={[{ value: 'auto', label: 'Auto' }, { value: 5, label: '5' }, { value: 10, label: '10' }, { value: 15, label: '15' }, { value: 20, label: '20' }]} onChange={(v) => g.updateSettings({ walls: v })} disabled={!isHost} />
          <ChoiceRow label="Obstacles au départ" hint="Des murs posés au hasard avant la première action (il reste toujours un chemin)." value={g.settings.obstacles ?? 0} options={[{ value: 0, label: 'Aucun' }, { value: 4, label: 'Quelques-uns' }, { value: 8, label: 'Beaucoup' }, { value: 12, label: 'Labyrinthe' }]} onChange={(v) => g.updateSettings({ obstacles: Number(v) })} disabled={!isHost} />
          <TimerRow value={timerOf(g.settings)} onChange={(v) => g.updateSettings({ timer: v })} disabled={!isHost} hint="Si le temps est écoulé, le pion avance automatiquement d’une case." />
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
  const previewOk = hover ? canPlaceWall(q.walls, pawns, activeIdx(q), hover) : false;
  const wallStyle = (w: Wall) =>
    w[2] === 'h'
      ? { gridRow: 2 * w[0] + 2, gridColumn: `${2 * w[1] + 1} / span 3` }
      : { gridColumn: 2 * w[1] + 2, gridRow: `${2 * w[0] + 1} / span 3` };
  const moveSet = new Set(moves.map((m) => m[0] * N + m[1]));

  const board = (
    <div
      className="grid w-full max-w-[36rem] mx-auto aspect-square rounded-xl bg-[#1a1a26] p-2 select-none"
      style={{ gridTemplateColumns: 'repeat(8, minmax(0,1fr) 0.45fr) minmax(0,1fr)', gridTemplateRows: 'repeat(8, minmax(0,1fr) 0.45fr) minmax(0,1fr)' }}
      onMouseLeave={() => setHover(null)}
    >
      {Array.from({ length: N * N }, (_, k) => {
        const r = Math.floor(k / N);
        const c = k % N;
        const pawnId = q.order.find((id: string) => !q.out.includes(id) && q.pawns[id][0] === r && q.pawns[id][1] === c);
        const can = moveSet.has(k);
        return (
          <button
            key={k}
            data-sfx="off"
            disabled={!can}
            onClick={() => clickCell(r, c)}
            style={{ gridRow: 2 * r + 1, gridColumn: 2 * c + 1 }}
            className={`relative rounded-md flex items-center justify-center transition ${can ? 'bg-emerald-500/50 hover:bg-emerald-400/70 cursor-pointer ring-2 ring-emerald-300' : 'bg-[#d6d9e6] cursor-default'}`}
          >
            {pawnId && (
              <span className={`w-[70%] aspect-square rounded-full border-2 border-black/40 shadow-md ${q.turn === pawnId ? 'animate-pulse' : ''}`} style={{ backgroundColor: colorOf(pawnId) }} />
            )}
          </button>
        );
      })}
      {q.walls.map((w: Wall, i: number) => (
        <div key={i} style={wallStyle(w)} className="bg-[#fb7185] rounded-full z-10 shadow" />
      ))}
      {canWall && q.phase === 'play' && (
        <>
          {Array.from({ length: (N - 1) * N }, (_, k) => {
            const r = Math.floor(k / N);
            const c = k % N;
            const w: Wall = [r, Math.min(c, N - 2), 'h'];
            return <button key={`h${k}`} data-sfx="off" aria-label="Poser un mur horizontal" onMouseEnter={() => setHover(w)} onClick={() => clickGroove(w)} style={{ gridRow: 2 * r + 2, gridColumn: 2 * c + 1 }} className="z-20 cursor-pointer" />;
          })}
          {Array.from({ length: N * (N - 1) }, (_, k) => {
            const r = Math.floor(k / (N - 1));
            const c = k % (N - 1);
            const w: Wall = [Math.min(r, N - 2), c, 'v'];
            return <button key={`v${k}`} data-sfx="off" aria-label="Poser un mur vertical" onMouseEnter={() => setHover(w)} onClick={() => clickGroove(w)} style={{ gridRow: 2 * r + 1, gridColumn: 2 * c + 2 }} className="z-20 cursor-pointer" />;
          })}
        </>
      )}
      {hover && canWall && (
        <div style={wallStyle(hover)} className={`rounded-full z-30 pointer-events-none ${previewOk ? 'bg-emerald-300/80' : 'bg-red-500/70'}`} />
      )}
    </div>
  );

  if (phase === 'play') {
    const turnName = q.turn ? nameOf(q.turn) : '?';
    return shell(
      <div className="flex-1 min-h-0 md:overflow-y-auto w-full max-w-3xl mx-auto">
        <div className="rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between gap-3 flex-wrap text-white" style={{ backgroundColor: q.turn ? `${colorOf(q.turn)}cc` : '#444' }}>
          <span className="font-heading text-lg">{myTurn ? '👉 À toi de jouer !' : `Tour de ${turnName}`}</span>
          {myIdx >= 0 && <span className="text-sm font-bold flex items-center gap-2">Ton but : le bord {GOAL_LABEL[myIdx]} · 🧱 {q.left[player.id] ?? 0}<TurnClock deadline={q.deadline} now={now} /></span>}
          {myIdx < 0 && <span className="text-sm font-bold">Tu regardes la partie 👀</span>}
        </div>
        {myTurn && <p className="text-xs text-gray-400 text-center mb-2">Clique une case verte pour avancer, ou une rainure entre les cases pour poser un mur{canWall ? '' : ' (plus de murs !)'}.</p>}
        {board}
      </div>
    );
  }

  // phase === 'over'
  const winner = q.winner;
  return shell(
    <div className="flex-1 min-h-0 md:overflow-y-auto w-full max-w-3xl mx-auto animate-fadein">
      <div className="rounded-xl px-5 py-4 mb-3 text-center text-white" style={{ backgroundColor: winner ? `${colorOf(winner)}cc` : '#444' }}>
        <p className="font-heading text-3xl flex items-center justify-center gap-2"><Crown /> {winner ? `${nameOf(winner)} gagne !` : 'Partie terminée'}</p>
        <p className="text-sm opacity-90 mt-1">{q.reason === 'forfeit' ? 'Les autres joueurs ont abandonné.' : 'Le bord opposé est atteint.'}</p>
      </div>
      {board}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
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
