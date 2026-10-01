'use client';

import React, { useEffect, useState } from 'react';
import { ArrowRight, Users, Clock, Sparkles, Radio } from 'lucide-react';
import { SoundToggle, useSoundAndClickFx, useDiscordAuth, AccountButton, useDirectoryListing, PlayerDot } from '@/lib/shared';

const LAST_GAME_KEY = 'makeitmeme-last-game';

const HOME_GAMES = [
  {
    id: 'caption-battle',
    href: '/caption-battle',
    name: 'Caption Battle',
    emoji: '😂',
    art: 'from-purple-700 via-pink-800 to-orange-700',
    text: 'Chacun poste un meme, tout le monde le légende, on vote pour la pire (la meilleure) punchline.',
    players: '2 à 12 joueurs',
    duration: '15 min',
  },
  {
    id: 'imposteur',
    href: '/imposteur',
    name: 'Imposteur',
    emoji: '🕵️',
    art: 'from-red-800 via-orange-800 to-yellow-700',
    text: 'Un mot pour tous… sauf un. Donne des indices, démasque l’imposteur avant qu’il ne te démasque.',
    players: '3 à 12 joueurs',
    duration: '10 min',
  },
  {
    id: 'qui-de-nous',
    href: '/qui-de-nous',
    name: 'Qui de nous ?',
    emoji: '🫵',
    art: 'from-teal-800 via-emerald-800 to-lime-700',
    text: 'Qui est le plus susceptible de… ? Tout le monde désigne un joueur en même temps. Ça va piquer.',
    players: '2 à 16 joueurs',
    duration: '10 min',
  },
];

const STEPS = [
  { n: '1', title: 'Choisis un jeu', text: 'Clique sur une carte pour ouvrir son salon.' },
  { n: '2', title: 'Crée ta room', text: 'Un code à 6 caractères est généré : partage-le ou copie le lien.' },
  { n: '3', title: 'Lance la partie', text: 'Dès que les potes ont rejoint, le host démarre le jeu.' },
];

