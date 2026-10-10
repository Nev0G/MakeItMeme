// Côté serveur uniquement : va chercher les extraits, images et titres chez iTunes, TMDB, RAWG et Jikan,
// puis assemble une « pioche » mélangée. Les clés API restent dans les variables d'environnement :
//   TMDB_API_KEY ou TMDB_READ_TOKEN (films & séries), RAWG_API_KEY (jeux vidéo). iTunes et Jikan n'en demandent pas.
import { BLIND_CATEGORIES, BlindCategory, categoryById } from './blindtest-catalog';
import { normAns } from './blindtest-judge';

export type BlindItem = {
  id: string;
  cat: string;
  kind: 'audio' | 'image';
  ask: string;
  url: string;
  display: string;
  sub: string;
  year?: number;
  cover?: string;
  answers: string[];
  extras: string[];
  choices: string[];
};

const MOCK = !!process.env.BLINDTEST_MOCK;

export type Range = { from?: number; to?: number };
const yearOf = (d: unknown) => {
  const y = parseInt(String(d || '').slice(0, 4), 10);
  return Number.isFinite(y) && y > 1900 ? y : undefined;
};
const inRange = (y: number | undefined, r: Range) => !r.from && !r.to ? true : y !== undefined && y >= (r.from || 0) && y <= (r.to || 9999);
const hasRange = (r: Range) => !!(r.from || r.to);

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const shuffled = <T,>(list: T[]): T[] => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const uniq = (list: string[]) => {
  const seen = new Set<string>();
  return list.filter((s) => {
    const k = normAns(s);
    if (!s || !k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

// ---------- disponibilité ----------
const hasEnv = (names?: string[]) => !names || names.some((n) => !!process.env[n]);
export const categoryInfo = () =>
  BLIND_CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    emoji: c.emoji,
    group: c.group,
    kind: c.kind,
    available: MOCK || hasEnv(c.needs),
    missing: !MOCK && !hasEnv(c.needs) ? (c.needs || []).join(' ou ') : '',
  }));

// ---------- requêtes ----------
const cache = new Map<string, { t: number; v: any }>();
const getJson = async (url: string, headers: Record<string, string> = {}, ttl = 15 * 60 * 1000) => {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const v = await res.json();
    cache.set(url, { t: Date.now(), v });
    if (cache.size > 400) cache.delete(cache.keys().next().value as string);
    return v;
  } finally {
    clearTimeout(timer);
  }
};

// Petit limiteur de concurrence (iTunes n'aime pas les rafales)
const limiter = (max: number) => {
  let active = 0;
  const queue: (() => void)[] = [];
  return async <T,>(fn: () => Promise<T>): Promise<T> => {
    if (active >= max) await new Promise<void>((r) => queue.push(r));
    active += 1;
    try {
      return await fn();
    } finally {
      active -= 1;
      queue.shift()?.();
    }
  };
};
const limit = limiter(4);

// ---------- iTunes ----------
const cleanTitle = (t: string) =>
  (t || '')
    .replace(/\s*[\(\[].*?[\)\]]/g, '')
    .replace(/\s+-\s+.*$/, '')
    .trim();
const bigCover = (u?: string) => (u ? u.replace(/\d+x\d+bb/, '600x600bb') : undefined);

