'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play, Trophy, Users, Loader2, Crown, Settings, Copy, LogOut, Check, BookOpen, X, RotateCcw, Eye, EyeOff, Send,
} from 'lucide-react';
import {
  supabase, makeId, fireConfetti, shuffle, colorForPlayer, AVATAR_EMOJIS, randomAvatar, PlayerDot, playSfx,
  SoundToggle, GamesRail as SharedGamesRail, Waiting, ToggleRow, CountdownBadge, makeSessionStore, MAX_NAME_LEN,
  readIdentity, writeIdentity, useSoundAndClickFx, useDiscordAuth, AccountButton, AvatarPicker, AvatarGlyph, isImageAvatar, useRefState,
  FrontPage, useRoomDirectory, VisibilityPicker, RoomOptions, useRoomExtras, ChatWidget, KickButton, toast,
} from '@/lib/shared';
import { WORD_CATEGORIES, PLAYERS_CATEGORY, pickWordPair, sameWord } from '@/lib/imposteur-words';
import { imposteurFront } from '@/lib/press';
import { SeatCharacter, ShootScene } from './character';

// ==========================================
// RÈGLES ET RÉGLAGES
// ==========================================
// Incrémenter à chaque mise à jour livrée du jeu.
const APP_VERSION = 'imposteur v7';
const GAME_ID = 'imposteur';
const GUESS_SECONDS = 25;
const MAX_CLUE_LEN = 30;
const SKIP_ID = 'skip'; // vote « je passe » : ne désigne personne
const POINTS_CIVIL_WIN = 2;
const POINTS_IMPOSTOR_WIN = 3;

const DEFAULT_SETTINGS = {
  visibility: 'private', // 'private' : code seulement — 'public' : visible dans la liste des salons
  roomName: '',
  chatEnabled: true,
  wordCategories: [], // catégories choisies (vide = toutes ; 'players' = pseudos des joueurs)
  mode: 'close', // 'close' : l'imposteur a un mot proche — 'blank' : l'imposteur n'a aucun mot
  blind: true, // l'imposteur ne sait pas qu'il est l'imposteur (il croit être civil)
  words: 3, // nombre de mots (donc de parties) par manche
  impostorCount: 1,
  mrWhite: false, // un des imposteurs devient Mister White : aucun mot, il sait qu'il est imposteur
  clueSeconds: 60,
  voteSeconds: 45,
  maxRounds: 3,
  lastChance: true,
};

const INITIAL_META = { phase: 'home', round: 0, turnIndex: 0, startedAt: null, eliminated: [], winner: null, reason: null, guess: null, delta: {}, wordIndex: 0, history: [] };

const { read: readSession, write: writeSession, clear: clearSession } = makeSessionStore('imposteur-session');
const GamesRail = () => <SharedGamesRail currentId="imposteur" />;
const VersionBadge = () => (
  <div className="fixed bottom-2 right-3 text-[10px] text-gray-600 font-mono select-none pointer-events-none z-50">
    {APP_VERSION}
  </div>
);

