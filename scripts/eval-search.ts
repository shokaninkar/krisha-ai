/**
 * Eval for query parsing and scraping.
 * Run: npx tsx --env-file=.env.local scripts/eval-search.ts          (parse only)
 *      npx tsx --env-file=.env.local scripts/eval-search.ts --scrape (also checks live listings)
 *
 * Each case lists only the fields that matter for it; other fields are not checked.
 */
import { parseQuery } from "../lib/claude";
import { scrapeListings } from "../lib/scraper";
import type { SearchFilters } from "../lib/types";

type Case = { query: string; expect: Partial<SearchFilters> };

const CASES: Case[] = [
  { query: "2-комнатная в Алматы до 40 млн, не первый этаж", expect: { type: "buy", rooms: 2, maxPrice: 40_000_000, notFirstFloor: true } },
  { query: "2-комнатную до 200 000 в месяц", expect: { type: "rent", rooms: 2, maxPrice: 200_000 } },
  { query: "купить 3 комнаты в Бостандыке до 40 млн", expect: { type: "buy", rooms: 3, district: "Бостандыкский" } },
  { query: "снять студию в Астане", expect: { type: "rent", city: "astana", rooms: 1 } },
  { query: "квартира от 25 до 35 млн, не первый и не последний", expect: { type: "buy", minPrice: 25_000_000, maxPrice: 35_000_000, notFirstFloor: true, notLastFloor: true } },
  { query: "1-комнатная до 250 тыс, выше 3 этажа", expect: { type: "rent", rooms: 1, maxPrice: 250_000, minFloor: 4 } },
  { query: "3 комнаты в Медеуском, с 2 по 5 этаж, до 90 млн", expect: { type: "buy", rooms: 3, district: "Медеуский", minFloor: 2, maxFloor: 5 } },
  { query: "flat for rent in Almaty under 300k, not ground floor", expect: { type: "rent", maxPrice: 300_000, notFirstFloor: true } },
  { query: "2 rooms to buy in Astana up to 30 million", expect: { type: "buy", city: "astana", rooms: 2, maxPrice: 30_000_000 } },
  { query: "двушка 60 квадратов от 50 млн", expect: { type: "buy", rooms: 2, minArea: 60, minPrice: 50_000_000 } },
];

function diff(got: SearchFilters, want: Partial<SearchFilters>): string[] {
  return Object.entries(want)
    .filter(([k, v]) => (got as Record<string, unknown>)[k] !== v)
    .map(([k, v]) => `${k}: want ${JSON.stringify(v)}, got ${JSON.stringify((got as Record<string, unknown>)[k])}`);
}

async function main() {
  const scrape = process.argv.includes("--scrape");
  let pass = 0;
  for (const c of CASES) {
    let filters: SearchFilters;
    try {
      filters = await parseQuery(c.query);
    } catch (e) {
      console.log(`FAIL  ${c.query}\n      parse error: ${(e as Error).message}`);
      continue;
    }
    const problems = diff(filters, c.expect);

    if (scrape && problems.length === 0) {
      const listings = await scrapeListings(filters);
      const floors = listings.map(l => l.floor);
      const bad = listings.filter(l => {
        const m = l.floor.match(/^(\d+)(?:\/(\d+))?/);
        if (!m) return false;
        const fl = +m[1], tot = m[2] ? +m[2] : undefined;
        return (filters.notFirstFloor && fl <= 1)
          || (filters.notLastFloor && tot !== undefined && fl >= tot)
          || (!!filters.minFloor && fl < filters.minFloor)
          || (!!filters.maxFloor && fl > filters.maxFloor);
      });
      if (listings.length === 0) problems.push("scrape: 0 listings");
      if (bad.length) problems.push(`scrape: ${bad.length} listings break the floor rule (${bad.map(b => b.floor).join(", ")})`);
      if (!problems.length) console.log(`      ${listings.length} listings, floors: ${floors.slice(0, 8).join(" ")}`);
    }

    if (problems.length === 0) { pass++; console.log(`PASS  ${c.query}`); }
    else console.log(`FAIL  ${c.query}\n      ${problems.join("\n      ")}`);
  }
  console.log(`\n${pass}/${CASES.length} passed`);
  process.exit(pass === CASES.length ? 0 : 1);
}

main();
