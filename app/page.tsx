"use client";

import { useState, useRef, useEffect } from "react";
import type { SearchResult, Listing, SearchFilters } from "@/lib/types";

const SUGGESTIONS = [
  "1-комнатная купить в Алматы до 25 млн от 30 м²",
  "2-bedroom in Almaty under 200,000 ₸/month",
  "Buy a studio near downtown Astana",
  "3-комнатная квартира в Алматы до 40 млн",
  "Rent furnished flat in Shymkent",
];

const STEPS = [
  "Parsing your query with AI…",
  "Searching Krisha.kz…",
  "Ranking results…",
];

function ScoreBadge({ score }: { score?: number }) {
  if (!score) return null;
  const color =
    score >= 80 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
    score >= 60 ? "bg-amber-500/15 text-amber-400 border-amber-500/20" :
                  "bg-zinc-500/15 text-zinc-400 border-zinc-500/20";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${color}`}>
      {score}% match
    </span>
  );
}

function PriceDeviationBadge({ dev }: { dev?: number }) {
  if (dev === undefined || dev === null) return null;
  const isChеap = dev < 0;
  const color = isChеap
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
    : "bg-red-500/15 text-red-400 border-red-500/20";
  const sign = dev > 0 ? "+" : "";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${color}`}>
      {sign}{dev}% от ср.
    </span>
  );
}

