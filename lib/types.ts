export interface SearchFilters {
  city: string;
  type: "rent" | "buy";
  rooms?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  district?: string | null;
  minArea?: number | null;
  keywords?: string[];
}

export interface Listing {
  id: string;
  title: string;
  price: string;
  priceRaw: number;
  rooms: string;
  area: string;
  floor: string;
  district: string;
  address: string;
  description: string;
  url: string;
  imageUrl?: string;
  aiSummary?: string;
  score?: number;
  postedAt?: string;       // e.g. "2 часа назад", "3 дня назад"
  isOwner?: boolean;       // true = owner, false = realtor/agency
  priceDeviation?: number; // % diff from avg price (negative = cheaper)
}

export interface SearchResult {
  listings: Listing[];
  filters: SearchFilters;
  totalFound: number;
  aiMessage: string;
  avgPrice?: number;       // average price across all results
  ownerCount?: number;
  realtorCount?: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
