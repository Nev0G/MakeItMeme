'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Heart, Crown, ArrowUp, ArrowDown, Send, RotateCcw, Check, Dices, Settings, GripVertical, Skull } from 'lucide-react';
import {
  makeId, shuffle, PlayerDot, playSfx, useSoundAndClickFx, fireConfetti, ToggleRow, RoomOptions, KickButton, toast, useRefState,
} from '@/lib/shared';
import { useGameRoom, GameHome, GameShell, RoomCodeBlock, RulesDialog, WaitingForHost } from '@/lib/gameroom';
import { pickThemes, themeKey } from '@/lib/topten-themes';
import { GameArt } from '@/lib/art';

const GAME_ID = 'top-ten';

const DEFAULT_SETTINGS = {
  visibility: 'private',
  roomName: '',
  chatEnabled: true,
  rounds: 5, // nombre de manches à survivre
  lives: 12, // vies de l'équipe
  themeMode: 'both', // 'cards' : cartes proposées — 'captain' : le capitaine écrit — 'both' : les deux
  answerSeconds: 120, // temps pour répondre (0 = illimité)
};
const INITIAL_TT = {
  phase: 'lobby', // 'lobby' | 'theme' | 'answer' | 'order' | 'result' | 'final'
  gameId: null,
  order: [], // joueurs de la partie (ordre des capitaines)
  round: 0,
  skip: 0, // décalage si un capitaine part
  total: 5,
  lives: 12,
  maxLives: 12,
  captain: null,
  contestants: [], // joueurs à classer (tous sauf le capitaine)
  cards: [],
  theme: null, // { t, lo, hi }
  used: [],
  sec: '', // numéros secrets (encodés)
  answers: {},
  guess: [], // ordre proposé par le capitaine
  startedAt: 0,
  until: 0,
  result: null, // { correct, nums, errors, lost }
  perfect: 0,
  won: null,
};

const enc = (o: any) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
const dec = (s: string) => {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(s))));
  } catch {
    return {};
  }
};

const RULES_STEPS = [
  { title: 'Un capitaine, des numéros secrets', text: 'À chaque manche, un joueur est capitaine. Tous les autres reçoivent un numéro secret entre 1 et 100 (1 = le plus faible, 100 = le plus extrême).' },
  { title: 'Un thème', text: 'Le capitaine choisit un thème (une carte, ou le sien) avec une échelle : par exemple « Un animal : 1 = inoffensif, 100 = dangereux ».' },
  { title: 'Chacun répond selon son numéro', text: 'Donne une réponse qui correspond à ton numéro sur l’échelle, sans jamais le révéler. Un 90 sur « dangereux » ? Pense à un requin, pas à un hamster.' },
  { title: 'Le capitaine classe', text: 'À partir des réponses, il classe les joueurs du plus petit numéro au plus grand. Les autres peuvent l’aider à voix haute ou par le chat.' },
  { title: 'Les vies de l’équipe', text: 'Chaque joueur mal placé fait perdre une vie à l’équipe. Survivez à toutes les manches avant d’être à court de vies !' },
];

const Hearts = ({ lives, max }: { lives: number; max: number }) => (
  <span className="inline-flex flex-wrap items-center gap-0.5" aria-label={`${lives} vie${lives > 1 ? 's' : ''} sur ${max}`}>
    {Array.from({ length: max }).map((_, i) => (
      <Heart key={i} size={14} className={i < lives ? 'text-red-500 fill-red-500' : 'text-gray-700'} />
    ))}
  </span>
);

// L'échelle du thème, avec éventuellement un repère pour le numéro du joueur
const Scale = ({ theme, mark }: { theme: any; mark?: number }) => (
  <div className="mt-3">
    <div className="relative h-3 rounded-full" style={{ background: 'linear-gradient(90deg, #2f9468, #e0b552, #c9661f, #b0302a)' }}>
      {mark ? (
        <span className="absolute -top-1.5 w-1.5 h-6 rounded bg-white shadow-lg ring-2 ring-black/60" style={{ left: `calc(${mark}% - 3px)` }} />
      ) : null}
    </div>
    <div className="flex justify-between text-xs mt-1.5 font-bold">
      <span className="text-teal-300 text-left">1 = {theme.lo}</span>
      <span className="text-red-300 text-right">100 = {theme.hi}</span>
    </div>
  </div>
);

