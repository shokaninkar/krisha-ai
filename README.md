# Krisha AI

Plain-language apartment search over [krisha.kz](https://krisha.kz), Kazakhstan's main property listings site.

Type what you want in Russian or English ("2-комнатная в Алматы до 40 млн, не первый этаж"). An LLM turns the sentence into structured search filters, the app scrapes the matching krisha.kz listings, and the results come back ranked with a match score and how far each price sits from the market.

## How it works

1. `app/api/search/route.ts` sends the query to GPT-OSS 120B on Groq and gets back a JSON filter object (rooms, price range, area, floor, district).
2. `lib/scraper.ts` builds the krisha.kz URL from those filters and parses the listing cards with cheerio.
3. Results are scored against the original request and returned to the Next.js front end in `app/page.tsx`.

Related repos: an agency SaaS that watches listings around the clock and alerts brokers on Telegram, and a Chrome extension that runs the same search on krisha.kz itself.

## Run locally

```bash
npm install
cp .env.example .env.local   # add your Groq key
npm run dev
```

`.env.local` needs one variable:

```
GROQ_API_KEY=...
```

## Stack

Next.js 16 (App Router), TypeScript, Groq (GPT-OSS 120B), cheerio, Tailwind CSS.

## Caveat

krisha.kz is scraped server-side. If the site rate-limits the deployment's IP range, searches fail with a 500 from `/api/listings`; run locally or add a proxy.
