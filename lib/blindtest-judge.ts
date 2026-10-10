// Comparaison tolérante des réponses du Blind Test (utilisé par le host, et pour l'affichage des indices).
// Les réponses attendues voyagent encodées dans la « pioche » partagée (ak) : pas lisibles à l'œil nu.

export type BlindSecret = { a: string[]; x: string[]; d: string; s: string; c?: string; y?: number };

const encodeSecret = (s: BlindSecret): string => {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(s))));
  } catch {
    return '';
  }
};
const decodeSecret = (ak: string): BlindSecret | null => {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(ak))));
  } catch {
    return null;
  }
};

const ARTICLES = new Set(['le', 'la', 'les', 'l', 'the', 'un', 'une', 'des', 'a', 'an']);
// minuscules, sans accents ni parenthèses ni ponctuation, sans article au début
const normAns = (s: string) => {
  const base = (s || '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/&/g, ' et ')
    .replace(/[\(\[].*?[\)\]]/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const words = base.split(' ').filter(Boolean);
  while (words.length > 1 && ARTICLES.has(words[0])) words.shift();
  return words.join('');
};

const distance = (a: string, b: string) => {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
};

// Le texte contient-il (à une petite faute près) la réponse ? On fait glisser une fenêtre sur le texte.
const fuzzyIncludes = (text: string, target: string, tol: number) => {
  if (text.includes(target)) return true;
  if (target.length < 5) return false;
  for (let len = target.length - 1; len <= target.length + 1; len += 1) {
    for (let i = 0; i + len <= text.length; i += 1) {
      if (distance(text.slice(i, i + len), target) <= tol) return true;
    }
  }
  return false;
};
const tolFor = (len: number) => (len >= 10 ? 2 : 1);

// Retour : ok (le titre est trouvé), artist (l'artiste / un complément est cité, avec ou sans le titre),
// extra (les deux d'un coup), close (« tu chauffes »)
const judgeAnswer = (text: string, secret: BlindSecret, strict = false) => {
  const n = normAns(text);
  if (!n) return { ok: false, artist: false, extra: false, close: false };
  let ok = false;
  let close = false;
  secret.a.forEach((ans) => {
    const na = normAns(ans);
    if (!na) return;
    const strip = (v: string) => v.replace(/s$/, '');
    if (n === na || strip(n) === strip(na)) ok = true;
    else if (!strict) {
      if (na.length >= 5 && fuzzyIncludes(n, na, tolFor(na.length))) ok = true; // « alors on dance stromae » contient le titre
      else if (n.length >= 4 && na.length >= 4) {
        const d = distance(n, na);
        const tol = na.length >= 10 ? 2 : 1;
        if (d <= tol) ok = true;
        else if (d <= tol + 1) close = true;
      }
    }
  });
  // L'artiste peut être cité seul, ou avec le titre
  const artist =
    !strict &&
    secret.x.some((x) => {
      const nx = normAns(x);
      if (nx.length < 3) return false;
      if (n === nx) return true;
      return nx.length >= 6 ? fuzzyIncludes(n, nx, 1) : n.includes(nx);
    });
  return { ok, artist, extra: ok && artist, close: !ok && !artist && close };
};

export { encodeSecret, decodeSecret, normAns, judgeAnswer };
