'use client';

import React, { useEffect } from 'react';
import { AvatarGlyph, playSfx } from '@/lib/shared';

// Un vrai personnage assis à la table : buste en costume, la tête est la photo de profil du joueur.
// Tout est dimensionné en `em` : la taille se règle avec text-[..px] sur le conteneur (className).
// state : '' | 'talk' (il parle) | 'done' (a répondu) | 'dead' (éliminé) | 'shot' (vient d'être abattu)
export const SeatCharacter = ({ avatar, color, state = '', isMe = false, className = '', children }) => (
  <div className={`char ${state ? `char-${state}` : ''} ${className}`} style={{ '--c': color } as React.CSSProperties}>
    <div className="char-head" style={{ backgroundColor: `${color}33`, borderColor: state === 'talk' ? '#7fe3ff' : color }}>
      <span className="char-face contents"><AvatarGlyph avatar={avatar} /></span>
    </div>
    <svg className="char-body" viewBox="0 0 120 60" aria-hidden="true">
      <rect x="51" y="0" width="18" height="16" rx="4" fill="#d9a77c" />
      <path d="M4 60 Q6 22 42 15 L78 15 Q114 22 116 60 Z" fill={color} />
      <path d="M4 60 Q6 22 42 15 L78 15 Q114 22 116 60 Z" fill="#000" opacity="0.3" />
      <path d="M44 15 L60 40 L76 15 Z" fill="#f4ecd8" />
      <path d="M44 15 L36 36 L58 52 L60 40 Z M76 15 L84 36 L62 52 L60 40 Z" fill={color} />
      <path d="M44 15 L36 36 L58 52 L60 40 Z M76 15 L84 36 L62 52 L60 40 Z" fill="#fff" opacity={isMe ? 0.28 : 0.12} />
      <path d="M57 28 H63 L65 50 L60 56 L55 50 Z" fill="#b3261e" />
      <ellipse cx="20" cy="58" rx="10" ry="5" fill="#d9a77c" />
      <ellipse cx="100" cy="58" rx="10" ry="5" fill="#d9a77c" />
    </svg>
    {children}
  </div>
);

// Scène « abattu » : un pistolet entre, tire, le civil désigné s'écroule.
export const ShootScene = ({ avatar, color, name }) => {
  useEffect(() => {
    const t = setTimeout(() => playSfx('gunshot'), 700);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="shoot-stage relative h-40 w-full overflow-hidden rounded-xl mb-3" role="img" aria-label={`${name} se fait tirer dessus`}>
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/60 to-transparent" />
      <div className="shoot-victim absolute left-[36%] sm:left-1/2 bottom-3">
        <SeatCharacter avatar={avatar} color={color} className="text-[13px] sm:text-[17px]" />
      </div>
      <div className="shoot-gun absolute left-[6%] top-[22%] w-36">
      <svg className="w-full" viewBox="0 0 120 60" aria-hidden="true">
        <rect x="8" y="12" width="92" height="20" rx="4" fill="#4a4f58" />
        <rect x="8" y="12" width="92" height="6" rx="3" fill="#6d7480" />
        <rect x="96" y="16" width="10" height="12" rx="2" fill="#2b2e34" />
        <path d="M16 32 H48 L40 58 H20 Z" fill="#23262b" />
        <path d="M22 36 H44 L38 54 H23 Z" fill="#6b3f22" />
        <path d="M50 32 Q56 46 66 42 L66 32" fill="none" stroke="#2b2e34" strokeWidth="3" />
        <rect x="88" y="8" width="6" height="5" fill="#2b2e34" />
      </svg>
      <svg className="shoot-flash absolute left-[84%] top-0 w-16" viewBox="0 0 60 60" aria-hidden="true">
        <path d="M0 30 L22 22 L18 2 L32 18 L58 8 L40 28 L58 52 L32 40 L20 58 L22 36 Z" fill="#ffd54a" />
        <path d="M6 30 L24 26 L22 14 L32 24 L46 20 L38 30 L46 42 L32 36 L24 46 L24 34 Z" fill="#fff6c8" />
      </svg>
      </div>
      <div className="shoot-bang absolute right-[8%] top-3 font-heading text-4xl font-black text-yellow-300 -rotate-6">BANG !</div>
    </div>
  );
};
