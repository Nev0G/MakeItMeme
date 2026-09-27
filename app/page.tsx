'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Play, Image as ImageIcon, Video, Music, Send, Trophy, Users, Loader2,
  Crown, ThumbsUp, SkipForward, Settings, Copy, LogOut, Check, Download,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

// ==========================================
// 1. CONFIGURATION SUPABASE
// ==========================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hidtcsztkjpqngwlrzqy.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_CREIog57Ep_e7sUZ0rx-VA_8ooqaGTJ';
const supabase = createClient(supabaseUrl, supabaseAnonKey);
// Si les variables d'env ne sont pas configurées sur Vercel, on tourne sur un
// projet Supabase de démo qui n'a ni bucket ni base : tout upload y restera bloqué.
const USING_FALLBACK_SUPABASE = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const withTimeout = (promise, ms, message) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);

const makeId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 11)}`;

// ==========================================
// COMPOSITION DU TEXTE SUR L'IMAGE (canvas)
// ==========================================
const MEME_STYLES = [
  { id: 'bottom-gradient', label: 'Dégradé (bas)' },
  { id: 'impact-top', label: 'Impact classique (haut)' },
  { id: 'banner-bottom', label: 'Bandeau plein (bas)' },
];

const loadImageEl = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l'image (CORS ?)."));
    img.src = url;
  });

const wrapCanvasText = (ctx, text, maxWidth) => {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const composeMemeImage = async (url, text, style = 'bottom-gradient') => {
  const img = await loadImageEl(url);
  const maxDim = 1080;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const fontSize = Math.max(20, Math.round(canvas.width / 16));
  const displayText = style === 'impact-top' ? text.toUpperCase() : text;
  ctx.font = `900 ${fontSize}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  const lines = wrapCanvasText(ctx, displayText, canvas.width - 40);
  const lineHeight = fontSize * 1.2;

  if (style === 'impact-top') {
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = fontSize / 8;
    ctx.textBaseline = 'alphabetic';
    let y = 20 + fontSize;
    lines.forEach((line) => {
      ctx.strokeText(line, canvas.width / 2, y);
      ctx.fillText(line, canvas.width / 2, y);
      y += lineHeight;
    });
  } else if (style === 'banner-bottom') {
    const bandHeight = lines.length * lineHeight + 30;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, canvas.height - bandHeight, canvas.width, bandHeight);
    ctx.fillStyle = 'white';
    ctx.textBaseline = 'alphabetic';
    let y = canvas.height - bandHeight + lineHeight;
    lines.forEach((line) => {
      ctx.fillText(line, canvas.width / 2, y);
      y += lineHeight;
    });
  } else {
    const bandHeight = lines.length * lineHeight + 50;
    const gradient = ctx.createLinearGradient(0, canvas.height - bandHeight, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.88)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, canvas.height - bandHeight, canvas.width, bandHeight);
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = fontSize / 10;
    ctx.textBaseline = 'alphabetic';
    let y = canvas.height - 20 - (lines.length - 1) * lineHeight;
    lines.forEach((line) => {
      ctx.strokeText(line, canvas.width / 2, y);
      ctx.fillText(line, canvas.width / 2, y);
      y += lineHeight;
    });
  }

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
};

const triggerBlobDownload = (blob, filename) => {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
};

