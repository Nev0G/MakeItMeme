'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Settings, Crown } from 'lucide-react';
import { makeId, shuffle, PlayerDot, playSfx, useSoundAndClickFx, fireConfetti, RoomOptions, KickButton, toast, useRefState } from '@/lib/shared';
import { useGameRoom, GameHome, GameShell, RoomCodeBlock, RulesDialog, WaitingForHost } from '@/lib/gameroom';
import { SIZES, dimsOf, emptyBoard, dropRow, winLine, winAny, isFull, popOut, autoColumn } from '@/lib/connect4';
import { ChoiceRow, VariantsPanel, TimerRow, TurnClock, nextDeadline, timerOf } from '@/lib/variants';
import { GameArt } from '@/lib/art';

const GAME_ID = 'puissance4';

const DEFAULT_SETTINGS = { visibility: 'private', roomName: '', chatEnabled: true, size: 'classic', pop: false, timer: 0 };
const INITIAL_C: any = {
  phase: 'lobby', // 'lobby' | 'play' | 'over'
  gameId: null,
  order: [], // [id du joueur rouge, id du joueur jaune]
  board: [], // 42 cases : 0 vide, 1 rouge, 2 jaune
  turn: null,
  winner: null, // id, ou null en cas de match nul
  line: [],
  reason: null, // 'four' | 'draw' | 'forfeit'
  last: -1, // dernière case jouée
  wins: {},
  started: 0, // nombre de parties jouées (alterne le joueur qui commence)
  opts: { size: 'classic', pop: false, timer: 0 }, // variantes de la partie en cours
  deadline: null, // fin du tour (si chronomètre)
};

const DISC = ['', '#ef4444', '#fbbf24'];
const DISC_NAME = ['', 'Rouge', 'Jaune'];

const RULES_STEPS = [
  { title: 'Deux joueurs, deux couleurs', text: 'Un joueur joue les jetons rouges, l’autre les jaunes. Les autres joueurs du salon regardent.' },
  { title: 'Fais tomber un jeton', text: 'À ton tour, clique sur une colonne : le jeton tombe tout en bas, ou sur le dernier jeton posé.' },
  { title: 'Aligne quatre jetons', text: 'Le premier qui aligne 4 jetons de sa couleur (horizontalement, verticalement ou en diagonale) gagne.' },
  { title: 'Match nul', text: 'Si la grille est pleine sans alignement, personne ne gagne.' },
  { title: 'Variantes', text: 'Le host peut choisir la taille de la grille (et le nombre de jetons à aligner), activer le Pop-out (retirer un de tes jetons de la rangée du bas, les autres descendent) et fixer un temps par tour.' },
];

