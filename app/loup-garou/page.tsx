'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RotateCcw, Settings, Crown, Eye, EyeOff, Skull, Send, Check } from 'lucide-react';
import { makeId, PlayerDot, playSfx, useSoundAndClickFx, fireConfetti, RoomOptions, KickButton, toast, useRefState } from '@/lib/shared';
import { useGameRoom, GameHome, GameShell, RoomCodeBlock, RulesDialog, WaitingForHost } from '@/lib/gameroom';
import * as W from '@/lib/werewolf';
import { ROLE_INFO, type Role, type WW } from '@/lib/werewolf';
import { ChoiceRow, VariantsPanel } from '@/lib/variants';
import { GameArt } from '@/lib/art';

const GAME_ID = 'loup-garou';

const DEFAULT_SETTINGS: any = { visibility: 'private', roomName: '', chatEnabled: true, dayS: 120, voteS: 45, wolves: 0, reveal: true, seer: true, witch: true, hunter: true, cupid: true, guard: true };
const INITIAL: any = {
  phase: 'lobby', // 'lobby' | 'play' | 'over'
  gameId: null,
  blob: '', // état de la partie, encodé (rôles et actions secrètes)
  wolfChat: [] as { id: string; text: string }[],
  wins: { village: 0, wolves: 0, lovers: 0 },
};

// L'état complet circule encodé : il contient les rôles et les actions de la nuit
const enc = (g: WW) => btoa(unescape(encodeURIComponent(JSON.stringify(g, (_k, v) => (v === Infinity ? '__inf' : v)))));
const dec = (b: string): WW | null => {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(b))), (_k, v) => (v === '__inf' ? Infinity : v));
  } catch {
    return null;
  }
};

const RULES_STEPS = [
  { title: 'Deux camps', text: 'Les villageois doivent éliminer tous les loups-garous. Les loups doivent dévorer assez de villageois pour être aussi nombreux qu’eux.' },
  { title: 'La nuit', text: 'Tout le monde dort. Les rôles spéciaux se réveillent un par un : Cupidon (nuit 1), la Voyante, le Garde, les Loups-Garous qui choisissent leur victime, puis la Sorcière.' },
  { title: 'Le jour', text: 'À l’aube, on découvre qui est mort. Le village débat (voix, chat…) puis vote : le joueur le plus désigné est éliminé. Égalité = personne ne meurt.' },
  { title: 'Les pouvoirs', text: 'Voyante : découvre un rôle chaque nuit. Sorcière : une potion de vie, une potion de mort. Chasseur : emporte quelqu’un en mourant. Cupidon : lie deux amoureux (si l’un meurt, l’autre aussi). Garde : protège un joueur (si le Garde et la Sorcière sauvent la même victime, elle meurt quand même).' },
  { title: 'Gagner', text: 'Le village gagne quand il n’y a plus de loups. Les loups gagnent quand ils sont au moins aussi nombreux que les autres. Deux amoureux de camps différents, derniers en vie, gagnent seuls.' },
];

