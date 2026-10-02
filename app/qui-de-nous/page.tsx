'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play, Users, Loader2, Crown, Settings, Copy, LogOut, Check, BookOpen, X, RotateCcw, Trophy,
} from 'lucide-react';
import {
  supabase, makeId, fireConfetti, colorForPlayer, randomAvatar, PlayerDot, playSfx, SoundToggle,
  GamesRail as SharedGamesRail, ToggleRow, CountdownBadge, makeSessionStore, MAX_NAME_LEN, readIdentity,
  writeIdentity, useSoundAndClickFx, useDiscordAuth, AccountButton, AvatarPicker, AvatarGlyph, isImageAvatar,
  useRefState,
  FrontPage, useRoomDirectory, VisibilityPicker, RoomOptions, useRoomExtras, ChatWidget, KickButton, toast,
} from '@/lib/shared';
import { pickQuestions } from '@/lib/quidenous-questions';
import { quiDeNousFront } from '@/lib/press';

const APP_VERSION = 'qui de nous v2';
const GAME_ID = 'qui-de-nous';

const DEFAULT_SETTINGS = {
  visibility: 'private', // 'private' : code seulement — 'public' : visible dans la liste des salons
  roomName: '',
  chatEnabled: true,
  rounds: 8,
  voteSeconds: 30,
  category: 'mix', // 'soft' | 'spicy' | 'mix'
  selfVote: true,
};
const INITIAL_META = { phase: 'home', round: 0, startedAt: null };

const { read: readSession, write: writeSession, clear: clearSession } = makeSessionStore('quidenous-session');
const GamesRail = () => <SharedGamesRail currentId="qui-de-nous" />;
const VersionBadge = () => (
  <div className="fixed bottom-2 right-3 text-[10px] text-gray-600 font-mono select-none pointer-events-none z-50">
    {APP_VERSION}
  </div>
);

const RULES_STEPS = [
  { emoji: '❓', title: 'Une question piquante', text: 'À chaque manche, une phrase s’affiche : « Qui est le plus susceptible de… ? »' },
  { emoji: '🫵', title: 'Tout le monde désigne', text: 'Chacun vote en secret pour le joueur qui colle le mieux. Tu peux même voter pour toi (si le host l’autorise).' },
  { emoji: '📊', title: 'Le verdict tombe', text: 'Les résultats s’affichent : qui est le plus désigné, et qui a voté pour qui.' },
  { emoji: '🏆', title: 'Le bilan', text: 'À la fin, le classement des plus désignés et le récap de chaque question.' },
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
        <BookOpen size={22} className="text-teal-400" /> Comment jouer ?
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
      <button
        onClick={onClose}
        className="mt-6 w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-lg transition active:scale-95"
      >
        Compris !
      </button>
    </div>
  </div>
);

