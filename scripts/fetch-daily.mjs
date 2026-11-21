import { mkdir, writeFile } from "node:fs/promises";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"
];

const MUSIC_KEYWORDS = [
  "album", "song", "single", "singer", "musician", "band", "rock", "pop",
  "jazz", "hip hop", "rap", "grammy", "billboard", "concert", "composer",
  "symphony", "record", "guitar", "vocalist", "beatles", "elvis", "opera"
];

const RSS_SOURCES = [
  { id: "bbc", name: "BBC News", lens: "UK / Europe Lens", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { id: "cnn", name: "CNN", lens: "US Mainstream", url: "http://rss.cnn.com/rss/edition_world.rss" },
  { id: "fox", name: "Fox News", lens: "US Conservative", url: "https://moxie.foxnews.com/google-publisher/world.xml" },
  { id: "aljazeera", name: "Al Jazeera", lens: "Middle East / Global South", url: "https://www.aljazeera.com/xml/rss/all.xml" }
];

const LEXICON = [
  { word: "Apricity", phonetic: "/əˈprɪs.ɪ.ti/", pos: "noun • literary", definition: "The warmth of the sun in winter.", example: "She paused on the porch to enjoy the brief afternoon apricity." },
  { word: "Sonder", phonetic: "/ˈsɒn.dər/", pos: "noun • modern coinage", definition: "The realization that each random passerby is living a life as vivid and complex as your own.", example: "Watching commuters cross the station filled him with a quiet sense of sonder." },
  { word: "Petrichor", phonetic: "/ˈpɛt.rɪ.kɔːr/", pos: "noun", definition: "A pleasant earthy smell produced when rain falls on dry soil.", example: "After weeks of summer heat, the evening storm brought a wave of petrichor." },
  { word: "Vellichor", phonetic: "/ˈvɛl.ɪ.kɔːr/", pos: "noun • literary", definition: "The strange wistfulness of used bookstores infused with the passage of time.", example: "Rows of annotated paperbacks gave the basement shop an unmistakable vellichor." },
  { word: "Eudaimonia", phonetic: "/ˌjuː.daɪˈmoʊ.ni.ə/", pos: "noun • philosophy", definition: "Human flourishing and deep fulfillment lived through purpose and virtue.", example: "Aristotle argued that lasting eudaimonia comes from lifelong curiosity and character." },
  { word: "Clinquant", phonetic: "/ˈklɪŋ.kənt/", pos: "adjective", definition: "Glittering with gold, tinsel, or showy brilliance.", example: "The theater's clinquant chandelier caught every beam of stage light." },
  { word: "Susurrus", phonetic: "/suːˈsɜːr.əs/", pos: "noun", definition: "A soft whispering or rustling sound, like wind through leaves.", example: "Only the susurrus of tall pines broke the morning silence." }
];

const QUOTES = [
  { text: "Judge a man by his questions rather than by his answers.", author: "Voltaire" },
  { text: "Champions keep playing until they get it right.", author: "Billie Jean King" },
  { text: "The measure of intelligence is the ability to change.", author: "Albert Einstein" },
  { text: "Well done is better than well said.", author: "Benjamin Franklin" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Will Durant" },
  { text: "Turn your wounds into wisdom.", author: "Oprah Winfrey" }
];

const HEADERS = {
  "User-Agent": "DayPulseBot/1.0 (+https://daypulse.live)",
  "Accept": "application/json, text/html, application/xml;q=0.9"
};

function cleanText(str = "") {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchSafe(url) {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function scrapeDaysOfTheYear(monthSlug, day) {
  const html = await fetchSafe(`https://www.daysoftheyear.com/days/${monthSlug}/${day}/`);
  if (!html) return [];
  const matches = [...html.matchAll(/<h[23][^>]*>(.*?)<\/h[23]>/gi)]
    .map(m => cleanText(m[1]))
    .filter(t => t.length > 4 && t.length < 80 && !/days of the year|explore|upcoming|popular/i.test(t));
  return [...new Set(matches)].slice(0, 6);
}

async function scrapeThisDayInMusic(monthSlug, day) {
  const html = await fetchSafe(`https://www.thisdayinmusic.com/on-this-day/${monthSlug}-${day}/`);
  if (!html) return [];
  const matches = [...html.matchAll(/<p[^>]*>(.*?)<\/p>/gi)]
    .map(m => cleanText(m[1]))
    .filter(t => /^\d{4}\s*[-–—]/.test(t) && t.length > 35 && t.length < 320);
  return matches.slice(0, 3).map(entry => {
    const match = entry.match(/^(\d{4})\s*[-–—]\s*(.*)$/);
    return {
      year: match ? match[1] : "",
      title: match ? match[2].split(".")[0] : entry.slice(0, 70),
      summary: match ? match[2] : entry,
      source: "This Day in Music"
    };
  });
}

async function fetchWikipediaOnThisDay(monthNum, dayNum) {
  const mm = String(monthNum).padStart(2, "0");
  const dd = String(dayNum).padStart(2, "0");
  const raw = await fetchSafe(`https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${mm}/${dd}`);
  if (!raw) return { holidays: [], events: [], births: [] };
  try {
    return JSON.parse(raw);
  } catch {
    return { holidays: [], events: [], births: [] };
  }
}

function getDayOfYear(dateObj) {
  const start = new Date(Date.UTC(dateObj.getUTCFullYear(), 0, 0));
  return Math.floor((dateObj - start) / 86400000);
}

async function buildDayPayload(dateObj) {
  const monthIdx = dateObj.getUTCMonth();
  const monthNum = monthIdx + 1;
  const dayNum = dateObj.getUTCDate();
  const monthSlug = MONTHS[monthIdx];
  const label = dateObj.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });

  const [dotyList, tdimMusic, wiki] = await Promise.all([
    scrapeDaysOfTheYear(monthSlug, dayNum),
    scrapeThisDayInMusic(monthSlug, dayNum),
    fetchWikipediaOnThisDay(monthNum, dayNum)
  ]);

  const wikiHolidays = (wiki.holidays || []).slice(0, 6).map(h => ({
    title: h.text,
    category: /UN|World|International/i.test(h.text) ? "global" : "fun",
    source: "Wikipedia",
    description: `Officially recognized observance marked on ${label}.`
  }));

  const dotyFormatted = dotyList.map(title => ({
    title,
    category: /World|International/i.test(title) ? "global" : "fun",
    source: "Days Of The Year",
    description: `Celebrated annually on ${label} across international communities.`
  }));

  const observances = [...dotyFormatted, ...wikiHolidays].slice(0, 6);

  const wikiMusic = (wiki.events || [])
    .filter(e => MUSIC_KEYWORDS.some(k => e.text.toLowerCase().includes(k)))
    .slice(0, 3)
    .map(e => ({
      year: String(e.year),
      title: e.pages?.[0]?.normalizedtitle || "Music History Milestone",
      summary: e.text,
      source: "Wikimedia"
    }));

  const music = [...tdimMusic, ...wikiMusic].slice(0, 3);

  const births = (wiki.births || [])
    .filter(b => b.pages?.[0]?.description)
    .slice(0, 3)
    .map(b => ({
      year: String(b.year),
      name: b.pages[0].normalizedtitle,
      role: b.pages[0].description,
      bio: b.text
    }));

  const doy = getDayOfYear(dateObj);
  const wordOfTheDay = LEXICON[doy % LEXICON.length];
  const quote = QUOTES[doy % QUOTES.length];

  const firstBirth = births[0] || { year: "1965", name: "Björk", role: "Musician" };
  const trivia = {
    question: `In what year was ${firstBirth.name} (${firstBirth.role}) born on this date?`,
    options: [
      String(Number(firstBirth.year) - 4),
      String(firstBirth.year),
      String(Number(firstBirth.year) + 3)
    ],
    answerIndex: 1
  };

  return {
    dateLabel: label,
    monthSlug,
    day: dayNum,
    observances,
    music,
    births,
    wordOfTheDay,
    quote,
    trivia
  };
}

async function fetchHeadlines() {
  return Promise.all(
    RSS_SOURCES.map(async src => {
      const xml = await fetchSafe(src.url);
      if (!xml) {
        return {
          id: src.id,
          name: src.name,
          lens: src.lens,
          title: `Latest global coverage from ${src.name}`,
          link: new URL(src.url).origin
        };
      }
      const itemMatch = xml.match(/<item[\s\S]*?<\/item>/i);
      const block = itemMatch ? itemMatch[0] : xml;
      const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const linkMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      return {
        id: src.id,
        name: src.name,
        lens: src.lens,
        title: cleanText(titleMatch?.[1] || "Top World Story"),
        link: cleanText(linkMatch?.[1] || new URL(src.url).origin)
      };
    })
  );
}

async function main() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [todayData, tomorrowData, headlines] = await Promise.all([
    buildDayPayload(now),
    buildDayPayload(tomorrow),
    fetchHeadlines()
  ]);

  const output = {
    updatedAt: now.toISOString(),
    today: todayData,
    tomorrow: tomorrowData,
    headlines
  };

  await mkdir("data", { recursive: true });
  await writeFile("data/today.json", JSON.stringify(output, null, 2), "utf8");
  console.log("Updated data/today.json at", output.updatedAt);
}

main();
