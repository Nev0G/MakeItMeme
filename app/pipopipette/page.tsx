'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Settings, Crown } from 'lucide-react';
import { makeId, shuffle, PlayerDot, playSfx, useSoundAndClickFx, fireConfetti, RoomOptions, KickButton, toast, useRefState } from '@/lib/shared';
import { useGameRoom, GameHome, GameShell, RoomCodeBlock, RulesDialog, WaitingForHost } from '@/lib/gameroom';
import { GameArt } from '@/lib/art';

const GAME_ID = 'pipopipette';

const DEFAULT_SETTINGS = { visibility: 'private', roomName: '', chatEnabled: true };
const SIZES = [3, 4, 5, 6, 7]; // nombre de carrés par côté
const INITIAL_P: any = {
  phase: 'lobby', // 'lobby' | 'play' | 'over'
  gameId: null,
  size: 5,
  order: [], // joueurs en jeu, dans l'ordre des tours (2 à 4)
  hs: [], // traits horizontaux : (size+1)*size, 0 = libre sinon n° du joueur + 1
  vs: [], // traits verticaux : size*(size+1)
  boxes: [], // size*size : n° du joueur + 1 qui a fermé le carré, 0 sinon
  out: [], // joueurs partis en cours de partie
  turn: null,
  winners: [], // ids (plusieurs en cas d'égalité)
  reason: null,
  wins: {},
  last: null, // dernier trait posé : { o, r, c }
};

const COLORS = ['#fbbf24', '#2dd4bf', '#f43f5e', '#a78bfa'];

const RULES_STEPS = [
  { title: 'Relie les points', text: 'À ton tour, trace un trait entre deux points voisins (clique sur l’espace entre eux).' },
  { title: 'Ferme des carrés', text: 'Quand tu poses le 4e côté d’un carré, il est à toi ! Il prend ta couleur.' },
  { title: 'Rejoue si tu captures', text: 'Si ton trait ferme un ou deux carrés, tu rejoues tout de suite. Sinon, c’est au joueur suivant.' },
  { title: 'Évite les cadeaux', text: 'Ne pose pas le 3e côté d’un carré : l’adversaire n’aura qu’à le fermer. Garde les pièges pour la fin !' },
  { title: 'Gagner', text: 'Quand tous les carrés sont pris, celui qui en a le plus gagne. 2 à 4 joueurs.' },
];

