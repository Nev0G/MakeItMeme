'use client';

import React, { useEffect, useState } from 'react';
import { ArrowRight, Users, Clock, Sparkles } from 'lucide-react';
import {
  SoundToggle, useSoundAndClickFx, useDiscordAuth, AccountButton, useDirectoryListing, PlayerDot, readIdentity, readEdition,
} from '@/lib/shared';
import { GameArt } from '@/lib/art';
import { dateline, weatherOf, SIGNS, horoscope, signFromName } from '@/lib/press';

const LAST_GAME_KEY = 'makeitmeme-last-game';
const SIGN_KEY = 'makeitmeme-sign';

const HOME_GAMES = [
  {
    id: 'caption-battle',
    glow: '#60a5fa',
    href: '/caption-battle',
    kicker: 'Concours de légendes',
    name: 'Caption Battle',
    emoji: '😂',
    text: 'Chacun poste un meme, tout le monde le légende, et le salon vote pour la punchline la plus cruelle. Les images y laissent des plumes.',
    players: '2 à 12 joueurs',
    duration: '15 min',
  },
  {
    id: 'imposteur',
    glow: '#9b6bd6',
    href: '/imposteur',
    kicker: 'Enquête',
    name: 'Imposteur',
    emoji: '🕵️',
    text: 'Un mot pour tous, sauf pour un. À chaque tour, un indice : qui bluffe ? Notre rédaction a mené l’enquête, personne n’est au-dessus de tout soupçon.',
    players: '3 à 12 joueurs',
    duration: '10 min',
  },
  {
    id: 'bomb-party',
    glow: '#d9453a',
    href: '/bomb-party',
    kicker: 'Course contre la montre',
    name: 'Bomb Party',
    emoji: '💣',
    text: 'Une syllabe, une bombe, quelques secondes : trouve un mot qui la contient avant que tout explose. Le dernier survivant remporte l’édition.',
    players: '2 à 12 joueurs',
    duration: '10 min',
  },
  {
    id: 'pictionary',
    glow: '#3b82c4',
    href: '/pictionary',
    kicker: 'Dessin & devinettes',
    name: 'Pictionary',
    emoji: '🎨',
    text: 'Un dessinateur, un mot secret, et toute la bande qui crie des bêtises. Pinceau arc-en-ciel, tampons, indices et chaos : le crayon n’a jamais été aussi dangereux.',
    players: '3 à 12 joueurs',
    duration: '15 min',
  },
  {
    id: 'blind-test',
    glow: '#e69d59',
    href: '/blind-test',
    kicker: 'Musiques & images',
    name: 'Blind Test',
    emoji: '🎧',
    text: 'Un extrait sonore ou une image floutée qui se dévoile peu à peu : musiques, films, séries, jeux vidéo, anime. Le plus rapide à trouver rafle les points.',
    players: '2 à 12 joueurs',
    duration: '15 min',
  },
  {
    id: 'top-ten',
    glow: '#fb7185',
    href: '/top-ten',
    kicker: 'Coopératif',
    name: 'Top Ten',
    emoji: '🔟',
    text: 'Chacun reçoit un numéro secret de 1 à 100 et répond au thème en conséquence. Le capitaine doit remettre tout le monde dans l’ordre sans perdre ses vies.',
    players: '3 à 12 joueurs',
    duration: '20 min',
  },
  {
    id: 'codenames',
    glow: '#b5382e',
    href: '/codenames',
    kicker: 'Mots & espionnage',
    name: 'Codenames',
    emoji: '🕵️',
    text: 'Deux équipes, deux maîtres-espions. Un indice, un nombre : retrouve tes agents sur le plateau et évite l’assassin.',
    players: '4 à 12 joueurs',
    duration: '20 min',
  },
  {
    id: 'quoridor',
    glow: '#fb7185',
    href: '/quoridor',
    kicker: 'Stratégie & blocus',
    name: 'Quoridor',
    emoji: '🧱',
    text: 'Traverse le plateau avant les autres, et dresse des murs pour leur barrer la route. Un jeu de blocus où chaque mur compte.',
    players: '2 à 4 joueurs',
    duration: '15 min',
  },
  {
    id: 'pipopipette',
    glow: '#43bfaa',
    href: '/pipopipette',
    kicker: 'Points & carrés',
    name: 'Pipopipette',
    emoji: '🔲',
    text: 'Relie les points un trait à la fois et ferme des carrés pour les rafler. Qui osera poser le troisième côté ?',
    players: '2 à 4 joueurs',
    duration: '10 min',
  },
];

