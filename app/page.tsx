'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Play, Image as ImageIcon, Video, Music, Send, Trophy, Users, Loader2,
  Crown, ThumbsUp, SkipForward, Settings, Copy, LogOut, Check, Download,
  ChevronLeft, ChevronRight, Link as LinkIcon, Volume2, VolumeX, Eye, EyeOff, Pencil, BookOpen, X, RotateCcw,
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

// Dessine le texte de légende sur un contexte canvas déjà rempli avec une
// image/frame — partagé entre la composition d'image et celle de vidéo.
const drawCaptionOnCanvas = (ctx, canvas, text, style) => {
  const fontSize = Math.max(16, Math.round(canvas.width / 16));
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
  drawCaptionOnCanvas(ctx, canvas, text, style);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
};

// Incruste la légende sur chaque frame d'une vidéo en la "filmant" en temps
// réel via canvas.captureStream() + MediaRecorder (pas de transcodage côté
// serveur : ça prend donc la durée de la vidéo, d'où le suivi de progression).
// Fonctionne dans les navigateurs basés Chromium ; retombe sur le fichier brut
// en cas d'échec (Safari plus ancien, CORS bloqué, etc.).
const composeMemeVideo = (url, text, style, onProgress) =>
  new Promise((resolve, reject) => {
    if (typeof MediaRecorder === 'undefined') {
      reject(new Error("Cette fonctionnalité n'est pas supportée par ce navigateur."));
      return;
    }
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = url;
    video.muted = false;
    video.playsInline = true;
    video.preload = 'auto';

    let rafId = null;
    let safetyTimer = null;
    let settled = false;
    const cleanup = () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (safetyTimer) clearTimeout(safetyTimer);
      video.pause();
      video.remove();
    };
    // Une seule issue possible (succès OU échec), et on nettoie toujours :
    // c'est ce qui évite le chargement infini si quelque chose se passe mal.
    const fail = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };
    const succeed = (blob) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(blob);
    };

    video.onerror = () => fail(new Error('Impossible de charger la vidéo (CORS ?).'));

    video.onloadedmetadata = () => {
      const maxDim = 720;
      const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale) || 480;
      canvas.height = Math.round(video.videoHeight * scale) || 270;
      const ctx = canvas.getContext('2d');

      let stream;
      try {
        stream = canvas.captureStream(30);
        const rawStream = video.captureStream ? video.captureStream() : video.mozCaptureStream ? video.mozCaptureStream() : null;
        if (rawStream) rawStream.getAudioTracks().forEach((t) => stream.addTrack(t));
      } catch (err) {
        fail(err);
        return;
      }

      const mimeCandidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';
      let recorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType });
      } catch (err) {
        fail(err);
        return;
      }
      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onerror = (e) => fail(e.error || new Error('Erreur MediaRecorder'));
      recorder.onstop = () => succeed(new Blob(chunks, { type: mimeType }));

      const drawFrame = () => {
        if (settled || video.paused || video.ended) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        drawCaptionOnCanvas(ctx, canvas, text, style);
        if (onProgress && isFinite(video.duration) && video.duration > 0) {
          onProgress(Math.min(1, video.currentTime / video.duration));
        }
        rafId = requestAnimationFrame(drawFrame);
      };

      const stopRecording = () => {
        if (recorder.state !== 'inactive') recorder.stop();
        else fail(new Error("L'enregistrement s'est arrêté avant la fin de la vidéo."));
      };

      video.onended = stopRecording;

      video
        .play()
        .then(() => {
          recorder.start(250);
          drawFrame();
          // Garde-fou : durée de la vidéo + marge, sinon on coupe et on garde ce qu'on a.
          const maxMs = ((isFinite(video.duration) && video.duration > 0 ? video.duration : 60) + 10) * 1000;
          safetyTimer = setTimeout(stopRecording, maxMs);
        })
        .catch(fail);
    };
  });

// Convertit un lien de partage Google Drive en URL directement chargeable
// (image ou vidéo). Les autres URLs sont retournées telles quelles.
const extractDriveFileId = (url) => {
  const patterns = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
};

const resolveExternalMediaUrl = (rawUrl) => {
  const driveId = extractDriveFileId(rawUrl);
  if (driveId) return `https://drive.google.com/uc?export=download&id=${driveId}`;
  return rawUrl;
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

  const colors = ['#a855f7', '#ec4899', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6'];
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

// Session du joueur (par onglet) : permet de garder le même identifiant après un
// rafraîchissement, donc de retrouver ses points et sa place dans la room.
const SESSION_KEY = 'caption-battle-session';
const readSession = () => {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
};
const writeSession = (data) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // stockage indisponible : on continue sans persistance
  }
};
const clearSession = () => {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
};

const DEFAULT_SETTINGS = {
  captionSeconds: 45,
  voteSeconds: 20,
  mediaPerPlayer: 1,
  shuffleRounds: true,
  allowExternalLink: true,
  maxFileMB: 25,
  ownerCanCaption: true,
  cursorsEnabled: true,
};
const MAX_NAME_LEN = 20;
const MAX_CAPTION_LEN = 140;
// Incrémenter à chaque mise à jour livrée du jeu.
const APP_VERSION = 'v26';

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
// EFFETS SONORES (synthétisés dans le navigateur, aucun fichier audio)
// ==========================================
let audioCtx = null;
let sfxEnabled = true;
let sfxSuspended = false; // coupé temporairement (ex. génération d'une vidéo)
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
const CURRENT_GAME_ID = 'caption-battle';
const GAMES = [
  { id: 'caption-battle', name: 'Caption Battle', emoji: '😂', status: 'live', gradient: 'from-purple-500 via-pink-500 to-orange-400' },
  { id: 'quiz', name: 'Quiz', emoji: '🧠', status: 'soon' },
  { id: 'dessin', name: 'Dessin', emoji: '🎨', status: 'soon' },
  { id: 'blind-test', name: 'Blind test', emoji: '🎵', status: 'soon' },
];

const GamesRail = () => (
  <nav
    aria-label="Jeux"
    className="fixed z-30 top-0 left-0 right-0 h-12 px-3 flex flex-row items-center gap-2 bg-gray-900/95 border-b border-gray-800 overflow-x-auto md:overflow-visible md:top-3 md:bottom-3 md:left-3 md:right-auto md:h-auto md:w-16 md:flex-col md:px-0 md:py-3 md:gap-3 md:rounded-2xl md:border md:shadow-xl md:shadow-black/30"
  >
    <span className="hidden md:block text-[9px] font-bold text-gray-600 uppercase tracking-widest">Jeux</span>
    {GAMES.map((g) => {
      const isCurrent = g.id === CURRENT_GAME_ID;
      const soon = g.status === 'soon';
      const tileClass = `w-10 h-10 md:w-11 md:h-11 flex items-center justify-center text-xl transition-all duration-200 ${
        isCurrent
          ? `bg-gradient-to-br ${g.gradient} rounded-xl shadow-lg shadow-purple-900/50`
          : soon
          ? 'rounded-2xl bg-gray-800/60 border border-dashed border-gray-700 opacity-60 grayscale cursor-not-allowed'
          : 'rounded-2xl bg-gray-800 hover:bg-purple-600 hover:rounded-xl active:scale-95'
      }`;
      const label = soon ? `${g.name} (bientôt)` : g.name;
      return (
        <div key={g.id} className="group relative shrink-0 flex items-center justify-center">
          {isCurrent && (
            <span className="hidden md:block absolute md:-left-[10px] top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-white" />
          )}
          {g.href && !isCurrent && !soon ? (
            <a href={g.href} aria-label={label} className={tileClass}>
              {g.emoji}
            </a>
          ) : (
            <button
              type="button"
              disabled={soon}
              aria-label={label}
              aria-current={isCurrent ? 'page' : undefined}
              className={tileClass}
            >
              {g.emoji}
            </button>
          )}
          <span
            role="tooltip"
            className="hidden md:block pointer-events-none absolute left-full ml-4 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-black border border-gray-700 px-3 py-1.5 text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-xl"
          >
            {g.name}
            {soon && <span className="ml-2 text-purple-300">Bientôt</span>}
          </span>
        </div>
      );
    })}
  </nav>
);

// ==========================================
// COMPOSANT LECTEUR MULTIMÉDIA UNIVERSEL
// ==========================================
const MediaPlayer = ({ src, type, compact = false }) => {
  if (!src) return null;
  // w-auto/h-auto (plutôt que w-full) : le média garde ses proportions
  // naturelles et se centre, au lieu d'être forcé sur toute la largeur puis
  // réduit à une bande minuscule pour les vidéos/images au format portrait.
  const sizingClasses = `max-w-full ${
    compact ? 'max-h-[35vh]' : 'max-h-[65vh]'
  } w-auto h-auto block mx-auto object-contain rounded-lg border-2 border-gray-700`;

  // Volume à 50 % au chargement (une seule fois : on ne touche pas au volume
  // à chaque re-render, sinon on écraserait le réglage du joueur).
  const setDefaultVolume = (e) => {
    e.currentTarget.volume = 0.5;
  };
  // Suivi des médias en lecture : les effets sonores du site se taisent tant
  // qu'un meme joue.
  const trackPlaying = (e) => playingMedia.add(e.currentTarget);
  const untrackPlaying = (e) => playingMedia.delete(e.currentTarget);

  if (type && type.includes('video')) {
    return (
      <video
        src={src}
        controls
        autoPlay
        playsInline
        onLoadedMetadata={setDefaultVolume}
        onPlaying={trackPlaying}
        onPause={untrackPlaying}
        onEmptied={untrackPlaying}
        onEnded={untrackPlaying}
        className={sizingClasses}
      />
    );
  }
  if (type && type.includes('audio')) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-800 rounded-lg border-2 border-gray-700 w-full">
        <Music size={48} className="text-purple-400 mb-4 animate-bounce" />
        <audio
          src={src}
          controls
          autoPlay
          onLoadedMetadata={setDefaultVolume}
          onPlaying={trackPlaying}
          onPause={untrackPlaying}
          onEmptied={untrackPlaying}
          onEnded={untrackPlaying}
          className="w-full"
        />
      </div>
    );
  }
  return <img src={src} alt="Média à captionner" className={sizingClasses} />;
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