const RULES_STEPS = [
  { emoji: '🃏', title: 'Chacun reçoit une carte secrète', text: "Les civils ont tous le même mot. L'imposteur a un mot proche du leur, et par défaut il ne sait pas qu'il est l'imposteur : il se croit civil !" },
  { emoji: '💬', title: 'Un indice chacun son tour', text: "À ton tour, écris UN mot ou une courte expression qui évoque ton mot, sans jamais le dire. L'imposteur doit deviner et faire semblant." },
  { emoji: '🗳️', title: 'Tout le monde vote', text: "Après les indices, chacun désigne qui lui paraît louche. Le plus voté est éliminé et son rôle est révélé (égalité, ou autant de joueurs qui préfèrent passer : personne ne sort)." },
  { emoji: '👤', title: 'Mister White (option)', text: "Un des imposteurs n'a aucun mot et le sait. Il doit bluffer à partir des indices des autres, et s'il est démasqué, il a toujours droit à sa dernière chance pour deviner le mot des civils." },
  { emoji: '🎯', title: 'Dernière chance', text: "Un imposteur démasqué peut tenter de deviner le mot des civils : s'il trouve, il gagne quand même !" },
  { emoji: '🔁', title: 'Plusieurs mots par manche', text: "Une manche enchaîne plusieurs mots (3 par défaut), avec de nouveaux rôles à chaque fois. Les points se cumulent jusqu'au bilan final." },
  { emoji: '🏆', title: 'Qui gagne ?', text: "Les civils gagnent s'ils éliminent tous les imposteurs. L'imposteur gagne s'il survit à tous les tours, s'il reste autant d'imposteurs que de civils, ou s'il devine le mot." },
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
      <h2 className="font-heading text-2xl font-bold mb-5 flex items-center gap-2">
        <BookOpen size={22} className="text-orange-400" /> Comment jouer ?
      </h2>
      <div className="space-y-4">
        {RULES_STEPS.map((s, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-3xl shrink-0">{s.emoji}</span>
            <div>
              <p className="font-bold text-white">{s.title}</p>
              <p className="text-sm text-gray-400">{s.text}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-600 mt-6 border-t border-gray-800 pt-4">
        💡 Il faut au moins 3 joueurs. Le host règle le mode, le nombre d'imposteurs et les temps dans le lobby. Discutez à voix haute pendant le vote !
      </p>
      <button
        onClick={onClose}
        className="mt-5 w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-lg transition active:scale-95"
      >
        Compris !
      </button>
    </div>
  </div>
);

// ==========================================
// APPLICATION PRINCIPALE
// ==========================================
export default function Imposteur() {
  // État initial identique côté serveur et client (sinon erreur d'hydratation) ;
  // le pseudo/avatar mémorisés ou tirés au hasard sont appliqués juste après le montage.
  const [player, setPlayer] = useState({ id: null, name: '', avatar: AVATAR_EMOJIS[0] });
  useEffect(() => {
    const saved = readIdentity();
    setPlayer((p) => (p.id ? p : { ...p, name: saved?.name || p.name, avatar: saved?.avatar || randomAvatar() }));
  }, []);
  // Compte Discord (optionnel) : préremplit le pseudo, sauf si on est déjà dans une room
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
  const [players, setPlayers] = useState([]); // présence en direct
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());

  const [settings, setSettings, settingsRef] = useRefState(DEFAULT_SETTINGS);
  const [meta, setMeta, metaRef] = useRefState(INITIAL_META);
  const [game, setGame, gameRef] = useRefState({ gameId: null, participants: [], roles: {}, order: [] });
  const [clues, setClues, cluesRef] = useRefState([]); // { round, player_id, text, skipped? }
  const [votes, setVotes, votesRef] = useRefState([]); // { round, voter_id, target_id }
  const [readyIds, setReadyIds, readyRef] = useRefState([]);
  const [guessEntry, setGuessEntry, guessEntryRef] = useRefState(null); // { id, text }
  const [scores, setScores, scoresRef] = useRefState({});

  const [myClue, setMyClue] = useState('');
  const [clueError, setClueError] = useState('');
  const [myGuess, setMyGuess] = useState('');
  const [wordVisible, setWordVisible] = useState(false);

  const channelRef = useRef(null);
  const isHostRef = useRef(false);
  const autoRef = useRef('');
  const { soundOn, toggleSound } = useSoundAndClickFx();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const roomParam = new URLSearchParams(window.location.search).get('room');
    if (roomParam) setJoinCode(roomParam.toUpperCase());
  }, []);

  const broadcast = (event, payload) => channelRef.current?.send({ type: 'broadcast', event, payload });

  // Le host change la phase / le tour : état mis à jour chez lui puis diffusé à tous.
  const commitMeta = (patch) => {
    const next = { ...metaRef.current, ...patch };
    setMeta(next);
    broadcast('meta', { meta: next });
  };

  // ==========================================
  // ÉTAT DE PARTIE (ajout dédoublonné, puis diffusion par l'appelant)
  // ==========================================
  const addClue = (clue) =>
    setClues((prev) =>
      prev.some((c) => c.round === clue.round && c.player_id === clue.player_id) ? prev : [...prev, clue]
    );
  const addVote = (vote) => {
    // Un joueur éliminé à un tour précédent ne peut plus voter
    if (metaRef.current.eliminated.some((e) => e.id === vote.voter_id && e.round < vote.round)) return;
    setVotes((prev) => [...prev.filter((v) => !(v.voter_id === vote.voter_id && v.round === vote.round)), vote]);
  };
  const addReady = (id) => setReadyIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

  const applyGameStart = (payload) => {
    setGame({ gameId: payload.gameId, participants: payload.participants, roles: payload.roles, order: payload.order });
    if (!payload.resync) {
      setClues([]);
      setVotes([]);
      setReadyIds([]);
      setGuessEntry(null);
      setMyClue('');
      setMyGuess('');
      setClueError('');
      setWordVisible(false);
      if (payload.resetScores) setScores({});
    }
  };

  // ==========================================
  // CONNEXION AU CHANNEL DE LA ROOM (presence + broadcast)
  // ==========================================
  const connectToRoom = (code, playerId, playerName, playerAvatar, isCreator) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase.channel(`imposteur:${code}`, { config: { presence: { key: playerId } } });

    channel.on('presence', { event: 'sync' }, () => {
      const byId = new Map();
      Object.values(channel.presenceState())
        .flat()
        .forEach((p) => {
          const prev = byId.get(p.player_id);
          if (!prev || p.joined_at > prev.joined_at) {
            byId.set(p.player_id, {
              id: p.player_id,
              name: p.player_name,
              avatar: p.player_avatar,
              is_creator: p.is_creator,
              joined_at: p.joined_at,
            });
          }
        });
      setPlayers([...byId.values()].sort((a, b) => a.joined_at - b.joined_at));
    });

    // Rattrapage : le host renvoie tout l'état de la partie à qui arrive en cours de route.
    channel.on('presence', { event: 'join' }, ({ key }) => {
      if (key === playerId || !isHostRef.current) return;
      extras.onPresenceJoin(channel, key);
      channel.send({ type: 'broadcast', event: 'settings_update', payload: { settings: settingsRef.current } });
      channel.send({ type: 'broadcast', event: 'scores_sync', payload: { scores: scoresRef.current } });
      const phase = metaRef.current.phase;
      if (phase === 'home' || phase === 'lobby') {
        channel.send({ type: 'broadcast', event: 'meta', payload: { meta: metaRef.current } });
        return;
      }
      channel.send({ type: 'broadcast', event: 'game_start', payload: { ...gameRef.current, resync: true } });
      cluesRef.current.forEach((clue) => channel.send({ type: 'broadcast', event: 'clue', payload: { clue } }));
      votesRef.current.forEach((vote) => channel.send({ type: 'broadcast', event: 'vote', payload: { vote } }));
      readyRef.current.forEach((id) => channel.send({ type: 'broadcast', event: 'ready', payload: { id } }));
      if (guessEntryRef.current) channel.send({ type: 'broadcast', event: 'guess', payload: { entry: guessEntryRef.current } });
      channel.send({ type: 'broadcast', event: 'meta', payload: { meta: metaRef.current } });
    });

    channel.on('broadcast', { event: 'settings_update' }, ({ payload }) => setSettings(payload.settings));
    channel.on('broadcast', { event: 'scores_sync' }, ({ payload }) => setScores(payload.scores || {}));
    channel.on('broadcast', { event: 'game_start' }, ({ payload }) => applyGameStart(payload));
    channel.on('broadcast', { event: 'meta' }, ({ payload }) => setMeta(payload.meta));
    channel.on('broadcast', { event: 'ready' }, ({ payload }) => addReady(payload.id));
    channel.on('broadcast', { event: 'clue' }, ({ payload }) => addClue(payload.clue));
    channel.on('broadcast', { event: 'vote' }, ({ payload }) => addVote(payload.vote));
    channel.on('broadcast', { event: 'guess' }, ({ payload }) => setGuessEntry(payload.entry));

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
    setMeta(INITIAL_META);
    setGame({ gameId: null, participants: [], roles: {}, order: [] });
    setClues([]);
    setVotes([]);
    setReadyIds([]);
    setGuessEntry(null);
    setScores({});
    setMyClue('');
    setMyGuess('');
    setWordVisible(false);
    autoRef.current = '';
  };

  const enterRoom = (code, playerId, isCreator) => {
    resetLocalState();
    if (isCreator) setSettings((prev) => ({ ...prev, visibility: createVisibility }));
    setPlayer((p) => ({ ...p, id: playerId }));
    setRoom({ code });
    writeSession({ code, id: playerId, name: player.name.trim(), avatar: player.avatar });
    connectToRoom(code, playerId, player.name.trim(), player.avatar, isCreator);
    setMeta({ ...INITIAL_META, phase: 'lobby' });
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

  // Reconnexion automatique après un rafraîchissement (même identité, le host renvoie l'état).
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
    setMeta({ ...INITIAL_META, phase: 'lobby' });
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
    started: meta.phase !== 'lobby',
  });
  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  // Notif quand le host change (le plus ancien arrivé reprend la main)
  const [hostToast, setHostToast] = useState(null);
  const prevHostIdRef = useRef(null);
  useEffect(() => {
    const prev = prevHostIdRef.current;
    prevHostIdRef.current = hostId;
    if (!prev || !hostId || prev === hostId || players.length === 0 || meta.phase === 'home') return;
    const newHost = players.find((p) => p.id === hostId);
    if (!newHost) return;
    setHostToast(newHost.id === player.id ? 'Le host a quitté — tu es maintenant host !' : `👑 ${newHost.name} est le nouveau host`);
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
    const link =
      typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?room=${room.code}` : room.code;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponible : on ignore
    }
  };

  // ==========================================
  // DONNÉES DÉRIVÉES
  // ==========================================
  const { participants, roles, order } = game;
  const phase = meta.phase;
  const presentIds = useMemo(() => new Set(players.map((p) => p.id)), [players]);
  const eliminatedIds = useMemo(() => new Set(meta.eliminated.map((e) => e.id)), [meta.eliminated]);
  const aliveParticipants = participants.filter((p) => !eliminatedIds.has(p.id));
  const myRole = roles[player.id] || null; // null : spectateur (arrivé en cours de partie)
  const iAmAlive = !!myRole && !eliminatedIds.has(player.id);
  const impostorIds = participants.filter((p) => roles[p.id]?.role === 'imposteur').map((p) => p.id);
  const civilWord = useMemo(() => Object.values(roles).find((r) => r.role === 'civil')?.word || '', [roles]);
  const impostorWord = useMemo(() => Object.values(roles).find((r) => r.role === 'imposteur' && !r.white)?.word || null, [roles]);
  const isWhite = (id) => !!roles[id]?.white;
  // Ce joueur sait-il qu'il est de l'autre camp ? (à l'aveugle, un imposteur ordinaire se croit civil ; Mister White, jamais)
  const knowsImpostor = (id) => roles[id]?.role === 'imposteur' && (!settings.blind || isWhite(id));

  const nameOf = (id) => participants.find((p) => p.id === id)?.name || players.find((p) => p.id === id)?.name || '???';
  const avatarOf = (id) => participants.find((p) => p.id === id)?.avatar || players.find((p) => p.id === id)?.avatar;

  // Ordre de parole du tour : ordre tiré au hasard au départ, décalé d'un cran à chaque tour
  const turnList = useMemo(() => {
    const list = order.filter((id) => !eliminatedIds.has(id));
    if (list.length === 0) return [];
    const rot = meta.round % list.length;
    return [...list.slice(rot), ...list.slice(0, rot)];
  }, [order, eliminatedIds, meta.round]);
  const speakerId = phase === 'clues' ? turnList[meta.turnIndex] : null;

  const secondsLeftFor = (total) => {
    if (!meta.startedAt) return total;
    return Math.min(total, Math.max(0, total - Math.floor((now - meta.startedAt) / 1000)));
  };

  const cluesThisRound = clues.filter((c) => c.round === meta.round);
  const votesThisRound = votes.filter((v) => v.round === meta.round);
  const eligibleVoters = aliveParticipants.filter((p) => presentIds.has(p.id));
  const myVote = votesThisRound.find((v) => v.voter_id === player.id);
  const currentGuessEntry = guessEntry && guessEntry.id === meta.guess?.id ? guessEntry : null;

  // ==========================================
  // ACTIONS DU HOST
  // ==========================================
  const startGame = ({ resetScores = false, nextWord = false } = {}) => {
    if (!isHost || players.length < 3) return;
    const cfg = settingsRef.current;
    const n = players.length;
    const impostorCount = Math.max(1, Math.min(cfg.impostorCount, Math.floor((n - 1) / 2)));
    const pair = pickWordPair(cfg.wordCategories || [], players.map((p) => p.name));
    const impostors = shuffle(players.map((p) => p.id)).slice(0, impostorCount);
    const whiteId = cfg.mrWhite ? impostors[0] : null; // Mister White : même camp que les imposteurs, mais sans mot
    const newRoles = {};
    players.forEach((p) => {
      newRoles[p.id] = p.id === whiteId
        ? { role: 'imposteur', white: true, word: null }
        : impostors.includes(p.id)
        ? { role: 'imposteur', word: cfg.blind || cfg.mode === 'close' ? pair.imposter : null }
        : { role: 'civil', word: pair.civil };
    });
    const payload = {
      gameId: makeId('g'),
      participants: players.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar })),
      roles: newRoles,
      order: shuffle(players.map((p) => p.id)),
      resetScores,
    };
    applyGameStart(payload);
    broadcast('game_start', payload);
    autoRef.current = '';
    const prev = metaRef.current;
    const carry = nextWord ? { wordIndex: prev.wordIndex + 1, history: prev.history } : {};
    commitMeta({ ...INITIAL_META, ...carry, phase: 'reveal', startedAt: Date.now() });
  };

  const backToLobby = () => commitMeta({ ...INITIAL_META, phase: 'lobby' });

  // Fin de partie : points attribués une fois, par le host, puis diffusés
  const endGame = (winner, reason, guess) => {
    const delta = {};
    participants.forEach((p) => {
      const isImpostor = roles[p.id]?.role === 'imposteur';
      if (winner === 'civils' && !isImpostor) delta[p.id] = POINTS_CIVIL_WIN;
      if (winner === 'impostors' && isImpostor) delta[p.id] = POINTS_IMPOSTOR_WIN;
    });
    const nextScores = { ...scoresRef.current };
    Object.entries(delta).forEach(([id, pts]) => {
      nextScores[id] = (nextScores[id] || 0) + (pts as number);
    });
    setScores(nextScores);
    broadcast('scores_sync', { scores: nextScores });
    const m = metaRef.current;
    const finalGuess = guess ?? m.guess;
    const entry = {
      word: civilWord,
      impWord: impostorWord,
      impostors: impostorIds.map(nameOf),
      winner,
      reason,
      guess: finalGuess ? { name: nameOf(finalGuess.id), text: finalGuess.text, correct: !!finalGuess.correct } : null,
    };
    commitMeta({ phase: 'game_over', winner, reason, delta, guess: finalGuess, history: [...m.history, entry], startedAt: Date.now() });
  };

  // Après un tour : on regarde qui a gagné, sinon on enchaîne sur le tour suivant
  const finishRound = (guess) => {
    const m = metaRef.current;
    const aliveAfter = participants.filter((p) => !m.eliminated.some((e) => e.id === p.id));
    const impAlive = aliveAfter.filter((p) => roles[p.id]?.role === 'imposteur').length;
    const civAlive = aliveAfter.length - impAlive;
    if (impAlive === 0) return endGame('civils', 'found', guess);
    if (impAlive >= civAlive) return endGame('impostors', 'outnumbered', guess);
    if (m.round + 1 >= settingsRef.current.maxRounds) return endGame('impostors', 'survived', guess);
    commitMeta({ phase: 'clues', round: m.round + 1, turnIndex: 0, startedAt: Date.now(), guess: guess ?? m.guess });
  };

  const resolveVote = () => {
    const m = metaRef.current;
    const aliveIds = new Set(participants.filter((p) => !m.eliminated.some((e) => e.id === p.id)).map((p) => p.id));
    const tally = {};
    votesRef.current
      .filter((v) => v.round === m.round && aliveIds.has(v.voter_id) && aliveIds.has(v.target_id))
      .forEach((v) => {
        tally[v.target_id] = (tally[v.target_id] || 0) + 1;
      });
    const skips = votesRef.current.filter((v) => v.round === m.round && v.target_id === SKIP_ID && aliveIds.has(v.voter_id)).length;
    const max = Math.max(0, ...Object.values(tally).map(Number));
    const leaders = Object.keys(tally).filter((id) => tally[id] === max);
    // Personne n'est éliminé en cas d'égalité, ou si autant (ou plus) de joueurs préfèrent passer
    const eliminatedId = max > 0 && leaders.length === 1 && max > skips ? leaders[0] : null;
    commitMeta({
      phase: 'vote_result',
      startedAt: Date.now(),
      eliminated: eliminatedId ? [...m.eliminated, { id: eliminatedId, round: m.round }] : m.eliminated,
    });
  };

  // "Continuer" après les résultats du vote
  const continueAfterVote = () => {
    const m = metaRef.current;
    const last = m.eliminated.find((e) => e.round === m.round);
    // Mister White a toujours droit à sa dernière chance : sans mot, c'est sa seule voie de victoire
    if (last && roles[last.id]?.role === 'imposteur' && (settingsRef.current.lastChance || roles[last.id]?.white)) {
      setGuessEntry(null);
      commitMeta({ phase: 'guess', startedAt: Date.now(), guess: { id: last.id, round: m.round, text: null, correct: null } });
    } else {
      finishRound();
    }
  };

  const resolveGuess = () => {
    const m = metaRef.current;
    const entry = guessEntryRef.current;
    const text = entry && entry.id === m.guess?.id ? entry.text : '';
    const correct = !!text && sameWord(text, civilWord);
    const guess = { id: m.guess.id, round: m.guess.round, text: text || null, correct };
    if (correct) endGame('impostors', 'guessed', guess);
    else finishRound(guess);
  };

  // ==========================================
  // ACTIONS DES JOUEURS
  // ==========================================
  const markReady = () => {
    if (!myRole) return;
    addReady(player.id);
    broadcast('ready', { id: player.id });
    setWordVisible(false);
    playSfx('success');
  };

  const submitClue = () => {
    const text = myClue.trim();
    if (!text || speakerId !== player.id) return;
    if (myRole?.word && sameWord(text, myRole.word)) {
      setClueError('Tu ne peux pas écrire ton propre mot !');
      playSfx('error');
      return;
    }
    const clue = { round: meta.round, player_id: player.id, text };
    addClue(clue);
    broadcast('clue', { clue });
    setMyClue('');
    setClueError('');
    playSfx('send');
  };

  const castVote = (targetId) => {
    if (!iAmAlive || targetId === player.id) return;
    const vote = { round: meta.round, voter_id: player.id, target_id: targetId };
    addVote(vote);
    broadcast('vote', { vote });
    playSfx('vote');
  };

  const submitGuess = () => {
    const text = myGuess.trim();
    if (!text || meta.guess?.id !== player.id || currentGuessEntry) return;
    const entry = { id: player.id, text };
    setGuessEntry(entry);
    broadcast('guess', { entry });
    setMyGuess('');
    playSfx('send');
  };

  // ==========================================
  // AUTOMATISMES (côté host uniquement)
  // ==========================================
  // Tout le monde a vu sa carte → les indices commencent
  useEffect(() => {
    if (!isHost || phase !== 'reveal') return;
    const needed = participants.filter((p) => presentIds.has(p.id));
    if (needed.length > 0 && needed.every((p) => readyIds.includes(p.id))) {
      commitMeta({ phase: 'clues', round: 0, turnIndex: 0, startedAt: Date.now() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyIds, players, phase, isHost]);

  // Indices : on passe au joueur suivant dès qu'il a répondu, ou quand son temps est écoulé / qu'il est parti
  useEffect(() => {
    if (!isHost || phase !== 'clues' || !speakerId) return;
    const hasClue = clues.some((c) => c.round === meta.round && c.player_id === speakerId);
    if (!hasClue && secondsLeftFor(settings.clueSeconds) > 0 && presentIds.has(speakerId)) return;
    const key = `${game.gameId}-clue-${meta.round}-${meta.turnIndex}`;
    if (autoRef.current === key) return;
    autoRef.current = key;
    if (!hasClue) {
      const clue = { round: meta.round, player_id: speakerId, text: '', skipped: true };
      addClue(clue);
      broadcast('clue', { clue });
    }
    if (meta.turnIndex + 1 < turnList.length) commitMeta({ turnIndex: meta.turnIndex + 1, startedAt: Date.now() });
    else commitMeta({ phase: 'vote', startedAt: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, clues, players, meta, isHost]);

  // Vote : résultat dès que tout le monde a voté, ou quand le temps est écoulé
  useEffect(() => {
    if (!isHost || phase !== 'vote') return;
    const key = `${game.gameId}-vote-${meta.round}`;
    if (autoRef.current === key) return;
    const allVoted =
      eligibleVoters.length > 0 && eligibleVoters.every((p) => votesThisRound.some((v) => v.voter_id === p.id));
    if (allVoted || secondsLeftFor(settings.voteSeconds) === 0) {
      autoRef.current = key;
      resolveVote();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, votes, players, meta, isHost]);

  // Dernière chance : dès que la réponse est arrivée (ou temps écoulé / joueur parti)
  useEffect(() => {
    if (!isHost || phase !== 'guess' || !meta.guess) return;
    const key = `${game.gameId}-guess-${meta.round}`;
    if (autoRef.current === key) return;
    const answered = guessEntry && guessEntry.id === meta.guess.id;
    if (answered || secondsLeftFor(GUESS_SECONDS) === 0 || !presentIds.has(meta.guess.id)) {
      autoRef.current = key;
      resolveGuess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, guessEntry, players, meta, isHost]);

  // ==========================================
  // SONS ET EFFETS
  // ==========================================
  const prevPhaseRef = useRef({ phase: 'home', round: 0 });
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = { phase, round: meta.round };
    if (prev.phase === phase && prev.round === meta.round) return;
    if (prev.phase === 'home' || phase === 'lobby') return;
    if (phase === 'reveal' || phase === 'clues') playSfx('roundStart');
    else if (phase === 'vote') playSfx('voteStart');
    else if (phase === 'vote_result') {
      // Civil désigné : la scène de tir fait elle-même le bruit
      const out = metaRef.current.eliminated.find((e) => e.round === meta.round);
      if (!out || roles[out.id]?.role === 'imposteur') playSfx('reveal');
    }
    else if (phase === 'game_over') {
      playSfx('fanfare');
      fireConfetti();
    }
  }, [phase, meta.round]);

  // C'est mon tour de donner un indice
  useEffect(() => {
    if (phase === 'clues' && speakerId && speakerId === player.id) playSfx('voteStart');
  }, [speakerId, phase]);

  // Un joueur arrive / part
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

  // Tic-tac sur les 5 dernières secondes du temps de parole / de vote
  const lastTickRef = useRef(null);
  useEffect(() => {
    if (phase !== 'clues' && phase !== 'vote' && phase !== 'guess') {
      lastTickRef.current = null;
      return;
    }
    const total = phase === 'clues' ? settings.clueSeconds : phase === 'vote' ? settings.voteSeconds : GUESS_SECONDS;
    const left = secondsLeftFor(total);
    const key = `${phase}-${meta.round}-${meta.turnIndex}-${left}`;
    if (lastTickRef.current === key) return;
    lastTickRef.current = key;
    if (left > 0 && left <= 5) playSfx('tick');
    else if (left === 0) playSfx('buzzer');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, phase, meta.round, meta.turnIndex]);

  // ==========================================
  // BRIQUES D'AFFICHAGE
  // ==========================================
  const phaseLabels = {
    lobby: { emoji: '🛋️', label: 'Lobby' },
    reveal: { emoji: '🃏', label: 'Découverte de ta carte' },
    clues: { emoji: '💬', label: 'Indices' },
    vote: { emoji: '🗳️', label: 'Vote' },
    vote_result: { emoji: '💀', label: 'Résultat du vote' },
    guess: { emoji: '🎯', label: 'Dernière chance' },
    game_over: { emoji: '🎉', label: meta.wordIndex + 1 < settings.words ? 'Mot terminé' : 'Fin de la manche' },
  };

  const playerStatus = (p) => {
    if (!participants.some((x) => x.id === p.id)) return null;
    if (eliminatedIds.has(p.id)) return { dead: true };
    if (phase === 'reveal') return { done: readyIds.includes(p.id) };
    if (phase === 'clues') {
      if (speakerId === p.id) return { turn: true };
      return { done: cluesThisRound.some((c) => c.player_id === p.id) };
    }
    if (phase === 'vote') return { done: votesThisRound.some((v) => v.voter_id === p.id) };
    return null;
  };

  const renderProgressHeader = () => {
    const info = phaseLabels[phase] || phaseLabels.lobby;
    const inGame = participants.length > 0 && phase !== 'lobby';
    const completed = phase === 'game_over' ? settings.maxRounds : meta.round + (phase === 'vote_result' || phase === 'guess' ? 1 : 0);
    const progress = Math.min(1, completed / Math.max(1, settings.maxRounds));
    return (
      <div className="shrink-0 mb-4 bg-gray-900/80 border border-gray-800 rounded-2xl px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-sm flex-wrap">
          <span className="font-bold">
            {info.emoji} {info.label}
          </span>
          <span className="text-gray-400 font-mono text-xs flex items-center gap-3 flex-wrap">
            {inGame && settings.words > 1 && (
              <span className="text-purple-300 font-bold">
                Mot {Math.min(meta.wordIndex + 1, settings.words)}/{settings.words}
              </span>
            )}
            {inGame && phase !== 'game_over' && phase !== 'reveal' && (
              <span className="text-orange-300 font-bold">
                Tour {Math.min(meta.round + 1, settings.maxRounds)}/{settings.maxRounds}
              </span>
            )}
            {phase === 'clues' && (
              <span>
                💬 {cluesThisRound.length}/{turnList.length} indices
              </span>
            )}
            {phase === 'vote' && (
              <span>
                🗳️ {votesThisRound.length}/{eligibleVoters.length} votes
              </span>
            )}
            <span>👥 {players.length}</span>
          </span>
        </div>
        {inGame && (
          <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-red-500 to-orange-400 transition-all duration-500" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
      </div>
    );
  };

  const renderSidebar = () => (
    <div className="w-full md:w-72 shrink-0 bg-gray-900 rounded-2xl border border-gray-800 shadow-xl shadow-black/30 p-4 flex flex-col md:h-[calc(100dvh-2rem)] md:sticky md:top-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-500 font-mono text-xs uppercase tracking-wide"># room-{room?.code}</span>
        <button onClick={copyCode} title="Copier le lien d'invitation" className="text-gray-500 hover:text-white transition">
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <div className="h-px bg-gray-800 my-3" />
      <h3 className="flex items-center gap-2 text-gray-500 font-bold mb-3 uppercase text-[11px] tracking-wide shrink-0">
        <Users size={13} /> En ligne — {players.length}
      </h3>
      <div className="space-y-1 md:flex-1 md:overflow-y-auto -mx-1 px-1">
        {[...players]
          .sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))
          .map((p, i) => {
            const st = playerStatus(p);
            return (
              <div
                key={p.id}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition ${
                  st?.turn ? 'bg-orange-900/40 border border-orange-500/60' : p.id === player.id ? 'bg-purple-900/40 border border-purple-600/60' : 'hover:bg-gray-800/70'
                } ${st?.dead ? 'opacity-50' : ''}`}
              >
                <span className="wiggle-hover inline-flex cursor-default">
                  <PlayerDot id={p.id} avatar={p.avatar} size="md" />
                </span>
                <span className={`font-bold truncate flex-1 ${st?.dead ? 'line-through' : ''}`}>{p.name}</span>
                {isHost && p.id !== player.id && <KickButton onClick={() => extras.kick(p.id)} />}
                {st?.dead && <span title="Éliminé">💀</span>}
                {st?.turn && <span className="text-[10px] font-bold text-orange-300">🎤</span>}
                {st && !st.dead && !st.turn && (
                  <span className="shrink-0" title={st.done ? 'Fait' : 'En attente'}>
                    {st.done ? <Check size={14} className="text-green-400" /> : <Loader2 size={12} className="text-gray-600 animate-spin" />}
                  </span>
                )}
                {i === 0 && (scores[p.id] || 0) > 0 && <Crown size={13} className="text-yellow-400 shrink-0" />}
                {p.id === hostId && (
                  <span className="text-[9px] font-bold text-purple-400 bg-purple-900/40 px-1.5 py-0.5 rounded shrink-0">HOST</span>
                )}
                <span key={scores[p.id] || 0} className="font-black text-purple-300 text-xs shrink-0 w-6 text-right inline-block animate-pop">
                  {scores[p.id] || 0}
                </span>
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

  // Fonction ordinaire (pas un composant <Tag>) : un composant défini dans le
  // composant serait remonté à chaque rendu et ferait perdre le focus des champs.
  const renderLobbyShell = (mainContent) => (
    <div className="min-h-screen md:h-[100dvh] md:overflow-hidden bg-gray-950/95 text-white relative z-10 flex justify-center p-4 pt-16 md:pt-4 md:pl-28">
      <VersionBadge />
      <GamesRail />
      <ChatWidget extras={extras} me={player} enabled={settings.chatEnabled !== false} />
      {hostToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[960] animate-fadein bg-gray-900 border border-purple-600 shadow-xl shadow-purple-900/40 text-white text-sm font-bold rounded-full px-5 py-2.5 flex items-center gap-2">
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

  // ----- Le Bureau : scène d'enquête autour de la table (toutes les phases de jeu) -----
  const renderBureauSeat = (p, idx, total) => {
    const st = playerStatus(p) || {};
    const present = presentIds.has(p.id);
    const myClues = cluesThisRound.filter((c) => c.player_id === p.id && !c.skipped);
    const lastClue = myClues.length ? myClues[myClues.length - 1].text : '';
    const color = colorForPlayer(p.id);
    // Les joueurs sont répartis en fer à cheval autour de la table (le bas reste libre pour le dossier de jeu)
    const start = 195;
    const end = -15;
    const angle = total === 1 ? 90 : start + ((end - start) * idx) / (total - 1);
    const rad = (angle * Math.PI) / 180;
    const x = 50 + 44 * Math.cos(rad);
    const y = 52 - 36 * Math.sin(rad);
    // Civil qui vient d'être désigné : il se fait tirer dessus (la scène du résultat joue en même temps)
    const shotNow = phase === 'vote_result' && roles[p.id]?.role === 'civil' && meta.eliminated.some((e) => e.id === p.id && e.round === meta.round);
    const charState = shotNow ? 'shot' : st.dead ? 'dead' : st.turn ? 'talk' : st.done ? 'done' : '';
    return (
      <div
        key={p.id}
        style={{ '--x': `${x}%`, '--y': `${y}%` } as React.CSSProperties}
        className={`group flex flex-col items-center text-center w-28 md:w-32 md:absolute md:left-[var(--x)] md:top-[var(--y)] md:-translate-x-1/2 md:-translate-y-1/2 z-10 ${present ? '' : 'opacity-40'}`}
      >
        <div className="relative">
          <SeatCharacter avatar={p.avatar} color={color} state={charState} isMe={p.id === player.id} className="text-[13px] md:text-[15px]" />
          {st.turn && <span className="absolute top-0 -right-1 text-sm bg-cyan-300 text-gray-950 rounded-full w-6 h-6 flex items-center justify-center shadow z-10">🎤</span>}
          {st.dead && !shotNow && <span className="absolute top-0 -right-1 text-lg z-10">💀</span>}
          {st.done && !st.dead && !st.turn && (
            <span className="absolute top-0 -right-1 bg-green-500 text-gray-950 rounded-full w-5 h-5 flex items-center justify-center shadow z-10"><Check size={12} strokeWidth={3} /></span>
          )}
          {p.id === hostId && <Crown size={14} className="absolute top-0 left-0 text-yellow-400 drop-shadow z-10" />}
          {isHost && p.id !== player.id && (
            <span className="absolute top-5 left-0 hidden group-hover:flex bg-gray-900 rounded-full p-1 border border-gray-700 z-10">
              <KickButton onClick={() => extras.kick(p.id)} />
            </span>
          )}
        </div>
        <p className={`mt-1 text-xs md:text-sm font-bold max-w-full truncate px-2 py-0.5 rounded-full bg-black/60 ${p.id === player.id ? 'text-amber-300' : ''} ${st.dead ? 'line-through' : ''}`}>
          {p.name}
          <span className="ml-1.5 text-[10px] font-bold text-amber-200/70 no-underline">{scores[p.id] || 0}</span>
        </p>
        {lastClue && (
          <p key={lastClue} className="animate-pop absolute top-full mt-0.5 max-w-[9rem] truncate rounded-lg bg-amber-100 text-stone-800 text-xs font-bold px-2 py-0.5 shadow z-10">
            {lastClue}
          </p>
        )}
      </div>
    );
  };

  const renderBureau = (mainContent) => {
    const info = phaseLabels[phase] || phaseLabels.lobby;
    const timerTotal = phase === 'clues' ? settings.clueSeconds : phase === 'vote' ? settings.voteSeconds : phase === 'guess' ? GUESS_SECONDS : null;
    const timerLeft = timerTotal ? secondsLeftFor(timerTotal) : null;
    const mmss = timerLeft === null ? '' : `${String(Math.floor(timerLeft / 60)).padStart(2, '0')}:${String(timerLeft % 60).padStart(2, '0')}`;
    const completed = phase === 'game_over' ? settings.maxRounds : meta.round + (phase === 'vote_result' || phase === 'guess' ? 1 : 0);
    const progress = timerTotal ? 1 - (timerLeft as number) / timerTotal : Math.min(1, completed / Math.max(1, settings.maxRounds));
    const usedWords = meta.history.map((h) => h.word).filter(Boolean);
    const isImp = knowsImpostor(player.id);
    // Résultat du vote / bilan : beaucoup de contenu, le dossier prend la place de la lampe et de la plaque
    const tall = phase === 'vote_result' || phase === 'game_over';
    const seated = participants.length ? participants : players;
    return (
      <div className="bureau-room min-h-screen md:h-[100dvh] md:overflow-hidden p-3 pt-16 md:pt-4 md:pl-24 md:p-4 z-10">
        <VersionBadge />
        <GamesRail />
        <ChatWidget extras={extras} me={player} enabled={settings.chatEnabled !== false} />
        {hostToast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[960] animate-fadein bg-gray-900 border border-amber-500 shadow-xl text-white text-sm font-bold rounded-full px-5 py-2.5 flex items-center gap-2">
            <Crown size={16} className="text-yellow-400" /> {hostToast}
          </div>
        )}
        <div className="relative w-full max-w-[100rem] mx-auto flex flex-col gap-3 md:block md:h-full">
          {/* Résumé de la manche */}
          <div className="bureau-panel rounded-xl px-4 py-3 text-sm md:absolute md:left-0 md:top-0 md:w-64 z-20">
            <p className="font-heading font-bold text-amber-200 tracking-wide uppercase text-xs mb-1.5">Résumé de la manche</p>
            <ul className="space-y-1 text-sm">
              <li>Tour : <b>{Math.min(meta.round + 1, settings.maxRounds)}/{settings.maxRounds}</b></li>
              {settings.words > 1 && <li>Mot : <b>{Math.min(meta.wordIndex + 1, settings.words)}/{settings.words}</b></li>}
              <li className="truncate">Mots utilisés : <b>{usedWords.length ? usedWords.join(', ') : '—'}</b></li>
              <li>Imposteur{impostorIds.length > 1 ? 's' : ''} : <b>{impostorIds.length}</b></li>
            </ul>
          </div>

          {/* Salon : code, quitter, son */}
          <div className="bureau-panel rounded-xl px-3 py-2 flex items-center gap-3 text-sm md:absolute md:right-0 md:top-0 z-20 self-start">
            <span className="font-mono text-xs text-amber-200/80 tracking-wider"># {room?.code}</span>
            <button onClick={copyCode} title="Copier le lien d'invitation" aria-label="Copier le lien d'invitation" className="text-amber-200/70 hover:text-white transition">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <SoundToggle on={soundOn} onToggle={toggleSound} />
            <button onClick={leaveRoom} className="flex items-center gap-1.5 text-amber-200/70 hover:text-red-400 text-xs font-bold transition active:scale-95">
              <LogOut size={14} /> Quitter
            </button>
          </div>

          {/* La scène : table, lampe, joueurs, plaque, dossier de jeu */}
          <div className="relative flex flex-col gap-3 md:block md:absolute md:inset-0">
            <div aria-hidden="true" className="hidden md:block absolute inset-x-[9%] top-[17%] bottom-[9%] rounded-[50%] bureau-table" />
            <div aria-hidden="true" className={`${tall ? 'hidden' : 'hidden md:flex'} absolute left-1/2 top-[19%] -translate-x-1/2 flex-col items-center pointer-events-none z-[1]`}>
              <svg width="120" height="74" viewBox="0 0 150 92">
                <defs>
                  <linearGradient id="lampShade" x1="0" x2="1">
                    <stop offset="0" stopColor="#0f5a34" /><stop offset="0.5" stopColor="#2fd27a" /><stop offset="1" stopColor="#0b4a2a" />
                  </linearGradient>
                </defs>
                <path d="M75 0 V10" stroke="#8a6b2c" strokeWidth="3" />
                <path d="M30 56 Q36 14 75 12 Q114 14 120 56 Z" fill="url(#lampShade)" stroke="#c9a24b" strokeWidth="2" />
                <ellipse cx="75" cy="58" rx="46" ry="6" fill="#bfffd5" opacity="0.55" />
              </svg>
              <div className="lamp-glow w-[26rem] h-40 -mt-2" />
            </div>

            <div className="flex flex-wrap justify-center gap-3 md:contents">
              {seated.map((p, i) => renderBureauSeat(p, i, seated.length))}
            </div>

            <div className={`bureau-plaque rounded-xl px-6 py-3 text-center self-center md:absolute md:left-1/2 md:top-[27%] md:-translate-x-1/2 z-10 ${tall ? 'md:hidden' : ''}`}>
              <p className="font-heading font-extrabold tracking-[0.2em] text-sm md:text-base uppercase">Imposteur : le Bureau</p>
              {mmss && (
                <p className={`font-mono text-lg font-bold ${timerLeft !== null && timerLeft <= 5 && timerLeft > 0 ? 'text-red-400 animate-pulse' : ''}`}>{mmss} <span className="text-[10px] tracking-widest opacity-70">RESTANT</span></p>
              )}
              <p className="mt-1 inline-block rounded-md border border-amber-300/50 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                Phase : {info.label}
              </p>
            </div>

            <div key={phase} className={`bureau-pad animate-fadein rounded-2xl p-3 md:p-4 md:absolute md:left-1/2 md:-translate-x-1/2 ${tall ? 'md:top-[30%]' : 'md:top-[43%]'} md:bottom-[5%] md:w-[min(52rem,50%)] md:overflow-y-auto z-10`}>
              {mainContent}
            </div>

            {/* Notes d'enquête : les indices de chacun */}
            <div className="bureau-notes rounded-sm p-4 pt-3 md:absolute md:left-0 md:bottom-6 md:w-72 md:max-h-[40vh] md:overflow-y-auto md:-rotate-2 z-20 text-sm">
              <p className="font-bold text-base leading-none">Notes d&apos;enquête</p>
              <p className="text-xs italic opacity-70 mb-2">Qui est suspect ?</p>
              <ul className="space-y-1.5 text-sm">
                {seated.map((p) => {
                  const mine = clues.filter((c) => c.player_id === p.id && !c.skipped).map((c) => c.text);
                  return (
                    <li key={p.id} className={eliminatedIds.has(p.id) ? 'line-through opacity-50' : ''}>
                      <b>{p.name}</b> : {mine.length ? mine.join(', ') : <span className="opacity-40">…</span>}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Dossier confidentiel : ton rôle */}
            {myRole && (
              <button
                type="button"
                data-sfx="off"
                onClick={() => setWordVisible((v) => !v)}
                aria-label={wordVisible ? 'Cacher ma carte' : 'Voir ma carte'}
                className="bureau-folder relative rounded-lg p-4 text-left md:absolute md:right-6 md:bottom-6 md:w-72 md:rotate-2 z-20 transition active:scale-[0.98] hover:-translate-y-0.5"
              >
                <span className="absolute -top-3 left-4 rounded-t-md bg-[#efe3c4] text-stone-700 text-[10px] font-extrabold uppercase tracking-widest px-3 py-0.5 border border-b-0 border-[#8b6c37]">
                  {wordVisible ? (isWhite(player.id) ? 'Mister White' : isImp ? 'Imposteur' : 'Citoyen') : 'Dossier'}
                </span>
                {wordVisible ? (
                  <>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-70">Ton mot</p>
                    <p className="font-heading font-extrabold text-xl break-words [overflow-wrap:anywhere] text-stone-900">{myRole.word || 'aucun mot'}</p>
                    <p className="text-[11px] mt-1 opacity-70 flex items-center gap-1"><EyeOff size={12} /> Touche pour cacher</p>
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="bureau-seal w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-amber-100"><Eye size={16} /></span>
                    <span>
                      <span className="block font-extrabold uppercase tracking-widest text-xs">Confidentiel</span>
                      <span className="block font-heading font-bold text-base leading-tight">Votre rôle</span>
                    </span>
                  </div>
                )}
              </button>
            )}

            <div className="md:absolute md:left-1/2 md:-translate-x-1/2 md:bottom-1 md:w-[min(30rem,38%)] z-10 text-center">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-amber-100/80 mb-1">{info.label}</p>
              <div className="h-2 rounded-full bg-black/60 border border-amber-300/30 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-500 to-amber-200 transition-all duration-700" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAppShell = (mainContent) => (phase === 'lobby' || phase === 'home' ? renderLobbyShell(mainContent) : renderBureau(mainContent));

  // Tableau des indices : une ligne par joueur, une colonne par tour
  const renderClueTable = (upToRound) => {
    const rounds = Array.from({ length: upToRound + 1 }, (_, i) => i);
    const rows = order.length ? order : participants.map((p) => p.id);
    if (rows.length === 0) return null;
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2">Joueur</th>
              {rounds.map((r) => (
                <th key={r} className="px-3 py-2">Tour {r + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((id) => (
              <tr key={id} className="border-t border-gray-800">
                <td className={`px-3 py-2 font-bold whitespace-nowrap ${eliminatedIds.has(id) ? 'line-through text-gray-500' : ''}`}>
                  <span className="inline-flex items-center gap-1.5">
                    <PlayerDot id={id} avatar={avatarOf(id)} /> {nameOf(id)}
                  </span>
                </td>
                {rounds.map((r) => {
                  const c = clues.find((x) => x.round === r && x.player_id === id);
                  return (
                    <td key={r} className="px-3 py-2">
                      {!c ? <span className="text-gray-700">…</span> : c.skipped ? <span className="text-gray-600 italic">passé</span> : <span className="font-semibold break-words [overflow-wrap:anywhere]">{c.text}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

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
        <div className="min-h-screen md:h-[100dvh] md:overflow-y-auto bg-gray-950/95 text-white relative z-10 flex flex-col items-center before:content-[''] before:flex-1 after:content-[''] after:flex-1 p-4 pt-16 md:pt-4 md:pl-28">
          <VersionBadge />
          <GamesRail />
          <div className="text-center mb-2">
            <p className="eyebrow">✦ Enquête ✦</p>
            <h1 className="font-heading text-4xl min-[420px]:text-5xl sm:text-7xl leading-none mt-2 ink-in">IMPOSTEUR</h1>
          </div>
          <p className="text-gray-500 mb-8 italic text-center">Un mot pour tous… sauf un. Saurez-vous le démasquer ?</p>

          <div className="relative bg-gray-900 p-8 sm:p-10 rounded-2xl w-full max-w-xl shadow-2xl border border-gray-800">
            <SoundToggle on={soundOn} onToggle={toggleSound} className="absolute top-3 right-3" />
            <AccountButton auth={auth} />
            <div className="flex justify-center mb-4">
              <span
                className="w-16 h-16 flex items-center justify-center rounded-full text-3xl"
                style={{ backgroundColor: `${colorForPlayer(player.avatar)}33`, border: `2px solid ${colorForPlayer(player.avatar)}` }}
              >
                <AvatarGlyph avatar={player.avatar} />
              </span>
            </div>
            <AvatarPicker
              auth={auth}
              avatar={player.avatar}
              activeClass="bg-orange-600"
              onPick={(avatar) => setPlayer((p) => ({ ...p, avatar }))}
            />
            <input
              type="text"
              placeholder="Ton Pseudo..."
              value={player.name}
              maxLength={MAX_NAME_LEN}
              autoFocus
              onChange={(e) => setPlayer({ ...player, name: e.target.value })}
              className="w-full p-4 bg-gray-950 border border-gray-700 rounded-lg text-white font-bold text-lg text-center mb-6 focus:border-orange-500 focus:outline-none transition"
            />
            <VisibilityPicker value={createVisibility} onChange={setCreateVisibility} />
            <div className="space-y-4">
              <button
                onClick={createRoom}
                disabled={!player.name.trim()}
                className="w-full bg-orange-600 hover:bg-orange-500 shadow-md shadow-orange-900/40 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition transform hover:scale-[1.02] active:scale-95"
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
              className="mt-5 w-full flex items-center justify-center gap-1.5 text-gray-500 hover:text-orange-300 text-sm font-bold transition"
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
    const effectiveImpostors = Math.max(1, Math.min(settings.impostorCount, Math.floor((players.length - 1) / 2)));
    return renderAppShell(
      <div className="bg-gray-900 p-6 sm:p-8 rounded-2xl w-full max-w-3xl mx-auto shadow-2xl border border-gray-800 text-center">
        <h2 className="font-heading text-2xl font-bold mb-2">Code de la Room</h2>
        <div className="relative mb-5">
          <div className="text-4xl sm:text-6xl font-black font-mono tracking-widest text-orange-400 bg-gray-950 py-4 rounded-xl border border-gray-800">
            {room?.code}
          </div>
          <button
            onClick={copyCode}
            className="flex w-fit mx-auto mt-3 sm:mt-0 sm:absolute sm:right-3 sm:bottom-3 items-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold px-3 py-2 rounded-lg transition active:scale-95"
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
          {players.length >= 3 && (
            <p className="text-xs text-gray-500 mb-3">
              → {effectiveImpostors} imposteur{effectiveImpostors > 1 ? 's' : ''} sur {players.length} joueurs
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {(
              <details className="col-span-2 sm:col-span-3 group">
                <summary className="text-gray-400 mb-1 text-xs font-bold cursor-pointer select-none list-none flex items-center gap-1.5 hover:text-white transition">
                  <span className="inline-block transition group-open:rotate-90">▸</span>
                  Catégories {settings.wordCategories?.length ? `(${settings.wordCategories.length})` : '(toutes)'}
                </summary>
                <div className="flex flex-wrap gap-1.5 mt-2 max-h-40 overflow-y-auto pr-1">
                  {[...WORD_CATEGORIES, PLAYERS_CATEGORY].map((c) => {
                    const on = (settings.wordCategories || []).includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={!isHost}
                        onClick={() =>
                          updateSettings({
                            wordCategories: on
                              ? settings.wordCategories.filter((x) => x !== c.id)
                              : [...(settings.wordCategories || []), c.id],
                          })
                        }
                        className={`px-3 py-1.5 text-xs font-bold rounded-full border transition active:scale-95 disabled:cursor-default ${
                          on ? 'bg-purple-300 text-gray-950 border-purple-300' : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                        }`}
                      >
                        {c.emoji} {c.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-600 mt-1">Aucune sélection = tous les mots mélangés. « Pseudos des joueurs » : le mot est le pseudo d'un joueur.</p>
              </details>
            )}
            {!settings.blind && (
            <div className="col-span-2 sm:col-span-3">
              <label className="block text-gray-500 mb-1 text-xs">Carte de l'imposteur</label>
              <select
                disabled={!isHost}
                value={settings.mode}
                onChange={(e) => updateSettings({ mode: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60"
              >
                <option value="close">Un mot proche de celui des civils</option>
                <option value="blank">Aucun mot (il doit bluffer)</option>
              </select>
            </div>
            )}
            <div>
              <label className="block text-gray-500 mb-1 text-xs">Mots par manche</label>
              <select
                disabled={!isHost}
                value={settings.words}
                onChange={(e) => updateSettings({ words: Number(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-500 mb-1 text-xs">Imposteurs</label>
              <select
                disabled={!isHost}
                value={settings.impostorCount}
                onChange={(e) => updateSettings({ impostorCount: Number(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60"
              >
                {[1, 2].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-500 mb-1 text-xs">Nombre de tours</label>
              <select
                disabled={!isHost}
                value={settings.maxRounds}
                onChange={(e) => updateSettings({ maxRounds: Number(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60"
              >
                {[2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-500 mb-1 text-xs">Temps par indice</label>
              <select
                disabled={!isHost}
                value={settings.clueSeconds}
                onChange={(e) => updateSettings({ clueSeconds: Number(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60"
              >
                {[30, 45, 60, 90, 120].map((n) => (
                  <option key={n} value={n}>{n}s</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-500 mb-1 text-xs">Temps de vote</label>
              <select
                disabled={!isHost}
                value={settings.voteSeconds}
                onChange={(e) => updateSettings({ voteSeconds: Number(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60"
              >
                {[20, 30, 45, 60, 90].map((n) => (
                  <option key={n} value={n}>{n}s</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-800 text-sm space-y-3">
            <ToggleRow
              label="Imposteur à l'aveugle"
              hint="L'imposteur reçoit un mot proche et ne sait pas qu'il est l'imposteur"
              checked={settings.blind}
              disabled={!isHost}
              onChange={(v) => updateSettings({ blind: v })}
            />
            <ToggleRow
              label="Mister White"
              hint="Un imposteur n'a aucun mot et le sait : il bluffe, et peut toujours deviner le mot des civils s'il est démasqué"
              checked={settings.mrWhite}
              disabled={!isHost}
              onChange={(v) => updateSettings({ mrWhite: v })}
            />
            <ToggleRow
              label="Dernière chance"
              hint="Un imposteur démasqué peut deviner le mot des civils pour gagner"
              checked={settings.lastChance}
              disabled={!isHost}
              onChange={(v) => updateSettings({ lastChance: v })}
            />
          </div>
        </div>

        {isHost ? (
          <button
            onClick={() => startGame({ resetScores: false })}
            disabled={players.length < 3}
            className="w-full bg-orange-600 hover:bg-orange-500 shadow-md shadow-orange-900/40 disabled:opacity-50 active:scale-95 text-white font-black py-4 px-6 rounded-lg text-lg transition"
          >
            {players.length < 3 ? "En attente d'au moins 3 joueurs..." : 'Lancer le jeu !'}
          </button>
        ) : (
          waitingForHost
        )}
      </div>
    );
  }

  if (phase === 'reveal') {
    const isImp = knowsImpostor(player.id); // à l'aveugle : l'imposteur se croit civil (sauf Mister White)
    const iAmWhite = isWhite(player.id);
    const iAmReady = readyIds.includes(player.id);
    const readyCount = participants.filter((p) => readyIds.includes(p.id)).length;
    return renderAppShell(
      <div className="flex flex-col items-center text-center flex-1 justify-center">
        {!myRole ? (
          <Waiting label="Une partie est en cours" sub="Tu joueras à la prochaine !" />
        ) : (
          <div className="bg-gray-900 p-8 rounded-2xl w-full max-w-xl shadow-2xl border border-gray-800">
            <p className="text-gray-400 text-sm mb-1">
              {impostorIds.length} imposteur{impostorIds.length > 1 ? 's' : ''} parmi {participants.length} joueurs
            </p>
            <h2 className="font-heading text-3xl font-bold mb-5">Ta carte secrète</h2>
            <button
              data-sfx="off"
              onClick={() => setWordVisible((v) => !v)}
              className={`w-full rounded-2xl p-6 mb-5 border-2 transition active:scale-[0.98] ${
                wordVisible
                  ? isImp
                    ? 'border-red-500 bg-gradient-to-br from-red-900/60 to-orange-900/40'
                    : 'border-green-500 bg-gradient-to-br from-green-900/50 to-emerald-900/30'
                  : 'border-gray-700 bg-gray-950 hover:border-orange-500'
              }`}
            >
              {wordVisible ? (
                <>
                  <p className="text-4xl mb-2">{iAmWhite ? '👤' : isImp ? '🕵️' : '🙂'}</p>
                  <p className="font-bold text-lg">{iAmWhite ? 'Tu es MISTER WHITE' : isImp ? "Tu es l'IMPOSTEUR" : 'Tu es CIVIL'}</p>
                  {myRole.word ? (
                    <>
                      <p className="text-xs text-gray-400 mt-2">Ton mot</p>
                      <p className="font-heading font-extrabold text-4xl mt-1 break-words [overflow-wrap:anywhere]">{myRole.word}</p>
                    </>
                  ) : (
                    <p className="font-heading font-extrabold text-2xl mt-2">Tu n'as aucun mot</p>
                  )}
                  <p className="text-xs text-gray-400 mt-3">
                    {iAmWhite
                      ? "Tu n'as aucun mot : écoute les indices, bluffe, et si on te démasque, devine le mot des civils !"
                      : isImp
                      ? myRole.word
                        ? 'Les civils ont un autre mot, proche du tien. Fais-toi passer pour l\'un d\'eux !'
                        : 'Écoute les indices des autres et bluffe pour passer inaperçu.'
                      : "Donne des indices sans dire ton mot, et démasque l'imposteur."}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-5xl mb-2">🃏</p>
                  <p className="font-bold">Clique pour découvrir ta carte</p>
                  <p className="text-xs text-gray-500 mt-1">Assure-toi que personne ne regarde ton écran</p>
                </>
              )}
            </button>
            <button
              onClick={markReady}
              disabled={iAmReady}
              className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-60 font-bold py-3 rounded-lg transition active:scale-95"
            >
              {iAmReady ? `✅ Prêt — en attente des autres (${readyCount}/${participants.length})` : "J'ai vu ma carte, je suis prêt"}
            </button>
          </div>
        )}
        {isHost && (
          <button
            onClick={() => commitMeta({ phase: 'clues', round: 0, turnIndex: 0, startedAt: Date.now() })}
            className="mt-4 text-sm text-gray-500 hover:text-white font-bold transition"
          >
            Commencer sans attendre les autres →
          </button>
        )}
      </div>
    );
  }

  if (phase === 'clues') {
    const isMyTurn = speakerId === player.id;
    const secs = secondsLeftFor(settings.clueSeconds);
    const failedGuess = meta.guess && meta.guess.correct === false && meta.guess.round === meta.round - 1 ? meta.guess : null;
    return renderAppShell(
      <div className="flex flex-col gap-4 max-w-4xl w-full mx-auto">
        {failedGuess && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-300 text-left">
            🎯 {nameOf(failedGuess.id)} avait tenté « {failedGuess.text || '…'} » : raté ! La partie continue.
          </div>
        )}
        <div className={`rounded-2xl p-6 text-center shadow-xl ${isMyTurn && iAmAlive ? 'my-turn-glow bg-gray-900 sm:p-8' : 'bg-gray-900 border border-gray-800'}`}>
          {isMyTurn && iAmAlive && (
            <p className="inline-block mb-3 rounded-full bg-purple-300 text-gray-950 px-4 py-1 text-xs font-extrabold uppercase tracking-widest animate-pulse">
              ✍️ À toi de jouer
            </p>
          )}
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-gray-400 text-sm text-left">Tour {meta.round + 1}/{settings.maxRounds}</p>
            <CountdownBadge seconds={secs} />
          </div>
          {speakerId ? (
            <>
              <p className="text-3xl mb-1 w-12 h-12 mx-auto flex items-center justify-center"><AvatarGlyph avatar={avatarOf(speakerId)} fallback="" /></p>
              <h2 className="font-heading text-2xl font-bold mb-4">
                {isMyTurn ? <span className="text-3xl sm:text-4xl text-purple-300">C'est à toi de donner ton indice !</span> : `Au tour de ${nameOf(speakerId)}`}
              </h2>
            </>
          ) : null}
          {isMyTurn && iAmAlive ? (
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                maxLength={MAX_CLUE_LEN}
                value={myClue}
                placeholder="Ton indice (un mot, sans dire ton mot)..."
                onChange={(e) => {
                  setMyClue(e.target.value);
                  setClueError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && submitClue()}
                className="flex-1 min-w-0 p-4 text-lg sm:text-xl bg-gray-950 border-2 border-purple-300/60 rounded-xl font-bold focus:outline-none"
              />
              <button
                onClick={submitClue}
                disabled={!myClue.trim()}
                data-sfx="off"
                className="bg-purple-300 hover:bg-purple-200 !text-gray-950 disabled:opacity-50 px-6 rounded-xl font-bold flex items-center gap-2 active:scale-95 transition"
              >
                <Send size={16} /> Envoyer
              </button>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              {iAmAlive ? 'Attends ton tour… et analyse les indices !' : myRole ? 'Tu es éliminé : tu regardes la suite.' : 'Tu joueras à la prochaine partie.'}
            </p>
          )}
          {clueError && <p className="text-red-400 text-sm mt-2">{clueError}</p>}
        </div>
      </div>
    );
  }

  if (phase === 'vote') {
    const secs = secondsLeftFor(settings.voteSeconds);
    return renderAppShell(
      <div className="flex flex-col gap-4 max-w-4xl w-full mx-auto">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center shadow-xl">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className="font-heading text-2xl font-bold text-left">Qui est l'imposteur ?</h2>
            <CountdownBadge seconds={secs} />
          </div>
          <p className="text-gray-500 text-sm mb-4 text-left">
            {iAmAlive ? 'Discutez, puis désigne le joueur le plus suspect.' : myRole ? '💀 Tu es éliminé : tu ne peux plus voter, regarde la discussion.' : 'Tu ne votes pas : regarde la discussion.'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {aliveParticipants.map((p) => {
              const isMe = p.id === player.id;
              const selected = myVote?.target_id === p.id;
              const voters = votesThisRound.filter((v) => v.target_id === p.id).map((v) => v.voter_id);
              return (
                <button
                  key={p.id}
                  data-sfx="off"
                  onClick={() => castVote(p.id)}
                  disabled={isMe || !iAmAlive}
                  className={`rounded-xl p-3 border-2 text-left transition active:scale-95 ${
                    selected
                      ? 'border-orange-400 bg-orange-900/40 shadow-lg shadow-orange-900/30'
                      : isMe
                      ? 'border-gray-800 bg-gray-950 opacity-50 cursor-default'
                      : 'border-gray-700 bg-gray-950 hover:border-orange-500'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <PlayerDot id={p.id} avatar={p.avatar} size="md" />
                    <span className="font-bold truncate">{p.name}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 break-words [overflow-wrap:anywhere]">
                    {clues
                      .filter((c) => c.player_id === p.id && !c.skipped)
                      .map((c) => c.text)
                      .join(' · ') || '—'}
                  </p>
                  {voters.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 mt-2 pt-2 border-t border-gray-800">
                      <span className="text-[11px] font-bold text-orange-300 mr-0.5">{voters.length}</span>
                      {voters.map((vid) => (
                        <span key={vid} title={nameOf(vid)} className="animate-pop inline-flex items-center gap-1 bg-gray-800 rounded-full pl-0.5 pr-1.5 py-0.5 text-[10px] max-w-full">
                          <PlayerDot id={vid} avatar={avatarOf(vid)} />
                          <span className="truncate">{nameOf(vid)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {selected && <p className="text-[11px] font-bold text-orange-300 mt-1">✅ Ton vote</p>}
                  {isMe && <p className="text-[11px] text-gray-500 mt-1">C'est toi</p>}
                </button>
              );
            })}
          </div>
          {iAmAlive && (
            <button
              data-sfx="off"
              onClick={() => castVote(SKIP_ID)}
              className={`mt-4 w-full rounded-xl border-2 border-dashed px-4 py-3 text-sm font-bold transition active:scale-[0.98] ${
                myVote?.target_id === SKIP_ID
                  ? 'border-orange-400 bg-orange-900/40 text-orange-200'
                  : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
              }`}
            >
              {myVote?.target_id === SKIP_ID ? '✅ Tu passes — personne ne sera désigné par toi' : 'Je ne vote pour personne (passer au tour suivant)'}
            </button>
          )}
          {votesThisRound.some((v) => v.target_id === SKIP_ID) && (
            <p className="text-xs text-gray-400 mt-2 text-left">
              ⏭️ Passent : {votesThisRound.filter((v) => v.target_id === SKIP_ID).map((v) => nameOf(v.voter_id)).join(', ')}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'vote_result') {
    const eliminatedNow = meta.eliminated.find((e) => e.round === meta.round);
    const aliveBefore = participants.filter((p) => !meta.eliminated.some((e) => e.round < meta.round && e.id === p.id));
    const tally = {};
    votesThisRound.forEach((v) => {
      tally[v.target_id] = [...(tally[v.target_id] || []), v.voter_id];
    });
    const rows = aliveBefore.map((p) => ({ ...p, voters: tally[p.id] || [] })).sort((a, b) => b.voters.length - a.voters.length);
    const skippers = tally[SKIP_ID] || [];
    const wasImp = eliminatedNow && roles[eliminatedNow.id]?.role === 'imposteur';
    return renderAppShell(
      <div className="flex flex-col items-center text-center max-w-3xl w-full mx-auto">
        {eliminatedNow ? (
          <div
            className={`w-full rounded-2xl p-4 mb-3 border-2 animate-pop ${
              wasImp ? 'border-green-500 bg-green-900/30' : 'border-red-500 bg-red-900/30'
            }`}
          >
            {wasImp ? (
              <p className="text-5xl mb-2">🎯</p>
            ) : (
              <ShootScene avatar={avatarOf(eliminatedNow.id)} color={colorForPlayer(eliminatedNow.id)} name={nameOf(eliminatedNow.id)} />
            )}
            <h2 className="font-heading text-2xl font-bold">
              <span className="inline-flex w-8 h-8 align-middle items-center justify-center"><AvatarGlyph avatar={avatarOf(eliminatedNow.id)} fallback="" /></span> {nameOf(eliminatedNow.id)} est éliminé(e)
            </h2>
            <p className="text-lg mt-1 font-bold">{wasImp ? (isWhite(eliminatedNow.id) ? "C'était MISTER WHITE !" : "C'était un IMPOSTEUR !") :"C'était un civil… ce n'était pas l'imposteur."}</p>
          </div>
        ) : (
          <div className="w-full rounded-2xl p-6 mb-4 border-2 border-gray-700 bg-gray-900">
            <p className="text-5xl mb-2">🤝</p>
            <h2 className="font-heading text-2xl font-bold">
              {skippers.length > 0 && skippers.length >= Math.max(0, ...rows.map((r) => r.voters.length))
                ? 'Le salon passe : personne n\'est éliminé'
                : 'Égalité : personne n\'est éliminé'}
            </h2>
          </div>
        )}
        <div className="w-full space-y-2 mb-6">
          {rows.map((r, i) => (
            <div
              key={r.id}
              className="animate-rise flex items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 text-left"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span className="flex items-center gap-2 font-bold min-w-0">
                <PlayerDot id={r.id} avatar={r.avatar} size="md" />
                <span className="truncate">{r.name}</span>
              </span>
              <span className="text-xs text-gray-400 truncate">{r.voters.map(nameOf).join(', ')}</span>
              <span className="font-heading font-extrabold text-xl text-orange-300 shrink-0">{r.voters.length}</span>
            </div>
          ))}
        </div>
        {skippers.length > 0 && (
          <p className="text-sm text-gray-400 mb-6 -mt-3">
            ⏭️ Ont passé : {skippers.map(nameOf).join(', ')}
          </p>
        )}
        {isHost ? (
          <button onClick={continueAfterVote} className="bg-orange-600 hover:bg-orange-500 shadow-md shadow-orange-900/40 font-bold py-3 px-8 rounded-full active:scale-95 transition">
            Continuer
          </button>
        ) : (
          waitingForHost
        )}
      </div>
    );
  }

  if (phase === 'guess') {
    const guesserId = meta.guess?.id;
    const iAmGuesser = guesserId === player.id;
    const secs = secondsLeftFor(GUESS_SECONDS);
    return renderAppShell(
      <div className="flex flex-col items-center text-center flex-1 justify-center max-w-md w-full mx-auto">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full shadow-xl">
          <p className="text-5xl mb-3">🎯</p>
          <div className="mb-4 flex justify-center">
            <CountdownBadge seconds={secs} />
          </div>
          {iAmGuesser ? (
            <>
              <h2 className="font-heading text-2xl font-bold mb-1">Dernière chance !</h2>
              <p className="text-gray-400 text-sm mb-4">Devine le mot des civils : si tu trouves, tu gagnes quand même.</p>
              {currentGuessEntry ? (
                <p className="font-bold text-orange-300">Réponse envoyée : « {currentGuessEntry.text} »</p>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    autoFocus
                    maxLength={MAX_CLUE_LEN}
                    value={myGuess}
                    placeholder="Le mot des civils..."
                    onChange={(e) => setMyGuess(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitGuess()}
                    className="flex-1 min-w-0 p-3 bg-gray-950 border border-gray-700 rounded-lg font-bold focus:border-orange-500 focus:outline-none"
                  />
                  <button
                    onClick={submitGuess}
                    disabled={!myGuess.trim()}
                    data-sfx="off"
                    className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 px-5 rounded-lg font-bold active:scale-95 transition"
                  >
                    Valider
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="font-heading text-2xl font-bold mb-1">
                <span className="inline-flex w-8 h-8 align-middle items-center justify-center"><AvatarGlyph avatar={avatarOf(guesserId)} fallback="" /></span> {nameOf(guesserId)} tente sa dernière chance…
              </h2>
              <p className="text-gray-400 text-sm">Il/elle essaie de deviner le mot des civils.</p>
              <Loader2 size={28} className="text-orange-400 animate-spin mx-auto mt-4" />
            </>
          )}
        </div>
      </div>
    );
  }

  // phase === 'game_over'
  const winnerCivils = meta.winner === 'civils';
  const isLastWord = meta.wordIndex + 1 >= settings.words;
  const reasonText = {
    found: 'Tous les imposteurs ont été démasqués.',
    outnumbered: "Il ne reste plus assez de civils pour gagner : les imposteurs l'emportent.",
    survived: `Les imposteurs ont survécu aux ${settings.maxRounds} tours.`,
    guessed: `${meta.guess ? nameOf(meta.guess.id) : "L'imposteur"} a deviné le mot des civils (« ${civilWord} ») !`,
  }[meta.reason] || '';
  const ranking = [...participants].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
  const guessInfo = meta.guess
    ? { name: nameOf(meta.guess.id), text: meta.guess.text, correct: !!meta.guess.correct }
    : null;

  // Le mot tenté par l'imposteur lors du repêchage
  const renderGuess = (g, small = false) =>
    g ? (
      <div className={`rounded-xl border text-left ${small ? 'px-3 py-2 text-sm' : 'p-4'} ${g.correct ? 'bg-green-900/30 border-green-700/60' : 'bg-gray-900 border-gray-800'}`}>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">🎯 Repêchage de {g.name}</p>
        {g.text ? (
          <p className={`font-heading font-extrabold break-words [overflow-wrap:anywhere] ${small ? 'text-base' : 'text-2xl'}`}>
            « {g.text} » <span className={`text-sm font-bold ${g.correct ? 'text-green-400' : 'text-red-400'}`}>{g.correct ? '✓ trouvé !' : '✗ raté'}</span>
          </p>
        ) : (
          <p className="text-gray-500 italic">Aucune réponse à temps.</p>
        )}
      </div>
    ) : null;

  const wordCards = (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mb-3">
      <div className="bg-green-900/30 border border-green-700/60 rounded-xl p-3">
        <p className="text-[10px] font-bold text-green-300 uppercase tracking-wide">Mot des civils</p>
        <p className="font-heading font-extrabold text-2xl break-words [overflow-wrap:anywhere]">{civilWord}</p>
      </div>
      <div className="bg-red-900/30 border border-red-700/60 rounded-xl p-3">
        <p className="text-[10px] font-bold text-red-300 uppercase tracking-wide">Mot de l'imposteur</p>
        <p className="font-heading font-extrabold text-2xl break-words [overflow-wrap:anywhere]">
          {impostorWord || <span className="text-gray-500 text-lg">aucun</span>}
        </p>
      </div>
      {guessInfo ? renderGuess(guessInfo) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-left">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">🎯 Repêchage</p>
          <p className="text-gray-500 italic mt-1">Personne n'a tenté sa chance.</p>
        </div>
      )}
    </div>
  );

  const rankingList = (
    <div className="w-full space-y-1.5 mb-3">
      {ranking.map((p, i) => {
        const isImp = roles[p.id]?.role === 'imposteur';
        const pts = meta.delta?.[p.id] || 0;
        const roleLabel = isWhite(p.id) ? '👤 Mister White' : isImp ? '🕵️ Imposteur' : 'Civil';
        return (
          <div
            key={p.id}
            className={`animate-rise flex items-center gap-3 rounded-xl px-4 py-2 border text-left ${
              isImp ? 'bg-red-900/20 border-red-700/50' : 'bg-gray-900 border-gray-800'
            }`}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <PlayerDot id={p.id} avatar={p.avatar} size="md" />
            <span className="font-bold truncate flex-1">{p.name}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${isImp ? 'bg-red-600/70' : 'bg-gray-700'}`}>
              {roleLabel}
            </span>
            {eliminatedIds.has(p.id) && <span title="Éliminé">💀</span>}
            {pts > 0 && <span className="text-green-400 font-bold text-sm animate-pop">+{pts}</span>}
            <span className="font-black text-purple-300 w-8 text-right">{scores[p.id] || 0}</span>
          </div>
        );
      })}
    </div>
  );

  return renderAppShell(
    <div className="flex flex-col items-center text-center max-w-4xl w-full mx-auto py-2">
      {isLastWord ? (
        <FrontPage
          front={imposteurFront({
            winner: meta.winner,
            reason: meta.reason,
            impostorNames: impostorIds.map(nameOf),
            word: civilWord,
            rounds: Math.max(0, ...clues.map((c) => c.round)) + 1,
            guesserName: meta.guess ? nameOf(meta.guess.id) : '',
            seed: game.gameId || 'imposteur',
          })}
          avatar={avatarOf(impostorIds[0])}
          photoCaption={winnerCivils ? 'Le suspect, à sa sortie du tribunal.' : 'Le suspect, le sourire aux lèvres.'}
        >
          <p className="mt-3">
            <span className="stamp text-base">{winnerCivils ? 'Les civils gagnent' : "L'imposteur gagne"}</span>
          </p>
          <p className="text-xs italic text-gray-500 mt-2">{reasonText}</p>
        </FrontPage>
      ) : (
        <div className="paper w-full px-6 py-4 mb-3 animate-fadein">
          <p className="eyebrow">Mot {meta.wordIndex + 1} sur {settings.words}</p>
          <h2 className="font-heading text-3xl mt-2">{winnerCivils ? 'Les civils gagnent ce mot' : "L'imposteur gagne ce mot"}</h2>
          <p className="text-sm text-gray-400 mt-2">{reasonText}</p>
          <p className="text-sm text-gray-500 mt-1">Imposteur{impostorIds.length > 1 ? 's' : ''} : {impostorIds.map(nameOf).join(', ')}</p>
        </div>
      )}

      {wordCards}
      {rankingList}
      <div className="w-full mb-4 flex justify-center">
      {isHost ? (
        isLastWord ? (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => startGame({ resetScores: false })}
              disabled={players.length < 3}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 shadow-md shadow-orange-900/40 active:scale-95 font-bold py-3 px-6 rounded-full transition"
            >
              <RotateCcw size={16} /> Nouvelle manche (scores conservés)
            </button>
            <button
              onClick={() => startGame({ resetScores: true })}
              disabled={players.length < 3}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 active:scale-95 font-bold py-3 px-6 rounded-full transition"
            >
              Scores à zéro
            </button>
            <button onClick={backToLobby} className="text-sm text-gray-500 hover:text-white font-bold transition px-2">
              Changer les réglages
            </button>
          </div>
        ) : (
          <button
            onClick={() => startGame({ nextWord: true })}
            disabled={players.length < 3}
            className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 shadow-md shadow-orange-900/40 active:scale-95 font-bold py-3 px-8 rounded-full transition"
          >
            Mot suivant ({meta.wordIndex + 2}/{settings.words})
          </button>
        )
      ) : (
        waitingForHost
      )}
      </div>

      {isLastWord && meta.history.length > 1 && (
        <div className="w-full mb-6 text-left">
          <p className="eyebrow mb-2">Récap des mots de la manche</p>
          <div className="space-y-2">
            {meta.history.map((h, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-xs text-gray-500">Mot {i + 1}</span>
                  <span className="font-heading font-extrabold text-lg">{h.word}</span>
                  <span className="text-xs text-gray-500">vs</span>
                  <span className="font-heading font-bold text-lg text-gray-300">{h.impWord || '—'}</span>
                  <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded ${h.winner === 'civils' ? 'bg-green-700/60' : 'bg-red-700/60'}`}>
                    {h.winner === 'civils' ? 'Civils' : 'Imposteur'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">🕵️ {h.impostors.join(', ')}</p>
                {h.guess && <div className="mt-2">{renderGuess(h.guess, true)}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <details className="w-full mb-2 text-left group">
        <summary className="eyebrow mb-2 cursor-pointer select-none list-none flex items-center gap-2 hover:text-white transition">
          Récap des indices <span className="text-[10px] opacity-60 group-open:hidden">(afficher)</span>
        </summary>
        {renderClueTable(Math.max(0, ...clues.map((c) => c.round)))}
      </details>

    </div>
  );
}
