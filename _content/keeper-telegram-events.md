# The Keeper's Telegram — event catalogue
_v4, 2026-09-14. Supersedes the 2026-09-13 catalogue (v3) and the 2026-09-03 note. Reviewed by
two hostile critiques (security/privacy, product/correctness) before shipping; their findings
are folded in below._

## What this is for
Dan's brief: **read the feed as one person's story** — where they came in, what they tried,
where they hesitated, where they stopped. Not a metrics dashboard; a narrative log.

Every line has the same shape so a Telegram search for a tag reads a visit top to bottom:

    <icon> <tag> · <place> · <what happened>

- **tag** — the first 4 characters of a random `ps_vid` self-assigned by the browser and kept
  in localStorage until site data is cleared. Not a name. Not an email. Not an IP.
- **place** — Vercel edge geo. **Country only** for the world; **country + two-letter
  region** for US and CA. Never a city. Never a lat/long.

## A story, as it reads in Telegram
```
🚶 a3f1 · US · NY · arrives at home from pinterest · phone
❌ a3f1 · US · NY · guessed “SECRET” · at the front door
🔓 a3f1 · US · NY · opened Vault I · at the front door
👁 a3f1 · US · NY · at the 3D vault door
🎁 a3f1 · US · NY · opens the Vault I reward card
📥 a3f1 · US · NY · clicks the Vault I gift
📄 a3f1 · US · NY · Vault I reward downloaded          ← server-verified
🔤 a3f1 · US · NY · the word box appears at the second door
❌ a3f1 · US · NY · guessed “PUZZLE” · at the 3D word box
🚫 a3f1 · US · NY · closes the word box at the second door after 1 miss
🧭 a3f1 · US · NY · lingers in the study — 4 minutes without progress
👣 a3f1 · US · NY · steps away — 3D · 1 rooms · 14m · last the study
🆘 a3f1 · US · NY · opens the Hint Chamber
👀 a3f1 · US · NY · reveals the second word on /hints
```
That visitor bought nothing, but you know exactly which door beat them. (Note the order:
leaving `/vault` for `/hints` fires "steps away" *before* the Hint Chamber line.)

## The events, by phase

### Arrival and moving around the site
| Event | Where | When | extra |
|---|---|---|---|
| `arrive` | every page, once/session | First page of the visit | `<page> from <source> · phone\|desktop` — source is **one word from a fixed list** (`pinterest`, `youtube`, `google`, `amazon`, `mensa`, … or `another site`); `utm <tag>` wins when a link carries `utm_source`; `direct` when there is no referrer; omitted when internal |
| `page.view` | every page after the first | So home → shop → Amazon reads as three lines | page name |
| _visit_ (`/api/visit`) | both vaults, once per **mode** per session | The gate is passed | — |
| `bookcase.open` | 3D | The odd book swings the shelves aside | — |
| `wordbox.open` | both | Word box appears | door key → rendered as "at the second door" |
| `wordbox.close` | both | Word box dismissed **without** a true word (cancel / Esc / phone Back) | `door2 after 2 misses` or `door2 without a guess` — misses counted **since this box opened** |
| _unlock_ (`/api/unlock`) | homepage + both vaults | Every word attempt, right or wrong | says **where**: `at the front door` / `at the 3D word box` / `at the painted word box`. After 8 misses from one IP in 10 min the Keeper says so once, then stays quiet on misses (unlocks are never muted) |
| `door.open.II` / `.III` | both | A door swings after a true word | — |
| `stair.descend` / `stair.ascend` | 3D | Sanctum stair crossed | — |

### Reading
| Event | Where | When | extra |
|---|---|---|---|
| `page.notebook` | both | Keeper's notebook opened (once/session) | — |
| `page.rejects` | both | A discarded draft page opened (once/session) | — |
| `desk.solved` | 3D | Today's page solved at the writer's desk (the embedded `/play` stays silent) | `in 4m12s` |
| `study.complete` | 3D | Reserved; not yet wired | — |

### The two mini-games
| Event | Where | When | extra |
|---|---|---|---|
| `round.start` / `round.solved` / `round.fail` | both | Keeper's Round begins / five found / the dark kept them | `Five in 23.4s · best` / `with help` / `at their own pace` |
| `lock.start` / `lock.solved` | both | Listening Lock | — |
| `tile.5` / `tile.7` | both | Tile awarded (Round / Lock) | — |

### Rewards
| Event | Where | When |
|---|---|---|
| `reward.open.I..IV` | both | Reward card opens |
| `reward.click.I..IV` | both | Player clicks the download link (sendBeacon — survives iOS opening the PDF in-tab) |
| `reward.served.I..IV` | **server** | `/api/reward` streams the PDF — the truthful signal. Never accepted from a browser |

### Vault IV
| Event | Where | When |
|---|---|---|
| `vault4.floor_open` | both | The fourth word is true; the floor grinds aside |
| `vault4.entered` | both | Player enters the sanctum |
| `carve.open` | both | Carve panel opened |
| _carve_ (`/api/carve`) | both | Initials carved (server) |

### Friction — the "stuck" signals
| Event | Where | When | extra |
|---|---|---|---|
| `hint.view` | `/hints` | Page loaded (once/session). The clearest "I'm stuck" on the site | — |
| `hint.reveal` | `/hints` | A word revealed. **Only the act number travels, never the word** | `I`..`IV` |
| `idle` | both vaults | ~4 minutes visible with no pointer/key/scroll, once per room. Paused while the desk puzzle is open (its keystrokes live in an iframe) | `the library` |
| `perf.slow` | 3D | The low-frame-rate bar appeared | `12 fps` |
| `wordbox.close` / `round.fail` | both | (listed above) — abandoning a door, losing the Round | |

