"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Article } from "@/lib/currents";

const REFRESH_MS = 60_000; // matches the server cache window; keeps API quota use low
const CATEGORIES = ["all", "general", "world", "business", "technology", "science", "health", "sports", "entertainment", "politics"];
const LANGS = [["en", "English"], ["es", "Español"], ["fr", "Français"], ["de", "Deutsch"], ["pt", "Português"]];
const COUNTRIES = [["", "All countries"], ["US", "United States"], ["GB", "United Kingdom"], ["IN", "India"], ["CA", "Canada"], ["AU", "Australia"]];

function ago(iso: string, now: number) {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function NewsApp() {
  const [category, setCategory] = useState("all");
  const [language, setLanguage] = useState("en");
  const [country, setCountry] = useState("");
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [updated, setUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => { const t = setTimeout(() => setQ(input.trim()), 450); return () => clearTimeout(t); }, [input]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  const load = useCallback(async (reset: boolean) => {
    ctl.current?.abort();
    const c = (ctl.current = new AbortController());
    if (reset) setArticles(null);
    setBusy(true);
    const p = new URLSearchParams({ language });
    if (country) p.set("country", country);
    if (category !== "all") p.set("category", category);
    if (q) p.set("q", q);
    try {
      const r = await fetch(`/api/news?${p}`, { signal: c.signal });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not load news.");
      setArticles(j.articles); setUpdated(j.fetchedAt); setError(null);
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setError(e.message || "Could not load news."); // keep showing the last good articles
      setArticles((a) => a ?? []);
    } finally { if (ctl.current === c) setBusy(false); }
  }, [category, language, country, q]);

  useEffect(() => {
    load(true);
    const tick = () => { if (!document.hidden) load(false); };
    const t = setInterval(tick, REFRESH_MS);
    const vis = () => { if (!document.hidden) { setNow(Date.now()); load(false); } };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); ctl.current?.abort(); };
  }, [load]);

  const hero = articles?.find((a) => a.image) ?? articles?.[0];
  const rest = articles?.filter((a) => a !== hero) ?? [];

  return (
    <>
      <header className="sticky top-0 z-30 bg-ink/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <a href="/" className="relative font-display text-2xl font-semibold tracking-tight">
            <span aria-hidden className="logo-glow absolute -inset-3 -z-10 rounded-full bg-violet-600/30 blur-xl" />
            <span className="neon-text">PulseNews</span>
          </a>
          <span className="flex items-center gap-2 text-xs font-medium text-pink-300"><i className="live-dot" />LIVE</span>
          <nav aria-label="Categories" className="-mb-3 ml-2 hidden flex-1 gap-5 overflow-x-auto md:flex">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)} aria-current={c === category}
                className={`link-u whitespace-nowrap pb-3 text-sm capitalize transition-colors ${c === category ? "text-white" : "text-slate-400 hover:text-white"}`}>{c}</button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
            <svg className={`h-3.5 w-3.5 text-cyan-300 ${busy ? "animate-spin" : "opacity-40"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" /></svg>
            <span aria-live="polite">{updated ? `Updated ${new Date(updated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Loading…"}</span>
          </div>
        </div>
        <div className="neon-line" />
        <div className="mx-auto flex max-w-7xl flex-wrap gap-2 px-4 py-3">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search headlines" aria-label="Search headlines"
            className="min-w-0 flex-1 rounded border border-line bg-char px-3 py-1.5 text-sm placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className="rounded border border-line bg-char px-2 py-1.5 text-sm capitalize md:hidden">
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Language" className="rounded border border-line bg-char px-2 py-1.5 text-sm">
            {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country" className="rounded border border-line bg-char px-2 py-1.5 text-sm">
            {COUNTRIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-20 pt-6">
        {error && (
          <div role="alert" className="mb-5 border-l-2 border-pink-500 bg-pink-500/10 px-4 py-2 text-sm text-pink-100">
            {error} {articles?.length ? "Showing the last loaded articles." : ""}
            <button onClick={() => load(false)} className="ml-3 underline">Try again</button>
          </div>
        )}

        {articles === null ? <Skeleton /> : articles.length === 0 ? (
          <p className="py-24 text-center text-slate-400">No articles match these filters. Try another category, country, or keyword.</p>
        ) : (
          <>
            {hero && (
              <section className="relative mb-10">
                <div aria-hidden className="hero-glow pointer-events-none absolute -inset-x-10 -top-16 h-72 bg-[radial-gradient(closest-side,rgba(139,92,246,.35),rgba(34,211,238,.12),transparent)] blur-2xl" />
                <a href={hero.url} target="_blank" rel="noopener noreferrer" className="glow-border group relative block overflow-hidden">
                  <div className="relative z-10 grid min-h-[22rem] md:grid-cols-5">
                    <div className="relative md:col-span-3">
                      {hero.image ? <img src={hero.image} alt="" loading="eager" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} /> : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/10 md:bg-gradient-to-r md:from-transparent md:to-[#0b0e18]" />
                      <span className="absolute left-4 top-4 flex items-center gap-2 rounded-sm bg-pink-600/90 px-2.5 py-1 text-xs font-semibold text-white"><i className="live-dot" />Top story</span>
                    </div>
                    <div className="relative flex flex-col justify-end border-l-2 border-cyan-400/70 p-6 md:col-span-2">
                      <h2 className="font-display text-3xl font-semibold leading-tight text-white md:text-4xl">{hero.title}</h2>
                      {hero.description && <p className="mt-3 line-clamp-3 text-sm text-slate-300">{hero.description}</p>}
                      <p className="mt-4 text-xs text-slate-400"><span className="text-cyan-300">{hero.source}</span> · {ago(hero.published, now)}</p>
                    </div>
                  </div>
                  <span aria-hidden className="absolute left-0 top-0 z-20 h-6 w-6 border-l-2 border-t-2 border-cyan-300" />
                  <span aria-hidden className="absolute bottom-0 right-0 z-20 h-6 w-6 border-b-2 border-r-2 border-fuchsia-400" />
                </a>
              </section>
            )}
            <div className="neon-line mb-8" />
            <section aria-label="Latest articles" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((a) => (
                <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="card flex flex-col overflow-hidden rounded">
                  <div className="aspect-[16/9] bg-char">
                    {a.image ? <img src={a.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                      : <div className="h-full w-full bg-gradient-to-br from-night via-char to-violet-950/60" />}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="font-display text-lg font-semibold leading-snug text-white">{a.title}</h3>
                    {a.description && <p className="mt-2 line-clamp-3 text-sm text-slate-400">{a.description}</p>}
                    <p className="mt-auto pt-4 text-xs text-slate-500"><span className="text-cyan-300/90">{a.source}</span> · {ago(a.published, now)}</p>
                  </div>
                </a>
              ))}
            </section>
          </>
        )}
        <footer className="mt-16 text-center text-xs text-slate-500">Headlines via Currents API. Each story opens at its original publisher.</footer>
      </main>
    </>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading articles">
      <div className="skeleton mb-10 h-[22rem] rounded" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-72 rounded" />)}
      </div>
    </div>
  );
}
