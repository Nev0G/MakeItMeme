'use client';

// Curseurs partagés + dessin, communs à tous les jeux.
// Les positions des autres joueurs arrivent par le canal temps réel (événement « cursor »). Tout est dans une
// couche fixe qui ignore la souris (pointer-events: none) : elle ne gêne jamais les clics. On dessine en
// maintenant Maj (Shift) et en bougeant la souris ; les traits s'effacent tout seuls au bout de quelques secondes.
// Chaque joueur règle ça pour lui-même, à tout moment : voir les curseurs des autres, montrer le sien, dessiner.
import React, { useEffect, useRef, useState } from 'react';
import { MousePointer2, Eye, Pencil, Check } from 'lucide-react';
import { colorForPlayer, AvatarGlyph } from '@/lib/shared';

const CURSOR_HOLD_MS = 5000; // le trait reste entier
const CURSOR_FADE_MS = 3000; // puis s'efface progressivement
const CURSOR_IDLE_MS = 6000; // curseur masqué sans nouvelles
const CURSOR_MAX_POINTS = 900;

// Petit bus : les messages "cursor" du canal arrivent ici sans faire re-rendre tout le jeu.
const cursorSubscribers = new Set<(m: any) => void>();
export const emitCursor = (payload: any) => cursorSubscribers.forEach((fn) => fn(payload));

// ---------- Préférences de chaque joueur (mémorisées sur son appareil, valables pour tous les jeux) ----------
export type CursorPrefs = { see: boolean; share: boolean; draw: boolean };
const PREF_KEY = 'makeitmeme-cursor-prefs';
const ALL_ON: CursorPrefs = { see: true, share: true, draw: true };

const readPrefs = (): CursorPrefs => {
  try {
    const saved = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
    if (saved && typeof saved === 'object') return { ...ALL_ON, ...saved };
    // Anciennes préférences de Caption Battle
    return {
      see: localStorage.getItem('caption-battle-cursors') !== 'off',
      share: true,
      draw: localStorage.getItem('caption-battle-draw') !== 'off',
    };
  } catch {
    return ALL_ON;
  }
};

export const useCursorPrefs = () => {
  const [prefs, setPrefs] = useState<CursorPrefs>(ALL_ON);
  useEffect(() => {
    setPrefs(readPrefs());
  }, []);
  const update = (patch: Partial<CursorPrefs>) =>
    setPrefs((cur) => {
      const next = { ...cur, ...patch };
      try {
        localStorage.setItem(PREF_KEY, JSON.stringify(next));
      } catch {
        // stockage indisponible
      }
      return next;
    });
  return { prefs, update };
};

const round4 = (n: number) => Math.round(n * 10000) / 10000;

const drawStrokes = (canvas: HTMLCanvasElement, strokes: Map<string, any>) => {
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
    stroke.pts = stroke.pts.filter((pt: any) => now - pt.t < CURSOR_HOLD_MS + CURSOR_FADE_MS);
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
      ctx.globalAlpha = age < CURSOR_HOLD_MS ? 0.95 : Math.max(0, 0.95 * (1 - (age - CURSOR_HOLD_MS) / CURSOR_FADE_MS));
      ctx.beginPath();
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
      ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;
  return alive;
};

type LayerProps = {
  channelRef: React.MutableRefObject<any>;
  me: { id: string; name: string; avatar: string };
  allowed: boolean;
  prefs: CursorPrefs;
  playerCount: number;
};

