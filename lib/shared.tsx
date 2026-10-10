// Briques communes aux jeux (Caption Battle, Imposteur...) : connexion Supabase,
// sons, couleurs/avatars des joueurs, barre des jeux, petits composants.
'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Loader2, Volume2, VolumeX, LogIn, LogOut, MessageCircle, Send, X, Globe, Lock, Users, Copy, Check } from 'lucide-react';
import { dateline } from '@/lib/press';
import { GameIcon } from '@/lib/art';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hidtcsztkjpqngwlrzqy.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_CREIog57Ep_e7sUZ0rx-VA_8ooqaGTJ';
// La session Discord est gardée dans le localStorage et renouvelée automatiquement :
// on reste connecté d'une visite à l'autre, tant qu'on ne se déconnecte pas.
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'makeitmeme-auth',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});
// Si les variables d'env ne sont pas configurées sur Vercel, on tourne sur un
// projet Supabase de démo qui n'a ni bucket ni base : tout upload y restera bloqué.
const USING_FALLBACK_SUPABASE = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const withTimeout = (promise, ms, message) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);

const makeId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 11)}`;

// Petite pluie de confettis vanilla (canvas), sans dépendance externe.
const fireConfetti = ({ count = 140, duration = 3200 } = {}) => {
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
  const ctx = canvas.getContext('2d');
  if (!ctx) return; // canvas indisponible : pas de confettis, mais pas d'erreur
  document.body.appendChild(canvas);

  const colors = ['#d6a948', '#43bfaa', '#f97316', '#eab308', '#7fb069', '#e3c27a', '#2aa897'];
  const pieces = Array.from({ length: count }, () => ({
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

const PLAYER_COLORS = ['#d6a948', '#43bfaa', '#f97316', '#9bc87a', '#e0705f', '#6aa6d6', '#c58ad6', '#e3c27a'];
const colorForPlayer = (id) => {
  if (!id) return PLAYER_COLORS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PLAYER_COLORS[hash % PLAYER_COLORS.length];
};
const AVATAR_EMOJIS = ['😂', '🔥', '👻', '🐸', '🦄', '🍕', '🎃', '🐙', '🤡', '👽', '🦖', '🍔', '🐵', '💀', '🥸', '🦊'];
const randomAvatar = () => AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];

const isImageAvatar = (avatar) => typeof avatar === 'string' && /^https:\/\/cdn\.discordapp\.com\//.test(avatar);

// Affiche un avatar : l'emoji tel quel, ou la photo Discord qui remplit son conteneur.
const AvatarGlyph = ({ avatar, fallback = '🙂' }) =>
  isImageAvatar(avatar) ? (
    <img src={avatar} alt="" referrerPolicy="no-referrer" className="w-full h-full rounded-full object-cover" />
  ) : (
    <>{avatar || fallback}</>
  );

const PlayerDot = ({ id, avatar, size = 'sm' }) => {
  const dims = size === 'lg' ? 'w-9 h-9 text-lg' : size === 'md' ? 'w-6 h-6 text-xs' : 'w-4 h-4 text-[10px]';
  if (avatar) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full shrink-0 ${dims}`}
        style={{ backgroundColor: `${colorForPlayer(id)}33`, border: `1.5px solid ${colorForPlayer(id)}` }}
      >
        <AvatarGlyph avatar={avatar} />
      </span>
    );
  }
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorForPlayer(id) }} />;
};

let audioCtx = null;
let sfxEnabled = true;
let sfxSuspended = false; // coupé temporairement (ex. génération d'une vidéo)
const setSfxEnabled = (v) => {
  sfxEnabled = v;
};
const setSfxSuspended = (v) => {
  sfxSuspended = v;
};
const playingMedia = new Set(); // vidéos/audios des memes actuellement en lecture

// Vrai tant qu'un meme (vidéo/audio) est en train de jouer. Les éléments retirés
// de la page ou en pause sont oubliés automatiquement.
const isMediaPlaying = () => {
  playingMedia.forEach((el) => {
    if (!el.isConnected || el.paused || el.ended) playingMedia.delete(el);
  });
  return playingMedia.size > 0;
};

const getAudioCtx = () => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
};

const tone = (ctx, { freq, start = 0, dur = 0.12, type = 'sine', gain = 0.07, slideTo = null }) => {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const t0 = ctx.currentTime + start;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
};

