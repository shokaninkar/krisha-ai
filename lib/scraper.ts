import * as cheerio from "cheerio";
import type { Listing, SearchFilters } from "./types";

const BASE = "https://krisha.kz";

// Krisha.kz uses numeric IDs for the das[live.rayon] filter.
// Keys are lowercase canonical district name fragments for fuzzy matching.
const ALMATY_DISTRICT_IDS: Record<string, number> = {
  алмалинский: 1,
  бостандыкский: 2,
  ауэзовский: 3,
  медеуский: 4,
  алатауский: 5,
  жетысуский: 6,
  наурызбайский: 7,
  турксибский: 8,
};

function resolveDistrictId(district: string, city: string): number | null {
  if (city !== "almaty") return null; // only mapped for Almaty for now
  const lower = district.toLowerCase();
  for (const [key, id] of Object.entries(ALMATY_DISTRICT_IDS)) {
    if (lower.includes(key) || key.includes(lower.slice(0, 6))) return id;
  }
  return null;
}

function buildUrl(filters: SearchFilters): string {
  const segment = filters.type === "rent" ? "arenda" : "prodazha";
  const city = filters.city.toLowerCase().replace(/\s+/g, "-") || "almaty";
  let url = `${BASE}/${segment}/kvartiry/${city}/`;

  const params: string[] = ["das[_sys.hasphoto]=1"];

  if (filters.rooms) {
    params.push(`das[live.rooms]=${filters.rooms}`);
  }
  if (filters.maxPrice) {
    params.push(`das[price][to]=${filters.maxPrice}`);
  }
  if (filters.minPrice) {
    params.push(`das[price][from]=${filters.minPrice}`);
  }
  if (filters.minArea) {
    params.push(`das[live.square][from]=${filters.minArea}`);
  }
  if (filters.notFirstFloor) params.push("das[floor_not_first]=1");
  if (filters.notLastFloor) params.push("das[floor_not_last]=1");
  if (filters.minFloor) params.push(`das[flat.floor][from]=${filters.minFloor}`);
  if (filters.maxFloor) params.push(`das[flat.floor][to]=${filters.maxFloor}`);
  if (filters.district) {
    const id = resolveDistrictId(filters.district, city);
    if (id !== null) {
      params.push(`das[live.rayon]=${id}`);
    }
    // If no ID found, skip the filter — wrong text breaks Krisha's search
    // The AI ranking will still deprioritize wrong-district results
  }

  if (params.length) {
    url += "?" + params.join("&");
  }

  return url;
}

// Krisha's floor params filter the main results but not every card on the page,
// so enforce them again here. Unknown floors pass; we can't prove they break the rule.
export function matchesFloor(f: SearchFilters, floor?: number, total?: number): boolean {
  if (floor === undefined) return true;
  if (f.notFirstFloor && floor <= 1) return false;
  if (f.notLastFloor && total !== undefined && floor >= total) return false;
  if (f.minFloor && floor < f.minFloor) return false;
  if (f.maxFloor && floor > f.maxFloor) return false;
  return true;
}

export async function scrapeListings(filters: SearchFilters): Promise<Listing[]> {
  const url = buildUrl(filters);

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`Krisha.kz returned ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const listings: Listing[] = [];

  $("div.a-card").each((_, el) => {
    const card = $(el);

    const id = card.attr("data-id") || String(Math.random());
    const titleEl = card.find("a.a-card__title");
    const titleText = titleEl.text().trim();
    const href = titleEl.attr("href") || "";
    if (!titleText || !href) return;

    const url = href.startsWith("http") ? href : `${BASE}${href}`;

    // Price — ".a-card__price" contains e.g. "350 000 〒 за месяц"
    const priceRaw = (() => {
      const t = card.find(".a-card__price").text();
      const digits = t.replace(/[^\d]/g, "");
      return parseInt(digits, 10) || 0;
    })();
    const priceText = (() => {
      if (!priceRaw) return "Цена не указана";
      return priceRaw.toLocaleString("ru-RU") + " 〒";
    })();

    // Rooms, area, floor are all embedded in the title
    // e.g. "2-комнатная квартира · 65 м² · 3/13 этаж"
    const roomMatch = titleText.match(/(\d+)-комн/);
    const rooms = roomMatch ? roomMatch[1] + " комн." : "—";

    const areaMatch = titleText.match(/([\d.]+)\s*м²/);
    const area = areaMatch ? areaMatch[1] + " м²" : "—";

    // Either "3/13 этаж" (floor/total) or just "1 этаж" for houses and some cards
    const floorMatch = titleText.match(/(\d+)(?:\/(\d+))?\s*этаж/);
    const floorNum = floorMatch ? parseInt(floorMatch[1], 10) : undefined;
    const floorTotal = floorMatch?.[2] ? parseInt(floorMatch[2], 10) : undefined;
    const floor = floorNum === undefined ? "—" : floorTotal ? `${floorNum}/${floorTotal} эт.` : `${floorNum} эт.`;
    if (!matchesFloor(filters, floorNum, floorTotal)) return;

    // Address is in .a-card__subtitle
    const subtitle = card.find(".a-card__subtitle").first().text().trim();
    const district = subtitle;
    const address = subtitle;

    // Description preview
    const description = card.find(".a-card__text-preview").text().trim();

    // Image — prefer webp source srcset, fallback to img src
    const imgSrc = (() => {
      const webpSrc = card.find("source[type='image/webp']").first().attr("srcset");
      if (webpSrc) return webpSrc.split(" ")[0];
      return card.find("img.a-image__img").first().attr("src") || undefined;
    })();

    // Time posted — Krisha puts it in .a-card__date or similar
    const postedAt = (() => {
      const dateEl = card.find(".a-card__date, [class*='card__date'], .a-card__stats").first().text().trim();
      if (dateEl) return dateEl;
      const fullText = card.text();
      const m = fullText.match(/\d+\s*(час|минут|ден|день|дней|неделю|месяц|год)[а-яёА-ЯЁ]*/i);
      return m ? m[0].trim() : undefined;
    })();

    // Owner vs realtor — owner listings typically show "хозяин/хозяйка"
    const isOwner = (() => {
      const tagText = card.find("[class*='tag'], [class*='owner'], [class*='agent']").text().toLowerCase();
      if (tagText.includes("хозяин") || tagText.includes("хозяйк")) return true;
      if (tagText.includes("агент") || tagText.includes("риелтор") || tagText.includes("агентств")) return false;
      const fullText = card.text().toLowerCase();
      if (fullText.includes("хозяин") || fullText.includes("хозяйк")) return true;
      if (fullText.includes("агентство") || fullText.includes("риелтор")) return false;
      return undefined;
    })();

    listings.push({
      id,
      title: titleText,
      price: priceText,
      priceRaw,
      rooms,
      area,
      floor,
      district,
      address,
      description,
      url,
      imageUrl: imgSrc,
      postedAt,
      isOwner,
    });
  });

  return listings.slice(0, 20);
}