// Petite pluie de confettis vanilla (canvas), sans dépendance externe.
const fireConfetti = () => {
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const colors = ['#a855f7', '#ec4899', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6'];
  const pieces = Array.from({ length: 140 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.5,
    size: 6 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    speedY: 2 + Math.random() * 3,
    speedX: -1.5 + Math.random() * 3,
    rotation: Math.random() * 360,
    rotationSpeed: -8 + Math.random() * 16,
  }));

  const start = Date.now();
  const duration = 3200;

  const tick = () => {
    const elapsed = Date.now() - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach((p) => {
      p.x += p.speedX;
      p.y += p.speedY;
      p.rotation += p.rotationSpeed;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    });
    if (elapsed < duration) {
      requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  };
  requestAnimationFrame(tick);
};

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const DEFAULT_SETTINGS = { captionSeconds: 45, voteSeconds: 20, mediaPerPlayer: 1 };
const MAX_FILE_MB = 25;
const MAX_NAME_LEN = 20;
const MAX_CAPTION_LEN = 140;
// Incrémenter à chaque mise à jour livrée du jeu.
const APP_VERSION = 'v13';

const PLAYER_COLORS = ['#a855f7', '#ec4899', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#f43f5e'];
const colorForPlayer = (id) => {
  if (!id) return PLAYER_COLORS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PLAYER_COLORS[hash % PLAYER_COLORS.length];
};
const AVATAR_EMOJIS = ['😂', '🔥', '👻', '🐸', '🦄', '🍕', '🎃', '🐙', '🤡', '👽', '🦖', '🍔', '🐵', '💀', '🥸', '🦊'];
const randomAvatar = () => AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];

const PlayerDot = ({ id, avatar, size = 'sm' }) => {
  const dims = size === 'lg' ? 'w-9 h-9 text-lg' : size === 'md' ? 'w-6 h-6 text-xs' : 'w-4 h-4 text-[10px]';
  if (avatar) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full shrink-0 ${dims}`}
        style={{ backgroundColor: `${colorForPlayer(id)}33`, border: `1.5px solid ${colorForPlayer(id)}` }}
      >
        {avatar}
      </span>
    );
  }
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorForPlayer(id) }} />;
};

const VersionBadge = () => (
  <div className="fixed bottom-2 right-3 text-[10px] text-gray-600 font-mono select-none pointer-events-none z-50">
    {APP_VERSION}
  </div>
);

// ==========================================
// COMPOSANT LECTEUR MULTIMÉDIA UNIVERSEL
// ==========================================
const MediaPlayer = ({ src, type }) => {
  if (!src) return null;

  if (type && type.includes('video')) {
    return <video src={src} controls autoPlay loop className="max-h-64 w-full object-contain rounded-lg border-2 border-gray-700" />;
  }
  if (type && type.includes('audio')) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-800 rounded-lg border-2 border-gray-700 w-full">
        <Music size={48} className="text-purple-400 mb-4 animate-bounce" />
        <audio src={src} controls autoPlay className="w-full" />
      </div>
    );
  }
  return <img src={src} alt="Média à captionner" className="max-h-64 w-full object-contain rounded-lg border-2 border-gray-700" />;
};

const FUN_WAITING_PHRASES = [
  'Recomptage des votes à la main...',
  "Réveil du gars qui a pas encore choisi...",
  "Suppression des preuves compromettantes...",
  'Négociation avec le serveur...',
  "Interrogation d'un pigeon voyageur...",
  'Chauffage des mèmes au micro-ondes...',
];

const Waiting = ({ label, sub, fun = false }) => {
  const [phraseIdx, setPhraseIdx] = useState(0);
  useEffect(() => {
    if (!fun) return;
    const id = setInterval(() => setPhraseIdx((i) => (i + 1) % FUN_WAITING_PHRASES.length), 2400);
    return () => clearInterval(id);
  }, [fun]);
  return (
    <div className="py-12 flex flex-col items-center">
      <Loader2 size={48} className="text-purple-500 animate-spin mb-4" />
      <p className="font-bold">{label}</p>
      {sub && <p className="text-gray-500 text-sm mt-2">{sub}</p>}
      {fun && <p className="text-gray-600 text-xs mt-3 italic">{FUN_WAITING_PHRASES[phraseIdx]}</p>}
    </div>
  );
};

const CountdownBadge = ({ seconds }) => (
  <div className={`bg-gray-900 px-4 py-2 rounded-full font-bold font-mono border ${seconds <= 5 ? 'border-red-500 text-red-400' : 'border-gray-800'}`}>
    {seconds > 0 ? `⏳ ${seconds}s` : '⏰ Terminé'}
  </div>
);

const isImageMedia = (media) => !media?.type || (!media.type.includes('video') && !media.type.includes('audio'));

const DownloadButton = ({ onClick, className = '' }) => (
  <button
    onClick={onClick}
    title="Télécharger le média"
    className={`bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg transition ${className}`}
  >
    <Download size={16} />
  </button>
);

const MediaWithDownload = ({ media, onDownload }) => (
  <div className="relative">
    <MediaPlayer src={media.url} type={media.type} />
    <DownloadButton onClick={() => onDownload(media)} className="absolute top-2 right-2" />
  </div>
);

// Carte "meme" pour le vote : légende incrustée directement sur l'image, comme
// un vrai meme. N'affiche l'image qu'une fois par carte (donc uniquement
// pertinent pour des images ; vidéo/audio utilisent CaptionChoiceCard pour
// éviter de dupliquer un lecteur audio/vidéo par carte).
const MemeVoteCard = ({ media, caption, isMine, isSelected, disabled, onVote, onDownloadStyle }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div
      className={`relative rounded-2xl overflow-hidden border-2 transition shadow-xl bg-gray-900 flex flex-col ${
        isSelected ? 'border-purple-500 ring-2 ring-purple-500' : isMine ? 'border-gray-700' : 'border-gray-800'
      }`}
    >
      {isMine && (
        <span className="absolute top-2 left-2 z-10 text-[10px] font-bold bg-gray-800/90 text-gray-300 px-2 py-1 rounded-full">
          C'est la tienne
        </span>
      )}
      <div className="absolute top-2 right-2 z-20">
        <DownloadButton onClick={() => setMenuOpen((v) => !v)} />
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 mt-1 z-20 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden w-48 text-xs">
              {MEME_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setMenuOpen(false);
                    onDownloadStyle(s.id);
                  }}
                  className="w-full text-left px-3 py-2.5 text-gray-200 hover:bg-purple-900/40 transition"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="relative">
        <img src={media.url} alt="" className="w-full h-64 sm:h-72 object-cover" />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pt-10">
          <p
            className="text-white font-black text-xl leading-tight"
            style={{ textShadow: '1.5px 1.5px 0 #000, -1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000' }}
          >
            "{caption}"
          </p>
        </div>
      </div>

      <button
        onClick={onVote}
        disabled={disabled}
        className={`w-full py-3 flex items-center justify-center gap-2 font-bold transition active:scale-95 ${
          disabled ? 'bg-gray-800 text-gray-500 cursor-default' : 'bg-purple-600 hover:bg-purple-500 text-white'
        }`}
      >
        {isSelected ? (
          <>
            <Check size={18} /> Ton vote
          </>
        ) : isMine ? (
          'Pas votable'
        ) : (
          <>
            <ThumbsUp size={18} /> Voter pour celle-ci
          </>
        )}
      </button>
    </div>
  );
};

// Carte texte pour le vote (utilisée quand le média est une vidéo/audio, pour
// ne pas dupliquer le lecteur — et donc le son — une fois par légende).
const CaptionChoiceCard = ({ caption, isMine, isSelected, disabled, onVote }) => (
  <div
    className={`rounded-2xl border-2 p-8 flex flex-col items-center justify-center gap-4 min-h-[180px] ${
      isSelected ? 'border-purple-500 bg-purple-900/30' : isMine ? 'border-gray-700 bg-gray-900' : 'border-gray-700 bg-gray-800'
    }`}
  >
    {isMine && (
      <span className="text-[10px] font-bold bg-gray-700 text-gray-300 px-2 py-1 rounded-full">C'EST LA TIENNE</span>
    )}
    <p className="font-black text-2xl text-center">"{caption}"</p>
    <button
      onClick={onVote}
      disabled={disabled}
      className={`px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition active:scale-95 ${
        disabled ? 'bg-gray-700 text-gray-500 cursor-default' : 'bg-purple-600 hover:bg-purple-500 text-white'
      }`}
    >
      {isSelected ? (
        <>
          <Check size={18} /> Ton vote
        </>
      ) : isMine ? (
        'Pas votable'
      ) : (
        <>
          <ThumbsUp size={18} /> Voter pour celle-ci
        </>
      )}
    </button>
  </div>
);

// Carrousel générique : une carte à la fois, navigation flèches + points +
// clavier (gérée par le composant parent). "cards" est un tableau de noeuds JSX déjà construits.
const Carousel = ({ index, count, onPrev, onNext, onJump, children }) => (
  <div className="w-full">
    <div className="flex items-center gap-3">
      <button
        onClick={onPrev}
        disabled={count <= 1}
        className="shrink-0 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white p-3 rounded-full transition active:scale-90"
        aria-label="Précédent"
      >
        <ChevronLeft size={22} />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
      <button
        onClick={onNext}
        disabled={count <= 1}
        className="shrink-0 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white p-3 rounded-full transition active:scale-90"
        aria-label="Suivant"
      >
        <ChevronRight size={22} />
      </button>
    </div>
    {count > 1 && (
      <div className="flex items-center justify-center gap-2 mt-4">
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            onClick={() => onJump(i)}
            className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-purple-500' : 'w-2 bg-gray-700 hover:bg-gray-600'}`}
            aria-label={`Aller à la carte ${i + 1}`}
          />
        ))}
      </div>
    )}
  </div>
);

