import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export interface Listing {
  id: string
  title: string
  price: string
  priceNum: number
  rooms: number
  area: number
  floor: string
  address: string
  url: string
  imageUrl: string | null
}

export async function GET() {
  const url = 'https://krisha.kz/prodazha/kvartiry/almaty/?das[live.rooms]=1&das[price][to]=25000000&das[live.square][from]=30'

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
    },
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 })
  }

  const html = await res.text()
  const $ = cheerio.load(html)
  const listings: Listing[] = []

  $('.a-card').each((_, el) => {
    const card = $(el)

    const linkEl = card.find('a.a-card__title')
    const href = linkEl.attr('href') || ''
    const id = href.split('/').filter(Boolean).pop() || String(Math.random())
    const title = linkEl.text().trim()

    const priceText = card.find('.a-card__price').text().trim()
    const priceNum = parseInt(priceText.replace(/\D/g, ''), 10) || 0

    const params = card.find('.a-card__parameters').text().trim()
    const roomsMatch = params.match(/(\d+)-комн/)
    const areaMatch = params.match(/([\d.]+)\s*м²/)
    const floorMatch = params.match(/(\d+\/\d+\s*эт)/)

    const rooms = roomsMatch ? parseInt(roomsMatch[1]) : 1
    const area = areaMatch ? parseFloat(areaMatch[1]) : 0
    const floor = floorMatch ? floorMatch[1] : ''

    const address = card.find('.a-card__subtitle').text().trim()
    const imageUrl = card.find('img').attr('src') || null

    if (title && priceNum > 0) {
      listings.push({
        id,
        title,
        price: priceText,
        priceNum,
        rooms,
        area,
        floor,
        address,
        url: 'https://krisha.kz' + href,
        imageUrl,
      })
    }
  })

  return NextResponse.json({ listings, total: listings.length })
}