export default function Home() {
  const { soundOn, toggleSound } = useSoundAndClickFx();
  const auth = useDiscordAuth();
  const [lastGame, setLastGame] = useState(null);
  const [code, setCode] = useState('');
  const [codeGame, setCodeGame] = useState('caption-battle');
  const [filter, setFilter] = useState('all');
  const directory = useDirectoryListing();
  const visibleRooms = directory.rooms.filter((r) => filter === 'all' || r.game === filter);

  useEffect(() => {
    // Anciens liens d'invitation (/?room=XXXX) : ils pointaient vers Caption Battle
    const room = new URLSearchParams(window.location.search).get('room');
    if (room) {
      window.location.replace(`/caption-battle?room=${encodeURIComponent(room)}`);
      return;
    }
    try {
      setLastGame(localStorage.getItem(LAST_GAME_KEY));
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

  const joinWithCode = (e) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    const game = HOME_GAMES.find((g) => g.id === codeGame) || HOME_GAMES[0];
    rememberGame(game.id);
    window.location.href = `${game.href}?room=${encodeURIComponent(clean)}`;
  };

  return (
    <div className="relative z-10 min-h-screen px-4 py-6 md:py-8 md:overflow-y-auto md:h-[100dvh]">
      <div className="max-w-6xl mx-auto">
        {/* En-tête */}
        <header className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-purple-500/20">
          <div className="flex items-center gap-4">
            <span className="w-11 h-11 rounded-full border-2 border-purple-400/70 flex items-center justify-center text-purple-300 text-xl bg-gray-950">
              ✦
            </span>
            <div>
              <h1 className="font-heading text-2xl sm:text-3xl text-purple-100 glow-brass leading-none">MAKE IT MEME</h1>
              <p className="eyebrow mt-1.5">La salle de jeux entre potes</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-64 max-w-full">
              <AccountButton auth={auth} className="" />
            </div>
            <SoundToggle on={soundOn} onToggle={toggleSound} />
          </div>
        </header>

        {/* Sélection du jeu */}
        <section className="panel-worn mt-6 px-5 sm:px-8 pt-6 pb-9">
          <p className="eyebrow">Salle commune · tout se joue dans le navigateur</p>
          <h2 className="inline-block mt-2 mb-7 bg-black/70 px-5 py-2 font-heading text-3xl sm:text-4xl text-purple-100 glow-brass">
            À quel jeu ?
          </h2>

          <div className="flex flex-wrap justify-center gap-6">
            {HOME_GAMES.map((g, i) => {
              const isLast = lastGame === g.id;
              return (
                <a
                  key={g.id}
                  href={g.href}
                  onClick={() => rememberGame(g.id)}
                  className={`group relative block w-64 pb-4 transition-transform duration-200 hover:-translate-y-1.5 hover:rotate-0 ${
                    i % 2 === 0 ? 'paper-tilt-l' : 'paper-tilt-r'
                  }`}
                >
                  <div className={`paper px-3 pt-3 pb-4 ${isLast ? 'paper-green' : ''}`}>
                    {isLast && (
                      <span className="absolute z-10 left-3 right-3 top-[28%] -rotate-3 bg-black/85 text-purple-100 text-center font-heading text-lg py-1.5 tracking-wide">
                        Ton dernier jeu
                      </span>
                    )}
                    <div
                      className={`h-40 flex items-center justify-center bg-gradient-to-br ${g.art} border-2 border-[#2a2114]/70 text-6xl shadow-inner`}
                    >
                      <span className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                        {g.emoji}
                      </span>
                    </div>
                    <h3 className="font-heading text-xl text-center mt-3 text-[#2a2114]">{g.name}</h3>
                    <p className="text-[13px] leading-snug text-center text-[#4a3b20] mt-1.5 min-h-[4.2rem]">{g.text}</p>
                    <div className="flex items-center justify-center gap-3 text-[11px] font-bold text-[#5b4a2c] mt-2">
                      <span className="inline-flex items-center gap-1"><Users size={12} /> {g.players}</span>
                      <span className="inline-flex items-center gap-1"><Clock size={12} /> ~{g.duration}</span>
                    </div>
                    <div className="tag-dark mt-3 py-2 text-center flex items-center justify-center gap-2 group-hover:bg-black transition-colors">
                      Jouer <ArrowRight size={13} />
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        {/* Navigateur de salons ouverts */}
        <section className="panel-worn mt-6 px-5 sm:px-8 pt-6 pb-8">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
            <div>
              <p className="eyebrow flex items-center gap-2">
                <Radio size={12} className="text-teal-300 animate-pulse" /> En direct
              </p>
              <h2 className="inline-block mt-2 bg-black/70 px-4 py-1.5 font-heading text-2xl text-purple-100 glow-brass">
                Salons ouverts
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {[{ id: 'all', label: 'Tous' }, ...HOME_GAMES.map((g) => ({ id: g.id, label: `${g.emoji} ${g.name}` }))].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition active:scale-95 ${
                    filter === f.id ? 'bg-purple-600 border-purple-400 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {!directory.ready ? (
            <p className="text-sm text-gray-500">Recherche des salons…</p>
          ) : visibleRooms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-700 px-4 py-8 text-center">
              <p className="font-bold text-gray-300">Aucun salon ouvert pour le moment</p>
              <p className="text-sm text-gray-500 mt-1">Crée le premier : choisis un jeu et active « Ouvert » avant de lancer ta partie.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {visibleRooms.map((r) => {
                const game = HOME_GAMES.find((g) => g.id === r.game);
                if (!game) return null;
                return (
                  <li key={`${r.game}-${r.code}`} className="animate-fadein flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-gray-800 bg-gray-900/80 px-4 py-3">
                    <span className="text-2xl shrink-0">{game.emoji}</span>
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="font-bold truncate">{r.name}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1.5">
                        {game.name} · <PlayerDot id={r.code} avatar={r.hostAvatar} /> {r.host}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm text-gray-300"><Users size={14} /> {r.count}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${r.started ? 'bg-amber-900/50 text-amber-300' : 'bg-emerald-900/50 text-emerald-300'}`}>
                      {r.started ? 'En cours' : 'En attente'}
                    </span>
                    <a
                      href={`${game.href}?room=${encodeURIComponent(r.code)}`}
                      onClick={() => rememberGame(game.id)}
                      className="bg-purple-600 hover:bg-purple-500 font-bold text-sm px-4 py-2 rounded-lg transition active:scale-95 flex items-center gap-1.5"
                    >
                      Rejoindre <ArrowRight size={14} />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Panneaux du bas */}
        <section className="grid gap-6 mt-6 md:grid-cols-5 pb-10">
          <div className="panel-worn md:col-span-3 px-6 pt-6 pb-8">
            <h3 className="inline-block bg-black/70 px-4 py-1.5 font-heading text-xl text-purple-100">Comment ça marche</h3>
            <ol className="mt-5 space-y-4">
              {STEPS.map((s) => (
                <li key={s.n} className="flex gap-4">
                  <span className="w-9 h-9 shrink-0 rounded-full border-2 border-purple-400/60 flex items-center justify-center font-heading text-purple-200">
                    {s.n}
                  </span>
                  <div>
                    <p className="font-bold text-gray-100">{s.title}</p>
                    <p className="text-sm text-gray-400">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <form onSubmit={joinWithCode} className="panel-worn md:col-span-2 px-6 pt-6 pb-8">
            <h3 className="inline-block bg-black/70 px-4 py-1.5 font-heading text-xl text-purple-100">Tu as un code ?</h3>
            <p className="text-sm text-gray-400 mt-4 mb-4">Choisis le jeu auquel tes potes jouent et colle leur code.</p>
            <select
              value={codeGame}
              onChange={(e) => setCodeGame(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 font-bold mb-3"
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
                placeholder="CODE (ex: AB4F2C)"
                className="min-w-0 flex-1 p-3 bg-gray-950 border border-gray-700 rounded-lg text-center font-mono uppercase font-bold text-white"
              />
              <button
                type="submit"
                disabled={!code.trim()}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 font-bold px-5 rounded-lg transition active:scale-95 flex items-center gap-2"
              >
                <Sparkles size={15} /> Go
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
