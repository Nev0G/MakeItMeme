import React from 'react';

// Icônes des jeux : Fluent Emoji (Microsoft, licence MIT), servies depuis /public/icons.
// <GameArt id="bomb-party" /> remplit son conteneur ; <GameIcon id="..." /> est la version compacte (barre de navigation).

const KNOWN = new Set(['caption-battle', 'imposteur', 'bomb-party', 'pictionary', 'blind-test', 'top-ten', 'codenames', 'quoridor', 'pipopipette', 'puissance4', 'uno', 'scrabble', 'liars-bar', 'spyfall', 'loup-garou', 'home']);
const src = (id: string) => `/icons/${KNOWN.has(id) ? id : 'home'}.svg`;

const GameArt = ({ id, className = '', title = '' }: { id: string; className?: string; title?: string }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src(id)} alt={title} aria-hidden={title ? undefined : true} className={`object-contain ${className}`} draggable={false} loading="lazy" decoding="async" />
);

const GameIcon = ({ id, className = '' }: { id: string; className?: string }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src(id)} alt="" aria-hidden="true" className={`object-contain ${className}`} draggable={false} decoding="async" />
);

export { GameArt, GameIcon };
