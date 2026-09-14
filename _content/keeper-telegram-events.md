# The Keeper's Telegram — event catalogue
_Rewritten 2026-09-13. Supersedes the 2026-09-03 note that only tracked visits + word attempts + carvings._

## What Dan sees now
Every meaningful interaction on `puzzlesecret.com/vault`, `/passport`, and the reward
pipeline fires a single Keeper-voice line to the private Telegram chat, in the shape:

    <icon> <verb> · <solverTag> · <place>

- **solverTag** — the first 4 characters of a random `ps_vid` self-assigned by the
  browser. Not a name. Not an email. Not an IP. Clearing site storage resets it.
- **place** — Vercel edge geo. **Country only** for the world; **country + two-letter
  region** for US and CA. Never a city. Never a lat/long.

Both the 3D vault (`src/scripts/vault3d.js`) and the painted vault
(`public/js/painted-vault.js`) emit the same events using the same string constants,
imported from **`src/lib/events.js`** (server + Astro) and its browser mirror
**`public/js/events.js`**. Drift between the two files is caught by
`node site/scripts/verify-events.js`.

## The events, by phase

### Arrival
| Event | Where | When |
|---|---|---|
| `bookcase.open` | 3D | The odd book swings the shelves aside |
| `wordbox.open` | both | Word box appears (extra = `first`/`door2`/`door3`/`fourth`) |
| `door.open.II` | both | Vault II door swings open after a true word |
| `door.open.III` | both | Vault III door swings open after a true word |
| `stair.descend` | 3D | Player crosses down past the sanctum threshold |
| `stair.ascend` | 3D | Player climbs back up |

### Reading
| Event | Where | When |
|---|---|---|
| `page.notebook` | both | Keeper's notebook / letter opened (once/session) |
| `page.rejects` | both | A discarded draft page opened (once/session) |
| `study.complete` | 3D | Every study item marked (reserved; not yet wired) |

### The two mini-games
| Event | Where | When |
|---|---|---|
| `round.start` | both | The Keeper's Round begins |
| `round.solved` | both | Five found (extra = `"Five in Xs"`) |
| `lock.start` | both | The Listening Lock begins |
| `lock.solved` | both | Chest opens |

### The tiles
| Event | Where | When |
|---|---|---|
| `tile.5` | both | Awarded on Round completion |
| `tile.7` | both | Awarded on Lock completion |

### Rewards
| Event | Where | When |
|---|---|---|
| `reward.open.I..IV` | both | Reward card opens |
| `reward.click.I..IV` | both | Player clicks the download link on the card |
| `reward.served.I..IV` | server | `/api/reward` streams the PDF (truthful signal) |

### Vault IV
| Event | Where | When |
|---|---|---|
| `vault4.floor_open` | both | The lantern is lit; the floor grinds aside |
| `vault4.entered` | both | Player physically enters the sanctum |
| `carve.open` | both | Carve panel opened |

### Passport / off-site
| Event | Where | When |
|---|---|---|
| `passport.view` | passport.astro | Page loaded (once/session) |
| `outbound.amazon` | painted+passport | Any Amazon/`amzn.to` link clicked |
| `share.copy` | reserved | Not yet wired |
| `session.depth` | both, `pagehide` | Sent via `sendBeacon` (extra = rooms touched) |

## What is NOT sent
- No IP address ever leaves the server
- No city, no zip, no lat/long
- No wrong-guess text unless it normalizes to A–Z (email-shaped inputs are dropped)
- No `parse_mode` on the Telegram call, so no markdown / HTML from any source can render

## Rate limiting (defence in depth)
- Per (`ip64`, `ev`) cooldown: 5 minutes. `ip64` is IPv4 whole, IPv6 truncated to /64.
- Per-IP burst cap: 40 accepted events / 5 min across all events.
- Global process breaker: 300 notifies / 60s hard ceiling, then a silent 60s mute.
- Serverless caveat: Vercel spawns N warm lambdas; each holds its own Map. The Map is
  a courtesy — the true backstop is the global breaker plus Telegram's own limits.

## How to verify locally
```powershell
# Dry-run: don't actually hit Telegram, just log what would go
$env:TELEGRAM_DRYRUN = "1"; cd site; npm run dev

# In another shell, walk through each event and grep for the log lines
# (open /vault, open the notebook, take a tile, click a reward, etc.)
node site/scripts/verify-events.js
```