const SFX_LIBRARY = {
  click: (c) => tone(c, { freq: 700, slideTo: 500, dur: 0.05, type: 'triangle', gain: 0.035 }),
  join: (c) => {
    tone(c, { freq: 523, dur: 0.12 });
    tone(c, { freq: 784, start: 0.1, dur: 0.18 });
  },
  leave: (c) => {
    tone(c, { freq: 500, dur: 0.12, gain: 0.06 });
    tone(c, { freq: 330, start: 0.1, dur: 0.2, gain: 0.06 });
  },
  success: (c) => {
    tone(c, { freq: 660, dur: 0.1 });
    tone(c, { freq: 880, start: 0.09, dur: 0.1 });
    tone(c, { freq: 1175, start: 0.18, dur: 0.18 });
  },
  error: (c) => {
    tone(c, { freq: 220, dur: 0.16, type: 'square', gain: 0.05 });
    tone(c, { freq: 165, start: 0.14, dur: 0.24, type: 'square', gain: 0.05 });
  },
  send: (c) => tone(c, { freq: 420, slideTo: 900, dur: 0.14, gain: 0.08 }),
  vote: (c) => {
    tone(c, { freq: 587, dur: 0.08, gain: 0.08 });
    tone(c, { freq: 880, start: 0.07, dur: 0.16, gain: 0.08 });
  },
  whoosh: (c) => tone(c, { freq: 260, slideTo: 820, dur: 0.2, type: 'sawtooth', gain: 0.03 }),
  tick: (c) => tone(c, { freq: 1000, dur: 0.05, type: 'square', gain: 0.03 }),
  buzzer: (c) => tone(c, { freq: 140, slideTo: 100, dur: 0.45, type: 'sawtooth', gain: 0.06 }),
  roundStart: (c) => {
    [392, 523, 659].forEach((f, i) => tone(c, { freq: f, start: i * 0.08, dur: 0.14, type: 'triangle' }));
  },
  voteStart: (c) => {
    tone(c, { freq: 440, dur: 0.1, type: 'triangle' });
    tone(c, { freq: 440, start: 0.14, dur: 0.1, type: 'triangle' });
    tone(c, { freq: 660, start: 0.28, dur: 0.2, type: 'triangle' });
  },
  reveal: (c) => {
    [523, 659, 784, 1047].forEach((f, i) => tone(c, { freq: f, start: i * 0.07, dur: 0.16 }));
  },
  // Coup de feu : claquement de bruit blanc + grosse basse qui s'effondre
  gunshot: (c) => {
    const len = Math.floor(c.sampleRate * 0.25);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = c.createBufferSource();
    const g = c.createGain();
    g.gain.value = 0.35;
    src.buffer = buf;
    src.connect(g);
    g.connect(c.destination);
    src.start();
    tone(c, { freq: 150, slideTo: 40, dur: 0.25, type: 'sine', gain: 0.25 });
  },
  fanfare: (c) => {
    [523, 659, 784, 1047].forEach((f, i) => tone(c, { freq: f, start: i * 0.12, dur: 0.22, type: 'triangle', gain: 0.09 }));
    tone(c, { freq: 1047, start: 0.5, dur: 0.6, type: 'triangle', gain: 0.09 });
    tone(c, { freq: 784, start: 0.5, dur: 0.6, type: 'triangle', gain: 0.06 });
  },
};

// Joue un effet, sauf si les sons sont coupés ou si un meme est en train de jouer.
const playSfx = (name) => {
  if (!sfxEnabled || sfxSuspended || isMediaPlaying()) return;
  try {
    const ctx = getAudioCtx();
    if (ctx && SFX_LIBRARY[name]) SFX_LIBRARY[name](ctx);
  } catch {
    // audio indisponible : on ignore silencieusement
  }
};

const SoundToggle = ({ on, onToggle, className = '' }) => (
  <button
    type="button"
    data-sfx="off"
    onClick={onToggle}
    title={on ? 'Couper les effets sonores' : 'Activer les effets sonores'}
    aria-label={on ? 'Couper les effets sonores' : 'Activer les effets sonores'}
    className={`text-gray-500 hover:text-white transition active:scale-90 ${className}`}
  >
    {on ? <Volume2 size={16} /> : <VolumeX size={16} />}
  </button>
);

// ==========================================
// BARRE DES JEUX (rail latéral façon Discord)
// ==========================================
// Pour ajouter un jeu : une ligne dans GAMES.
//  - status 'live' : jouable. Mettre "href" pour y naviguer une fois qu'il existe.
//  - status 'soon' : grisé, affiché "Bientôt" (les noms ci-dessous sont des exemples).
const GAMES = [
  { id: 'home', name: 'Accueil', emoji: '🏠', status: 'live', href: '/', gradient: 'from-purple-600 to-purple-400' },
  { id: 'caption-battle', name: 'Caption Battle', emoji: '😂', status: 'live', href: '/caption-battle', gradient: 'from-purple-500 via-pink-500 to-orange-400' },
  { id: 'imposteur', name: 'Imposteur', emoji: '🕵️', status: 'live', href: '/imposteur', gradient: 'from-red-500 via-orange-500 to-yellow-400' },
  { id: 'bomb-party', name: 'Bomb Party', emoji: '💣', status: 'live', href: '/bomb-party', gradient: 'from-orange-500 via-amber-500 to-yellow-400' },
  { id: 'pictionary', name: 'Pictionary', emoji: '🎨', status: 'live', href: '/pictionary', gradient: 'from-teal-500 via-purple-500 to-orange-400' },
  { id: 'blind-test', name: 'Blind Test', emoji: '🎧', status: 'live', href: '/blind-test', gradient: 'from-orange-500 via-purple-500 to-teal-400' },
];