const STEPS = [
  { n: 'I', title: 'Choisis ton jeu', text: 'Une carte à la une, un clic.' },
  { n: 'II', title: 'Crée ton salon', text: 'Un code à 6 lettres, fermé ou ouvert.' },
  { n: 'III', title: 'Lance la partie', text: 'Dès que la bande est là, le host démarre.' },
];

export default function Home() {
  const { soundOn, toggleSound } = useSoundAndClickFx();
  const auth = useDiscordAuth();
  const [lastGame, setLastGame] = useState(null);
  const [code, setCode] = useState('');
  const [codeGame, setCodeGame] = useState('caption-battle');
  const [filter, setFilter] = useState('all');
  const [paper, setPaper] = useState({ date: '', weather: '', edition: 1 });
  const [sign, setSign] = useState(0);
  const directory = useDirectoryListing();
  const visibleRooms = directory.rooms.filter((r) => filter === 'all' || r.game === filter);

  useEffect(() => {
    // Anciens liens d'invitation (/?room=XXXX) : ils pointaient vers Caption Battle
    const room = new URLSearchParams(window.location.search).get('room');
    if (room) {
      window.location.replace(`/caption-battle?room=${encodeURIComponent(room)}`);
      return;
    }
    setPaper({ date: dateline(), weather: weatherOf(), edition: readEdition() + 1 });
    try {
      setLastGame(localStorage.getItem(LAST_GAME_KEY));
      const savedSign = localStorage.getItem(SIGN_KEY);
      setSign(savedSign !== null ? Number(savedSign) : signFromName(readIdentity()?.name || 'lecteur'));
    } catch {
      // stockage indisponible
    }
  }, []);

  const rememberGame = (id) => {
    try {
      localStorage.setItem(LAST_GAME_KEY, id);
    } catch {
      // ignore
    }
  };
  const changeSign = (value) => {
    setSign(value);
    try {
      localStorage.setItem(SIGN_KEY, String(value));
    } catch {
      // ignore
    }
  };

  const joinWithCode = (e) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    const game = HOME_GAMES.find((g) => g.id === codeGame) || HOME_GAMES[0];
    rememberGame(game.id);
    window.location.href = `${game.href}?room=${encodeURIComponent(clean)}`;
  };

  const fortune = horoscope(sign);
  const advised = HOME_GAMES.find((g) => g.id === fortune.game);

  // Taille de chaque tuile dans la grille bento (desktop)
  const SPAN: Record<string, string> = {
    'caption-battle': 'lg:col-span-2',
    pictionary: 'lg:row-span-2',
    imposteur: 'lg:row-span-2',
  };

  return (
    <div className="relative z-10 min-h-screen px-4 sm:px-8 py-4 md:py-6 md:overflow-y-auto md:h-[100dvh] text-white">
      <div className="max-w-[88rem] mx-auto">
        {/* Barre du haut */}
        <header className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-300 to-purple-500 flex items-center justify-center shadow-lg shrink-0">
              <Sparkles size={22} className="text-gray-950" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-2xl leading-none">MakeItMeme</p>
              <p className="text-xs text-gray-500 mt-1 truncate">Les jeux entre potes {paper.weather ? `· ${paper.weather}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto sm:min-w-[22rem]">
            <div className="flex-1 min-w-0">
              <AccountButton auth={auth} className="" />
            </div>
            <SoundToggle on={soundOn} onToggle={toggleSound} />
          </div>
        </header>

        {/* Bento */}
        <main className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(13rem,auto)] lg:grid-flow-dense">
          {/* Hero + code */}
          <section className="paper p-6 sm:p-8 flex flex-col justify-between sm:col-span-2 lg:row-span-2 overflow-hidden">
            <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-purple-400/20 blur-3xl pointer-events-none" aria-hidden="true" />
            <div className="relative">
              <p className="eyebrow">Jeux entre potes · n° {paper.edition}</p>
              <h1 className="font-masthead text-4xl sm:text-5xl lg:text-6xl mt-3 leading-[1.02]">À quel jeu joue&#8209;t&#8209;on ce&nbsp;soir&nbsp;?</h1>
              <p className="text-gray-400 mt-4 text-base max-w-md">
                {HOME_GAMES.length} jeux, zéro excuse. Crée un salon, invite la bande, et que le meilleur gagne.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-5 text-xs font-semibold">
                <span className="rounded-full border border-gray-700 bg-gray-900/60 px-3 py-1.5">{HOME_GAMES.length} jeux</span>
                <span className="rounded-full border border-gray-700 bg-gray-900/60 px-3 py-1.5">2 à 12 joueurs</span>
                <span className="rounded-full border border-purple-400/40 bg-purple-400/10 text-purple-300 px-3 py-1.5 inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-300 animate-pulse" />
                  {directory.ready ? `${directory.rooms.length} salon${directory.rooms.length > 1 ? 's' : ''} ouvert${directory.rooms.length > 1 ? 's' : ''}` : 'connexion…'}
                </span>
              </div>
            </div>
            <form onSubmit={joinWithCode} className="relative mt-8 rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
              <p className="font-heading text-lg leading-tight">Tu as un code&nbsp;?</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <select
                  value={codeGame}
                  onChange={(e) => setCodeGame(e.target.value)}
                  aria-label="Jeu du salon"
                  className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 font-semibold text-sm min-w-0 flex-1 basis-36"
                >
                  {HOME_GAMES.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="CODE"
                  aria-label="Code du salon"
                  className="min-w-0 flex-1 basis-28 px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-center font-mono uppercase font-bold"
                />
                <button type="submit" disabled={!code.trim()} className="tag-dark px-5 py-2.5 flex items-center gap-1.5 disabled:opacity-40 active:scale-95 cursor-pointer">
                  Rejoindre <ArrowRight size={14} />
                </button>
              </div>
            </form>
          </section>

          {/* Les jeux */}
          {HOME_GAMES.map((g) => {
            const isLast = lastGame === g.id;
            const wide = g.id === 'caption-battle';
            const tall = !wide && !!SPAN[g.id];
            return (
              <a
                key={g.id}
                href={g.href}
                onClick={() => rememberGame(g.id)}
                style={{ '--glow': g.glow } as React.CSSProperties}
                className={`group deco-card relative overflow-hidden flex flex-col justify-end p-5 min-h-[13rem] cursor-pointer ${SPAN[g.id] || ''}`}
              >
                <div className="!absolute inset-0 print-photo !rounded-none" aria-hidden="true">
                  <GameArt id={g.id} className={`print-subject absolute opacity-90 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-2 ${wide ? 'top-0 right-2 w-[36%] h-[85%]' : tall ? 'top-3 left-1/2 -translate-x-1/2 w-[85%] h-[50%]' : 'top-1 right-1 w-[48%] h-[58%]'}`} />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/55 to-transparent" aria-hidden="true" />
                {isLast && <span className="stamp absolute left-4 top-4 z-10">Ton dernier jeu</span>}
                <div className="relative z-10">
                  <p className="eyebrow">{g.kicker}</p>
                  <h3 className="font-heading text-2xl sm:text-3xl mt-1 leading-tight">{g.name}</h3>
                  {(wide || tall) && <p className="text-sm leading-relaxed text-gray-300 mt-2 max-w-md line-clamp-3">{g.text}</p>}
                  <div className="flex items-center justify-between gap-3 mt-3">
                    <div className="flex items-center gap-3 text-xs font-medium text-gray-400">
                      <span className="inline-flex items-center gap-1.5"><Users size={13} aria-hidden="true" /> {g.players}</span>
                      <span className="inline-flex items-center gap-1.5"><Clock size={13} aria-hidden="true" /> {g.duration}</span>
                    </div>
                    <span className="w-9 h-9 rounded-full bg-white/10 group-hover:bg-purple-300 group-hover:text-gray-950 flex items-center justify-center transition shrink-0" aria-hidden="true">
                      <ArrowRight size={16} />
                    </span>
                  </div>
                </div>
              </a>
            );
          })}

          {/* Salons ouverts */}
          <section className="paper p-5 sm:p-6 sm:col-span-2 lg:col-span-3 lg:row-span-2 flex flex-col min-h-0">
            <div className="flex flex-wrap items-end justify-between gap-3 pb-4 border-b border-gray-800">
              <div>
                <p className="eyebrow">En direct</p>
                <h2 className="font-heading text-2xl leading-none mt-1.5">Salons ouverts</h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[{ id: 'all', label: 'Tous' }, ...HOME_GAMES.map((g) => ({ id: g.id, label: g.name }))].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition active:scale-95 cursor-pointer ${
                      filter === f.id ? 'bg-purple-300 text-gray-950 border-purple-300' : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {!directory.ready ? (
                <p className="text-sm text-gray-500 mt-5">Recherche des salons…</p>
              ) : visibleRooms.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-gray-700 px-4 py-10 text-center">
                  <p className="font-heading text-lg">Aucun salon pour le moment</p>
                  <p className="text-sm text-gray-500 mt-1">Sois le premier : choisis un jeu, active « Ouvert » et lance ton salon.</p>
                </div>
              ) : (
                <ul className="mt-2 divide-y divide-gray-800">
                  {visibleRooms.map((r) => {
                    const game = HOME_GAMES.find((g) => g.id === r.game);
                    if (!game) return null;
                    return (
                      <li key={`${r.game}-${r.code}`} className="animate-fadein flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
                        <GameArt id={game.id} className="w-14 h-10 shrink-0 rounded-xl bg-gray-950/60" />
                        <div className="min-w-0 flex-1 basis-48">
                          <p className="font-heading text-base leading-tight truncate">{r.name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1.5">
                            {game.name} · <PlayerDot id={r.code} avatar={r.hostAvatar} /> {r.host}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-sm text-gray-300"><Users size={14} aria-hidden="true" /> {r.count}</span>
                        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${r.started ? 'border-orange-400/50 text-orange-300 bg-orange-400/10' : 'border-purple-400/50 text-purple-300 bg-purple-400/10'}`}>
                          {r.started ? 'En cours' : 'Ouvert'}
                        </span>
                        <a
                          href={`${game.href}?room=${encodeURIComponent(r.code)}`}
                          onClick={() => rememberGame(game.id)}
                          className="tag-dark px-4 py-2.5 flex items-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          Rejoindre <ArrowRight size={13} />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* Horoscope */}
          <aside className="parchment p-5 flex flex-col">
            <p className="eyebrow flex items-center gap-1.5"><Sparkles size={13} aria-hidden="true" /> Horoscope du joueur</p>
            <div className="flex items-center gap-2 mt-3">
              <select
                value={sign}
                onChange={(e) => changeSign(Number(e.target.value))}
                className="bg-gray-950 border border-gray-700 rounded-xl px-2.5 py-1.5 text-sm font-semibold"
                aria-label="Ton signe"
              >
                {SIGNS.map((name, idx) => (
                  <option key={name} value={idx}>{name}</option>
                ))}
              </select>
              <span className="text-xs text-gray-500">du jour</span>
            </div>
            <p className="font-heading text-base leading-snug mt-4 text-gray-200 flex-1">« {fortune.text} »</p>
            {advised && (
              <a href={advised.href} onClick={() => rememberGame(advised.id)} className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-purple-300 hover:text-purple-200 transition cursor-pointer">
                Jeu conseillé : {advised.name} <ArrowRight size={14} />
              </a>
            )}
          </aside>

          {/* Mode d'emploi */}
          {STEPS.map((s, i) => (
            <section key={s.n} className="paper p-5 flex flex-col justify-between lg:col-span-1">
              <span className="font-masthead text-4xl leading-none">{i + 1}</span>
              <div>
                <p className="font-heading text-lg leading-tight">{s.title}</p>
                <p className="text-sm text-gray-500 mt-1">{s.text}</p>
              </div>
            </section>
          ))}
        </main>

        <p className="text-center text-[11px] uppercase tracking-[0.2em] text-gray-600 mt-8 pb-8">
          Aucun imposteur n’a été blessé pendant la conception de ce site
        </p>
      </div>
    </div>
  );
}
