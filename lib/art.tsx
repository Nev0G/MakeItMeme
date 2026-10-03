import React from 'react';

// Illustrations des jeux, dessinées en SVG (art déco : or, nuit, âmes turquoise).
// <GameArt id="bomb-party" /> remplit son conteneur ; <GameIcon id="..." /> est la version compacte.

const Defs = ({ p }) => (
  <defs>
    <linearGradient id={`${p}-gold`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#f7ffd0" />
      <stop offset="0.45" stopColor="#c8ee6a" />
      <stop offset="1" stopColor="#6f8f22" />
    </linearGradient>
    <radialGradient id={`${p}-soul`} cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#43bfaa" stopOpacity="0.55" />
      <stop offset="1" stopColor="#43bfaa" stopOpacity="0" />
    </radialGradient>
    <radialGradient id={`${p}-ember`} cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#f08a3a" stopOpacity="0.65" />
      <stop offset="1" stopColor="#f08a3a" stopOpacity="0" />
    </radialGradient>
    <linearGradient id={`${p}-night`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#1b2a30" />
      <stop offset="1" stopColor="#070a0c" />
    </linearGradient>
  </defs>
);

// Fond commun : halo, anneau et rayons de soleil art déco
const Backdrop = ({ p, glow = 'soul' }) => (
  <g>
    <circle cx="100" cy="70" r="64" fill={`url(#${p}-${glow})`} />
    <g stroke="#c8ee6a" strokeOpacity="0.22" strokeWidth="1">
      {Array.from({ length: 16 }).map((_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return <line key={i} x1={100 + Math.cos(a) * 52} y1={70 + Math.sin(a) * 52} x2={100 + Math.cos(a) * 66} y2={70 + Math.sin(a) * 66} />;
      })}
    </g>
    <circle cx="100" cy="70" r="50" fill="none" stroke="#c8ee6a" strokeOpacity="0.45" strokeWidth="1.2" />
  </g>
);

const CaptionArt = ({ p }) => (
  <g>
    <Backdrop p={p} glow="ember" />
    {/* tableau */}
    <g transform="rotate(-7 100 72)">
      <rect x="52" y="38" width="96" height="70" fill={`url(#${p}-gold)`} />
      <rect x="58" y="44" width="84" height="58" fill={`url(#${p}-night)`} />
      <circle cx="118" cy="62" r="9" fill="#e4f9a8" />
      <circle cx="118" cy="62" r="15" fill="#e4f9a8" opacity="0.18" />
      <path d="M58 102 L78 74 L92 90 L108 68 L142 102 Z" fill="#14343a" />
      <path d="M58 102 L78 74 L86 84 L70 102 Z" fill="#1f5a5a" />
      <path d="M96 102 L108 68 L120 84 L112 102 Z" fill="#1f5a5a" opacity="0.8" />
      <g stroke="#4d6a14" strokeWidth="1">
        <path d="M52 38 h12 v3 h-9 v9 h-3 Z" fill="#f7ffd0" />
        <path d="M148 38 h-12 v3 h9 v9 h3 Z" fill="#f7ffd0" />
        <path d="M52 108 h12 v-3 h-9 v-9 h-3 Z" fill="#f7ffd0" />
        <path d="M148 108 h-12 v-3 h9 v-9 h3 Z" fill="#f7ffd0" />
      </g>
    </g>
    {/* bulle de légende */}
    <path d="M118 14 h56 a8 8 0 0 1 8 8 v22 a8 8 0 0 1 -8 8 h-30 l-14 12 v-12 h-12 a8 8 0 0 1 -8 -8 v-22 a8 8 0 0 1 8 -8 Z" fill="#0b1114" stroke={`url(#${p}-gold)`} strokeWidth="2.5" />
    <g fill="#43bfaa">
      <circle cx="132" cy="33" r="3.4" />
      <circle cx="146" cy="33" r="3.4" />
      <circle cx="160" cy="33" r="3.4" />
    </g>
    {/* plume */}
    <g transform="rotate(38 38 112)">
      <path d="M38 80 C52 92 52 122 38 140 C24 122 24 92 38 80 Z" fill={`url(#${p}-gold)`} stroke="#4d6a14" strokeWidth="1" />
      <path d="M38 88 V136" stroke="#4d6a14" strokeWidth="1.2" />
    </g>
  </g>
);

const ImposteurArt = ({ p }) => (
  <g>
    <Backdrop p={p} glow="ember" />
    {/* silhouette */}
    <path d="M46 138 C48 106 70 98 100 98 C130 98 152 106 154 138 Z" fill={`url(#${p}-night)`} stroke="#c8ee6a" strokeOpacity="0.5" />
    <path d="M100 98 L88 138 M100 98 L112 138" stroke="#c8ee6a" strokeOpacity="0.5" />
    <ellipse cx="100" cy="72" rx="22" ry="27" fill="#0b1114" stroke="#c8ee6a" strokeOpacity="0.45" />
    {/* oeil unique qui brille */}
    <ellipse cx="108" cy="74" rx="6" ry="3.5" fill="#43bfaa" />
    <ellipse cx="108" cy="74" rx="14" ry="9" fill={`url(#${p}-soul)`} />
    <circle cx="109" cy="74" r="1.6" fill="#07100f" />
    {/* chapeau */}
    <ellipse cx="100" cy="52" rx="40" ry="8" fill={`url(#${p}-gold)`} stroke="#4d6a14" />
    <path d="M72 52 C72 28 82 20 100 20 C118 20 128 28 128 52 Z" fill="#141b1f" stroke="#c8ee6a" strokeOpacity="0.6" />
    <path d="M73 46 H127 V52 H73 Z" fill={`url(#${p}-gold)`} />
    {/* loupe */}
    <g transform="rotate(-20 142 98)">
      <circle cx="142" cy="92" r="19" fill="#43bfaa" fillOpacity="0.16" stroke={`url(#${p}-gold)`} strokeWidth="4" />
      <path d="M133 86 Q137 80 145 80" stroke="#fff" strokeOpacity="0.6" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="139" y="110" width="6" height="26" rx="2" fill={`url(#${p}-gold)`} stroke="#4d6a14" />
    </g>
  </g>
);

const BombPartyArt = ({ p }) => (
  <g>
    <Backdrop p={p} glow="ember" />
    {/* mèche */}
    <path d="M108 40 C114 26 128 24 136 14" stroke="#b9d46a" strokeWidth="4" fill="none" strokeLinecap="round" />
    {/* étincelle */}
    <g transform="translate(138 12)">
      <circle r="14" fill={`url(#${p}-ember)`} />
      <path d="M0 -11 L3 -3 L11 0 L3 3 L0 11 L-3 3 L-11 0 L-3 -3 Z" fill="#fff3c4" />
      <path d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z" fill="#f08a3a" />
    </g>
    {/* bombe */}
    <circle cx="96" cy="84" r="42" fill="#0b1114" stroke="#c8ee6a" strokeOpacity="0.7" strokeWidth="2" />
    <circle cx="96" cy="84" r="42" fill={`url(#${p}-soul)`} opacity="0.4" />
    <path d="M70 66 A32 32 0 0 1 98 50" stroke="#fff" strokeOpacity="0.45" strokeWidth="5" fill="none" strokeLinecap="round" />
    <rect x="84" y="38" width="24" height="14" rx="3" fill={`url(#${p}-gold)`} stroke="#4d6a14" />
    <rect x="80" y="48" width="32" height="5" fill={`url(#${p}-gold)`} />
    {/* syllabe gravée */}
    <text x="96" y="97" textAnchor="middle" fontFamily="'Unbounded', system-ui, sans-serif" fontWeight="800" fontSize="30" fill={`url(#${p}-gold)`} stroke="#3f5810" strokeWidth="0.6">tion</text>
    {/* braises */}
    <g fill="#f08a3a">
      <circle cx="160" cy="46" r="2.2" />
      <circle cx="170" cy="68" r="1.6" />
      <circle cx="154" cy="22" r="1.4" />
      <circle cx="30" cy="40" r="1.6" fill="#43bfaa" />
      <circle cx="40" cy="116" r="2" fill="#43bfaa" />
    </g>
  </g>
);

const HomeArt = ({ p }) => (
  <g>
    <Backdrop p={p} glow="soul" />
    <path d="M40 74 L100 28 L160 74 V122 H40 Z" fill={`url(#${p}-night)`} stroke={`url(#${p}-gold)`} strokeWidth="4" strokeLinejoin="round" />
    <rect x="84" y="86" width="32" height="36" fill="#43bfaa" fillOpacity="0.25" stroke="#c8ee6a" strokeWidth="2" />
  </g>
);

const ARTS = {
  'caption-battle': CaptionArt,
  imposteur: ImposteurArt,
  'bomb-party': BombPartyArt,
  home: HomeArt,
};

const GameArt = ({ id, className = '', title = '' }) => {
  const Art = ARTS[id] || HomeArt;
  const p = `art-${id}`;
  return (
    <svg viewBox="0 0 200 140" className={className} role={title ? 'img' : undefined} aria-label={title || undefined} aria-hidden={title ? undefined : true} preserveAspectRatio="xMidYMid meet">
      <Defs p={p} />
      <Art p={p} />
    </svg>
  );
};

// Version compacte (barre latérale) : on recadre sur le motif central
const GameIcon = ({ id, className = '' }) => {
  const Art = ARTS[id] || HomeArt;
  const p = `ico-${id}`;
  return (
    <svg viewBox="30 10 140 126" className={className} aria-hidden="true">
      <Defs p={p} />
      <Art p={p} />
    </svg>
  );
};

export { GameArt, GameIcon };