const GamesRail = ({ currentId }) => (
  <nav
    aria-label="Jeux"
    className="fixed z-30 top-0 left-0 right-0 h-12 px-3 flex flex-row items-center gap-2 bg-gray-900/95 border-b border-purple-500/20 overflow-x-auto md:overflow-visible md:top-3 md:bottom-3 md:left-3 md:right-auto md:h-auto md:w-16 md:flex-col md:px-0 md:py-3 md:gap-3 md:rounded-2xl md:border md:shadow-xl md:shadow-black/40"
  >
    {GAMES.map((g, i) => {
      const isCurrent = g.id === currentId;
      const tileClass = `w-10 h-10 md:w-11 md:h-11 flex items-center justify-center text-xl transition-all duration-200 ${
        isCurrent
          ? `bg-gradient-to-br ${g.gradient} rounded-xl shadow-lg shadow-black/50`
          : 'rounded-2xl bg-gray-800 hover:bg-purple-600 hover:rounded-xl active:scale-95'
      }`;
      return (
        <React.Fragment key={g.id}>
          <div className="group relative shrink-0 flex items-center justify-center">
            {isCurrent && (
              <span className="hidden md:block absolute md:-left-[10px] top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-purple-300" />
            )}
            {isCurrent ? (
              <button type="button" aria-label={g.name} aria-current="page" className={tileClass}>
                <GameIcon id={g.id} className="w-8 h-8" />
              </button>
            ) : (
              <a href={g.href} aria-label={g.name} className={tileClass}>
                <GameIcon id={g.id} className="w-8 h-8" />
              </a>
            )}
            <span
              role="tooltip"
              className="hidden md:block pointer-events-none absolute left-full ml-4 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-950 border border-purple-500/60 px-3 py-1.5 text-xs font-bold text-purple-200 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-xl"
            >
              {g.name}
            </span>
          </div>
          {i === 0 && <span className="shrink-0 w-px h-6 md:w-7 md:h-px bg-purple-500/30" />}
        </React.Fragment>
      );
    })}
  </nav>
);

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

const ToggleRow = ({ label, hint, checked, disabled, onChange }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="min-w-0">
      <p className="text-gray-300">{label}</p>
      {hint && <p className="text-[11px] text-gray-600">{hint}</p>}
    </div>
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`relative shrink-0 w-11 h-6 rounded-full transition disabled:opacity-50 ${checked ? 'bg-purple-600' : 'bg-gray-700'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`}
      />
    </button>
  </div>
);

const CountdownBadge = ({ seconds }) => (
  <div
    className={`bg-gray-900 px-4 py-2 rounded-full font-bold font-mono border transition-transform ${
      seconds <= 5 && seconds > 0 ? 'border-red-500 text-red-400 animate-pulse scale-110' : 'border-gray-800'
    }`}
  >
    {seconds > 0 ? `⏳ ${seconds}s` : '⏰ Terminé'}
  </div>
);

// Session du joueur (par onglet) : permet de garder le même identifiant après un
// rafraîchissement, donc de retrouver ses points et sa place dans la room.
const makeSessionStore = (key) => ({
  read: () => {
    try {
      return JSON.parse(sessionStorage.getItem(key) || 'null');
    } catch {
      return null;
    }
  },
  write: (data) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(data));
    } catch {
      // stockage indisponible : on continue sans persistance
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
});

// Pseudo/avatar mémorisés (localStorage), partagés entre les jeux.
const IDENTITY_KEY = 'caption-battle-identity';
const MAX_NAME_LEN = 20;
const readIdentity = () => {
  try {
    return JSON.parse(localStorage.getItem(IDENTITY_KEY) || 'null');
  } catch {
    return null;
  }
};
const writeIdentity = (name, avatar) => {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify({ name, avatar }));
  } catch {
    // stockage indisponible
  }
};

