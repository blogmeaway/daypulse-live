// Cloudflare Pages Function: /api/live
// Provides IP-based geolocation, city search, Open-Meteo weather + sunset,
// astronomical moon phase, and live 4-source global RSS wire (BBC, CNN, Fox News, Al Jazeera).

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data, status = 200, maxAge = 300) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}`,
      ...CORS_HEADERS,
    },
  });
}

function getMoonPhase(date = new Date()) {
  const SYNODIC_MONTH = 29.53058867;
  const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);
  const daysSince = (date.getTime() - KNOWN_NEW_MOON) / 86400000;
  const cycle = ((daysSince % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  const phaseRatio = cycle / SYNODIC_MONTH;
  const illumination = Math.round(((1 - Math.cos(2 * Math.PI * phaseRatio)) / 2) * 100);

  let name = "New Moon";
  let icon = "🌑";
  if (phaseRatio < 0.03 || phaseRatio >= 0.97) {
    name = "New Moon";
    icon = "🌑";
  } else if (phaseRatio < 0.22) {
    name = "Waxing Crescent";
    icon = "🌒";
  } else if (phaseRatio < 0.28) {
    name = "First Quarter";
    icon = "🌓";
  } else if (phaseRatio < 0.47) {
    name = "Waxing Gibbous";
    icon = "🌔";
  } else if (phaseRatio < 0.53) {
    name = "Full Moon";
    icon = "🌕";
  } else if (phaseRatio < 0.72) {
    name = "Waning Gibbous";
    icon = "🌖";
  } else if (phaseRatio < 0.78) {
    name = "Last Quarter";
    icon = "🌗";
  } else {
    name = "Waning Crescent";
    icon = "🌘";
  }

  return { name, icon, illumination, ageDays: Number(cycle.toFixed(1)) };
}

function decodeEntities(str = "") {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRssItems(xml, sourceName, stripSuffix = null, limit = 5) {
  const items = [];
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const block = match[1];
    const titleMatch = block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i);
    const pubDateMatch = block.match(/<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i);
    const descMatch = block.match(/<description\b[^>]*>([\s\S]*?)<\/description>/i);

    let title = titleMatch ? decodeEntities(titleMatch[1]) : "";
    if (stripSuffix && title.endsWith(stripSuffix)) {
      title = title.slice(0, -stripSuffix.length).trim();
    }
    const link = linkMatch ? decodeEntities(linkMatch[1]) : "";
    const pubDate = pubDateMatch ? decodeEntities(pubDateMatch[1]) : "";
    const summary = descMatch ? decodeEntities(descMatch[1]).slice(0, 180) : "";

    if (title && link && !title.toLowerCase().includes("bbc news channel")) {
      items.push({ source: sourceName, title, link, pubDate, summary });
    }
  }
  return items;
}

async function fetchFeedWithFallback(urls, sourceName, stripSuffix = null, limit = 5) {
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; DayPulseBot/1.0; +https://daypulse.live)",
          "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        },
        signal: AbortSignal.timeout(4500),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const parsed = parseRssItems(xml, sourceName, stripSuffix, limit);
      if (parsed.length > 0) return parsed;
    } catch (_) {
      // Try next fallback URL
    }
  }
  return [];
}

async function fetchGlobalNewsWire() {
  const [bbc, cnn, fox, aljazeera] = await Promise.all([
    fetchFeedWithFallback(
      [
        "https://feeds.bbci.co.uk/news/world/rss.xml",
        "https://feeds.bbci.co.uk/news/rss.xml",
      ],
      "BBC News",
      null,
      5
    ),
    fetchFeedWithFallback(
      [
        "https://news.google.com/rss/search?q=site:cnn.com+when:24h&hl=en-US&gl=US&ceid=US:en",
        "http://rss.cnn.com/rss/edition_world.rss",
      ],
      "CNN",
      " - CNN",
      5
    ),
    fetchFeedWithFallback(
      [
        "https://moxie.foxnews.com/google-publisher/latest.xml",
        "https://news.google.com/rss/search?q=site:foxnews.com+when:24h&hl=en-US&gl=US&ceid=US:en",
      ],
      "Fox News",
      " - Fox News",
      5
    ),
    fetchFeedWithFallback(
      [
        "https://www.aljazeera.com/xml/rss/all.xml",
        "https://news.google.com/rss/search?q=site:aljazeera.com+when:24h&hl=en-US&gl=US&ceid=US:en",
      ],
      "Al Jazeera",
      " - Al Jazeera",
      5
    ),
  ]);

  return {
    bbc,
    cnn,
    fox,
    aljazeera,
    fetchedAt: new Date().toISOString(),
  };
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("search");

  if (searchQuery && searchQuery.trim().length >= 2) {
    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          searchQuery.trim()
        )}&count=6&language=en&format=json`,
        { signal: AbortSignal.timeout(4000) }
      );
      const geoData = await geoRes.json();
      const results = (geoData.results || []).map((item) => ({
        name: item.name,
        country: item.country || item.country_code || "",
        admin1: item.admin1 || "",
        lat: item.latitude,
        lon: item.longitude,
        timezone: item.timezone || "UTC",
      }));
      return jsonResponse({ results }, 200, 3600);
    } catch (err) {
      return jsonResponse({ results: [], error: "City lookup failed" }, 200, 60);
    }
  }

  const cf = request.cf || {};
  let lat = parseFloat(url.searchParams.get("lat"));
  let lon = parseFloat(url.searchParams.get("lon"));
  let city = url.searchParams.get("city");
  let country = url.searchParams.get("country");

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    lat = parseFloat(cf.latitude);
    lon = parseFloat(cf.longitude);
    city = cf.city || "London";
    country = cf.country || "GB";
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    lat = 51.5072;
    lon = -0.1276;
    city = city || "London";
    country = country || "UK";
  }

  const includeNews = url.searchParams.get("news") !== "0";

  const weatherPromise = fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=2`,
    { signal: AbortSignal.timeout(4500) }
  )
    .then((r) => r.json())
    .catch(() => null);

  const newsPromise = includeNews ? fetchGlobalNewsWire() : Promise.resolve(null);

  const [weatherRaw, news] = await Promise.all([weatherPromise, newsPromise]);

  let weather = null;
  if (weatherRaw && weatherRaw.current) {
    const sunsetIso = weatherRaw.daily?.sunset?.[0] || null;
    const sunriseIso = weatherRaw.daily?.sunrise?.[0] || null;
    weather = {
      tempC: Math.round(weatherRaw.current.temperature_2m),
      tempF: Math.round((weatherRaw.current.temperature_2m * 9) / 5 + 32),
      feelsLikeC: Math.round(weatherRaw.current.apparent_temperature),
      feelsLikeF: Math.round((weatherRaw.current.apparent_temperature * 9) / 5 + 32),
      highC: weatherRaw.daily?.temperature_2m_max?.[0] != null ? Math.round(weatherRaw.daily.temperature_2m_max[0]) : null,
      lowC: weatherRaw.daily?.temperature_2m_min?.[0] != null ? Math.round(weatherRaw.daily.temperature_2m_min[0]) : null,
      code: weatherRaw.current.weather_code,
      isDay: weatherRaw.current.is_day === 1,
      windKmh: Math.round(weatherRaw.current.wind_speed_10m),
      sunrise: sunriseIso ? sunriseIso.split("T")[1] : null,
      sunset: sunsetIso ? sunsetIso.split("T")[1] : null,
      timezone: weatherRaw.timezone || cf.timezone || "UTC",
    };
  }

  return jsonResponse(
    {
      location: {
        city: city || "London",
        country: country || "",
        lat,
        lon,
      },
      weather,
      moon: getMoonPhase(new Date()),
      news,
      serverTime: new Date().toISOString(),
    },
    200,
    300
  );
}
