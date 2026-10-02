'use client';

import React, { useEffect, useState } from 'react';
import { ArrowRight, Users, Clock, Sparkles } from 'lucide-react';
import {
  SoundToggle, useSoundAndClickFx, useDiscordAuth, AccountButton, useDirectoryListing, PlayerDot, readIdentity, readEdition,
} from '@/lib/shared';
import { dateline, weatherOf, SIGNS, horoscope, signFromName } from '@/lib/press';

const LAST_GAME_KEY = 'makeitmeme-last-game';
const SIGN_KEY = 'makeitmeme-sign';

const HOME_GAMES = [
  {
    id: 'caption-battle',
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
    href: '/imposteur',
    kicker: 'Enquête',
    name: 'Imposteur',
    emoji: '🕵️',
    text: 'Un mot pour tous, sauf pour un. À chaque tour, un indice : qui bluffe ? Notre rédaction a mené l’enquête, personne n’est au-dessus de tout soupçon.',
    players: '3 à 12 joueurs',
    duration: '10 min',
  },
  {
    id: 'qui-de-nous',
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
    <div className="relative z-10 min-h-screen px-3 sm:px-6 py-4 md:py-6 md:overflow-y-auto md:h-[100dvh] text-white">
      <div className="max-w-6xl mx-auto">
        {/* Ligne de date */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-y border-white/70 py-1.5 text-[11px] uppercase tracking-[0.18em] font-bold">
          <span>Vol. I · N° {paper.edition}</span>
          <span className="text-center">New York · {paper.date || ' '}</span>
          <span>Édition du soir · 1 $</span>
        </div>

        {/* Titre du journal */}
        <header className="grid items-center gap-4 py-4 md:grid-cols-[1fr_auto_1fr]">
          <div className="hidden md:block border border-white/70 p-3 text-left">
            <p className="eyebrow">Météo du salon</p>
            <p className="font-heading text-sm leading-snug mt-1">{paper.weather || ' '}</p>
          </div>

          <div className="text-center">
            <h1 className="font-masthead text-5xl sm:text-7xl md:text-8xl leading-none tracking-tight">
              <span className="twinkle text-2xl sm:text-4xl align-middle mr-3">✦</span>
              MakeItMeme
              <span className="twinkle text-2xl sm:text-4xl align-middle ml-3" style={{ animationDelay: '1.4s' }}>✦</span>
            </h1>
            <p className="font-heading italic text-sm sm:text-base mt-2 text-gray-500">
              « Tous les jeux dignes d’être joués »
            </p>
          </div>

          <div className="border border-white/70 p-3 text-left">
            <p className="eyebrow">Abonnez-vous</p>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex-1 min-w-0">
                <AccountButton auth={auth} className="" />
              </div>
              <SoundToggle on={soundOn} onToggle={toggleSound} />
            </div>
          </div>
        </header>

        <div className="rule-double" />

        {/* Gros titre */}
        <section className="text-center pt-6 pb-5">
          <p className="eyebrow">Édition spéciale</p>
          <h2 className="font-heading text-4xl sm:text-6xl leading-[0.98] mt-2 ink-in">
            À quel jeu joue-t-on ce soir&nbsp;?
          </h2>
          <p className="italic text-gray-500 mt-3 text-base sm:text-lg">
            Trois jeux, zéro excuse. Crée un salon, invite la bande, et que le meilleur gagne.
          </p>
        </section>

        {/* Les jeux, en colonnes */}
        <section className="grid gap-0 md:grid-cols-3 border-y-[3px] border-double border-white/80">
          {HOME_GAMES.map((g, i) => {
            const isLast = lastGame === g.id;
            return (
              <a
                key={g.id}
                href={g.href}
                onClick={() => rememberGame(g.id)}
                className={`group relative block px-5 py-6 transition-colors hover:bg-purple-900/60 ${i > 0 ? 'md:col-rule border-t md:border-t-0 border-white/40' : ''} ${isLast ? 'bg-purple-900/70' : ''}`}
              >
                {isLast && (
                  <span className="stamp absolute right-4 top-3 z-10 text-xs sm:text-sm">Ton dernier jeu</span>
                )}
                <p className="eyebrow">{g.kicker}</p>
                <h3 className="font-heading text-3xl mt-1 leading-tight">{g.name}</h3>
                <div className="print-photo mt-3 h-40 flex items-center justify-center border border-white/80">
                  <span className="print-subject text-7xl transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
                    {g.emoji}
                  </span>
                </div>
                <p className="text-[11px] italic text-gray-500 mt-1">Photo : la rédaction, en plein jeu</p>
                <p className="dropcap text-[15px] leading-snug mt-3 text-justify hyphens-auto" lang="fr">{g.text}</p>
                <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider text-gray-500 mt-3">
                  <span className="inline-flex items-center gap-1"><Users size={12} /> {g.players}</span>
                  <span className="inline-flex items-center gap-1"><Clock size={12} /> ~{g.duration}</span>
                </div>
                <div className="tag-dark mt-4 py-2.5 text-center flex items-center justify-center gap-2 group-hover:tracking-[0.22em] transition-all">
                  Jouer <ArrowRight size={13} />
                </div>
              </a>
            );
          })}
        </section>

        {/* Petites annonces + horoscope / code */}
        <section className="grid gap-8 md:grid-cols-3 mt-8">
          <div className="md:col-span-2">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-white pb-2">
              <div>
                <p className="eyebrow">En direct · salons ouverts</p>
                <h3 className="font-heading text-3xl leading-none mt-1">Petites annonces</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[{ id: 'all', label: 'Tous' }, ...HOME_GAMES.map((g) => ({ id: g.id, label: `${g.emoji} ${g.name}` }))].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide border transition active:scale-95 ${
                      filter === f.id ? 'bg-white text-gray-950 border-white' : 'border-white/50 text-gray-500 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {!directory.ready ? (
              <p className="text-sm italic text-gray-500 mt-4">Recherche des annonces…</p>
            ) : visibleRooms.length === 0 ? (
              <div className="mt-4 border border-dashed border-white/60 px-4 py-8 text-center">
                <p className="font-heading text-lg">Aucune annonce pour le moment</p>
                <p className="text-sm italic text-gray-500 mt-1">Passe la première : choisis un jeu, active « Ouvert » et lance ton salon.</p>
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-dotted divide-white/60">
                {visibleRooms.map((r) => {
                  const game = HOME_GAMES.find((g) => g.id === r.game);
                  if (!game) return null;
                  return (
                    <li key={`${r.game}-${r.code}`} className="animate-fadein flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                      <span className="text-2xl shrink-0" style={{ filter: 'grayscale(0.6) sepia(0.3)' }}>{game.emoji}</span>
                      <div className="min-w-0 flex-1 basis-48">
                        <p className="font-heading text-lg leading-tight truncate">{r.name}</p>
                        <p className="text-xs italic text-gray-500 flex items-center gap-1.5">
                          {game.name} · <PlayerDot id={r.code} avatar={r.hostAvatar} /> {r.host}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-sm"><Users size={14} /> {r.count}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border ${r.started ? 'border-[#7a4b00] text-[#7a4b00]' : 'border-[#1f5a2b] text-[#1f5a2b]'}`}>
                        {r.started ? 'En cours' : 'Ouvert'}
                      </span>
                      <a
                        href={`${game.href}?room=${encodeURIComponent(r.code)}`}
                        onClick={() => rememberGame(game.id)}
                        className="tag-dark px-4 py-2 flex items-center gap-1.5 hover:tracking-[0.2em] transition-all active:scale-95"
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
            <div className="border-[3px] border-double border-white/80 p-4 bg-gray-950/50">
              <p className="eyebrow flex items-center gap-1.5"><span className="twinkle">✦</span> Horoscope du joueur</p>
              <div className="flex items-center gap-2 mt-2">
                <select
                  value={sign}
                  onChange={(e) => changeSign(Number(e.target.value))}
                  className="bg-gray-950 border border-white/60 px-2 py-1 text-sm font-bold"
                  aria-label="Ton signe"
                >
                  {SIGNS.map((name, idx) => (
                    <option key={name} value={idx}>{name}</option>
                  ))}
                </select>
                <span className="text-xs italic text-gray-500">prévisions du jour</span>
              </div>
              <p className="font-heading text-[17px] leading-snug mt-3 italic">« {fortune.text} »</p>
              {advised && (
                <a href={advised.href} onClick={() => rememberGame(advised.id)} className="inline-flex items-center gap-1.5 mt-3 text-sm font-bold underline decoration-dotted underline-offset-4 hover:text-purple-300">
                  Jeu conseillé : {advised.emoji} {advised.name} <ArrowRight size={13} />
                </a>
              )}
            </div>

            {/* Code */}
            <form onSubmit={joinWithCode} className="border border-white/70 p-4">
              <p className="eyebrow">Un correspondant vous attend</p>
              <p className="font-heading text-xl leading-tight mt-1">Tu as un code ?</p>
              <select
                value={codeGame}
                onChange={(e) => setCodeGame(e.target.value)}
                className="w-full bg-gray-950 border border-white/60 p-2 font-bold mt-3 mb-2"
              >
                {HOME_GAMES.map((g) => (
                  <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="CODE"
                  className="min-w-0 flex-1 p-2 bg-gray-950 border border-white/60 text-center font-mono uppercase font-bold"
                />
                <button
                  type="submit"
                  disabled={!code.trim()}
                  className="tag-dark px-4 flex items-center gap-1.5 disabled:opacity-40 active:scale-95"
                >
                  <Sparkles size={13} /> Go
                </button>
              </div>
            </form>
          </aside>
        </section>

        {/* Mode d'emploi + pied de page */}
        <section className="mt-10 border-t-[3px] border-double border-white/80 pt-4">
          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="flex items-baseline gap-3">
                <span className="font-heading text-3xl text-purple-300 w-10 shrink-0">{s.n}.</span>
                <div>
                  <p className="font-heading text-lg leading-tight">{s.title}</p>
                  <p className="text-sm italic text-gray-500">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-center text-[11px] uppercase tracking-[0.2em] text-gray-500 mt-8 pb-8">
            ✦ Imprimé sur du pixel recyclé · Aucun imposteur n’a été blessé pendant la rédaction ✦
          </p>
        </section>
      </div>
    </div>
  );
}