// Effets sonores : état on/off mémorisé, son des boutons, déblocage de l'audio
// par le premier geste, onde au clic.
const useSoundAndClickFx = () => {
  const [soundOn, setSoundOn] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem('caption-battle-sfx') === 'off') setSoundOn(false);
    } catch {
      // stockage indisponible
    }
  }, []);
  useEffect(() => {
    setSfxEnabled(soundOn);
    try {
      localStorage.setItem('caption-battle-sfx', soundOn ? 'on' : 'off');
    } catch {
      // stockage indisponible
    }
  }, [soundOn]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    if (next) {
      setSfxEnabled(true);
      playSfx('success');
    }
  };

  // Petite onde au clic (purement décorative, ignore les clics au clavier)
  useEffect(() => {
    const onClick = (e) => {
      if (!e.detail || typeof e.clientX !== 'number') return;
      const ripple = document.createElement('span');
      ripple.className = 'click-ripple';
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 650);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // Les navigateurs exigent un geste de l'utilisateur avant de laisser jouer du son
  useEffect(() => {
    const unlock = () => getAudioCtx();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Petit clic sur tous les boutons (sauf ceux qui ont leur propre son : data-sfx="off")
  useEffect(() => {
    const onClick = (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!btn || btn.disabled || btn.dataset.sfx === 'off') return;
      playSfx('click');
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return { soundOn, toggleSound };
};

// Connexion (optionnelle) avec Discord via Supabase Auth. Le compte sert à
// préremplir le pseudo et à garder le même identifiant de joueur d'une partie à l'autre.
const useDiscordAuth = (onProfile, onSignedOut) => {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const onProfileRef = React.useRef(onProfile);
  onProfileRef.current = onProfile;
  const onSignedOutRef = React.useRef(onSignedOut);
  onSignedOutRef.current = onSignedOut;
  const announcedRef = React.useRef(null);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setUser(data.session?.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const profile = React.useMemo(() => {
    if (!user) return null;
    const meta = user.user_metadata || {};
    const name = meta.custom_claims?.global_name || meta.full_name || meta.name || meta.user_name || 'Joueur Discord';
    return { id: `u_${user.id}`, name: String(name).slice(0, MAX_NAME_LEN), avatarUrl: meta.avatar_url || null };
  }, [user]);

  // Une seule fois par compte : le pseudo Discord remplace celui du champ (modifiable ensuite)
  useEffect(() => {
    if (!profile || announcedRef.current === profile.id) return;
    announcedRef.current = profile.id;
    if (onProfileRef.current) onProfileRef.current(profile);
  }, [profile]);

  // Pas (ou plus) connecté : une éventuelle photo Discord mémorisée repasse en emoji
  useEffect(() => {
    if (ready && !profile && onSignedOutRef.current) onSignedOutRef.current();
  }, [ready, profile]);

  const signIn = async () => {
    const redirectTo = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo } });
    return error ? error.message : null;
  };
  const signOut = async () => {
    announcedRef.current = null;
    await supabase.auth.signOut();
  };

  return { ready, profile, signIn, signOut };
};

// Pastille ronde du sélecteur d'avatar : la photo Discord (si connecté) puis les emojis.
const AvatarPicker = ({ auth, avatar, onPick, activeClass }) => (
  <div className="flex flex-wrap justify-center gap-2 mb-5">
    {auth.profile?.avatarUrl && isImageAvatar(auth.profile.avatarUrl) && (
      <button
        type="button"
        title="Ma photo Discord"
        aria-label="Ma photo Discord"
        onClick={() => onPick(auth.profile.avatarUrl)}
        className={`w-9 h-9 rounded-full overflow-hidden transition active:scale-90 ${
          avatar === auth.profile.avatarUrl ? `${activeClass} scale-110` : 'bg-gray-800 hover:bg-gray-700'
        }`}
      >
        <AvatarGlyph avatar={auth.profile.avatarUrl} />
      </button>
    )}
    {AVATAR_EMOJIS.map((emoji) => (
      <button
        key={emoji}
        type="button"
        onClick={() => onPick(emoji)}
        className={`w-9 h-9 flex items-center justify-center rounded-full text-lg transition active:scale-90 ${
          avatar === emoji ? `${activeClass} scale-110` : 'bg-gray-800 hover:bg-gray-700'
        }`}
      >
        {emoji}
      </button>
    ))}
  </div>
);

const AccountButton = ({ auth, className = 'mb-4' }) => {
  const [error, setError] = useState(null);
  if (!auth.ready) return <div className={`h-11 ${className}`} />;
  if (auth.profile) {
    return (
      <div className={`flex items-center justify-between gap-3 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 ${className}`}>
        <span className="flex items-center gap-2 min-w-0">
          {auth.profile.avatarUrl && (
            <img src={auth.profile.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-7 h-7 rounded-full shrink-0" />
          )}
          <span className="text-sm font-bold truncate">{auth.profile.name}</span>
          <span className="text-[10px] font-bold text-[#8c95ff] bg-[#5865F2]/20 px-1.5 py-0.5 rounded shrink-0">Discord</span>
        </span>
        <button
          type="button"
          onClick={auth.signOut}
          title="Se déconnecter"
          aria-label="Se déconnecter"
          className="text-gray-500 hover:text-red-400 transition active:scale-90 shrink-0"
        >
          <LogOut size={16} />
        </button>
      </div>
    );
  }
  return (
    <div className={className}>
      <button type="button" onClick={async () => setError(await auth.signIn())} className="btn-discord group">
        <DiscordMark className="w-6 h-6 shrink-0" />
        <span className="flex flex-col items-start text-left leading-tight min-w-0">
          <span className="font-bold text-sm">Se connecter avec Discord</span>
          <span className="text-[10px] font-normal text-gray-400 normal-case">Optionnel · garde ton pseudo et ta photo</span>
        </span>
        <LogIn size={15} className="ml-auto shrink-0 text-gray-400 group-hover:text-white transition" />
      </button>
      {error && <p className="text-xs text-red-400 mt-2">Connexion Discord impossible : {error}</p>}
    </div>
  );
};

// Petit logo façon "Clyde" (manette Discord), dessiné à la main
const DiscordMark = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M5 6.5C6.6 5.3 8.4 4.6 10.2 4.4l.5 1.1a12 12 0 0 1 2.6 0l.5-1.1c1.8.2 3.6.9 5.2 2.1 1.7 2.7 2.5 5.6 2.3 9.1-1.5 1.1-3.100 1.800-4.800 2.200l-1-1.600c.5-.2 1-.4 1.400-.7-.1-.1-.3-.2-.4-.3a9 9 0 0 1-7.600 0c-.1.100-.3.200-.4.300.4.300.9.500 1.400.700l-1 1.600c-1.700-.4-3.300-1.100-4.800-2.200C2.500 12.100 3.300 9.200 5 6.500Z" fill="#8c95ff" />
    <ellipse cx="9" cy="12.300" rx="1.600" ry="1.900" fill="#0b1114" />
    <ellipse cx="15" cy="12.300" rx="1.600" ry="1.900" fill="#0b1114" />
  </svg>
);

// État + ref mise à jour en même temps : les listeners du channel (posés une seule
// fois) et les enchaînements immédiats lisent toujours la valeur la plus fraîche.
const useRefState = (initial) => {
  const [value, setValue] = useState(initial);
  const ref = React.useRef(initial);
  const set = (updater) => {
    const next = typeof updater === 'function' ? updater(ref.current) : updater;
    ref.current = next;
    setValue(next);
  };
  return [value, set, ref];
};

// ==========================================
// NOTIFICATIONS (toast) — `toast('message')` depuis n'importe où, <ToastHost /> monté une fois dans le layout
// ==========================================
const toastSubscribers = new Set();
const toast = (message) => toastSubscribers.forEach((fn) => fn(message));

const ToastHost = () => {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const onToast = (message) => {
      const id = Math.random().toString(36).slice(2);
      setItems((prev) => [...prev, { id, message }]);
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4500);
    };
    toastSubscribers.add(onToast);
    return () => {
      toastSubscribers.delete(onToast);
    };
  }, []);
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[990] flex flex-col items-center gap-2 pointer-events-none">
      {items.map((t) => (
        <div key={t.id} className="animate-fadein bg-gray-800 border border-gray-950 shadow-[0_0_0_2px_#b98a35,0_0_0_3px_#1a0f08,0_10px_24px_rgba(0,0,0,0.6)] text-white text-sm font-bold rounded-full px-5 py-2.5">
          {t.message}
        </div>
      ))}
    </div>
  );
};

