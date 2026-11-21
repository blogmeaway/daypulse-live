# DayPulse.live

Automated daily cultural almanac featuring World & National Days, Music History, Notable Birthdays, 4 Global News Headlines (BBC, CNN, Fox News, Al Jazeera), Word of the Day, Daily Trivia, and IP-localized weather.

## Quick Setup (GitHub + Cloudflare Pages)

1. **Upload all files** from this folder into your GitHub repository (`daypulse-live`).
2. **Enable GitHub Actions write permissions:**
   - Go to **Settings -> Actions -> General -> Workflow permissions**
   - Select **Read and write permissions** and click **Save**.
3. **Run the first data update:**
   - Go to **Actions -> DayPulse Daily Update -> Run workflow**.
4. **Connect to Cloudflare Pages:**
   - In Cloudflare Dashboard go to **Workers & Pages -> Create -> Pages -> Connect to Git**
   - Select `daypulse-live`, leave Build command empty, set Build output directory to `/`, and click **Save and Deploy**.
   - Attach your custom domain `daypulse.live` under **Custom domains**.