const RULES_STEPS = [
  { emoji: '📤', title: 'Chacun upload un meme', text: "Une image, un GIF, une vidéo ou un audio — le tien, celui d'un autre, peu importe." },
  { emoji: '✍️', title: 'Tout le monde légende', text: "À chaque round, un meme s'affiche et chacun écrit sa légende dessus." },
  { emoji: '👀', title: 'Le host fait défiler', text: 'Les légendes anonymes défilent une par une, dans un ordre tiré au hasard, pareil pour tous.' },
  { emoji: '🗳️', title: 'Tout le monde vote', text: 'Résumé de toutes les légendes en même temps : chacun vote pour sa préférée (pas la sienne !).' },
  { emoji: '🏆', title: 'Les points tombent', text: '1 point par vote reçu. Le score cumule sur tous les rounds — le plus haut score gagne.' },
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
        <BookOpen size={22} className="text-purple-400" /> Comment jouer ?
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
        💡 Le host règle le temps de légende, le temps de vote et le nombre de memes par joueur dans le lobby.
      </p>
      <button
        onClick={onClose}
        className="mt-5 w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg transition active:scale-95"
      >
        Compris !
      </button>
    </div>
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

const isImageMedia = (media) => !media?.type || (!media.type.includes('video') && !media.type.includes('audio'));
const isVideoMedia = (media) => !!media?.type && media.type.includes('video');

const DownloadButton = ({ onClick, className = '' }) => (
  <button
    onClick={onClick}
    title="Télécharger le média"
    className={`bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg transition ${className}`}
  >
    <Download size={16} />
  </button>
);

const MediaWithDownload = ({ media, onDownload, compact = false }) => (
  <div className="relative">
    <MediaPlayer src={media.url} type={media.type} compact={compact} />
    <DownloadButton onClick={() => onDownload(media)} className="absolute top-2 right-2" />
  </div>
);

// ==========================================
// LÉGENDES : rendu lisible et aux couleurs du site
// ==========================================
// La taille du texte s'adapte à la longueur : une légende courte est énorme,
// une longue reste lisible sans déborder.
const captionSizeLarge = (text) => {
  const n = (text || '').length;
  if (n <= 24) return 'text-4xl sm:text-5xl';
  if (n <= 60) return 'text-3xl sm:text-4xl';
  if (n <= 110) return 'text-2xl sm:text-3xl';
  return 'text-xl sm:text-2xl';
};
const captionSizeSmall = (text) => {
  const n = (text || '').length;
  if (n <= 30) return 'text-2xl';
  if (n <= 70) return 'text-xl';
  return 'text-lg';
};

const CaptionText = ({ text, size = 'large', className = '' }) => (
  <p
    className={`font-heading font-extrabold text-white text-center leading-tight break-words [overflow-wrap:anywhere] [text-shadow:0_2px_14px_rgba(168,85,247,0.45)] ${
      size === 'large' ? captionSizeLarge(text) : captionSizeSmall(text)
    } ${className}`}
  >
    <span className="text-transparent bg-clip-text bg-gradient-to-br from-purple-400 to-pink-400">“</span>
    {text}
    <span className="text-transparent bg-clip-text bg-gradient-to-br from-pink-400 to-orange-300">”</span>
  </p>
);

// Carte du résumé de vote : fond sombre + bordure dégradée, texte blanc très
// contrasté. Sa propre légende reste visible mais n'est pas votable.
const RecapCaptionCard = ({ index, caption, isMine, isSelected, disabled, onVote, showDownload, onDownloadStyle }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div
      className={`relative rounded-2xl p-[2px] transition duration-200 animate-rise ${
        isSelected
          ? 'bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 shadow-xl shadow-purple-500/40 scale-[1.02]'
          : isMine
          ? 'bg-gray-700/60'
          : 'bg-gradient-to-br from-purple-800/70 to-pink-800/70 hover:from-purple-500 hover:to-pink-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-900/50'
      }`}
      style={{ animationDelay: `${Math.min(index, 12) * 60}ms` }}
    >
      <div
        className={`relative h-full rounded-[14px] overflow-hidden flex flex-col ${
          isSelected ? 'bg-gradient-to-br from-purple-800 to-pink-800' : 'bg-gray-950'
        }`}
      >
        <span className="absolute top-2 left-2 z-10 text-xs font-black bg-purple-600/80 text-white w-6 h-6 flex items-center justify-center rounded-full">
          {index}
        </span>
        {showDownload && (
          <div className="absolute top-2 right-2 z-20">
            <DownloadButton onClick={() => setMenuOpen((v) => !v)} />
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1 z-20 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden w-48 text-xs">
                  {MEME_STYLES.map((st) => (
                    <button
                      key={st.id}
                      onClick={() => {
                        setMenuOpen(false);
                        onDownloadStyle(st.id);
                      }}
                      className="w-full text-left px-3 py-2.5 text-gray-200 hover:bg-purple-900/40 transition"
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <button
          data-sfx="off"
          onClick={onVote}
          disabled={disabled}
          className={`flex-1 px-5 pt-11 pb-6 transition active:scale-[0.98] ${
            isMine ? 'cursor-default opacity-70' : disabled ? 'cursor-default' : 'cursor-pointer'
          }`}
        >
          <CaptionText text={caption} size="small" />
        </button>
        <div
          className={`px-3 py-2 text-xs font-bold text-center ${
            isSelected ? 'bg-black/25 text-white' : 'bg-gray-900 text-gray-400'
          }`}
        >
          {isSelected ? (
            <span className="inline-block animate-pop">✅ Ton vote</span>
          ) : isMine ? (
            "C'est la tienne — pas votable"
          ) : (
            'Clique pour voter'
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// CURSEURS PARTAGÉS + DESSIN
// ==========================================
// Les positions des autres joueurs arrivent par le canal temps réel. Tout est
// dans une couche fixe qui ignore la souris (pointer-events: none) : elle ne
// gêne jamais les clics. On dessine en maintenant Maj (Shift) et en bougeant la
// souris ; les traits s'effacent tout seuls au bout de quelques secondes.
const CURSOR_HOLD_MS = 5000; // le trait reste entier
const CURSOR_FADE_MS = 3000; // puis s'efface progressivement
const CURSOR_IDLE_MS = 6000; // curseur masqué sans nouvelles
const CURSOR_MAX_POINTS = 900;

// Petit bus : les messages "cursor" du canal arrivent ici sans faire re-rendre tout le jeu.
const cursorSubscribers = new Set();
const emitCursor = (payload) => cursorSubscribers.forEach((fn) => fn(payload));

const round4 = (n) => Math.round(n * 10000) / 10000;

const drawStrokes = (canvas, strokes) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  const now = Date.now();
  let alive = false;
  strokes.forEach((stroke, key) => {
    stroke.pts = stroke.pts.filter((pt) => now - pt.t < CURSOR_HOLD_MS + CURSOR_FADE_MS);
    if (stroke.pts.length === 0) {
      strokes.delete(key);
      return;
    }
    alive = true;
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    if (stroke.pts.length === 1) {
      const pt = stroke.pts[0];
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(pt.x * w, pt.y * h, 2.5, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    for (let i = 1; i < stroke.pts.length; i++) {
      const a = stroke.pts[i - 1];
      const b = stroke.pts[i];
      const age = now - b.t;
      ctx.globalAlpha =
        age < CURSOR_HOLD_MS ? 0.95 : Math.max(0, 0.95 * (1 - (age - CURSOR_HOLD_MS) / CURSOR_FADE_MS));
      ctx.beginPath();
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
      ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;
  return alive;
};

const CursorLayer = React.memo(function CursorLayer({ channelRef, me, allowed, showCursors, drawOn, playerCount }) {
  const canvasRef = useRef(null);
  const strokesRef = useRef(new Map()); // "idJoueur:idTrait" -> { color, pts: [{x, y, t}] }
  const rafRef = useRef(null);
  const [remote, setRemote] = useState({}); // id -> { x, y, name, avatar, t, off }
  const [hint, setHint] = useState(false);
  const [hasMouse, setHasMouse] = useState(true);

  // Valeurs les plus récentes pour les écouteurs (qui ne sont posés qu'une fois)
  const latest = useRef({});
  latest.current = { allowed, showCursors, drawOn, me };

  // Fréquence d'envoi adaptée au nombre de joueurs, pour ne pas saturer le canal
  const interval = Math.min(500, 150 + playerCount * 40);

  const startLoop = () => {
    if (rafRef.current) return;
    const tick = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        rafRef.current = null;
        return;
      }
      const alive = drawStrokes(canvas, strokesRef.current);
      rafRef.current = alive ? requestAnimationFrame(tick) : null;
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    setHasMouse(window.matchMedia ? window.matchMedia('(pointer: fine)').matches : true);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Aide affichée quelques secondes à l'arrivée
  useEffect(() => {
    if (!allowed) return;
    setHint(true);
    const timer = setTimeout(() => setHint(false), 9000);
    return () => clearTimeout(timer);
  }, [allowed]);

  // Réception des curseurs et des traits des autres joueurs
  useEffect(() => {
    const onMsg = (m) => {
      const cur = latest.current;
      if (!m || !m.id || m.id === cur.me.id || !cur.allowed || !cur.showCursors) return;
      const now = Date.now();
      if (m.off) {
        setRemote((prev) => (prev[m.id] ? { ...prev, [m.id]: { ...prev[m.id], off: true } } : prev));
        return;
      }
      if (typeof m.x === 'number' && typeof m.y === 'number') {
        setRemote((prev) => ({ ...prev, [m.id]: { x: m.x, y: m.y, name: m.n, avatar: m.a, t: now, off: false } }));
      }
      if (Array.isArray(m.s)) {
        m.s.forEach((seg) => {
          if (!seg || !seg.i || !Array.isArray(seg.p)) return;
          const key = `${m.id}:${seg.i}`;
          let stroke = strokesRef.current.get(key);
          if (!stroke) {
            stroke = { color: colorForPlayer(m.id), pts: [] };
            strokesRef.current.set(key, stroke);
          }
          for (let i = 0; i + 1 < seg.p.length; i += 2) {
            if (stroke.pts.length < CURSOR_MAX_POINTS) stroke.pts.push({ x: seg.p[i], y: seg.p[i + 1], t: now });
          }
        });
        startLoop();
      }
    };
    cursorSubscribers.add(onMsg);
    return () => {
      cursorSubscribers.delete(onMsg);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Curseurs qui n'ont plus donné de nouvelles : on les masque
  useEffect(() => {
    const timer = setInterval(() => {
      setRemote((prev) => {
        const now = Date.now();
        let changed = false;
        const next = {};
        Object.entries(prev).forEach(([id, c]) => {
          if (now - c.t < CURSOR_IDLE_MS) next[id] = c;
          else changed = true;
        });
        return changed ? next : prev;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  // Si on masque les curseurs (ou si le host les coupe) : on retire ceux des autres
  useEffect(() => {
    if (showCursors && allowed) return;
    setRemote({});
    strokesRef.current.forEach((_, key) => {
      if (!key.startsWith(`${latest.current.me.id}:`)) strokesRef.current.delete(key);
    });
  }, [showCursors, allowed]);

  // Envoi de MA position (et de mes traits), en petits paquets
  useEffect(() => {
    if (!allowed) return;
    const st = { x: 0, y: 0, dirty: false, offPending: false, sid: null, last: null, pending: {} };

    const onMove = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      st.x = e.clientX / w;
      st.y = e.clientY / h;
      st.dirty = true;
      st.offPending = false;
      if (latest.current.drawOn && e.shiftKey) {
        if (!st.sid) {
          st.sid = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
          st.last = null;
        }
        if (!st.last || Math.hypot(e.clientX - st.last.x, e.clientY - st.last.y) >= 4) {
          st.last = { x: e.clientX, y: e.clientY };
          const nx = round4(st.x);
          const ny = round4(st.y);
          (st.pending[st.sid] = st.pending[st.sid] || []).push(nx, ny);
          const key = `${latest.current.me.id}:${st.sid}`;
          let stroke = strokesRef.current.get(key);
          if (!stroke) {
            stroke = { color: colorForPlayer(latest.current.me.id), pts: [] };
            strokesRef.current.set(key, stroke);
          }
          if (stroke.pts.length < CURSOR_MAX_POINTS) stroke.pts.push({ x: nx, y: ny, t: Date.now() });
          startLoop();
        }
      } else {
        st.sid = null;
        st.last = null;
      }
    };
    const onLeave = () => {
      st.offPending = true;
      st.sid = null;
      st.last = null;
    };

    window.addEventListener('pointermove', onMove);
    document.documentElement.addEventListener('mouseleave', onLeave);
    window.addEventListener('blur', onLeave);

    const timer = setInterval(() => {
      const ch = channelRef.current;
      const hasStrokes = Object.keys(st.pending).length > 0;
      if (!ch || (!st.dirty && !hasStrokes && !st.offPending)) return;
      const cur = latest.current.me;
      const payload = { id: cur.id, n: cur.name, a: cur.avatar, x: round4(st.x), y: round4(st.y) };
      if (hasStrokes) payload.s = Object.entries(st.pending).map(([i, p]) => ({ i, p }));
      if (st.offPending) payload.off = true;
      ch.send({ type: 'broadcast', event: 'cursor', payload });
      st.pending = {};
      st.dirty = false;
      st.offPending = false;
    }, interval);

    return () => {
      clearInterval(timer);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('blur', onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, interval]);

  if (!allowed || !hasMouse) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 w-screen h-screen pointer-events-none z-[890]" />
      {showCursors &&
        Object.entries(remote).map(([id, c]) => {
          if (c.off) return null;
          const col = colorForPlayer(id);
          return (
            <div
              key={id}
              className="fixed top-0 left-0 z-[900] pointer-events-none"
              style={{ transform: `translate3d(${c.x * vw}px, ${c.y * vh}px, 0)`, transition: `transform ${interval}ms linear` }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}>
                <path d="M3 2l7.5 19 2.6-7.9L21 10.5z" fill={col} stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <span
                className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white whitespace-nowrap shadow-lg"
                style={{ backgroundColor: col }}
              >
                {c.avatar} {c.name}
              </span>
            </div>
          );
        })}
      {hint && drawOn && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[900] pointer-events-none animate-fadein bg-gray-900/90 border border-purple-700 text-gray-200 text-xs font-bold rounded-full px-4 py-2 shadow-xl">
          ✏️ Maintiens <kbd className="bg-gray-700 rounded px-1.5 py-0.5">Maj</kbd> et bouge la souris pour gribouiller
        </div>
      )}
    </>
  );
});

// ==========================================
// APPLICATION PRINCIPALE
// ==========================================
export default function CaptionBattle() {
  const [gameState, setGameState] = useState('home');
  // Pseudo/avatar mémorisés (localStorage, séparé de la session de room) pour
  // ne pas les retaper à chaque partie.
  const readIdentity = () => {
    try {
      return JSON.parse(localStorage.getItem('caption-battle-identity') || 'null');
    } catch {
      return null;
    }
  };
  const [player, setPlayer] = useState(() => {
    const saved = readIdentity();
    return { id: null, name: saved?.name || '', avatar: saved?.avatar || randomAvatar() };
  });
  useEffect(() => {
    if (!player.name.trim()) return;
    try {
      localStorage.setItem('caption-battle-identity', JSON.stringify({ name: player.name, avatar: player.avatar }));
    } catch {
      // stockage indisponible
    }
  }, [player.name, player.avatar]);
  const [room, setRoom] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [showRules, setShowRules] = useState(false);
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
  // Présentation synchronisée : ordre (aléatoire) des légendes tiré par le host,
  // et index de la légende actuellement affichée chez tout le monde.
  const [captionOrder, setCaptionOrder] = useState({ mediaId: null, order: [] });
  const [presentIndex, setPresentIndex] = useState(0);

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
  const captionOrderRef = useRef({ mediaId: null, order: [] });
  const presentIndexRef = useRef(0);

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
      // Dédoublonnage par id : après une reconnexion, l'ancienne connexion peut
      // rester visible quelques secondes — on garde seulement la plus récente.
      const byId = new Map();
      Object.values(state)
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

    // Rattrapage : si un joueur rejoint alors que la partie est déjà lancée,
    // le host lui renvoie tout l'état courant (sinon il resterait bloqué au lobby).
    channel.on('presence', { event: 'join' }, ({ key }) => {
      if (key === playerId) return;
      if (!isHostRefValue.current) return;

      // Les réglages sont toujours renvoyés (y compris dans le lobby), sinon un
      // nouvel arrivant garderait les valeurs par défaut au lieu de celles du host.
      channel.send({ type: 'broadcast', event: 'settings_update', payload: { settings: settingsRef.current } });
      if (gameStateRef.current === 'home' || gameStateRef.current === 'lobby') return;

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
      channel.send({
        type: 'broadcast',
        event: 'scores_sync',
        payload: { scores: cumulativeScoresRef.current, processedRound: processedRoundRef.current },
      });
      channel.send({ type: 'broadcast', event: 'caption_order', payload: captionOrderRef.current });
      channel.send({ type: 'broadcast', event: 'present_slide', payload: { index: presentIndexRef.current } });
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

    channel.on('broadcast', { event: 'scores_sync' }, ({ payload }) => {
      setCumulativeScores(payload.scores || {});
      cumulativeScoresRef.current = payload.scores || {};
      // Si le host a déjà compté ce round, on ne le recompte pas localement.
      if (typeof payload.processedRound === 'number') {
        processedRoundRef.current = Math.max(processedRoundRef.current, payload.processedRound);
      }
    });

    channel.on('broadcast', { event: 'cursor' }, ({ payload }) => emitCursor(payload));

    channel.on('broadcast', { event: 'caption_order' }, ({ payload }) => {
      setCaptionOrder({ mediaId: payload.mediaId, order: payload.order || [] });
    });

    channel.on('broadcast', { event: 'present_slide' }, ({ payload }) => {
      setPresentIndex(payload.index || 0);
    });

    channel.on('broadcast', { event: 'new_game' }, ({ payload }) => {
      setCaptionOrder({ mediaId: null, order: [] });
      setPresentIndex(0);
      setMedias([]);
      setRoundQueue([]);
      setCurrentRoundIndex(0);
      setCaptions([]);
      setVotes([]);
      setMyCaption('');
      if (!payload?.keepScores) setCumulativeScores({});
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
    setCaptionOrder({ mediaId: null, order: [] });
    setPresentIndex(0);
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
    writeSession({ code, id: newPlayerId, name: player.name.trim(), avatar: player.avatar });
    connectToRoom(code, newPlayerId, player.name.trim(), player.avatar, true);
    setGameState('lobby');
  };

  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code || !player.name.trim()) return;
    // Même room que la session précédente de cet onglet : on reprend le même id
    // pour retrouver ses points au lieu d'apparaître comme un nouveau joueur.
    const saved = readSession();
    const newPlayerId = saved && saved.code === code && saved.id ? saved.id : makeId('p');
    resetGameStateLocal();
    setPlayer((p) => ({ ...p, id: newPlayerId }));
    setRoom({ code });
    writeSession({ code, id: newPlayerId, name: player.name.trim(), avatar: player.avatar });
    connectToRoom(code, newPlayerId, player.name.trim(), player.avatar, false);
    setGameState('lobby');
  };

  const leaveRoom = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    clearSession();
    resetGameStateLocal();
    setRoom(null);
    setPlayer((p) => ({ ...p, id: null }));
    setGameState('home');
  };

  // Reconnexion automatique après un rafraîchissement : on reprend la même
  // identité (donc les mêmes points) et le host renvoie l'état de la partie.
  useEffect(() => {
    const saved = readSession();
    if (!saved || !saved.code || !saved.id || !saved.name) return;
    // Lien d'invitation vers une autre room : on n'écrase pas avec l'ancienne session
    const urlRoom = new URLSearchParams(window.location.search).get('room');
    if (urlRoom && urlRoom.toUpperCase() !== saved.code) {
      clearSession();
      return;
    }
    setPlayer({ id: saved.id, name: saved.name, avatar: saved.avatar });
    setRoom({ code: saved.code });
    connectToRoom(saved.code, saved.id, saved.name, saved.avatar, false);
    setGameState('lobby');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hostId = useMemo(() => {
    const creator = players.find((p) => p.is_creator);
    return creator ? creator.id : players[0]?.id ?? null;
  }, [players]);
  const isHost = player.id !== null && player.id === hostId;

  // Transfert de host visible : le host actuel part → quelqu'un d'autre reprend
  // automatiquement la main (le plus ancien arrivé), avec une notif pour tous.
  const [hostToast, setHostToast] = useState(null);
  const prevHostIdRef = useRef(null);
  useEffect(() => {
    const prev = prevHostIdRef.current;
    prevHostIdRef.current = hostId;
    if (!prev || !hostId || prev === hostId || players.length === 0) return;
    if (gameState === 'home') return;
    const newHost = players.find((p) => p.id === hostId);
    if (!newHost) return;
    setHostToast(newHost.id === player.id ? 'Le host a quitté — tu es maintenant host !' : `👑 ${newHost.name} est le nouveau host`);
    playSfx(newHost.id === player.id ? 'success' : 'whoosh');
    const t = setTimeout(() => setHostToast(null), 4500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostId]);

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
  useEffect(() => { captionOrderRef.current = captionOrder; }, [captionOrder]);
  useEffect(() => { presentIndexRef.current = presentIndex; }, [presentIndex]);

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

  const [isDragging, setIsDragging] = useState(false);

  // Coeur de l'upload, partagé entre le sélecteur de fichier et le glisser-déposer.
  const uploadFile = async (file, inputEl) => {
    setUploadError(null);

    // On passe en "uploading" tout de suite, avant même la moindre autre opération.
    setUploading(true);
    try {
      pushDebug(`fichier reçu : ${file.name} (${Math.round(file.size / 1024)}ko, ${file.type || 'type inconnu'})`);

      if (!/^(image|video|audio)\//.test(file.type || '')) {
        throw new Error('Type de fichier non supporté (image, vidéo ou audio uniquement)');
      }
      if (file.size > settings.maxFileMB * 1024 * 1024) {
        throw new Error(`Ce fichier dépasse ${settings.maxFileMB}Mo, choisis-en un plus léger.`);
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
      playSfx('success');
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
      playSfx('error');
    } finally {
      setUploading(false);
      if (inputEl) inputEl.value = '';
    }
  };

  const handleFileUpload = (e) => {
    pushDebug('onChange input fichier déclenché');
    const inputEl = e.target;
    const file = inputEl.files && inputEl.files[0];
    if (!file) return;
    uploadFile(file, inputEl);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) uploadFile(file, null);
  };

  const [externalUrl, setExternalUrl] = useState('');
  const [externalType, setExternalType] = useState('image');

  const submitExternalMedia = () => {
    const raw = externalUrl.trim();
    if (!raw) return;
    setUploadError(null);
    let parsed;
    try {
      parsed = new URL(raw).toString();
    } catch {
      setUploadError('Ce lien ne semble pas valide.');
      playSfx('error');
      return;
    }
    const resolvedUrl = resolveExternalMediaUrl(parsed);
    const typeMap = { image: 'image/jpeg', video: 'video/mp4', audio: 'audio/mpeg' };
    const media = {
      id: makeId('m'),
      url: resolvedUrl,
      type: typeMap[externalType],
      owner_id: player.id,
      owner_name: player.name,
      owner_avatar: player.avatar,
    };
    setMedias((prev) => [...prev, media]);
    broadcast('media_added', { media });
    setExternalUrl('');
    playSfx('success');
  };

  const myUploadCount = medias.filter((m) => m.owner_id === player.id).length;
  const iUploaded = myUploadCount >= settings.mediaPerPlayer;
  const everyoneUploaded =
    players.length > 0 &&
    players.every((p) => medias.filter((m) => m.owner_id === p.id).length >= settings.mediaPerPlayer);

  const launchGame = () => {
    const ids = medias.map((m) => m.id);
    const queue = settings.shuffleRounds ? shuffle(ids) : ids;
    broadcast('round_queue', { queue });
    setRoundQueue(queue);
    goToState('caption', { roundIndex: 0, phaseStartedAt: Date.now() });
  };

  // Lancement automatique dès que tout le monde a fini d'uploader (le host
  // n'a plus besoin de cliquer sur "Lancer les rounds").
  const autoLaunchedRef = useRef(false);
  useEffect(() => {
    if (isHost && gameState === 'upload' && everyoneUploaded && !autoLaunchedRef.current) {
      autoLaunchedRef.current = true;
      launchGame();
    }
    if (gameState !== 'upload') autoLaunchedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [everyoneUploaded, isHost, gameState]);

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
  // Qui doit légender ce round : tout le monde (le posteur aussi si le réglage l'autorise)
  const expectedCaptioners = currentMedia
    ? players.filter((p) => settings.ownerCanCaption || p.id !== currentMedia.owner_id).length
    : 0;

  const submitCaption = () => {
    if (!myCaption.trim() || !currentMedia) return;
    const caption = { media_id: currentMedia.id, author_id: player.id, author_name: player.name, author_avatar: player.avatar, text: myCaption.trim() };
    setCaptions((prev) => [...prev, caption]);
    broadcast('caption_submitted', { caption });
    setMyCaption('');
    playSfx('send');
  };

  const secondsLeftFor = (totalSeconds) => {
    if (!phaseStartedAt) return totalSeconds;
    return Math.max(0, totalSeconds - Math.floor((now - phaseStartedAt) / 1000));
  };

  // Légendes du round dans l'ordre partagé : l'ordre est tiré au hasard par le
  // host (donc identique pour tous et sans rapport avec l'ordre d'arrivée des
  // joueurs). Les légendes arrivées en retard sont ajoutées à la fin.
  const orderedCaptions = useMemo(() => {
    const forRound = captions.filter((c) => c.media_id === currentMediaId);
    const order = captionOrder.mediaId === currentMediaId ? captionOrder.order : [];
    const byAuthor = new Map(forRound.map((c) => [c.author_id, c]));
    const inOrder = order.map((id) => byAuthor.get(id)).filter(Boolean);
    const rest = forRound.filter((c) => !order.includes(c.author_id));
    return [...inOrder, ...rest];
  }, [captions, captionOrder, currentMediaId]);

  // Fin de la phase d'écriture : le host tire l'ordre des légendes au hasard, le
  // diffuse, puis lance la présentation (ou passe aux résultats s'il n'y en a aucune).
  const goAfterCaption = () => {
    if (!currentMedia) return;
    if (captionsForRound.length === 0) {
      goToState('round_result', { phaseStartedAt: Date.now() });
      return;
    }
    const order = shuffle(captionsForRound.map((c) => c.author_id));
    const payload = { mediaId: currentMedia.id, order };
    broadcast('caption_order', payload);
    setCaptionOrder(payload);
    broadcast('present_slide', { index: 0 });
    setPresentIndex(0);
    goToState('present', { phaseStartedAt: Date.now() });
  };

  // Le host fait défiler les légendes : tout le monde voit la même en même temps.
  const setSlide = (index) => {
    const clamped = Math.max(0, Math.min(Math.max(0, orderedCaptions.length - 1), index));
    setPresentIndex(clamped);
    broadcast('present_slide', { index: clamped });
  };

  // Avance automatiquement quand tout le monde a répondu
  useEffect(() => {
    if (isHost && gameState === 'caption' && currentMedia && expectedCaptioners > 0 && captionsForRound.length >= expectedCaptioners) {
      goAfterCaption();
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
        goAfterCaption();
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
    playSfx('vote');
  };

  useEffect(() => {
    if (isHost && gameState === 'vote' && currentMedia && eligibleVoters.length > 0 && votesForRound.length >= eligibleVoters.length) {
      goToState('round_result', { phaseStartedAt: Date.now() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [votes, isHost, gameState, currentMediaId, players.length]);

  // Vote (résumé) : touches 1-9 pour voter directement pour la légende correspondante
  useEffect(() => {
    if (gameState !== 'vote' || myVoteForRound) return;
    const handler = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const n = parseInt(e.key, 10);
      if (!n) return;
      const target = orderedCaptions[n - 1];
      if (target && target.author_id !== player.id) castVote(target.author_id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, myVoteForRound, orderedCaptions, player.id]);

  // Présentation : le host fait défiler avec les flèches du clavier
  useEffect(() => {
    if (gameState !== 'present' || !isHost) return;
    const handler = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight') setSlide(presentIndex + 1);
      else if (e.key === 'ArrowLeft') setSlide(presentIndex - 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, isHost, presentIndex, orderedCaptions.length]);

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

  const [videoComposeProgress, setVideoComposeProgress] = useState(null); // 0..1 ou null

  // Télécharge le meme avec le texte incrusté directement dans le média (canvas).
  // Images : composition instantanée. Vidéos : "filmées" en temps réel avec la
  // légende incrustée (donc ça prend la durée de la vidéo) puis ré-encodées en .webm.
  const downloadComposedMeme = async (media, text, style) => {
    if (isVideoMedia(media)) {
      setVideoComposeProgress(0);
      sfxSuspended = true;
      try {
        const blob = await composeMemeVideo(media.url, text, style, (ratio) => setVideoComposeProgress(ratio));
        if (!blob || blob.size === 0) throw new Error('Génération de la vidéo impossible.');
        triggerBlobDownload(blob, `meme-${media.id}-${style}.webm`);
      } catch (err) {
        console.error('Composition vidéo impossible, téléchargement brut à la place :', err);
        alert(
          "Impossible d'incruster la légende sur cette vidéo dans ce navigateur (fonctionnalité expérimentale, marche mieux sur Chrome/Edge desktop). Téléchargement du fichier original à la place."
        );
        downloadMedia(media);
      } finally {
        setVideoComposeProgress(null);
        sfxSuspended = false;
      }
      return;
    }
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
      // On calcule à partir de la dernière valeur connue (ref), puis le host
      // diffuse le total : c'est lui la référence, ce qui corrige tout écart
      // (joueur reconnecté, vote manqué...).
      const next = { ...cumulativeScoresRef.current };
      votesForRound.forEach((v) => {
        next[v.caption_author_id] = (next[v.caption_author_id] || 0) + 1;
      });
      cumulativeScoresRef.current = next;
      setCumulativeScores(next);
      if (isHostRefValue.current) {
        broadcast('scores_sync', { scores: next, processedRound: currentRoundIndex });
      }
      // Petite pluie de confettis si quelqu'un a marqué des points ce round
      if (votesForRound.length > 0) {
        fireConfetti({ count: 50, duration: 1800 });
      }
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

  const newGame = (keepScores = false) => {
    broadcast('new_game', { keepScores });
    setCaptionOrder({ mediaId: null, order: [] });
    setPresentIndex(0);
    setMedias([]);
    setRoundQueue([]);
    setCurrentRoundIndex(0);
    setCaptions([]);
    setVotes([]);
    setMyCaption('');
    if (!keepScores) setCumulativeScores({});
    setPhaseStartedAt(null);
    setGameState('upload');
    processedRoundRef.current = -1;
    autoSkipRef.current = '';
  };

  // Résumé de chaque manche : le meme de la manche + sa légende gagnante (celle
  // qui a reçu le plus de votes). Une manche sans vote n'a pas de gagnant.
  const roundRecaps = useMemo(() => {
    return roundQueue.map((mediaId, idx) => {
      const media = medias.find((m) => m.id === mediaId);
      const withPoints = captions
        .filter((c) => c.media_id === mediaId)
        .map((c) => ({
          ...c,
          points: votes.filter((v) => v.media_id === mediaId && v.caption_author_id === c.author_id).length,
        }));
      const winner = withPoints.reduce((best, c) => (!best || c.points > best.points ? c : best), null);
      return { round: idx + 1, media, winner: winner && winner.points > 0 ? winner : null };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState === 'final_results']);

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
  // EFFETS SONORES (les sons se taisent tant qu'un meme vidéo/audio joue)
  // ==========================================
  const [soundOn, setSoundOn] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem('caption-battle-sfx') === 'off') setSoundOn(false);
    } catch {
      // stockage indisponible
    }
  }, []);
  useEffect(() => {
    sfxEnabled = soundOn;
    try {
      localStorage.setItem('caption-battle-sfx', soundOn ? 'on' : 'off');
    } catch {
      // stockage indisponible
    }
  }, [soundOn]);
  // Préférences d'affichage des curseurs partagés / du dessin (mémorisées)
  const [showCursors, setShowCursors] = useState(true);
  const [drawOn, setDrawOn] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem('caption-battle-cursors') === 'off') setShowCursors(false);
      if (localStorage.getItem('caption-battle-draw') === 'off') setDrawOn(false);
    } catch {
      // stockage indisponible
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('caption-battle-cursors', showCursors ? 'on' : 'off');
      localStorage.setItem('caption-battle-draw', drawOn ? 'on' : 'off');
    } catch {
      // stockage indisponible
    }
  }, [showCursors, drawOn]);
  const meForCursor = useMemo(
    () => ({ id: player.id, name: player.name, avatar: player.avatar }),
    [player.id, player.name, player.avatar]
  );

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

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    if (next) {
      sfxEnabled = true;
      playSfx('success');
    }
  };

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

  // Changement de phase / de round
  const prevPhaseRef = useRef({ state: 'home', round: 0 });
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = { state: gameState, round: currentRoundIndex };
    if (prev.state === gameState && prev.round === currentRoundIndex) return;
    if (prev.state === 'home') return; // pas de son en arrivant dans une room
    if (gameState === 'upload' || gameState === 'caption') playSfx('roundStart');
    else if (gameState === 'vote') playSfx('voteStart');
    else if (gameState === 'round_result') playSfx('reveal');
    else if (gameState === 'final_results') playSfx('fanfare');
  }, [gameState, currentRoundIndex]);

  // Chaque nouvelle légende affichée pendant la présentation
  useEffect(() => {
    if (gameState === 'present') playSfx('whoosh');
  }, [presentIndex, gameState]);

  // Un joueur arrive / part
  const prevPlayerIdsRef = useRef(new Set());
  useEffect(() => {
    const ids = new Set(players.map((p) => p.id));
    const prev = prevPlayerIdsRef.current;
    prevPlayerIdsRef.current = ids;
    if (prev.size === 0 || !room) return; // première synchro : on ne joue rien
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

  // Compte à rebours : tic-tac sur les 5 dernières secondes, buzzer à 0
  const lastTickRef = useRef(null);
  useEffect(() => {
    if (gameState !== 'caption' && gameState !== 'vote') {
      lastTickRef.current = null;
      return;
    }
    const left = secondsLeftFor(gameState === 'caption' ? settings.captionSeconds : settings.voteSeconds);
    const key = `${gameState}-${currentRoundIndex}-${left}`;
    if (lastTickRef.current === key) return;
    lastTickRef.current = key;
    if (left > 0 && left <= 5) playSfx('tick');
    else if (left === 0) playSfx('buzzer');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, gameState, currentRoundIndex]);

  // ==========================================
  // SIDEBAR PERSISTANTE (façon Discord : room + liste des joueurs en direct)
  // ==========================================
  // Statut de chaque joueur pour la phase en cours (✅ fait / ⏳ en attente / null = non concerné)
  const playerStatus = (p) => {
    if (gameState === 'upload') {
      const n = medias.filter((m) => m.owner_id === p.id).length;
      return { done: n >= settings.mediaPerPlayer, label: `${n}/${settings.mediaPerPlayer}` };
    }
    if (gameState === 'caption' && currentMedia) {
      if (!settings.ownerCanCaption && p.id === currentMedia.owner_id) return null;
      return { done: captionsForRound.some((c) => c.author_id === p.id) };
    }
    if (gameState === 'vote' && currentMedia) {
      if (!captionsForRound.some((c) => c.author_id !== p.id)) return null;
      return { done: votesForRound.some((v) => v.voter_id === p.id) };
    }
    return null;
  };

  // Bandeau permanent : phase en cours, round X/Y, compteurs et barre d'avancement
  const renderProgressHeader = () => {
    const totalRounds = roundQueue.length;
    const phases = {
      lobby: { emoji: '🛋️', label: 'Lobby' },
      upload: { emoji: '📤', label: 'Upload des memes' },
      caption: { emoji: '✍️', label: 'Écriture des légendes' },
      present: { emoji: '👀', label: 'Présentation des légendes' },
      vote: { emoji: '🗳️', label: 'Résumé & vote' },
      round_result: { emoji: '🏆', label: 'Résultats du round' },
      final_results: { emoji: '🎉', label: 'Partie terminée' },
    };
    const phase = phases[gameState] || phases.lobby;
    const completedRounds =
      gameState === 'final_results' ? totalRounds : currentRoundIndex + (gameState === 'round_result' ? 1 : 0);
    const progress = totalRounds > 0 ? Math.min(1, completedRounds / totalRounds) : 0;

    return (
      <div className="shrink-0 mb-4 bg-gray-900/80 border border-gray-800 rounded-2xl px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-sm flex-wrap">
          <span className="font-bold">
            {phase.emoji} {phase.label}
          </span>
          <span className="text-gray-400 font-mono text-xs flex items-center gap-3 flex-wrap">
            {totalRounds > 0 && gameState !== 'final_results' && (
              <span className="text-purple-300 font-bold">
                Round {Math.min(currentRoundIndex + 1, totalRounds)}/{totalRounds}
              </span>
            )}
            {gameState === 'upload' && (
              <span>
                📤 {medias.length}/{players.length * settings.mediaPerPlayer} médias
              </span>
            )}
            {gameState === 'caption' && (
              <span>
                ✍️ {captionsForRound.length}/{expectedCaptioners} légendes
              </span>
            )}
            {gameState === 'vote' && (
              <span>
                🗳️ {votesForRound.length}/{eligibleVoters.length} votes
              </span>
            )}
            <span>👥 {players.length}</span>
          </span>
        </div>
        {totalRounds > 0 && (
          <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full shimmer-bar transition-all duration-500"
              style={{ width: `${Math.round(progress * 100)}%` }}
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
      {roundQueue.length > 0 && (
        <p className="text-xs text-gray-600 mb-1">
          Round {Math.min(currentRoundIndex + 1, roundQueue.length)}/{roundQueue.length}
        </p>
      )}

      <div className="h-px bg-gray-800 my-3" />

      <h3 className="flex items-center gap-2 text-gray-500 font-bold mb-3 uppercase text-[11px] tracking-wide shrink-0">
        <Users size={13} /> En ligne — {players.length}
      </h3>
      <div className="space-y-1 md:flex-1 md:overflow-y-auto -mx-1 px-1">
        {[...players]
          .sort((a, b) => (cumulativeScores[b.id] || 0) - (cumulativeScores[a.id] || 0))
          .map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition ${
                p.id === player.id ? 'bg-purple-900/40 border border-purple-600/60' : 'hover:bg-gray-800/70 hover:translate-x-0.5'
              }`}
            >
              <span className="wiggle-hover inline-flex cursor-default">
                <PlayerDot id={p.id} avatar={p.avatar} size="md" />
              </span>
              <span className="font-bold truncate flex-1">{p.name}</span>
              {(() => {
                const st = playerStatus(p);
                if (!st) return null;
                return (
                  <span className="flex items-center gap-1 shrink-0" title={st.done ? 'Fait' : 'En attente'}>
                    {st.label && !st.done && <span className="text-[10px] text-gray-500 font-mono">{st.label}</span>}
                    {st.done ? (
                      <Check size={14} className="text-green-400" />
                    ) : (
                      <Loader2 size={12} className="text-gray-600 animate-spin" />
                    )}
                  </span>
                );
              })()}
              {i === 0 && (cumulativeScores[p.id] || 0) > 0 && <Crown size={13} className="text-yellow-400 shrink-0" />}
              {p.id === hostId && (
                <span className="text-[9px] font-bold text-purple-400 bg-purple-900/40 px-1.5 py-0.5 rounded shrink-0">HOST</span>
              )}
              <span key={cumulativeScores[p.id] || 0} className="font-black text-purple-300 text-xs shrink-0 w-6 text-right inline-block animate-pop">
                {cumulativeScores[p.id] || 0}
              </span>
            </div>
          ))}
      </div>

      <div className="h-px bg-gray-800 my-3 shrink-0" />
      <div className="flex items-center justify-between shrink-0">
        <button
          onClick={leaveRoom}
          className="flex items-center gap-2 text-gray-500 hover:text-red-400 text-sm font-bold transition py-1 active:scale-95"
        >
          <LogOut size={14} /> Quitter la room
        </button>
        <div className="flex items-center gap-2.5">
          {settings.cursorsEnabled && (
            <>
              <button
                type="button"
                onClick={() => setShowCursors((v) => !v)}
                title={showCursors ? 'Masquer les curseurs des autres' : 'Afficher les curseurs des autres'}
                className="text-gray-500 hover:text-white transition active:scale-90"
              >
                {showCursors ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button
                type="button"
                onClick={() => setDrawOn((v) => !v)}
                title={drawOn ? 'Dessin activé (Maj + souris)' : 'Dessin désactivé'}
                className={`transition active:scale-90 ${drawOn ? 'text-purple-400 hover:text-purple-300' : 'text-gray-600 hover:text-white'}`}
              >
                <Pencil size={16} />
              </button>
            </>
          )}
          <SoundToggle on={soundOn} onToggle={toggleSound} />
        </div>
      </div>
    </div>
  );

  // Fonction ordinaire (pas un composant <Tag>) — voir la note plus haut sur le
  // bug de remontage : la même règle s'applique ici.
  const renderAppShell = (mainContent) => (
    <div className="min-h-screen md:h-[100dvh] md:overflow-hidden bg-gray-950/95 text-white relative z-10 flex justify-center p-4 pt-16 md:pt-4 md:pl-24">
      <VersionBadge />
      <GamesRail />
      {hostToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[960] animate-fadein bg-gray-900 border border-purple-600 shadow-xl shadow-purple-900/40 text-white text-sm font-bold rounded-full px-5 py-2.5 flex items-center gap-2">
          <Crown size={16} className="text-yellow-400" /> {hostToast}
        </div>
      )}
      <CursorLayer
        key="cursor-layer"
        channelRef={channelRef}
        me={meForCursor}
        allowed={settings.cursorsEnabled && !!player.id}
        showCursors={showCursors}
        drawOn={drawOn}
        playerCount={players.length}
      />
      {videoComposeProgress !== null && (
        <div className="fixed inset-0 z-[999] bg-black/80 flex flex-col items-center justify-center gap-4 p-4">
          <Loader2 size={40} className="text-purple-400 animate-spin" />
          <p className="font-bold">Génération de la vidéo avec la légende incrustée...</p>
          <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all"
              style={{ width: `${Math.round(videoComposeProgress * 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">Ça prend la durée de la vidéo, patience 🙏</p>
        </div>
      )}
      <div className="w-full max-w-[100rem] flex flex-col md:flex-row gap-4 md:h-full md:min-h-0">
        {renderSidebar()}
        <div className="flex-1 min-w-0 flex flex-col md:h-full md:min-h-0">
          {renderProgressHeader()}
          <div
            key={gameState}
            className="flex-1 min-w-0 flex flex-col animate-fadein md:min-h-0 md:overflow-y-auto md:pr-1"
          >
            {mainContent}
          </div>
        </div>
      </div>
    </div>
  );

  // ==========================================
  // ÉCRANS
  // ==========================================
  if (gameState === 'home') {
    return (
      <>
      <div className="min-h-screen md:h-[100dvh] md:overflow-hidden bg-gray-950/95 text-white relative z-10 flex flex-col items-center justify-center p-4 pt-16 md:pt-4 md:pl-24">
        <VersionBadge />
        <GamesRail />
        <h1
          className="font-heading text-6xl sm:text-7xl font-extrabold mb-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent animate-bob drop-shadow-sm"
          style={{ '--bob-rot': '-2deg' }}
        >
          CAPTION BATTLE
        </h1>
        <p className="text-gray-400 mb-8 font-medium">Le jeu où tes potes ruinent tes images (et vidéos/audios).</p>

        <div className="relative bg-gray-900 p-8 rounded-2xl w-full max-w-md shadow-2xl border border-gray-800">
          <SoundToggle on={soundOn} onToggle={toggleSound} className="absolute top-3 right-3" />
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
              className="w-full bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-900/40 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition transform hover:scale-[1.02] active:scale-95"
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

  if (gameState === 'lobby') {
    const settingOptions = {
      captionSeconds: [20, 30, 45, 60, 90],
      voteSeconds: [10, 15, 20, 30],
      mediaPerPlayer: [1, 2, 3],
      maxFileMB: [10, 25, 50],
    };
    return renderAppShell(
      <div className="bg-gray-900 p-8 rounded-2xl w-full max-w-lg mx-auto shadow-2xl border border-gray-800 text-center">
        <h2 className="font-heading text-2xl font-bold mb-2">Code de la Room</h2>
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

          <div className="mt-4 pt-4 border-t border-gray-800 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-300">Poids max par fichier</span>
              <select
                disabled={!isHost}
                value={settings.maxFileMB}
                onChange={(e) => updateSettings({ maxFileMB: Number(e.target.value) })}
                className="bg-gray-800 border border-gray-700 rounded-lg p-1.5 font-bold disabled:opacity-60"
              >
                {settingOptions.maxFileMB.map((s) => (
                  <option key={s} value={s}>{s} Mo</option>
                ))}
              </select>
            </div>
            <ToggleRow
              label="Ordre des memes aléatoire"
              hint="Sinon : dans l'ordre d'upload"
              checked={settings.shuffleRounds}
              disabled={!isHost}
              onChange={(v) => updateSettings({ shuffleRounds: v })}
            />
            <ToggleRow
              label="Légender son propre meme"
              hint="Impossible de voter pour sa propre légende"
              checked={settings.ownerCanCaption}
              disabled={!isHost}
              onChange={(v) => updateSettings({ ownerCanCaption: v })}
            />
            <ToggleRow
              label="Autoriser l'ajout par lien"
              hint="Lien direct ou Google Drive public"
              checked={settings.allowExternalLink}
              disabled={!isHost}
              onChange={(v) => updateSettings({ allowExternalLink: v })}
            />
            <ToggleRow
              label="Curseurs & dessins partagés"
              hint="Voir la souris des autres et gribouiller (Maj + souris)"
              checked={settings.cursorsEnabled}
              disabled={!isHost}
              onChange={(v) => updateSettings({ cursorsEnabled: v })}
            />
          </div>
        </div>

        {isHost ? (
          <button
            onClick={startUploadPhase}
            disabled={players.length < 2}
            className="w-full bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-900/40 disabled:opacity-50 active:scale-95 text-white font-black py-4 px-6 rounded-lg text-lg transition shadow-lg shadow-purple-500/20"
          >
            {players.length < 2 ? "En attente d'au moins 2 joueurs..." : 'Lancer le jeu !'}
          </button>
        ) : (
          <div className="flex items-center justify-center gap-3 text-gray-400 animate-pulse">
            <Loader2 className="animate-spin" /> En attente du Host...
          </div>
        )}
      </div>
    );
  }

  if (gameState === 'upload') {
    return (
      renderAppShell(<>
        <div className="bg-gray-900 p-8 rounded-2xl w-full shadow-2xl border border-gray-800 text-center flex-1 flex flex-col justify-center">
          <h2 className="font-heading text-3xl font-bold mb-2">Choisis ton arme</h2>
          <p className="text-gray-400 mb-8">
            Upload {settings.mediaPerPlayer > 1 ? `${settings.mediaPerPlayer} médias` : 'un média'} (image, GIF, vidéo ou audio, {settings.maxFileMB}Mo max). Chacun sera captionné par les autres !
          </p>

          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {players.map((p) => {
              const n = medias.filter((m) => m.owner_id === p.id).length;
              const done = n >= settings.mediaPerPlayer;
              return (
                <span
                  key={p.id}
                  className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border transition ${
                    done ? 'border-green-600 bg-green-900/30 text-green-300' : 'border-gray-700 bg-gray-800 text-gray-400'
                  }`}
                >
                  <PlayerDot id={p.id} avatar={p.avatar} />
                  {p.name}
                  {done ? <Check size={12} /> : <span className="font-mono">⏳ {n}/{settings.mediaPerPlayer}</span>}
                </span>
              );
            })}
          </div>

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
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition group ${
                  isDragging
                    ? 'border-purple-400 bg-purple-900/30 scale-[1.02]'
                    : 'border-gray-600 hover:border-purple-500 hover:bg-purple-900/10'
                }`}
              >
                <div className="flex gap-4 text-gray-400 group-hover:text-purple-400 mb-3">
                  <ImageIcon size={32} />
                  <Video size={32} />
                  <Music size={32} />
                </div>
                <span className="font-bold">
                  {isDragging ? 'Lâche ton fichier ici !' : `Clique ou glisse-dépose un fichier (${myUploadCount}/${settings.mediaPerPlayer})`}
                </span>
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

              {settings.allowExternalLink && (<>
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-gray-800"></div>
                <span className="flex-shrink-0 mx-4 text-gray-600 font-bold text-xs">OU PAR LIEN</span>
                <div className="flex-grow border-t border-gray-800"></div>
              </div>

              <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-left">
                <div className="flex gap-2 mb-2">
                  {[
                    { id: 'image', label: '🖼️ Image' },
                    { id: 'video', label: '🎬 Vidéo' },
                    { id: 'audio', label: '🎵 Audio' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setExternalType(t.id)}
                      className={`flex-1 text-xs font-bold py-2 rounded-lg transition ${
                        externalType === t.id ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="Colle un lien (image/vidéo direct, ou partage Google Drive public)"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitExternalMedia()}
                    className="flex-1 min-w-0 p-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:border-purple-500 focus:outline-none"
                  />
                  <button
                    onClick={submitExternalMedia}
                    disabled={!externalUrl.trim()}
                    className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white px-4 rounded-lg transition active:scale-95"
                  >
                    <LinkIcon size={18} />
                  </button>
                </div>
                <p className="text-[11px] text-gray-600 mt-2">
                  Pour un lien Google Drive : le fichier doit être partagé en "Tout le monde avec le lien". Note :
                  l'incrustation de légende au téléchargement peut ne pas marcher sur des liens externes (restrictions
                  du site source) — le fichier brut sera proposé à la place dans ce cas.
                </p>
              </div>
              </>)}
            </div>
          )}

          {isHost && !uploading && (
            <button
              onClick={launchGame}
              disabled={!everyoneUploaded}
              className="mt-6 w-full bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-900/40 disabled:opacity-40 text-white font-black py-4 px-6 rounded-lg text-lg transition active:scale-95"
            >
              {everyoneUploaded
                ? `Lancement automatique...`
                : `En attente des uploads (${medias.length}/${players.length * settings.mediaPerPlayer})`}
            </button>
          )}
        </div>
      </>)
    );
  }

  if (gameState === 'caption') {
    if (!currentMedia) {
      return (
        renderAppShell(<>
          <Waiting label="Préparation du round..." />
        </>)
      );
    }
    return (
      renderAppShell(<>
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-heading text-2xl font-bold text-purple-400">
            Round {currentRoundIndex + 1}/{roundQueue.length}
          </h2>
          <CountdownBadge seconds={secondsLeftFor(settings.captionSeconds)} />
        </div>

        {isMyMedia && !settings.ownerCanCaption ? (
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
              <span className="text-purple-400 font-bold">{isMyMedia ? 'toi' : currentMedia.owner_name}</span>
            </p>
            {isMyMedia && (
              <p className="text-xs text-purple-300 bg-purple-900/30 border border-purple-800 rounded-full px-3 py-1 mb-3">
                C'est ton meme ! Tu peux le légender aussi (mais tu ne pourras pas voter pour ta propre légende).
              </p>
            )}
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
                data-sfx="off"
                onClick={submitCaption}
                disabled={!myCaption.trim()}
                className="absolute right-3 top-3 bottom-3 bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-900/40 disabled:opacity-40 rounded-lg px-4 flex items-center justify-center transition active:scale-95"
              >
                <Send size={20} />
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2 self-end">{myCaption.length}/{MAX_CAPTION_LEN}</p>
          </div>
        )}

        {isHost && (
          <button
            onClick={goAfterCaption}
            className="mt-6 w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-300 text-sm font-bold py-2 transition"
          >
            <SkipForward size={16} /> Passer à la présentation quand même
          </button>
        )}
      </>)
    );
  }

  if (gameState === 'present') {
    if (!currentMedia) {
      return renderAppShell(<Waiting label="Chargement de la présentation..." />);
    }
    const total = orderedCaptions.length;
    const idx = Math.min(presentIndex, Math.max(0, total - 1));
    const active = orderedCaptions[idx];
    const isLast = idx >= total - 1;
    const hostName = players.find((p) => p.id === hostId)?.name;
    const startVote = () => goToState('vote', { phaseStartedAt: Date.now() });

    return renderAppShell(
      <>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-heading text-2xl font-bold text-purple-400">
            Round {currentRoundIndex + 1}/{roundQueue.length} — Les légendes
          </h2>
          <span className="font-mono text-sm text-gray-400 bg-gray-900 border border-gray-800 rounded-full px-3 py-1">
            {total > 0 ? idx + 1 : 0}/{total}
          </span>
        </div>

        {/* Le média reste monté d'une légende à l'autre : la vidéo ne se relance pas */}
        <div className="w-full rounded-3xl p-[3px] bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 gradient-animated shadow-2xl shadow-purple-900/40">
          <div className="rounded-[21px] bg-gray-950 overflow-hidden">
            <div className="bg-black/50 p-3">
              <MediaWithDownload media={currentMedia} onDownload={downloadMedia} />
            </div>
            {active ? (
              <div
                key={active.author_id}
                className="animate-caption-in bg-gradient-to-b from-gray-900 to-purple-950/70 px-6 py-8 sm:py-10"
              >
                <CaptionText text={active.text} size="large" />
              </div>
            ) : (
              <div className="bg-gray-900 px-6 py-8 text-center text-gray-400">Aucune légende à afficher.</div>
            )}
          </div>
        </div>

        {total > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            {orderedCaptions.map((c, i) => (
              <button
                key={c.author_id}
                data-sfx="off"
                disabled={!isHost}
                onClick={() => setSlide(i)}
                aria-label={`Légende ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-purple-500' : 'w-2 bg-gray-700'} ${
                  isHost ? 'hover:bg-gray-500 cursor-pointer' : 'cursor-default'
                }`}
              />
            ))}
          </div>
        )}

        {isHost ? (
          <>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                data-sfx="off"
                onClick={() => setSlide(idx - 1)}
                disabled={idx <= 0}
                className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white font-bold py-3 px-5 rounded-lg transition active:scale-95"
              >
                <ChevronLeft size={20} /> Précédente
              </button>
              {!isLast ? (
                <button
                  data-sfx="off"
                  onClick={() => setSlide(idx + 1)}
                  className="flex items-center gap-1 bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-900/40 text-white font-bold py-3 px-5 rounded-lg transition active:scale-95"
                >
                  Suivante <ChevronRight size={20} />
                </button>
              ) : (
                <button
                  onClick={startVote}
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black py-3 px-6 rounded-lg shadow-lg shadow-purple-900/40 transition active:scale-95"
                >
                  Passer au vote 🗳️
                </button>
              )}
            </div>
            <p className="text-center text-xs text-gray-600 mt-2">
              ← → pour faire défiler — tout le monde voit la même légende que toi
            </p>
            {!isLast && (
              <button
                onClick={startVote}
                className="mt-3 w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-300 text-sm font-bold py-2 transition"
              >
                <SkipForward size={16} /> Passer directement au vote
              </button>
            )}
          </>
        ) : (
          <p className="mt-5 text-center text-sm text-gray-400 animate-pulse">
            👀 {hostName || 'Le host'} fait défiler les légendes...
          </p>
        )}
      </>
    );
  }

  if (gameState === 'vote') {
    if (!currentMedia) {
      return renderAppShell(<Waiting label="Chargement du vote..." />);
    }
    const canIVote = orderedCaptions.some((c) => c.author_id !== player.id);
    const canDownload = isImageMedia(currentMedia) || isVideoMedia(currentMedia);

    return renderAppShell(
      <>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-heading text-2xl font-bold text-purple-400">
            Résumé — Round {currentRoundIndex + 1}/{roundQueue.length}
          </h2>
          <CountdownBadge seconds={secondsLeftFor(settings.voteSeconds)} />
        </div>

        <div className="w-full bg-gray-900 p-3 rounded-2xl border border-gray-800 mb-4 shadow-2xl">
          <MediaWithDownload media={currentMedia} onDownload={downloadMedia} compact />
        </div>

        <p className="text-center text-sm text-gray-400 mb-3">
          {myVoteForRound
            ? `Vote enregistré — en attente des autres (${votesForRound.length}/${eligibleVoters.length})`
            : !canIVote
            ? 'Aucune autre légende pour laquelle voter — attends les autres...'
            : 'Vote pour la meilleure légende (touches 1-9 pour voter vite)'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {orderedCaptions.map((c, i) => {
            const isMine = c.author_id === player.id;
            return (
              <RecapCaptionCard
                key={c.author_id}
                index={i + 1}
                caption={c.text}
                isMine={isMine}
                isSelected={myVoteForRound?.caption_author_id === c.author_id}
                disabled={isMine || !!myVoteForRound}
                onVote={() => castVote(c.author_id)}
                showDownload={canDownload}
                onDownloadStyle={(style) => downloadComposedMeme(currentMedia, c.text, style)}
              />
            );
          })}
        </div>

        {isHost && (
          <button
            onClick={() => goToState('round_result', { phaseStartedAt: Date.now() })}
            className="mt-6 w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-300 text-sm font-bold py-2 transition"
          >
            <SkipForward size={16} /> Passer aux résultats quand même
          </button>
        )}
      </>
    );
  }

  if (gameState === 'round_result') {
    return (
      renderAppShell(<>
        <div className="flex flex-col items-center text-center">
          <Trophy size={48} className="text-yellow-400 mb-4 animate-bob" />
          <h2 className="font-heading text-2xl font-bold mb-1">Résultats — Round {currentRoundIndex + 1}/{roundQueue.length}</h2>
          {currentMedia && (
            <div className="w-full bg-gray-900 p-4 rounded-2xl border border-gray-800 my-4 shadow-2xl">
              <MediaWithDownload media={currentMedia} onDownload={downloadMedia} />
            </div>
          )}
          <div className="w-full space-y-2 mb-6">
            {orderedCaptions
              .map((c) => ({ ...c, points: votesForRound.filter((v) => v.caption_author_id === c.author_id).length }))
              .sort((a, b) => b.points - a.points)
              .map((c, rank) => (
                <div
                  key={c.author_id}
                  className={`animate-rise flex items-center justify-between rounded-xl px-4 py-3 gap-3 border ${
                    rank === 0 && c.points > 0
                      ? 'bg-gradient-to-r from-purple-900/60 to-pink-900/50 border-pink-500/60 shadow-lg shadow-purple-900/30'
                      : 'bg-gray-900 border-gray-800'
                  }`}
                  style={{ animationDelay: `${rank * 80}ms` }}
                >
                  <div className="text-left min-w-0">
                    <p className="font-heading font-bold text-lg leading-snug text-white break-words [overflow-wrap:anywhere]">
                      {rank === 0 && c.points > 0 && <span className="mr-1">👑</span>}“{c.text}”
                    </p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <PlayerDot id={c.author_id} avatar={c.author_avatar} /> par {c.author_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {currentMedia && (isImageMedia(currentMedia) || isVideoMedia(currentMedia)) && (
                      <button
                        onClick={() => downloadComposedMeme(currentMedia, c.text, 'bottom-gradient')}
                        title="Télécharger avec la légende incrustée"
                        className="text-gray-500 hover:text-white transition p-1.5"
                      >
                        <Download size={16} />
                      </button>
                    )}
                    <span className="font-heading font-extrabold text-xl text-purple-300 animate-pop">+{c.points}</span>
                  </div>
                </div>
              ))}
            {captionsForRound.length === 0 && <p className="text-gray-500 text-sm">Aucune légende n'a été soumise ce round.</p>}
          </div>

          {isHost ? (
            <button onClick={nextRound} className="bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-900/40 font-bold py-3 px-8 rounded-full">
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

  return renderAppShell(
    <div className="flex flex-col items-center text-center flex-1 justify-center py-4">
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

      {bestCaptionOfGame && (
        <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 border border-purple-700 rounded-2xl p-4 w-full max-w-md mb-8 flex items-center gap-4">
          {bestCaptionOfGame.media && isImageMedia(bestCaptionOfGame.media) && (
            <img src={bestCaptionOfGame.media.url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-purple-300 uppercase tracking-wide mb-1">🏆 Punchline légendaire du match</p>
            <p className="font-heading font-bold text-lg leading-snug text-white line-clamp-2 break-words [overflow-wrap:anywhere]">
              “{bestCaptionOfGame.text}”
            </p>
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
              <PlayerDot id={bestCaptionOfGame.author_id} avatar={bestCaptionOfGame.author_avatar} /> {bestCaptionOfGame.author_name} · {bestCaptionOfGame.points} vote{bestCaptionOfGame.points > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {roundRecaps.length > 0 && (
        <div className="w-full max-w-md mb-8">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">📜 Résumé des manches</p>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {roundRecaps.map(({ round, media, winner }) => (
              <div key={round} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3 text-left">
                <span className="shrink-0 text-xs font-black bg-gray-800 text-gray-400 w-6 h-6 flex items-center justify-center rounded-full">
                  {round}
                </span>
                {media && isImageMedia(media) && (
                  <img src={media.url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                )}
                {media && isVideoMedia(media) && (
                  <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                    <Video size={18} className="text-gray-500" />
                  </div>
                )}
                <div className="min-w-0">
                  {winner ? (
                    <>
                      <p className="font-heading font-bold text-sm leading-snug text-white break-words [overflow-wrap:anywhere]">
                        “{winner.text}”
                      </p>
                      <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <PlayerDot id={winner.author_id} avatar={winner.author_avatar} /> {winner.author_name} · {winner.points} vote
                        {winner.points > 1 ? 's' : ''}
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-gray-500 italic">Pas de vote sur cette manche</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isHost ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => newGame(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-900/40 active:scale-95 font-bold py-3 px-6 rounded-full transition"
          >
            <RotateCcw size={16} /> Rejouer (scores conservés)
          </button>
          <button
            onClick={() => newGame(false)}
            className="bg-gray-800 hover:bg-gray-700 active:scale-95 font-bold py-3 px-6 rounded-full transition"
          >
            Nouvelle partie (scores à zéro)
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3 text-gray-400 animate-pulse">
          <Loader2 className="animate-spin" /> En attente du Host...
        </div>
      )}
    </div>
  );
}
