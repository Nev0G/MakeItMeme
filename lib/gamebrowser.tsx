'use client';

// Catalogue filtrable des jeux : recherche, type de jeu, nombre de joueurs et durée.
// Les filtres choisis sont mémorisés sur l'appareil.
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Users, Clock, X, SearchX } from 'lucide-react';
import { GameArt } from '@/lib/art';
import { HOME_GAMES, CATEGORIES, type HomeGame } from '@/lib/catalog';

type Filters = { q: string; cat: string; players: number; time: string };
const NONE: Filters = { q: '', cat: 'all', players: 0, time: 'all' };
const KEY = 'makeitmeme-filters';

const PLAYER_CHIPS = [2, 3, 4, 5, 6, 7]; // 7 = « 7 et plus »
const TIME_CHIPS = [
  { id: 'fast', label: '≤ 10 min', test: (m: number) => m <= 10 },
  { id: 'mid', label: '10 – 20 min', test: (m: number) => m > 10 && m <= 20 },
  { id: 'long', label: '+ 20 min', test: (m: number) => m > 20 },
];

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const matches = (g: HomeGame, f: Filters) => {
  if (f.q && !fold(`${g.name} ${g.kicker} ${g.cat} ${g.text}`).includes(fold(f.q.trim()))) return false;
  if (f.cat !== 'all' && g.cat !== f.cat) return false;
  if (f.players && !(g.min <= f.players && (f.players >= 7 ? g.max >= 7 : g.max >= f.players))) return false;
  if (f.time !== 'all' && !TIME_CHIPS.find((t) => t.id === f.time)?.test(g.minutes)) return false;
  return true;
};

const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={`shrink-0 whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-full border transition active:scale-95 cursor-pointer ${
      active ? 'bg-purple-300 text-gray-950 border-purple-300' : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
    }`}
  >
    {children}
  </button>
);

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-3 min-w-0">
    <span className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</span>
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mb-0.5 [scrollbar-width:none]">{children}</div>
  </div>
);

export const GameBrowser = ({ lastGame, onPick }: { lastGame: string | null; onPick: (id: string) => void }) => {
  const [f, setF] = useState<Filters>(NONE);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved) setF({ ...NONE, ...saved, q: '' });
    } catch {
      // stockage indisponible
    }
  }, []);
  const update = (patch: Partial<Filters>) =>
    setF((cur) => {
      const next = { ...cur, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...next, q: '' }));
      } catch {
        // ignore
      }
      return next;
    });
  const reset = () => update(NONE);

  const shown = useMemo(() => HOME_GAMES.filter((g) => matches(g, f)), [f]);
  const active = f.q !== '' || f.cat !== 'all' || f.players !== 0 || f.time !== 'all';

  return (
    <section aria-label="Les jeux" className="mb-4">
      <div className="paper p-4 sm:p-5 mb-3 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[12rem]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={f.q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder="Chercher un jeu…"
              aria-label="Chercher un jeu"
              className="w-full bg-gray-950 border border-gray-700 rounded-xl pl-10 pr-3 py-2.5 text-sm"
            />
          </div>
          <p className="text-sm text-gray-400 font-medium" aria-live="polite">
            <span className="text-white font-bold">{shown.length}</span> jeu{shown.length > 1 ? 'x' : ''} sur {HOME_GAMES.length}
          </p>
          {active && (
            <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-300 hover:text-purple-200 transition cursor-pointer">
              <X size={14} aria-hidden="true" /> Réinitialiser
            </button>
          )}
        </div>
        <Row label="Type">
          <Chip active={f.cat === 'all'} onClick={() => update({ cat: 'all' })}>Tous</Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} active={f.cat === c} onClick={() => update({ cat: f.cat === c ? 'all' : c })}>{c}</Chip>
          ))}
        </Row>
        <Row label="Joueurs">
          <Chip active={f.players === 0} onClick={() => update({ players: 0 })}>Peu importe</Chip>
          {PLAYER_CHIPS.map((n) => (
            <Chip key={n} active={f.players === n} onClick={() => update({ players: f.players === n ? 0 : n })}>{n === 7 ? '7 et +' : `${n}`}</Chip>
          ))}
        </Row>
        <Row label="Durée">
          <Chip active={f.time === 'all'} onClick={() => update({ time: 'all' })}>Peu importe</Chip>
          {TIME_CHIPS.map((t) => (
            <Chip key={t.id} active={f.time === t.id} onClick={() => update({ time: f.time === t.id ? 'all' : t.id })}>{t.label}</Chip>
          ))}
        </Row>
      </div>

      {shown.length === 0 ? (
        <div className="paper px-6 py-12 text-center">
          <SearchX size={32} className="mx-auto text-gray-500" aria-hidden="true" />
          <p className="font-heading text-lg mt-3">Aucun jeu ne correspond</p>
          <p className="text-sm text-gray-500 mt-1">Essaie avec moins de filtres.</p>
          <button type="button" onClick={reset} className="tag-dark px-5 py-2.5 mt-4 text-sm cursor-pointer active:scale-95">Tout afficher</button>
        </div>
      ) : (
        <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {shown.map((g) => (
            <li key={g.id} className="animate-fadein">
              <Link
                href={g.href}
                onClick={() => onPick(g.id)}
                style={{ '--glow': g.glow } as React.CSSProperties}
                className="group deco-card relative flex flex-col h-full p-3.5 sm:p-4 cursor-pointer"
              >
                {lastGame === g.id && <span className="stamp absolute right-2.5 top-2.5 z-10">Dernier jeu</span>}
                <div className="print-photo h-20 sm:h-24 flex items-center justify-center mb-3">
                  <GameArt id={g.id} className="print-subject h-14 sm:h-16 w-14 sm:w-16 transition-transform duration-300 group-hover:scale-110" />
                </div>
                <p className="eyebrow !text-[10px] truncate">{g.cat}</p>
                <h3 className="font-heading text-lg sm:text-xl leading-tight mt-0.5">{g.name}</h3>
                <p className="hidden sm:block text-xs leading-relaxed text-gray-400 mt-1.5 line-clamp-2">{g.text}</p>
                <div className="mt-auto pt-3 flex items-center gap-3 text-[11px] font-medium text-gray-400">
                  <span className="inline-flex items-center gap-1"><Users size={12} aria-hidden="true" /> {g.min === g.max ? g.min : `${g.min}-${g.max}`}</span>
                  <span className="inline-flex items-center gap-1"><Clock size={12} aria-hidden="true" /> {g.minutes} min</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
