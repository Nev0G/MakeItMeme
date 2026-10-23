'use client';

// Briques communes des variantes de jeu : choix d'une option dans le salon, chronomètre de tour.
import React from 'react';
import { Sparkles, Timer } from 'lucide-react';

export type Choice = { value: string | number; label: string };

// Une option à choix unique, modifiable par le host seulement
export const ChoiceRow = ({ label, hint, value, options, onChange, disabled }: {
  label: string; hint?: string; value: string | number; options: Choice[]; onChange: (v: any) => void; disabled?: boolean;
}) => (
  <div className="py-3 first:pt-0 last:pb-0">
    <p className="text-sm font-bold text-gray-200">{label}</p>
    {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
    <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const active = String(o.value) === String(value);
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${
              active ? 'bg-purple-300 text-gray-950 border-purple-300' : 'border-gray-700 text-gray-400'
            } ${disabled ? 'cursor-default opacity-80' : 'hover:text-white hover:border-gray-500 active:scale-95 cursor-pointer'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  </div>
);

// Encadré « Variantes » du salon
export const VariantsPanel = ({ children, isHost }: { children: React.ReactNode; isHost: boolean }) => (
  <div className="text-left mb-5 bg-gray-950/70 border border-gray-800 rounded-xl p-4">
    <h3 className="flex items-center gap-2 text-gray-400 font-bold mb-1 uppercase text-sm"><Sparkles size={16} /> Variantes</h3>
    {!isHost && <p className="text-xs text-gray-500 mb-3">Seul le host peut les modifier.</p>}
    <div className={`divide-y divide-gray-800 ${isHost ? 'mt-3' : ''}`}>{children}</div>
  </div>
);

export const TIMER_OPTIONS: Choice[] = [
  { value: 0, label: 'Sans limite' },
  { value: 15, label: '15 s' },
  { value: 30, label: '30 s' },
  { value: 60, label: '1 min' },
  { value: 90, label: '1 min 30' },
];
export const TimerRow = ({ value, onChange, disabled, hint = 'Si le temps est écoulé, un coup est joué automatiquement.' }: { value: number; onChange: (v: number) => void; disabled?: boolean; hint?: string }) => (
  <ChoiceRow label="Temps par tour" hint={hint} value={value || 0} options={TIMER_OPTIONS} onChange={(v) => onChange(Number(v))} disabled={disabled} />
);

// Échéance du tour suivant (null : pas de chronomètre)
export const nextDeadline = (seconds: number | undefined | null) => (seconds && seconds > 0 ? Date.now() + seconds * 1000 : null);
export const timerOf = (settings: any) => Math.max(0, Number(settings?.timer) || 0);

// Pastille de compte à rebours
export const TurnClock = ({ deadline, now, className = '' }: { deadline: number | null | undefined; now: number; className?: string }) => {
  if (!deadline) return null;
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${left <= 5 ? 'bg-red-600 text-white animate-pulse' : 'bg-black/30'} ${className}`} role="timer" aria-label={`${left} secondes restantes`}>
      <Timer size={12} aria-hidden="true" /> {left} s
    </span>
  );
};