const CursorLayer = React.memo(function CursorLayer({ channelRef, me, allowed, prefs, playerCount }: LayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef(new Map<string, any>()); // "idJoueur:idTrait" -> { color, pts: [{x, y, t}] }
  const rafRef = useRef<number | null>(null);
  const [remote, setRemote] = useState<Record<string, any>>({}); // id -> { x, y, name, avatar, t, off }
  const [hint, setHint] = useState(false);
  const { see, share, draw } = prefs;

  // Valeurs les plus récentes pour les écouteurs (qui ne sont posés qu'une fois)
  const latest = useRef<any>({});
  latest.current = { allowed, see, share, draw, me };

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

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  // Aide affichée quelques secondes à l'arrivée
  useEffect(() => {
    if (!allowed) return;
    setHint(true);
    const timer = setTimeout(() => setHint(false), 9000);
    return () => clearTimeout(timer);
  }, [allowed]);

  // Réception des curseurs et des traits des autres joueurs
  useEffect(() => {
    const onMsg = (m: any) => {
      const cur = latest.current;
      if (!m || !m.id || m.id === cur.me.id || !cur.allowed || !cur.see) return;
      const now = Date.now();
      if (m.off) {
        setRemote((prev) => (prev[m.id] ? { ...prev, [m.id]: { ...prev[m.id], off: true } } : prev));
        return;
      }
      if (typeof m.x === 'number' && typeof m.y === 'number') {
        setRemote((prev) => ({ ...prev, [m.id]: { x: m.x, y: m.y, name: m.n, avatar: m.a, t: now, off: false } }));
      }
      if (Array.isArray(m.s)) {
        m.s.forEach((seg: any) => {
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
        const next: Record<string, any> = {};
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
    if (see && allowed) return;
    setRemote({});
    strokesRef.current.forEach((_, key) => {
      if (!key.startsWith(`${latest.current.me.id}:`)) strokesRef.current.delete(key);
    });
  }, [see, allowed]);

  // On cesse de montrer le sien : les autres le retirent tout de suite
  useEffect(() => {
    if (allowed && !share && me.id) channelRef.current?.send({ type: 'broadcast', event: 'cursor', payload: { id: me.id, off: true } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [share, allowed]);

  // Envoi de MA position (et de mes traits), en petits paquets
  useEffect(() => {
    if (!allowed || !share) return;
    const st: any = { x: 0, y: 0, dirty: false, offPending: false, sid: null, last: null, pending: {} };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      st.x = e.clientX / w;
      st.y = e.clientY / h;
      st.dirty = true;
      st.offPending = false;
      if (latest.current.draw && e.shiftKey) {
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
      const payload: any = { id: cur.id, n: cur.name, a: cur.avatar, x: round4(st.x), y: round4(st.y) };
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
  }, [allowed, share, interval]);

  if (!allowed) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 w-screen h-screen pointer-events-none z-[890]" />
      {see &&
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
                <span className="inline-flex w-4 h-4 items-center justify-center"><AvatarGlyph avatar={c.avatar} fallback="" /></span> {c.name}
              </span>
            </div>
          );
        })}
      {hint && share && draw && (
        <div className="max-md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-[900] pointer-events-none animate-fadein bg-gray-900/90 border border-purple-700 text-gray-200 text-xs font-bold rounded-full px-4 py-2 shadow-xl">
          ✏️ Maintiens <kbd className="bg-gray-700 rounded px-1.5 py-0.5">Maj</kbd> et bouge la souris pour gribouiller
        </div>
      )}
    </>
  );
});

// ---------- Bouton + réglages (visible dans tous les jeux, au-dessus de la bulle de chat) ----------
const Switch = ({ on, onChange, icon, label, hint, disabled = false }: { on: boolean; onChange: (v: boolean) => void; icon: React.ReactNode; label: string; hint: string; disabled?: boolean }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!on)}
    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/5 active:scale-[0.98] cursor-pointer'}`}
  >
    <span className={`shrink-0 ${on ? 'text-purple-300' : 'text-gray-500'}`}>{icon}</span>
    <span className="flex-1 min-w-0">
      <span className="block text-sm font-bold text-gray-100">{label}</span>
      <span className="block text-[11px] text-gray-500 leading-snug">{hint}</span>
    </span>
    <span className={`shrink-0 w-9 h-5 rounded-full p-0.5 transition-colors ${on ? 'bg-purple-300' : 'bg-gray-700'}`} aria-hidden="true">
      <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
    </span>
  </button>
);

const CursorControls = ({ prefs, update }: { prefs: CursorPrefs; update: (p: Partial<CursorPrefs>) => void }) => {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const anyOn = prefs.see || prefs.share;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Raccourci : Alt + C coupe / rétablit tout d'un coup
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        update(anyOn ? { see: false, share: false } : { see: true, share: true });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyOn]);

  return (
    <div ref={boxRef} className="fixed bottom-[5.5rem] right-4 z-[940] max-md:hidden flex flex-col items-end gap-2">
      {open && (
        <div role="dialog" aria-label="Réglages des curseurs" className="w-72 paper p-2 animate-fadein shadow-2xl">
          <p className="eyebrow px-3 pt-2 pb-1">Curseurs partagés</p>
          <Switch on={prefs.see} onChange={(v) => update({ see: v })} icon={<Eye size={18} />} label="Voir les curseurs des autres" hint="Leur souris apparaît sur ton écran." />
          <Switch on={prefs.share} onChange={(v) => update(v ? { share: true } : { share: false, draw: prefs.draw })} icon={<MousePointer2 size={18} />} label="Montrer mon curseur" hint="Les autres voient ta souris bouger." />
          <Switch on={prefs.share && prefs.draw} disabled={!prefs.share} onChange={(v) => update({ draw: v })} icon={<Pencil size={18} />} label="Dessiner (Maj + souris)" hint="Tes gribouillis s’effacent tout seuls." />
          <div className="flex items-center justify-between px-3 pt-2 pb-1 text-[11px] text-gray-500 border-t border-gray-800 mt-1">
            <span>Raccourci : <kbd className="bg-gray-800 rounded px-1">Alt</kbd> + <kbd className="bg-gray-800 rounded px-1">C</kbd></span>
            <button type="button" onClick={() => update(anyOn ? { see: false, share: false } : { see: true, share: true, draw: true })} className="font-bold text-purple-300 hover:text-purple-200 cursor-pointer">{anyOn ? 'Tout couper' : 'Tout activer'}</button>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={anyOn ? 'Curseurs partagés : réglages (Alt + C pour tout couper)' : 'Curseurs partagés désactivés : réglages (Alt + C pour réactiver)'}
        aria-label="Réglages des curseurs partagés"
        className={`relative w-10 h-10 rounded-full flex items-center justify-center shadow-lg shadow-black/50 transition active:scale-90 cursor-pointer ${anyOn ? 'bg-gray-800 hover:bg-gray-700 text-purple-300' : 'bg-gray-900 hover:bg-gray-800 text-gray-500'}`}
      >
        <MousePointer2 size={18} />
        {!anyOn && <span className="absolute w-6 h-0.5 bg-red-500 rotate-45 rounded" aria-hidden="true" />}
        {anyOn && prefs.see && prefs.share && <Check size={10} className="absolute -top-0.5 -right-0.5 bg-emerald-500 text-white rounded-full p-[1px]" aria-hidden="true" />}
      </button>
    </div>
  );
};

// À monter une seule fois par jeu (c'est ChatWidget qui s'en charge)
export const SharedCursors = ({ channelRef, me, allowed, playerCount }: { channelRef: React.MutableRefObject<any>; me: { id: string | null; name: string; avatar: string }; allowed: boolean; playerCount: number }) => {
  const { prefs, update } = useCursorPrefs();
  const [hasMouse, setHasMouse] = useState(false);
  useEffect(() => {
    setHasMouse(window.matchMedia ? window.matchMedia('(pointer: fine)').matches : true);
  }, []);
  if (!hasMouse || !me.id) return null;
  return (
    <>
      <CursorLayer channelRef={channelRef} me={me as any} allowed={allowed} prefs={prefs} playerCount={playerCount} />
      {allowed && <CursorControls prefs={prefs} update={update} />}
    </>
  );
};
