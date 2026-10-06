import Groq from "groq-sdk";
import type { Listing, SearchFilters } from "./types";

const GROQ_MODEL = "openai/gpt-oss-120b";
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function parseQuery(userQuery: string): Promise<SearchFilters> {
  const message = await client.chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: 512,
    response_format: { type: "json_object" },
    reasoning_effort: "low",
    messages: [
      {
        role: "system",
        content:
          "You are a real estate search assistant for Kazakhstan property portal Krisha.kz. Extract structured filters from user queries. Respond with valid JSON only.",
      },
      {
        role: "user",
        content: `Extract real estate search filters from the query below. Return ONLY valid JSON with this exact shape:
{
  "city": string,
  "type": "rent" | "buy",
  "rooms": number | null,
  "minPrice": number | null,
  "maxPrice": number | null,
  "district": string | null,
  "minArea": number | null,
  "minFloor": number | null,
  "maxFloor": number | null,
  "notFirstFloor": boolean,
  "notLastFloor": boolean,
  "keywords": string[]
}

Rules:
- city: one of almaty, astana, shymkent, aktobe, karaganda, atyrau, pavlodar, taraz, semey, kostanay. Default: "almaty"
- type: "rent" if user says аренда/снять/снимать/в месяц/rent/per month. "buy" if купить/продажа/покупка/buy/purchase.
  If neither is said, decide from the budget: a price of 3 млн (3,000,000 KZT) or more is a purchase price, so "buy". Below that, "rent". With no price and no word either way, "rent"
- rooms: integer. "студия" or "studio" = 1. null if not mentioned
- Prices are in KZT. "млн" = ×1,000,000. "тыс" or "к" = ×1,000. "$" or USD = ×500
- "до X" = maxPrice. "от X" = minPrice. "X–Y" = minPrice + maxPrice
- district: canonical Russian district name if mentioned, else null.
  Almaty district aliases → canonical form:
  медеу/медеуский → "Медеуский"
  бостандык/бостандыкский → "Бостандыкский"
  алмалы/алмалинский → "Алмалинский"
  ауэзов/ауэзовский → "Ауэзовский"
  алатау/алатауский → "Алатауский"
  жетысу/жетысуский → "Жетысуский"
  наурызбай/наурызбайский → "Наурызбайский"
  турксиб/турксибский → "Турксибский"
- minArea: minimum area in m². "от X кв" / "30+ sqm" / "от 30 м²" → number. null if not mentioned
- Floors: "не первый этаж"/"не на первом" → notFirstFloor: true. "не последний"/"не на последнем" → notLastFloor: true.
  "выше N этажа" → minFloor: N+1. "не выше N" / "до N этажа" → maxFloor: N. "с N по M этаж" → minFloor N, maxFloor M. Otherwise null / false.
  Floor wishes go ONLY in these fields, never in keywords.
- keywords: other relevant terms

Examples:
- "2-комнатную до 200 000 в месяц" → {"city":"almaty","type":"rent","rooms":2,"minPrice":null,"maxPrice":200000,"district":null,"keywords":[]}
- "купить 3 комнаты в Бостандыке до 40 млн" → {"city":"almaty","type":"buy","rooms":3,"minPrice":null,"maxPrice":40000000,"district":"Бостандыкский","keywords":[]}
- "studio apartment for rent astana" → {"city":"astana","type":"rent","rooms":1,"minPrice":null,"maxPrice":null,"district":null,"keywords":["studio"]}
- "1-комнатная от 100 до 150 тыс" → {"city":"almaty","type":"rent","rooms":1,"minPrice":100000,"maxPrice":150000,"district":null,"keywords":[]}
- "медеуский район 2 комнаты" → {"city":"almaty","type":"rent","rooms":2,"minPrice":null,"maxPrice":null,"district":"Медеуский","keywords":[]}
- "2-комнатная в Алматы до 40 млн, не первый этаж" → {"city":"almaty","type":"buy","rooms":2,"minPrice":null,"maxPrice":40000000,"district":null,"minArea":null,"minFloor":null,"maxFloor":null,"notFirstFloor":true,"notLastFloor":false,"keywords":[]}

Query: "${userQuery}"`,
      },
    ],
  });

  const text = message.choices[0]?.message?.content?.trim() ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse query into filters");

  return normalizeFilters(JSON.parse(jsonMatch[0]) as SearchFilters, userQuery);
}

const RENT_WORDS = /аренд|снять|снима|в месяц|\/\s*мес|помесячн|посуточн|\brent|per month/i;
const BUY_WORDS = /купить|куплю|продаж|покупк|\bbuy|purchase/i;
const PURCHASE_PRICE_FLOOR = 3_000_000; // no monthly rent in Kazakhstan is this high