const itunesSearch = async (term: string) => {
  const data = await getJson(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=30&country=FR&lang=fr_fr`);
  return ((data?.results || []) as any[]).filter((r) => r.previewUrl && r.trackName);
};

type Cand = { item: BlindItem; pool: string[] }; // pool : titres voisins pour les fausses réponses

const itunesArtistItem = async (cat: BlindCategory, used: Set<string>, range: Range): Promise<Cand | null> => {
  for (let attempt = 0; attempt < (hasRange(range) ? 10 : 4); attempt += 1) {
    const artist = pick(cat.artists || []);
    const na = normAns(artist);
    let rows: any[] = [];
    try {
      rows = await limit(() => itunesSearch(artist));
    } catch {
      continue;
    }
    const own = rows.filter((r) => {
      const ar = normAns(r.artistName || '');
      return ar && (ar.includes(na) || na.includes(ar));
    });
    const seenTitles = new Set<string>();
    const titles = own
      .map((r) => ({ r, title: cleanTitle(r.trackName) }))
      .filter((x) => x.title && !seenTitles.has(normAns(x.title)) && seenTitles.add(normAns(x.title)));
    const fresh = titles.filter((x) => !used.has(normAns(x.title)) && inRange(yearOf(x.r.releaseDate), range));
    if (!fresh.length) continue;
    const chosen = pick(fresh);
    used.add(normAns(chosen.title));
    return {
      item: {
        id: '',
        cat: cat.id,
        kind: 'audio',
        ask: cat.ask,
        url: chosen.r.previewUrl,
        display: chosen.title,
        sub: chosen.r.artistName,
        year: yearOf(chosen.r.releaseDate),
        cover: bigCover(chosen.r.artworkUrl100),
        answers: uniq([chosen.title, cleanTitle(chosen.r.trackName), chosen.r.trackName]),
        extras: uniq([chosen.r.artistName, artist]),
        choices: [],
      },
      pool: titles.map((x) => x.title),
    };
  }
  return null;
};

const itunesTitleItem = async (cat: BlindCategory, used: Set<string>, range: Range): Promise<Cand | null> => {
  const all = cat.titles || [];
  const free = all.filter((t) => !used.has(t[0]));
  for (let attempt = 0; attempt < (hasRange(range) ? 10 : 4) && free.length; attempt += 1) {
    const entry = free.splice(Math.floor(Math.random() * free.length), 1)[0];
    let rows: any[] = [];
    try {
      rows = await limit(() => itunesSearch(`${entry[0]} ${cat.id === 'jeux-ost' ? 'original soundtrack' : 'bande originale'}`));
    } catch {
      continue;
    }
    // On préfère les vraies bandes originales (genre « Soundtrack »)
    const ost = rows.filter((r) => /sound|bande|score|film|musique|original/i.test(`${r.primaryGenreName} ${r.collectionName}`));
    const rowsOk = (ost.length ? ost : rows).filter((r) => inRange(yearOf(r.releaseDate), range));
    if (!rowsOk.length) continue;
    const chosen = pick(rowsOk);
    used.add(entry[0]);
    return {
      item: {
        id: '',
        cat: cat.id,
        kind: 'audio',
        ask: cat.ask,
        url: chosen.previewUrl,
        display: entry[1] || entry[0],
        sub: cleanTitle(chosen.trackName),
        year: yearOf(chosen.releaseDate),
        cover: bigCover(chosen.artworkUrl100),
        answers: uniq(entry.slice(1).length ? entry.slice(1) : [entry[0]]),
        extras: [],
        choices: [],
      },
      pool: all.map((t) => t[1] || t[0]),
    };
  }
  return null;
};

// ---------- TMDB ----------
const tmdbAuth = () => {
  const token = process.env.TMDB_READ_TOKEN;
  const key = process.env.TMDB_API_KEY;
  return { headers: token ? { Authorization: `Bearer ${token}` } : {}, key: !token && key ? `&api_key=${key}` : '' };
};
const tmdbItem = async (cat: BlindCategory, used: Set<string>, range: Range): Promise<Cand | null> => {
  const type = cat.tmdb?.type || 'movie';
  const shot = !!cat.tmdb?.shot;
  const { headers, key } = tmdbAuth();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const page = 1 + Math.floor(Math.random() * (hasRange(range) ? 8 : 25));
    const dateKey = type === 'movie' ? 'primary_release_date' : 'first_air_date';
    const dates = (range.from ? `&${dateKey}.gte=${range.from}-01-01` : '') + (range.to ? `&${dateKey}.lte=${range.to}-12-31` : '');
    let results: any[] = [];
    try {
      const data = await getJson(
        `https://api.themoviedb.org/3/discover/${type}?language=fr-FR&sort_by=popularity.desc&vote_count.gte=${type === 'movie' ? (hasRange(range) ? 400 : 1500) : 200}${dates}&page=${page}${key}`,
        headers
      );
      results = (data?.results || []) as any[];
    } catch {
      continue;
    }
    const nameOf = (r: any) => (type === 'movie' ? r.title : r.name);
    const origOf = (r: any) => (type === 'movie' ? r.original_title : r.original_name);
    const dateOf = (r: any) => String(type === 'movie' ? r.release_date : r.first_air_date || '').slice(0, 4);
    const pool = results.map(nameOf).filter(Boolean);
    const cands = shuffled(results.filter((r) => nameOf(r) && r.poster_path && !used.has(normAns(nameOf(r)))));
    for (const r of cands.slice(0, 4)) {
      let url = `https://image.tmdb.org/t/p/w500${r.poster_path}`;
      if (shot) {
        try {
          const imgs = await limit(() => getJson(`https://api.themoviedb.org/3/${type}/${r.id}/images?include_image_language=null${key}`, headers));
          const backs = ((imgs?.backdrops || []) as any[]).filter((b) => !b.iso_639_1).slice(0, 10);
          if (!backs.length) continue;
          url = `https://image.tmdb.org/t/p/w780${pick(backs).file_path}`;
        } catch {
          continue;
        }
      }
      used.add(normAns(nameOf(r)));
      return {
        item: {
          id: '',
          cat: cat.id,
          kind: 'image',
          ask: cat.ask,
          url,
          display: nameOf(r),
          sub: dateOf(r),
          year: yearOf(type === 'movie' ? r.release_date : r.first_air_date),
          cover: `https://image.tmdb.org/t/p/w342${r.poster_path}`,
          answers: uniq([nameOf(r), origOf(r)]),
          extras: [],
          choices: [],
        },
        pool,
      };
    }
  }
  return null;
};

