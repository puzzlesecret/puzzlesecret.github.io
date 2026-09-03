# puzzlesecret.com — Improvement Plan (2026-09-02)
_Bird's-eye audit of the live site + codebase, then a plan to take the experience to 9.8/10.
Scope: the WEBSITE only (not marketing). Dan's two named asks: (1) a real animated
"safe cracking open" when the word is entered; (2) far better vault graphics, plus fun little
games / secret things so cracking a vault feels like a reward. "Improve upon all of it, don't
change it all."_

---

## 1. AUDIT — what a visitor actually experiences today

**Verified live in a browser (desktop + 375px mobile) and in code.**

### Strong — keep
- The fiction is coherent and the voice (Kokoro `bm_george`) is consistent everywhere.
- Secrets are genuinely server-gated (`/api/unlock`, salted hashes); 0 answer words in the bundle.
- A LOT exists: 3D crawl (4 rooms), the 9-page story hunt, the Register wall, the acrostic
  reveal, the Corsair's Chart easel, a text/illustrated fallback, passport stamps, /play arcade,
  Telegram funnel pings, honest newsletter.
- The three concept paintings (`public/art/rooms/*.webp`, 189 KB total) are **beautiful** —
  concept-art grade — and today they are only used as a small header image in the fallback card.

### Weak — ranked by how a visitor feels it
1. **The payoff moment is flat.** Typing the right word → a 1.4 s flare + a 2-px shake +
   a text line "The door swings wide. Step inside…" → 2.8 s wait → page navigation → a **black
   gate screen** with another "Step inside" button → a 2.2 s fade from black → the 3D study.
   Four steps, ~8 seconds, and **the door never opens.** This is the moment the whole book builds
   toward. (Screenshots: PRE vs LIVE landing are nearly identical apart from the console text.)
2. **The 3D rooms read as a prototype** next to the paintings: boxy geometry, visibly repeating
   stone, primitive props, a "gallery" of five dark smudged rectangles behind the treasure chest.
   Charming, but not "wow". ~900 draw calls also strains phones (the code already routes weak
   devices away from it).
3. **The reward is a download button in a modal.** After a cinematic walk there is nothing to
   *play*, nothing to *keep*, nothing to *show*. No collectible, no keepsake, no share.
4. **"Enter Volume I" spends the fireworks early** — boom + flare fire on Enter, so the real
   moment (the correct word) reuses the exact same effect.
5. Hygiene / trust:
   - `/vault` loads **Google Fonts from fonts.googleapis.com** while `/faq` promises *"zero
     external font tracking. All font assets are self-hosted."* A broken trust claim.
   - `/vault` sets `maximum-scale=1, user-scalable=no` (accessibility).
   - ~120 lines of CSS are duplicated verbatim in `vault.astro` (`.reward-card`, `.gold-btn`,
     `#wordbox`, `.tile` … twice).
   - `/hints` Act IV nudge 3 says "look at the left pedestal … one object is not lit"; the lantern
     actually sits on the floor in the far-left back corner of Vault III, not on a pedestal.
   - The review-ask panel (ROADMAP 1.3) is finished in the working tree but **uncommitted**.
   - The illustrated fallback is a form in a card, not an experience.

---

## 2. WHAT WAS BUILT (final, after three hostile critiques — see §5)

Everything below is in the working tree of `site/` as of 2026-09-02 (NOT yet committed or
deployed; Dan says "push" and it ships). Verified in a real browser, desktop + 375px phone,
production build clean, leak scan 0 non-innocent hits.

### A. THE DOOR OPENS — `src/pages/index.astro`
The cover art is a **single-leaf** vault door (hinges on the left, wheel in the centre), so the
slab swings as one piece on its hinges — never split (the critics were unanimous that a two-leaf
split would look cut in half). Beat sheet on a correct word (~6 s, click anywhere to skip):
0.0 a held breath · 0.4 / 0.85 / 1.3 three bolts draw back (the third only half-lands) with
jolts · 1.75 the fracture blazes to a blade of light, sparks, rumble, the wheel spins free ·
2.55 THE HOLD: the slab sits ajar with a gold rim down its free edge, the console clears, only the
Keeper's caption stays as a subtitle · 3.3 the slab swings inward on the painted Writer's Study
while the Keeper speaks INTO the opening and the camera pushes in with the swing · 5.6 blackout →
`/vault?from=door`, whose gate is the same painting. Also: a mechanical tick per typed letter,
a clunk + seam-dim on a wrong word, a "the first door remembers you" shortcut for returning
solvers, `/vault` prefetched on success, full `prefers-reduced-motion` branch (plain crossfade).
Technique: a JS-sized box with the cover's exact aspect (percent = picture coordinates); the
room sits behind a plate-shaped window; the slab is built lazily on success from the same image.