// Code-side guard behind the prompt: the model's guesses are corrected by rules
// that are cheap to check, so a wrong guess never reaches the scraper.
export function normalizeFilters(f: SearchFilters, query: string): SearchFilters {
  const out: SearchFilters = { ...f, keywords: [...(f.keywords ?? [])] };
  const q = query.toLowerCase();

  if (RENT_WORDS.test(q)) out.type = "rent";
  else if (BUY_WORDS.test(q)) out.type = "buy";
  else if ((out.maxPrice ?? 0) >= PURCHASE_PRICE_FLOOR || (out.minPrice ?? 0) >= PURCHASE_PRICE_FLOOR) out.type = "buy";

  if (/не\s+(на\s+)?перв/.test(q)) out.notFirstFloor = true;
  if (/не\s+(на\s+)?последн/.test(q)) out.notLastFloor = true;
  out.notFirstFloor = !!out.notFirstFloor;
  out.notLastFloor = !!out.notLastFloor;
  out.minFloor = out.minFloor ?? null;
  out.maxFloor = out.maxFloor ?? null;
  out.keywords = (out.keywords ?? []).filter(k => !/этаж/i.test(k));
  return out;
}

export async function rankAndSummarize(
  listings: Listing[],
  userQuery: string,
  filters: SearchFilters
): Promise<{ listings: Listing[]; aiMessage: string }> {
  if (listings.length === 0) {
    return {
      listings: [],
      aiMessage:
        "Ничего не нашлось по вашему запросу. Попробуйте расширить фильтры — например, увеличить бюджет или убрать район.",
    };
  }

  // Send clean structured data — not pipe-delimited Russian text the model struggles to parse
  const listingsForAI = listings.slice(0, 20).map((l, i) => ({
    index: i,
    price_tenge: l.priceRaw,
    rooms: l.rooms,
    area: l.area,
    floor: l.floor,
    district: l.district,
    description: l.description.slice(0, 120),
  }));

  const isRent = filters.type !== "buy";

  const systemPrompt = isRent
    ? "You are a rental property ranking assistant for Kazakhstan portal Krisha.kz. Prices are monthly rent in KZT. Rank listings by how well they match the renter's needs. Respond with valid JSON only."
    : "You are a property sales ranking assistant for Kazakhstan portal Krisha.kz. Prices are total purchase price in KZT (divide by 1,000,000 to get millions). Rank listings by investment value and match to buyer's needs. Respond with valid JSON only.";

  const rankingCriteria = isRent
    ? `Ranking criteria for RENTAL listings (in order of importance):
1. Monthly price — must fit within budget (price_tenge is monthly rent in KZT)
2. Number of rooms matching request
3. District/location if specified
4. Floor preference (avoid ground floor and top floor unless specified)
5. Area size — bigger is better at same price`
    : `Ranking criteria for PURCHASE listings (in order of importance):
1. Total price — must fit within budget (price_tenge is total price in KZT)
2. Number of rooms matching request
3. Price per m² ratio — lower is better value
4. District/location if specified
5. Floor and building quality — mid-floors preferred, avoid ground floor`;

  const message = await client.chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: 2000,
    response_format: { type: "json_object" },
    reasoning_effort: "low",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: `User's search: "${userQuery}"
Extracted filters: ${JSON.stringify(filters)}

${rankingCriteria}

${listingsForAI.length} listings from Krisha.kz (each has a 0-based "index" field):
${JSON.stringify(listingsForAI, null, 2)}

Rank ALL ${listingsForAI.length} listings. Return ONLY valid JSON:
{
  "aiMessage": "2-3 sentences in Russian: what was found, best options, ${isRent ? "tips on monthly budget" : "tips on price per m² or total value"}. Name options by district and price (e.g. «в Алатауском районе за 28 млн»), never by index number. Use only numbers present in the listings above.",
  "ranked": [
    { "index": 0, "score": 85, "summary": "One sentence in Russian why this listing is a ${isRent ? "good rental" : "good purchase"}" }
  ]
}

Include every listing (all ${listingsForAI.length} items) in "ranked". Scores: 90-100 excellent, 70-89 good, 50-69 acceptable, <50 poor. Sort by score descending.
${filters.district ? `IMPORTANT: The user specifically wants listings in ${filters.district} district. Any listing whose district field does NOT contain "${filters.district}" must receive a score of 20 or below. Only listings clearly in ${filters.district} can score above 50.` : ""}`,
      },
    ],
  });

  const text = message.choices[0]?.message?.content?.trim() ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { listings, aiMessage: `Найдено ${listings.length} вариантов.` };

  const result = JSON.parse(jsonMatch[0]);
  const ranked: { index: number; score: number; summary: string }[] =
    result.ranked || [];

  // Map by 0-based index — avoids ID mismatch bugs
  const scoreMap = new Map(ranked.map((r) => [r.index, r]));

  const scoredListings = listings
    .map((l, i) => {
      const r = scoreMap.get(i);
      return {
        ...l,
        score: r?.score ?? 50,
        aiSummary: r?.summary,
      };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return {
    listings: scoredListings,
    aiMessage: result.aiMessage || `Найдено ${listings.length} вариантов.`,
  };
}
