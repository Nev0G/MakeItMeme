'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Settings, Crown, Hand, ArrowRightLeft } from 'lucide-react';
import { makeId, PlayerDot, playSfx, useSoundAndClickFx, fireConfetti, RoomOptions, KickButton, toast, useRefState } from '@/lib/shared';
import { useGameRoom, GameHome, GameShell, RoomCodeBlock, RulesDialog, WaitingForHost } from '@/lib/gameroom';
import { deal, playCard, drawOne, passTurn, forfeitPlayer, canPlay, isWild, shuffled, COLORS, COLOR_NAME, type UnoState } from '@/lib/uno';
import { GameArt } from '@/lib/art';

const GAME_ID = 'uno';

const DEFAULT_SETTINGS = { visibility: 'private', roomName: '', chatEnabled: true };
const INITIAL_U: any = {
  phase: 'lobby', // 'lobby' | 'play' | 'over'
  gameId: null,
  game: null as UnoState | null,
  wins: {},
};

const BG: Record<string, string> = { R: '#dc2626', Y: '#eab308', G: '#16a34a', B: '#2563eb', W: '#1f2937' };
const SYMBOL: Record<string, string> = { S: '⊘', R: '⇄', D: '+2', W: '★', F: '+4' };
const label = (card: string) => SYMBOL[card[1]] || card[1];

const RULES_STEPS = [
  { title: 'Vide ta main', text: 'Chaque joueur reçoit 7 cartes. Le premier qui n’a plus de cartes gagne la manche.' },
  { title: 'Joue une carte', text: 'À ton tour, pose une carte de la même couleur ou de la même valeur que la dernière carte de la défausse. Un joker se pose à tout moment.' },
  { title: 'Cartes spéciales', text: '⊘ fait passer le tour du suivant, ⇄ inverse le sens (à 2 joueurs, tu rejoues), +2 et +4 font piocher le suivant qui passe son tour. Les jokers ★ et +4 te laissent choisir la couleur.' },
  { title: 'Rien à jouer ?', text: 'Pioche une carte : si elle se joue, tu peux la poser tout de suite, sinon tu passes ton tour.' },
  { title: 'Dernière carte', text: 'Quand il ne te reste qu’une carte, « UNO ! » est annoncé automatiquement à tout le salon.' },
];

const UnoCard = ({ card, playable = false, onClick, small = false, hidden = false }: { card?: string; playable?: boolean; onClick?: () => void; small?: boolean; hidden?: boolean }) => {
  const size = small ? 'w-12 h-[4.5rem] text-xl rounded-lg' : 'w-[4.2rem] h-[6.2rem] sm:w-20 sm:h-[7.4rem] text-3xl rounded-xl';
  const bg = hidden || !card ? '#111827' : BG[card[0]];
  const inner = hidden || !card ? (
    <span className="font-heading text-red-500 -rotate-12 text-base sm:text-lg">UNO</span>
  ) : (
    <>
      <span className="absolute top-1 left-1.5 text-xs font-bold leading-none">{label(card)}</span>
      <span className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-[62%] rounded-[50%] bg-white/90 -rotate-[24deg]" aria-hidden="true" />
      <span className="relative font-heading font-black drop-shadow" style={{ color: card[0] === 'W' ? '#111827' : bg }}>{label(card)}</span>
      <span className="absolute bottom-1 right-1.5 text-xs font-bold leading-none rotate-180">{label(card)}</span>
    </>
  );
  const cls = `relative shrink-0 flex items-center justify-center text-white border-2 border-white shadow-lg select-none ${size} ${playable ? 'cursor-pointer -translate-y-2 hover:-translate-y-4 ring-2 ring-white/80 transition-transform' : ''}`;
  return onClick ? (
    <button type="button" data-sfx="off" onClick={onClick} disabled={!playable} aria-label={card ? `${COLOR_NAME[card[0]]} ${label(card)}` : 'Carte'} className={`${cls} ${playable ? '' : 'opacity-70 cursor-not-allowed'}`} style={{ backgroundColor: bg }}>{inner}</button>
  ) : (
    <div className={cls} style={{ backgroundColor: bg }}>{inner}</div>
  );
};

