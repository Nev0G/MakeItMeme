'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Settings, Crown, Skull, Megaphone } from 'lucide-react';
import { makeId, shuffle, PlayerDot, playSfx, useSoundAndClickFx, fireConfetti, RoomOptions, KickButton, toast, useRefState } from '@/lib/shared';
import { useGameRoom, GameHome, GameShell, RoomCodeBlock, RulesDialog, WaitingForHost } from '@/lib/gameroom';
import { newGame, playCards, callLiar, afterReveal, forfeitPlayer, mustCallLiar, aliveOf, CARD_NAME, CHAMBERS, type LiarState, type Card } from '@/lib/liarsbar';
import { GameArt } from '@/lib/art';

const GAME_ID = 'liars-bar';

const DEFAULT_SETTINGS = { visibility: 'private', roomName: '', chatEnabled: true };
const INITIAL_L: any = {
  phase: 'lobby', // 'lobby' | 'play' | 'over'
  gameId: null,
  game: null as LiarState | null,
  wins: {},
};

const FACE: Record<string, { bg: string; fg: string; symbol: string }> = {
  K: { bg: '#fbbf24', fg: '#422006', symbol: 'R' },
  Q: { bg: '#f472b6', fg: '#500724', symbol: 'D' },
  A: { bg: '#60a5fa', fg: '#172554', symbol: 'A' },
  J: { bg: '#a78bfa', fg: '#2e1065', symbol: '★' },
};
const TABLE_LABEL: Record<string, string> = { K: 'ROI', Q: 'DAME', A: 'AS' };

const RULES_STEPS = [
  { title: 'Une carte à la table', text: 'Chaque manche annonce un type de carte : Roi, Dame ou As. Chacun reçoit 5 cartes.' },
  { title: 'Pose et bluffe', text: 'À ton tour, pose 1 à 3 cartes face cachée en prétendant que ce sont toutes des cartes du type de la table. Tu peux mentir !' },
  { title: 'Menteur !', text: 'Au lieu de jouer, tu peux traiter le joueur précédent de menteur. Ses cartes sont retournées. Les Jokers comptent comme n’importe quelle carte.' },
  { title: 'La roulette', text: 'Si le joueur mentait, c’est lui qui tire sur son revolver. S’il disait vrai, c’est toi. 6 chambres, 1 balle : chaque tir sans effet augmente le risque suivant.' },
  { title: 'Plus de cartes ?', text: 'Si ta main est vide, tu dois traiter le joueur précédent de menteur.' },
  { title: 'Dernier debout', text: 'Une balle et tu es éliminé. Le dernier joueur en vie remporte la partie (2 à 4 joueurs).' },
];

const LbCard = ({ c, hidden = false, selected = false, onClick, small = false }: { c?: Card; hidden?: boolean; selected?: boolean; onClick?: () => void; small?: boolean }) => {
  const f = c ? FACE[c] : null;
  const size = small ? 'w-9 h-12 text-base rounded-md' : 'w-14 h-20 sm:w-16 sm:h-24 text-2xl rounded-lg';
  const style = hidden || !f ? { background: 'repeating-linear-gradient(45deg,#1f2937,#1f2937 5px,#111827 5px,#111827 10px)' } : { backgroundColor: f.bg, color: f.fg };
  const cls = `relative shrink-0 flex items-center justify-center border-2 border-white/80 shadow-lg font-heading font-black select-none ${size} ${selected ? '-translate-y-3 ring-2 ring-purple-300' : ''} ${onClick ? 'cursor-pointer transition-transform hover:-translate-y-1.5' : ''}`;
  const inner = hidden || !f ? <span className="text-red-500/70 text-xs">♠</span> : <span>{f.symbol}</span>;
  return onClick ? (
    <button type="button" data-sfx="off" onClick={onClick} aria-pressed={selected} aria-label={c ? CARD_NAME[c] : 'Carte'} className={cls} style={style}>{inner}</button>
  ) : (
    <div className={cls} style={style}>{inner}</div>
  );
};

