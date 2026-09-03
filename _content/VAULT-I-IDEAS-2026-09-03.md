# Vault I (The Writer's Study) — making the first door worth opening
_Ideas only, 2026-09-03. Nothing here is built. Dan's brief: after the first word, people should feel they
received something — entertained, more to discover, simple puzzles, word puzzles, maybe a playable
sudoku on the desk. Keep it simple; never lose the goal (sell the series). Dan decides._

## What Vault I is today (3D crawl, the default)
Walk in → glowing stack on the desk (50-puzzle PDF) → three story pages on the floor (1, 4, 7) →
the bookcase swings open on its own as you approach → corridor → Door II (sealed).
Clickable things: 2 (+3 pages). Desk, chair, candle, sconce, pinboard, quill, inkwell, the four
bookcases and the crumpled rejects do nothing. The Keeper says one line on entry and one at the
stack. There is no game, no reason to stay, no reason to come back, and no sign of Volume II.
The painted vault (behind the small link) has the object lines and the candle; the 3D room has
none of that yet.

## Candidate ideas (ranked by value ÷ effort; effort in sessions of work)

### 1. Sit at the Keeper's desk — a playable sudoku, right there  ★ Dan's own thought
Click the chair → the camera settles at the desk, a parchment grid slides into view, and you
play a real puzzle from the existing 200-puzzle arcade engine (pencil notes, checking, hints
already built at /play). Themed as a page in the Keeper's hand, not a web widget.
- **The Keeper's Daily Page**: one puzzle per day (date-seeded from the arcade's 200), a
  best-time kept locally, a quiet "come back tomorrow — I will have set another" line.
  A reason to return to the vault, which is a reason to see Volume II again.
- Solving it inks a stamp on the page ("solved at the Keeper's desk") — collect seven and the
  desk yields a small extra (a printable bookmark, or ten "Keeper's favourite" puzzles).
- Effort ~1 session: add an `?embed=1&puzzle=N` mode to /play (no header/footer), show it in
  the 3D overlay as an iframe framed as parchment. No new puzzle content needed.