### B. THE HAND-OFF — `/vault?from=door`
Both vault modes show the study painting as the gate backdrop; one pulsing "Step inside".
Audio cannot survive a navigation in any browser, so the gate stays a real click.

### C. THE PAINTED VAULT is now the front door — `src/components/FlatVault.astro` +
`public/js/painted-vault.js` (plain script, no three.js; the 3D crawl is a dynamic import in
`src/scripts/vault3d.js` and is only downloaded for `?mode=3d`, the "walk it in 3D" chip, or
the drawer link; the choice is remembered in `localStorage.ps_vault_mode`).
Point-and-click on the three approved paintings: cover-fit room box that pans on portrait
phones (drag, plus a slow idle drift), mouse parallax + a cursor light on desktop, breathing
light pools (two incommensurate sines + a rare gutter) with a warm multiply layer, dust motes
in the strongest light, Ken Burns that pauses while you aim, the room ambience synth per room.
Hotspots are invisible until you draw near (the object warms — no rings); `✦ show` / `H`
reveals everything (on by default for touch). Everything the 3D crawl has: rewards, the two
sealed doors + the fourth-secret "something unlit" (drawn dark, never glowing), all nine story
pages (same `ps_story_v1`), the Sanctum in HTML (lit lamp, the Register with live marks, the
gilded acrostic parchment, the covered Chart, the stair), the Register carve, the same Keeper
VO map and captions. Plus micro-interactions with persistence (snuff/relight the candle, the
quill, the pinboard, the reject, the shelves, the discs, the cryptex, the machines, the boxes,
the seals, the ledgers, the gems…). Room strip I·II·III·IV: a sealed numeral opens its word box.

### D. REWARDS — two games, key-tiles, the certificate
- **The Keeper's Round** (library): lights out, the cursor/finger carries the light, the Keeper
  names five objects, 60 s, best time kept. Awards **key-tile 5**.
- **The Listening Lock** (the locked chest, treasure): a 40-position dial, drag or arrow keys;
  the tick sharpens and the dial trembles as you near each of three tumblers; hold still and
  it falls. Awards **key-tile 7**. Both → **the Keeper's Mark** on the certificate.
  (The cipher-wheel and 4×4-sudoku games from v2 were CUT: one leaked Act III's mechanic to a
  Vault I solver, the other insulted someone who just solved 200 grids.)
- **The Certificate** — `public/js/keeper-certificate.js`: canvas PNG, initials drawn
  client-side only, vaults, pages, date, a serial that looks like a code (and decodes to
  nothing), gold seal, "PUZZLESECRET.COM". Download, Web Share where files can be shared, and
  the image itself for press-and-hold on iOS. Offered from the passport once any vault is
  cracked, and the vault points there after III/IV — deliberately NOT in the review-ask modal.
- **Passport**: key-tiles row, a standing (only the EARNED title is ever rendered), the
  certificate box, a Volume II slot "waiting for a book still being drawn", honest copy
  ("gifts open to anyone; stamps, tiles and certificate are yours alone"), "Puzzles Unlocked".

### E. 3D crawl: untouched apart from the from-door gate, the "see it painted" chip, and the
split into its own module. Bloom was CUT (all three critics: spend the effort on the paintings).

### F. Hygiene: self-hosted fonts on /vault (the FAQ promise is true again), zoom allowed,
~120 duplicated CSS lines removed, the Act IV hint corrected, shop copy reconciled with the
passport, the drawer lists the vaults (painted) and the 3D walk separately.

### How to flip the default back to 3D (one line)
`src/components/FlatVault.astro`, inline script: `var want3d = pref === '3d';` →
`var want3d = pref !== 'painted';`

### Update 2026-09-03 — the Sanctum is painted too
Dan approved Gemini artwork, so Vault IV now has its own painting (`public/art/rooms/sanctum.webp`,
1600 px, 66 KB): the lamp, lit, over a pedestal with the glowing tome; the register plaque on the
left wall; the framed letters on the right; the covered Chart on an easel; the stair back up.
Generated with Nano Banana in Dan's `dshcorporations@gmail.com` Gemini Pro profile (a first copy
also exists in `genxaijourney`'s chat); source saved at
`assets/vault_concepts/vault4_secret_sanctum_v1.jpg`. The HTML sanctum is gone; the register and
the acrostic open as panels from their painted objects.

