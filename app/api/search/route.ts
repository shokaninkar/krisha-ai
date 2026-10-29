import { NextRequest, NextResponse } from "next/server";
import { parseQuery } from "@/lib/claude";
import { scrapeListings } from "@/lib/scraper";
import { rankAndSummarize } from "@/lib/claude";
import { rateLimit } from "@/lib/rate-limit";

// Each search costs 2 Groq calls and 1 Krisha.kz fetch, so cap abuse of the free quota.
const MAX_QUERY_LEN = 300;
const RATE_LIMIT_PER_MIN = 10;

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const rl = rateLimit(`search:${ip}`, RATE_LIMIT_PER_MIN, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Слишком много запросов. Попробуйте через ${rl.retryAfterSec} с.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const { query } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }
    if (query.length > MAX_QUERY_LEN) {
      return NextResponse.json(
        { error: `Запрос должен быть не длиннее ${MAX_QUERY_LEN} символов` },
        { status: 400 }
      );
    }

    const filters = await parseQuery(query);
    const listings = await scrapeListings(filters);

    // Compute stats before ranking
    const priced = listings.filter(l => l.priceRaw > 0);
    const avgPrice = priced.length > 0
      ? Math.round(priced.reduce((s, l) => s + l.priceRaw, 0) / priced.length)
      : undefined;
    const ownerCount = listings.filter(l => l.isOwner === true).length;
    const realtorCount = listings.filter(l => l.isOwner === false).length;

    // Attach price deviation % to each listing
    if (avgPrice) {
      for (const l of listings) {
        if (l.priceRaw > 0) {
          l.priceDeviation = Math.round(((l.priceRaw - avgPrice) / avgPrice) * 100);
        }
      }
    }

    const result = await rankAndSummarize(listings, query, filters);

    return NextResponse.json({
      ...result,
      filters,
      totalFound: result.listings.length,
      avgPrice,
      ownerCount,
      realtorCount,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Search failed. Please try again." },
      { status: 500 }
    );
  }
}
