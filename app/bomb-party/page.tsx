'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play, Users, Loader2, Crown, Settings, Copy, LogOut, Check, BookOpen, X, RotateCcw, Heart, Skull, Send,
} from 'lucide-react';
import {
  supabase, makeId, fireConfetti, shuffle, colorForPlayer, randomAvatar, PlayerDot, playSfx, SoundToggle,
  GamesRail as SharedGamesRail, ToggleRow, makeSessionStore, MAX_NAME_LEN, readIdentity,
  writeIdentity, useSoundAndClickFx, useDiscordAuth, AccountButton, AvatarPicker, AvatarGlyph, isImageAvatar,
  useRefState,
  FrontPage, useRoomDirectory, VisibilityPicker, RoomOptions, useRoomExtras, ChatWidget, KickButton, toast,
} from '@/lib/shared';
import { pickSyllable, fuseSeconds } from '@/lib/bomb-syllables';
import { bombFront } from '@/lib/press';
import { GameArt } from '@/lib/art';

const APP_VERSION = 'bomb party v1';
const GAME_ID = 'bomb-party';

const DEFAULT_SETTINGS = {
  visibility: 'private',
  roomName: '',
  chatEnabled: true,
  lives: 3,
  seconds: 10,
  difficulty: 'progressive', // 'progressive' | 'easy' | 'mix' | 'hard'
  dictionary: true,
};
const INITIAL_BP = {
  phase: 'lobby', // 'lobby' | 'play' | 'final'
  gameId: null,
  order: [],
  lives: {},
  maxLives: 3,
  seconds: 10,
  duration: 10, // durée de la mèche du tour en cours (aléatoire)
  turn: null,
  syllable: '',
  startedAt: 0,
  used: [],
  recent: [],
  round: 0,
  winner: null,
  event: null,
};

const { read: readSession, write: writeSession, clear: clearSession } = makeSessionStore('bombparty-session');
const GamesRail = () => <SharedGamesRail currentId="bomb-party" />;
const VersionBadge = () => (
  <div className="fixed bottom-2 right-3 text-[10px] text-gray-600 font-mono select-none pointer-events-none z-50">
    {APP_VERSION}
  </div>
);

const norm = (w) => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Vérifie qu'un mot existe, via le Wiktionnaire français. Si le réseau est indisponible, on accepte.
const wordCache = new Map();
const checkWord = async (word) => {
  if (wordCache.has(word)) return wordCache.get(word);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch(
      `https://fr.wiktionary.org/w/api.php?action=query&titles=${encodeURIComponent(word)}&format=json&origin=*`,
      { signal: ctrl.signal }
    );
    clearTimeout(timer);
    const data = await res.json();
    const pages = Object.values(data?.query?.pages || {}) as any[];
    const ok = pages.length > 0 && !('missing' in pages[0]) && !('invalid' in pages[0]);
    wordCache.set(word, ok);
    return ok;
  } catch {
    return true;
  }
};

const RULES_STEPS = [
  { title: 'Une syllabe s’affiche', text: 'Elle est gravée sur la bombe, par exemple « tion » ou « ver ».' },
  { title: 'Trouve un mot qui la contient', text: 'Quand c’est ton tour, tape un vrai mot français qui contient la syllabe. Pas de répétition !' },
  { title: 'Passe la bombe', text: 'Mot valide : la bombe passe au joueur suivant, avec une nouvelle syllabe.' },
  { title: 'Ça explose !', text: 'La mèche a une durée aléatoire, et la partie devient de plus en plus rapide et difficile. Si ça explose chez toi, tu perds une vie. Plus de vie, tu es éliminé. Le dernier debout gagne.' },
];

const RulesModal = ({ onClose }) => (
  <div className="fixed inset-0 z-[950] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
    <div
      onClick={(e) => e.stopPropagation()}
      className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 relative animate-rise"
    >
      <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition active:scale-90">
        <X size={20} />
      </button>
      <h2 className="font-heading text-2xl mb-5 flex items-center gap-2">
        <BookOpen size={22} className="text-purple-300" /> Comment jouer ?
      </h2>
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
      <button
        onClick={onClose}
        className="mt-6 w-full bg-purple-300 hover:bg-purple-200 !text-gray-950 text-white font-bold py-3 rounded-lg transition active:scale-95"
      >
        Compris !
      </button>
    </div>
  </div>
);

