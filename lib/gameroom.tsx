'use client';

// Socle commun des nouveaux jeux : identité du joueur, salon (code, présence, host), invitation, annuaire,
// écran d'accueil et cadre de jeu (barre latérale des joueurs). Chaque jeu y branche ses propres événements.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Users, Crown, Copy, LogOut, Check, BookOpen, X, Loader2 } from 'lucide-react';
import {
  supabase, makeId, AVATAR_EMOJIS, colorForPlayer, randomAvatar, playSfx, SoundToggle,
  GamesRail as SharedGamesRail, useRoomHub, makeSessionStore, MAX_NAME_LEN, readIdentity, writeIdentity,
  useDiscordAuth, AccountButton, AvatarPicker, AvatarGlyph, isImageAvatar, useRefState,
  useRoomDirectory, VisibilityPicker, useRoomExtras, ChatWidget, toast,
} from '@/lib/shared';

type Callbacks = {
  attach?: (channel: any) => void; // pose les écouteurs d'événements du jeu (avant subscribe)
  hostSync?: (channel: any) => void; // le host renvoie l'état du jeu à qui arrive
  reset?: () => void; // remise à zéro de l'état local du jeu
};

export const useGameRoom = ({
  channelName,
  gameId,
  sessionKey,
  defaultSettings,
  started,
  cbRef,
}: {
  channelName: string;
  gameId: string;
  sessionKey: string;
  defaultSettings: any;
  started: boolean;
  cbRef: React.MutableRefObject<Callbacks>;
}) => {
  const session = useMemo(() => makeSessionStore(sessionKey), [sessionKey]);
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

  const [room, setRoom] = useState<{ code: string } | null>(null);
  const [createVisibility, setCreateVisibility] = useState('private');
  const [joinCode, setJoinCode] = useState('');
  const [players, setPlayers] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [settings, setSettings, settingsRef] = useRefState(defaultSettings);
  const [known, setKnown, knownRef] = useRefState({});
  const playersRef = useRef<any[]>([]);
  const channelRef = useRef<any>(null);
  const isHostRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
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

  const broadcast = (event: string, payload: any) => channelRef.current?.send({ type: 'broadcast', event, payload });

  const connectToRoom = (code: string, playerId: string, playerName: string, playerAvatar: string, isCreator: boolean) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase.channel(`${channelName}:${code}`, { config: { presence: { key: playerId } } });

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
    // Rattrapage : le host renvoie réglages, roster et état du jeu à qui arrive
    channel.on('presence', { event: 'join' }, ({ key }: any) => {
      if (key === playerId || !isHostRef.current) return;
      extras.onPresenceJoin(channel, key);
      channel.send({ type: 'broadcast', event: 'settings_update', payload: { settings: settingsRef.current } });
      channel.send({ type: 'broadcast', event: 'roster', payload: { known: knownRef.current } });
      cbRef.current.hostSync?.(channel);
    });
    channel.on('broadcast', { event: 'settings_update' }, ({ payload }: any) => setSettings(payload.settings));
    channel.on('broadcast', { event: 'roster' }, ({ payload }: any) => setKnown((prev) => ({ ...payload.known, ...prev })));
    cbRef.current.attach?.(channel);

    extras.attach(channel);
    channel.subscribe(async (status: string) => {
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
    setSettings(defaultSettings);
    setKnown({});
    cbRef.current.reset?.();
  };
  const enterRoom = (code: string, playerId: string, isCreator: boolean) => {
    resetLocalState();
    if (isCreator) setSettings((prev) => ({ ...prev, visibility: createVisibility }));
    setPlayer((p) => ({ ...p, id: playerId }));
    setRoom({ code });
    session.write({ code, id: playerId, name: player.name.trim(), avatar: player.avatar });
    connectToRoom(code, playerId, player.name.trim(), player.avatar, isCreator);
  };
  const createRoom = () => {
    if (!player.name.trim()) return;
    enterRoom(Math.random().toString(36).substring(2, 8).toUpperCase(), auth.profile?.id || makeId('p'), true);
  };
  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code || !player.name.trim()) return;
    const saved = session.read();
    enterRoom(code, auth.profile?.id || (saved && saved.code === code && saved.id ? saved.id : makeId('p')), false);
  };
  const leaveRoom = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    session.clear();
    resetLocalState();
    setRoom(null);
    setPlayer((p) => ({ ...p, id: null }));
  };
  // Reconnexion automatique après un rafraîchissement
  useEffect(() => {
    const saved = session.read();
    if (!saved || !saved.code || !saved.id || !saved.name) return;
    const urlRoom = new URLSearchParams(window.location.search).get('room');
    if (urlRoom && urlRoom.toUpperCase() !== saved.code) {
      session.clear();
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
  useRoomHub({ gameId: gameId, code: room?.code, player, isHost });
  const extras = useRoomExtras({
    channelRef, me: player, isHost, hostId,
    onKicked: () => {
      leaveRoom();
      toast('Tu as été expulsé du salon.');
    },
  });
  useRoomDirectory({
    enabled: !!room && isHost && settings.visibility === 'public',
    game: gameId,
    code: room?.code,
    roomName: settings.roomName,
    hostName: player.name,
    hostAvatar: player.avatar,
    count: players.length,
    started,
  });
  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  const [hostToast, setHostToast] = useState<string | null>(null);
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

  const updateSettings = (patch: any) => {
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

  const nameOf = (id: string) => (known as any)[id]?.name || '???';
  const avatarOf = (id: string) => (known as any)[id]?.avatar;
  const presentIds = () => new Set(playersRef.current.map((p) => p.id));

  return {
    player, setPlayer, auth, room, players, playersRef, now, copied, copyCode,
    settings, settingsRef, setSettings, updateSettings, known, knownRef, nameOf, avatarOf, presentIds,
    isHost, isHostRef, hostId, extras, broadcast, channelRef, hostToast,
    createRoom, joinRoom, leaveRoom, createVisibility, setCreateVisibility, joinCode, setJoinCode,
  };
};

export type GameRoom = ReturnType<typeof useGameRoom>;

// ---------- Fenêtre des règles ----------
export const RulesDialog = ({ steps, onClose }: { steps: { title: string; text: string }[]; onClose: () => void }) => (
  <div className="fixed inset-0 z-[950] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()} className="paper w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 relative animate-rise">
      <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition active:scale-90"><X size={20} /></button>
      <h2 className="font-heading text-2xl mb-5 flex items-center gap-2"><BookOpen size={22} className="text-purple-300" /> Comment jouer ?</h2>
      <div className="space-y-4">
        {steps.map((s, i) => (
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

// ---------- Écran d'accueil du jeu (pseudo, avatar, créer / rejoindre) ----------
export const GameHome = ({
  g, eyebrow, title, tagline, soundOn, toggleSound, onRules, gameId,
}: {
  g: GameRoom; eyebrow: string; title: string; tagline: string; soundOn: boolean; toggleSound: () => void; onRules: () => void; gameId: string;
}) => (
  <div className="min-h-screen md:h-[100dvh] md:overflow-y-auto text-white relative z-10 flex flex-col items-center before:content-[''] before:flex-1 after:content-[''] after:flex-1 p-4 pt-16 md:pt-4 md:pl-28">
    <GameVersion label={gameId} />
    <SharedGamesRail currentId={gameId} />
    <div className="text-center mb-2">
      <p className="eyebrow">✦ {eyebrow} ✦</p>
      <h1 className="font-heading text-4xl min-[420px]:text-5xl sm:text-7xl leading-none mt-2 ink-in">{title}</h1>
    </div>
    <p className="text-gray-400 mb-6 italic text-center">{tagline}</p>
    <div className="paper relative p-8 sm:p-10 w-full max-w-xl">
      <SoundToggle on={soundOn} onToggle={toggleSound} className="absolute top-3 right-3" />
      <AccountButton auth={g.auth} />
      <div className="flex justify-center mb-4">
        <span className="w-16 h-16 flex items-center justify-center rounded-full text-3xl overflow-hidden" style={{ backgroundColor: `${colorForPlayer(g.player.avatar)}33`, border: `2px solid ${colorForPlayer(g.player.avatar)}` }}>
          <AvatarGlyph avatar={g.player.avatar} />
        </span>
      </div>
      <AvatarPicker auth={g.auth} avatar={g.player.avatar} activeClass="bg-purple-600" onPick={(avatar) => g.setPlayer((p) => ({ ...p, avatar }))} />
      <input
        type="text"
        placeholder="Ton Pseudo..."
        value={g.player.name}
        maxLength={MAX_NAME_LEN}
        autoFocus
        onChange={(e) => g.setPlayer({ ...g.player, name: e.target.value })}
        className="w-full p-4 bg-gray-950 border border-gray-700 rounded-lg text-white font-bold text-lg text-center mb-6 focus:outline-none transition"
      />
      <VisibilityPicker value={g.createVisibility} onChange={g.setCreateVisibility} />
      <div className="space-y-4">
        <button onClick={g.createRoom} disabled={!g.player.name.trim()} className="w-full bg-purple-300 hover:bg-purple-200 !text-gray-950 shadow-md disabled:opacity-50 font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition transform hover:scale-[1.02] active:scale-95">
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
            value={g.joinCode}
            onChange={(e) => g.setJoinCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && g.joinRoom()}
            className="w-2/3 p-4 bg-gray-950 border border-gray-700 rounded-lg text-center font-mono uppercase font-bold text-white"
          />
          <button onClick={g.joinRoom} disabled={!g.player.name.trim() || !g.joinCode.trim()} className="w-1/3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-bold py-4 rounded-lg transition active:scale-95">Rejoindre</button>
        </div>
      </div>
      <button onClick={onRules} className="mt-5 w-full flex items-center justify-center gap-1.5 text-gray-400 hover:text-purple-300 text-sm font-bold transition">
        <BookOpen size={15} /> Comment jouer ?
      </button>
    </div>
  </div>
);

export const GameVersion = ({ label }: { label: string }) => (
  <div className="fixed bottom-2 right-3 text-[10px] text-gray-600 font-mono select-none pointer-events-none z-50">{label} v1</div>
);

// ---------- Cadre de jeu : barre latérale (code, joueurs, quitter) + zone principale ----------
export const GameShell = ({
  g, gameId, soundOn, toggleSound, sidebar, children, sidebarTitle,
}: {
  g: GameRoom; gameId: string; soundOn: boolean; toggleSound: () => void; sidebar: React.ReactNode; children: React.ReactNode; sidebarTitle?: string;
}) => (
  <div className="min-h-screen md:h-[100dvh] md:overflow-hidden text-white relative z-10 flex justify-center p-4 pt-16 md:pt-4 md:pl-28">
    <GameVersion label={gameId} />
    <SharedGamesRail currentId={gameId} />
    <ChatWidget extras={g.extras} me={g.player} enabled={g.settings.chatEnabled !== false} />
    {g.hostToast && (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[960] animate-fadein paper px-5 py-2.5 text-sm font-bold flex items-center gap-2">
        <Crown size={16} className="text-yellow-400" /> {g.hostToast}
      </div>
    )}
    <div className="w-full max-w-[100rem] flex flex-col md:flex-row gap-4 md:h-full md:min-h-0">
      <div className="paper w-full md:w-64 shrink-0 p-4 flex flex-col md:h-[calc(100dvh-2rem)] md:sticky md:top-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-gray-400 font-mono text-xs uppercase tracking-wide"># room-{g.room?.code}</span>
          <button onClick={g.copyCode} title="Copier le lien d'invitation" className="text-gray-400 hover:text-white transition">
            {g.copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <div className="h-px bg-purple-600/30 my-3" />
        <h3 className="flex items-center gap-2 text-gray-400 font-bold mb-2 uppercase text-[11px] tracking-wide shrink-0">
          <Users size={13} /> {sidebarTitle || 'Joueurs'} — {g.players.length}
        </h3>
        <div className="space-y-1 md:flex-1 md:overflow-y-auto -mx-1 px-1">{sidebar}</div>
        <div className="h-px bg-purple-600/30 my-3 shrink-0" />
        <div className="flex items-center justify-between shrink-0">
          <button onClick={g.leaveRoom} className="flex items-center gap-2 text-gray-400 hover:text-red-400 text-sm font-bold transition py-1 active:scale-95">
            <LogOut size={14} /> Quitter
          </button>
          <SoundToggle on={soundOn} onToggle={toggleSound} />
        </div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col md:h-full md:min-h-0">{children}</div>
    </div>
  </div>
);

// ---------- Bloc « code de la room » du lobby ----------
export const RoomCodeBlock = ({ g }: { g: GameRoom }) => (
  <>
    <h2 className="font-heading text-2xl mb-2">Code de la Room</h2>
    <div className="relative mb-5">
      <div className="text-4xl sm:text-6xl font-black font-mono tracking-widest text-purple-300 bg-gray-950 py-4 rounded-xl border border-gray-800">{g.room?.code}</div>
      <button onClick={g.copyCode} className="flex w-fit mx-auto mt-3 sm:mt-0 sm:absolute sm:right-3 sm:bottom-3 items-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold px-3 py-2 rounded-lg transition active:scale-95">
        {g.copied ? <Check size={14} /> : <Copy size={14} />}
        {g.copied ? 'Lien copié !' : "Copier l'invitation"}
      </button>
    </div>
  </>
);

export const WaitingForHost = () => (
  <div className="flex items-center justify-center gap-3 text-gray-400 animate-pulse">
    <Loader2 className="animate-spin" /> En attente du Host...
  </div>
);
