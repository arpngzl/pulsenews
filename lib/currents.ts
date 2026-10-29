import "server-only";

export type Article = {
  id: string; title: string; description: string; url: string;
  source: string; image: string | null; category: string[]; published: string;
};
export type NewsResult = { articles: Article[]; fetchedAt: string };

export class NewsError extends Error {
  constructor(message: string, public status: number, public retryAfter?: number) { super(message); }
}

const BASE = "https://api.currentsapi.services/v1";
// Params are passed only when set; verify supported values at https://currentsapi.services/en/docs/
export type Query = { category?: string; q?: string; language?: string; country?: string };

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function normalize(raw: any[]): Article[] {
  const seen = new Set<string>();
  const out: Article[] = [];
  for (const n of raw) {
    const title = clean(n?.title), url = clean(n?.url), published = clean(n?.published);
    if (!title || !/^https?:\/\//.test(url) || Number.isNaN(Date.parse(published)) || seen.has(url)) continue;
    seen.add(url);
    let host = "";
    try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}
    const img = clean(n?.image);
    out.push({
      id: clean(n?.id) || url, title, url, published,
      description: clean(n?.description),
      source: clean(n?.author) || host || "Unknown source",
      image: /^https:\/\//.test(img) ? img : null,
      category: Array.isArray(n?.category) ? n.category.filter((c: unknown) => typeof c === "string") : [],
    });
  }
  return out.sort((a, b) => Date.parse(b.published) - Date.parse(a.published));
}

export async function fetchNews(p: Query): Promise<NewsResult> {
  const key = process.env.CURRENTS_API_KEY;
  if (!key) throw new NewsError("News provider is not configured.", 500);
  const search = clean(p.q);
  const url = new URL(`${BASE}/${search ? "search" : "latest-news"}`);
  if (search) url.searchParams.set("keywords", search);
  if (p.language) url.searchParams.set("language", p.language);
  if (p.country) url.searchParams.set("country", p.country);
  if (p.category && p.category !== "all") url.searchParams.set("category", p.category);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: key }, // key stays server-side
      next: { revalidate: 60 },        // shared cache protects the API quota
      signal: AbortSignal.timeout(10_000),
    });
  } catch { throw new NewsError("Could not reach the news provider.", 502); }

  if (res.status === 401 || res.status === 403) throw new NewsError("The news provider rejected the API key.", 502);
  if (res.status === 429) throw new NewsError("Rate limit reached. Retrying shortly.", 429, Number(res.headers.get("retry-after")) || 60);
  if (!res.ok) throw new NewsError(`News provider error (${res.status}).`, 502);

  let json: any;
  try { json = await res.json(); } catch { throw new NewsError("Malformed response from provider.", 502); }
  if (json?.status !== "ok" || !Array.isArray(json?.news)) throw new NewsError("Unexpected response from provider.", 502);
  return { articles: normalize(json.news), fetchedAt: new Date().toISOString() };
}