export default function Puissance4() {
  const [c, setC, cRef] = useRefState(INITIAL_C);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);
  const cbRef = useRef<any>({});
  const absentRef = useRef(0);
  const { soundOn, toggleSound } = useSoundAndClickFx();

  const g = useGameRoom({
    channelName: 'puissance4', gameId: GAME_ID, sessionKey: 'puissance4-session', defaultSettings: DEFAULT_SETTINGS,
    started: c.phase === 'play', cbRef,
  });
  const { room, players, isHost, isHostRef, broadcast, now, nameOf, presentIds } = g;
  const player: { id: string; name: string; avatar: string } = g.player as any;

  const commitC = (patch: any) => {
    const next = { ...cRef.current, ...patch };
    // Chaque coup relance le chronomètre
    next.deadline = next.phase === 'play' && next.turn ? nextDeadline(next.opts?.timer) : null;
    setC(next);
    broadcast('c4', { c: next });
  };

  // ==========================================
  // LOGIQUE DE JEU (le host fait foi)
  // ==========================================
  const endGame = (winner: string | null, reason: string, extra: any = {}) => {
    const wins = { ...cRef.current.wins };
    if (winner) wins[winner] = (wins[winner] || 0) + 1;
    commitC({ ...extra, phase: 'over', winner, reason, turn: null, wins });
  };

  const startGame = () => {
    if (!isHost) return;
    if (players.length < 2) {
      toast('Il faut 2 joueurs.');
      return;
    }
    const b = cRef.current;
    // Rejouer : mêmes joueurs si encore présents, le premier joueur change à chaque partie
    const keep = b.order.filter((id: string) => presentIds().has(id));
    let order = keep.length === 2 ? [...b.order] : shuffle(players.map((p) => p.id)).slice(0, 2);
    if (b.gameId && keep.length === 2) order = [order[1], order[0]];
    g.broadcast('roster', { known: g.knownRef.current });
    absentRef.current = 0;
    const st = g.settingsRef.current;
    const opts = { size: SIZES[st.size] ? st.size : 'classic', pop: !!st.pop, timer: timerOf(st) };
    commitC({ ...INITIAL_C, phase: 'play', gameId: makeId('g'), order, board: emptyBoard(dimsOf(opts.size)), turn: order[0], wins: b.wins, opts });
  };
  const backToLobby = () => commitC({ ...INITIAL_C, wins: cRef.current.wins });

  const handleDrop = (id: string, col: number) => {
    const b = cRef.current;
    if (b.phase !== 'play' || b.turn !== id) return;
    const d = dimsOf(b.opts.size);
    const row = dropRow(b.board, col, d);
    if (row < 0) return;
    const me = b.order.indexOf(id) + 1;
    const board = [...b.board];
    board[row * d.cols + col] = me;
    const extra = { board, last: row * d.cols + col };
    const line = winLine(board, row, col, d);
    if (line) return endGame(id, 'four', { ...extra, line });
    if (isFull(board)) return endGame(null, 'draw', extra);
    commitC({ ...extra, turn: b.order[me % 2] });
  };
  // Pop-out : retire son propre jeton de la rangée du bas
  const handlePop = (id: string, col: number) => {
    const b = cRef.current;
    if (b.phase !== 'play' || b.turn !== id || !b.opts.pop) return;
    const d = dimsOf(b.opts.size);
    const me = b.order.indexOf(id) + 1;
    const board = popOut(b.board, col, me, d);
    if (!board) return;
    const extra = { board, last: -1 };
    const mine = winAny(board, me, d);
    const theirs = winAny(board, 3 - me, d);
    if (mine) return endGame(id, 'four', { ...extra, line: mine });
    if (theirs) return endGame(b.order[2 - me], 'four', { ...extra, line: theirs });
    commitC({ ...extra, turn: b.order[me % 2] });
  };
  const forfeit = (id: string) => {
    const b = cRef.current;
    if (b.phase !== 'play' || !b.order.includes(id)) return;
    endGame(b.order.find((x: string) => x !== id) || null, 'forfeit');
  };

  // Joueur dont c'est le tour parti : il abandonne
  useEffect(() => {
    if (!isHostRef.current) return;
    const b = cRef.current;
    if (b.phase !== 'play' || !b.turn) return;
    // Temps écoulé : coup automatique
    if (b.deadline && Date.now() > b.deadline) {
      const col = autoColumn(b.board, dimsOf(b.opts.size));
      if (col >= 0) {
        toast(`${nameOf(b.turn)} a été trop lent : coup automatique.`);
        return handleDrop(b.turn, col);
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
      ch.on('broadcast', { event: 'c4' }, ({ payload }: any) => setC(payload.c));
      ch.on('broadcast', { event: 'c4_drop' }, ({ payload }: any) => isHostRef.current && handleDrop(payload?.id, payload?.col));
      ch.on('broadcast', { event: 'c4_pop' }, ({ payload }: any) => isHostRef.current && handlePop(payload?.id, payload?.col));
      ch.on('broadcast', { event: 'c4_quit' }, ({ payload }: any) => isHostRef.current && forfeit(payload?.id));
    },
    hostSync: (ch: any) => ch.send({ type: 'broadcast', event: 'c4', payload: { c: cRef.current } }),
    reset: () => {
      setC(INITIAL_C);
      setHoverCol(null);
      absentRef.current = 0;
    },
  };

  // ==========================================
  // ACTIONS DU JOUEUR
  // ==========================================
  const send = (event: string, host: () => void, payload: any) => (isHost ? host() : broadcast(event, { id: player.id, ...payload }));
  const phase = room ? c.phase : 'home';
  const myTurn = c.phase === 'play' && c.turn === player.id;
  const myIdx = c.order.indexOf(player.id);
  const opts = c.phase === 'lobby' ? { size: g.settings.size, pop: !!g.settings.pop, timer: timerOf(g.settings) } : c.opts;
  const dims = dimsOf(opts.size);
  const board: number[] = c.board.length ? c.board : emptyBoard(dims);

  const clickCol = (col: number) => {
    if (!myTurn || dropRow(board, col, dims) < 0) return;
    send('c4_drop', () => handleDrop(player.id, col), { col });
  };
  const clickPop = (col: number) => {
    if (!myTurn) return;
    send('c4_pop', () => handlePop(player.id, col), { col });
  };
  const leaveGame = () => {
    if (c.phase === 'play' && myIdx >= 0) send('c4_quit', () => forfeit(player.id), {});
    g.leaveRoom();
  };

  // Sons
  const prev = useRef({ last: -1, phase: 'lobby', turn: null as any });
  useEffect(() => {
    if (c.last >= 0 && c.last !== prev.current.last) playSfx('click');
    if (c.phase === 'play' && c.turn === player.id && prev.current.turn !== player.id) playSfx('whoosh');
    if (c.phase === 'over' && prev.current.phase !== 'over') {
      if (c.winner === player.id) {
        playSfx('fanfare');
        fireConfetti();
      } else playSfx('error');
    }
    prev.current = { last: c.last, phase: c.phase, turn: c.turn };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.last, c.phase, c.turn]);

  // ==========================================
  // BRIQUES D'AFFICHAGE
  // ==========================================
  const sidebar = (
    <>
      {players.map((p) => {
        const i = c.order.indexOf(p.id);
        const playing = c.phase !== 'lobby' && i >= 0;
        return (
          <div key={p.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${p.id === player.id ? 'bg-black/25 border border-purple-400/30' : ''} ${c.turn === p.id ? 'ring-2 ring-yellow-400/70' : ''}`}>
            <PlayerDot id={p.id} avatar={p.avatar} size="md" />
            <span className="font-bold truncate flex-1">{p.name}</span>
            {playing && <span title={DISC_NAME[i + 1]} className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: DISC[i + 1] }} />}
            {c.wins[p.id] > 0 && <span className="text-xs text-gray-300 shrink-0">🏆{c.wins[p.id]}</span>}
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
        <GameHome g={g} gameId={GAME_ID} eyebrow="Duel de stratégie" title="PUISSANCE 4" tagline="Aligne quatre jetons avant ton adversaire." soundOn={soundOn} toggleSound={toggleSound} onRules={() => setShowRules(true)} />
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
        <GameArt id="puissance4" className="h-28 mx-auto -mt-2 mb-2 float-y" />
        <RoomCodeBlock g={g} />
        {Object.keys(c.wins).length > 0 && (
          <p className="mb-4 text-sm text-gray-300">🏆 {Object.entries(c.wins).map(([id, n]) => `${nameOf(id)} ${n}`).join(' · ')}</p>
        )}
        <p className="text-gray-400 text-sm mb-5">
          {ready ? `Les 2 premiers joueurs s’affrontent${players.length > 2 ? ' (les autres regardent)' : ''}.` : 'En attente d’un adversaire…'}
        </p>
        <div className="text-left mb-5 bg-gray-950/70 border border-gray-800 rounded-xl p-4">
          <h3 className="flex items-center gap-2 text-gray-400 font-bold mb-3 uppercase text-sm"><Settings size={16} /> Paramètres du salon</h3>
          <RoomOptions settings={g.settings} updateSettings={g.updateSettings} isHost={isHost} />
        </div>
        <VariantsPanel isHost={isHost}>
          <ChoiceRow label="Grille" hint="Plus la grille est grande, plus il faut aligner de jetons." value={g.settings.size || 'classic'} options={Object.entries(SIZES).map(([value, v]) => ({ value, label: v.label }))} onChange={(v) => g.updateSettings({ size: v })} disabled={!isHost} />
          <ChoiceRow label="Mode Pop-out" hint="Tu peux retirer un de tes jetons de la rangée du bas : les autres descendent d’un cran." value={g.settings.pop ? 'on' : 'off'} options={[{ value: 'off', label: 'Non' }, { value: 'on', label: 'Oui' }]} onChange={(v) => g.updateSettings({ pop: v === 'on' })} disabled={!isHost} />
          <TimerRow value={timerOf(g.settings)} onChange={(v) => g.updateSettings({ timer: v })} disabled={!isHost} />
        </VariantsPanel>
        {isHost ? (
          <button onClick={startGame} disabled={!ready} className="w-full bg-purple-300 hover:bg-purple-200 !text-gray-950 shadow-md disabled:opacity-50 active:scale-95 font-black py-4 px-6 rounded-lg text-lg transition">
            {ready ? 'Lancer la partie !' : 'Il faut 2 joueurs…'}
          </button>
        ) : (
          <WaitingForHost />
        )}
        <button onClick={() => setShowRules(true)} className="mt-4 text-gray-400 hover:text-purple-300 text-sm font-bold transition">Comment jouer ?</button>
      </div>
    );
  }

  // ----- Plateau -----
  const winSet = new Set<number>(c.line);
  const colsStyle = { gridTemplateColumns: `repeat(${dims.cols}, minmax(0, 1fr))` };
  const bottomOf = (col: number) => board[(dims.rows - 1) * dims.cols + col];
  const grid = (
    <div className="w-full mx-auto select-none" style={{ maxWidth: `${Math.min(40, 4.9 * dims.cols)}rem` }} onMouseLeave={() => setHoverCol(null)}>
      {/* Jeton « fantôme » au-dessus de la colonne survolée */}
      <div className="grid gap-1.5 sm:gap-2 px-2 h-9 sm:h-11 mb-1" style={colsStyle} aria-hidden="true">
        {Array.from({ length: dims.cols }, (_, col) => (
          <div key={col} className="flex items-center justify-center">
            {myTurn && hoverCol === col && dropRow(board, col, dims) >= 0 && (
              <span className="w-[70%] aspect-square rounded-full opacity-80" style={{ backgroundColor: DISC[myIdx + 1] }} />
            )}
          </div>
        ))}
      </div>
      <div className="grid gap-1.5 sm:gap-2 p-2 rounded-2xl bg-blue-600 shadow-xl ring-4 ring-blue-800/60" style={colsStyle}>
        {Array.from({ length: dims.cols * dims.rows }, (_, k) => {
          const col = k % dims.cols;
          const v = board[k];
          const full = dropRow(board, col, dims) < 0;
          return (
            <button
              key={k}
              data-sfx="off"
              disabled={!myTurn || full}
              aria-label={`Colonne ${col + 1}`}
              onClick={() => clickCol(col)}
              onMouseEnter={() => setHoverCol(col)}
              onFocus={() => setHoverCol(col)}
              className={`relative aspect-square rounded-full bg-gray-950 shadow-inner flex items-center justify-center ${myTurn && !full ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {v > 0 && (
                <span
                  className={`absolute inset-[6%] rounded-full shadow-md ${k === c.last ? 'c4-drop' : ''} ${winSet.has(k) ? 'ring-4 ring-white animate-pulse' : ''}`}
                  style={{ backgroundColor: DISC[v], ['--drop' as any]: `${(Math.floor(k / dims.cols) + 1) * 105}%` }}
                />
              )}
            </button>
          );
        })}
      </div>
      {/* Pop-out : retirer un de ses jetons du bas */}
      {opts.pop && c.phase === 'play' && (
        <div className="grid gap-1.5 sm:gap-2 px-2 mt-1.5" style={colsStyle}>
          {Array.from({ length: dims.cols }, (_, col) => {
            const can = myTurn && bottomOf(col) === myIdx + 1;
            return (
              <button key={col} type="button" data-sfx="off" disabled={!can} onClick={() => clickPop(col)} aria-label={`Retirer mon jeton de la colonne ${col + 1}`}
                className={`h-7 rounded-lg text-xs font-bold transition ${can ? 'bg-white/15 hover:bg-white/30 cursor-pointer active:scale-95' : 'opacity-20 cursor-default'}`}>⬇</button>
            );
          })}
        </div>
      )}
    </div>
  );

  if (phase === 'play') {
    const turnIdx = c.order.indexOf(c.turn);
    return shell(
      <div className="flex-1 min-h-0 md:overflow-y-auto w-full max-w-3xl mx-auto">
        <div className="rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between gap-3 flex-wrap text-gray-950 font-bold" style={{ backgroundColor: DISC[turnIdx + 1] }}>
          <span className="font-heading text-lg">{myTurn ? '👉 À toi de jouer !' : `Tour de ${nameOf(c.turn)}`}</span>
          <span className="text-sm flex items-center gap-2">{myIdx >= 0 ? `Tu joues les jetons ${DISC_NAME[myIdx + 1].toLowerCase()}s` : 'Tu regardes la partie 👀'}<TurnClock deadline={c.deadline} now={now} /></span>
        </div>
        {grid}
      </div>
    );
  }

  const w = c.winner;
  return shell(
    <div className="flex-1 min-h-0 md:overflow-y-auto w-full max-w-3xl mx-auto animate-fadein">
      <div className="rounded-xl px-5 py-4 mb-3 text-center text-gray-950" style={{ backgroundColor: w ? DISC[c.order.indexOf(w) + 1] : '#cbd5e1' }}>
        <p className="font-heading text-3xl flex items-center justify-center gap-2">{w ? <><Crown /> {nameOf(w)} gagne !</> : 'Match nul'}</p>
        <p className="text-sm opacity-80 mt-1 font-semibold">{c.reason === 'forfeit' ? 'Son adversaire a abandonné.' : c.reason === 'draw' ? 'La grille est pleine.' : `${dims.need} jetons alignés !`}</p>
      </div>
      {grid}
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