function OwnerBadge({ isOwner }: { isOwner?: boolean }) {
  if (isOwner === undefined) return null;
  return isOwner ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20">
      хозяин
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-500/15 text-zinc-400 border border-zinc-500/20">
      риелтор
    </span>
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  // Derive a clean human title: strip the area/floor from the Krisha title
  // "2-комнатная квартира · 65 м² · 3/13 этаж" → "2-комн. квартира"
  const cleanTitle = listing.title
    .split("·")[0]
    .replace("комнатная", "комн.")
    .replace("квартира", "кв.")
    .trim();

  return (
    <a
      href={listing.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.14] transition-all overflow-hidden"
    >
      {/* Image */}
      {listing.imageUrl ? (
        <div className="h-44 overflow-hidden bg-zinc-900 relative">
          <img
            src={listing.imageUrl}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1">
            {listing.postedAt && (
              <span className="px-2 py-0.5 rounded-md text-[10px] bg-black/60 text-zinc-300 backdrop-blur-sm">
                {listing.postedAt}
              </span>
            )}
            {listing.score && listing.score >= 80 && (
              <div className="ml-auto">
                <ScoreBadge score={listing.score} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="h-44 bg-zinc-900 flex items-center justify-center relative">
          <svg className="w-10 h-10 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9.75L12 3l9 6.75V21a.75.75 0 01-.75.75H3.75A.75.75 0 013 21V9.75z" />
          </svg>
          <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1">
            {listing.postedAt && (
              <span className="px-2 py-0.5 rounded-md text-[10px] bg-black/60 text-zinc-300 backdrop-blur-sm">
                {listing.postedAt}
              </span>
            )}
            {listing.score && listing.score >= 80 && (
              <div className="ml-auto">
                <ScoreBadge score={listing.score} />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5 p-4 flex-1">
        {/* Price + deviation */}
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <p className="text-xl font-bold text-white tabular-nums">{listing.price}</p>
          <div className="flex items-center gap-1 flex-wrap">
            <PriceDeviationBadge dev={listing.priceDeviation} />
            {listing.score && listing.score < 80 && <ScoreBadge score={listing.score} />}
          </div>
        </div>

        {/* Clean title */}
        <p className="text-sm font-medium text-zinc-200">{cleanTitle}</p>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          {listing.rooms !== "—" && (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-zinc-800 text-zinc-300">{listing.rooms}</span>
          )}
          {listing.area !== "—" && (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-zinc-800 text-zinc-300">{listing.area}</span>
          )}
          {listing.floor !== "—" && (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-zinc-800 text-zinc-300">этаж {listing.floor}</span>
          )}
          <OwnerBadge isOwner={listing.isOwner} />
        </div>

        {/* Address */}
        {listing.district && (
          <p className="text-xs text-zinc-500 flex items-start gap-1.5 leading-snug">
            <svg className="w-3 h-3 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {listing.district}
          </p>
        )}

        {/* AI summary */}
        {listing.aiSummary && (
          <p className="text-[11px] text-emerald-400/70 border-t border-white/[0.05] pt-2.5 mt-auto leading-relaxed">
            ✦ {listing.aiSummary}
          </p>
        )}
      </div>
    </a>
  );
}

type SortKey = "score" | "price_asc" | "price_desc";

function FilterChips({ filters }: { filters: SearchFilters }) {
  const chips: string[] = [];
  if (filters.city) chips.push(filters.city.charAt(0).toUpperCase() + filters.city.slice(1));
  if (filters.type) chips.push(filters.type === "rent" ? "For rent" : "For sale");
  if (filters.rooms) chips.push(`${filters.rooms} room${filters.rooms > 1 ? "s" : ""}`);
  if (filters.minPrice) chips.push(`from ${filters.minPrice.toLocaleString("ru-RU")} ₸`);
  if (filters.maxPrice) chips.push(`up to ${filters.maxPrice.toLocaleString("ru-RU")} ₸`);
  if (filters.district) chips.push(filters.district);
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <span className="text-[11px] text-zinc-600 uppercase tracking-wider">Parsed:</span>
      {chips.map((c) => (
        <span key={c} className="px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[11px] text-zinc-300 font-medium">
          {c}
        </span>
      ))}
    </div>
  );
}

function SearchBar({
  query, setQuery, onSearch, loading, compact,
}: {
  query: string;
  setQuery: (v: string) => void;
  onSearch: (q?: string) => void;
  loading: boolean;
  compact: boolean;
}) {
  return (
    <div className={`flex gap-2 p-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] focus-within:border-emerald-500/40 focus-within:bg-white/[0.05] transition-all ${compact ? "w-full" : "w-full max-w-2xl"}`}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSearch()}
        placeholder={compact ? "New search…" : "e.g. 2-bedroom near a park in Almaty, budget 150k/month…"}
        className="flex-1 bg-transparent px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none"
      />
      <button
        onClick={() => onSearch()}
        disabled={!query.trim() || loading}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
        {compact ? "" : (loading ? "Searching…" : "Search")}
      </button>
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("score");
  const [ownerFilter, setOwnerFilter] = useState<"all" | "owner" | "realtor">("all");
  const resultsRef = useRef<HTMLDivElement>(null);

  // Cycle through loading step labels
  useEffect(() => {
    if (!loading) { setLoadStep(0); return; }
    const id = setInterval(() => setLoadStep((s) => Math.min(s + 1, STEPS.length - 1)), 2200);
    return () => clearInterval(id);
  }, [loading]);

  async function search(q?: string) {
    const text = (q ?? query).trim();
    if (!text || loading) return;
    if (q) setQuery(q);
    setLoading(true);
    setError(null);
    setResult(null);
    setSort("score");
    setOwnerFilter("all");

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setResult(data);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setQuery("");
  }

  const hasResults = result && result.listings.length > 0;

  const sortedListings = hasResults
    ? [...result.listings]
        .filter(l => {
          if (ownerFilter === "owner") return l.isOwner === true;
          if (ownerFilter === "realtor") return l.isOwner === false;
          return true;
        })
        .sort((a, b) => {
          if (sort === "price_asc") return (a.priceRaw || 0) - (b.priceRaw || 0);
          if (sort === "price_desc") return (b.priceRaw || 0) - (a.priceRaw || 0);
          return (b.score ?? 0) - (a.score ?? 0);
        })
    : [];

  const isActive = loading || !!result || !!error;

  return (
    <div className="min-h-screen bg-[#080808] text-white">

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-20 flex items-center justify-between px-6 py-3.5 border-b border-white/[0.05] bg-[#080808]/90 backdrop-blur-md">
        <button onClick={reset} className="text-sm font-semibold tracking-tight hover:opacity-80 transition-opacity">
          krisha<span className="text-emerald-400">.ai</span>
        </button>
        {isActive && !loading && (
          <div className="flex-1 mx-6 max-w-xl hidden sm:block">
            <SearchBar query={query} setQuery={setQuery} onSearch={search} loading={loading} compact />
          </div>
        )}
        <a
          href="https://krisha.kz"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
        >
          Powered by Krisha.kz →
        </a>
      </nav>

      <main className="pt-16 pb-24">

        {/* ── HERO (hidden once results appear) ── */}
        {!isActive && (
          <section className="flex flex-col items-center text-center px-6 pt-20 pb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs font-medium mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              AI-powered property search for Kazakhstan
            </div>

            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.05] max-w-2xl mb-6">
              Find your home.<br />
              <span className="text-emerald-400">Just describe it.</span>
            </h1>

            <p className="text-zinc-400 text-lg max-w-md leading-relaxed mb-12">
              Type what you&apos;re looking for in plain language — English or Russian.
              AI parses your intent, searches Krisha.kz, and ranks the best matches.
            </p>

            <div className="w-full max-w-2xl space-y-4">
              <SearchBar query={query} setQuery={setQuery} onSearch={search} loading={loading} compact={false} />
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => search(s)}
                    className="px-3 py-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] text-xs text-zinc-400 hover:text-white hover:border-white/[0.14] hover:bg-white/[0.05] transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* How it works */}
            <div className="mt-24 w-full max-w-3xl">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-600 mb-8">How it works</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    step: "01",
                    title: "Describe in plain language",
                    body: "Type anything — \"cheap 2-bed near the park in Almaty\" or in Russian. No dropdowns, no filters.",
                  },
                  {
                    step: "02",
                    title: "AI extracts your intent",
                    body: "Llama 3.3 parses city, rooms, budget, district, and transaction type from your query.",
                  },
                  {
                    step: "03",
                    title: "Ranked results, instantly",
                    body: "Listings scraped live from Krisha.kz and ranked by relevance with an AI explanation per result.",
                  },
                ].map((item) => (
                  <div key={item.step} className="text-left p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                    <span className="text-[11px] font-bold text-emerald-500/60 tracking-wider">{item.step}</span>
                    <h3 className="text-sm font-semibold text-white mt-2 mb-1.5">{item.title}</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── LOADING ── */}
        {loading && (
          <section className="flex flex-col items-center px-6 pt-20 pb-8">
            <div className="flex flex-col items-center gap-4 mb-12">
              <div className="w-10 h-10 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
              <p className="text-sm text-zinc-400 animate-pulse">{STEPS[loadStep]}</p>
            </div>
            <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-72 rounded-2xl bg-white/[0.03] border border-white/[0.04] animate-pulse"
                  style={{ animationDelay: `${i * 100}ms` }}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── ERROR ── */}
        {error && (
          <section className="max-w-2xl mx-auto px-6 pt-20">
            <div className="flex items-start gap-3 p-5 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium">{error}</p>
                <button onClick={reset} className="mt-2 text-xs text-red-400/60 hover:text-red-400 underline">
                  Try again
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── RESULTS ── */}
        {hasResults && (
          <section ref={resultsRef} className="max-w-6xl mx-auto px-6 pt-10 space-y-5">

            {/* AI summary bar */}
            <div className="flex items-start gap-4 p-5 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04]">
              <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5 text-emerald-400">
                ✦
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-300 leading-relaxed">{result.aiMessage}</p>
                <div className="mt-2.5">
                  <FilterChips filters={result.filters} />
                </div>
              </div>
              <button
                onClick={reset}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-white/[0.08] text-xs text-zinc-500 hover:text-white hover:border-white/[0.14] transition-colors"
              >
                New search
              </button>
            </div>

            {/* Stats bar */}
            {(result.avgPrice || result.ownerCount || result.realtorCount) && (
              <div className="flex flex-wrap gap-3 px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] text-xs text-zinc-400">
                {result.avgPrice && (
                  <span>Средняя цена: <span className="text-white font-semibold tabular-nums">{result.avgPrice.toLocaleString("ru-RU")} 〒</span></span>
                )}
                {(result.ownerCount !== undefined || result.realtorCount !== undefined) && (
                  <span className="border-l border-white/[0.08] pl-3">
                    <span className="text-blue-400 font-semibold">{result.ownerCount ?? 0}</span> от хозяев
                    {" · "}
                    <span className="text-zinc-400 font-semibold">{result.realtorCount ?? 0}</span> от риелторов
                  </span>
                )}
              </div>
            )}

            {/* Controls row */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm text-zinc-500">
                  <span className="text-white font-semibold">{sortedListings.length}</span>
                  {ownerFilter !== "all" && <span className="text-zinc-600"> / {result.totalFound}</span>}
                  {" "}найдено
                </p>
                {/* Owner filter */}
                <div className="flex items-center gap-0.5 border border-white/[0.07] rounded-lg p-0.5">
                  {([["all", "Все"], ["owner", "Хозяин"], ["realtor", "Риелтор"]] as ["all"|"owner"|"realtor", string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setOwnerFilter(key)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${ownerFilter === key ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 border border-white/[0.07] rounded-lg p-0.5">
                {([ ["score", "Best match"], ["price_asc", "Price ↑"], ["price_desc", "Price ↓"] ] as [SortKey, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSort(key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${sort === key ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </section>
        )}

        {/* ── NO RESULTS ── */}
        {result && result.listings.length === 0 && (
          <section className="max-w-2xl mx-auto px-6 text-center pt-20">
            <p className="text-3xl mb-4">🏠</p>
            <p className="text-zinc-300 font-medium mb-2">No listings found</p>
            <p className="text-zinc-500 text-sm mb-6">{result.aiMessage}</p>
            <button
              onClick={reset}
              className="px-5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors"
            >
              Try a different search
            </button>
          </section>
        )}
      </main>

      {/* Footer */}
      {!isActive && (
        <footer className="border-t border-white/[0.05] py-8 px-6 text-center">
          <p className="text-xs text-zinc-700">
            krisha.ai — Natural language real estate search for Kazakhstan · Llama 3.3 70B + Krisha.kz
          </p>
        </footer>
      )}
    </div>
  );
}
