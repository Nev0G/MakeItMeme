'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Users, Loader2, Crown, Settings, Copy, LogOut, Check, BookOpen, X, RotateCcw, Send, Volume2, Music } from 'lucide-react';
import {
  supabase, makeId, AVATAR_EMOJIS, fireConfetti, shuffle, colorForPlayer, randomAvatar, PlayerDot, playSfx, SoundToggle,
  GamesRail as SharedGamesRail, ToggleRow, makeSessionStore, MAX_NAME_LEN, readIdentity, writeIdentity, useSoundAndClickFx,
  useDiscordAuth, AccountButton, AvatarPicker, AvatarGlyph, isImageAvatar, useRefState,
  useRoomDirectory, VisibilityPicker, RoomOptions, useRoomExtras, ChatWidget, KickButton, toast,
} from '@/lib/shared';
import { encodeSecret, decodeSecret, judgeAnswer, normAns } from '@/lib/blindtest-judge';
import { GameArt } from '@/lib/art';

const APP_VERSION = 'blind test v1';
const GAME_ID = 'blind-test';
const REVEAL_SECONDS = 7;
const MAX_BLUR = 20; // flou de départ des images, en pixels
const BLUR_END = 0.6; // l'image est nette dès 60 % du temps écoulé
const VOLUME_KEY = 'blindtest-volume';
const ARTIST_PTS = 30; // points pour l'artiste (seul ou avec le titre)
// Époques proposées dans le lobby (années de sortie)
const ERAS = [
  { label: 'Toutes', from: null, to: null },
  { label: 'Avant 80', from: 1900, to: 1979 },
  { label: '80s', from: 1980, to: 1989 },
  { label: '90s', from: 1990, to: 1999 },
  { label: '2000s', from: 2000, to: 2009 },
  { label: '2010s', from: 2010, to: 2019 },
  { label: '2020s', from: 2020, to: 2030 },
];

const DEFAULT_SETTINGS = {
  visibility: 'private',
  roomName: '',
  chatEnabled: true,
  rounds: 10, // nombre d'extraits
  seconds: 20, // temps pour répondre (et durée du dévoilement des images)
  categories: [], // vide = toutes les catégories disponibles
  answerMode: 'free', // 'free' : on tape la réponse — 'choices' : 4 propositions
  hints: true, // lettres révélées au fil du temps (réponse libre)
  bonusFirst: true, // +25 pour le premier à trouver
  bonusExtra: true, // points pour l'artiste (seul ou avec le titre) en réponse libre, musiques
  yearMin: null, // période de sortie (null = toutes les époques)
  yearMax: null,
  chrono: false, // extraits classés du plus ancien au plus récent
};
const INITIAL_BT = {
  phase: 'lobby', // 'lobby' | 'loading' | 'play' | 'reveal' | 'final'
  gameId: null,
  order: [],
  round: 0,
  total: 0,
  startedAt: 0,
  duration: 20,
  t0: 0, // début de l'extrait audio (en secondes dans l'aperçu)
  until: 0, // fin de la phase « reveal »
  solved: {}, // id -> ms écoulées (titre trouvé)
  art: {}, // id -> true (artiste trouvé)
  lock: {}, // joueurs ayant déjà tenté leur chance (mode propositions)
  scores: {},
  gained: {},
  feed: [],
  reveal: null, // { d, s, c } réponse affichée à la fin de la manche
  stats: { fast: null, found: {} },
};

const { read: readSession, write: writeSession, clear: clearSession } = makeSessionStore('blindtest-session');
const GamesRail = () => <SharedGamesRail currentId="blind-test" />;
const VersionBadge = () => (
  <div className="fixed bottom-2 right-3 text-[10px] text-gray-600 font-mono select-none pointer-events-none z-50">{APP_VERSION}</div>
);

