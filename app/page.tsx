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
    glow: '#43bfaa',
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
    glow: '#f08a3a',
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
    glow: '#e3b955',
    href: '/bomb-party',
    kicker: 'Course contre la montre',
    name: 'Bomb Party',
    emoji: '💣',
    text: 'Une syllabe, une bombe, quelques secondes : trouve un mot qui la contient avant que tout explose. Le dernier survivant remporte l’édition.',
    players: '2 à 12 joueurs',
    duration: '10 min',
  },
  {
    id: 'qui-de-nous',
    glow: '#d9f891',
    href: '/qui-de-nous',
    kicker: 'Sondage',
    name: 'Qui de nous ?',
    emoji: '🫵',
    text: 'Qui est le plus susceptible de… ? Tout le monde désigne un joueur en même temps. Les résultats du sondage vont faire des vagues.',
    players: '2 à 16 joueurs',
    duration: '10 min',
  },
];

const STEPS = [
  { n: 'I', title: 'Choisis ton jeu', text: 'Une carte à la une, un clic.' },
  { n: 'II', title: 'Crée ton salon', text: 'Un code à 6 lettres, fermé ou ouvert.' },
  { n: 'III', title: 'Lance l’édition', text: 'Dès que la bande est là, le host démarre.' },
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

  return (
    <div className="relative z-10 min-h-screen px-4 sm:px-8 py-4 md:py-6 md:overflow-y-auto md:h-[100dvh] text-white">
      <div className="max-w-[92rem] mx-auto">
        {/* Barre du haut */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-800 bg-gray-900/60 backdrop-blur px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <GameArt id="bomb-party" className="w-10 h-9 shrink-0" />
            <div className="min-w-0">
              <p className="font-masthead text-2xl sm:text-3xl leading-none">MakeItMeme</p>
              <p className="text-[11px] text-gray-500 mt-1 truncate">Les jeux entre potes · {paper.weather || ' '}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto sm:min-w-[22rem]">
            <div className="flex-1 min-w-0">
              <AccountButton auth={auth} className="" />
            </div>
            <SoundToggle on={soundOn} onToggle={toggleSound} />
          </div>
        </header>

        {/* Hero */}
        <section className="text-center pt-10 pb-8 sm:pt-14">
          <p className="eyebrow">Jeux entre potes · édition n° {paper.edition}</p>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl mt-4 ink-in">À quel jeu joue-t-on ce soir&nbsp;?</h1>
          <p className="text-gray-400 mt-5 text-base sm:text-lg max-w-2xl mx-auto">
            Quatre jeux, zéro excuse. Crée un salon, invite la bande, et que le meilleur gagne.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6 text-xs font-bold">
            <span className="rounded-full border border-gray-800 bg-gray-900/60 px-3 py-1.5">4 jeux</span>
            <span className="rounded-full border border-gray-800 bg-gray-900/60 px-3 py-1.5">2 à 16 joueurs</span>
            <span className="rounded-full border border-purple-400/40 bg-purple-400/10 text-purple-300 px-3 py-1.5 inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-300 animate-pulse" />
              {directory.ready ? `${directory.rooms.length} salon${directory.rooms.length > 1 ? 's' : ''} ouvert${directory.rooms.length > 1 ? 's' : ''}` : 'connexion…'}
            </span>
          </div>
        </section>

        {/* Les jeux */}
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {HOME_GAMES.map((g) => {
            const isLast = lastGame === g.id;
            return (
              <a
                key={g.id}
                href={g.href}
                onClick={() => rememberGame(g.id)}
                style={{ '--glow': g.glow } as React.CSSProperties}
                className="group deco-card relative flex flex-col p-4"
              >
                {isLast && <span className="stamp absolute right-4 top-4 z-10">Ton dernier jeu</span>}
                <div className="print-photo h-48 flex items-center justify-center">
                  <GameArt id={g.id} title={g.name} className="print-subject h-full w-full p-3 transition-transform duration-500 group-hover:scale-110" />
                </div>
                <div className="px-1 pt-4 flex-1 flex flex-col">
                  <p className="eyebrow">{g.kicker}</p>
                  <h3 className="font-heading text-2xl mt-1.5 leading-tight">{g.name}</h3>
                  <p className="text-sm leading-relaxed text-gray-400 mt-2 flex-1">{g.text}</p>
                  <div className="flex items-center gap-4 text-[11px] font-semibold text-gray-500 mt-4">
                    <span className="inline-flex items-center gap-1.5"><Users size={13} /> {g.players}</span>
                    <span className="inline-flex items-center gap-1.5"><Clock size={13} /> ~{g.duration}</span>
                  </div>
                  <div className="tag-dark mt-4 py-3 text-center flex items-center justify-center gap-2">
                    Jouer <ArrowRight size={14} />
                  </div>
                </div>
              </a>
            );
          })}
        </section>

        {/* Salons ouverts + horoscope / code */}
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr] mt-8">
          <div className="paper p-5 sm:p-6">
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
                    className={`px-3 py-1.5 text-xs font-bold rounded-full border transition active:scale-95 ${
                      filter === f.id ? 'bg-purple-300 text-gray-950 border-purple-300' : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {!directory.ready ? (
              <p className="text-sm text-gray-500 mt-5">Recherche des salons…</p>
            ) : visibleRooms.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-gray-700 px-4 py-10 text-center">
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
                      <GameArt id={game.id} className="w-14 h-10 shrink-0 rounded-lg bg-gray-950/60" />
                      <div className="min-w-0 flex-1 basis-48">
                        <p className="font-heading text-base leading-tight truncate">{r.name}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1.5">
                          {game.name} · <PlayerDot id={r.code} avatar={r.hostAvatar} /> {r.host}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-sm text-gray-300"><Users size={14} /> {r.count}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${r.started ? 'border-orange-400/50 text-orange-300 bg-orange-400/10' : 'border-purple-400/50 text-purple-300 bg-purple-400/10'}`}>
                        {r.started ? 'En cours' : 'Ouvert'}
                      </span>
                      <a
                        href={`${game.href}?room=${encodeURIComponent(r.code)}`}
                        onClick={() => rememberGame(game.id)}
                        className="tag-dark px-4 py-2.5 flex items-center gap-1.5 active:scale-95"
                      >
                        Rejoindre <ArrowRight size={13} />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <aside className="space-y-6">
            {/* Horoscope */}
            <div className="paper p-5">
              <p className="eyebrow flex items-center gap-1.5"><span className="twinkle">✦</span> Horoscope du joueur</p>
              <div className="flex items-center gap-2 mt-3">
                <select
                  value={sign}
                  onChange={(e) => changeSign(Number(e.target.value))}
                  className="bg-gray-950 border border-gray-700 rounded-lg px-2.5 py-1.5 text-sm font-bold"
                  aria-label="Ton signe"
                >
                  {SIGNS.map((name, idx) => (
                    <option key={name} value={idx}>{name}</option>
                  ))}
                </select>
                <span className="text-xs text-gray-500">prévisions du jour</span>
              </div>
              <p className="font-heading text-base leading-snug mt-4 text-gray-200">« {fortune.text} »</p>
              {advised && (
                <a href={advised.href} onClick={() => rememberGame(advised.id)} className="inline-flex items-center gap-1.5 mt-4 text-sm font-bold text-purple-300 hover:text-purple-200 transition">
                  Jeu conseillé : {advised.name} <ArrowRight size={14} />
                </a>
              )}
            </div>

            {/* Code */}
            <form onSubmit={joinWithCode} className="paper p-5">
              <p className="eyebrow">Un correspondant vous attend</p>
              <p className="font-heading text-xl leading-tight mt-1.5">Tu as un code ?</p>
              <select
                value={codeGame}
                onChange={(e) => setCodeGame(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2.5 font-bold mt-3 mb-2"
              >
                {HOME_GAMES.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="CODE"
                  className="min-w-0 flex-1 p-2.5 bg-gray-950 border border-gray-700 rounded-lg text-center font-mono uppercase font-bold"
                />
                <button
                  type="submit"
                  disabled={!code.trim()}
                  className="tag-dark px-5 flex items-center gap-1.5 disabled:opacity-40 active:scale-95"
                >
                  <Sparkles size={13} /> Go
                </button>
              </div>
            </form>
          </aside>
        </section>

        {/* Mode d'emploi + pied de page */}
        <section className="mt-10 border-t border-gray-800 pt-8">
          <ol className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.n} className="flex items-start gap-4">
                <span className="font-masthead text-3xl w-10 shrink-0 leading-none">{i + 1}</span>
                <div>
                  <p className="font-heading text-lg leading-tight">{s.title}</p>
                  <p className="text-sm text-gray-500 mt-1">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-center text-[11px] uppercase tracking-[0.2em] text-gray-600 mt-10 pb-8">
            Aucun imposteur n’a été blessé pendant la conception de ce site
          </p>
        </section>
      </div>
    </div>
  );
}