### Update 2026-09-03 — Dan's call: the 3D crawl is the default
`/vault` always loads the 3D crawl; the painted vault is reached only via the small link under
the gate button (`?mode=painted`) or the drawer. Nothing is remembered. Arriving from the
landing's opened door skips the gate entirely (sound and the Keeper's entry line start on the
first tap, because browsers refuse audio before a gesture); a direct visit shows one gate only.
The earlier "flip the default" note above is obsolete: `FlatVault.astro`'s inline script now
reads `var want3d = !(mode === 'painted' || flat === '1')`.

### Not done / ideas parked
- The "missing 2" easter egg (the cover's number column has no 2 — designer's suggestion).
- Spot-the-difference / cut-out layers per painting (needs offline alpha cutting).
- Real-device iOS pass (audio unlock, share sheet, press-and-hold save).

---

## 2b. THE PLAN AS IT WAS (v2, before the critiques — kept for the record)

 (v2 — after two self-critique passes)

Build order = leverage order. Every item is additive; nothing existing is removed.

### A. THE DOOR OPENS — the landing cinematic  ⭐ Dan's ask #1
The cover art *is* a vault door with a jagged glowing crack down the middle. **Split the door
along that actual crack into two leaves and swing them open.**
- Offline: trace the seam from `door-v10.webp` (brightest-pixel centroid per row, smoothed) →
  bake two complementary `clip-path: polygon(…)` shapes (left leaf / right leaf).
- The door box gets a fixed 1200:1788 aspect that covers its container, so clip percentages map
  exactly onto image pixels at every viewport size. The 5-volume hover crossfade keeps working
  (all five layers live inside both leaves; closed leaves tile seamlessly whatever the cut).
- **Behind the door: the painted Writer's Study** (`/art/rooms/study.webp`), over-exposed gold
  at first, settling as the door opens, with dust motes and a slow push-in.
- **Sequence on the correct word (~4.5 s):**
  1. three bolt thuds (new Web Audio `playBolts`), the door jolts with each;
  2. the seam blazes white-gold, sparks burst, low rumble (existing `igniting` effects);
  3. the leaves part — a short translate apart, then `rotateY` inward (into the lit room) with
     `perspective`, origin at the outer edges, ~2.2 s ease-in-out; each inner edge carries a
     bright rim-light gradient and a dark "thickness" edge so the leaves read as heavy steel,
     not paper; stone groan (`playCreak`, ported from /vault);
  4. the room behind blooms then settles; the console text softens away so the room is seen;
  5. camera push-in (stage scales toward the opening, vignette tightens);
  6. crossfade → `/vault?from=door`.
- Wrong word: existing shudder + a new dial "clunk" + the seam dims for a beat.
- "Enter Volume I": keep the boom, but the door stays shut (nothing earned yet).
- Each typed letter: a soft mechanical tick + tile glow (tactile entry).
- **Return visitor** who already cracked a vault (`ps_vaults_v1`): the console offers
  *"The first door remembers you — step through"* → `/vault` directly, no re-typing.
- `prefers-reduced-motion`: leaves fade out, room fades in, no 3D transforms.

### B. THE HAND-OFF — /vault continuity
- `/vault?from=door`: the gate's backdrop becomes the same painted study (no black wall), the
  gate copy shrinks to one pulsing "Step inside", and the 3D fade-in starts from the painting.
  Landing → vault reads as one continuous shot.

### C. THE PAINTED VAULT — the illustrated mode becomes a first-class experience  ⭐ ask #2
The cheapest, biggest graphics jump: **use the concept paintings as the rooms** (point-and-click
adventure style: Myst / Monkey Island), instead of only as a thumbnail in a form.
- Full-bleed painting per room, slow Ken-Burns drift + mouse/gyro parallax (painting, a light
  layer, a foreground vignette + dust motes).
- **Living light**: candle/sconce flicker as animated radial gradients placed over each
  painting's light sources; embers; the existing synthesized room ambience.
- **Hotspots** (pulsing gold rings): the reward object; the next door (sealed → word box); the
  three story pages per room (same 9-page hunt, same `ps_story_v1` key as 3D, so progress is
  shared); the mini-game object (§D); and **secret micro-interactions** (snuff/relight the
  candle, a crumpled reject that the Keeper grumbles about, a chess piece that moves).
- Room strip at the bottom: I · II · III · IV with sealed/open state; arrows to move between
  opened rooms.
- **Vault IV** has no painting by design ("never lit"): a dark HTML room — the lit lantern
  (CSS), the Register wall, the acrostic letters, the Corsair's Chart easel.