// ---------- RAWG ----------
const rawgItem = async (cat: BlindCategory, used: Set<string>, range: Range): Promise<Cand | null> => {
  const key = process.env.RAWG_API_KEY;
  if (!key) return null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const page = 1 + Math.floor(Math.random() * (hasRange(range) ? 5 : 10));
    const dates = hasRange(range) ? `&dates=${range.from || 1970}-01-01,${range.to || new Date().getFullYear()}-12-31` : '';
    let results: any[] = [];
    try {
      const data = await getJson(`https://api.rawg.io/api/games?key=${key}&ordering=-added&page_size=40${dates}&page=${page}`);
      results = (data?.results || []) as any[];
    } catch {
      continue;
    }
    const pool = results.map((r) => r.name).filter(Boolean);
    const cands = shuffled(results.filter((r) => r.name && (r.short_screenshots || []).length > 1 && !used.has(normAns(r.name))));
    const r = cands[0];
    if (!r) continue;
    const shots = (r.short_screenshots as any[]).slice(1);
    used.add(normAns(r.name));
    return {
      item: {
        id: '',
        cat: cat.id,
        kind: 'image',
        ask: cat.ask,
        url: pick(shots).image,
        display: r.name,
        sub: String(r.released || '').slice(0, 4),
        year: yearOf(r.released),
        cover: r.background_image,
        answers: uniq([r.name, r.name.split(':')[0], r.name.split(' - ')[0]]),
        extras: [],
        choices: [],
      },
      pool,
    };
  }
  return null;
};

// ---------- Jikan (anime, sans clé) ----------
const jikanItem = async (cat: BlindCategory, used: Set<string>, range: Range): Promise<Cand | null> => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const page = 1 + Math.floor(Math.random() * (hasRange(range) ? 4 : 8));
    const url = hasRange(range)
      ? `https://api.jikan.moe/v4/anime?order_by=popularity&sort=asc&sfw=true&limit=25&page=${page}&start_date=${range.from || 1960}-01-01&end_date=${range.to || new Date().getFullYear()}-12-31`
      : `https://api.jikan.moe/v4/top/anime?page=${page}&limit=25`;
    let results: any[] = [];
    try {
      const data = await getJson(url);
      results = (data?.data || []) as any[];
    } catch {
      continue;
    }
    const nameOf = (r: any) => r.title_english || r.title;
    const pool = results.map(nameOf).filter(Boolean);
    const cands = shuffled(results.filter((r) => nameOf(r) && r.images?.jpg?.large_image_url && !used.has(normAns(nameOf(r)))));
    const r = cands[0];
    if (!r) continue;
    used.add(normAns(nameOf(r)));
    return {
      item: {
        id: '',
        cat: cat.id,
        kind: 'image',
        ask: cat.ask,
        url: r.images.jpg.large_image_url,
        display: nameOf(r),
        sub: String(r.year || ''),
        year: yearOf(r.aired?.from) || (r.year ? Number(r.year) : undefined),
        cover: r.images.jpg.large_image_url,
        answers: uniq([r.title_english, r.title, ...((r.titles || []) as any[]).map((t) => t.title)].filter(Boolean)),
        extras: [],
        choices: [],
      },
      pool,
    };
  }
  return null;
};

// ---------- Mode test (BLINDTEST_MOCK=1) : de faux éléments sans réseau ----------
const mockItem = (cat: BlindCategory, n: number, range: Range): Cand => {
  const names = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima'];
  const name = `${cat.label.split(' ')[0]} ${names[n % names.length]}`;
  const colors = ['c0392b', '2980b9', '27ae60', '8e44ad', 'd35400', '16a085'];
  const color = colors[n % colors.length];
  return {
    item: {
      id: '',
      cat: cat.id,
      kind: cat.kind,
      ask: cat.ask,
      url: cat.kind === 'audio' ? `/api/blindtest?mock=audio&n=${n}` : `/api/blindtest?mock=image&c=${color}&n=${n}`,
      display: name,
      sub: cat.kind === 'audio' ? 'Artiste Test' : '2024',
      year: (range.from || 1985) + ((n * 7) % Math.max(1, (range.to || 2024) - (range.from || 1985) + 1)),
      cover: `/api/blindtest?mock=image&c=${color}&n=${n}`,
      answers: [name],
      extras: cat.kind === 'audio' ? ['Artiste Test'] : [],
      choices: [],
    },
    pool: names.map((x) => `${cat.label.split(' ')[0]} ${x}`),
  };
};

