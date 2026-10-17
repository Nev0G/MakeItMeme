'use client';

// Chat global de l'accueil : un canal Supabase Realtime partagé par tous les visiteurs (pas de base de données).
// Les derniers messages sont renvoyés aux nouveaux arrivants par le plus ancien visiteur présent.
import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Users } from 'lucide-react';
import { supabase, PlayerDot, cleanChatMessage, CHAT_TEXT_MAX, readIdentity, writeIdentity, randomAvatar, makeId, MAX_NAME_LEN } from '@/lib/shared';

const KEEP = 80;
const ANON_KEY = 'makeitmeme-anon-id';

const anonId = () => {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = makeId('a');
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return makeId('a');
  }
};

export const GlobalChat = ({ auth, className = '' }: { auth: any; className?: string }) => {
  const [me, setMe] = useState<{ id: string; name: string; avatar: string } | null>(null);
  const [pseudo, setPseudo] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [online, setOnline] = useState(0);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'connecting' | 'live' | 'error'>('connecting');
  const listRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const msgsRef = useRef<any[]>([]);
  const chanRef = useRef<any>(null);
  const lastSend = useRef(0);

  // Identité : compte Discord, sinon pseudo mémorisé sur cet appareil
  useEffect(() => {
    if (!auth.ready) return;
    if (auth.profile) {
      setMe({ id: auth.profile.id, name: auth.profile.name, avatar: auth.profile.avatarUrl || randomAvatar() });
      return;
    }
    const saved = readIdentity();
    setMe(saved?.name ? { id: anonId(), name: saved.name, avatar: saved.avatar || randomAvatar() } : null);
  }, [auth.ready, auth.profile]);

  const add = (list: any[]) => {
    const known = new Set(msgsRef.current.map((x) => x.id));
    const fresh = list.map(cleanChatMessage).filter((m: any) => m && !known.has(m.id));
    if (!fresh.length) return;
    msgsRef.current = [...msgsRef.current, ...fresh].sort((a, b) => a.t - b.t).slice(-KEEP);
    setMessages(msgsRef.current);
  };

  useEffect(() => {
    if (!me) return;
    const channel = supabase.channel('global-chat', { config: { presence: { key: me.id } } });
    const joinedAt = Date.now();
    channel.on('presence', { event: 'sync' }, () => setOnline(Object.keys(channel.presenceState()).length));
    channel.on('presence', { event: 'join' }, ({ key }: any) => {
      if (key === me.id || !msgsRef.current.length) return;
      // Seul le plus ancien visiteur renvoie l'historique
      const all = Object.entries(channel.presenceState()).map(([k, v]: any) => ({ k, t: v[0]?.joined_at ?? 0 }));
      const oldest = all.sort((a, b) => a.t - b.t || a.k.localeCompare(b.k))[0];
      if (oldest?.k === me.id) channel.send({ type: 'broadcast', event: 'history', payload: { messages: msgsRef.current.slice(-30) } });
    });
    channel.on('broadcast', { event: 'msg' }, ({ payload }: any) => add([payload?.msg]));
    channel.on('broadcast', { event: 'history' }, ({ payload }: any) => add(Array.isArray(payload?.messages) ? payload.messages : []));
    channel.subscribe(async (s: string) => {
      if (s === 'SUBSCRIBED') {
        setStatus('live');
        await channel.track({ joined_at: joinedAt });
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setStatus('error');
    });
    chanRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      chanRef.current = null;
    };
  }, [me?.id]);

  useEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = text.trim().slice(0, CHAT_TEXT_MAX);
    const now = Date.now();
    if (!me || !clean || now - lastSend.current < 800) return;
    lastSend.current = now;
    const msg = { id: `${me.id}-${now}-${Math.random().toString(36).slice(2, 6)}`, from: me.id, name: me.name, avatar: me.avatar, text: clean, t: now };
    add([msg]);
    stickRef.current = true;
    chanRef.current?.send({ type: 'broadcast', event: 'msg', payload: { msg } });
    setText('');
  };
  const savePseudo = (e: React.FormEvent) => {
    e.preventDefault();
    const name = pseudo.trim().slice(0, MAX_NAME_LEN);
    if (!name) return;
    const avatar = randomAvatar();
    writeIdentity(name, avatar);
    setMe({ id: anonId(), name, avatar });
  };

  return (
    <section className={`paper flex flex-col min-h-0 overflow-hidden ${className}`} aria-label="Chat global">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-800">
        <div>
          <p className="eyebrow">Discussion</p>
          <h2 className="font-heading text-xl leading-none mt-1 flex items-center gap-2"><MessageCircle size={18} className="text-purple-300" aria-hidden="true" /> Chat global</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400">
          <span className={`w-2 h-2 rounded-full ${status === 'live' ? 'bg-emerald-400' : status === 'error' ? 'bg-red-400' : 'bg-gray-500 animate-pulse'}`} />
          <Users size={13} aria-hidden="true" /> {status === 'live' ? `${online} en ligne` : status === 'error' ? 'hors ligne' : 'connexion…'}
        </span>
      </div>
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="flex-1 min-h-[14rem] overflow-y-auto px-4 py-3 space-y-2.5"
        aria-live="polite"
      >
        {messages.length === 0 && <p className="text-sm text-gray-500 text-center mt-8">Personne n’a encore parlé. Lance la discussion 👋</p>}
        {messages.map((m) => {
          const mine = me && m.from === me.id;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
              <PlayerDot id={m.from} avatar={m.avatar} size="md" />
              <div className={`min-w-0 max-w-[80%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <span className="text-[11px] text-gray-500 mb-0.5">{mine ? 'Toi' : m.name}</span>
                <p className={`rounded-2xl px-3 py-1.5 text-sm break-words [overflow-wrap:anywhere] ${mine ? 'bg-purple-300 text-gray-950' : 'bg-gray-800 text-gray-100'}`}>{m.text}</p>
              </div>
            </div>
          );
        })}
      </div>
      {!auth.ready ? (
        <div className="h-16 border-t border-gray-800" />
      ) : me ? (
        <form onSubmit={submit} className="flex gap-2 p-3 border-t border-gray-800">
          <input
            type="text"
            value={text}
            maxLength={CHAT_TEXT_MAX}
            placeholder={status === 'live' ? `Écrire en tant que ${me.name}…` : 'Connexion au chat…'}
            aria-label="Message"
            onChange={(e) => setText(e.target.value)}
            className="flex-1 min-w-0 bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm"
          />
          <button type="submit" data-sfx="off" disabled={!text.trim() || status !== 'live'} aria-label="Envoyer" className="tag-dark shrink-0 px-4 flex items-center justify-center disabled:opacity-40 active:scale-95 cursor-pointer">
            <Send size={16} />
          </button>
        </form>
      ) : (
        <form onSubmit={savePseudo} className="flex gap-2 p-3 border-t border-gray-800">
          <input
            type="text"
            value={pseudo}
            maxLength={MAX_NAME_LEN}
            placeholder="Choisis un pseudo pour écrire…"
            aria-label="Pseudo"
            onChange={(e) => setPseudo(e.target.value)}
            className="flex-1 min-w-0 bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm"
          />
          <button type="submit" disabled={!pseudo.trim()} className="tag-dark shrink-0 whitespace-nowrap px-5 text-sm disabled:opacity-40 active:scale-95 cursor-pointer">Entrer</button>
        </form>
      )}
    </section>
  );
};