- Same Keeper captions + VO map; same `/api/unlock` and `/api/carve`.
- **Mode choice** at the gate: two equal picture buttons — *Walk it in 3D* / *Explore the
  painted vault*. Default stays 3D on capable desktops (unchanged); phones / weak devices
  default to painted (already routed there). Choice remembered.

### D. REWARDS THAT FEEL LIKE REWARDS
1. **Three mini-games, one per vault** (30–90 s each, in the fiction, one shared plain-HTML
   module used by both 3D and painted modes). None gates a PDF. None is sudoku (they just did
   200). Each awards a **Keeper's Coin** (persisted, shown on the passport).
   - **Vault I — The Burned Note**: a scrap on the desk shows a short line in the book's own +3
     cipher and a two-ring wheel to drag; align it and the line reads clear — a one-line clue
     to where the coin is hidden in the room. (Teaches Act III's mechanic, playfully.)
   - **Vault II — Shelve the Story**: the nine manuscript pages are mis-shelved as book spines;
     tap-swap them into order 1–9; the shelf slides aside, coin behind it. (Ties to the story hunt.)
   - **Vault III — The Combination Chest**: a 4×4 mini "Sudoku with a Secret" on the lid with
     three shaded cells; solve it, read the shaded digits, set the three dials; lid opens with a
     coin burst. (The book's mechanic in miniature.)
   - **Three coins → the Keeper's Seal**: unlocks the gold-sealed certificate (below) and one
     extra Keeper line. Coins are skill-based bonus content — no chance, no "win/prize" wording.
2. **The Certificate** (canvas → PNG, download + Web Share on mobile): *"Cracked the Keeper's
   Vault"* — initials (typed locally, never sent), date, vaults opened, cover art, gold seal,
   puzzlesecret.com. Offered at Vault III & IV and on the passport. Non-spoiling. This is the
   keepsake and the word-of-mouth artifact (ROADMAP 1E, never built).
3. **Passport upgrade**: coins row, certificate button, a rank title
   (Apprentice → Solver → Keeper's Equal → Keeper of the Fourth).

### E. 3D CRAWL POLISH (keep it, make it prettier where cheap)
- **Bloom + vignette** post-processing (three `UnrealBloomPass`) on capable desktops only, with a
  toggle; candles, seals and the glowing stack read painterly. Auto-off if the fps watchdog dips.
- Fix the smudged gallery: brighter gallery light, larger frames.
- Pulsing hotspot rings on interactables (so "click what glows" is unambiguous).
- Mini-game objects placed in the 3D rooms too (note on the desk, a shelf, the chest dial).

### F. TRUST & HYGIENE
- `/vault`: self-hosted fonts (`/fonts/fonts.css`) instead of Google Fonts.
- Remove `user-scalable=no`; dedupe the CSS; fix the Act IV hint wording; commit the review ask.
- Pre-deploy leak scan of `dist/client` (both cases) — mandatory.

---

## 3. CONSTRAINTS (from CLAUDE.md — non-negotiable)
- Answer words never in client code or captions (CLEVER / SOLVERS / TRIUMPH / LANTERN).
- Images: Google Gemini only — **no new AI images this pass**; everything here uses existing art
  or CSS/canvas. Never Higgsfield.
- No "win/prize" language; rewards are bonus content, never tied to reviews, never email-gated.
- COPPA: no new personal data. Certificate initials are rendered client-side only.
- Keeper voice lines: only existing recordings; new captions run silent (never browser TTS).
- Nothing is priced/sold here; Amazon link untouched.

## 4. SELF-RATING
- v1: 9.3 · v2: 9.6 (my own scores before critique).
- The three critics scored v2 at **8.1 / 7.5 / 7.5** and agreed on the same corrections:
  single-slab door, kill the mode-choice screen (painted is the front door), cut bloom and two
  of the three games, add a held beat and the Keeper's voice to the opening, make room state
  persistent, fix the phone routing, and keep the certificate away from the review ask.
- v3 (built): every one of those is in. My honest score for what shipped: **9.5** — the door,
  the painted rooms and the sanctum are the wow; the two games are good; the 0.3 that remains
  is a real-device iOS pass and per-painting cut-out layers.

## 5. THE CRITIQUES (2026-09-02)
Three hostile reviews were run on v2 by separate agents: a game/experience designer, a
principal front-end engineer, and a cold first-time tester paired with a brand/conversion
strategist. Their top findings are folded into §2 above. The shared verdicts: the two-leaf
door and the two-button mode gate were the plan's two central mistakes; the paintings are the
asset; persistence and a held silent beat sell "place" better than any particle system.
