import { buildDeck, categoryInfo, mockSvg, mockWav } from '@/lib/blindtest-server';

// Données du Blind Test : liste des catégories (?info=1) ou pioche mélangée (?cats=a,b&n=10).
// Les clés API (TMDB_API_KEY ou TMDB_READ_TOKEN, RAWG_API_KEY) restent côté serveur.
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;

  // Fichiers factices pour tester sans réseau (BLINDTEST_MOCK=1 uniquement)
  const mock = sp.get('mock');
  if (mock && process.env.BLINDTEST_MOCK) {
    if (mock === 'audio') return new Response(mockWav(), { headers: { 'content-type': 'audio/wav', 'cache-control': 'no-store' } });
    const color = /^[0-9a-f]{6}$/i.test(sp.get('c') || '') ? (sp.get('c') as string) : '2980b9';
    return new Response(mockSvg(color, (sp.get('n') || '').replace(/[^0-9]/g, '')), { headers: { 'content-type': 'image/svg+xml' } });
  }

  if (sp.get('info')) return json({ categories: categoryInfo() });

  const cats = (sp.get('cats') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const n = Math.max(3, Math.min(25, Number(sp.get('n')) || 10));
  try {
    const yr = (k: string) => {
      const v = parseInt(sp.get(k) || '', 10);
      return Number.isFinite(v) && v >= 1900 && v <= 2100 ? v : undefined;
    };
    const deck = await buildDeck(cats, n, { range: { from: yr('from'), to: yr('to') }, chrono: sp.get('sort') === 'year' });
    if (deck.length < 3) return json({ error: 'Pas assez d’extraits trouvés, réessaie dans un instant.' }, 502);
    return json({ deck });
  } catch (e: any) {
    return json({ error: e?.message || 'Erreur serveur' }, 500);
  }
}