export default function QuiDeNous() {
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
  const [meta, setMeta, metaRef] = useRefState(INITIAL_META);
  const [game, setGame, gameRef] = useRefState({ gameId: null, questions: [] });
  const [votes, setVotes, votesRef] = useRefState([]); // { round, voter_id, target_id }
  const [scores, setScores, scoresRef] = useRefState({}); // votes reçus, cumulés
  const [known, setKnown, knownRef] = useRefState({}); // id -> { name, avatar } (même après un départ)

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
    const roomParam = new URLSearchParams(window.location.search).get('room');
    if (roomParam) setJoinCode(roomParam.toUpperCase());
  }, []);

  const broadcast = (event, payload) => channelRef.current?.send({ type: 'broadcast', event, payload });
  const commitMeta = (patch) => {
    const next = { ...metaRef.current, ...patch };
    setMeta(next);
    broadcast('meta', { meta: next });
  };
  const addVote = (vote) =>
    setVotes((prev) => [...prev.filter((v) => !(v.voter_id === vote.voter_id && v.round === vote.round)), vote]);

  // ==========================================
  // CHANNEL DE LA ROOM (presence + broadcast)
  // ==========================================
  const connectToRoom = (code, playerId, playerName, playerAvatar, isCreator) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase.channel(`quidenous:${code}`, { config: { presence: { key: playerId } } });

    channel.on('presence', { event: 'sync' }, () => {
      const byId = new Map();
      Object.values(channel.presenceState())
        .flat()
        .forEach((p) => {
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

    // Rattrapage : le host renvoie tout l'état de la partie à qui arrive en cours de route.
    channel.on('presence', { event: 'join' }, ({ key }) => {
      if (key === playerId || !isHostRef.current) return;
      extras.onPresenceJoin(channel, key);
      channel.send({ type: 'broadcast', event: 'settings_update', payload: { settings: settingsRef.current } });
      channel.send({ type: 'broadcast', event: 'scores_sync', payload: { scores: scoresRef.current } });
      channel.send({ type: 'broadcast', event: 'roster', payload: { known: knownRef.current } });
      const phase = metaRef.current.phase;
      if (phase !== 'home' && phase !== 'lobby') {
        channel.send({ type: 'broadcast', event: 'game_start', payload: { ...gameRef.current, resync: true } });
        votesRef.current.forEach((vote) => channel.send({ type: 'broadcast', event: 'vote', payload: { vote } }));
      }
      channel.send({ type: 'broadcast', event: 'meta', payload: { meta: metaRef.current } });
    });

    channel.on('broadcast', { event: 'settings_update' }, ({ payload }) => setSettings(payload.settings));
    channel.on('broadcast', { event: 'scores_sync' }, ({ payload }) => setScores(payload.scores || {}));
    channel.on('broadcast', { event: 'roster' }, ({ payload }) => setKnown((prev) => ({ ...payload.known, ...prev })));
    channel.on('broadcast', { event: 'game_start' }, ({ payload }) => {
      setGame({ gameId: payload.gameId, questions: payload.questions });
      if (!payload.resync) {
        setVotes([]);
        if (payload.resetScores) setScores({});
      }
    });
    channel.on('broadcast', { event: 'meta' }, ({ payload }) => setMeta(payload.meta));
    channel.on('broadcast', { event: 'vote' }, ({ payload }) => addVote(payload.vote));

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
    setGame({ gameId: null, questions: [] });
    setVotes([]);
    setScores({});
    setKnown({});
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
  // DONNÉES DÉRIVÉES
  // ==========================================
  const phase = meta.phase;
  const { questions } = game;
  const totalRounds = questions.length;
  const question = questions[meta.round] || '';
  const nameOf = (id) => known[id]?.name || '???';
  const avatarOf = (id) => known[id]?.avatar;
  const secondsLeftFor = (total) => {
    if (!meta.startedAt) return total;
    return Math.min(total, Math.max(0, total - Math.floor((now - meta.startedAt) / 1000)));
  };

  const votesThisRound = votes.filter((v) => v.round === meta.round);
  const myVote = votesThisRound.find((v) => v.voter_id === player.id);
  const tallyFor = (round) => {
    const tally = {};
    votes.filter((v) => v.round === round).forEach((v) => {
      tally[v.target_id] = [...(tally[v.target_id] || []), v.voter_id];
    });
    return tally;
  };

  // ==========================================
  // ACTIONS
  // ==========================================
  const startGame = ({ resetScores = false } = {}) => {
    if (!isHost || players.length < 2) return;
    const cfg = settingsRef.current;
    const payload = { gameId: makeId('g'), questions: pickQuestions(cfg.category, cfg.rounds), resetScores };
    setGame({ gameId: payload.gameId, questions: payload.questions });
    setVotes([]);
    if (resetScores) setScores({});
    broadcast('game_start', payload);
    broadcast('roster', { known: knownRef.current });
    autoRef.current = '';
    commitMeta({ phase: 'vote', round: 0, startedAt: Date.now() });
  };
  const backToLobby = () => commitMeta({ ...INITIAL_META, phase: 'lobby' });

  const castVote = (targetId) => {
    if (!settings.selfVote && targetId === player.id) return;
    const vote = { round: meta.round, voter_id: player.id, target_id: targetId };
    addVote(vote);
    broadcast('vote', { vote });
    playSfx('vote');
  };

  // Fin du vote : le host cumule les votes reçus et diffuse le total
  const revealRound = () => {
    const m = metaRef.current;
    const present = new Set(players.map((p) => p.id));
    const next = { ...scoresRef.current };
    votesRef.current
      .filter((v) => v.round === m.round && present.has(v.voter_id))
      .forEach((v) => {
        next[v.target_id] = (next[v.target_id] || 0) + 1;
      });
    setScores(next);
    broadcast('scores_sync', { scores: next });
    commitMeta({ phase: 'reveal', startedAt: Date.now() });
  };
  const nextRound = () => {
    if (meta.round + 1 >= totalRounds) commitMeta({ phase: 'final', startedAt: Date.now() });
    else commitMeta({ phase: 'vote', round: meta.round + 1, startedAt: Date.now() });
  };

  // Le vote se termine quand tout le monde a voté ou que le temps est écoulé
  useEffect(() => {
    if (!isHost || phase !== 'vote') return;
    const key = `${game.gameId}-vote-${meta.round}`;
    if (autoRef.current === key) return;
    const allVoted = players.length > 0 && players.every((p) => votesThisRound.some((v) => v.voter_id === p.id));
    if (allVoted || secondsLeftFor(settings.voteSeconds) === 0) {
      autoRef.current = key;
      revealRound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, votes, players, meta, isHost]);

  // ==========================================
  // SONS
  // ==========================================
  const prevPhaseRef = useRef({ phase: 'home', round: 0 });
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = { phase, round: meta.round };
    if (prev.phase === phase && prev.round === meta.round) return;
    if (prev.phase === 'home' || phase === 'lobby') return;
    if (phase === 'vote') playSfx('voteStart');
    else if (phase === 'reveal') playSfx('reveal');
    else if (phase === 'final') {
      playSfx('fanfare');
      fireConfetti();
    }
  }, [phase, meta.round]);

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

  const lastTickRef = useRef(null);
  useEffect(() => {
    if (phase !== 'vote') {
      lastTickRef.current = null;
      return;
    }
    const left = secondsLeftFor(settings.voteSeconds);
    const key = `${meta.round}-${left}`;
    if (lastTickRef.current === key) return;
    lastTickRef.current = key;
    if (left > 0 && left <= 5) playSfx('tick');
    else if (left === 0) playSfx('buzzer');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, phase, meta.round]);

  // ==========================================
  // BRIQUES D'AFFICHAGE
  // ==========================================
  const phaseLabels = {
    lobby: { emoji: '🛋️', label: 'Lobby' },
    vote: { emoji: '🫵', label: 'Vote' },
    reveal: { emoji: '📊', label: 'Verdict' },
    final: { emoji: '🏆', label: 'Bilan de la partie' },
  };

  const renderProgressHeader = () => {
    const info = phaseLabels[phase] || phaseLabels.lobby;
    const inGame = totalRounds > 0 && phase !== 'lobby';
    const completed = phase === 'final' ? totalRounds : meta.round + (phase === 'reveal' ? 1 : 0);
    return (
      <div className="shrink-0 mb-4 bg-gray-900/80 border border-gray-800 rounded-2xl px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-sm flex-wrap">
          <span className="font-bold">
            {info.emoji} {info.label}
          </span>
          <span className="text-gray-400 font-mono text-xs flex items-center gap-3 flex-wrap">
            {inGame && phase !== 'final' && (
              <span className="text-teal-300 font-bold">
                Question {Math.min(meta.round + 1, totalRounds)}/{totalRounds}
              </span>
            )}
            {phase === 'vote' && (
              <span>
                🫵 {votesThisRound.filter((v) => players.some((p) => p.id === v.voter_id)).length}/{players.length} votes
              </span>
            )}
            <span>👥 {players.length}</span>
          </span>
        </div>
        {inGame && (
          <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-600 to-lime-400 transition-all duration-500"
              style={{ width: `${Math.round(Math.min(1, completed / totalRounds) * 100)}%` }}
            />
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
      <h3 className="flex items-center gap-2 text-gray-500 font-bold mb-1 uppercase text-[11px] tracking-wide shrink-0">
        <Users size={13} /> En ligne — {players.length}
      </h3>
      <p className="text-[10px] text-gray-600 mb-2">Le chiffre = fois désigné(e)</p>
      <div className="space-y-1 md:flex-1 md:overflow-y-auto -mx-1 px-1">
        {[...players]
          .sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))
          .map((p, i) => {
            const voted = phase === 'vote' && votesThisRound.some((v) => v.voter_id === p.id);
            return (
              <div
                key={p.id}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition ${
                  p.id === player.id ? 'bg-teal-900/40 border border-teal-600/60' : 'hover:bg-gray-800/70'
                }`}
              >
                <span className="wiggle-hover inline-flex cursor-default">
                  <PlayerDot id={p.id} avatar={p.avatar} size="md" />
                </span>
                <span className="font-bold truncate flex-1">{p.name}</span>
                {isHost && p.id !== player.id && <KickButton onClick={() => extras.kick(p.id)} />}
                {phase === 'vote' && (
                  <span className="shrink-0">
                    {voted ? <Check size={14} className="text-green-400" /> : <Loader2 size={12} className="text-gray-600 animate-spin" />}
                  </span>
                )}
                {i === 0 && (scores[p.id] || 0) > 0 && <Crown size={13} className="text-yellow-400 shrink-0" />}
                {p.id === hostId && (
                  <span className="text-[9px] font-bold text-purple-300 bg-purple-900/40 px-1.5 py-0.5 rounded shrink-0">HOST</span>
                )}
                <span key={scores[p.id] || 0} className="font-black text-teal-300 text-xs shrink-0 w-6 text-right inline-block animate-pop">
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

  // Fonction ordinaire (pas un composant <Tag>) : évite le remontage à chaque rendu.
  const renderAppShell = (mainContent) => (
    <div className="min-h-screen md:h-[100dvh] md:overflow-hidden bg-gray-950/90 text-white relative z-10 flex justify-center p-4 pt-16 md:pt-4 md:pl-24">
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

  // La question, sur un parchemin
  const renderQuestionCard = () => (
    <div className="paper px-6 py-8 sm:px-10 text-center mb-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Qui est le plus susceptible de…</p>
      <h2 className="font-heading text-2xl sm:text-4xl mt-3 leading-tight text-white break-words [overflow-wrap:anywhere]">
        {question}&nbsp;?
      </h2>
    </div>
  );

  // ==========================================
  // ÉCRANS
  // ==========================================
  if (phase === 'home') {
    return (
      <>
        <div className="min-h-screen md:h-[100dvh] md:overflow-hidden bg-gray-950/90 text-white relative z-10 flex flex-col items-center justify-center p-4 pt-16 md:pt-4 md:pl-24">
          <VersionBadge />
          <GamesRail />
          <div className="text-center mb-2">
            <p className="eyebrow">✦ Sondage ✦</p>
            <h1 className="font-heading text-5xl sm:text-7xl leading-none mt-2 ink-in">QUI DE NOUS ?</h1>
          </div>
          <p className="text-gray-500 mb-8 italic text-center">Qui est le plus susceptible de… ? Tout le monde désigne, ça va piquer.</p>

          <div className="relative bg-gray-900 p-8 rounded-2xl w-full max-w-md shadow-2xl border border-gray-800">
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
            <AvatarPicker auth={auth} avatar={player.avatar} activeClass="bg-teal-600" onPick={(avatar) => setPlayer((p) => ({ ...p, avatar }))} />
            <input
              type="text"
              placeholder="Ton Pseudo..."
              value={player.name}
              maxLength={MAX_NAME_LEN}
              autoFocus
              onChange={(e) => setPlayer({ ...player, name: e.target.value })}
              className="w-full p-4 bg-gray-950 border border-gray-700 rounded-lg text-white font-bold text-lg text-center mb-6 focus:border-teal-500 focus:outline-none transition"
            />
            <VisibilityPicker value={createVisibility} onChange={setCreateVisibility} />
            <div className="space-y-4">
              <button
                onClick={createRoom}
                disabled={!player.name.trim()}
                className="w-full bg-teal-600 hover:bg-teal-500 shadow-md shadow-teal-900/40 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition transform hover:scale-[1.02] active:scale-95"
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
              className="mt-5 w-full flex items-center justify-center gap-1.5 text-gray-500 hover:text-teal-300 text-sm font-bold transition"
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
      <div className="bg-gray-900 p-8 rounded-2xl w-full max-w-lg mx-auto shadow-2xl border border-gray-800 text-center">
        <h2 className="font-heading text-2xl mb-2">Code de la Room</h2>
        <div className="relative mb-8">
          <div className="text-6xl font-black font-mono tracking-widest text-teal-400 bg-gray-950 py-4 rounded-xl border border-gray-800">
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
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2">
              <label className="block text-gray-500 mb-1 text-xs">Type de questions</label>
              <select
                disabled={!isHost}
                value={settings.category}
                onChange={(e) => updateSettings({ category: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60"
              >
                <option value="mix">Un peu de tout</option>
                <option value="soft">Rigolo (tout public)</option>
                <option value="spicy">Piquant (entre potes)</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-500 mb-1 text-xs">Nombre de questions</label>
              <select
                disabled={!isHost}
                value={settings.rounds}
                onChange={(e) => updateSettings({ rounds: Number(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60"
              >
                {[5, 8, 10, 15].map((n) => (
                  <option key={n} value={n}>{n}</option>
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
                {[15, 20, 30, 45, 60].map((n) => (
                  <option key={n} value={n}>{n}s</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-800 text-sm">
            <ToggleRow
              label="Voter pour soi-même"
              hint="Autorise à se désigner soi-même"
              checked={settings.selfVote}
              disabled={!isHost}
              onChange={(v) => updateSettings({ selfVote: v })}
            />
          </div>
        </div>

        {isHost ? (
          <button
            onClick={() => startGame({ resetScores: false })}
            disabled={players.length < 2}
            className="w-full bg-teal-600 hover:bg-teal-500 shadow-md shadow-teal-900/40 disabled:opacity-50 active:scale-95 text-white font-black py-4 px-6 rounded-lg text-lg transition"
          >
            {players.length < 2 ? "En attente d'au moins 2 joueurs..." : 'Lancer le jeu !'}
          </button>
        ) : (
          waitingForHost
        )}
      </div>
    );
  }

  if (phase === 'vote') {
    const secs = secondsLeftFor(settings.voteSeconds);
    return renderAppShell(
      <div className="max-w-2xl w-full mx-auto">
        {renderQuestionCard()}
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-gray-400 text-sm">{myVote ? 'Vote enregistré — tu peux encore changer d’avis.' : 'Désigne un joueur :'}</p>
          <CountdownBadge seconds={secs} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {players.map((p) => {
            const isMe = p.id === player.id;
            const blocked = isMe && !settings.selfVote;
            const selected = myVote?.target_id === p.id;
            return (
              <button
                key={p.id}
                data-sfx="off"
                onClick={() => castVote(p.id)}
                disabled={blocked}
                className={`rounded-xl p-4 border-2 transition active:scale-95 flex flex-col items-center gap-2 ${
                  selected
                    ? 'border-teal-300 bg-teal-900/50 shadow-lg shadow-teal-900/40 scale-[1.03]'
                    : blocked
                    ? 'border-gray-800 bg-gray-950 opacity-40 cursor-default'
                    : 'border-gray-700 bg-gray-900 hover:border-teal-500 hover:-translate-y-0.5'
                }`}
              >
                <span className="w-14 h-14 inline-flex items-center justify-center rounded-full text-3xl overflow-hidden" style={{ backgroundColor: `${colorForPlayer(p.id)}33`, border: `2px solid ${colorForPlayer(p.id)}` }}>
                  <AvatarGlyph avatar={p.avatar} />
                </span>
                <span className="font-bold truncate max-w-full">{p.name}{isMe ? ' (toi)' : ''}</span>
                {selected && <span className="text-[11px] font-bold text-teal-200 animate-pop">✅ Ton vote</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (phase === 'reveal') {
    const tally = tallyFor(meta.round);
    const ids = Array.from(new Set([...players.map((p) => p.id), ...Object.keys(tally)]));
    const rows = ids.map((id) => ({ id, voters: tally[id] || [] })).sort((a, b) => b.voters.length - a.voters.length);
    const max = rows[0]?.voters.length || 0;
    const hasVotes = max > 0;
    const isLast = meta.round + 1 >= totalRounds;
    return renderAppShell(
      <div className="max-w-2xl w-full mx-auto">
        {renderQuestionCard()}
        {!hasVotes && <p className="text-center text-gray-500 mb-4">Personne n’a voté sur cette question.</p>}
        <div className="space-y-2 mb-6">
          {rows.map((r, i) => {
            const winner = hasVotes && r.voters.length === max;
            return (
              <div
                key={r.id}
                className={`animate-rise rounded-xl border px-4 py-3 ${
                  winner ? 'bg-gradient-to-r from-teal-900/60 to-emerald-900/40 border-teal-500/60 shadow-lg shadow-teal-900/30' : 'bg-gray-900 border-gray-800'
                }`}
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="flex items-center gap-3">
                  <PlayerDot id={r.id} avatar={avatarOf(r.id)} size="md" />
                  <span className="font-bold truncate flex-1">{winner && '👑 '}{nameOf(r.id)}</span>
                  <span className="font-heading text-xl text-teal-300">{r.voters.length}</span>
                </div>
                <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-lime-400 transition-all duration-700"
                    style={{ width: `${max ? (r.voters.length / max) * 100 : 0}%` }}
                  />
                </div>
                {r.voters.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] text-gray-400">
                    <span>désigné par</span>
                    {r.voters.map((vid) => (
                      <span key={vid} className="inline-flex items-center gap-1 bg-gray-800 rounded-full pl-0.5 pr-2 py-0.5">
                        <PlayerDot id={vid} avatar={avatarOf(vid)} />
                        {nameOf(vid)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {isHost ? (
          <div className="text-center">
            <button onClick={nextRound} className="bg-teal-600 hover:bg-teal-500 shadow-md shadow-teal-900/40 font-bold py-3 px-8 rounded-full active:scale-95 transition">
              {isLast ? 'Voir le bilan' : 'Question suivante'}
            </button>
          </div>
        ) : (
          waitingForHost
        )}
      </div>
    );
  }

  // phase === 'final'
  const totals = {};
  votes.forEach((v) => {
    totals[v.target_id] = (totals[v.target_id] || 0) + 1;
  });
  const ranking = Object.keys({ ...totals, ...Object.fromEntries(players.map((p) => [p.id, 0])) })
    .map((id) => ({ id, n: totals[id] || 0 }))
    .sort((a, b) => b.n - a.n);
  const recap = questions.map((q, round) => {
    const tally = tallyFor(round);
    const top = Math.max(0, ...Object.values(tally).map((v) => (v as string[]).length));
    const winners = Object.keys(tally).filter((id) => tally[id].length === top);
    return { q, top, winners };
  });

  const topVotes = ranking[0]?.n || 0;
  const topIds = ranking.filter((r) => r.n === topVotes && topVotes > 0).map((r) => r.id);
  const worst = recap.filter((r) => r.winners.some((w) => topIds.includes(w))).sort((a, b) => b.top - a.top)[0];
  const front = quiDeNousFront({
    topNames: topIds.map(nameOf),
    topVotes,
    rounds: totalRounds,
    worstQuestion: worst?.q,
    seed: game.gameId || 'qui-de-nous',
  });

  return renderAppShell(
    <div className="flex flex-col items-center text-center max-w-2xl w-full mx-auto py-2">
      <FrontPage front={front} avatar={avatarOf(topIds[0])} photoCaption="Notre plus désigné, photographié ce soir." />
      <p className="eyebrow mb-3">Le classement des plus désignés</p>

      <div className="w-full space-y-2 mb-8">
        {ranking.map((r, i) => (
          <div
            key={r.id}
            className={`animate-rise flex items-center gap-3 rounded-xl px-4 py-3 border text-left ${
              i === 0 && r.n > 0 ? 'bg-gradient-to-r from-teal-900/60 to-emerald-900/40 border-teal-500/60' : 'bg-gray-900 border-gray-800'
            }`}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <span className="w-6 text-center font-heading text-gray-500">{i + 1}</span>
            <PlayerDot id={r.id} avatar={avatarOf(r.id)} size="md" />
            <span className="font-bold truncate flex-1">{i === 0 && r.n > 0 && '👑 '}{nameOf(r.id)}</span>
            <span className="text-xs text-gray-400">{r.n} vote{r.n > 1 ? 's' : ''}</span>
          </div>
        ))}
      </div>

      <div className="w-full mb-8 text-left">
        <p className="eyebrow mb-2">📜 Récap des questions</p>
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {recap.map((r, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <p className="text-xs text-gray-500">Qui est le plus susceptible de…</p>
              <p className="font-heading text-base leading-snug text-gray-100 break-words [overflow-wrap:anywhere]">{r.q}&nbsp;?</p>
              <p className="text-sm text-teal-300 mt-1">
                {r.winners.length ? `👑 ${r.winners.map(nameOf).join(', ')} (${r.top} vote${r.top > 1 ? 's' : ''})` : 'Aucun vote'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {isHost ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => startGame({ resetScores: false })}
            disabled={players.length < 2}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 shadow-md shadow-teal-900/40 active:scale-95 font-bold py-3 px-6 rounded-full transition"
          >
            <RotateCcw size={16} /> Rejouer (scores conservés)
          </button>
          <button
            onClick={() => startGame({ resetScores: true })}
            disabled={players.length < 2}
            className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 active:scale-95 font-bold py-3 px-6 rounded-full transition"
          >
            Nouvelle partie (scores à zéro)
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