### 2. A "things to find in this room" counter  (cheap, big effect)
A small HUD line: *"5 of 9 things found in the study."* It turns a static room into a hunt and
tells people there IS more here. Ticks up on: the stack, each page, the candle, the quill, the
pinboard, the reject, a book, the chair. Effort ~½ session (needs #3).

### 3. Every object answers  (parity with the painted vault)
Click the candle (snuff/relight, it stays that way), the quill, the inkwell, the pinboard, the
crumpled reject, a bookshelf — the Keeper says a line, the same lines the painted vault already
has. Cheap, and it makes the room feel inhabited. Effort ~½ session.

### 4. Pull a book — the lever, and the Keeper's Notebook
The bookcase currently opens itself. Instead: the spines are pullable; most give a Keeper quip
("Not that one."); one is the lever and the case swings with a satisfying clunk. Keep the
auto-open as a fallback after ~20 s so nobody is stuck. Plus one special book on the desk,
**the Keeper's Notebook**: a flippable 6-page booklet — how to spot a key cell, three solving
tricks, a page of lore, and the last page a pencil sketch of the Corsair's Chart with "Volume II
— being drawn." The on-goal tease lives inside a reward, not a banner. Effort ~1 session.

### 5. Word puzzles on the pinboard
The pinboard of grids becomes a small word game: **the Keeper's Ledger** — a 5-clue mini
crossword from the book's own world (KEEPER, VAULT, SEAM, GRID, CIPHER-free words), or an
unscramble. Answers must never be an answer word. Solving pins a gold tack on the board.
Effort ~1 session for a crossword renderer + ten hand-written puzzles.

### 6. The riddle drawer under the desk
A locked drawer with a one-line riddle (the Keeper's voice). Type the answer → the drawer
slides out with something small and real: a printable "Keeper's bookmark" PDF or a wallpaper of
the door. Ten riddles rotating by date. Effort ~½ session. Risk: riddles are easy to Google and
the answer must never collide with the four words.

### 7. A page from Volume II, on the desk
A rolled chart on the desk: "a draft page from The Corsair's Chart." Unroll it → one real
puzzle from the Volume II dataset (which exists and is verified), key layer stripped, styled in
emerald. Playable via the same embed. The strongest series hook in the room — but it is Dan's
future product; showing one of eighty grids is a marketing decision. Effort ~½ session on top
of #1.

### 8. A speed-solve at the desk (the Keeper's wager)
Same embed, a 6×6 mini grid, a timer, your best time kept. "Beat me: under four minutes." Cheap
once #1 exists. Effort ~¼ session.

### 9. Lower priority / parked
- Hidden-object round in 3D (the painted vault already has one; the 3D room is small).
- Ambient touches (a clock, fire) — mood, not value.
- Register/certificate for Vault I alone — the passport certificate already appears after any vault.

## Guardrails that apply to all of them
No answer word anywhere in client code or captions. Nothing gates the PDFs. No win/prize/chance
language, no email gate, no review tie-in. Rewards are skill-based bonus content. Every new
puzzle is machine-checked (unique solution) like the book's.

## My recommended package (simple, on-goal)
**#1 desk sudoku (daily) + #2 counter + #3 object lines + #4 notebook with the Volume II last page.**
About three sessions. It gives the first-word solver a place to sit and play, a room that talks
back, a reason to return, and the series tease delivered as a gift rather than an ad.

---

## After three critiques (game designer · reader+strategist · engineer), 2026-09-03

Scores for the original package: 6 / 6.5 / (engineer: 3.5–4.5 sessions, not 3). What they agreed on:
- **Object lines + the candle** in the 3D room: cheapest, biggest felt change (copy already exists in the painted vault).
- **The Keeper's Notebook** on the desk, last page = the Corsair's Chart sketch: the best item; and
  **move the covered Chart into the study** — today it sits in the treasure room behind two sealed
  words, visible only to people who need no persuading.
- **Fix "Pages found: 1 of 9"** (tells a first-word reader they failed) → room-scoped counts.
- **Cut** the riddle drawer, the crossword, the pull-a-book lever (friction), any streaks, the word "wager".
- **Desk sudoku**: keep the idea, change the shape — a seated camera, the grid on the parchment,
  ONE new Keeper line per day (the line is the reason to return, the grid is the excuse),
  cumulative stamps only. Iframe of /play in embed mode ships in ~1.25 sessions; a 6×6 "beat the
  Keeper in four minutes" needs the engine extracted first (later).
- **Hold the playable Volume II page** until Volume 2 has a date (a dated promise on a paused book
  reads as a stalled series); show the sketch only.
- New idea worth keeping: **the crumpled rejects unfold into broken drafts** ("Two answers. Burn it.").
- Checked and cleared: the arcade's key digits are NOT the book's (different 200 puzzles).
- Flagged for Dan: the Door II/III word box shows exactly seven cells (publishes the word length).

---

## BUILT 2026-09-03 (Dan: "build them all"; in the working tree, not yet pushed)
- **Every object answers** in the 3D study: quill/inkwell, pinboard, the four bookcases, the sconce,
  the candle (snuff/relight, remembered in `ps_study_v1`).
- **The Keeper's Notebook** on the desk's edge: five pages (spotting a key, scanning, the lonely
  candidate, pairs) and a last page with the Corsair's Chart sketch — "still being drawn… it will
  not be kinder than this one. When it is finished, it will be where the first one was."
- **The Corsair's Chart easel** now stands in the study's back-right corner (the sanctum keeps its own).
- **Three rejects unfold** into 4×4 drafts with exactly two answers (machine-verified); two buttons
  show each answer with the swapped cells highlighted; the Keeper explains why it went in the fire.
- **The desk**: click the chair, the eye settles at the desk, and today's page from the arcade is
  played inside a parchment frame (`/play?embed=1&daily=1` — a 200-day cycle, no repeats); one new
  Keeper line per day (30 lines rotating); pages solved at the desk are counted in `ps_desk_v1`,
  cumulative only, never streaks.
- **"Found N of 15 in the study"** under the room name, and the exit line into the corridor.
- **Fixes**: story-page card is room-scoped ("Found in this room: 1 of 3"); the word box no longer
  shows a fixed seven cells (tiles grow as you type, both modes); and a LIVE bug on `/play` — the
  picker and the book-nudge modals were displayed on load because `display:flex` beat `hidden`.
- While an overlay is up the 3D scene renders every third frame.

## Round 3 — 2026-09-03 (Dan's three fixes; built, tested by two sub-agents, not yet pushed)
- **Back button never throws you out of the vault**: a page-level guard (in `vault.astro`, installed
  before either scene loads) keeps two history entries of its own; Back closes whatever overlay is
  open, a Back with nothing open warns once, a second Back within 12 s leaves. Both modes.
- **The rejects are real book pages**: three 9×9 grids with exactly two answers (deadly rectangle;
  `public/data/rejects.json`, machine-verified, unlike any book/arcade puzzle) drawn inside the
  book's own printed page borders (`public/art/page-border-*.webp`, from `art_out/`), with a red
  REJECTED stamp and an A/B answer toggle. Also in the painted study.
- **Five free puzzles a day on the homepage**: 2 easy · 2 medium · 1 hard chosen by calendar day,
  played in a modal frame of the arcade (`/play?embed=1&puzzle=N`), progress saved per puzzle,
  solved cards tick. The full arcade stays one link below.
- **The arcade is playable on a phone**: the JS-built cells never received Astro's scoped CSS, so
  the grid was an unstyled photo (live bug). Cell rules are global now: cream squares on the
  parchment, ink lines, blue entries, live conflict reds, long-press pencil, 9-wide numpad, saved
  progress, keyboard focus, no alert().
- Sub-agent tests: code review (7 confirmed bugs, all fixed) + a browser walkthrough (all tests
  passed; arcade playability scored 8.5 before the final fixes).
