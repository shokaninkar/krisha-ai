import { NextRequest, NextResponse } from "next/server";
import { parseQuery } from "@/lib/claude";
import { scrapeListings } from "@/lib/scraper";
import { rankAndSummarize } from "@/lib/claude";

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
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
