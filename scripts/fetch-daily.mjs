// Automated Daily Data Collector for DayPulse.live
// Runs via GitHub Actions (Node 20+ native fetch, zero external dependencies).
// Populates data/today.json with Today & Tomorrow:
// - World & National Observances (Wikimedia On This Day + Days Of The Year)
// - 3 Music History Milestones (Wikimedia + This Day in Music)
// - 3 Notable Birthdays (Wikimedia)
// - Word of the Day, Quote of the Day, Daily Trivia, and fallback News Wire

import fs from "node:fs/promises";
import path from "node:path";

const UA = "DayPulseDailyBot/1.0 (https://daypulse.live; contact@daypulse.live)";

const CURATED_WORDS = [
  { word: "Apricity", phonetic: "/əˈprɪs.ɪ.ti/", pos: "noun", definition: "The warmth of the sun felt on a crisp winter's day.", example: "Stepping out onto the terrace at noon, she paused to enjoy the sudden apricity." },
  { word: "Sonder", phonetic: "/ˈsɒn.dər/", pos: "noun", definition: "The realization that each random passerby is living a life as vivid and complex as your own.", example: "Watching commuters cross the concourse brought on a quiet wave of sonder." },
  { word: "Vellichor", phonetic: "/ˈvɛl.ɪ.kɔːr/", pos: "noun", definition: "The wistful, evocative atmosphere of secondhand bookshops.", example: "The narrow aisles smelled of cedar, old ink, and unmistakable vellichor." },
  { word: "Eudaimonia", phonetic: "/ˌjuː.daɪˈmoʊ.ni.ə/", pos: "noun", definition: "Human flourishing and deep contentment achieved through virtue and purposeful living.", example: "Aristotle argued that eudaimonia is the highest aim of human action." },
  { word: "Perspicacious", phonetic: "/ˌpɜː.spɪˈkeɪ.ʃəs/", pos: "adjective", definition: "Having a ready insight into and understanding of things; shrewd and observant.", example: "Her perspicacious analysis spotted the flaw in the treaty before anyone else." },
  { word: "Halcyon", phonetic: "/ˈhæl.si.ən/", pos: "adjective", definition: "Denoting a period of time in the past that was idyllically happy and peaceful.", example: "They looked back fondly on the halcyon summers spent by the coast." },
  { word: "Susurrus", phonetic: "/suːˈsʌr.əs/", pos: "noun", definition: "A soft whispering or rustling sound, such as wind through leaves.", example: "The gentle susurrus of the pines lulled the camp to sleep." },
  { word: "Equanimity", phonetic: "/ˌiː.kwəˈnɪm.ɪ.ti/", pos: "noun", definition: "Mental calmness, composure, and evenness of temper, especially in a difficult situation.", example: "She accepted the unexpected delay with remarkable equanimity." },
  { word: "Ineffable", phonetic: "/ɪnˈɛf.ə.bəl/", pos: "adjective", definition: "Too great or extreme to be expressed or described in words.", example: "Standing at the edge of the canyon filled him with an ineffable sense of awe." },
  { word: "Serendipity", phonetic: "/ˌsɛr.ənˈdɪp.ɪ.ti/", pos: "noun", definition: "The occurrence of finding valuable or agreeable things not sought for.", example: "Discovering the small jazz cellar down a side street was pure serendipity." },
  { word: "Luminous", phonetic: "/ˈluː.mɪ.nəs/", pos: "adjective", definition: "Full of or shedding light; bright or shining, especially in the dark.", example: "The astronomer pointed toward a luminous cluster low on the eastern horizon." },
  { word: "Sagacious", phonetic: "/səˈɡeɪ.ʃəs/", pos: "adjective", definition: "Having or showing keen mental discernment and good judgment; wise.", example: "His sagacious counsel saved the expedition from an early retreat." },
];