export default function Uno() {
  const [u, setU, uRef] = useRefState(INITIAL_U);
  const [picking, setPicking] = useState<number | null>(null); // carte joker en attente d'une couleur
  const [showRules, setShowRules] = useState(false);
  const cbRef = useRef<any>({});
  const absentRef = useRef(0);
  const { soundOn, toggleSound } = useSoundAndClickFx();

  const g = useGameRoom({
    channelName: 'uno', gameId: GAME_ID, sessionKey: 'uno-session', defaultSettings: DEFAULT_SETTINGS,
    started: u.phase === 'play', cbRef,
  });
  const { room, players, isHost, isHostRef, broadcast, now, nameOf, avatarOf, presentIds } = g;
  const player: { id: string; name: string; avatar: string } = g.player as any;

  const commitU = (patch: any) => {
    const next = { ...uRef.current, ...patch };
    setU(next);
    broadcast('uno', { u: next });
  };

  // ==========================================
  // LOGIQUE DE JEU (le host fait foi)
  // ==========================================
  const applyGame = (game: UnoState | null) => {
    if (!game) return;
    if (game.winner) {
      const wins = { ...uRef.current.wins, [game.winner]: (uRef.current.wins[game.winner] || 0) + 1 };
      return commitU({ game, phase: 'over', wins });
    }
    commitU({ game });
  };

  const startGame = () => {
    if (!isHost) return;
    const ids = players.map((p) => p.id).slice(0, 6);
    if (ids.length < 2) {
      toast('Il faut au moins 2 joueurs.');
      return;
    }
    g.broadcast('roster', { known: g.knownRef.current });
    absentRef.current = 0;
    commitU({ phase: 'play', gameId: makeId('g'), game: deal(shuffled(ids)), wins: uRef.current.wins });
  };
  const backToLobby = () => commitU({ phase: 'lobby', game: null, gameId: null });

  const onPlay = (id: string, index: number, color?: string) => uRef.current.phase === 'play' && applyGame(playCard(uRef.current.game, id, index, color));
  const onDraw = (id: string) => uRef.current.phase === 'play' && applyGame(drawOne(uRef.current.game, id));
  const onPass = (id: string) => uRef.current.phase === 'play' && applyGame(passTurn(uRef.current.game, id));
  const forfeit = (id: string) => uRef.current.phase === 'play' && applyGame(forfeitPlayer(uRef.current.game, id));

  // Joueur dont c'est le tour parti : il est retiré de la partie
  useEffect(() => {
    if (!isHostRef.current) return;
    const b = uRef.current;
    if (b.phase !== 'play' || !b.game) return;
    const t = Date.now();
    const turn = b.game.turn;
    if (g.playersRef.current.length > 0 && !presentIds().has(turn)) {
      absentRef.current = absentRef.current || t;
      if (t - absentRef.current > 8000) {
        absentRef.current = 0;
        toast(`${nameOf(turn)} a quitté la partie.`);
        forfeit(turn);
      }
    } else absentRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // ==========================================
  // CANAL : événements du jeu
  // ==========================================
  cbRef.current = {
    attach: (ch: any) => {
      ch.on('broadcast', { event: 'uno' }, ({ payload }: any) => setU(payload.u));
      ch.on('broadcast', { event: 'uno_play' }, ({ payload }: any) => isHostRef.current && onPlay(payload?.id, payload?.index, payload?.color));
      ch.on('broadcast', { event: 'uno_draw' }, ({ payload }: any) => isHostRef.current && onDraw(payload?.id));
      ch.on('broadcast', { event: 'uno_pass' }, ({ payload }: any) => isHostRef.current && onPass(payload?.id));
      ch.on('broadcast', { event: 'uno_quit' }, ({ payload }: any) => isHostRef.current && forfeit(payload?.id));
    },
    hostSync: (ch: any) => ch.send({ type: 'broadcast', event: 'uno', payload: { u: uRef.current } }),
    reset: () => {
      setU(INITIAL_U);
      setPicking(null);
      absentRef.current = 0;
    },
  };

  // ==========================================
  // ACTIONS DU JOUEUR
  // ==========================================
  const send = (event: string, host: () => void, payload: any) => (isHost ? host() : broadcast(event, { id: player.id, ...payload }));
  const phase = room ? u.phase : 'home';
  const game: UnoState | null = u.game;
  const top = game ? game.discard[game.discard.length - 1] : '';
  const myHand: string[] = game?.hands[player.id] || [];
  const inGame = !!game && game.order.includes(player.id) && !game.out.includes(player.id);
  const myTurn = u.phase === 'play' && !!game && game.turn === player.id;

  const play = (index: number, color?: string) => {
    send('uno_play', () => onPlay(player.id, index, color), { index, color });
    setPicking(null);
  };
  const clickCard = (index: number) => {
    if (!myTurn || !game) return;
    const card = myHand[index];
    if (!canPlay(card, top, game.color)) return;
    if (isWild(card)) setPicking(index);
    else play(index);
  };
  const leaveGame = () => {
    if (u.phase === 'play' && inGame) send('uno_quit', () => forfeit(player.id), {});
    g.leaveRoom();
  };

  // Sons et annonce « UNO ! »
  const prev = useRef({ top: '', phase: 'lobby', turn: null as any, counts: {} as Record<string, number> });
  useEffect(() => {
    if (game) {
      if (u.phase === 'play' && game.turn === player.id && prev.current.turn !== player.id) playSfx('whoosh');
      else if (top && top !== prev.current.top) playSfx('click');
      game.order.forEach((id) => {
        const n = game.hands[id]?.length ?? 0;
        if (n === 1 && (prev.current.counts[id] ?? 0) > 1 && u.phase === 'play') {
          toast(`${id === player.id ? 'Tu as' : `${nameOf(id)} a`} UNO ! 🃏`);
          playSfx('success');
        }
      });
      prev.current.counts = Object.fromEntries(game.order.map((id) => [id, game.hands[id]?.length ?? 0]));
    }
    if (u.phase === 'over' && prev.current.phase !== 'over') {
      if (game?.winner === player.id) {
        playSfx('fanfare');
        fireConfetti();
      } else playSfx('error');
    }
    prev.current.top = top;
    prev.current.phase = u.phase;
    prev.current.turn = game?.turn ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, u.phase]);

  // ==========================================
  // BRIQUES D'AFFICHAGE
  // ==========================================
  const sidebar = (
    <>
      {players.map((p) => {
        const inPlay = u.phase !== 'lobby' && !!game && game.order.includes(p.id);
        const out = inPlay && game!.out.includes(p.id);
        return (
          <div key={p.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${p.id === player.id ? 'bg-black/25 border border-purple-400/30' : ''} ${game?.turn === p.id ? 'ring-2 ring-yellow-400/70' : ''} ${out ? 'opacity-40' : ''}`}>
            <PlayerDot id={p.id} avatar={p.avatar} size="md" />
            <span className="font-bold truncate flex-1">{p.name}</span>
            {inPlay && !out && <span title="Cartes en main" className="text-xs font-bold text-gray-200 shrink-0">🃏 {game!.hands[p.id]?.length ?? 0}</span>}
            {u.wins[p.id] > 0 && <span className="text-xs text-gray-300 shrink-0">🏆{u.wins[p.id]}</span>}
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
        <GameHome g={g} gameId={GAME_ID} eyebrow="Jeu de cartes" title="UNO" tagline="Défausse toutes tes cartes avant les autres." soundOn={soundOn} toggleSound={toggleSound} onRules={() => setShowRules(true)} />
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
        <GameArt id="uno" className="h-28 mx-auto -mt-2 mb-2" />
        <RoomCodeBlock g={g} />
        {Object.keys(u.wins).length > 0 && (
          <p className="mb-4 text-sm text-gray-300">🏆 {Object.entries(u.wins).map(([id, n]) => `${nameOf(id)} ${n}`).join(' · ')}</p>
        )}
        <p className="text-gray-400 text-sm mb-5">
          {ready ? `${Math.min(players.length, 6)} joueurs vont jouer${players.length > 6 ? ' (les autres regardent)' : ''}.` : 'En attente d’au moins un adversaire…'}
        </p>
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

  if (!game) return shell(<WaitingForHost />);

  const sorted = myHand.map((card, i) => ({ card, i })).sort((a, b) => a.card.localeCompare(b.card));
  const canDrawNow = myTurn && !game.drew;
  const board = (
    <div className="flex-1 min-h-0 md:overflow-y-auto w-full max-w-4xl mx-auto flex flex-col gap-4">
      {/* Adversaires */}
      <div className="flex flex-wrap gap-2 justify-center">
        {game.order.filter((id) => id !== player.id).map((id) => (
          <div key={id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${game.turn === id ? 'border-yellow-400 bg-yellow-400/10' : 'border-gray-800 bg-gray-950/50'} ${game.out.includes(id) ? 'opacity-40' : ''}`}>
            <PlayerDot id={id} avatar={avatarOf(id)} />
            <span className="text-sm font-bold max-w-[7rem] truncate">{nameOf(id)}</span>
            <span className="text-xs font-bold bg-gray-800 rounded-full px-2 py-0.5">🃏 {game.hands[id]?.length ?? 0}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="paper p-5 flex flex-col items-center gap-3">
        <div className="flex items-center gap-4 sm:gap-8">
          <button
            type="button"
            data-sfx="off"
            disabled={!canDrawNow}
            onClick={() => send('uno_draw', () => onDraw(player.id), {})}
            aria-label="Piocher une carte"
            className={`relative ${canDrawNow ? 'cursor-pointer hover:-translate-y-1 transition-transform ring-2 ring-white/70 rounded-xl' : 'opacity-80 cursor-default'}`}
          >
            <UnoCard hidden />
            <span className="absolute -bottom-2 -right-2 text-[11px] font-bold bg-gray-900 border border-gray-700 rounded-full px-2 py-0.5">{game.deck.length}</span>
          </button>
          <UnoCard card={top} />
          <div className="flex flex-col items-center gap-1.5" title="Couleur à jouer">
            <span className="w-10 h-10 rounded-full border-2 border-white shadow-lg" style={{ backgroundColor: BG[game.color] }} />
            <span className="text-[11px] font-bold text-gray-300">{COLOR_NAME[game.color]}</span>
            <ArrowRightLeft size={16} className={`text-gray-400 ${game.dir === -1 ? '-scale-x-100' : ''}`} aria-label="Sens du jeu" />
          </div>
        </div>
        <p className="text-sm font-bold h-5">
          {myTurn ? '👉 À toi de jouer !' : `Tour de ${nameOf(game.turn)}`}
          {game.log ? <span className="text-gray-400 font-normal"> · {game.log}</span> : null}
        </p>
        {myTurn && game.drew && (
          <button onClick={() => send('uno_pass', () => onPass(player.id), {})} className="flex items-center gap-2 rounded-full border border-gray-600 px-4 py-1.5 text-sm font-bold hover:bg-white/10 active:scale-95 transition cursor-pointer"><Hand size={15} /> Passer mon tour</button>
        )}
        {canDrawNow && !myHand.some((c) => canPlay(c, top, game.color)) && <p className="text-xs text-gray-400">Aucune carte jouable : pioche !</p>}
      </div>

      {/* Ma main */}
      {inGame ? (
        <div className="paper p-4 pt-6">
          <p className="eyebrow mb-3 text-center">Ta main · {myHand.length} carte{myHand.length > 1 ? 's' : ''}</p>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-2.5">
            {sorted.map(({ card, i }) => (
              <UnoCard key={`${card}-${i}`} card={card} onClick={() => clickCard(i)} playable={myTurn && canPlay(card, top, game.color)} />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-center text-sm text-gray-400">Tu regardes la partie 👀</p>
      )}

      {picking !== null && (
        <div className="fixed inset-0 z-[950] bg-black/70 flex items-center justify-center p-4" onClick={() => setPicking(null)}>
          <div onClick={(e) => e.stopPropagation()} className="paper p-6 text-center animate-rise">
            <p className="font-heading text-xl mb-4">Choisis une couleur</p>
            <div className="grid grid-cols-2 gap-3">
              {COLORS.map((c) => (
                <button key={c} data-sfx="off" onClick={() => play(picking, c)} className="w-24 h-16 rounded-xl border-2 border-white font-bold text-white shadow-lg hover:scale-105 active:scale-95 transition cursor-pointer" style={{ backgroundColor: BG[c] }}>{COLOR_NAME[c]}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (phase === 'play') return shell(board);

  const winner = game.winner;
  return shell(
    <div className="flex-1 min-h-0 md:overflow-y-auto w-full max-w-4xl mx-auto animate-fadein flex flex-col gap-4">
      <div className="rounded-xl px-5 py-4 text-center bg-yellow-400 text-gray-950">
        <p className="font-heading text-3xl flex items-center justify-center gap-2"><Crown /> {winner ? `${nameOf(winner)} gagne !` : 'Partie terminée'}</p>
        <p className="text-sm font-semibold mt-1">{game.log}</p>
      </div>
      <div className="paper p-4">
        <p className="eyebrow mb-2">Cartes restantes</p>
        <ul className="space-y-1.5">
          {game.order.map((id) => (
            <li key={id} className="flex items-center gap-2 text-sm">
              <PlayerDot id={id} avatar={avatarOf(id)} /> <span className="font-bold flex-1 truncate">{nameOf(id)}</span>
              <span className="text-gray-300">{id === winner ? '🎉 0' : `🃏 ${game.hands[id]?.length ?? 0}`}</span>
            </li>
          ))}
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
