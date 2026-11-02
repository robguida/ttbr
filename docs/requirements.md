# Travel The Back Roads: Requirements

Status: draft. Last updated 2026-11-02.
This is the short, living list of what the site must do and what has been decided. Each decision names who made it and when.

## Robots policy (decided by Rob, 2026-11-02)

The site tells robots who is welcome through `robots.txt`.

**Welcome:**
- Search engines: Google, Bing, Apple.
- Link-preview robots, so shared links show a title and picture: Facebook, LinkedIn, Pinterest, X, WhatsApp, Slack, Discord.
- AI search and answer robots that link back to the site: ChatGPT search, Claude search, Perplexity.

**Asked to stay out:**
- AI training robots: GPTBot, ClaudeBot, Common Crawl (CCBot), Bytespider, Google-Extended, Applebot-Extended.
- SEO-tool robots: Ahrefs, Semrush, MJ12, DotBot.

**Plain facts:**
- `robots.txt` is a polite request. A robot can ignore it.
- `robots.txt` never lists private folders. A list of hidden places would point people to them.
- Blocking Google-Extended does not remove the site from Google search.

## Visit reporting (standing)

- The visit report leads with "Readers": browsers that actually ran the site. Raw visitor-days come second, because robots inflate them.
- The site keeps no tracking cookies.

## Open questions

- Should the robot list be reviewed on a schedule, since new robots appear often? Suggest a check every 6 months.

## Maintenance plan

Update this file whenever Rob decides a new site requirement. Review for stale items every 6 months.
