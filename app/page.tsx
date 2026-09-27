'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Play, Image as ImageIcon, Video, Music, Link as LinkIcon, Send, Trophy, Users, Loader2, Check, ThumbsUp } from 'lucide-react';

// ==========================================
// 1. CONFIGURATION SUPABASE
// ==========================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hidtcsztkjpqngwlrzqy.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_CREIog57Ep_e7sUZ0rx-VA_8ooqaGTJ';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const makeId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 11)}`;

// ==========================================
// COMPOSANT LECTEUR MULTIMÉDIA UNIVERSEL
// ==========================================
const MediaPlayer = ({ src, type }) => {
  if (!src) return null;

  if (type && type.includes('video')) {
    return <video src={src} controls autoPlay loop className="max-h-64 w-full object-contain rounded-lg border-2 border-gray-700" />;
  }
  if (type && type.includes('audio')) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-800 rounded-lg border-2 border-gray-700 w-full">
        <Music size={48} className="text-purple-400 mb-4 animate-bounce" />
        <audio src={src} controls autoPlay className="w-full" />
      </div>
    );
  }
  return <img src={src} alt="Média à captionner" className="max-h-64 w-full object-contain rounded-lg border-2 border-gray-700" />;
};

const Waiting = ({ label, sub }) => (
  <div className="py-12 flex flex-col items-center">
    <Loader2 size={48} className="text-purple-500 animate-spin mb-4" />
    <p className="font-bold animate-pulse">{label}</p>
    {sub && <p className="text-gray-500 text-sm mt-2">{sub}</p>}
  </div>
);