const CURATED_QUOTES = [
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Will Durant", role: "Historian & Philosopher" },
  { text: "The best time to plant a tree was twenty years ago. The second best time is now.", author: "Chinese Proverb", role: "Traditional Wisdom" },
  { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein", role: "Theoretical Physicist" },
  { text: "Do not wait to strike till the iron is hot; but make it hot by striking.", author: "William Butler Yeats", role: "Poet & Nobel Laureate" },
  { text: "It is not that we have a short time to live, but that we waste a lot of it.", author: "Seneca", role: "Stoic Philosopher" },
  { text: "Curiosity is the wick in the candle of learning.", author: "William Arthur Ward", role: "Writer" },
  { text: "Well begun is half done.", author: "Aristotle", role: "Greek Philosopher" },
  { text: "The measure of intelligence is the ability to change.", author: "Albert Einstein", role: "Theoretical Physicist" },
  { text: "Simplicity is about subtracting the obvious and adding the meaningful.", author: "John Maeda", role: "Designer & Technologist" },
  { text: "What you do today can improve all your tomorrows.", author: "Ralph Marston", role: "Author" },
];

const CURATED_TRIVIA = [
  {
    category: "Science & Space",
    question: "Which planet in our Solar System rotates in the opposite direction to most other planets, causing the Sun to rise in the west?",
    options: ["Venus", "Mars", "Neptune", "Mercury"],
    answer: "Venus",
    explanation: "Venus has a retrograde rotation, spinning clockwise on its axis once every 243 Earth days."
  },
  {
    category: "Geography",
    question: "Which country has the longest coastline in the world?",
    options: ["Canada", "Indonesia", "Russia", "Australia"],
    answer: "Canada",
    explanation: "Canada's coastline stretches over 202,080 kilometers across the Atlantic, Pacific, and Arctic oceans."
  },
  {
    category: "History & Culture",
    question: "In which city was the first modern Olympic Games held in 1896?",
    options: ["Athens", "Paris", "London", "Rome"],
    answer: "Athens",
    explanation: "Athens hosted the inaugural modern Olympic Games in April 1896 with 14 participating nations."
  },
  {
    category: "Music & Arts",
    question: "How many keys are on a standard full-size modern piano?",
    options: ["88", "76", "84", "92"],
    answer: "88",
    explanation: "A standard modern piano has 88 keys: 52 white keys and 36 black keys."
  },
  {
    category: "Nature",
    question: "What is the only mammal capable of true sustained flight?",
    options: ["Bat", "Flying squirrel", "Sugar glider", "Colugo"],
    answer: "Bat",
    explanation: "Bats are the only mammals with wings capable of true powered flight; others only glide."
  },
  {
    category: "World & Language",
    question: "Which chemical element gives emeralds their rich green color?",
    options: ["Chromium", "Copper", "Cobalt", "Titanium"],
    answer: "Chromium",
    explanation: "Trace amounts of chromium (and sometimes vanadium) give beryl crystals their emerald green hue."
  },
];

const MUSIC_KEYWORDS = [
  "album", "song", "single", "music", "band", "concert", "grammy", "billboard",
  "symphony", "opera", "singer", "musician", "guitarist", "composer", "record",
  "tour", "festival", "woodstock", "beatles", "elvis", "mozart", "beethoven",
  "jazz", "rock", "pop", "hip hop", "orchestra", "chart", "release", "debut"
];

function decodeHtml(str = "") {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getDayOfYear(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86400000);
}

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function fetchJson(url, headers = {}) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, ...headers },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchText(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchDaysOfTheYearRss() {
  const xml = await fetchText("https://www.daysoftheyear.com/feed/");
  if (!xml) return [];
  const items = [];
  const regex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = regex.exec(xml)) !== null && items.length < 12) {
    const block = m[1];
    const title = decodeHtml((block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
    const link = decodeHtml((block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || "");
    const desc = decodeHtml((block.match(/<description\b[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || "");
    if (title) {
      items.push({
        title,
        region: "Global / Cultural",
        description: desc.slice(0, 160),
        url: link || "https://www.daysoftheyear.com/",
      });
    }
  }
  return items;
}

async function fetchThisDayInMusicRss() {
  const xml = await fetchText("https://www.thisdayinmusic.com/feed/");
  if (!xml) return [];
  const items = [];
  const regex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = regex.exec(xml)) !== null && items.length < 6) {
    const block = m[1];
    const title = decodeHtml((block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
    const link = decodeHtml((block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || "");
    const desc = decodeHtml((block.match(/<description\b[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || "");
    const yearMatch = `${title} ${desc}`.match(/\b(19\d{2}|20[0-2]\d)\b/);
    if (title) {
      items.push({
        year: yearMatch ? Number(yearMatch[1]) : null,
        title,
        detail: desc.slice(0, 180) || title,
        url: link || "https://www.thisdayinmusic.com/",
      });
    }
  }
  return items;
}

async function fetchWordOfTheDay(doy) {
  const xml = await fetchText("https://www.merriam-webster.com/wotd/feed/rss2");
  if (xml) {
    const itemMatch = xml.match(/<item\b[^>]*>([\s\S]*?)<\/item>/i);
    if (itemMatch) {
      const block = itemMatch[1];
      const title = decodeHtml((block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
      const desc = decodeHtml((block.match(/<description\b[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || "");
      if (title && desc && title.length < 28) {
        const cleanWord = title.charAt(0).toUpperCase() + title.slice(1);
        const sentences = desc.split(/(?<=\.)\s+/).filter(Boolean);
        return {
          word: cleanWord,
          phonetic: "",
          pos: "word of the day",
          definition: sentences[0] || desc.slice(0, 180),
          example: sentences[1] || `Daily featured vocabulary: ${cleanWord}.`,
        };
      }
    }
  }
  return CURATED_WORDS[doy % CURATED_WORDS.length];
}

async function fetchQuoteOfTheDay(doy) {
  const data = await fetchJson("https://zenquotes.io/api/today");
  if (Array.isArray(data) && data[0]?.q && data[0]?.a) {
    return {
      text: decodeHtml(data[0].q),
      author: decodeHtml(data[0].a),
      role: "Daily Reflection",
    };
  }
  return CURATED_QUOTES[doy % CURATED_QUOTES.length];
}

async function fetchTrivia(doy) {
  const data = await fetchJson("https://opentdb.com/api.php?amount=1&type=multiple&encode=url3986");
  if (data?.response_code === 0 && Array.isArray(data.results) && data.results[0]) {
    const q = data.results[0];
    const question = decodeURIComponent(q.question);
    const answer = decodeURIComponent(q.correct_answer);
    const incorrect = q.incorrect_answers.map((a) => decodeURIComponent(a));
    const options = [...incorrect, answer].sort((a, b) => a.localeCompare(b));
    return {
      category: decodeURIComponent(q.category),
      question,
      options,
      answer,
      explanation: `Correct answer: ${answer} (${decodeURIComponent(q.category)}).`,
    };
  }
  return CURATED_TRIVIA[doy % CURATED_TRIVIA.length];
}

async function buildDayBundle(dateObj, dotyRss, tdimRss, isToday) {
  const mm = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getUTCDate()).padStart(2, "0");
  const doy = getDayOfYear(dateObj);

  const wiki = await fetchJson(
    `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${mm}/${dd}`
  );

  // 1. World & National Observances
  const observances = [];
  const seenTitles = new Set();

  if (wiki?.holidays && Array.isArray(wiki.holidays)) {
    for (const h of wiki.holidays) {
      const text = decodeHtml(h.text || "");
      const page = h.pages?.[0];
      const title = page?.normalizedtitle || text.split("(")[0].trim();
      if (title && !seenTitles.has(title.toLowerCase()) && observances.length < 6) {
        seenTitles.add(title.toLowerCase());
        observances.push({
          title,
          region: text.includes("(") ? text.match(/\(([^)]+)\)/)?.[1] || "International" : "World / National",
          description: page?.extract ? page.extract.slice(0, 150) : text,
          url: page?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, "_"))}`,
        });
      }
    }
  }

  if (isToday && dotyRss.length > 0) {
    for (const item of dotyRss) {
      if (!seenTitles.has(item.title.toLowerCase()) && observances.length < 6) {
        seenTitles.add(item.title.toLowerCase());
        observances.push(item);
      }
    }
  }

  if (observances.length === 0) {
    observances.push({
      title: `Global Cultural & Civic Observances (${formatDisplayDate(dateObj)})`,
      region: "International",
      description: "Daily international awareness, heritage, and civic commemorations around the world.",
      url: `https://en.wikipedia.org/wiki/${dateObj.toLocaleString("en-US", { month: "long", timeZone: "UTC" })}_${dateObj.getUTCDate()}`,
    });
  }

  // 2. 3 Music History Milestones
  const musicMilestones = [];
  const allEvents = [...(wiki?.selected || []), ...(wiki?.events || [])];
  for (const ev of allEvents) {
    if (musicMilestones.length >= 3) break;
    const text = decodeHtml(ev.text || "");
    const lower = text.toLowerCase();
    const isMusic = MUSIC_KEYWORDS.some((kw) => new RegExp(`\\b${kw}s?\\b`, "i").test(lower));
    if (isMusic && text.length > 20) {
      const page = ev.pages?.[0];
      if (!musicMilestones.some((m) => m.title === text)) {
        musicMilestones.push({
          year: ev.year || null,
          title: text,
          detail: page?.description || "Music history milestone",
          url: page?.content_urls?.desktop?.page || "https://en.wikipedia.org/wiki/Portal:Music",
        });
      }
    }
  }

  if (isToday && musicMilestones.length < 3 && tdimRss.length > 0) {
    for (const item of tdimRss) {
      if (musicMilestones.length >= 3) break;
      musicMilestones.push(item);
    }
  }

  while (musicMilestones.length < 3 && allEvents.length > musicMilestones.length) {
    const ev = allEvents[musicMilestones.length];
    const text = decodeHtml(ev.text || "");
    const page = ev.pages?.[0];
    musicMilestones.push({
      year: ev.year || null,
      title: text,
      detail: page?.description || "Notable cultural milestone",
      url: page?.content_urls?.desktop?.page || "https://en.wikipedia.org/",
    });
  }

  // 3. 3 Notable Birthdays
  const birthdays = [];
  if (wiki?.births && Array.isArray(wiki.births)) {
    const ranked = [...wiki.births].sort((a, b) => {
      const scoreA = (a.pages?.[0]?.thumbnail ? 2 : 0) + (a.pages?.[0]?.extract ? 1 : 0);
      const scoreB = (b.pages?.[0]?.thumbnail ? 2 : 0) + (b.pages?.[0]?.extract ? 1 : 0);
      return scoreB - scoreA;
    });

    for (const b of ranked) {
      if (birthdays.length >= 3) break;
      const page = b.pages?.[0];
      const rawText = decodeHtml(b.text || "");
      const name = page?.normalizedtitle || rawText.split(",")[0].trim();
      const role = page?.description || rawText.split(",").slice(1).join(",").trim() || "Notable figure";
      if (name && !birthdays.some((x) => x.name === name)) {
        birthdays.push({
          name,
          year: b.year || null,
          role: role.charAt(0).toUpperCase() + role.slice(1),
          url: page?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/\s+/g, "_"))}`,
        });
      }
    }
  }

  const [word, quote, trivia] = await Promise.all([
    fetchWordOfTheDay(doy),
    fetchQuoteOfTheDay(doy),
    fetchTrivia(doy),
  ]);

  return {
    isoDate: formatIsoDate(dateObj),
    displayDate: formatDisplayDate(dateObj),
    observances,
    music: musicMilestones.slice(0, 3),
    birthdays: birthdays.slice(0, 3),
    word,
    quote,
    trivia,
  };
}

async function fetchFallbackNews() {
  const feeds = [
    { key: "bbc", name: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml", strip: null },
    { key: "cnn", name: "CNN", url: "https://news.google.com/rss/search?q=site:cnn.com+when:24h&hl=en-US&gl=US&ceid=US:en", strip: " - CNN" },
    { key: "fox", name: "Fox News", url: "https://moxie.foxnews.com/google-publisher/latest.xml", strip: " - Fox News" },
    { key: "aljazeera", name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", strip: " - Al Jazeera" },
  ];

  const out = {};
  await Promise.all(
    feeds.map(async (f) => {
      const xml = await fetchText(f.url);
      const items = [];
      if (xml) {
        const regex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
        let m;
        while ((m = regex.exec(xml)) !== null && items.length < 5) {
          const block = m[1];
          let title = decodeHtml((block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
          if (f.strip && title.endsWith(f.strip)) title = title.slice(0, -f.strip.length).trim();
          const link = decodeHtml((block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || "");
          const pubDate = decodeHtml((block.match(/<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] || "");
          if (title && link) items.push({ source: f.name, title, link, pubDate });
        }
      }
      out[f.key] = items;
    })
  );
  return out;
}

async function main() {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrowUtc = new Date(todayUtc.getTime() + 86400000);

  const [dotyRss, tdimRss, fallbackNews] = await Promise.all([
    fetchDaysOfTheYearRss(),
    fetchThisDayInMusicRss(),
    fetchFallbackNews(),
  ]);

  const [today, tomorrow] = await Promise.all([
    buildDayBundle(todayUtc, dotyRss, tdimRss, true),
    buildDayBundle(tomorrowUtc, [], [], false),
  ]);

  const payload = {
    updatedAt: new Date().toISOString(),
    today,
    tomorrow,
    fallbackNews,
  };

  const outPath = path.resolve("data/today.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(payload, null, 2) + "\n", "utf-8");
  console.log(`Updated ${outPath} for ${today.isoDate} & ${tomorrow.isoDate}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
