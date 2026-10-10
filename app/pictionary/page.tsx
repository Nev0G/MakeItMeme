'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Users, Loader2, Crown, Settings, Copy, LogOut, Check, BookOpen, X, RotateCcw, Send, Pencil } from 'lucide-react';
import {
  supabase, makeId, AVATAR_EMOJIS, fireConfetti, shuffle, colorForPlayer, randomAvatar, PlayerDot, playSfx, SoundToggle,
  GamesRail as SharedGamesRail, ToggleRow, makeSessionStore, MAX_NAME_LEN, readIdentity, writeIdentity, useSoundAndClickFx,
  useDiscordAuth, AccountButton, AvatarPicker, AvatarGlyph, isImageAvatar, useRefState,
  useRoomDirectory, VisibilityPicker, RoomOptions, useRoomExtras, ChatWidget, KickButton, toast,
} from '@/lib/shared';
import { pickChoices, sameWord, isClose, norm } from '@/lib/pictionary-words';
import { GameArt } from '@/lib/art';

const APP_VERSION = 'pictionary v1';
const GAME_ID = 'pictionary';
const CW = 800; // taille logique du canevas (les coordonnées échangées sont normalisées 0..1)
const CH = 600;
const CHOOSE_SECONDS = 15;
const REVEAL_SECONDS = 6;
const PAPER = '#fbf3dc';
const PALETTE = ['#1b1008', '#ffffff', '#d9453a', '#e8832a', '#f0c43a', '#3fae7d', '#3b82c4', '#7b4fc4', '#d9559a', '#8a5a2b', '#9a9a9a', '#7fd6f0'];
const SIZES = [4, 9, 18];
const STAMPS = ['⭐', '❤️', '🔥', '🍕', '🦆', '👑', '💩', '🎩'];
const REACTIONS = ['👏', '😂', '🔥', '🤔', '😱', '❤️'];
const CHAOS = {
  shake: { label: '🌪️ Tremblement de terre ! Le crayon n’en fait qu’à sa tête', cls: 'pc-chaos-shake' },
  fog: { label: '🌫️ Brouillard ! Plus rien n’est net', cls: 'pc-chaos-fog' },
  mirror: { label: '🪞 Miroir magique ! Tout est à l’envers', cls: 'pc-chaos-mirror' },
};

const DEFAULT_SETTINGS = {
  visibility: 'private',
  roomName: '',
  chatEnabled: true,
  rounds: 2, // nombre de tours de dessin par joueur
  seconds: 75,
  difficulty: 'mix', // 'easy' | 'mix' | 'hard'
  hints: true, // lettres révélées au fil du temps
  chaos: true, // événements surprises pendant le dessin
};
const INITIAL_PC = {
  phase: 'lobby', // 'lobby' | 'choose' | 'draw' | 'reveal' | 'final'
  gameId: null,
  order: [],
  turn: 0,
  total: 0,
  drawer: null,
  choices: [],
  used: [],
  word: '',
  startedAt: 0,
  duration: 75,
  until: 0, // fin de la phase « choose » ou « reveal »
  solved: {},
  scores: {},
  gained: {}, // points gagnés pendant la manche en cours (affichés au résumé)
  feed: [],
  hintOrder: [],
  chaos: null,
  stats: { drawPts: {}, fast: null },
};

const { read: readSession, write: writeSession, clear: clearSession } = makeSessionStore('pictionary-session');
const GamesRail = () => <SharedGamesRail currentId="pictionary" />;
const VersionBadge = () => (
  <div className="fixed bottom-2 right-3 text-[10px] text-gray-600 font-mono select-none pointer-events-none z-50">{APP_VERSION}</div>
);

const RULES_STEPS = [
  { title: 'Un dessinateur, trois mots', text: 'À chaque tour, un joueur choisit un mot secret parmi trois et le dessine. Pas de lettres, pas de chiffres !' },
  { title: 'Les autres devinent', text: 'Tape tes propositions dans la boîte à droite. Plus tu trouves vite, plus tu gagnes de points. « Tu chauffes ! » te dit quand tu es à une lettre près.' },
  { title: 'Des indices au fil du temps', text: 'Quand le temps file, des lettres du mot se dévoilent. Le dessinateur gagne des points à chaque joueur qui trouve.' },
  { title: 'Gadgets du dessinateur', text: 'Pinceau arc-en-ciel 🌈, tampons emoji ⭐, gomme, annuler… et gare aux événements chaos : tremblement de terre, brouillard, miroir magique !' },
  { title: 'Réactions', text: 'Tout le monde peut balancer des emojis qui flottent au-dessus du dessin. À utiliser sans modération.' },
];

const RulesModal = ({ onClose }) => (
  <div className="fixed inset-0 z-[950] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()} className="paper w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 relative animate-rise">
      <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition active:scale-90"><X size={20} /></button>
      <h2 className="font-heading text-2xl mb-5 flex items-center gap-2"><BookOpen size={22} className="text-purple-300" /> Comment jouer ?</h2>
      <div className="space-y-4">
        {RULES_STEPS.map((s, i) => (
          <div key={i} className="flex gap-3">
            <span className="font-heading text-3xl text-purple-300 w-8 shrink-0">{i + 1}.</span>
            <div>
              <p className="font-bold text-white">{s.title}</p>
              <p className="text-sm text-gray-400">{s.text}</p>
            </div>
          </div>
        ))}
      </div>
      <button onClick={onClose} className="mt-6 w-full bg-purple-300 hover:bg-purple-200 !text-gray-950 font-bold py-3 rounded-lg transition active:scale-95">Compris !</button>
    </div>
  </div>
);

