'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Users, Sparkles } from 'lucide-react';
import {
  SoundToggle, useSoundAndClickFx, useDiscordAuth, AccountButton, useDirectoryListing, PlayerDot, readIdentity, readEdition,
} from '@/lib/shared';
import { GameArt } from '@/lib/art';
import { dateline, weatherOf } from '@/lib/press';
import { GlobalChat } from '@/lib/globalchat';
import { GameBrowser } from '@/lib/gamebrowser';
import { HOME_GAMES } from '@/lib/catalog';

const LAST_GAME_KEY = 'makeitmeme-last-game';


export default function Home() {
  const { soundOn, toggleSound } = useSoundAndClickFx();
  const auth = useDiscordAuth();
  const [lastGame, setLastGame] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeGame, setCodeGame] = useState('caption-battle');
  const [filter, setFilter] = useState('all');
  const [paper, setPaper] = useState({ date: '', weather: '', edition: 1 });
  const router = useRouter();
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
    router.push(`${game.href}?room=${encodeURIComponent(clean)}`);
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

        {/* Titre + code d'invitation, sur une seule bande */}
        <section className="paper relative overflow-hidden p-5 sm:p-6 mb-4 flex flex-wrap items-center justify-between gap-5">
          <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-purple-400/15 blur-3xl pointer-events-none" aria-hidden="true" />
          <div className="relative min-w-0">
            <h1 className="font-masthead text-3xl sm:text-4xl leading-tight">À quel jeu joue&#8209;t&#8209;on ce&nbsp;soir&nbsp;?</h1>
            <p className="text-gray-400 mt-1.5 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{HOME_GAMES.length} jeux · 2 à 12 joueurs</span>
              <span className="inline-flex items-center gap-1.5 text-purple-300 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-300 animate-pulse" />
                {directory.ready ? `${directory.rooms.length} salon${directory.rooms.length > 1 ? 's' : ''} ouvert${directory.rooms.length > 1 ? 's' : ''}` : 'connexion…'}
              </span>
            </p>
          </div>
          <form onSubmit={joinWithCode} className="relative flex flex-wrap gap-2 w-full lg:w-auto" aria-label="Rejoindre avec un code">
            <select
              value={codeGame}
              onChange={(e) => setCodeGame(e.target.value)}
              aria-label="Jeu du salon"
              className="bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 font-semibold text-sm min-w-0 flex-1 basis-36 lg:flex-none"
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
              className="min-w-0 flex-1 basis-28 lg:w-32 lg:flex-none px-3 py-2.5 bg-gray-950 border border-gray-700 rounded-xl text-center font-mono uppercase font-bold"
            />
            <button type="submit" disabled={!code.trim()} className="tag-dark whitespace-nowrap px-5 py-2.5 flex items-center gap-1.5 disabled:opacity-40 active:scale-95 cursor-pointer">
              Rejoindre <ArrowRight size={14} />
            </button>
          </form>
        </section>

        {/* Jeux filtrables */}
        <GameBrowser lastGame={lastGame} onPick={rememberGame} />

        {/* Chat + salons ouverts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <GlobalChat auth={auth} className="h-[26rem]" />

          <section className="paper p-5 sm:p-6 flex flex-col min-h-0 h-[26rem]" aria-label="Salons ouverts">
            <div className="flex flex-wrap items-end justify-between gap-3 pb-4 border-b border-gray-800">
              <div>
                <p className="eyebrow">En direct</p>
                <h2 className="font-heading text-xl leading-none mt-1.5">Salons ouverts</h2>
              </div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                aria-label="Filtrer les salons par jeu"
                className="bg-gray-950 border border-gray-700 rounded-xl px-3 py-1.5 text-xs font-semibold"
              >
                <option value="all">Tous les jeux</option>
                {HOME_GAMES.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
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
                        <GameArt id={game.id} className="w-12 h-10 shrink-0 rounded-xl bg-gray-950/60 p-1" />
                        <div className="min-w-0 flex-1 basis-40">
                          <p className="font-heading text-base leading-tight truncate">{r.name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1.5">
                            {game.name} · <PlayerDot id={r.code} avatar={r.hostAvatar} /> {r.host}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-sm text-gray-300"><Users size={14} aria-hidden="true" /> {r.count}</span>
                        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${r.started ? 'border-orange-400/50 text-orange-300 bg-orange-400/10' : 'border-purple-400/50 text-purple-300 bg-purple-400/10'}`}>
                          {r.started ? 'En cours' : 'Ouvert'}
                        </span>
                        <Link
                          href={`${game.href}?room=${encodeURIComponent(r.code)}`}
                          onClick={() => rememberGame(game.id)}
                          className="tag-dark px-4 py-2.5 flex items-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          Rejoindre <ArrowRight size={13} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>

        <p className="text-center text-[11px] uppercase tracking-[0.2em] text-gray-600 mt-8 pb-8">
          Aucun imposteur n’a été blessé pendant la conception de ce site
        </p>
      </div>
    </div>
  );
}