// La bombe : la syllabe est gravée dessus, elle tremble de plus en plus quand le temps file
const Bomb = ({ syllable, ratio, boom }) => (
  <div className="relative w-52 h-52 sm:w-64 sm:h-64 mx-auto">
    {boom && <span key={boom} className="boom-ring" />}
    <div className={ratio < 0.3 ? 'bomb-panic' : 'bomb-calm'}>
      <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="bp-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f7ffd0" />
            <stop offset="0.5" stopColor="#c8ee6a" />
            <stop offset="1" stopColor="#6f8f22" />
          </linearGradient>
          <radialGradient id="bp-body" cx="0.38" cy="0.32" r="0.8">
            <stop offset="0" stopColor="#25343a" />
            <stop offset="1" stopColor="#05080a" />
          </radialGradient>
          <radialGradient id="bp-spark" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#f08a3a" stopOpacity="0.8" />
            <stop offset="1" stopColor="#f08a3a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d="M112 44 C120 26 138 24 150 10" stroke="#b9d46a" strokeWidth="5" fill="none" strokeLinecap="round" />
        <g transform="translate(152 10)">
          <circle r={14 + (1 - ratio) * 10} fill="url(#bp-spark)" />
          <path d="M0 -10 L3 -3 L10 0 L3 3 L0 10 L-3 3 L-10 0 L-3 -3 Z" fill="#fff3c4" />
        </g>
        <circle cx="100" cy="118" r="70" fill="url(#bp-body)" stroke="#c8ee6a" strokeOpacity="0.8" strokeWidth="2.5" />
        <path d="M58 92 A52 52 0 0 1 100 66" stroke="#fff" strokeOpacity="0.35" strokeWidth="7" fill="none" strokeLinecap="round" />
        <rect x="84" y="42" width="32" height="18" rx="4" fill="url(#bp-gold)" stroke="#4d6a14" />
        <rect x="78" y="56" width="44" height="7" fill="url(#bp-gold)" />
        <text
          x="100"
          y="136"
          textAnchor="middle"
          fontFamily="'Unbounded', system-ui, sans-serif"
          fontWeight="800"
          fontSize={syllable.length > 3 ? 40 : 52}
          fill="url(#bp-gold)"
          stroke="#3f5810"
          strokeWidth="0.8"
        >
          {syllable}
        </text>
      </svg>
    </div>
  </div>
);