// Barillet : une pastille par chambre, grisée quand elle a déjà été tirée
const Cylinder = ({ shots }: { shots: number }) => (
  <span className="inline-flex gap-[3px]" title={`${CHAMBERS - shots} chambre${CHAMBERS - shots > 1 ? 's' : ''} restante${CHAMBERS - shots > 1 ? 's' : ''}`} aria-label={`${shots} tir${shots > 1 ? 's' : ''} déjà effectué${shots > 1 ? 's' : ''}`}>
    {Array.from({ length: CHAMBERS }, (_, i) => (
      <span key={i} className={`w-2 h-2 rounded-full border ${i < shots ? 'bg-gray-600 border-gray-600' : 'bg-red-500/80 border-red-400'}`} />
    ))}
  </span>
);

export default function LiarsBar() {
  const [l, setL, lRef] = useRefState(INITIAL_L);
  const [sel, setSel] = useState<number[]>([]);
  const [showRules, setShowRules] = useState(false);
  const cbRef = useRef<any>({});
  const absentRef = useRef(0);
  const { soundOn, toggleSound } = useSoundAndClickFx();

  const g = useGameRoom({
    channelName: 'liars-bar', gameId: GAME_ID, sessionKey: 'liarsbar-session', defaultSettings: DEFAULT_SETTINGS,
    started: l.phase === 'play', cbRef,
  });
  const { room, players, isHost, isHostRef, broadcast, now, nameOf, avatarOf, presentIds } = g;
  const player: { id: string; name: string; avatar: string } = g.player as any;

  const commitL = (patch: any) => {
    const next = { ...lRef.current, ...patch };
    setL(next);
    broadcast('lb', { l: next });
  };

  // ==========================================
  // LOGIQUE DE JEU (le host fait foi)
  // ==========================================
  const applyGame = (game: LiarState | null) => {
    if (!game) return;
    if (game.winner) {
      const wins = { ...lRef.current.wins, [game.winner]: (lRef.current.wins[game.winner] || 0) + 1 };
      return commitL({ game, phase: 'over', wins });
    }
    commitL({ game });
  };

  const startGame = () => {
    if (!isHost) return;
    const ids = players.map((p) => p.id).slice(0, 4);
    if (ids.length < 2) {
      toast('Il faut au moins 2 joueurs.');
      return;
    }
    g.broadcast('roster', { known: g.knownRef.current });
    absentRef.current = 0;
    commitL({ phase: 'play', gameId: makeId('g'), game: newGame(shuffle(ids)), wins: lRef.current.wins });
  };
  const backToLobby = () => commitL({ phase: 'lobby', game: null, gameId: null });

  const playing = () => lRef.current.phase === 'play' && lRef.current.game;
  const onPlay = (id: string, idxs: number[]) => playing() && applyGame(playCards(lRef.current.game, id, Array.isArray(idxs) ? idxs.map(Number) : []));
  const onCall = (id: string) => playing() && applyGame(callLiar(lRef.current.game, id, Date.now() + 7500));
  const forfeit = (id: string) => playing() && applyGame(forfeitPlayer(lRef.current.game, id));

  // Fin de l'épreuve (le host enchaîne) + joueur dont c'est le tour parti
  useEffect(() => {
    if (!isHostRef.current) return;
    const b = lRef.current;
    const game: LiarState | null = b.game;
    if (b.phase !== 'play' || !game) return;
    if (game.reveal) {
      if (Date.now() >= game.reveal.until) {
        let next = afterReveal(game);
        // Un joueur parti pendant l'épreuve est retiré maintenant
        next.order.filter((id) => !next.out.includes(id) && !presentIds().has(id) && g.playersRef.current.length > 0).forEach((id) => (next = forfeitPlayer(next, id)));
        applyGame(next);
      }
      return;
    }
    const t = Date.now();
    if (g.playersRef.current.length > 0 && !presentIds().has(game.turn)) {
      absentRef.current = absentRef.current || t;
      if (t - absentRef.current > 8000) {
        absentRef.current = 0;
        toast(`${nameOf(game.turn)} a quitté la partie.`);
        forfeit(game.turn);
      }
    } else absentRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // ==========================================
  // CANAL : événements du jeu
  // ==========================================
  cbRef.current = {
    attach: (ch: any) => {
      ch.on('broadcast', { event: 'lb' }, ({ payload }: any) => setL(payload.l));
      ch.on('broadcast', { event: 'lb_play' }, ({ payload }: any) => isHostRef.current && onPlay(payload?.id, payload?.idxs));
      ch.on('broadcast', { event: 'lb_call' }, ({ payload }: any) => isHostRef.current && onCall(payload?.id));
      ch.on('broadcast', { event: 'lb_quit' }, ({ payload }: any) => isHostRef.current && forfeit(payload?.id));
    },
    hostSync: (ch: any) => ch.send({ type: 'broadcast', event: 'lb', payload: { l: lRef.current } }),
    reset: () => {
      setL(INITIAL_L);
      setSel([]);
      absentRef.current = 0;
    },
  };

  // ==========================================
  // ACTIONS DU JOUEUR
  // ==========================================
  const send = (event: string, host: () => void, payload: any) => (isHost ? host() : broadcast(event, { id: player.id, ...payload }));
  const phase = room ? l.phase : 'home';
  const game: LiarState | null = l.game;
  const inGame = !!game && game.order.includes(player.id) && !game.out.includes(player.id);
  const myHand: Card[] = game?.hands[player.id] || [];
  const myTurn = l.phase === 'play' && !!game && !game.reveal && game.turn === player.id && inGame;
  const forced = !!game && myTurn && mustCallLiar(game, player.id);

  useEffect(() => setSel([]), [game?.turn, game?.round]);

  const toggle = (i: number) => {
    if (!myTurn || forced) return;
    setSel((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : cur.length >= 3 ? cur : [...cur, i]));
  };
  const doPlay = () => {
    if (!sel.length) return;
    const idxs = sel;
    setSel([]);
    send('lb_play', () => onPlay(player.id, idxs), { idxs });
  };
  const doCall = () => send('lb_call', () => onCall(player.id), {});
  const leaveGame = () => {
    if (l.phase === 'play' && inGame) send('lb_quit', () => forfeit(player.id), {});
    g.leaveRoom();
  };

  // Sons
  const prev = useRef({ turn: null as any, phase: 'lobby', reveal: false });
  useEffect(() => {
    const rv = game?.reveal;
    if (l.phase === 'play' && game && !rv && game.turn === player.id && prev.current.turn !== player.id) playSfx('whoosh');
    if (rv && !prev.current.reveal) {
      playSfx('error');
      setTimeout(() => playSfx(rv.hit ? 'buzzer' : 'success'), 2600);
    }
    if (l.phase === 'over' && prev.current.phase !== 'over') {
      if (game?.winner === player.id) {
        playSfx('fanfare');
        fireConfetti();
      }
    }
    prev.current = { turn: game?.turn ?? null, phase: l.phase, reveal: !!rv };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, l.phase]);

  // ==========================================
  // BRIQUES D'AFFICHAGE
  // ==========================================
  const sidebar = (
    <>
      {players.map((p) => {
        const inPlay = l.phase !== 'lobby' && !!game && game.order.includes(p.id);
        const dead = inPlay && game!.out.includes(p.id);
        return (
          <div key={p.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${p.id === player.id ? 'bg-black/25 border border-purple-400/30' : ''} ${game?.turn === p.id && !game?.reveal ? 'ring-2 ring-yellow-400/70' : ''} ${dead ? 'opacity-40' : ''}`}>
            <PlayerDot id={p.id} avatar={p.avatar} size="md" />
            <span className="font-bold truncate flex-1">{p.name}</span>
            {dead && <Skull size={14} className="text-gray-400 shrink-0" aria-label="Éliminé" />}
            {l.wins[p.id] > 0 && <span className="text-xs text-gray-300 shrink-0">🏆{l.wins[p.id]}</span>}
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
        <GameHome g={g} gameId={GAME_ID} eyebrow="Bluff & roulette russe" title="LIAR’S BAR" tagline="Mens bien, démasque les menteurs, et ne tire pas la mauvaise chambre." soundOn={soundOn} toggleSound={toggleSound} onRules={() => setShowRules(true)} />
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
        <GameArt id="liars-bar" className="h-28 mx-auto -mt-2 mb-2" />
        <RoomCodeBlock g={g} />
        {Object.keys(l.wins).length > 0 && (
          <p className="mb-4 text-sm text-gray-300">🏆 {Object.entries(l.wins).map(([id, n]) => `${nameOf(id)} ${n}`).join(' · ')}</p>
        )}
        <p className="text-gray-400 text-sm mb-5">
          {ready ? `${Math.min(players.length, 4)} joueurs vont s’affronter${players.length > 4 ? ' (les autres regardent)' : ''}.` : 'En attente d’au moins un adversaire…'}
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

  const rv = game.reveal;
  const turnName = nameOf(game.turn);
  const lastName = game.lastPlay ? nameOf(game.lastPlay.id) : '';

  const seats = (
    <div className="flex flex-wrap gap-3 justify-center">
      {game.order.map((id) => {
        const dead = game.out.includes(id);
        const gun = game.guns[id];
        const active = game.turn === id && !rv && !dead;
        const count = game.hands[id]?.length ?? 0;
        return (
          <div key={id} className={`relative w-36 sm:w-40 rounded-2xl border px-3 py-2.5 text-center ${active ? 'border-yellow-400 bg-yellow-400/10' : 'border-gray-800 bg-gray-950/50'} ${dead ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-center gap-2">
              <PlayerDot id={id} avatar={avatarOf(id)} />
              <span className="text-sm font-bold truncate max-w-[6.5rem]">{id === player.id ? 'Toi' : nameOf(id)}</span>
            </div>
            {dead ? (
              <p className="mt-2 text-xs font-bold text-gray-400 flex items-center justify-center gap-1"><Skull size={14} /> Éliminé</p>
            ) : (
              <>
                <div className="mt-2 flex justify-center gap-0.5 min-h-[3rem]">
                  {Array.from({ length: Math.min(count, 5) }, (_, i) => <LbCard key={i} hidden small />)}
                  {count === 0 && <span className="text-xs text-gray-500 self-center">Plus de cartes</span>}
                </div>
                <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-gray-400">
                  <Cylinder shots={gun.shots} />
                  <span>{Math.round(100 / (CHAMBERS - gun.shots))}%</span>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );

  const table = (
    <div className="paper p-5 flex flex-col items-center gap-3">
      <p className="eyebrow">Manche {game.round}</p>
      <div className="flex items-center gap-5">
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">Carte de la table</p>
          <div className="w-20 h-28 rounded-xl border-2 border-white flex items-center justify-center font-heading font-black text-lg shadow-xl" style={{ backgroundColor: FACE[game.table].bg, color: FACE[game.table].fg }}>
            {TABLE_LABEL[game.table]}
          </div>
        </div>
        {game.lastPlay && (
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">{lastName} a posé</p>
            <div className="flex gap-1">
              {Array.from({ length: game.lastPlay.count }, (_, i) => <LbCard key={i} hidden />)}
            </div>
          </div>
        )}
      </div>
      <p className="text-sm font-bold" aria-live="polite">
        {rv ? 'Vérification des cartes…' : myTurn ? '👉 À toi de jouer !' : `Tour de ${turnName}`}
      </p>
    </div>
  );

  const controls = inGame && (
    <div className="paper p-4 pt-5">
      <p className="eyebrow mb-3 text-center">Ta main · {myHand.length} carte{myHand.length > 1 ? 's' : ''}</p>
      <div className="flex flex-wrap justify-center gap-2 min-h-[6rem]">
        {myHand.map((c, i) => <LbCard key={`${c}-${i}`} c={c} selected={sel.includes(i)} onClick={myTurn && !forced ? () => toggle(i) : undefined} />)}
        {myHand.length === 0 && <p className="text-sm text-gray-400 self-center">Tu n’as plus de cartes.</p>}
      </div>
      {myTurn && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {!forced && (
            <button onClick={doPlay} disabled={!sel.length} className="tag-dark whitespace-nowrap px-5 py-2.5 disabled:opacity-40 active:scale-95 cursor-pointer">
              Poser {sel.length || ''} carte{sel.length > 1 ? 's' : ''} · « {TABLE_LABEL[game.table]} »
            </button>
          )}
          {game.lastPlay && (
            <button onClick={doCall} className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold px-5 py-2.5 active:scale-95 transition cursor-pointer">
              <Megaphone size={16} /> Menteur !
            </button>
          )}
        </div>
      )}
      {myTurn && forced && <p className="text-center text-xs text-gray-400 mt-2">Plus de cartes : tu dois traiter {lastName} de menteur.</p>}
      {myTurn && !forced && <p className="text-center text-xs text-gray-500 mt-2">Choisis 1 à 3 cartes. Dis la vérité… ou pas.</p>}
    </div>
  );

  const overlay = rv && (
    <div className="fixed inset-0 z-[950] bg-black/80 flex items-center justify-center p-4">
      <div className="paper w-full max-w-md p-6 text-center animate-rise">
        <p className="font-heading text-xl">
          {nameOf(rv.caller)} traite {nameOf(rv.liar)} de menteur !
        </p>
        <p className="text-xs text-gray-400 mt-1">Carte de la table : <b>{CARD_NAME[game.table]}</b></p>
        <div className="flex justify-center gap-2 my-5">
          {rv.cards.map((c, i) => (
            <div key={i} style={{ opacity: 0, animation: `fadein 0.35s ease ${0.5 + i * 0.4}s forwards` }}>
              <LbCard c={c} />
            </div>
          ))}
        </div>
        <p className="font-bold" style={{ opacity: 0, animation: `fadein 0.4s ease ${0.6 + rv.cards.length * 0.4}s forwards` }}>
          {rv.truthful ? `${nameOf(rv.liar)} disait vrai !` : `${nameOf(rv.liar)} mentait !`}
        </p>
        <div className="mt-4" style={{ opacity: 0, animation: 'fadein 0.5s ease 2.4s forwards' }}>
          <p className="text-sm text-gray-300">{rv.loser === player.id ? 'Tu tires' : `${nameOf(rv.loser)} tire`} la chambre {rv.chamber} sur {CHAMBERS}…</p>
          <p className={`font-heading text-4xl mt-2 ${rv.hit ? 'text-red-500' : 'text-emerald-400'}`}>{rv.hit ? '💥 BANG !' : '😮‍💨 Clic…'}</p>
          <p className="text-sm text-gray-400 mt-1">{rv.loser === player.id ? (rv.hit ? 'Tu es éliminé.' : 'Tu survis.') : rv.hit ? `${nameOf(rv.loser)} est éliminé.` : `${nameOf(rv.loser)} survit.`}</p>
        </div>
      </div>
    </div>
  );

  if (phase === 'play') {
    return shell(
      <div className="flex-1 min-h-0 md:overflow-y-auto w-full max-w-4xl mx-auto flex flex-col gap-4">
        {seats}
        {table}
        {controls || <p className="text-center text-sm text-gray-400">{game.out.includes(player.id) ? 'Tu es éliminé : tu regardes la fin de la partie 👀' : 'Tu regardes la partie 👀'}</p>}
        {overlay}
      </div>
    );
  }

  const winner = game.winner;
  return shell(
    <div className="flex-1 min-h-0 md:overflow-y-auto w-full max-w-3xl mx-auto animate-fadein flex flex-col gap-4">
      <div className="rounded-xl px-5 py-4 text-center bg-red-600 text-white">
        <p className="font-heading text-3xl flex items-center justify-center gap-2"><Crown /> {winner ? `${nameOf(winner)} est le dernier debout !` : 'Partie terminée'}</p>
        <p className="text-sm mt-1 opacity-90">{aliveOf(game).length === 1 ? 'Seul survivant de la soirée 🍻' : ''}</p>
      </div>
      {seats}
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