### The free puzzles
| Event | Where | When | extra |
|---|---|---|---|
| `play.start` | `/play` | First puzzle opened (once/session; not when embedded in the vault desk) | — |
| `play.solved` | `/play` | A puzzle solved | `easy · 3m12s · 4 total` |
| `play.offer` | `/play` | The one-time book nudge appeared (after 3 solves) | — |

### Passport / off-site / the last line
| Event | Where | When | extra |
|---|---|---|---|
| `passport.view` | `/passport` | Page loaded (once/session) | — |
| `outbound.amazon` | **every page** | Any Amazon / `amzn.to` link clicked (sendBeacon, survives navigation) | page name |
| `session.depth` | both vaults | **Every** tab-hide and pagehide, re-armed when the tab returns — so a glance at a text mid-visit does not end the story; the last one is the exit. Identical repeats are collapsed server-side | `3D · 4 rooms · 12m · last the library` |
| `share.copy` | reserved | Not yet wired | |
| _subscribe_ (`/api/subscribe`) | newsletter | `d***@domain joined the dispatch` | |

## What is NOT sent
- No IP address ever leaves the server. No city, no zip, no lat/long.
- No wrong-guess text unless it normalizes to A–Z (email-shaped inputs are dropped).
- No referrer hostname, ever — only a word from a fixed source list. (Telegram turns a bare
  `example.com` into a tappable link even with no `parse_mode`; that is why.)
- No user agent string — only `phone` / `desktop`, decided client-side from pointer type.
- No `parse_mode` on the Telegram call, so no markdown / HTML from any source can render.
- Crawlers that execute JS (Googlebot, Lighthouse, headless) are dropped by user agent on
  `/api/event`, `/api/visit` and `/api/unlock`, so `arrive` counts people.

## Extras are grammars, not free text
Anyone can POST to `/api/event`, so an `extra` is attacker-controlled. A character whitelist
was not enough (a hostname is all-whitelisted characters). Every event that carries an extra
now has an exact regex in `src/lib/events.js` → `EXTRA_RULES` — fixed vocabularies and digits,
matching precisely what our own clients produce. Anything else is dropped; the event still
goes through without its extra. Nothing that passes can spell a hostname, a phone number, or
a sentence the Keeper did not write. `validExtra()` is the only door in.

## Rate limiting (defence in depth)
- Per (`ip64`, `ev`, `extra`) cooldown: 5 minutes. `ip64` is IPv4 whole, IPv6 expanded then
  truncated to /64. Extra joins the key only for events that declare one, so "word box at
  door 2" and then "at door 3" both arrive.
- Per-IP burst cap: 40 accepted events / 5 min across all events. Varying `extra` does not
  raise this ceiling; it only changes which 40 lines — and the grammars fix what a line can say.
- Wrong guesses: 8 relayed per IP per 10 min, then one "going quiet" line, then silence.
- Global process breaker: 300 notifies / 60s hard ceiling, then a silent 60s mute.
- Serverless caveat: Vercel spawns N warm lambdas; each holds its own Maps and breaker. The
  Maps are a courtesy — the true backstop is the breaker plus Telegram's own limits. If
  distributed flooding ever matters, move the limiter to shared storage (Vercel KV).
- **Shared IPs:** two people on one Wi-Fi share cooldowns, so their stories can merge or lose
  a line. Accepted trade-off — throttling by the client-chosen tag would be trivially bypassed.

## Where the code lives
- `src/lib/events.js` — the vocabulary, `keeperLine()`, `EXTRA_RULES` / `validExtra()`.
  **Source of truth.**
- `public/js/events.js` — browser mirror. Also, on its own: `arrive` / `page.view`, the
  Amazon click ping, `psOnLeave` / `psIdleWatch` / `psMinutes` / `psBeacon` helpers.
- `src/scripts/vault3d.js` — has its own inline copy of the table (bundled; can't import the
  static file), plus its own idle / leave logic.
- `src/pages/api/event.js` — the pipe. `visit.js`, `unlock.js`, `carve.js`, `reward.js`,
  `subscribe.js` notify directly.
- `src/lib/keeper-telegram.js` — `notify`, `place`, `safeExtra`, `isBot`, the flood breaker.
- `scripts/verify-events.js` — fails if the three copies of the table drift.

## Adding an event (the checklist)
1. `src/lib/events.js` — add to `CLIENT_EV`, add a `parts()` line, and if it carries an extra
   add an exact regex to `EXTRA_RULES`.
2. `public/js/events.js` **and** `src/scripts/vault3d.js` — add the same key/string.
3. Emit it. `node scripts/verify-events.js` must pass.
4. Add a row here.
5. **Update `src/pages/privacy.astro` §2 and the FAQ answer** if the new event sends anything
   a visitor would not expect. The policy must never lag the code.

## Known blind spots (deliberate, for now)
- No duration for a visit that never enters a vault (`session.depth` is vault-only).
- An abandoned Listening Lock is not logged; repeated `round.start` within 5 min collapses.
- `door.open.I` is in the vocabulary but never emitted — the `visit` line already means the
  gate was passed.

## How to verify locally
```powershell
cd site
node scripts/verify-events.js
# TELEGRAM_DRYRUN=1 in .env prints lines instead of sending; then `npm run dev`
```