// ----- Dessin : un « op » est un trait ou un tampon, en coordonnées normalisées -----
const paintSegment = (ctx, op, from) => {
  const p = op.p;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = op.w * 2;
  const color = op.e ? PAPER : op.c;
  if (p.length === 2) {
    ctx.fillStyle = op.r ? `hsl(${op.h} 90% 55%)` : color;
    ctx.beginPath();
    ctx.arc(p[0] * CW, p[1] * CH, op.w, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  for (let i = Math.max(2, from); i < p.length; i += 2) {
    ctx.strokeStyle = op.r ? `hsl(${(op.h + (i / 2) * 9) % 360} 90% 55%)` : color;
    ctx.beginPath();
    ctx.moveTo(p[i - 2] * CW, p[i - 1] * CH);
    ctx.lineTo(p[i] * CW, p[i + 1] * CH);
    ctx.stroke();
  }
};
const paintOp = (ctx, op) => {
  if (op.k === 'st') {
    ctx.font = `${op.s}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(op.e, op.x * CW, op.y * CH);
  } else paintSegment(ctx, op, 2);
};

export default function Pictionary() {
  const [player, setPlayer] = useState({ id: null, name: '', avatar: AVATAR_EMOJIS[0] });
  useEffect(() => {
    const saved = readIdentity();
    setPlayer((p) => (p.id ? p : { ...p, name: saved?.name || p.name, avatar: saved?.avatar || randomAvatar() }));
  }, []);
  const auth = useDiscordAuth(
    (profile) => setPlayer((p) => (p.id ? p : { ...p, name: profile.name, avatar: profile.avatarUrl || p.avatar })),
    () => setPlayer((p) => (!p.id && isImageAvatar(p.avatar) ? { ...p, avatar: randomAvatar() } : p))
  );
  useEffect(() => {
    if (player.name.trim()) writeIdentity(player.name, player.avatar);
  }, [player.name, player.avatar]);

  const [room, setRoom] = useState(null);
  const [createVisibility, setCreateVisibility] = useState('private');
  const [joinCode, setJoinCode] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [players, setPlayers] = useState([]);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());

  const [settings, setSettings, settingsRef] = useRefState(DEFAULT_SETTINGS);
  const [pc, setPc, pcRef] = useRefState(INITIAL_PC);
  const [known, setKnown, knownRef] = useRefState({});
  const playersRef = useRef([]);
  const playerIdRef = useRef(null);
  playerIdRef.current = player.id;

  // Outils du dessinateur
  const [tool, setTool] = useState('brush'); // 'brush' | 'rainbow' | 'eraser' | 'stamp'
  const [color, setColor] = useState(PALETTE[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [stamp, setStamp] = useState(STAMPS[0]);
  const [guess, setGuess] = useState('');
  const [floaters, setFloaters] = useState([]);

  const canvasRef = useRef(null);
  const opsRef = useRef([]);
  const strokeRef = useRef(null); // trait en cours (dessinateur)
  const pendingRef = useRef({ sid: null, meta: null, pts: [] });
  const flushTimerRef = useRef(null);
  const channelRef = useRef(null);
  const isHostRef = useRef(false);
  const stepRef = useRef('');
  const chaosNextRef = useRef(0);
  const absentRef = useRef(0);
  const { soundOn, toggleSound } = useSoundAndClickFx();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);
  useEffect(() => {
    const roomParam = new URLSearchParams(window.location.search).get('room');
    if (roomParam) setJoinCode(roomParam.toUpperCase());
  }, []);

  const broadcast = (event, payload) => channelRef.current?.send({ type: 'broadcast', event, payload });
  const commitPc = (patch) => {
    const next = { ...pcRef.current, ...patch };
    setPc(next);
    broadcast('pc', { pc: next });
  };

  // ==========================================
  // CANEVAS
  // ==========================================
  const redraw = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, CW, CH);
    opsRef.current.forEach((op) => paintOp(ctx, op));
  };
  // Applique un lot reçu (ou local) : trait en cours, tampon, annulation, effacement
  const applyOps = (m) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (m.k === 'clr') {
      opsRef.current = [];
      redraw();
    } else if (m.k === 'undo') {
      opsRef.current.pop();
      redraw();
    } else if (m.k === 'st') {
      opsRef.current.push(m);
      if (ctx) paintOp(ctx, m);
    } else if (m.sid) {
      let op = [...opsRef.current].reverse().find((o) => o.sid === m.sid);
      if (!op) {
        op = { sid: m.sid, k: 's', ...m.meta, p: [] };
        opsRef.current.push(op);
      }
      const from = op.p.length;
      op.p.push(...m.pts);
      if (ctx) paintSegment(ctx, op, from);
    }
  };
  const flushStroke = () => {
    clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
    const pend = pendingRef.current;
    if (!pend.pts.length) return;
    broadcast('ops', { sid: pend.sid, meta: pend.meta, pts: pend.pts });
    pendingRef.current = { sid: pend.sid, meta: null, pts: [] };
  };

  const chaosActive = pc.chaos && now < pc.chaos.until ? pc.chaos.type : null;
  const phase = room ? pc.phase : 'home';
  const iAmDrawer = pc.drawer === player.id;
  const canDraw = phase === 'draw' && iAmDrawer;

  const pointOf = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)), Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))];
  };
  const round3 = (n) => Math.round(n * 1000) / 1000;
  const onDown = (e) => {
    if (!canDraw) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const [x, y] = pointOf(e);
    if (tool === 'stamp') {
      const m = { k: 'st', e: stamp, x: round3(x), y: round3(y), s: 40 + size * 4 };
      applyOps(m);
      broadcast('ops', m);
      playSfx('click');
      return;
    }
    const meta = { c: color, w: size, r: tool === 'rainbow' ? 1 : 0, e: tool === 'eraser' ? 1 : 0, h: Math.floor(Math.random() * 360) };
    const sid = makeId('s');
    strokeRef.current = { sid, last: [x, y] };
    pendingRef.current = { sid, meta, pts: [] };
    const first = [round3(x), round3(y)];
    applyOps({ sid, meta, pts: first });
    pendingRef.current.pts.push(...first);
    flushTimerRef.current = setTimeout(flushStroke, 100);
  };
  const onMove = (e) => {
    const s = strokeRef.current;
    if (!s || !canDraw) return;
    let [x, y] = pointOf(e);
    if (Math.hypot(x - s.last[0], y - s.last[1]) < 0.003) return;
    s.last = [x, y];
    if (chaosActive === 'shake') {
      x = Math.min(1, Math.max(0, x + (Math.random() - 0.5) * 0.05));
      y = Math.min(1, Math.max(0, y + (Math.random() - 0.5) * 0.05));
    }
    const pts = [round3(x), round3(y)];
    applyOps({ sid: s.sid, pts });
    pendingRef.current.pts.push(...pts);
    if (!flushTimerRef.current) flushTimerRef.current = setTimeout(flushStroke, 100);
  };
  const onUp = () => {
    if (!strokeRef.current) return;
    strokeRef.current = null;
    flushStroke();
  };
  const sendAction = (k) => {
    if (!canDraw) return;
    applyOps({ k });
    broadcast('ops', { k });
    playSfx(k === 'clr' ? 'whoosh' : 'click');
  };

  // ==========================================
  // LOGIQUE DE JEU (le host fait foi)
  // ==========================================
  const presentIds = () => new Set(playersRef.current.map((p) => p.id));
  const resetCanvas = () => {
    opsRef.current = [];
    redraw();
    broadcast('ops', { k: 'clr' });
  };
  const startChoose = (turn, base) => {
    const b = base || pcRef.current;
    const cfg = settingsRef.current;
    const present = presentIds();
    // saute les dessinateurs partis
    let t = turn;
    while (t < b.total && !present.has(b.order[t % b.order.length])) t += 1;
    if (t >= b.total) return commitPc({ ...b, phase: 'final', drawer: null });
    resetCanvas();
    commitPc({
      ...b,
      phase: 'choose',
      turn: t,
      drawer: b.order[t % b.order.length],
      choices: pickChoices(cfg.difficulty, b.used),
      until: Date.now() + CHOOSE_SECONDS * 1000,
      word: '',
      solved: {},
      gained: {},
      feed: [],
      chaos: null,
    });
  };
  const beginDraw = (word) => {
    const b = pcRef.current;
    const cfg = settingsRef.current;
    const letters = Array.from(word).map((ch, i) => (norm(ch) ? i : -1)).filter((i) => i >= 0);
    chaosNextRef.current = Date.now() + 12000 + Math.random() * 6000;
    commitPc({ ...b, phase: 'draw', word, used: [...b.used, word], startedAt: Date.now(), duration: cfg.seconds, hintOrder: shuffle(letters), solved: {}, gained: {}, feed: [], chaos: null });
  };
  const finishTurn = () => {
    const b = pcRef.current;
    if (b.phase !== 'draw') return;
    commitPc({ phase: 'reveal', until: Date.now() + REVEAL_SECONDS * 1000, chaos: null });
  };
  const advance = () => {
    const b = pcRef.current;
    if (b.turn + 1 >= b.total) commitPc({ phase: 'final', drawer: null });
    else startChoose(b.turn + 1, b);
  };
  const handleGuess = (id, raw) => {
    const b = pcRef.current;
    const text = String(raw || '').slice(0, 40);
    if (b.phase !== 'draw' || id === b.drawer || b.solved[id] !== undefined || !text.trim() || !b.order.includes(id)) return;
    const elapsed = Date.now() - b.startedAt;
    if (sameWord(text, b.word)) {
      const ratio = Math.min(1, elapsed / (b.duration * 1000));
      const first = Object.keys(b.solved).length === 0;
      const pts = Math.round(50 + 100 * (1 - ratio)) + (first ? 25 : 0);
      const scores = { ...b.scores, [id]: (b.scores[id] || 0) + pts, [b.drawer]: (b.scores[b.drawer] || 0) + 25 };
      const gained = { ...b.gained, [id]: (b.gained[id] || 0) + pts, [b.drawer]: (b.gained[b.drawer] || 0) + 25 };
      const stats = {
        drawPts: { ...b.stats.drawPts, [b.drawer]: (b.stats.drawPts[b.drawer] || 0) + 25 },
        fast: !b.stats.fast || elapsed < b.stats.fast.ms ? { id, ms: elapsed } : b.stats.fast,
      };
      const solved = { ...b.solved, [id]: elapsed };
      const present = presentIds();
      const guessers = b.order.filter((x) => x !== b.drawer && present.has(x));
      const feed = [...b.feed, { id, ok: true, pts, k: Date.now() }].slice(-30);
      const all = guessers.length > 0 && guessers.every((x) => solved[x] !== undefined);
      const patch = { solved, scores, gained, stats, feed };
      if (all) commitPc({ ...patch, phase: 'reveal', until: Date.now() + REVEAL_SECONDS * 1000, chaos: null });
      else commitPc(patch);
    } else {
      commitPc({ feed: [...b.feed, { id, text, k: Date.now() }].slice(-30) });
      if (isClose(text, b.word)) {
        // Le host ne reçoit pas ses propres messages : on le prévient en local
        if (id === playerIdRef.current) toast('🔥 Tu chauffes ! À une lettre près…');
        else broadcast('close', { to: id });
      }
    }
  };
  const startGame = () => {
    if (!isHost || players.length < 2) return;
    const cfg = settingsRef.current;
    const order = shuffle(players.map((p) => p.id));
    broadcast('roster', { known: knownRef.current });
    startChoose(0, {
      ...INITIAL_PC,
      gameId: makeId('g'),
      order,
      total: order.length * cfg.rounds,
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      stats: { drawPts: {}, fast: null },
    });
  };
  const backToLobby = () => commitPc({ ...INITIAL_PC });

  // Automatismes du host : choix automatique, fin du temps, passage au tour suivant, chaos, joueur absent
  useEffect(() => {
    if (!isHostRef.current) return;
    const b = pcRef.current;
    const t = Date.now();
    const step = `${b.gameId}-${b.turn}-${b.phase}`;
    if (b.phase === 'choose' && t > b.until && stepRef.current !== step) {
      stepRef.current = step;
      beginDraw(b.choices[0]);
    } else if (b.phase === 'draw') {
      if (t > b.startedAt + b.duration * 1000 && stepRef.current !== step) {
        stepRef.current = step;
        finishTurn();
      } else if (settingsRef.current.chaos && t > chaosNextRef.current && b.startedAt + b.duration * 1000 - t > 12000) {
        const type = ['shake', 'fog', 'mirror'][Math.floor(Math.random() * 3)];
        chaosNextRef.current = t + 16000 + Math.random() * 8000;
        commitPc({ chaos: { type, until: t + 7000, t } });
      }
    } else if (b.phase === 'reveal' && t > b.until && stepRef.current !== step) {
      stepRef.current = step;
      advance();
    }
    // Dessinateur parti : on passe son tour après quelques secondes
    if ((b.phase === 'choose' || b.phase === 'draw') && playersRef.current.length > 0 && !presentIds().has(b.drawer)) {
      absentRef.current = absentRef.current || t;
      if (t - absentRef.current > 4000) {
        absentRef.current = 0;
        stepRef.current = `${b.gameId}-${b.turn}-gone`;
        if (b.phase === 'draw') finishTurn();
        else advance();
      }
    } else absentRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // ==========================================
  // CHANNEL DE LA ROOM
  // ==========================================
  const connectToRoom = (code, playerId, playerName, playerAvatar, isCreator) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase.channel(`pictionary:${code}`, { config: { presence: { key: playerId } } });

    channel.on('presence', { event: 'sync' }, () => {
      const byId = new Map();
      Object.values(channel.presenceState())
        .flat()
        .forEach((p: any) => {
          const prev = byId.get(p.player_id);
          if (!prev || p.joined_at > prev.joined_at) {
            byId.set(p.player_id, { id: p.player_id, name: p.player_name, avatar: p.player_avatar, is_creator: p.is_creator, joined_at: p.joined_at });
          }
        });
      const list = [...byId.values()].sort((a, b) => a.joined_at - b.joined_at);
      playersRef.current = list;
      setPlayers(list);
      setKnown((prev) => {
        const next = { ...prev };
        list.forEach((p) => {
          next[p.id] = { name: p.name, avatar: p.avatar };
        });
        return next;
      });
    });
    // Rattrapage : le host renvoie l'état (et le dessin en cours) à qui arrive
    channel.on('presence', { event: 'join' }, ({ key }) => {
      if (key === playerId || !isHostRef.current) return;
      extras.onPresenceJoin(channel, key);
      channel.send({ type: 'broadcast', event: 'settings_update', payload: { settings: settingsRef.current } });
      channel.send({ type: 'broadcast', event: 'roster', payload: { known: knownRef.current } });
      channel.send({ type: 'broadcast', event: 'pc', payload: { pc: pcRef.current } });
      channel.send({ type: 'broadcast', event: 'sync_ops', payload: { ops: opsRef.current } });
    });
    channel.on('broadcast', { event: 'settings_update' }, ({ payload }) => setSettings(payload.settings));
    channel.on('broadcast', { event: 'roster' }, ({ payload }) => setKnown((prev) => ({ ...payload.known, ...prev })));
    channel.on('broadcast', { event: 'pc' }, ({ payload }) => setPc(payload.pc));
    channel.on('broadcast', { event: 'ops' }, ({ payload }) => applyOps(payload));
    channel.on('broadcast', { event: 'sync_ops' }, ({ payload }) => {
      opsRef.current = Array.isArray(payload.ops) ? payload.ops : [];
      redraw();
    });
    channel.on('broadcast', { event: 'pc_pick' }, ({ payload }) => {
      const b = pcRef.current;
      if (isHostRef.current && b.phase === 'choose' && payload?.id === b.drawer && b.choices.includes(payload.word)) beginDraw(payload.word);
    });
    channel.on('broadcast', { event: 'pc_guess' }, ({ payload }) => {
      if (isHostRef.current && payload?.id) handleGuess(payload.id, payload.text);
    });
    channel.on('broadcast', { event: 'close' }, ({ payload }) => {
      if (payload?.to === playerId) {
        toast('🔥 Tu chauffes ! À une lettre près…');
        playSfx('whoosh');
      }
    });
    channel.on('broadcast', { event: 'react' }, ({ payload }) => addFloater(payload?.e));

    extras.attach(channel);
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ player_id: playerId, player_name: playerName, player_avatar: playerAvatar, is_creator: isCreator, joined_at: Date.now() });
      }
    });
    channelRef.current = channel;
  };

  const resetLocalState = () => {
    extras.reset();
    setPlayers([]);
    playersRef.current = [];
    setSettings(DEFAULT_SETTINGS);
    setPc(INITIAL_PC);
    setKnown({});
    setGuess('');
    setFloaters([]);
    opsRef.current = [];
    stepRef.current = '';
    absentRef.current = 0;
  };
  const enterRoom = (code, playerId, isCreator) => {
    resetLocalState();
    if (isCreator) setSettings((prev) => ({ ...prev, visibility: createVisibility }));
    setPlayer((p) => ({ ...p, id: playerId }));
    setRoom({ code });
    writeSession({ code, id: playerId, name: player.name.trim(), avatar: player.avatar });
    connectToRoom(code, playerId, player.name.trim(), player.avatar, isCreator);
  };
  const createRoom = () => {
    if (!player.name.trim()) return;
    enterRoom(Math.random().toString(36).substring(2, 8).toUpperCase(), auth.profile?.id || makeId('p'), true);
  };
  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code || !player.name.trim()) return;
    const saved = readSession();
    enterRoom(code, auth.profile?.id || (saved && saved.code === code && saved.id ? saved.id : makeId('p')), false);
  };
  const leaveRoom = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    clearSession();
    resetLocalState();
    setRoom(null);
    setPlayer((p) => ({ ...p, id: null }));
  };
  useEffect(() => {
    const saved = readSession();
    if (!saved || !saved.code || !saved.id || !saved.name) return;
    const urlRoom = new URLSearchParams(window.location.search).get('room');
    if (urlRoom && urlRoom.toUpperCase() !== saved.code) {
      clearSession();
      return;
    }
    setPlayer({ id: saved.id, name: saved.name, avatar: saved.avatar });
    setRoom({ code: saved.code });
    connectToRoom(saved.code, saved.id, saved.name, saved.avatar, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hostId = useMemo(() => {
    const creator = players.find((p) => p.is_creator);
    return creator ? creator.id : players[0]?.id ?? null;
  }, [players]);
  const isHost = player.id !== null && player.id === hostId;
  const extras = useRoomExtras({
    channelRef, me: player, isHost, hostId,
    onKicked: () => {
      leaveRoom();
      toast('Tu as été expulsé du salon.');
    },
  });
  useRoomDirectory({
    enabled: !!room && isHost && settings.visibility === 'public',
    game: GAME_ID,
    code: room?.code,
    roomName: settings.roomName,
    hostName: player.name,
    hostAvatar: player.avatar,
    count: players.length,
    started: pc.phase !== 'lobby',
  });
  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  const [hostToast, setHostToast] = useState(null);
  const prevHostIdRef = useRef(null);
  useEffect(() => {
    const prev = prevHostIdRef.current;
    prevHostIdRef.current = hostId;
    if (!prev || !hostId || prev === hostId || players.length === 0) return;
    const newHost = players.find((p) => p.id === hostId);
    if (!newHost) return;
    setHostToast(newHost.id === player.id ? 'Le host a quitté — tu es maintenant host !' : `${newHost.name} est le nouveau host`);
    playSfx(newHost.id === player.id ? 'success' : 'whoosh');
    const t = setTimeout(() => setHostToast(null), 4500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostId]);

  const updateSettings = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    broadcast('settings_update', { settings: next });
  };
  const copyCode = async () => {
    if (!room?.code) return;
    const link = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponible
    }
  };

  // ==========================================
  // ACTIONS DES JOUEURS
  // ==========================================
  const pickWord = (word) => {
    if (!iAmDrawer || pc.phase !== 'choose') return;
    if (isHost) beginDraw(word);
    else broadcast('pc_pick', { id: player.id, word });
    playSfx('success');
  };
  const submitGuess = (e) => {
    e.preventDefault();
    const text = guess.trim();
    if (!text || phase !== 'draw' || iAmDrawer || pc.solved[player.id] !== undefined) return;
    setGuess('');
    if (isHost) handleGuess(player.id, text);
    else broadcast('pc_guess', { id: player.id, text });
    playSfx('send');
  };
  const addFloater = (e) => {
    if (!e || typeof e !== 'string') return;
    const f = { k: makeId('f'), e: e.slice(0, 4), x: 8 + Math.random() * 80 };
    setFloaters((l) => [...l.slice(-14), f]);
    setTimeout(() => setFloaters((l) => l.filter((x) => x.k !== f.k)), 2600);
  };
  const react = (e) => {
    addFloater(e);
    broadcast('react', { id: player.id, e });
    playSfx('click');
  };

  // ==========================================
  // DONNÉES DÉRIVÉES + SONS
  // ==========================================
  const nameOf = (id) => known[id]?.name || '???';
  const avatarOf = (id) => known[id]?.avatar;
  const elapsed = Math.max(0, now - pc.startedAt);
  const msLeft = phase === 'draw' ? Math.max(0, pc.duration * 1000 - elapsed) : phase === 'choose' || phase === 'reveal' ? Math.max(0, pc.until - now) : 0;
  const secsLeft = Math.ceil(msLeft / 1000);
  const ratioLeft = phase === 'draw' && pc.duration ? Math.min(1, msLeft / (pc.duration * 1000)) : 1;
  const iSolved = pc.solved[player.id] !== undefined;
  const knowsWord = iAmDrawer || iSolved || phase === 'reveal';
  const hintCount = (() => {
    if (!settings.hints || phase !== 'draw') return 0;
    const r = elapsed / (pc.duration * 1000);
    if (r < 0.4) return 0;
    return Math.min(Math.floor(pc.hintOrder.length / 2), 1 + Math.floor((r - 0.4) / 0.15));
  })();
  const revealed = new Set(pc.hintOrder.slice(0, hintCount));
  const pattern = Array.from(pc.word || '').map((ch, i) => (!norm(ch) ? ch : revealed.has(i) ? ch.toUpperCase() : '_'));
  const ranking = [...pc.order].sort((a, b) => (pc.scores[b] || 0) - (pc.scores[a] || 0));
  const roundNumber = pc.order.length ? Math.floor(pc.turn / pc.order.length) + 1 : 1;

  useEffect(() => {
    if (phase === 'choose' && iAmDrawer) playSfx('voteStart');
    if (phase === 'draw') playSfx('roundStart');
    if (phase === 'reveal') playSfx('reveal');
    if (phase === 'final') {
      playSfx('fanfare');
      fireConfetti();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pc.turn]);
  const feedLenRef = useRef(0);
  useEffect(() => {
    const prev = feedLenRef.current;
    feedLenRef.current = pc.feed.length;
    const last = pc.feed[pc.feed.length - 1];
    if (pc.feed.length > prev && last?.ok && last.id !== player.id) playSfx('vote');
    if (pc.feed.length > prev && last?.ok && last.id === player.id) {
      playSfx('success');
      fireConfetti({ count: 50, duration: 1400 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pc.feed.length]);
  const lastTickRef = useRef('');
  useEffect(() => {
    if (phase !== 'draw') return;
    const key = `${pc.turn}-${secsLeft}`;
    if (lastTickRef.current === key) return;
    lastTickRef.current = key;
    if (secsLeft > 0 && secsLeft <= 5) playSfx('tick');
  }, [secsLeft, phase, pc.turn]);
  const chaosSoundRef = useRef(0);
  useEffect(() => {
    if (pc.chaos && pc.chaos.t !== chaosSoundRef.current) {
      chaosSoundRef.current = pc.chaos.t;
      playSfx('buzzer');
    }
  }, [pc.chaos]);
  const prevPlayerIdsRef = useRef(new Set());
  useEffect(() => {
    const ids = new Set(players.map((p) => p.id));
    const prev = prevPlayerIdsRef.current;
    prevPlayerIdsRef.current = ids;
    if (prev.size === 0 || !room) return;
    let joined = false;
    let left = false;
    ids.forEach((id) => {
      if (!prev.has(id) && id !== player.id) joined = true;
    });
    prev.forEach((id) => {
      if (!ids.has(id)) left = true;
    });
    if (joined) playSfx('join');
    else if (left) playSfx('leave');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players]);
  // Le canevas apparaît quand on entre en jeu : on le repeint avec ce qu'on connaît déjà
  useEffect(() => {
    if (phase === 'choose' || phase === 'draw' || phase === 'reveal') redraw();
  }, [phase]);

  // ==========================================
  // BRIQUES D'AFFICHAGE
  // ==========================================
  const waitingForHost = (
    <div className="flex items-center justify-center gap-3 text-gray-400 animate-pulse">
      <Loader2 className="animate-spin" /> En attente du Host...
    </div>
  );

  const renderSidebar = () => (
    <div className="paper w-full md:w-64 shrink-0 p-4 flex flex-col md:h-[calc(100dvh-2rem)] md:sticky md:top-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-400 font-mono text-xs uppercase tracking-wide"># room-{room?.code}</span>
        <button onClick={copyCode} title="Copier le lien d'invitation" className="text-gray-400 hover:text-white transition">
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <div className="h-px bg-purple-600/30 my-3" />
      <h3 className="flex items-center gap-2 text-gray-400 font-bold mb-2 uppercase text-[11px] tracking-wide shrink-0">
        <Users size={13} /> Joueurs — {players.length}
      </h3>
      <div className="space-y-1 md:flex-1 md:overflow-y-auto -mx-1 px-1">
        {[...players].sort((a, b) => (pc.scores[b.id] || 0) - (pc.scores[a.id] || 0)).map((p) => {
          const drawing = (pc.phase === 'choose' || pc.phase === 'draw') && pc.drawer === p.id;
          const solved = pc.phase === 'draw' && pc.solved[p.id] !== undefined;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition ${
                drawing ? 'bg-purple-900/50 border border-purple-400/60' : p.id === player.id ? 'bg-black/25 border border-purple-400/30' : 'hover:bg-black/20'
              }`}
            >
              <span className="wiggle-hover inline-flex cursor-default"><PlayerDot id={p.id} avatar={p.avatar} size="md" /></span>
              <span className="font-bold truncate flex-1">{p.name}</span>
              {isHost && p.id !== player.id && <KickButton onClick={() => extras.kick(p.id)} />}
              {drawing && <Pencil size={13} className="text-purple-300 shrink-0" />}
              {solved && <Check size={14} className="text-teal-300 shrink-0" />}
              {p.id === hostId && <span className="text-[9px] font-bold text-purple-300 bg-purple-900/50 px-1.5 py-0.5 rounded shrink-0">HOST</span>}
              <span key={pc.scores[p.id] || 0} className="font-black text-purple-300 text-xs shrink-0 w-8 text-right animate-pop">{pc.scores[p.id] || 0}</span>
            </div>
          );
        })}
      </div>
      <div className="h-px bg-purple-600/30 my-3 shrink-0" />
      <div className="flex items-center justify-between shrink-0">
        <button onClick={leaveRoom} className="flex items-center gap-2 text-gray-400 hover:text-red-400 text-sm font-bold transition py-1 active:scale-95">
          <LogOut size={14} /> Quitter
        </button>
        <SoundToggle on={soundOn} onToggle={toggleSound} />
      </div>
    </div>
  );

  const renderShell = (main) => (
    <div className="min-h-screen md:h-[100dvh] md:overflow-hidden text-white relative z-10 flex justify-center p-4 pt-16 md:pt-4 md:pl-28">
      <VersionBadge />
      <GamesRail />
      <ChatWidget extras={extras} me={player} enabled={settings.chatEnabled !== false} />
      {hostToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[960] animate-fadein paper px-5 py-2.5 text-sm font-bold flex items-center gap-2">
          <Crown size={16} className="text-yellow-400" /> {hostToast}
        </div>
      )}
      <div className="w-full max-w-[100rem] flex flex-col md:flex-row gap-4 md:h-full md:min-h-0">
        {renderSidebar()}
        <div className="flex-1 min-w-0 flex flex-col md:h-full md:min-h-0">{main}</div>
      </div>
    </div>
  );

  const toolBtn = (id, label, title) => (
    <button
      key={id}
      type="button"
      title={title}
      aria-label={title}
      onClick={() => setTool(id)}
      className={`px-2.5 py-1.5 rounded-lg text-base border-2 transition active:scale-95 ${tool === id ? 'border-purple-300 bg-purple-900/60' : 'border-transparent bg-black/25 hover:bg-black/40'}`}
    >
      {label}
    </button>
  );

  const renderToolbar = () => (
    <div className="paper px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-1">
        {toolBtn('brush', '🖌️', 'Pinceau')}
        {toolBtn('rainbow', '🌈', 'Pinceau arc-en-ciel')}
        {toolBtn('eraser', '🧽', 'Gomme')}
        {toolBtn('stamp', stamp, 'Tampon emoji')}
      </div>
      {tool === 'stamp' ? (
        <div className="flex items-center gap-1">
          {STAMPS.map((s) => (
            <button key={s} type="button" onClick={() => setStamp(s)} className={`w-8 h-8 rounded-lg text-lg transition active:scale-90 ${stamp === s ? 'bg-purple-900/70 ring-2 ring-purple-300' : 'bg-black/25 hover:bg-black/40'}`}>{s}</button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Couleur ${c}`}
              onClick={() => {
                setColor(c);
                if (tool === 'eraser') setTool('brush');
              }}
              className={`w-6 h-6 rounded-full border-2 transition active:scale-90 ${color === c && tool !== 'eraser' ? 'border-white scale-110' : 'border-black/40'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        {SIZES.map((s) => (
          <button key={s} type="button" aria-label={`Taille ${s}`} onClick={() => setSize(s)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-90 ${size === s ? 'bg-purple-900/70 ring-2 ring-purple-300' : 'bg-black/25 hover:bg-black/40'}`}>
            <span className="rounded-full bg-white" style={{ width: s + 2, height: s + 2 }} />
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 ml-auto">
        <button type="button" onClick={() => sendAction('undo')} className="px-3 py-1.5 rounded-lg bg-black/25 hover:bg-black/40 text-sm font-bold transition active:scale-95">↩️ Annuler</button>
        <button type="button" onClick={() => sendAction('clr')} className="px-3 py-1.5 rounded-lg bg-black/25 hover:bg-red-900/50 text-sm font-bold transition active:scale-95">🗑️ Tout effacer</button>
      </div>
    </div>
  );

  const wordLine = () => {
    if (phase === 'choose') return iAmDrawer ? 'À toi de choisir ton mot !' : `${nameOf(pc.drawer)} choisit son mot…`;
    if (phase === 'reveal') return <>Le mot était : <b className="text-purple-300">{pc.word}</b></>;
    if (knowsWord) {
      return (
        <>
          {iAmDrawer ? 'Dessine : ' : '✅ Bien joué : '}
          <b className="text-purple-300 tracking-wide">{pc.word}</b>
        </>
      );
    }
    return (
      <span className="inline-flex items-center gap-3 flex-wrap justify-center">
        <span className="font-mono text-2xl sm:text-3xl tracking-[0.18em] font-bold">{pattern.join(' ')}</span>
        <span className="text-xs text-gray-400">({pc.word.replace(/[^\p{L}\p{N}]/gu, '').length} lettres)</span>
      </span>
    );
  };

  const renderGame = () => {
    const chaosInfo = chaosActive ? CHAOS[chaosActive] : null;
    const wrapCls = chaosActive === 'shake' ? 'pc-chaos-shake' : '';
    const canvasCls = !iAmDrawer && chaosActive === 'fog' ? 'pc-chaos-fog' : !iAmDrawer && chaosActive === 'mirror' ? 'pc-chaos-mirror' : '';
    const timerDanger = phase === 'draw' && secsLeft <= 10;
    return (
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col gap-3 min-h-0">
          {/* Barre d'état : manche, mot / indices, chrono */}
          <div className="paper px-4 py-2.5 flex items-center justify-between gap-3">
            <span className="text-xs text-gray-400 font-mono shrink-0">Tour {Math.min(pc.turn + 1, pc.total)}/{pc.total}<br />Manche {roundNumber}</span>
            <div className="text-center text-base sm:text-lg font-bold min-w-0">{wordLine()}</div>
            <div className={`shrink-0 font-heading text-2xl w-14 text-right ${timerDanger ? 'text-red-400 animate-pulse' : 'text-purple-300'}`}>
              {phase === 'choose' || phase === 'draw' ? secsLeft : ''}
            </div>
          </div>
          {phase === 'draw' && (
            <div className="h-1.5 -mt-1.5 rounded-full bg-black/40 overflow-hidden shrink-0">
              <div className="h-full shimmer-bar transition-[width] duration-200" style={{ width: `${ratioLeft * 100}%` }} />
            </div>
          )}

          {/* Chevalet : le canevas et ses surcouches */}
          <div className="relative mx-auto" style={{ width: 'min(100%, max(18rem, calc((100dvh - 19.5rem) * 1.3333)))', aspectRatio: '4 / 3' }}>
            <div className={`pc-frame absolute inset-0 ${wrapCls}`}>
              <canvas
                ref={canvasRef}
                width={CW}
                height={CH}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                className={`w-full h-full rounded-md touch-none ${canvasCls} ${canDraw ? (tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair') : 'cursor-default'}`}
                style={{ background: PAPER }}
              />
            </div>
            {chaosInfo && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 animate-pop paper px-4 py-1.5 text-sm font-bold whitespace-nowrap max-w-[96%] truncate pointer-events-none">{chaosInfo.label}</div>
            )}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-md z-10">
              {floaters.map((f) => (
                <span key={f.k} className="pc-float absolute bottom-2 text-4xl" style={{ left: `${f.x}%` }}>{f.e}</span>
              ))}
            </div>

            {phase === 'choose' && (
              <div className="absolute inset-0 z-20 rounded-md bg-black/70 flex flex-col items-center justify-center p-4 text-center gap-4">
                {iAmDrawer ? (
                  <>
                    <p className="font-heading text-2xl">Choisis ton mot</p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {pc.choices.map((w) => (
                        <button key={w} onClick={() => pickWord(w)} className="tag-dark px-6 py-3 active:scale-95 !normal-case !tracking-normal !text-base">{w}</button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400">Sans choix, le premier mot est pris d’office.</p>
                  </>
                ) : (
                  <>
                    <span className="text-5xl animate-bob"><AvatarGlyph avatar={avatarOf(pc.drawer)} fallback="🎨" /></span>
                    <p className="font-heading text-xl">{nameOf(pc.drawer)} prépare son chef-d’œuvre…</p>
                  </>
                )}
              </div>
            )}
            {phase === 'reveal' && (
              <div className="absolute inset-0 z-20 rounded-md bg-black/75 flex flex-col items-center justify-center p-4 text-center gap-2 animate-fadein">
                <p className="eyebrow">Le mot était</p>
                <p className="font-heading text-4xl sm:text-5xl text-purple-300">{pc.word}</p>
                <p className="text-sm text-gray-300 mt-1">
                  {Object.keys(pc.solved).length === 0 ? 'Personne n’a trouvé… art contemporain ?' : `${Object.keys(pc.solved).length} joueur${Object.keys(pc.solved).length > 1 ? 's ont' : ' a'} trouvé !`}
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {Object.entries(pc.gained).filter(([, v]: any) => v > 0).map(([id, v]: any) => (
                    <span key={id} className="stamp animate-pop">{nameOf(id)} +{v}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {canDraw ? renderToolbar() : null}
        </div>

        {/* Colonne de droite : propositions, saisie, réactions */}
        <aside className="lg:w-72 shrink-0 flex flex-col gap-3 min-h-0 lg:max-h-full">
          <div className="paper p-3 flex-1 min-h-[9rem] lg:min-h-0 overflow-y-auto flex flex-col-reverse">
            <ul className="space-y-1.5 text-sm">
              {pc.feed.length === 0 && <li className="text-gray-500 text-center py-4 text-xs">Les propositions apparaîtront ici…</li>}
              {pc.feed.map((f) => (
                <li key={f.k} className={`animate-fadein flex items-start gap-1.5 rounded-lg px-2 py-1 ${f.ok ? 'bg-teal-900/50 text-teal-200' : ''}`}>
                  <span className="mt-0.5 shrink-0"><PlayerDot id={f.id} avatar={avatarOf(f.id)} /></span>
                  <span className="min-w-0 break-words">
                    <b className="text-gray-300">{nameOf(f.id)}</b> {f.ok ? <>a trouvé ! <b>+{f.pts}</b> 🎉</> : <span className="text-gray-200">{f.text}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {phase === 'draw' && !iAmDrawer && (
            <form onSubmit={submitGuess} className="flex gap-2 shrink-0">
              <input
                type="text"
                value={guess}
                maxLength={40}
                disabled={iSolved}
                onChange={(e) => setGuess(e.target.value)}
                placeholder={iSolved ? 'Tu as trouvé !' : 'Ta proposition…'}
                autoFocus
                className="flex-1 min-w-0 p-3 bg-gray-950 border-2 border-gray-700 rounded-xl font-bold focus:outline-none disabled:opacity-60"
              />
              <button type="submit" aria-label="Envoyer ma proposition" disabled={iSolved || !guess.trim()} data-sfx="off" className="bg-purple-300 hover:bg-purple-200 !text-gray-950 disabled:opacity-40 px-4 rounded-xl active:scale-95 transition">
                <Send size={18} />
              </button>
            </form>
          )}
          <div className="paper px-2 py-1.5 flex items-center justify-between gap-1 shrink-0">
            {REACTIONS.map((e) => (
              <button key={e} type="button" onClick={() => react(e)} aria-label={`Réaction ${e}`} className="text-xl w-9 h-9 rounded-lg hover:bg-black/30 transition active:scale-75">{e}</button>
            ))}
          </div>
        </aside>
      </div>
    );
  };

  // ==========================================
  // ÉCRANS
  // ==========================================
  if (phase === 'home') {
    return (
      <>
        <div className="min-h-screen md:h-[100dvh] md:overflow-y-auto text-white relative z-10 flex flex-col items-center before:content-[''] before:flex-1 after:content-[''] after:flex-1 p-4 pt-16 md:pt-4 md:pl-28">
          <VersionBadge />
          <GamesRail />
          <div className="text-center mb-2">
            <p className="eyebrow">✦ Dessin &amp; devinettes ✦</p>
            <h1 className="font-heading text-4xl min-[420px]:text-5xl sm:text-7xl leading-none mt-2 ink-in">PICTIONARY</h1>
          </div>
          <p className="text-gray-400 mb-6 italic text-center">Dessine, devine, déconne : le crayon n’a jamais été aussi dangereux.</p>
          <div className="paper relative p-8 sm:p-10 w-full max-w-xl">
            <SoundToggle on={soundOn} onToggle={toggleSound} className="absolute top-3 right-3" />
            <AccountButton auth={auth} />
            <div className="flex justify-center mb-4">
              <span className="w-16 h-16 flex items-center justify-center rounded-full text-3xl overflow-hidden" style={{ backgroundColor: `${colorForPlayer(player.avatar)}33`, border: `2px solid ${colorForPlayer(player.avatar)}` }}>
                <AvatarGlyph avatar={player.avatar} />
              </span>
            </div>
            <AvatarPicker auth={auth} avatar={player.avatar} activeClass="bg-purple-600" onPick={(avatar) => setPlayer((p) => ({ ...p, avatar }))} />
            <input
              type="text"
              placeholder="Ton Pseudo..."
              value={player.name}
              maxLength={MAX_NAME_LEN}
              autoFocus
              onChange={(e) => setPlayer({ ...player, name: e.target.value })}
              className="w-full p-4 bg-gray-950 border border-gray-700 rounded-lg text-white font-bold text-lg text-center mb-6 focus:outline-none transition"
            />
            <VisibilityPicker value={createVisibility} onChange={setCreateVisibility} />
            <div className="space-y-4">
              <button onClick={createRoom} disabled={!player.name.trim()} className="w-full bg-purple-300 hover:bg-purple-200 !text-gray-950 shadow-md disabled:opacity-50 font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition transform hover:scale-[1.02] active:scale-95">
                <Play fill="currentColor" /> Créer une partie
              </button>
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-700"></div>
                <span className="flex-shrink-0 mx-4 text-gray-500 font-bold text-sm">OU</span>
                <div className="flex-grow border-t border-gray-700"></div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Code (ex: AB4F2C)"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                  className="w-2/3 p-4 bg-gray-950 border border-gray-700 rounded-lg text-center font-mono uppercase font-bold text-white"
                />
                <button onClick={joinRoom} disabled={!player.name.trim() || !joinCode.trim()} className="w-1/3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-bold py-4 rounded-lg transition active:scale-95">Rejoindre</button>
              </div>
            </div>
            <button onClick={() => setShowRules(true)} className="mt-5 w-full flex items-center justify-center gap-1.5 text-gray-400 hover:text-purple-300 text-sm font-bold transition">
              <BookOpen size={15} /> Comment jouer ?
            </button>
          </div>
        </div>
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      </>
    );
  }

  if (phase === 'lobby') {
    return renderShell(
      <div className="paper p-6 sm:p-8 w-full max-w-3xl mx-auto text-center md:overflow-y-auto">
        <GameArt id="pictionary" className="h-28 mx-auto -mt-2 mb-2" />
        <h2 className="font-heading text-2xl mb-2">Code de la Room</h2>
        <div className="relative mb-5">
          <div className="text-4xl sm:text-6xl font-black font-mono tracking-widest text-purple-300 bg-gray-950 py-4 rounded-xl border border-gray-800">{room?.code}</div>
          <button onClick={copyCode} className="flex w-fit mx-auto mt-3 sm:mt-0 sm:absolute sm:right-3 sm:bottom-3 items-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold px-3 py-2 rounded-lg transition active:scale-95">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Lien copié !' : "Copier l'invitation"}
          </button>
        </div>
        <div className="text-left mb-6 bg-gray-950/70 border border-gray-800 rounded-xl p-4">
          <h3 className="flex items-center gap-2 text-gray-400 font-bold mb-3 uppercase text-sm"><Settings size={16} /> Paramètres de la partie</h3>
          <RoomOptions settings={settings} updateSettings={updateSettings} isHost={isHost} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <label className="block text-gray-500 mb-1 text-xs">Tours par joueur</label>
              <select disabled={!isHost} value={settings.rounds} onChange={(e) => updateSettings({ rounds: Number(e.target.value) })} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60">
                {[1, 2, 3].map((n) => (<option key={n} value={n}>{n}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-gray-500 mb-1 text-xs">Temps pour dessiner</label>
              <select disabled={!isHost} value={settings.seconds} onChange={(e) => updateSettings({ seconds: Number(e.target.value) })} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60">
                {[45, 60, 75, 90, 120].map((n) => (<option key={n} value={n}>{n}s</option>))}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-gray-500 mb-1 text-xs">Difficulté des mots</label>
              <select disabled={!isHost} value={settings.difficulty} onChange={(e) => updateSettings({ difficulty: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60">
                <option value="easy">Facile</option>
                <option value="mix">Mélangé</option>
                <option value="hard">Difficile (expressions)</option>
              </select>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-800 text-sm space-y-3">
            <ToggleRow label="Indices progressifs" hint="Des lettres du mot se dévoilent quand le temps file" checked={settings.hints !== false} disabled={!isHost} onChange={(v) => updateSettings({ hints: v })} />
            <ToggleRow label="Événements chaos" hint="Tremblement de terre, brouillard, miroir magique… en plein dessin" checked={settings.chaos !== false} disabled={!isHost} onChange={(v) => updateSettings({ chaos: v })} />
          </div>
        </div>
        {isHost ? (
          <button onClick={startGame} disabled={players.length < 2} className="w-full bg-purple-300 hover:bg-purple-200 !text-gray-950 shadow-md disabled:opacity-50 active:scale-95 font-black py-4 px-6 rounded-lg text-lg transition">
            {players.length < 2 ? "En attente d'au moins 2 joueurs..." : 'Sortir les crayons !'}
          </button>
        ) : (
          waitingForHost
        )}
        <button onClick={() => setShowRules(true)} className="mt-4 text-gray-400 hover:text-purple-300 text-sm font-bold transition inline-flex items-center gap-1.5"><BookOpen size={15} /> Comment jouer ?</button>
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      </div>
    );
  }

  if (phase === 'final') {
    const picasso = Object.entries(pc.stats.drawPts).sort((a: any, b: any) => b[1] - a[1])[0] as any;
    const fast = pc.stats.fast;
    return renderShell(
      <div className="paper p-6 sm:p-8 w-full max-w-3xl mx-auto text-center md:overflow-y-auto animate-fadein">
        <p className="eyebrow">Fin de la partie</p>
        <h2 className="font-heading text-3xl mt-1 mb-5">🏆 {nameOf(ranking[0])} remporte l’exposition !</h2>
        <div className="space-y-2 mb-6">
          {ranking.map((id, i) => (
            <div key={id} className="animate-rise flex items-center gap-3 rounded-xl px-4 py-2.5 bg-black/25 border border-purple-600/30 text-left" style={{ animationDelay: `${i * 70}ms` }}>
              <span className="font-heading text-xl w-7 text-purple-300">{i + 1}</span>
              <PlayerDot id={id} avatar={avatarOf(id)} size="md" />
              <span className="font-bold truncate flex-1">{nameOf(id)}</span>
              <span className="font-black text-purple-300">{pc.scores[id] || 0}</span>
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mb-6 text-sm">
          <div className="parchment p-3">
            <p className="eyebrow">🎨 Picasso</p>
            <p className="font-heading text-lg">{picasso ? nameOf(picasso[0]) : '—'}</p>
            <p className="text-xs opacity-70">{picasso ? `${picasso[1]} pts rapportés par ses dessins` : 'Personne n’a rien deviné…'}</p>
          </div>
          <div className="parchment p-3">
            <p className="eyebrow">⚡ Éclair</p>
            <p className="font-heading text-lg">{fast ? nameOf(fast.id) : '—'}</p>
            <p className="text-xs opacity-70">{fast ? `bonne réponse en ${(fast.ms / 1000).toFixed(1)} s` : 'Aucune bonne réponse'}</p>
          </div>
        </div>
        {isHost ? (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button onClick={startGame} disabled={players.length < 2} className="flex items-center gap-2 bg-purple-300 hover:bg-purple-200 !text-gray-950 disabled:opacity-50 active:scale-95 font-bold py-3 px-6 rounded-full transition">
              <RotateCcw size={16} /> Rejouer
            </button>
            <button onClick={backToLobby} className="text-sm text-gray-400 hover:text-white font-bold transition px-2">Changer les réglages</button>
          </div>
        ) : (
          waitingForHost
        )}
      </div>
    );
  }

  return renderShell(renderGame());
}