// ==========================================
// APPLICATION PRINCIPALE
// ==========================================
export default function CaptionBattle() {
  const [gameState, setGameState] = useState('home');
  const [player, setPlayer] = useState({ id: null, name: '', avatar: randomAvatar() });
  const [room, setRoom] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [players, setPlayers] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [copied, setCopied] = useState(false);

  const [medias, setMedias] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const pushDebug = (msg) => {
    console.log('[upload]', msg);
  };
  const [roundQueue, setRoundQueue] = useState([]); // liste d'ids de médias, 1 par round
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [phaseStartedAt, setPhaseStartedAt] = useState(null);
  const [now, setNow] = useState(Date.now());

  const [captions, setCaptions] = useState([]); // {media_id, author_id, author_name, text}
  const [myCaption, setMyCaption] = useState('');
  const [votes, setVotes] = useState([]); // {media_id, voter_id, caption_author_id}
  const [cumulativeScores, setCumulativeScores] = useState({});

  const channelRef = useRef(null);
  const processedRoundRef = useRef(-1);
  const autoSkipRef = useRef('');

  // Refs "miroir" de l'état, pour que les listeners Supabase (enregistrés une
  // seule fois côté channel) lisent toujours la valeur la plus fraîche
  // plutôt qu'une closure figée au moment de la connexion.
  const isHostRefValue = useRef(false);
  const gameStateRef = useRef('home');
  const settingsRef = useRef(DEFAULT_SETTINGS);
  const mediasRef = useRef([]);
  const roundQueueRef = useRef([]);
  const currentRoundIndexRef = useRef(0);
  const phaseStartedAtRef = useRef(null);
  const captionsRef = useRef([]);
  const votesRef = useRef([]);
  const cumulativeScoresRef = useRef({});

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  // Pré-remplit le code de room si on arrive via un lien d'invitation (?room=XXXX)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const roomParam = new URLSearchParams(window.location.search).get('room');
    if (roomParam) setJoinCode(roomParam.toUpperCase());
  }, []);

  // ==========================================
  // CONNEXION AU CHANNEL DE LA ROOM (presence + broadcast)
  // ==========================================
  const connectToRoom = (code, playerId, playerName, playerAvatar, isCreator) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase.channel(`room:${code}`, {
      config: { presence: { key: playerId } },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const list = Object.values(state)
        .flat()
        .map((p) => ({ id: p.player_id, name: p.player_name, avatar: p.player_avatar, is_creator: p.is_creator, joined_at: p.joined_at }))
        .sort((a, b) => a.joined_at - b.joined_at);
      setPlayers(list);
    });

    // Rattrapage : si un joueur rejoint alors que la partie est déjà lancée,
    // le host lui renvoie tout l'état courant (sinon il resterait bloqué au lobby).
    channel.on('presence', { event: 'join' }, ({ key }) => {
      if (key === playerId) return;
      if (!isHostRefValue.current) return;
      if (gameStateRef.current === 'home' || gameStateRef.current === 'lobby') return;

      channel.send({ type: 'broadcast', event: 'settings_update', payload: { settings: settingsRef.current } });
      mediasRef.current.forEach((media) => {
        channel.send({ type: 'broadcast', event: 'media_added', payload: { media } });
      });
      if (roundQueueRef.current.length) {
        channel.send({ type: 'broadcast', event: 'round_queue', payload: { queue: roundQueueRef.current } });
      }
      captionsRef.current.forEach((caption) => {
        channel.send({ type: 'broadcast', event: 'caption_submitted', payload: { caption } });
      });
      votesRef.current.forEach((vote) => {
        channel.send({ type: 'broadcast', event: 'vote_cast', payload: { vote } });
      });
      channel.send({ type: 'broadcast', event: 'scores_sync', payload: { scores: cumulativeScoresRef.current } });
      channel.send({
        type: 'broadcast',
        event: 'game_update',
        payload: {
          newState: gameStateRef.current,
          roundIndex: currentRoundIndexRef.current,
          phaseStartedAt: phaseStartedAtRef.current,
        },
      });
    });

    channel.on('broadcast', { event: 'game_update' }, ({ payload }) => {
      if (payload?.newState) setGameState(payload.newState);
      if (typeof payload?.roundIndex === 'number') setCurrentRoundIndex(payload.roundIndex);
      if (payload?.phaseStartedAt) setPhaseStartedAt(payload.phaseStartedAt);
    });

    channel.on('broadcast', { event: 'settings_update' }, ({ payload }) => setSettings(payload.settings));

    channel.on('broadcast', { event: 'media_added' }, ({ payload }) => {
      setMedias((prev) => (prev.some((m) => m.id === payload.media.id) ? prev : [...prev, payload.media]));
    });

    channel.on('broadcast', { event: 'round_queue' }, ({ payload }) => setRoundQueue(payload.queue || []));

    channel.on('broadcast', { event: 'caption_submitted' }, ({ payload }) => {
      setCaptions((prev) =>
        prev.some((c) => c.media_id === payload.caption.media_id && c.author_id === payload.caption.author_id)
          ? prev
          : [...prev, payload.caption]
      );
    });

    channel.on('broadcast', { event: 'vote_cast' }, ({ payload }) => {
      setVotes((prev) => [
        ...prev.filter((v) => !(v.voter_id === payload.vote.voter_id && v.media_id === payload.vote.media_id)),
        payload.vote,
      ]);
    });

    channel.on('broadcast', { event: 'scores_sync' }, ({ payload }) => setCumulativeScores(payload.scores || {}));

    channel.on('broadcast', { event: 'new_game' }, () => {
      setMedias([]);
      setRoundQueue([]);
      setCurrentRoundIndex(0);
      setCaptions([]);
      setVotes([]);
      setMyCaption('');
      setCumulativeScores({});
      setPhaseStartedAt(null);
      setGameState('upload');
      processedRoundRef.current = -1;
      autoSkipRef.current = '';
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ player_id: playerId, player_name: playerName, player_avatar: playerAvatar, is_creator: isCreator, joined_at: Date.now() });
      }
    });

    channelRef.current = channel;
  };

  const resetGameStateLocal = () => {
    setPlayers([]);
    setMedias([]);
    setUploadError(null);
    setRoundQueue([]);
    setCurrentRoundIndex(0);
    setCaptions([]);
    setVotes([]);
    setMyCaption('');
    setCumulativeScores({});
    setPhaseStartedAt(null);
    setSettings(DEFAULT_SETTINGS);
    processedRoundRef.current = -1;
    autoSkipRef.current = '';
  };

  const createRoom = () => {
    if (!player.name.trim()) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newPlayerId = makeId('p');
    resetGameStateLocal();
    setPlayer((p) => ({ ...p, id: newPlayerId }));
    setRoom({ code });
    connectToRoom(code, newPlayerId, player.name.trim(), player.avatar, true);
    setGameState('lobby');
  };

  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code || !player.name.trim()) return;
    const newPlayerId = makeId('p');
    resetGameStateLocal();
    setPlayer((p) => ({ ...p, id: newPlayerId }));
    setRoom({ code });
    connectToRoom(code, newPlayerId, player.name.trim(), player.avatar, false);
    setGameState('lobby');
  };

  const leaveRoom = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    resetGameStateLocal();
    setRoom(null);
    setPlayer((p) => ({ ...p, id: null }));
    setGameState('home');
  };

  const hostId = useMemo(() => {
    const creator = players.find((p) => p.is_creator);
    return creator ? creator.id : players[0]?.id ?? null;
  }, [players]);
  const isHost = player.id !== null && player.id === hostId;

  // Miroirs à jour pour les listeners du channel
  useEffect(() => { isHostRefValue.current = isHost; }, [isHost]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { mediasRef.current = medias; }, [medias]);
  useEffect(() => { roundQueueRef.current = roundQueue; }, [roundQueue]);
  useEffect(() => { currentRoundIndexRef.current = currentRoundIndex; }, [currentRoundIndex]);
  useEffect(() => { phaseStartedAtRef.current = phaseStartedAt; }, [phaseStartedAt]);
  useEffect(() => { captionsRef.current = captions; }, [captions]);
  useEffect(() => { votesRef.current = votes; }, [votes]);
  useEffect(() => { cumulativeScoresRef.current = cumulativeScores; }, [cumulativeScores]);

  const broadcast = (event, payload) => channelRef.current?.send({ type: 'broadcast', event, payload });

  const updateSettings = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    broadcast('settings_update', { settings: next });
  };

  const goToState = (newState, extra = {}) => {
    broadcast('game_update', { newState, ...extra });
    setGameState(newState);
    if (typeof extra.roundIndex === 'number') setCurrentRoundIndex(extra.roundIndex);
    if (extra.phaseStartedAt) setPhaseStartedAt(extra.phaseStartedAt);
  };

  const copyCode = async () => {
    if (!room?.code) return;
    const link =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}?room=${room.code}`
        : room.code;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponible (ex: contexte non sécurisé) — on ignore silencieusement
    }
  };

  // ==========================================
  // UPLOAD
  // ==========================================
  const startUploadPhase = () => goToState('upload');

  const handleFileUpload = async (e) => {
    pushDebug('onChange input fichier déclenché');
    const inputEl = e.target;
    const file = inputEl.files && inputEl.files[0];
    setUploadError(null);
    if (!file) {
      pushDebug('aucun fichier dans la sélection');
      return;
    }

    // On passe en "uploading" tout de suite, avant même la moindre autre
    // opération : si le spinner ne s'affiche pas après ça, c'est que
    // onChange lui-même ne se déclenche pas (souci de rendu, pas réseau).
    setUploading(true);
    try {
      pushDebug(`fichier reçu : ${file.name} (${Math.round(file.size / 1024)}ko, ${file.type || 'type inconnu'})`);

      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        throw new Error(`Ce fichier dépasse ${MAX_FILE_MB}Mo, choisis-en un plus léger.`);
      }
      if (!room?.code) {
        throw new Error('Code de room manquant côté client (rejoins ou recrée une partie).');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `${room.code}/${fileName}`;

      pushDebug(`envoi vers Supabase Storage : ${filePath}`);
      const { error } = await withTimeout(
        supabase.storage.from('game-media').upload(filePath, file),
        20000,
        'Le serveur Supabase ne répond pas (délai dépassé). Vérifie ta connexion et la configuration Supabase.'
      );
      if (error) throw error;
      pushDebug('upload réussi ✅');

      const { data: { publicUrl } } = supabase.storage.from('game-media').getPublicUrl(filePath);

      const media = { id: makeId('m'), url: publicUrl, type: file.type, owner_id: player.id, owner_name: player.name, owner_avatar: player.avatar };
      setMedias((prev) => [...prev, media]);
      broadcast('media_added', { media });
    } catch (error) {
      // On affiche le message d'erreur réel de Supabase dans l'UI (un alert()
      // navigateur peut être bloqué/silencieux selon le contexte et donner
      // l'impression que "rien ne se passe").
      pushDebug(`ÉCHEC : ${error?.message || error}`);
      const raw = error?.message || String(error);
      let hint = '';
      if (/bucket.*not.*found/i.test(raw)) {
        hint = " Le bucket Supabase Storage 'game-media' n'existe pas (ou le nom ne correspond pas exactement).";
      } else if (/row-level security|permission|not authorized|unauthorized/i.test(raw)) {
        hint = " Les règles (RLS) du bucket 'game-media' bloquent l'upload anonyme — vérifie que la policy INSERT s'applique bien au rôle 'anon' (pas seulement 'authenticated').";
      } else if (/payload.*too.*large|exceeded.*size/i.test(raw)) {
        hint = ' Le fichier dépasse la limite de taille configurée côté Supabase.';
      } else if (/failed to fetch|networkerror|load failed/i.test(raw)) {
        hint = ' Requête réseau bloquée (CORS, ad-blocker, ou URL Supabase invalide) — regarde l\'onglet Réseau des outils de dev.';
      }
      setUploadError(`Échec de l'upload : ${raw}.${hint}`);
    } finally {
      setUploading(false);
      if (inputEl) inputEl.value = '';
    }
  };

  const myUploadCount = medias.filter((m) => m.owner_id === player.id).length;
  const iUploaded = myUploadCount >= settings.mediaPerPlayer;
  const everyoneUploaded =
    players.length > 0 &&
    players.every((p) => medias.filter((m) => m.owner_id === p.id).length >= settings.mediaPerPlayer);

  const launchGame = () => {
    const queue = shuffle(medias.map((m) => m.id));
    broadcast('round_queue', { queue });
    setRoundQueue(queue);
    goToState('caption', { roundIndex: 0, phaseStartedAt: Date.now() });
  };

  // ==========================================
  // ROUND EN COURS
  // ==========================================
  const currentMediaId = roundQueue[currentRoundIndex];
  const currentMedia = medias.find((m) => m.id === currentMediaId);
  const captionsForRound = captions.filter((c) => c.media_id === currentMediaId);
  const votesForRound = votes.filter((v) => v.media_id === currentMediaId);
  const isMyMedia = currentMedia && currentMedia.owner_id === player.id;
  const iSubmittedCaption = captionsForRound.some((c) => c.author_id === player.id);
  // tout le monde sauf le posteur (et sauf ceux qui ont quitté la room)
  const expectedCaptioners = currentMedia ? players.filter((p) => p.id !== currentMedia.owner_id).length : 0;

  const submitCaption = () => {
    if (!myCaption.trim() || !currentMedia) return;
    const caption = { media_id: currentMedia.id, author_id: player.id, author_name: player.name, author_avatar: player.avatar, text: myCaption.trim() };
    setCaptions((prev) => [...prev, caption]);
    broadcast('caption_submitted', { caption });
    setMyCaption('');
  };

  const secondsLeftFor = (totalSeconds) => {
    if (!phaseStartedAt) return totalSeconds;
    return Math.max(0, totalSeconds - Math.floor((now - phaseStartedAt) / 1000));
  };

  // Avance automatiquement quand tout le monde a répondu
  useEffect(() => {
    if (isHost && gameState === 'caption' && currentMedia && expectedCaptioners > 0 && captionsForRound.length >= expectedCaptioners) {
      goToState('vote', { phaseStartedAt: Date.now() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captions, isHost, gameState, currentMediaId, players.length]);

  // Filet de sécurité : avance automatiquement quand le temps est écoulé, même si
  // tout le monde n'a pas répondu (évite qu'un round reste bloqué indéfiniment).
  useEffect(() => {
    if (!isHost || !currentMedia) return;
    if (gameState === 'caption') {
      const key = `caption-${currentRoundIndex}`;
      if (secondsLeftFor(settings.captionSeconds) === 0 && autoSkipRef.current !== key) {
        autoSkipRef.current = key;
        goToState('vote', { phaseStartedAt: Date.now() });
      }
    }
    if (gameState === 'vote') {
      const key = `vote-${currentRoundIndex}`;
      if (secondsLeftFor(settings.voteSeconds) === 0 && autoSkipRef.current !== key) {
        autoSkipRef.current = key;
        goToState('round_result', { phaseStartedAt: Date.now() });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, isHost, gameState, currentRoundIndex]);

  // Joueurs qui ont au moins une légende éligible à voter (≠ la leur)
  const eligibleVoters = players.filter((p) => captionsForRound.some((c) => c.author_id !== p.id));
  const myVoteForRound = votesForRound.find((v) => v.voter_id === player.id);

  const castVote = (authorId) => {
    if (!currentMedia) return;
    const vote = { media_id: currentMedia.id, voter_id: player.id, caption_author_id: authorId };
    setVotes((prev) => [...prev.filter((v) => !(v.voter_id === player.id && v.media_id === currentMedia.id)), vote]);
    broadcast('vote_cast', { vote });
  };

  useEffect(() => {
    if (isHost && gameState === 'vote' && currentMedia && eligibleVoters.length > 0 && votesForRound.length >= eligibleVoters.length) {
      goToState('round_result', { phaseStartedAt: Date.now() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [votes, isHost, gameState, currentMediaId, players.length]);

  // Ordre mélangé des légendes pour le vote (stable tant que le set de légendes du round ne change pas)
  const shuffledCaptionsForRound = useMemo(
    () => shuffle(captionsForRound),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [captionsForRound.map((c) => c.author_id).join(','), currentMediaId]
  );

  // Carrousel de vote : une légende candidate à la fois
  const [voteSlide, setVoteSlide] = useState(0);
  useEffect(() => {
    setVoteSlide(0);
  }, [currentMediaId]);
  const voteCardCount = shuffledCaptionsForRound.length;
  const goPrevSlide = () => setVoteSlide((s) => (voteCardCount ? (s - 1 + voteCardCount) % voteCardCount : 0));
  const goNextSlide = () => setVoteSlide((s) => (voteCardCount ? (s + 1) % voteCardCount : 0));

  // Navigation clavier pendant le vote : flèches pour parcourir, Entrée pour voter la carte affichée
  useEffect(() => {
    if (gameState !== 'vote') return;
    const handler = (e) => {
      if (e.key === 'ArrowLeft') goPrevSlide();
      else if (e.key === 'ArrowRight') goNextSlide();
      else if (e.key === 'Enter') {
        const target = shuffledCaptionsForRound[voteSlide];
        if (target && target.author_id !== player.id && !myVoteForRound) castVote(target.author_id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, voteSlide, shuffledCaptionsForRound, myVoteForRound, player.id, voteCardCount]);

  const downloadMedia = async (media) => {
    try {
      const res = await fetch(media.url);
      const blob = await res.blob();
      const ext = (media.url.split('.').pop() || 'jpg').split('?')[0];
      triggerBlobDownload(blob, `caption-battle-${media.id}.${ext}`);
    } catch (err) {
      console.error('Téléchargement impossible, ouverture dans un nouvel onglet :', err);
      window.open(media.url, '_blank');
    }
  };

  // Télécharge le meme avec le texte incrusté directement dans l'image (canvas)
  const downloadComposedMeme = async (media, text, style) => {
    try {
      const blob = await composeMemeImage(media.url, text, style);
      if (!blob) throw new Error('Génération du canvas impossible.');
      triggerBlobDownload(blob, `meme-${media.id}-${style}.png`);
    } catch (err) {
      console.error('Composition impossible, téléchargement brut à la place :', err);
      downloadMedia(media);
    }
  };

  const roundScoreboard = useMemo(() => {
    const tally = {};
    votesForRound.forEach((v) => {
      tally[v.caption_author_id] = (tally[v.caption_author_id] || 0) + 1;
    });
    return players.map((p) => ({ ...p, roundPoints: tally[p.id] || 0 })).sort((a, b) => b.roundPoints - a.roundPoints);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [votes, players, currentMediaId]);

  useEffect(() => {
    if (gameState === 'round_result' && processedRoundRef.current !== currentRoundIndex) {
      processedRoundRef.current = currentRoundIndex;
      setCumulativeScores((prev) => {
        const next = { ...prev };
        roundScoreboard.forEach((p) => {
          next[p.id] = (next[p.id] || 0) + p.roundPoints;
        });
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, currentRoundIndex]);

  const hasNextRound = currentRoundIndex + 1 < roundQueue.length;
  const nextRound = () => {
    if (hasNextRound) {
      goToState('caption', { roundIndex: currentRoundIndex + 1, phaseStartedAt: Date.now() });
    } else {
      goToState('final_results', {});
    }
  };

  const newGame = () => {
    broadcast('new_game', {});
    setMedias([]);
    setRoundQueue([]);
    setCurrentRoundIndex(0);
    setCaptions([]);
    setVotes([]);
    setMyCaption('');
    setCumulativeScores({});
    setPhaseStartedAt(null);
    setGameState('upload');
    processedRoundRef.current = -1;
    autoSkipRef.current = '';
  };

  // Meilleure légende de tout le match (toutes légendes/votes cumulés depuis le début de la partie)
  const bestCaptionOfGame = useMemo(() => {
    if (captions.length === 0) return null;
    let best = null;
    captions.forEach((c) => {
      const pts = votes.filter((v) => v.media_id === c.media_id && v.caption_author_id === c.author_id).length;
      if (!best || pts > best.points) best = { ...c, points: pts };
    });
    if (!best || best.points === 0) return null;
    return { ...best, media: medias.find((m) => m.id === best.media_id) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState === 'final_results']);

  const confettiFiredRef = useRef(false);
  useEffect(() => {
    if (gameState === 'final_results' && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      fireConfetti();
    }
    if (gameState !== 'final_results') confettiFiredRef.current = false;
  }, [gameState]);

  // ==========================================
  // CLASSEMENT (panneau latéral)
  // ==========================================
  const renderScoreboard = () => (
    <div className="w-full md:w-64 shrink-0 bg-gray-900 rounded-2xl border border-gray-800 p-4 h-fit">
      <h3 className="flex items-center gap-2 text-gray-400 font-bold mb-1 uppercase text-xs">
        <Trophy size={14} /> Classement
      </h3>
      {roundQueue.length > 0 && (
        <p className="text-xs text-gray-500 mb-3">
          Round {Math.min(currentRoundIndex + 1, roundQueue.length)}/{roundQueue.length}
        </p>
      )}
      <div className="space-y-2">
        {[...players]
          .sort((a, b) => (cumulativeScores[b.id] || 0) - (cumulativeScores[a.id] || 0))
          .map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                p.id === player.id ? 'bg-purple-900/40 border border-purple-600' : 'bg-gray-800'
              }`}
            >
              <span className="font-bold truncate flex items-center gap-1.5">
                <PlayerDot id={p.id} avatar={p.avatar} />
                {i === 0 && (cumulativeScores[p.id] || 0) > 0 && <Crown size={14} className="text-yellow-400" />}
                {p.name}
              </span>
              <span className="font-black text-purple-300">{cumulativeScores[p.id] || 0}</span>
            </div>
          ))}
      </div>
    </div>
  );

  const renderTopBar = () => (
    <div className="flex items-center justify-between mb-3 text-sm">
      <span className="text-gray-500 font-mono">Room {room?.code}</span>
      <button onClick={leaveRoom} className="flex items-center gap-1 text-gray-500 hover:text-red-400 font-bold transition">
        <LogOut size={14} /> Quitter
      </button>
    </div>
  );

  // IMPORTANT : ceci est une fonction ordinaire, pas un composant utilisé via
  // renderGameLayout (fonction, pas composant JSX <GameLayout>). Un composant défini À L'INTÉRIEUR du rendu d'un autre
  // composant change de "type" (nouvelle identité de fonction) à chaque
  // re-render — et comme le chrono déclenche un re-render toutes les
  // secondes, React démontait/remontait tout ce qu'il y avait dedans (y
  // compris l'input fichier) en boucle, ce qui perdait silencieusement la
  // sélection de fichier de l'utilisateur si elle prenait plus d'une seconde.
  const renderGameLayout = (children) => (
    <div className="min-h-screen bg-gray-950/95 text-white relative z-10 flex justify-center p-4">
      <VersionBadge />
      <div className="w-full max-w-5xl flex flex-col md:flex-row gap-4">
        <div className="flex-1 flex flex-col w-full md:max-w-2xl">
          {renderTopBar()}
          {children}
        </div>
        {renderScoreboard()}
      </div>
    </div>
  );

  // ==========================================
  // ÉCRANS
  // ==========================================
  if (gameState === 'home') {
    return (
      <div className="min-h-screen bg-gray-950/95 text-white relative z-10 flex flex-col items-center justify-center p-4">
        <VersionBadge />
        <h1 className="font-heading text-6xl sm:text-7xl font-extrabold mb-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent transform -rotate-2 drop-shadow-sm">
          CAPTION BATTLE
        </h1>
        <p className="text-gray-400 mb-8 font-medium">Le jeu où tes potes ruinent tes images (et vidéos/audios).</p>

        <div className="bg-gray-900 p-8 rounded-2xl w-full max-w-md shadow-2xl border border-gray-800">
          <div className="flex justify-center mb-4">
            <span
              className="w-16 h-16 flex items-center justify-center rounded-full text-3xl"
              style={{ backgroundColor: `${colorForPlayer(player.avatar)}33`, border: `2px solid ${colorForPlayer(player.avatar)}` }}
            >
              {player.avatar}
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mb-5">
            {AVATAR_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setPlayer((p) => ({ ...p, avatar: emoji }))}
                className={`w-9 h-9 flex items-center justify-center rounded-full text-lg transition active:scale-90 ${
                  player.avatar === emoji ? 'bg-purple-600 scale-110' : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Ton Pseudo..."
            value={player.name}
            maxLength={MAX_NAME_LEN}
            autoFocus
            onChange={(e) => setPlayer({ ...player, name: e.target.value })}
            className="w-full p-4 bg-gray-950 border border-gray-700 rounded-lg text-white font-bold text-lg text-center mb-6 focus:border-purple-500 focus:outline-none transition"
          />

          <div className="space-y-4">
            <button
              onClick={createRoom}
              disabled={!player.name.trim()}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition transform hover:scale-[1.02] active:scale-95"
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
        </div>
      </div>
    );
  }

  if (gameState === 'lobby') {
    const settingOptions = {
      captionSeconds: [20, 30, 45, 60, 90],
      voteSeconds: [10, 15, 20, 30],
      mediaPerPlayer: [1, 2, 3],
    };
    return (
      <div className="min-h-screen bg-gray-950/95 text-white relative z-10 flex flex-col items-center justify-center p-4">
        <VersionBadge />
        <div className="bg-gray-900 p-8 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-800 text-center">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-heading text-2xl font-bold">Code de la Room</h2>
            <button onClick={leaveRoom} className="flex items-center gap-1 text-gray-500 hover:text-red-400 text-sm font-bold transition">
              <LogOut size={14} /> Quitter
            </button>
          </div>
          <div className="relative mb-8">
            <div className="text-6xl font-black font-mono tracking-widest text-purple-400 bg-gray-950 py-4 rounded-xl border border-gray-800">
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

          <div className="text-left mb-8">
            <h3 className="flex items-center gap-2 text-gray-400 font-bold mb-4 uppercase text-sm">
              <Users size={18} /> Joueurs dans le lobby ({players.length}/8)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {players.map((p) => (
                <div key={p.id} className="bg-gray-800 py-3 px-4 rounded-lg font-bold flex items-center gap-3">
                  <PlayerDot id={p.id} avatar={p.avatar} />
                  <span className="truncate">{p.name}</span>
                  {p.id === hostId && <span className="text-xs text-purple-400 bg-purple-900/30 px-2 py-1 rounded shrink-0">HOST</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="text-left mb-8 bg-gray-950 border border-gray-800 rounded-xl p-4">
            <h3 className="flex items-center gap-2 text-gray-400 font-bold mb-1 uppercase text-sm">
              <Settings size={16} /> Paramètres de la partie
            </h3>
            {players.length > 0 && (
              <p className="text-xs text-gray-500 mb-3">
                → {players.length * settings.mediaPerPlayer} round{players.length * settings.mediaPerPlayer > 1 ? 's' : ''} au total
              </p>
            )}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <label className="block text-gray-500 mb-1 text-xs">Temps légende</label>
                <select
                  disabled={!isHost}
                  value={settings.captionSeconds}
                  onChange={(e) => updateSettings({ captionSeconds: Number(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60"
                >
                  {settingOptions.captionSeconds.map((s) => (
                    <option key={s} value={s}>{s}s</option>
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
                  {settingOptions.voteSeconds.map((s) => (
                    <option key={s} value={s}>{s}s</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-500 mb-1 text-xs">Memes/joueur</label>
                <select
                  disabled={!isHost}
                  value={settings.mediaPerPlayer}
                  onChange={(e) => updateSettings({ mediaPerPlayer: Number(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60"
                >
                  {settingOptions.mediaPerPlayer.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {isHost ? (
            <button
              onClick={startUploadPhase}
              disabled={players.length < 2}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-black py-4 px-6 rounded-lg text-lg transition shadow-lg shadow-purple-500/20"
            >
              {players.length < 2 ? "En attente d'au moins 2 joueurs..." : 'Lancer le jeu !'}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-3 text-gray-400 animate-pulse">
              <Loader2 className="animate-spin" /> En attente du Host...
            </div>
          )}
        </div>
      </div>
    );
  }

  if (gameState === 'upload') {
    return (
      renderGameLayout(<>
        <div className="bg-gray-900 p-8 rounded-2xl w-full shadow-2xl border border-gray-800 text-center flex-1 flex flex-col justify-center">
          <h2 className="font-heading text-3xl font-bold mb-2">Choisis ton arme</h2>
          <p className="text-gray-400 mb-8">
            Upload {settings.mediaPerPlayer > 1 ? `${settings.mediaPerPlayer} médias` : 'un média'} (image, GIF, vidéo ou audio, {MAX_FILE_MB}Mo max). Chacun sera captionné par les autres !
          </p>

          {USING_FALLBACK_SUPABASE && (
            <div className="mb-4 text-left bg-yellow-950/50 border border-yellow-700 text-yellow-300 text-sm rounded-lg p-4">
              <p className="font-bold mb-1">⚠️ Config Supabase non détectée</p>
              <p>
                Les variables <code>NEXT_PUBLIC_SUPABASE_URL</code> et <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> ne
                semblent pas configurées sur Vercel. Le jeu tourne sur un projet Supabase de démo sans bucket — les
                uploads resteront bloqués. Ajoute-les dans Vercel → Project Settings → Environment Variables, avec
                les valeurs de <em>ton</em> projet Supabase, puis redéploie.
              </p>
            </div>
          )}

          {uploadError && (
            <div className="mb-4 text-left bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-lg p-4">
              <p className="font-bold mb-1">⚠️ {uploadError}</p>
              <button onClick={() => setUploadError(null)} className="text-red-400 hover:text-red-200 underline text-xs">
                Fermer
              </button>
            </div>
          )}

          {uploading ? (
            <Waiting label="Upload vers Supabase en cours..." />
          ) : iUploaded ? (
            <Waiting
              label={`En attente des autres joueurs... (${medias.length} médias reçus)`}
              sub={`Tu as envoyé ${myUploadCount}/${settings.mediaPerPlayer} média(s).`}
              fun
            />
          ) : (
            <div className="space-y-4">
              <label
                onClick={() => pushDebug('label "uploader" cliqué (ouverture sélecteur système attendue)')}
                className="relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-600 hover:border-purple-500 hover:bg-purple-900/10 rounded-xl cursor-pointer transition group"
              >
                <div className="flex gap-4 text-gray-400 group-hover:text-purple-400 mb-3">
                  <ImageIcon size={32} />
                  <Video size={32} />
                  <Music size={32} />
                </div>
                <span className="font-bold">Cliquer pour uploader un fichier ({myUploadCount}/{settings.mediaPerPlayer})</span>
                <span className="text-xs text-gray-500 mt-2">JPG, PNG, GIF, MP4, MP3</span>
                {/* sr-only plutôt que "hidden" (display:none) : certains navigateurs/webviews
                    refusent d'ouvrir le sélecteur système sur un input display:none,
                    que ce soit via clic natif du label ou via .click() en JS. */}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  accept="image/*,video/mp4,audio/*"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          )}

          {isHost && !uploading && (
            <button
              onClick={launchGame}
              disabled={!everyoneUploaded}
              className="mt-6 w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black py-4 px-6 rounded-lg text-lg transition active:scale-95"
            >
              {everyoneUploaded ? `Lancer les ${medias.length} rounds !` : `En attente des uploads (${medias.length}/${players.length * settings.mediaPerPlayer})`}
            </button>
          )}
        </div>
      </>)
    );
  }

  if (gameState === 'caption') {
    if (!currentMedia) {
      return (
        renderGameLayout(<>
          <Waiting label="Préparation du round..." />
        </>)
      );
    }
    return (
      renderGameLayout(<>
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-heading text-2xl font-bold text-purple-400">
            Round {currentRoundIndex + 1}/{roundQueue.length}
          </h2>
          <CountdownBadge seconds={secondsLeftFor(settings.captionSeconds)} />
        </div>

        {isMyMedia ? (
          <Waiting
            label="C'est ton meme ! Les autres légendent..."
            sub={`${captionsForRound.length}/${expectedCaptioners} légendes reçues.`}
            fun
          />
        ) : iSubmittedCaption ? (
          <Waiting
            label={`En attente des autres joueurs... (${captionsForRound.length}/${expectedCaptioners})`}
            sub="Ta légende a bien été envoyée."
            fun
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-gray-400 mb-3 text-sm flex items-center gap-1.5">
              Média envoyé par <PlayerDot id={currentMedia.owner_id} avatar={currentMedia.owner_avatar} />
              <span className="text-purple-400 font-bold">{currentMedia.owner_name}</span>
            </p>
            <div className="w-full bg-gray-900 p-4 rounded-2xl border border-gray-800 mb-6 shadow-2xl">
              <MediaWithDownload media={currentMedia} onDownload={downloadMedia} />
            </div>

            <div className="w-full relative">
              <input
                type="text"
                placeholder="Écris la meilleure légende possible..."
                value={myCaption}
                maxLength={MAX_CAPTION_LEN}
                autoFocus
                onChange={(e) => setMyCaption(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitCaption()}
                className="w-full p-5 pl-6 pr-16 bg-gray-800 border-2 border-gray-700 rounded-xl text-white font-bold text-lg focus:border-purple-500 focus:outline-none transition shadow-lg"
              />
              <button
                onClick={submitCaption}
                disabled={!myCaption.trim()}
                className="absolute right-3 top-3 bottom-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-lg px-4 flex items-center justify-center transition active:scale-95"
              >
                <Send size={20} />
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2 self-end">{myCaption.length}/{MAX_CAPTION_LEN}</p>
          </div>
        )}

        {isHost && (
          <button
            onClick={() => goToState('vote', { phaseStartedAt: Date.now() })}
            className="mt-6 w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-300 text-sm font-bold py-2 transition"
          >
            <SkipForward size={16} /> Passer au vote quand même
          </button>
        )}
      </>)
    );
  }

  if (gameState === 'vote') {
    if (!currentMedia) {
      return (
        renderGameLayout(<>
          <Waiting label="Chargement du vote..." />
        </>)
      );
    }
    const canIVote = captionsForRound.some((c) => c.author_id !== player.id);
    const useMemeCards = isImageMedia(currentMedia);
    const boundedSlide = voteCardCount ? Math.min(voteSlide, voteCardCount - 1) : 0;
    const activeCaption = shuffledCaptionsForRound[boundedSlide];

    return (
      renderGameLayout(<>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-heading text-2xl font-bold text-purple-400">Vote — Round {currentRoundIndex + 1}/{roundQueue.length}</h2>
          <CountdownBadge seconds={secondsLeftFor(settings.voteSeconds)} />
        </div>

        {!useMemeCards && (
          <div className="w-full bg-gray-900 p-4 rounded-2xl border border-gray-800 mb-4 shadow-2xl">
            <MediaWithDownload media={currentMedia} onDownload={downloadMedia} />
          </div>
        )}

        {!canIVote ? (
          <Waiting label="Aucune légende à voter pour toi ce round." sub="En attente des autres..." />
        ) : (
          <>
            <div className="flex items-center justify-between mb-3 text-sm">
              <span className="text-gray-500 font-mono">{boundedSlide + 1}/{voteCardCount}</span>
              {myVoteForRound ? (
                <span className="text-gray-500">
                  Vote enregistré — en attente des autres ({votesForRound.length}/{eligibleVoters.length})
                </span>
              ) : (
                <span className="text-gray-600 text-xs hidden sm:inline">← → pour naviguer, Entrée pour voter</span>
              )}
            </div>

            {activeCaption && (
              <Carousel index={boundedSlide} count={voteCardCount} onPrev={goPrevSlide} onNext={goNextSlide} onJump={setVoteSlide}>
                {(() => {
                  const isMine = activeCaption.author_id === player.id;
                  const isSelected = myVoteForRound?.caption_author_id === activeCaption.author_id;
                  const disabled = isMine || !!myVoteForRound;
                  return useMemeCards ? (
                    <MemeVoteCard
                      media={currentMedia}
                      caption={activeCaption.text}
                      isMine={isMine}
                      isSelected={isSelected}
                      disabled={disabled}
                      onVote={() => castVote(activeCaption.author_id)}
                      onDownloadStyle={(style) => downloadComposedMeme(currentMedia, activeCaption.text, style)}
                    />
                  ) : (
                    <CaptionChoiceCard
                      caption={activeCaption.text}
                      isMine={isMine}
                      isSelected={isSelected}
                      disabled={disabled}
                      onVote={() => castVote(activeCaption.author_id)}
                    />
                  );
                })()}
              </Carousel>
            )}
          </>
        )}

        {isHost && (
          <button
            onClick={() => goToState('round_result', { phaseStartedAt: Date.now() })}
            className="mt-6 w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-300 text-sm font-bold py-2 transition"
          >
            <SkipForward size={16} /> Passer aux résultats quand même
          </button>
        )}
      </>)
    );
  }

  if (gameState === 'round_result') {
    return (
      renderGameLayout(<>
        <div className="flex flex-col items-center text-center">
          <Trophy size={48} className="text-yellow-400 mb-4" />
          <h2 className="font-heading text-2xl font-bold mb-1">Résultats — Round {currentRoundIndex + 1}/{roundQueue.length}</h2>
          {currentMedia && (
            <div className="w-full bg-gray-900 p-4 rounded-2xl border border-gray-800 my-4 shadow-2xl">
              <MediaWithDownload media={currentMedia} onDownload={downloadMedia} />
            </div>
          )}
          <div className="w-full space-y-2 mb-6">
            {captionsForRound
              .map((c) => ({ ...c, points: votesForRound.filter((v) => v.caption_author_id === c.author_id).length }))
              .sort((a, b) => b.points - a.points)
              .map((c) => (
                <div key={c.author_id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3 gap-3">
                  <div className="text-left min-w-0">
                    <p className="font-bold truncate">"{c.text}"</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <PlayerDot id={c.author_id} avatar={c.author_avatar} /> par {c.author_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {currentMedia && isImageMedia(currentMedia) && (
                      <button
                        onClick={() => downloadComposedMeme(currentMedia, c.text, 'bottom-gradient')}
                        title="Télécharger avec la légende incrustée"
                        className="text-gray-500 hover:text-white transition p-1.5"
                      >
                        <Download size={16} />
                      </button>
                    )}
                    <span className="font-black text-purple-300">+{c.points}</span>
                  </div>
                </div>
              ))}
            {captionsForRound.length === 0 && <p className="text-gray-500 text-sm">Aucune légende n'a été soumise ce round.</p>}
          </div>

          {isHost ? (
            <button onClick={nextRound} className="bg-purple-600 hover:bg-purple-500 font-bold py-3 px-8 rounded-full">
              {hasNextRound ? 'Round suivant' : 'Voir le classement final'}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-3 text-gray-400 animate-pulse">
              <Loader2 className="animate-spin" /> En attente du Host...
            </div>
          )}
        </div>
      </>)
    );
  }

  // gameState === 'final_results'
  const finalRanking = [...players].sort((a, b) => (cumulativeScores[b.id] || 0) - (cumulativeScores[a.id] || 0));
  const podium = [finalRanking[1], finalRanking[0], finalRanking[2]]; // 2e, 1er, 3e — ordre visuel du podium
  const rest = finalRanking.slice(3);

  return (
    <div className="min-h-screen bg-gray-950/95 text-white relative z-10 flex flex-col items-center justify-center p-4 overflow-hidden">
      <VersionBadge />
      <Trophy size={56} className="text-yellow-400 mb-3 animate-bounce" />
      <h2 className="font-heading text-4xl font-bold mb-8">Classement final !</h2>

      {finalRanking.length > 0 && (
        <div className="flex items-end justify-center gap-3 sm:gap-5 mb-8 w-full max-w-lg">
          {podium.map((p, slot) => {
            if (!p) return <div key={slot} className="flex-1" />;
            const place = slot === 1 ? 1 : slot === 0 ? 2 : 3;
            const heights = { 1: 'h-40', 2: 'h-28', 3: 'h-20' };
            const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
            return (
              <div key={p.id} className="flex-1 flex flex-col items-center">
                <span className="text-3xl mb-1">{medals[place]}</span>
                <span className="text-2xl mb-1">{p.avatar || '🙂'}</span>
                <span className="font-bold text-sm truncate max-w-full">{p.name}</span>
                <span className="font-heading font-bold text-purple-300 text-lg mb-2">{cumulativeScores[p.id] || 0} pts</span>
                <div
                  className={`w-full ${heights[place]} rounded-t-xl border-t-2 border-x-2 border-purple-500/50 flex items-start justify-center pt-2 font-heading font-bold text-2xl`}
                  style={{ background: `linear-gradient(to top, ${colorForPlayer(p.id)}55, ${colorForPlayer(p.id)}15)` }}
                >
                  {place}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rest.length > 0 && (
        <div className="bg-gray-900 p-4 rounded-2xl w-full max-w-md shadow-xl border border-gray-800 mb-6 space-y-2">
          {rest.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-mono text-sm w-5">{i + 4}.</span>
                <PlayerDot id={p.id} avatar={p.avatar} />
                <span className="font-bold">{p.name}</span>
              </div>
              <div className="font-black text-purple-300">{cumulativeScores[p.id] || 0} pts</div>
            </div>
          ))}
        </div>
      )}

      {bestCaptionOfGame && (
        <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 border border-purple-700 rounded-2xl p-4 w-full max-w-md mb-8 flex items-center gap-4">
          {bestCaptionOfGame.media && isImageMedia(bestCaptionOfGame.media) && (
            <img src={bestCaptionOfGame.media.url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-purple-300 uppercase tracking-wide mb-1">🏆 Punchline légendaire du match</p>
            <p className="font-bold truncate">"{bestCaptionOfGame.text}"</p>
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
              <PlayerDot id={bestCaptionOfGame.author_id} avatar={bestCaptionOfGame.author_avatar} /> {bestCaptionOfGame.author_name} · {bestCaptionOfGame.points} vote{bestCaptionOfGame.points > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        {isHost ? (
          <button onClick={newGame} className="bg-purple-600 hover:bg-purple-500 active:scale-95 font-bold py-3 px-8 rounded-full transition">
            Nouvelle partie
          </button>
        ) : (
          <div className="flex items-center justify-center gap-3 text-gray-400 animate-pulse">
            <Loader2 className="animate-spin" /> En attente du Host...
          </div>
        )}
        <button onClick={leaveRoom} className="flex items-center gap-2 text-gray-500 hover:text-red-400 active:scale-95 font-bold py-3 px-6 transition">
          <LogOut size={16} /> Quitter
        </button>
      </div>
    </div>
  );
}