const RULES_STEPS = [
  { title: 'Écoute, regarde, devine', text: 'À chaque manche : un extrait sonore (musique, bande originale, jeu vidéo…) ou une image floutée (affiche, scène, capture). Trouve vite le titre !' },
  { title: 'Images', text: 'Les affiches ont un léger flou qui cache juste le titre, les captures de jeux sont nettes, et les scènes de films ou de séries sont floutées puis se dévoilent petit à petit. Plus tu trouves tôt, plus tu gagnes de points.' },
  { title: 'Réponse libre ou propositions', text: 'Selon le réglage du host : tu tapes ta réponse (quelques fautes sont tolérées) ou tu choisis parmi 4 propositions (un seul essai !).' },
  { title: 'Bonus', text: 'Pour les musiques, le titre et l’artiste rapportent chacun des points : trouve l’un et continue pour l’autre. Le premier à trouver le titre peut aussi gagner un bonus.' },
  { title: 'Catégories', text: 'Le host choisit les catégories : hits français ou internationaux, rap, rock, années 80-90-2000, films, séries, Disney, jeux vidéo, anime…' },
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

// Ordre de dévoilement des lettres : mélange stable à partir d'un texte (identique chez tous les joueurs)
const seededOrder = (seed: string, indexes: number[]) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9;
    return ((h >>> 0) % 100000) / 100000;
  };
  const a = [...indexes];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default function BlindTest() {
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
  const [bt, setBt, btRef] = useRefState(INITIAL_BT);
  const [deck, setDeck, deckRef] = useRefState([]); // pioche : { id, cat, kind, ask, url, choices, ak }
  const [known, setKnown, knownRef] = useRefState({});
  const [catInfo, setCatInfo] = useState([]);
  const [guess, setGuess] = useState('');
  const [needTap, setNeedTap] = useState(false);
  const [volume, setVolume] = useState(0.2);

  const playersRef = useRef([]);
  const channelRef = useRef(null);
  const isHostRef = useRef(false);
  const stepRef = useRef('');
  const loadingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const volumeRef = useRef(0.2);
  const { soundOn, toggleSound } = useSoundAndClickFx();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      audioRef.current?.pause();
    };
  }, []);
  useEffect(() => {
    const roomParam = new URLSearchParams(window.location.search).get('room');
    if (roomParam) setJoinCode(roomParam.toUpperCase());
    try {
      const v = parseFloat(localStorage.getItem(VOLUME_KEY) || '');
      if (!Number.isNaN(v)) setVolume(Math.min(1, Math.max(0, v)));
    } catch {
      // stockage indisponible
    }
  }, []);
  useEffect(() => {
    volumeRef.current = volume;
    if (audioRef.current) audioRef.current.volume = volume;
    try {
      localStorage.setItem(VOLUME_KEY, String(volume));
    } catch {
      // ignore
    }
  }, [volume]);

  const broadcast = (event, payload) => channelRef.current?.send({ type: 'broadcast', event, payload });
  const commitBt = (patch) => {
    const next = { ...btRef.current, ...patch };
    setBt(next);
    broadcast('bt', { bt: next });
  };
  const presentIds = () => new Set(playersRef.current.map((p) => p.id));

  // Catégories disponibles (selon les clés API configurées sur le serveur)
  useEffect(() => {
    if (!room) return;
    fetch('/api/blindtest?info=1')
      .then((r) => r.json())
      .then((d) => setCatInfo(d.categories || []))
      .catch(() => setCatInfo([]));
  }, [!!room]);

  // ==========================================
  // LOGIQUE DE JEU (le host fait foi)
  // ==========================================
  const secretOf = (item) => (item ? decodeSecret(item.ak) : null);

  const startRound = (i, base) => {
    const b = base || btRef.current;
    const item = deckRef.current[i];
    commitBt({
      ...b,
      phase: 'play',
      round: i,
      startedAt: Date.now(),
      duration: settingsRef.current.seconds,
      // extrait sonore : on démarre à un endroit aléatoire de l'aperçu (30 s)
      t0: item?.kind === 'audio' ? Math.round(Math.random() * Math.max(0, 27 - settingsRef.current.seconds) * 10) / 10 : 0,
      solved: {},
      art: {},
      lock: {},
      gained: {},
      feed: [],
      reveal: null,
    });
  };
  const revealRound = () => {
    const b = btRef.current;
    if (b.phase !== 'play') return;
    const s = secretOf(deckRef.current[b.round]);
    commitBt({ phase: 'reveal', until: Date.now() + REVEAL_SECONDS * 1000, reveal: s ? { d: s.d, s: s.s, c: s.c || null, y: s.y || null } : { d: '?', s: '', c: null, y: null } });
  };
  const advance = () => {
    const b = btRef.current;
    if (b.round + 1 >= b.total) commitBt({ phase: 'final' });
    else startRound(b.round + 1, b);
  };

  const handleGuess = (id, raw) => {
    const b = btRef.current;
    const cfg = settingsRef.current;
    const text = String(raw || '').slice(0, 80);
    const item = deckRef.current[b.round];
    if (b.phase !== 'play' || !item || !text.trim() || !b.order.includes(id)) return;
    const choices = cfg.answerMode === 'choices';
    const secret = secretOf(item);
    if (!secret) return;
    // En réponse libre, l'artiste est un 2e objectif (titre et artiste rapportent chacun des points)
    const artistGoal = !choices && cfg.bonusExtra !== false && secret.x.length > 0;
    const hasTitle = b.solved[id] !== undefined;
    const hasArtist = !!b.art[id];
    if (hasTitle && (!artistGoal || hasArtist)) return; // tout est déjà trouvé
    if (choices && (b.lock[id] || !item.choices.includes(text))) return;
    const res = judgeAnswer(text, secret, choices);
    const elapsed = Date.now() - b.startedAt;
    const gotTitle = res.ok && !hasTitle;
    const gotArtist = artistGoal && res.artist && !hasArtist;

    if (!gotTitle && !gotArtist) {
      if (res.ok || res.artist) return; // déjà trouvé plus tôt : rien de neuf
      commitBt({ feed: [...b.feed, { id, text, k: Date.now() }].slice(-30), lock: choices ? { ...b.lock, [id]: true } : b.lock });
      if (res.close) {
        if (id === playerIdRef.current) toast('🔥 Tu chauffes ! Presque…');
        else broadcast('close', { to: id });
      }
      return;
    }

    let pts = 0;
    let bonus = 0;
    const solved = { ...b.solved };
    const art = { ...b.art };
    let stats = b.stats;
    if (gotTitle) {
      const ratio = Math.min(1, elapsed / (b.duration * 1000));
      const first = Object.keys(b.solved).length === 0;
      pts += Math.round(50 + 100 * (1 - ratio));
      if (first && cfg.bonusFirst) bonus += 25;
      solved[id] = elapsed;
      stats = {
        fast: !b.stats.fast || elapsed < b.stats.fast.ms ? { id, ms: elapsed } : b.stats.fast,
        found: { ...b.stats.found, [id]: (b.stats.found[id] || 0) + 1 },
      };
    }
    if (gotArtist) {
      pts += ARTIST_PTS;
      art[id] = true;
    }
    pts += bonus;
    const kind = gotTitle && gotArtist ? 'both' : gotTitle ? 'title' : 'artist';
    const scores = { ...b.scores, [id]: (b.scores[id] || 0) + pts };
    const gained = { ...b.gained, [id]: (b.gained[id] || 0) + pts };
    const present = presentIds();
    const guessers = b.order.filter((x) => present.has(x));
    const feed = [...b.feed, { id, ok: true, kind, pts, bonus, k: Date.now() }].slice(-30);
    // La manche s'arrête quand tout le monde a tout trouvé (titre, et artiste si c'est un objectif)
    const done = guessers.length > 0 && guessers.every((x) => solved[x] !== undefined && (!artistGoal || art[x]));
    commitBt({ solved, art, scores, gained, stats, feed });
    if (done) revealRound();
  };
  const playerIdRef = useRef(null);
  playerIdRef.current = player.id;

  const startGame = async () => {
    if (!isHost || players.length < 2 || loadingRef.current) return;
    const cfg = settingsRef.current;
    const order = shuffle(players.map((p) => p.id));
    broadcast('roster', { known: knownRef.current });
    stepRef.current = '';
    loadingRef.current = true;
    commitBt({
      ...INITIAL_BT,
      phase: 'loading',
      gameId: makeId('g'),
      order,
      total: cfg.rounds,
      duration: cfg.seconds,
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      stats: { fast: null, found: {} },
    });
    try {
      const period = (cfg.yearMin ? `&from=${cfg.yearMin}` : '') + (cfg.yearMax ? `&to=${cfg.yearMax}` : '') + (cfg.chrono ? '&sort=year' : '');
      const res = await fetch(`/api/blindtest?cats=${encodeURIComponent((cfg.categories || []).join(','))}&n=${cfg.rounds}${period}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.deck)) throw new Error(data.error || 'Impossible de préparer la partie');
      const items = data.deck.map((it) => ({
        id: it.id,
        cat: it.cat,
        kind: it.kind,
        ask: it.ask,
        url: it.url,
        choices: it.choices,
        blur: it.blur || null,
        ak: encodeSecret({ a: it.answers, x: it.extras, d: it.display, s: it.sub, c: it.cover, y: it.year }),
      }));
      setDeck(items);
      broadcast('deck', { deck: items });
      startRound(0, { ...btRef.current, total: items.length });
    } catch (e: any) {
      toast(`Blind Test : ${e?.message || 'erreur'}`);
      commitBt({ ...INITIAL_BT });
    } finally {
      loadingRef.current = false;
    }
  };
  const backToLobby = () => commitBt({ ...INITIAL_BT });

  // Automatismes du host : fin du temps, passage à la suite
  useEffect(() => {
    if (!isHostRef.current) return;
    const b = btRef.current;
    const t = Date.now();
    const step = `${b.gameId}-${b.round}-${b.phase}`;
    if (b.phase === 'play' && t > b.startedAt + b.duration * 1000 && stepRef.current !== step) {
      stepRef.current = step;
      revealRound();
    } else if (b.phase === 'reveal' && t > b.until && stepRef.current !== step) {
      stepRef.current = step;
      advance();
    } else if (b.phase === 'loading' && !loadingRef.current && stepRef.current !== step) {
      // le host précédent est parti pendant la préparation : on revient au lobby
      stepRef.current = step;
      commitBt({ ...INITIAL_BT });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // ==========================================
  // CHANNEL DE LA ROOM
  // ==========================================
  const connectToRoom = (code, playerId, playerName, playerAvatar, isCreator) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase.channel(`blindtest:${code}`, { config: { presence: { key: playerId } } });

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
    // Rattrapage : le host renvoie réglages, pioche et état à qui arrive
    channel.on('presence', { event: 'join' }, ({ key }) => {
      if (key === playerId || !isHostRef.current) return;
      extras.onPresenceJoin(channel, key);
      channel.send({ type: 'broadcast', event: 'settings_update', payload: { settings: settingsRef.current } });
      channel.send({ type: 'broadcast', event: 'roster', payload: { known: knownRef.current } });
      channel.send({ type: 'broadcast', event: 'deck', payload: { deck: deckRef.current } });
      channel.send({ type: 'broadcast', event: 'bt', payload: { bt: btRef.current } });
    });
    channel.on('broadcast', { event: 'settings_update' }, ({ payload }) => setSettings(payload.settings));
    channel.on('broadcast', { event: 'roster' }, ({ payload }) => setKnown((prev) => ({ ...payload.known, ...prev })));
    channel.on('broadcast', { event: 'deck' }, ({ payload }) => setDeck(Array.isArray(payload.deck) ? payload.deck : []));
    channel.on('broadcast', { event: 'bt' }, ({ payload }) => setBt(payload.bt));
    channel.on('broadcast', { event: 'bt_guess' }, ({ payload }) => {
      if (isHostRef.current && payload?.id) handleGuess(payload.id, payload.text);
    });
    channel.on('broadcast', { event: 'close' }, ({ payload }) => {
      if (payload?.to === playerId) {
        toast('🔥 Tu chauffes ! Presque…');
        playSfx('whoosh');
      }
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
    playersRef.current = [];
    setSettings(DEFAULT_SETTINGS);
    setBt(INITIAL_BT);
    setDeck([]);
    setKnown({});
    setGuess('');
    stepRef.current = '';
    loadingRef.current = false;
    audioRef.current?.pause();
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
    started: bt.phase !== 'lobby',
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
  // ACTIONS DU JOUEUR
  // ==========================================
  const phase = room ? bt.phase : 'home';
  const item = deck[bt.round] || null;
  const secret = useMemo(() => (item ? decodeSecret(item.ak) : null), [item?.id, item?.ak]);
  const iSolved = bt.solved[player.id] !== undefined;
  const iArt = !!bt.art[player.id];
  const artistGoal = settings.answerMode === 'free' && settings.bonusExtra !== false && !!secret && secret.x.length > 0;
  const iDone = iSolved && (!artistGoal || iArt);
  const iLocked = !!bt.lock[player.id];
  const iPlay = bt.order.includes(player.id);

  const sendGuess = (text) => {
    const t = (text || '').trim();
    if (!t || phase !== 'play' || iDone || !iPlay) return;
    if (isHost) handleGuess(player.id, t);
    else broadcast('bt_guess', { id: player.id, text: t });
    playSfx('send');
  };
  const submitGuess = (e) => {
    e.preventDefault();
    const t = guess.trim();
    if (!t) return;
    setGuess('');
    sendGuess(t);
  };

  // ==========================================
  // SON : lecture de l'extrait, au bon endroit, pour tout le monde
  // ==========================================
  useEffect(() => {
    if (phase !== 'play' || !item) return;
    if (item.kind !== 'audio') {
      audioRef.current?.pause();
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    a.pause();
    a.src = item.url;
    a.preload = 'auto';
    a.volume = volumeRef.current;
    const seek = () => {
      const b = btRef.current;
      const start = (b.t0 || 0) + Math.max(0, (Date.now() - b.startedAt) / 1000);
      try {
        a.currentTime = Math.min(start, Math.max(0, (a.duration || 30) - 1));
      } catch {
        // position non réglable
      }
      a.play().then(() => setNeedTap(false)).catch(() => setNeedTap(true));
    };
    // Certains navigateurs refusent de se placer avant d'avoir assez chargé : on retente quand la lecture est prête
    const retry = () => {
      const b = btRef.current;
      const want = (b.t0 || 0) + Math.max(0, (Date.now() - b.startedAt) / 1000);
      if (Math.abs(a.currentTime - want) > 3 && want < (a.duration || 30) - 1) {
        try {
          a.currentTime = want;
        } catch {
          // ignore
        }
      }
    };
    a.onloadedmetadata = seek;
    a.oncanplay = () => {
      retry();
      a.oncanplay = null;
    };
    a.load();
    return () => {
      a.onloadedmetadata = null;
      a.oncanplay = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bt.round, bt.gameId, item?.id]);
  useEffect(() => {
    if (phase !== 'play' && phase !== 'reveal') audioRef.current?.pause();
  }, [phase]);

  // Préchargement : toutes les images, et l'extrait suivant
  useEffect(() => {
    deck.forEach((it) => {
      if (it.kind === 'image') {
        const img = new Image();
        img.src = it.url;
      }
    });
  }, [deck.length]);
  useEffect(() => {
    const next = deck[bt.round + 1];
    if (next?.kind === 'audio') {
      const p = new Audio();
      p.preload = 'auto';
      p.src = next.url;
      preloadRef.current = p;
    }
  }, [bt.round, deck.length]);

  // Sons du jeu
  useEffect(() => {
    if (phase === 'play') playSfx('roundStart');
    if (phase === 'reveal') playSfx('reveal');
    if (phase === 'final') {
      playSfx('fanfare');
      fireConfetti();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bt.round]);
  const feedLenRef = useRef(0);
  useEffect(() => {
    const prev = feedLenRef.current;
    feedLenRef.current = bt.feed.length;
    const last = bt.feed[bt.feed.length - 1];
    if (bt.feed.length > prev && last?.ok && last.id !== player.id) playSfx('vote');
    if (bt.feed.length > prev && last?.ok && last.id === player.id) {
      playSfx('success');
      fireConfetti({ count: 50, duration: 1400 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bt.feed.length]);
  const lastTickRef = useRef('');
  const elapsed = Math.max(0, now - bt.startedAt);
  const msLeft = phase === 'play' ? Math.max(0, bt.duration * 1000 - elapsed) : phase === 'reveal' ? Math.max(0, bt.until - now) : 0;
  const secsLeft = Math.ceil(msLeft / 1000);
  useEffect(() => {
    if (phase !== 'play') return;
    const key = `${bt.round}-${secsLeft}`;
    if (lastTickRef.current === key) return;
    lastTickRef.current = key;
    if (secsLeft > 0 && secsLeft <= 5) playSfx('tick');
  }, [secsLeft, phase, bt.round]);
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
  // DONNÉES DÉRIVÉES
  // ==========================================
  const nameOf = (id) => known[id]?.name || '???';
  const avatarOf = (id) => known[id]?.avatar;
  const ratioLeft = phase === 'play' && bt.duration ? Math.min(1, msLeft / (bt.duration * 1000)) : 1;
  const ranking = [...bt.order].sort((a, b) => (bt.scores[b] || 0) - (bt.scores[a] || 0));
  // flou : part de MAX_BLUR et s'estompe jusqu'à zéro à BLUR_END du chrono
  const blurPx = phase === 'play' ? Math.max(0, MAX_BLUR * (1 - elapsed / (bt.duration * 1000 * BLUR_END))) : 0;
  // Par catégorie : captures de jeux sans flou, affiches avec un flou léger constant (cache le titre), le reste progressif
  const blurCss = (it, reveal) => {
    if (reveal || !it || it.blur === 'none') return 'none';
    if (it.blur === 'light') return 'blur(max(5px, 1.5vh))';
    return `blur(${blurPx.toFixed(1)}px)`;
  };

  // Indice : lettres du titre qui apparaissent après 40 % du temps (réponse libre).
  // Un tiret bas par lettre, les mots restent séparés (« _ _ _ / _ _ _ _ »).
  const hintWords = (() => {
    if (!secret || !settings.hints || settings.answerMode !== 'free' || phase !== 'play') return null;
    const chars = Array.from(secret.d);
    const letters = chars.map((ch, i) => (normAns(ch) ? i : -1)).filter((i) => i >= 0);
    const r = elapsed / (bt.duration * 1000);
    const count = r < 0.4 ? 0 : Math.min(Math.floor(letters.length / 2), 1 + Math.floor((r - 0.4) / 0.15));
    const shown = new Set(seededOrder(item?.id || '', letters).slice(0, count));
    const words: string[][] = [[]];
    chars.forEach((ch, i) => {
      if (/\s/.test(ch)) {
        if (words[words.length - 1].length) words.push([]);
      } else words[words.length - 1].push(!normAns(ch) ? ch : shown.has(i) ? ch.toUpperCase() : '_');
    });
    return words.filter((w) => w.length);
  })();

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
        {[...players].sort((a, b) => (bt.scores[b.id] || 0) - (bt.scores[a.id] || 0)).map((p) => {
          const solved = phase === 'play' && bt.solved[p.id] !== undefined && (!artistGoal || !!bt.art[p.id]);
          const partial = phase === 'play' && !solved && (bt.solved[p.id] !== undefined || !!bt.art[p.id]);
          const locked = phase === 'play' && settings.answerMode === 'choices' && !!bt.lock[p.id] && !solved;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition ${p.id === player.id ? 'bg-black/25 border border-purple-400/30' : 'hover:bg-black/20'}`}
            >
              <span className="wiggle-hover inline-flex cursor-default"><PlayerDot id={p.id} avatar={p.avatar} size="md" /></span>
              <span className="font-bold truncate flex-1">{p.name}</span>
              {isHost && p.id !== player.id && <KickButton onClick={() => extras.kick(p.id)} />}
              {solved && <Check size={14} className="text-teal-300 shrink-0" />}
              {partial && <span title={bt.art[p.id] ? 'Artiste trouvé' : 'Titre trouvé'} className="text-xs shrink-0">{bt.art[p.id] ? '🎤' : '🎵'}</span>}
              {locked && <X size={14} className="text-red-400 shrink-0" />}
              {p.id === hostId && <span className="text-[9px] font-bold text-purple-300 bg-purple-900/50 px-1.5 py-0.5 rounded shrink-0">HOST</span>}
              <span key={bt.scores[p.id] || 0} className="font-black text-purple-300 text-xs shrink-0 w-9 text-right animate-pop">{bt.scores[p.id] || 0}</span>
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

  const catOf = (id) => catInfo.find((c) => c.id === id);

  // Zone principale : l'extrait (équaliseur) ou l'image floutée
  const renderStage = () => {
    if (!item) return <div className="paper flex-1 flex items-center justify-center text-gray-400"><Loader2 className="animate-spin mr-2" /> Chargement…</div>;
    const isReveal = phase === 'reveal';
    const cat = catOf(item.cat);
    return (
      <div className="paper relative flex-1 min-h-[16rem] md:min-h-0 overflow-hidden flex flex-col items-center justify-center p-3">
        <div className="absolute top-3 left-3 z-10 rounded-full bg-black/55 px-3 py-1 text-xs font-bold">
          {cat ? `${cat.emoji} ${cat.label}` : item.cat}
        </div>
        {item.kind === 'image' ? (
          <div className="relative w-full h-full flex-1 min-h-0 flex items-center justify-center overflow-hidden rounded-xl bg-black/40">
            <img
              src={item.url}
              alt={isReveal ? 'Image du round' : 'Image floutée à deviner'}
              referrerPolicy="no-referrer"
              draggable={false}
              className="bt-image max-h-full max-w-full object-contain select-none"
              style={{ filter: blurCss(item, isReveal), transform: isReveal || item.blur === 'none' ? 'none' : 'scale(1.06)' }}
            />
          </div>
        ) : isReveal && bt.reveal?.c ? (
          <img src={bt.reveal.c} alt="" referrerPolicy="no-referrer" className="max-h-full max-w-[min(100%,22rem)] rounded-xl shadow-2xl object-contain animate-pop" />
        ) : (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className={`bt-vinyl ${phase === 'play' ? 'bt-vinyl-spin' : ''}`} aria-hidden="true"><Music size={34} className="text-gray-950" /></div>
            <div className="bt-eq" aria-hidden="true">
              {Array.from({ length: 14 }).map((_, i) => (
                <span key={i} style={{ animationDelay: `${(i * 97) % 700}ms` }} className={phase === 'play' ? 'bt-eq-on' : ''} />
              ))}
            </div>
            {needTap && phase === 'play' && (
              <button
                onClick={() => audioRef.current?.play().then(() => setNeedTap(false)).catch(() => {})}
                className="tag-dark px-5 py-3 flex items-center gap-2 animate-pulse"
              >
                <Volume2 size={16} /> Activer le son
              </button>
            )}
          </div>
        )}
        {isReveal && bt.reveal && (
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 to-transparent px-4 pt-10 pb-4 text-center animate-fadein">
            <p className="eyebrow">C’était</p>
            <p className="font-heading text-3xl sm:text-4xl text-purple-300 break-words">{bt.reveal.d}</p>
            {(bt.reveal.s || bt.reveal.y) && (
              <p className="text-sm text-gray-300">{[bt.reveal.s, bt.reveal.y && !String(bt.reveal.s || '').includes(String(bt.reveal.y)) ? bt.reveal.y : ''].filter(Boolean).join(' · ')}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderGame = () => {
    const timerDanger = phase === 'play' && secsLeft <= 5;
    const choices = settings.answerMode === 'choices';
    return (
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col gap-3 min-h-0">
          <div className="paper px-4 py-2.5 flex items-center justify-between gap-3">
            <span className="text-xs text-gray-400 font-mono shrink-0">Extrait<br />{Math.min(bt.round + 1, bt.total)}/{bt.total}</span>
            <div className="text-center min-w-0">
              <p className="text-base sm:text-lg font-bold">{item?.ask || '…'}</p>
              {hintWords && (
                <p className="font-mono text-lg sm:text-xl font-bold text-purple-200 flex flex-wrap justify-center gap-x-12 gap-y-1" aria-label={`${hintWords.length} mot${hintWords.length > 1 ? 's' : ''}`}>
                  {hintWords.map((w, wi) => (
                    <span key={wi} className="tracking-[0.1em] whitespace-nowrap">{w.join(' ')}</span>
                  ))}
                </p>
              )}
            </div>
            <div className={`shrink-0 font-heading text-2xl w-14 text-right ${timerDanger ? 'text-red-400 animate-pulse' : 'text-purple-300'}`}>{phase === 'play' || phase === 'reveal' ? secsLeft : ''}</div>
          </div>
          {phase === 'play' && (
            <div className="h-1.5 -mt-1.5 rounded-full bg-black/40 overflow-hidden shrink-0">
              <div className="h-full shimmer-bar transition-[width] duration-200" style={{ width: `${ratioLeft * 100}%` }} />
            </div>
          )}

          {renderStage()}

          {phase === 'play' && item?.kind === 'audio' && (
            <div className="paper px-4 py-2 flex items-center gap-3 shrink-0">
              <Volume2 size={16} className="text-purple-300 shrink-0" />
              <input type="range" min={0} max={1} step={0.05} value={volume} aria-label="Volume" onChange={(e) => setVolume(Number(e.target.value))} className="flex-1 h-2 cursor-pointer accent-[#d9f891]" />
              <span className="text-xs font-mono text-gray-400 w-9 text-right">{Math.round(volume * 100)}%</span>
            </div>
          )}

          {/* Réponse */}
          {phase === 'play' && iPlay && (
            choices ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 shrink-0">
                {(item?.choices || []).map((c) => (
                  <button
                    key={c}
                    data-sfx="off"
                    disabled={iSolved || iLocked}
                    onClick={() => sendGuess(c)}
                    className="paper px-4 py-3 text-left font-bold break-words hover:border-purple-300 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-default"
                  >
                    {c}
                  </button>
                ))}
                {(iSolved || iLocked) && (
                  <p className="sm:col-span-2 text-center text-sm text-gray-400">{iSolved ? '✅ Bien joué, attends les autres…' : '❌ Raté ! Un seul essai par extrait.'}</p>
                )}
              </div>
            ) : (
              <form onSubmit={submitGuess} className="flex gap-2 shrink-0">
                <input
                  type="text"
                  value={guess}
                  maxLength={80}
                  disabled={iDone}
                  onChange={(e) => setGuess(e.target.value)}
                  placeholder={
                    iDone ? 'Tu as tout trouvé !'
                    : iSolved ? `Titre trouvé ✅ — trouve aussi l’artiste (+${ARTIST_PTS})`
                    : iArt ? 'Artiste trouvé ✅ — trouve maintenant le titre !'
                    : artistGoal ? 'Titre et/ou artiste…' : 'Ta réponse…'
                  }
                  autoFocus
                  autoComplete="off"
                  className="flex-1 min-w-0 p-3 bg-gray-950 border-2 border-gray-700 rounded-xl font-bold focus:outline-none disabled:opacity-60"
                />
                <button type="submit" aria-label="Envoyer ma réponse" disabled={iDone || !guess.trim()} data-sfx="off" className="bg-purple-300 hover:bg-purple-200 !text-gray-950 disabled:opacity-40 px-5 rounded-xl active:scale-95 transition">
                  <Send size={18} />
                </button>
              </form>
            )
          )}
          {phase === 'play' && !iPlay && <p className="text-center text-sm text-gray-400">Partie en cours : tu regardes cette manche.</p>}
        </div>

        <aside className="lg:w-72 shrink-0 flex flex-col gap-3 min-h-0 lg:max-h-full">
          <div className="paper p-3 flex-1 min-h-[9rem] lg:min-h-0 overflow-y-auto flex flex-col-reverse">
            <ul className="space-y-1.5 text-sm">
              {bt.feed.length === 0 && <li className="text-gray-500 text-center py-4 text-xs">Les réponses apparaîtront ici…</li>}
              {bt.feed.map((f) => (
                <li key={f.k} className={`animate-fadein flex items-start gap-1.5 rounded-lg px-2 py-1 ${f.ok ? 'bg-teal-900/50 text-teal-200' : ''}`}>
                  <span className="mt-0.5 shrink-0"><PlayerDot id={f.id} avatar={avatarOf(f.id)} /></span>
                  <span className="min-w-0 break-words">
                    <b className="text-gray-300">{nameOf(f.id)}</b>{' '}
                    {f.ok ? <>a trouvé {f.kind === 'artist' ? 'l’artiste' : f.kind === 'both' ? 'le titre et l’artiste' : artistGoal ? 'le titre' : ''} ! <b>+{f.pts}</b>{f.bonus ? <span className="text-xs"> (dont bonus {f.bonus})</span> : null} 🎉</> : <span className="text-gray-200">{f.text}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {phase === 'reveal' && (
            <div className="paper p-3 text-sm shrink-0">
              {Object.keys(bt.gained).length === 0 ? (
                <p className="text-gray-300 text-center">Personne n’a trouvé… 🦗</p>
              ) : (
                <div className="flex flex-wrap gap-2 justify-center">
                  {Object.entries(bt.gained).filter(([, v]: any) => v > 0).map(([id, v]: any) => (
                    <span key={id} className="stamp animate-pop">{nameOf(id)} +{v}</span>
                  ))}
                </div>
              )}
            </div>
          )}
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
            <p className="eyebrow">✦ Musiques &amp; images ✦</p>
            <h1 className="font-heading text-4xl min-[420px]:text-5xl sm:text-7xl leading-none mt-2 ink-in">BLIND TEST</h1>
          </div>
          <p className="text-gray-400 mb-6 italic text-center">Un son, une image qui se dévoile : trouve avant les autres.</p>
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
    const groups = Array.from(new Set(catInfo.map((c) => c.group)));
    const selected = settings.categories || [];
    const toggleCat = (id) => updateSettings({ categories: selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id] });
    return renderShell(
      <div className="paper p-6 sm:p-8 w-full max-w-3xl mx-auto text-center md:overflow-y-auto">
        <GameArt id="blind-test" className="h-28 mx-auto -mt-2 mb-2" />
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

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-gray-500 text-xs">Catégories {selected.length ? `(${selected.length} choisie${selected.length > 1 ? 's' : ''})` : '(toutes)'}</label>
              {isHost && selected.length > 0 && (
                <button type="button" onClick={() => updateSettings({ categories: [] })} className="text-xs text-gray-400 hover:text-white font-bold">Tout réinitialiser</button>
              )}
            </div>
            {catInfo.length === 0 ? (
              <p className="text-xs text-gray-500">Chargement des catégories…</p>
            ) : (
              groups.map((g) => (
                <div key={g} className="mb-2">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500 font-bold mb-1">{g}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {catInfo.filter((c) => c.group === g).map((c) => {
                      const on = selected.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          disabled={!isHost || !c.available}
                          title={c.available ? c.label : `Indisponible : clé API manquante (${c.missing})`}
                          onClick={() => toggleCat(c.id)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-full border transition active:scale-95 disabled:cursor-default ${
                            !c.available ? 'border-gray-800 text-gray-600 line-through opacity-60' : on ? 'bg-purple-300 text-gray-950 border-purple-300' : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                          }`}
                        >
                          {c.emoji} {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
            {catInfo.some((c) => !c.available) && (
              <p className="text-[11px] text-gray-600 mt-1">Les catégories barrées demandent une clé API (TMDB pour les films et séries, RAWG pour les jeux) à configurer sur le serveur.</p>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-gray-500 mb-2 text-xs">Époque (année de sortie)</label>
            <div className="flex flex-wrap gap-1.5">
              {ERAS.map((e) => {
                const on = (settings.yearMin || null) === e.from && (settings.yearMax || null) === e.to;
                return (
                  <button
                    key={e.label}
                    type="button"
                    disabled={!isHost}
                    onClick={() => updateSettings({ yearMin: e.from, yearMax: e.to })}
                    className={`px-3 py-1.5 text-xs font-bold rounded-full border transition active:scale-95 disabled:cursor-default ${on ? 'bg-purple-300 text-gray-950 border-purple-300' : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'}`}
                  >
                    {e.label}
                  </button>
                );
              })}
            </div>
            {settings.yearMin && <p className="text-[11px] text-gray-600 mt-1">Une époque précise réduit le choix : si un extrait manque, il est remplacé par un autre.</p>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <label className="block text-gray-500 mb-1 text-xs">Nombre d’extraits</label>
              <select disabled={!isHost} value={settings.rounds} onChange={(e) => updateSettings({ rounds: Number(e.target.value) })} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60">
                {[5, 8, 10, 15, 20].map((n) => (<option key={n} value={n}>{n}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-gray-500 mb-1 text-xs">Temps par extrait</label>
              <select disabled={!isHost} value={settings.seconds} onChange={(e) => updateSettings({ seconds: Number(e.target.value) })} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60">
                {[10, 15, 20, 30, 45].map((n) => (<option key={n} value={n}>{n}s</option>))}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-gray-500 mb-1 text-xs">Façon de répondre</label>
              <select disabled={!isHost} value={settings.answerMode} onChange={(e) => updateSettings({ answerMode: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60">
                <option value="free">Réponse libre</option>
                <option value="choices">4 propositions</option>
              </select>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-800 text-sm space-y-3">
            <ToggleRow label="Ordre chronologique" hint="Les extraits sont classés du plus ancien au plus récent" checked={!!settings.chrono} disabled={!isHost} onChange={(v) => updateSettings({ chrono: v })} />
            <ToggleRow label="Bonus du premier" hint="+25 points pour le premier à trouver le titre" checked={settings.bonusFirst !== false} disabled={!isHost} onChange={(v) => updateSettings({ bonusFirst: v })} />
            {settings.answerMode === 'free' && (
              <>
                <ToggleRow label="Points pour l'artiste" hint="+30 points si tu trouves l'artiste, seul ou avec le titre : titre et artiste se cherchent chacun de leur côté (musiques)" checked={settings.bonusExtra !== false} disabled={!isHost} onChange={(v) => updateSettings({ bonusExtra: v })} />
                <ToggleRow label="Indices progressifs" hint="Des lettres du titre se dévoilent quand le temps file" checked={settings.hints !== false} disabled={!isHost} onChange={(v) => updateSettings({ hints: v })} />
              </>
            )}
          </div>
        </div>
        {isHost ? (
          <button onClick={startGame} disabled={players.length < 2} className="w-full bg-purple-300 hover:bg-purple-200 !text-gray-950 shadow-md disabled:opacity-50 active:scale-95 font-black py-4 px-6 rounded-lg text-lg transition">
            {players.length < 2 ? "En attente d'au moins 2 joueurs..." : 'Lancer le blind test !'}
          </button>
        ) : (
          waitingForHost
        )}
        <button onClick={() => setShowRules(true)} className="mt-4 text-gray-400 hover:text-purple-300 text-sm font-bold transition inline-flex items-center gap-1.5"><BookOpen size={15} /> Comment jouer ?</button>
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      </div>
    );
  }

  if (phase === 'loading') {
    return renderShell(
      <div className="paper flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <GameArt id="blind-test" className="h-32" />
        <Loader2 size={30} className="animate-spin text-purple-300" />
        <p className="font-heading text-2xl">Préparation des extraits…</p>
        <p className="text-sm text-gray-400">On va chercher les musiques et les images, ça prend quelques secondes.</p>
      </div>
    );
  }

  if (phase === 'final') {
    const fast = bt.stats.fast;
    const best = Object.entries(bt.stats.found).sort((a: any, b: any) => b[1] - a[1])[0] as any;
    return renderShell(
      <div className="paper p-6 sm:p-8 w-full max-w-3xl mx-auto text-center md:overflow-y-auto animate-fadein">
        <p className="eyebrow">Fin du blind test</p>
        <h2 className="font-heading text-3xl mt-1 mb-5">🏆 {nameOf(ranking[0])} a la meilleure oreille !</h2>
        <div className="space-y-2 mb-6">
          {ranking.map((id, i) => (
            <div key={id} className="animate-rise flex items-center gap-3 rounded-xl px-4 py-2.5 bg-black/25 border border-purple-600/30 text-left" style={{ animationDelay: `${i * 70}ms` }}>
              <span className="font-heading text-xl w-7 text-purple-300">{i + 1}</span>
              <PlayerDot id={id} avatar={avatarOf(id)} size="md" />
              <span className="font-bold truncate flex-1">{nameOf(id)}</span>
              <span className="text-xs text-gray-400">{bt.stats.found[id] || 0} trouvé{(bt.stats.found[id] || 0) > 1 ? 's' : ''}</span>
              <span className="font-black text-purple-300 w-12 text-right">{bt.scores[id] || 0}</span>
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mb-6 text-sm">
          <div className="bg-black/25 border border-purple-600/30 rounded-xl p-3">
            <p className="eyebrow">⚡ Éclair</p>
            <p className="font-heading text-lg">{fast ? nameOf(fast.id) : '—'}</p>
            <p className="text-xs text-gray-400">{fast ? `bonne réponse en ${(fast.ms / 1000).toFixed(1)} s` : 'Aucune bonne réponse'}</p>
          </div>
          <div className="bg-black/25 border border-purple-600/30 rounded-xl p-3">
            <p className="eyebrow">👂 Oreille d’or</p>
            <p className="font-heading text-lg">{best ? nameOf(best[0]) : '—'}</p>
            <p className="text-xs text-gray-400">{best ? `${best[1]} extrait${best[1] > 1 ? 's' : ''} trouvé${best[1] > 1 ? 's' : ''}` : 'Personne n’a rien trouvé…'}</p>
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