export default function TopTen() {
  const [tt, setTt, ttRef] = useRefState(INITIAL_TT);
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [customTheme, setCustomTheme] = useState({ t: '', lo: '', hi: '' });
  const [showRules, setShowRules] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const cbRef = useRef<any>({});
  const stepRef = useRef('');
  const absentRef = useRef(0);
  const { soundOn, toggleSound } = useSoundAndClickFx();

  const g = useGameRoom({
    channelName: 'topten', gameId: GAME_ID, sessionKey: 'topten-session', defaultSettings: DEFAULT_SETTINGS,
    started: tt.phase !== 'lobby', cbRef,
  });
  const { player, room, players, settings, settingsRef, isHost, isHostRef, broadcast, now, nameOf, avatarOf, presentIds } = g;

  const commitTt = (patch: any) => {
    const next = { ...ttRef.current, ...patch };
    setTt(next);
    broadcast('tt', { tt: next });
  };

  // ==========================================
  // LOGIQUE DE JEU (le host fait foi)
  // ==========================================
  const startRound = (i: number, base: any) => {
    const order = base.order;
    const present = presentIds();
    let captain = null;
    for (let k = 0; k < order.length; k += 1) {
      const id = order[(i + base.skip + k) % order.length];
      if (present.has(id)) {
        captain = id;
        break;
      }
    }
    const contestants = order.filter((id) => id !== captain && present.has(id));
    if (!captain || contestants.length < 2) {
      toast('Il faut au moins 3 joueurs présents pour continuer.');
      commitTt({ ...INITIAL_TT });
      return;
    }
    const pool = shuffle(Array.from({ length: 100 }, (_, k) => k + 1));
    const nums = Object.fromEntries(contestants.map((id, k) => [id, pool[k]]));
    stepRef.current = '';
    absentRef.current = 0;
    commitTt({
      ...base,
      phase: 'theme',
      round: i,
      captain,
      contestants,
      sec: enc(nums),
      cards: pickThemes(base.used),
      theme: null,
      answers: {},
      guess: [],
      result: null,
      startedAt: Date.now(),
      until: 0,
    });
    setLocalOrder(null);
    setAnswerText('');
  };

  const startGame = () => {
    if (!isHost || players.length < 3) return;
    const cfg = settingsRef.current;
    g.broadcast('roster', { known: g.knownRef.current });
    startRound(0, {
      ...INITIAL_TT,
      gameId: makeId('g'),
      order: shuffle(players.map((p) => p.id)),
      total: cfg.rounds,
      lives: cfg.lives,
      maxLives: cfg.lives,
    });
  };
  const backToLobby = () => commitTt({ ...INITIAL_TT });

  const handleTheme = (id: string, raw: any) => {
    const b = ttRef.current;
    const cfg = settingsRef.current;
    if (b.phase !== 'theme' || id !== b.captain) return;
    const clean = (s: any, max: number) => String(s || '').trim().slice(0, max);
    const theme = { t: clean(raw?.t, 80), lo: clean(raw?.lo, 40), hi: clean(raw?.hi, 40) };
    if (theme.t.length < 3) return;
    const fromCards = b.cards.some((c) => themeKey(c) === themeKey(theme));
    if (cfg.themeMode === 'cards' && !fromCards) return;
    if (cfg.themeMode === 'captain' && fromCards) return;
    if (!theme.lo) theme.lo = 'très faible';
    if (!theme.hi) theme.hi = 'très fort';
    commitTt({ phase: 'answer', theme, used: [...b.used, themeKey(theme)], startedAt: Date.now(), until: cfg.answerSeconds ? Date.now() + cfg.answerSeconds * 1000 : 0 });
  };
  const handleReroll = (id: string) => {
    const b = ttRef.current;
    if (b.phase === 'theme' && id === b.captain) commitTt({ cards: pickThemes(b.used) });
  };
  const toOrder = () => {
    const b = ttRef.current;
    if (b.phase !== 'answer') return;
    const answers = { ...b.answers };
    b.contestants.forEach((id) => {
      if (!answers[id]) answers[id] = '…';
    });
    commitTt({ phase: 'order', answers, guess: shuffle(b.contestants) });
  };
  const handleAnswer = (id: string, raw: any) => {
    const b = ttRef.current;
    const text = String(raw || '').trim().slice(0, 60);
    if (b.phase !== 'answer' || !b.contestants.includes(id) || b.answers[id] || !text) return;
    const answers = { ...b.answers, [id]: text };
    const present = presentIds();
    const all = b.contestants.filter((x) => present.has(x)).every((x) => answers[x]);
    commitTt({ answers });
    if (all) toOrder();
  };
  const validOrder = (ids: any, b: any) =>
    Array.isArray(ids) && ids.length === b.contestants.length && ids.every((x) => b.contestants.includes(x)) && new Set(ids).size === ids.length;
  const handleOrder = (id: string, ids: any) => {
    const b = ttRef.current;
    if (b.phase === 'order' && id === b.captain && validOrder(ids, b)) commitTt({ guess: ids });
  };
  const handleValidate = (id: string, ids: any) => {
    const b = ttRef.current;
    if (b.phase !== 'order' || id !== b.captain) return;
    const guess = validOrder(ids, b) ? ids : b.guess;
    const nums = dec(b.sec);
    const correct = [...b.contestants].sort((a, c) => nums[a] - nums[c]);
    const errors = guess.reduce((n, pid, i) => n + (pid !== correct[i] ? 1 : 0), 0);
    commitTt({
      phase: 'result',
      guess,
      result: { correct, nums, errors, lost: errors },
      lives: Math.max(0, b.lives - errors),
      perfect: b.perfect + (errors === 0 ? 1 : 0),
    });
  };
  const nextRound = () => {
    const b = ttRef.current;
    if (b.phase !== 'result') return;
    if (b.lives <= 0) commitTt({ phase: 'final', won: false });
    else if (b.round + 1 >= b.total) commitTt({ phase: 'final', won: true });
    else startRound(b.round + 1, b);
  };

  // Automatismes du host : temps de réponse écoulé, capitaine parti
  useEffect(() => {
    if (!isHostRef.current) return;
    const b = ttRef.current;
    const t = Date.now();
    if (b.phase === 'answer' && b.until && t > b.until) {
      const key = `${b.gameId}-${b.round}-late`;
      if (stepRef.current !== key) {
        stepRef.current = key;
        toOrder();
      }
    }
    if (['theme', 'answer', 'order'].includes(b.phase) && playersRefLength() > 0 && !presentIds().has(b.captain)) {
      absentRef.current = absentRef.current || t;
      if (t - absentRef.current > 5000) {
        absentRef.current = 0;
        toast('Le capitaine est parti : au suivant !');
        startRound(b.round, { ...b, skip: b.skip + 1 });
      }
    } else absentRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);
  const playersRefLength = () => g.playersRef.current.length;

  // ==========================================
  // CANAL : événements du jeu
  // ==========================================
  cbRef.current = {
    attach: (ch: any) => {
      ch.on('broadcast', { event: 'tt' }, ({ payload }: any) => {
        setTt(payload.tt);
        setLocalOrder(null);
      });
      ch.on('broadcast', { event: 'tt_theme' }, ({ payload }: any) => isHostRef.current && handleTheme(payload?.id, payload?.theme));
      ch.on('broadcast', { event: 'tt_reroll' }, ({ payload }: any) => isHostRef.current && handleReroll(payload?.id));
      ch.on('broadcast', { event: 'tt_answer' }, ({ payload }: any) => isHostRef.current && handleAnswer(payload?.id, payload?.text));
      ch.on('broadcast', { event: 'tt_order' }, ({ payload }: any) => isHostRef.current && handleOrder(payload?.id, payload?.ids));
      ch.on('broadcast', { event: 'tt_validate' }, ({ payload }: any) => isHostRef.current && handleValidate(payload?.id, payload?.ids));
    },
    hostSync: (ch: any) => ch.send({ type: 'broadcast', event: 'tt', payload: { tt: ttRef.current } }),
    reset: () => {
      setTt(INITIAL_TT);
      setLocalOrder(null);
      setAnswerText('');
      stepRef.current = '';
    },
  };

  // ==========================================
  // ACTIONS DU JOUEUR
  // ==========================================
  const phase = room ? tt.phase : 'home';
  const iAmCaptain = tt.captain === player.id;
  const iContest = tt.contestants.includes(player.id);
  const myNum = iContest ? dec(tt.sec)[player.id] : null;
  const shownOrder: string[] = iAmCaptain && localOrder ? localOrder : tt.guess;

  const chooseTheme = (theme: any) => {
    if (isHost) handleTheme(player.id, theme);
    else broadcast('tt_theme', { id: player.id, theme });
    playSfx('success');
  };
  const reroll = () => (isHost ? handleReroll(player.id) : broadcast('tt_reroll', { id: player.id }));
  const sendAnswer = (e?: any) => {
    e?.preventDefault();
    const text = answerText.trim();
    if (!text || tt.answers[player.id]) return;
    if (isHost) handleAnswer(player.id, text);
    else broadcast('tt_answer', { id: player.id, text });
    setAnswerText('');
    playSfx('send');
  };
  const reorder = (ids: string[]) => {
    setLocalOrder(ids);
    if (isHost) handleOrder(player.id, ids);
    else broadcast('tt_order', { id: player.id, ids });
  };
  const moveCard = (from: number, to: number) => {
    if (!iAmCaptain || to < 0 || to >= shownOrder.length || from === to) return;
    const next = [...shownOrder];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    reorder(next);
    playSfx('click');
  };
  const validate = () => {
    if (!iAmCaptain) return;
    if (isHost) handleValidate(player.id, shownOrder);
    else broadcast('tt_validate', { id: player.id, ids: shownOrder });
  };

  // Sons
  const prevPhase = useRef('lobby');
  useEffect(() => {
    const prev = prevPhase.current;
    prevPhase.current = tt.phase;
    if (prev === tt.phase) return;
    if (tt.phase === 'theme' && iAmCaptain) playSfx('voteStart');
    if (tt.phase === 'answer') playSfx('roundStart');
    if (tt.phase === 'result') playSfx(tt.result?.errors === 0 ? 'fanfare' : 'reveal');
    if (tt.phase === 'final') {
      playSfx(tt.won ? 'fanfare' : 'buzzer');
      if (tt.won) fireConfetti();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tt.phase]);

  const secsLeft = tt.until && tt.phase === 'answer' ? Math.max(0, Math.ceil((tt.until - now) / 1000)) : 0;

  // ==========================================
  // BRIQUES D'AFFICHAGE
  // ==========================================
  const sidebar = (
    <>
      {players.map((p) => {
        const isCap = tt.phase !== 'lobby' && tt.captain === p.id;
        const answered = tt.phase === 'answer' && !!tt.answers[p.id];
        return (
          <div key={p.id} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition ${p.id === player.id ? 'bg-black/25 border border-purple-400/30' : 'hover:bg-black/20'}`}>
            <PlayerDot id={p.id} avatar={p.avatar} size="md" />
            <span className="font-bold truncate flex-1">{p.name}</span>
            {isHost && p.id !== player.id && <KickButton onClick={() => g.extras.kick(p.id)} />}
            {isCap && <Crown size={14} className="text-yellow-400 shrink-0" />}
            {answered && <Check size={14} className="text-teal-300 shrink-0" />}
            {p.id === g.hostId && <span className="text-[9px] font-bold text-purple-300 bg-purple-900/50 px-1.5 py-0.5 rounded shrink-0">HOST</span>}
          </div>
        );
      })}
    </>
  );

  const statusBar = (
    <div className="paper px-4 py-2.5 flex items-center justify-between gap-3 mb-3 flex-wrap shrink-0">
      <span className="text-xs text-gray-400 font-mono">Manche {Math.min(tt.round + 1, tt.total)}/{tt.total}</span>
      <Hearts lives={tt.lives} max={tt.maxLives} />
      <span className="text-sm font-bold">{tt.captain ? <>👑 {nameOf(tt.captain)}</> : ''}</span>
    </div>
  );

  const themeCard = tt.theme ? (
    <div className="paper px-5 py-4 mb-3 text-center shrink-0">
      <p className="eyebrow">Le thème</p>
      <h2 className="font-heading text-2xl sm:text-3xl mt-1 break-words">{tt.theme.t}</h2>
      <Scale theme={tt.theme} mark={phase === 'answer' && myNum ? myNum : undefined} />
    </div>
  ) : null;

  // ==========================================
  // ÉCRANS
  // ==========================================
  if (phase === 'home') {
    return (
      <>
        <GameHome g={g} gameId={GAME_ID} eyebrow="Jeu coopératif" title="TOP TEN" tagline="Un thème, un numéro secret : qui est le plus fort, le plus extrême ?" soundOn={soundOn} toggleSound={toggleSound} onRules={() => setShowRules(true)} />
        {showRules && <RulesDialog steps={RULES_STEPS} onClose={() => setShowRules(false)} />}
      </>
    );
  }

  const shell = (main: React.ReactNode) => (
    <GameShell g={g} gameId={GAME_ID} soundOn={soundOn} toggleSound={toggleSound} sidebar={sidebar}>
      {main}
      {showRules && <RulesDialog steps={RULES_STEPS} onClose={() => setShowRules(false)} />}
    </GameShell>
  );

  if (phase === 'lobby') {
    return shell(
      <div className="paper p-6 sm:p-8 w-full max-w-3xl mx-auto text-center md:overflow-y-auto">
        <GameArt id="top-ten" className="h-28 mx-auto -mt-2 mb-2" />
        <RoomCodeBlock g={g} />
        <div className="text-left mb-6 bg-gray-950/70 border border-gray-800 rounded-xl p-4">
          <h3 className="flex items-center gap-2 text-gray-400 font-bold mb-3 uppercase text-sm"><Settings size={16} /> Paramètres de la partie</h3>
          <RoomOptions settings={settings} updateSettings={g.updateSettings} isHost={isHost} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <label className="block text-gray-500 mb-1 text-xs">Manches à survivre</label>
              <select disabled={!isHost} value={settings.rounds} onChange={(e) => g.updateSettings({ rounds: Number(e.target.value) })} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60">
                {[3, 5, 8, 10].map((n) => (<option key={n} value={n}>{n}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-gray-500 mb-1 text-xs">Vies de l’équipe</label>
              <select disabled={!isHost} value={settings.lives} onChange={(e) => g.updateSettings({ lives: Number(e.target.value) })} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60">
                {[5, 8, 12, 16, 20].map((n) => (<option key={n} value={n}>{n}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-gray-500 mb-1 text-xs">Temps pour répondre</label>
              <select disabled={!isHost} value={settings.answerSeconds} onChange={(e) => g.updateSettings({ answerSeconds: Number(e.target.value) })} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60">
                {[0, 60, 90, 120, 180].map((n) => (<option key={n} value={n}>{n ? `${n} s` : 'Illimité'}</option>))}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-gray-500 mb-1 text-xs">Thèmes</label>
              <select disabled={!isHost} value={settings.themeMode} onChange={(e) => g.updateSettings({ themeMode: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60">
                <option value="both">Cartes ou libre</option>
                <option value="cards">Cartes seulement</option>
                <option value="captain">Libre (le capitaine)</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">Chaque joueur mal placé fait perdre une vie. Plus il y a de joueurs, plus les erreurs coûtent cher : prévois assez de vies.</p>
        </div>
        {isHost ? (
          <button onClick={startGame} disabled={players.length < 3} className="w-full bg-purple-300 hover:bg-purple-200 !text-gray-950 shadow-md disabled:opacity-50 active:scale-95 font-black py-4 px-6 rounded-lg text-lg transition">
            {players.length < 3 ? "En attente d'au moins 3 joueurs..." : 'Lancer le Top Ten !'}
          </button>
        ) : (
          <WaitingForHost />
        )}
        <button onClick={() => setShowRules(true)} className="mt-4 text-gray-400 hover:text-purple-300 text-sm font-bold transition">Comment jouer ?</button>
      </div>
    );
  }

  if (phase === 'theme') {
    const mode = settings.themeMode;
    return shell(
      <div className="flex-1 min-h-0 md:overflow-y-auto max-w-3xl w-full mx-auto">
        {statusBar}
        {iAmCaptain ? (
          <div className="paper p-6">
            <p className="eyebrow">👑 Tu es le capitaine</p>
            <h2 className="font-heading text-2xl mt-1 mb-4">Choisis le thème de la manche</h2>
            {mode !== 'captain' && (
              <>
                <div className="grid gap-3 mb-3">
                  {tt.cards.map((c) => (
                    <button key={themeKey(c)} onClick={() => chooseTheme(c)} className="text-left rounded-xl border-2 border-gray-700 bg-gray-950/60 hover:border-purple-300 transition p-4 active:scale-[0.99]">
                      <p className="font-heading text-xl">{c.t}</p>
                      <Scale theme={c} />
                    </button>
                  ))}
                </div>
                <button onClick={reroll} className="mb-4 flex items-center gap-2 text-sm text-gray-400 hover:text-white font-bold transition"><Dices size={16} /> D’autres thèmes</button>
              </>
            )}
            {mode !== 'cards' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  chooseTheme(customTheme);
                }}
                className="rounded-xl border border-gray-700 bg-gray-950/50 p-4 space-y-2"
              >
                <p className="text-xs uppercase tracking-wide font-bold text-gray-400">{mode === 'captain' ? 'Ton thème' : 'Ou invente ton thème'}</p>
                <input value={customTheme.t} onChange={(e) => setCustomTheme({ ...customTheme, t: e.target.value })} maxLength={80} placeholder="Ex : Un animal" className="w-full p-3 bg-gray-950 border border-gray-700 rounded-lg font-bold" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={customTheme.lo} onChange={(e) => setCustomTheme({ ...customTheme, lo: e.target.value })} maxLength={40} placeholder="1 = … (ex : inoffensif)" className="p-3 bg-gray-950 border border-gray-700 rounded-lg" />
                  <input value={customTheme.hi} onChange={(e) => setCustomTheme({ ...customTheme, hi: e.target.value })} maxLength={40} placeholder="100 = … (ex : dangereux)" className="p-3 bg-gray-950 border border-gray-700 rounded-lg" />
                </div>
                <button type="submit" disabled={customTheme.t.trim().length < 3} className="w-full bg-purple-300 hover:bg-purple-200 !text-gray-950 disabled:opacity-50 font-bold py-3 rounded-lg active:scale-95 transition">Valider ce thème</button>
              </form>
            )}
          </div>
        ) : (
          <div className="paper p-8 text-center">
            <p className="text-5xl mb-3">👑</p>
            <p className="font-heading text-2xl">{nameOf(tt.captain)} choisit le thème…</p>
            <p className="text-sm text-gray-400 mt-2">Prépare-toi : tu vas recevoir un numéro secret entre 1 et 100 et devoir répondre en conséquence.</p>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'answer') {
    const answeredCount = tt.contestants.filter((id) => tt.answers[id]).length;
    return shell(
      <div className="flex-1 min-h-0 md:overflow-y-auto max-w-3xl w-full mx-auto">
        {statusBar}
        {themeCard}
        {iContest ? (
          <div className="paper p-6 text-center">
            <p className="eyebrow">Ton numéro secret</p>
            <p className="font-heading text-7xl text-purple-300 my-2">{myNum}</p>
            <p className="text-sm text-gray-400 mb-4">Réponds avec quelque chose qui correspond à {myNum} sur l’échelle, sans dire le chiffre !</p>
            {tt.answers[player.id] ? (
              <p className="font-bold text-teal-300">✅ Réponse envoyée : « {tt.answers[player.id]} »</p>
            ) : (
              <form onSubmit={sendAnswer} className="flex gap-2">
                <input autoFocus value={answerText} onChange={(e) => setAnswerText(e.target.value)} maxLength={60} placeholder="Ta réponse…" autoComplete="off" className="flex-1 min-w-0 p-3 bg-gray-950 border-2 border-gray-700 rounded-xl font-bold focus:outline-none" />
                <button type="submit" disabled={!answerText.trim()} data-sfx="off" aria-label="Envoyer" className="bg-purple-300 hover:bg-purple-200 !text-gray-950 disabled:opacity-40 px-5 rounded-xl active:scale-95 transition"><Send size={18} /></button>
              </form>
            )}
          </div>
        ) : (
          <div className="paper p-6 text-center">
            <p className="text-4xl mb-2">👑</p>
            <p className="font-heading text-xl">{iAmCaptain ? 'Tu es le capitaine : tu n’as pas de numéro.' : 'Tu regardes cette manche.'}</p>
            <p className="text-sm text-gray-400 mt-1">Les joueurs répondent… ({answeredCount}/{tt.contestants.length})</p>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2 justify-center text-sm">
          {tt.contestants.map((id) => (
            <span key={id} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 border ${tt.answers[id] ? 'border-teal-400/60 bg-teal-900/30' : 'border-gray-700 bg-gray-900/50'}`}>
              <PlayerDot id={id} avatar={avatarOf(id)} /> {nameOf(id)} {tt.answers[id] ? '✓' : '…'}
            </span>
          ))}
        </div>
        {tt.until ? <p className="text-center text-xs font-mono text-gray-400 mt-3">⏳ {secsLeft}s</p> : null}
        {isHost && (
          <button onClick={toOrder} className="mt-3 mx-auto block text-xs text-gray-500 hover:text-white font-bold transition">Passer aux réponses sans attendre →</button>
        )}
      </div>
    );
  }

  if (phase === 'order') {
    return shell(
      <div className="flex-1 min-h-0 md:overflow-y-auto max-w-3xl w-full mx-auto">
        {statusBar}
        {themeCard}
        {myNum ? <p className="text-center text-xs text-gray-400 mb-2">Ton numéro (secret) : <b className="text-purple-300">{myNum}</b></p> : null}
        <div className="paper p-4">
          <div className="flex items-center justify-between text-xs font-bold mb-2">
            <span className="text-teal-300">▲ 1 = {tt.theme?.lo}</span>
            <span className="text-gray-400">{iAmCaptain ? 'Classe les joueurs : glisse ou utilise les flèches' : `👑 ${nameOf(tt.captain)} classe les joueurs…`}</span>
          </div>
          <ol className="space-y-2">
            {shownOrder.map((id, i) => (
              <li
                key={id}
                draggable={iAmCaptain}
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => iAmCaptain && e.preventDefault()}
                onDrop={() => {
                  if (iAmCaptain && dragIdx !== null) moveCard(dragIdx, i);
                  setDragIdx(null);
                }}
                className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 bg-gray-950/60 transition ${dragIdx === i ? 'opacity-50 border-purple-300' : 'border-gray-700'} ${iAmCaptain ? 'cursor-grab' : ''}`}
              >
                <span className="font-heading text-xl w-7 text-center text-purple-300">{i + 1}</span>
                {iAmCaptain && <GripVertical size={16} className="text-gray-600 shrink-0" />}
                <PlayerDot id={id} avatar={avatarOf(id)} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">{nameOf(id)}</p>
                  <p className="text-sm text-gray-300 break-words">« {tt.answers[id]} »</p>
                </div>
                {iAmCaptain && (
                  <span className="flex flex-col shrink-0">
                    <button onClick={() => moveCard(i, i - 1)} disabled={i === 0} aria-label="Monter" className="p-1 rounded hover:bg-black/30 disabled:opacity-25"><ArrowUp size={16} /></button>
                    <button onClick={() => moveCard(i, i + 1)} disabled={i === shownOrder.length - 1} aria-label="Descendre" className="p-1 rounded hover:bg-black/30 disabled:opacity-25"><ArrowDown size={16} /></button>
                  </span>
                )}
              </li>
            ))}
          </ol>
          <div className="text-right text-xs font-bold text-red-300 mt-2">▼ 100 = {tt.theme?.hi}</div>
        </div>
        {iAmCaptain ? (
          <button onClick={validate} className="mt-3 w-full bg-purple-300 hover:bg-purple-200 !text-gray-950 font-black py-4 rounded-xl text-lg active:scale-95 transition">Valider l’ordre</button>
        ) : (
          <p className="text-center text-sm text-gray-400 mt-3">Tu peux aider le capitaine à voix haute ou par le chat 💬</p>
        )}
      </div>
    );
  }

  if (phase === 'result' && tt.result) {
    const r = tt.result;
    return shell(
      <div className="flex-1 min-h-0 md:overflow-y-auto max-w-3xl w-full mx-auto">
        {statusBar}
        {themeCard}
        <div className={`paper p-5 mb-3 text-center ${r.errors === 0 ? 'paper-green' : ''}`}>
          <p className="font-heading text-3xl">{r.errors === 0 ? '🎯 Classement parfait !' : `${r.errors} joueur${r.errors > 1 ? 's' : ''} mal placé${r.errors > 1 ? 's' : ''}`}</p>
          <p className="text-sm text-gray-300 mt-1">{r.errors === 0 ? 'Aucune vie perdue.' : `L’équipe perd ${r.lost} vie${r.lost > 1 ? 's' : ''}.`}</p>
          <div className="mt-2"><Hearts lives={tt.lives} max={tt.maxLives} /></div>
        </div>
        <ol className="space-y-2">
          {tt.guess.map((id, i) => {
            const ok = r.correct[i] === id;
            return (
              <li key={id} className={`animate-rise flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 ${ok ? 'border-teal-400/70 bg-teal-900/25' : 'border-red-500/70 bg-red-900/25'}`} style={{ animationDelay: `${i * 80}ms` }}>
                <span className="font-heading text-xl w-7 text-center text-purple-300">{i + 1}</span>
                <PlayerDot id={id} avatar={avatarOf(id)} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">{nameOf(id)}</p>
                  <p className="text-sm text-gray-300 break-words">« {tt.answers[id]} »</p>
                </div>
                <span className="font-heading text-2xl shrink-0">{r.nums[id]}</span>
                <span className="shrink-0 text-lg">{ok ? '✅' : '❌'}</span>
              </li>
            );
          })}
        </ol>
        {r.errors > 0 && (
          <p className="text-center text-xs text-gray-400 mt-3">
            Bon ordre : {r.correct.map((id) => `${nameOf(id)} (${r.nums[id]})`).join(' → ')}
          </p>
        )}
        <div className="mt-4 text-center">
          {isHost ? (
            <button onClick={nextRound} className="bg-purple-300 hover:bg-purple-200 !text-gray-950 font-bold py-3 px-8 rounded-full active:scale-95 transition">
              {tt.lives <= 0 ? 'Voir le bilan' : tt.round + 1 >= tt.total ? 'Voir le bilan' : 'Manche suivante'}
            </button>
          ) : (
            <WaitingForHost />
          )}
        </div>
      </div>
    );
  }

  // phase === 'final'
  return shell(
    <div className="paper p-6 sm:p-8 w-full max-w-3xl mx-auto text-center md:overflow-y-auto animate-fadein">
      <p className="eyebrow">Fin de la partie</p>
      <h2 className="font-heading text-3xl mt-1 mb-2">{tt.won ? '🏆 Victoire de l’équipe !' : <><Skull className="inline mr-2 -mt-1" /> L’équipe a sombré…</>}</h2>
      <p className="text-gray-300 mb-4">
        {tt.won ? `Vous avez survécu aux ${tt.total} manches avec ${tt.lives} vie${tt.lives > 1 ? 's' : ''} restante${tt.lives > 1 ? 's' : ''}.` : `Plus de vies après ${Math.min(tt.round + 1, tt.total)} manche${tt.round > 0 ? 's' : ''}.`}
      </p>
      <div className="mb-5"><Hearts lives={tt.lives} max={tt.maxLives} /></div>
      <div className="grid sm:grid-cols-2 gap-3 mb-6 text-sm">
        <div className="bg-black/25 border border-purple-600/30 rounded-xl p-3">
          <p className="eyebrow">🎯 Manches parfaites</p>
          <p className="font-heading text-3xl">{tt.perfect}</p>
        </div>
        <div className="bg-black/25 border border-purple-600/30 rounded-xl p-3">
          <p className="eyebrow">❤️ Vies restantes</p>
          <p className="font-heading text-3xl">{tt.lives}/{tt.maxLives}</p>
        </div>
      </div>
      {isHost ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button onClick={startGame} disabled={players.length < 3} className="flex items-center gap-2 bg-purple-300 hover:bg-purple-200 !text-gray-950 disabled:opacity-50 active:scale-95 font-bold py-3 px-6 rounded-full transition"><RotateCcw size={16} /> Rejouer</button>
          <button onClick={backToLobby} className="text-sm text-gray-400 hover:text-white font-bold transition px-2">Changer les réglages</button>
        </div>
      ) : (
        <WaitingForHost />
      )}
    </div>
  );
}