const makeOne = async (cat: BlindCategory, used: Set<string>, n: number, range: Range): Promise<Cand | null> => {
  if (MOCK) return mockItem(cat, n, range);
  if (cat.source === 'itunes-artist') return itunesArtistItem(cat, used, range);
  if (cat.source === 'itunes-title') return itunesTitleItem(cat, used, range);
  if (cat.source === 'tmdb') return tmdbItem(cat, used, range);
  if (cat.source === 'rawg') return rawgItem(cat, used, range);
  return jikanItem(cat, used, range);
};

// ---------- assemblage de la pioche ----------
export const buildDeck = async (catIds: string[], total: number, opts: { range?: Range; chrono?: boolean } = {}): Promise<BlindItem[]> => {
  const range = opts.range || {};
  const available = categoryInfo().filter((c) => c.available).map((c) => c.id);
  const wanted = catIds.filter((id) => available.includes(id) && categoryById(id));
  const ids = wanted.length ? wanted : available;
  const order = shuffled(ids);
  const counts: Record<string, number> = {};
  for (let i = 0; i < total; i += 1) counts[order[i % order.length]] = (counts[order[i % order.length]] || 0) + 1;

  const globalPool: string[] = [];
  const found: Cand[] = [];
  await Promise.all(
    Object.entries(counts).map(async ([id, k]) => {
      const cat = categoryById(id) as BlindCategory;
      const used = new Set<string>();
      const want = k + (k > 1 ? 1 : 0); // une de rab pour absorber les échecs
      const got = await Promise.all(Array.from({ length: want }, (_, i) => makeOne(cat, used, i, range)));
      got.filter(Boolean).forEach((c) => found.push(c as Cand));
    })
  );
  // Si certaines catégories ont échoué, on complète depuis celles qui répondent
  let deck = shuffled(found).slice(0, total);
  if (deck.length < total && found.length) {
    const okCats = Array.from(new Set(found.map((c) => c.item.cat)));
    const used = new Set<string>(found.map((c) => normAns(c.item.display)));
    for (let tries = 0; deck.length < total && tries < total * 2; tries += 1) {
      const extra = await makeOne(categoryById(pick(okCats)) as BlindCategory, used, deck.length + tries, range);
      if (extra && !deck.some((d) => normAns(d.item.display) === normAns(extra.item.display))) deck.push(extra);
    }
  }
  deck.forEach((c) => c.pool.forEach((t) => globalPool.push(t)));

  // Ordre chronologique : du plus ancien au plus récent (les éléments sans date à la fin)
  if (opts.chrono) deck = [...deck].sort((a, b) => (a.item.year || 9999) - (b.item.year || 9999));
  return deck.map((c, i) => {
    const answerKeys = new Set(c.item.answers.map(normAns));
    const near = uniq(c.pool).filter((t) => !answerKeys.has(normAns(t)));
    const far = uniq(globalPool).filter((t) => !answerKeys.has(normAns(t)));
    const fakes = shuffled(near).slice(0, 3);
    if (fakes.length < 3) shuffled(far).forEach((t) => fakes.length < 3 && !fakes.some((f) => normAns(f) === normAns(t)) && fakes.push(t));
    return { ...c.item, id: `${c.item.cat}-${i}`, choices: shuffled([c.item.display, ...fakes]) };
  });
};

// ---------- fichiers de test ----------
export const mockWav = () => {
  // 35 s de sinus doux, 8 kHz, 8 bits mono
  const rate = 8000;
  const secs = 35;
  const n = rate * secs;
  const buf = Buffer.alloc(44 + n);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n, 40);
  for (let i = 0; i < n; i += 1) buf[44 + i] = 128 + Math.round(30 * Math.sin((2 * Math.PI * (330 + (Math.floor(i / rate) % 5) * 55) * i) / rate));
  return buf;
};
export const mockSvg = (color: string, n: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="780" height="440" viewBox="0 0 780 440"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#${color}"/><stop offset="1" stop-color="#111"/></linearGradient></defs><rect width="780" height="440" fill="url(#g)"/><circle cx="390" cy="200" r="90" fill="#fff" fill-opacity=".85"/><path d="M60 400 L220 250 L330 340 L470 200 L720 400 Z" fill="#000" fill-opacity=".35"/><text x="390" y="215" font-size="64" text-anchor="middle" font-family="sans-serif" fill="#222">${n}</text></svg>`;