export default function Pipopipette() {
  const [p, setP, pRef] = useRefState(INITIAL_P);
  const [showRules, setShowRules] = useState(false);
  const cbRef = useRef<any>({});
  const absentRef = useRef(0);
  const { soundOn, toggleSound } = useSoundAndClickFx();

  const g = useGameRoom({
    channelName: 'pipopipette', gameId: GAME_ID, sessionKey: 'pipopipette-session', defaultSettings: DEFAULT_SETTINGS,
    started: p.phase === 'play', cbRef,
  });
  const { room, players, isHost, isHostRef, broadcast, now, nameOf, presentIds } = g;
  const player: { id: string; name: string; avatar: string } = g.player as any;

  const commitP = (patch: any) => {
    const next = { ...pRef.current, ...patch };
    setP(next);
    broadcast('pp', { p: next });
  };

  // ==========================================
  // LOGIQUE DE JEU (le host fait foi)
  // ==========================================
  const nextTurn = (b: any, from: string) => {
    const n = b.order.length;
    let i = b.order.indexOf(from);
    for (let k = 0; k < n; k++) {
      i = (i + 1) % n;
      if (!b.out.includes(b.order[i])) return b.order[i];
    }
    return from;
  };
  const scoresOf = (b: any) => b.order.map((id: string, i: number) => b.boxes.filter((x: number) => x === i + 1).length);
  const endGame = (winners: string[], reason: string, extra: any = {}) => {
    const wins = { ...pRef.current.wins };
    winners.forEach((id) => (wins[id] = (wins[id] || 0) + 1));
    commitP({ ...extra, phase: 'over', winners, reason, turn: null, wins });
  };

  const startGame = () => {
    if (!isHost) return;
    const present = players.map((x) => x.id);
    if (present.length < 2) {
      toast('Il faut au moins 2 joueurs.');
      return;
    }
    const size = pRef.current.size;
    g.broadcast('roster', { known: g.knownRef.current });
    absentRef.current = 0;
    const order = shuffle(present.slice(0, 4));
    commitP({
      ...INITIAL_P, phase: 'play', gameId: makeId('g'), size, order, turn: order[0], wins: pRef.current.wins,
      hs: Array((size + 1) * size).fill(0), vs: Array(size * (size + 1)).fill(0), boxes: Array(size * size).fill(0),
    });
  };
  const backToLobby = () => commitP({ ...INITIAL_P, size: pRef.current.size, wins: pRef.current.wins });
  const setSize = (size: number) => isHost && pRef.current.phase === 'lobby' && SIZES.includes(size) && commitP({ size });

  const handleEdge = (id: string, o: string, r: number, c: number) => {
    const b = pRef.current;
    if (b.phase !== 'play' || b.turn !== id) return;
    const n = b.size;
    const hs = [...b.hs];
    const vs = [...b.vs];
    if (o === 'h') {
      if (!(r >= 0 && r <= n && c >= 0 && c < n) || hs[r * n + c]) return;
    } else if (o === 'v') {
      if (!(r >= 0 && r < n && c >= 0 && c <= n) || vs[r * (n + 1) + c]) return;
    } else return;
    const me = b.order.indexOf(id) + 1;
    if (o === 'h') hs[r * n + c] = me;
    else vs[r * (n + 1) + c] = me;
    const full = (br: number, bc: number) => br >= 0 && br < n && bc >= 0 && bc < n && hs[br * n + bc] && hs[(br + 1) * n + bc] && vs[br * (n + 1) + bc] && vs[br * (n + 1) + bc + 1];
    const cand = o === 'h' ? [[r - 1, c], [r, c]] : [[r, c - 1], [r, c]];
    const boxes = [...b.boxes];
    let got = 0;
    cand.forEach(([br, bc]) => {
      if (full(br, bc) && !boxes[br * n + bc]) {
        boxes[br * n + bc] = me;
        got++;
      }
    });
    const next = { ...b, hs, vs, boxes };
    const extra = { hs, vs, boxes, last: { o, r, c } };
    if (boxes.every((x: number) => x)) {
      const sc = scoresOf(next);
      const best = Math.max(...sc);
      return endGame(b.order.filter((_: string, i: number) => sc[i] === best), 'full', extra);
    }
    commitP({ ...extra, turn: got ? id : nextTurn(b, id) });
  };
  const forfeit = (id: string) => {
    const b = pRef.current;
    if (b.phase !== 'play' || b.out.includes(id) || !b.order.includes(id)) return;
    const out = [...b.out, id];
    const alive = b.order.filter((x: string) => !out.includes(x));
    if (alive.length <= 1) return endGame(alive.length ? alive : [id], 'forfeit', { out });
    commitP({ out, turn: b.turn === id ? nextTurn({ ...b, out }, id) : b.turn });
  };

  // Joueur dont c'est le tour parti : il est retiré de la partie
  useEffect(() => {
    if (!isHostRef.current) return;
    const b = pRef.current;
    if (b.phase !== 'play' || !b.turn) return;
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
      ch.on('broadcast', { event: 'pp' }, ({ payload }: any) => setP(payload.p));
      ch.on('broadcast', { event: 'pp_edge' }, ({ payload }: any) => isHostRef.current && handleEdge(payload?.id, payload?.o, payload?.r, payload?.c));
      ch.on('broadcast', { event: 'pp_quit' }, ({ payload }: any) => isHostRef.current && forfeit(payload?.id));
    },
    hostSync: (ch: any) => ch.send({ type: 'broadcast', event: 'pp', payload: { p: pRef.current } }),
    reset: () => {
      setP(INITIAL_P);
      absentRef.current = 0;
    },
  };

  // ==========================================
  // ACTIONS DU JOUEUR
  // ==========================================
  const send = (event: string, host: () => void, payload: any) => (isHost ? host() : broadcast(event, { id: player.id, ...payload }));
  const phase = room ? p.phase : 'home';
  const myTurn = p.phase === 'play' && p.turn === player.id;
  const myIdx = p.order.indexOf(player.id);
  const colorOf = (id: string) => COLORS[Math.max(0, p.order.indexOf(id))];
  const scores: number[] = p.boxes.length ? scoresOf(p) : [];

  const clickEdge = (o: string, r: number, c: number) => {
    if (!myTurn) return;
    send('pp_edge', () => handleEdge(player.id, o, r, c), { o, r, c });
  };
  const leaveGame = () => {
    if (p.phase === 'play' && myIdx >= 0 && !p.out.includes(player.id)) send('pp_quit', () => forfeit(player.id), {});
    g.leaveRoom();
  };

  // Sons
  const prev = useRef({ edges: 0, boxes: 0, phase: 'lobby', turn: null as any });
  useEffect(() => {
    const edges = p.hs.filter(Boolean).length + p.vs.filter(Boolean).length;
    const boxes = p.boxes.filter(Boolean).length;
    if (p.phase === 'play' && boxes > prev.current.boxes) playSfx('success');
    else if (p.phase === 'play' && edges > prev.current.edges) playSfx('click');
    if (p.phase === 'play' && p.turn === player.id && prev.current.turn !== player.id) playSfx('whoosh');
    if (p.phase === 'over' && prev.current.phase !== 'over') {
      if (p.winners.includes(player.id)) {
        playSfx('fanfare');
        fireConfetti();
      } else playSfx('error');
    }
    prev.current = { edges, boxes, phase: p.phase, turn: p.turn };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.hs, p.vs, p.boxes, p.phase, p.turn]);

  // ==========================================
  // BRIQUES D'AFFICHAGE
  // ==========================================
  const sidebar = (
    <>
      {players.map((pl) => {
        const i = p.order.indexOf(pl.id);
        const playing = p.phase !== 'lobby' && i >= 0;
        return (
          <div key={pl.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${pl.id === player.id ? 'bg-black/25 border border-purple-400/30' : ''} ${p.turn === pl.id ? 'ring-2 ring-yellow-400/70' : ''} ${playing && p.out.includes(pl.id) ? 'opacity-40' : ''}`}>
            <PlayerDot id={pl.id} avatar={pl.avatar} size="md" />
            <span className="font-bold truncate flex-1">{pl.name}</span>
            {playing && <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i] }} />}
            {playing && <span title="Carrés" className="text-xs font-bold text-gray-200 shrink-0">◼ {scores[i] ?? 0}</span>}
            {isHost && pl.id !== player.id && <KickButton onClick={() => g.extras.kick(pl.id)} />}
            {pl.id === g.hostId && <span className="text-[9px] font-bold text-purple-300 bg-purple-900/50 px-1.5 py-0.5 rounded shrink-0">HOST</span>}
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
        <GameHome g={g} gameId={GAME_ID} eyebrow="Points & carrés" title="PIPOPIPETTE" tagline="Relie les points, ferme des carrés, rafle le plateau." soundOn={soundOn} toggleSound={toggleSound} onRules={() => setShowRules(true)} />
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
        <GameArt id="pipopipette" className="h-28 mx-auto -mt-2 mb-2" />
        <RoomCodeBlock g={g} />
        {Object.keys(p.wins).length > 0 && (
          <p className="mb-4 text-sm text-gray-300">🏆 {Object.entries(p.wins).map(([id, n]) => `${nameOf(id)} ${n}`).join(' · ')}</p>
        )}
        <p className="text-gray-400 text-sm mb-3">
          {ready ? `${Math.min(players.length, 4)} joueurs vont s’affronter${players.length > 4 ? ' (les autres regardent)' : ''}.` : 'En attente d’au moins un adversaire…'}
        </p>
        <div className="mb-5">
          <p className="text-xs uppercase tracking-wide font-bold text-gray-400 mb-2">Taille de la grille</p>
          <div className="flex justify-center gap-2 flex-wrap">
            {SIZES.map((s) => (
              <button key={s} onClick={() => setSize(s)} disabled={!isHost} className={`font-bold rounded-full px-4 py-1.5 text-sm border transition ${p.size === s ? 'bg-purple-300 !text-gray-950 border-purple-300' : 'border-gray-600 text-gray-300'} ${isHost ? 'hover:bg-purple-200 hover:!text-gray-950' : 'cursor-default'}`}>{s}×{s}</button>
            ))}
          </div>
        </div>
        <div className="text-left mb-5 bg-gray-950/70 border border-gray-800 rounded-xl p-4">
          <h3 className="flex items-center gap-2 text-gray-400 font-bold mb-3 uppercase text-sm"><Settings size={16} /> Paramètres du salon</h3>
          <RoomOptions settings={g.settings} updateSettings={g.updateSettings} isHost={isHost} />
        </div>
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

  // ----- Plateau (SVG) -----
  const n: number = p.size;
  const S = 60; // écart entre deux points
  const M = 20; // marge
  const W = n * S + 2 * M;
  const edgeColor = (v: number) => COLORS[v - 1];
  const lastIs = (o: string, r: number, c: number) => p.last && p.last.o === o && p.last.r === r && p.last.c === c;
  const edge = (o: 'h' | 'v', r: number, c: number) => {
    const x1 = M + c * S;
    const y1 = M + r * S;
    const x2 = o === 'h' ? x1 + S : x1;
    const y2 = o === 'h' ? y1 : y1 + S;
    const v = o === 'h' ? p.hs[r * n + c] : p.vs[r * (n + 1) + c];
    return (
      <g key={`${o}${r}-${c}`}>
        {v ? (
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={edgeColor(v)} strokeWidth={lastIs(o, r, c) ? 9 : 6} strokeLinecap="round" />
        ) : (
          <>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6b5a45" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" />
            {myTurn && p.phase === 'play' && (
              <line data-sfx="off" x1={x1} y1={y1} x2={x2} y2={y2} onClick={() => clickEdge(o, r, c)} strokeWidth="26" strokeLinecap="round" className="cursor-pointer stroke-transparent hover:stroke-white/40" />
            )}
          </>
        )}
      </g>
    );
  };
  const board = (
    <svg viewBox={`0 0 ${W} ${W}`} className="w-full max-w-[36rem] mx-auto rounded-xl bg-[#1a1a26] select-none" role="img" aria-label="Plateau de pipopipette">
      {p.boxes.map((v: number, k: number) => {
        if (!v) return null;
        const r = Math.floor(k / n);
        const c = k % n;
        const id = p.order[v - 1];
        return (
          <g key={`b${k}`}>
            <rect x={M + c * S + 4} y={M + r * S + 4} width={S - 8} height={S - 8} rx="6" fill={COLORS[v - 1]} fillOpacity="0.75" />
            <text x={M + c * S + S / 2} y={M + r * S + S / 2 + 7} textAnchor="middle" fontSize="20" fontWeight="bold" fill="#1b130c">{(nameOf(id) || '?').slice(0, 1).toUpperCase()}</text>
          </g>
        );
      })}
      {Array.from({ length: (n + 1) * n }, (_, k) => edge('h', Math.floor(k / n), k % n))}
      {Array.from({ length: n * (n + 1) }, (_, k) => edge('v', Math.floor(k / (n + 1)), k % (n + 1)))}
      {Array.from({ length: (n + 1) * (n + 1) }, (_, k) => (
        <circle key={`d${k}`} cx={M + (k % (n + 1)) * S} cy={M + Math.floor(k / (n + 1)) * S} r="5.5" fill="#f5f5fa" />
      ))}
    </svg>
  );

  if (phase === 'play') {
    const turnName = p.turn ? nameOf(p.turn) : '?';
    return shell(
      <div className="flex-1 min-h-0 md:overflow-y-auto w-full max-w-3xl mx-auto">
        <div className="rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between gap-3 flex-wrap text-white" style={{ backgroundColor: p.turn ? `${colorOf(p.turn)}cc` : '#444' }}>
          <span className="font-heading text-lg">{myTurn ? '👉 À toi de jouer !' : `Tour de ${turnName}`}</span>
          <span className="text-sm font-bold">{myIdx >= 0 ? `Tes carrés : ${scores[myIdx] ?? 0}` : 'Tu regardes la partie 👀'}</span>
        </div>
        {myTurn && <p className="text-xs text-gray-400 text-center mb-2">Clique entre deux points pour tracer un trait. Un carré fermé = tu rejoues !</p>}
        {board}
      </div>
    );
  }

  // phase === 'over'
  const names = p.winners.map((id: string) => nameOf(id)).join(' & ');
  return shell(
    <div className="flex-1 min-h-0 md:overflow-y-auto w-full max-w-3xl mx-auto animate-fadein">
      <div className="rounded-xl px-5 py-4 mb-3 text-center text-white" style={{ backgroundColor: p.winners[0] ? `${colorOf(p.winners[0])}cc` : '#444' }}>
        <p className="font-heading text-3xl flex items-center justify-center gap-2"><Crown /> {p.winners.length > 1 ? `Égalité : ${names}` : `${names || 'Personne'} gagne !`}</p>
        <p className="text-sm opacity-90 mt-1">{p.reason === 'forfeit' ? 'Les autres joueurs ont abandonné.' : p.order.map((id: string, i: number) => `${nameOf(id)} ${scores[i]}`).join(' · ')}</p>
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