// ==========================================
// SALONS : visibilité, nom, annuaire des salons ouverts
// ==========================================
const ROOM_NAME_MAX = 30;
const DIRECTORY_CHANNEL = 'directory';

// Les salons ouverts s'annoncent dans un channel de présence commun : quand le host
// part (ou ferme l'onglet), l'annonce disparaît toute seule — aucune base de données.
const useRoomDirectory = ({ enabled, game, code, roomName, hostName, hostAvatar, count, started }) => {
  const chRef = React.useRef(null);
  const readyRef = React.useRef(false);
  const dataRef = React.useRef(null);
  dataRef.current = {
    game,
    code,
    name: (roomName || '').trim().slice(0, ROOM_NAME_MAX) || `Salon de ${hostName}`,
    host: hostName,
    hostAvatar,
    count,
    started: !!started,
  };

  useEffect(() => {
    if (!enabled || !code) return;
    const channel = supabase.channel(DIRECTORY_CHANNEL, { config: { presence: { key: code } } });
    chRef.current = channel;
    readyRef.current = false;
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        readyRef.current = true;
        channel.track(dataRef.current);
      }
    });
    return () => {
      readyRef.current = false;
      chRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [enabled, code]);

  useEffect(() => {
    if (enabled && readyRef.current && chRef.current) chRef.current.track(dataRef.current);
  }, [enabled, game, code, roomName, hostName, hostAvatar, count, started]);
};

