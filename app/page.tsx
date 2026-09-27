'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Play, Image as ImageIcon, Video, Music, Link as LinkIcon, Send, Trophy, Users, Loader2 } from 'lucide-react';


// ==========================================
// 1. CONFIGURATION SUPABASE
// ==========================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hidtcsztkjpqngwlrzqy.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_CREIog57Ep_e7sUZ0rx-VA_8ooqaGTJ';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

// ==========================================
// APPLICATION PRINCIPALE
// ==========================================
export default function CaptionBattle() {
  const [gameState, setGameState] = useState('home');
  const [player, setPlayer] = useState({ id: null, name: '' });
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  
  const [medias, setMedias] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [myCaption, setMyCaption] = useState('');
  
  useEffect(() => {
    if (!room?.id) return;

    const roomChannel = supabase.channel(`room:${room.id}`)
      .on('broadcast', { event: 'game_update' }, (payload) => {
        if (payload.payload.newState) {
          setGameState(payload.payload.newState);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await roomChannel.track({ player_name: player.name, player_id: player.id });
        }
      });

    return () => { supabase.removeChannel(roomChannel); };
  }, [room?.id, player]);

  const createRoom = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newPlayerId = 'p_' + Math.random().toString(36).substr(2, 9);
    
    setPlayer({ ...player, id: newPlayerId });
    setRoom({ id: 'room_123', code, host_id: newPlayerId });
    setPlayers([{ id: newPlayerId, name: player.name, score: 0 }]);
    setGameState('lobby');
  };

  const startGame = () => {
    supabase.channel(`room:${room.id}`).send({
      type: 'broadcast',
      event: 'game_update',
      payload: { newState: 'upload' }
    });
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

      setMedias((prev) => [...prev, { url: publicUrl, type: file.type, owner_id: player.id }]);
      setGameState('caption');
      
    } catch (error) {
      console.error("Erreur d'upload :", error.message);
      alert("Erreur lors de l'envoi du fichier.");
    } finally {
      setUploading(false);
    }
  };

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
              disabled={!player.name}
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
              <input type="text" placeholder="Code (ex: AB4F)" className="w-2/3 p-4 bg-gray-950 border border-gray-700 rounded-lg text-center font-mono uppercase font-bold text-white" />
              <button className="w-1/3 bg-gray-800 hover:bg-gray-700 text-white font-bold py-4 rounded-lg transition">
                Rejoindre
              </button>
            </div>
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
              {players.map((p, i) => (
                <div key={i} className="bg-gray-800 py-3 px-4 rounded-lg font-bold flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  {p.name} {p.id === room.host_id && <span className="text-xs text-purple-400 bg-purple-900/30 px-2 py-1 rounded">HOST</span>}
                </div>
              ))}
            </div>
          </div>

          {player.id === room?.host_id ? (
            <button onClick={startGame} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-4 px-6 rounded-lg text-lg transition shadow-lg shadow-purple-500/20">
              Lancer le jeu !
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
            <div className="py-12 flex flex-col items-center">
              <Loader2 size={48} className="text-purple-500 animate-spin mb-4" />
              <p className="font-bold animate-pulse">Upload vers Supabase en cours...</p>
            </div>
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
              
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-700"></div>
                <span className="flex-shrink-0 mx-4 text-gray-500 font-bold text-sm">OU</span>
                <div className="flex-grow border-t border-gray-700"></div>
              </div>

              <div className="flex gap-2">
                <input type="url" placeholder="Coller un lien externe..." className="w-full p-4 bg-gray-950 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:border-purple-500" />
                <button className="bg-gray-800 hover:bg-gray-700 text-white p-4 rounded-lg transition">
                  <LinkIcon size={24} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (gameState === 'caption') {
    const currentMedia = medias[0] || { url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3B4emYyaHhxeHh5eHhxeHhxeHhxeHhxeHhxeHhxeHhxeHhxeHhxeA/3o7TKSjRrfIPjeiVyM/giphy.gif', type: 'image/gif' };
    
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col p-4">
        <div className="max-w-2xl w-full mx-auto flex flex-col flex-1">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-purple-400">À toi de jouer !</h2>
            <div className="bg-gray-900 px-4 py-2 rounded-full font-bold font-mono border border-gray-800">⏳ 45s</div>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-full bg-gray-900 p-4 rounded-2xl border border-gray-800 mb-6 shadow-2xl">
               <MediaPlayer src={currentMedia.url} type={currentMedia.type} />
            </div>

            <div className="w-full relative">
              <input
                type="text"
                placeholder="Écris la meilleure légende possible..."
                value={myCaption}
                onChange={(e) => setMyCaption(e.target.value)}
                className="w-full p-5 pl-6 pr-16 bg-gray-800 border-2 border-gray-700 rounded-xl text-white font-bold text-lg focus:border-purple-500 focus:outline-none transition shadow-lg"
              />
              <button 
                onClick={() => setGameState('vote')}
                className="absolute right-3 top-3 bottom-3 bg-purple-600 hover:bg-purple-500 rounded-lg px-4 flex items-center justify-center transition"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
      <div className="text-center">
        <Trophy size={64} className="text-yellow-400 mx-auto mb-6 animate-bounce" />
        <h2 className="text-3xl font-black mb-4">Fin du Round !</h2>
        <button onClick={() => setGameState('upload')} className="bg-purple-600 hover:bg-purple-500 font-bold py-3 px-8 rounded-full">
          Nouveau Round
        </button>
      </div>
    </div>
  );
}