const Hearts = ({ lives, max }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${lives} vie${lives > 1 ? 's' : ''}`}>
    {Array.from({ length: max }).map((_, i) =>
      i < lives ? (
        <Heart key={i} size={14} className="text-red-500 fill-red-500" />
      ) : (
        <Heart key={i} size={14} className="text-gray-700" />
      )
    )}
  </span>
);

export default function BombParty() {
  const [player, setPlayer] = useState(() => {
    const saved = readIdentity();
    return { id: null, name: saved?.name || '', avatar: saved?.avatar || randomAvatar() };
  });
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
  const [bp, setBp, bpRef] = useRefState(INITIAL_BP);
  const [known, setKnown, knownRef] = useRefState({});
  const [typing, setTyping] = useState({ id: null, text: '' });

  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [errorKey, setErrorKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [boomKey, setBoomKey] = useState(0);
  const inputRef = useRef(null);

  const channelRef = useRef(null);
  const isHostRef = useRef(false);
  const explodeRef = useRef('');
  const absentRef = useRef({});
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
  const commitBp = (patch) => {
    const next = { ...bpRef.current, ...patch };
    setBp(next);
    broadcast('bp', { bp: next });
  };

  // ==========================================
  // LOGIQUE DE JEU (le host fait foi)
  // ==========================================
  const nextAlive = (order, lives, fromId) => {
    const i = order.indexOf(fromId);
    for (let k = 1; k <= order.length; k += 1) {
      const id = order[(i + k) % order.length];
      if (lives[id] > 0) return id;
    }
    return null;
  };

  // Termine le tour de `from` : nouvelle syllabe pour le suivant, ou fin de partie
  const advance = (base, lives, from, event) => {
    const alive = base.order.filter((id) => lives[id] > 0);
    if (alive.length <= 1) {
      commitBp({ ...base, lives, phase: 'final', turn: null, winner: alive[0] || null, event });
      return;
    }
    commitBp({
      ...base,
      lives,
      turn: nextAlive(base.order, lives, from),
      syllable: pickSyllable(settingsRef.current.difficulty, [base.syllable], base.round + 1),
      duration: fuseSeconds(base.seconds, base.round + 1),
      startedAt: Date.now(),
      round: base.round + 1,
      event,
    });
  };

  const handleWord = (id, word) => {
    const b = bpRef.current;
    if (b.phase !== 'play' || b.turn !== id) return;
    const w = norm(word);
    if (w.length < 2 || !w.includes(norm(b.syllable)) || b.used.includes(w)) return;
    advance(
      { ...b, used: [...b.used, w], recent: [...b.recent, { id, word }].slice(-14) },
      b.lives,
      id,
      { type: 'ok', id, word, t: Date.now() }
    );
  };

  // ==========================================
  // CHANNEL DE LA ROOM (presence + broadcast)
  // ==========================================
  const connectToRoom = (code, playerId, playerName, playerAvatar, isCreator) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase.channel(`bombparty:${code}`, { config: { presence: { key: playerId } } });

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
      setPlayers(list);
      setKnown((prev) => {
        const next = { ...prev };
        list.forEach((p) => {
          next[p.id] = { name: p.name, avatar: p.avatar };
        });
        return next;
      });
    });

    // Rattrapage : le host renvoie l'état à qui arrive en cours de route
    channel.on('presence', { event: 'join' }, ({ key }) => {
      if (key === playerId || !isHostRef.current) return;
      extras.onPresenceJoin(channel, key);
      channel.send({ type: 'broadcast', event: 'settings_update', payload: { settings: settingsRef.current } });
      channel.send({ type: 'broadcast', event: 'roster', payload: { known: knownRef.current } });
      channel.send({ type: 'broadcast', event: 'bp', payload: { bp: bpRef.current } });
    });

    channel.on('broadcast', { event: 'settings_update' }, ({ payload }) => setSettings(payload.settings));
    channel.on('broadcast', { event: 'roster' }, ({ payload }) => setKnown((prev) => ({ ...payload.known, ...prev })));
    channel.on('broadcast', { event: 'bp' }, ({ payload }) => {
      setBp(payload.bp);
      setTyping({ id: null, text: '' });
    });
    channel.on('broadcast', { event: 'bp_word' }, ({ payload }) => {
      if (isHostRef.current && payload?.id && typeof payload.word === 'string') handleWord(payload.id, payload.word.slice(0, 40));
    });
    channel.on('broadcast', { event: 'bp_typing' }, ({ payload }) => {
      if (payload?.id && payload.id === bpRef.current.turn) setTyping({ id: payload.id, text: String(payload.text || '').slice(0, 40) });
    });

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
    setSettings(DEFAULT_SETTINGS);
    setBp(INITIAL_BP);
    setKnown({});
    setTyping({ id: null, text: '' });
    setText('');
    setError('');
    explodeRef.current = '';
    absentRef.current = {};
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

  // Reconnexion automatique après un rafraîchissement
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
    channelRef,
    me: player,
    isHost,
    hostId,
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
    started: bp.phase !== 'lobby',
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
  // ACTIONS
  // ==========================================
  const startGame = () => {
    if (!isHost || players.length < 2) return;
    const cfg = settingsRef.current;
    const order = shuffle(players.map((p) => p.id));
    const next = {
      phase: 'play',
      gameId: makeId('g'),
      order,
      lives: Object.fromEntries(order.map((id) => [id, cfg.lives])),
      maxLives: cfg.lives,
      seconds: cfg.seconds,
      turn: order[0],
      syllable: pickSyllable(cfg.difficulty, [], 0),
      duration: fuseSeconds(cfg.seconds, 0),
      startedAt: Date.now(),
      used: [],
      recent: [],
      round: 0,
      winner: null,
      event: null,
    };
    explodeRef.current = '';
    absentRef.current = {};
    broadcast('roster', { known: knownRef.current });
    setBp(next);
    broadcast('bp', { bp: next });
  };
  const backToLobby = () => commitBp({ phase: 'lobby', event: null });

  const fail = (message) => {
    setError(message);
    setErrorKey((k) => k + 1);
    playSfx('error');
  };

  const submitWord = async (e) => {
    e.preventDefault();
    const b = bpRef.current;
    if (busy || b.phase !== 'play' || b.turn !== player.id) return;
    const raw = text.trim().toLowerCase();
    if (raw.length < 2) return fail('Trop court');
    if (!/^[a-zàâäçéèêëîïôöùûüÿœæ]+$/i.test(raw)) return fail('Lettres uniquement, sans espace');
    if (!norm(raw).includes(norm(b.syllable))) return fail(`Le mot doit contenir « ${b.syllable} »`);
    if (b.used.includes(norm(raw))) return fail('Mot déjà utilisé');
    setBusy(true);
    const ok = settingsRef.current.dictionary === false ? true : await checkWord(raw);
    setBusy(false);
    const now2 = bpRef.current;
    if (now2.round !== b.round || now2.turn !== player.id) return; // la bombe a explosé entre-temps
    if (!ok) return fail('Ce mot n’existe pas dans le dictionnaire');
    setError('');
    setText('');
    if (isHostRef.current) handleWord(player.id, raw);
    else broadcast('bp_word', { id: player.id, word: raw });
    playSfx('success');
  };

  const onType = (value) => {
    setText(value);
    setError('');
    broadcast('bp_typing', { id: player.id, text: value });
  };

  // Le host fait exploser la bombe quand le temps est écoulé (petite marge pour la latence)
  useEffect(() => {
    const bp = bpRef.current;
    if (!isHost || bp.phase !== 'play' || !bp.turn) return;
    if (Date.now() < bp.startedAt + bp.duration * 1000 + 400) return;
    const key = `${bp.gameId}-${bp.round}`;
    if (explodeRef.current === key) return;
    explodeRef.current = key;
    const lives = { ...bp.lives, [bp.turn]: Math.max(0, bp.lives[bp.turn] - 1) };
    advance(bp, lives, bp.turn, { type: 'boom', id: bp.turn, out: lives[bp.turn] === 0, t: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, bp, isHost]);

  // Un joueur parti est éliminé (après quelques secondes, pour ignorer les micro-coupures)
  useEffect(() => {
    const bp = bpRef.current;
    if (!isHost || bp.phase !== 'play' || players.length === 0) return;
    const gone = bp.order.filter((id) => bp.lives[id] > 0 && !players.some((p) => p.id === id));
    bp.order.forEach((id) => {
      if (!gone.includes(id)) delete absentRef.current[id];
    });
    const out = gone.filter((id) => {
      absentRef.current[id] = absentRef.current[id] || Date.now();
      return Date.now() - absentRef.current[id] > 4000;
    });
    if (!out.length) return;
    const lives = { ...bp.lives };
    out.forEach((id) => {
      lives[id] = 0;
    });
    const event = { type: 'left', id: out[0], t: Date.now() };
    if (out.includes(bp.turn)) advance(bp, lives, bp.turn, event);
    else if (bp.order.filter((id) => lives[id] > 0).length <= 1) advance(bp, lives, bp.turn, event);
    else commitBp({ lives });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, players, bp, isHost]);

  // ==========================================
  // DONNÉES DÉRIVÉES + SONS
  // ==========================================
  const phase = room ? bp.phase : 'home';
  const nameOf = (id) => known[id]?.name || '???';
  const avatarOf = (id) => known[id]?.avatar;
  const isMyTurn = phase === 'play' && bp.turn === player.id;
  const iPlay = bp.order.includes(player.id);
  const msLeft = Math.max(0, bp.startedAt + bp.duration * 1000 - now);
  const ratio = bp.duration ? Math.min(1, msLeft / (bp.duration * 1000)) : 1;
  const secsLeft = Math.ceil(msLeft / 1000);

  useEffect(() => {
    if (phase === 'play' && isMyTurn) {
      setText('');
      setError('');
      inputRef.current?.focus();
      playSfx('voteStart');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bp.round, bp.gameId, isMyTurn]);

  const lastEventRef = useRef(0);
  useEffect(() => {
    const ev = bp.event;
    if (!ev || ev.t === lastEventRef.current) return;
    lastEventRef.current = ev.t;
    if (ev.type === 'boom') {
      setBoomKey(ev.t);
      playSfx('buzzer');
    } else if (ev.type === 'ok' && ev.id !== player.id) playSfx('vote');
  }, [bp.event]);

  const prevPhaseRef = useRef('lobby');
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = bp.phase;
    if (prev !== 'final' && bp.phase === 'final') {
      playSfx('fanfare');
      fireConfetti();
    }
  }, [bp.phase]);

  const lastTickRef = useRef('');
  useEffect(() => {
    if (phase !== 'play') return;
    const key = `${bp.round}-${secsLeft}`;
    if (lastTickRef.current === key) return;
    lastTickRef.current = key;
    if (secsLeft > 0 && secsLeft <= 2) playSfx('tick');
  }, [secsLeft, bp.round, phase]);

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

  // ==========================================
  // BRIQUES D'AFFICHAGE
  // ==========================================
  const aliveCount = bp.order.filter((id) => bp.lives[id] > 0).length;
  const renderProgressHeader = () => (
    <div className="shrink-0 mb-4 bg-gray-900/80 border border-gray-800 rounded-2xl px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-sm flex-wrap">
        <span className="font-bold">
          {phase === 'play' ? 'La bombe tourne' : phase === 'final' ? 'Fin de la partie' : 'Lobby'}
        </span>
        <span className="text-gray-400 font-mono text-xs flex items-center gap-3 flex-wrap">
          {phase === 'play' && <span className="text-purple-300 font-bold">{aliveCount} en vie</span>}
          {phase === 'play' && <span>Syllabe n°{bp.round + 1}</span>}
          <span className="inline-flex items-center gap-1"><Users size={12} /> {players.length}</span>
        </span>
      </div>
    </div>
  );

  const renderSidebar = () => (
    <div className="w-full md:w-72 shrink-0 bg-gray-900 rounded-2xl border border-gray-800 shadow-xl shadow-black/30 p-4 flex flex-col md:h-[calc(100dvh-2rem)] md:sticky md:top-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-500 font-mono text-xs uppercase tracking-wide"># room-{room?.code}</span>
        <button onClick={copyCode} title="Copier le lien d'invitation" className="text-gray-500 hover:text-white transition">
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <div className="h-px bg-gray-800 my-3" />
      <h3 className="flex items-center gap-2 text-gray-500 font-bold mb-2 uppercase text-[11px] tracking-wide shrink-0">
        <Users size={13} /> En ligne — {players.length}
      </h3>
      <div className="space-y-1 md:flex-1 md:overflow-y-auto -mx-1 px-1">
        {players.map((p) => {
          const lives = bp.lives[p.id];
          const inGame = phase !== 'lobby' && lives !== undefined;
          const out = inGame && lives === 0;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition ${
                p.id === player.id ? 'bg-purple-900/30 border border-purple-400/40' : 'hover:bg-gray-800/70'
              } ${out ? 'opacity-50' : ''}`}
            >
              <span className="wiggle-hover inline-flex cursor-default">
                <PlayerDot id={p.id} avatar={p.avatar} size="md" />
              </span>
              <span className="font-bold truncate flex-1">{p.name}</span>
              {isHost && p.id !== player.id && <KickButton onClick={() => extras.kick(p.id)} />}
              {p.id === hostId && (
                <span className="text-[9px] font-bold text-purple-300 bg-purple-900/40 px-1.5 py-0.5 rounded shrink-0">HOST</span>
              )}
              {inGame && (out ? <Skull size={14} className="text-gray-500 shrink-0" /> : <Hearts lives={lives} max={bp.maxLives} />)}
            </div>
          );
        })}
      </div>
      <div className="h-px bg-gray-800 my-3 shrink-0" />
      <div className="flex items-center justify-between shrink-0">
        <button
          onClick={leaveRoom}
          className="flex items-center gap-2 text-gray-500 hover:text-red-400 text-sm font-bold transition py-1 active:scale-95"
        >
          <LogOut size={14} /> Quitter la room
        </button>
        <SoundToggle on={soundOn} onToggle={toggleSound} />
      </div>
    </div>
  );

  const renderAppShell = (mainContent) => (
    <div className="min-h-screen md:h-[100dvh] md:overflow-hidden bg-gray-950/90 text-white relative z-10 flex justify-center p-4 pt-16 md:pt-4 md:pl-28">
      <VersionBadge />
      <GamesRail />
      <ChatWidget extras={extras} me={player} enabled={settings.chatEnabled !== false} />
      {hostToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[960] animate-fadein bg-gray-900 border border-purple-600 shadow-xl text-white text-sm font-bold rounded-full px-5 py-2.5 flex items-center gap-2">
          <Crown size={16} className="text-yellow-400" /> {hostToast}
        </div>
      )}
      <div className="w-full max-w-[100rem] flex flex-col md:flex-row gap-4 md:h-full md:min-h-0">
        {renderSidebar()}
        <div className="flex-1 min-w-0 flex flex-col md:h-full md:min-h-0">
          {renderProgressHeader()}
          <div key={phase} className="flex-1 min-w-0 flex flex-col animate-fadein md:min-h-0 md:overflow-y-auto md:pr-1">
            {mainContent}
          </div>
        </div>
      </div>
    </div>
  );

  const waitingForHost = (
    <div className="flex items-center justify-center gap-3 text-gray-400 animate-pulse">
      <Loader2 className="animate-spin" /> En attente du Host...
    </div>
  );

  // ==========================================
  // ÉCRANS
  // ==========================================
  if (phase === 'home') {
    return (
      <>
        <div className="min-h-screen md:h-[100dvh] md:overflow-hidden bg-gray-950/90 text-white relative z-10 flex flex-col items-center justify-center p-4 pt-16 md:pt-4 md:pl-28">
          <VersionBadge />
          <GamesRail />
          <div className="text-center mb-2">
            <p className="eyebrow">✦ Course contre la montre ✦</p>
            <h1 className="font-heading text-5xl sm:text-7xl leading-none mt-2 ink-in">BOMB PARTY</h1>
          </div>
          <p className="text-gray-500 mb-6 italic text-center">Une syllabe, une bombe : trouve un mot avant l’explosion.</p>

          <div className="relative bg-gray-900 p-8 sm:p-10 rounded-2xl w-full max-w-xl shadow-2xl border border-gray-800">
            <SoundToggle on={soundOn} onToggle={toggleSound} className="absolute top-3 right-3" />
            <AccountButton auth={auth} />
            <div className="flex justify-center mb-4">
              <span
                className="w-16 h-16 flex items-center justify-center rounded-full text-3xl overflow-hidden"
                style={{ backgroundColor: `${colorForPlayer(player.avatar)}33`, border: `2px solid ${colorForPlayer(player.avatar)}` }}
              >
                <AvatarGlyph avatar={player.avatar} />
              </span>
            </div>
            <AvatarPicker auth={auth} avatar={player.avatar} activeClass="bg-orange-600" onPick={(avatar) => setPlayer((p) => ({ ...p, avatar }))} />
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
              <button
                onClick={createRoom}
                disabled={!player.name.trim()}
                className="w-full bg-purple-300 hover:bg-purple-200 !text-gray-950 shadow-md disabled:opacity-50 text-white font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition transform hover:scale-[1.02] active:scale-95"
              >
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
                <button
                  onClick={joinRoom}
                  disabled={!player.name.trim() || !joinCode.trim()}
                  className="w-1/3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-bold py-4 rounded-lg transition active:scale-95"
                >
                  Rejoindre
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowRules(true)}
              className="mt-5 w-full flex items-center justify-center gap-1.5 text-gray-500 hover:text-purple-300 text-sm font-bold transition"
            >
              <BookOpen size={15} /> Comment jouer ?
            </button>
          </div>
        </div>
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      </>
    );
  }

  if (phase === 'lobby') {
    return renderAppShell(
      <div className="bg-gray-900 p-8 rounded-2xl w-full max-w-3xl mx-auto shadow-2xl border border-gray-800 text-center">
        <GameArt id="bomb-party" className="h-28 mx-auto -mt-2 mb-2" />
        <h2 className="font-heading text-2xl mb-2">Code de la Room</h2>
        <div className="relative mb-8">
          <div className="text-6xl font-black font-mono tracking-widest text-purple-300 bg-gray-950 py-4 rounded-xl border border-gray-800">
            {room?.code}
          </div>
          <button
            onClick={copyCode}
            className="absolute right-3 bottom-3 flex items-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold px-3 py-2 rounded-lg transition active:scale-95"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Lien copié !' : "Copier l'invitation"}
          </button>
        </div>

        <div className="text-left mb-8 bg-gray-950 border border-gray-800 rounded-xl p-4">
          <h3 className="flex items-center gap-2 text-gray-400 font-bold mb-3 uppercase text-sm">
            <Settings size={16} /> Paramètres de la partie
          </h3>
          <RoomOptions settings={settings} updateSettings={updateSettings} isHost={isHost} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <label className="block text-gray-500 mb-1 text-xs">Vies par joueur</label>
              <select
                disabled={!isHost}
                value={settings.lives}
                onChange={(e) => updateSettings({ lives: Number(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60"
              >
                {[2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-500 mb-1 text-xs">Temps moyen par tour</label>
              <select
                disabled={!isHost}
                value={settings.seconds}
                onChange={(e) => updateSettings({ seconds: Number(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60"
              >
                {[6, 8, 10, 15, 20].map((n) => (
                  <option key={n} value={n}>{n}s</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-gray-500 mb-1 text-xs">Difficulté</label>
              <select
                disabled={!isHost}
                value={settings.difficulty}
                onChange={(e) => updateSettings({ difficulty: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60"
              >
                <option value="progressive">Progressive</option>
                <option value="easy">Facile</option>
                <option value="mix">Mélangé</option>
                <option value="hard">Difficile</option>
              </select>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-800 text-sm">
            <ToggleRow
              label="Vérifier le dictionnaire"
              hint="Refuse les mots qui n’existent pas (Wiktionnaire)"
              checked={settings.dictionary !== false}
              disabled={!isHost}
              onChange={(v) => updateSettings({ dictionary: v })}
            />
          </div>
        </div>

        {isHost ? (
          <button
            onClick={startGame}
            disabled={players.length < 2}
            className="w-full bg-purple-300 hover:bg-purple-200 !text-gray-950 shadow-md disabled:opacity-50 active:scale-95 text-white font-black py-4 px-6 rounded-lg text-lg transition"
          >
            {players.length < 2 ? "En attente d'au moins 2 joueurs..." : 'Allumer la mèche !'}
          </button>
        ) : (
          waitingForHost
        )}
      </div>
    );
  }

  if (phase === 'play') {
    const current = bp.turn;
    const shownText = current === player.id ? text : typing.id === current ? typing.text : '';
    const ev = bp.event;
    return renderAppShell(
      <div className="max-w-4xl w-full mx-auto">
        <div className="paper px-4 py-6 sm:px-8 text-center mb-5">
          <p className="eyebrow">{isMyTurn ? 'À toi de jouer !' : `Au tour de ${nameOf(current)}`}</p>
          <Bomb syllable={bp.syllable} ratio={ratio} boom={ev?.type === 'boom' && now - ev.t < 700 ? boomKey : 0} />
          <p className="text-xs text-gray-500 italic mt-1">Mèche aléatoire : impossible de savoir quand ça explose…</p>

          {isMyTurn ? (
            <form onSubmit={submitWord} className="max-w-md mx-auto mt-3">
              <div key={errorKey} className={`flex gap-2 ${error ? 'animate-nope' : ''}`}>
                <input
                  ref={inputRef}
                  type="text"
                  value={text}
                  onChange={(e) => onType(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={40}
                  placeholder={`Un mot avec « ${bp.syllable} »`}
                  className="min-w-0 flex-1 p-3 bg-gray-950 border border-gray-700 rounded-lg text-center font-bold text-xl text-white"
                />
                <button
                  type="submit"
                  disabled={busy || !text.trim()}
                  className="tag-dark px-5 flex items-center gap-1.5 disabled:opacity-40 active:scale-95"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Go
                </button>
              </div>
              <p className="min-h-[1.25rem] mt-2 text-sm text-red-400 font-bold">{error}</p>
            </form>
          ) : (
            <div className="max-w-md mx-auto mt-4 min-h-[3rem]">
              <p className="font-heading text-2xl text-white/90 tracking-wide break-all">{shownText || '…'}</p>
              {!iPlay && <p className="text-xs text-gray-500 mt-1 italic">Partie en cours : tu regardes cette manche.</p>}
              {iPlay && bp.lives[player.id] === 0 && <p className="text-xs text-gray-500 mt-1 italic">Tu es éliminé : profite du spectacle.</p>}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
          {bp.order.map((id) => {
            const lives = bp.lives[id];
            const isTurn = id === current;
            return (
              <div
                key={id}
                className={`rounded-xl p-3 border-2 flex flex-col items-center gap-1.5 transition ${
                  isTurn ? 'border-purple-300 bg-purple-900/30 shadow-lg scale-[1.03]' : lives === 0 ? 'border-gray-800 bg-gray-950 opacity-40' : 'border-gray-700 bg-gray-900'
                }`}
              >
                <span
                  className="w-12 h-12 inline-flex items-center justify-center rounded-full text-2xl overflow-hidden"
                  style={{ backgroundColor: `${colorForPlayer(id)}33`, border: `2px solid ${colorForPlayer(id)}` }}
                >
                  <AvatarGlyph avatar={avatarOf(id)} />
                </span>
                <span className="font-bold truncate max-w-full text-sm">{nameOf(id)}{id === player.id ? ' (toi)' : ''}</span>
                {lives === 0 ? <Skull size={16} className="text-gray-500" /> : <Hearts lives={lives} max={bp.maxLives} />}
              </div>
            );
          })}
        </div>

        {bp.recent.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <p className="eyebrow mb-2">Derniers mots</p>
            <div className="flex flex-wrap gap-1.5">
              {[...bp.recent].reverse().map((r, i) => (
                <span key={`${r.word}-${i}`} className="inline-flex items-center gap-1 bg-gray-800 rounded-full pl-0.5 pr-2.5 py-0.5 text-sm animate-fadein">
                  <PlayerDot id={r.id} avatar={avatarOf(r.id)} />
                  {r.word}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // phase === 'final'
  const front = bombFront({
    winnerName: bp.winner ? nameOf(bp.winner) : '',
    rounds: bp.round + 1,
    seed: bp.gameId || 'bomb-party',
  });
  const standings = [...bp.order].sort((a, b) => (bp.lives[b] || 0) - (bp.lives[a] || 0));
  return renderAppShell(
    <div className="flex flex-col items-center text-center max-w-4xl w-full mx-auto py-2">
      <FrontPage front={front} avatar={bp.winner ? avatarOf(bp.winner) : undefined} photoCaption="Le dernier survivant, encore sous le choc." />
      <p className="eyebrow mb-3">Le classement</p>
      <div className="w-full space-y-2 mb-8">
        {standings.map((id, i) => (
          <div
            key={id}
            className={`animate-rise flex items-center gap-3 rounded-xl px-4 py-3 border text-left ${
              id === bp.winner ? 'bg-gradient-to-r from-purple-900/50 to-gray-900 border-purple-400/50' : 'bg-gray-900 border-gray-800'
            }`}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <span className="w-6 text-center font-heading text-gray-500">{i + 1}</span>
            <PlayerDot id={id} avatar={avatarOf(id)} size="md" />
            <span className="font-bold truncate flex-1">{id === bp.winner && <Crown size={14} className="inline text-yellow-400 mr-1" />}{nameOf(id)}</span>
            {bp.lives[id] > 0 ? <Hearts lives={bp.lives[id]} max={bp.maxLives} /> : <Skull size={14} className="text-gray-500" />}
          </div>
        ))}
      </div>

      {isHost ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={startGame}
            disabled={players.length < 2}
            className="flex items-center gap-2 bg-purple-300 hover:bg-purple-200 !text-gray-950 disabled:opacity-50 shadow-md active:scale-95 font-bold py-3 px-6 rounded-full transition"
          >
            <RotateCcw size={16} /> Rejouer
          </button>
          <button onClick={backToLobby} className="text-sm text-gray-500 hover:text-white font-bold transition px-2">
            Changer les réglages
          </button>
        </div>
      ) : (
        waitingForHost
      )}
    </div>
  );
}