// Pour la page d'accueil : écoute l'annuaire (sans s'y inscrire)
const useDirectoryListing = () => {
  const [rooms, setRooms] = useState([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const channel = supabase.channel(DIRECTORY_CHANNEL);
    channel.on('presence', { event: 'sync' }, () => {
      const list = [];
      Object.entries(channel.presenceState()).forEach(([key, metas]) => {
        const m = (metas as any[])[(metas as any[]).length - 1];
        if (!m || !m.code || !m.game) return;
        list.push({
          code: String(m.code),
          game: String(m.game),
          name: String(m.name || '').slice(0, ROOM_NAME_MAX),
          host: String(m.host || '').slice(0, MAX_NAME_LEN),
          hostAvatar: m.hostAvatar,
          count: Number(m.count) || 0,
          started: !!m.started,
        });
      });
      list.sort((a, b) => Number(a.started) - Number(b.started) || b.count - a.count);
      setRooms(list);
      setReady(true);
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  return { rooms, ready };
};

// Choix du type de salon avant la création (accueil des jeux)
const VisibilityPicker = ({ value, onChange }) => (
  <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
    {[
      { id: 'private', icon: <Lock size={14} />, label: 'Fermé', hint: 'Avec un code' },
      { id: 'public', icon: <Globe size={14} />, label: 'Ouvert', hint: 'Dans la liste' },
    ].map((o) => (
      <button
        key={o.id}
        type="button"
        onClick={() => onChange(o.id)}
        className={`rounded-lg border-2 px-3 py-2 text-left transition active:scale-95 ${
          value === o.id ? 'border-purple-400 bg-purple-900/40' : 'border-gray-700 bg-gray-950 hover:border-gray-500'
        }`}
      >
        <span className="flex items-center gap-1.5 font-bold">{o.icon} {o.label}</span>
        <span className="block text-[11px] text-gray-500">{o.hint}</span>
      </button>
    ))}
  </div>
);

// Réglages communs d'un salon, dans le lobby : visibilité, nom, chat
const RoomOptions = ({ settings, updateSettings, isHost }) => (
  <div className="mb-4 pb-4 border-b border-gray-800 space-y-3 text-sm">
    <div>
      <label className="block text-gray-500 mb-1 text-xs">Type de salon</label>
      <div className="grid grid-cols-2 gap-2">
        {[
          { id: 'private', icon: <Lock size={14} />, label: 'Fermé (code)' },
          { id: 'public', icon: <Globe size={14} />, label: 'Ouvert (liste)' },
        ].map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={!isHost}
            onClick={() => updateSettings({ visibility: o.id })}
            className={`flex items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2 font-bold transition active:scale-95 disabled:opacity-60 ${
              settings.visibility === o.id ? 'border-purple-400 bg-purple-900/40' : 'border-gray-700 bg-gray-900'
            }`}
          >
            {o.icon} {o.label}
          </button>
        ))}
      </div>
      {settings.visibility === 'public' && (
        <p className="text-[11px] text-purple-300 mt-1.5">🌍 Ton salon est visible par tout le monde sur la page d'accueil.</p>
      )}
    </div>
    {settings.visibility === 'public' && (
      <div>
        <label className="block text-gray-500 mb-1 text-xs">Nom du salon</label>
        <input
          type="text"
          disabled={!isHost}
          maxLength={ROOM_NAME_MAX}
          value={settings.roomName || ''}
          placeholder="Salon de…"
          onChange={(e) => updateSettings({ roomName: e.target.value })}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 font-bold disabled:opacity-60"
        />
      </div>
    )}
    <ToggleRow
      label="Chat écrit"
      hint="Une bulle de discussion pour tous les joueurs"
      checked={settings.chatEnabled !== false}
      disabled={!isHost}
      onChange={(v) => updateSettings({ chatEnabled: v })}
    />
  </div>
);

// ==========================================
// CHAT ÉCRIT + EXPULSION (partagés par tous les jeux)
// ==========================================
const CHAT_KEEP = 100;
const CHAT_TEXT_MAX = 200;

const cleanChatMessage = (m) =>
  m && typeof m.id === 'string' && typeof m.text === 'string'
    ? {
        id: m.id.slice(0, 40),
        from: String(m.from || '').slice(0, 60),
        name: String(m.name || '???').slice(0, MAX_NAME_LEN),
        avatar: typeof m.avatar === 'string' ? m.avatar.slice(0, 300) : '',
        text: m.text.slice(0, CHAT_TEXT_MAX),
        t: Number(m.t) || Date.now(),
      }
    : null;

const useRoomExtras = ({ channelRef, me, isHost, hostId, onKicked }) => {
  const [messages, setMessages] = useState([]);
  const messagesRef = React.useRef([]);
  const kickedRef = React.useRef(new Set());
  const lastSendRef = React.useRef(0);
  const live = React.useRef({});
  live.current = { me, isHost, hostId, onKicked };

  const addMessages = (list) => {
    const known = new Set(messagesRef.current.map((x) => x.id));
    const fresh = list.map(cleanChatMessage).filter((m) => m && !known.has(m.id));
    if (!fresh.length) return;
    messagesRef.current = [...messagesRef.current, ...fresh].sort((a, b) => a.t - b.t).slice(-CHAT_KEEP);
    setMessages(messagesRef.current);
  };

  // À appeler dans connectToRoom, avant channel.subscribe()
  const attach = (channel) => {
    channel.on('broadcast', { event: 'chat' }, ({ payload }) => addMessages([payload?.msg]));
    channel.on('broadcast', { event: 'chat_history' }, ({ payload }) => addMessages(Array.isArray(payload?.messages) ? payload.messages : []));
    channel.on('broadcast', { event: 'kick' }, ({ payload }) => {
      const l = live.current;
      if (payload?.id && payload.id === l.me.id && payload.by === l.hostId) l.onKicked && l.onKicked();
    });
  };

  // À appeler dans le handler presence "join" (le host renvoie l'historique, et re-expulse un joueur déjà expulsé)
  const onPresenceJoin = (channel, key) => {
    if (!live.current.isHost) return;
    if (messagesRef.current.length) {
      channel.send({ type: 'broadcast', event: 'chat_history', payload: { messages: messagesRef.current.slice(-30) } });
    }
    if (kickedRef.current.has(key)) {
      channel.send({ type: 'broadcast', event: 'kick', payload: { id: key, by: live.current.me.id } });
    }
  };

  const send = (text) => {
    const clean = (text || '').trim().slice(0, CHAT_TEXT_MAX);
    const nowMs = Date.now();
    if (!clean || nowMs - lastSendRef.current < 600) return false;
    lastSendRef.current = nowMs;
    const msg = {
      id: `${live.current.me.id}-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
      from: live.current.me.id,
      name: live.current.me.name,
      avatar: live.current.me.avatar,
      text: clean,
      t: nowMs,
    };
    addMessages([msg]);
    channelRef.current?.send({ type: 'broadcast', event: 'chat', payload: { msg } });
    return true;
  };

  const kick = (id) => {
    if (!live.current.isHost || id === live.current.me.id) return;
    kickedRef.current.add(id);
    channelRef.current?.send({ type: 'broadcast', event: 'kick', payload: { id, by: live.current.me.id } });
  };

  const reset = () => {
    messagesRef.current = [];
    setMessages([]);
  };

  return { messages, send, kick, attach, onPresenceJoin, reset };
};

const ChatWidget = ({ extras, me, enabled }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [seen, setSeen] = useState(0);
  const listRef = React.useRef(null);
  const msgs = extras.messages;

  useEffect(() => {
    if (open) {
      setSeen(msgs.length);
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, msgs.length]);

  if (!enabled) return null;
  const unread = open ? 0 : Math.max(0, msgs.length - seen);
  const submit = (e) => {
    e.preventDefault();
    if (extras.send(text)) setText('');
  };

  return (
    <div className="fixed bottom-6 right-4 z-[940] flex flex-col items-end gap-2">
      {open && (
        <div className="w-[min(20rem,calc(100vw-2rem))] h-96 max-h-[60vh] bg-gray-900 border border-purple-500/30 rounded-2xl shadow-2xl shadow-black/60 flex flex-col animate-fadein overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
            <span className="font-bold text-sm flex items-center gap-2"><MessageCircle size={15} className="text-purple-300" /> Chat du salon</span>
            <button type="button" onClick={() => setOpen(false)} className="text-gray-500 hover:text-white transition"><X size={16} /></button>
          </div>
          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {msgs.length === 0 && <p className="text-xs text-gray-600 text-center mt-6">Aucun message pour l'instant. Dis bonjour 👋</p>}
            {msgs.map((m) => {
              const mine = m.from === me.id;
              return (
                <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-gray-500 flex items-center gap-1 mb-0.5">
                    {!mine && <PlayerDot id={m.from} avatar={m.avatar} />}
                    {mine ? 'Toi' : m.name}
                  </span>
                  <p className={`max-w-[85%] rounded-xl px-3 py-1.5 text-sm break-words [overflow-wrap:anywhere] ${mine ? 'bg-purple-700/70 text-white' : 'bg-gray-800 text-gray-100'}`}>
                    {m.text}
                  </p>
                </div>
              );
            })}
          </div>
          <form onSubmit={submit} className="flex gap-2 p-2 border-t border-gray-800">
            <input
              type="text"
              value={text}
              maxLength={CHAT_TEXT_MAX}
              placeholder="Écrire un message…"
              onChange={(e) => setText(e.target.value)}
              className="flex-1 min-w-0 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
            />
            <button type="submit" data-sfx="off" disabled={!text.trim()} className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg px-3 active:scale-95 transition">
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Chat du salon"
        aria-label="Chat du salon"
        className="relative w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-500 shadow-lg shadow-black/50 flex items-center justify-center transition active:scale-90"
      >
        <MessageCircle size={20} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-[11px] font-black flex items-center justify-center animate-pop">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  );
};

// "Une" du journal affichée à la fin d'une partie : gros titre, photo, article
const FrontPage = ({ front, avatar, avatarId, photoCaption, children }) => {
  const [date] = useState(() => dateline());
  const [edition, setEdition] = useState(1);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    bumpEdition();
    setEdition(readEdition());
  }, []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${front.headline}\n${front.sub}\n— MakeItMeme, New York, ${date}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponible
    }
  };
  return (
    <article className="paper animate-fadein w-full text-left px-5 sm:px-8 pt-4 pb-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-x-3 text-[10px] uppercase tracking-[0.18em] font-bold border-b border-white/70 pb-1.5">
        <span>N° {edition}</span>
        <span>New York · {date}</span>
        <span>1 $</span>
      </div>
      <p className="font-masthead text-3xl sm:text-4xl text-center leading-none mt-3">
        <span className="twinkle text-base mr-2">✦</span>MakeItMeme<span className="twinkle text-base ml-2" style={{ animationDelay: '1.2s' }}>✦</span>
      </p>
      <div className="rule-double mt-3" />
      <p className="eyebrow text-center mt-3">{front.kicker}</p>
      <h2 className="font-heading text-3xl sm:text-5xl leading-[0.98] text-center mt-1 ink-in">{front.headline}</h2>
      <p className="italic text-center text-gray-500 mt-2 text-base sm:text-lg">{front.sub}</p>
      <div className="grid gap-5 sm:grid-cols-[11rem_1fr] mt-5 items-start">
        <div className="group">
          <div className="print-photo h-40 flex items-center justify-center border border-white/80 text-6xl">
            <span className="print-subject w-full h-full flex items-center justify-center">
              <AvatarGlyph avatar={avatar} fallback="🗞️" />
            </span>
          </div>
          {photoCaption && <p className="text-[11px] italic text-gray-500 mt-1">{photoCaption}</p>}
        </div>
        <div>
          <p className="dropcap text-[15px] leading-snug text-justify hyphens-auto" lang="fr">{front.story}</p>
          {children}
        </div>
      </div>
      <button
        type="button"
        onClick={copy}
        className="tag-dark mt-5 mx-auto px-4 py-2 flex items-center gap-2 active:scale-95"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Titre copié' : 'Copier la une'}
      </button>
    </article>
  );
};

// Petit bouton "expulser" pour la liste des joueurs (visible par le host uniquement)
const KickButton = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title="Expulser ce joueur"
    aria-label="Expulser ce joueur"
    className="shrink-0 text-gray-600 hover:text-red-400 transition active:scale-90"
  >
    <X size={13} />
  </button>
);

// Numéro d'édition du journal : +1 à chaque partie terminée sur cet appareil
const EDITION_KEY = 'makeitmeme-edition';
const readEdition = () => {
  try {
    return Math.max(0, parseInt(localStorage.getItem(EDITION_KEY) || '0', 10) || 0);
  } catch {
    return 0;
  }
};
const bumpEdition = () => {
  try {
    localStorage.setItem(EDITION_KEY, String(readEdition() + 1));
  } catch {
    // stockage indisponible
  }
};

export {
  readEdition,
  bumpEdition,
  toast,
  ToastHost,
  ROOM_NAME_MAX,
  useRoomDirectory,
  useDirectoryListing,
  VisibilityPicker,
  RoomOptions,
  useRoomExtras,
  ChatWidget,
  KickButton,
  FrontPage,
  useRefState,
  useDiscordAuth,
  AccountButton,
  AvatarPicker,
  AvatarGlyph,
  isImageAvatar,
  supabase,
  USING_FALLBACK_SUPABASE,
  withTimeout,
  makeId,
  fireConfetti,
  shuffle,
  PLAYER_COLORS,
  colorForPlayer,
  AVATAR_EMOJIS,
  randomAvatar,
  PlayerDot,
  playingMedia,
  setSfxEnabled,
  setSfxSuspended,
  playSfx,
  SoundToggle,
  GAMES,
  GamesRail,
  Waiting,
  ToggleRow,
  CountdownBadge,
  makeSessionStore,
  MAX_NAME_LEN,
  readIdentity,
  writeIdentity,
  useSoundAndClickFx,
};