const CAUSE: Record<string, string> = { wolves: 'dévoré par les loups', poison: 'empoisonné', love: 'mort de chagrin', vote: 'éliminé par le village', hunter: 'abattu par le chasseur', left: 'parti du village' };
const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function LoupGarou() {
  const [ww, setWw, wwRef] = useRefState(INITIAL);
  const [sel, setSel] = useState<string[]>([]);
  const [poisonMode, setPoisonMode] = useState(false);
  const [showCard, setShowCard] = useState(true);
  const [chatText, setChatText] = useState('');
  const [showRules, setShowRules] = useState(false);
  const cbRef = useRef<any>({});
  const absentRef = useRef<Record<string, number>>({});
  const { soundOn, toggleSound } = useSoundAndClickFx();

  const g = useGameRoom({
    channelName: 'loup-garou', gameId: GAME_ID, sessionKey: 'loupgarou-session', defaultSettings: DEFAULT_SETTINGS,
    started: ww.phase === 'play', cbRef,
  });
  const { room, players, isHost, isHostRef, broadcast, now, nameOf, avatarOf, presentIds } = g;
  const player: { id: string; name: string; avatar: string } = g.player as any;

  const G: WW | null = useMemo(() => (ww.blob ? dec(ww.blob) : null), [ww.blob]);

  const commit = (patch: any) => {
    const next = { ...wwRef.current, ...patch };
    setWw(next);
    broadcast('ww', { ww: next });
  };
  const commitGame = (game: WW) => {
    if (game.winner) {
      const wins = { ...wwRef.current.wins };
      if (game.winner !== 'none') wins[game.winner] = (wins[game.winner] || 0) + 1;
      return commit({ blob: enc(game), phase: 'over', wins });
    }
    commit({ blob: enc(game) });
  };

  // ==========================================
  // LOGIQUE DE JEU (le host fait foi)
  // ==========================================
  const startGame = () => {
    if (!isHost) return;
    const ids = players.map((p) => p.id).slice(0, 16);
    if (ids.length < 5) {
      toast('Il faut au moins 5 joueurs.');
      return;
    }
    const st = g.settingsRef.current;
    const opts: W.Opts = {
      dayS: [60, 90, 120, 180].includes(Number(st.dayS)) ? Number(st.dayS) : 120,
      voteS: [30, 45, 60].includes(Number(st.voteS)) ? Number(st.voteS) : 45,
      wolves: [0, 1, 2, 3].includes(Number(st.wolves)) ? Number(st.wolves) : 0,
      reveal: st.reveal !== false,
      roles: { seer: st.seer !== false, witch: st.witch !== false, hunter: st.hunter !== false, cupid: st.cupid !== false, guard: st.guard !== false },
    };
    g.broadcast('roster', { known: g.knownRef.current });
    absentRef.current = {};
    commit({ ...INITIAL, phase: 'play', gameId: makeId('g'), wins: wwRef.current.wins, blob: enc(W.newGame(W.shuffled(ids), opts, Date.now())) });
  };
  const backToLobby = () => commit({ ...INITIAL, wins: wwRef.current.wins });

  const current = () => (wwRef.current.phase === 'play' && wwRef.current.blob ? dec(wwRef.current.blob) : null);
  const applyAction = (id: string, kind: string, a: any) => {
    const cur = current();
    if (!cur || !a) return;
    const t = Date.now();
    let r: WW | null = null;
    switch (kind) {
      case 'cupid': r = W.actCupid(cur, id, a.a, a.b); break;
      case 'seer': r = W.actSeer(cur, id, a.target); break;
      case 'guard': r = W.actGuard(cur, id, a.target); break;
      case 'wolf': r = W.actWolf(cur, id, a.target); break;
      case 'witch': r = W.actWitch(cur, id, !!a.heal, a.poison || null); break;
      case 'hunter': r = W.actHunter(cur, id, a.target, t); break;
      case 'ready': r = W.actReady(cur, id); break;
      case 'vote': r = W.actVote(cur, id, a.target); break;
    }
    if (!r) return;
    commitGame(W.stepDone(r) ? W.tick(r, t) : r);
  };
  const onChat = (id: string, text: any) => {
    const cur = current();
    const t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    if (!cur || !t || cur.roles[id] !== 'wolf' || cur.dead.includes(id)) return;
    commit({ wolfChat: [...wwRef.current.wolfChat, { id, text: t }].slice(-40) });
  };
  const forfeit = (id: string) => {
    const cur = current();
    if (cur) commitGame(W.leave(cur, id));
  };

  // Horloge du narrateur (host) : avance les étapes, retire les joueurs partis
  useEffect(() => {
    if (!isHostRef.current) return;
    const cur = current();
    if (!cur) return;
    const t = Date.now();
    const nx = W.tick(cur, t);
    if (nx !== cur) return commitGame(nx);
    if (g.playersRef.current.length > 0) {
      const present = presentIds();
      for (const id of W.aliveOf(cur)) {
        if (present.has(id)) delete absentRef.current[id];
        else {
          absentRef.current[id] = absentRef.current[id] || t;
          if (t - absentRef.current[id] > 20000) {
            delete absentRef.current[id];
            toast(`${nameOf(id)} a quitté le village.`);
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
      ch.on('broadcast', { event: 'ww' }, ({ payload }: any) => setWw(payload.ww));
      ch.on('broadcast', { event: 'ww_act' }, ({ payload }: any) => isHostRef.current && applyAction(payload?.id, payload?.kind, payload?.a));
      ch.on('broadcast', { event: 'ww_chat' }, ({ payload }: any) => isHostRef.current && onChat(payload?.id, payload?.text));
      ch.on('broadcast', { event: 'ww_quit' }, ({ payload }: any) => isHostRef.current && forfeit(payload?.id));
    },
    hostSync: (ch: any) => ch.send({ type: 'broadcast', event: 'ww', payload: { ww: wwRef.current } }),
    reset: () => {
      setWw(INITIAL);
      setSel([]);
      setPoisonMode(false);
      absentRef.current = {};
    },
  };

  // ==========================================
  // ACTIONS DU JOUEUR
  // ==========================================
  const send = (event: string, host: () => void, payload: any) => (isHost ? host() : broadcast(event, { id: player.id, ...payload }));
  const act = (kind: string, a: any) => {
    send('ww_act', () => applyAction(player.id, kind, a), { kind, a });
    setSel([]);
    setPoisonMode(false);
  };
  const phase = room ? ww.phase : 'home';
  const me = player.id;
  const inGame = !!G && G.order.includes(me);
  const amDead = !!G && G.dead.includes(me);
  const myRole: Role | null = G && inGame ? G.roles[me] : null;
  const alive = G ? W.aliveOf(G) : [];
  const leaveGame = () => {
    if (ww.phase === 'play' && inGame && !amDead) send('ww_quit', () => forfeit(me), {});
    g.leaveRoom();
  };

  // Nouvelle étape : on repart d'une sélection vide
  useEffect(() => {
    setSel([]);
    setPoisonMode(false);
  }, [G?.step, G?.night]);

  // Sons
  const prev = useRef({ step: '', phase: 'lobby', dead: 0 });
  useEffect(() => {
    if (G && ww.phase !== 'lobby') {
      if (G.step !== prev.current.step) {
        if (G.step === 'dawn' || G.step === 'day') playSfx('success');
        else if (G.step === 'wolves' && myRole === 'wolf') playSfx('whoosh');
        else if (G.step === 'voteResult') playSfx('buzzer');
        else if (['cupid', 'seer', 'guard', 'witch', 'hunter'].includes(G.step) && G.roles[me] === ({ cupid: 'cupid', seer: 'seer', guard: 'guard', witch: 'witch', hunter: 'hunter' } as any)[G.step]) playSfx('whoosh');
      }
      if (G.dead.length > prev.current.dead) playSfx('error');
    }
    if (ww.phase === 'over' && prev.current.phase !== 'over' && G) {
      const mine = myRole ? ROLE_INFO[myRole].camp : null;
      const won = (G.winner === 'village' && mine === 'village') || (G.winner === 'wolves' && mine === 'wolves') || (G.winner === 'lovers' && !!G.lovers?.includes(me));
      if (won) {
        playSfx('fanfare');
        fireConfetti();
      }
    }
    prev.current = { step: G?.step || '', phase: ww.phase, dead: G?.dead.length || 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [G, ww.phase]);

  // ==========================================
  // BRIQUES D'AFFICHAGE
  // ==========================================
  const sidebar = (
    <>
      {players.map((p) => {
        const inPlay = ww.phase !== 'lobby' && !!G && G.order.includes(p.id);
        const dead = inPlay && G!.dead.includes(p.id);
        return (
          <div key={p.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${p.id === me ? 'bg-black/25 border border-purple-400/30' : ''} ${dead ? 'opacity-40' : ''}`}>
            <PlayerDot id={p.id} avatar={p.avatar} size="md" />
            <span className={`font-bold truncate flex-1 ${dead ? 'line-through' : ''}`}>{p.name}</span>
            {dead && <Skull size={14} className="text-gray-400 shrink-0" aria-label="Mort" />}
            {isHost && p.id !== me && <KickButton onClick={() => g.extras.kick(p.id)} />}
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
        <GameHome g={g} gameId={GAME_ID} eyebrow="Village & trahisons" title="LOUP-GAROU" tagline="La nuit, les loups rôdent. Le jour, le village cherche un coupable." soundOn={soundOn} toggleSound={toggleSound} onRules={() => setShowRules(true)} />
        {showRules && <RulesDialog steps={RULES_STEPS} onClose={() => setShowRules(false)} />}
      </>
    );
  }

  const shell = (main: React.ReactNode) => (
    <GameShell g={{ ...g, leaveRoom: leaveGame }} gameId={GAME_ID} soundOn={soundOn} toggleSound={toggleSound} sidebar={sidebar} sidebarTitle="Villageois">
      {main}
      {showRules && <RulesDialog steps={RULES_STEPS} onClose={() => setShowRules(false)} />}
    </GameShell>
  );

  if (phase === 'lobby') {
    const ready = players.length >= 5;
    const tog = (key: string, label: string, hint: string) => (
      <ChoiceRow key={key} label={label} hint={hint} value={g.settings[key] === false ? 'off' : 'on'} options={[{ value: 'on', label: 'Oui' }, { value: 'off', label: 'Non' }]} onChange={(v) => g.updateSettings({ [key]: v === 'on' })} disabled={!isHost} />
    );
    return shell(
      <div className="paper p-6 sm:p-8 w-full max-w-2xl mx-auto text-center md:overflow-y-auto">
        <GameArt id="loup-garou" className="h-28 mx-auto -mt-2 mb-2 float-y" />
        <RoomCodeBlock g={g} />
        {(ww.wins.village > 0 || ww.wins.wolves > 0 || ww.wins.lovers > 0) && (
          <p className="mb-4 text-sm text-gray-300">🏡 Village {ww.wins.village} — {ww.wins.wolves} Loups 🐺{ww.wins.lovers ? ` — ${ww.wins.lovers} Amoureux 💘` : ''}</p>
        )}
        <p className="text-gray-400 text-sm mb-5">
          {ready ? `${Math.min(players.length, 16)} joueurs dans le village${players.length > 16 ? ' (les autres regardent)' : ''}.` : 'Il faut au moins 5 joueurs (idéal : 8 et plus).'}
        </p>
        <div className="text-left mb-5 bg-gray-950/70 border border-gray-800 rounded-xl p-4">
          <h3 className="flex items-center gap-2 text-gray-400 font-bold mb-3 uppercase text-sm"><Settings size={16} /> Paramètres du salon</h3>
          <RoomOptions settings={g.settings} updateSettings={g.updateSettings} isHost={isHost} />
        </div>
        <VariantsPanel isHost={isHost}>
          <ChoiceRow label="Discussion du jour" value={g.settings.dayS ?? 120} options={[{ value: 60, label: '1 min' }, { value: 90, label: '1 min 30' }, { value: 120, label: '2 min' }, { value: 180, label: '3 min' }]} onChange={(v) => g.updateSettings({ dayS: Number(v) })} disabled={!isHost} />
          <ChoiceRow label="Temps de vote" value={g.settings.voteS ?? 45} options={[{ value: 30, label: '30 s' }, { value: 45, label: '45 s' }, { value: 60, label: '1 min' }]} onChange={(v) => g.updateSettings({ voteS: Number(v) })} disabled={!isHost} />
          <ChoiceRow label="Nombre de loups" hint="Auto : 1 loup jusqu’à 6 joueurs, 2 jusqu’à 11, puis 3 ou 4." value={g.settings.wolves ?? 0} options={[{ value: 0, label: 'Auto' }, { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }]} onChange={(v) => g.updateSettings({ wolves: Number(v) })} disabled={!isHost} />
          {tog('reveal', 'Révéler le rôle des morts', 'Sinon, on ne sait jamais qui était qui avant la fin.')}
          {tog('seer', '🔮 Voyante', 'À partir de 5 joueurs.')}
          {tog('witch', '🧙‍♀️ Sorcière', 'À partir de 6 joueurs.')}
          {tog('hunter', '🏹 Chasseur', 'À partir de 7 joueurs.')}
          {tog('cupid', '💘 Cupidon', 'À partir de 8 joueurs.')}
          {tog('guard', '🛡️ Garde', 'À partir de 9 joueurs.')}
        </VariantsPanel>
        {isHost ? (
          <button onClick={startGame} disabled={!ready} className="w-full bg-purple-300 hover:bg-purple-200 !text-gray-950 shadow-md disabled:opacity-50 active:scale-95 font-black py-4 px-6 rounded-lg text-lg transition">
            {ready ? 'Lancer la partie !' : 'Il faut 5 joueurs minimum…'}
          </button>
        ) : (
          <WaitingForHost />
        )}
        <button onClick={() => setShowRules(true)} className="mt-4 text-gray-400 hover:text-purple-300 text-sm font-bold transition">Comment jouer ?</button>
      </div>
    );
  }

  if (!G) return shell(<WaitingForHost />);

  const isNightStep = ['reveal', 'cupid', 'seer', 'guard', 'wolves', 'witch'].includes(G.step);
  const timeLeft = (Number.isFinite(G.until) ? G.until : now) - now;
  const comp = W.composition(G);
  const isWolf = myRole === 'wolf';
  const lover = !!G.lovers?.includes(me);
  const partner = lover ? G.lovers!.find((x) => x !== me) : null;
  const showRole = (id: string): Role | null => {
    if (id === me && myRole) return myRole;
    if (G.dead.includes(id) && (G.opts.reveal || ww.phase === 'over')) return G.roles[id];
    if (isWolf && G.roles[id] === 'wolf') return 'wolf';
    if (myRole === 'seer' && G.seerSeen[id]) return G.seerSeen[id];
    if (ww.phase === 'over') return G.roles[id];
    return null;
  };

  // ----- Qui peut être choisi ? -----
  let selectable: string[] = [];
  let maxSel = 1;
  const myTurn = inGame && !amDead && W.actorsOf(G).includes(me) && !G.fake;
  if (myTurn) {
    if (G.step === 'cupid') { selectable = alive; maxSel = 2; }
    else if (G.step === 'seer') selectable = alive.filter((id) => id !== me);
    else if (G.step === 'guard') selectable = alive.filter((id) => id !== G.lastGuard);
    else if (G.step === 'wolves') selectable = alive.filter((id) => G.roles[id] !== 'wolf');
    else if (G.step === 'witch' && poisonMode) selectable = alive.filter((id) => id !== me);
    else if (G.step === 'hunter') selectable = alive.filter((id) => id !== me);
    else if (G.step === 'vote' && !(me in G.votes)) selectable = alive.filter((id) => id !== me);
  }
  const toggleSel = (id: string) => {
    if (!selectable.includes(id)) return;
    setSel((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : maxSel === 1 ? [id] : [...cur, id].slice(-maxSel)));
  };

  const voteCounts: Record<string, number> = {};
  Object.values(G.votes).forEach((t) => t !== 'blank' && (voteCounts[t] = (voteCounts[t] || 0) + 1));
  const wolfVoteCounts: Record<string, number> = {};
  if (isWolf && G.step === 'wolves') Object.values(G.wolfVotes).forEach((t) => (wolfVoteCounts[t] = (wolfVoteCounts[t] || 0) + 1));

  // ----- Titre de l'étape -----
  const STEP_TITLE: Record<string, { icon: string; text: string }> = {
    reveal: { icon: '🌙', text: 'Le village s’endort… découvre ton rôle' },
    cupid: { icon: '💘', text: 'Cupidon se réveille' },
    seer: { icon: '🔮', text: 'La voyante se réveille' },
    guard: { icon: '🛡️', text: 'Le garde se réveille' },
    wolves: { icon: '🐺', text: 'Les loups-garous se réveillent' },
    witch: { icon: '🧙‍♀️', text: 'La sorcière se réveille' },
    dawn: { icon: '🌅', text: 'Le jour se lève…' },
    hunter: { icon: '🏹', text: 'Le chasseur tire sa dernière balle' },
    day: { icon: '☀️', text: 'Le village débat' },
    vote: { icon: '🗳️', text: 'Le village vote' },
    voteResult: { icon: '⚖️', text: 'Le village a tranché' },
  };
  const title = STEP_TITLE[G.step] || { icon: '🌙', text: '' };

  const deathLine = (d: { id: string; cause: string }) => {
    const r = G.opts.reveal ? ` (${ROLE_INFO[G.roles[d.id]].emoji} ${ROLE_INFO[G.roles[d.id]].name})` : '';
    return `${nameOf(d.id)}${r} — ${CAUSE[d.cause] || ''}`;
  };

  // ----- Panneau d'action -----
  const btn = 'tag-dark whitespace-nowrap px-5 py-2.5 disabled:opacity-40 active:scale-95 cursor-pointer';
  let action: React.ReactNode = null;
  if (amDead) {
    action = <p className="text-sm text-gray-300">👻 Tu es mort. Tu peux suivre la partie, mais plus influencer le village.</p>;
  } else if (!inGame) {
    action = <p className="text-sm text-gray-300">Tu regardes la partie 👀</p>;
  } else if (G.step === 'reveal') {
    action = <p className="text-sm text-gray-300">Découvre ta carte ci-dessus. La première nuit va commencer…</p>;
  } else if (myTurn && G.step === 'cupid') {
    action = (<div className="space-y-2"><p className="text-sm font-bold">💘 Choisis deux amoureux ({sel.length}/2).</p><button className={btn} disabled={sel.length !== 2} onClick={() => act('cupid', { a: sel[0], b: sel[1] })}>Lier ces deux joueurs</button></div>);
  } else if (myTurn && G.step === 'seer') {
    const done = !!G.seerPick;
    action = done ? (
      <p className="text-sm font-bold">🔮 {nameOf(G.seerPick!)} est <span className="text-purple-300">{ROLE_INFO[G.roles[G.seerPick!]].emoji} {ROLE_INFO[G.roles[G.seerPick!]].name}</span>.</p>
    ) : (<div className="space-y-2"><p className="text-sm font-bold">🔮 Qui veux-tu sonder ?</p><button className={btn} disabled={sel.length !== 1} onClick={() => act('seer', { target: sel[0] })}>Découvrir son rôle</button></div>);
  } else if (myTurn && G.step === 'guard') {
    action = (<div className="space-y-2"><p className="text-sm font-bold">🛡️ Qui protèges-tu cette nuit ?{G.lastGuard ? ` (pas ${nameOf(G.lastGuard)} : protégé hier)` : ''}</p><button className={btn} disabled={sel.length !== 1} onClick={() => act('guard', { target: sel[0] })}>Protéger</button></div>);
  } else if (myTurn && G.step === 'wolves') {
    const mine = G.wolfVotes[me];
    action = (
      <div className="space-y-2">
        <p className="text-sm font-bold">🐺 Qui dévorez-vous ? {mine ? <span className="text-red-300">Ton choix : {nameOf(mine)}</span> : null}</p>
        <button className={btn} disabled={sel.length !== 1} onClick={() => act('wolf', { target: sel[0] })}>{mine ? 'Changer mon vote' : 'Voter pour cette victime'}</button>
        <p className="text-xs text-gray-400">Les loups se concertent par écrit ci-dessous. Majorité des voix, sinon au hasard.</p>
      </div>
    );
  } else if (myTurn && G.step === 'witch') {
    const victim = G.wolfTarget;
    action = G.witchDone ? <p className="text-sm font-bold">🧙‍♀️ Tes potions sont prêtes. À demain…</p> : (
      <div className="space-y-3">
        <p className="text-sm font-bold">🧙‍♀️ {victim ? <>Les loups ont désigné <span className="text-red-300">{nameOf(victim)}</span>.</> : 'Les loups n’ont désigné personne.'}</p>
        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={G.healUsed || !victim} onClick={() => act('witch', { heal: true, poison: null })}>💚 Sauver {victim ? nameOf(victim) : ''}{G.healUsed ? ' (utilisée)' : ''}</button>
          <button className={`${btn} !bg-none !bg-red-600 !text-white`} disabled={G.poisonUsed} onClick={() => setPoisonMode((v) => !v)}>{poisonMode ? '✖ Annuler' : `☠️ Empoisonner${G.poisonUsed ? ' (utilisée)' : ''}`}</button>
          <button className="rounded-xl border border-gray-600 px-4 py-2.5 text-sm font-bold hover:bg-white/10 active:scale-95 transition cursor-pointer" onClick={() => act('witch', { heal: false, poison: null })}>Ne rien faire</button>
        </div>
        {poisonMode && <button className={btn} disabled={sel.length !== 1} onClick={() => act('witch', { heal: false, poison: sel[0] })}>Empoisonner {sel[0] ? nameOf(sel[0]) : '…'}</button>}
      </div>
    );
  } else if (myTurn && G.step === 'hunter') {
    action = (<div className="space-y-2"><p className="text-sm font-bold">🏹 Tu es mort… emporte quelqu’un avec toi !</p><button className={btn} disabled={sel.length !== 1} onClick={() => act('hunter', { target: sel[0] })}>Tirer</button></div>);
  } else if (G.step === 'day') {
    const ready = G.readyDay.filter((id) => !G.dead.includes(id)).length;
    action = (
      <div className="space-y-2">
        <p className="text-sm text-gray-300">💬 Débattez ! (voix, chat de la salle…) Qui se comporte bizarrement ?</p>
        <button className={btn} disabled={G.readyDay.includes(me)} onClick={() => act('ready', {})}>{G.readyDay.includes(me) ? 'Tu es prêt(e) à voter' : 'Prêt(e) à voter'}</button>
        <p className="text-xs text-gray-500">{ready} / {alive.length} prêts · le vote démarre quand plus de la moitié l’est.</p>
      </div>
    );
  } else if (G.step === 'vote') {
    const voted = me in G.votes;
    action = voted ? (
      <p className="text-sm text-gray-300">🗳️ Vote enregistré. {Object.keys(G.votes).length} / {alive.length} ont voté.</p>
    ) : (
      <div className="space-y-2">
        <p className="text-sm font-bold">🗳️ Qui éliminer ?</p>
        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={sel.length !== 1} onClick={() => act('vote', { target: sel[0] })}>Voter {sel[0] ? nameOf(sel[0]) : ''}</button>
          <button className="rounded-xl border border-gray-600 px-4 py-2.5 text-sm font-bold hover:bg-white/10 active:scale-95 transition cursor-pointer" onClick={() => act('vote', { target: 'blank' })}>Vote blanc</button>
        </div>
      </div>
    );
  } else if (G.step === 'dawn' || G.step === 'voteResult') {
    action = (
      <div className="space-y-2" role="status" aria-live="polite">
        {G.deaths.length === 0 ? (
          <p className="text-sm font-bold">{G.step === 'dawn' ? '☀️ Personne n’est mort cette nuit.' : '⚖️ Personne n’est éliminé.'}</p>
        ) : (
          G.deaths.map((d) => <p key={d.id} className="text-sm font-bold death-in">💀 {deathLine(d)}</p>)
        )}
        {G.step === 'voteResult' && G.voteOutcome && (
          <p className="text-xs text-gray-400">Votes : {Object.entries(G.votes).map(([v, t]) => `${nameOf(v)} → ${t === 'blank' ? 'blanc' : nameOf(t)}`).join(' · ')}</p>
        )}
      </div>
    );
  } else if (isNightStep) {
    action = <p className="text-sm text-gray-300 sleep-z">😴 Tu dors… ne fais aucun bruit.</p>;
  } else {
    action = <p className="text-sm text-gray-300">{title.text}…</p>;
  }

  const wolfChatPanel = isWolf && !amDead && G.step === 'wolves' && (
    <div className="mt-3 rounded-xl bg-red-950/40 border border-red-900/60 p-3">
      <p className="text-xs font-bold text-red-300 mb-2">🐺 Chat des loups (secret)</p>
      <ul className="space-y-1 max-h-32 overflow-y-auto mb-2 text-sm">
        {ww.wolfChat.map((m: any, i: number) => <li key={i}><b className="text-red-200">{nameOf(m.id)}</b> : {m.text}</li>)}
        {ww.wolfChat.length === 0 && <li className="text-gray-500 text-xs">Concertez-vous sur la victime…</li>}
      </ul>
      <form onSubmit={(e) => { e.preventDefault(); const t = chatText.trim(); if (!t) return; send('ww_chat', () => onChat(me, t), { text: t }); setChatText(''); }} className="flex gap-2">
        <input value={chatText} maxLength={160} onChange={(e) => setChatText(e.target.value)} aria-label="Message aux loups" placeholder="Message aux loups…" className="flex-1 min-w-0 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
        <button type="submit" aria-label="Envoyer" className="tag-dark shrink-0 px-3 flex items-center justify-center cursor-pointer"><Send size={15} /></button>
      </form>
    </div>
  );

  // ----- Écran de fin -----
  const over = ww.phase === 'over';
  const winnerLabel = G.winner === 'village' ? { t: 'Le village a gagné !', c: 'bg-emerald-600', i: '🏡' } : G.winner === 'wolves' ? { t: 'Les loups-garous ont gagné !', c: 'bg-red-700', i: '🐺' } : G.winner === 'lovers' ? { t: 'Les amoureux ont gagné !', c: 'bg-pink-600', i: '💘' } : { t: 'Personne ne survit…', c: 'bg-gray-700', i: '💀' };

  const skyClass = over ? 'ww-over' : isNightStep ? 'ww-night' : 'ww-day';

  return shell(
    <div className={`ww-sky ${skyClass} flex-1 min-h-0 md:overflow-y-auto w-full max-w-4xl mx-auto rounded-2xl p-3 sm:p-4 flex flex-col gap-4`}>
      {over ? (
        <div className={`rounded-xl px-5 py-4 text-center text-white ${winnerLabel.c} animate-pop`}>
          <p className="font-heading text-3xl flex items-center justify-center gap-2"><Crown /> {winnerLabel.i} {winnerLabel.t}</p>
        </div>
      ) : (
        <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap bg-black/35 border border-white/10 backdrop-blur">
          <span className="flex items-center gap-3">
            <span className="ww-orb text-3xl" aria-hidden="true">{isNightStep ? '🌙' : title.icon}</span>
            <span><span className="block eyebrow">{G.night > 0 ? (isNightStep || G.step === 'dawn' ? `Nuit ${G.night}` : `Jour ${G.night}`) : 'Début'}</span><span className="font-heading text-lg">{title.icon} {title.text}</span></span>
          </span>
          {Number.isFinite(G.until) && <span className="font-heading text-2xl tabular-nums" role="timer" aria-label={`${fmt(timeLeft)} restantes`}>{fmt(timeLeft)}</span>}
        </div>
      )}

      {/* Ma carte */}
      {inGame && myRole && (
        <div key={G.night === 0 ? 'first' : 'card'} className={`rounded-2xl p-4 border-2 role-flip ${isWolf ? 'bg-red-950/60 border-red-500' : 'bg-black/40 border-purple-300/50'}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="eyebrow">Ton rôle</p>
            <button type="button" onClick={() => setShowCard((v) => !v)} aria-pressed={!showCard} className="inline-flex items-center gap-1 text-xs font-bold text-gray-300 hover:text-white cursor-pointer">{showCard ? <><EyeOff size={14} /> Masquer</> : <><Eye size={14} /> Afficher</>}</button>
          </div>
          {showCard ? (
            <div className="flex items-start gap-3 mt-1">
              <span className="text-5xl leading-none" aria-hidden="true">{ROLE_INFO[myRole].emoji}</span>
              <div>
                <p className="font-heading text-2xl">{ROLE_INFO[myRole].name}{amDead ? ' (mort)' : ''}</p>
                <p className="text-sm text-gray-300">{ROLE_INFO[myRole].text}</p>
                {lover && partner && <p className="mt-1 text-sm font-bold text-pink-300">💘 Tu es amoureux de {nameOf(partner)}{G.roles[partner] ? '' : ''} : vous gagnez ensemble… ou mourez ensemble.</p>}
                {myRole === 'witch' && <p className="mt-1 text-xs text-gray-400">Potion de vie : {G.healUsed ? 'utilisée' : 'disponible'} · Potion de mort : {G.poisonUsed ? 'utilisée' : 'disponible'}</p>}
              </div>
            </div>
          ) : <p className="font-heading text-xl text-gray-500 mt-1">••••••••</p>}
        </div>
      )}

      {/* Rôles en jeu */}
      <div className="flex flex-wrap gap-1.5 items-center" aria-label="Rôles en jeu">
        <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mr-1">Au village :</span>
        {(Object.entries(comp) as [Role, number][]).map(([r, n]) => (
          <span key={r} className="inline-flex items-center gap-1 rounded-full bg-black/30 border border-white/10 px-2.5 py-0.5 text-xs font-semibold">{ROLE_INFO[r].emoji} {n} {ROLE_INFO[r].name}{n > 1 ? 's' : ''}</span>
        ))}
      </div>

      {/* Joueurs */}
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {G.order.map((id, i) => {
          const dead = G.dead.includes(id);
          const canPick = selectable.includes(id);
          const picked = sel.includes(id);
          const r = showRole(id);
          const votesOn = G.step === 'vote' || G.step === 'voteResult' ? voteCounts[id] || 0 : 0;
          const wv = wolfVoteCounts[id] || 0;
          return (
            <button
              key={id}
              type="button"
              data-sfx="off"
              disabled={!canPick}
              onClick={() => toggleSel(id)}
              aria-pressed={picked}
              style={{ animationDelay: `${i * 40}ms` }}
              className={`ww-tile relative rounded-xl border px-3 py-2.5 text-left transition ${dead ? 'opacity-50 grayscale border-gray-800 bg-black/30' : 'border-white/10 bg-black/30'} ${canPick ? 'cursor-pointer hover:border-purple-300 hover:-translate-y-0.5 ring-1 ring-purple-300/40' : 'cursor-default'} ${picked ? '!border-purple-300 bg-purple-300/20 ring-2 ring-purple-300 scale-[1.03]' : ''}`}
            >
              <span className="flex items-center gap-2">
                <PlayerDot id={id} avatar={avatarOf(id)} />
                <span className={`font-bold text-sm truncate ${dead ? 'line-through' : ''}`}>{id === me ? 'Toi' : nameOf(id)}</span>
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-1 text-[11px] min-h-[1.1rem]">
                {dead && <span className="text-gray-400">💀 {r ? `${ROLE_INFO[r].emoji} ${ROLE_INFO[r].name}` : 'mort'}</span>}
                {!dead && r && id !== me && <span className="text-gray-300">{ROLE_INFO[r].emoji} {ROLE_INFO[r].name}</span>}
                {!dead && lover && id === partner && <span className="text-pink-300">💘 amoureux</span>}
                {!dead && G.step === 'day' && G.readyDay.includes(id) && <span className="text-emerald-300">✔ prêt</span>}
                {votesOn > 0 && <span className="rounded-full bg-red-600 text-white px-1.5 font-bold">{votesOn} 🗳️</span>}
                {wv > 0 && <span className="rounded-full bg-red-800 text-white px-1.5 font-bold">{wv} 🐺</span>}
              </span>
            </button>
          );
        })}
      </div>

      {/* Action */}
      {!over && (
        <div className="rounded-2xl bg-black/35 border border-white/10 p-4">
          {action}
          {wolfChatPanel}
        </div>
      )}

      {/* Cimetière + journal */}
      {G.graveyard.length > 0 && (
        <div className="rounded-2xl bg-black/25 border border-white/10 p-4">
          <p className="eyebrow mb-2">Cimetière</p>
          <ul className="space-y-1 text-sm text-gray-300">
            {G.graveyard.map((d, i) => <li key={i}>💀 <span className="text-gray-500">Nuit {d.night}</span> · {deathLine(d)}</li>)}
          </ul>
        </div>
      )}

      {over && (
        <>
          <div className="rounded-2xl bg-black/30 border border-white/10 p-4">
            <p className="eyebrow mb-2">Les rôles</p>
            <ul className="grid sm:grid-cols-2 gap-1.5">
              {G.order.map((id) => (
                <li key={id} className="flex items-center gap-2 rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm">
                  <PlayerDot id={id} avatar={avatarOf(id)} /> <span className={`font-bold truncate flex-1 ${G.dead.includes(id) ? 'line-through opacity-60' : ''}`}>{nameOf(id)}</span>
                  <span>{ROLE_INFO[G.roles[id]].emoji} {ROLE_INFO[G.roles[id]].name}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {isHost ? (
              <>
                <button onClick={startGame} className="flex items-center gap-2 bg-purple-300 hover:bg-purple-200 !text-gray-950 active:scale-95 font-bold py-3 px-6 rounded-full transition"><RotateCcw size={16} /> Rejouer</button>
                <button onClick={backToLobby} className="text-sm text-gray-300 hover:text-white font-bold transition px-2">Retour au salon</button>
              </>
            ) : (
              <WaitingForHost />
            )}
          </div>
        </>
      )}
    </div>
  );
}