// ==========================================
// APPLICATION PRINCIPALE
// ==========================================
export default function CaptionBattle() {
  const [gameState, setGameState] = useState('home');
  const [player, setPlayer] = useState({ id: null, name: '' });
  const [room, setRoom] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [players, setPlayers] = useState([]);

  const [medias, setMedias] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [assignments, setAssignments] = useState({});
  const [captions, setCaptions] = useState([]);
  const [myCaption, setMyCaption] = useState('');
  const [votes, setVotes] = useState([]);
  const [cumulativeScores, setCumulativeScores] = useState({});

  const channelRef = useRef(null);
  const processedResultsRef = useRef(false);

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  // ==========================================
  // CONNEXION AU CHANNEL DE LA ROOM (presence + broadcast)
  // ==========================================
  const connectToRoom = (code, playerId, playerName, isCreator) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase.channel(`room:${code}`, {
      config: { presence: { key: playerId } },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const list = Object.values(state)
        .flat()
        .map((p) => ({
          id: p.player_id,
          name: p.player_name,
          is_creator: p.is_creator,
          joined_at: p.joined_at,
        }))
        .sort((a, b) => a.joined_at - b.joined_at);
      setPlayers(list);
    });

    channel.on('broadcast', { event: 'game_update' }, ({ payload }) => {
      if (payload?.newState) setGameState(payload.newState);
    });

    channel.on('broadcast', { event: 'media_added' }, ({ payload }) => {
      setMedias((prev) => (prev.some((m) => m.id === payload.media.id) ? prev : [...prev, payload.media]));
    });

    channel.on('broadcast', { event: 'assignments' }, ({ payload }) => {
      setAssignments(payload.assignments || {});
    });

    channel.on('broadcast', { event: 'caption_submitted' }, ({ payload }) => {
      setCaptions((prev) =>
        prev.some((c) => c.media_id === payload.caption.media_id) ? prev : [...prev, payload.caption]
      );
    });

    channel.on('broadcast', { event: 'vote_cast' }, ({ payload }) => {
      setVotes((prev) => [...prev.filter((v) => v.voter_id !== payload.vote.voter_id), payload.vote]);
    });

    channel.on('broadcast', { event: 'new_round' }, () => {
      setMedias([]);
      setAssignments({});
      setCaptions([]);
      setVotes([]);
      setMyCaption('');
      setGameState('upload');
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          player_id: playerId,
          player_name: playerName,
          is_creator: isCreator,
          joined_at: Date.now(),
        });
      }
    });

    channelRef.current = channel;
  };

  const createRoom = () => {
    if (!player.name.trim()) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newPlayerId = makeId('p');

    setPlayer((p) => ({ ...p, id: newPlayerId }));
    setRoom({ code });
    connectToRoom(code, newPlayerId, player.name.trim(), true);
    setGameState('lobby');
  };

  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code || !player.name.trim()) return;
    setJoinError('');
    const newPlayerId = makeId('p');

    setPlayer((p) => ({ ...p, id: newPlayerId }));
    setRoom({ code });
    connectToRoom(code, newPlayerId, player.name.trim(), false);
    setGameState('lobby');
  };

  const hostId = useMemo(() => {
    const creator = players.find((p) => p.is_creator);
    if (creator) return creator.id;
    return players[0]?.id ?? null;
  }, [players]);
  const isHost = player.id !== null && player.id === hostId;

  const broadcast = (event, payload) => {
    channelRef.current?.send({ type: 'broadcast', event, payload });
  };

  const startGame = () => {
    broadcast('game_update', { newState: 'upload' });
    setGameState('upload');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `${room.code}/${fileName}`;

      const { error } = await supabase.storage.from('game-media').upload(filePath, file);
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('game-media').getPublicUrl(filePath);

      const media = {
        id: makeId('m'),
        url: publicUrl,
        type: file.type,
        owner_id: player.id,
        owner_name: player.name,
      };
      setMedias((prev) => [...prev, media]);
      broadcast('media_added', { media });
    } catch (error) {
      console.error("Erreur d'upload :", error.message);
      alert("Erreur lors de l'envoi du fichier. Vérifie que le bucket 'game-media' existe et est public sur Supabase.");
    } finally {
      setUploading(false);
    }
  };

  const iUploaded = medias.some((m) => m.owner_id === player.id);
  const uploadedCount = medias.length;

  const launchCaptioning = () => {
    const n = players.length;
    if (n < 2) return;
    const assign = {};
    players.forEach((p, i) => {
      const targetPlayer = players[(i + 1) % n];
      const targetMedia = medias.find((m) => m.owner_id === targetPlayer.id);
      if (targetMedia) assign[p.id] = targetMedia.id;
    });
    broadcast('assignments', { assignments: assign });
    setAssignments(assign);
    broadcast('game_update', { newState: 'caption' });
    setGameState('caption');
  };

  // Le host lance le captioning dès que tout le monde a uploadé
  const everyoneUploaded = players.length > 0 && players.every((p) => medias.some((m) => m.owner_id === p.id));

  const myMediaToCaption = medias.find((m) => m.id === assignments[player.id]);
  const iSubmittedCaption = captions.some((c) => c.author_id === player.id);

  const submitCaption = () => {
    if (!myCaption.trim() || !myMediaToCaption) return;
    const caption = {
      media_id: myMediaToCaption.id,
      author_id: player.id,
      author_name: player.name,
      text: myCaption.trim(),
    };
    setCaptions((prev) => [...prev, caption]);
    broadcast('caption_submitted', { caption });
    setMyCaption('');
  };

  // Le host fait avancer vers le vote quand tout le monde a légendé
  useEffect(() => {
    if (isHost && gameState === 'caption' && players.length > 0 && captions.length >= players.length) {
      broadcast('game_update', { newState: 'vote' });
      setGameState('vote');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captions, isHost, gameState, players.length]);

  const myVote = votes.find((v) => v.voter_id === player.id);

  const castVote = (mediaId) => {
    const vote = { media_id: mediaId, voter_id: player.id };
    setVotes((prev) => [...prev.filter((v) => v.voter_id !== player.id), vote]);
    broadcast('vote_cast', { vote });
  };

  // Le host fait avancer vers les résultats quand tout le monde a voté
  useEffect(() => {
    if (isHost && gameState === 'vote' && players.length > 0 && votes.length >= players.length) {
      broadcast('game_update', { newState: 'results' });
      setGameState('results');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [votes, isHost, gameState, players.length]);

  const roundScoreboard = useMemo(() => {
    const tally = {};
    votes.forEach((v) => {
      const caption = captions.find((c) => c.media_id === v.media_id);
      if (caption) tally[caption.author_id] = (tally[caption.author_id] || 0) + 1;
    });
    return players
      .map((p) => ({ ...p, roundPoints: tally[p.id] || 0 }))
      .sort((a, b) => b.roundPoints - a.roundPoints);
  }, [votes, captions, players]);

  useEffect(() => {
    if (gameState === 'results' && !processedResultsRef.current) {
      processedResultsRef.current = true;
      setCumulativeScores((prev) => {
        const next = { ...prev };
        roundScoreboard.forEach((p) => {
          next[p.id] = (next[p.id] || 0) + p.roundPoints;
        });
        return next;
      });
    }
    if (gameState !== 'results') processedResultsRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  const newRound = () => {
    broadcast('new_round', {});
    setMedias([]);
    setAssignments({});
    setCaptions([]);
    setVotes([]);
    setMyCaption('');
    setGameState('upload');
  };

  // ==========================================
  // ÉCRANS
  // ==========================================
  if (gameState === 'home') {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-6xl font-black mb-2 bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent transform -rotate-2">
          CAPTION BATTLE
        </h1>
        <p className="text-gray-400 mb-8 font-medium">Le jeu où tes potes ruinent tes images (et vidéos/audios).</p>

        <div className="bg-gray-900 p-8 rounded-2xl w-full max-w-md shadow-2xl border border-gray-800">
          <input
            type="text"
            placeholder="Ton Pseudo..."
            value={player.name}
            onChange={(e) => setPlayer({ ...player, name: e.target.value })}
            className="w-full p-4 bg-gray-950 border border-gray-700 rounded-lg text-white font-bold text-lg text-center mb-6 focus:border-purple-500 focus:outline-none transition"
          />

          <div className="space-y-4">
            <button
              onClick={createRoom}
              disabled={!player.name.trim()}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition transform hover:scale-[1.02]"
            >
              <Play fill="currentColor" /> Créer une partie
            </button>
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-gray-700"></div>
              <span className="flex-shrink-0 mx-4 text-gray-500 font-bold text-sm">OU</span>
              <div className="flex-grow border-t border-gray-700"></div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Code (ex: AB4F2C)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="w-2/3 p-4 bg-gray-950 border border-gray-700 rounded-lg text-center font-mono uppercase font-bold text-white"
              />
              <button
                onClick={joinRoom}
                disabled={!player.name.trim() || !joinCode.trim()}
                className="w-1/3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-bold py-4 rounded-lg transition"
              >
                Rejoindre
              </button>
            </div>
            {joinError && <p className="text-red-400 text-sm text-center">{joinError}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'lobby') {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
        <div className="bg-gray-900 p-8 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-800 text-center">
          <h2 className="text-2xl font-bold mb-2">Code de la Room</h2>
          <div className="text-6xl font-black font-mono tracking-widest text-purple-400 mb-8 bg-gray-950 py-4 rounded-xl border border-gray-800">
            {room?.code}
          </div>

          <div className="text-left mb-8">
            <h3 className="flex items-center gap-2 text-gray-400 font-bold mb-4 uppercase text-sm">
              <Users size={18} /> Joueurs dans le lobby ({players.length}/8)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {players.map((p) => (
                <div key={p.id} className="bg-gray-800 py-3 px-4 rounded-lg font-bold flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  {p.name} {p.id === hostId && <span className="text-xs text-purple-400 bg-purple-900/30 px-2 py-1 rounded">HOST</span>}
                </div>
              ))}
            </div>
          </div>

          {isHost ? (
            <button
              onClick={startGame}
              disabled={players.length < 2}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-black py-4 px-6 rounded-lg text-lg transition shadow-lg shadow-purple-500/20"
            >
              {players.length < 2 ? 'En attente d\'au moins 2 joueurs...' : 'Lancer le jeu !'}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-3 text-gray-400 animate-pulse">
              <Loader2 className="animate-spin" /> En attente du Host...
            </div>
          )}
        </div>
      </div>
    );
  }

  if (gameState === 'upload') {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
        <div className="bg-gray-900 p-8 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-800 text-center">
          <h2 className="text-3xl font-black mb-2">Choisis ton arme</h2>
          <p className="text-gray-400 mb-8">Upload une image, un GIF, une vidéo ou un audio. Les autres devront y ajouter une légende !</p>

          {uploading ? (
            <Waiting label="Upload vers Supabase en cours..." />
          ) : iUploaded ? (
            <Waiting
              label={`En attente des autres joueurs... (${uploadedCount}/${players.length})`}
              sub="Ton média a bien été envoyé."
            />
          ) : (
            <div className="space-y-4">
              <label className="relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-600 hover:border-purple-500 hover:bg-purple-900/10 rounded-xl cursor-pointer transition group">
                <div className="flex gap-4 text-gray-400 group-hover:text-purple-400 mb-3">
                  <ImageIcon size={32} />
                  <Video size={32} />
                  <Music size={32} />
                </div>
                <span className="font-bold">Cliquer pour uploader un fichier</span>
                <span className="text-xs text-gray-500 mt-2">JPG, PNG, GIF, MP4, MP3</span>
                <input type="file" className="hidden" accept="image/*,video/mp4,audio/*" onChange={handleFileUpload} />
              </label>
            </div>
          )}

          {isHost && !uploading && (
            <button
              onClick={launchCaptioning}
              disabled={!everyoneUploaded}
              className="mt-6 w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black py-4 px-6 rounded-lg text-lg transition"
            >
              {everyoneUploaded ? 'Lancer le captioning !' : `En attente des uploads (${uploadedCount}/${players.length})`}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (gameState === 'caption') {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col p-4">
        <div className="max-w-2xl w-full mx-auto flex flex-col flex-1">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-purple-400">À toi de jouer !</h2>
          </div>

          {!myMediaToCaption ? (
            <Waiting label="Préparation de ton média à légender..." />
          ) : iSubmittedCaption ? (
            <Waiting
              label={`En attente des autres joueurs... (${captions.length}/${players.length})`}
              sub="Ta légende a bien été envoyée."
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
              <p className="text-gray-400 mb-3 text-sm">
                Média envoyé par <span className="text-purple-400 font-bold">{myMediaToCaption.owner_name}</span>
              </p>
              <div className="w-full bg-gray-900 p-4 rounded-2xl border border-gray-800 mb-6 shadow-2xl">
                <MediaPlayer src={myMediaToCaption.url} type={myMediaToCaption.type} />
              </div>

              <div className="w-full relative">
                <input
                  type="text"
                  placeholder="Écris la meilleure légende possible..."
                  value={myCaption}
                  onChange={(e) => setMyCaption(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitCaption()}
                  className="w-full p-5 pl-6 pr-16 bg-gray-800 border-2 border-gray-700 rounded-xl text-white font-bold text-lg focus:border-purple-500 focus:outline-none transition shadow-lg"
                />
                <button
                  onClick={submitCaption}
                  disabled={!myCaption.trim()}
                  className="absolute right-3 top-3 bottom-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-lg px-4 flex items-center justify-center transition"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (gameState === 'vote') {
    const entries = medias
      .map((m) => ({ media: m, caption: captions.find((c) => c.media_id === m.id) }))
      .filter((e) => e.caption);

    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col p-4">
        <div className="max-w-2xl w-full mx-auto flex flex-col flex-1">
          <h2 className="text-2xl font-black text-purple-400 mb-6 text-center">Vote pour la meilleure légende !</h2>

          {myVote ? (
            <Waiting label={`En attente des autres votes... (${votes.length}/${players.length})`} />
          ) : (
            <div className="space-y-6">
              {entries.map((entry) => {
                const isOwnCaption = entry.caption.author_id === player.id;
                return (
                  <div key={entry.media.id} className="bg-gray-900 p-4 rounded-2xl border border-gray-800 shadow-xl">
                    <MediaPlayer src={entry.media.url} type={entry.media.type} />
                    <p className="text-xl font-bold text-center my-4">"{entry.caption.text}"</p>
                    <button
                      onClick={() => castVote(entry.media.id)}
                      disabled={isOwnCaption}
                      className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition"
                    >
                      <ThumbsUp size={18} /> {isOwnCaption ? "C'est ta légende" : 'Voter pour celle-ci'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // gameState === 'results'
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
      <Trophy size={64} className="text-yellow-400 mb-6 animate-bounce" />
      <h2 className="text-3xl font-black mb-8">Résultats du round !</h2>

      <div className="bg-gray-900 p-6 rounded-2xl w-full max-w-md shadow-2xl border border-gray-800 mb-8">
        {roundScoreboard.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center justify-between py-3 px-4 rounded-lg mb-2 ${i === 0 ? 'bg-purple-900/40 border border-purple-500' : 'bg-gray-800'}`}
          >
            <div className="flex items-center gap-3">
              {i === 0 && <Check size={18} className="text-yellow-400" />}
              <span className="font-bold">{p.name}</span>
            </div>
            <div className="text-right">
              <div className="font-black text-purple-300">+{p.roundPoints} ce round</div>
              <div className="text-xs text-gray-500">{cumulativeScores[p.id] || 0} pts au total</div>
            </div>
          </div>
        ))}
      </div>

      {isHost ? (
        <button onClick={newRound} className="bg-purple-600 hover:bg-purple-500 font-bold py-3 px-8 rounded-full">
          Nouveau Round
        </button>
      ) : (
        <div className="flex items-center justify-center gap-3 text-gray-400 animate-pulse">
          <Loader2 className="animate-spin" /> En attente du Host pour le prochain round...
        </div>
      )}
    </div>
  );
}
